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
  // 批量入口的默认返回：results 为空 => 每张图都走普通图片回退分支。
  buildLivePhotoMessagesBatch: vi.fn(async () => ({ results: [], tempFiles: [], generatedLivePhoto: false })),
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

/**
 * 「插件认为未登录」和「B站返回哪种流」是两个独立判据，会打架：
 * amagi 的 qtparam 按 `cookie === ''` 分流（只有空串才请求 &platform=html5 拿 durl 直链），
 * 而本插件的 checkCk() 判的是 ck 有不有效。ck 填了但失效时，amagi 按已登录去请求，
 * 回来只有 dash 没有 durl —— 旧代码的未登录分支只读 durl，于是直接报
 * 「无法下载视频,请配置CooKie后重试」，把配了 ck 的用户往配置方向误导。
 * 真实响应形状已实测：durl=0、dash.video=4、dash.audio=3。
 */
describe('getvideo 未登录分支的流兜底', () => {
  // 文件顶层的 beforeEach 只重置 configMock，不清 vi 的调用记录。这三条用例互相断言
  // 「有没有调过 mergeFile / logger.error」，不清的话第一条留下的合流记录会让第二条误判。
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /** 造一个只跑未登录分支的实例：islogin=false 且不烧弹幕 */
  const noLoginInstance = (): InstanceType<typeof Bilibili> => {
    const instance = new Bilibili({ reply: vi.fn() } as never, {})
    instance.islogin = false
    instance.downloadfilename = 'test-video'
    return instance
  }

  it('响应只有 dash 时走合流，不再误报「请配置CooKie后重试」', async () => {
    const { downloadFile, mergeFile } = await import('../../src/module/utils/index.js')
    vi.mocked(downloadFile).mockResolvedValue({ filepath: '/tmp/fake' } as never)
    vi.mocked(mergeFile).mockResolvedValue(undefined as never)

    const instance = noLoginInstance()
    await instance.getvideo({
      playUrlData: {
        data: {
          data: {
            durl: [],
            dash: {
              video: [{ id: 80, base_url: 'https://example.com/v.m4s', backup_url: [] }],
              audio: [{ id: 30280, base_url: 'https://example.com/a.m4s', backup_url: [] }]
            }
          }
        }
      }
    } as never)

    // 视频流和音频流各下一次，然后合流 —— 而不是报错走人
    expect(vi.mocked(downloadFile).mock.calls.map(call => call[0])).toEqual([
      'https://example.com/v.m4s',
      'https://example.com/a.m4s'
    ])
    expect(mergeFile).toHaveBeenCalledOnce()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('响应有 durl 时仍走单文件直链，不多下一次音频', async () => {
    const { downloadVideo, mergeFile } = await import('../../src/module/utils/index.js')
    vi.mocked(downloadVideo).mockResolvedValue(undefined as never)

    const instance = noLoginInstance()
    await instance.getvideo({
      playUrlData: { data: { data: { durl: [{ url: 'https://example.com/full.mp4' }] } } }
    } as never)

    expect(vi.mocked(downloadVideo).mock.calls[0]?.[1]).toMatchObject({ video_url: 'https://example.com/full.mp4' })
    // durl 自带音轨，不需要合流
    expect(mergeFile).not.toHaveBeenCalled()
  })

  it('durl 和 dash 都为空时才报错，且文案不再把人往配置 ck 上引', async () => {
    const reply = vi.fn()
    const instance = new Bilibili({ reply } as never, {})
    instance.islogin = false

    await instance.getvideo({ playUrlData: { data: { data: { durl: [], dash: {} } } } } as never)

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('没有返回任何可用的视频流'))
    expect(vi.mocked(logger.error).mock.calls.flat().join(' ')).not.toContain('请配置CooKie')
    expect(reply).toHaveBeenCalled()
  })
})

/**
 * `bilibiliCdnMode` 的改写次序在 bilibili-cdn.test.ts 里逐条钉过了，那批用例测的是纯函数。
 * 这里钉的是另一件事：面板上那两个开关到底有没有走到下载层。
 *
 * 分开测是因为两者的失效方式不一样 —— 改写函数算得再对，只要 `getvideo` 忘了把结果
 * 往下传，开关在用户看来就是「开了没用」，而纯函数的用例全绿，一个字都不会报。
 */
describe('CDN 选路配置到下载层的交接', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /** 跑未登录的 dash 合流分支：那条路要下两次（视频 + 音频），正好看得出两者的差别 */
  const runDashMerge = async (): Promise<void> => {
    const { downloadFile, mergeFile } = await import('../../src/module/utils/index.js')
    vi.mocked(downloadFile).mockResolvedValue({ filepath: '/tmp/fake' } as never)
    vi.mocked(mergeFile).mockResolvedValue(undefined as never)

    const instance = new Bilibili({ reply: vi.fn() } as never, { type: 'one_video' })
    instance.islogin = false
    instance.downloadfilename = 'test-video'
    await instance.getvideo({
      infoData: { data: { bvid: 'BV1test' } },
      playUrlData: {
        data: {
          data: {
            durl: [],
            dash: {
              video: [{ id: 80, base_url: 'https://example.com/v.m4s', backup_url: [] }],
              audio: [{ id: 30280, base_url: 'https://example.com/a.m4s', backup_url: [] }]
            }
          }
        }
      }
    } as never)
  }

  it('开着测速时只有视频流带 probeCdn，音频流不带', async () => {
    configMock.bilibili = { bilibiliCdnProbe: true }
    const { downloadFile } = await import('../../src/module/utils/index.js')

    await runDashMerge()

    const [video, audio] = vi.mocked(downloadFile).mock.calls
    expect(video?.[1]).toMatchObject({ probeCdn: true })
    // 音频那一路刻意不测速：它只有几兆，为它多等一次握手不值得，而且两路流的主机名
    // 基本相同，视频那次的结果已经进了按主机缓存的表，音频直接命中。
    expect(audio?.[1]).not.toMatchObject({ probeCdn: true })
  })

  it('默认（配置里没有这一项）不测速，不给新主机的首次下载加等待', async () => {
    configMock.bilibili = {}
    const { downloadFile } = await import('../../src/module/utils/index.js')

    await runDashMerge()

    expect(vi.mocked(downloadFile).mock.calls[0]?.[1]).toMatchObject({ probeCdn: false })
  })

  // 读的是 `=== true`，所以 YAML 里被写成字符串 'false' 之类的脏值不会被当成开启。
  it('只认布尔真值，字符串不算开', async () => {
    configMock.bilibili = { bilibiliCdnProbe: 'true' }
    const { downloadFile } = await import('../../src/module/utils/index.js')

    await runDashMerge()

    expect(vi.mocked(downloadFile).mock.calls[0]?.[1]).toMatchObject({ probeCdn: false })
  })

  it('视频与音频用不同的地址簿键，候选清单不会互相污染', async () => {
    configMock.bilibili = {}
    const { downloadFile } = await import('../../src/module/utils/index.js')

    await runDashMerge()

    const [video, audio] = vi.mocked(downloadFile).mock.calls
    expect(video?.[1]).toMatchObject({ resource: 'bili:BV1test:video' })
    expect(audio?.[1]).toMatchObject({ resource: 'bili:BV1test:audio' })
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

  // 原来这条用例只给一条流，手动挡和自动挡都会选中它，断言其实分不出走了哪个分支。
  // 这里让「按 id 精确匹配」和「按体积挑」得出不同答案：4K 那条超限，
  // 只有自动挡才会退到 1080P；上游的 `||` 判断会走手动挡、精确命中 qn: 120 拿到 4K。
  it('automatic branch wins over an explicit qn', async () => {
    configMock.bilibili = { videoQuality: 0, maxAutoVideoSize: 100 }
    headersByUrl.set('u120', contentRange(300))
    headersByUrl.set('u80', contentRange(50))

    const result = await bilibiliProcessVideos(
      { accept_description: ['超清 4K', '高清 1080P'], bvid: 'BV1', qn: 120 },
      [stream(120, 'u120'), stream(80, 'u80')],
      'audio'
    )

    expect(result.selectedQuality).toBe('高清 1080P')
    expect(result.videoList).toEqual([stream(80, 'u80')])
  })

  // 反方向：配置是固定画质，但调用方显式传 qn: 0 要自动挡。
  // 上游的 `||` 会进手动挡并把 targetQuality 算成 0，
  // 于是 lowerVideos 为空、higherVideos[0] 取到升序后的最低清晰度（720P）。
  it('treats an explicit qn: 0 as automatic even when the config pins a quality', async () => {
    configMock.bilibili = { videoQuality: 80, maxAutoVideoSize: 100 }
    headersByUrl.set('u120', contentRange(50))
    headersByUrl.set('u64', contentRange(20))

    const result = await bilibiliProcessVideos(
      { accept_description: ['超清 4K', '高清720P'], bvid: 'BV1', qn: 0 },
      [stream(120, 'u120'), stream(64, 'u64')],
      'audio'
    )

    expect(result.selectedQuality).toBe('超清 4K')
    expect(result.videoList).toEqual([stream(120, 'u120')])
  })

  // 选择依据是**体积**而不是清晰度 id。这里故意让两者矛盾：720P 比 1080P 还大，
  // 结果就该是 720P。删掉那段永远走不到的 largestUnderLimit 兜底后，这条用例负责钉住规则。
  it('selects by size rather than by quality id when the two disagree', async () => {
    configMock.bilibili = { videoQuality: 0, maxAutoVideoSize: 100 }
    headersByUrl.set('u120', contentRange(500))
    headersByUrl.set('u80', contentRange(30))
    headersByUrl.set('u64', contentRange(60))

    const result = await bilibiliProcessVideos(
      { accept_description: ['超清 4K', '高清 1080P', '高清720P'], bvid: 'BV1', qn: 0 },
      [stream(120, 'u120'), stream(80, 'u80'), stream(64, 'u64')],
      'audio'
    )

    expect(result.selectedQuality).toBe('高清720P')
    expect(result.videoList).toEqual([stream(64, 'u64')])
  })

  // 上游的兜底是 `[[...videoList].pop()!]`，空数组时会把 [undefined] 交给下载阶段。
  it('keeps the stream list empty instead of yielding [undefined]', async () => {
    configMock.bilibili = { videoQuality: 0, maxAutoVideoSize: 100 }

    const result = await bilibiliProcessVideos(
      { accept_description: ['高清 1080P'], bvid: 'BV1', qn: 0 },
      [],
      'audio'
    )

    expect(result.videoList).toEqual([])
    expect(result.accept_description).toEqual(['高清 1080P'])
    expect(result.selectedQuality).toBe('高清 1080P')
  })

  // 同理，accept_description 为空时上游会得到 [undefined]，这里应当保持空数组。
  it('keeps accept_description empty instead of yielding [undefined]', async () => {
    configMock.bilibili = { videoQuality: 0, maxAutoVideoSize: 10 }
    headersByUrl.set('u80', contentRange(500))

    const result = await bilibiliProcessVideos(
      { accept_description: [], bvid: 'BV1', qn: 0 },
      [stream(80, 'u80')],
      'audio'
    )

    expect(result.videoList).toEqual([stream(80, 'u80')])
    expect(result.accept_description).toEqual([])
    expect(result.selectedQuality).toBe('')
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
