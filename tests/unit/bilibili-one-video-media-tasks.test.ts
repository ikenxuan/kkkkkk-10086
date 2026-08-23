import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
}

const mocks = vi.hoisted(() => ({
  events: [] as string[],
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  },
  render: vi.fn(),
  processImageUrl: vi.fn(),
  checkCk: vi.fn(),
  bilibiliComments: vi.fn(),
  config: {
    getConfig: vi.fn(),
    app: {
      parseTip: false
    },
    bilibili: {
      sendContent: ['info', 'comment', 'video'],
      bilibiliTip: [] as string[],
      displayContent: ['cover'],
      videoInfoMode: 'text',
      showDanmakuInVideoInfo: false,
      burnDanmaku: true,
      videopriority: true,
      bilibilinumcomments: 1,
      realCommentCount: false,
      videoQuality: 80,
      maxAutoVideoSize: 100
    },
    cookies: {
      bilibili: ''
    },
    upload: {
      usefilelimit: false,
      filelimit: 100
    }
  }
}))

// 工厂是 async 的、并且引真实的 filename.js：它零依赖纯函数，塞个假的反而会和
// 真实清洗行为漂移（那套清洗是安全边界，见 utils/filename.ts 的说明）。
vi.mock('../../src/module/utils/index.js', async () => {
  const { sanitizeFilename, sanitizeFilenameSegment } = await import('../../src/module/utils/filename.js')

  class Base {}

  return {
    sanitizeFilename,
    sanitizeFilenameSegment,
    Base,
    Render: mocks.render,
    Config: mocks.config,
    Networks: class {},
    mergeFile: vi.fn(),
    Common: {
      count: (value: unknown) => String(value ?? 0),
      convertTimestampToDateTime: () => '2026-08-17 12:00:00',
      getCurrentTime: () => '2026-08-17 12:00:00',
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
  bilibiliComments: mocks.bilibiliComments,
  checkCk: mocks.checkCk,
  genParams: vi.fn()
}))

vi.mock('../../src/module/platform/bilibili/dynamicText.js', () => ({
  formatBilibiliDynamicText: vi.fn(),
  formatBilibiliVideoDescText: vi.fn(),
  getHotBilibiliDanmaku: vi.fn(() => [])
}))

vi.mock('../../src/module/platform/bilibili/article.js', () => ({
  extractBilibiliArticleImages: vi.fn(),
  formatBilibiliArticleBody: vi.fn()
}))

vi.mock('../../src/module/platform/common/livePhoto.js', () => ({
  buildLivePhotoMessages: vi.fn(),
  buildLivePhotoTipMessage: vi.fn()
}))

vi.mock('../../src/module/platform/common/danmaku.js', () => ({
  burnDanmaku: vi.fn()
}))

vi.mock('../../src/runtime/host/common.js', () => ({
  default: {
    makeForwardMsg: vi.fn()
  }
}))

import { Bilibili } from '../../src/module/platform/bilibili/bilibili.js'

const createDeferred = <T>(): Deferred<T> => {
  let resolveDeferred!: Deferred<T>['resolve']
  const promise = new Promise<T>((resolve) => {
    resolveDeferred = resolve
  })
  return { promise, resolve: resolveDeferred }
}

const infoData = {
  data: {
    data: {
      aid: 123,
      bvid: 'BV1test',
      cid: 456,
      ctime: 1_700_000_000,
      duration: 120,
      pages: [{ cid: 456, duration: 120 }],
      owner: {
        mid: 789,
        name: 'tester',
        face: 'https://example.com/avatar.jpg'
      },
      pic: 'https://example.com/cover.jpg',
      title: 'parallel test',
      desc: 'description',
      stat: {
        coin: 1,
        like: 2,
        share: 3,
        view: 4,
        favorite: 5,
        danmaku: 6,
        reply: 7
      }
    }
  }
}

const playUrlData = {
  data: {
    accept_description: ['高清 1080P'],
    durl: [{ id: 80, url: 'https://example.com/video.mp4', size: 1024 * 1024 }]
  }
}

interface SubjectOptions {
  posterGate?: Deferred<void>
  videoGate?: Deferred<void>
  posterError?: Error
  videoError?: Error
}

const createSubject = (options: SubjectOptions = {}) => {
  const reply = vi.fn(async (message: unknown) => {
    const kind = (message as { kind?: string })?.kind
    if (kind === 'poster') {
      mocks.events.push('poster:start')
      if (options.posterError) throw options.posterError
      await options.posterGate?.promise
      mocks.events.push('poster:end')
      return
    }
    if (kind === 'comment') mocks.events.push('comment:reply')
  })

  const getBilibiliData = vi.fn(async (method: string) => {
    if (method === '单个视频作品数据') return infoData
    if (method === '单个视频下载信息数据') return playUrlData
    if (method === '评论数据') {
      mocks.events.push('comment:fetch')
      return { data: { replies: [{ rpid: 1 }] } }
    }
    throw new Error(`Unexpected Bilibili API method: ${method}`)
  })

  const fetchVideoDanmakuList = vi.fn(async () => {
    mocks.events.push('video:danmaku')
    return []
  })
  const getvideo = vi.fn(async () => {
    mocks.events.push('video:start')
    if (options.videoError) throw options.videoError
    await options.videoGate?.promise
    mocks.events.push('video:end')
  })

  const subject = Object.create(Bilibili.prototype) as Bilibili
  Object.assign(subject, {
    Type: 'one_video',
    e: { reply },
    amagi: { getBilibiliData },
    forceBurnDanmaku: true,
    islogin: false,
    downloadfilename: '',
    headers: {},
    mkMsg: (content: unknown) => ({
      kind: content === 'comment-image' ? 'comment' : 'poster'
    }),
    fetchVideoDanmakuList,
    getvideo
  })

  return {
    subject,
    reply,
    getBilibiliData,
    fetchVideoDanmakuList,
    getvideo
  }
}

describe('Bilibili one_video media tasks', () => {
  beforeEach(() => {
    mocks.events.length = 0
    vi.clearAllMocks()
    vi.stubGlobal('logger', mocks.logger)
    vi.stubGlobal('segment', {
      image: vi.fn((url: string) => ({ type: 'image', url }))
    })
    mocks.config.bilibili.sendContent = ['info', 'comment', 'video']
    mocks.config.bilibili.bilibilinumcomments = 1
    mocks.config.getConfig.mockReturnValue({
      sendContent: mocks.config.bilibili.sendContent
    })
    mocks.processImageUrl.mockResolvedValue('processed-cover')
    mocks.checkCk.mockResolvedValue({ Status: 'notLogin', isVIP: false })
    mocks.bilibiliComments.mockReturnValue([{ rpid: 1 }])
    mocks.render.mockImplementation(async (route: string) => {
      if (route === 'bilibili/comment') {
        mocks.events.push('comment:render')
        return 'comment-image'
      }
      throw new Error(`Unexpected render route: ${route}`)
    })
  })

  // 三条分支各自取数、渲染、发送，互不等待：谁先好谁先发，顺序不作保证。
  // 这条用例原来断言的是「评论图必须排在 video:end 之后」，那是评论块还串在
  // runMediaTasks 之后时的行为 —— 视频上传多久评论图就得等多久。现在评论图是
  // 独立分支，断言改成「海报和视频都还卡着的时候，评论图就已经开始取数了」。
  it('starts the information, video and comment branches concurrently', async () => {
    const posterGate = createDeferred<void>()
    const videoGate = createDeferred<void>()
    const { subject, getBilibiliData } = createSubject({ posterGate, videoGate })
    const execution = subject.RESOURCES({ type: 'one_video', bvid: 'BV1test', p: 1 })

    try {
      await vi.waitFor(() => expect(mocks.events).toContain('poster:start'))
      // 两条重分支都还没放闸，评论图不该被它们挡住
      await vi.waitFor(() => expect(mocks.events).toContain('comment:fetch'))
      expect(mocks.events).toEqual(expect.arrayContaining([
        'poster:start',
        'video:danmaku',
        'video:start',
        'comment:fetch'
      ]))
      expect(mocks.events).not.toContain('poster:end')
      expect(mocks.events).not.toContain('video:end')

      posterGate.resolve()
      videoGate.resolve()
      await expect(execution).resolves.not.toBe(false)
      expect(mocks.events).toContain('comment:reply')
      const commentCall = getBilibiliData.mock.calls.find(([method]) => method === '评论数据')
      expect(commentCall).toEqual([
        '评论数据',
        '',
        expect.objectContaining({
          oid: '123',
          type: 1,
          number: 1,
          typeMode: 'strict'
        })
      ])
    } finally {
      posterGate.resolve()
      videoGate.resolve()
      await execution
    }
  })

  it('keeps the video branch running when the information branch fails', async () => {
    mocks.config.bilibili.sendContent = ['info', 'video']
    const posterError = new Error('poster failed')
    const { subject, getvideo } = createSubject({ posterError })

    await expect(subject.RESOURCES({ type: 'one_video', bvid: 'BV1test', p: 1 })).resolves.not.toBe(false)
    expect(getvideo).toHaveBeenCalledOnce()
    expect(mocks.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('视频信息海报/回复任务失败'),
      posterError
    )
  })

  it('keeps the information branch result when the video branch fails', async () => {
    mocks.config.bilibili.sendContent = ['info', 'video']
    const videoError = new Error('video failed')
    const { subject, reply } = createSubject({ videoError })

    await expect(subject.RESOURCES({ type: 'one_video', bvid: 'BV1test', p: 1 })).resolves.not.toBe(false)
    expect(reply).toHaveBeenCalledWith({ kind: 'poster' })
    expect(mocks.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('视频下载、弹幕烧录与发送任务失败'),
      videoError
    )
  })

  it('rethrows when every media branch fails so the unified error handler sees it', async () => {
    mocks.config.bilibili.sendContent = ['info', 'video']
    const posterError = new Error('poster failed')
    const videoError = new Error('video failed')
    const { subject, getvideo } = createSubject({ posterError, videoError })

    // 两个分支都失败时 runMediaTasks 抛 AggregateError。以前 RESOURCES 会咽掉它、
    // warn 一句 'Bilibili解析错误' 然后返回 false——调用方全都不看返回值，等于彻底静默。
    // 现在原样上抛，wrapWithErrorHandler 才能出错误卡片并通知主人。
    await expect(subject.RESOURCES({ type: 'one_video', bvid: 'BV1test', p: 1 }))
      .rejects.toThrow('All enabled media tasks failed')
    expect(getvideo).toHaveBeenCalledOnce()
    // 两条分支失败各一条，加上 RESOURCES 自己那条带堆栈的汇总日志。
    expect(mocks.logger.error).toHaveBeenCalledTimes(3)
    expect(mocks.logger.error).toHaveBeenLastCalledWith(
      expect.stringContaining('解析失败'),
      expect.any(AggregateError)
    )
  })
})
