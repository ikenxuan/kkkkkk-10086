import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadRealAmagiEnums } from '../helpers/amagi-enums.js'

/**
 * `dynamic_info` 里评论图不能再带走正文。
 *
 * 这条支线原来是 fan-out 之前的一次裸 `await softFetch(fetchComments)`，而
 * `dynamic_info` 整条是串行的、没接 `runMediaTasks` —— 白名单外的硬失败
 * （-352 风控、超时、其它业务码）一抛就是整条动态都不发：图文、纯图、纯文、
 * 转发、专栏一张都出不来。渲染侧同样危险，AV 动态里评论卡排在正文**之前**。
 *
 * 12061（UP 主关了评论区）是白名单内的软失败，走的是另一条路，这里一并钉住
 * 免得修硬失败时把它的提示语弄丢。
 */

const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  processImageUrl: vi.fn(),
  makeForwardMsg: vi.fn(),
  bilibiliComments: vi.fn(() => [{ message: '评论一条' }]),
  bilibiliApi: {
    fetchDynamicDetail: vi.fn(),
    fetchUserCard: vi.fn(),
    fetchComments: vi.fn(),
    fetchVideoInfo: vi.fn()
  },
  config: {
    getConfig: vi.fn(),
    app: { parseTip: false },
    bilibili: {
      // 旧键写法：hasBilibiliContent 在没配 sendContent 时读的就是它
      bilibiliTip: ['动态', '评论图'] as string[],
      sendContent: [] as string[],
      bilibilinumcomments: 5
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
      useDarkTheme: () => false,
      removeFile: vi.fn()
    },
    baseHeaders: {},
    downloadFile: vi.fn(),
    uploadFile: vi.fn(),
    downloadVideo: vi.fn(),
    processImageUrl: mocks.processImageUrl
  }
})

vi.mock('../../src/module/utils/amagiClient.js', () => ({
  loadAmagiEnums: loadRealAmagiEnums,
  bilibiliFetcher: new Proxy({}, {
    get: (_target, prop) => {
      throw new Error(`不该读模块级 bilibiliFetcher.${String(prop)}，取数应走 this.amagi.bilibili`)
    }
  }),
  buildAmagiRequestConfig: vi.fn(() => ({}))
}))

vi.mock('../../src/module/platform/bilibili/index.js', () => ({
  bilibiliComments: mocks.bilibiliComments,
  checkCk: vi.fn(),
  genParams: vi.fn()
}))

vi.mock('../../src/module/platform/common/livePhoto.js', () => ({
  buildLivePhotoMessages: vi.fn(),
  buildLivePhotoMessagesBatch: vi.fn(async () => ({ results: [], tempFiles: [], generatedLivePhoto: false })),
  buildLivePhotoTipMessage: vi.fn()
}))

vi.mock('../../src/module/platform/common/danmaku.js', () => ({
  burnDanmaku: vi.fn()
}))

vi.mock('../../src/runtime/host/common.js', () => ({
  default: { makeForwardMsg: mocks.makeForwardMsg }
}))

import { Bilibili } from '../../src/module/platform/bilibili/bilibili.js'

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

const moduleAuthor = {
  mid: 10086,
  name: '测试UP',
  face: 'https://i.example.com/avatar.jpg',
  pendant: { image: '' },
  pub_time: '刚刚',
  pub_ts: 1_723_900_000
}

const moduleStat = {
  like: { count: 8 },
  comment: { count: 7 },
  forward: { count: 6 }
}

/** 图文动态：正文卡排在评论卡**之后**，评论一挂原来就把它带走了 */
const drawDynamic = {
  data: {
    data: {
      follower: 34,
      item: {
        id_str: '888',
        type: 'DYNAMIC_TYPE_DRAW',
        basic: { rid_str: '1' },
        modules: {
          module_author: moduleAuthor,
          module_dynamic: {
            major: {
              opus: {
                pics: [{ url: 'https://i.example.com/1.jpg' }],
                summary: { text: '动态正文', rich_text_nodes: [] }
              }
            }
          },
          module_stat: moduleStat
        }
      }
    }
  }
}

/** 视频动态：评论卡排在正文卡**之前**，所以渲染一抛正文就没了 */
const avDynamic = {
  data: {
    data: {
      follower: 34,
      item: {
        id_str: '999',
        type: 'DYNAMIC_TYPE_AV',
        basic: { comment_id_str: '123' },
        modules: {
          module_author: moduleAuthor,
          module_dynamic: {
            desc: { text: '来看视频', rich_text_nodes: [] },
            major: {
              type: 'MAJOR_TYPE_ARCHIVE',
              archive: { bvid: 'BV1dyn', duration_text: '03:20' }
            }
          },
          module_stat: moduleStat
        }
      }
    }
  }
}

/** 纯文动态：原来它只查数量、不查「评论图」开关，关掉开关照样出评论卡 */
const wordDynamic = {
  data: {
    data: {
      follower: 34,
      item: {
        id_str: '777',
        type: 'DYNAMIC_TYPE_WORD',
        basic: { rid_str: '1' },
        modules: {
          module_author: moduleAuthor,
          module_dynamic: {
            major: { opus: { pics: [], summary: { text: '纯文正文', rich_text_nodes: [] } } }
          },
          module_stat: moduleStat
        }
      }
    }
  }
}

const videoInfo = {
  data: {
    data: {
      title: '视频标题',
      desc: '视频简介',
      desc_v2: [],
      pic: 'https://i.example.com/cover.jpg',
      ctime: 1_723_900_000,
      pages: [{ cid: 1 }],
      owner: { face: 'https://i.example.com/owner.jpg' },
      stat: { like: 1, reply: 2, share: 3, view: 4, coin: 5 }
    }
  }
}

/** 走一遍 dynamic_info，返回被渲染过的模板路径序列 */
const parseDynamic = async (dynamic: unknown): Promise<{ rendered: string[], replies: unknown[] }> => {
  mocks.bilibiliApi.fetchDynamicDetail.mockResolvedValue(dynamic)
  const replies: unknown[] = []

  const subject = Object.create(Bilibili.prototype) as Bilibili
  Object.assign(subject, {
    Type: 'dynamic_info',
    e: { reply: vi.fn(async (message: unknown) => { replies.push(message) }) },
    amagi: { bilibili: mocks.bilibiliApi },
    headers: {}
  })

  await subject.RESOURCES({ type: 'dynamic_info', dynamic_id: '888' } as never)

  return {
    rendered: mocks.render.mock.calls.map(([template]) => String(template)),
    replies
  }
}

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
  mocks.config.bilibili.bilibiliTip = ['动态', '评论图']
  mocks.config.bilibili.sendContent = []
  mocks.config.bilibili.bilibilinumcomments = 5
  mocks.processImageUrl.mockImplementation(async (url: string) => `processed:${url}`)
  mocks.makeForwardMsg.mockResolvedValue({ type: 'forward' })
  mocks.render.mockResolvedValue({ type: 'poster' })
  mocks.bilibiliComments.mockReturnValue([{ message: '评论一条' }])
  mocks.bilibiliApi.fetchUserCard.mockResolvedValue(userProfile)
  mocks.bilibiliApi.fetchComments.mockResolvedValue({ data: { replies: [{ rpid: 1 }] } })
  mocks.bilibiliApi.fetchVideoInfo.mockResolvedValue(videoInfo)
})

describe('dynamic_info 的评论图不再带走正文', () => {
  it('评论取数硬失败时图文动态照发，只少一张评论卡', async () => {
    const fetchError = new Error('-352 风控')
    mocks.bilibiliApi.fetchComments.mockRejectedValue(fetchError)

    const { rendered } = await parseDynamic(drawDynamic)

    expect(rendered).toContain('bilibili/dynamic/DYNAMIC_TYPE_DRAW')
    expect(rendered).not.toContain('bilibili/comment')
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('[Bilibili] 动态评论取数失败'),
      fetchError
    )
  })

  it('评论卡渲染失败时图文动态照发', async () => {
    const renderError = new Error('SSR 崩了')
    mocks.render.mockImplementation(async (template: string) => {
      if (template === 'bilibili/comment') throw renderError
      return { type: 'poster' }
    })

    const { rendered } = await parseDynamic(drawDynamic)

    expect(rendered).toContain('bilibili/dynamic/DYNAMIC_TYPE_DRAW')
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('[Bilibili] 动态评论图渲染与发送任务失败'),
      renderError
    )
  })

  /*
    AV 动态是唯一「评论卡排在正文之前」的类型，所以它是这次修复里唯一靠
    try/catch 而不是靠位置侥幸活下来的分支。
  */
  it('评论卡渲染失败时视频动态的正文照发（它排在评论卡之后）', async () => {
    mocks.render.mockImplementation(async (template: string) => {
      if (template === 'bilibili/comment') throw new Error('SSR 崩了')
      return { type: 'poster' }
    })

    const { rendered } = await parseDynamic(avDynamic)

    expect(rendered).toContain('bilibili/dynamic/DYNAMIC_TYPE_AV')
  })

  it('评论取数硬失败时视频动态的正文照发', async () => {
    mocks.bilibiliApi.fetchComments.mockRejectedValue(new Error('timeout of 15000ms exceeded'))

    const { rendered } = await parseDynamic(avDynamic)

    expect(rendered).toContain('bilibili/dynamic/DYNAMIC_TYPE_AV')
    expect(rendered).not.toContain('bilibili/comment')
  })

  // 12061 走白名单软失败那条路：提示语要留着，也一样不该影响正文
  it('UP 主关了评论区时提示一句，正文照发', async () => {
    mocks.bilibiliApi.fetchComments.mockRejectedValue(
      Object.assign(new Error('评论区已关闭'), { code: 12061 })
    )

    const { rendered, replies } = await parseDynamic(drawDynamic)

    expect(replies).toContain('UP主已关闭评论区，无法获取评论')
    expect(rendered).toContain('bilibili/dynamic/DYNAMIC_TYPE_DRAW')
    expect(rendered).not.toContain('bilibili/comment')
  })

  it('一切正常时评论卡照出，且排在正文之前', async () => {
    const { rendered } = await parseDynamic(drawDynamic)

    expect(rendered).toContain('bilibili/comment')
    expect(rendered.indexOf('bilibili/comment'))
      .toBeLessThan(rendered.indexOf('bilibili/dynamic/DYNAMIC_TYPE_DRAW'))
  })
})

/*
  「评论图」这个开关原来只有 DRAW 分支查，WORD / AV / ARTICLE 三个分支只查数量 ——
  用户在面板里关掉它，那三种动态照样出评论卡。而且不管开关如何，取数那一跳都照发。
*/
describe('dynamic_info 的评论图闸门四种类型一致', () => {
  const cases = [
    ['图文', drawDynamic, 'bilibili/dynamic/DYNAMIC_TYPE_DRAW'],
    ['纯文', wordDynamic, 'bilibili/dynamic/DYNAMIC_TYPE_WORD'],
    ['视频', avDynamic, 'bilibili/dynamic/DYNAMIC_TYPE_AV']
  ] as const

  it.each(cases)('关掉「评论图」后%s动态不出评论卡，正文照发', async (_label, dynamic, template) => {
    mocks.config.bilibili.bilibiliTip = ['动态']

    const { rendered } = await parseDynamic(dynamic)

    expect(rendered).not.toContain('bilibili/comment')
    expect(rendered).toContain(template)
    // 关掉了就别白发那一跳
    expect(mocks.bilibiliApi.fetchComments).not.toHaveBeenCalled()
  })

  it.each(cases)('数量设成 0 后%s动态不出评论卡，正文照发', async (_label, dynamic, template) => {
    mocks.config.bilibili.bilibilinumcomments = 0

    const { rendered } = await parseDynamic(dynamic)

    expect(rendered).not.toContain('bilibili/comment')
    expect(rendered).toContain(template)
    expect(mocks.bilibiliApi.fetchComments).not.toHaveBeenCalled()
  })

  it.each(cases)('开关和数量都给足时%s动态出评论卡', async (_label, dynamic) => {
    const { rendered } = await parseDynamic(dynamic)

    expect(rendered).toContain('bilibili/comment')
  })
})

/*
  `dynamic_info` 原来整条串行、压根没接 runMediaTasks：图片处理一抛正文卡就没了，
  正文卡一抛评论卡就没了（AV 动态反过来，评论卡排在正文之前）。
  现在正文 / 图片 / 评论卡是三条并发支线。
*/
describe('dynamic_info 的正文、图片、评论各自进行', () => {
  it('图片处理失败时图文动态的正文卡和评论卡照发', async () => {
    const imageError = new Error('图片 403')
    mocks.processImageUrl.mockRejectedValue(imageError)

    const { rendered } = await parseDynamic(drawDynamic)

    expect(rendered).toContain('bilibili/dynamic/DYNAMIC_TYPE_DRAW')
    expect(rendered).toContain('bilibili/comment')
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('[Bilibili] 动态图片下载与发送任务失败'),
      imageError
    )
  })

  it('正文卡渲染失败时图片和评论卡照发', async () => {
    const posterError = new Error('正文卡 SSR 崩了')
    mocks.render.mockImplementation(async (template: string) => {
      if (template === 'bilibili/dynamic/DYNAMIC_TYPE_DRAW') throw posterError
      return { type: 'poster' }
    })

    const { rendered } = await parseDynamic(drawDynamic)

    expect(rendered).toContain('bilibili/comment')
    expect(mocks.processImageUrl).toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('[Bilibili] 动态正文卡渲染与发送任务失败'),
      posterError
    )
  })

  /*
    `fetchUserCard` 原来是 switch 之前的裸 await，六种动态类型的正文卡都读它 ——
    它一挂整条动态一张卡都不发。现在它只在正文支线里被 await。
  */
  it('UP 主名片取数失败时只带走正文卡，图片和评论卡照发', async () => {
    const cardError = new Error('名片接口挂了')
    mocks.bilibiliApi.fetchUserCard.mockRejectedValue(cardError)

    const { rendered } = await parseDynamic(drawDynamic)

    expect(rendered).not.toContain('bilibili/dynamic/DYNAMIC_TYPE_DRAW')
    expect(rendered).toContain('bilibili/comment')
    expect(mocks.processImageUrl).toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('[Bilibili] 动态正文卡渲染与发送任务失败'),
      cardError
    )
  })

  it('视频动态的作品取数失败时评论卡照发', async () => {
    const infoError = new Error('视频详情挂了')
    mocks.bilibiliApi.fetchVideoInfo.mockRejectedValue(infoError)

    const { rendered } = await parseDynamic(avDynamic)

    expect(rendered).not.toContain('bilibili/dynamic/DYNAMIC_TYPE_AV')
    expect(rendered).toContain('bilibili/comment')
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('[Bilibili] 动态正文卡渲染与发送任务失败'),
      infoError
    )
  })

  // 名片只取一次：转发动态的嵌套分支会再读一次，记忆化不能丢
  it('UP 主名片在一次解析里只取一次', async () => {
    await parseDynamic(drawDynamic)

    expect(mocks.bilibiliApi.fetchUserCard).toHaveBeenCalledTimes(1)
  })
})
