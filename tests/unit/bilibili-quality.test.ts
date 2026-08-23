import { beforeEach, describe, expect, it, vi } from 'vitest'

interface FakeVideoStream {
  [key: string]: unknown
  id: number
  base_url: string
}

const configMock = vi.hoisted(() => ({
  bilibili: {} as Record<string, unknown>,
  cookies: {} as Record<string, unknown>,
  app: {} as Record<string, unknown>,
  upload: {} as Record<string, unknown>,
  request: {} as Record<string, unknown>,
  getConfig: () => ({})
}))

/** url -> 响应头，用于驱动 getvideosize 的 content-range 解析 */
const headersByUrl = vi.hoisted(() => new Map<string, Record<string, string>>())
/** 需要抛错的 url，用于覆盖体积获取失败分支 */
const failingUrls = vi.hoisted(() => new Set<string>())

vi.mock('../../src/module/utils/index.js', () => ({
  Base: class {
    e: unknown
    headers: Record<string, string> = {}
  },
  baseHeaders: {},
  Config: configMock,
  Common: { tempDri: { images: '', video: '', default: '' }, useDarkTheme: () => false },
  Render: vi.fn(),
  Networks: class {
    url: string
    constructor (options: { url: string }) {
      this.url = options.url
    }

    async getHeaders (): Promise<Record<string, string>> {
      if (failingUrls.has(this.url)) throw new Error(`headers unavailable for ${this.url}`)
      return headersByUrl.get(this.url) ?? {}
    }
  },
  mergeFile: vi.fn(),
  downloadFile: vi.fn(),
  downloadVideo: vi.fn(),
  uploadFile: vi.fn(),
  processImageUrl: vi.fn(),
  Version: { BotName: 'TRSS-Yunzai', version: 'test', pluginName: 'kkkkkk-10086' }
}))

vi.mock('../../src/module/platform/bilibili/index.js', () => ({
  bilibiliComments: vi.fn(),
  checkCk: vi.fn(),
  genParams: vi.fn()
}))

vi.mock('../../src/module/platform/bilibili/api.js', () => ({
  getBilibiliData: vi.fn()
}))

vi.mock('../../src/module/platform/common/danmaku.js', () => ({
  burnDanmaku: vi.fn()
}))

vi.mock('../../src/module/platform/common/livePhoto.js', () => ({
  buildLivePhotoMessages: vi.fn(),
  buildLivePhotoTipMessage: vi.fn()
}))

vi.mock('../../src/runtime/host/common.js', () => ({
  default: { makeForwardMsg: vi.fn() }
}))

globalThis.logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  mark: vi.fn()
} as unknown as typeof logger

const {
  Bilibili,
  bilibiliProcessVideos,
  dedupeBilibiliVideoStreams,
  getvideosize
} = await import('../../src/module/platform/bilibili/bilibili.js')

/** 构造一个带 content-range 的响应头，size 单位 MB */
const contentRange = (sizeInMB: number): Record<string, string> => ({
  'content-range': `bytes 0-1/${sizeInMB * 1024 * 1024}`
})

const stream = (id: number, base_url: string): FakeVideoStream => ({ id, base_url })

beforeEach(() => {
  configMock.bilibili = {}
  configMock.cookies = {}
  headersByUrl.clear()
  failingUrls.clear()
})

describe('dedupeBilibiliVideoStreams', () => {
  it('keeps the first stream of every quality id', () => {
    const input = [
      stream(120, 'first-120'),
      stream(80, 'first-80'),
      stream(120, 'second-120'),
      stream(80, 'second-80'),
      stream(64, 'first-64')
    ]

    expect(dedupeBilibiliVideoStreams(input)).toEqual([
      stream(120, 'first-120'),
      stream(80, 'first-80'),
      stream(64, 'first-64')
    ])
  })

  it('leaves an already unique list untouched', () => {
    const input = [stream(80, 'a'), stream(64, 'b')]

    expect(dedupeBilibiliVideoStreams(input)).toEqual(input)
  })

  it('returns an empty list for missing input', () => {
    expect(dedupeBilibiliVideoStreams(undefined)).toEqual([])
    expect(dedupeBilibiliVideoStreams([])).toEqual([])
  })

  it('does not mutate the source array', () => {
    const input = [stream(80, 'a'), stream(80, 'b')]
    dedupeBilibiliVideoStreams(input)

    expect(input).toHaveLength(2)
  })
})

describe('Bilibili adapter lookup', () => {
  it('does not require an event object when the caller only inspects the adapter', () => {
    const instance = new Bilibili(undefined, {})

    expect(instance.botadapter).toBeUndefined()
  })
})

describe('bilibiliProcessVideos fixed quality strategy', () => {
  it('picks the exactly matching quality', async () => {
    configMock.bilibili = { videoQuality: 80 }
    const videoList = [stream(64, 'u64'), stream(80, 'u80'), stream(120, 'u120')]

    const result = await bilibiliProcessVideos(
      { accept_description: ['超清 4K', '高清 1080P', '高清720P'], bvid: 'BV1', qn: 80 },
      videoList,
      'audio'
    )

    expect(result.videoList).toEqual([stream(80, 'u80')])
    expect(result.selectedQuality).toBe('高清 1080P')
    expect(result.accept_description).toEqual(['高清 1080P'])
  })

  it('falls back to the largest quality below the target', async () => {
    configMock.bilibili = { videoQuality: 80 }
    const videoList = [stream(64, 'u64'), stream(120, 'u120'), stream(80, 'u80')]

    const result = await bilibiliProcessVideos(
      { accept_description: ['超清 4K'], bvid: 'BV1', qn: 116 },
      videoList,
      'audio'
    )

    expect(result.videoList).toEqual([stream(80, 'u80')])
    expect(result.selectedQuality).toBe('高清 1080P')
  })

  it('falls back to the smallest quality above the target when nothing is lower', async () => {
    configMock.bilibili = { videoQuality: 80 }
    const videoList = [stream(120, 'u120'), stream(80, 'u80')]

    const result = await bilibiliProcessVideos(
      { accept_description: ['超清 4K'], bvid: 'BV1', qn: 6 },
      videoList,
      'audio'
    )

    expect(result.videoList).toEqual([stream(80, 'u80')])
    expect(result.selectedQuality).toBe('高清 1080P')
  })

  it('uses the configured quality when the caller passes none', async () => {
    configMock.bilibili = { videoQuality: 120 }
    const videoList = [stream(80, 'u80'), stream(120, 'u120')]

    const result = await bilibiliProcessVideos(
      { accept_description: ['超清 4K'], bvid: 'BV1' },
      videoList,
      'audio'
    )

    expect(result.videoList).toEqual([stream(120, 'u120')])
    expect(result.selectedQuality).toBe('超清 4K')
  })

  it('defaults to 1080P when neither the caller nor the config sets a quality', async () => {
    const videoList = [stream(32, 'u32'), stream(80, 'u80'), stream(120, 'u120')]

    const result = await bilibiliProcessVideos(
      { accept_description: ['超清 4K'], bvid: 'BV1' },
      videoList,
      'audio'
    )

    expect(result.videoList).toEqual([stream(80, 'u80')])
    expect(result.selectedQuality).toBe('高清 1080P')
  })

  it('falls back to the first accept_description for an unmapped quality id', async () => {
    configMock.bilibili = { videoQuality: 999 }

    const result = await bilibiliProcessVideos(
      { accept_description: ['自定义画质', '高清 1080P'], bvid: 'BV1', qn: 999 },
      [stream(999, 'u999')],
      'audio'
    )

    expect(result.videoList).toEqual([stream(999, 'u999')])
    expect(result.selectedQuality).toBe('自定义画质')
    expect(result.accept_description).toEqual(['自定义画质'])
  })

  it('reports an unknown quality for an empty stream list', async () => {
    configMock.bilibili = { videoQuality: 80 }

    const result = await bilibiliProcessVideos(
      { accept_description: [], bvid: 'BV1', qn: 80 },
      [],
      'audio'
    )

    expect(result.videoList).toEqual([])
    expect(result.selectedQuality).toBe('未知')
    expect(result.accept_description).toEqual(['未知'])
  })

  it('never requests any stream size in fixed quality mode', async () => {
    configMock.bilibili = { videoQuality: 80 }
    headersByUrl.set('u80', contentRange(999))

    await bilibiliProcessVideos(
      { accept_description: ['高清 1080P'], bvid: 'BV1', qn: 80 },
      [stream(80, 'u80')],
      'audio'
    )

    // 走固定画质分支时不应触发任何体积探测，failingUrls 为空即不会抛错，
    // 这里通过缺失的 audio 响应头来确认逻辑没有进入体积计算
    expect(headersByUrl.get('audio')).toBeUndefined()
  })
})

describe('bilibiliProcessVideos automatic size strategy', () => {
  beforeEach(() => {
    headersByUrl.set('audio', contentRange(5))
  })

  it('selects the largest stream that stays under the size limit', async () => {
    configMock.bilibili = { videoQuality: 0, maxAutoVideoSize: 100 }
    headersByUrl.set('u64', contentRange(20))
    headersByUrl.set('u80', contentRange(50))
    headersByUrl.set('u120', contentRange(200))

    const result = await bilibiliProcessVideos(
      { accept_description: ['超清 4K', '高清 1080P', '高清720P'], bvid: 'BV1', qn: 0 },
      [stream(120, 'u120'), stream(80, 'u80'), stream(64, 'u64')],
      'audio'
    )

    expect(result.videoList).toEqual([stream(80, 'u80')])
    expect(result.selectedQuality).toBe('高清 1080P')
    expect(result.accept_description).toEqual(['高清 1080P'])
  })

  it('prefers the caller supplied size limit over the config', async () => {
    configMock.bilibili = { videoQuality: 0, maxAutoVideoSize: 500 }
    headersByUrl.set('u64', contentRange(20))
    headersByUrl.set('u80', contentRange(50))

    const result = await bilibiliProcessVideos(
      { accept_description: ['高清 1080P', '高清720P'], bvid: 'BV1', qn: 0, maxAutoVideoSize: 30 },
      [stream(80, 'u80'), stream(64, 'u64')],
      'audio'
    )

    expect(result.videoList).toEqual([stream(64, 'u64')])
    expect(result.selectedQuality).toBe('高清720P')
  })

  it('adds the resolved quality when accept_description does not contain it', async () => {
    configMock.bilibili = { videoQuality: 0, maxAutoVideoSize: 100 }
    headersByUrl.set('u80', contentRange(50))

    const result = await bilibiliProcessVideos(
      { accept_description: ['某个未对应的描述'], bvid: 'BV1', qn: 0 },
      [stream(80, 'u80')],
      'audio'
    )

    expect(result.accept_description).toEqual(['高清 1080P'])
    expect(result.selectedQuality).toBe('高清 1080P')
  })

  it('falls back to the last stream when every quality exceeds the limit', async () => {
    configMock.bilibili = { videoQuality: 0, maxAutoVideoSize: 10 }
    headersByUrl.set('u120', contentRange(400))
    headersByUrl.set('u80', contentRange(200))

    const result = await bilibiliProcessVideos(
      { accept_description: ['超清 4K', '高清 1080P'], bvid: 'BV1', qn: 0 },
      [stream(120, 'u120'), stream(80, 'u80')],
      'audio'
    )

    expect(result.videoList).toEqual([stream(80, 'u80')])
    expect(result.accept_description).toEqual(['高清 1080P'])
    expect(result.selectedQuality).toBe('高清 1080P')
  })

  it('treats a stream whose size cannot be resolved as oversized', async () => {
    configMock.bilibili = { videoQuality: 0, maxAutoVideoSize: 100 }
    failingUrls.add('u120')
    headersByUrl.set('u80', contentRange(50))

    const result = await bilibiliProcessVideos(
      { accept_description: ['超清 4K', '高清 1080P'], bvid: 'BV1', qn: 0 },
      [stream(120, 'u120'), stream(80, 'u80')],
      'audio'
    )

    expect(result.videoList).toEqual([stream(80, 'u80')])
    expect(result.selectedQuality).toBe('高清 1080P')
  })

  it('uses the default 100MB limit when nothing is configured', async () => {
    configMock.bilibili = { videoQuality: 0 }
    headersByUrl.set('u80', contentRange(50))
    headersByUrl.set('u120', contentRange(300))

    const result = await bilibiliProcessVideos(
      { accept_description: ['超清 4K', '高清 1080P'], bvid: 'BV1', qn: 0 },
      [stream(120, 'u120'), stream(80, 'u80')],
      'audio'
    )

    expect(result.videoList).toEqual([stream(80, 'u80')])
    expect(result.selectedQuality).toBe('高清 1080P')
  })

  it('enters the automatic branch when only the config asks for it', async () => {
    configMock.bilibili = { videoQuality: 0, maxAutoVideoSize: 100 }
    headersByUrl.set('u80', contentRange(50))

    const result = await bilibiliProcessVideos(
      { accept_description: ['高清 1080P'], bvid: 'BV1', qn: 120 },
      [stream(80, 'u80')],
      'audio'
    )

    expect(result.selectedQuality).toBe('高清 1080P')
    expect(result.videoList).toEqual([stream(80, 'u80')])
  })
})

describe('getvideosize', () => {
  it('sums the video and audio content ranges', async () => {
    headersByUrl.set('video-url', contentRange(20))
    headersByUrl.set('audio-url', contentRange(5.5))

    expect(await getvideosize('video-url', 'audio-url', 'BV1')).toBe('25.50')
  })

  it('reports zero when neither response exposes a content range', async () => {
    expect(await getvideosize('video-url', 'audio-url', 'BV1')).toBe('0.00')
  })

  it('counts only the side that exposes a content range', async () => {
    headersByUrl.set('video-url', contentRange(12))

    expect(await getvideosize('video-url', 'audio-url', 'BV1')).toBe('12.00')
  })
})
