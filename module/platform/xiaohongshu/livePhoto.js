import { baseHeaders } from '../../utils/Networks.js'
import Config from '../../utils/Config.js'
import { buildLivePhotoMessages as buildCommonLivePhotoMessages, buildLivePhotoTipMessage } from '../common/livePhoto.js'

export { buildLivePhotoTipMessage }

export const pickXiaohongshuImageUrl = (image) => {
  if (typeof image === 'string') return image
  return image?.url_default || image?.url_pre || image?.url || image?.info_list?.[0]?.url
}

export const getXiaohongshuLivePhotoVideo = (streamData) => {
  if (!streamData) return null
  for (const codec of ['h264', 'h265', 'av1', 'h266']) {
    if (Array.isArray(streamData[codec]) && streamData[codec].length > 0) {
      return streamData[codec][0]
    }
  }
  return null
}

export const buildLivePhotoMessages = async (image, index) => {
  const staticUrl = pickXiaohongshuImageUrl(image)
  const livePhotoVideo = getXiaohongshuLivePhotoVideo(image?.stream)

  if (!image?.live_photo || !staticUrl || !livePhotoVideo?.master_url) {
    return { messages: [], tempFiles: [], generatedLivePhoto: false }
  }

  return await buildCommonLivePhotoMessages({
    platform: 'xiaohongshu',
    staticUrl,
    liveVideoUrl: livePhotoVideo.master_url,
    index,
    headers: {
      ...baseHeaders,
      Referer: 'https://www.xiaohongshu.com',
      Cookie: Config.cookies.xiaohongshu
    }
  })
}
