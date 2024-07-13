import { Base, Config } from '#components'

export default class KuaiShou extends Base {
  constructor (e = {}, Iddata) {
    super()
    this.e = e
  }

  async Action (data) {
    Config.kuaishou.kuaishoutip && await this.e.reply('检测到快手链接，开始解析')
    if (data.data.visionVideoDetail.status == 1) {
      const video_url = data.data.visionVideoDetail.photo.photoUrl
      await this.DownLoadVideo(video_url, Config.app.rmmp4 ? 'tmp_' + Date.now() : data.data.visionVideoDetail.photo.caption)
      return true
    }
  }

}
