import { Base, Config, Render } from '../../components/index.js'
import  comments  from './getdata.js'

export default class KuaiShou extends Base {
  constructor (e = {}, Iddata) {
    super()
    this.e = e
  }

  async Action (data) {
    if (!data.VideoData.data.visionVideoDetail.status === 1) {
      await this.e.reply('不支持解析的视频')
      return true
    }
    Config.kuaishou.kuaishoutip && await this.e.reply('检测到快手链接，开始解析')
    const video_url = data.VideoData.data.visionVideoDetail.photo.photoUrl
    const transformedData = Object.entries(data.EmojiData.data.visionBaseEmoticons.iconUrls).map(([ name, path ]) => {
      return { name, url: `https:${path}` }
    })
    const CommentsData = await comments(data.CommentData, transformedData)
    const img = await Render.render(
      'html/kuaishou/comment',
      {
        Type: '视频',
        CommentsData,
        CommentLength: String(CommentsData?.length ? CommentsData.length : 0),
        VideoUrl: video_url,
        VideoSize: '？？？',
        VideoFPS: '？？？'
      }
    )
    await this.e.reply(img)
    await this.DownLoadVideo(video_url, Config.app.rmmp4 ? 'tmp_' + Date.now() : data.VideoData.data.visionVideoDetail.photo.caption)
    return true
  }

}
