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
/**
 * 地址簿与测速缓存的快照。
 *
 * 这两套的真实模块是**进程级单例**，状态只能靠 `resetCdnRegistry()` 之类的副作用推。
 * 替成固定值是为了能直接钉「毫秒怎么排成人话」「失败性质怎么换中文」这些纯格式化的账，
 * 不必先想办法把某个主机弄进惩罚期。
 */
const cdnRegistrySnapshot = vi.hoisted(() => ({
  value: { resources: 0, hosts: 0, penalized: [] as Array<Record<string, unknown>> } as Record<string, unknown>
}))
const cdnProbeSnapshot = vi.hoisted(() => ({
  value: { hosts: 0, entries: [] as Array<Record<string, unknown>> } as Record<string, unknown>
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
vi.mock('../../src/module/utils/CdnRegistry.js', () => ({
  getCdnRegistrySnapshot: () => cdnRegistrySnapshot.value
}))
vi.mock('../../src/module/utils/CdnProbe.js', () => ({
  getCdnProbeSnapshot: () => cdnProbeSnapshot.value
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
  cdnRegistrySnapshot.value = { resources: 0, hosts: 0, penalized: [] }
  cdnProbeSnapshot.value = { hosts: 0, entries: [] }
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

describe('CDN 地址簿与测速缓存', () => {
  it('失败性质换成中文，四种都有对应措辞', () => {
    cdnRegistrySnapshot.value = {
      resources: 4,
      hosts: 4,
      penalized: [
        { host: 'a.example.com', failures: 1, lastKind: 'blocked', penaltyRemainingMs: 1000 },
        { host: 'b.example.com', failures: 2, lastKind: 'missing', penaltyRemainingMs: 1000 },
        { host: 'c.example.com', failures: 3, lastKind: 'slow', penaltyRemainingMs: 1000 },
        { host: 'd.example.com', failures: 4, lastKind: 'network', penaltyRemainingMs: 1000 }
      ]
    }

    expect(collect().cdn.penalized.map(entry => entry.reason)).toEqual([
      '拒绝服务', '资源缺失', '持续低速', '连接失败'
    ])
  })

  // lastKind 为 null 是真实形状：`HostHealth` 的初始值就是 null，
  // 而 `penalized` 只筛「还在惩罚期」，不保证 lastKind 已经写过。
  it('没记下性质时写「未知」，不印 undefined', () => {
    cdnRegistrySnapshot.value = {
      resources: 1,
      hosts: 1,
      penalized: [{ host: 'a.example.com', failures: 1, lastKind: null, penaltyRemainingMs: 1000 }]
    }

    expect(collect().cdn.penalized[0]?.reason).toBe('未知')
  })

  // 惩罚期是 10 分钟量级，看的人关心「还要避开多久」，所以不足一分钟印秒、
  // 超过就印分钟。印成 `252秒` 要自己换算。
  it('剩余惩罚时长按量级换单位', () => {
    const remaining = (penaltyRemainingMs: number): string | undefined => {
      cdnRegistrySnapshot.value = {
        resources: 1,
        hosts: 1,
        penalized: [{ host: 'a.example.com', failures: 1, lastKind: 'slow', penaltyRemainingMs }]
      }
      return collect().cdn.penalized[0]?.remaining
    }

    expect(remaining(38_500)).toBe('38.5秒')
    expect(remaining(252_000)).toBe('4.2分钟')
    // 边界：正好一分钟归到分钟档
    expect(remaining(60_000)).toBe('1.0分钟')
    // 已经到点（快照筛过一遍，但两次读之间时钟会走）时不印负数
    expect(remaining(0)).toBe('即将解除')
    expect(remaining(-5)).toBe('即将解除')
  })

  it('测速速度按量级换单位，测不通的那条写「不可用」', () => {
    cdnProbeSnapshot.value = {
      hosts: 3,
      entries: [
        { host: 'fast.example.com', ok: true, kbPerSecond: 8602, ttfbMs: 96 },
        { host: 'slow.example.com', ok: true, kbPerSecond: 742, ttfbMs: 210 },
        { host: 'dead.example.com', ok: false, kbPerSecond: 0, ttfbMs: 0 }
      ]
    }

    expect(collect().cdn.probes).toEqual([
      { host: 'fast.example.com', speed: '8.4MB/s', ttfb: '96ms', ok: true },
      { host: 'slow.example.com', speed: '742KB/s', ttfb: '210ms', ok: true },
      // 测不通那条什么都不声称：`ttfbMs` 在失败分支里是「失败前耗时」，
      // 印成 `0ms` 会被读成「快得测不出来」，写死「超时」又会冤枉 403 那种真握上手的失败
      { host: 'dead.example.com', speed: '不可用', ttfb: '—', ok: false }
    ])
  })

  // 上一条钉的是地址畸形（耗时 0）那种失败，这条钉的是「真的连上了、但被拒」：
  // 两者都是 ok: false，可后者的耗时是有意义的 —— 一律照印就会把前者说成很快，
  // 一律写「超时」又会把后者说成没连上。所以两种都不印。
  it('失败原因不同但耗时都不印，免得把「测不通」说成一个速度指标', () => {
    cdnProbeSnapshot.value = {
      hosts: 1,
      entries: [{ host: 'blocked.example.com', ok: false, kbPerSecond: 0, ttfbMs: 320 }]
    }

    expect(collect().cdn.probes).toEqual([
      { host: 'blocked.example.com', speed: '不可用', ttfb: '—', ok: false }
    ])
  })

  it('资源数、主机数与测速主机数原样透传', () => {
    cdnRegistrySnapshot.value = { resources: 6, hosts: 4, penalized: [] }
    cdnProbeSnapshot.value = { hosts: 3, entries: [] }

    expect(collect().cdn).toMatchObject({ resources: 6, hosts: 4, probedHosts: 3 })
  })

  it('两套都空着时给空数组，让模板画「没有节点在惩罚期」而不是崩', () => {
    expect(collect().cdn).toEqual({
      resources: 0,
      hosts: 0,
      probedHosts: 0,
      penalized: [],
      probes: []
    })
  })

  // 主机名是要画进图里的，但完整地址不能：路径带着鉴权签名，
  // 那张图在群里是所有人可见的。
  it('只带主机名，不把完整下载地址带出来', () => {
    cdnRegistrySnapshot.value = {
      resources: 1,
      hosts: 1,
      penalized: [{ host: 'upos-sz-mirror08c.bilivideo.com', failures: 1, lastKind: 'slow', penaltyRemainingMs: 1000 }]
    }

    expect(JSON.stringify(collect().cdn)).not.toContain('/')
  })
})
