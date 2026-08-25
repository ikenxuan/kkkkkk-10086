import { beforeEach, describe, expect, it, vi } from 'vitest'

const configMock = vi.hoisted(() => ({
  xiaohongshu: {} as Record<string, unknown>
}))

vi.mock('../../src/module/utils/Config.js', () => ({ default: configMock }))
// ImageHelper 会连带把宿主 runtime 拉进来（lib/config/config.js 在源码树里不存在），
// 而这组用例只走纯数据转换，不碰图片下载
vi.mock('../../src/module/utils/ImageHelper.js', () => ({ processImageUrl: vi.fn() }))

const { buildRenderComments } = await import('../../src/module/platform/xiaohongshu/comments.js')

beforeEach(() => {
  configMock.xiaohongshu = { numcomment: 10 }
})

/**
 * `xiaohongshu/comment` 模板把 ip_location 原样插进 JSX（`{props.ip_location}`），
 * 没有任何空值分支，所以这里给空串就是评论头上一段突兀的留白。
 * 上游兜的是「未知」，本仓库同文件的纯文本分支（formatCommentLine）兜的也是「未知」，
 * 只有渲染分支漏了 —— 这组用例把三处对齐钉住。
 */
describe('buildRenderComments ip_location 兜底', () => {
  const comment = (overrides: Record<string, unknown> = {}) => ({
    id: 'c1',
    user_info: { nickname: '张三' },
    show_tags: [],
    ...overrides
  })

  it('主评论缺少 ip_location 时兜「未知」而不是空串', () => {
    const [rendered] = buildRenderComments([comment()], [], 'note-1')

    expect(rendered?.ip_location).toBe('未知')
  })

  it('主评论 ip_location 为空串时同样兜「未知」', () => {
    const [rendered] = buildRenderComments([comment({ ip_location: '' })], [], 'note-1')

    expect(rendered?.ip_location).toBe('未知')
  })

  it('子评论缺少 ip_location 时兜「未知」', () => {
    const [rendered] = buildRenderComments(
      [comment({ sub_comments: [{ id: 'sub1', user_info: { nickname: '李四' } }] })],
      [],
      'note-1'
    )

    expect(rendered?.sub_comments[0]?.ip_location).toBe('未知')
  })

  it('有真实归属地时原样保留', () => {
    const [rendered] = buildRenderComments([comment({ ip_location: '广东' })], [], 'note-1')

    expect(rendered?.ip_location).toBe('广东')
  })
})

/**
 * 渲染列表按 getCommentLimit() 截断，模板头部的「评论数量」必须跟截断后的卡片数一致。
 * 这里钉住截断本身，调用点传给模板的 CommentLength 由 handler-guard 那组用例覆盖。
 */
describe('buildRenderComments 渲染条数受 numcomment 约束', () => {
  it('抓回来的条数超过 numcomment 时只渲染前 N 条', () => {
    configMock.xiaohongshu = { numcomment: 2 }
    const comments = Array.from({ length: 5 }, (_, index) => ({
      id: `c${index}`,
      user_info: { nickname: `u${index}` },
      show_tags: []
    }))

    expect(buildRenderComments(comments, [], 'note-1')).toHaveLength(2)
  })
})
