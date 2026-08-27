import { beforeEach, describe, expect, it, vi } from 'vitest'

const configMock = vi.hoisted(() => ({
  app: { parseTip: false },
  cookies: { xiaohongshu: 'xhs-cookie' },
  xiaohongshu: { sendContent: [] as string[], numcomment: 5 }
}))
const getXiaohongshuDataMock = vi.hoisted(() => vi.fn())
const renderMock = vi.hoisted(() => vi.fn())
const processImageUrlMock = vi.hoisted(() => vi.fn())
const removeFileMock = vi.hoisted(() => vi.fn())
const makeForwardMsgMock = vi.hoisted(() => vi.fn())
const buildLivePhotoMessagesBatchMock = vi.hoisted(() => vi.fn())
const buildLivePhotoTipMessageMock = vi.hoisted(() => vi.fn())
const downloadVideoMock = vi.hoisted(() => vi.fn())

vi.mock('../../src/module/utils/Config.js', () => ({ default: configMock }))
vi.mock('../../src/module/utils/Networks.js', () => ({ baseHeaders: {} }))
vi.mock('../../src/module/utils/Render.js', () => ({ Render: renderMock }))
vi.mock('../../src/module/utils/Common.js', () => ({ default: { removeFile: removeFileMock } }))
vi.mock('../../src/module/utils/ImageHelper.js', () => ({ processImageUrl: processImageUrlMock }))
vi.mock('../../src/runtime/host/common.js', () => ({ default: { makeForwardMsg: makeForwardMsgMock } }))

vi.mock('../../src/module/platform/xiaohongshu/livePhoto.js', () => ({
  buildLivePhotoMessages: vi.fn(),
  buildLivePhotoMessagesBatch: buildLivePhotoMessagesBatchMock,
  buildLivePhotoTipMessage: buildLivePhotoTipMessageMock,
  // 真实实现只是从 image_list 项里挑一个可用 url，这里给个稳定的桩，
  // 图集支线只需要「每张图都能走普通图片回退」这一个事实。
  pickXiaohongshuImageUrl: vi.fn((item: unknown) => (item as { url?: string })?.url)
}))

vi.mock('../../src/module/utils/Base.js', () => ({
  Base: class {
    e: unknown

    constructor (e: unknown) {
      this.e = e
    }
  },
  downloadVideo: downloadVideoMock
}))

vi.mock('../../src/module/platform/xiaohongshu/api.js', () => ({
  getXiaohongshuData: getXiaohongshuDataMock
}))

/*
  MediaTasks 只包一层探针、不换实现：并发编排正是被验的东西。
  探针只为看清调用点给每条支线报了多少超时预算。
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

const {
  livePhotoBatchTimeoutMs,
  MAX_MEDIA_TASK_TIMEOUT_MS,
  MIN_MEDIA_TASK_TIMEOUT_MS,
  VIDEO_DOWNLOAD_TIMEOUT_MS
} = await import('../../src/module/utils/MediaTasks.js')
const { Xiaohongshu } = await import('../../src/module/platform/xiaohongshu/xiaohongshu.js')

const loggerMock = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  mark: vi.fn(),
  warn: vi.fn()
}

const NOTE_ID = { type: 'note' as const, note_id: 'note-1', xsec_token: 'token-1' }

interface NoteOptions {
  video?: boolean
  /** 图集张数，默认 2 张。按图数算的超时预算用它撑边界。 */
  imageCount?: number
}

/**
 * 视频笔记的 `video` 字段。单独抽成函数而不是在字面量里写
 * `...(options.video ? {…} : {})`：本仓 legacy `indent` 和 `@stylistic/indent`
 * 对「三元 false 分支是多行对象字面量」要求的缩进不一致，`--fix` 收敛不了。
 */
const buildNoteVideo = () => ({
  url_default: 'https://example.com/note.mp4',
  image: { url_default: 'https://example.com/cover.jpg' },
  media: {
    stream: {
      h264: [{ master_url: 'https://example.com/h264.mp4', width: 1920, height: 1080, size: 1024 }]
    }
  }
})

const buildNoteCard = (options: NoteOptions = {}) => ({
  note_id: 'note-1',
  title: '标题',
  desc: '正文',
  time: 1_700_000_000_000,
  ip_location: '上海',
  interact_info: {},
  user: { nickname: 'tester', avatar: 'https://example.com/avatar.jpg', user_id: 'u-1' },
  image_list: Array.from(
    { length: options.imageCount ?? 2 },
    (_item, index) => ({ url: `https://example.com/${index + 1}.jpg` })
  ),
  video: options.video ? buildNoteVideo() : undefined
})

interface RespondOptions extends NoteOptions {
  onEmoji?: () => void
  onComments?: () => Promise<void> | void
}

const respond = (options: RespondOptions = {}): void => {
  getXiaohongshuDataMock.mockImplementation(async (method: string) => {
    if (method === '单个笔记数据') {
      return { success: true, data: { data: { items: [{ note_card: buildNoteCard(options) }] } } }
    }
    if (method === '表情列表') {
      options.onEmoji?.()
      return { success: true }
    }
    if (method === '评论数据') {
      await options.onComments?.()
      return {
        success: true,
        data: {
          data: {
            comments: [{ id: 'c1', user_info: { nickname: 'u1' }, show_tags: [] }],
            has_more: false
          }
        }
      }
    }
    return { success: true }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('logger', loggerMock)
  vi.stubGlobal('segment', { image: vi.fn((url: string) => ({ type: 'image', url })) })
  configMock.app.parseTip = false
  configMock.cookies.xiaohongshu = 'xhs-cookie'
  configMock.xiaohongshu.sendContent = ['info', 'comment', 'image']
  configMock.xiaohongshu.numcomment = 5
  renderMock.mockImplementation(async (route: string) => `rendered:${route}`)
  processImageUrlMock.mockImplementation(async (url: string) => `processed:${url}`)
  buildLivePhotoMessagesBatchMock.mockResolvedValue({ results: [], tempFiles: [], generatedLivePhoto: false })
  buildLivePhotoTipMessageMock.mockResolvedValue('live-photo-tip')
  makeForwardMsgMock.mockResolvedValue('forwarded-images')
  removeFileMock.mockResolvedValue(undefined)
  downloadVideoMock.mockResolvedValue(undefined)
  respond()
})

describe('Xiaohongshu media tasks', () => {
  /**
   * 三条支线之间没有数据依赖：笔记卡和评论卡都只要上面取好的 `card` / `emojiData`，
   * 图集支线只要 `card.image_list`。这个闸门只在**三条都已启动**之后才放行，
   * 所以串行实现会永久卡在第一条上，由 1s 竞速兜底报出具名错误。
   */
  it('runs the note info, comment and image branches concurrently rather than serially', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>(resolve => { release = resolve })
    const started: string[] = []
    const enter = (branch: string): void => {
      started.push(branch)
      if (started.length === 3) release()
    }

    respond({
      onComments: async () => {
        enter('comment')
        await gate
      }
    })
    renderMock.mockImplementation(async (route: string) => {
      if (route === 'xiaohongshu/noteInfo') {
        enter('poster')
        await gate
      }
      return `rendered:${route}`
    })
    buildLivePhotoMessagesBatchMock.mockImplementation(async () => {
      enter('image')
      await gate
      return { results: [], tempFiles: [], generatedLivePhoto: false }
    })

    const reply = vi.fn(async () => undefined)
    try {
      await expect(Promise.race([
        new Xiaohongshu({ reply } as never).XiaohongshuHandler(NOTE_ID),
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('XiaohongshuHandler 仍在串行：三条支线没有同时在跑')), 1000)
        })
      ])).resolves.toBe(true)
    } finally {
      release()
    }

    expect(started.sort()).toEqual(['comment', 'image', 'poster'])
  })

  /**
   * `emojiData` 是笔记卡和评论卡的共享前置，必须留在 fan-out 之前。
   * 塞进任一条支线里就会变成两条各取一次（甚至并发打两次表情列表接口）。
   */
  it('fetches the emoji list exactly once for both card branches', async () => {
    const reply = vi.fn(async () => undefined)

    await new Xiaohongshu({ reply } as never).XiaohongshuHandler(NOTE_ID)

    const emojiCalls = getXiaohongshuDataMock.mock.calls.filter(([method]) => method === '表情列表')
    expect(emojiCalls).toHaveLength(1)
    expect(renderMock.mock.calls.map(([route]) => route).sort()).toEqual([
      'xiaohongshu/comment',
      'xiaohongshu/noteInfo'
    ])
  })

  // 视频笔记不该跑图片循环：`!card.video` 这个前置条件决定 image 支线压根不进 fan-out。
  it('never starts the image branch for a video note', async () => {
    configMock.xiaohongshu.sendContent = ['info', 'comment', 'image', 'video']
    respond({ video: true })
    const reply = vi.fn(async () => undefined)

    await expect(new Xiaohongshu({ reply } as never).XiaohongshuHandler(NOTE_ID)).resolves.toBe(true)

    expect(buildLivePhotoMessagesBatchMock).not.toHaveBeenCalled()
    expect(makeForwardMsgMock).not.toHaveBeenCalled()
    // 视频笔记走的是视频分支
    expect(downloadVideoMock).toHaveBeenCalledTimes(1)
  })

  it('keeps the other branches running when the note info branch fails', async () => {
    const posterError = new Error('noteInfo render failed')
    renderMock.mockImplementation(async (route: string) => {
      if (route === 'xiaohongshu/noteInfo') throw posterError
      return `rendered:${route}`
    })
    const reply = vi.fn(async () => undefined)

    await expect(new Xiaohongshu({ reply } as never).XiaohongshuHandler(NOTE_ID)).resolves.toBe(true)

    expect(reply).toHaveBeenCalledWith('rendered:xiaohongshu/comment')
    expect(buildLivePhotoMessagesBatchMock).toHaveBeenCalledTimes(1)
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.stringContaining('[小红书] 笔记信息卡渲染与发送任务失败'),
      posterError
    )
  })

  it('keeps the other branches running when the comment branch fails', async () => {
    const commentError = new Error('comment fetch failed')
    respond({ onComments: () => { throw commentError } })
    const reply = vi.fn(async () => undefined)

    await expect(new Xiaohongshu({ reply } as never).XiaohongshuHandler(NOTE_ID)).resolves.toBe(true)

    expect(reply).toHaveBeenCalledWith('rendered:xiaohongshu/noteInfo')
    expect(makeForwardMsgMock).toHaveBeenCalledTimes(1)
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.stringContaining('[小红书] 评论图渲染与发送任务失败'),
      commentError
    )
  })

  it('keeps the card branches running when the image branch fails', async () => {
    const imageError = new Error('live photo batch failed')
    buildLivePhotoMessagesBatchMock.mockRejectedValueOnce(imageError)
    const reply = vi.fn(async () => undefined)

    await expect(new Xiaohongshu({ reply } as never).XiaohongshuHandler(NOTE_ID)).resolves.toBe(true)

    expect(reply).toHaveBeenCalledWith('rendered:xiaohongshu/noteInfo')
    expect(reply).toHaveBeenCalledWith('rendered:xiaohongshu/comment')
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.stringContaining('[小红书] 图集/实况图发送任务失败'),
      imageError
    )
  })

  /**
   * 临时文件清理留在图集支线内部：它只清这条支线自己那批。
   * 提到 fan-out 外面就会在别的支线还在用文件时先删掉。
   */
  it('cleans up only its own temporary files inside the image branch', async () => {
    buildLivePhotoMessagesBatchMock.mockResolvedValueOnce({
      results: [{ messages: ['live-photo-1'] }],
      tempFiles: [{ filepath: 'tmp/live-1.mp4' }],
      generatedLivePhoto: true
    })
    const reply = vi.fn(async () => undefined)

    await new Xiaohongshu({ reply } as never).XiaohongshuHandler(NOTE_ID)

    expect(removeFileMock).toHaveBeenCalledWith('tmp/live-1.mp4', true)
    // 生成过实况图就追加那张提示图，而且它排在图片队尾
    expect(buildLivePhotoTipMessageMock).toHaveBeenCalledTimes(1)
    expect(makeForwardMsgMock.mock.calls[0]?.[1]).toEqual([
      'live-photo-1',
      { type: 'image', url: 'processed:https://example.com/2.jpg' },
      'live-photo-tip'
    ])
  })

  // 「这个笔记没有评论 ~」是用户可见的反馈，挪进支线后不能丢。
  it('still tells the user when the note has no comments', async () => {
    getXiaohongshuDataMock.mockImplementation(async (method: string) => {
      if (method === '单个笔记数据') {
        return { success: true, data: { data: { items: [{ note_card: buildNoteCard() }] } } }
      }
      if (method === '评论数据') return { success: true, data: { data: { comments: [], has_more: false } } }
      return { success: true }
    })
    const reply = vi.fn(async () => undefined)

    await new Xiaohongshu({ reply } as never).XiaohongshuHandler(NOTE_ID)

    expect(reply).toHaveBeenCalledWith('这个笔记没有评论 ~')
    expect(renderMock).not.toHaveBeenCalledWith('xiaohongshu/comment', expect.anything())
  })

  it('rethrows when every enabled branch fails so the unified error handler sees it', async () => {
    configMock.xiaohongshu.sendContent = ['info', 'comment']
    respond({ onComments: () => { throw new Error('comment fetch failed') } })
    renderMock.mockImplementation(async () => { throw new Error('render failed') })

    await expect(new Xiaohongshu({ reply: vi.fn() } as never).XiaohongshuHandler(NOTE_ID))
      .rejects.toThrow('All enabled media tasks failed')
  })

  // 图文笔记走 image、不走 video —— 上面那条视频笔记用例的另一半。
  it('runs the image branch and never the video branch for an image note', async () => {
    configMock.xiaohongshu.sendContent = ['info', 'comment', 'image', 'video']
    respond()
    const reply = vi.fn(async () => undefined)

    await expect(new Xiaohongshu({ reply } as never).XiaohongshuHandler(NOTE_ID)).resolves.toBe(true)

    expect(buildLivePhotoMessagesBatchMock).toHaveBeenCalledTimes(1)
    expect(downloadVideoMock).not.toHaveBeenCalled()
    // 挂上去的四条里 image 有、video 没有
    const [tasks] = runMediaTasksSpy.mock.calls[0] as [Record<string, unknown>]
    expect(tasks.image).toBeTypeOf('function')
    expect(tasks.video).toBeUndefined()
  })

  // 视频笔记那半边同理：video 挂上去、image 压根不进 fan-out。
  it('hands only the video branch to the fan-out for a video note', async () => {
    configMock.xiaohongshu.sendContent = ['info', 'comment', 'image', 'video']
    respond({ video: true })
    const reply = vi.fn(async () => undefined)

    await new Xiaohongshu({ reply } as never).XiaohongshuHandler(NOTE_ID)

    const [tasks] = runMediaTasksSpy.mock.calls[0] as [Record<string, unknown>]
    expect(tasks.video).toBeTypeOf('function')
    expect(tasks.image).toBeUndefined()
  })

  /**
   * 视频笔记的三条支线（笔记卡 / 评论卡 / 视频下载）同样并发。
   * 闸门只在三条都已启动后放行，串行实现会卡在第一条上并由 1s 竞速报出具名错误。
   */
  it('runs the note info, comment and video branches concurrently for a video note', async () => {
    configMock.xiaohongshu.sendContent = ['info', 'comment', 'video']
    let release: () => void = () => {}
    const gate = new Promise<void>(resolve => { release = resolve })
    const started: string[] = []
    const enter = (branch: string): void => {
      started.push(branch)
      if (started.length === 3) release()
    }

    respond({
      video: true,
      onComments: async () => {
        enter('comment')
        await gate
      }
    })
    renderMock.mockImplementation(async (route: string) => {
      if (route === 'xiaohongshu/noteInfo') {
        enter('poster')
        await gate
      }
      return `rendered:${route}`
    })
    downloadVideoMock.mockImplementation(async () => {
      enter('video')
      await gate
    })

    const reply = vi.fn(async () => undefined)
    try {
      await expect(Promise.race([
        new Xiaohongshu({ reply } as never).XiaohongshuHandler(NOTE_ID),
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('视频笔记仍在串行：三条支线没有同时在跑')), 1000)
        })
      ])).resolves.toBe(true)
    } finally {
      release()
    }

    expect(started.sort()).toEqual(['comment', 'poster', 'video'])
  })

  it('keeps the card branches running when the video branch fails', async () => {
    configMock.xiaohongshu.sendContent = ['info', 'comment', 'video']
    const videoError = new Error('download failed')
    respond({ video: true })
    downloadVideoMock.mockRejectedValueOnce(videoError)
    const reply = vi.fn(async () => undefined)

    await expect(new Xiaohongshu({ reply } as never).XiaohongshuHandler(NOTE_ID)).resolves.toBe(true)

    expect(reply).toHaveBeenCalledWith('rendered:xiaohongshu/noteInfo')
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.stringContaining('[小红书] 视频下载与发送任务失败'),
      videoError
    )
  })

  /**
   * 「未找到可用的视频地址」原来是提前 `return true` 结束整个 handler，挪进支线后
   * 变成这条支线自己 return。那句用户可见的反馈不能丢，另外两条也不该被它掐断。
   */
  it('still reports a missing video url from inside the video branch', async () => {
    configMock.xiaohongshu.sendContent = ['info', 'comment', 'video']
    getXiaohongshuDataMock.mockImplementation(async (method: string) => {
      if (method === '单个笔记数据') {
        const card = { ...buildNoteCard({ video: true }), video: { media: { stream: {} } } }
        return { success: true, data: { data: { items: [{ note_card: card }] } } }
      }
      if (method === '评论数据') {
        return { success: true, data: { data: { comments: [{ id: 'c1', user_info: { nickname: 'u1' }, show_tags: [] }], has_more: false } } }
      }
      return { success: true }
    })
    const reply = vi.fn(async () => undefined)

    await expect(new Xiaohongshu({ reply } as never).XiaohongshuHandler(NOTE_ID)).resolves.toBe(true)

    expect(reply).toHaveBeenCalledWith('未找到可用的视频地址')
    expect(downloadVideoMock).not.toHaveBeenCalled()
    // 两张卡片照发
    expect(reply).toHaveBeenCalledWith('rendered:xiaohongshu/noteInfo')
    expect(reply).toHaveBeenCalledWith('rendered:xiaohongshu/comment')
  })

  /**
   * 两条重支线各自放宽，两张卡片留在 60s 的默认兜底上。
   *
   * image 的预算按图数算：整批实况图的工作量线性于图数，固定魔数对一张图的笔记
   * 是形同虚设的守卫、对三十张的又可能不够。
   */
  it('widens the image and video budgets by workload and leaves the cards on the guard default', async () => {
    respond({ imageCount: 12 })
    const reply = vi.fn(async () => undefined)

    await new Xiaohongshu({ reply } as never).XiaohongshuHandler(NOTE_ID)

    const [, options] = runMediaTasksSpy.mock.calls[0] as [unknown, { timeoutMs?: number, taskTimeoutMs?: Record<string, number> }]
    expect(options.taskTimeoutMs).toEqual({
      image: livePhotoBatchTimeoutMs(12),
      video: VIDEO_DOWNLOAD_TIMEOUT_MS
    })
    // 12 张 × 每张 30s = 360s，还没碰到 10 分钟的上限
    expect(options.taskTimeoutMs?.image).toBe(360_000)
    // 没有全局 timeoutMs：poster / comment 靠「不传」落到默认 60s
    expect(options.timeoutMs).toBeUndefined()
  })

  it('falls back to the floor budget for a note with a single image', async () => {
    respond({ imageCount: 1 })
    const reply = vi.fn(async () => undefined)

    await new Xiaohongshu({ reply } as never).XiaohongshuHandler(NOTE_ID)

    const [, options] = runMediaTasksSpy.mock.calls[0] as [unknown, { taskTimeoutMs?: Record<string, number> }]
    expect(options.taskTimeoutMs?.image).toBe(MIN_MEDIA_TASK_TIMEOUT_MS)
  })

  it('clamps a huge image list to the ceiling budget', async () => {
    respond({ imageCount: 40 })
    const reply = vi.fn(async () => undefined)

    await new Xiaohongshu({ reply } as never).XiaohongshuHandler(NOTE_ID)

    const [, options] = runMediaTasksSpy.mock.calls[0] as [unknown, { taskTimeoutMs?: Record<string, number> }]
    expect(options.taskTimeoutMs?.image).toBe(MAX_MEDIA_TASK_TIMEOUT_MS)
  })
})
