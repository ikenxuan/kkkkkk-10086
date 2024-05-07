import { botCfg, networks, Config } from '#modules'
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
    this.botCfg = botCfg
    this.Config = Config
    this._path = process.cwd()
    this.ConfigPath = process.cwd() + '/plugins/kkkkkk-10086/config/config.json'
    this.networks = networks
  }

  /** 检查是或否设置抖音ck */
  get allow() {
    return Config.ck !== ''
  }

  /** 获取鸡鸡人名字 */
  get botname() {
    return this.botCfg.package.name === 'miao-yunzai' ? 'miao-yunzai' : 'trss-yunzai'
  }

  /** 获取登录协议 */
  get botadapter() {
    if (this.botCfg.package.name === 'miao-yunzai') {
      if (this.e.bot?.sendUni) {
        return 'ICQQ'
      }
      switch (true) {
        case this.e.bot?.adapter === 'LagrangeCore':
          return 'LagrangeCore'
        case this.e.bot?.adapter === 'QQBot':
          return 'QQBot'
        case this.e.bot?.adapter === 'OneBotv11':
          return 'OneBotv11'
        default:
          return '无法判断适配器'
      }
    } else if (this.botCfg.package.name === 'trss-yunzai') {
      switch (true) {
        case this.e.bot?.adapter?.name === 'ICQQ':
          return 'ICQQ'
        case this.e.bot?.adapter?.name === 'Lagrange':
          return 'LagrangeCore'
        case this.e.bot?.adapter?.name === 'QQBot':
          return 'QQBot'
        case this.e.bot?.adapter?.name === 'OneBotv11':
          return 'OneBotv11'
        case this.e.bot?.adapter?.name === 'KOOKBot':
          return 'KOOKBot'
        default:
          return '无法判断适配器'
      }
    }
  }

  resultMsg(forwardmsg) {
    if (this.botname === 'miao-yunzai') {
      if (this.botadapter === 'OneBotv11') return null
      return forwardmsg
    } else if (this.botname === 'trss-yunzai') {
      switch (this.botadapter) {
        case 'ICQQ':
        case 'LagrangeCore':
        case 'QQBot':
        case 'OneBotv11':
        default:
          return forwardmsg
        case 'KOOKBot':
          return null
      }
    }
  }
  /**
   *
   * @param {Array|String} msg 消息
   * @param {Array} btns 按钮数组
   * @returns
   */
  mkMsg(msg, btns = []) {
    if (!Array.isArray(msg)) {
      msg = [msg]
    }
    if (btns.length > 0) {
      btns = this.mkbutton(btns)
      if (btns) {
        return [...msg, btns]
      } else return msg
    } else return msg.flat(Infinity)
  }

  /**
   *
   * @param {Array} btn 按钮数组
   * @returns
   */
  mkbutton(btn) {
    switch (this.botname) {
      case 'miao-yunzai':
        /** 判断是否ICQQ */
        switch (this.botadapter) {
          case 'ICQQ':
          case 'LagrangeCore':
          case 'OneBotv11':
            return null
          case 'QQBot':
            if (this.e.bot.config?.markdown?.type !== 0 || !undefined) {
              return Bot.Button(btn)
            } else {
              return null
            }
          default:
            return null
        }

      case 'trss-yunzai':
        return segment.button(btn)
    }
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
      switch (this.botname) {
        case 'miao-yunzai':
          switch (this.botadapter) {
            case 'ICQQ':
              if (this.e.isGroup) {
                groupfile ? await this.e.group.fs.upload(file.filepath) : await this.e.reply(segment.video(file.filepath || video_url))
              } else {
                groupfile ? await this.e.friend.fs.upload(file.filepath) : await this.e.reply(segment.video(file.filepath || video_url))
              }
              break
            case 'LagrangeCore':
              /** 拉格朗视频默认传群文件 */
              await this.e.group.sendFile(file.filepath)
              break
            case 'OneBotv11':
              groupfile ? await this.e.group.fs.upload(file.filepath) : await this.e.reply(segment.video(file.filepath || video_url))
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
          break

        case 'trss-yunzai':
          switch (this.botadapter) {
            case 'LagrangeCore':
              logger.warn('TRSS-Yunzai & Lagrange适配器暂不支持上传视频')
            case 'QQBot':
              file.totalBytes >= 10 ? await this.e.reply(segment.file(file.filepath)) : await this.e.reply(segment.video(video_url || file.filepath))
              break
            case 'ICQQ':
              if (this.e.isGroup) {
                groupfile ? await this.e.reply(segment.file(file.filepath)) : await this.e.reply(segment.video(file.filepath || video_url))
              } else {
                groupfile ? await this.e.reply(segment.file(file.filepath)) : await this.e.reply(segment.video(file.filepath || video_url))
              }
              break
            case 'OneBotv11':
            case 'KOOKBot':
              groupfile ? await this.e.reply(segment.file(file.filepath)) : await this.e.reply(segment.video(file.filepath || video_url))
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
      this.e.reply(`视频大小: ${res.totalBytes}MB 正通过群文件上传中...`)
      /** 使用群文件 */
      await this.upload_file(res, video_url, true)
    } else {
      /** 不使用群文件 */
      await this.upload_file(res, video_url)
    }
  }

  /**
   *
   * @param {String} video_url 下载地址
   * @param {String} title 文件名
   * @param {Object} headers 请求头
   * @param {String} type 下载文件类型，默认.mp4
   * @returns
   */
  async DownLoadFile(video_url, title, headers = {}, type = '.mp4') {
    const { filepath, totalBytes } = await new this.networks({
      url: video_url,
      headers: headers,
      filepath: `${this._path}/resources/kkkdownload/video/${title}${type}`,
    }).downloadStream((downloadedBytes, totalBytes) => {
      // const progressPercentage = (downloadedBytes / totalBytes) * 100
      // console.log(`Download ${title}: ${progressPercentage.toFixed(2)}%`)
      const barLength = 45
      function generateProgressBar(progressPercentage) {
        // 计算进度条中应填充的 '#' 符号数量
        const filledLength = Math.floor((progressPercentage / 100) * barLength)
        // 计算进度条样式
        let progress = ''
        progress += '#'.repeat(filledLength)
        progress += '-'.repeat(Math.max(0, barLength - filledLength - 1))
        const formattedProgress = progressPercentage.toFixed(2) + '%'
        console.log(`DownLoading ${title}${type} [${progress}] ${formattedProgress}\r`)
      }
      // 计算进度百分比
      const progressPercentage = (downloadedBytes / totalBytes) * 100
      generateProgressBar(progressPercentage)
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
      if (this.mkdirs(path.dirname(dirname))) {
        fs.mkdirSync(dirname)
        return true
      }
    }
  }
}
