import { afterEach, describe, expect, it } from 'vitest'

import {
  fromMilliseconds,
  fromSeconds,
  getMediaMetricsPlatform,
  reportMedia,
  runWithMediaMetrics,
  type MediaRecord
} from '../../src/module/utils/media-metrics.js'

// globalThis.logger 在全局声明里是必填的 Logger，所以只能先转成 unknown 再转成
// 带可选 logger 的形状，否则塞部分实现的 mock 会报 TS2740。
// runWithMediaMetrics 在超限和落库失败两条路上会调 logger，不塞 mock 会 ReferenceError。
const globalWithLogger = globalThis as unknown as { logger?: unknown }
const originalLogger = globalWithLogger.logger

const stubLogger = (): { debug: string[], error: string[] } => {
  const captured = { debug: [] as string[], error: [] as string[] }
  globalWithLogger.logger = {
    debug: (message: string) => captured.debug.push(String(message)),
    error: (message: string) => captured.error.push(String(message)),
    info: () => undefined,
    warn: () => undefined
  }
  return captured
}

afterEach(() => {
  globalWithLogger.logger = originalLogger
})

/** 跑一次作用域，把收集到的记录交出来 */
const collect = async (fn: () => Promise<void>): Promise<MediaRecord[]> => {
  let collected: MediaRecord[] = []
  await runWithMediaMetrics('douyin', fn, records => { collected = records })
  return collected
}

describe('时长单位归一', () => {
  it('fromSeconds 乘 1000，fromMilliseconds 原样', () => {
    expect(fromSeconds(12)).toBe(12000)
    expect(fromMilliseconds(12000)).toBe(12000)
  })

  it('0 / 负数 / 非有限值 / null 一律当「没有时长」', () => {
    // 平台代码里 `video?.duration || 0` 这种写法遍布各处，0 既可能是真没拿到
    // 也可能是接口没给，记成 0 会污染平均时长的分母
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, null, undefined]) {
      expect(fromSeconds(value)).toBeUndefined()
      expect(fromMilliseconds(value)).toBeUndefined()
    }
  })

  it('小数四舍五入到整毫秒', () => {
    expect(fromSeconds(1.2345)).toBe(1000)
    expect(fromMilliseconds(12.6)).toBe(13)
  })
})

describe('runWithMediaMetrics', () => {
  it('把作用域内的上报收集起来并交给 onSettled', async () => {
    stubLogger()

    const records = await collect(async () => {
      reportMedia({ kind: 'video', durationMs: 5000, bytes: 1024 })
      reportMedia({ kind: 'audio', durationMs: 3000 })
    })

    expect(records).toEqual([
      { kind: 'video', durationMs: 5000, bytes: 1024 },
      { kind: 'audio', durationMs: 3000, bytes: undefined }
    ])
  })

  it('跨 await 边界仍在同一个作用域里', async () => {
    stubLogger()

    const records = await collect(async () => {
      reportMedia({ kind: 'video', durationMs: 1000 })
      await new Promise(resolve => setTimeout(resolve, 1))
      reportMedia({ kind: 'video', durationMs: 2000 })
    })

    expect(records).toHaveLength(2)
  })

  it('并发的两个作用域互不串台', async () => {
    stubLogger()

    const [first, second] = await Promise.all([
      collect(async () => {
        reportMedia({ kind: 'video', durationMs: 1000 })
        await new Promise(resolve => setTimeout(resolve, 5))
        reportMedia({ kind: 'video', durationMs: 1000 })
      }),
      collect(async () => {
        await new Promise(resolve => setTimeout(resolve, 1))
        reportMedia({ kind: 'audio', durationMs: 9000 })
      })
    ])

    expect(first?.map(record => record.kind)).toEqual(['video', 'video'])
    expect(second?.map(record => record.kind)).toEqual(['audio'])
  })

  it('fn 抛错时原样往上抛，但已收集到的记录仍然交出去', async () => {
    stubLogger()

    let collected: MediaRecord[] | undefined
    const boom = new Error('解析失败')

    await expect(runWithMediaMetrics(
      'bilibili',
      async () => {
        // 解析失败前已经发出去的媒体是真发出去了，不该因为后续步骤失败就不算
        reportMedia({ kind: 'video', durationMs: 4000 })
        throw boom
      },
      records => { collected = records }
    )).rejects.toBe(boom)

    expect(collected).toHaveLength(1)
  })

  it('onSettled 自己抛错不影响 fn 的返回值，只记日志', async () => {
    const logs = stubLogger()

    const value = await runWithMediaMetrics(
      'douyin',
      async () => 'ok',
      () => { throw new Error('落库失败') }
    )

    expect(value).toBe('ok')
    expect(logs.error).toHaveLength(1)
  })

  it('超过 32 条只丢多的、不抛错，并记一条 debug', async () => {
    const logs = stubLogger()

    const records = await collect(async () => {
      for (let i = 0; i < 40; i++) reportMedia({ kind: 'video', durationMs: 1000 })
    })

    expect(records).toHaveLength(32)
    expect(logs.debug.join()).toContain('8')
  })

  it('暴露当前作用域的平台，作用域外是 undefined', async () => {
    stubLogger()

    let inside: string | undefined
    await runWithMediaMetrics('kuaishou', async () => {
      inside = getMediaMetricsPlatform()
    }, () => undefined)

    expect(inside).toBe('kuaishou')
    expect(getMediaMetricsPlatform()).toBeUndefined()
  })

  it('作用域外上报是无害的空操作', () => {
    // 推送任务、定时任务这些不经过解析路由的路径不会凭空往统计里塞数据
    expect(() => reportMedia({ kind: 'video', durationMs: 1000 })).not.toThrow()
  })

  it('脏时长在上报处再归一一次，不信任调用点', async () => {
    stubLogger()

    const records = await collect(async () => {
      reportMedia({ kind: 'video', durationMs: 0 })
      reportMedia({ kind: 'video', durationMs: -5 })
    })

    expect(records.map(record => record.durationMs)).toEqual([undefined, undefined])
  })
})
