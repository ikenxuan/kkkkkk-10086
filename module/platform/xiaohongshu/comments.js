import Config from '../../utils/Config.js'
import { processImageUrl } from '../../utils/ImageHelper.js'

const formatCount = (value) => value ?? 0

const formatTime = (timestamp) => {
  const time = Number(timestamp)
  if (!time) return '未知时间'
  const date = new Date(time < 10000000000 ? time * 1000 : time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const normalizeTagNames = (tags) => {
  if (!Array.isArray(tags)) return []
  return tags
    .map(tag => {
      if (typeof tag === 'string') return tag
      if (tag && typeof tag === 'object') return tag.name || tag.tag || ''
      return ''
    })
    .filter(Boolean)
}

const normalizeAtUsers = (atUsers) => {
  if (!Array.isArray(atUsers)) return []
  return atUsers
    .map(item => {
      if (typeof item === 'string' && item.trim()) return `@${item.trim().replace(/^@/, '')}`
      const nickname = item?.nickname || item?.user_info?.nickname
      return nickname ? `@${String(nickname).trim().replace(/^@/, '')}` : ''
    })
    .filter(Boolean)
}

export const buildXiaohongshuEmojiList = (data) => {
  const tabs = data?.data?.data?.emoji?.tabs || data?.data?.emoji?.tabs || data?.emoji?.tabs || []
  const result = []
  for (const tab of tabs) {
    for (const collection of tab?.collection || []) {
      for (const emoji of collection?.emoji || []) {
        if (emoji?.image_name) result.push({ name: emoji.image_name, url: emoji.image })
      }
    }
  }
  return result
}

export const buildXiaohongshuText = (text, emojiData = [], atUsers = [], options = {}) => {
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

const pickPictureUrl = (picture) => {
  if (typeof picture === 'string') return picture
  return picture?.url_default || picture?.url_pre || picture?.url || picture?.info_list?.[0]?.url
}

const formatCommentLine = (comment, emojiData, prefix = '') => {
  const user = comment.user_info || {}
  const text = buildXiaohongshuText(comment.content, emojiData, comment.at_users)
  return [
    `${prefix}${user.nickname || '未知用户'}: ${text || '[图片评论]'}`,
    `${formatTime(comment.create_time)} | IP: ${comment.ip_location || '未知'} | 赞: ${formatCount(comment.like_count)}`
  ].join('\n')
}

const formatSubComments = (comment, emojiData) => {
  const subComments = Array.isArray(comment.sub_comments) ? comment.sub_comments : []
  if (!subComments.length) return ''
  return subComments
    .slice(0, 3)
    .map(item => formatCommentLine(item, emojiData, '  ↳ '))
    .join('\n')
}

export const buildXiaohongshuCommentMessages = async (comments, emojiData = [], imageOptions = {}) => {
  const limit = Math.max(1, Number(Config.xiaohongshu.numcomment || 5))
  const normalized = Array.isArray(comments) ? comments : []
  const messages = []

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
