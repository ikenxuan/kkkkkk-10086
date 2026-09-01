import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { xiaohongshuFetcher } from '../../src/module/utils/amagiClient.js'

/**
 * 取数方法名的全集。下面的期望数组都用 `satisfies` 钉在它上面：`toEqual` 的形参是
 * 无约束泛型，光写字面量的话上游改名后这里会静默变成「断言一串谁也不会调用的名字」。
 */
type XiaohongshuApiMethod = keyof typeof xiaohongshuFetcher

const configMock = vi.hoisted(() => ({
  app: { parseTip: false },
  cookies: { xiaohongshu: 'xhs-cookie' },
  xiaohongshu: { sendContent: [] as string[], numcomment: 5 }
}))

/**
 * 裸 fetcher 上只列被测那条路会用到的三个方法，而且都是具名 handle：
 * 写成 `new Proxy({}, { get: () => vi.fn() })` 的话每次属性访问都是一个新 `vi.fn()`，
 * 调用断言永远拿不到收到调用的那一份。
 *
 * `requestConfig` 是个哨兵值，用来认第三个实参真的到位 —— 小红书不在 `Base.amagi`
 * 的错误卡片包装里（那层只包 bilibili / douyin），cookie 和请求配置都得由调用点自己带。
 */
const api = vi.hoisted(() => {
  const requestConfig = { timeout: 15_000 }
  return {
    requestConfig,
    buildAmagiRequestConfig: vi.fn(() => requestConfig),
    fetcher: {
      fetchNoteDetail: vi.fn(),
      fetchEmojiList: vi.fn(),
      fetchNoteComments: vi.fn()
    } satisfies Partial<Record<XiaohongshuApiMethod, unknown>>
  }
})
const renderMock = vi.hoisted(() => vi.fn())

vi.mock('../../src/module/utils/Config.js', () => ({
  default: configMock
}))

vi.mock('../../src/module/utils/Network/index.js', () => ({
  baseHeaders: {}
}))

vi.mock('../../src/module/utils/Render.js', () => ({
  Render: renderMock
}))

vi.mock('../../src/module/utils/Common.js', () => ({
  default: { removeFile: vi.fn() }
}))

vi.mock('../../src/module/utils/ImageHelper.js', () => ({
  processImageUrl: vi.fn()
}))

vi.mock('../../src/runtime/host/common.js', () => ({
  default: { makeForwardMsg: vi.fn() }
}))

vi.mock('../../src/module/platform/xiaohongshu/livePhoto.js', () => ({
  buildLivePhotoMessages: vi.fn(),
  // 批量入口的默认返回：results 为空 => 每张图都走普通图片回退分支。
  buildLivePhotoMessagesBatch: vi.fn(async () => ({ results: [], tempFiles: [], generatedLivePhoto: false })),
  buildLivePhotoTipMessage: vi.fn(),
  pickXiaohongshuImageUrl: vi.fn()
}))

// comments.js 不打桩：分页取数的 getCommentLimit、渲染 payload 的 buildRenderComments
// 都在里面，桩掉「置顶排在前面」这条就没在验真东西了。Config / ImageHelper 已经打过桩，
// 真模块跑起来没有外部依赖（表情列表拿 { success: true } 时 buildXiaohongshuEmojiList 自然返回 []）。

vi.mock('../../src/module/utils/Base.js', () => ({
  Base: class {
    e: unknown

    constructor (e: unknown) {
      this.e = e
    }
  },
  downloadVideo: vi.fn()
}))

vi.mock('../../src/module/utils/amagiClient.js', () => ({
  xiaohongshuFetcher: api.fetcher,
  buildAmagiRequestConfig: api.buildAmagiRequestConfig
}))

const { Xiaohongshu, fetchConfiguredNoteComments } = await import('../../src/module/platform/xiaohongshu/xiaohongshu.js')

/** 这次解析真正打过的取数方法，按名字排好序便于比对 */
const touchedApiMethods = (): XiaohongshuApiMethod[] => {
  const methods = Object.keys(api.fetcher) as Array<keyof typeof api.fetcher>
  return methods.filter(method => api.fetcher[method].mock.calls.length > 0).sort()
}

beforeEach(() => {
  configMock.app.parseTip = false
  configMock.cookies.xiaohongshu = 'xhs-cookie'
  configMock.xiaohongshu.sendContent = []
  configMock.xiaohongshu.numcomment = 5
  renderMock.mockReset()
  for (const method of Object.values(api.fetcher)) method.mockReset()
  api.fetcher.fetchNoteDetail.mockResolvedValue({
    success: true,
    data: {
      data: {
        items: [{ note_card: { note_id: 'note-1' } }]
      }
    }
  })
  api.fetcher.fetchEmojiList.mockResolvedValue({ success: true })
  api.fetcher.fetchNoteComments.mockResolvedValue({ success: true })
})

describe('Xiaohongshu guarded Amagi integration', () => {
  it('loads note data through the shared fetcher with an explicit cookie, not a bound client', async () => {
    const reply = vi.fn()
    const handler = new Xiaohongshu({ reply } as never)

    await expect(handler.XiaohongshuHandler({ type: 'note', note_id: 'note-1', xsec_token: 'token-1' }))
      .resolves.toBe(true)

    expect(api.fetcher.fetchNoteDetail).toHaveBeenCalledWith(
      { typeMode: 'strict', note_id: 'note-1', xsec_token: 'token-1' },
      'xhs-cookie',
      api.requestConfig
    )
    // sendContent 为空时除了笔记详情一个接口都不该碰
    expect(touchedApiMethods()).toEqual(['fetchNoteDetail'] satisfies XiaohongshuApiMethod[])
    expect(reply).not.toHaveBeenCalled()
  })

  /**
   * 上游在取数之前就会回一句「检测到小红书链接，开始解析」，本仓库的 bilibili/douyin/kuaishou
   * 也都有，只有小红书漏了 —— 开了 parseTip 的用户在小红书链接上看不到任何反馈。
   */
  it('replies with the parse tip when parseTip is enabled', async () => {
    configMock.app.parseTip = true
    const reply = vi.fn()
    const handler = new Xiaohongshu({ reply } as never)

    await expect(handler.XiaohongshuHandler({ type: 'note', note_id: 'note-1', xsec_token: 'token-1' }))
      .resolves.toBe(true)

    expect(reply).toHaveBeenCalledWith('检测到小红书链接，开始解析')
  })

  it('stays silent when parseTip is disabled', async () => {
    configMock.app.parseTip = false
    const reply = vi.fn()
    const handler = new Xiaohongshu({ reply } as never)

    await handler.XiaohongshuHandler({ type: 'note', note_id: 'note-1', xsec_token: 'token-1' })

    expect(reply).not.toHaveBeenCalledWith('检测到小红书链接，开始解析')
  })
})

describe('Xiaohongshu paginated comments', () => {
  it('fetches additional pages until the configured comment count is reached', async () => {
    configMock.xiaohongshu.numcomment = 3
    const fetchComments = vi.fn()
      .mockResolvedValueOnce({
        success: true,
        data: {
          data: {
            comments: [{ id: 'comment-1' }],
            cursor: 'cursor-1',
            has_more: true
          }
        }
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          data: {
            comments: [{ id: 'comment-2' }, { id: 'comment-3' }],
            cursor: 'cursor-2',
            has_more: true
          }
        }
      })

    const result = await fetchConfiguredNoteComments(
      { type: 'note', note_id: 'note-1', xsec_token: 'token-1' },
      fetchComments
    )

    expect(fetchComments).toHaveBeenCalledTimes(2)
    expect(fetchComments).toHaveBeenNthCalledWith(1, {
      typeMode: 'strict',
      note_id: 'note-1',
      xsec_token: 'token-1'
    })
    expect(fetchComments).toHaveBeenNthCalledWith(2, {
      typeMode: 'strict',
      note_id: 'note-1',
      cursor: 'cursor-1',
      xsec_token: 'token-1'
    })
    expect(result.data?.data?.comments).toEqual([
      { id: 'comment-1' },
      { id: 'comment-2' },
      { id: 'comment-3' }
    ])
  })

  /**
   * 不传 fetchComments 时的默认取数：走模块级 fetcher，cookie 与请求配置由调用点自己带。
   * 这条链路上没有绑定 cookie 的 client，漏掉第二个实参就是一次未登录请求。
   */
  it('falls back to the shared fetcher when no comment fetcher is injected', async () => {
    configMock.xiaohongshu.numcomment = 1
    api.fetcher.fetchNoteComments.mockResolvedValue({
      success: true,
      data: { data: { comments: [{ id: 'comment-1' }], has_more: false } }
    })

    const result = await fetchConfiguredNoteComments({ type: 'note', note_id: 'note-1', xsec_token: 'token-1' })

    expect(api.fetcher.fetchNoteComments).toHaveBeenCalledWith(
      { typeMode: 'strict', note_id: 'note-1', xsec_token: 'token-1' },
      'xhs-cookie',
      api.requestConfig
    )
    expect(result.data?.data?.comments).toEqual([{ id: 'comment-1' }])
  })
})
describe('Xiaohongshu comment pagination stop conditions', () => {
  it('does not request another page when the first page already reaches numcomment', async () => {
    configMock.xiaohongshu.numcomment = 2
    const fetchComments = vi.fn().mockResolvedValue({
      data: {
        data: {
          comments: [{ id: 'comment-1' }, { id: 'comment-2' }],
          cursor: 'cursor-1',
          has_more: true
        }
      }
    })

    const result = await fetchConfiguredNoteComments(
      { type: 'note', note_id: 'note-1', xsec_token: 'token-1' },
      fetchComments
    )

    expect(fetchComments).toHaveBeenCalledTimes(1)
    expect(result.data?.data?.comments).toHaveLength(2)
  })

  it('stops when the response says there are no more pages', async () => {
    configMock.xiaohongshu.numcomment = 4
    const fetchComments = vi.fn().mockResolvedValue({
      data: {
        data: {
          comments: [{ id: 'comment-1' }],
          cursor: 'cursor-1',
          has_more: false
        }
      }
    })

    const result = await fetchConfiguredNoteComments(
      { type: 'note', note_id: 'note-1', xsec_token: 'token-1' },
      fetchComments
    )

    expect(fetchComments).toHaveBeenCalledTimes(1)
    expect(result.data?.data?.comments).toEqual([{ id: 'comment-1' }])
  })

  it('stops when a cursor repeats instead of requesting the same page forever', async () => {
    configMock.xiaohongshu.numcomment = 5
    const fetchComments = vi.fn()
      .mockResolvedValueOnce({
        data: {
          data: {
            comments: [{ id: 'comment-1' }],
            cursor: 'cursor-1',
            has_more: true
          }
        }
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            comments: [{ id: 'comment-2' }],
            cursor: 'cursor-1',
            has_more: true
          }
        }
      })

    const result = await fetchConfiguredNoteComments(
      { type: 'note', note_id: 'note-1', xsec_token: 'token-1' },
      fetchComments
    )

    expect(fetchComments).toHaveBeenCalledTimes(2)
    expect(result.data?.data?.comments).toEqual([
      { id: 'comment-1' },
      { id: 'comment-2' }
    ])
  })

  it('does not request a page when has_more is true but the cursor is empty', async () => {
    configMock.xiaohongshu.numcomment = 5
    const fetchComments = vi.fn().mockResolvedValue({
      data: {
        data: {
          comments: [{ id: 'comment-1' }],
          cursor: '',
          has_more: true
        }
      }
    })

    await fetchConfiguredNoteComments(
      { type: 'note', note_id: 'note-1', xsec_token: 'token-1' },
      fetchComments
    )

    expect(fetchComments).toHaveBeenCalledTimes(1)
  })
})

describe('Xiaohongshu comment rendering after pagination', () => {
  it('keeps pinned comments ahead of later pages and retains the configured render limit', async () => {
    configMock.xiaohongshu.sendContent = ['comment']
    configMock.xiaohongshu.numcomment = 2
    api.fetcher.fetchNoteComments
      .mockResolvedValueOnce({
        success: true,
        data: {
          data: {
            comments: [
              { id: 'regular', user_info: { nickname: 'regular' }, show_tags: [] }
            ],
            cursor: 'cursor-1',
            has_more: true
          }
        }
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          data: {
            comments: [
              { id: 'pinned', user_info: { nickname: 'pinned' }, show_tags: ['user_top'] }
            ],
            cursor: 'cursor-2',
            has_more: false
          }
        }
      })
    renderMock.mockResolvedValue('rendered-comment-image')

    const handler = new Xiaohongshu({ reply: vi.fn() } as never)
    await handler.XiaohongshuHandler({ type: 'note', note_id: 'note-1', xsec_token: 'token-1' })

    expect(renderMock).toHaveBeenCalledWith('xiaohongshu/comment', expect.objectContaining({
      CommentLength: 2,
      CommentsData: [
        expect.objectContaining({ id: 'pinned', show_tags: ['user_top'] }),
        expect.objectContaining({ id: 'regular' })
      ]
    }))
  })

  /**
   * 分页取数为了凑够 numcomment 条会把整页拿回来，comments 往往比真正渲染的多。
   * CommentLength 是模板头部那句「评论数量：N条」，跟卡片数对不上就是明摆着的错数：
   * 限 2 条却写「评论数量：5条」。
   */
  it('reports the rendered comment count, not the fetched page size', async () => {
    configMock.xiaohongshu.sendContent = ['comment']
    configMock.xiaohongshu.numcomment = 2
    // 一页就返回 5 条，超过 numcomment=2
    api.fetcher.fetchNoteComments.mockResolvedValue({
      success: true,
      data: {
        data: {
          comments: Array.from({ length: 5 }, (_, index) => ({
            id: `c${index}`,
            user_info: { nickname: `u${index}` },
            show_tags: []
          })),
          has_more: false
        }
      }
    })
    renderMock.mockResolvedValue('rendered-comment-image')

    const handler = new Xiaohongshu({ reply: vi.fn() } as never)
    await handler.XiaohongshuHandler({ type: 'note', note_id: 'note-1', xsec_token: 'token-1' })

    const payload = renderMock.mock.calls.find(([template]) => template === 'xiaohongshu/comment')?.[1]
    expect(payload.CommentsData).toHaveLength(2)
    expect(payload.CommentLength).toBe(2)
  })
})
