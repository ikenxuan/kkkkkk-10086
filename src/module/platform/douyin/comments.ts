import convert from 'heic-convert'
import {
  createEmojiNode,
  createLineBreakNode,
  createMentionNode,
  createRichTextDocument,
  createSearchKeywordNode,
  createTextNode,
  type RichTextDocument,
  type RichTextEmojiDefinition,
  type RichTextNode
} from '@kkk/richtext'
import { Config, Networks, baseHeaders } from '@/module/utils/index'
import { getDouyinData } from './api.js'

/** 表情项 */
export interface DouyinEmoji {
  name?: string
  url?: string
}

/** 评论中的 @ 用户扩展 */
export interface ExtraSecUid {
  sec_uid: string
}

/** 评论中的搜索词扩展 */
export interface ExtraSearchText {
  search_text: string
  search_query_id: string
}

interface RawTextExtra {
  start?: number
  end?: number
  sec_uid?: string
  search_text?: string
  search_query_id?: string
}

interface RawDouyinComment {
  cid?: string
  aweme_id?: string
  user: { nickname?: string, avatar_thumb: { url_list: string[] } }
  text: string
  ip_label?: string
  create_time: number
  label_type?: number
  label_text?: string
  sticker?: { animate_url: { url_list: string[] } }
  digg_count: number
  image_list?: Array<{ origin_url?: { url_list?: string[] } }>
  label_list?: Array<{ text?: string }>
  text_extra?: RawTextExtra[]
  reply_comment_total?: number
  reply_to_reply_id?: string
  reply_to_username?: string
  is_author_digged?: boolean
}

/**
 * 渲染用的评论项。
 *
 * 这是 `ktr/template/douyin/comment/components/types.ts` 里 `DouyinCommentData['CommentsData'][number]`
 * 的手抄副本。上游是 `import type { DouyinCommentData } from '@template/...'` 直接引契约，
 * 本仓库暂时抄不了：`tsconfig.json` 的 `rootDir` 是 `./src`，把 `ktr/**` 的 .ts 拉进这个 program
 * 会直接 TS6059。所以这里先照抄形状，改动契约时两边都要动 —— 让它变成编译期错误是
 * 待办里的 `TemplateDataMap`（把模板契约挪到 src/ 下、由 ktr 侧反向 re-export，
 * 就是 9d215bd 给 richtext 做过的那套）。
 */
export interface DouyinComment {
  /** 楼层序号，从 1 开始 */
  id?: number
  /** 评论 CID */
  cid?: string
  /** 作品 ID */
  aweme_id?: string
  /** 用户头像 URL */
  userimageurl: string
  /** 用户昵称 */
  nickname: string
  /** 标签类型（1 = 作者） */
  label_type?: number
  /** 状态标签 */
  status_label?: string
  /** 评论正文富文本 */
  text: RichTextDocument
  /** 评论图片 */
  commentimage?: string
  /** 贴纸 */
  sticker?: string
  /** 创建时间戳（秒） */
  create_time: number
  /** IP 标签 */
  ip_label: string
  /** 点赞数 */
  digg_count: number
  /** 搜索词 */
  search_text?: ExtraSearchText[] | null
  /** 正文里 @ 到的用户 sec_uid 列表 */
  is_At_user_id?: string[] | null
  /** 子评论 */
  replyComment?: DouyinReplyComment[]
  /** 作者是否点赞过这条评论 */
  is_author_digged?: boolean
}

/**
 * 渲染用的子评论项，对应 `ktr/template/douyin/components/types.ts` 的 `DouyinSubComment`。
 * 同上，形状要跟模板侧手工保持一致。
 */
export interface DouyinReplyComment {
  /** 创建时间戳（秒） */
  create_time: number
  /** 用户昵称 */
  nickname: string
  /** 用户头像 URL */
  userimageurl: string
  /** 评论正文富文本 */
  text: RichTextDocument
  /** 点赞数 */
  digg_count: number
  /** IP 标签 */
  ip_label: string
  /** 原始 text_extra，模板侧目前只透传 */
  text_extra: RawTextExtra[]
  /** 标签文本 */
  label_text: string
  /** 评论图片 */
  image_list: string[] | null
  /** 评论 CID */
  cid: string
  /** 回复的评论 ID */
  reply_to_reply_id: string
  /** 回复的用户昵称 */
  reply_to_username: string
}

/** 评论接口返回结构 */
export interface DouyinCommentsPayload {
  data: { comments: RawDouyinComment[] | null }
}

/**
 * 处理结果。
 *
 * `CommentsData` 是**扁平数组**，直接就是模板 `douyin/comment` 要的那个字段。
 * 旧实现返回 `{ jsonArray }`，调用点把整个包装对象塞给 `CommentsData`：
 * 模板里 `props.data.CommentsData.length`（Comment.tsx:590）读到 undefined，
 * `undefined > 0` 是 false 而不是抛错，于是走「暂无评论数据」分支 ——
 * 不崩，但**静默出一张空评论图**。实测确认过：这个包装渲染 success=true。
 * 线上真正的崩溃点是 payload 缺 `Statistics`，见调用点注释。
 */
export interface DouyinCommentResult {
  CommentsData: DouyinComment[]
  /** 评论区里出现过的图片/表情包直链，用于「评论图片收集」转发 */
  image_url: string[]
}

/** 搜索词在正文里的范围 */
interface DouyinSearchToken {
  start: number
  end: number
  text: string
  queryId: string
}

/** 正文里可以匹配的 @ 标记 */
interface DouyinMentionToken {
  text: string
  userId: string
}

/**
 * 提取评论里的 @ 用户 sec_uid 列表
 */
const extractMentionSecUids = (textExtra: RawTextExtra[] | undefined): string[] | null => {
  if (!Array.isArray(textExtra) || textExtra.length === 0) return null

  const secUids = textExtra
    .map(item => item?.sec_uid)
    .filter((secUid): secUid is string => Boolean(secUid))

  return secUids.length > 0 ? secUids : null
}

/**
 * 解析评论中的搜索词信息
 */
const extractSearchText = (textExtra: RawTextExtra[] | undefined): ExtraSearchText[] | null => {
  if (!Array.isArray(textExtra) || textExtra.length === 0) return null

  const searchItems = textExtra
    .filter(item => Boolean(item?.search_text))
    .map(item => ({
      search_text: item.search_text!,
      search_query_id: item.search_query_id ?? ''
    }))

  return searchItems.length > 0 ? searchItems : null
}

/**
 * 提取评论正文中的搜索词范围。
 *
 * 抖音会把高亮搜索词单独放在 `text_extra` 里，但用户实际看到的是「正文里某一段文字高亮」，
 * 所以不能只把它单独透传给模板，而要把范围信息重新合回正文解析流程。
 * 只保留原文片段与 search_text 完全一致的那些，避免范围异常时把正文切错位。
 */
const extractSearchTokens = (textExtra: RawTextExtra[] | undefined, text: string): DouyinSearchToken[] => {
  if (!Array.isArray(textExtra) || textExtra.length === 0 || !text) return []

  return textExtra
    .filter((item): item is RawTextExtra & { start: number, end: number, search_text: string } =>
      typeof item?.start === 'number' &&
      typeof item.end === 'number' &&
      typeof item.search_text === 'string' &&
      item.search_text.length > 0 &&
      item.start >= 0 &&
      item.end > item.start &&
      item.end <= text.length
    )
    .map(item => ({
      start: item.start,
      end: item.end,
      text: item.search_text,
      queryId: item.search_query_id ?? ''
    }))
    .filter(item => text.slice(item.start, item.end) === item.text)
    .sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
}

interface UserInfoResponse {
  data: { user: { sec_uid?: string, nickname?: string } }
}

/**
 * 根据抖音 `sec_uid` 反查当前昵称，生成正文里可匹配的 @ 标记。
 *
 * 评论正文里只有 `@昵称`，稳定 ID 在 `text_extra` 里，所以先把 ID 换成 `@昵称 + userId`，
 * 后面解析时才能把普通文本切成 mention 节点。昵称长的排前面，避免短昵称先匹配上截断长的。
 * 接口没有历史昵称，改过名的 @ 会匹配不上，只能按纯文本渲染。
 */
const resolveMentionTokens = async (userIds: string[] | null): Promise<DouyinMentionToken[]> => {
  if (!userIds || userIds.length === 0) return []

  const uniqueUserIds = [...new Set(userIds)]

  const mentionTokens = await Promise.all(uniqueUserIds.map(async secUid => {
    try {
      const userInfo = await getDouyinData('用户主页数据', Config.cookies.douyin || '', {
        sec_uid: secUid,
        typeMode: 'strict'
      }) as UserInfoResponse
      const nickname = userInfo.data.user.nickname?.trim()
      if (!nickname || userInfo.data.user.sec_uid !== secUid) return null
      return { text: `@${nickname}`, userId: secUid }
    } catch (error) {
      logger.warn(`[抖音] 获取 sec_uid 为 ${secUid} 的用户信息失败，该 @ 按纯文本渲染`, error)
      return null
    }
  }))

  return mentionTokens
    .filter((item): item is DouyinMentionToken => Boolean(item))
    .sort((a, b) => b.text.length - a.text.length)
}

/**
 * 把抖音评论原始文本解析成共享富文本 JSON。
 *
 * 刻意不拼 HTML：
 * - 普通文本原样放进 text 节点，由 React 渲染时自动转义
 * - 换行符转成 lineBreak 节点，保留原来的视觉换行
 * - 平台表情转成 emoji 节点，图片 URL 交给模板侧渲染器再做协议白名单
 * - @ 用户与搜索词转成对应节点，模板侧只负责套样式
 */
const buildDouyinRichText = async (
  text: string,
  emojiData: RichTextEmojiDefinition[],
  mentionUserIds: string[] | null,
  searchTokens: DouyinSearchToken[] = []
): Promise<RichTextDocument> => {
  const mentionTokens = await resolveMentionTokens(mentionUserIds)
  const emojiTokens = emojiData
    .filter(item => Boolean(item?.name) && Boolean(item?.url))
    .sort((a, b) => b.name.length - a.name.length)

  const nodes: RichTextNode[] = []
  let buffer = ''
  let index = 0

  const pushBuffer = (): void => {
    if (buffer.length > 0) {
      nodes.push(createTextNode(buffer))
      buffer = ''
    }
  }

  let searchTokenIndex = 0

  while (index < text.length) {
    while (searchTokens[searchTokenIndex] && searchTokens[searchTokenIndex]!.start < index) {
      searchTokenIndex += 1
    }

    const currentSearchToken = searchTokens[searchTokenIndex]
    if (currentSearchToken && currentSearchToken.start === index) {
      pushBuffer()
      nodes.push(createSearchKeywordNode(currentSearchToken.text, currentSearchToken.queryId))
      index = currentSearchToken.end
      searchTokenIndex += 1
      continue
    }

    if (text[index] === '\r') {
      pushBuffer()
      index += text[index + 1] === '\n' ? 2 : 1
      nodes.push(createLineBreakNode())
      continue
    }

    if (text[index] === '\n') {
      pushBuffer()
      nodes.push(createLineBreakNode())
      index += 1
      continue
    }

    const matchedMention = mentionTokens.find(item => text.startsWith(item.text, index))
    if (matchedMention) {
      pushBuffer()
      nodes.push(createMentionNode(matchedMention.text, matchedMention.userId))
      index += matchedMention.text.length
      continue
    }

    const matchedEmoji = emojiTokens.find(item => text.startsWith(item.name, index))
    if (matchedEmoji) {
      pushBuffer()
      nodes.push(createEmojiNode(matchedEmoji.name, matchedEmoji.url))
      index += matchedEmoji.name.length
      continue
    }

    buffer += text[index]
    index += 1
  }

  pushBuffer()

  return createRichTextDocument(nodes, { platform: 'douyin' })
}

/**
 * 单张评论图片的 HEIC 转 JPG。
 *
 * 上游用 heic-decode + jpeg-js，这里沿用本仓库既有的 heic-convert，行为一致。
 * 非 HEIC 直接原样返回。
 */
const processCommentImage = async (imageUrl: string | null | undefined): Promise<string | null> => {
  if (!imageUrl) return null

  const headers = await new Networks({
    url: imageUrl,
    type: 'arraybuffer',
    headers: { ...baseHeaders, Referer: 'https://www.douyin.com/', Cookie: '' }
  }).getHeaders()

  if (headers['content-type'] !== 'image/heic') return imageUrl

  const response = await new Networks({
    url: imageUrl,
    type: 'arraybuffer',
    headers: { ...baseHeaders, Referer: 'https://www.douyin.com/', Cookie: '' }
  }).request()

  const jpegBuffer = await convert({
    buffer: response.data as never,
    format: 'JPEG'
  })

  return `data:image/jpeg;base64,${Buffer.from(jpegBuffer).toString('base64')}`
}

/** 把 data URL 换成宿主收得下的 base64:// 直链，其余原样 */
const toSendableImage = (url: string): string =>
  url.startsWith('data:image/jpeg;base64,')
    ? `base64://${url.replace('data:image/jpeg;base64,', '')}`
    : url

interface CommentRepliesResponse {
  data: { comments: RawDouyinComment[] | null }
}

/**
 * 拉取一条评论下的子评论并转成模板要的形状。
 *
 * 拉不到就返回空数组：子评论是锦上添花，不能因为它失败就让整张评论图渲染不出来。
 */
const fetchReplyComments = async (
  awemeId: string | undefined,
  commentId: string | undefined,
  emojiData: RichTextEmojiDefinition[],
  imageUrls: string[]
): Promise<DouyinReplyComment[]> => {
  if (!awemeId || !commentId) return []

  let replyComment: CommentRepliesResponse
  try {
    replyComment = await getDouyinData('指定评论回复数据', Config.cookies.douyin || '', {
      aweme_id: awemeId,
      comment_id: commentId,
      number: Config.douyin.subCommentLimit,
      typeMode: 'strict'
    }) as CommentRepliesResponse
  } catch (error) {
    logger.warn(`[抖音] 获取评论 ${commentId} 的子评论失败，该楼只渲染主评论`, error)
    return []
  }

  const replies = replyComment.data.comments
  if (!replies || replies.length === 0) return []

  const replyComments: DouyinReplyComment[] = []
  for (const reply of replies) {
    const replyUserintextlongid = extractMentionSecUids(reply.text_extra)
    const replySearchTokens = extractSearchTokens(reply.text_extra, reply.text)
    const replyRichText = await buildDouyinRichText(reply.text, emojiData, replyUserintextlongid, replySearchTokens)

    const replyImageUrl = reply.image_list?.[0]?.origin_url?.url_list?.[0]
    const replyStickerUrl = reply.sticker?.animate_url?.url_list?.[0]

    let replyImageList: string[] | null = null
    if (replyImageUrl) {
      const processedReplyImage = await processCommentImage(replyImageUrl)
      if (processedReplyImage) {
        replyImageList = [processedReplyImage]
        imageUrls.push(toSendableImage(processedReplyImage))
      }
    } else if (replyStickerUrl) {
      replyImageList = [replyStickerUrl]
      imageUrls.push(replyStickerUrl)
    }

    replyComments.push({
      create_time: reply.create_time,
      nickname: reply.user.nickname ?? '',
      userimageurl: reply.user.avatar_thumb.url_list[0] ?? '',
      text: replyRichText,
      digg_count: reply.digg_count,
      ip_label: reply.ip_label ?? '未知',
      text_extra: reply.text_extra ?? [],
      label_text: reply.label_text ?? '',
      image_list: replyImageList,
      cid: reply.cid ?? '',
      reply_to_reply_id: reply.reply_to_reply_id ?? '',
      reply_to_username: reply.reply_to_username ?? ''
    })
  }

  return replyComments
}

/**
 * 处理抖音评论数据
 * @param data 完整的评论数据
 * @param emojidata 处理过后的 emoji 列表
 */
export async function douyinComments (
  data: DouyinCommentsPayload,
  emojidata: RichTextEmojiDefinition[] = []
): Promise<DouyinCommentResult> {
  const commentsData: DouyinComment[] = []
  const imageUrls: string[] = []
  if (data.data.comments === null) return { CommentsData: [], image_url: [] }

  let id = 1
  for (const comment of data.data.comments) {
    const text = comment.text
    const sticker = comment.sticker ? comment.sticker.animate_url.url_list[0] : null
    const imageurl = comment.image_list?.[0]?.origin_url?.url_list?.[0] ?? null
    const userintextlongid = extractMentionSecUids(comment.text_extra)
    const search_text = extractSearchText(comment.text_extra)
    const searchTokens = extractSearchTokens(comment.text_extra, text)
    const richText = await buildDouyinRichText(text, emojidata, userintextlongid, searchTokens)

    const processedImageUrl = await processCommentImage(imageurl)

    // 收集评论图片与表情包，供「评论图片收集」合并转发
    if (processedImageUrl) imageUrls.push(toSendableImage(processedImageUrl))
    if (sticker) imageUrls.push(sticker)

    const replyComments = await fetchReplyComments(comment.aweme_id, comment.cid, emojidata, imageUrls)

    commentsData.push({
      id: id++,
      replyComment: replyComments.length > 0 ? replyComments : undefined,
      cid: comment.cid,
      aweme_id: comment.aweme_id,
      nickname: comment.user.nickname ?? '',
      userimageurl: comment.user.avatar_thumb.url_list[0] ?? '',
      text: richText,
      digg_count: comment.digg_count,
      ip_label: comment.ip_label ?? '未知',
      // 时间戳原样透传（秒）。旧实现在这里就把它格式化成「3分钟前」，
      // 模板拿到字符串再走 fromUnixTime 只会得到 Invalid Date。
      create_time: comment.create_time,
      commentimage: processedImageUrl ?? undefined,
      label_type: comment.label_type ?? -1,
      sticker: sticker ?? undefined,
      status_label: comment.label_list?.[0]?.text ?? undefined,
      is_At_user_id: userintextlongid,
      search_text,
      is_author_digged: comment.is_author_digged ?? false
    })
  }

  // 点赞多的排前面，作者评论再置顶。
  // digg_count 保持数字，格式化成「1.2w」是模板的事（formatDouyinCommentDiggCount）——
  // 旧实现在这里就地改成字符串，模板侧再比较就会按字典序乱序。
  commentsData.sort((a, b) => b.digg_count - a.digg_count)

  const indexLabelTypeOne = commentsData.findIndex(comment => comment.label_type === 1)
  if (indexLabelTypeOne !== -1) {
    const authorComment = commentsData.splice(indexLabelTypeOne, 1)[0]
    if (authorComment) commentsData.unshift(authorComment)
  }

  return {
    CommentsData: commentsData,
    image_url: imageUrls
  }
}
