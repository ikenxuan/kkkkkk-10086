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

  /**
   *
   * @param {object} file 视频文件数据
   * @param {string} file.filepath 要上传的视频文件地址
   * @param {number} file.totalBytes 要上传的视频文件大小，单位：MB
   * @param {string} video_url 要上传的视频直链
   * @param {boolean} groupfile 是否使用群文件，默认false
   */
  async upload_file(file, video_url, groupfile = false) {
    try {
      switch (this.botCfg.package.name) {
        case 'miao-yunzai':
          if (this.e.bot?.sendUni) {
            /** 登陆了icqq */
            groupfile ? await this.e.group.fs.upload(file.filepath) : await this.e.reply(segment.video(video_url || file.filepath))
          } else {
            /** 其他协议端 */
            switch (this.e.bot?.adapter) {
              case 'LagrangeCore':
                /** 拉格朗视频时好时坏，默认传群文件 */
                await this.e.group.sendFile(file.filepath)
                break
              case 'QQBot':
                file.totalBytes >= 10
                  ? (() => {
                      return new Promise((resolve, reject) => {
                        try {
                          /** 尝试硬发 */
                          this.e.reply(segment.video(video_url || file.filepath))
                        } catch {
                          reject(new Error('视频太大了，发不出来'))
                        }
                      })
                    })()
                  : await this.e.reply(segment.video(video_url || file.filepath))
                break
            }
          }
          break

        case 'trss-yunzai':
          switch (this.e.bot?.adapter?.name) {
            case 'Lagrange':
              logger.warn('TRSS-Yunzai & Lagrange适配器暂不支持上传视频')
            case 'QQBot':
              file.totalBytes >= 10 ? await this.e.reply(segment.file(file.filepath)) : await this.e.reply(segment.video(video_url || file.filepath))
              break
            case 'ICQQ':
              groupfile ? await this.e.group.sendFile(file.filepath) : await this.e.reply(segment.video(video_url || file.filepath))
              break
          }
          break
      }
    } catch {
      await this.removeFileOrFolder(file.filepath)
    }
    await this.removeFileOrFolder(file.filepath)
  }
  async DownLoadVideo(video_url, title) {
    let res = await this.DownLoadFile(video_url, title, this.headers)
    res.totalBytes = (res.totalBytes / (1024 * 1024)).toFixed(2)
    if (res.totalBytes > 75) {
      this.botCfg.package.name === 'trss-yunzai' ? null : this.e.reply(`视频大小: ${res.totalBytes}MB 正通过群文件上传中...`)
      /** 使用群文件 */
      await this.upload_file(res, video_url, true)
    } else {
      /** 不使用群文件 */
      await this.upload_file(res, video_url)
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
