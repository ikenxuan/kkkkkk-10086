import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 抖音图文作品的三条支线互不牵连。
 *
 * 图集/合辑/实况图那一整段原来是 fan-out 之前的裸 await，而它同时是整条解析里最慢的
 * 一步（N 张图下载 + ffmpeg 逐张转实况图）：封面卡和评论卡全程被它堵着，它一抛
 * 那两张卡也一起没了。这份用例钉的就是「各自进行、各自发送、谁挂了都不带走别人」。
 *
 * 视频那条支线的对应用例在 `douyin-one-work-media-tasks.test.ts`，那份的
 * `isDouyinVideo` 恒为 true，所以图文这条走不到，只能另开一份替身。
 */

const mocks = vi.hoisted(() => ({
  douyinComments: vi.fn(),
  downloadFile: vi.fn(),
  downloadVideo: vi.fn(),
  parseWork: vi.fn(),
  fetchWorkComments: vi.fn(),
  fetchEmojiList: vi.fn(),
  fetchUserProfile: vi.fn(),
  loggerError: vi.fn(),
  makeForwardMsg: vi.fn(),
  processImageUrl: vi.fn(),
  render: vi.fn(),
  uploadRecord: vi.fn(),
  isDouyinArticle: vi.fn(() => false),
  isDouyinVideo: vi.fn(() => false),
  buildLivePhotoMessagesBatch: vi.fn(),
  config: {
    getConfig: vi.fn(),
    app: { parseTip: false, removeCache: true },
    cookies: { douyin: '' },
    douyin: {
      autoResolution: false,
      commentImageCollection: false,
      displayContent: ['cover'],
      // 图集没有新键，`hasDouyinContent('图集')` 只读这个旧数组
      douyinTip: ['图集', '背景音乐'] as string[],
      liveImageMergeMode: 'independent',
      numcomment: 1,
      realCommentCount: false,
      sendContent: ['info', 'comment'] as string[],
      sendHDrecord: true,
      videoInfoMode: 'text'
    },
    upload: { filelimit: 100 }
  }
}))

vi.mock('../../src/module/utils/index.js', async () => {
  const { sanitizeFilename, sanitizeFilenameSegment } = await import('../../src/module/utils/filename.js')

  class Base {
    e: Record<string, unknown>
    headers: Record<string, string> = {}
    amagi = {
      douyin: {
        parseWork: mocks.parseWork,
        fetchWorkComments: mocks.fetchWorkComments,
        fetchEmojiList: mocks.fetchEmojiList,
        fetchUserProfile: mocks.fetchUserProfile
      }
    }

    constructor (event: Record<string, unknown>) {
      this.e = event
    }
  }

  return {
    sanitizeFilename,
    sanitizeFilenameSegment,
    Base,
    Common: {
      count: (value: unknown) => String(value ?? 0),
      convertTimestampToDateTime: () => '2026-08-18 12:00:00',
      mkdir: vi.fn(),
      removeFile: vi.fn(async () => undefined),
      tempDri: { images: '', video: 'tmp/' }
    },
    Config: mocks.config,
    Networks: class {},
    Render: mocks.render,
    UploadRecord: mocks.uploadRecord,
    baseHeaders: {},
    downloadFile: mocks.downloadFile,
    downloadVideo: mocks.downloadVideo,
    processImageUrl: mocks.processImageUrl,
    uploadFile: vi.fn()
  }
})

vi.mock('../../src/module/utils/amagiClient.js', () => ({
  douyinFetcher: new Proxy({}, { get: () => vi.fn() }),
  douyinGuest: vi.fn(() => undefined),
  buildAmagiRequestConfig: vi.fn(() => ({}))
}))

vi.mock('../../src/module/platform/douyin/danmaku.js', () => ({
  burnDouyinDanmaku: vi.fn()
}))

vi.mock('../../src/module/platform/common/danmaku.js', () => ({
  burnDanmaku: vi.fn()
}))

vi.mock('../../src/module/platform/common/livePhoto.js', () => ({
  buildLivePhotoMessages: vi.fn(),
  buildLivePhotoMessagesBatch: mocks.buildLivePhotoMessagesBatch,
  buildLivePhotoTipMessage: vi.fn()
}))

vi.mock('../../src/module/platform/douyin/index.js', () => ({
  douyinComments: mocks.douyinComments
}))

// 限时表情补充包会真下 1.9MB zip，单测里连接口都不该碰：表情表原样透传
vi.mock('../../src/module/platform/douyin/emojiRes.js', () => ({
  mergeDouyinEmojiList: <T> (base: readonly T[]): T[] => [...base],
  syncDouyinEmojiResourceOnce: vi.fn(async () => null)
}))

vi.mock('../../src/module/platform/douyin/workType.js', () => ({
  getDouyinLiveVideoUrl: vi.fn(() => 'https://example.com/live.mp4'),
  getDouyinWorkCoverUrl: vi.fn(() => 'https://example.com/cover.jpg'),
  isDouyinArticle: mocks.isDouyinArticle,
  isDouyinVideo: mocks.isDouyinVideo,
  normalizeArticleImages: vi.fn(() => []),
  parseJsonSafely: vi.fn(() => ({}))
}))

vi.mock('../../src/runtime/host/common.js', () => ({
  default: { makeForwardMsg: mocks.makeForwardMsg }
}))

vi.mock('@karinjs/md-html', () => ({
  markdown: vi.fn((value: string) => value)
}))

import { DouYin } from '../../src/module/platform/douyin/douyin.js'

/** 三张静态图的图集（`clip_type: 2` = 非实况图） */
const imageWorkResponse = {
  data: {
    aweme_detail: {
      author: {
        avatar_thumb: { url_list: ['https://example.com/avatar.jpg'] },
        nickname: 'tester',
        sec_uid: 'sec-1'
      },
      aweme_id: 'work-img',
      create_time: 1_700_000_000,
      desc: 'image description',
      is_slides: false,
      preview_title: 'image title',
      region: 'CN',
      share_url: 'https://www.douyin.com/note/work-img',
      statistics: { collect_count: 1, comment_count: 2, digg_count: 3, share_count: 4 },
      images: [
        { clip_type: 2, url_list: ['https://example.com/1a.jpg', 'https://example.com/1b.jpg', 'https://example.com/1c.jpg'] },
        { clip_type: 2, url_list: ['https://example.com/2a.jpg', 'https://example.com/2b.jpg', 'https://example.com/2c.jpg'] },
        { clip_type: 2, url_list: ['https://example.com/3a.jpg', 'https://example.com/3b.jpg', 'https://example.com/3c.jpg'] }
      ],
      music: { play_url: { uri: 'https://example.com/bgm.mp3' } },
      video: { cover: { url_list: ['https://example.com/cover.jpg'] } }
    }
  }
}

const emojiResponse = {
  data: {
    emoji_list: [{ display_name: '[笑哭]', emoji_url: { url_list: ['https://example.com/laugh.png'] } }]
  }
}

/** 跑一遍 one_work，回传每条 reply 的内容序列 */
const parseImageWork = async (): Promise<unknown[]> => {
  const replies: unknown[] = []
  const reply = vi.fn(async (message: unknown) => { replies.push(message) })
  const parser = new DouYin({ reply, bot: {} }, { type: 'one_work', aweme_id: 'work-img', is_mp4: false })

  await expect(parser.RESOURCES({ type: 'one_work', aweme_id: 'work-img', is_mp4: false })).resolves.toBe(true)
  return replies
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('logger', {
    debug: vi.fn(),
    error: mocks.loggerError,
    info: vi.fn(),
    mark: vi.fn(),
    warn: vi.fn(),
    green: (value: unknown) => String(value),
    yellow: (value: unknown) => String(value)
  })
  vi.stubGlobal('segment', {
    image: vi.fn((url: string) => ({ type: 'image', url }))
  })

  mocks.config.douyin.douyinTip = ['图集', '背景音乐']
  mocks.config.douyin.sendContent = ['info', 'comment']
  mocks.config.getConfig.mockReturnValue({ sendContent: mocks.config.douyin.sendContent })
  mocks.isDouyinArticle.mockReturnValue(false)
  mocks.isDouyinVideo.mockReturnValue(false)
  mocks.parseWork.mockResolvedValue(imageWorkResponse)
  mocks.fetchWorkComments.mockResolvedValue({ data: { comments: [] } })
  mocks.fetchEmojiList.mockResolvedValue(emojiResponse)
  mocks.fetchUserProfile.mockResolvedValue({ data: { user: { nickname: 'tester' } } })
  mocks.buildLivePhotoMessagesBatch.mockResolvedValue({ results: [], tempFiles: [], generatedLivePhoto: false })
  mocks.downloadFile.mockResolvedValue({ filepath: 'tmp/bgm.mp3' })
  mocks.processImageUrl.mockImplementation(async (url: string) => `processed:${url}`)
  mocks.makeForwardMsg.mockResolvedValue({ type: 'forward', label: '图集' })
  mocks.render.mockResolvedValue('rendered-comment')
  mocks.uploadRecord.mockResolvedValue({ type: 'record' })
  mocks.douyinComments.mockResolvedValue({
    CommentsData: [{ id: 1, nickname: 'commenter', text: { nodes: [] }, create_time: 1_700_000_000, digg_count: 3, ip_label: '未知', userimageurl: '' }],
    image_url: []
  })
})

describe('抖音图文作品的三条支线各自进行', () => {
  /**
   * 图集支线卡住时，封面卡和评论卡必须已经发出去了。
   *
   * 串行实现会永久卡在图集上（它排在最前面），所以那两张卡一条也不会出现，
   * 由 `waitFor` 的超时把它报成具名失败。
   */
  it('图集还卡在合并转发上，封面卡和评论卡已经发完', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>(resolve => { release = resolve })
    mocks.makeForwardMsg.mockImplementation(async () => {
      await gate
      return { type: 'forward' }
    })

    const replies: unknown[] = []
    const reply = vi.fn(async (message: unknown) => { replies.push(message) })
    const parser = new DouYin({ reply, bot: {} }, { type: 'one_work', aweme_id: 'work-img', is_mp4: false })
    const execution = parser.RESOURCES({ type: 'one_work', aweme_id: 'work-img', is_mp4: false })

    try {
      await vi.waitFor(() => {
        expect(mocks.render).toHaveBeenCalledWith('douyin/comment', expect.anything())
        expect(replies).toContain('rendered-comment')
      })
      // 封面走 videoInfoMode: 'text'，回的是一条 segment.image 数组
      expect(mocks.processImageUrl).toHaveBeenCalledWith(
        'https://example.com/1a.jpg',
        expect.anything(),
        0,
        expect.anything()
      )
    } finally {
      release()
    }

    await expect(execution).resolves.toBe(true)
  })

  it('图集发送失败时封面卡和评论卡照发，日志记在 image 支线上', async () => {
    const imageError = new Error('合并转发失败')
    mocks.makeForwardMsg.mockRejectedValue(imageError)

    const replies = await parseImageWork()

    expect(replies).toContain('rendered-comment')
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.stringContaining('[抖音] 图集/合辑/实况图与背景音乐发送任务失败'),
      imageError
    )
  })

  it('评论图失败时图集和封面照发', async () => {
    const commentError = new Error('评论图渲染失败')
    mocks.render.mockRejectedValue(commentError)

    const replies = await parseImageWork()

    expect(replies).toContainEqual({ type: 'forward', label: '图集' })
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.stringContaining('[抖音] 评论图渲染与发送任务失败'),
      commentError
    )
  })

  it('封面失败时图集和评论照发', async () => {
    const posterError = new Error('封面处理失败')
    // 封面那一跳取的是第一张图的 url_list[0]；图集循环取的是 [2]，两边不会互相误伤
    mocks.processImageUrl.mockImplementation(async (url: string) => {
      if (url === 'https://example.com/1a.jpg') throw posterError
      return `processed:${url}`
    })

    const replies = await parseImageWork()

    expect(replies).toContainEqual({ type: 'forward', label: '图集' })
    expect(replies).toContain('rendered-comment')
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.stringContaining('[抖音] 作品信息海报/回复任务失败'),
      posterError
    )
  })
})

describe('评论图上的图片数量与图集支线解耦', () => {
  /*
    先钉一条「全绿」：三条支线都跑完、一条失败日志都没有。
    没有它的话某条支线在收尾处静默抛掉（背景音乐那段就漏过一次：测试事件上没有 `bot`，
    `getUploadRecordEvent` 当场抛，整条 image 支线被记成失败而上面那些断言照样通过）。
  */
  it('三条支线全跑通，且没有任何支线被记成失败', async () => {
    const replies = await parseImageWork()

    expect(mocks.makeForwardMsg).toHaveBeenCalledTimes(1)
    expect(mocks.uploadRecord).toHaveBeenCalledTimes(1)
    expect(replies).toContain('rendered-comment')
    expect(mocks.loggerError).not.toHaveBeenCalledWith(
      expect.stringContaining('任务失败'),
      expect.anything()
    )
  })

  it('图片数量取 images 的长度', async () => {
    await parseImageWork()

    expect(mocks.render).toHaveBeenCalledWith('douyin/comment', expect.objectContaining({ ImageLength: 3 }))
  })

  /*
    这条钉的是搬支线时顺手修掉的老问题：`imagenum` 原来靠图集循环里的 `imagenum++`
    累出来，关掉「图集」开关那些自增压根不执行，评论卡上的图片数恒为 0。
  */
  it('关掉「图集」开关后图片数量照旧，只是不发图集', async () => {
    mocks.config.douyin.douyinTip = []

    const replies = await parseImageWork()

    expect(mocks.render).toHaveBeenCalledWith('douyin/comment', expect.objectContaining({ ImageLength: 3 }))
    expect(mocks.makeForwardMsg).not.toHaveBeenCalled()
    expect(replies).toContain('rendered-comment')
  })
})

/*
  这条支线的闸门是「图集 或 背景音乐」，两个开关各自在闭包内部再判一次 ——
  搬家前它们是两段独立的 if，只有这个组合能看出闸门有没有拼错。
*/
describe('图集与背景音乐两个开关各自生效', () => {
  it('只开背景音乐时支线照跑，发音乐但不发图集', async () => {
    mocks.config.douyin.douyinTip = ['背景音乐']

    await parseImageWork()

    expect(mocks.uploadRecord).toHaveBeenCalledTimes(1)
    expect(mocks.makeForwardMsg).not.toHaveBeenCalled()
  })

  it('只开图集时发图集但不发音乐', async () => {
    mocks.config.douyin.douyinTip = ['图集']

    await parseImageWork()

    expect(mocks.makeForwardMsg).toHaveBeenCalledTimes(1)
    expect(mocks.uploadRecord).not.toHaveBeenCalled()
  })

  it('两个都关时这条支线压根不启动，封面与评论照发', async () => {
    mocks.config.douyin.douyinTip = []

    const replies = await parseImageWork()

    expect(mocks.makeForwardMsg).not.toHaveBeenCalled()
    expect(mocks.uploadRecord).not.toHaveBeenCalled()
    expect(replies).toContain('rendered-comment')
  })
})
