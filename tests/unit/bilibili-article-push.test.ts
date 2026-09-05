import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { loadRealAmagiEnums } from '../helpers/amagi-enums.js'
import type { AmagiProxyClient } from '../../src/module/utils/types.js'

/**
 * 方法名取自生产代码用的同一份 fetcher 声明。下面的假 handle 与期望数组都靠 `satisfies` 钉在它上面，
 * 上游改名或塞回中文旧名会在 typecheck 报错 —— 而不是留下一个谁也不会调用的替身让断言假绿。
 */
type BilibiliApiMethod = keyof AmagiProxyClient['bilibili']

const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  processImageUrl: vi.fn(),
  makeForwardMsg: vi.fn(),
  addDynamicCache: vi.fn(),
  formatBilibiliArticleBody: vi.fn(),
  /** 按 getdata 的调用顺序声明，下面用它的键序当「实际调用了哪些方法」的期望 */
  bilibiliApi: {
    fetchUserCard: vi.fn(),
    fetchEmojiList: vi.fn(),
    fetchArticleInfo: vi.fn(),
    fetchArticleContent: vi.fn()
  } satisfies Partial<Record<BilibiliApiMethod, Mock>>
}))

vi.mock('../../src/module/utils/index.js', () => ({
  Base: class {},
  baseHeaders: {},
  Common: {
    tempDri: { images: '', video: '' },
    useDarkTheme: () => false,
    count: (value: unknown) => String(value ?? 0),
    convertTimestampToDateTime: () => '2026-08-18 08:00:00',
    getCurrentTime: () => '2026-08-18 08:01:00',
    removeFile: vi.fn()
  },
  Config: {
    cookies: { bilibili: 'SESSDATA=test' },
    bilibili: { push: { parsedynamic: false } },
    pushlist: { bilibili: [] },
    app: {},
    upload: {}
  },
  downloadFile: vi.fn(),
  mergeFile: vi.fn(),
  Render: mocks.render,
  uploadFile: vi.fn(),
  Version: { BotName: 'TRSS-Yunzai', version: 'test', pluginName: 'kkkkkk-10086' },
  processImageUrl: mocks.processImageUrl
}))

vi.mock('../../src/module/db/index.js', () => ({
  cleanOldDynamicCache: vi.fn(),
  bilibiliDB: {
    shouldFilter: vi.fn(async () => false),
    addDynamicCache: mocks.addDynamicCache
  }
}))

vi.mock('../../src/module/platform/bilibili/bilibili.js', () => ({
  bilibiliProcessVideos: vi.fn(),
  cover: vi.fn(() => []),
  generateDecorationCard: vi.fn(),
  getBilibiliDash: vi.fn(),
  getBilibiliPayload: vi.fn(),
  getvideosize: vi.fn(),
  replacetext: vi.fn()
}))

vi.mock('../../src/module/platform/bilibili/article.js', () => ({
  formatBilibiliArticleBody: mocks.formatBilibiliArticleBody
}))

// 取数一律走注入的 this.amagi.bilibili；模块级 fetcher 被碰到就是接线错了，所以让它直接抛
vi.mock('../../src/module/utils/amagiClient.js', () => ({
  loadAmagiEnums: loadRealAmagiEnums,
  bilibiliFetcher: new Proxy({}, {
    get: (_target, prop) => {
      throw new Error(`不该读模块级 bilibiliFetcher.${String(prop)}，取数应走 this.amagi.bilibili`)
    }
  }),
  buildAmagiRequestConfig: vi.fn(() => ({}))
}))

vi.mock('../../src/module/platform/common/livePhoto.js', () => ({
  buildLivePhotoMessages: vi.fn(),
  // 批量入口的默认返回：results 为空 => 每张图都走普通图片回退分支。
  buildLivePhotoMessagesBatch: vi.fn(async () => ({ results: [], tempFiles: [], generatedLivePhoto: false })),
  buildLivePhotoTipMessage: vi.fn()
}))

vi.mock('../../src/runtime/host/common.js', () => ({
  default: { makeForwardMsg: mocks.makeForwardMsg }
}))

import { Bilibilipush } from '../../src/module/platform/bilibili/push.js'

const userProfile = {
  data: {
    data: {
      card: {
        name: '测试UP',
        face: 'https://i.example.com/avatar.jpg',
        mid: 10086,
        attention: 12,
        vip: { status: 1, nickname_color: '#FB7299' }
      },
      follower: 34,
      like_num: 56
    }
  }
}

const articleInfo = {
  data: {
    data: {
      title: '专栏标题',
      summary: '专栏摘要',
      banner_url: 'https://i.example.com/banner.jpg',
      categories: ['开发'],
      words: 321,
      stats: {
        view: 101,
        like: 102,
        favorite: 103,
        reply: 104,
        share: 105,
        dynamic: 106,
        coin: 107
      }
    }
  }
}

const articleContent = {
  data: {
    data: {
      id: 42,
      content: '<p>第一段</p><img src="https://i.example.com/body.jpg" alt="正文插图"><p>第二段</p>'
    }
  }
}

const articlePushList = {
  'dynamic-999': {
    remark: '测试UP',
    host_mid: 10086,
    create_time: 1_723_900_000,
    targets: [
      { groupId: 'group-1', botId: 'bot-1' },
      { groupId: 'group-2', botId: 'bot-1' }
    ],
    avatar_img: 'https://i.example.com/avatar.jpg',
    dynamic_type: 'DYNAMIC_TYPE_ARTICLE',
    Dynamic_Data: {
      id_str: 'dynamic-999',
      type: 'DYNAMIC_TYPE_ARTICLE',
      basic: { rid_str: '42' },
      modules: {
        module_author: {
          mid: 10086,
          name: '测试UP',
          face: 'https://i.example.com/avatar.jpg',
          pendant: { image: 'https://i.example.com/frame.png' },
          pub_time: '刚刚',
          pub_ts: 1_723_900_000
        },
        module_dynamic: {
          major: {
            type: 'MAJOR_TYPE_ARTICLE',
            article: { id: 42, title: '动态中的标题' }
          }
        },
        module_stat: {
          like: { count: 8 },
          comment: { count: 7 },
          forward: { count: 6 }
        }
      }
    }
  }
}

describe('Bilibili article push integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('logger', {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      mark: vi.fn(),
      blue: (value: unknown) => String(value),
      cyan: (value: unknown) => String(value),
      green: (value: unknown) => String(value),
      yellow: (value: unknown) => String(value)
    })
    vi.stubGlobal('segment', {
      text: vi.fn((text: string) => ({ type: 'text', text })),
      image: vi.fn((url: string) => ({ type: 'image', url }))
    })

    const sendMsg = vi.fn(async (message: unknown) => ({ message_id: String(message) }))
    const bot = {
      pickGroup: vi.fn(() => ({ sendMsg }))
    }
    vi.stubGlobal('Bot', {
      'bot-1': bot,
      makeForwardMsg: vi.fn()
    })

    mocks.processImageUrl.mockImplementation(async (url: string) => `processed:${url}`)
    mocks.makeForwardMsg.mockImplementation(async (_bot: unknown, messages: unknown[], title: string) => ({
      type: 'forward',
      messages,
      title
    }))
    mocks.render.mockResolvedValue({ type: 'poster' })
    mocks.bilibiliApi.fetchUserCard.mockResolvedValue(userProfile)
    mocks.bilibiliApi.fetchEmojiList.mockResolvedValue({ data: { data: { packages: [] } } })
    mocks.bilibiliApi.fetchArticleInfo.mockResolvedValue(articleInfo)
    mocks.bilibiliApi.fetchArticleContent.mockResolvedValue(articleContent)
  })

  it('builds article content once, sends a forward before each poster, and uses the React contract', async () => {
    const subject = Object.create(Bilibilipush.prototype) as Bilibilipush
    Object.assign(subject, {
      amagi: { bilibili: mocks.bilibiliApi },
      headers: {}
    })

    await subject.getdata(articlePushList as never)

    expect(mocks.bilibiliApi.fetchArticleInfo).toHaveBeenCalledWith({ id: '42', typeMode: 'strict' }, 'SESSDATA=test', {})
    expect(mocks.bilibiliApi.fetchArticleContent).toHaveBeenCalledWith({ id: '42', typeMode: 'strict' }, 'SESSDATA=test', {})
    const invokedMethods = (Object.keys(mocks.bilibiliApi) as Array<keyof typeof mocks.bilibiliApi>)
      .filter(method => mocks.bilibiliApi[method].mock.calls.length > 0)
    expect(invokedMethods).toEqual([
      'fetchUserCard',
      'fetchEmojiList',
      'fetchArticleInfo',
      'fetchArticleContent'
    ] satisfies BilibiliApiMethod[])
    expect(mocks.processImageUrl).toHaveBeenCalledTimes(1)
    expect(mocks.makeForwardMsg).toHaveBeenCalledTimes(2)
    expect(mocks.makeForwardMsg).toHaveBeenCalledWith(
      expect.objectContaining({ pickGroup: expect.any(Function) }),
      expect.arrayContaining([
        expect.objectContaining({ type: 'text' }),
        { type: 'image', url: 'processed:https://i.example.com/body.jpg' }
      ]),
      '专栏内容'
    )

    const bot = (globalThis as unknown as { Bot: Record<string, { pickGroup: ReturnType<typeof vi.fn> }> }).Bot['bot-1']
    const firstGroup = bot.pickGroup.mock.results[0]?.value as { sendMsg: ReturnType<typeof vi.fn> }
    expect(firstGroup.sendMsg).toHaveBeenCalledTimes(4)
    expect(firstGroup.sendMsg.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ type: 'forward' }))
    expect(firstGroup.sendMsg.mock.calls[1]?.[0]).toEqual({ type: 'poster' })
    expect(firstGroup.sendMsg.mock.calls[2]?.[0]).toEqual(expect.objectContaining({ type: 'forward' }))
    expect(firstGroup.sendMsg.mock.calls[3]?.[0]).toEqual({ type: 'poster' })

    expect(mocks.render).toHaveBeenCalledWith(
      'bilibili/dynamic/DYNAMIC_TYPE_ARTICLE',
      expect.objectContaining({
        usernameMeta: {
          name: '测试UP',
          vipStatus: 1,
          nicknameColor: '#FB7299'
        },
        body: expect.objectContaining({ version: 1, nodes: expect.any(Array) }),
        stats: {
          view: 101,
          like: 102,
          favorite: 103,
          reply: 104,
          share: 106,
          dynamic: 106,
          coin: 107
        }
      })
    )
    const renderData = mocks.render.mock.calls[0]?.[1] as Record<string, unknown>
    expect(renderData).not.toHaveProperty('username')
    expect(renderData).not.toHaveProperty('view')
  })
})
