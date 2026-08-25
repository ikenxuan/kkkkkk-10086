import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 「连接时长」这一格的回归护栏。
 *
 * 这个字段此前恒为「未知」：它读的是 `adapter.connectTime`，而那是 Karin 的键，
 * 宿主 TRSS-Yunzai 里根本不存在（全量搜 plugins/adapter 与 lib 只有 Satori 的
 * reconnectTimer，无关）。Yunzai 的连接时刻在 `bot.stat.start_time`，
 * 七个适配器里六个有，单位是**秒**；而原实现按毫秒算差值，
 * 所以就算字段对了、不做单位归一也会得出「一万多天」这种离谱结果。
 */

// runtime-report 会拉起 Config（构造时读 yaml）等一串模块，这里只测取时长这一个纯函数，
// 把重依赖全替掉，避免测试去碰真实配置目录。
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

const { getConnectedFor } = await import('../../src/module/utils/runtime-report.js')

/** 固定「现在」，让时长断言不受真实时钟影响 */
const NOW_MS = 1_760_000_000_000
const NOW_SECONDS = NOW_MS / 1000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW_MS)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getConnectedFor', () => {
  it('把 bot.stat.start_time 当秒级纪元算（宿主 Yunzai 的真实来源）', () => {
    // 2 天 6 小时 18 分钟前连上
    const ago = 2 * 86400 + 6 * 3600 + 18 * 60
    const event = { bot: { stat: { start_time: NOW_SECONDS - ago } } }

    expect(getConnectedFor(event as never)).toBe('2天 6小时 18分钟')
  })

  it('毫秒级纪元也认，不会把它当秒算出上万天', () => {
    // Karin 的 adapter.connectTime 是毫秒；1e11 那条分界线要能把两种单位分开
    const event = { bot: { adapter: { connectTime: NOW_MS - 90 * 60 * 1000 } } }

    expect(getConnectedFor(event as never)).toBe('1小时 30分钟')
  })

  it('stat.start_time 优先于 Karin 的 connectTime', () => {
    const event = {
      bot: {
        stat: { start_time: NOW_SECONDS - 3600 },
        adapter: { connectTime: NOW_MS - 99 * 86400 * 1000 }
      }
    }

    expect(getConnectedFor(event as never)).toBe('1小时 0分钟')
  })

  it('两个来源都没有才返回未知', () => {
    // 这正是修复前每个 Yunzai 适配器的处境：只读 connectTime，而宿主不写这个键
    expect(getConnectedFor({ bot: { adapter: { id: 'QQ', name: 'OneBotv11' } } } as never)).toBe('未知')
    expect(getConnectedFor({ bot: {} } as never)).toBe('未知')
    expect(getConnectedFor({} as never)).toBe('未知')
  })

  it('0、负数、非数字一律按取不到处理', () => {
    expect(getConnectedFor({ bot: { stat: { start_time: 0 } } } as never)).toBe('未知')
    expect(getConnectedFor({ bot: { stat: { start_time: -1 } } } as never)).toBe('未知')
    expect(getConnectedFor({ bot: { stat: { start_time: 'soon' } } } as never)).toBe('未知')
  })

  it('时钟回拨导致的负时长收敛成 0 秒而不是负数', () => {
    const event = { bot: { stat: { start_time: NOW_SECONDS + 600 } } }

    expect(getConnectedFor(event as never)).toBe('0秒')
  })
})
