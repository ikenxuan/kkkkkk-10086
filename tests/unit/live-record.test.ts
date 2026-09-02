import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DouyinLiveApiFetcher } from '../../src/module/platform/douyin/live-room.js'
import type { CommandEvent } from '../../src/types/message.js'

/**
 * `common/liveRecord.ts` 的行为护栏。
 *
 * 这条流水线上每一步的失败都是「等满五分钟才发现」的那种，所以钉住的是那些
 * 用肉眼 review 看不出来的接缝：
 *
 * - **后缀**。ffmpeg 按输出文件扩展名选封装器，后缀写错等于把 ts 的字节塞进 flv 盒子。
 * - **headers 透传**。B站拉流 CDN 校验 Referer，丢了就是 403，而 403 在 ffmpeg
 *   日志里长得像「地址失效」。
 * - **时长截断**。锅巴允许 7200 秒，而协调器的预算比它小，超出的部分不是「录得更久」
 *   而是一个已知的坏状态。
 * - **体积闸在调用点**。`uploadFile` 自己没有体积门（`usefilelimit` 那道判断在
 *   `downloadVideo` 函数体内，这条路不经过它），漏了就是白录一场加一次静默失败。
 *
 * 保留真实实现的三个模块是有意的：`douyin/live.ts`（档位挑选是本文件要验的逻辑之一）、
 * `utils/media-metrics.ts`（用真的作用域收记录，比断言一次 mock 调用更接近线上）、
 * `utils/ParseCoordinator.ts`（截断上限从它的预算推导，用替身就等于自己跟自己对答案）。
 */

/** `buildAmagiRequestConfig()` 的替身返回值，只用来认第三个实参真的到位 */
const requestConfig = vi.hoisted(() => ({ timeout: 15_000 }))

const doubles = vi.hoisted(() => ({
  getDouyinID: vi.fn(),
  getBilibiliID: vi.fn(),
  fetchLiveRoomInfo: vi.fn(),
  fetchUserProfile: vi.fn(),
  buildAmagiRequestConfig: vi.fn(() => requestConfig),
  resolveDouyinLiveRoom: vi.fn(),
  fetchBilibiliLiveStream: vi.fn(),
  recordLiveStream: vi.fn(),
  uploadFile: vi.fn(),
  getVideoFileSize: vi.fn(),
  removeFile: vi.fn(),
  mkdir: vi.fn(),
  Base: vi.fn(function () { return { botadapter: 'ICQQ' } })
}))

const config = vi.hoisted(() => ({
  cookies: {} as { douyin?: string },
  douyin: {} as { live?: { maxDuration?: number, quality?: string } },
  bilibili: {} as { live?: { maxDuration?: number, qn?: number } },
  upload: {} as { usefilelimit?: boolean, filelimit?: number }
}))

vi.mock('../../src/module/utils/index.js', async () => ({
  Config: config,
  Base: doubles.Base,
  Common: {
    tempDri: { video: '/tmp/kkk/video/' },
    mkdir: doubles.mkdir,
    getVideoFileSize: doubles.getVideoFileSize,
    removeFile: doubles.removeFile,
    count: (value: unknown) => String(value)
  },
  baseHeaders: { 'User-Agent': 'test-ua' },
  // 文件名清洗用真的：这一步会真的改文件名（`「」` 之外还有一堆元字符），
  // 自己手写一个 identity 替身等于把「名字到底长什么样」这件事从断言里抹掉。
  sanitizeFilenameSegment: (await import('../../src/module/utils/filename.js')).sanitizeFilenameSegment,
  uploadFile: doubles.uploadFile
}))

vi.mock('../../src/module/utils/FFmpeg.js', () => ({
  recordLiveStream: doubles.recordLiveStream
}))

vi.mock('../../src/module/platform/douyin/index.js', () => ({
  getDouyinID: doubles.getDouyinID
}))

// 裸 fetcher 上只列被测那条路用到的两个方法：写成 Proxy 的话每次属性访问都是一个新
// `vi.fn()`，断言永远拿不到收到调用的那一份。
vi.mock('../../src/module/utils/amagiClient.js', () => ({
  douyinFetcher: {
    fetchLiveRoomInfo: doubles.fetchLiveRoomInfo,
    fetchUserProfile: doubles.fetchUserProfile
  },
  buildAmagiRequestConfig: doubles.buildAmagiRequestConfig
}))

vi.mock('../../src/module/platform/douyin/live-room.js', () => ({
  resolveDouyinLiveRoom: doubles.resolveDouyinLiveRoom
}))

vi.mock('../../src/module/platform/bilibili/index.js', () => ({
  getBilibiliID: doubles.getBilibiliID
}))

vi.mock('../../src/module/platform/bilibili/live-stream.js', () => ({
  fetchBilibiliLiveStream: doubles.fetchBilibiliLiveStream
}))

globalThis.logger = {
  debug: vi.fn(), error: vi.fn(), info: vi.fn(), mark: vi.fn(), warn: vi.fn()
} as unknown as typeof logger

const { LIVE_RECORD_MAX_DURATION_MS, recordLiveRoom } =
  await import('../../src/module/platform/common/liveRecord.js')
const { DEFAULT_PARSE_TIMEOUT_MS } = await import('../../src/module/utils/ParseCoordinator.js')
const { runWithMediaMetrics } = await import('../../src/module/utils/media-metrics.js')
const DOUYIN_URL = 'https://live.douyin.com/26139686'
const BILIBILI_URL = 'https://live.bilibili.com/1017'

const createEvent = (): CommandEvent & { reply: ReturnType<typeof vi.fn> } =>
  ({ msg: `#kkk录直播 ${DOUYIN_URL}`, user_id: 1, group_id: 2, reply: vi.fn() }) as never

/** 最后一次 `recordLiveStream` 收到的参数 */
const lastRecordOptions = (): Record<string, unknown> =>
  doubles.recordLiveStream.mock.calls.at(-1)?.[0] as Record<string, unknown>

/** 最后一次 `e.reply` 收到的文本 */
const lastReply = (event: { reply: ReturnType<typeof vi.fn> }): string =>
  String(event.reply.mock.calls.at(-1)?.[0])

/** 一个在播的抖音直播间，flv 给了两档 */
const livingRoom = (overrides: Record<string, unknown> = {}): unknown => ({
  living: true,
  anchor: { nickname: '主播/甲' },
  webRid: '26139686',
  partitionTitle: '娱乐',
  liveItem: {
    title: '深夜杂谈',
    stream_url: {
      flv_pull_url: {
        FULL_HD1: 'https://pull.douyin.com/full.flv',
        SD1: 'https://pull.douyin.com/sd.flv'
      },
      resolution_name: { FULL_HD1: '蓝光', SD1: '高清' }
    }
  },
  ...overrides
})

beforeEach(() => {
  vi.clearAllMocks()

  config.cookies = { douyin: 'douyin-ck' }
  config.douyin = {}
  config.bilibili = {}
  config.upload = {}

  doubles.getDouyinID.mockResolvedValue({ type: 'live_room_detail', room_id: '26139686' })
  doubles.getBilibiliID.mockResolvedValue({ type: 'live_room_detail', room_id: '1017' })
  doubles.resolveDouyinLiveRoom.mockResolvedValue(livingRoom())
  doubles.fetchBilibiliLiveStream.mockResolvedValue({
    url: 'https://cn-live.bilivideo.com/live.flv',
    qn: 10000,
    qualityName: '原画',
    format: 'flv',
    headers: { Referer: 'https://live.bilibili.com/1017' }
  })
  doubles.recordLiveStream.mockResolvedValue({
    success: true,
    filePath: '/tmp/kkk/video/rec.flv',
    durationMs: 300_000,
    bytes: 41_943_040
  })
  doubles.getVideoFileSize.mockResolvedValue(40)
  doubles.uploadFile.mockResolvedValue(true)
  doubles.mkdir.mockResolvedValue(true)
  doubles.removeFile.mockResolvedValue(true)
})

describe('recordLiveRoom 抖音取流', () => {
  it('把挑中的 flv 地址、时长与请求头交给 recordLiveStream', async () => {
    const event = createEvent()

    await expect(recordLiveRoom(event, 'douyin', DOUYIN_URL)).resolves.toBe(true)

    expect(lastRecordOptions()).toMatchObject({
      url: 'https://pull.douyin.com/full.flv',
      maxDurationMs: 300_000,
      // UA 不能丢：缺了可能在 CDN 侧被当成非浏览器流量
      headers: { 'User-Agent': 'test-ua', Referer: 'https://live.douyin.com/' }
    })
  })

  it('落盘后缀固定 flv —— 被 SIGTERM 打断时 flv 已写入的部分仍可播', async () => {
    await recordLiveRoom(createEvent(), 'douyin', DOUYIN_URL)

    expect(String(lastRecordOptions().outputPath)).toMatch(/\.flv$/)
  })

  it('文件名过清洗：主播昵称里的路径分隔符不会拼出一层子目录', async () => {
    await recordLiveRoom(createEvent(), 'douyin', DOUYIN_URL)

    const outputPath = String(lastRecordOptions().outputPath)
    expect(outputPath.startsWith('/tmp/kkk/video/抖音直播_主播 甲_26139686_')).toBe(true)
    // 清洗过后 tempDri 之下不能再多出斜杠，否则 ffmpeg 报的是一句 ENOENT
    expect(outputPath.slice('/tmp/kkk/video/'.length)).not.toContain('/')
  })

  it('配置的档位只改变尝试顺序，命中时用它', async () => {
    config.douyin.live = { quality: 'SD1' }

    await recordLiveRoom(createEvent(), 'douyin', DOUYIN_URL)

    expect(lastRecordOptions().url).toBe('https://pull.douyin.com/sd.flv')
  })

  it('`live` 整个缺失时按 FULL_HD1 起手（getDefOrConfig 是浅展开，不会逐键补默认值）', async () => {
    const event = createEvent()

    await recordLiveRoom(event, 'douyin', DOUYIN_URL)

    expect(lastRecordOptions().url).toBe('https://pull.douyin.com/full.flv')
    expect(event.reply.mock.calls[0]?.[0]).toContain('画质：蓝光')
  })

  it('直播间那一跳落在 fetchLiveRoomInfo 上，参数、Cookie、请求配置依次到位', async () => {
    doubles.resolveDouyinLiveRoom.mockImplementation(async (
      _id: unknown,
      fetch: DouyinLiveApiFetcher
    ) => {
      await fetch('fetchLiveRoomInfo', { room_id: '7300', web_rid: '26139686' })
      return livingRoom()
    })

    await recordLiveRoom(createEvent(), 'douyin', DOUYIN_URL)

    // amagi 收的是 `(options, cookie, requestConfig)`。cookie 排在第二位，
    // 和 options 换了位置不会崩、只会让请求变成未登录态，回来一份空数据。
    expect(doubles.fetchLiveRoomInfo).toHaveBeenCalledWith(
      { room_id: '7300', web_rid: '26139686' },
      'douyin-ck',
      requestConfig
    )
    // 分支写死方法名，串台了就是拿房间参数去打主页接口
    expect(doubles.fetchUserProfile).not.toHaveBeenCalled()
  })

  it('主页那一跳落在 fetchUserProfile 上，不会串到直播间接口', async () => {
    doubles.resolveDouyinLiveRoom.mockImplementation(async (
      _id: unknown,
      fetch: DouyinLiveApiFetcher
    ) => {
      await fetch('fetchUserProfile', { sec_uid: 'MS4wLjABAAAA' })
      return livingRoom()
    })

    await recordLiveRoom(createEvent(), 'douyin', DOUYIN_URL)

    expect(doubles.fetchUserProfile).toHaveBeenCalledWith(
      { sec_uid: 'MS4wLjABAAAA' },
      'douyin-ck',
      requestConfig
    )
    expect(doubles.fetchLiveRoomInfo).not.toHaveBeenCalled()
  })

  it('把链接里的两个号一起交给房间解析，缺哪个由那边补', async () => {
    doubles.getDouyinID.mockResolvedValue({
      type: 'live_room_detail', sec_uid: 'MS4wLjABAAAA', room_id: '26139686'
    })

    await recordLiveRoom(createEvent(), 'douyin', DOUYIN_URL)

    expect(doubles.resolveDouyinLiveRoom).toHaveBeenCalledWith(
      { sec_uid: 'MS4wLjABAAAA', room_id: '26139686' },
      expect.any(Function)
    )
  })

  it('不是直播间链接时说清楚，且不去打房间接口', async () => {
    doubles.getDouyinID.mockResolvedValue({ type: 'one_work', aweme_id: '123' })
    const event = createEvent()

    await expect(recordLiveRoom(event, 'douyin', DOUYIN_URL)).resolves.toBe(false)
    expect(lastReply(event)).toBe('这条抖音链接不是直播间，录直播只认直播间链接')
    expect(doubles.resolveDouyinLiveRoom).not.toHaveBeenCalled()
    expect(doubles.recordLiveStream).not.toHaveBeenCalled()
  })

  it('未开播时带上昵称告知，不开录', async () => {
    doubles.resolveDouyinLiveRoom.mockResolvedValue({ living: false, anchor: { nickname: '主播甲' } })
    const event = createEvent()

    await expect(recordLiveRoom(event, 'douyin', DOUYIN_URL)).resolves.toBe(false)
    expect(lastReply(event)).toBe('「主播甲」未开播，没有流可以录')
    expect(doubles.recordLiveStream).not.toHaveBeenCalled()
  })

  it('所有档位都是空串时判「没有可用地址」而不是拿空地址去录', async () => {
    doubles.resolveDouyinLiveRoom.mockResolvedValue(livingRoom({
      liveItem: { title: '空档位', stream_url: { flv_pull_url: { FULL_HD1: '' } } }
    }))
    const event = createEvent()

    await expect(recordLiveRoom(event, 'douyin', DOUYIN_URL)).resolves.toBe(false)
    expect(lastReply(event)).toBe('这个直播间没给出可用的 flv 拉流地址，录不了')
    expect(doubles.recordLiveStream).not.toHaveBeenCalled()
  })
})

describe('recordLiveRoom B站取流', () => {
  it('默认按原画 10000 请求，并把那份 headers 原样带进录制', async () => {
    await expect(recordLiveRoom(createEvent(), 'bilibili', BILIBILI_URL)).resolves.toBe(true)

    expect(doubles.fetchBilibiliLiveStream).toHaveBeenCalledWith('1017', 10000)
    // 这份 headers 是取流时实际用的那一份；少了 Referer 就是 403
    expect(lastRecordOptions().headers).toEqual({ Referer: 'https://live.bilibili.com/1017' })
  })

  it('配置了 qn 时用配置值', async () => {
    config.bilibili.live = { qn: 250 }

    await recordLiveRoom(createEvent(), 'bilibili', BILIBILI_URL)

    expect(doubles.fetchBilibiliLiveStream).toHaveBeenCalledWith('1017', 250)
  })

  it.each([
    ['flv', 'flv'],
    ['ts', 'ts'],
    ['fmp4', 'mp4'],
    ['', 'flv'],
    ['未来新格式', 'flv']
  ])('容器 %s 落盘成 .%s', async (format, suffix) => {
    doubles.fetchBilibiliLiveStream.mockResolvedValue({
      url: 'https://cn-live.bilivideo.com/live', qn: 10000, qualityName: '原画', format, headers: {}
    })

    await recordLiveRoom(createEvent(), 'bilibili', BILIBILI_URL)

    expect(String(lastRecordOptions().outputPath).endsWith(`.${suffix}`)).toBe(true)
  })

  it('不是直播间链接、或房间号没提取到，都算不认', async () => {
    doubles.getBilibiliID.mockResolvedValue({ type: 'live_room_detail', room_id: undefined })
    const event = createEvent()

    await expect(recordLiveRoom(event, 'bilibili', BILIBILI_URL)).resolves.toBe(false)
    expect(lastReply(event)).toBe('这条B站链接不是直播间，录直播只认直播间链接')
    expect(doubles.fetchBilibiliLiveStream).not.toHaveBeenCalled()
  })

  it('拿不到拉流地址时说清楚可能的原因', async () => {
    doubles.fetchBilibiliLiveStream.mockResolvedValue({
      url: '', qn: 0, qualityName: '', format: '', headers: {}
    })
    const event = createEvent()

    await expect(recordLiveRoom(event, 'bilibili', BILIBILI_URL)).resolves.toBe(false)
    expect(lastReply(event)).toBe('拿不到这个B站直播间的拉流地址，可能已关播或该画质不可用')
  })
})

describe('recordLiveRoom 录制时长', () => {
  it('单次上限严格小于协调器的整次解析预算，留出上传余量', () => {
    // 上限是从 DEFAULT_PARSE_TIMEOUT_MS 推导的。这条断言钉的是「推导关系还在」，
    // 而不是某个具体秒数 —— 改协调器预算时这里应当跟着动，不该要人手改字面量。
    expect(LIVE_RECORD_MAX_DURATION_MS).toBeLessThan(DEFAULT_PARSE_TIMEOUT_MS)
    expect(LIVE_RECORD_MAX_DURATION_MS).toBeGreaterThan(0)
  })

  it('配置值按秒换算成毫秒', async () => {
    config.douyin.live = { maxDuration: 45 }

    await recordLiveRoom(createEvent(), 'douyin', DOUYIN_URL)

    expect(lastRecordOptions().maxDurationMs).toBe(45_000)
  })

  it('缺配置时用 300 秒兜底', async () => {
    await recordLiveRoom(createEvent(), 'douyin', DOUYIN_URL)

    expect(lastRecordOptions().maxDurationMs).toBe(300_000)
  })

  it('B站读的是 bilibili 那份配置，不是抖音的', async () => {
    config.douyin.live = { maxDuration: 45 }
    config.bilibili.live = { maxDuration: 90 }

    await recordLiveRoom(createEvent(), 'bilibili', BILIBILI_URL)

    expect(lastRecordOptions().maxDurationMs).toBe(90_000)
  })

  it.each([[0], [-30], [Number.NaN]])('非正的 %s 也回落到兜底值，不会传出 -t 0', async (value) => {
    config.bilibili.live = { maxDuration: value }

    await recordLiveRoom(createEvent(), 'bilibili', BILIBILI_URL)

    expect(lastRecordOptions().maxDurationMs).toBe(300_000)
  })

  it('锅巴允许的 7200 秒被截到单次上限，并且告诉用户', async () => {
    config.douyin.live = { maxDuration: 7200 }
    const event = createEvent()

    await recordLiveRoom(event, 'douyin', DOUYIN_URL)

    expect(lastRecordOptions().maxDurationMs).toBe(LIVE_RECORD_MAX_DURATION_MS)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('已截断'))
    expect(event.reply.mock.calls[0]?.[0]).toContain('已截断')
  })

  it('没截断时提示语里不出现截断字样', async () => {
    config.douyin.live = { maxDuration: 60 }
    const event = createEvent()

    await recordLiveRoom(event, 'douyin', DOUYIN_URL)

    expect(event.reply.mock.calls[0]?.[0]).toContain('时长：60 秒')
    expect(event.reply.mock.calls[0]?.[0]).not.toContain('已截断')
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('开录前先回一句，说明要等到录完', async () => {
    const event = createEvent()

    await recordLiveRoom(event, 'douyin', DOUYIN_URL)

    const notice = String(event.reply.mock.calls[0]?.[0])
    expect(notice).toContain('「深夜杂谈」')
    expect(notice).toContain('录完才会上传')
    // 提示必须早于录制本身，否则用户在整段录制期间是一片静默
    expect(event.reply.mock.invocationCallOrder[0]!)
      .toBeLessThan(doubles.recordLiveStream.mock.invocationCallOrder[0]!)
  })
})

describe('recordLiveRoom 上传与闸门', () => {
  it('一个字节都没录到时报出可排查的原因，不去上传', async () => {
    doubles.recordLiveStream.mockResolvedValue({
      success: false, filePath: '/tmp/kkk/video/rec.flv', durationMs: 1200, bytes: 0
    })
    const event = createEvent()

    await expect(recordLiveRoom(event, 'douyin', DOUYIN_URL)).resolves.toBe(false)
    expect(lastReply(event)).toBe('录制失败，一个字节都没拉到。检查 FFmpeg 是否可用，或者主播是不是已经关播了')
    expect(doubles.uploadFile).not.toHaveBeenCalled()
  })

  it('超过视频上传拦截阈值时删文件并说明，不做一次注定失败的发送', async () => {
    config.upload = { usefilelimit: true, filelimit: 30 }
    const event = createEvent()

    await expect(recordLiveRoom(event, 'douyin', DOUYIN_URL)).resolves.toBe(false)
    expect(doubles.removeFile).toHaveBeenCalledWith('/tmp/kkk/video/rec.flv', true)
    expect(doubles.uploadFile).not.toHaveBeenCalled()
    const reply = lastReply(event)
    expect(reply).toContain('40.0MB')
    expect(reply).toContain('30MB')
  })

  it('闸门关着时体积再大也照发', async () => {
    config.upload = { usefilelimit: false, filelimit: 30 }

    await expect(recordLiveRoom(createEvent(), 'douyin', DOUYIN_URL)).resolves.toBe(true)
    expect(doubles.removeFile).not.toHaveBeenCalled()
    expect(doubles.uploadFile).toHaveBeenCalledTimes(1)
  })

  it('恰好等于阈值不算超，不删', async () => {
    config.upload = { usefilelimit: true, filelimit: 40 }

    await expect(recordLiveRoom(createEvent(), 'douyin', DOUYIN_URL)).resolves.toBe(true)
    expect(doubles.removeFile).not.toHaveBeenCalled()
  })

  it('上传参数：MB 体积、带后缀的文件名，不再替用户强制群文件通道', async () => {
    const event = createEvent()

    await recordLiveRoom(event, 'douyin', DOUYIN_URL)

    // 第四个参数整个去掉了：走不走群文件只听 upload.usegroupfile / groupfilevalue
    expect(doubles.uploadFile).toHaveBeenCalledWith(
      event,
      {
        filepath: '/tmp/kkk/video/rec.flv',
        // 这一层的 totalBytes 单位是 MB 而不是字节
        totalBytes: 40,
        originTitle: '抖音直播_主播 甲_26139686.flv'
      },
      ''
    )
  })

  it('落盘目录先兜一次 mkdir，缺目录时 ffmpeg 只会回一句 ENOENT', async () => {
    await recordLiveRoom(createEvent(), 'douyin', DOUYIN_URL)

    expect(doubles.mkdir).toHaveBeenCalledWith('/tmp/kkk/video/')
  })

  it('发失败时告诉用户文件已落盘，别让它静默', async () => {
    doubles.uploadFile.mockResolvedValue(false)
    const event = createEvent()

    await expect(recordLiveRoom(event, 'douyin', DOUYIN_URL)).resolves.toBe(false)
    expect(lastReply(event)).toContain('没能发出去')
  })
})

describe('recordLiveRoom 媒体度量', () => {
  it('发出去的录像计入媒体记录，时长取录制墙上时间', async () => {
    const records: unknown[] = []

    await runWithMediaMetrics('douyin', async () => {
      await recordLiveRoom(createEvent(), 'douyin', DOUYIN_URL)
    }, collected => { records.push(...collected) })

    expect(records).toEqual([{ kind: 'video', durationMs: 300_000, bytes: 41_943_040 }])
  })

  it('被体积闸拦掉的录像不计入 —— 文件压根没发出去', async () => {
    config.upload = { usefilelimit: true, filelimit: 30 }
    const records: unknown[] = []

    await runWithMediaMetrics('douyin', async () => {
      await recordLiveRoom(createEvent(), 'douyin', DOUYIN_URL)
    }, collected => { records.push(...collected) })

    expect(records).toEqual([])
  })
})
