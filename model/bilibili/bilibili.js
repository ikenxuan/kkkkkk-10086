import { base, image, Config } from '../common.js'
import ffmpeg from '../ffmpeg.js'
import { bilicomments } from './comments.js'
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

    const commentsdata = await bilicomments(OBJECT)
    let file = null
    let { img } = await image(this.e, 'bilicomment', 'kkkkkk-10086', {
      saveId: 'bilicomment',
      Type: '视频',
      CommentsData: commentsdata,
      CommentLength: String(commentsdata?.length ? commentsdata.length : 0),
      VideoUrl: 'https://www.bilibili.com/' + OBJECT.INFODATA.data.bvid,
      VideoSize: '？？？',
      VideoFPS: '？？？',
      ImageLength: 0,
      shareurl: 'b23.tv/' + OBJECT.INFODATA.data.bvid,
    })
    file = img
    Config.commentsimg ? await this.e.reply(img) : null
    await this.getvideo(OBJECT)
  }

  async getvideo(OBJECT) {
    /** 获取视频 => FFMPEG合成 */
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
            /** 根据配置文件 `rmmp4` 重命名 */
            async () => {
              const filePath = this._path + `/resources/kkkdownload/video/${Config.rmmp4 ? 'kkktemp_' + Date.now() : this.downloadfilename}.mp4`
              fs.renameSync(this._path + `/resources/kkkdownload/video/Bil_Result_${OBJECT.INFODATA.data.bvid}.mp4`, filePath)
              await this.removeFileOrFolder(bmp4.filepath, true)
              await this.removeFileOrFolder(bmp3.filepath, true)

              const stats = fs.statSync(filePath)
              const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2)
              if (fileSizeInMB > 75) {
                this.botCfg.package.name === 'trss-yunzai' ? null : this.e.reply(`视频大小: ${fileSizeInMB}MB 正通过群文件上传中...`)
                await this.upload_file(filePath, null, true)
              } else {
                /** 因为本地合成，没有视频直链 */
                await this.upload_file(filePath, null)
              }
            },
            async () => {
              throw new Error('FFMPEG 合成失败')
            },
          )
        }
        break
      case '!isLogin':
        /** 没登录（没配置ck）情况下直接发直链，传直链在DownLoadVideo()处理 */
        await this.DownLoadVideo(OBJECT.DATA.data.durl[0].url, this.downloadfilename)
        break
    }
  }
}
