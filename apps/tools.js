import { KuaiShou, GetKuaishouID, KuaishouData } from '../module/platform/kuaishou/index.js'
import { Bilibili, getBilibiliID } from '../module/platform/bilibili/index.js'
import { DouYin, getDouyinID } from '../module/platform/douyin/index.js'
import { Xiaohongshu, getXiaohongshuID } from '../module/platform/xiaohongshu/index.js'
import { Config, Common, UploadRecord, wrapWithErrorHandler, downloadVideo, baseHeaders } from '../module/utils/index.js'
import { getStatisticsDB } from '../module/db/index.js'
import { getDouyinData } from '@ikenxuan/amagi'

// 用户状态存储对象
const user = {}
const douyinSelections = new Map()

const getConfigValue = (value, fallback) => value ?? fallback
const isVideoToolEnabled = () => getConfigValue(Config.app?.videoTool, Config.app?.videotool) !== false
const isDefaultTool = () => getConfigValue(Config.app?.defaulttool, Config.app?.videoTool) !== false

const PLATFORM_CONFIG = [
  {
    reg: /.*((www|v|jx|jingxuan|m)\.(douyin|iesdouyin)\.com|douyin\.com\/(video|note)).*/i,
    handler: 'douyin',
    enabled: getConfigValue(Config.douyin?.switch, Config.douyin?.douyintool)
  },
  {
    reg: /(bilibili.com|b23.tv|t.bilibili.com|bili2233.cn|^BV[1-9a-zA-Z]{10}$|^av\d+$)/i,
    handler: 'bilibili',
    enabled: getConfigValue(Config.bilibili?.switch, Config.bilibili?.bilibilitool)
  },
  {
    reg: /^((.*)快手(.*)快手(.*)|(.*)v\.kuaishou(.*)|(.*)kuaishou\.com\/f\/[a-zA-Z0-9]+.*)$/,
    handler: 'kuaishou',
    enabled: getConfigValue(Config.kuaishou?.switch, Config.kuaishou?.kuaishoutool)
  },
  {
    reg: /(xiaohongshu\.com|xhslink\.com)/i,
    handler: 'xiaohongshu',
    enabled: Config.xiaohongshu?.switch
  }
]

/**
 * 动态生成插件规则
 * @returns {Array} 返回启用的平台规则数组
 */
const generateRules = () => isVideoToolEnabled()
  ? PLATFORM_CONFIG
    .filter(config => config.enabled)
    .map(({ reg, handler }) => ({ reg, fnc: handler }))
  : []

const findPlatformConfig = msg => PLATFORM_CONFIG.find(config => config.enabled && config.reg.test(msg || ''))
const getEventUserId = e => String(e.user_id || e.userId || e.sender?.user_id || e.sender?.userId || 'unknown')
const getEventGroupId = e => String(e.group_id || e.groupId || 'private')
const getSelectionKey = e => `${getEventGroupId(e)}:${getEventUserId(e)}`

const recordParseStatistics = async (e, platform) => {
  const groupId = String(e.group_id || e.groupId || 'private')
  const userId = String(e.user_id || e.userId || e.sender?.user_id || e.sender?.userId || 'unknown')
  try {
    const statisticsDB = await getStatisticsDB()
    await statisticsDB?.recordParse(groupId, userId, platform)
  } catch (error) {
    logger.error('[统计] 记录解析统计失败', error)
  }
}

export class kkkTools extends plugin {
  constructor() {
    super({
      name: 'kkkkkk-10086-视频功能',
      dsc: '视频',
      event: 'message',
      priority: isDefaultTool() ? -Infinity : Config.app.priority,
      rule: [
        ...generateRules(), // 动态生成的平台规则
        ...(isVideoToolEnabled() ? [{ reg: /^(\[图片\])?$/, fnc: 'imageQrCode' }] : []),
        { reg: /^#?\d{1,2}$/, fnc: 'selectDouyinWork' },
        { reg: /^#?(解析|kkk解析|弹幕解析)/, fnc: 'prefix' }, // 解析功能规则
        { reg: /#?BGM(\d+)/, fnc: 'uploadRecord' }, // BGM上传功能规则
        { reg: /^#?第(\d{1,3})集$/, fnc: 'next' } // 选集功能规则
      ]
    })
  }

  /**
   * 统一处理不同平台的链接解析
   * @param {any} e 事件对象
   * @returns {Promise<boolean>} 处理结果
   */
  async prefix(e) {
    const originalMsg = e.msg || ''
    e.msg = await Common.getReplyMessage(e)

    if (/^#?弹幕解析/.test(originalMsg)) {
      e.msg = `#弹幕解析 ${e.msg}`
    }

    if (/https:\/\/aweme\.snssdk\.com\/aweme\/v1\/play/i.test(e.msg)) {
      const videoId = e.msg.match(/video_id=([^&\s]+)/)?.[1] || Date.now().toString()
      await downloadVideo(e, {
        video_url: e.msg,
        title: {
          timestampTitle: `tmp_${Date.now()}.mp4`,
          originTitle: `抖音视频_${videoId}.mp4`
        },
        headers: {
          ...baseHeaders,
          Referer: 'https://www.douyin.com'
        }
      })
      return true
    }

    // 查找匹配的平台并直接调用处理函数
    await this.dispatchPlatform(e)
    return true
  }

  /**
   * 处理直接发送的平台二维码图片
   * @param {any} e 事件对象
   * @returns {Promise<boolean>}
   */
  async imageQrCode(e) {
    const msg = await Common.getReplyMessage(e)
    if (!msg || msg === e.msg) return false
    e.msg = msg
    return await this.dispatchPlatform(e)
  }

  /**
   * 根据消息内容分发到对应平台处理器
   * @param {any} e 事件对象
   * @returns {Promise<boolean>}
   */
  async dispatchPlatform(e) {
    const config = findPlatformConfig(e.msg)
    if (!config) return false
    await this[config.handler](e)
    return true
  }

  async runWithErrorHandler(e, businessName, fn) {
    const handler = wrapWithErrorHandler(async event => fn.call(this, event), { businessName, plugin: this })
    return await handler(e)
  }

  /**
   * 处理抖音链接解析
   * @param {any} e 事件对象
   * @returns {Promise<boolean>} 处理结果
   */
  async douyin(e) {
    return await this.runWithErrorHandler(e, '抖音视频解析', this._douyin)
  }

  async _douyin(e) {
    const forceBurnDanmaku = /^#?弹幕解析/.test(e.msg)
    const urlMatch = e.msg.match(/https?:\/\/(?:www\.|v\.|jx\.|m\.|jingxuan\.)?(douyin\.com|iesdouyin\.com)\/[^\s]+/g)
    if (urlMatch && urlMatch[0]) {
      const iddata = await getDouyinID(urlMatch[0])
      const result = await new DouYin(e, iddata, { forceBurnDanmaku }).RESOURCES(iddata)
      if (result?.type === 'douyin_user_selection') {
        const key = getSelectionKey(e)
        const selection = {
          videos: result.videos,
          expiresAt: Date.now() + result.timeoutSeconds * 1000
        }
        douyinSelections.set(key, selection)
        setTimeout(() => {
          if (douyinSelections.get(key) === selection) douyinSelections.delete(key)
        }, result.timeoutSeconds * 1000)
      }
      await recordParseStatistics(e, 'douyin')
    }
    return true
  }

  async selectDouyinWork(e) {
    const key = getSelectionKey(e)
    const selection = douyinSelections.get(key)
    if (!selection) return false
    if (Date.now() > selection.expiresAt) {
      douyinSelections.delete(key)
      await e.reply('抖音主页作品选择已超时，请重新发送主页链接')
      return true
    }

    const index = Number((e.msg || '').replace(/^#/, ''))
    const target = selection.videos[index - 1]
    if (!target) {
      await e.reply(`请输入 1~${selection.videos.length} 之间的序号`)
      return true
    }

    douyinSelections.delete(key)
    const iddata = {
      type: 'one_work',
      aweme_id: target.aweme_id
    }
    await this.runWithErrorHandler(e, '抖音主页作品选择解析', async event => {
      await new DouYin(event, iddata).RESOURCES(iddata)
      await recordParseStatistics(event, 'douyin')
    })
    return true
  }

  /**
   * 处理B站链接解析
   * @param {any} e 事件对象
   * @returns {Promise<boolean>} 处理结果
   */
  async bilibili(e) {
    return await this.runWithErrorHandler(e, 'B站视频解析', this._bilibili)
  }

  async _bilibili(e) {
    const forceBurnDanmaku = /^#?弹幕解析/.test(e.msg)
    let url = (e.msg || (e.message?.[0]?.data || '')).replaceAll('\\', '').trim()

    // 处理不同类型的B站链接
    if (url.includes('b23.tv')) {
      url = url.match(/(http:|https:)\/\/b23.tv\/[A-Za-z\d._?%&+\-=\/#]*/)?.[0] || url
    } else if (/bilibili\.com|bili2233\.cn/.test(url)) {
      url = url.match(/(?:https?:\/\/)?(?:www\.bilibili\.com|m\.bilibili\.com|bili2233\.cn)\/[A-Za-z\d._?%&+\-=\/#]*/)?.[0] || url
    } else if (/^BV[1-9a-zA-Z]{10}$/i.test(url) || /^av\d+$/i.test(url)) {
      url = `https://www.bilibili.com/video/${url}`
    }

    if (!url) {
      logger.warn(`未能在消息中找到有效的B站分享链接、BV号或av号: ${url}`)
      return true
    }

    const iddata = await getBilibiliID(url)
    await new Bilibili(e, iddata, { forceBurnDanmaku }).RESOURCES(iddata)
    await recordParseStatistics(e, 'bilibili')

    // 记录用户操作状态，用于选集功能
    user[e.user_id] = 'bilib'
    setTimeout(() => delete user[e.user_id], 60000)
    return true
  }

  /**
   * 处理快手链接解析
   * @param {any} e 事件对象
   * @returns {Promise<boolean>} 处理结果
   */
  async kuaishou(e) {
    return await this.runWithErrorHandler(e, '快手视频解析', this._kuaishou)
  }

  async _kuaishou(e) {
    const url = e.msg.replaceAll('\\', '').match(/(https:\/\/v\.kuaishou\.com\/\w+|https:\/\/www\.kuaishou\.com\/f\/[a-zA-Z0-9]+)/g)
    const Iddata = await GetKuaishouID(url)
    const WorkData = await new KuaishouData(Iddata.type).GetData({ photoId: Iddata.photoId || Iddata.id })
    await new KuaiShou(e, Iddata).Action(WorkData)
    await recordParseStatistics(e, 'kuaishou')
    return true
  }

  /**
   * 处理小红书链接解析
   * @param {any} e 事件对象
   * @returns {Promise<boolean>} 处理结果
   */
  async xiaohongshu(e) {
    return await this.runWithErrorHandler(e, '小红书笔记解析', this._xiaohongshu)
  }

  async _xiaohongshu(e) {
    const url = e.msg.replaceAll('\\', '').match(/https?:\/\/[^\s"'<>]+/i)?.[0]
    if (!url) {
      logger.warn(`未能在消息中找到有效的小红书链接: ${e.msg}`)
      return true
    }

    const iddata = await getXiaohongshuID(url)
    await new Xiaohongshu(e, iddata).XiaohongshuHandler(iddata)
    await recordParseStatistics(e, 'xiaohongshu')
    return true
  }

  /**
   * 处理BGM音频上传功能
   * @param {any} e 事件对象
   * @returns {Promise<boolean>} 处理结果
   */
  async uploadRecord(e) {
    try {
      // 获取音乐ID并验证
      const musicIdMatch = e.msg.match(/BGM(\d+)/)
      if (!musicIdMatch) {
        await e.reply('未找到有效的音乐ID')
        return false
      }

      // 获取音乐数据
      const data = await getDouyinData('音乐数据', Config.cookies.douyin, {
        music_id: musicIdMatch[1],
        typeMode: 'strict'
      })

      // 验证音乐数据
      if (!data?.data?.music_info) {
        await e.reply('获取音乐数据失败，可能是音乐ID错误或网络问题')
        return false
      }

      // 提取音乐信息
      const { title, play_url } = data.data.music_info
      const music_url = play_url.uri
      const musicInfo = `《${title}》\n${music_url}`

      await e.reply(`正在上传: ${musicInfo}`)
      await e.reply(await UploadRecord(e, music_url, 0, Config.douyin.sendHDrecord ? false : true))
      return true
    } catch (error) {
      logger.error('上传音乐记录时发生错误:', error)
      await e.reply('处理音乐时发生错误，请稍后重试')
      return false
    }
  }

  /**
   * 处理B站番剧选集功能
   * @param {any} e 事件对象
   * @returns {Promise<boolean>} 处理结果
   */
  async next(e) {
    if (user[e.user_id] === 'bilib') {
      const episode = e.msg.match(/第(\d+)集/)[1]
      global.BILIBILIOBJECT.Episode = episode
      await new Bilibili(e, global.BILIBILIOBJECT).RESOURCES(global.BILIBILIOBJECT, true)
    }
    return true
  }
}
