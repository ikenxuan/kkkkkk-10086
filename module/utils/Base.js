import { Networks, baseHeaders, logger, segment, Bot, mergeFile } from './index.js'
import Client, { bilibiliErrorCodeMap } from '@ikenxuan/amagi'
import cfg from '../../../../lib/config/config.js'
import { Render } from './Render.js'
import Version from './Version.js'
import Config from './Config.js'
import Common from './Common.js'
import fs from 'fs'

/**
 * 统计每个平台使用最多的机器人 ID 和使用次数
 * @typedef {Object} PlatformBotStats
 * @property {string} botId 机器人 ID
 * @property {number} count 使用次数
 */

/**
 * 上传文件选项
 * @typedef {Object} uploadFileOptions
 * @property {boolean} [useGroupFile] 是否使用群文件上传
 * @property {string} [message_id] 消息ID，如果有，则将使用该消息ID制作回复元素
 * @property {boolean} [active] 是否为主动消息
 * @property {Object} [activeOption] 主动消息参数
 * @property {string} activeOption.uin 机器人账号
 * @property {string} activeOption.group_id 群号
 */

/**
 * 文件名选项
 * @typedef {Object} title
 * @property {string} [originTitle] 文件名：自定义
 * @property {string} [timestampTitle] 文件名：tmp + 时间戳
 */

/**
 * 下载文件选项
 * @typedef {Object} downloadFileOptions
 * @property {string} video_url 视频链接
 * @property {title} title 文件名
 * @property {string} [filetype] 下载文件类型，默认为'.mp4'
 * @property {import('axios').AxiosRequestConfig['headers']} [headers] 自定义请求头，将使用该请求头下载文件
 */

/**
 * 文件信息
 * @typedef {Object} fileInfo
 * @property {string} filepath 视频文件的绝对路径
 * @property {number} totalBytes 视频文件大小
 * @property {string} [originTitle] 文件名：自定义
 * @property {string} [timestampTitle] 文件名：tmp + 时间戳
 */

/**
 * HTTP请求方法类型
 * @typedef {'GET'|'POST'|'PUT'|'DELETE'|'PATCH'|'HEAD'|'OPTIONS'} Method
 */

/**
 * 表示HTTP请求方法的请求头类型
 * @typedef {Object} MethodsHeaders
 * @remarks
 * 这是一个部分类型，将HTTP方法映射到对应的AxiosHeaders类型
 * @property {import('axios').AxiosHeaders} [get] GET方法请求头
 * @property {import('axios').AxiosHeaders} [post] POST方法请求头
 * @property {import('axios').AxiosHeaders} [put] PUT方法请求头
 * @property {import('axios').AxiosHeaders} [delete] DELETE方法请求头
 * @property {import('axios').AxiosHeaders} [patch] PATCH方法请求头
 * @property {import('axios').AxiosHeaders} [head] HEAD方法请求头
 * @property {import('axios').AxiosHeaders} [options] OPTIONS方法请求头
 * @property {import('axios').AxiosHeaders} common 通用请求头
 */

/**
 * 下载文件配置选项
 * @typedef {Object} downLoadFileOptions
 * @property {string} title 文件名
 * @property {import('axios').RawAxiosRequestHeaders & import('./index.js').MethodsHeaders | import('axios').AxiosHeaders} [headers] 用于下载文件的请求头
 * @default {}
 */

export class Base {
  /** @type {import('axios').AxiosRequestConfig['headers']} */
  headers
  /** @type {ReturnType<typeof Client>} */
  amagi
  /**
   * @param {*} e 消息对象
   */
  constructor(e) {
    this.e = e
    /** @type {import('axios').AxiosRequestConfig['headers']} */
    this.headers = baseHeaders
    const client = Client({
      cookies: {
        douyin: Config.cookies.douyin,
        bilibili: Config.cookies.bilibili,
        kuaishou: Config.cookies.kuaishou
      },
      request: {
        timeout: Config.request?.timeout ?? 15000,
        headers: { 'User-Agent': Config.request?.['User-Agent'] ?? this.headers?.['User-Agent'] },
        proxy: Config.request?.proxy?.switch ? {
          host: Config.request.proxy.host,
          port: parseInt(Config.request.proxy.port),
          protocol: Config.request.proxy.protocol,
          auth: Config.request.proxy.auth
        } : false,
      }
    })

    // 使用Proxy包装amagi客户端
    this.amagi = new Proxy(client, {
      get(/** @type {ReturnType<typeof Client>} */ target, /** @type {keyof ReturnType<typeof Client>} */ prop) {
        const method = target[prop]
        if (typeof method === 'function') {
          return async (/** @type {any} */ ...args) => {
            const result = await Function.prototype.apply.call(method, target, args)

            // 返回值检查逻辑
            if (!result) {
              logger.warn(`Amagi API调用 (${String(prop)}) 返回了空值`)
              return result
            }

            // 检查抖音数据返回结构
            if (prop === 'getDouyinData' && (result.code !== 200)) {
              /** @type {import('@ikenxuan/amagi').ApiResponse<import('@ikenxuan/amagi').APIErrorType<'douyin'>>} */
              const err = result
              const img = await Render('apiError/index', err.error)
              if (Object.keys(e).length === 0) {
                await sendMasterMessage('douyin', img)
                throw new Error(err.data.amagiMessage)
              }
              await e.reply(img)
              throw new Error(err.data.amagiMessage)
            }

            // 检查哔哩哔哩数据返回结构
            if (prop === 'getBilibiliData' && result.code in bilibiliErrorCodeMap) {
              /** @type {import('@ikenxuan/amagi').ApiResponse<import('@ikenxuan/amagi').APIErrorType<'bilibili'>>} */
              const err = result
              const img = await Render('apiError/index', err.error)
              if (Object.keys(e).length === 0) {
                await sendMasterMessage('bilibili', img)
                throw new Error(err.data.amagiMessage)
              }
              await e.reply(img)
              throw new Error(err.data.amagiMessage)
            }
            return result
          }
        }
        return method
      }
    })
  }

  /**
   * 获取适配器名称
   * @returns {string} 返回适配器名称，如 'ICQQ', 'LagrangeCore', 'QQBot', 'OneBotv11' 等
   */
  get botadapter() {
    // 定义不同机器人版本对应的适配器检查规则
    const adapters = {
      // Miao-Yunzai 版本的适配器检查规则
      'Miao-Yunzai': {
        'ICQQ': () => this.e?.bot?.sendUni,  // 检查是否有 sendUni 方法
        'LagrangeCore': () => this.e?.bot?.adapter === 'LagrangeCore',
        'QQBot': () => this.e?.bot?.adapter === 'QQBot',
        'OneBotv11': () => this.e?.bot?.adapter === 'OneBotv11'
      },
      // TRSS-Yunzai 版本的适配器检查规则
      'TRSS-Yunzai': {
        'ICQQ': () => this.e?.bot?.adapter?.name === 'ICQQ',
        'QQBot': () => this.e?.bot?.adapter?.name === 'QQBot',
        'OneBotv11': () => this.e?.bot?.adapter?.name === 'OneBotv11',
        'LagrangeCore': () => this.e?.bot?.adapter?.name === 'Lagrange',
        'KOOKBot': () => this.e?.bot?.adapter?.name === 'KOOKBot'
      }
    }

    // 特殊处理 TRSS-Yunzai 的 OneBotv11 情况
    if (Version.BotName === 'TRSS-Yunzai' && this?.e?.bot?.adapter?.name === 'OneBotv11') {
      // 判断是否为 Lagrange.OneBot 版本
      return this.e?.bot?.version?.app_name === 'Lagrange.OneBot' ? 'Lagrange.OneBot' : 'OneBotv11'
    }

    // 查找匹配的适配器，优先使用对应版本的适配器检查规则，如果没有则使用 Miao-Yunzai 的规则
    const botAdapters = adapters[Version.BotName] || adapters['Miao-Yunzai']
    // 遍历适配器检查规则，返回第一个匹配的适配器名称
    for (const [adapterName, checkFn] of Object.entries(botAdapters)) {
      if (checkFn()) {
        return adapterName
      }
    }

    // 默认返回 ICQQ
    return 'ICQQ'
  }

  /**
   * 处理转发消息
   * @param {*} forwardmsg - 转发消息内容
   * @returns {*} 处理后的消息或null
   */
  resultMsg(forwardmsg) {
    // Miao-Yunzai的处理
    if (Version.BotName === 'Miao-Yunzai') {
      return this.botadapter === 'OneBotv11' ? null : forwardmsg
    }

    // TRSS-Yunzai的处理
    if (Version.BotName === 'TRSS-Yunzai') {
      // 这些适配器支持转发消息
      const supportedAdapters = ['ICQQ', 'LagrangeCore', 'QQBot', 'OneBotv11']
      return supportedAdapters.includes(this.botadapter) ? forwardmsg : null
    }

    // 其他情况默认返回转发消息
    return forwardmsg
  }

  /**
   *
   * @param {Array<any>|string} msg 消息
   * @param {Array<any>} btns 按钮数组
   * @returns
   */
  mkMsg(msg, btns = []) {
    if (!Array.isArray(msg)) {
      msg = [msg]
    }
    if (btns.length > 0) {
      const buttonResult = this.mkbutton(btns)
      if (buttonResult) {
        return [...msg, buttonResult]
      } else return msg
    } else return msg.flat(Infinity)
  }

  /**
   * 创建按钮
   * @param {Array<any>} btn - 按钮数组
   * @returns {Object|null} 返回按钮对象或null
   */
  // cSpell:ignore mkbutton
  mkbutton(btn) {
    // Miao-Yunzai和yunzai的处理
    if (['Miao-Yunzai', 'yunzai'].includes(Version.BotName)) {
      // 只有QQBot适配器且markdown配置允许时才创建按钮
      if (this.botadapter === 'QQBot' && this.e.bot.config?.markdown?.type !== 0) {
        return Bot.Button(btn)
      }
      return null
    }

    // TRSS-Yunzai的处理
    if (Version.BotName === 'TRSS-Yunzai') {
      return segment.button(btn)
    }

    // 其他情况返回null
    return null
  }

}

/**
 * 统计推送列表中每个平台使用最多的机器人
 * @param {import('./Config.js').PushlistConfig} pushList 推送列表配置
 * @returns {{douyin: PlatformBotStats, bilibili: PlatformBotStats}} 返回每个平台使用最多的机器人统计
 */
export const statBotId = (pushList) => {
  const platformBotCount = {
    douyin: new Map(),
    bilibili: new Map()
  }

  // 统计抖音平台机器人使用次数
  pushList.douyin?.forEach(item => {
    item.group_id.forEach(gid => {
      const botId = gid.split(':')[1]
      platformBotCount.douyin.set(botId, (platformBotCount.douyin.get(botId) ?? 0) + 1)
    })
  })

  // 统计B站平台机器人使用次数
  pushList.bilibili?.forEach(item => {
    item.group_id.forEach(gid => {
      const botId = gid.split(':')[1]
      platformBotCount.bilibili.set(botId, (platformBotCount.bilibili.get(botId) ?? 0) + 1)
    })
  })

  // 获取抖音平台使用最多的机器人
  let douyinMaxCount = 0
  let douyinMostFrequentBot = ''
  platformBotCount.douyin.forEach((count, botId) => {
    if (count > douyinMaxCount) {
      douyinMaxCount = count
      douyinMostFrequentBot = botId
    }
  })

  // 获取B站平台使用最多的机器人
  let biliMaxCount = 0
  let biliMostFrequentBot = ''
  platformBotCount.bilibili.forEach((count, botId) => {
    if (count > biliMaxCount) {
      biliMaxCount = count
      biliMostFrequentBot = botId
    }
  })

  return {
    douyin: {
      botId: douyinMostFrequentBot,
      count: douyinMaxCount
    },
    bilibili: {
      botId: biliMostFrequentBot,
      count: biliMaxCount
    }
  }
}

/**
 * 发送错误消息给主人
 * @param {'douyin'|'bilibili'} platform 平台名称
 * @param {*} img 错误图片
 */
const sendMasterMessage = async (platform, img) => {
  if (Version.BotName === 'TRSS-Yunzai') {
    Bot.sendMasterMsg(['推送任务出错！请即时解决以消除警告', img])
  } else {
    const botId = statBotId(Config.pushlist)
    const masterList = cfg.masterQQ
    for (const masterQQ of masterList) {
      await Bot[botId[platform].botId].pickFriend(masterQQ).sendMsg(['推送任务出错！请即时解决以消除警告', img])
    }
  }
}

/**
 * 上传视频文件
 * @param {*} e 消息事件
 * @param {fileInfo} file 包含本地视频文件信息的对象
 * @param {string} videoUrl 视频直链，无则传空字符串
 * @param {uploadFileOptions} [options] 上传参数
 * @returns {Promise<boolean>}
 */
export const uploadFile = async (e, file, videoUrl, options) => {
  let newFileSize = file.totalBytes
  const isActiveMessage = options?.active && options?.activeOption

  // 视频压缩处理
  if (Config.upload?.compress && file.totalBytes > (Config.upload.compresstrigger || 100)) {
    const duration = await mergeFile('获取指定视频文件时长', { path: file.filepath, resultPath: '' })
    logger.warn(logger.yellow(`视频大小 (${file.totalBytes} MB) 触发压缩条件，正在压缩...`))

    // 发送压缩提示消息
    const compressMsg = `视频大小 (${file.totalBytes} MB) 触发压缩条件，正在压缩至${Config.upload.compressvalue} MB...`
    const msg1 = isActiveMessage && options?.activeOption
      ? await Bot[options.activeOption.uin].pickGroup(options.activeOption.group_id).sendMsg(compressMsg)
      : await e.reply(compressMsg)

    const startTime = Date.now()
    const targetBitrate = Common.calculateBitrate(Config.upload.compresstrigger || 80, Number(duration)) * 0.75
    const compressedPath = await mergeFile('压缩视频', {
      path: file.filepath,
      targetBitrate,
      resultPath: `${Common.tempDri.video}tmp_${Date.now()}.mp4`
    })
    file.filepath = String(compressedPath)

    newFileSize = await Common.getVideoFileSize(file.filepath)
    const compressTime = ((Date.now() - startTime) / 1000).toFixed(1)

    logger.debug(`压缩完成: ${file.totalBytes.toFixed(1)}MB → ${newFileSize.toFixed(1)}MB`)

    // 发送压缩结果消息
    const resultMsg = [`压缩完成: ${newFileSize.toFixed(1)}MB，耗时: ${compressTime}秒`, segment.reply(msg1.message_id)]
    if (isActiveMessage && options?.activeOption) {
      await Bot[options.activeOption.uin].pickGroup(options.activeOption.group_id).sendMsg(resultMsg)
    } else {
      await e.reply(resultMsg)
    }
  }

  // 获取适配器信息
  const base = new Base(e)
  const botAdapter = base.botadapter

  // 特殊处理
  if (Version.BotName === 'TRSS-Yunzai' && botAdapter === 'LagrangeCore') {
    logger.warn('TRSS-Yunzai & Lagrange插件暂不支持上传视频，请使用ws链接Lagrange.Onebot')
    return false
  }

  // 确定上传方式
  const useGroupFile = Config.upload?.usegroupfile && newFileSize > (Config.upload.groupfilevalue || 100)
  if (options) options.useGroupFile = useGroupFile

  // 文件处理
  let File
  if (Config.upload.sendbase64 && !useGroupFile) {
    File = `base64://${fs.readFileSync(file.filepath).toString('base64')}`
    logger.mark(`已开启base64转换...`)
  } else {
    File = useGroupFile ? file.filepath : `file://${file.filepath}`
  }

  try {
    const msgType = isActiveMessage ? '主动' : '被动'
    const uploadType = useGroupFile ? '群文件' : '消息'
    logger.mark(`${msgType}消息: ${newFileSize.toFixed(1)}MB 通过${uploadType}上传`)

    const target = isActiveMessage && options?.activeOption?.uin
      ? Bot[options.activeOption.uin].pickGroup(options.activeOption.group_id)
      : e.isGroup ? e.group : e.friend

    if (useGroupFile) {
      await (botAdapter === 'ICQQ'
        ? target.fs?.upload(File)
        : ['LagrangeCore', 'OneBotv11', 'Lagrange.OneBot'].includes(botAdapter)
          ? target.sendFile?.(File)
          : target.sendMsg?.(segment.file(File)))
      return true
    } else {
      const status = isActiveMessage
        ? await target.sendMsg(segment.video(File) || videoUrl)
        : await e.reply(segment.video(File) || videoUrl)
      return !!status?.message_id
    }
  } catch (error) {
    if (options && options.active === false) {
      await e.reply('视频文件上传失败' + JSON.stringify(error, null, 2))
    }
    logger.error('视频文件上传错误,' + String(error))
    return false
  } finally {
    Config.app.removeCache && logger.info(`文件 ${file.filepath} 将在 10 分钟后删除`) && setTimeout(() => Common.removeFile(file.filepath), 10 * 60 * 1000)
  }
}

/**
 * 下载视频并上传到群
 * @param {*} e 事件
 * @param {downloadFileOptions} downloadOpt 下载参数
 * @param {uploadFileOptions} [uploadOpt] 上传参数
 * @returns {Promise<boolean>}
 */
export const downloadVideo = async (e, downloadOpt, uploadOpt) => {
  // 获取文件大小
  const fileHeaders = await new Networks({ url: downloadOpt.video_url, headers: downloadOpt.headers ?? baseHeaders }).getHeaders()
  const fileSizeContent = fileHeaders['content-range']?.match(/\/(\d+)/) ? parseInt(fileHeaders['content-range']?.match(/\/(\d+)/)[1], 10) : 0
  const fileSizeInMB = (fileSizeContent / (1024 * 1024)).toFixed(2)
  const fileSize = parseInt(parseFloat(fileSizeInMB).toFixed(2))

  if (Config.upload.usefilelimit && Config.upload.filelimit && fileSize > Config.upload.filelimit) {
    const message = `视频：「${downloadOpt.title.originTitle ?? 'Error: 文件名获取失败'}」大小 (${fileSizeInMB} MB) 超出最大限制（设定值：${Config.upload.filelimit} MB），已取消上传`
    if (uploadOpt?.active && uploadOpt?.activeOption) {
      await Bot[uploadOpt.activeOption.uin].pickGroup(uploadOpt.activeOption.group_id).sendMsg(message)
    } else {
      await e.reply(message)
    }
    return false
  }

  // 下载文件
  let res = await downloadFile(downloadOpt.video_url, {
    title: Config.app.removeCache ? (downloadOpt.title.timestampTitle || 'temp') : processFilename(downloadOpt.title.originTitle || 'video', 50),
    headers: downloadOpt.headers || /** @type {any} */ (baseHeaders)
  })

  res = { ...res, ...downloadOpt.title }
  res.totalBytes = Number((res.totalBytes / (1024 * 1024)).toFixed(2))

  // 视频大小判断
  const botAdapter = new Base(e).botadapter
  const useGroupFile = res.totalBytes > (['LagrangeCore', 'Lagrange.OneBot', 'OneBotv11', 'OneBot11'].includes(botAdapter) ? 99 : 75)
  // 上传视频
  return await uploadFile(e, res, downloadOpt.video_url, { ...uploadOpt, useGroupFile })
}

/**
 * 异步下载文件的函数
 * @param {string} videoUrl 下载地址
 * @param {downLoadFileOptions} opt 配置选项，包括标题、请求头等
 * @returns {Promise<fileInfo>} 返回一个包含文件路径和总字节数的对象
 */
export const downloadFile = async (videoUrl, opt) => {
  const startTime = Date.now()

  const { filepath, totalBytes } = await new Networks({
    url: videoUrl,
    headers: opt.headers ?? baseHeaders,
    filepath: Common.tempDri.video + opt.title,
    timeout: 30000
  }).downloadStream((downloadedBytes, totalBytes) => {
    // 定义进度条长度及生成进度条字符串的函数
    const barLength = 45
    const generateProgressBar = (/** @type {number} */ progressPercentage) => {
      // 验证progressPercentage是否为有效数字
      if (!isFinite(progressPercentage) || progressPercentage < 0 || isNaN(progressPercentage)) {
        progressPercentage = 0
      }

      // 限制进度在0-100之间
      progressPercentage = Math.max(0, Math.min(100, progressPercentage))

      const filledLength = Math.floor((progressPercentage / 100) * barLength)
      let progress = ''
      progress += '\u2588'.repeat(filledLength)
      progress += '\u2591'.repeat(Math.max(0, barLength - filledLength - 1))
      return `[${progress}]`
    }

    // 验证参数有效性
    const validDownloadedBytes = isFinite(downloadedBytes) && downloadedBytes >= 0 ? downloadedBytes : 0
    const validTotalBytes = isFinite(totalBytes) && totalBytes > 0 ? totalBytes : validDownloadedBytes + 1

    // 计算当前下载进度百分比
    const progressPercentage = (validDownloadedBytes / validTotalBytes) * 100

    // 计算动态 RGB 颜色
    const red = Math.floor(255 - (255 * progressPercentage) / 100) // 红色分量随进度减少
    const green = Math.floor((255 * progressPercentage) / 100) // 绿色分量随进度增加
    const hexColor = `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}00`

    // 根据不同的机器人框架选择不同的着色方法
    const colorMethod = Version.BotName === 'TRSS-Yunzai'
      ? (/** @type {any} */ color) => logger.hex(color)
      : (/** @type {any} */ color) => logger.chalk.hex(color)

    const coloredPercentage = colorMethod(hexColor)(`${progressPercentage.toFixed(1)}%`)
    const coloredProgressBar = colorMethod(hexColor)(generateProgressBar(progressPercentage))

    // 计算下载速度（MB/s）
    const elapsedTime = (Date.now() - startTime) / 1000
    const speed = validDownloadedBytes / elapsedTime
    const formattedSpeed = (speed / 1048576).toFixed(1) + ' MB/s'

    // 计算剩余时间
    const remainingBytes = validTotalBytes - validDownloadedBytes // 剩余字节数
    const remainingTime = remainingBytes / speed // 剩余时间（秒）
    const formattedRemainingTime = remainingTime > 60
      ? `${Math.floor(remainingTime / 60)}min ${Math.floor(remainingTime % 60)}s`
      : `${remainingTime.toFixed(0)}s`

    // 计算已下载和总下载的文件大小（MB）
    const downloadedSizeMB = (validDownloadedBytes / 1048576).toFixed(1)
    const totalSizeMB = (validTotalBytes / 1048576).toFixed(1)

    // 打印下载进度、速度和剩余时间
    logger.info(
      `⬇️ ${opt.title} ${coloredProgressBar} ${coloredPercentage} ${downloadedSizeMB}/${totalSizeMB} MB | ${formattedSpeed} 剩余: ${formattedRemainingTime}\r`
    )
  }, 3)

  return { filepath, totalBytes }
}

/**
 * 处理文件名长度，保留文件扩展名
 * @param {string} filename 原始文件名
 * @param {number} [maxLength=50] 最大长度（不包括扩展名）
 * @returns {string} 处理后的文件名
 */
const processFilename = (filename, maxLength = 50) => {
  const lastDotIndex = filename.lastIndexOf('.')
  const hasExtension = lastDotIndex > 0 && lastDotIndex < filename.length - 1

  if (!hasExtension) {
    return filename.substring(0, maxLength).replace(/[\\/:*?"<>|\r\n\s]/g, ' ')
  }

  const nameWithoutExt = filename.substring(0, lastDotIndex)
  const extension = filename.substring(lastDotIndex)
  const processedName = nameWithoutExt.substring(0, maxLength).replace(/[\\/:*?"<>|\r\n\s]/g, ' ')

  return processedName + '...' + extension
}


