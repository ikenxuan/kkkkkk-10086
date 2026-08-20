import type { AxiosRequestConfig } from 'axios'
import Config from '@/module/utils/Config'
import { processImageUrl } from '@/module/utils/ImageHelper'
import {
  createEmojiNode,
  createLineBreakNode,
  createMentionNode,
  createRichTextDocument,
  createTextNode,
  createTopicNode,
  createWebLinkNode,
  type RichTextDocument,
  type RichTextNode
} from '@kkk/richtext'

/** 小红书表情项 */
export interface XiaohongshuEmoji {
  name: string
  url?: string
}

/** 评论用户信息 */
export interface XiaohongshuUserInfo {
  nickname?: string
  nick_name?: string
  user_id?: string
  id?: string
  image?: string
  avatar?: string
  avatar_url?: string
  avatar_url_default?: string
  xsec_token?: string
}

/** 图片资源，可能是字符串或多种字段的对象 */
export type XiaohongshuPicture = string | {
  height?: number | string
  width?: number | string
  url_default?: string
  url_pre?: string
  url?: string
  info_list?: Array<{ image_scene?: string, url?: string }>
}

/** @ 用户项 */
export type XiaohongshuAtUser = string | {
  nickname?: string
  user_info?: { nickname?: string }
}

/** 评论标签项 */
export type XiaohongshuTag = string | { name?: string, tag?: string }

/** 评论原始数据 */
export interface XiaohongshuComment {
  id?: string
  comment_id?: string
  note_id?: string
  user_info?: XiaohongshuUserInfo
  content?: string
  at_users?: XiaohongshuAtUser[]
  create_time?: number | string
  ip_location?: string
  like_count?: number | string
  liked?: boolean
  status?: number | string
  show_tags?: XiaohongshuTag[]
  sub_comment_count?: number
  pictures?: XiaohongshuPicture[]
  sub_comments?: XiaohongshuComment[]
}

/** 表情列表接口返回结构 */
interface EmojiTab {
  collection?: Array<{ emoji?: Array<{ image_name?: string, image?: string }> }>
}

interface EmojiPayload {
  data?: { data?: { emoji?: { tabs?: EmojiTab[] } }, emoji?: { tabs?: EmojiTab[] } }
  emoji?: { tabs?: EmojiTab[] }
}

/** 文本构建选项 */
export interface BuildTextOptions {
  stripTopicMarker?: boolean
}

/** 评论图片处理选项 */
export interface CommentImageOptions {
  title?: string
  headers?: AxiosRequestConfig['headers']
}

const formatCount = (value: number | string | undefined): number | string => value ?? 0

/** 配置里的评论条数，最少 1 条 */
export const getCommentLimit = (): number =>
  Math.max(1, Number(Config.xiaohongshu.numcomment || 5))

/**
 * 时间戳 → `YYYY-MM-DD HH:mm` 文本，只给纯文本转发消息和笔记头部用。
 *
 * 注意别拿它填模板里的 `create_time`：评论契约要的是毫秒 number，
 * 而这里拿不到时间会返回 `'未知时间'` —— 模板的 `if (!timestamp) return ''` 拦不住
 * 非空字符串，一路走到 date-fns 的 `format(Invalid Date, ...)` 抛
 * `RangeError: Invalid time value`（实测必炸）。要数字请用 {@link toMilliseconds}。
 */
export const formatTime = (timestamp: number | string | undefined): string => {
  const time = Number(timestamp)
  if (!time) return '未知时间'
  const date = new Date(time < 10000000000 ? time * 1000 : time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** 时间戳 → 毫秒。小红书同一个字段混着给秒和毫秒，拿不到就给 0（模板会当成空时间跳过） */
export const toMilliseconds = (timestamp: number | string | undefined): number => {
  const time = Number(timestamp)
  if (!Number.isFinite(time) || time <= 0) return 0
  return time < 10000000000 ? time * 1000 : time
}

export const normalizeTagNames = (tags: XiaohongshuTag[] | undefined): string[] => {
  if (!Array.isArray(tags)) return []
  return tags
    .map(tag => {
      if (typeof tag === 'string') return tag
      if (tag && typeof tag === 'object') return tag.name || tag.tag || ''
      return ''
    })
    .filter(Boolean)
}

/** `@昵称` 列表归一：统一带上一个 `@` 前缀，空项丢掉 */
export const normalizeAtUsers = (atUsers: XiaohongshuAtUser[] | undefined): string[] => {
  if (!Array.isArray(atUsers)) return []
  return atUsers
    .map(item => {
      if (typeof item === 'string' && item.trim()) return `@${item.trim().replace(/^@/, '')}`
      const nickname = typeof item === 'string' ? undefined : item?.nickname || item?.user_info?.nickname
      return nickname ? `@${String(nickname).trim().replace(/^@/, '')}` : ''
    })
    .filter(Boolean)
}

export const buildXiaohongshuEmojiList = (data: EmojiPayload | undefined): XiaohongshuEmoji[] => {
  const tabs = data?.data?.data?.emoji?.tabs || data?.data?.emoji?.tabs || data?.emoji?.tabs || []
  const result: XiaohongshuEmoji[] = []
  for (const tab of tabs) {
    for (const collection of tab?.collection || []) {
      for (const emoji of collection?.emoji || []) {
        if (emoji?.image_name) result.push({ name: emoji.image_name, url: emoji.image })
      }
    }
  }
  return result
}

export const buildXiaohongshuText = (
  text: string | undefined,
  emojiData: XiaohongshuEmoji[] = [],
  atUsers: XiaohongshuAtUser[] = [],
  options: BuildTextOptions = {}
): string => {
  let output = String(text || '')
  if (options.stripTopicMarker) output = output.replace(/\[话题\]/g, '')

  for (const mention of normalizeAtUsers(atUsers)) {
    const raw = mention.replace(/^@/, '')
    // 别把已经带 @ 的昵称再加一遍，否则出 `@@昵称`
    output = output.replaceAll(mention, raw).replaceAll(raw, mention)
  }

  // 表情在纯文本里就保持 `[表情名]` 字面量，emojiData 只在富文本版用得上
  return output.trim()
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 富文本分词器：把 @昵称 / `[表情名]` / #话题# 拿出来，其余留给纯文本处理。
 *
 * `@` 后面的昵称可以带空格，所以不能用 `@\S+`，只能拿 `at_users` 里的真实昵称
 * 逐个建分支；长的排前面，避免「@小明」被「@小」抢先匹配。
 */
const buildXiaohongshuTokenRegExp = (mentions: string[]): RegExp => {
  const parts = mentions
    .map(name => name.replace(/^@/, ''))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    // 正文里可能带 @ 也可能不带（两种响应都见过），所以 @ 是可选的
    .map(name => `@?${escapeRegExp(name)}`)

  parts.push(
    '\\[[^[\\]]+\\]', // 表情字面量：[微笑R]
    '#[^#\\n]+#' // 话题：#话题名#
  )
  return new RegExp(parts.join('|'), 'g')
}

/** 纯文本 → 富文本节点：换行拆 lineBreak，裸 URL 拆 webLink，其余是 text */
const buildXiaohongshuPlainNodes = (text: string): RichTextNode[] => {
  const nodes: RichTextNode[] = []
  for (const part of text.split(/(\r?\n)/)) {
    if (part === '\n' || part === '\r\n') {
      nodes.push(createLineBreakNode())
      continue
    }
    if (!part) continue

    let lastIndex = 0
    for (const match of part.matchAll(/https?:\/\/[-\w._~:/?#[\]@!$&'()*+,;=%]+/g)) {
      if (match.index > lastIndex) nodes.push(createTextNode(part.slice(lastIndex, match.index)))
      nodes.push(createWebLinkNode(match[0], match[0]))
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < part.length) nodes.push(createTextNode(part.slice(lastIndex)))
  }
  return nodes
}

/**
 * 把小红书正文 / 评论内容转成模板要的 {@link RichTextDocument}。
 *
 * 这是 {@link buildXiaohongshuText} 的富文本版。那个返回纯字符串，而
 * `noteInfo` 和 `comment` 两条路由都是 `renderRichTextToReact(content, ...)`，
 * 拿到字符串当场在 `document.nodes.map()` 抛
 * `Cannot read properties of undefined (reading 'map')` —— 实测两条路由都必炸。
 *
 * 顺带把表情真正渲染出来：字符串版那个循环是
 * `output.replaceAll(emoji.name, emoji.name)`，把表情名换成它自己，
 * 是个彻底的空操作，所以线上一直是 `[微笑R]` 这样的字面量。
 *
 * @param text 正文 / 评论内容
 * @param emojiData 表情表，来自 {@link buildXiaohongshuEmojiList}
 * @param atUsers @ 用户列表
 * @param options 构建选项
 */
export const buildXiaohongshuRichText = (
  text: string | undefined,
  emojiData: XiaohongshuEmoji[] = [],
  atUsers: XiaohongshuAtUser[] = [],
  options: BuildTextOptions = {}
): RichTextDocument => {
  let raw = String(text || '')
  // 小红书的话题写法是 `#话题名[话题]#`，`[话题]` 只是个标记，不是表情
  if (options.stripTopicMarker) raw = raw.replace(/\[话题\]/g, '')
  raw = raw.trim()

  const toDocument = (nodes: RichTextNode[]): RichTextDocument =>
    createRichTextDocument(nodes, { platform: 'xiaohongshu' })
  if (!raw) return toDocument([])

  const emojiTable = new Map<string, string>()
  for (const emoji of emojiData) {
    if (emoji?.name && emoji?.url) emojiTable.set(emoji.name, emoji.url)
  }
  const mentions = normalizeAtUsers(atUsers)
  const mentionSet = new Set(mentions.map(name => name.replace(/^@/, '')))

  const nodes: RichTextNode[] = []
  let lastIndex = 0
  for (const match of raw.matchAll(buildXiaohongshuTokenRegExp(mentions))) {
    const token = match[0]
    const node = (() => {
      // 话题里的 `[话题]` 就地摘掉：话题正则吃的是整个 `#话题名[话题]#`，不摘就直接印在话题标签上。
      // 上面那个 stripTopicMarker 只有笔记正文传，评论这条路没传过 —— 而评论里同样带这个标记。
      // 只动话题 token 内部，正文里单独出现的 `[话题]` 字样不受影响。
      if (token.startsWith('#')) return createTopicNode(token.replace(/\[话题\]/g, ''))
      if (token.startsWith('[')) {
        const url = emojiTable.get(token)
        // 查不到图就当普通文字，别塞个空 src 进去（渲染器那边 sanitizeImageSource 会 trim）
        return url ? createEmojiNode(token, url) : null
      }
      const name = token.replace(/^@/, '')
      return mentionSet.has(name) ? createMentionNode(`@${name}`) : null
    })()
    if (!node) continue

    if (match.index > lastIndex) nodes.push(...buildXiaohongshuPlainNodes(raw.slice(lastIndex, match.index)))
    nodes.push(node)
    lastIndex = match.index + token.length
  }
  if (lastIndex < raw.length) nodes.push(...buildXiaohongshuPlainNodes(raw.slice(lastIndex)))

  return toDocument(nodes)
}

/** 评论图片 → 一个能用的 URL；拿不到给空串（调用点都按 falsy 处理） */
export const pickPictureUrl = (picture: XiaohongshuPicture | undefined): string => {
  if (typeof picture === 'string') return picture
  return picture?.url_default || picture?.url_pre || picture?.url || picture?.info_list?.[0]?.url || ''
}

/**
 * 评论图片 → 模板契约的对象形状。
 *
 * 模板只读 `pictures[0].url_default`，但契约里这 5 个字段全是必填，
 * 而小红书接口本来就带 height / width / info_list，所以按原样补齐，别只留一个 url。
 */
const normalizeCommentPicture = (picture: XiaohongshuPicture | undefined) => {
  const record = typeof picture === 'string' ? {} : picture ?? {}
  const url = pickPictureUrl(picture)
  return {
    height: Number(record.height) || 0,
    width: Number(record.width) || 0,
    url_pre: record.url_pre || url,
    url_default: url,
    info_list: (record.info_list ?? [])
      .map(item => ({ image_scene: item?.image_scene || '', url: item?.url || '' }))
      .filter(item => item.url)
  }
}

const normalizeUser = (user: XiaohongshuUserInfo = {}) => ({
  user_id: user.user_id || user.id || '',
  nickname: user.nickname || user.nick_name || '未知用户',
  image: user.image || user.avatar || user.avatar_url || user.avatar_url_default || '',
  xsec_token: user.xsec_token || ''
})

/**
 * 笔记互动数据 → `xiaohongshu/noteInfo` 契约的 `statistics`。
 *
 * `interact_info` 是接口原样透传的 `Record<string, unknown>`，而契约里 8 个字段全是必填。
 * 之前直接把原对象丢给模板，缺字段时 `formatNumber(undefined)` 会在页面上
 * 印出 4 个字面量 `'undefined'`（实测不崩，但很丑）。
 */
export const buildNoteStatistics = (interactInfo: Record<string, unknown> | undefined) => {
  const info = interactInfo ?? {}
  const count = (...keys: string[]): string | number => {
    for (const key of keys) {
      const value = info[key]
      if (typeof value === 'number' || (typeof value === 'string' && value)) return value
    }
    return 0
  }
  const flag = (key: string): boolean => info[key] === true || info[key] === 'true'
  return {
    liked: flag('liked'),
    liked_count: count('liked_count', 'like_count'),
    collected: flag('collected'),
    collected_count: count('collected_count'),
    comment_count: count('comment_count'),
    share_count: count('share_count'),
    followed: flag('followed'),
    relation: typeof info.relation === 'string' ? info.relation : ''
  }
}

/**
 * 置顶优先 + 按配置截断。图片消息和渲染 payload 两条路都要用同一份顺序，
 * 否则「图上第 3 条」和「转发消息里第 3 条」会指向不同评论。
 *
 * 顺手把 `show_tags` 归一成 `string[]`，后面 `includes` / `join` 才有意义。
 */
const sortAndLimitComments = (
  comments: XiaohongshuComment[] | undefined
): Array<XiaohongshuComment & { show_tags: string[] }> =>
  (Array.isArray(comments) ? comments : [])
    .map(comment => ({ ...comment, show_tags: normalizeTagNames(comment.show_tags) }))
    .sort((a, b) => Number(b.show_tags.includes('user_top')) - Number(a.show_tags.includes('user_top')))
    .slice(0, getCommentLimit())

/**
 * 评论列表 → `xiaohongshu/comment` 契约的 `CommentsData`。
 *
 * 这里刻意不写返回类型标注：原来那个 `unknown[]` 把 `Render()` 的逐字段校验全关掉了，
 * 于是 `content` 传字符串、`create_time` 传 `'未知时间'` 这两个必炸的 bug 一直没人拦。
 * 契约类型在 ktr/ 里，src/ 这个 program 的 rootDir 是 ./src，引进来就是 TS6059，
 * 所以让 TS 从字面量推断，漂移交给调用点的 `Render()` 抓。
 *
 * @param comments 接口原始评论
 * @param emojiData 表情表，来自 {@link buildXiaohongshuEmojiList}
 * @param noteId 笔记 ID，用于补齐评论上缺失的 `note_id`
 */
export const buildRenderComments = (
  comments: XiaohongshuComment[] | undefined,
  emojiData: XiaohongshuEmoji[],
  noteId: string
) => {
  const pickId = (item: XiaohongshuComment): string =>
    item.id || item.comment_id || `${item.user_info?.user_id || 'user'}-${item.create_time || Date.now()}`
  return sortAndLimitComments(comments)
    .map(comment => ({
      id: pickId(comment),
      note_id: comment.note_id || noteId,
      user_info: normalizeUser(comment.user_info),
      // 模板是 renderRichTextToReact(content, ...)，拿到字符串会在 document.nodes.map() 上抛
      content: buildXiaohongshuRichText(comment.content, emojiData, comment.at_users),
      create_time: toMilliseconds(comment.create_time),
      ip_location: comment.ip_location || '',
      // 模板里 formatXiaohongshuLikeCount(count: string) 先 Number(count) 再 `count || '0'`
      like_count: String(comment.like_count ?? 0),
      liked: Boolean(comment.liked),
      status: Number(comment.status) || 0,
      at_users: normalizeAtUsers(comment.at_users),
      show_tags: comment.show_tags,
      sub_comment_count: String(comment.sub_comment_count || 0),
      pictures: (Array.isArray(comment.pictures) ? comment.pictures : [])
        .map(picture => normalizeCommentPicture(picture))
        .filter(picture => picture.url_default),
      sub_comments: (Array.isArray(comment.sub_comments) ? comment.sub_comments : []).slice(0, 3).map(item => ({
        id: pickId(item),
        note_id: item.note_id || comment.note_id || noteId,
        user_info: normalizeUser(item.user_info),
        content: buildXiaohongshuRichText(item.content, emojiData, item.at_users),
        create_time: toMilliseconds(item.create_time),
        ip_location: item.ip_location || '',
        like_count: String(item.like_count ?? 0),
        liked: Boolean(item.liked),
        status: Number(item.status) || 0,
        at_users: normalizeAtUsers(item.at_users),
        show_tags: normalizeTagNames(item.show_tags),
        // 子评论的 pictures 契约是裸 URL 数组，跟父级那个对象数组不一样
        pictures: (Array.isArray(item.pictures) ? item.pictures : [])
          .map(picture => pickPictureUrl(picture))
          .filter(Boolean)
      }))
    }))
}

const formatCommentLine = (
  comment: XiaohongshuComment,
  emojiData: XiaohongshuEmoji[],
  prefix = ''
): string => {
  const user = comment.user_info || {}
  const text = buildXiaohongshuText(comment.content, emojiData, comment.at_users)
  return [
    `${prefix}${user.nickname || '未知用户'}: ${text || '[图片评论]'}`,
    `${formatTime(comment.create_time)} | IP: ${comment.ip_location || '未知'} | 赞: ${formatCount(comment.like_count)}`
  ].join('\n')
}

const formatSubComments = (comment: XiaohongshuComment, emojiData: XiaohongshuEmoji[]): string => {
  const subComments = Array.isArray(comment.sub_comments) ? comment.sub_comments : []
  if (!subComments.length) return ''
  return subComments
    .slice(0, 3)
    .map(item => formatCommentLine(item, emojiData, '  ↳ '))
    .join('\n')
}

export const buildXiaohongshuCommentMessages = async (
  comments: XiaohongshuComment[] | undefined,
  emojiData: XiaohongshuEmoji[] = [],
  imageOptions: CommentImageOptions = {}
): Promise<unknown[]> => {
  const messages: unknown[] = []

  for (const [index, comment] of sortAndLimitComments(comments).entries()) {
    const tags = comment.show_tags.length ? ` | ${comment.show_tags.join('/')}` : ''
    const subComments = formatSubComments(comment, emojiData)
    messages.push([
      `#${index + 1}${tags}`,
      formatCommentLine(comment, emojiData),
      subComments
    ].filter(Boolean).join('\n'))

    const pictures = Array.isArray(comment.pictures) ? comment.pictures : []
    for (const [pictureIndex, picture] of pictures.entries()) {
      const url = pickPictureUrl(picture)
      if (url) {
        const imageUrl = await processImageUrl(url, imageOptions.title || '小红书评论图片', pictureIndex, imageOptions.headers)
        messages.push(globalThis.segment?.image ? globalThis.segment.image(imageUrl) : imageUrl)
      }
    }
  }

  return messages
}
