import { baseHeaders } from '@/module/utils/Networks'
import Config from '@/module/utils/Config'
import {
  buildLivePhotoMessages as buildCommonLivePhotoMessages,
  buildLivePhotoTipMessage,
  type BuildLivePhotoResult
} from '@/module/platform/common/livePhoto'

export { buildLivePhotoTipMessage }

/** 小红书图片项中被实况图逻辑读取的字段 */
export interface XiaohongshuImageItem {
  url_default?: string
  url_pre?: string
  url?: string
  info_list?: Array<{ url?: string }>
  live_photo?: boolean
  stream?: XiaohongshuStreamData
}

/** 实况图视频流 */
export interface XiaohongshuLiveVideo {
  master_url?: string
  width?: number
  height?: number
  size?: number
}

/** 按编码分组的视频流 */
export type XiaohongshuStreamData = Partial<Record<'h264' | 'h265' | 'av1' | 'h266', XiaohongshuLiveVideo[]>>

export const pickXiaohongshuImageUrl = (image: XiaohongshuImageItem | string | undefined): string | undefined => {
  if (typeof image === 'string') return image
  return image?.url_default || image?.url_pre || image?.url || image?.info_list?.[0]?.url
}

export const getXiaohongshuLivePhotoVideo = (
  streamData: XiaohongshuStreamData | undefined
): XiaohongshuLiveVideo | null => {
  if (!streamData) return null
  for (const codec of ['h264', 'h265', 'av1', 'h266'] as const) {
    const streams = streamData[codec]
    if (Array.isArray(streams) && streams.length > 0) {
      return streams[0] ?? null
    }
  }
  return null
}

export const buildLivePhotoMessages = async (
  image: XiaohongshuImageItem | undefined,
  index: number
): Promise<BuildLivePhotoResult> => {
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
