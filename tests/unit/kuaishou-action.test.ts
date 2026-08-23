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
  CommentData: { data: { visionCommentList: { rootComments: [] } } },
  EmojiData: { data: { visionBaseEmoticons: { iconUrls: {} } } }
})

const createEvent = () => ({ reply: vi.fn().mockResolvedValue({ message_id: 1 }) })

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
  })

  it('announces the parse when the tip switch is enabled', async () => {
    configMock.app.parseTip = true
    const event = createEvent()

    await new KuaiShou(event).Action(buildVideoData())

    expect(event.reply).toHaveBeenCalledWith('检测到快手链接，开始解析')
  })
})
