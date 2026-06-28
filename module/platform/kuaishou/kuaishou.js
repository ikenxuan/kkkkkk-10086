import { Base, Config, Render, Networks, downloadVideo } from '../../utils/index.js'
import  comments  from './comments.js'

export default class KuaiShou extends Base {
  constructor (e = {}, Iddata) {
    super()
    this.e = e
  }

  async Action (data) {
    const videoDetail = data.VideoData?.data?.data?.visionVideoDetail || data.VideoData?.data?.visionVideoDetail
    const commentsData = data.CommentsData?.data || data.CommentsData || data.CommentData
    const emojiList = data.EmojiData?.data?.data?.visionBaseEmoticons?.iconUrls || data.EmojiData?.data?.visionBaseEmoticons?.iconUrls || {}

    if (videoDetail?.status !== 1) {
      await this.e.reply('不支持解析的视频')
      return true
    }
    ;(Config.app.parseTip || Config.kuaishou.kuaishoutip) && await this.e.reply('检测到快手链接，开始解析')
    const video_url = videoDetail.photo.photoUrl
    const transformedData = Object.entries(emojiList).map(([ name, path ]) => {
      return { name, url: `https:${path}` }
    })
    const CommentsData = await comments(commentsData, transformedData)
    const videoheaders = await new Networks({ url: video_url, headers: this.headers }).getHeaders()
    const Size = videoheaders['content-length'] ? parseInt(videoheaders['content-length'], 10) : 0
    const videoSizeInMB = (Size / (1024 * 1024)).toFixed(2)
    const img = await Render.render(
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
    await this.e.reply(img)
    await downloadVideo(this.e, {
      video_url,
      title: {
        timestampTitle: `tmp_${Date.now()}.mp4`,
        originTitle: `${videoDetail.photo.caption || '快手作品'}.mp4`
      }
    })
    return true
  }

}
