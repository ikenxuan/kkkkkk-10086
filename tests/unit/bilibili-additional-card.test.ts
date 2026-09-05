import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadRealAmagiEnums } from '../helpers/amagi-enums.js'
import type { DynamicAdditional } from '../../src/module/platform/bilibili/types.js'

const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  processImageUrl: vi.fn(),
  makeForwardMsg: vi.fn(),
  bilibiliApi: {
    fetchDynamicDetail: vi.fn(),
    fetchUserCard: vi.fn()
  },
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
  bilibiliComments: vi.fn(() => []),
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

import { Bilibili, buildBilibiliAdditionalCard } from '../../src/module/platform/bilibili/bilibili.js'

/** 四份原始卡片逐字段照 bilibili-API-collect 的 `module_dynamic.additional` 抄，用 satisfies 钉在 src 侧类型上。 */
const reserveAdditional = {
  type: 'ADDITIONAL_TYPE_RESERVE',
  reserve: {
    title: '这是一场直播预约',
    desc1: { text: '11-05 20:00 直播' },
    desc2: { text: '2人预约', visible: true },
    desc3: { text: '预约有奖：抽 3 位送周边' },
    button: {
      status: 1,
      check: { text: '已预约' },
      uncheck: { text: '预约' }
    }
  }
} satisfies DynamicAdditional

const voteAdditional = {
  type: 'ADDITIONAL_TYPE_VOTE',
  vote: {
    title: '你更喜欢哪个结局？',
    desc: '你更喜欢哪个结局？',
    join_num: 1703,
    status: 4
  }
} satisfies DynamicAdditional

const commonAdditional = {
  type: 'ADDITIONAL_TYPE_COMMON',
  common: {
    cover: 'https://i.example.com/game.jpg',
    title: '某某手游',
    desc1: '角色扮演',
    desc2: '预约人数 120 万',
    head_text: '相关游戏',
    sub_type: 'game',
    button: { jump_style: { text: '进入' } }
  }
} satisfies DynamicAdditional

const ugcAdditional = {
  type: 'ADDITIONAL_TYPE_UGC',
  ugc: {
    cover: 'https://i.example.com/ugc.jpg',
    title: '被引用的视频标题',
    duration: '08:01',
    desc_second: '12.6万播放 · 1061弹幕'
  }
} satisfies DynamicAdditional

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

const buildDynamicResponse = (type: string, additional: unknown) => ({
  data: {
    data: {
      follower: 34,
      item: {
        id_str: '888',
        type,
        basic: { rid_str: '1' },
        modules: {
          module_author: {
            mid: 10086,
            name: '测试UP',
            face: 'https://i.example.com/avatar.jpg',
            pendant: { image: '' },
            pub_time: '刚刚',
            pub_ts: 1_723_900_000
          },
          module_dynamic: {
            major: {
              opus: {
                pics: [],
                summary: { text: '动态正文', rich_text_nodes: [] }
              }
            },
            additional
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
})

/** 跑一遍 dynamic_info 链路，回传该路由拿到的载荷。 */
const renderDynamic = async (type: string, additional: unknown): Promise<Record<string, unknown>> => {
  mocks.bilibiliApi.fetchDynamicDetail.mockResolvedValue(buildDynamicResponse(type, additional))

  const subject = Object.create(Bilibili.prototype) as Bilibili
  Object.assign(subject, {
    Type: 'dynamic_info',
    e: { reply: vi.fn() },
    amagi: { bilibili: mocks.bilibiliApi },
    headers: {}
  })

  await subject.RESOURCES({ type: 'dynamic_info', dynamic_id: '888' })

  const route = `bilibili/dynamic/${type}`
  const call = mocks.render.mock.calls.find(([called]) => called === route)
  expect(call, `未渲染 ${route}`).toBeDefined()
  return call![1] as Record<string, unknown>
}

describe('buildBilibiliAdditionalCard', () => {
  it('映射预约卡片，未预约时按钮取 uncheck 文案', () => {
    expect(buildBilibiliAdditionalCard(reserveAdditional)).toEqual({
      type: 'ADDITIONAL_TYPE_RESERVE',
      reserve: {
        title: '这是一场直播预约',
        desc1: '11-05 20:00 直播',
        desc2: '2人预约',
        desc3: '预约有奖：抽 3 位送周边',
        buttonText: '预约'
      }
    })
  })

  it('已预约（status 2）时按钮取 check 文案', () => {
    const card = buildBilibiliAdditionalCard({
      ...reserveAdditional,
      reserve: { ...reserveAdditional.reserve, button: { ...reserveAdditional.reserve.button, status: 2 } }
    })
    expect(card).toMatchObject({ reserve: { buttonText: '已预约' } })
  })

  it('视频预约只给 jump_style 时按钮取它', () => {
    const card = buildBilibiliAdditionalCard({
      ...reserveAdditional,
      reserve: { ...reserveAdditional.reserve, button: { jump_style: { text: '去观看' } } }
    })
    expect(card).toMatchObject({ reserve: { buttonText: '去观看' } })
  })

  it('desc2.visible 为 false 时按钮显示已结束', () => {
    const card = buildBilibiliAdditionalCard({
      ...reserveAdditional,
      reserve: { ...reserveAdditional.reserve, desc2: { text: '1.0万人看过', visible: false } }
    })
    expect(card).toMatchObject({ reserve: { desc2: '1.0万人看过', buttonText: '已结束' } })
  })

  it('映射投票卡片，参与人数由 join_num 拼出', () => {
    expect(buildBilibiliAdditionalCard(voteAdditional)).toEqual({
      type: 'ADDITIONAL_TYPE_VOTE',
      vote: {
        title: '你更喜欢哪个结局？',
        desc: '1703人参与',
        status: 4
      }
    })
  })

  it('映射通用卡片', () => {
    expect(buildBilibiliAdditionalCard(commonAdditional)).toEqual({
      type: 'ADDITIONAL_TYPE_COMMON',
      common: {
        cover: 'https://i.example.com/game.jpg',
        title: '某某手游',
        desc1: '角色扮演',
        desc2: '预约人数 120 万',
        button_text: '进入',
        head_text: '相关游戏',
        sub_type: 'game'
      }
    })
  })

  it('映射视频跳转卡片，播放量与弹幕数从 desc_second 拆开', () => {
    expect(buildBilibiliAdditionalCard(ugcAdditional)).toEqual({
      type: 'ADDITIONAL_TYPE_UGC',
      ugc: {
        cover: 'https://i.example.com/ugc.jpg',
        title: '被引用的视频标题',
        duration: '08:01',
        play: '12.6万',
        danmaku: '1061'
      }
    })
  })

  it('模板没实现的类型不传（商品卡）', () => {
    expect(buildBilibiliAdditionalCard({
      type: 'ADDITIONAL_TYPE_GOODS',
      // @ts-expect-error goods 不在 src 侧类型里，正是「认不出就返回 undefined」要覆盖的输入
      goods: { head_text: '相关商品', items: [{ name: '手办' }] }
    })).toBeUndefined()
  })

  it('additional 缺失或为 null 时不传', () => {
    expect(buildBilibiliAdditionalCard(undefined)).toBeUndefined()
    expect(buildBilibiliAdditionalCard(null)).toBeUndefined()
  })

  it('类型对得上但子对象缺失时不传', () => {
    expect(buildBilibiliAdditionalCard({ type: 'ADDITIONAL_TYPE_UGC' })).toBeUndefined()
  })
})

describe('动态渲染载荷带上 additional', () => {
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
    mocks.processImageUrl.mockImplementation(async (url: string) => `processed:${url}`)
    mocks.makeForwardMsg.mockResolvedValue({ type: 'forward' })
    mocks.render.mockResolvedValue({ type: 'poster' })
    mocks.bilibiliApi.fetchUserCard.mockResolvedValue(userProfile)
  })

  it('纯文动态把预约卡片传进 Render', async () => {
    const payload = await renderDynamic('DYNAMIC_TYPE_WORD', reserveAdditional)
    expect(payload.additional).toEqual(buildBilibiliAdditionalCard(reserveAdditional))
    expect(payload.additional).toMatchObject({ type: 'ADDITIONAL_TYPE_RESERVE', reserve: { buttonText: '预约' } })
  })

  it('图文动态把投票卡片传进 Render', async () => {
    const payload = await renderDynamic('DYNAMIC_TYPE_DRAW', voteAdditional)
    expect(payload.additional).toEqual(buildBilibiliAdditionalCard(voteAdditional))
    expect(payload.additional).toMatchObject({ type: 'ADDITIONAL_TYPE_VOTE', vote: { desc: '1703人参与' } })
  })

  it('图文动态把视频跳转卡片传进 Render', async () => {
    const payload = await renderDynamic('DYNAMIC_TYPE_DRAW', ugcAdditional)
    expect(payload.additional).toMatchObject({ type: 'ADDITIONAL_TYPE_UGC', ugc: { play: '12.6万', danmaku: '1061' } })
  })

  it('纯文动态把通用卡片传进 Render', async () => {
    const payload = await renderDynamic('DYNAMIC_TYPE_WORD', commonAdditional)
    expect(payload.additional).toMatchObject({ type: 'ADDITIONAL_TYPE_COMMON', common: { button_text: '进入' } })
  })

  it('商品卡与 additional 缺失都不进载荷', async () => {
    const goods = await renderDynamic('DYNAMIC_TYPE_WORD', { type: 'ADDITIONAL_TYPE_GOODS', goods: {} })
    expect(goods.additional).toBeUndefined()

    vi.clearAllMocks()
    mocks.render.mockResolvedValue({ type: 'poster' })
    mocks.bilibiliApi.fetchUserCard.mockResolvedValue(userProfile)
    const absent = await renderDynamic('DYNAMIC_TYPE_DRAW', undefined)
    expect(absent.additional).toBeUndefined()
  })
})
