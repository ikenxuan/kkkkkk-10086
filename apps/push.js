import { Bilibilipush } from '../module/platform/bilibili/index.js'
import { getBilibiliData, getDouyinData } from '@ikenxuan/amagi'
import { DouYinpush } from '../module/platform/douyin/index.js'
import { Config } from '../module/utils/index.js'

export class kkkPush extends plugin {
  constructor() {
    super({
      name: 'kkkkkk-10086-推送功能',
      dsc: '推送',
      event: 'message',
      priority: Config.app.defaulttool ? -Infinity : Config.app.priority,
      rule: [
        { reg: /^#设置抖音推送/, fnc: 'setdyPush', permission: Config.douyin.douyinpushGroup },
        { reg: /^#设置[bB]站推送(?:[Uu][Ii][Dd]:)?(\d+)$/, fnc: 'setbiliPush', permission: Config.douyin.douyinpushGroup },
        { reg: /#(抖音|[bB]站)(全部)?强制推送/, fnc: 'forcePush', permission: 'master' },
        { reg: /^#(抖音|[bB]站)推送列表$/, fnc: 'pushlist' },
        { reg: /^#kkk设置推送机器人/, fnc: 'changeBotID', permission: 'master' }
      ]
    })

    this.task = [
      ...(Config.bilibili.push.switch ? [{
        cron: Config.bilibili.push.cron,
        name: '哔哩哔哩更新推送',
        fnc: () => this.bilibiliPush(),
        log: Config.bilibili.push.log
      }] : []),
      ...(Config.douyin.push.switch ? [{
        cron: Config.douyin.push.cron,
        name: '抖音更新推送',
        fnc: () => this.douyinPush(),
        log: Config.douyin.push.log
      }] : [])
    ]
  }

  /**
   * 抖音推送方法
   * 这是一个异步方法，用于执行抖音推送操作
   * @returns {Promise<boolean>}
   */
  async douyinPush() {
    // 创建DouYinpush实例并执行action方法
    await new DouYinpush().action()
    return true
  }

  /**
   * 执行B站推送功能的方法
   * 这是一个异步方法，用于调用B站推送类的action方法
   * @returns {Promise<boolean>}
   */
  async bilibiliPush() {
    await new Bilibilipush().action()  // 创建B站推送实例并执行action方法
    return true
  }

  /**
   * 强制推送方法，根据消息内容判断并执行相应的推送操作
   * @param {Object} e - 包含消息信息的对象
   * @returns {Promise<boolean>} 返回一个Promise，解析为true表示操作成功
   */
  async forcePush(e) {
    // 检查消息中是否包含"抖音"
    if (e.msg.includes('抖音')) {
      // 创建抖音推送实例并执行操作
      await new DouYinpush().action()
      return true
    } else if (e.msg.includes('B站')) {
      // 创建B站推送实例并执行操作
      await new Bilibilipush().action()
      return true
    }
    return true
  }

  /**
   * 设置抖音推送功能的方法
   * @param {Object} e - 事件对象，包含消息相关信息
   * @returns {Promise<boolean>}
   */
  async setdyPush(e) {
    // 如果是私聊消息，直接返回true
    if (e.isPrivate) return true
    const data = await getDouyinData('搜索数据', Config.cookies.douyin, { query: e.msg.replace(/^#设置抖音推送/, ''), typeMode: 'strict' })
    await new DouYinpush(e).setting(data.data)
    return true
  }

  /**
   * 设置B站推送的异步方法
   * @param {Object} e - 包含消息信息的对象
   * @returns {Promise<boolean>}
   */
  async setbiliPush(e) {
    // 如果是私信消息，直接返回true
    if (e.isPrivate) return true
    // 检查是否配置了B站Cookie，如果没有则提示用户配置
    if (!Config.cookies.bilibili) {
      await e.reply('\n请先配置B站Cookie', { at: true })
      return true
    }
    // 使用正则表达式匹配消息格式，提取UID
    const match = /^#设置[bB]站推送(?:UID:)?(\d+)$/.exec(e.msg)
    if (match && match[1]) {
      // 获取B站用户主页数据
      const data = await getBilibiliData('用户主页数据', Config.cookies.bilibili, { host_mid: Number(match[1]), typeMode: 'strict' })
      // 创建Bilibilipush实例并调用setting方法进行设置
      await new Bilibilipush(e).setting(data.data)
    }
    return true
  }

  /**
   * 根据消息内容显示不同平台的推送列表
   * @param {Object} e - 消息事件对象
   * @returns {Promise<boolean>} 返回一个Promise，解析为true表示操作成功
   */
  async pushlist(e) {
    // 根据消息内容判断显示哪个平台的推送列表
    const platform = e.msg.includes('抖音') ? 'douyin' : 'bilibili'
    if (platform === 'douyin') {
      // 如果是抖音平台，则创建DouYinpush实例并渲染推送列表
      await new DouYinpush(e).renderPushList()
    } else {
      // 如果是哔哩哔哩平台，则创建Bilibilipush实例并渲染推送列表
      await new Bilibilipush(e).renderPushList()
    }
    return true
  }

  /**
   * 更改推送机器人ID的方法
   * @param {Object} e - 事件对象，包含消息等信息
   * @returns {Promise<boolean>} 返回一个Promise，解析为true表示操作成功
   */
  async changeBotID(e) {
    // 定义匹配命令的正则表达式，用于识别"#kkk设置推送机器人"开头的消息
    const command = /^#kkk设置推送机器人/
    // 从消息中提取新的机器人ID，移除命令部分
    const newBotId = e.msg.replace(command, '')

    // 更改推送列表机器人ID
    const updateGroupIds = (list) => {
      // 检查列表是否为空或未定义
      if (!list || !Array.isArray(list) || list.length === 0) {
        return []
      }

      return list.map(item => ({
        ...item,
        group_id: item.group_id ? item.group_id.map(groupId => {
          const [group_id] = groupId.split(':')
          return `${group_id}:${newBotId}`
        }) : []
      }))
    }

    // 更新配置，提供默认空数组
    Config.modify('pushlist', 'douyin', updateGroupIds(Config.pushlist.douyin || []))
    Config.modify('pushlist', 'bilibili', updateGroupIds(Config.pushlist.bilibili || []))

    await e.reply(`推送机器人已修改为${newBotId}`)
    return true
  }

}
