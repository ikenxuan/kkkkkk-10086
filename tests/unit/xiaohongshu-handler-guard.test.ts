import { beforeEach, describe, expect, it, vi } from 'vitest'

const configMock = vi.hoisted(() => ({
  cookies: { xiaohongshu: 'xhs-cookie' },
  xiaohongshu: { sendContent: [] as string[], numcomment: 5 }
}))
const getXiaohongshuDataMock = vi.hoisted(() => vi.fn())
const renderMock = vi.hoisted(() => vi.fn())

vi.mock('../../src/module/utils/Config.js', () => ({
  default: configMock
}))

vi.mock('../../src/module/utils/Networks.js', () => ({
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

vi.mock('../../src/module/platform/xiaohongshu/api.js', () => ({
  getXiaohongshuData: getXiaohongshuDataMock
}))

const { Xiaohongshu, fetchConfiguredNoteComments } = await import('../../src/module/platform/xiaohongshu/xiaohongshu.js')

beforeEach(() => {
  configMock.cookies.xiaohongshu = 'xhs-cookie'
  configMock.xiaohongshu.sendContent = []
  configMock.xiaohongshu.numcomment = 5
  renderMock.mockReset()
  getXiaohongshuDataMock.mockReset()
  getXiaohongshuDataMock.mockResolvedValue({
    success: true,
    data: {
      data: {
        items: [{ note_card: { note_id: 'note-1' } }]
      }
    }
  })
})

describe('Xiaohongshu guarded Amagi integration', () => {
  it('loads note data through the guarded platform wrapper without a bound Amagi client', async () => {
    const reply = vi.fn()
    const handler = new Xiaohongshu({ reply } as never)

    await expect(handler.XiaohongshuHandler({ type: 'note', note_id: 'note-1', xsec_token: 'token-1' }))
      .resolves.toBe(true)

    expect(getXiaohongshuDataMock).toHaveBeenCalledWith('单个笔记数据', {
      typeMode: 'strict',
      note_id: 'note-1',
      xsec_token: 'token-1'
    })
    expect(reply).not.toHaveBeenCalled()
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
    getXiaohongshuDataMock.mockImplementation(async (method: string) => {
      if (method === '单个笔记数据') {
        return {
          success: true,
          data: {
            data: {
              items: [{ note_card: { note_id: 'note-1' } }]
            }
          }
        }
      }
      if (method === '表情列表') return { success: true }
      if (method === '评论数据') {
        const commentCalls = getXiaohongshuDataMock.mock.calls.filter(([name]) => name === '评论数据').length
        if (commentCalls === 1) {
          return {
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
          }
        }
        return {
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
        }
      }
      return { success: true }
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
})
