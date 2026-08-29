import { describe, expect, it, vi } from 'vitest'

import {
  acquireDownloadSlot,
  getCurrentDownloadBucket,
  resetDownloadBudget,
  setDownloadBudgetLimitResolver
} from '../../src/module/utils/Network/DownloadBudget.js'
import {
  ParseCoordinator,
  createParseFingerprint,
  type ParseJobIdentity,
  type ParseReactionPort,
  type ParseReactionState
} from '../../src/module/utils/ParseCoordinator.js'

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

const workIdentity = (
  workId: string,
  scope: ParseJobIdentity['scope'] = { type: 'group', id: '10001' }
): ParseJobIdentity => ({
  platform: 'douyin',
  target: { type: 'work-id', value: workId },
  scope
})

const createReactionRecorder = (): {
  port: ParseReactionPort
  states: ParseReactionState[]
} => {
  const states: ParseReactionState[] = []
  return {
    port: {
      setState: state => {
        states.push(state)
      }
    },
    states
  }
}

describe('createParseFingerprint', () => {
  it('normalizes platform, URL syntax, query order, fragments, and scope IDs', () => {
    const first = createParseFingerprint({
      platform: ' DouYin ',
      target: {
        type: 'url',
        value: 'HTTPS://WWW.DOUYIN.COM:443/video/123?z=9&a=1#share'
      },
      scope: { type: 'group', id: ' 10001 ' }
    })
    const second = createParseFingerprint({
      platform: 'douyin',
      target: {
        type: 'url',
        value: 'https://www.douyin.com/video/123?a=1&z=9'
      },
      scope: { type: 'group', id: 10001 }
    })

    expect(first).toBe(second)
    expect(first).toMatch(/^parse:v1:/)
  })

  it('trims work IDs but preserves meaningful case and isolates scope and target kinds', () => {
    const base = createParseFingerprint({
      platform: ' BILIBILI ',
      target: { type: 'work-id', value: ' BV1AbC ' },
      scope: { type: 'private', id: '42' }
    })

    expect(base).toBe(createParseFingerprint({
      platform: 'bilibili',
      target: { type: 'work-id', value: 'BV1AbC' },
      scope: { type: 'private', id: 42 }
    }))
    expect(base).not.toBe(createParseFingerprint({
      platform: 'bilibili',
      target: { type: 'work-id', value: 'bv1abc' },
      scope: { type: 'private', id: 42 }
    }))
    expect(base).not.toBe(createParseFingerprint({
      platform: 'bilibili',
      target: { type: 'url', value: 'https://example.com/BV1AbC' },
      scope: { type: 'private', id: 42 }
    }))
    expect(base).not.toBe(createParseFingerprint({
      platform: 'bilibili',
      target: { type: 'work-id', value: 'BV1AbC' },
      scope: { type: 'group', id: 42 }
    }))
  })

  it('rejects empty identity components and non-HTTP URL targets', () => {
    expect(() => createParseFingerprint({
      platform: ' ',
      target: { type: 'work-id', value: '123' },
      scope: { type: 'group', id: '1' }
    })).toThrow(TypeError)
    expect(() => createParseFingerprint({
      platform: 'douyin',
      target: { type: 'work-id', value: ' ' },
      scope: { type: 'group', id: '1' }
    })).toThrow(TypeError)
    expect(() => createParseFingerprint({
      platform: 'douyin',
      target: { type: 'url', value: 'file:///tmp/video' },
      scope: { type: 'group', id: '1' }
    })).toThrow(TypeError)
    expect(() => createParseFingerprint({
      platform: 'douyin',
      target: { type: 'work-id', value: '123' },
      scope: { type: 'private', id: ' ' }
    })).toThrow(TypeError)
  })
})

describe('ParseCoordinator', () => {
  it('shares the exact result promise and lets only the winning submission react', async () => {
    const coordinator = new ParseCoordinator({ concurrency: 1 })
    const gate = createDeferred<string>()
    const winnerReaction = createReactionRecorder()
    const duplicateReaction = createReactionRecorder()
    const winnerTask = vi.fn(async () => await gate.promise)
    const duplicateTask = vi.fn(() => 'must-not-run')
    const identity = workIdentity('7345')

    const winner = coordinator.submit(identity, winnerTask, winnerReaction.port)
    await flushMicrotasks()
    const duplicate = coordinator.submit(identity, duplicateTask, duplicateReaction.port)

    expect(duplicate).toBe(winner)
    expect(winnerTask).toHaveBeenCalledTimes(1)
    expect(duplicateTask).not.toHaveBeenCalled()
    expect(winnerReaction.states).toEqual(['processing'])
    expect(duplicateReaction.states).toEqual([])

    gate.resolve('parsed')
    await expect(Promise.all([winner, duplicate])).resolves.toEqual([
      'parsed',
      'parsed'
    ])
    expect(winnerReaction.states).toEqual(['processing', 'succeeded'])
    expect(duplicateReaction.states).toEqual([])
  })

  it('deduplicates while queued without adding a second processing reaction', async () => {
    const coordinator = new ParseCoordinator({ concurrency: 1 })
    const blockerGate = createDeferred<void>()
    const parseGate = createDeferred<string>()
    const winnerReaction = createReactionRecorder()
    const duplicateReaction = createReactionRecorder()
    const blocker = coordinator.submit(workIdentity('blocker'), () => blockerGate.promise)
    const identity = workIdentity('queued-work')
    const winner = coordinator.submit(identity, () => parseGate.promise, winnerReaction.port)
    const duplicate = coordinator.submit(identity, () => 'must-not-run', duplicateReaction.port)

    expect(duplicate).toBe(winner)
    expect(winnerReaction.states).toEqual([])
    expect(duplicateReaction.states).toEqual([])

    blockerGate.resolve()
    await blocker
    await flushMicrotasks()
    expect(winnerReaction.states).toEqual(['processing'])

    parseGate.resolve('ok')
    await expect(winner).resolves.toBe('ok')
    expect(winnerReaction.states).toEqual(['processing', 'succeeded'])
    expect(duplicateReaction.states).toEqual([])
  })

  it('marks only the winner as failed and preserves the original task error', async () => {
    const coordinator = new ParseCoordinator()
    const reaction = createReactionRecorder()
    const failure = new Error('parse failed')

    const result = coordinator.submit(
      workIdentity('broken'),
      () => { throw failure },
      reaction.port
    )

    await expect(result).rejects.toBe(failure)
    expect(reaction.states).toEqual(['processing', 'failed'])
  })

  it('silently isolates synchronous and asynchronous reaction failures from tasks and locks', async () => {
    const coordinator = new ParseCoordinator()
    let executions = 0
    const brokenReaction: ParseReactionPort = {
      setState: state => {
        if (state === 'processing') throw new Error('sync reaction failure')
        return Promise.reject(new Error('async reaction failure'))
      }
    }
    const identity = workIdentity('reaction-failure')

    await expect(coordinator.submit(identity, () => {
      executions += 1
      return 'first'
    }, brokenReaction)).resolves.toBe('first')
    await flushMicrotasks()

    await expect(coordinator.submit(identity, () => {
      executions += 1
      return 'second'
    }, brokenReaction)).resolves.toBe('second')
    await flushMicrotasks()

    expect(executions).toBe(2)
    expect(coordinator.getSnapshot()).toMatchObject({
      running: 0,
      queued: 0,
      pending: 0
    })
  })

  it('works without a reaction port and delegates bounded FIFO scheduling', async () => {
    const coordinator = new ParseCoordinator({ concurrency: 1 })
    const firstGate = createDeferred<string>()
    const starts: string[] = []

    const first = coordinator.submit(workIdentity('first'), async () => {
      starts.push('first')
      return await firstGate.promise
    })
    const second = coordinator.submit(workIdentity('second'), () => {
      starts.push('second')
      return 'second-result'
    })

    await flushMicrotasks()
    expect(starts).toEqual(['first'])
    expect(coordinator.getSnapshot()).toMatchObject({
      concurrency: 1,
      running: 1,
      queued: 1,
      pending: 2
    })

    firstGate.resolve('first-result')
    await expect(first).resolves.toBe('first-result')
    await expect(second).resolves.toBe('second-result')
    expect(starts).toEqual(['first', 'second'])
  })
})

describe('ParseCoordinator 下载桶上下文', () => {
  it('把 identity.platform 铺成下载桶，跨调度延迟与 await 都不丢', async () => {
    resetDownloadBudget()
    setDownloadBudgetLimitResolver(() => 4)
    try {
      // 并发 1：第二个任务一定被排队、延后到另一个 tick 才启动。
      // 上下文如果套在 submit 外面，它就会落到 default 桶。
      const coordinator = new ParseCoordinator({ concurrency: 1 })
      const firstGate = createDeferred<string>()

      const observe = async (): Promise<{ inherited: string | undefined, slot: string }> => {
        await new Promise(resolve => setTimeout(resolve, 1))
        const slot = await acquireDownloadSlot()
        slot.release()
        return { inherited: getCurrentDownloadBucket(), slot: slot.bucket }
      }

      const first = coordinator.submit(
        { platform: 'douyin', target: { type: 'work-id', value: 'first' }, scope: { type: 'group', id: '10001' } },
        async () => {
          await firstGate.promise
          return await observe()
        }
      )
      const second = coordinator.submit(
        { platform: 'bilibili', target: { type: 'work-id', value: 'second' }, scope: { type: 'group', id: '10001' } },
        observe
      )

      await flushMicrotasks()
      firstGate.resolve('go')

      await expect(first).resolves.toEqual({ inherited: 'douyin', slot: 'douyin' })
      await expect(second).resolves.toEqual({ inherited: 'bilibili', slot: 'bilibili' })
      // 上下文只在任务内部有效，不该泄漏到协调器外面
      expect(getCurrentDownloadBucket()).toBeUndefined()
    } finally {
      resetDownloadBudget()
    }
  })
})
