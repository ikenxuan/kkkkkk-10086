import { describe, expect, it, vi } from 'vitest'

// live.ts 从 utils 的 barrel 取 `Common`，而那个 barrel 会把 Render -> puppeteer
// 一路拉进来，未构建 lib/ 时直接 ERR_MODULE_NOT_FOUND。挡掉它，只留本文件用到的面。
// `pickDouyinLiveStream` 本身不碰 Common，这个 mock 纯粹是为了让模块能加载。
vi.mock('../../src/module/utils/index.js', () => ({
  Common: { count: (value: unknown) => String(value ?? 0) }
}))

const {
  buildDouyinLiveHeadline,
  buildDouyinReflowUrl,
  listDouyinLiveStreams,
  pickDouyinLiveStream
} = await import('../../src/module/platform/douyin/live.js')
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

/**
 * 清单和挑选是两件事：挑选只要一条能播的、受配置影响；清单要全集、不受配置影响。
 * 下面这组钉住的就是这个分工，以及「上游新开的档不能从清单里消失」。
 */
describe('listDouyinLiveStreams', () => {
  it('按内置优先级从高到低排，flv 排在同档的 hls 前面', () => {
    const entries = listDouyinLiveStreams(liveItem({
      flv_pull_url: {
        SD2: 'https://pull.example.com/sd2.flv',
        FULL_HD1: 'https://pull.example.com/full.flv',
        SD1: 'https://pull.example.com/sd1.flv'
      },
      hls_pull_url_map: { FULL_HD1: 'https://pull.example.com/full.m3u8' }
    }))

    expect(entries.map(entry => `${entry.quality}:${entry.protocol}`)).toEqual([
      'FULL_HD1:flv',
      'FULL_HD1:hls',
      'SD1:flv',
      'SD2:flv'
    ])
  })

  // 内置表只写了三个键，HD1 属于「上游可能给、类型没承诺」那一类，清单不能把它漏掉
  it('优先级表外的档位追加在后面而不是被丢掉', () => {
    const entries = listDouyinLiveStreams(liveItem({
      flv_pull_url: {
        HD1: 'https://pull.example.com/hd1.flv',
        FULL_HD1: 'https://pull.example.com/full.flv',
        BRAND_NEW: 'https://pull.example.com/new.flv'
      }
    }))

    expect(entries.map(entry => entry.quality)).toEqual(['FULL_HD1', 'HD1', 'BRAND_NEW'])
  })

  it('档位中文名取 resolution_name，查不到时回落成档位键', () => {
    const entries = listDouyinLiveStreams(liveItem({
      flv_pull_url: { FULL_HD1: 'https://pull.example.com/full.flv', SD1: 'https://pull.example.com/sd1.flv' },
      resolution_name: { FULL_HD1: '原画' }
    }))

    expect(entries.map(entry => entry.qualityName)).toEqual(['原画', 'SD1'])
  })

  // 「存在但是空串」是抖音的常态，清单里出现一条空地址等于给用户一个必然失败的链接
  it('空串和非字符串值都不进清单', () => {
    const entries = listDouyinLiveStreams(liveItem({
      flv_pull_url: { FULL_HD1: '', SD1: '   ', SD2: 1234 } as never,
      hls_pull_url_map: { FULL_HD1: 'https://pull.example.com/full.m3u8' }
    }))

    expect(entries).toEqual([{
      quality: 'FULL_HD1',
      qualityName: 'FULL_HD1',
      protocol: 'hls',
      url: 'https://pull.example.com/full.m3u8'
    }])
  })

  // hls_pull_url 与 hls_pull_url_map 是同一份流的两种给法，收两遍就是同一条地址出现两次
  it('不收单条的 hls_pull_url', () => {
    const entries = listDouyinLiveStreams(liveItem({
      flv_pull_url: { FULL_HD1: 'https://pull.example.com/full.flv' },
      hls_pull_url: 'https://pull.example.com/full.m3u8'
    }))

    expect(entries).toHaveLength(1)
    expect(entries[0].protocol).toBe('flv')
  })

  it('整个 stream_url 缺失时返回空数组而不抛', () => {
    expect(() => listDouyinLiveStreams(undefined)).not.toThrow()
    expect(listDouyinLiveStreams(undefined)).toEqual([])
    expect(listDouyinLiveStreams({})).toEqual([])
    expect(listDouyinLiveStreams(liveItem({ default_resolution: 'FULL_HD1' }))).toEqual([])
  })

  // 清单不读配置：`pickDouyinLiveStream` 的 preferredQuality 那套不该漏到这里
  it('不接受也不受画质偏好影响', () => {
    const streamUrl = {
      flv_pull_url: { FULL_HD1: 'https://pull.example.com/full.flv', SD1: 'https://pull.example.com/sd1.flv' }
    }

    expect(listDouyinLiveStreams(liveItem(streamUrl)).map(entry => entry.quality)).toEqual(['FULL_HD1', 'SD1'])
    expect(pickDouyinLiveStream(liveItem(streamUrl), 'SD1').quality).toBe('SD1')
  })
})

describe('buildDouyinReflowUrl', () => {
  it('拼出 App 分享按钮那种 webcast 链接', () => {
    expect(buildDouyinReflowUrl('7543662824310573864', 'MS4wLjABAAAAQ-St3h4')).toBe(
      'https://webcast.amemv.com/douyin/webcast/reflow/7543662824310573864?sec_user_id=MS4wLjABAAAAQ-St3h4'
    )
  })

  /*
    不带 did / iid / with_sec_did：那三个是设备标识，服务端不要求，
    而硬编一个假 device id 是给风控多送一个矛盾信号。
  */
  it('不带设备标识参数', () => {
    const url = buildDouyinReflowUrl('123', 'MS4w')

    expect(url).not.toContain('did=')
    expect(url).not.toContain('iid=')
    expect(url).not.toContain('with_sec_did')
  })

  // sec_uid 里有 `-` 和 `_`，交给 URLSearchParams 转义不能把它改写坏
  it('sec_uid 原样出现在 query 里', () => {
    const secUid = 'MS4wLjABAAAANwkJuWIRFOzg5uCpDRpMj4OX-QryoDgn-yYlXQnRwQQ'

    expect(buildDouyinReflowUrl('123', secUid)).toContain(`sec_user_id=${secUid}`)
  })

  it('缺房间号或 sec_uid 时返回空串，交给调用方兜', () => {
    expect(buildDouyinReflowUrl('', 'MS4w')).toBe('')
    expect(buildDouyinReflowUrl('123', '')).toBe('')
    expect(buildDouyinReflowUrl('', '')).toBe('')
  })
})

/** 造一份够 headline 用的房间项 */
const headlineLiveItem = (overrides: Record<string, unknown> = {}): never => ({
  cover: { url_list: ['https://cover.example.com/room.jpg'] },
  title: '韩式双开门',
  room_view_stats: { display_value: 340 },
  ...overrides
}) as never

describe('buildDouyinLiveHeadline', () => {
  const anchor = { nickname: '小纯同学', avatar_larger: { url_list: ['https://avatar.example.com/a.jpg'] } }

  it('封面 + 标题 + 作者 + 在线人数 + reflow 链', () => {
    const headline = buildDouyinLiveHeadline({
      anchor,
      liveItem: headlineLiveItem(),
      webRid: '26139686',
      roomId: '7543662824310573864',
      secUid: 'MS4wLjABAAAAQ-St3h4'
    })

    expect(headline).toEqual({
      imageUrl: 'https://cover.example.com/room.jpg',
      title: '韩式双开门',
      author: '小纯同学',
      online: '340人正在观看',
      shareUrl: 'https://webcast.amemv.com/douyin/webcast/reflow/7543662824310573864?sec_user_id=MS4wLjABAAAAQ-St3h4'
    })
  })

  // 封面比头像信息量大，但封面缺了不该让这条节点没有图
  it('没有封面时回落到主播头像', () => {
    const headline = buildDouyinLiveHeadline({
      anchor,
      liveItem: headlineLiveItem({ cover: undefined }),
      webRid: '26139686',
      roomId: '123',
      secUid: 'MS4w'
    })

    expect(headline.imageUrl).toBe('https://avatar.example.com/a.jpg')
  })

  // 拼不出 reflow 链时回落到卡片上那条 live.douyin.com
  it('缺内部房间号时回落到 web_rid 链', () => {
    const headline = buildDouyinLiveHeadline({
      anchor,
      liveItem: headlineLiveItem(),
      webRid: '26139686',
      roomId: '',
      secUid: 'MS4w'
    })

    expect(headline.shareUrl).toBe('https://live.douyin.com/26139686')
  })

  it('连 web_rid 都没有时 shareUrl 为空串', () => {
    const headline = buildDouyinLiveHeadline({
      anchor,
      liveItem: headlineLiveItem(),
      webRid: '',
      roomId: '',
      secUid: ''
    })

    expect(headline.shareUrl).toBe('')
  })

  /*
    抖音的 `*_str` 字段本身就是展示文本（'5.3万'）。直接 Number() 会得到 NaN，
    所以要走 displayCount 那条「带单位原样透传」的分支再补「正在观看」。
  */
  it('带单位的人数原样透传', () => {
    const headline = buildDouyinLiveHeadline({
      anchor,
      liveItem: headlineLiveItem({ room_view_stats: { display_value: '5.3万' } }),
      webRid: '1',
      roomId: '1',
      secUid: 'MS4w'
    })

    expect(headline.online).toBe('5.3万人正在观看')
  })

  it('room_view_stats 缺失时退到 stats.user_count_str', () => {
    const headline = buildDouyinLiveHeadline({
      anchor,
      liveItem: headlineLiveItem({ room_view_stats: undefined, stats: { user_count_str: '1234' } }),
      webRid: '1',
      roomId: '1',
      secUid: 'MS4w'
    })

    expect(headline.online).toBe('1234人正在观看')
  })

  // 取不到人数时给空串，让排版层整行不渲染，而不是印出「0人正在观看」
  it('两个人数字段都缺时给空串', () => {
    const headline = buildDouyinLiveHeadline({
      anchor,
      liveItem: headlineLiveItem({ room_view_stats: undefined }),
      webRid: '1',
      roomId: '1',
      secUid: 'MS4w'
    })

    expect(headline.online).toBe('')
  })

  it('整个房间项和主播都缺时不抛', () => {
    expect(() => buildDouyinLiveHeadline({
      anchor: undefined,
      liveItem: undefined,
      webRid: '',
      roomId: '',
      secUid: ''
    })).not.toThrow()
  })
})
