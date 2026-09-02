import { beforeEach, describe, expect, it, vi } from 'vitest'

const renderMock = vi.hoisted(() => vi.fn())
const downloadVideoMock = vi.hoisted(() => vi.fn())
const commentsMock = vi.hoisted(() => vi.fn())
const getHeadersMock = vi.hoisted(() => vi.fn())
const fetchCommentsMock = vi.hoisted(() => vi.fn())
const fetchEmojiMock = vi.hoisted(() => vi.fn())

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

// 评论与表情两跳现在由 Action 的评论支线自己发；换成替身，免得引真 getdata 把
// Config / amagiClient 一起拖进来
vi.mock('../../src/module/platform/kuaishou/getdata.js', () => ({
  fetchKuaishouWorkComments: fetchCommentsMock,
  fetchKuaishouEmojiList: fetchEmojiMock
}))

globalThis.logger = {
  warn: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  mark: vi.fn()
} as unknown as typeof logger

const { default: KuaiShou } = await import('../../src/module/platform/kuaishou/kuaishou.js')

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
  photoId: '3x1'
})

const createEvent = () => ({ reply: vi.fn().mockResolvedValue({ message_id: 1 }) })

/**
 * 两个数量键都没配时 `resolveCommentLimit` 落到的默认值，和
 * `config/default_config/kuaishou.yaml` 里写的 5 一致。
 */
const DEFAULT_LIMIT = 5

beforeEach(() => {
  configMock.app = {}
  configMock.kuaishou = {}
  configMock.cookies = {}
  renderMock.mockReset()
  renderMock.mockResolvedValue(['rendered-comment-image'])
  downloadVideoMock.mockReset()
  downloadVideoMock.mockResolvedValue(true)
  commentsMock.mockReset()
  commentsMock.mockResolvedValue([])
  getHeadersMock.mockReset()
  getHeadersMock.mockResolvedValue({ 'content-length': '2097152' })
  fetchCommentsMock.mockReset()
  fetchCommentsMock.mockResolvedValue({ data: { visionCommentList: { rootComments: [] } } })
  fetchEmojiMock.mockReset()
  fetchEmojiMock.mockResolvedValue({ data: { visionBaseEmoticons: { iconUrls: {} } } })
})

describe('KuaiShou.Action', () => {
  it('renders the comment card through the Render function', async () => {
    const event = createEvent()
    const instance = new KuaiShou(event)

    expect(await instance.Action(buildVideoData())).toBe(true)

    expect(renderMock).toHaveBeenCalledTimes(1)
    expect(renderMock).toHaveBeenCalledWith('kuaishou/comment', expect.objectContaining({
      Type: '视频',
      viewCount: 100,
      likeCount: 20,
      share_url: 'https://example.com/video.mp4',
      VideoSize: '2.00'
    }))
    expect(event.reply).toHaveBeenCalledWith(['rendered-comment-image'])
  })

  it('downloads the video with both title variants', async () => {
    const event = createEvent()

    await new KuaiShou(event).Action(buildVideoData())

    expect(downloadVideoMock).toHaveBeenCalledTimes(1)
    const [, options] = downloadVideoMock.mock.calls[0] as [unknown, { video_url: string, title: { originTitle: string } }]
    expect(options.video_url).toBe('https://example.com/video.mp4')
    expect(options.title.originTitle).toBe('测试作品.mp4')
  })

  it('refuses an unsupported video without rendering', async () => {
    const event = createEvent()
    const payload = buildVideoData()
    payload.VideoData.data.visionVideoDetail.status = 0

    expect(await new KuaiShou(event).Action(payload)).toBe(true)

    expect(event.reply).toHaveBeenCalledWith('不支持解析的视频')
    expect(renderMock).not.toHaveBeenCalled()
    expect(downloadVideoMock).not.toHaveBeenCalled()
    // 早退在 fan-out 之前：评论与表情两跳一个都不该发出去
    expect(fetchCommentsMock).not.toHaveBeenCalled()
    expect(fetchEmojiMock).not.toHaveBeenCalled()
  })

  it('announces the parse when the tip switch is enabled', async () => {
    configMock.app.parseTip = true
    const event = createEvent()

    await new KuaiShou(event).Action(buildVideoData())

    expect(event.reply).toHaveBeenCalledWith('检测到快手链接，开始解析')
  })

  // payload 里除了作品本体只剩 photoId，评论支线就是靠它自己去取评论的
  it('fetches the comments with the photoId carried by the payload', async () => {
    await new KuaiShou(createEvent()).Action(buildVideoData())

    expect(fetchCommentsMock).toHaveBeenCalledWith('3x1')
    expect(commentsMock).toHaveBeenCalledWith(
      { data: { visionCommentList: { rootComments: [] } } },
      [],
      DEFAULT_LIMIT
    )
  })

  // 表情表只影响富文本里的表情节点，拿不到该退成纯文字，而不是把整张评论卡带走
  it('renders the comment card in plain text when the emoji list fetch fails', async () => {
    fetchEmojiMock.mockRejectedValueOnce(new Error('emoji failed'))
    const event = createEvent()

    expect(await new KuaiShou(event).Action(buildVideoData())).toBe(true)

    expect(commentsMock).toHaveBeenCalledWith(expect.anything(), [], DEFAULT_LIMIT)
    expect(event.reply).toHaveBeenCalledWith(['rendered-comment-image'])
  })

  it('maps the emoji icon urls onto the comment renderer', async () => {
    fetchEmojiMock.mockResolvedValueOnce({
      data: { visionBaseEmoticons: { iconUrls: { '[大笑]': '//static.kuaishou.com/daxiao.png' } } }
    })

    await new KuaiShou(createEvent()).Action(buildVideoData())

    expect(commentsMock).toHaveBeenCalledWith(
      expect.anything(),
      [{ name: '[大笑]', url: 'https://static.kuaishou.com/daxiao.png' }],
      DEFAULT_LIMIT
    )
  })

  // 表情表的两种嵌套深度都见过，剥壳后多一层 data 也得读得到
  it('reads the emoji icon urls through the extra data wrapper too', async () => {
    fetchEmojiMock.mockResolvedValueOnce({
      data: { data: { visionBaseEmoticons: { iconUrls: { '[抓狂]': '//static.kuaishou.com/zhuakuang.png' } } } }
    })

    await new KuaiShou(createEvent()).Action(buildVideoData())

    expect(commentsMock).toHaveBeenCalledWith(
      expect.anything(),
      [{ name: '[抓狂]', url: 'https://static.kuaishou.com/zhuakuang.png' }],
      DEFAULT_LIMIT
    )
  })
})

/*
  面板上「快手评论解析」和「快手评论数量」两项以前都是死的：
  `Config.kuaishou.comment` 从来没有代码读过，而数量那句 `numcomment ||
  kuaishounumcomments || 5` 会把用户设的 0 一路兜回 5。两个开关关掉都得真的关掉，
  而且不能顺带把视频也关掉。
*/
describe('KuaiShou.Action 的评论闸门', () => {
  it('comment 关掉时不出评论卡，视频照发', async () => {
    configMock.kuaishou.comment = false
    const event = createEvent()

    expect(await new KuaiShou(event).Action(buildVideoData())).toBe(true)

    expect(renderMock).not.toHaveBeenCalled()
    // 关掉了就别白发那两个请求
    expect(fetchCommentsMock).not.toHaveBeenCalled()
    expect(fetchEmojiMock).not.toHaveBeenCalled()
    expect(downloadVideoMock).toHaveBeenCalledTimes(1)
  })

  it('数量设成 0 时不出评论卡，视频照发', async () => {
    configMock.kuaishou.numcomment = 0
    const event = createEvent()

    expect(await new KuaiShou(event).Action(buildVideoData())).toBe(true)

    expect(renderMock).not.toHaveBeenCalled()
    expect(fetchCommentsMock).not.toHaveBeenCalled()
    expect(downloadVideoMock).toHaveBeenCalledTimes(1)
  })

  // 新键是 0 时不能掉进旧键：`??` 而不是 `||`，0 是用户在面板里选得出来的值
  it('新键 0 不会掉进旧键的 5', async () => {
    configMock.kuaishou.numcomment = 0
    configMock.kuaishou.kuaishounumcomments = 5

    await new KuaiShou(createEvent()).Action(buildVideoData())

    expect(renderMock).not.toHaveBeenCalled()
  })

  it('只配旧键时旧键生效，条数原样传给 comments()', async () => {
    configMock.kuaishou.kuaishounumcomments = 3

    await new KuaiShou(createEvent()).Action(buildVideoData())

    expect(commentsMock).toHaveBeenCalledWith(expect.anything(), [], 3)
  })

  it('两个键都配时新键优先', async () => {
    configMock.kuaishou.numcomment = 8
    configMock.kuaishou.kuaishounumcomments = 3

    await new KuaiShou(createEvent()).Action(buildVideoData())

    expect(commentsMock).toHaveBeenCalledWith(expect.anything(), [], 8)
  })

  // 没配过这一项的老用户不该被这次改动影响
  it('comment 键缺失时按开着算', async () => {
    expect('comment' in configMock.kuaishou).toBe(false)

    await new KuaiShou(createEvent()).Action(buildVideoData())

    expect(renderMock).toHaveBeenCalledWith('kuaishou/comment', expect.anything())
  })
})
