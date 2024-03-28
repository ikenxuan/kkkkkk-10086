import { base, TikHub } from '../common.js'
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
      segment.image(封面),
      `标题: ${title}\n\n作者: ${name}\n播放量: ${view},    弹幕: ${danmaku}\n点赞: ${like},    投币: ${coin}\n转发: ${share},    收藏: ${favorite}`,
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
              const filePath = this._path + `/resources/kkkdownload/video/${this.downloadfilename}.mp4`
              fs.renameSync(this._path + `/resources/kkkdownload/video/Bil_Result_${OBJECT.INFODATA.data.bvid}.mp4`, filePath)
              await this.removeFileOrFolder(bmp4, true)
              await this.removeFileOrFolder(bmp3, true)

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
        await new TikHub(this.e).DownLoadVideo(OBJECT.DATA.data.durl[0].url, this.downloadfilename)
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

  async removeFileOrFolder(path, force = false) {
    if (this.Config.rmmp4 || this.Config.rmmp4 === undefined) {
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
    } else if (force) {
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
