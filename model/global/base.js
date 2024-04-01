import cfg from '../../../../lib/config/config.js'
import networks from './networks.js'
import { Config } from '../config.js'
import fs from 'fs'
import path from 'path'

export default class base {
  constructor(e = {}) {
    this.e = e
    this.headers = {
      Accept: '*/*',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
    this.numcomments = Config.numcomments
    this.comments = Config.comments
    this.URL = ''
    this.botCfg = cfg
    this.Config = Config
    this._path = process.cwd()
    this.ConfigPath = process.cwd() + '/plugins/kkkkkk-10086/config/config.json'
    this.networks = networks
  }
  get allow() {
    return Config.ck !== ''
  }

  /** 要上传的视频文件，私聊需要加好友 */
  async upload_file(file) {
    if (this.e.bot?.sendUni) {
      /** 是icqq */
      await this.e.group.fs.upload(file)
    } else {
      /** 其他协议端 */
      await this.e.group.sendFile(file)
    }
    await this.removeFileOrFolder(file)
  }
  async DownLoadVideo(video_url, title) {
    let res = await this.DownLoadFile(video_url, title, this.headers)
    res.totalBytes = (res.totalBytes / (1024 * 1024)).toFixed(2)
    if (this.botCfg.bot.skip_login) {
      if (res.totalBytes >= 75) {
        await this.upload_file(res.filepath)
        await this.removeFileOrFolder(res.filepath)
      } else {
        if (this.e.bot?.adapter === 'LagrangeCore') {
          await this.upload_file(res.filepath)
        } else {
          await this.e.reply(segment.video(video_url))
        }
        await this.removeFileOrFolder(res.filepath)
      }
    } else if (res.totalBytes >= 75) {
      // 群和私聊分开
      await this.e.reply(`视频大小: ${res.totalBytes}MB 正通过群文件上传中...`)
      await this.upload_file(res.filepath)
      await this.removeFileOrFolder(res.filepath)
    } else {
      await this.e.reply(segment.video(res.filepath))
      await this.removeFileOrFolder(res.filepath)
    }
  }

  /**
   *
   * @param {*} video_url 下载地址
   * @param {*} title 文件名
   * @param {*} headers 请求头
   * @param {*} type 下载文件类型，默认.mp4
   * @returns
   */
  async DownLoadFile(video_url, title, headers = {}, type = '.mp4') {
    const { filepath, totalBytes } = await new this.networks({
      url: video_url,
      headers: headers,
      filepath: `${this._path}/resources/kkkdownload/video/${title}${type}`,
    }).downloadStream((downloadedBytes, totalBytes) => {
      const progressPercentage = (downloadedBytes / totalBytes) * 100
      console.log(`Download ${title}: ${progressPercentage.toFixed(2)}%`)
    })
    return { filepath, totalBytes }
  }

  /** 删文件 */
  async removeFileOrFolder(path, force) {
    if (Config.rmmp4 === true || Config.rmmp4 === undefined) {
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
            console.error(path + ' 删除失败！', err)
          } else {
            console.log(path + ' 删除成功！')
          }
        })
      }
    } else if (force) {
      fs.unlink(path, (err) => {
        if (err) {
          console.error(path + ' 删除失败！', err)
        } else {
          console.log(path + ' 删除成功！')
        }
      })
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

  /** 文件夹名字 */
  async mkdirs(dirname) {
    if (fs.existsSync(dirname)) {
      return true
    } else {
      if (mkdirs(path.dirname(dirname))) {
        fs.mkdirSync(dirname)
        return true
      }
    }
  }
}
