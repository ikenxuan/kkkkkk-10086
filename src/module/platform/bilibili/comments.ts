import {
  createEmojiNode,
  createLineBreakNode,
  createMentionNode,
  createRichTextDocument,
  createTextNode,
  type RichTextDocument,
  type RichTextNode
} from '@kkk/richtext'

/** 评论中的表情项 */
interface BilibiliCommentEmote {
  url: string
}

/** 评论用户信息，非可选字段即原实现直接取值、不做保护的字段 */
interface BilibiliCommentMember {
  mid?: string | number
  uname: string
  avatar: string
  pendant: { image: string }
  level_info: { current_level: number }
  vip: {
    /** 本文件沿用 vipStatus 判断大会员，与 bilibili.ts / push.ts 使用的 status 不同 */
    vipStatus?: number
    status: number
    nickname_color?: string
  }
}

/** 评论中被 @ 的用户 */
interface BilibiliCommentAtMember {
  mid?: string | number
  uname: string
}

/** 评论正文 */
interface BilibiliCommentContent {
  message: string
  emote?: Record<string, BilibiliCommentEmote>
  pictures?: Array<{ img_src: string }>
  members?: BilibiliCommentAtMember[]
}

/** 单条评论 */
interface BilibiliCommentReply {
  mid?: string | number
  ctime: number
  content: BilibiliCommentContent
  member: BilibiliCommentMember
  like: number
  rcount: number
  reply_control?: { location?: string, is_up_top?: boolean }
  /** 二级评论，接口最多带回三条 */
  replies?: BilibiliCommentReply[] | null
}

/** 评论接口响应，仅声明本文件读取的字段 */
export interface BilibiliCommentsData {
  code?: number
  data: {
    replies: BilibiliCommentReply[]
    /** UP 主信息，用来判断哪条评论顶着「UP主」标 */
    upper?: { mid?: string | number }
  }
}

/**
 * 表情占位符 → 行内表情节点。
 *
 * `content.emote` 是以 `[笑哭]` 这种字面量为键的表，把正文按这些键切开，
 * 命中的片段出 emoji 节点交给模板渲染 `<img>`，其余按普通文本走。
 * 原实现是直接把 `<img src=…>` 拼进字符串的，而模板走的是
 * `renderRichTextToReact(props.message)`，拼出来的标签只会被当纯文本印在卡片上。
 */
const splitByEmote = (text: string, emote: Record<string, BilibiliCommentEmote> | undefined): RichTextNode[] => {
  const names = Object.keys(emote ?? {}).filter(name => emote?.[name]?.url && text.includes(name))
  if (names.length === 0) return splitByLineBreak(text)

  // 长的键优先，避免 [笑] 把 [笑哭] 先切一半
  const pattern = new RegExp(
    `(${names.sort((a, b) => b.length - a.length).map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`
  )
  return text.split(pattern).flatMap((part): RichTextNode[] => {
    const url = emote?.[part]?.url
    return url ? [createEmojiNode(part, url)] : splitByLineBreak(part)
  })
}

/** 换行拆成 lineBreak 节点，原实现是把 `\n` 换成 `<br>` 字符串 */
const splitByLineBreak = (text: string): RichTextNode[] => {
  if (!text) return []
  return text.split(/(\r?\n)/).flatMap((part): RichTextNode[] =>
    part === '\n' || part === '\r\n' ? [createLineBreakNode()] : part ? [createTextNode(part)] : []
  )
}

/** `@昵称` → mention 节点，颜色由模板的 bilibiliMentionClassName 决定 */
const splitByMention = (nodes: RichTextNode[], members: BilibiliCommentAtMember[] | undefined): RichTextNode[] => {
  const names = (members ?? []).map(member => member.uname).filter(Boolean)
  if (names.length === 0) return nodes

  const pattern = new RegExp(
    `(${names.sort((a, b) => b.length - a.length).map(name => `@${name}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`
  )
  return nodes.flatMap((node): RichTextNode[] => {
    if (node.type !== 'text') return [node]
    return node.text.split(pattern).flatMap((part): RichTextNode[] => {
      if (!part) return []
      const member = (members ?? []).find(item => `@${item.uname}` === part)
      return member ? [createMentionNode(part, member.mid === undefined ? undefined : String(member.mid))] : [createTextNode(part)]
    })
  })
}

/** 评论正文 → 富文本文档 */
const buildCommentMessage = (content: BilibiliCommentContent): RichTextDocument =>
  createRichTextDocument(
    splitByMention(splitByEmote(content.message ?? '', content.emote), content.members),
    { platform: 'bilibili' }
  )

/** 评论配图，模板按数量决定单图铺满还是两张缩略图 + 「+N」 */
const buildCommentPictures = (content: BilibiliCommentContent): string[] =>
  (content.pictures ?? []).map(picture => picture?.img_src).filter((src): src is string => !!src)

/** IP 属地，接口给的是「IP属地：广东」 */
const buildCommentLocation = (reply: BilibiliCommentReply): string =>
  reply.reply_control?.location?.replace(/^IP属地[:：]?\s*/, '') || ''

/**
 * 大会员昵称颜色。原实现把整个昵称包成 `<span style=…>` 塞进 `uname`，
 * 而模板是 `uname` 出纯文本、颜色单独读 `unameColor`，
 * 于是那串 span 标签会连同尖括号一起印在卡片上。
 */
const buildUnameColor = (member: BilibiliCommentMember): string | null =>
  member.vip?.vipStatus === 1 ? (member.vip.nickname_color || '#FB7299') : null

/** 二级评论，字段是 SubCommentItem 的子集，没有置顶和回复数 */
const buildSubComment = (reply: BilibiliCommentReply, upperMid: string) => ({
  avatar: reply.member?.avatar ?? '',
  uname: reply.member?.uname ?? '',
  unameColor: buildUnameColor(reply.member),
  level: reply.member?.level_info?.current_level ?? 0,
  frame: reply.member?.pendant?.image ?? '',
  message: buildCommentMessage(reply.content ?? { message: '' }),
  pictures: buildCommentPictures(reply.content ?? { message: '' }),
  ctime: reply.ctime ?? 0,
  location: buildCommentLocation(reply),
  like: Number(reply.like ?? 0),
  isUP: !!upperMid && String(reply.mid ?? reply.member?.mid ?? '') === upperMid,
  vipstatus: reply.member?.vip?.status ?? 0
})

/**
 * B站评论数据 → `bilibili/comment` 契约的 `CommentsData`。
 *
 * 这里刻意不写返回类型标注：让 TS 推出字面量形状，四个
 * `Render('bilibili/comment', …)` 调用点就都会拿契约来校验它。
 *
 * 整个函数是从 art-template 时代重写的——原实现把等级图标 SVG、大会员 span、
 * 表情 `<img>`、`<br>` 全拼成 HTML 字符串塞进 `uname` / `message`，而 React 模板
 * 自己就会按 `level` 取 `/image/bilibili/level/lv{n}.svg`、按 `unameColor` 上色、
 * 用 `renderRichTextToReact` 渲染富文本，拼好的标签只会被当纯文本印出来。
 * 更要紧的是三处类型对不上，卡片根本渲染不出来：
 *
 * - `ctime` 原来给的是「3小时前」这种成品文案，而模板是
 *   `formatBilibiliCommentTime(ctime: number)`：`fromUnixTime('3小时前')` 得到
 *   Invalid Date，最后一行 `format(...)` 直接抛 RangeError，B站评论卡片必崩
 * - `like` 过万时原来被改写成 '1.2w' 字符串，而模板自己会做这个换算，
 *   拿到字符串就是 `count > 10000` 恒假、原样印出 '1.2w'
 * - 配图原来只留 `img_src` 一个字段，模板读的是 `pictures: string[]`，
 *   所以带图评论一张图都不显示
 *
 * 另外原来 code 为 404（评论区关闭）时返回 `null`，而模板是
 * `props.data.CommentsData.length > 0` 无守卫访问，同样直接崩；
 * 现在统一返回空数组，模板会走「暂无评论数据」那一支。
 *
 * @param commentsData 评论接口响应
 * @returns 契约形状的评论列表，按点赞降序
 */
export function bilibiliComments (commentsData: BilibiliCommentsData | undefined) {
  if (!commentsData || commentsData.code === 404) return []
  const upperMid = String(commentsData.data?.upper?.mid ?? '')

  return (commentsData.data?.replies ?? [])
    .filter((reply): reply is BilibiliCommentReply => !!reply)
    .map(reply => {
      const content = reply.content ?? { message: '' }
      const subReplies = (reply.replies ?? []).filter((item): item is BilibiliCommentReply => !!item)

      return {
        avatar: reply.member?.avatar ?? '',
        uname: reply.member?.uname ?? '',
        unameColor: buildUnameColor(reply.member),
        level: reply.member?.level_info?.current_level ?? 0,
        frame: reply.member?.pendant?.image ?? '',
        message: buildCommentMessage(content),
        pictures: buildCommentPictures(content),
        vipstatus: reply.member?.vip?.status ?? 0,
        ctime: reply.ctime ?? 0,
        location: buildCommentLocation(reply),
        replylength: Number(reply.rcount ?? 0),
        like: Number(reply.like ?? 0),
        isTop: reply.reply_control?.is_up_top === true,
        isUP: !!upperMid && String(reply.mid ?? reply.member?.mid ?? '') === upperMid,
        replies: subReplies.map(item => buildSubComment(item, upperMid))
      }
    })
    .sort((a, b) => b.like - a.like)
}
