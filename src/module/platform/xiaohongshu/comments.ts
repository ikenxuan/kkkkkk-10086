import type { AxiosRequestConfig } from 'axios'
import Config from '../../utils/Config.js'
import { processImageUrl } from '../../utils/ImageHelper.js'

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
}

/** 图片资源，可能是字符串或多种字段的对象 */
export type XiaohongshuPicture = string | {
  url_default?: string
  url_pre?: string
  url?: string
  info_list?: Array<{ url?: string }>
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
  user_info?: XiaohongshuUserInfo
  content?: string
  at_users?: XiaohongshuAtUser[]
  create_time?: number | string
  ip_location?: string
  like_count?: number | string
  liked?: boolean
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

const formatTime = (timestamp: number | string | undefined): string => {
  const time = Number(timestamp)
  if (!time) return '未知时间'
  const date = new Date(time < 10000000000 ? time * 1000 : time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const normalizeTagNames = (tags: XiaohongshuTag[] | undefined): string[] => {
  if (!Array.isArray(tags)) return []
  return tags
    .map(tag => {
      if (typeof tag === 'string') return tag
      if (tag && typeof tag === 'object') return tag.name || tag.tag || ''
      return ''
    })
    .filter(Boolean)
}

const normalizeAtUsers = (atUsers: XiaohongshuAtUser[] | undefined): string[] => {
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
    output = output.replaceAll(raw, mention)
  }

  for (const emoji of emojiData) {
    if (!emoji?.name) continue
    output = output.replaceAll(emoji.name, emoji.name)
  }

  return output.trim()
}

const pickPictureUrl = (picture: XiaohongshuPicture | undefined): string | undefined => {
  if (typeof picture === 'string') return picture
  return picture?.url_default || picture?.url_pre || picture?.url || picture?.info_list?.[0]?.url
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
  const limit = Math.max(1, Number(Config.xiaohongshu.numcomment || 5))
  const normalized = Array.isArray(comments) ? comments : []
  const messages: unknown[] = []

  const sortedComments = normalized
    .map(comment => ({ ...comment, show_tags: normalizeTagNames(comment.show_tags) }))
    .sort((a, b) => Number(b.show_tags.includes('user_top')) - Number(a.show_tags.includes('user_top')))
    .slice(0, limit)

  for (const [index, comment] of sortedComments.entries()) {
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
