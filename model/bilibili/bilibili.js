import { base } from '../common.js'
import ffmpeg from '../ffmpeg.js'
import fs from 'fs'

export default class BiLiBiLi extends base {
  constructor(e = {}, TYPE) {
    super()
    this.e = e
    this.TYPE = TYPE
    this.downloadfilename = ''
  }

  async RESOURCES(OBJECT) {
    const { desc, owner, pic, title, stat } = OBJECT.INFODATA.data
    const { name, face } = owner
    const { coin, like, share, view, favorite, danmaku } = stat
    this.downloadfilename = title.substring(0, 50).replace(/[\\/:\*\?"<>\|\r\n\s]/g, ' ')

    await this.e.reply([
      segment.image(pic),
      `标题: ${title}\n\n作者: ${name}\n播放量: ${await this.count(view)},    弹幕: ${await this.count(danmaku)}\n点赞: ${await this.count(
        like,
      )},    投币: ${await this.count(coin)}\n转发: ${await this.count(share)},    收藏: ${await this.count(favorite)}`,
    ])
    await this.getvideo(OBJECT)
  }

  async getvideo(OBJECT) {
    await ffmpeg.checkEnv()
    switch (this.TYPE) {
      case 'isLogin':
        const bmp4 = await this.DownLoadFile(
          OBJECT.DATA.data.dash.video[0].base_url,
          `Bil_Video_${OBJECT.INFODATA.data.bvid}`,
          (this.headers = { ...this.headers, Referer: 'https://api.bilibili.com/' }),
          '.mp4',
        )
        const bmp3 = await this.DownLoadFile(
          OBJECT.DATA.data.dash.audio[0].base_url,
          `Bil_Aaudio_${OBJECT.INFODATA.data.bvid}`,
          (this.headers = { ...this.headers, Referer: 'https://api.bilibili.com/' }),
          '.mp3',
        )
        if (bmp4.filepath && bmp3.filepath) {
          ffmpeg.VideoComposite(
            bmp4.filepath,
            bmp3.filepath,
            this._path + `/resources/kkkdownload/video/Bil_Result_${OBJECT.INFODATA.data.bvid}.mp4`,
            async () => {
              const filePath = this._path + `/resources/kkkdownload/video/${this.downloadfilename}.mp4`
              fs.renameSync(this._path + `/resources/kkkdownload/video/Bil_Result_${OBJECT.INFODATA.data.bvid}.mp4`, filePath)
              await this.removeFileOrFolder(bmp4.filepath, true)
              await this.removeFileOrFolder(bmp3.filepath, true)

              const stats = fs.statSync(filePath)
              const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2)
              if (fileSizeInMB > 70) {
                this.e.reply(`视频大小: ${fileSizeInMB}MB 正通过群文件上传中...`)
                await this.upload_file(filePath)
              } else {
                await this.e.reply(segment.video(filePath))
                await this.removeFileOrFolder(filePath)
              }
            },
            async () => {
              throw new Error('FFMPEG 合成失败')
            },
          )
        }
        break
      case '!isLogin':
        await this.DownLoadVideo(OBJECT.DATA.data.durl[0].url, this.downloadfilename)
        break
    }
  }
}
