import { Base, logger } from './index.js'
import Version from './Version.js'
import Config from './Config.js'
import { join } from 'node:path'
import fs from 'node:fs'

/** 常用工具合集 */
class Tools {
  constructor() {
    // 初始化default路径
    const defaultPath = join(Version.clientPath, 'temp', Version.pluginName)
    this.tempDri = {
      /** 插件缓存目录 */
      default: defaultPath,
      /** 视频缓存文件 */
      video: join(defaultPath, 'kkkdownload', 'video') + '/',
      /** 图片缓存文件 */
      images: join(defaultPath, 'kkkdownload', 'images') + '/'
    }
  }

  /**
   * 获取回复消息的内容
   * @param {*} e 消息事件对象
   * @returns {Promise<string>} 回复消息的文本内容
   */
  async getReplyMessage(e) {
    const botAdapter = new Base(e).botadapter
    // TRSS-Yunzai 处理
    if (Version.BotName === 'TRSS-Yunzai' && e.reply_id) {
      const replyMsg = await e.getReply()
      if (replyMsg) {
        const sourceArray = Array.isArray(replyMsg) ? replyMsg : [replyMsg]
        e.msg = sourceArray
          .flatMap(item => item.message)
          .filter(msg => ['text', 'json'].includes(msg?.type))
          .map(i => i?.text || i?.data)
          .join('')
      }
    }
    // ICQQ适配器处理
    if (botAdapter === 'ICQQ' && e.source) {
      const history = await e.group.getChatHistory(e.source.seq, 1)
      const message = history.pop()?.message
      const textMsg = message?.find((/** @type {{ type: string; }} */ v) => ['text', 'json'].includes(v?.type))
      if (textMsg) e.msg = textMsg.text || textMsg.data
    }

    // Miao-Yunzai OneBotv11 处理
    if (Version.BotName === 'Miao-Yunzai' && ['LagrangeCore', 'Lagrange.OneBot', 'OneBotv11'].includes(botAdapter)) {
      const replyMsg = e.message.find((/** @type {{ type: string; }} */ msg) => msg.type === 'reply')
      if (replyMsg) {
        const replyData = await e.bot?.sendApi?.('get_msg', { message_id: replyMsg.id })
        const message = replyData?.data?.message?.find((/** @type {{ type: string; }} */ v) => ['text', 'json'].includes(v?.type))
        if (message) e.msg = message.data?.text || message.data?.data
      }
    }
    return e.msg || ''
  }

  /**
   * 将中文数字转换为阿拉伯数字
   * @param {string} chineseNumber 中文数字字符串
   * @returns {number} 转换后的阿拉伯数字
   */
  chineseToArabic(chineseNumber) {
    const numbers = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
    const units = { 十: 10, 百: 100, 千: 1000, 万: 10000, 亿: 100000000 }

    let result = 0, temp = 0, unit = 1

    for (let i = chineseNumber.length - 1; i >= 0; i--) {
      const char = chineseNumber[i]

      if (char && char in units) {
        unit = /** @type {number} */ (units[/** @type {keyof typeof units} */ (char)])
        if (unit >= 10000) {
          result += temp * unit
          temp = 0
        }
      } else if (char && char in numbers) {
        temp += /** @type {number} */ (numbers[/** @type {keyof typeof numbers} */ (char)]) * (unit > 1 ? unit : 1)
        unit = 1
      }
    }

    return result + temp
  }

  /**
   * 格式化Cookie字符串
   * @param {string[]} cookies Cookie数组
   * @returns {string} 格式化后的Cookie字符串
   */
  formatCookies(cookies) {
    return cookies.map(cookie => {
      const [nameValue] = cookie.split(';').map(part => part.trim())
      const [name, value] = (nameValue || '').split('=')
      return `${name}=${value}`
    }).join('; ')
  }

  /**
   * 计算视频比特率
   * @param {number} targetSizeMB 目标文件大小(MB)
   * @param {number} duration 视频时长(秒)
   * @returns {number} 计算得到的比特率(kbps)
   */
  calculateBitrate(targetSizeMB, duration) {
    const targetSizeBytes = targetSizeMB * 1024 * 1024
    return (targetSizeBytes * 8) / duration / 1024
  }

  /**
   * 获取视频文件大小
   * @param {string} filePath 文件路径
   * @returns {Promise<number>} 文件大小(MB)
   */
  async getVideoFileSize(filePath) {
    try {
      const stats = await fs.promises.stat(filePath)
      const fileSizeInBytes = stats.size
      const fileSizeInMB = fileSizeInBytes / (1024 * 1024)
      return fileSizeInMB
    } catch (error) {
      console.error('获取文件大小时发生错误:', error)
      throw error
    }
  }

  /**
   * 将数字转换为带"万"单位的字符串
   * @param {number} count 需要转换的数字
   * @returns {string} 转换后的字符串，超过1万的数字会转换为"xx万"的格式
   * @example
   * count(12345) // 返回 "1.2万"
   * count(999) // 返回 "999"
   * count(undefined) // 返回 "无法获取"
   */
  count(count) {
    if (count > 10000) {
      return (count / 10000).toFixed(1) + '万'
    } else {
      return count?.toString() || '无法获取'
    }
  }

  /**
   * 递归创建文件夹
   * @param {string} dirname 文件夹路径
   * @returns {Promise<boolean>} 返回布尔值 是否创建成功
   */
  async mkdir(dirname) {
    try {
      await fs.promises.mkdir(dirname, { recursive: true })
      return true
    } catch {
      return false
    }
  }

  /**
   * 删除文件
   * @param {string} dirname 文件路径
   * @param {boolean} force 是否强制删除
   * @returns {Promise<boolean>} 删除是否成功
   */
  async removeFile(dirname, force = false) {
    if (!Config.app.removeCache && !force) return true

    const normalizedPath = dirname.replace(/\\/g, '/')
    try {
      await fs.promises.unlink(normalizedPath)
      logger.mark(`缓存文件: ${normalizedPath} 删除成功！`)
      return true
    } catch (err) {
      logger.error(`缓存文件: ${normalizedPath} 删除失败！`, err)
      return false
    }
  }

  /**
   * 将时间戳转换为日期时间字符串
   * @param {number} timestamp Unix时间戳
   * @returns {string} 格式化的日期时间字符串 (YYYY-MM-DD HH:mm)
   */
  convertTimestampToDateTime(timestamp) {
    const date = new Date(timestamp * 1000)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

  /**
   * 获取当前时间的格式化字符串
   * @returns {string} 格式化的当前时间字符串 (YYYY-MM-DD HH:mm:ss)
   */
  getCurrentTime() {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const day = now.getDate()
    const hour = now.getHours()
    const minute = now.getMinutes()
    const second = now.getSeconds()

    const formattedMonth = month < 10 ? '0' + month : '' + month
    const formattedDay = day < 10 ? '0' + day : '' + day
    const formattedHour = hour < 10 ? '0' + hour : '' + hour
    const formattedMinute = minute < 10 ? '0' + minute : '' + minute
    const formattedSecond = second < 10 ? '0' + second : '' + second
    return `${year}-${formattedMonth}-${formattedDay} ${formattedHour}:${formattedMinute}:${formattedSecond}`
  }

  /**
   * 根据配置和时间判断是否使用深色主题
   * @returns {boolean} 是否使用深色主题
   */
  useDarkTheme() {
    let dark = true
    const configTheme = Config.app.Theme
    if (configTheme === 0) {
      const date = new Date().getHours()
      if (date >= 6 && date < 18) {
        dark = false
      }
    } else if (configTheme === 1) {
      dark = false
    } else if (configTheme === 2) {
      dark = true
    }
    return dark
  }

  /**
   * 计算从指定时间戳到现在经过的时间
   * @param {number} timestamp 起始时间戳
   * @returns {string} 格式化的经过时间字符串
   */
  timeSince(timestamp) {
    const now = Date.now()
    const elapsed = now - timestamp

    const seconds = Math.floor(elapsed / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    const remainingSeconds = seconds % 60
    const remainingMinutes = minutes % 60

    if (hours > 0) {
      return `${hours}小时${remainingMinutes}分钟${remainingSeconds}秒`
    } else if (minutes > 0) {
      return `${minutes}分钟${remainingSeconds}秒`
    } else {
      return `${seconds}秒`
    }
  }

  /**
   * 休眠函数
   * @param {number} ms 毫秒
   * @example
   * ```js
   * await Common.sleep(1000)
   * ```
   */
  async sleep(ms) {
    new Promise(resolve => setTimeout(resolve, ms))
  }

}

export default new Tools()
