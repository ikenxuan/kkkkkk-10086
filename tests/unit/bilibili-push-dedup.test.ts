/**
 * B站推送的「已推标记」语义。
 *
 * 这一组用例锁的是「什么时候才允许把动态记成已推」：写早了（发送失败也记）会让动态被
 * 永久吞掉，群里永远收不到；写晚了（成功也不记）会在下一轮重复推送。
 * 另外锁住 parseDynamicTypes —— 它在 config 和锅巴面板里都暴露着，但一度没人读。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getBilibiliDataMock = vi.hoisted(() => vi.fn())
const renderMock = vi.hoisted(() => vi.fn())
const addDynamicCacheMock = vi.hoisted(() => vi.fn())
const shouldFilterMock = vi.hoisted(() => vi.fn())
const processImageUrlMock = vi.hoisted(() => vi.fn())
const configMock = vi.hoisted(() => ({
  cookies: { bilibili: '' },
  bilibili: {
    push: {
      parsedynamic: false,
      parseDynamicTypes: ['DYNAMIC_TYPE_AV', 'DYNAMIC_TYPE_DRAW', 'DYNAMIC_TYPE_ARTICLE'] as string[] | undefined
    }
  },
  pushlist: { bilibili: [] },
  app: {},
  upload: {}
}))

vi.mock('../../src/module/utils/index.js', () => ({
  Base: class {
    e: unknown
    headers: Record<string, string> = {}
  },
  baseHeaders: {},
  Render: renderMock,
  Config: configMock,
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
  processImageUrl: processImageUrlMock,
  sanitizeFilenameSegment: (value: string) => value,
  Version: { BotName: 'TRSS-Yunzai', version: 'test', pluginName: 'kkkkkk-10086' }
}))

vi.mock('../../src/module/db/index.js', () => ({
  cleanOldDynamicCache: vi.fn(),
  bilibiliDB: {
    shouldFilter: shouldFilterMock,
    addDynamicCache: addDynamicCacheMock
  }
}))

vi.mock('../../src/module/platform/bilibili/bilibili.js', () => ({
  bilibiliProcessVideos: vi.fn(),
  cover: vi.fn(() => ''),
  generateDecorationCard: vi.fn(() => null),
  getBilibiliDash: vi.fn(() => ({})),
  getBilibiliPayload: vi.fn(() => ({})),
  getvideosize: vi.fn(),
  replacetext: vi.fn(() => 'text'),
  dedupeBilibiliVideoStreams: vi.fn()
}))

vi.mock('../../src/module/platform/bilibili/article.js', () => ({
  formatBilibiliArticleBody: vi.fn()
}))

vi.mock('../../src/module/platform/bilibili/api.js', () => ({
  getBilibiliData: getBilibiliDataMock
}))

vi.mock('../../src/module/platform/common/livePhoto.js', () => ({
  buildLivePhotoMessages: vi.fn(),
  // 批量入口的默认返回：results 为空 => 每张图都走普通图片回退分支。
  buildLivePhotoMessagesBatch: vi.fn(async () => ({ results: [], tempFiles: [], generatedLivePhoto: false })),
  buildLivePhotoTipMessage: vi.fn()
}))

vi.mock('../../src/runtime/host/common.js', () => ({
  default: { makeForwardMsg: vi.fn(() => 'forward') }
}))

globalThis.logger = {
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  mark: vi.fn(),
  blue: (value: string) => value,
  green: (value: string) => value,
  red: (value: string) => value,
  cyan: (value: string) => value,
  yellow: (value: string) => value,
  magenta: (value: string) => value
} as unknown as typeof logger

globalThis.segment = {
  image: (value: unknown) => ({ type: 'image', value }),
  text: (value: unknown) => ({ type: 'text', value }),
  reply: (value: unknown) => ({ type: 'reply', value })
} as unknown as typeof segment

const { Bilibilipush } = await import('../../src/module/platform/bilibili/push.js')

/** UP 主页数据：只保留纯文动态卡片会读到的字段 */
const userProfile = {
  data: {
    data: {
      card: { name: 'UP', mid: 123, attention: 5, vip: { status: 0 } },
      follower: 100,
      like_num: 200
    }
  }
}

/** 一条最小可渲染的纯文动态；DRAW 需要额外带图片列表 */
const dynamicItem = (overrides: Record<string, unknown> = {}) => ({
  remark: 'UP',
  host_mid: 123,
  create_time: Math.floor(Date.now() / 1000),
  targets: [{ groupId: '999', botId: 'bot-1' }],
  avatar_img: 'face',
  dynamic_type: 'DYNAMIC_TYPE_WORD',
  Dynamic_Data: {
    id_str: 'dyn-1',
    type: 'DYNAMIC_TYPE_WORD',
    modules: {
      module_author: {
        face: 'face',
        name: 'UP',
        pendant: { image: '' },
        pub_ts: Math.floor(Date.now() / 1000),
        pub_time: 'now'
      },
      module_dynamic: { desc: { text: '正文', rich_text_nodes: [] } },
      module_stat: { like: { count: 1 }, comment: { count: 2 }, forward: { count: 3 } }
    }
  },
  ...overrides
})

/** 把一条动态塞进 getdata 要的形状 */
const pushList = (item: ReturnType<typeof dynamicItem>) => ({ 'dyn-1': item }) as never

let sendMsgMock: ReturnType<typeof vi.fn>

/** 装一个正常在线的 bot */
const installBot = (): void => {
  globalThis.Bot = {
    'bot-1': { pickGroup: vi.fn(() => ({ sendMsg: sendMsgMock })) },
    makeForwardMsg: vi.fn(() => 'forward')
  } as unknown as typeof Bot
}

beforeEach(() => {
  // 顶层 beforeEach 只重置 config 的话，「有没有调过某个 mock」的断言会读到上一个用例的
  // 调用记录，所以这里显式清一次
  vi.clearAllMocks()
  configMock.bilibili.push.parsedynamic = false
  configMock.bilibili.push.parseDynamicTypes = ['DYNAMIC_TYPE_AV', 'DYNAMIC_TYPE_DRAW', 'DYNAMIC_TYPE_ARTICLE']
  shouldFilterMock.mockResolvedValue(false)
  renderMock.mockResolvedValue([{ type: 'image' }])
  getBilibiliDataMock.mockResolvedValue(userProfile)
  processImageUrlMock.mockResolvedValue('https://example.com/img.jpg')
  sendMsgMock = vi.fn().mockResolvedValue({ message_id: 'msg-1' })
})

/** 造一个 amagi 被打桩过的推送实例 */
const newPush = (): InstanceType<typeof Bilibilipush> => {
  const subject = new Bilibilipush()
  ;(subject as unknown as { amagi: { getBilibiliData: typeof getBilibiliDataMock } }).amagi = {
    getBilibiliData: getBilibiliDataMock
  }
  return subject
}

describe('B站推送的已推标记时机', () => {
  it('卡片发送成功后才写入已推缓存', async () => {
    installBot()

    expect(await newPush().getdata(pushList(dynamicItem()))).toBe(true)

    expect(sendMsgMock).toHaveBeenCalledTimes(1)
    expect(addDynamicCacheMock).toHaveBeenCalledExactlyOnceWith('dyn-1', 123, '999', 'DYNAMIC_TYPE_WORD')
  })

  it('发送抛错时不写已推缓存，留给下一轮重试', async () => {
    sendMsgMock = vi.fn().mockRejectedValue(new Error('风控：消息发送失败'))
    installBot()

    expect(await newPush().getdata(pushList(dynamicItem()))).toBe(true)

    expect(sendMsgMock).toHaveBeenCalledTimes(1)
    expect(addDynamicCacheMock).not.toHaveBeenCalled()
  })

  it('渲染失败时既不发送也不写已推缓存', async () => {
    // Render 返回 false 是本仓库约定的「这次渲染失败」
    renderMock.mockResolvedValue(false)
    installBot()

    expect(await newPush().getdata(pushList(dynamicItem()))).toBe(true)

    expect(sendMsgMock).not.toHaveBeenCalled()
    expect(addDynamicCacheMock).not.toHaveBeenCalled()
  })

  it('bot 或群不存在时照旧写已推缓存，避免 bot 上线后补推一堆历史动态', async () => {
    globalThis.Bot = {} as unknown as typeof Bot

    expect(await newPush().getdata(pushList(dynamicItem()))).toBe(true)

    expect(addDynamicCacheMock).toHaveBeenCalledExactlyOnceWith('dyn-1', 123, '999', 'DYNAMIC_TYPE_WORD')
  })

  it('被过滤规则跳过的动态直接记成已推，不再反复评估', async () => {
    shouldFilterMock.mockResolvedValue(true)
    installBot()

    expect(await newPush().getdata(pushList(dynamicItem()))).toBe(true)

    expect(sendMsgMock).not.toHaveBeenCalled()
    expect(addDynamicCacheMock).toHaveBeenCalledExactlyOnceWith('dyn-1', 123, '999', 'DYNAMIC_TYPE_WORD')
  })
})

describe('B站推送二次解析的类型开关', () => {
  /** 一条带图的图文动态，二次解析会去下载图片 */
  const drawItem = () => dynamicItem({
    dynamic_type: 'DYNAMIC_TYPE_DRAW',
    Dynamic_Data: {
      id_str: 'dyn-1',
      type: 'DYNAMIC_TYPE_DRAW',
      modules: {
        module_author: {
          face: 'face',
          name: 'UP',
          pendant: { image: '' },
          pub_ts: Math.floor(Date.now() / 1000),
          pub_time: 'now'
        },
        module_dynamic: {
          topic: null,
          desc: { text: '正文', rich_text_nodes: [] },
          major: { type: 'MAJOR_TYPE_DRAW', draw: { items: [{ src: 'https://example.com/a.jpg' }] } }
        },
        module_stat: { like: { count: 1 }, comment: { count: 2 }, forward: { count: 3 } }
      }
    }
  })

  it('类型在 parseDynamicTypes 里时执行二次解析', async () => {
    configMock.bilibili.push.parsedynamic = true
    configMock.bilibili.push.parseDynamicTypes = ['DYNAMIC_TYPE_DRAW']
    installBot()

    await newPush().getdata(pushList(drawItem()))

    expect(processImageUrlMock).toHaveBeenCalled()
    // 卡片 + 图片合并转发
    expect(sendMsgMock).toHaveBeenCalledTimes(2)
  })

  it('类型不在 parseDynamicTypes 里时只发卡片', async () => {
    configMock.bilibili.push.parsedynamic = true
    configMock.bilibili.push.parseDynamicTypes = ['DYNAMIC_TYPE_AV']
    installBot()

    await newPush().getdata(pushList(drawItem()))

    expect(processImageUrlMock).not.toHaveBeenCalled()
    expect(sendMsgMock).toHaveBeenCalledTimes(1)
  })

  it('配置读不到 parseDynamicTypes 时按全部允许处理', async () => {
    // Config 对 default_config 与用户配置只做浅合并，用户写了 push: 就可能整段读不到
    configMock.bilibili.push.parsedynamic = true
    configMock.bilibili.push.parseDynamicTypes = undefined
    installBot()

    await newPush().getdata(pushList(drawItem()))

    expect(processImageUrlMock).toHaveBeenCalled()
  })

  it('总开关关闭时无论类型如何都不二次解析', async () => {
    configMock.bilibili.push.parsedynamic = false
    configMock.bilibili.push.parseDynamicTypes = ['DYNAMIC_TYPE_DRAW']
    installBot()

    await newPush().getdata(pushList(drawItem()))

    expect(processImageUrlMock).not.toHaveBeenCalled()
    expect(sendMsgMock).toHaveBeenCalledTimes(1)
  })
})
