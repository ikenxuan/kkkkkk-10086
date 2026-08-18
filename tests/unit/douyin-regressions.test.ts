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

const { DouYin } = await import('../../src/module/platform/douyin/douyin.js')
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
    const result = await parser.RESOURCES({ type: 'one_work', aweme_id: 'work-1' })

    expect(reply).toHaveBeenCalledWith('检测到抖音链接，开始解析')
    expect(result).toBe(false)
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
    expect(renderMock).toHaveBeenCalledWith('douyin/live', expect.objectContaining({
      image_url: [{ image_src: 'cover' }],
      text: 'Live title',
      liveinf: 'Games | 房间号: room-1'
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
