import {
  createEmojiNode,
  createLineBreakNode,
  createMentionNode,
  createRichTextDocument,
  createTextNode,
  type RichTextDocument,
  type RichTextNode
} from '@kkk/richtext'
import Config from '@/module/utils/Config'

/** 处理后的表情项 */
export interface KuaishouEmoji {
  name: string
  url: string
}

/** 渲染用的评论项，字段形状对齐 `kuaishou/comment` 契约 */
export interface KuaishouComment {
  id: number
  cid: string
  aweme_id: string
  nickname: string
  userimageurl: string
  text: RichTextDocument
  digg_count: number
  /** 毫秒时间戳，模板自己用 date-fns 转「x 分钟前」 */
  create_time: number
  reply_comment_total: number
}

/** 接口原样返回的评论项 */
export interface RawKuaishouComment {
  commentId?: string
  authorName?: string
  headurl?: string
  content?: string
  timestamp?: number
  likedCount?: number
  realLikedCount?: number
  subCommentCount?: number
}

/** 评论接口响应，两种嵌套深度都见过 */
export interface RawCommentPayload {
  data?: { visionCommentList?: { rootComments?: RawKuaishouComment[] } }
  visionCommentList?: { rootComments?: RawKuaishouComment[] }
}

interface MentionToken {
  start: number
  end: number
  text: string
  userId: string
}

/**
 * `@昵称(用户ID)` —— 快手把被 at 的用户 ID 放在紧跟昵称的括号里。
 * 昵称不含左括号和换行，比老那版 `@[\S\s]+?\(\w+\)` 精确：那个是跨行懒匹配，
 * 一条评论里有两个 @ 时会把中间的正文一起吞掉。
 */
const KUAISHOU_MENTION_PATTERN = /@([^\n(]+)\((\w+)\)/g

const collectMentionTokens = (text: string): MentionToken[] => {
  const tokens: MentionToken[] = []
  for (const match of text.matchAll(KUAISHOU_MENTION_PATTERN)) {
    const nickname = (match[1] || '').trim()
    if (!nickname) continue
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      text: `@${nickname}`,
      userId: match[2] || ''
    })
  }
  return tokens
}

/**
 * 评论正文 → 模板契约要的 {@link RichTextDocument}。
 *
 * 模板那边是 `renderRichTextToReact(props.text, ...)`，拿到字符串会直接在
 * `document.nodes.map()` 抛 `Cannot read properties of undefined (reading 'map')`，
 * 所以这里必须产出文档对象，不能再拼 HTML 字符串。
 *
 * 老实现是 art-template 时代留下的：把表情替换成 `<img src>`、换行换成 `<br>`、
 * @ 换成 `<span style>`，交给 React 只会被转义成可见的标签文本 —— 而且那段表情
 * 替换本身就是坏的：命中一个表情就把正文里所有 `[xxx]` 全换成同一张图，
 * 表情名不带中括号时更是把整条评论直接替换成一张图。
 */
export const buildKuaishouRichText = (
  text: string | undefined,
  emojiData: KuaishouEmoji[] = []
): RichTextDocument => {
  const raw = String(text || '')
  const nodes: RichTextNode[] = []
  const toDocument = (): RichTextDocument => createRichTextDocument(nodes, { platform: 'kuaishou' })
  if (!raw) return toDocument()

  // 长的排前面，避免 `[大笑]` 被 `[大]` 之类的短名抢先匹配
  const emojiTokens = emojiData
    .filter(item => Boolean(item?.name) && Boolean(item?.url))
    .sort((a, b) => b.name.length - a.name.length)
  const mentionTokens = collectMentionTokens(raw)

  let buffer = ''
  let index = 0
  const pushBuffer = (): void => {
    if (buffer) {
      nodes.push(createTextNode(buffer))
      buffer = ''
    }
  }

  while (index < raw.length) {
    const mention = mentionTokens.find(item => item.start === index)
    if (mention) {
      pushBuffer()
      nodes.push(createMentionNode(mention.text, mention.userId))
      index = mention.end
      continue
    }

    if (raw[index] === '\r' || raw[index] === '\n') {
      pushBuffer()
      index += raw[index] === '\r' && raw[index + 1] === '\n' ? 2 : 1
      nodes.push(createLineBreakNode())
      continue
    }

    const emoji = emojiTokens.find(item => raw.startsWith(item.name, index))
    if (emoji) {
      pushBuffer()
      nodes.push(createEmojiNode(emoji.name, emoji.url))
      index += emoji.name.length
      continue
    }

    buffer += raw[index]
    index += 1
  }

  pushBuffer()
  return toDocument()
}

/**
 * 处理快手评论数据
 * @param data 完整的评论数据
 * @param emojidata 处理过后的 emoji 列表
 */
export default async function comments (
  data: RawCommentPayload | null | undefined,
  emojidata: KuaishouEmoji[]
): Promise<KuaishouComment[]> {
  const rootComments = data?.data?.visionCommentList?.rootComments || data?.visionCommentList?.rootComments || []
  if (!Array.isArray(rootComments) || rootComments.length === 0) return []

  const jsonArray: KuaishouComment[] = rootComments
    .filter((item): item is RawKuaishouComment => Boolean(item))
    .map((item, index) => ({
      id: index + 1,
      cid: item.commentId || '',
      aweme_id: item.commentId || '',
      nickname: item.authorName || '',
      userimageurl: item.headurl || '',
      text: buildKuaishouRichText(item.content, emojidata),
      // 点赞数保持原始数字：模板里 formatKuaishouLikeCount(count: number) 自己做万位换算，
      // 这边再转成 '1.2w' 字符串的话 `count >= 10000` 恒为 false，等于把它的换算废掉
      digg_count: Number(item.realLikedCount ?? item.likedCount) || 0,
      // 快手给的是毫秒，模板 formatKuaishouCommentTime 要的也是毫秒。
      // 老实现在这里塞 '3分钟前' 这种文本，模板 `if (!timestamp) return ''` 拦不住非空字符串，
      // 一路走到 date-fns 的 `format(Invalid Date, 'yyyy-MM-dd')` 抛 RangeError（实测必炸）
      create_time: Number(item.timestamp) || 0,
      reply_comment_total: item.subCommentCount || 0
    }))
    // 按照点赞量降序
    .sort((a, b) => b.digg_count - a.digg_count)

  // 从数组前方开始保留 Config.kuaishou.kuaishounumcomments 条评论，自动移除数组末尾的评论
  const limit = Config.kuaishou.numcomment || Config.kuaishou.kuaishounumcomments || 5
  return jsonArray.slice(0, Math.min(jsonArray.length, limit))
}
