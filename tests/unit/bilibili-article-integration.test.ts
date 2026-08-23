import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  processImageUrl: vi.fn(),
  makeForwardMsg: vi.fn(),
  extractBilibiliArticleImages: vi.fn(),
  formatBilibiliArticleBody: vi.fn(),
  config: {
    getConfig: vi.fn(),
    app: { parseTip: false },
    bilibili: {
      bilibiliTip: ['动态'] as string[],
      sendContent: [] as string[],
      bilibilinumcomments: 0
    },
    cookies: { bilibili: 'SESSDATA=test' }
  }
}))

vi.mock('../../src/module/utils/index.js', () => {
  class Base {}

  return {
    Base,
    Render: mocks.render,
    Config: mocks.config,
    Networks: class {},
    mergeFile: vi.fn(),
    Common: {
      count: (value: unknown) => String(value ?? 0),
      convertTimestampToDateTime: () => '2026-08-18 08:00:00',
      getCurrentTime: () => '2026-08-18 08:01:00',
      useDarkTheme: () => false
    },
    baseHeaders: {},
    downloadFile: vi.fn(),
    uploadFile: vi.fn(),
    downloadVideo: vi.fn(),
    processImageUrl: mocks.processImageUrl
  }
})

vi.mock('../../src/module/platform/bilibili/api.js', () => ({
  getBilibiliData: vi.fn()
}))

vi.mock('../../src/module/platform/bilibili/index.js', () => ({
  bilibiliComments: vi.fn(() => []),
  checkCk: vi.fn(),
  genParams: vi.fn()
}))

vi.mock('../../src/module/platform/bilibili/article.js', () => ({
  extractBilibiliArticleImages: mocks.extractBilibiliArticleImages,
  formatBilibiliArticleBody: mocks.formatBilibiliArticleBody
}))

vi.mock('../../src/module/platform/common/livePhoto.js', () => ({
  buildLivePhotoMessages: vi.fn(),
  buildLivePhotoTipMessage: vi.fn()
}))

vi.mock('../../src/module/platform/common/danmaku.js', () => ({
  burnDanmaku: vi.fn()
}))

vi.mock('../../src/runtime/host/common.js', () => ({
  default: { makeForwardMsg: mocks.makeForwardMsg }
}))

import { Bilibili } from '../../src/module/platform/bilibili/bilibili.js'

const dynamicInfo = {
  data: {
    data: {
      item: {
        id_str: '999',
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
}

const userProfile = {
  data: {
    data: {
      card: {
        name: '测试UP',
        face: 'https://i.example.com/avatar.jpg',
        mid: 10086,
        attention: 12,
        pendant: { image: '' },
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

describe('Bilibili article dynamic integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('logger', {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      mark: vi.fn(),
      green: (value: unknown) => String(value),
      yellow: (value: unknown) => String(value)
    })
    vi.stubGlobal('segment', {
      text: vi.fn((text: string) => ({ type: 'text', text })),
      image: vi.fn((url: string) => ({ type: 'image', url }))
    })

    mocks.config.getConfig.mockReturnValue({})
    mocks.extractBilibiliArticleImages.mockReturnValue(['https://i.example.com/body.jpg'])
    mocks.processImageUrl.mockImplementation(async (url: string) => `processed:${url}`)
    mocks.makeForwardMsg.mockImplementation(async (_event: unknown, messages: unknown[], title: string) => ({
      type: 'forward',
      messages,
      title
    }))
    mocks.render.mockResolvedValue({ type: 'poster' })
  })

  it('sends rich text and poster independently and passes the React article contract', async () => {
    const reply = vi.fn()
    const getBilibiliData = vi.fn(async (method: string) => {
      if (method === '动态详情数据') return dynamicInfo
      if (method === '用户主页数据') return userProfile
      if (method === '专栏文章基本信息') return articleInfo
      if (method === '专栏正文内容') return articleContent
      throw new Error(`Unexpected API method: ${method}`)
    })

    const subject = Object.create(Bilibili.prototype) as Bilibili
    Object.assign(subject, {
      Type: 'dynamic_info',
      e: { reply },
      amagi: { getBilibiliData },
      headers: {}
    })

    await subject.RESOURCES({ type: 'dynamic_info', dynamic_id: '999' })

    expect(mocks.makeForwardMsg).toHaveBeenCalledOnce()
    expect(mocks.makeForwardMsg).toHaveBeenCalledWith(
      subject.e,
      expect.arrayContaining([
        expect.objectContaining({ type: 'text' }),
        { type: 'image', url: 'processed:https://i.example.com/body.jpg' }
      ]),
      '专栏内容'
    )
    expect(reply).toHaveBeenCalledWith(expect.objectContaining({ type: 'forward' }))
    expect(reply).toHaveBeenCalledWith({ type: 'poster' })

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
          coin: 107,
          dynamic: 106
        }
      })
    )

    const articleRenderData = mocks.render.mock.calls.find(([route]) => route === 'bilibili/dynamic/DYNAMIC_TYPE_ARTICLE')?.[1]
    expect(articleRenderData).not.toHaveProperty('username')
    expect(articleRenderData).not.toHaveProperty('view')
    expect(mocks.processImageUrl).toHaveBeenCalledTimes(1)
  })
})
