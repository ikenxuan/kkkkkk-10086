import { Base, Config } from '#components'

export default class KuaiShou extends Base {
  constructor (e = {}, Iddata) {
    super()
    this.e = e
  }

  async Action (data) {
    if (data.data.visionVideoDetail.status == 1) {
      const video_url = data.data.visionVideoDetail.photo.photoUrl
      await this.DownLoadVideo(video_url, Config.app.rmmp4 ? 'tmp_' + Date.now() : data.data.visionVideoDetail.photo.caption)
      return true
    }
  }

}
