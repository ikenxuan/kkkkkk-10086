import { describe, expect, it, vi } from 'vitest'

/**
 * 宿主的 `lib/common/common.js` 在测试环境里不存在，`runtime/host/common` 会在 import
 * 期就 `importHost` 失败。这个替身同时是断言对象：转发的节点数组原样落在它的调用参数里。
 */
const makeForwardMsg = vi.fn((_event: unknown, messages: unknown[], title: string) => ({ messages, title }))

vi.mock('../../src/runtime/host/common.js', () => ({
  default: { makeForwardMsg }
}))

globalThis.segment = {
  image: (file: string) => ({ type: 'image', file })
} as never

const { buildLiveStreamForward } = await import('../../src/module/platform/common/liveStreamForward.js')
type LiveStreamEntry = import('../../src/module/platform/common/liveStreamForward.js').LiveStreamEntry
type LiveRoomHeadline = import('../../src/module/platform/common/liveStreamForward.js').LiveRoomHeadline

const event = { group_id: 1 } as never

const headline = (options: Partial<LiveRoomHeadline> = {}): LiveRoomHeadline => ({
  imageUrl: 'https://cover.example.com/room.jpg',
  title: '韩式双开门',
  author: '小纯同学',
  online: '340人正在观看',
  shareUrl: 'https://webcast.amemv.com/douyin/webcast/reflow/7543662824310573864?sec_user_id=MS4wAAA',
  ...options
})

const entry = (options: Partial<LiveStreamEntry> = {}): LiveStreamEntry => ({
  quality: 'FULL_HD1',
  qualityName: '蓝光',
  protocol: 'flv',
  url: 'https://pull-flv.example.com/or4.flv',
  ...options
})

/** 取出替身收到的节点数组 */
const nodesOf = (): unknown[] => makeForwardMsg.mock.calls.at(-1)?.[1] as unknown[]

/** 只取纯文本节点（第一条是 [图, 文字] 数组，取它的文字部分） */
const textOf = (node: unknown): string =>
  Array.isArray(node) ? String(node[1]) : String(node)

describe('buildLiveStreamForward 第一条节点', () => {
  it('图片和文字在同一条节点里，四行都带 emoji', async () => {
    await buildLiveStreamForward(event, headline(), [entry()], '标题')

    const first = nodesOf()[0] as unknown[]
    expect(Array.isArray(first)).toBe(true)
    expect(first[0]).toEqual({ type: 'image', file: 'https://cover.example.com/room.jpg' })
    const text = String(first[1])
    expect(text).toContain('📺标题：韩式双开门')
    expect(text).toContain('🎤作者：小纯同学')
    expect(text).toContain('🏄‍♂️在线人数：340人正在观看')
    expect(text).toContain('🔗在线地址：https://webcast.amemv.com/douyin/webcast/reflow/7543662824310573864')
  })

  // 签名直链会失效，而这条消息会一直留在群里；不说一句用户只会看到 403
  it('末尾附一句失效说明', async () => {
    await buildLiveStreamForward(event, headline(), [entry()], '标题')

    expect(textOf(nodesOf()[0])).toContain('失效')
  })

  // 缺图不该印出一个裂图段
  it('没有图时第一条节点只有文字', async () => {
    await buildLiveStreamForward(event, headline({ imageUrl: '' }), [entry()], '标题')

    const first = nodesOf()[0]
    expect(Array.isArray(first)).toBe(false)
    expect(String(first)).toContain('📺标题：')
  })

  // 印一个「标题：undefined」比不印更难看，所以取不到的字段整行不渲染
  it('取不到的字段整行不渲染', async () => {
    await buildLiveStreamForward(
      event,
      headline({ title: '', author: '', online: '', shareUrl: '' }),
      [entry()],
      '标题'
    )

    const text = textOf(nodesOf()[0])
    expect(text).not.toContain('标题：')
    expect(text).not.toContain('作者：')
    expect(text).not.toContain('在线人数：')
    expect(text).not.toContain('在线地址：')
    expect(text).toContain('失效')
  })
})

describe('buildLiveStreamForward 地址节点', () => {
  /*
    协议优先、画质其次：同协议的几档挨在一起，用户挑完协议只在相邻几行里比画质。
    按画质分组会让 FLV 和 M3U8 交替出现，复制时要跳着找。
  */
  it('FLV 全列完再列 M3U8，同协议内保持入参顺序', async () => {
    await buildLiveStreamForward(event, headline(), [
      entry({ qualityName: '蓝光', protocol: 'flv', url: 'https://x/or4.flv' }),
      entry({ qualityName: '蓝光', protocol: 'hls', url: 'https://x/or4.m3u8' }),
      entry({ qualityName: '高清', protocol: 'flv', url: 'https://x/sd.flv' }),
      entry({ qualityName: '高清', protocol: 'hls', url: 'https://x/sd.m3u8' }),
      entry({ qualityName: '标清', protocol: 'flv', url: 'https://x/ld.flv' }),
      entry({ qualityName: '标清', protocol: 'hls', url: 'https://x/ld.m3u8' })
    ], '标题')

    // 第 0 条是房间信息，地址从第 1 条开始
    expect(nodesOf().slice(1).map(textOf)).toEqual([
      '🎥FLV_蓝光：https://x/or4.flv',
      '🎥FLV_高清：https://x/sd.flv',
      '🎥FLV_标清：https://x/ld.flv',
      '📡M3U8_蓝光：https://x/or4.m3u8',
      '📡M3U8_高清：https://x/sd.m3u8',
      '📡M3U8_标清：https://x/ld.m3u8'
    ])
  })

  // 用户复制这条是去丢给播放器的，播放器认的是 m3u8 这个说法而不是 hls
  it('hls 显示成 M3U8', async () => {
    await buildLiveStreamForward(event, headline(), [entry({ protocol: 'hls' })], '标题')

    expect(textOf(nodesOf()[1])).toMatch(/^📡M3U8_/)
  })

  /*
    B站那条的 format 是 flv / ts / fmp4，表里只有前者。
    表外协议按 indexOf 会拿到 -1 排到最前面 —— 这里钉住它排最后。
  */
  it('表外协议大写显示并排到最后', async () => {
    await buildLiveStreamForward(event, headline(), [
      entry({ qualityName: '原画', protocol: 'fmp4', url: 'https://x/live.m4s' }),
      entry({ qualityName: '原画', protocol: 'flv', url: 'https://x/live.flv' })
    ], '标题')

    expect(nodesOf().slice(1).map(textOf)).toEqual([
      '🎥FLV_原画：https://x/live.flv',
      'FMP4_原画：https://x/live.m4s'
    ])
  })

  it('转发描述原样传给宿主', async () => {
    await buildLiveStreamForward(event, headline(), [entry()], '小纯同学 的直播间信息')

    expect(makeForwardMsg.mock.calls.at(-1)?.[2]).toBe('小纯同学 的直播间信息')
  })

  // 未开播、或上游一条地址都没给时，不该发一条只有房间信息的空转发
  it('清单为空时返回 undefined 且不调宿主', async () => {
    makeForwardMsg.mockClear()

    await expect(buildLiveStreamForward(event, headline(), [], '标题')).resolves.toBeUndefined()
    expect(makeForwardMsg).not.toHaveBeenCalled()
  })
})
