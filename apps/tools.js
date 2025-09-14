import { KuaiShou, GetKuaishouID, KuaishouData } from '../module/platform/kuaishou/index.js'
import { Bilibili, getBilibiliID } from '../module/platform/bilibili/index.js'
import { DouYin, getDouyinID } from '../module/platform/douyin/index.js'
import { Config, Common, UploadRecord } from '../module/utils/index.js'
import { getDouyinData } from '@ikenxuan/amagi'

// 用户状态存储对象
const user = {}

const PLATFORM_CONFIG = [
  {
    reg: /^.*((www|v|jx)\.(douyin|iesdouyin)\.com|douyin\.com\/(video|note)).*/,
    handler: 'douyin',
    enabled: Config.douyin?.douyintool
  },
  {
    reg: /(bilibili.com|b23.tv|t.bilibili.com|bili2233.cn|BV[a-zA-Z0-9]{10}$)/,
    handler: 'bilibili',
    enabled: Config.bilibili?.bilibilitool
  },
  {
    reg: /^((.*)快手(.*)快手(.*)|(.*)v\.kuaishou(.*)|(.*)kuaishou\.com\/f\/[a-zA-Z0-9]+.*)$/,
    handler: 'kuaishou',
    enabled: Config.kuaishou?.kuaishoutool
  }
]

/**
 * 动态生成插件规则
 * @returns {Array} 返回启用的平台规则数组
 */
const generateRules = () => Config.app.videotool
  ? PLATFORM_CONFIG
    .filter(config => config.enabled)
    .map(({ reg, handler }) => ({ reg, fnc: handler }))
  : []

export class kkkTools extends plugin {
  constructor() {
    super({
      name: 'kkkkkk-10086-视频功能',
      dsc: '视频',
      event: 'message',
      priority: Config.app.defaulttool ? -Infinity : Config.app.priority,
      rule: [
        ...generateRules(), // 动态生成的平台规则
        { reg: /^#?(解析|kkk解析)/, fnc: 'prefix' }, // 解析功能规则
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
    e.msg = await Common.getReplyMessage(e)
    // 查找匹配的平台并直接调用处理函数
    const config = PLATFORM_CONFIG.find(config => config.enabled && config.reg.test(e.msg))
    if (config) await this[config.handler](e)
    return true
  }

  /**
   * 处理抖音链接解析
   * @param {any} e 事件对象
   * @returns {Promise<boolean>} 处理结果
   */
  async douyin(e) {
    const url = e.msg.match(/https?:\/\/.*\.(douyin|iesdouyin)\.com\/[^ ]+/g)
    const iddata = await getDouyinID(url)
    await new DouYin(e, iddata).RESOURCES(iddata)
    return true
  }

  /**
   * 处理B站链接解析
   * @param {any} e 事件对象
   * @returns {Promise<boolean>} 处理结果
   */
  async bilibili(e) {
    let url = (e.msg || e.message[0].data).replaceAll('\\', '').trim()

    // 处理不同类型的B站链接
    if (url.includes('b23.tv')) {
      url = url.match(/(http:|https:)\/\/b23.tv\/[A-Za-z\d._?%&+\-=\/#]*/)[0]
    } else if (/bilibili\.com|bili2233\.cn/.test(url)) {
      url = url.match(/(?:https?:\/\/)?(?:www\.bilibili\.com|m\.bilibili\.com|bili2233\.cn)\/[A-Za-z\d._?%&+\-=\/#]*/)[0]
    } else if (/^BV[1-9a-zA-Z]{10}$/.test(url)) {
      url = `https://www.bilibili.com/video/${url}`
    }

    const iddata = await getBilibiliID(url)
    await new Bilibili(e, iddata).RESOURCES(iddata)

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
    const url = e.msg.replaceAll('\\', '').match(/(https:\/\/v\.kuaishou\.com\/\w+|https:\/\/www\.kuaishou\.com\/f\/[a-zA-Z0-9]+)/g)
    const Iddata = await GetKuaishouID(url)
    const WorkData = await new KuaishouData(Iddata.type).GetData({ photoId: Iddata.id })
    await new KuaiShou(e, Iddata).Action(WorkData)
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
        await e.reply('获取音乐数据失败')
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
