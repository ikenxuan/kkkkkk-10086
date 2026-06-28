import { Base, downloadVideo } from '../../utils/Base.js'
import { baseHeaders } from '../../utils/Networks.js'
import { Render } from '../../utils/Render.js'
import Config from '../../utils/Config.js'
import Common from '../../utils/Common.js'
import { processImageUrl } from '../../utils/ImageHelper.js'
import common from '../../../../../lib/common/common.js'
import { buildLivePhotoMessages, buildLivePhotoTipMessage, pickXiaohongshuImageUrl } from './livePhoto.js'
import { buildXiaohongshuEmojiList, buildXiaohongshuText } from './comments.js'

const buildShareUrl = (data) => `https://www.xiaohongshu.com/discovery/item/${data.note_id}${data.xsec_token ? `?xsec_token=${data.xsec_token}` : ''}`

const getNoteCard = (noteResponse) => noteResponse?.data?.data?.items?.[0]?.note_card

const normalizeSendContent = () => Array.isArray(Config.xiaohongshu.sendContent) ? Config.xiaohongshu.sendContent : []

const formatCount = (value) => value ?? 0

const collectVideoStreams = (streamData) => {
  const codecPriority = ['h265', 'h264', 'av1', 'h266']
  const streams = []
  for (const codec of codecPriority) {
    if (Array.isArray(streamData?.[codec])) streams.push(...streamData[codec])
  }
  return streams
}

const getQualityLevel = (stream) => {
  const pixels = (stream.width || 0) * (stream.height || 0)
  if (pixels >= 3840 * 2160) return '4k'
  if (pixels >= 2560 * 1440) return '2k'
  if (pixels >= 1920 * 1080) return '1080p'
  if (pixels >= 1280 * 720) return '720p'
  return '540p'
}

const selectVideoStream = (streamData) => {
  const streams = collectVideoStreams(streamData)
  if (!streams.length) return null

  const quality = Config.xiaohongshu.videoQuality || '4k'
  const qualityPriority = ['4k', '2k', '1080p', '720p', '540p']
  const sorted = streams.sort((a, b) => (b.size || 0) - (a.size || 0))

  if (quality === 'adapt') {
    const limit = (Config.xiaohongshu.maxAutoVideoSize || 50) * 1024 * 1024
    return sorted.find(stream => (stream.size || 0) <= limit) || sorted.at(-1)
  }

  const targetIndex = qualityPriority.indexOf(quality)
  const fallbackOrder = targetIndex >= 0
    ? [...qualityPriority.slice(targetIndex), ...qualityPriority.slice(0, targetIndex).reverse()]
    : qualityPriority

  for (const item of fallbackOrder) {
    const stream = sorted.find(stream => getQualityLevel(stream) === item)
    if (stream) return stream
  }

  return sorted[0]
}

const formatTime = (timestamp) => {
  const time = Number(timestamp)
  if (!time) return '未知时间'
  const date = new Date(time < 10000000000 ? time * 1000 : time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const pickCommentPictureUrl = (picture) => {
  if (typeof picture === 'string') return picture
  return picture?.url_default || picture?.url_pre || picture?.url || picture?.info_list?.[0]?.url || ''
}

const normalizeTagNames = (tags) => {
  if (!Array.isArray(tags)) return []
  return tags
    .map(tag => typeof tag === 'string' ? tag : tag?.name || tag?.tag || '')
    .filter(Boolean)
}

const normalizeUser = (user = {}) => ({
  nickname: user.nickname || user.nick_name || '未知用户',
  image: user.image || user.avatar || user.avatar_url || user.avatar_url_default || ''
})

const buildRenderComments = (comments, emojiData) => {
  const limit = Math.max(1, Number(Config.xiaohongshu.numcomment || 5))
  return (Array.isArray(comments) ? comments : [])
    .map(comment => ({ ...comment, show_tags: normalizeTagNames(comment.show_tags) }))
    .sort((a, b) => Number(b.show_tags.includes('user_top')) - Number(a.show_tags.includes('user_top')))
    .slice(0, limit)
    .map(comment => ({
      id: comment.id || comment.comment_id || `${comment.user_info?.user_id || 'user'}-${comment.create_time || Date.now()}`,
      user_info: normalizeUser(comment.user_info),
      content: buildXiaohongshuText(comment.content, emojiData, comment.at_users),
      create_time: formatTime(comment.create_time),
      ip_location: comment.ip_location || '',
      like_count: formatCount(comment.like_count),
      liked: Boolean(comment.liked),
      show_tags: comment.show_tags,
      sub_comment_count: String(comment.sub_comment_count || 0),
      pictures: (Array.isArray(comment.pictures) ? comment.pictures : [])
        .map(picture => ({ url_default: pickCommentPictureUrl(picture) }))
        .filter(picture => picture.url_default),
      sub_comments: (Array.isArray(comment.sub_comments) ? comment.sub_comments : []).slice(0, 3).map(item => ({
        id: item.id || item.comment_id || `${item.user_info?.user_id || 'user'}-${item.create_time || Date.now()}`,
        user_info: normalizeUser(item.user_info),
        content: buildXiaohongshuText(item.content, emojiData, item.at_users),
        create_time: formatTime(item.create_time),
        ip_location: item.ip_location || '',
        like_count: formatCount(item.like_count),
        liked: Boolean(item.liked),
        show_tags: normalizeTagNames(item.show_tags)
      }))
    }))
}

export class Xiaohongshu extends Base {
  constructor (e, iddata) {
    super(e)
    this.e = e
    this.type = iddata?.type
  }

  async XiaohongshuHandler (data) {
    if (!Config.cookies.xiaohongshu) {
      await this.e.reply('我还没有小红书 Cookies，暂时无法解析')
      return true
    }

    const sendContent = normalizeSendContent()
    const noteData = await this.amagi.xiaohongshu.api.getNote({
      typeMode: 'strict',
      note_id: data.note_id,
      xsec_token: data.xsec_token
    })
    const card = getNoteCard(noteData)
    if (!card) throw new Error('小红书笔记数据为空')

    let emojiData = []
    if (sendContent.includes('info') || sendContent.includes('comment')) {
      try {
        const emojiList = await this.amagi.xiaohongshu.api.getEmojiList({ typeMode: 'strict' })
        emojiData = buildXiaohongshuEmojiList(emojiList)
      } catch (error) {
        logger.debug(`[小红书] 获取表情列表失败，使用纯文本渲染: ${error?.message || error}`)
      }
    }

    if (sendContent.includes('info')) {
      const noteInfoImg = await Render('xiaohongshu/noteInfo', {
        title: card.title || '无标题',
        desc: buildXiaohongshuText(card.desc, emojiData, [], { stripTopicMarker: true }),
        statistics: card.interact_info || {},
        note_id: card.note_id || data.note_id,
        author: {
          avatar: card.user?.avatar || card.user?.image || '',
          nickname: card.user?.nickname || card.user?.nick_name || '未知用户',
          user_id: card.user?.user_id || card.user?.id || ''
        },
        image_url: pickXiaohongshuImageUrl(card.image_list?.[0]) || card.video?.image?.url_default || card.video?.cover?.url_default || '',
        time: formatTime(card.time),
        ip_location: card.ip_location || '',
        share_url: buildShareUrl(data)
      })
      await this.e.reply(noteInfoImg)
    }

    if (sendContent.includes('comment')) {
      const commentData = await this.amagi.xiaohongshu.api.getComments({
        typeMode: 'strict',
        note_id: data.note_id,
        xsec_token: data.xsec_token || ''
      })
      const comments = commentData?.data?.data?.comments || []
      if (!comments.length) {
        await this.e.reply('这个笔记没有评论 ~')
      } else {
        const commentListImg = await Render('xiaohongshu/comment', {
          Type: card.video ? '视频' : '图文',
          CommentsData: buildRenderComments(comments, emojiData),
          CommentLength: comments.length,
          ImageLength: card.image_list?.length || 0,
          share_url: buildShareUrl(data)
        })
        await this.e.reply(commentListImg)
      }
    }

    if (!card.video && sendContent.includes('image')) {
      const imageMessages = []
      const tempFiles = []
      let hasGeneratedLivePhoto = false

      for (const [index, item] of (card.image_list || []).entries()) {
        if (item?.live_photo && item?.stream) {
          const livePhoto = await buildLivePhotoMessages(item, index)
          tempFiles.push(...livePhoto.tempFiles)
          hasGeneratedLivePhoto = hasGeneratedLivePhoto || livePhoto.generatedLivePhoto
          if (livePhoto.messages.length > 0) {
            imageMessages.push(...livePhoto.messages)
            continue
          }
        }

        const imageUrl = await processImageUrl(pickXiaohongshuImageUrl(item), card.title || '小红书图片', index, {
          Referer: 'https://www.xiaohongshu.com',
          Cookie: Config.cookies.xiaohongshu
        })
        if (imageUrl) imageMessages.push(segment.image(imageUrl))
      }

      if (hasGeneratedLivePhoto) imageMessages.push(await buildLivePhotoTipMessage())

      try {
        if (imageMessages.length === 1) {
          await this.e.reply(imageMessages[0])
        } else if (imageMessages.length > 1) {
          await this.e.reply(await common.makeForwardMsg(this.e, imageMessages, '小红书图集解析结果'))
        }
      } finally {
        for (const item of tempFiles) {
          if (item?.filepath) await Common.removeFile(item.filepath, true)
        }
      }
    }

    if (card.video && sendContent.includes('video')) {
      const stream = selectVideoStream(card.video.media?.stream)
      const videoUrl = stream?.master_url || card.video.url_default
      if (!videoUrl) {
        await this.e.reply('未找到可用的视频地址')
        return true
      }

      await downloadVideo(this.e, {
        video_url: videoUrl,
        title: {
          timestampTitle: `tmp_${Date.now()}.mp4`,
          originTitle: `${card.title || '小红书视频'}.mp4`
        },
        headers: {
          ...baseHeaders,
          Referer: 'https://www.xiaohongshu.com',
          Cookie: Config.cookies.xiaohongshu
        }
      })
    }

    return true
  }
}
