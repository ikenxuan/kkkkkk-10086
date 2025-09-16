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
        { reg: /#(抖音|B站)(全部)?强制推送/, fnc: 'forcePush', permission: 'master' },
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

  async douyinPush() {
    await new DouYinpush().action()
    return true
  }

  async bilibiliPush() {
    await new Bilibilipush().action()
    return true
  }

  async forcePush(e) {
    if (e.msg.includes('抖音')) {
      await new DouYinpush().action()
      return true
    } else if (e.msg.includes('B站')) {
      await new Bilibilipush().action()
      return true
    }
    return true
  }

  async setdyPush(e) {
    if (e.isPrivate) return true
    const data = await getDouyinData('搜索数据', Config.cookies.douyin, { query: e.msg.replace(/^#设置抖音推送/, ''), typeMode: 'strict' })
    await new DouYinpush(e).setting(data.data)
    return true
  }

  async setbiliPush(e) {
    if (e.isPrivate) return true
    if (!Config.cookies.bilibili) {
      await e.reply('\n请先配置B站Cookie', { at: true })
      return true
    }
    const match = /^#设置[bB]站推送(?:UID:)?(\d+)$/.exec(e.msg)
    if (match && match[1]) {
      const data = await getBilibiliData('用户主页数据', Config.cookies.bilibili, { host_mid: Number(match[1]), typeMode: 'strict' })
      await new Bilibilipush(e).setting(data.data)
    }
    return true
  }

  async pushlist(e) {
    // 根据消息内容判断显示哪个平台的推送列表
    const platform = e.msg.includes('抖音') ? 'douyin' : 'bilibili'
    if (platform === 'douyin') {
      await new DouYinpush(e).renderPushList()
    } else {
      await new Bilibilipush(e).renderPushList()
    }
    return true
  }

  async changeBotID(e) {
    const command = /^#kkk设置推送机器人/
    const newBotId = e.msg.replace(command, '')

    // 更改推送列表机器人ID
    const updateGroupIds = (list) => list.map(item => ({
      ...item,
      group_id: item.group_id.map(groupId => {
        const [group_id] = groupId.split(':')
        return `${group_id}:${newBotId}`
      })
    }))

    // 更新配置
    Config.modify('pushlist', 'douyin', updateGroupIds(Config.pushlist.douyin))
    Config.modify('pushlist', 'bilibili', updateGroupIds(Config.pushlist.bilibili))

    await e.reply(`推送机器人已修改为${newBotId}`)
    return true
  }

}
