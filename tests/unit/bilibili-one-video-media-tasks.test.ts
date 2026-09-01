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

// 任何方法都返回 undefined，与旧的 `getBilibiliData: vi.fn()` 同义：这些用例不该走到取数
vi.mock('../../src/module/utils/amagiClient.js', () => ({
  bilibiliFetcher: new Proxy({}, { get: () => vi.fn() }),
  buildAmagiRequestConfig: vi.fn(() => ({}))
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
  // 批量入口的默认返回：results 为空 => 每张图都走普通图片回退分支。
  buildLivePhotoMessagesBatch: vi.fn(async () => ({ results: [], tempFiles: [], generatedLivePhoto: false })),
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
  /**
   * 让「评论数据」返回一个软失败 Result（UP 主关了评论区）而不是正常数据。
   * 形状照 amagi 的失败 Result：softError.ts 的 readAmagiFailureCode 读的就是这个 code。
   */
  commentsSoftFailureCode?: number
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

  const fetchVideoInfo = vi.fn(async () => infoData)
  const fetchVideoStreamUrl = vi.fn(async () => playUrlData)
  const fetchComments = vi.fn(async () => {
    mocks.events.push('comment:fetch')
    if (options.commentsSoftFailureCode !== undefined) {
      return {
        success: false,
        code: options.commentsSoftFailureCode,
        message: 'UP主已关闭评论区',
        data: null
      }
    }
    return { data: { replies: [{ rpid: 1 }] } }
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

  // Proxy 兜底保留旧 stub 的 `Unexpected method` 报错：one_video 将来多调一个 fetcher
  // 方法时要当场炸出来，而不是静默拿到 undefined 再在几十行外报 TypeError。
  const bilibili = new Proxy({ fetchVideoInfo, fetchVideoStreamUrl, fetchComments }, {
    get: (target, prop) => {
      if (prop in target) return Reflect.get(target, prop)
      throw new Error(`Unexpected Bilibili fetcher method: ${String(prop)}`)
    }
  })

  const subject = Object.create(Bilibili.prototype) as Bilibili
  Object.assign(subject, {
    Type: 'one_video',
    e: { reply },
    amagi: { bilibili },
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
    fetchComments,
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
    const { subject, fetchComments } = createSubject({ posterGate, videoGate })
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
      // 参数顺序跟着 amagi fetcher 变了：options 在前、cookie 在中、请求配置在后
      expect(fetchComments.mock.calls[0]).toEqual([
        {
          oid: '123',
          type: 1,
          number: 1,
          typeMode: 'strict'
        },
        '',
        expect.anything()
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

  describe('Bilibili 软错误码：UP 主已关闭评论区', () => {
    beforeEach(() => {
      mocks.config.bilibili.sendContent = ['comment']
    })

    /*
      12061 / 12002 不在 amagi 的 bilibiliErrorCodeMap 里，所以 Base 的 Proxy 不会拦成错误卡，
      失败 Result 会一路交到业务层；而 bilibiliComments 对它只能给出空数组。
      改动前的表现是「评论图静默不出」——用户分不清是 UP 关了评论区还是解析坏了。
    */
    it.each([
      ['12061 UP主已关闭评论区', 12061],
      ['12002 评论区已关闭', 12002]
    ])('%s：明确告知一句，且不渲染评论图', async (_label, code) => {
      const { subject, reply } = createSubject({ commentsSoftFailureCode: code })

      await expect(subject.RESOURCES({ type: 'one_video', bvid: 'BV1test', p: 1 }))
        .resolves.not.toThrow()

      // 取数发生了，但渲染没有——软失败不该走到 Render
      expect(mocks.events).toContain('comment:fetch')
      expect(mocks.events).not.toContain('comment:render')
      expect(mocks.render).not.toHaveBeenCalled()

      // 用户拿到的是一句人话，而不是什么都没有
      const texts = reply.mock.calls.map(call => call[0]).filter(arg => typeof arg === 'string')
      expect(texts).toContain('UP主已关闭评论区，无法获取评论')

      // 软失败是业务上的正常拒绝，不该记 error、更不该上抛
      expect(mocks.logger.error).not.toHaveBeenCalled()
    })

    it('白名单外的失败码不当软失败处理，照旧走原有路径', async () => {
      // 12009（评论主体 type 不合法）是我们自己传错参，刻意没进白名单：
      // 软化它会把自家 bug 伪装成「这条视频没有评论」，是最难查的一类问题。
      const { subject, reply } = createSubject({ commentsSoftFailureCode: 12009 })

      await subject.RESOURCES({ type: 'one_video', bvid: 'BV1test', p: 1 })

      const texts = reply.mock.calls.map(call => call[0]).filter(arg => typeof arg === 'string')
      expect(texts).not.toContain('UP主已关闭评论区，无法获取评论')
    })

    it('评论数据正常时不受影响，照旧渲染评论图', async () => {
      const { subject, reply } = createSubject()

      await subject.RESOURCES({ type: 'one_video', bvid: 'BV1test', p: 1 })

      expect(mocks.events).toContain('comment:render')
      const texts = reply.mock.calls.map(call => call[0]).filter(arg => typeof arg === 'string')
      expect(texts).not.toContain('UP主已关闭评论区，无法获取评论')
    })
  })
})
