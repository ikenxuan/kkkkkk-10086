import Config from './Config.js'
import Networks from './Networks.js'
import Version from './Version.js'
import { segment, logger, Bot, common } from '../lib/public/index.js'
import fs from 'fs'
import path from 'path'

export default class Base {
  constructor (e = {}) {
    /**
     * @type { import('node-karin').KarinMessage }
     */
    this.e = e
    this.headers = {
      Accept: '*/*',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    }
    this._path = process.cwd()?.replace(/\\/g, '/')
  }

  /** 检查是或否设置抖音ck */
  get allow () {
    return Config.cookies.douyin !== ''
  }

  /** 获取鸡鸡人名字 */
  get botname () {
    return Version.BotName
  }

  /** 获取适配器名称 */
  get botadapter () {
    if (this.botname === 'Miao-Yunzai' || this.botname === 'yunzai') {
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
          return 'ICQQ'
      }
    } else if (this.botname === 'TRSS-Yunzai') {
      switch (true) {
        case this.e.bot?.adapter?.name === 'ICQQ':
          return 'ICQQ'
        case this.e.bot?.adapter?.name === 'QQBot':
          return 'QQBot'
        case this.e.bot?.adapter?.name === 'OneBotv11':
          switch (this.e.bot?.version?.app_name) {
            case 'Lagrange.OneBot':
              return 'Lagrange.OneBot'
            default:
              return 'OneBotv11'
          }
        case this.e.bot?.adapter?.name === 'Lagrange':
          return 'LagrangeCore'
        case this.e.bot?.adapter?.name === 'KOOKBot':
          return 'KOOKBot'
        default:
          return 'ICQQ'
      }
    } else if (this.botname === 'Karin') {
      return this.e.bot?.adapter?.name
    }
  }

  resultMsg (forwardmsg) {
    if (this.botname === 'Miao-Yunzai' || this.botname === 'yunzai') {
      if (this.botadapter === 'OneBotv11') return null
      return forwardmsg
    } else if (this.botname === 'TRSS-Yunzai') {
      switch (this.botadapter) {
        case 'ICQQ':
        case 'LagrangeCore':
        case 'QQBot':
        case 'OneBotv11':{
          return forwardmsg
        }
        case 'KOOKBot':{
          return null
        }
        default:
          break
      }
    } else {
      return forwardmsg
    }
  }

  /**
   *
   * @param {Array|String} msg 消息
   * @param {Array} btns 按钮数组
   * @returns
   */
  mkMsg (msg, btns = []) {
    if (!Array.isArray(msg)) {
      msg = [ msg ]
    }
    if (btns.length > 0) {
      btns = this.mkbutton(btns)
      if (btns) {
        return [ ...msg, btns ]
      } else return msg
    } else return msg.flat(Infinity)
  }

  /**
   *
   * @param {Array} btn 按钮数组
   * @returns
   */
  mkbutton (btn) {
    switch (this.botname) {
      case 'Miao-Yunzai':
      case 'yunzai':{
      /** 判断是否ICQQ */
        switch (this.botadapter) {
          case 'QQBot':{
            if (this.e.bot.config?.markdown?.type !== 0 || !undefined) {
              return Bot.Button(btn)
            } else {
              return null
            }
          }
          default:
            return null
        }
      }
      case 'TRSS-Yunzai':{
        return segment.button(btn)
      }
      default:
        break
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
  async upload_file (file, video_url, groupfile = false) {
    try {
      switch (this.botname) {
        case 'Miao-Yunzai':
        case 'yunzai':{
          switch (this.botadapter) {
            case 'ICQQ':{
              if (this.e.isGroup) {
                groupfile
                  ? await this.e.group.fs.upload(file.filepath)
                  : await this.e.reply(
                    segment.video(file.filepath || video_url)
                  )
              } else {
                groupfile
                  ? await this.e.friend.fs.upload(file.filepath)
                  : await this.e.reply(
                    segment.video(file.filepath || video_url)
                  )
              }
              break
            }
            case 'LagrangeCore':{
              /** 拉格朗视频默认传群文件 */
              groupfile
                ? await this.e.group.sendFile(file.filepath)
                : await this.e.reply(segment.video(file.filepath || video_url))
              break
            }
            case 'OneBotv11':{
              groupfile
                ? await this.e.group.fs.upload(file.filepath)
                : await this.e.reply(segment.video(file.filepath || video_url))
              break
            }
            case 'QQBot':{
              if (file.totalBytes < 10) {
                await this.e.reply(segment.video(video_url || file.filepath))
                break
              }
              (() => {
                return new Promise((resolve, reject) => {
                  try {
                    /** 尝试硬发 */
                    this.e.reply(segment.video(video_url || file.filepath))
                  } catch {
                    reject(new Error('视频太大了，发不出来'))
                  }
                })
              })()
              break
            }
            default:
              break
          }
          break
        }
        case 'TRSS-Yunzai':
          switch (this.botadapter) {
            case 'LagrangeCore':{
              logger.warn(
                'TRSS-Yunzai & Lagrange插件暂不支持上传视频，请使用ws链接Lagrange'
              )
              break
            }
            case 'Lagrange.OneBot':{
              groupfile
                ? await this.e.group.sendFile(file.filepath)
                : await this.e.reply(segment.video(file.filepath || video_url))
              break
            }
            case 'QQBot':{
              file.totalBytes >= 10
                ? await this.e.reply(segment.file(file.filepath))
                : await this.e.reply(segment.video(video_url || file.filepath))
              break
            }
            case 'ICQQ':{
              if (this.e.isGroup) {
                groupfile
                  ? await this.e.reply(segment.file(file.filepath))
                  : await this.e.reply(
                    segment.video(file.filepath || video_url)
                  )
              } else {
                groupfile
                  ? await this.e.reply(segment.file(file.filepath))
                  : await this.e.reply(
                    segment.video(file.filepath || video_url)
                  )
              }
              break
            }
            case 'OneBotv11':
            case 'KOOKBot':{
              groupfile
                ? await this.e.reply(segment.file(file.filepath))
                : await this.e.reply(segment.video(file.filepath || video_url))
              break
            }
            default:
              break
          }
          break
        case 'Karin':{
          groupfile
            ? await this.e.reply('暂时不支持群文件上传')
            : await this.e.reply(segment.video('base64://' + await common.base64(file.filepath) || video_url))
          break
        }
        default:
          break
      }
    } catch (error) {
      logger.error('视频上传错误,' + error)
    } finally {
      await this.removeFile(file.filepath)
    }
  }

  /**
   * 异步下载视频并根据大小决定上传方式。
   * @param {string} video_url - 视频的URL地址。
   * @param {string} title - 视频的标题。
   * @returns {Promise<void>} 不返回任何内容。
   */
  async DownLoadVideo (video_url, title) {
    // 下载文件，视频URL，标题和自定义headers
    const res = await this.DownLoadFile(video_url, title, this.headers)
    // 将下载的文件大小转换为MB并保留两位小数
    res.totalBytes = (res.totalBytes / (1024 * 1024)).toFixed(2)
    // 根据视频大小和适配器类型决定上传方式
    // 视频75兆时不被拦截的适配器
    const continueAdapter = [ 'LagrangeCore', 'Lagrange.OneBot', 'OneBotv11', 'OneBot11' ]
    const useGroupFile = (res.totalBytes > 75 && !continueAdapter.includes(this.botadapter)) || (res.totalBytes > 99 && continueAdapter.includes(this.botadapter))
    if (useGroupFile) {
      this.e.reply(`视频大小: ${res.totalBytes}MB 正通过群文件上传中...`)
    }
    /** 上传视频 */
    await this.upload_file(res, video_url, useGroupFile)
  }

  /**
   * 异步下载文件的函数。
   *
   * @param {String} video_url 下载地址。
   * @param {String} title 文件名。
   * @param {Object} headers 请求头，可选参数，默认为空对象。
   * @param {String} type 下载文件的类型，默认为'.mp4'。
   * @returns 返回一个包含文件路径和总字节数的对象。
   */
  async DownLoadFile (video_url, title, headers = {}, type = '.mp4') {
    // 使用networks类进行文件下载，并通过回调函数实时更新下载进度
    await this.mkdirs(`${this._path}/resources/kkkdownload/video/`)
    const { filepath, totalBytes } = await new Networks({
      url: video_url, // 视频地址
      headers, // 请求头
      filepath: `${this._path}/resources/kkkdownload/video/${title}${type}`, // 文件保存路径
      timeout: 30000, // 设置30秒超时
      maxRetries: 3   // 最多重试3次
    }).downloadStream((downloadedBytes, totalBytes) => {
      // 定义进度条长度及生成进度条字符串的函数
      const barLength = 45
      function generateProgressBar (progressPercentage) {
        // 根据进度计算填充的'#'字符数量，并生成进度条样式
        const filledLength = Math.floor((progressPercentage / 100) * barLength)
        let progress = ''
        progress += '#'.repeat(filledLength)
        progress += '-'.repeat(Math.max(0, barLength - filledLength - 1))
        const formattedProgress = progressPercentage.toFixed(2) + '%'
        console.log(`正在下载 ${title}${type} [${progress}] ${formattedProgress}\r`)
      }
      // 计算并打印当前下载进度
      const progressPercentage = (downloadedBytes / totalBytes) * 100
      generateProgressBar(progressPercentage)
    })
    return { filepath, totalBytes }
  }

  /** 删文件 */
  async removeFile (path, force) {
    if (Config.app.rmmp4) {
      try {
        fs.promises.unlink(path)
        logger.mark('缓存文件: ', path + ' 删除成功！')
      } catch (err) {
        logger.error('缓存文件: ', path + ' 删除失败！', err)
      }
    } else if (force) {
      try {
        fs.promises.unlink(path)
        logger.mark('缓存文件: ', path + ' 删除成功！')
      } catch (err) {
        logger.error('缓存文件: ', path + ' 删除失败！', err)
      }
    }
  }

  /** 过万整除 */
  count (count) {
    if (count > 10000) {
      return (count / 10000).toFixed(1) + '万'
    } else {
      return count?.toString() || '无法获取'
    }
  }

  /** 文件夹名字 */
  async mkdirs (dirname) {
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
