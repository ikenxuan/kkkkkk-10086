import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MessageEvent } from '../../src/types/message'

/**
 * 运行诊断卡「并发与缓存」那一段的护栏。
 *
 * `collectRuntimeReport` 对这两套设施只做**展示格式化**，所以这里把两个只读快照替成
 * 固定值，验证三件事：命中率算得对、桶占用透传没走形、桶名换成了中文。
 *
 * 之所以要单独钉「透传」：`getDownloadBudgetSnapshot()` 是别人的模块级单例，
 * 这一格出错的典型形态是字段名对不上（`queued` 写成 `queue`），
 * 而那种错在 TS 里是编译期可见的、在运行时却会安静地变成 undefined。
 */
vi.mock('../../src/module/utils/Config.js', () => ({
  default: { app: {}, cookies: {}, bilibili: {} }
}))
vi.mock('../../src/module/utils/Version.js', () => ({
  default: { pluginPath: '.', pluginName: 'test', version: '0.0.0', BotName: 'Yunzai', BotVersion: '3.1.3' }
}))
vi.mock('../../src/module/tooling/build-metadata.js', () => ({
  getBuildMetadata: () => undefined,
  formatBuildTime: (value: string) => value
}))
vi.mock('../../src/module/tooling/release-channel.js', () => ({
  getReleaseChannel: () => 'Dev'
}))
vi.mock('../../src/module/utils/ErrorHandler/adapter.js', () => ({
  getAdapterInfo: () => undefined
}))

const cacheSnapshot = vi.hoisted(() => ({
  value: {
    enabled: true,
    capacity: 128,
    entries: 0,
    hits: 0,
    coalesced: 0,
    misses: 0,
    hitRate: 0,
    negativeEntries: 0,
    inflight: 0,
    tiers: [] as Array<Record<string, unknown>>
  } as Record<string, unknown>
}))
const budgetSnapshot = vi.hoisted(() => ({
  value: { limit: 8, buckets: [] as Array<Record<string, unknown>> } as Record<string, unknown>
}))
/** 协调器没登记时是 undefined，这一格要能区分「读不到」和「队列是空的」 */
const parseSnapshot = vi.hoisted(() => ({
  value: undefined as Record<string, unknown> | undefined
}))

vi.mock('../../src/module/utils/ApiCache.js', () => ({
  getApiCacheSnapshot: () => cacheSnapshot.value
}))
vi.mock('../../src/module/utils/DownloadBudget.js', () => ({
  getDownloadBudgetSnapshot: () => budgetSnapshot.value
}))
vi.mock('../../src/module/utils/ParseCoordinator.js', () => ({
  getParseCoordinatorSnapshot: () => parseSnapshot.value
}))

const { collectRuntimeReport } = await import('../../src/module/utils/runtime-report.js')

const event = { bot: { stat: {} } } as unknown as MessageEvent

const collect = () => collectRuntimeReport(event).concurrency

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_760_000_000_000)
  cacheSnapshot.value = {
    enabled: true,
    capacity: 128,
    entries: 0,
    hits: 0,
    coalesced: 0,
    misses: 0,
    hitRate: 0,
    negativeEntries: 0,
    inflight: 0,
    tiers: []
  }
  budgetSnapshot.value = { limit: 8, buckets: [] }
  parseSnapshot.value = undefined
})

afterEach(() => {
  vi.useRealTimers()
})

describe('缓存指标', () => {
  it('命中率排成可直接当进度条宽度用的百分数', () => {
    cacheSnapshot.value = {
      ...cacheSnapshot.value,
      hits: 132,
      coalesced: 47,
      misses: 49,
      entries: 63,
      hitRate: (132 + 47) / (132 + 47 + 49),
      negativeEntries: 2,
      inflight: 1
    }

    const { cache } = collect()
    expect(cache.hitRate).toBe('78.5%')
    expect(cache.hits).toBe(132)
    expect(cache.coalesced).toBe(47)
    expect(cache.misses).toBe(49)
    expect(cache.entries).toBe(63)
    expect(cache.capacity).toBe(128)
    expect(cache.negativeEntries).toBe(2)
    expect(cache.inflight).toBe(1)
    expect(cache.sampled).toBe(true)
  })

  it('一次查询都没有时标成未采样，让卡上写「尚未产生请求」而不是一个假的 0%', () => {
    const { cache } = collect()
    expect(cache.sampled).toBe(false)
    expect(cache.hitRate).toBe('0.0%')
  })

  it('越界的比率被夹回 0~100%，免得画出溢出容器的进度条', () => {
    cacheSnapshot.value = { ...cacheSnapshot.value, hits: 1, hitRate: 1.4 }
    expect(collect().cache.hitRate).toBe('100.0%')

    cacheSnapshot.value = { ...cacheSnapshot.value, hits: 1, hitRate: Number.NaN }
    expect(collect().cache.hitRate).toBe('0.0%')

    cacheSnapshot.value = { ...cacheSnapshot.value, hits: 1, hitRate: -0.3 }
    expect(collect().cache.hitRate).toBe('0.0%')
  })

  it('开关关闭时如实透传，卡上据此改文案', () => {
    cacheSnapshot.value = { ...cacheSnapshot.value, enabled: false }
    expect(collect().cache.enabled).toBe(false)
  })

  it('档位换成中文措辞，明细在 core 就拼好，模板不算数', () => {
    cacheSnapshot.value = {
      ...cacheSnapshot.value,
      hits: 4,
      misses: 1,
      tiers: [
        { tier: 'static', hits: 3, coalesced: 1, misses: 0, entries: 2 },
        { tier: 'detail', hits: 1, coalesced: 0, misses: 1, entries: 5 }
      ]
    }

    expect(collect().cache.tiers).toEqual([
      { label: '准静态接口', hitRate: '100.0%', detail: '命中 3 · 合并 1 · 未命中 0 · 缓存 2 条' },
      { label: '作品详情', hitRate: '50.0%', detail: '命中 1 · 合并 0 · 未命中 1 · 缓存 5 条' }
    ])
  })

  it('某个档位一次查询都没有时报 0%，不报 NaN', () => {
    cacheSnapshot.value = {
      ...cacheSnapshot.value,
      tiers: [{ tier: 'static', hits: 0, coalesced: 0, misses: 0, entries: 0 }]
    }
    expect(collect().cache.tiers[0]?.hitRate).toBe('0.0%')
  })
})

describe('下载桶占用', () => {
  it('额度上限与每个桶的占用/排队原样透传', () => {
    budgetSnapshot.value = {
      limit: 8,
      buckets: [
        { bucket: 'bilibili', limit: 8, running: 2, queued: 5 },
        { bucket: 'douyin', limit: 8, running: 3, queued: 0 }
      ]
    }

    const { download } = collect()
    expect(download.limit).toBe(8)
    expect(download.buckets).toEqual([
      { label: '哔哩哔哩', running: 2, queued: 5 },
      { label: '抖音', running: 3, queued: 0 }
    ])
  })

  it('四个平台桶和默认桶都有中文名', () => {
    budgetSnapshot.value = {
      limit: 4,
      buckets: ['bilibili', 'default', 'douyin', 'kuaishou', 'xiaohongshu']
        .map(bucket => ({ bucket, limit: 4, running: 0, queued: 0 }))
    }

    expect(collect().download.buckets.map(bucket => bucket.label))
      .toEqual(['哔哩哔哩', '默认', '抖音', '快手', '小红书'])
  })

  it('认不出的桶名原样显示，而不是消失', () => {
    budgetSnapshot.value = {
      limit: 4,
      buckets: [{ bucket: 'weibo', limit: 4, running: 1, queued: 0 }]
    }

    expect(collect().download.buckets).toEqual([{ label: 'weibo', running: 1, queued: 0 }])
  })

  it('一次下载都没跑过时桶列表是空数组，让模板画「暂无下载任务」', () => {
    expect(collect().download.buckets).toEqual([])
    expect(collect().download.limit).toBe(8)
  })
})

describe('解析队列占用', () => {
  it('计数原样透传', () => {
    parseSnapshot.value = {
      concurrency: 2,
      running: 2,
      queued: 3,
      pending: 5,
      runningFingerprints: ['parse:v1:["douyin","url","https://www.douyin.com/video/1","group","114"]'],
      queuedFingerprints: []
    }

    expect(collect().parse).toEqual({
      available: true,
      concurrency: 2,
      running: 2,
      queued: 3,
      pending: 5
    })
  })

  // 指纹是「平台 + 作品链接 + 群号」拼出来的。这张卡的前提是群里触发也不会把
  // 用户数据画进图里，所以指纹一个都不能进 payload —— 光靠人看 collect() 的
  // 字面量看不出漏没漏，这里按值扫一遍。
  it('指纹一个都不带出来', () => {
    const url = 'https://www.douyin.com/video/7123456789'
    parseSnapshot.value = {
      concurrency: 2,
      running: 1,
      queued: 1,
      pending: 2,
      runningFingerprints: [`parse:v1:["douyin","url","${url}","group","114514"]`],
      queuedFingerprints: ['parse:v1:["bilibili","work-id","BV1xx411c7mD","private","2233"]']
    }

    const serialized = JSON.stringify(collect().parse)
    expect(serialized).not.toContain(url)
    expect(serialized).not.toContain('114514')
    expect(serialized).not.toContain('BV1xx411c7mD')
    expect(serialized).not.toContain('parse:v1:')
  })

  // 协调器实例归 apps/tools.ts 所有。只加载 utils 的场合读不到，
  // 这时候画一排 0 会被读成「队列是空的」，得让模板改写文案。
  it('协调器没登记时标成不可用，而不是报一排 0', () => {
    expect(collect().parse).toEqual({
      available: false,
      concurrency: 0,
      running: 0,
      queued: 0,
      pending: 0
    })
  })

  it('队列真的空着时是可用 + 全 0，和「读不到」区分得开', () => {
    parseSnapshot.value = {
      concurrency: 4,
      running: 0,
      queued: 0,
      pending: 0,
      runningFingerprints: [],
      queuedFingerprints: []
    }

    expect(collect().parse).toEqual({
      available: true,
      concurrency: 4,
      running: 0,
      queued: 0,
      pending: 0
    })
  })
})
