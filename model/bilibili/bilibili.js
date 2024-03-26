import { base, TikHub } from '../common.js'
import ffmpeg from '../ffmpeg.js'
import fs from 'fs'

export default class BiLiBiLi extends base {
  constructor(e = {}, TYPE) {
    super()
    this.e = e
    this.TYPE = TYPE
    this.标题 = ''
  }

  async RESOURCES(OBJECT) {
    const 简介 = OBJECT.INFODATA.data.desc
    const up名字 = OBJECT.INFODATA.data.owner.name
    const up头像 = OBJECT.INFODATA.data.owner.face
    const 封面 = OBJECT.INFODATA.data.pic
    this.标题 = OBJECT.INFODATA.data.title
    const 硬币 = await this.count(OBJECT.INFODATA.data.stat.coin)
    const 点赞 = await this.count(OBJECT.INFODATA.data.stat.like)
    const 转发 = await this.count(OBJECT.INFODATA.data.stat.share)
    const 播放量 = await this.count(OBJECT.INFODATA.data.stat.view)
    const 收藏 = await this.count(OBJECT.INFODATA.data.stat.favorite)
    const 弹幕 = await this.count(OBJECT.INFODATA.data.stat.danmaku)
    await this.e.reply([
      segment.image(封面),
      `标题: ${this.标题}\n\n作者: ${up名字}\n播放量: ${播放量},    弹幕: ${弹幕}\n点赞: ${点赞},    投币: ${硬币}\n转发: ${转发},    收藏: ${收藏}`,
    ])
    await this.getvideo(OBJECT)
  }

  async getvideo(OBJECT) {
    await ffmpeg.checkEnv()
    switch (this.TYPE) {
      case 'isLogin':
        const bmp4 = await new TikHub(this.e).DownLoadFile(
          OBJECT.DATA.data.dash.video[0].base_url,
          `Bil_Video_${OBJECT.INFODATA.data.bvid}`,
          (this.headers = { ...this.headers, Referer: 'https://api.bilibili.com/' }),
          '.mp4',
        )
        const bmp3 = await new TikHub(this.e).DownLoadFile(
          OBJECT.DATA.data.dash.audio[0].base_url,
          `Bil_Aaudio_${OBJECT.INFODATA.data.bvid}`,
          (this.headers = { ...this.headers, Referer: 'https://api.bilibili.com/' }),
          '.mp3',
        )
        if (bmp4 && bmp3) {
          ffmpeg.VideoComposite(
            bmp4,
            bmp3,
            this._path + `/resources/kkkdownload/video/Bil_Result_${OBJECT.INFODATA.data.bvid}.mp4`,
            async () => {
              const filePath = this._path + `/resources/kkkdownload/video/${OBJECT.INFODATA.data.title}.mp4`
              fs.renameSync(this._path + `/resources/kkkdownload/video/Bil_Result_${OBJECT.INFODATA.data.bvid}.mp4`, filePath)
              const stats = fs.statSync(filePath)
              const fileSizeInMB = stats.size / (1024 * 1024)
              if (fileSizeInMB > 70) {
                this.e.reply('视频文件正通过群文件上传中...')
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
        await new TikHub(this.e).DownLoadVideo(OBJECT.DATA.data.durl[0].url, this.标题)
        break
    }
  }

  /** 过万整除 */
  async count(count) {
    if (count > 10000) {
      return (count / 10000).toFixed(1) + '万'
    } else {
      return count.toString()
    }
  }

  async replyvideo() {}
  async upload_file(file) {
    if (this.e.isGroup) {
      await this.e.group.fs.upload(file)
      await this.removeFileOrFolder(file)
    } else if (this.e.isPrivate) {
      await this.e.friend.sendFile(file)
      await this.removeFileOrFolder(file)
    }
  }

  async removeFileOrFolder(path) {
    if (this.Config.rmmp4 === true || this.Config.rmmp4 === undefined) {
      const stats = await new Promise((resolve, reject) => {
        fs.stat(path, (err, stats) => {
          if (err) reject(err)
          resolve(stats)
        })
      })
      if (stats.isFile()) {
        // 指向文件
        fs.unlink(path, (err) => {
          if (err) {
            console.error('删除缓存文件失败', err)
          } else {
            console.log('缓存文件删除成功')
          }
        })
      }
    }
  }
}
