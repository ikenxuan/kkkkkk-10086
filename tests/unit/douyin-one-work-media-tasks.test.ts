import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  burnDouyinDanmaku: vi.fn(),
  legacyBurnDanmaku: vi.fn(),
  douyinComments: vi.fn(),
  downloadFile: vi.fn(),
  downloadVideo: vi.fn(),
  parseWork: vi.fn(),
  fetchWorkComments: vi.fn(),
  fetchDanmakuList: vi.fn(),
  fetchEmojiList: vi.fn(),
  loggerError: vi.fn(),
  processImageUrl: vi.fn(),
  render: vi.fn(),
  uploadFile: vi.fn(),
  config: {
    getConfig: vi.fn(() => ({ sendContent: ['info', 'comment', 'video'] })),
    app: {
      parseTip: false,
      removeCache: true,
      groupfilevalue: 100
    },
    cookies: { douyin: '' },
    douyin: {
      autoResolution: false,
      burnDanmaku: true,
      commentImageCollection: false,
      danmakuArea: 0.5,
      danmakuFontSize: 'medium',
      danmakuOpacity: 100,
      displayContent: ['cover'],
      douyinTip: [] as string[],
      numcomments: 1,
      realCommentCount: false,
      sendContent: ['info', 'comment', 'video'],
      sendHDrecord: true,
      videoCodec: 'h264',
      videoInfoMode: 'text',
      verticalMode: 'off'
    },
    upload: { filelimit: 100 }
  }
}))

// 工厂是 async 的、并且引真实的 filename.js：它零依赖纯函数，塞个假的反而会和
// 真实清洗行为漂移（那套清洗是安全边界，见 utils/filename.ts 的说明）。
vi.mock('../../src/module/utils/index.js', async () => {
  const { sanitizeFilename, sanitizeFilenameSegment } = await import('../../src/module/utils/filename.js')

  class Base {
    e: Record<string, unknown>
    headers: Record<string, string> = {}
    amagi = {
      douyin: {
        parseWork: mocks.parseWork,
        fetchWorkComments: mocks.fetchWorkComments,
        fetchDanmakuList: mocks.fetchDanmakuList,
        fetchEmojiList: mocks.fetchEmojiList
      }
    }

    constructor (event: Record<string, unknown>) {
      this.e = event
    }
  }

  class Networks {
    async getLongLink (): Promise<string> {
      return 'https://example.com/video.mp4'
    }
  }

  return {
    sanitizeFilename,
    sanitizeFilenameSegment,
    Base,
    Common: {
      count: (value: unknown) => String(value ?? 0),
      convertTimestampToDateTime: () => '2026-08-18 12:00:00',
      getVideoFileSize: vi.fn(async () => 1),
      removeFile: vi.fn(async () => undefined),
      tempDri: { images: '', video: 'tmp/' }
    },
    Config: mocks.config,
    Networks,
    Render: mocks.render,
    UploadRecord: vi.fn(),
    baseHeaders: {},
    downloadFile: mocks.downloadFile,
    downloadVideo: mocks.downloadVideo,
    processImageUrl: mocks.processImageUrl,
    uploadFile: mocks.uploadFile
  }
})

// douyin.ts 只从这里取 buildAmagiRequestConfig，fetcher 走的是 Base 上的 amagi
vi.mock('../../src/module/utils/amagiClient.js', () => ({
  douyinFetcher: new Proxy({}, { get: () => vi.fn() }),
  buildAmagiRequestConfig: vi.fn(() => ({}))
}))

vi.mock('../../src/module/platform/douyin/danmaku.js', () => ({
  burnDouyinDanmaku: mocks.burnDouyinDanmaku
}))

vi.mock('../../src/module/platform/common/danmaku.js', () => ({
  burnDanmaku: mocks.legacyBurnDanmaku
}))

vi.mock('../../src/module/platform/common/livePhoto.js', () => ({
  buildLivePhotoMessages: vi.fn(),
  // 批量入口的默认返回：results 为空 => 每张图都走普通图片回退分支。
  buildLivePhotoMessagesBatch: vi.fn(async () => ({ results: [], tempFiles: [], generatedLivePhoto: false })),
  buildLivePhotoTipMessage: vi.fn()
}))

vi.mock('../../src/module/platform/douyin/index.js', () => ({
  douyinComments: mocks.douyinComments
}))

vi.mock('../../src/module/platform/douyin/workType.js', () => ({
  getDouyinWorkCoverUrl: vi.fn(() => 'https://example.com/cover.jpg'),
  isDouyinArticle: vi.fn(() => false),
  isDouyinVideo: vi.fn(() => true),
  normalizeArticleImages: vi.fn(() => []),
  parseJsonSafely: vi.fn(() => ({}))
}))

vi.mock('../../src/runtime/host/common.js', () => ({
  default: { makeForwardMsg: vi.fn() }
}))

vi.mock('@karinjs/md-html', () => ({
  markdown: vi.fn((value: string) => value)
}))

import { DouYin } from '../../src/module/platform/douyin/douyin.js'
import hostCommon from '../../src/runtime/host/common.js'

const workResponse = {
  data: {
    aweme_detail: {
      author: {
        avatar_larger: { url_list: ['https://example.com/avatar.jpg'] },
        avatar_thumb: { url_list: ['https://example.com/avatar.jpg'] },
        nickname: 'tester',
        sec_uid: 'sec-1',
        short_id: 'tester'
      },
      aweme_id: 'work-1',
      create_time: 1_700_000_000,
      desc: 'video description',
      preview_title: 'video title',
      region: 'CN',
      share_url: 'https://www.douyin.com/video/work-1',
      statistics: {
        collect_count: 1,
        comment_count: 2,
        digg_count: 3,
        share_count: 4
      },
      suggest_words: {
        suggest_words: [
          { scene: 'comment_top_rec', words: [{ word: '相关搜索一' }, { word: '相关搜索二' }] },
          { scene: 'search_bar_rec', words: [{ word: '不该出现在评论图里' }] }
        ]
      },
      video: {
        bit_rate: [{
          FPS: 60,
          format: 'mp4',
          play_addr: {
            data_size: 1024,
            height: 1920,
            url_list: ['https://example.com/video.mp4'],
            width: 1080
          }
        }],
        cover: { url_list: ['https://example.com/cover.jpg'] },
        duration: 10_000,
        height: 1920,
        play_addr: {
          data_size: 1024,
          uri: 'video-uri',
          url_list: ['https://example.com/video.mp4']
        },
        play_addr_h264: {
          data_size: 1024,
          uri: 'video-uri',
          url_list: [
            'https://example.com/video.mp4',
            'https://example.com/video.mp4',
            'https://example.com/video.mp4'
          ]
        },
        ratio: '1080p',
        width: 1080
      }
    }
  }
}

const emojiResponse = {
  data: {
    emoji_list: [{
      display_name: '[笑哭]',
      emoji_url: { url_list: ['https://example.com/laugh.png'] }
    }]
  }
}

const danmakuList = [{
  danmaku_id: 'dm-1',
  digg_count: 8,
  offset_time: 1000,
  text: '开场[笑哭]'
}]

describe('Douyin one_work media tasks', () => {
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

    mocks.config.getConfig.mockReturnValue({ sendContent: mocks.config.douyin.sendContent })
    mocks.config.douyin.sendContent = ['info', 'comment', 'video']
    mocks.config.douyin.commentImageCollection = false
    mocks.config.douyin.realCommentCount = false
    mocks.parseWork.mockResolvedValue(workResponse)
    mocks.fetchWorkComments.mockResolvedValue({ data: { comments: [] } })
    mocks.fetchDanmakuList.mockResolvedValue({ data: { danmaku_list: danmakuList } })
    mocks.fetchEmojiList.mockResolvedValue(emojiResponse)
    mocks.downloadFile.mockResolvedValue({ filepath: 'tmp/input.mp4' })
    mocks.downloadVideo.mockResolvedValue(undefined)
    mocks.processImageUrl.mockResolvedValue('processed-cover')
    mocks.render.mockResolvedValue('rendered-comment')
    mocks.douyinComments.mockResolvedValue({
      CommentsData: [{ id: 1, nickname: 'commenter', text: { nodes: [] }, create_time: 1_700_000_000, digg_count: 3, ip_label: '未知', userimageurl: '' }],
      image_url: []
    })
    mocks.burnDouyinDanmaku.mockResolvedValue(false)
    mocks.legacyBurnDanmaku.mockResolvedValue(false)
  })

  it('shares one emoji lookup between danmaku burning and comment rendering, then falls back to the original video', async () => {
    const reply = vi.fn(async () => undefined)
    const parser = new DouYin({ reply }, { type: 'one_work', aweme_id: 'work-1', is_mp4: true }, { forceBurnDanmaku: true })

    await expect(parser.RESOURCES({ type: 'one_work', aweme_id: 'work-1', is_mp4: true })).resolves.toBe(true)

    expect(mocks.burnDouyinDanmaku).toHaveBeenCalledOnce()
    expect(mocks.legacyBurnDanmaku).not.toHaveBeenCalled()
    expect(mocks.downloadVideo).toHaveBeenCalledOnce()

    expect(mocks.fetchEmojiList).toHaveBeenCalledOnce()

    const burnOptions = mocks.burnDouyinDanmaku.mock.calls[0]?.[3] as { emojiList?: unknown }
    expect(burnOptions.emojiList).toEqual([
      { name: '[笑哭]', url: 'https://example.com/laugh.png' }
    ])
    expect(mocks.douyinComments.mock.calls[0]?.[1]).toBe(burnOptions.emojiList)
  })

  it('falls back to the original video when the danmaku burner throws', async () => {
    mocks.burnDouyinDanmaku.mockRejectedValueOnce(new Error('ffmpeg failed'))
    const parser = new DouYin(
      { reply: vi.fn(async () => undefined) },
      { type: 'one_work', aweme_id: 'work-1', is_mp4: true },
      { forceBurnDanmaku: true }
    )

    await expect(parser.RESOURCES({ type: 'one_work', aweme_id: 'work-1', is_mp4: true })).resolves.toBe(true)

    expect(mocks.downloadVideo).toHaveBeenCalledOnce()
  })

  it('falls back to the original video when uploading the burned result throws', async () => {
    mocks.burnDouyinDanmaku.mockResolvedValueOnce(true)
    mocks.uploadFile.mockRejectedValueOnce(new Error('upload failed'))
    const parser = new DouYin(
      { reply: vi.fn(async () => undefined) },
      { type: 'one_work', aweme_id: 'work-1', is_mp4: true },
      { forceBurnDanmaku: true }
    )

    await expect(parser.RESOURCES({ type: 'one_work', aweme_id: 'work-1', is_mp4: true })).resolves.toBe(true)

    expect(mocks.downloadVideo).toHaveBeenCalledOnce()
  })

  it('falls back to the original video when the temporary burn download throws', async () => {
    mocks.downloadFile.mockRejectedValueOnce(new Error('temporary download failed'))
    const parser = new DouYin(
      { reply: vi.fn(async () => undefined) },
      { type: 'one_work', aweme_id: 'work-1', is_mp4: true },
      { forceBurnDanmaku: true }
    )

    await expect(parser.RESOURCES({ type: 'one_work', aweme_id: 'work-1', is_mp4: true })).resolves.toBe(true)

    expect(mocks.downloadVideo).toHaveBeenCalledOnce()
  })

  /**
   * 回归：远程 preview 上 `douyin/comment` SSR 崩溃。
   *
   * 实测复刻旧 payload 定位到的崩溃点是**缺 `Statistics`**：`VideoInfoHeader` 直接读
   * `props.Statistics.digg_count`（Comment.tsx:147），拿 undefined 解属性当场抛，
   * 渲染器如实返回 success=false，整张评论图出不来。
   *
   * 顺带修掉的第二个毛病是 `CommentsData` 的 `{ jsonArray }` 包装：它不抛，
   * `undefined > 0` 走「暂无评论数据」分支，静默出一张空图 —— 比崩溃更难发现。
   *
   * 这条把契约里的必填字段全钉住，少传一个就红。
   */
  it('sends the douyin/comment template every field its contract requires', async () => {
    const parser = new DouYin(
      { reply: vi.fn(async () => undefined) },
      { type: 'one_work', aweme_id: 'work-1', is_mp4: true },
      {}
    )

    await expect(parser.RESOURCES({ type: 'one_work', aweme_id: 'work-1', is_mp4: true })).resolves.toBe(true)

    const commentCall = mocks.render.mock.calls.find(([route]) => route === 'douyin/comment')
    expect(commentCall).toBeDefined()
    const payload = commentCall![1] as Record<string, unknown>

    // 扁平数组，不是包装对象 —— 就是这一处让模板炸掉的
    expect(Array.isArray(payload.CommentsData)).toBe(true)
    expect(payload.CommentsData).toHaveLength(1)
    expect(payload).not.toHaveProperty('jsonArray')
    // 契约里没有 Title，旧实现却在传
    expect(payload).not.toHaveProperty('Title')

    expect(payload.Statistics).toEqual({
      digg_count: 3,
      comment_count: 2,
      share_count: 4,
      collect_count: 1
    })
    expect(payload.Region).toBe('CN')
    expect(payload.Author).toBe('tester')
    expect(payload.AuthorAvatar).toBe('https://example.com/avatar.jpg')
    expect(payload.CreateTime).toBe(1_700_000_000)
    expect(payload.Resolution).toBe('1080 x 1920')
    expect(payload.maxDepth).toBe(6)
    // 只收评论区顶部那一组，search_bar_rec 不该混进来
    expect(payload.suggestWrod).toEqual(['相关搜索一', '相关搜索二'])
  })

  it('forwards collected comment images before replying with the comment image', async () => {
    mocks.config.douyin.commentImageCollection = true
    mocks.douyinComments.mockResolvedValueOnce({
      CommentsData: [{ id: 1, nickname: 'commenter', text: { nodes: [] }, create_time: 1_700_000_000, digg_count: 3, ip_label: '未知', userimageurl: '' }],
      image_url: ['https://example.com/comment-image.jpg', 'base64://AAAA']
    })
    const parser = new DouYin(
      { reply: vi.fn(async () => undefined) },
      { type: 'one_work', aweme_id: 'work-1', is_mp4: true },
      {}
    )

    await expect(parser.RESOURCES({ type: 'one_work', aweme_id: 'work-1', is_mp4: true })).resolves.toBe(true)

    const forwarded = vi.mocked(hostCommon.makeForwardMsg).mock.calls
      .find(([, , title]) => title === '评论图片收集')
    expect(forwarded).toBeDefined()
    expect(forwarded![1]).toHaveLength(2)
  })

  /**
   * 回归：评论解析失败挡住视频发送。
   *
   * 「评论数据」的取数原来是 fan-out 之前的裸 await，narrowApiResponse 对接口挂掉、
   * 超时、返回非对象三种情况一律当场抛 —— 抛在 runMediaTasks 之前，
   * 于是 allSettled 的容错压根没机会生效，视频和海报跟着一起没了。
   *
   * 下面三条分别钉住：接口 reject、接口返回非对象、以及闸门关掉时压根不该发这个请求。
   */
  it('still sends the video when the comments API rejects', async () => {
    mocks.fetchWorkComments.mockRejectedValue(new Error('comments endpoint down'))
    const parser = new DouYin(
      { reply: vi.fn(async () => undefined) },
      { type: 'one_work', aweme_id: 'work-1', is_mp4: true },
      {}
    )

    await expect(parser.RESOURCES({ type: 'one_work', aweme_id: 'work-1', is_mp4: true })).resolves.toBe(true)

    // 视频支线照跑完
    expect(mocks.downloadVideo).toHaveBeenCalledOnce()
    // 评论图没渲染，但失败被记成「评论支线」而不是把整条解析带走
    expect(mocks.render.mock.calls.find(([route]) => route === 'douyin/comment')).toBeUndefined()
    expect(
      mocks.loggerError.mock.calls.some(([message]) => String(message).includes('评论图渲染与发送'))
    ).toBe(true)
  })

  it('still sends the video when the comments API returns a non-object', async () => {
    // narrowApiResponse 的 isRecord 判据落空 => 抛「评论数据返回格式异常」
    mocks.fetchWorkComments.mockResolvedValue(null)
    const parser = new DouYin(
      { reply: vi.fn(async () => undefined) },
      { type: 'one_work', aweme_id: 'work-1', is_mp4: true },
      {}
    )

    await expect(parser.RESOURCES({ type: 'one_work', aweme_id: 'work-1', is_mp4: true })).resolves.toBe(true)

    expect(mocks.downloadVideo).toHaveBeenCalledOnce()
    expect(mocks.douyinComments).not.toHaveBeenCalled()
  })

  it('never requests comments data when the comment gate is off', async () => {
    mocks.config.douyin.sendContent = ['info', 'video']
    mocks.config.getConfig.mockReturnValue({ sendContent: mocks.config.douyin.sendContent })
    const parser = new DouYin(
      { reply: vi.fn(async () => undefined) },
      { type: 'one_work', aweme_id: 'work-1', is_mp4: true },
      {}
    )

    await expect(parser.RESOURCES({ type: 'one_work', aweme_id: 'work-1', is_mp4: true })).resolves.toBe(true)

    // 用户把评论图关掉了，取数就该一次都不发（原来照发，还能炸掉整条解析）
    expect(mocks.fetchWorkComments).not.toHaveBeenCalled()
    expect(mocks.downloadVideo).toHaveBeenCalledOnce()
  })
})
