/**
 * 抖音推送的去重与冷启动语义。
 *
 * 两块内容：
 * 1. 新订阅的冷启动 —— 喜欢/推荐列表没有时间窗，只靠 AwemeCaches 去重。判定「是不是新订阅」
 *    的 hasHistory 读的正是这张表，而「跳过旧作品」的标记也写这张表，所以快照必须在遍历
 *    作品之前一次取好，否则第一条跳过的标记会把后面的作品全变成「老订阅」而被推出去。
 * 2. 已推标记的时机 —— 发送失败时不能记成已推，否则这条作品永久丢失。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const douyinDataMock = vi.hoisted(() => vi.fn())
const guardedDouyinDataMock = vi.hoisted(() => vi.fn())
const renderMock = vi.hoisted(() => vi.fn())
const getDouyinIdMock = vi.hoisted(() => vi.fn())
const shouldFilterMock = vi.hoisted(() => vi.fn())
const configMock = vi.hoisted(() => ({
  app: {},
  cookies: { douyin: '' },
  douyin: { push: { shareType: 'video', parsedynamic: false } },
  pushlist: { douyin: [] },
  upload: { filelimit: 100 }
}))

/**
 * 一个有状态的 AwemeCaches 假实现。
 *
 * 真库里 hasHistory / isAwemePushed / addAwemeCache 操作的是同一张表，这个共享状态是
 * 冷启动那组用例能成立的前提 —— 换成三个互不相干的 vi.fn() 就永远测不出自污染。
 */
const cacheStore = vi.hoisted(() => new Set<string>())
const addAwemeCacheMock = vi.hoisted(() => vi.fn())
const hasHistoryMock = vi.hoisted(() => vi.fn())
const isAwemePushedMock = vi.hoisted(() => vi.fn())

vi.mock('../../src/module/utils/index.js', () => ({
  Base: class {
    e: unknown
    headers: Record<string, string> = {}
    amagi = { getDouyinData: douyinDataMock }

    constructor (event: unknown) {
      this.e = event
    }
  },
  baseHeaders: {},
  Networks: class {},
  Render: renderMock,
  Config: configMock,
  Common: {
    count: (value: unknown) => String(value ?? 0),
    convertTimestampToDateTime: () => 'now',
    tempDri: { images: '', video: '' },
    removeFile: vi.fn()
  },
  downloadFile: vi.fn(),
  downloadVideo: vi.fn(),
  processImageUrl: vi.fn(),
  Version: { BotName: 'TRSS-Yunzai', version: 'test', pluginName: 'kkkkkk-10086' }
}))

vi.mock('../../src/module/db/index.js', () => ({
  cleanOldDynamicCache: vi.fn(),
  douyinDB: {
    shouldFilter: shouldFilterMock,
    addAwemeCache: addAwemeCacheMock,
    hasHistory: hasHistoryMock,
    isAwemePushed: isAwemePushedMock,
    getLiveStatus: vi.fn(),
    updateLiveStatus: vi.fn(),
    syncConfigSubscriptions: vi.fn()
  }
}))

vi.mock('../../src/module/platform/douyin/index.js', () => ({
  getDouyinID: getDouyinIdMock,
  douyinProcessVideos: vi.fn()
}))

vi.mock('../../src/module/platform/douyin/getid.js', () => ({
  getDouyinID: getDouyinIdMock
}))

vi.mock('../../src/module/platform/douyin/api.js', () => ({
  getDouyinData: guardedDouyinDataMock
}))

vi.mock('../../src/module/platform/douyin/workType.js', () => ({
  getDouyinWorkCoverUrl: vi.fn(() => ''),
  isDouyinArticle: vi.fn(() => false),
  isDouyinImage: vi.fn(() => false),
  isDouyinVideo: vi.fn(() => true),
  normalizeArticleImages: vi.fn(() => []),
  parseJsonSafely: vi.fn(() => ({}))
}))

vi.mock('../../src/module/platform/common/livePhoto.js', () => ({
  buildLivePhotoMessages: vi.fn(),
  buildLivePhotoTipMessage: vi.fn()
}))

vi.mock('../../src/runtime/host/common.js', () => ({
  default: { makeForwardMsg: vi.fn() }
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

const { DouYinpush } = await import('../../src/module/platform/douyin/push.js')

/** 缓存键与真库的唯一索引对齐 */
const cacheKey = (awemeId: string, secUid: string, groupId: string, pushType: string): string =>
  `${awemeId}|${secUid}|${groupId}|${pushType}`

const userProfile = {
  data: {
    user: {
      sec_uid: 'sec-1',
      nickname: '博主',
      unique_id: 'douyin-id',
      short_id: '123',
      avatar_larger: { uri: 'avatar', url_list: ['https://example.com/a.jpg'] },
      follower_count: 1,
      total_favorited: 2,
      following_count: 3,
      live_status: 0
    }
  }
}

/** 造一条作品，create_time 单位为秒 */
const aweme = (awemeId: string, createTime = Math.floor(Date.now() / 1000)) => ({
  aweme_id: awemeId,
  create_time: createTime,
  author: { sec_uid: 'sec-1', nickname: '博主' },
  share_url: `https://www.douyin.com/video/${awemeId}`,
  desc: '作品',
  statistics: { digg_count: 1, comment_count: 2, share_count: 3, collect_count: 4 },
  video: { play_addr: { uri: 'v' }, play_addr_h264: { url_list: ['u'] }, bit_rate: [] }
})

const subscription = (pushTypes: string[]) => ({
  switch: true,
  sec_uid: 'sec-1',
  short_id: '123',
  remark: '博主',
  group_id: ['999:bot-1'],
  pushTypes
})

beforeEach(() => {
  // 顶层只重置 config 的话，「有没有调过某个 mock」的断言会读到上一个用例的调用记录
  vi.clearAllMocks()
  cacheStore.clear()
  configMock.douyin.push.parsedynamic = false

  // 三个 mock 共享 cacheStore，模拟真库的同一张表
  addAwemeCacheMock.mockImplementation(async (awemeId: string, secUid: string, groupId: string, pushType = 'post') => {
    cacheStore.add(cacheKey(awemeId, secUid, groupId, pushType))
  })
  isAwemePushedMock.mockImplementation(async (awemeId: string, secUid: string, groupId: string, pushType = 'post') =>
    cacheStore.has(cacheKey(awemeId, secUid, groupId, pushType))
  )
  hasHistoryMock.mockImplementation(async (secUid: string, groupId: string, pushType = 'post') =>
    [...cacheStore].some(key => {
      const [, keySecUid, keyGroupId, keyPushType] = key.split('|')
      return keySecUid === secUid && keyGroupId === groupId && keyPushType === pushType
    })
  )

  shouldFilterMock.mockResolvedValue(false)
  renderMock.mockResolvedValue([{ type: 'image' }])
  getDouyinIdMock.mockResolvedValue({ type: 'one_work', is_mp4: true })
  douyinDataMock.mockResolvedValue(userProfile)
  guardedDouyinDataMock.mockResolvedValue({ data: { aweme_list: [] } })
})

describe('抖音喜欢/推荐列表的新订阅冷启动', () => {
  /** 15 条历史作品，模拟刚订阅时接口给的一整页 */
  const historyList = Array.from({ length: 15 }, (_, index) => aweme(`old-${index}`))

  for (const pushType of ['favorite', 'recommend'] as const) {
    it(`${pushType}：新订阅只推最新一条，其余历史作品全部标记为已读`, async () => {
      guardedDouyinDataMock.mockResolvedValue({ data: { aweme_list: historyList } })

      const result = await new DouYinpush().getDynamicList([subscription([pushType])] as never)

      // 只有 index 0 被列入推送
      expect(Object.keys(result)).toEqual([`${pushType}_old-0`])
      // 其余 14 条在库里被标记为已读，不会在后续轮次再冒出来
      for (let index = 1; index < historyList.length; index++) {
        expect(cacheStore.has(cacheKey(`old-${index}`, 'sec-1', '999', pushType))).toBe(true)
      }
      expect(cacheStore.has(cacheKey('old-0', 'sec-1', '999', pushType))).toBe(false)
    })
  }

  it('老订阅（库里已有历史）时列表里未推过的作品都要推', async () => {
    // 预置一条历史，代表这个群早就订阅过
    cacheStore.add(cacheKey('already-pushed', 'sec-1', '999', 'favorite'))
    guardedDouyinDataMock.mockResolvedValue({
      data: { aweme_list: [aweme('new-a'), aweme('new-b'), aweme('new-c')] }
    })

    const result = await new DouYinpush().getDynamicList([subscription(['favorite'])] as never)

    expect(Object.keys(result).sort()).toEqual(['favorite_new-a', 'favorite_new-b', 'favorite_new-c'])
  })

  it('已推过的作品不会再次列入推送', async () => {
    cacheStore.add(cacheKey('seen', 'sec-1', '999', 'favorite'))
    guardedDouyinDataMock.mockResolvedValue({ data: { aweme_list: [aweme('seen')] } })

    const result = await new DouYinpush().getDynamicList([subscription(['favorite'])] as never)

    expect(result).toEqual({})
  })

  it('作品列表（post）走 24 小时时间窗，不受冷启动快照影响', async () => {
    const stale = aweme('stale', Math.floor(Date.now() / 1000) - 90000)
    guardedDouyinDataMock.mockResolvedValue({ data: { aweme_list: [aweme('fresh'), stale] } })

    const result = await new DouYinpush().getDynamicList([subscription(['post'])] as never)

    expect(Object.keys(result)).toEqual(['post_fresh'])
  })
})

describe('抖音推送的已推标记时机', () => {
  /** 一条已经过完 getDynamicList、可以直接交给 getdata 的推送项 */
  const workPushItem = () => ({
    remark: '博主',
    sec_uid: 'sec-1',
    create_time: Date.now(),
    targets: [{ groupId: '999', botId: 'bot-1' }],
    pushType: 'post' as const,
    avatar_img: 'avatar',
    living: false,
    Detail_Data: {
      aweme_id: 'work-1',
      share_url: 'https://www.douyin.com/video/work-1',
      desc: '作品',
      author: { nickname: '博主' },
      statistics: { digg_count: 1, comment_count: 2, share_count: 3, collect_count: 4 },
      video: { play_addr: { uri: 'v' }, play_addr_h264: { url_list: ['u'] }, bit_rate: [] },
      user_info: userProfile
    }
  })

  let sendMsgMock: ReturnType<typeof vi.fn>

  const installBot = (): void => {
    globalThis.Bot = {
      'bot-1': { pickGroup: vi.fn(() => ({ sendMsg: sendMsgMock })) }
    } as unknown as typeof Bot
  }

  beforeEach(() => {
    sendMsgMock = vi.fn().mockResolvedValue({ message_id: 'msg-1' })
  })

  it('卡片发送成功后才写入已推标记', async () => {
    installBot()

    expect(await new DouYinpush().getdata({ 'post_work-1': workPushItem() } as never)).toBe(true)

    expect(sendMsgMock).toHaveBeenCalledTimes(1)
    expect(addAwemeCacheMock).toHaveBeenCalledExactlyOnceWith('work-1', 'sec-1', '999', 'post')
  })

  it('发送抛错时不写已推标记，留给下一轮重试', async () => {
    sendMsgMock = vi.fn().mockRejectedValue(new Error('风控：消息发送失败'))
    installBot()

    expect(await new DouYinpush().getdata({ 'post_work-1': workPushItem() } as never)).toBe(true)

    expect(sendMsgMock).toHaveBeenCalledTimes(1)
    expect(addAwemeCacheMock).not.toHaveBeenCalled()
  })

  it('bot 或群不存在时照旧写已推标记，避免 bot 上线后补推一堆历史作品', async () => {
    globalThis.Bot = {} as unknown as typeof Bot

    expect(await new DouYinpush().getdata({ 'post_work-1': workPushItem() } as never)).toBe(true)

    expect(addAwemeCacheMock).toHaveBeenCalledExactlyOnceWith('work-1', 'sec-1', '999', 'post')
  })

  it('被过滤规则跳过的作品直接记成已推，不再反复评估', async () => {
    shouldFilterMock.mockResolvedValue(true)
    installBot()

    expect(await new DouYinpush().getdata({ 'post_work-1': workPushItem() } as never)).toBe(true)

    expect(sendMsgMock).not.toHaveBeenCalled()
    expect(addAwemeCacheMock).toHaveBeenCalledExactlyOnceWith('work-1', 'sec-1', '999', 'post')
  })
})
