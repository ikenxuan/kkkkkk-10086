import { describe, expect, it } from 'vitest'
import type { RawKuaishouComment } from '../../src/module/platform/kuaishou/comments.js'

/*
  `comments()` 不再自己读配置：条数由调用点用 `kuaishouCommentLimit()` 算好传进来，
  所以这份用例里也没有 Config 替身了。键的新旧兜底（numcomment / kuaishounumcomments）
  改由 `kuaishou-action.test.ts` 在真正的闸门那一侧钉。
*/
const { default: comments, buildKuaishouRichText } = await import('../../src/module/platform/kuaishou/comments.js')

/** 大多数用例不关心条数，给一个不会截断的值 */
const NO_TRUNCATION = 30

const emojiData = [
  { name: '[大笑]', url: 'https://example.com/laugh.png' },
  { name: '[哭]', url: 'https://example.com/cry.png' },
  // 快手表情表里确实有不带中括号的名字，老实现遇到它会把整条评论替换成一张图
  { name: '奥特曼', url: 'https://example.com/ultraman.png' }
]

const wrap = (rootComments: RawKuaishouComment[]) => ({ data: { visionCommentList: { rootComments } } })

describe('buildKuaishouRichText', () => {
  it('emits a rich text document instead of an HTML string', async () => {
    const doc = buildKuaishouRichText('普通文字', emojiData)

    // 模板是 renderRichTextToReact(text, ...)，字符串会在 document.nodes.map() 上抛
    expect(doc.nodes).toEqual([expect.objectContaining({ type: 'text', text: '普通文字' })])
    expect(doc.platform).toBe('kuaishou')
  })

  it('keeps each emoji pointing at its own image', async () => {
    const doc = buildKuaishouRichText('前[大笑]中[哭]后', emojiData)

    // 老实现命中一个表情就把所有 [xxx] 换成同一张图
    expect(doc.nodes.filter(node => node.type === 'emoji')).toEqual([
      expect.objectContaining({ name: '[大笑]', src: 'https://example.com/laugh.png' }),
      expect.objectContaining({ name: '[哭]', src: 'https://example.com/cry.png' })
    ])
    expect(doc.nodes.map(node => node.type)).toEqual(['text', 'emoji', 'text', 'emoji', 'text'])
  })

  it('does not swallow the whole comment when an emoji name has no brackets', async () => {
    const doc = buildKuaishouRichText('我觉得奥特曼很强', emojiData)

    // 老实现在这种情况下把 text 整体替换成 <img src="ultraman.png"/>，正文全丢
    expect(doc.nodes.map(node => node.type)).toEqual(['text', 'emoji', 'text'])
    expect(doc.nodes[0]).toMatchObject({ text: '我觉得' })
    expect(doc.nodes[2]).toMatchObject({ text: '很强' })
  })

  it('drops emoji entries without a usable url instead of emitting an empty src', async () => {
    const doc = buildKuaishouRichText('前[大笑]后', [{ name: '[大笑]', url: '' }])

    expect(doc.nodes.map(node => node.type)).toEqual(['text'])
    expect(doc.nodes[0]).toMatchObject({ text: '前[大笑]后' })
  })

  it('turns @nickname(uid) into a mention node carrying the user id', async () => {
    const doc = buildKuaishouRichText('喊一下 @某个人(998877) 看看', emojiData)

    expect(doc.nodes).toEqual([
      expect.objectContaining({ type: 'text', text: '喊一下 ' }),
      expect.objectContaining({ type: 'mention', text: '@某个人', userId: '998877' }),
      expect.objectContaining({ type: 'text', text: ' 看看' })
    ])
  })

  it('does not let one mention pattern swallow the text between two mentions', async () => {
    const doc = buildKuaishouRichText('@甲(1) 中间的正文 @乙(2)', emojiData)

    // 老正则 /(@[\S\s]+?)\(\w+\)/g 是跨行懒匹配，这里会把「中间的正文」一起吃掉
    expect(doc.nodes.filter(node => node.type === 'mention')).toHaveLength(2)
    expect(doc.nodes.some(node => node.type === 'text' && node.text.includes('中间的正文'))).toBe(true)
  })

  it('splits newlines into line break nodes', async () => {
    const doc = buildKuaishouRichText('一行\r\n二行\n三行', emojiData)

    expect(doc.nodes.map(node => node.type)).toEqual(['text', 'lineBreak', 'text', 'lineBreak', 'text'])
  })

  it('returns an empty document for missing content', async () => {
    expect(buildKuaishouRichText(undefined, emojiData).nodes).toEqual([])
  })
})

describe('kuaishou comments payload', () => {
  it('hands the template raw numbers so its own formatters still work', async () => {
    const now = 1700000000000
    const result = await comments(wrap([
      { commentId: 'c-1', authorName: '一号', headurl: 'a.png', content: '甲', timestamp: now, realLikedCount: 23456, likedCount: 1, subCommentCount: 7 }
    ]), emojiData, NO_TRUNCATION)

    // 点赞数转成 '2.3w' 字符串会让模板里的 `count >= 10000` 恒为 false，万位换算等于被废掉
    expect(result[0].digg_count).toBe(23456)
    // 时间戳必须是毫秒数字：老实现塞 '3分钟前'，模板 `if (!timestamp)` 拦不住非空字符串，
    // 一路走到 date-fns 的 format(Invalid Date) 抛 RangeError
    expect(result[0].create_time).toBe(now)
    expect(result[0].reply_comment_total).toBe(7)
  })

  it('falls back to likedCount when realLikedCount is absent', async () => {
    const result = await comments(wrap([{ commentId: 'c-1', content: '甲', likedCount: 88 }]), emojiData, NO_TRUNCATION)

    expect(result[0].digg_count).toBe(88)
  })

  it('defaults every required contract field instead of leaking undefined', async () => {
    const result = await comments(wrap([{}]), emojiData, NO_TRUNCATION)

    expect(result[0]).toMatchObject({
      cid: '',
      aweme_id: '',
      nickname: '',
      userimageurl: '',
      digg_count: 0,
      create_time: 0,
      reply_comment_total: 0
    })
    expect(result[0].text.nodes).toEqual([])
  })

  it('sorts by like count and truncates to the limit it is handed', async () => {
    const result = await comments(wrap([
      { commentId: 'low', content: '低', likedCount: 1 },
      { commentId: 'high', content: '高', likedCount: 999 },
      { commentId: 'mid', content: '中', likedCount: 50 }
    ]), emojiData, 2)

    expect(result.map(item => item.cid)).toEqual(['high', 'mid'])
  })

  // 0 的语义是「不发评论图」，调用点靠它决定整条支线要不要跑；真传进来也不该切出东西
  it.each([[0], [-1]])('limit 为 %p 时一条都不留', async (limit) => {
    const result = await comments(wrap([
      { commentId: 'a', content: '甲', likedCount: 2 },
      { commentId: 'b', content: '乙', likedCount: 1 }
    ]), emojiData, limit)

    expect(result).toEqual([])
  })

  it('returns an empty list when the payload carries no comments', async () => {
    await expect(comments(undefined, emojiData, NO_TRUNCATION)).resolves.toEqual([])
    await expect(comments(wrap([]), emojiData, NO_TRUNCATION)).resolves.toEqual([])
  })

  it('reads the flattened payload shape as well', async () => {
    const result = await comments(
      { visionCommentList: { rootComments: [{ commentId: 'c-1', content: '甲' }] } },
      emojiData,
      NO_TRUNCATION
    )

    expect(result).toHaveLength(1)
  })
})
