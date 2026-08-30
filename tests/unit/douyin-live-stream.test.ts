import { describe, expect, it, vi } from 'vitest'

// live.ts 从 utils 的 barrel 取 `Common`，而那个 barrel 会把 Render -> puppeteer
// 一路拉进来，未构建 lib/ 时直接 ERR_MODULE_NOT_FOUND。挡掉它，只留本文件用到的面。
// `pickDouyinLiveStream` 本身不碰 Common，这个 mock 纯粹是为了让模块能加载。
vi.mock('../../src/module/utils/index.js', () => ({
  Common: { count: (value: unknown) => String(value ?? 0) }
}))

const { pickDouyinLiveStream } = await import('../../src/module/platform/douyin/live.js')
type DouyinLiveItem = import('../../src/module/platform/douyin/live.js').DouyinLiveItem

/** 只造 `stream_url`，其余字段与档位挑选无关 */
const liveItem = (streamUrl: DouyinLiveItem['stream_url']): DouyinLiveItem => ({
  stream_url: streamUrl
})

describe('pickDouyinLiveStream quality priority', () => {
  it('prefers FULL_HD1 over SD1 and SD2', () => {
    const pick = pickDouyinLiveStream(liveItem({
      flv_pull_url: {
        FULL_HD1: 'https://pull.example.com/full.flv',
        SD1: 'https://pull.example.com/sd1.flv',
        SD2: 'https://pull.example.com/sd2.flv'
      }
    }))

    expect(pick.url).toBe('https://pull.example.com/full.flv')
    expect(pick.quality).toBe('FULL_HD1')
  })

  it('falls back to SD1 when FULL_HD1 is absent', () => {
    const pick = pickDouyinLiveStream(liveItem({
      flv_pull_url: {
        SD1: 'https://pull.example.com/sd1.flv',
        SD2: 'https://pull.example.com/sd2.flv'
      }
    }))

    expect(pick.url).toBe('https://pull.example.com/sd1.flv')
    expect(pick.quality).toBe('SD1')
  })

  it('prefers SD1 over SD2 ahead of declaration order in the response', () => {
    // 键序刻意反着给：挑选依据必须是优先级表，不是响应里的键序
    const pick = pickDouyinLiveStream(liveItem({
      flv_pull_url: {
        SD2: 'https://pull.example.com/sd2.flv',
        SD1: 'https://pull.example.com/sd1.flv'
      }
    }))

    expect(pick.quality).toBe('SD1')
  })

  // 这条是「运行时判空」那条设计的回归：`[property: string]: any` 让类型检查
  // 对空串完全无感，只有运行时判据能把空档位跳过去。
  it('skips FULL_HD1 when it is present but an empty string', () => {
    const pick = pickDouyinLiveStream(liveItem({
      flv_pull_url: {
        FULL_HD1: '',
        SD1: 'https://pull.example.com/sd1.flv'
      }
    }))

    expect(pick.url).toBe('https://pull.example.com/sd1.flv')
    expect(pick.quality).toBe('SD1')
  })

  it('skips whitespace-only urls the same way as empty strings', () => {
    const pick = pickDouyinLiveStream(liveItem({
      flv_pull_url: { FULL_HD1: '   ', SD2: 'https://pull.example.com/sd2.flv' }
    }))

    expect(pick.quality).toBe('SD2')
  })

  // HD1 只在 amagi 的 FluffyFlvPullurl 里声明，本仓这条路径的类型没承诺它，
  // 但上游真给的时候不能白扔。
  it('picks up undeclared qualities such as HD1 as a runtime fallback', () => {
    const pick = pickDouyinLiveStream(liveItem({
      flv_pull_url: { HD1: 'https://pull.example.com/hd1.flv' }
    }))

    expect(pick.url).toBe('https://pull.example.com/hd1.flv')
    expect(pick.quality).toBe('HD1')
  })

  it('resolves the Chinese quality name from resolution_name', () => {
    const pick = pickDouyinLiveStream(liveItem({
      flv_pull_url: { FULL_HD1: 'https://pull.example.com/full.flv' },
      resolution_name: { FULL_HD1: '蓝光' }
    }))

    expect(pick.qualityName).toBe('蓝光')
  })

  it('falls back to the quality key when resolution_name has no entry', () => {
    const pick = pickDouyinLiveStream(liveItem({
      flv_pull_url: { SD2: 'https://pull.example.com/sd2.flv' }
    }))

    expect(pick.qualityName).toBe('SD2')
  })
})

// 这一组钉的是 `douyin.live.quality` 那个配置项的语义：它只改变尝试顺序。
// 「只认配置值」会让「用户填了 FULL_HD1、主播只推 SD1」变成录不到，而那条流是可播的。
describe('pickDouyinLiveStream 配置的档位偏好', () => {
  it('把配置的档位排到内置优先级表前面', () => {
    const pick = pickDouyinLiveStream(liveItem({
      flv_pull_url: {
        FULL_HD1: 'https://pull.example.com/full.flv',
        SD1: 'https://pull.example.com/sd1.flv'
      }
    }), 'SD1')

    expect(pick.quality).toBe('SD1')
  })

  it('配置内置表里没有的档位（HD1）也照样先试', () => {
    const pick = pickDouyinLiveStream(liveItem({
      flv_pull_url: {
        FULL_HD1: 'https://pull.example.com/full.flv',
        HD1: 'https://pull.example.com/hd1.flv'
      }
    }), 'HD1')

    expect(pick.quality).toBe('HD1')
  })

  it('配置的档位拿不到地址时继续往下试，而不是判失败', () => {
    const pick = pickDouyinLiveStream(liveItem({
      flv_pull_url: {
        FULL_HD1: '',
        SD1: 'https://pull.example.com/sd1.flv'
      }
    }), 'FULL_HD1')

    expect(pick.url).toBe('https://pull.example.com/sd1.flv')
    expect(pick.quality).toBe('SD1')
  })

  it('配置了一个上游压根没给的档位时，仍然录到可播的那条', () => {
    // 用户填错档位名（或上游改名）不该等于「不能录」
    const pick = pickDouyinLiveStream(liveItem({
      flv_pull_url: { SD2: 'https://pull.example.com/sd2.flv' }
    }), 'NOT_A_QUALITY')

    expect(pick.quality).toBe('SD2')
  })

  it('空串与纯空白的配置值等于没配，按内置顺序走', () => {
    const streamUrl = {
      flv_pull_url: {
        SD2: 'https://pull.example.com/sd2.flv',
        FULL_HD1: 'https://pull.example.com/full.flv'
      }
    }

    expect(pickDouyinLiveStream(liveItem(streamUrl), '').quality).toBe('FULL_HD1')
    expect(pickDouyinLiveStream(liveItem(streamUrl), '   ').quality).toBe('FULL_HD1')
    expect(pickDouyinLiveStream(liveItem(streamUrl)).quality).toBe('FULL_HD1')
  })

  it('配置值两侧的空白被剪掉，不会因此错过那个档位', () => {
    const pick = pickDouyinLiveStream(liveItem({
      flv_pull_url: {
        FULL_HD1: 'https://pull.example.com/full.flv',
        SD2: 'https://pull.example.com/sd2.flv'
      }
    }), '  SD2  ')

    expect(pick.quality).toBe('SD2')
  })

  it('配置内置表里已有的档位时不会把它试两遍', () => {
    // 去重的回归：`FULL_HD1` 插到队首后，内置表里那份必须被过滤掉，
    // 否则兜底扫描的「跳过优先级表里的键」判据要多考虑一次重复项
    const pick = pickDouyinLiveStream(liveItem({
      flv_pull_url: { FULL_HD1: 'https://pull.example.com/full.flv' }
    }), 'FULL_HD1')

    expect(pick.quality).toBe('FULL_HD1')
    expect(pick.url).toBe('https://pull.example.com/full.flv')
  })
})

describe('pickDouyinLiveStream malformed responses', () => {
  it('does not throw when stream_url is missing entirely', () => {
    expect(() => pickDouyinLiveStream({})).not.toThrow()
    expect(pickDouyinLiveStream({})).toEqual({ url: '', quality: '', qualityName: '' })
  })

  it('does not throw when flv_pull_url is missing', () => {
    const pick = pickDouyinLiveStream(liveItem({ default_resolution: 'FULL_HD1' }))

    expect(pick).toEqual({ url: '', quality: '', qualityName: '' })
  })

  it('does not throw when the whole live item is undefined', () => {
    expect(() => pickDouyinLiveStream(undefined)).not.toThrow()
    expect(pickDouyinLiveStream(undefined).url).toBe('')
  })

  it('does not throw when every declared quality is an empty string', () => {
    const pick = pickDouyinLiveStream(liveItem({
      flv_pull_url: { FULL_HD1: '', SD1: '', SD2: '' }
    }))

    expect(pick.url).toBe('')
    expect(pick.quality).toBe('')
  })

  it('ignores non-string quality values instead of returning them', () => {
    // 上游把地址换成对象/数字时，不能把它当地址透传给 ffmpeg
    const pick = pickDouyinLiveStream(liveItem({
      flv_pull_url: { FULL_HD1: 1234, SD1: 'https://pull.example.com/sd1.flv' } as never
    }))

    expect(pick.url).toBe('https://pull.example.com/sd1.flv')
  })
})
