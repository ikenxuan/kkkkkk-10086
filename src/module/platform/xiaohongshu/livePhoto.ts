import type { AxiosRequestConfig } from 'axios'
import { baseHeaders } from '@/module/utils/Networks'
import Config from '@/module/utils/Config'
import {
  buildLivePhotoMessages as buildCommonLivePhotoMessages,
  buildLivePhotoMessagesBatch as buildCommonLivePhotoMessagesBatch,
  buildLivePhotoTipMessage,
  type BuildLivePhotoBatchResult,
  type BuildLivePhotoResult,
  type LivePhotoBatchItem
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

/** 整批小红书图片共用的请求头 */
const xiaohongshuLivePhotoHeaders = (): AxiosRequestConfig['headers'] => ({
  ...baseHeaders,
  Referer: 'https://www.xiaohongshu.com',
  Cookie: Config.cookies.xiaohongshu
})

/** 把一张小红书图片翻译成实况图批量入口认识的条目。不是实况图就返回空条目。 */
const toLivePhotoBatchItem = (image: XiaohongshuImageItem | undefined): LivePhotoBatchItem => {
  const staticUrl = pickXiaohongshuImageUrl(image)
  const livePhotoVideo = getXiaohongshuLivePhotoVideo(image?.stream)
  if (!image?.live_photo || !staticUrl || !livePhotoVideo?.master_url) return {}
  return { staticUrl, liveVideoUrl: livePhotoVideo.master_url }
}

export const buildLivePhotoMessages = async (
  image: XiaohongshuImageItem | undefined,
  index: number
): Promise<BuildLivePhotoResult> => {
  const item = toLivePhotoBatchItem(image)
  if (item.staticUrl === undefined) {
    return { messages: [], tempFiles: [], generatedLivePhoto: false }
  }

  return await buildCommonLivePhotoMessages({
    platform: 'xiaohongshu',
    ...item,
    index,
    headers: xiaohongshuLivePhotoHeaders()
  })
}

/**
 * 整篇笔记的图片一次过：下载滑动窗口并发，ffmpeg 按序串行。
 * 结果和输入 `images` 逐位对齐，非实况图的位置是空 messages。
 */
export const buildLivePhotoMessagesBatch = async (
  images: ReadonlyArray<XiaohongshuImageItem | undefined>
): Promise<BuildLivePhotoBatchResult> => {
  return await buildCommonLivePhotoMessagesBatch(images.map(toLivePhotoBatchItem), {
    platform: 'xiaohongshu',
    headers: xiaohongshuLivePhotoHeaders()
  })
}
