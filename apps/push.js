import { bilibiliDB, douyinDB } from '../module/db/index.js'
import { Bilibilipush, getBilibiliID } from '../module/platform/bilibili/index.js'
import { getBilibiliData, getDouyinData } from '@ikenxuan/amagi'
import { DouYinpush, getDouyinID } from '../module/platform/douyin/index.js'
import { Config } from '../module/utils/index.js'

export class kkkPush extends plugin {
  constructor() {
    super({
      name: 'kkkkkk-10086-推送功能',
      dsc: '推送',
      event: 'message',
      priority: Config.app.defaulttool ? -Infinity : Config.app.priority,
      rule: [
        { reg: /^#设置抖音推送/, fnc: 'setdyPush', permission: Config.douyin.push.permission },
        { reg: /^#设置[bB]站推送/, fnc: 'setbiliPush', permission: Config.bilibili.push.permission },
        { reg: /^#(抖音|[bB]站)(全部)?强制推送/, fnc: 'forcePush', permission: 'master' },
        { reg: /^#(抖音|[bB]站)推送列表$/, fnc: 'pushlist' },
        { reg: /^#kkk设置推送机器人/, fnc: 'changeBotID', permission: 'master' },
        { reg: /^#kkk推送全局忽略/, fnc: 'globalIgnore', permission: 'master' }
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
    if (e.msg.includes('抖音')) {
      await new DouYinpush().action()
      return true
    } else if (/[bB]站/.test(e.msg)) {
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
    const query = e.msg.replace(/^#设置抖音推送/, '').trim()
    if (query === '开启' || query === '关闭') {
      const enable = query === '开启'
      Config.modify('douyin', 'push.switch', enable)
      await e.reply(`抖音推送已${enable ? '开启' : '关闭'}，重启后生效`)
      return true
    }

    // 如果是私聊消息，直接返回true
    if (e.isPrivate) return true
    const data = await getDouyinData('搜索数据', Config.cookies.douyin, { query, typeMode: 'strict' })
    await new DouYinpush(e).setting(data.data)
    return true
  }

  /**
   * 设置B站推送的异步方法
   * @param {Object} e - 包含消息信息的对象
   * @returns {Promise<boolean>}
   */
  async setbiliPush(e) {
    const query = e.msg
      .replace(/^#设置[bB]站推送/, '')
      .replace(/^(?:[Uu][Ii][Dd]:)?/, '')
      .trim()

    if (query === '开启' || query === '关闭') {
      const enable = query === '开启'
      Config.modify('bilibili', 'push.switch', enable)
      await e.reply(`B站推送已${enable ? '开启' : '关闭'}，重启后生效`)
      return true
    }

    // 如果是私信消息，直接返回true
    if (e.isPrivate) return true
    // 检查是否配置了B站Cookie，如果没有则提示用户配置
    if (!Config.cookies.bilibili) {
      await e.reply('\n请先配置B站Cookie', { at: true })
      return true
    }
    // 使用正则表达式匹配消息格式，提取UID
    const match = /^(\d+)$/.exec(query)
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

  async globalIgnore(e) {
    const url = e.msg.replace(/^#kkk推送全局忽略/, '').trim().match(/https?:\/\/[^\s]+/i)?.[0]
    if (!url) {
      await e.reply('请提供要忽略的抖音作品或B站动态链接')
      return true
    }

    if (/(douyin|iesdouyin)\.com/.test(url)) return await this.ignoreDouyinWork(e, url)
    if (/bilibili\.com/.test(url)) return await this.ignoreBilibiliDynamic(e, url)

    await e.reply('暂不支持该平台链接')
    return true
  }

  async ignoreDouyinWork(e, url) {
    const idData = await getDouyinID(url, false)
    if (!idData?.aweme_id) {
      await e.reply('无法解析该抖音作品链接')
      return true
    }

    const workInfo = await getDouyinData('聚合解析', Config.cookies.douyin || '', { aweme_id: idData.aweme_id, typeMode: 'strict' })
    const aweme = workInfo?.data?.aweme_detail || workInfo?.data?.data?.aweme_detail
    const secUid = aweme?.author?.sec_uid
    if (!secUid) {
      await e.reply('无法获取该作品作者信息')
      return true
    }

    const subscribedItem = Config.pushlist.douyin?.find(item => item.sec_uid === secUid)
    if (!subscribedItem) {
      await e.reply('该作品对应的博主未在推送订阅中，跳过')
      return true
    }

    const groupIds = (subscribedItem.group_id || []).map(item => String(item).split(':')[0]).filter(Boolean)
    for (const groupId of groupIds) {
      await douyinDB?.addAwemeCache(idData.aweme_id, secUid, groupId, 'post')
    }

    await e.reply(`已忽略抖音作品 ${idData.aweme_id}，共 ${groupIds.length} 个群组标记为已处理`)
    return true
  }

  async ignoreBilibiliDynamic(e, url) {
    const idData = await getBilibiliID(url, false)
    if (!idData?.dynamic_id) {
      await e.reply('无法解析该B站动态链接')
      return true
    }

    const dynamicInfo = await getBilibiliData('动态详情数据', Config.cookies.bilibili || '', { dynamic_id: idData.dynamic_id, typeMode: 'strict' })
    const item = dynamicInfo?.data?.data?.item || dynamicInfo?.data?.item
    const hostMid = Number(item?.modules?.module_author?.mid)
    if (!hostMid) {
      await e.reply('无法获取该动态作者信息')
      return true
    }

    const subscribedItem = Config.pushlist.bilibili?.find(item => Number(item.host_mid) === hostMid)
    if (!subscribedItem) {
      await e.reply('该动态对应的UP主未在推送订阅中，跳过')
      return true
    }

    const groupIds = (subscribedItem.group_id || []).map(item => String(item).split(':')[0]).filter(Boolean)
    for (const groupId of groupIds) {
      await bilibiliDB?.addDynamicCache(idData.dynamic_id, hostMid, groupId, item?.type || '')
    }

    await e.reply(`已忽略B站动态 ${idData.dynamic_id}，共 ${groupIds.length} 个群组标记为已处理`)
    return true
  }

}
