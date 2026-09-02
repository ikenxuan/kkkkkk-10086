import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 一张评论配图取不到，不能把整批评论图带走。
 *
 * 回归背景：`processCommentImage` 里那次 HEIC 探测原来是裸 await，线上抖音图床
 * ETIMEDOUT 时异常穿透 `douyinComments` 的 `for...of` —— 已经解析好、已经拉完子评论的
 * 评论连同 `imageUrls` 一起随栈销毁，`Render('douyin/comment')` 压根没执行，
 * 用户侧一句提示都没有，只有日志里一行「评论图渲染与发送任务失败」。
 */
vi.stubGlobal('logger', {
  debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), mark: vi.fn()
})

const networksOptions = vi.hoisted(() => [] as Array<Record<string, unknown>>)
const getHeadersMock = vi.hoisted(() => vi.fn())
const requestMock = vi.hoisted(() => vi.fn())

vi.mock('../../src/module/utils/index.js', () => ({
  Config: { douyin: { subCommentLimit: 3 }, cookies: { douyin: '' } },
  baseHeaders: {},
  Networks: class Networks {
    constructor (options: Record<string, unknown>) { networksOptions.push(options) }
    getHeaders = getHeadersMock
    request = requestMock
  }
}))

vi.mock('../../src/module/utils/amagiClient.js', () => ({
  buildAmagiRequestConfig: () => ({}),
  douyinFetcher: { fetchCommentReplies: vi.fn(async () => ({ data: { comments: null } })) }
}))

vi.mock('heic-convert', () => ({ default: vi.fn(async () => Buffer.from('jpeg-bytes')) }))

const { douyinComments } = await import('../../src/module/platform/douyin/comments.js')
const { default: convert } = await import('heic-convert')

/** 不给 cid / aweme_id：`fetchReplyComments` 会当场返回 []，这份用例不碰子评论 */
const withImage = (url: string, diggCount: number, text = '正文'): Record<string, unknown> => ({
  user: { nickname: '甲', avatar_thumb: { url_list: ['https://example.com/avatar.jpg'] } },
  text,
  create_time: 1,
  digg_count: diggCount,
  image_list: [{ origin_url: { url_list: [url] } }]
})

const run = async (comments: Array<Record<string, unknown>>) =>
  await douyinComments({ data: { comments } } as never)

beforeEach(() => {
  networksOptions.length = 0
  getHeadersMock.mockReset()
  requestMock.mockReset()
  vi.mocked(convert).mockReset()
  vi.mocked(convert).mockResolvedValue(Buffer.from('jpeg-bytes') as never)
})

describe('评论配图的失败降级', () => {
  it('探测失败时按原图渲染，且不带走同一批的其它评论', async () => {
    getHeadersMock
      .mockRejectedValueOnce(Object.assign(new Error('connect ETIMEDOUT 36.249.93.217:443'), { code: 'ETIMEDOUT' }))
      .mockResolvedValue({ 'content-type': 'image/jpeg' })

    const result = await run([
      withImage('https://p11-sign.douyinpic.com/first.image', 2),
      withImage('https://p11-sign.douyinpic.com/second.image', 1, '第二条')
    ])

    expect(result.CommentsData).toHaveLength(2)
    expect(result.CommentsData.map(comment => comment.commentimage)).toEqual([
      'https://p11-sign.douyinpic.com/first.image',
      'https://p11-sign.douyinpic.com/second.image'
    ])
    // 收集列表也要留住，「评论图片收集」的合并转发读的是它
    expect(result.image_url).toEqual([
      'https://p11-sign.douyinpic.com/first.image',
      'https://p11-sign.douyinpic.com/second.image'
    ])
  })

  it('HEIC 转码失败同样退回原图', async () => {
    // heic-convert 拿到非 HEIC 输入会抛 TypeError，探测判对了也不代表转得动
    getHeadersMock.mockResolvedValue({ 'content-type': 'image/heic' })
    requestMock.mockResolvedValue({ data: Buffer.from('not-really-heic') })
    vi.mocked(convert).mockRejectedValueOnce(new TypeError('input buffer is not a HEIC image'))

    const result = await run([withImage('https://p11-sign.douyinpic.com/broken.heic', 1)])

    expect(result.CommentsData[0]!.commentimage).toBe('https://p11-sign.douyinpic.com/broken.heic')
  })

  it('探测请求不吃默认的 3 秒与 3 次重试', async () => {
    getHeadersMock.mockResolvedValue({ 'content-type': 'image/jpeg' })

    await run([withImage('https://p11-sign.douyinpic.com/first.image', 1)])

    // 默认值最坏 3s × 4 次尝试 + 1/2/3s 退避 ≈ 18 秒，而评论是串行探测的
    expect(networksOptions[0]).toMatchObject({ headersTimeout: 8000, maxRetries: 0 })
  })

  it('真是 HEIC 时照旧转成 data URL', async () => {
    getHeadersMock.mockResolvedValue({ 'content-type': 'image/heic' })
    requestMock.mockResolvedValue({ data: Buffer.from('heic-bytes') })

    const result = await run([withImage('https://p11-sign.douyinpic.com/real.heic', 1)])

    expect(result.CommentsData[0]!.commentimage).toMatch(/^data:image\/jpeg;base64,/)
    // 收集列表要的是宿主收得下的 base64:// 直链，不是 data URL
    expect(result.image_url[0]).toMatch(/^base64:\/\//)
  })
})
