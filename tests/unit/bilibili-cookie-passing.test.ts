/**
 * B站 每个取数调用点**实际传出去的 cookie 实参**。
 *
 * 钉的是一处与上游的已知语义分叉，不是在主张空 cookie 是对的。本仓的
 * `bilibiliFetcher` 是 `@ikenxuan/amagi` 的模块级裸导出，cookie 只能由调用点显式传；
 * 上游那份取自 `Client({ cookies })` 建出来的实例，cookie 在实例上。于是上游
 * 「少传两个参数」的写法照样带着 cookie，而本仓抄成 `''` 的三处是真的不带。
 * 这三处从最初的云崽移植就在，谁都不敢动，因为没有任何测试说得清「带不带 ck」的现状。
 *
 * 所以这个文件只做一件事：把现状写死。任何一处调用点的 cookie 实参被改动，
 * 这里立刻变红，让它变成一次显式决定。真要改的时候，连同
 * `docs/upstream-sync.md` 的「待查：推送路径的空 cookie」一节一起更新。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const configMock = vi.hoisted(() => ({
  // 必须非空：空串会让「传了配置 cookie」和「传了 ''」两组断言同时为真，测试恒真
  cookies: { bilibili: 'SESSDATA=fixture-cookie' },
  app: { parseTip: false },
  bilibili: {
    sendContent: ['comment'] as string[],
    bilibiliTip: ['动态'] as string[],
    displayContent: [] as string[],
    videoInfoMode: 'text',
    showDanmakuInVideoInfo: false,
    burnDanmaku: false,
    videopriority: true,
    numcomment: 5,
    bilibilinumcomments: 5,
    realCommentCount: false,
    videoQuality: 80,
    maxAutoVideoSize: 100,
    push: { parsedynamic: false, parseDynamicTypes: [] as string[] }
  },
  pushlist: { bilibili: [] },
  upload: {},
  getConfig: (key: string) => (key === 'bilibili' ? { sendContent: ['comment'] } : {})
}))

const BILIBILI_COOKIE = configMock.cookies.bilibili

/**
 * 每个调用点一个具名替身。
 *
 * 不用 `new Proxy({}, { get: () => vi.fn() })` 承载断言：那样每次属性访问都返回一个
 * **新的** `vi.fn()`，被测代码调到的那一份和断言拿到的那一份不是同一个对象，
 * 调用断言永远不可能通过。
 */
const handles = vi.hoisted(() => ({
  /** `push.ts` 从 amagiClient 直接 import 的模块级裸 fetcher，和 `this.amagi.bilibili` 不是一个东西 */
  moduleFetchVideoInfo: vi.fn(),
  fetchUserCard: vi.fn(),
  fetchEmojiList: vi.fn(),
  fetchVideoInfo: vi.fn(),
  fetchVideoStreamUrl: vi.fn(),
  fetchComments: vi.fn(),
  fetchDynamicDetail: vi.fn(),
  render: vi.fn(),
  bilibiliComments: vi.fn(),
  checkCk: vi.fn(),
  shouldFilter: vi.fn(),
  addDynamicCache: vi.fn(),
  processImageUrl: vi.fn()
}))

/** `buildAmagiRequestConfig()` 的替身返回值，只用来认第三个实参真的到位 */
const requestConfig = vi.hoisted(() => ({ timeout: 15_000 }))

vi.mock('../../src/module/utils/index.js', async () => {
  const { sanitizeFilename, sanitizeFilenameSegment } =
    await import('../../src/module/utils/filename.js')

  return {
    Base: class {
      e: unknown
      headers: Record<string, string> = {}
    },
    baseHeaders: {},
    Render: handles.render,
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
    downloadVideo: vi.fn(),
    mergeFile: vi.fn(),
    uploadFile: vi.fn(),
    processImageUrl: handles.processImageUrl,
    sanitizeFilename,
    sanitizeFilenameSegment,
    Version: { BotName: 'TRSS-Yunzai', version: 'test', pluginName: 'kkkkkk-10086' }
  }
})

// 真 amagi 绝不能被加载：vitest 下 `require('@ikenxuan/amagi')` 会走 exports map 的
// development 条件，解析到未发布的 src/index.ts，一加载就是 MODULE_NOT_FOUND。
vi.mock('../../src/module/utils/amagiClient.js', () => ({
  bilibiliFetcher: { fetchVideoInfo: handles.moduleFetchVideoInfo },
  buildAmagiRequestConfig: vi.fn(() => requestConfig)
}))

vi.mock('../../src/module/db/index.js', () => ({
  cleanOldDynamicCache: vi.fn(),
  bilibiliDB: {
    shouldFilter: handles.shouldFilter,
    addDynamicCache: handles.addDynamicCache
  }
}))

vi.mock('../../src/module/platform/bilibili/index.js', () => ({
  bilibiliComments: handles.bilibiliComments,
  checkCk: handles.checkCk,
  genParams: vi.fn()
}))

vi.mock('../../src/module/platform/common/livePhoto.js', () => ({
  buildLivePhotoMessages: vi.fn(),
  buildLivePhotoMessagesBatch: vi.fn(async () => ({ results: [], tempFiles: [], generatedLivePhoto: false })),
  buildLivePhotoTipMessage: vi.fn()
}))

// 挡住 FFmpeg → runtime/host/config 那条链：宿主的 lib/config/config.js 在测试里不存在
vi.mock('../../src/module/platform/common/danmaku.js', () => ({
  burnDanmaku: vi.fn()
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
  cyan: (value: string) => value,
  green: (value: string) => value,
  magenta: (value: string) => value,
  red: (value: string) => value,
  yellow: (value: string) => value
} as unknown as typeof logger

globalThis.segment = {
  image: (value: unknown) => ({ type: 'image', value }),
  text: (value: unknown) => ({ type: 'text', value }),
  reply: (value: unknown) => ({ type: 'reply', value })
} as unknown as typeof segment

const { Bilibili } = await import('../../src/module/platform/bilibili/bilibili.js')
const { Bilibilipush } = await import('../../src/module/platform/bilibili/push.js')

/** `this.amagi.bilibili` 的替身：只列被测路径会调到的方法，多调一个当场炸出来 */
const amagiBilibili = new Proxy({
  fetchUserCard: handles.fetchUserCard,
  fetchEmojiList: handles.fetchEmojiList,
  fetchVideoInfo: handles.fetchVideoInfo,
  fetchVideoStreamUrl: handles.fetchVideoStreamUrl,
  fetchComments: handles.fetchComments,
  fetchDynamicDetail: handles.fetchDynamicDetail
}, {
  get: (target, prop) => {
    if (prop in target) return Reflect.get(target, prop)
    throw new Error(`Unexpected Bilibili fetcher method: ${String(prop)}`)
  }
})

const userProfile = {
  data: {
    data: {
      card: { name: 'UP', mid: 789, attention: 5, face: 'face', pendant: { image: '' }, fans: 1, vip: { status: 0 } },
      follower: 100,
      like_num: 200
    }
  }
}

const videoInfo = {
  data: {
    data: {
      aid: 123,
      bvid: 'BV1test',
      cid: 456,
      ctime: 1_700_000_000,
      duration: 120,
      pages: [{ cid: 456, duration: 120 }],
      owner: { mid: 789, name: 'UP', face: 'face' },
      pic: 'https://example.com/cover.jpg',
      title: '标题',
      desc: '简介',
      desc_v2: [],
      stat: { coin: 1, like: 2, share: 3, view: 4, favorite: 5, danmaku: 6, reply: 7 }
    }
  }
}

const playUrl = {
  data: {
    accept_description: ['高清 1080P'],
    durl: [{ id: 80, url: 'https://example.com/video.mp4', size: 1024 * 1024 }]
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  handles.render.mockResolvedValue([{ type: 'image' }])
  handles.processImageUrl.mockResolvedValue('https://example.com/img.jpg')
  handles.shouldFilter.mockResolvedValue(false)
  handles.checkCk.mockResolvedValue({ Status: 'notLogin', isVIP: false })
  handles.bilibiliComments.mockReturnValue([{ rpid: 1 }])
  handles.fetchUserCard.mockResolvedValue(userProfile)
  handles.fetchEmojiList.mockResolvedValue({ data: { data: { packages: [] } } })
  handles.fetchVideoInfo.mockResolvedValue(videoInfo)
  handles.moduleFetchVideoInfo.mockResolvedValue(videoInfo)
  handles.fetchVideoStreamUrl.mockResolvedValue(playUrl)
  handles.fetchComments.mockResolvedValue({ data: { replies: [{ rpid: 1 }] } })
})

/** 一条视频动态推送项，够 `getdata` 走完 DYNAMIC_TYPE_AV 分支 */
const videoDynamicPushList = () => ({
  'dyn-1': {
    remark: 'UP',
    host_mid: 789,
    create_time: Math.floor(Date.now() / 1000),
    targets: [{ groupId: '999', botId: 'bot-1' }],
    avatar_img: 'face',
    dynamic_type: 'DYNAMIC_TYPE_AV',
    Dynamic_Data: {
      id_str: 'dyn-1',
      type: 'DYNAMIC_TYPE_AV',
      modules: {
        module_author: {
          face: 'face',
          name: 'UP',
          pendant: { image: '' },
          pub_ts: Math.floor(Date.now() / 1000),
          pub_time: 'now'
        },
        module_dynamic: {
          desc: { text: '正文', rich_text_nodes: [] },
          topic: null,
          major: {
            type: 'MAJOR_TYPE_ARCHIVE',
            archive: { bvid: 'BV1test', duration_text: '1:00' }
          }
        },
        module_stat: { like: { count: 1 }, comment: { count: 2 }, forward: { count: 3 } }
      }
    }
  }
}) as never

/** 一个 amagi 已被打桩的推送实例 */
const newPush = () => {
  const subject = new Bilibilipush()
  ;(subject as unknown as { amagi: { bilibili: unknown } }).amagi = { bilibili: amagiBilibili }
  return subject
}

/** 一个 amagi 已被打桩的解析实例；不走构造函数，避开 Base 那条依赖链 */
const newParser = (type: string): InstanceType<typeof Bilibili> => {
  const subject = Object.create(Bilibili.prototype) as InstanceType<typeof Bilibili>
  Object.assign(subject, {
    Type: type,
    e: { reply: vi.fn() },
    amagi: { bilibili: amagiBilibili },
    forceBurnDanmaku: false,
    islogin: false,
    downloadfilename: '',
    headers: {},
    mkMsg: (content: unknown) => content
  })
  return subject
}

describe('推送路径的 cookie 实参（Bilibilipush.getdata）', () => {
  beforeEach(() => {
    globalThis.Bot = {
      'bot-1': { pickGroup: vi.fn(() => ({ sendMsg: vi.fn(async () => ({ message_id: 'msg-1' })) })) },
      makeForwardMsg: vi.fn(() => 'forward')
    } as unknown as typeof Bot
  })

  it('fetchVideoInfo 不带 cookie（与上游分叉的那一处）', async () => {
    await newPush().getdata(videoDynamicPushList())

    expect(handles.moduleFetchVideoInfo).toHaveBeenCalledWith(
      expect.anything(),
      '',
      expect.anything()
    )
  })

  it('fetchUserCard 带配置里的 cookie', async () => {
    await newPush().getdata(videoDynamicPushList())

    expect(handles.fetchUserCard).toHaveBeenCalledWith(
      expect.anything(),
      BILIBILI_COOKIE,
      expect.anything()
    )
  })

  it('fetchEmojiList 带配置里的 cookie', async () => {
    await newPush().getdata(videoDynamicPushList())

    expect(handles.fetchEmojiList).toHaveBeenCalledWith(
      expect.anything(),
      BILIBILI_COOKIE,
      expect.anything()
    )
  })

  it('同一条动态里两类调用点的 cookie 实参确实不同', async () => {
    await newPush().getdata(videoDynamicPushList())

    expect(handles.moduleFetchVideoInfo.mock.calls[0]?.[1]).toBe('')
    expect(handles.fetchUserCard.mock.calls[0]?.[1]).toBe(BILIBILI_COOKIE)
  })
})

describe('视频解析路径的 cookie 实参（Bilibili.RESOURCES one_video）', () => {
  const parse = async (): Promise<void> => {
    await newParser('one_video').RESOURCES({ type: 'one_video', bvid: 'BV1test', p: 1 } as never)
  }

  it('fetchComments 不带 cookie（与上游分叉的那一处）', async () => {
    await parse()

    expect(handles.fetchComments).toHaveBeenCalledWith(
      expect.anything(),
      '',
      expect.anything()
    )
  })

  it('fetchVideoInfo 带配置里的 cookie', async () => {
    await parse()

    expect(handles.fetchVideoInfo).toHaveBeenCalledWith(
      expect.anything(),
      BILIBILI_COOKIE,
      expect.anything()
    )
  })

  it('fetchVideoStreamUrl 带配置里的 cookie', async () => {
    await parse()

    expect(handles.fetchVideoStreamUrl).toHaveBeenCalledWith(
      expect.anything(),
      BILIBILI_COOKIE,
      expect.anything()
    )
  })
})

describe('动态解析路径的 cookie 实参（Bilibili.RESOURCES dynamic_info）', () => {
  const dynamicDetail = {
    data: {
      data: {
        item: {
          id_str: 'dyn-1',
          // 落进 switch 的 default 分支：这组用例只关心 default 之前那三次取数
          type: 'DYNAMIC_TYPE_UNSUPPORTED',
          basic: { comment_id_str: '123', rid_str: '123' },
          modules: { module_author: { mid: 789 } }
        }
      }
    }
  }

  const parse = async (): Promise<void> => {
    handles.fetchDynamicDetail.mockResolvedValue(dynamicDetail)
    await newParser('dynamic_info').RESOURCES({ type: 'dynamic_info', dynamic_id: 'dyn-1' } as never)
  }

  it('fetchComments 不带 cookie（与上游分叉的那一处）', async () => {
    await parse()

    expect(handles.fetchComments).toHaveBeenCalledWith(
      expect.anything(),
      '',
      expect.anything()
    )
  })

  it('fetchDynamicDetail 带配置里的 cookie', async () => {
    await parse()

    expect(handles.fetchDynamicDetail).toHaveBeenCalledWith(
      expect.anything(),
      BILIBILI_COOKIE,
      expect.anything()
    )
  })

  it('fetchUserCard 带配置里的 cookie', async () => {
    await parse()

    expect(handles.fetchUserCard).toHaveBeenCalledWith(
      expect.anything(),
      BILIBILI_COOKIE,
      expect.anything()
    )
  })
})
