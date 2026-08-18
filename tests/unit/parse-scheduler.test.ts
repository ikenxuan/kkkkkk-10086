import { describe, expect, it, vi } from 'vitest'

import {
  ParseScheduler,
  type ParseSchedulerStateEvent
} from '../../src/module/utils/ParseScheduler.js'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

const createDeferred = <T>(): Deferred<T> => {
  let resolveDeferred!: Deferred<T>['resolve']
  let rejectDeferred!: Deferred<T>['reject']
  const promise = new Promise<T>((resolve, reject) => {
    resolveDeferred = resolve
    rejectDeferred = reject
  })

  return {
    promise,
    resolve: resolveDeferred,
    reject: rejectDeferred
  }
}

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('ParseScheduler', () => {
  it('enforces bounded concurrency and starts queued tasks in FIFO order', async () => {
    const scheduler = new ParseScheduler({ concurrency: 2 })
    const firstGate = createDeferred<string>()
    const secondGate = createDeferred<string>()
    const thirdGate = createDeferred<string>()
    const fourthGate = createDeferred<string>()
    const starts: string[] = []
    let running = 0
    let maxRunning = 0

    const submit = (fingerprint: string, gate: Deferred<string>): Promise<string> => (
      scheduler.submit(fingerprint, async () => {
        starts.push(fingerprint)
        running += 1
        maxRunning = Math.max(maxRunning, running)
        try {
          return await gate.promise
        } finally {
          running -= 1
        }
      })
    )

    const first = submit('first', firstGate)
    const second = submit('second', secondGate)
    const third = submit('third', thirdGate)
    const fourth = submit('fourth', fourthGate)

    await flushMicrotasks()

    expect(starts).toEqual(['first', 'second'])
    expect(scheduler.getSnapshot()).toEqual({
      concurrency: 2,
      running: 2,
      queued: 2,
      pending: 4,
      runningFingerprints: ['first', 'second'],
      queuedFingerprints: ['third', 'fourth']
    })

    secondGate.resolve('second-result')
    await expect(second).resolves.toBe('second-result')
    await flushMicrotasks()
    expect(starts).toEqual(['first', 'second', 'third'])

    firstGate.resolve('first-result')
    await expect(first).resolves.toBe('first-result')
    await flushMicrotasks()
    expect(starts).toEqual(['first', 'second', 'third', 'fourth'])

    thirdGate.resolve('third-result')
    fourthGate.resolve('fourth-result')
    await expect(Promise.all([third, fourth])).resolves.toEqual([
      'third-result',
      'fourth-result'
    ])

    expect(maxRunning).toBe(2)
    expect(scheduler.getSnapshot()).toEqual({
      concurrency: 2,
      running: 0,
      queued: 0,
      pending: 0,
      runningFingerprints: [],
      queuedFingerprints: []
    })
  })

  it('times out a permanently pending task and releases its slot for queued work', async () => {
    vi.useFakeTimers()
    const stuckGate = createDeferred<void>()
    const starts: string[] = []
    const scheduler = new ParseScheduler({
      concurrency: 1,
      timeoutMs: 50
    })
    const stuck = scheduler.submit('stuck-link', async () => {
      starts.push('stuck-link')
      await stuckGate.promise
    })
    const next = scheduler.submit('next-link', () => {
      starts.push('next-link')
      return 'next-result'
    })
    const stuckAssertion = expect(stuck).rejects.toMatchObject({
      name: 'RequestTimeoutError',
      code: 'ERR_REQUEST_TIMEOUT',
      timeoutMs: 50
    })

    try {
      await flushMicrotasks()
      expect(starts).toEqual(['stuck-link'])

      await vi.advanceTimersByTimeAsync(50)
      await flushMicrotasks()

      expect(starts).toEqual(['stuck-link', 'next-link'])
      await stuckAssertion
      await expect(next).resolves.toBe('next-result')
      expect(scheduler.getSnapshot()).toMatchObject({
        running: 0,
        queued: 0,
        pending: 0
      })
    } finally {
      stuckGate.resolve()
      await Promise.allSettled([stuck, next])
      vi.useRealTimers()
    }
  })

  it('deduplicates queued and running fingerprints onto the exact same promise', async () => {
    const events: ParseSchedulerStateEvent[] = []
    const scheduler = new ParseScheduler({
      concurrency: 1,
      onState: event => events.push(event)
    })
    const blockerGate = createDeferred<void>()
    const parseGate = createDeferred<string>()
    let executions = 0

    const blocker = scheduler.submit('blocker', () => blockerGate.promise)
    const original = scheduler.submit('same-link', async () => {
      executions += 1
      return await parseGate.promise
    })
    const queuedDuplicate = scheduler.submit('same-link', () => 'must-not-run')

    expect(queuedDuplicate).toBe(original)
    expect(events
      .filter(event => event.fingerprint === 'same-link')
      .map(event => event.state)
    ).toEqual(['queued', 'deduplicated'])

    blockerGate.resolve()
    await blocker
    await flushMicrotasks()

    expect(executions).toBe(1)
    const runningDuplicate = scheduler.submit('same-link', () => 'must-not-run')
    expect(runningDuplicate).toBe(original)

    parseGate.resolve('shared-result')
    await expect(Promise.all([
      original,
      queuedDuplicate,
      runningDuplicate
    ])).resolves.toEqual([
      'shared-result',
      'shared-result',
      'shared-result'
    ])

    expect(events
      .filter(event => event.fingerprint === 'same-link')
      .map(event => event.state)
    ).toEqual([
      'queued',
      'deduplicated',
      'running',
      'deduplicated',
      'succeeded'
    ])
    expect(events).toContainEqual(expect.objectContaining({
      fingerprint: 'same-link',
      state: 'succeeded',
      result: 'shared-result'
    }))

    const afterCleanup = scheduler.submit('same-link', () => {
      executions += 1
      return 'fresh-result'
    })

    expect(afterCleanup).not.toBe(original)
    await expect(afterCleanup).resolves.toBe('fresh-result')
    expect(executions).toBe(2)
  })

  it('continues with the next queued task after a task fails', async () => {
    const events: ParseSchedulerStateEvent[] = []
    const scheduler = new ParseScheduler({
      concurrency: 1,
      onState: event => events.push(event)
    })
    const starts: string[] = []
    const failure = new Error('parse failed')

    const failed = scheduler.submit('failed-link', () => {
      starts.push('failed-link')
      throw failure
    })
    const failedAssertion = expect(failed).rejects.toBe(failure)
    const succeeded = scheduler.submit('next-link', () => {
      starts.push('next-link')
      return 'ok'
    })

    await failedAssertion
    await expect(succeeded).resolves.toBe('ok')

    expect(starts).toEqual(['failed-link', 'next-link'])
    expect(events).toContainEqual(expect.objectContaining({
      fingerprint: 'failed-link',
      state: 'failed',
      error: failure
    }))
    expect(events).toContainEqual(expect.objectContaining({
      fingerprint: 'next-link',
      state: 'succeeded',
      result: 'ok'
    }))
    expect(scheduler.getSnapshot()).toMatchObject({
      running: 0,
      queued: 0,
      pending: 0
    })
  })

  it('rejects invalid concurrency limits', () => {
    expect(() => new ParseScheduler({ concurrency: 0 })).toThrow(RangeError)
    expect(() => new ParseScheduler({ concurrency: 1.5 })).toThrow(RangeError)
  })
})
