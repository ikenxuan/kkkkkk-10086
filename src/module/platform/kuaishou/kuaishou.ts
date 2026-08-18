import { Base, Config, Render, Networks, downloadVideo } from '../../utils/index.js'
import comments, { type KuaishouEmoji } from './comments.js'

interface KuaishouPhoto {
  photoUrl?: string
  caption?: string
  viewCount?: number
  likeCount?: number
}

interface KuaishouVideoDetail {
  status?: number
  photo: KuaishouPhoto
}

/** KuaishouData.GetData 返回的聚合数据 */
export interface KuaishouActionPayload {
  VideoData?: {
    data?: {
      data?: { visionVideoDetail?: KuaishouVideoDetail }
      visionVideoDetail?: KuaishouVideoDetail
    }
  }
  CommentsData?: { data?: unknown }
  CommentData?: unknown
  EmojiData?: {
    data?: {
      data?: { visionBaseEmoticons?: { iconUrls?: Record<string, string> } }
      visionBaseEmoticons?: { iconUrls?: Record<string, string> }
    }
  }
}

export default class KuaiShou extends Base {
  constructor (e: ConstructorParameters<typeof Base>[0] = {}, _Iddata?: unknown) {
    super()
    this.e = e
  }

  async Action (data: KuaishouActionPayload): Promise<boolean> {
    const videoDetail = data.VideoData?.data?.data?.visionVideoDetail || data.VideoData?.data?.visionVideoDetail
    const commentsData = data.CommentsData?.data || data.CommentsData || data.CommentData
    const emojiList = data.EmojiData?.data?.data?.visionBaseEmoticons?.iconUrls || data.EmojiData?.data?.visionBaseEmoticons?.iconUrls || {}

    if (videoDetail?.status !== 1) {
      await this.e!.reply!('不支持解析的视频')
      return true
    }
    ;(Config.app.parseTip || Config.kuaishou.kuaishoutip) && await this.e!.reply!('检测到快手链接，开始解析')
    const video_url = videoDetail.photo.photoUrl
    const transformedData: KuaishouEmoji[] = Object.entries(emojiList).map(([name, path]) => {
      return { name, url: `https:${path}` }
    })
    const CommentsData = await comments(commentsData as Parameters<typeof comments>[0], transformedData)
    const videoheaders = await new Networks({ url: video_url as string, headers: this.headers }).getHeaders()
    const Size = videoheaders['content-length'] ? parseInt(videoheaders['content-length'], 10) : 0
    const videoSizeInMB = (Size / (1024 * 1024)).toFixed(2)
    const img = await Render(
      'kuaishou/comment',
      {
        Type: '视频',
        viewCount: videoDetail.photo.viewCount,
        CommentsData,
        CommentLength: String(CommentsData?.length ? CommentsData.length : 0),
        share_url: video_url,
        VideoSize: videoSizeInMB,
        likeCount: videoDetail.photo.likeCount
      }
    )
    await this.e!.reply!(img)
    await downloadVideo(this.e as Parameters<typeof downloadVideo>[0], {
      video_url: video_url as string,
      title: {
        timestampTitle: `tmp_${Date.now()}.mp4`,
        originTitle: `${videoDetail.photo.caption || '快手作品'}.mp4`
      }
    })
    return true
  }
}
