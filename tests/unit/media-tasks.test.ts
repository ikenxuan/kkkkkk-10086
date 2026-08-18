import { describe, expect, it, vi } from 'vitest'

import {
  runMediaTasks,
  type MediaTaskFailure
} from '../../src/module/utils/MediaTasks.js'

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

describe('runMediaTasks', () => {
  it('starts poster and video before either task settles', async () => {
    const posterGate = createDeferred<void>()
    const videoGate = createDeferred<void>()
    const starts: string[] = []

    const execution = runMediaTasks({
      poster: async () => {
        starts.push('poster')
        await posterGate.promise
      },
      video: async () => {
        starts.push('video')
        await videoGate.promise
      }
    })

    await flushMicrotasks()
    expect(starts).toEqual(['poster', 'video'])

    posterGate.resolve()
    videoGate.resolve()
    await expect(execution).resolves.toEqual({
      succeeded: ['poster', 'video'],
      failures: []
    })
  })

  it('times out a permanently pending branch without blocking its parallel peer', async () => {
    vi.useFakeTimers()
    const posterGate = createDeferred<void>()
    const videoGate = createDeferred<void>()
    const starts: string[] = []
    const failures: MediaTaskFailure[] = []
    let videoFinished = false
    let executionSettled = false

    const execution = runMediaTasks({
      poster: async () => {
        starts.push('poster')
        await posterGate.promise
      },
      video: async () => {
        starts.push('video')
        await videoGate.promise
        videoFinished = true
      }
    }, {
      timeoutMs: 50,
      onTaskFailure: failure => failures.push(failure)
    })
    const settleObserver = execution.then(
      () => { executionSettled = true },
      () => { executionSettled = true }
    )

    try {
      await flushMicrotasks()
      expect(starts).toEqual(['poster', 'video'])

      videoGate.resolve()
      await flushMicrotasks()
      expect(videoFinished).toBe(true)
      expect(executionSettled).toBe(false)

      await vi.advanceTimersByTimeAsync(50)
      await flushMicrotasks()

      expect(executionSettled).toBe(true)
      const result = await execution
      expect(result.succeeded).toEqual(['video'])
      expect(result.failures).toEqual([{
        task: 'poster',
        error: expect.objectContaining({
          name: 'RequestTimeoutError',
          code: 'ERR_REQUEST_TIMEOUT',
          timeoutMs: 50
        })
      }])
      expect(failures).toEqual(result.failures)
    } finally {
      posterGate.resolve()
      videoGate.resolve()
      await Promise.allSettled([execution, settleObserver])
      vi.useRealTimers()
    }
  })

  it.each([
    ['poster', 'video'],
    ['video', 'poster']
  ] as const)('lets %s fail without cancelling %s', async (failedTask, successfulTask) => {
    const successfulGate = createDeferred<void>()
    const failure = new Error(`${failedTask} failed`)
    const failures: MediaTaskFailure[] = []
    let successfulTaskFinished = false

    const execution = runMediaTasks({
      poster: async () => {
        if (failedTask === 'poster') throw failure
        await successfulGate.promise
        successfulTaskFinished = true
      },
      video: async () => {
        if (failedTask === 'video') throw failure
        await successfulGate.promise
        successfulTaskFinished = true
      }
    }, {
      onTaskFailure: taskFailure => failures.push(taskFailure)
    })

    await flushMicrotasks()
    expect(successfulTaskFinished).toBe(false)

    successfulGate.resolve()
    await expect(execution).resolves.toEqual({
      succeeded: [successfulTask],
      failures: [{ task: failedTask, error: failure }]
    })
    expect(successfulTaskFinished).toBe(true)
    expect(failures).toEqual([{ task: failedTask, error: failure }])
  })

  it('reports every failure and rejects when all enabled tasks fail', async () => {
    const posterError = new Error('poster failed')
    const videoError = new Error('video failed')
    const failures: MediaTaskFailure[] = []

    const execution = runMediaTasks({
      poster: async () => { throw posterError },
      video: async () => { throw videoError }
    }, {
      onTaskFailure: taskFailure => failures.push(taskFailure)
    })

    await expect(execution).rejects.toMatchObject({
      name: 'AggregateError',
      errors: [posterError, videoError]
    })
    expect(failures).toEqual([
      { task: 'poster', error: posterError },
      { task: 'video', error: videoError }
    ])
  })
})
