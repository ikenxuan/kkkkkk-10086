import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 裸 fetcher 是「一个对象、每个方法一个键」，而这些用例要断言的是跨方法的调用次序，
 * 所以把每个方法都汇进同一个 spy，方法名当第一个实参传进去 —— 旧的
 * `getBilibiliData(method, options)` 形态原样保留，只是方法名从中文换成英文。
 * cookie 与 requestConfig 不往下传：它们不是这些用例的被测面。
 */
const getBilibiliDataMock = vi.hoisted(() => vi.fn())
const bilibiliFetcherStub = vi.hoisted(() => new Proxy({}, {
  get: (_target, method: string) =>
    async (options: unknown) => await getBilibiliDataMock(method, options)
}))

vi.mock('../../src/module/utils/index.js', () => ({
  Base: class {
    e: unknown
    headers: Record<string, string> = {}
  },
  baseHeaders: {},
  Render: vi.fn(),
  Config: {
    cookies: { bilibili: '' },
    bilibili: { push: { parsedynamic: false } },
    pushlist: { bilibili: [] },
    app: {},
    upload: {}
  },
  Common: {
    tempDri: { images: '', video: '' },
    useDarkTheme: () => false,
    count: (value: unknown) => String(value ?? 0),
    convertTimestampToDateTime: (value: number) => String(value),
    getCurrentTime: () => 'now',
    removeFile: vi.fn()
  },
  Networks: class {},
  downloadFile: vi.fn(),
  mergeFile: vi.fn(),
  uploadFile: vi.fn(),
  processImageUrl: vi.fn(),
  Version: { BotName: 'TRSS-Yunzai', version: 'test', pluginName: 'kkkkkk-10086' }
}))

vi.mock('../../src/module/db/index.js', () => ({
  cleanOldDynamicCache: vi.fn(),
  bilibiliDB: { shouldFilter: vi.fn() }
}))

vi.mock('../../src/module/platform/bilibili/bilibili.js', () => ({
  bilibiliProcessVideos: vi.fn(),
  cover: vi.fn(() => []),
  generateDecorationCard: vi.fn(),
  getBilibiliDash: vi.fn(),
  getBilibiliPayload: vi.fn(),
  getvideosize: vi.fn(),
  replacetext: vi.fn(),
  dedupeBilibiliVideoStreams: vi.fn()
}))

vi.mock('../../src/module/platform/bilibili/article.js', () => ({
  formatBilibiliArticleBody: vi.fn()
}))

vi.mock('../../src/module/utils/amagiClient.js', () => ({
  bilibiliFetcher: bilibiliFetcherStub,
  buildAmagiRequestConfig: vi.fn(() => ({}))
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
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  mark: vi.fn(),
  green: (value: string) => value,
  red: (value: string) => value,
  yellow: (value: string) => value
} as unknown as typeof logger

const { Bilibilipush } = await import('../../src/module/platform/bilibili/push.js')

const envelope = <T>(data: T) => ({ data: { data } })

const liveSubscription = () => ({
  switch: true,
  host_mid: 123,
  remark: 'UP',
  group_id: ['999:bot-1'],
  pushTypes: ['live']
})

const dynamicLiveItem = {
  id_str: 'unstable-dynamic-id',
  type: 'DYNAMIC_TYPE_LIVE_RCMD',
  modules: {
    module_author: {
      face: 'face',
      name: 'UP',
      pendant: { image: '' },
      pub_ts: Math.floor(Date.now() / 1000)
    },
    module_dynamic: {
      major: {
        type: 'MAJOR_TYPE_LIVE_RCMD',
        live_rcmd: {
          content: JSON.stringify({
            live_play_info: { room_id: 456, cover: 'cover', title: '直播', area_name: '游戏' }
          })
        }
      }
    }
  }
}

beforeEach(() => {
  getBilibiliDataMock.mockReset()
})

describe('Bilibili live push identity', () => {
  it('uses a stable live session key when direct status and room details are available', async () => {
    getBilibiliDataMock.mockImplementation(async (method: string) => {
      if (method === 'fetchUserLiveStatus') {
        return envelope({ roomStatus: 1, liveStatus: 1, roomid: 456, cover: 'status-cover', title: '状态标题' })
      }
      if (method === 'fetchLiveRoomInfo') {
        return envelope({
          live_status: 1,
          live_time: '2026-08-18 12:34:56',
          room_id: 456,
          area_name: '游戏',
          user_cover: 'room-cover',
          title: '房间标题'
        })
      }
      throw new Error(`unexpected method: ${method}`)
    })

    const result = await newPush().getDynamicList([liveSubscription()] as never)

    expect(result.willbepushlist).toHaveProperty('bilibili-live:123:456:2026-08-18 12:34:56')
    expect(result.willbepushlist['bilibili-live:123:456:2026-08-18 12:34:56']).toMatchObject({
      host_mid: 123,
      dynamic_type: 'DYNAMIC_TYPE_LIVE_RCMD',
      targets: [{ groupId: '999', botId: 'bot-1' }]
    })
    expect(getBilibiliDataMock).toHaveBeenNthCalledWith(1, 'fetchUserLiveStatus', { host_mid: 123, typeMode: 'strict' })
    expect(getBilibiliDataMock).toHaveBeenNthCalledWith(2, 'fetchLiveRoomInfo', { room_id: '456', typeMode: 'strict' })
    expect(getBilibiliDataMock).not.toHaveBeenCalledWith('fetchUserDynamicList', expect.anything())
  })

  it('uses the same stable key when a live dynamic falls back from direct status lookup', async () => {
    getBilibiliDataMock.mockImplementation(async (method: string) => {
      if (method === 'fetchUserLiveStatus') throw new Error('temporary status failure')
      if (method === 'fetchUserDynamicList') return envelope({ items: [dynamicLiveItem] })
      if (method === 'fetchLiveRoomInfo') {
        return envelope({ live_status: 1, live_time: '2026-08-18 12:34:56', room_id: 456 })
      }
      throw new Error(`unexpected method: ${method}`)
    })

    const result = await newPush().getDynamicList([liveSubscription()] as never)

    expect(Object.keys(result.willbepushlist)).toEqual(['bilibili-live:123:456:2026-08-18 12:34:56'])
  })

  it('does not query dynamic fallback for an offline live-only subscription', async () => {
    getBilibiliDataMock.mockResolvedValueOnce(envelope({ roomStatus: 1, liveStatus: 0, roomid: 456 }))

    const result = await newPush().getDynamicList([liveSubscription()] as never)

    expect(result.willbepushlist).toEqual({})
    expect(getBilibiliDataMock).toHaveBeenCalledTimes(1)
  })
})

function newPush (): InstanceType<typeof Bilibilipush> {
  const subject = new Bilibilipush()
  // 上面那个 Base 替身不建 amagi，所以这里补上被测代码真正读的 `amagi.bilibili`
  ;(subject as unknown as { amagi: { bilibili: unknown } }).amagi = {
    bilibili: bilibiliFetcherStub
  }
  return subject
}
