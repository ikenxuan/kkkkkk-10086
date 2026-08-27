import { beforeEach, describe, expect, it, vi } from 'vitest'

const renderMock = vi.hoisted(() => vi.fn())
const downloadVideoMock = vi.hoisted(() => vi.fn())
const commentsMock = vi.hoisted(() => vi.fn())
const getHeadersMock = vi.hoisted(() => vi.fn())

const configMock = vi.hoisted(() => ({
  app: {} as Record<string, unknown>,
  kuaishou: {} as Record<string, unknown>,
  cookies: {} as Record<string, unknown>,
  request: {} as Record<string, unknown>
}))

vi.mock('../../src/module/utils/index.js', () => ({
  Base: class {
    e: unknown
    headers: Record<string, string> = {}
  },
  Config: configMock,
  Render: renderMock,
  Networks: class {
    getHeaders = getHeadersMock
  },
  downloadVideo: downloadVideoMock
}))

vi.mock('../../src/module/platform/kuaishou/comments.js', () => ({
  default: commentsMock
}))

/*
  MediaTasks 只包一层探针、不换实现：并发编排和「作用域外上报是空操作」正是被验的东西，
  桩掉 runMediaTasks 这份用例就只在验自己写的假货了。探针只为看清调用点传了什么超时预算。
*/
const runMediaTasksSpy = vi.hoisted(() => vi.fn())

vi.mock('../../src/module/utils/MediaTasks.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/module/utils/MediaTasks.js')>()
  return {
    ...actual,
    runMediaTasks: (tasks: Parameters<typeof actual.runMediaTasks>[0], options?: Parameters<typeof actual.runMediaTasks>[1]) => {
      runMediaTasksSpy(tasks, options)
      return actual.runMediaTasks(tasks, options)
    }
  }
})

const { VIDEO_DOWNLOAD_TIMEOUT_MS } = await import('../../src/module/utils/MediaTasks.js')
const { default: KuaiShou } = await import('../../src/module/platform/kuaishou/kuaishou.js')

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
}

const createDeferred = <T>(): Deferred<T> => {
  let resolveDeferred!: Deferred<T>['resolve']
  const promise = new Promise<T>(resolve => { resolveDeferred = resolve })
  return { promise, resolve: resolveDeferred }
}

const loggerMock = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  mark: vi.fn(),
  warn: vi.fn()
}

const buildVideoData = () => ({
  VideoData: {
    data: {
      visionVideoDetail: {
        status: 1,
        photo: {
          photoUrl: 'https://example.com/video.mp4',
          caption: '测试作品',
          viewCount: 100,
          likeCount: 20
        }
      }
    }
  },
  CommentData: { data: { visionCommentList: { rootComments: [] } } },
  EmojiData: { data: { visionBaseEmoticons: { iconUrls: {} } } }
})

const createEvent = () => ({ reply: vi.fn().mockResolvedValue({ message_id: 1 }) })

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('logger', loggerMock)
  configMock.app = {}
  configMock.kuaishou = {}
  configMock.cookies = {}
  renderMock.mockResolvedValue(['rendered-comment-image'])
  downloadVideoMock.mockResolvedValue(true)
  commentsMock.mockResolvedValue([])
  getHeadersMock.mockResolvedValue({ 'content-length': '2097152' })
})

describe('KuaiShou.Action media tasks', () => {
  /**
   * 两条支线之间没有数据依赖（评论卡只要 commentsData/emoji 表，视频下载只要 video_url）。
   * 这个闸门只在**两条都已启动**之后才放行，所以串行实现会永久卡在先跑的那条上，
   * 由下面的 1s 竞速兜底报出具名错误。
   */
  it('runs the comment card and the video download concurrently rather than serially', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>(resolve => { release = resolve })
    const started: string[] = []
    const enter = (branch: string): void => {
      started.push(branch)
      if (started.length === 2) release()
    }

    commentsMock.mockImplementation(async () => {
      enter('comment')
      await gate
      return []
    })
    downloadVideoMock.mockImplementation(async () => {
      enter('video')
      await gate
      return true
    })

    const event = createEvent()
    try {
      await expect(Promise.race([
        new KuaiShou(event).Action(buildVideoData()),
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('Action 仍在串行：评论卡和视频下载没有同时在跑')), 1000)
        })
      ])).resolves.toBe(true)
    } finally {
      release()
    }

    expect(started).toHaveLength(2)
    expect(event.reply).toHaveBeenCalledWith(['rendered-comment-image'])
    expect(downloadVideoMock).toHaveBeenCalledTimes(1)
  })

  /**
   * 评论卡支线内部的顺序不能被打散：`VideoSize` 就是 `getHeaders()` 探回来的
   * `content-length`，把 HEAD 探测拆成第三条并发支线会让 Render 拿到还没探到的体积。
   *
   * 这条同时钉住两件事：Render 一定等 getHeaders 出结果（内部按序），
   * 而视频下载不等它（跨支线并发）。
   */
  it('keeps getHeaders ahead of Render inside the comment branch so VideoSize comes from the probe', async () => {
    const headersGate = createDeferred<Record<string, string>>()
    getHeadersMock.mockImplementation(async () => await headersGate.promise)

    const event = createEvent()
    const execution = new KuaiShou(event).Action(buildVideoData())

    // 评论卡还卡在 HEAD 探测上，视频下载已经跑完了
    await vi.waitFor(() => expect(downloadVideoMock).toHaveBeenCalledTimes(1))
    expect(renderMock).not.toHaveBeenCalled()

    headersGate.resolve({ 'content-length': '5242880' })
    await expect(execution).resolves.toBe(true)

    expect(renderMock).toHaveBeenCalledWith('kuaishou/comment', expect.objectContaining({
      VideoSize: '5.00'
    }))
  })

  it('keeps downloading the video when the comment card fails, and reports it as the comment task', async () => {
    const renderError = new Error('render failed')
    renderMock.mockRejectedValueOnce(renderError)
    const event = createEvent()

    await expect(new KuaiShou(event).Action(buildVideoData())).resolves.toBe(true)

    expect(downloadVideoMock).toHaveBeenCalledTimes(1)
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.stringContaining('[快手] 评论图渲染与发送任务失败'),
      renderError
    )
  })

  it('still replies with the comment card when the video download fails, and reports it as the video task', async () => {
    const downloadError = new Error('download failed')
    downloadVideoMock.mockRejectedValueOnce(downloadError)
    const event = createEvent()

    await expect(new KuaiShou(event).Action(buildVideoData())).resolves.toBe(true)

    expect(event.reply).toHaveBeenCalledWith(['rendered-comment-image'])
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.stringContaining('[快手] 视频下载与发送任务失败'),
      downloadError
    )
  })

  // 两条都失败时 runMediaTasks 原样上抛，wrapWithErrorHandler 才能出错误卡片。
  it('rethrows when both branches fail so the unified error handler sees it', async () => {
    renderMock.mockRejectedValueOnce(new Error('render failed'))
    downloadVideoMock.mockRejectedValueOnce(new Error('download failed'))

    await expect(new KuaiShou(createEvent()).Action(buildVideoData()))
      .rejects.toThrow('All enabled media tasks failed')
  })

  it('starts neither branch when the video is not parseable', async () => {
    const event = createEvent()
    const payload = buildVideoData()
    payload.VideoData.data.visionVideoDetail.status = 0

    expect(await new KuaiShou(event).Action(payload)).toBe(true)

    expect(event.reply).toHaveBeenCalledWith('不支持解析的视频')
    // 早退在 fan-out 之前：评论取数、HEAD 探测、渲染、下载一个都不该启动
    expect(commentsMock).not.toHaveBeenCalled()
    expect(getHeadersMock).not.toHaveBeenCalled()
    expect(renderMock).not.toHaveBeenCalled()
    expect(downloadVideoMock).not.toHaveBeenCalled()
  })

  // 共享前置：解析提示要在两条支线之前回，不能被并发挤到卡片后面。
  it('replies with the parse tip before either branch starts', async () => {
    configMock.app.parseTip = true
    const order: string[] = []
    const event = { reply: vi.fn(async (message: unknown) => { order.push(String(message)) }) }
    commentsMock.mockImplementation(async () => { order.push('comment:fetch'); return [] })
    downloadVideoMock.mockImplementation(async () => { order.push('video:download'); return true })

    await new KuaiShou(event).Action(buildVideoData())

    expect(order[0]).toBe('检测到快手链接，开始解析')
  })

  /**
   * 视频下载是重支线：字节流那条路上 axios 拿的是 `timeout: 0`，压根没有壁钟上限，
   * 60s 的默认兜底装不下一条正常体积的短视频。所以**只**放宽它。
   *
   * 评论卡那条必须留在默认值上 —— 它就是取数 + 一次 HEAD + 一次渲染，
   * 跟着放宽只会让卡死的渲染多挂 9 分钟。
   */
  it('widens only the video branch budget and leaves the comment card on the guard default', async () => {
    await new KuaiShou(createEvent()).Action(buildVideoData())

    expect(runMediaTasksSpy).toHaveBeenCalledTimes(1)
    const [, options] = runMediaTasksSpy.mock.calls[0] as [unknown, { timeoutMs?: number, taskTimeoutMs?: Record<string, number> }]
    expect(options.taskTimeoutMs).toEqual({ video: VIDEO_DOWNLOAD_TIMEOUT_MS })
    // 没有全局 timeoutMs：评论卡靠「不传」落到 runWithRequestGuard 的默认 60s
    expect(options.timeoutMs).toBeUndefined()
    expect(VIDEO_DOWNLOAD_TIMEOUT_MS).toBeGreaterThan(60_000)
  })
})
