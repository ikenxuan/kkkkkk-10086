import { describe, expect, it, vi } from 'vitest'

import { readFileSync } from 'node:fs'

import { DEFAULT_REQUEST_TIMEOUT_MS } from '../../src/module/utils/RequestGuard.js'
import {
  livePhotoBatchTimeoutMs,
  MAX_MEDIA_TASK_TIMEOUT_MS,
  MIN_MEDIA_TASK_TIMEOUT_MS,
  resolveMediaTaskTimeoutMs,
  runMediaTasks,
  VIDEO_DOWNLOAD_TIMEOUT_MS,
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

  /**
   * `image` 是小红书图文笔记那条分支（图片循环 + 实况图生成）。它和 `video` 并列，
   * 收集顺序钉在 video 之后、comment 之前：两条正文媒体分支挨在一起，
   * 而 poster/video/comment 三者的相对顺序跟加 `image` 之前完全一致。
   */
  it('runs the image branch alongside its peers and keeps the documented collection order', async () => {
    const gate = createDeferred<void>()
    const starts: string[] = []

    const execution = runMediaTasks({
      // 故意打乱字面量的书写顺序：收集顺序由 runMediaTasks 定，不该跟着对象字面量漂。
      comment: async () => {
        starts.push('comment')
        await gate.promise
      },
      image: async () => {
        starts.push('image')
        await gate.promise
      },
      poster: async () => {
        starts.push('poster')
        await gate.promise
      },
      video: async () => {
        starts.push('video')
        await gate.promise
      }
    })

    await flushMicrotasks()
    expect(starts).toEqual(['poster', 'video', 'image', 'comment'])

    gate.resolve()
    await expect(execution).resolves.toEqual({
      succeeded: ['poster', 'video', 'image', 'comment'],
      failures: []
    })
  })

  it('reports an image failure under its own task name without cancelling its peers', async () => {
    const imageError = new Error('image failed')
    const failures: MediaTaskFailure[] = []
    let posterFinished = false

    const execution = runMediaTasks({
      poster: async () => { posterFinished = true },
      image: async () => { throw imageError }
    }, {
      onTaskFailure: taskFailure => failures.push(taskFailure)
    })

    await expect(execution).resolves.toEqual({
      succeeded: ['poster'],
      failures: [{ task: 'image', error: imageError }]
    })
    expect(posterFinished).toBe(true)
    expect(failures).toEqual([{ task: 'image', error: imageError }])
  })
})

/**
 * 按支线单独放宽超时。
 *
 * 这一组的存在理由：小红书的整批实况图生成和快手/小红书的视频下载，工作量本身就
 * 远超 60s（实况图每张一次 30s 上限的下载 + 串行 ffmpeg；视频字节流那条路
 * axios 拿的是 `timeout: 0`，压根没有壁钟上限）。而 douyin / bilibili 的视频支线
 * 恰恰**要**那 60s 兜底去拦卡死的上传 —— 所以放宽必须是逐支线的，不能是全局的。
 */
describe('resolveMediaTaskTimeoutMs', () => {
  // 最容易回归的一条：douyin / bilibili 的调用点什么超时都不传，必须继续拿默认值。
  it('leaves every branch on the guard default when the caller passes no timeout', () => {
    for (const task of ['poster', 'video', 'image', 'comment'] as const) {
      expect(resolveMediaTaskTimeoutMs(task, {})).toBeUndefined()
      expect(resolveMediaTaskTimeoutMs(task)).toBeUndefined()
    }
  })

  it('only widens the branches named in taskTimeoutMs, leaving their peers on the default', () => {
    const options = { taskTimeoutMs: { image: 300_000, video: VIDEO_DOWNLOAD_TIMEOUT_MS } }

    expect(resolveMediaTaskTimeoutMs('image', options)).toBe(300_000)
    expect(resolveMediaTaskTimeoutMs('video', options)).toBe(VIDEO_DOWNLOAD_TIMEOUT_MS)
    // 卡片支线没被列出来 -> 继续吃 60s 的默认兜底
    expect(resolveMediaTaskTimeoutMs('poster', options)).toBeUndefined()
    expect(resolveMediaTaskTimeoutMs('comment', options)).toBeUndefined()
  })

  it('lets a per-branch value win over the global timeoutMs', () => {
    const options = { timeoutMs: 5_000, taskTimeoutMs: { video: 90_000 } }

    expect(resolveMediaTaskTimeoutMs('video', options)).toBe(90_000)
    expect(resolveMediaTaskTimeoutMs('comment', options)).toBe(5_000)
  })

  /**
   * 行为层面钉一遍：不传超时的调用点仍然在 60s 上被释放，而被放宽的邻居不受影响。
   * 上面那条只验解析函数，这条验它真的接到了 runWithRequestGuard 上。
   */
  it('times out an un-widened branch at the guard default while its widened peer keeps running', async () => {
    vi.useFakeTimers()
    const commentGate = createDeferred<void>()
    const videoGate = createDeferred<void>()
    const failures: MediaTaskFailure[] = []
    let videoFinished = false
    let executionSettled = false

    const execution = runMediaTasks({
      video: async () => {
        await videoGate.promise
        videoFinished = true
      },
      comment: async () => { await commentGate.promise }
    }, {
      taskTimeoutMs: { video: VIDEO_DOWNLOAD_TIMEOUT_MS },
      onTaskFailure: failure => failures.push(failure)
    })
    const settleObserver = execution.then(
      () => { executionSettled = true },
      () => { executionSettled = true }
    )

    try {
      // 走过默认的 60s，再多走 2 分钟：没被放宽的 comment 早该被 guard 释放，
      // 而 video 的预算是 10 分钟，此刻必须还活着。
      await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS + 120_000)
      await flushMicrotasks()
      // 收集是在 allSettled 之后做的，所以此刻还没有人被上报 —— video 还挂着
      expect(executionSettled).toBe(false)
      expect(videoFinished).toBe(false)

      videoGate.resolve()
      const result = await execution

      // video 撑过了 3 分钟没被砍，说明它拿到的是放宽后的值而不是默认值；
      // 要是放宽没生效，两条都会超时、runMediaTasks 会抛 AggregateError。
      expect(videoFinished).toBe(true)
      expect(result.succeeded).toEqual(['video'])
      expect(result.failures).toEqual([{
        task: 'comment',
        error: expect.objectContaining({
          name: 'RequestTimeoutError',
          code: 'ERR_REQUEST_TIMEOUT',
          timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS
        })
      }])
      expect(failures).toEqual(result.failures)
    } finally {
      commentGate.resolve()
      videoGate.resolve()
      await Promise.allSettled([execution, settleObserver])
      vi.useRealTimers()
    }
  })

  /**
   * douyin / bilibili 的调用点不许被顺手放宽 —— 它们的视频上传支线现在正靠 60s
   * 默认值拦卡死。源码级钉死比行为级便宜也更直接。
   *
   * 正则写成 `/timeout_?ms/i` 而不是 `toContain('timeoutMs')`：后者漏得过
   * `taskTimeoutMs`（大写的 T）和 `VIDEO_DOWNLOAD_TIMEOUT_MS`（带下划线），
   * 而这两个恰恰是最可能被顺手加进去的写法。两个文件里现存的 `timeoutSeconds`
   * 不匹配这个模式，所以它不会误伤。
   */
  it.each([
    'douyin/douyin.ts',
    'bilibili/bilibili.ts'
  ])('keeps %s free of any media task timeout override', file => {
    const source = readFileSync(new URL(`../../src/module/platform/${file}`, import.meta.url), 'utf8')

    // 先确认真读到了那个调用点，别让文件改名把这条变成空断言
    expect(source).toContain('runMediaTasks(')
    expect(source).not.toMatch(/timeout_?ms/i)
  })
})

describe('livePhotoBatchTimeoutMs', () => {
  it('never drops below the guard default, however few images the note has', () => {
    // 0/1/2 张都落到下限：图少不该让守卫比今天更紧
    expect(livePhotoBatchTimeoutMs(0)).toBe(MIN_MEDIA_TASK_TIMEOUT_MS)
    expect(livePhotoBatchTimeoutMs(1)).toBe(MIN_MEDIA_TASK_TIMEOUT_MS)
    expect(livePhotoBatchTimeoutMs(2)).toBe(MIN_MEDIA_TASK_TIMEOUT_MS)
    expect(MIN_MEDIA_TASK_TIMEOUT_MS).toBe(DEFAULT_REQUEST_TIMEOUT_MS)
  })

  it('scales linearly with the image count between the two bounds', () => {
    // 每张 30s：3 张 90s、9 张 270s，都还没碰到上限
    expect(livePhotoBatchTimeoutMs(3)).toBe(90_000)
    expect(livePhotoBatchTimeoutMs(9)).toBe(270_000)
    expect(livePhotoBatchTimeoutMs(18)).toBe(540_000)
  })

  it('clamps a huge image count to the ceiling', () => {
    expect(livePhotoBatchTimeoutMs(20)).toBe(MAX_MEDIA_TASK_TIMEOUT_MS)
    expect(livePhotoBatchTimeoutMs(500)).toBe(MAX_MEDIA_TASK_TIMEOUT_MS)
  })

  it('treats a dirty image count as zero rather than dropping the guard', () => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(livePhotoBatchTimeoutMs(value)).toBe(MIN_MEDIA_TASK_TIMEOUT_MS)
    }
  })

  it('stays inside [min, max] across the whole plausible range', () => {
    for (let count = 0; count <= 60; count++) {
      const timeout = livePhotoBatchTimeoutMs(count)
      expect(timeout).toBeGreaterThanOrEqual(MIN_MEDIA_TASK_TIMEOUT_MS)
      expect(timeout).toBeLessThanOrEqual(MAX_MEDIA_TASK_TIMEOUT_MS)
    }
  })
})
