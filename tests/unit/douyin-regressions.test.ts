import { beforeEach, describe, expect, it, vi } from 'vitest'

const configMock = vi.hoisted(() => ({
  app: { parseTip: true },
  douyin: { douyinTip: [], push: { shareType: 'video' } },
  cookies: { douyin: '' },
  upload: { filelimit: 100 }
}))

const douyinDataMock = vi.hoisted(() => vi.fn())
const renderMock = vi.hoisted(() => vi.fn())
const addAwemeCacheMock = vi.hoisted(() => vi.fn())
const shouldFilterMock = vi.hoisted(() => vi.fn())
const getDouyinIdMock = vi.hoisted(() => vi.fn())
const guardedDouyinDataMock = vi.hoisted(() => vi.fn())

vi.mock('../../src/module/utils/index.js', () => ({
  Base: class {
    e: Record<string, unknown>
    headers: Record<string, string> = {}
    amagi = { getDouyinData: douyinDataMock }

    constructor (event: Record<string, unknown>) {
      this.e = event
    }
  },
  Config: configMock,
  Common: {
    count: (value: unknown) => String(value ?? 0),
    convertTimestampToDateTime: () => 'now',
    tempDri: { images: '', video: '' }
  },
  Networks: class {},
  Render: renderMock,
  UploadRecord: vi.fn(),
  baseHeaders: {},
  downloadFile: vi.fn(),
  downloadVideo: vi.fn(),
  processImageUrl: vi.fn(),
  uploadFile: vi.fn()
}))

vi.mock('../../src/runtime/host/common.js', () => ({
  default: { makeForwardMsg: vi.fn() }
}))

vi.mock('@karinjs/md-html', () => ({ markdown: vi.fn((value: string) => value) }))
vi.mock('../../src/module/platform/common/danmaku.js', () => ({ burnDanmaku: vi.fn() }))
vi.mock('../../src/module/platform/common/livePhoto.js', () => ({
  buildLivePhotoMessages: vi.fn(),
  // 批量入口的默认返回：results 为空 => 每张图都走普通图片回退分支。
  buildLivePhotoMessagesBatch: vi.fn(async () => ({ results: [], tempFiles: [], generatedLivePhoto: false })),
  buildLivePhotoTipMessage: vi.fn()
}))
vi.mock('../../src/module/platform/douyin/index.js', () => ({
  douyinComments: vi.fn(),
  douyinProcessVideos: vi.fn(),
  getDouyinID: getDouyinIdMock
}))
vi.mock('../../src/module/platform/douyin/workType.js', () => ({
  getDouyinWorkCoverUrl: vi.fn(() => ''),
  isDouyinArticle: vi.fn(() => false),
  isDouyinImage: vi.fn(() => false),
  isDouyinVideo: vi.fn(() => false),
  normalizeArticleImages: vi.fn(() => []),
  parseJsonSafely: vi.fn(() => ({}))
}))
vi.mock('../../src/module/db/index.js', () => ({
  addAwemeCache: addAwemeCacheMock,
  cleanOldDynamicCache: vi.fn(),
  douyinDB: {
    addAwemeCache: addAwemeCacheMock,
    shouldFilter: shouldFilterMock,
    getLiveStatus: vi.fn(),
    updateLiveStatus: vi.fn()
  }
}))
vi.mock('../../src/module/platform/douyin/getid.js', () => ({
  getDouyinID: getDouyinIdMock
}))
vi.mock('../../src/module/platform/douyin/api.js', () => ({
  getDouyinData: guardedDouyinDataMock
}))

globalThis.logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  mark: vi.fn(),
  blue: (value: string) => value,
  green: (value: string) => value,
  magenta: (value: string) => value,
  cyan: (value: string) => value,
  yellow: (value: string) => value,
  red: (value: string) => value
} as unknown as typeof logger

const { DouYin, pickDouyinPlayUrl } = await import('../../src/module/platform/douyin/douyin.js')
const { DouYinpush } = await import('../../src/module/platform/douyin/push.js')
const { DouyinPushPreview } = await import('../../src/module/platform/douyin/pushPreview.js')

beforeEach(() => {
  configMock.app.parseTip = true
  configMock.douyin.push.shareType = 'video'
  douyinDataMock.mockReset()
  renderMock.mockReset()
  addAwemeCacheMock.mockReset()
  shouldFilterMock.mockReset()
  shouldFilterMock.mockResolvedValue(false)
  getDouyinIdMock.mockReset()
  getDouyinIdMock.mockResolvedValue({ type: 'one_work', is_mp4: true })
  guardedDouyinDataMock.mockReset()
  guardedDouyinDataMock.mockResolvedValue({})
})

describe('Douyin migration regressions', () => {
  it('announces the parse tip before requesting work data', async () => {
    const reply = vi.fn().mockResolvedValue(undefined)
    douyinDataMock.mockRejectedValueOnce(new Error('stop after ordering check'))

    const event = { reply }
    const parser = new DouYin(event, { type: 'one_work', aweme_id: 'work-1' })
    expect(parser.type).toBe('one_work')
    expect(parser.e.reply).toBe(reply)
    expect(configMock.app.parseTip).toBe(true)
    // 这里注入的拒绝只是用来在顺序断言之后停住流程。RESOURCES 以前会把它咽掉并返回
    // false，现在会原样抛出，交给 wrapWithErrorHandler 出错误卡片，所以断言从
    // 「返回 false」改成「向上抛」——本用例真正要证明的是下面那条调用顺序。
    await expect(parser.RESOURCES({ type: 'one_work', aweme_id: 'work-1' }))
      .rejects.toThrow('stop after ordering check')

    expect(reply).toHaveBeenCalledWith('检测到抖音链接，开始解析')
    expect(douyinDataMock).toHaveBeenCalled()
    expect(reply.mock.invocationCallOrder[0]!).toBeLessThan(douyinDataMock.mock.invocationCallOrder[0]!)
  })

  it('reads live room items from the fetchLiveRoomInfo response layer', async () => {
    renderMock.mockResolvedValue(['rendered'])

    const liveItem = {
      cover: { url_list: ['cover'] },
      title: 'Live title',
      room_view_stats: { display_value: '12' },
      stats: { total_user_str: '34' }
    }
    const pushItem = {
      create_time: 0,
      avatar_img: '',
      living: true,
      remark: 'author',
      sec_uid: 'sec-1',
      targets: [],
      Detail_Data: {
        room_data: { owner: { web_rid: 'room-1' } },
        live_data: {
          data: {
            data: [liveItem],
            partition_road_map: { partition: { title: 'Games' } }
          }
        },
        user_info: {
          data: {
            user: {
              nickname: 'author',
              avatar_larger: { uri: 'avatar' },
              follower_count: 10
            }
          }
        },
        liveStatus: { liveStatus: 'open' as const }
      }
    }

    const result = await new DouYinpush({ group_id: 'group-1' }).getdata({ 'live-1': pushItem })

    expect(result).toBe(true)
    // 断言的是 ktr/template/douyin/live 的契约形状，不是 art-template 时代的旧形状：
    // image_url 直接进 <img src>，所以必须是字符串；分区和房间号是两个独立字段，
    // 不是拼好的 liveinf 串（模板里没有 liveinf 这个字段）。
    expect(renderMock).toHaveBeenCalledWith('douyin/live', expect.objectContaining({
      image_url: 'cover',
      text: 'Live title',
      partition_title: 'Games',
      room_id: 'room-1',
      online_viewers: '12',
      total_viewers: '34'
    }))
  })

  it.each([
    ['favorite', 'fetchUserFavoriteList'],
    ['recommend', 'fetchUserRecommendList']
  ])('fetches the %s list through the guarded API wrapper', async (pushType, method) => {
    guardedDouyinDataMock.mockResolvedValue({ data: { aweme_list: [{ aweme_id: `${pushType}-1` }] } })

    const result = await new DouYinpush({ group_id: 'group-1' }).fetchContentList(
      pushType as 'favorite' | 'recommend',
      'sec-1',
      { remark: 'author' } as never
    )

    expect(result).toEqual([{ aweme_id: `${pushType}-1` }])
    expect(guardedDouyinDataMock).toHaveBeenCalledWith(method === 'fetchUserFavoriteList' ? 'fetchUserFavoriteList' : 'fetchUserRecommendList', {
      sec_uid: 'sec-1',
      number: 15,
      typeMode: 'strict'
    })
  })

  // live.douyin.com 直链只能提取出 web_rid，而卡片要的主播字段只有「用户主页数据」才给。
  // 这条断言钉住那一跳：先用 web_rid 探直播间，从响应的 user.sec_uid 反查主播，
  // 再带着主页的 room_id_str 取正式的直播间信息。
  // 回归的是「room_id 分支根本没接上消费方」——原来这里只读 data.sec_uid，
  // 直链解析出的 room_id 无人使用，且只传 sec_uid 会被 amagi 的 zod 校验直接拒掉。
  it('resolves a live room from a web_rid-only direct link', async () => {
    renderMock.mockResolvedValue(['rendered'])
    const reply = vi.fn().mockResolvedValue(undefined)

    const liveItem = {
      cover: { url_list: ['cover'] },
      title: '南方花园正在直播',
      owner: { web_rid: '26139686' },
      room_view_stats: { display_value: '12' },
      stats: { total_user_str: '34' }
    }

    douyinDataMock.mockImplementation(async (method: string, options: Record<string, unknown>) => {
      if (method === '直播间信息数据') {
        // 第一次探测只有 web_rid；第二次才带上主页给的内部房间号
        if (options.room_id === '26139686') {
          return { data: { data: { user: { sec_uid: 'sec-live-1' } } } }
        }
        return {
          data: {
            data: {
              data: [liveItem],
              partition_road_map: { partition: { title: '户外' } }
            }
          }
        }
      }
      return {
        data: {
          user: {
            live_status: 1,
            nickname: '南方花园',
            sec_uid: 'sec-live-1',
            room_id_str: '7632061670499617555',
            room_data: JSON.stringify({ owner: { web_rid: '26139686' } }),
            avatar_larger: { url_list: ['avatar'] }
          }
        }
      }
    })

    const data = { type: 'live_room_detail', room_id: '26139686' }
    expect(await new DouYin({ reply }, data).RESOURCES(data)).toBe(true)

    // 用 web_rid 探一次直播间，拿到 sec_uid
    expect(douyinDataMock).toHaveBeenNthCalledWith(1, '直播间信息数据', {
      room_id: '26139686',
      web_rid: '26139686',
      typeMode: 'strict'
    })
    // 用探到的 sec_uid 反查主播主页
    expect(douyinDataMock).toHaveBeenNthCalledWith(2, '用户主页数据', {
      sec_uid: 'sec-live-1',
      typeMode: 'strict'
    })
    // 正式取直播间信息时 room_id 换成主页给的内部房间号，web_rid 仍是展示号
    expect(douyinDataMock).toHaveBeenNthCalledWith(3, '直播间信息数据', {
      room_id: '7632061670499617555',
      web_rid: '26139686',
      typeMode: 'strict'
    })
    expect(renderMock).toHaveBeenCalledWith('douyin/live', expect.objectContaining({
      image_url: 'cover',
      text: '南方花园正在直播',
      partition_title: '户外',
      room_id: '26139686'
    }))
  })

  // webcast 分享链接（抖音 App「复制链接」的真实形态）给的是 sec_uid，
  // 这条确认它不再多探一次直播间，直接走主页 -> 直播间信息。
  it('resolves a live room from a sec_uid-only webcast link', async () => {
    renderMock.mockResolvedValue(['rendered'])
    const reply = vi.fn().mockResolvedValue(undefined)

    douyinDataMock.mockImplementation(async (method: string) => {
      if (method === '直播间信息数据') {
        return { data: { data: { data: [{ title: 'Live', cover: { url_list: ['cover'] } }] } } }
      }
      return {
        data: {
          user: {
            live_status: 1,
            nickname: '主播',
            sec_uid: 'sec-webcast',
            room_id_str: '7632061670499617555',
            room_data: JSON.stringify({ owner: { web_rid: '26139686' } }),
            avatar_larger: { url_list: ['avatar'] }
          }
        }
      }
    })

    const data = { type: 'live_room_detail', sec_uid: 'sec-webcast' }
    expect(await new DouYin({ reply }, data).RESOURCES(data)).toBe(true)

    expect(douyinDataMock).toHaveBeenNthCalledWith(1, '用户主页数据', {
      sec_uid: 'sec-webcast',
      typeMode: 'strict'
    })
    expect(douyinDataMock).toHaveBeenNthCalledWith(2, '直播间信息数据', {
      room_id: '7632061670499617555',
      web_rid: '26139686',
      typeMode: 'strict'
    })
  })

  it('tells the user the anchor is offline instead of rendering a card', async () => {
    const reply = vi.fn().mockResolvedValue(undefined)
    douyinDataMock.mockResolvedValue({ data: { user: { live_status: 0, nickname: '主播' } } })

    const data = { type: 'live_room_detail', sec_uid: 'sec-offline' }
    expect(await new DouYin({ reply }, data).RESOURCES(data)).toBe(true)

    expect(reply).toHaveBeenCalledWith('「主播」\n未开播，正在休息中~')
    expect(renderMock).not.toHaveBeenCalled()
  })

  it('fetches live room details through the guarded API wrapper', async () => {
    const liveData = { data: { data: [{ title: 'Live' }] } }
    guardedDouyinDataMock.mockResolvedValue(liveData)

    const result = await new DouYinpush({ group_id: 'group-1' }).buildLivePushItem(
      'sec-1',
      {
        data: {
          user: {
            live_status: 1,
            room_id_str: 'room-1',
            room_data: JSON.stringify({ owner: { web_rid: 'web-1' } }),
            avatar_larger: { uri: 'avatar' }
          }
        }
      } as never,
      { remark: 'author' } as never,
      []
    )

    expect(result?.Detail_Data.live_data).toBe(liveData)
    expect(guardedDouyinDataMock).toHaveBeenCalledWith('直播间信息数据', {
      room_id: 'room-1',
      web_rid: 'web-1',
      typeMode: 'strict'
    })
  })

  it('previews favorite and recommend lists through the guarded API wrapper', async () => {
    getDouyinIdMock.mockResolvedValue({ type: 'user_dynamic', sec_uid: 'sec-1' })
    douyinDataMock.mockResolvedValue({ data: { user: { nickname: 'author' } } })
    guardedDouyinDataMock.mockResolvedValue({ data: { aweme_list: [{ desc: 'work' }] } })
    renderMock.mockResolvedValue('image')

    const result = await new DouyinPushPreview({} as never).renderList('favorite', 'https://douyin.test/user')

    expect(result).toEqual({ ok: true, image: 'image' })
    expect(guardedDouyinDataMock).toHaveBeenCalledWith('fetchUserFavoriteList', {
      sec_uid: 'sec-1',
      number: 1,
      typeMode: 'strict'
    })
  })

  it('previews live details through the guarded API wrapper', async () => {
    getDouyinIdMock.mockResolvedValue({ type: 'user_dynamic', sec_uid: 'sec-1' })
    douyinDataMock.mockResolvedValue({
      data: {
        user: {
          nickname: 'author',
          live_status: 1,
          room_id_str: 'room-1',
          room_data: JSON.stringify({ owner: { web_rid: 'web-1' } })
        }
      }
    })
    const liveData = { data: { data: [{ title: 'Live', cover: { url_list: ['cover'] } }] } }
    guardedDouyinDataMock.mockResolvedValue(liveData)
    renderMock.mockResolvedValue('image')

    const result = await new DouyinPushPreview({} as never).renderLive('https://douyin.test/user')

    expect(result).toEqual({ ok: true, image: 'image' })
    expect(guardedDouyinDataMock).toHaveBeenCalledWith('直播间信息数据', {
      room_id: 'room-1',
      web_rid: 'web-1',
      typeMode: 'strict'
    })
  })

  it('does not cache a work when rendering returns false', async () => {
    renderMock.mockResolvedValue(false)
    getDouyinIdMock.mockResolvedValue({ type: 'one_work', is_mp4: true })

    const pushItem = {
      create_time: 0,
      avatar_img: '',
      living: false,
      remark: 'author',
      sec_uid: 'sec-1',
      targets: [{ groupId: 'group-1', botId: 'bot-1' }],
      Detail_Data: {
        aweme_id: 'work-1',
        share_url: 'https://douyin.test/work-1',
        desc: 'work',
        create_time: 1,
        author: { nickname: 'author' },
        video: { play_addr: { uri: 'video-1' } },
        statistics: { digg_count: 1, comment_count: 2, collect_count: 3 },
        user_info: {
          data: {
            user: {
              avatar_larger: { uri: 'avatar' },
              nickname: 'author',
              unique_id: 'author',
              short_id: 'author',
              follower_count: 10,
              total_favorited: 11,
              following_count: 12
            }
          }
        }
      }
    }

    globalThis.Bot = {
      'bot-1': {
        pickGroup: vi.fn(() => ({ sendMsg: vi.fn() }))
      }
    } as unknown as typeof Bot

    const result = await new DouYinpush({ group_id: 'group-1' }).getdata({ 'work-1': pushItem })

    expect(result).toBe(true)
    expect(addAwemeCacheMock).not.toHaveBeenCalled()
  })
})

/**
 * url_list[2] 是 www.douyin.com/aweme/v1/play 的包装 URL，会按抖音负载均衡 302 到任意 CDN，
 * 部分 CDN 返回非 MP4 乱码字节，下下来的文件放不出来。旧实现取的正是 [2]，还额外用
 * getLongLink 主动跟随那个 302 —— 等于把「落到坏 CDN」的概率全吃下来。
 * 上游的修法是直接用 url_list[0] 的签名直链绕开这层跳转。
 */
describe('pickDouyinPlayUrl 绕开 aweme/v1/play 包装地址', () => {
  const wrapped = 'https://www.douyin.com/aweme/v1/play/?video_id=v1&ratio=1080p'

  it('优先取 url_list[0] 的签名直链，而不是包装地址', () => {
    expect(pickDouyinPlayUrl({
      url_list: ['https://v3-web.douyinvod.com/signed.mp4', 'https://v26-web.douyinvod.com/backup.mp4', wrapped]
    })).toBe('https://v3-web.douyinvod.com/signed.mp4')
  })

  it('[0] 缺失时退到 [1]，仍然不碰包装地址', () => {
    expect(pickDouyinPlayUrl({
      url_list: ['', 'https://v26-web.douyinvod.com/backup.mp4', wrapped]
    })).toBe('https://v26-web.douyinvod.com/backup.mp4')
  })

  it('只有包装地址时才退回它，保证不比修复前更差', () => {
    expect(pickDouyinPlayUrl({ url_list: ['', '', wrapped] })).toBe(wrapped)
  })

  it('play_addr 缺失或没有候选时返回空串而不是抛错', () => {
    // 关掉 autoResolution 时读的是 play_addr_h264，部分作品没有这个变体
    expect(pickDouyinPlayUrl(undefined)).toBe('')
    expect(pickDouyinPlayUrl({ url_list: [] })).toBe('')
  })
})

/**
 * 账号注销后主页接口照样有响应，但作品/直播列表恒空。上游在拿到 special_state 后就 continue，
 * 本仓库原来没拦：每一轮推送都会为这个 sec_uid 白打一遍作品列表接口、白吃一次风控额度。
 */
describe('抖音推送跳过已注销账号', () => {
  const deletedProfile = {
    data: {
      user: {
        nickname: '已注销用户',
        avatar_larger: { uri: 'avatar' },
        special_state_info: { special_state: 1, title: '该账号已注销' },
        user_deleted: true
      }
    }
  }

  const liveProfile = {
    data: {
      user: {
        nickname: '正常用户',
        avatar_larger: { uri: 'avatar' }
      }
    }
  }

  const userList = [{
    sec_uid: 'sec-deleted',
    remark: 'gone',
    group_id: ['group-1:bot-1'],
    pushTypes: ['post'],
    switch: true
  }] as never

  it('账号已注销时不再去拉作品列表', async () => {
    douyinDataMock.mockResolvedValue(deletedProfile)

    const result = await new DouYinpush({ group_id: 'group-1' }).getDynamicList(userList)

    expect(result).toEqual({})
    // 只应该有那一次「用户主页数据」，不该再有作品列表请求
    expect(douyinDataMock).toHaveBeenCalledTimes(1)
    expect(guardedDouyinDataMock).not.toHaveBeenCalled()
  })

  it('special_state 为 1 但账号未删除时照常推送', async () => {
    // 两个条件是「与」关系：只有 special_state 不足以判定注销（私密账号等也会带状态）
    douyinDataMock.mockResolvedValue({
      data: {
        user: {
          ...liveProfile.data.user,
          special_state_info: { special_state: 1, title: '私密账号' },
          user_deleted: false
        }
      }
    })
    guardedDouyinDataMock.mockResolvedValue({ data: { aweme_list: [] } })

    await new DouYinpush({ group_id: 'group-1' }).getDynamicList(userList)

    expect(guardedDouyinDataMock).toHaveBeenCalled()
  })

  it('正常账号不受影响', async () => {
    douyinDataMock.mockResolvedValue(liveProfile)
    guardedDouyinDataMock.mockResolvedValue({ data: { aweme_list: [] } })

    await new DouYinpush({ group_id: 'group-1' }).getDynamicList(userList)

    expect(guardedDouyinDataMock).toHaveBeenCalled()
  })
})
