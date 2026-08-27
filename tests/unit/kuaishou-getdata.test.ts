import { beforeEach, describe, expect, it, vi } from 'vitest'

const getKuaishouDataMock = vi.hoisted(() => vi.fn())
const renderMock = vi.hoisted(() => vi.fn())
const downloadVideoMock = vi.hoisted(() => vi.fn())
const getHeadersMock = vi.hoisted(() => vi.fn())
const networksOptions = vi.hoisted(() => [] as Array<{ url: string, headers: Record<string, string> }>)

const configMock = vi.hoisted(() => ({
  app: {} as Record<string, unknown>,
  kuaishou: {} as Record<string, unknown>,
  cookies: {} as Record<string, unknown>,
  request: {} as Record<string, unknown>
}))

vi.mock('../../src/module/platform/kuaishou/api.js', () => ({
  getKuaishouData: getKuaishouDataMock
}))

vi.mock('../../src/module/utils/index.js', () => ({
  Base: class {
    e: unknown
    headers: Record<string, string> = { Accept: '*/*' }
  },
  Config: configMock,
  Render: renderMock,
  Networks: class {
    constructor (options: { url: string, headers: Record<string, string> }) {
      networksOptions.push(options)
    }

    getHeaders = getHeadersMock
  },
  downloadVideo: downloadVideoMock
}))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: configMock
}))

globalThis.logger = {
  warn: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  mark: vi.fn()
} as unknown as typeof logger

const { default: KuaishouData } = await import('../../src/module/platform/kuaishou/getdata.js')
const { default: KuaiShou } = await import('../../src/module/platform/kuaishou/kuaishou.js')

/**
 * amagi v6 的成功响应形状：`createSuccessResponse(rawData, '获取成功', 200)`
 * （`@ikenxuan/amagi@6.5.0` `dist/default/index.cjs:1405`）。
 * `rawData` 就是快手 GraphQL 的响应体，也正是迁移前 `Networks.getData()` 的返回值。
 */
const amagiResult = (rawBody: unknown) => ({
  success: true,
  code: 200,
  message: '获取成功',
  error: undefined,
  data: rawBody
})

const VIDEO_BODY = {
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
}

const COMMENT_BODY = {
  data: {
    visionCommentList: {
      commentCount: 1,
      rootComments: [
        {
          commentId: 'c1',
          authorName: '甲',
          headurl: 'https://example.com/a.png',
          content: '好看[大笑]',
          timestamp: 1_700_000_000_000,
          likedCount: 7,
          realLikedCount: 7,
          subCommentCount: 2
        }
      ]
    }
  }
}

const EMOJI_BODY = {
  data: {
    visionBaseEmoticons: {
      iconUrls: { '[大笑]': '//static.kuaishou.com/daxiao.png' }
    }
  }
}

/** 按内部方法名分派 mock 响应 */
const respondByMethod = (wrap: (body: unknown) => unknown = amagiResult) => {
  getKuaishouDataMock.mockImplementation(async (method: string) => {
    if (method === '单个视频作品数据') return wrap(VIDEO_BODY)
    if (method === '评论数据') return wrap(COMMENT_BODY)
    if (method === 'Emoji数据') return wrap(EMOJI_BODY)
    throw new Error(`unexpected method: ${method}`)
  })
}

const createEvent = () => ({ reply: vi.fn().mockResolvedValue({ message_id: 1 }) })

beforeEach(() => {
  configMock.app = {}
  configMock.kuaishou = { numcomment: 5 }
  configMock.cookies = {}
  configMock.request = {}
  getKuaishouDataMock.mockReset()
  renderMock.mockReset()
  renderMock.mockResolvedValue(['rendered-comment-image'])
  downloadVideoMock.mockReset()
  downloadVideoMock.mockResolvedValue(true)
  getHeadersMock.mockReset()
  getHeadersMock.mockResolvedValue({ 'content-length': '2097152' })
  networksOptions.length = 0
  vi.mocked(logger.error).mockClear()
})

describe('KuaishouData.GetData', () => {
  it('asks amagi for the three internal method names this plugin needs', async () => {
    respondByMethod()

    await new KuaishouData('one_work').GetData({ photoId: '3x1' })

    expect(getKuaishouDataMock.mock.calls.map(call => call[0]).sort()).toEqual(
      ['Emoji数据', '单个视频作品数据', '评论数据'].sort()
    )
    // 作品与评论都要带 photoId，表情列表无参
    expect(getKuaishouDataMock.mock.calls.find(call => call[0] === '单个视频作品数据')?.[1])
      .toEqual({ photoId: '3x1' })
    expect(getKuaishouDataMock.mock.calls.find(call => call[0] === '评论数据')?.[1])
      .toEqual({ photoId: '3x1' })
    expect(getKuaishouDataMock.mock.calls.find(call => call[0] === 'Emoji数据')?.[1])
      .toBeUndefined()
  })

  it('strips the amagi Result wrapper so the payload keeps its pre-migration shape', async () => {
    respondByMethod()

    const payload = await new KuaishouData('one_work').GetData({ photoId: '3x1' })

    // 迁移前 `Networks.getData()` 返回的就是这三个裸响应体，字段路径必须逐字相同
    expect(payload).toEqual({
      VideoData: VIDEO_BODY,
      CommentData: COMMENT_BODY,
      EmojiData: EMOJI_BODY
    })
  })

  it('passes a bare response through untouched when there is no Result wrapper', async () => {
    // 防御：amagi 换形状或调用方直接塞裸响应时不能把 data 再剥一层
    respondByMethod(body => body)

    const payload = await new KuaishouData('one_work').GetData({ photoId: '3x1' })

    expect(payload).toEqual({
      VideoData: VIDEO_BODY,
      CommentData: COMMENT_BODY,
      EmojiData: EMOJI_BODY
    })
  })

  it('runs the three requests concurrently rather than serially', async () => {
    // 三个请求之间没有数据依赖。这个 gate 只在**三个都已发出**之后才放行，
    // 所以串行实现会永久卡在第一个请求上，由下面的 1s 竞速兜底报错。
    let release: () => void = () => {}
    const gate = new Promise<void>(resolve => { release = resolve })
    const started: string[] = []

    getKuaishouDataMock.mockImplementation(async (method: string) => {
      started.push(method)
      if (started.length === 3) release()
      await gate
      if (method === '单个视频作品数据') return amagiResult(VIDEO_BODY)
      if (method === '评论数据') return amagiResult(COMMENT_BODY)
      return amagiResult(EMOJI_BODY)
    })

    const payload = await Promise.race([
      new KuaishouData('one_work').GetData({ photoId: '3x1' }),
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error('GetData 仍在串行发请求：三个请求没有同时在飞')), 1000)
      })
    ])

    expect(started).toHaveLength(3)
    expect(payload).toEqual({
      VideoData: VIDEO_BODY,
      CommentData: COMMENT_BODY,
      EmojiData: EMOJI_BODY
    })
  })

  it('returns only the unwrapped comment payload for the comments-only type', async () => {
    respondByMethod()

    const payload = await new KuaishouData('作品评论信息').GetData({ photoId: '3x1' })

    expect(payload).toEqual(COMMENT_BODY)
    expect(getKuaishouDataMock).toHaveBeenCalledTimes(1)
    expect(getKuaishouDataMock.mock.calls[0]?.[0]).toBe('评论数据')
  })

  it('logs an error for each empty response instead of throwing', async () => {
    // amagi 失败时返回 `{ success: false, ... }`，剥壳后 data 是 undefined
    getKuaishouDataMock.mockResolvedValue({ success: false, code: 500, message: '快手数据获取失败', data: undefined })

    const payload = await new KuaishouData('one_work').GetData({ photoId: '3x1' })

    expect(payload).toEqual({ VideoData: undefined, CommentData: undefined, EmojiData: undefined })
    expect(logger.error).toHaveBeenCalledTimes(3)
  })

  it('returns undefined for an unknown request type', async () => {
    expect(await new KuaishouData('未知类型' as never).GetData({ photoId: '3x1' })).toBeUndefined()
    expect(getKuaishouDataMock).not.toHaveBeenCalled()
  })
})

describe('KuaishouWorkPayload feeds KuaiShou.Action unchanged', () => {
  it('reaches the video, comment and emoji fields Action and comments() actually read', async () => {
    respondByMethod()
    const payload = await new KuaishouData('one_work').GetData({ photoId: '3x1' })
    const event = createEvent()

    expect(await new KuaiShou(event).Action(
      payload as Parameters<InstanceType<typeof KuaiShou>['Action']>[0]
    )).toBe(true)

    expect(renderMock).toHaveBeenCalledTimes(1)
    const [template, props] = renderMock.mock.calls[0] as [string, {
      viewCount: number
      likeCount: number
      share_url: string
      VideoSize: string
      CommentLength: number
      CommentsData: Array<{ nickname: string, digg_count: number, text: { nodes: Array<Record<string, unknown>> } }>
    }]

    expect(template).toBe('kuaishou/comment')
    // VideoData 走到了 `data.visionVideoDetail`
    expect(props.viewCount).toBe(100)
    expect(props.likeCount).toBe(20)
    expect(props.share_url).toBe('https://example.com/video.mp4')
    expect(props.VideoSize).toBe('2.00')
    // CommentData 走到了 `data.visionCommentList.rootComments`
    expect(props.CommentLength).toBe(1)
    expect(props.CommentsData[0]?.nickname).toBe('甲')
    expect(props.CommentsData[0]?.digg_count).toBe(7)
    // EmojiData 走到了 `data.visionBaseEmoticons.iconUrls`，且 `//` 被补成 https
    expect(props.CommentsData[0]?.text.nodes).toEqual([
      expect.objectContaining({ type: 'text', text: '好看' }),
      expect.objectContaining({ type: 'emoji', name: '[大笑]', src: 'https://static.kuaishou.com/daxiao.png' })
    ])

    expect(downloadVideoMock).toHaveBeenCalledTimes(1)
    const [, options] = downloadVideoMock.mock.calls[0] as [unknown, { title: { originTitle: string } }]
    expect(options.title.originTitle).toBe('测试作品.mp4')
  })

  it('sends the kuaishou referer with the video size probe', async () => {
    // 迁移前这个 Referer 是靠 getdata.ts 污染共享 baseHeaders 拿到的，
    // 删掉污染后必须在 kuaishou.ts 里显式补上，否则防盗链会拦掉体积探测
    respondByMethod()
    const payload = await new KuaishouData('one_work').GetData({ photoId: '3x1' })

    await new KuaiShou(createEvent()).Action(
      payload as Parameters<InstanceType<typeof KuaiShou>['Action']>[0]
    )

    expect(networksOptions).toHaveLength(1)
    const options = networksOptions[0]!
    expect(options.url).toBe('https://example.com/video.mp4')
    expect(options.headers.Referer).toBe('https://www.kuaishou.com/')
    expect(options.headers.Origin).toBe('https://www.kuaishou.com')
    // Base 的原有请求头不能被丢掉
    expect(options.headers.Accept).toBe('*/*')
    // ck 不该发给视频 CDN
    expect('Cookie' in options.headers).toBe(false)
  })

  it('refuses the work when amagi comes back with a failed Result', async () => {
    getKuaishouDataMock.mockResolvedValue({ success: false, code: 500, message: '快手数据获取失败', data: undefined })
    const payload = await new KuaishouData('one_work').GetData({ photoId: '3x1' })
    const event = createEvent()

    expect(await new KuaiShou(event).Action(
      payload as Parameters<InstanceType<typeof KuaiShou>['Action']>[0]
    )).toBe(true)

    // 和迁移前一致：取数失败退化成「不支持解析的视频」，不弹错误卡
    expect(event.reply).toHaveBeenCalledWith('不支持解析的视频')
    expect(renderMock).not.toHaveBeenCalled()
    expect(downloadVideoMock).not.toHaveBeenCalled()
  })
})
