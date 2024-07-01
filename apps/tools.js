/* eslint-disable no-useless-escape */
import { GetID, Config, Pushlist } from '#components'
import { BiLiBiLi, bilidata as Bilidata, Bilibilipush } from '#bilibili'
import { DouYin, DouYinpush, iKun as IKun } from '#douyin'
import { plugin } from '#lib'

const task = []
const rule = []

if (Config.app.videotool) {
  if (Config.douyin.douyintool) {
    rule.push({
      reg: '^.*((www|v|jx)\\.(douyin|iesdouyin)\\.com|douyin\\.com\\/(video|note)).*',
      fnc: 'douy'
    })
  }

  if (Config.bilibili.bilibilitool) {
    rule.push({
      reg: '(bilibili.com|b23.tv|t.bilibili.com)',
      fnc: 'bilib'
    })
  }
}

export class Tools extends plugin {
  constructor () {
    if (Config.bilibili.bilibilipush) {
      task.push({
        cron: Config.bilibili.bilibilipushcron,
        name: '哔哩哔哩更新推送',
        fnc: () => this.pushbili(),
        log: Config.bilibili.bilibilipushlog
      })
    }

    if (Config.douyin.douyinpush) {
      task.push({
        cron: Config.douyin.douyinpushcron,
        name: '抖音更新推送',
        fnc: () => this.pushdouy(),
        log: Config.douyin.douyinpushlog
      })
    }

    super({
      name: 'kkkkkk-10086-视频功能',
      dsc: '视频',
      event: 'message',
      priority: Config.app.defaulttool ? -Infinity : Config.app.priority,
      rule: [
        ...rule,
        { reg: '^#设置抖音推送', fnc: 'setpushdouy', permission: Config.douyin.douyinpushGroup },
        { reg: /^#设置[bB]站推送(?:UID:)?(\d+)$/, fnc: 'setpushbili', permission: Config.douyin.douyinpushGroup },
        { reg: '^#抖音强制推送$', fnc: 'pushdouy', permission: 'master' },
        { reg: '^#B站强制推送$', fnc: 'pushbili', permission: 'master' },
        { reg: '^#?kkk推送列表$', fnc: 'pushlist' },
        { reg: '^第(\\d{1,3})集$', fnc: 'next' },
        { reg: '^#?BGM', fnc: 'uploadrecord' }
      ]
    })
    this.task = task
  }

  async pushlist (e) {
    const obj = {
      douyin: [],
      bilibili: []
    }
    const platforms = {
      douyin: Config.pushlist.douyin ? Config.pushlist.douyin : [],
      bilibili: Config.pushlist.bilibili ? Config.pushlist.bilibili : []
    }
    for (const platform in platforms) {
      // eslint-disable-next-line no-prototype-builtins
      if (platforms.hasOwnProperty(platform)) {
        const list = platforms[platform]
        for (const item of list) {
          // 根据平台不同，选择不同的属性 key
          const key = platform === 'douyin' ? 'sec_uid' : 'host_mid'
          // 检查 item[key] 是否不为 null 且 item.group_id 是否不是空数组
          if (item[key] && item.group_id.length > 0) {
            obj[platform].push({
              group_id: item.group_id,
              remark: item.remark,
              [key]: item[key]
            })
          }
        }
      }
    }
    const img = await Pushlist(e, obj)
    await e.reply(img)
    return true
  }

  async pushdouy () {
    if (String(this.e?.msg).match('强制')) await new DouYinpush(this.e, true).action()
    else await new DouYinpush(this.e).action()
    return true
  }

  async pushbili () {
    if (String(this.e?.msg).match('强制')) await new Bilibilipush(this.e, true).action()
    else await new Bilibilipush(this.e).action()
    return true
  }

  async next (e) {
    if (user[this.e.user_id] === 'bilib') {
      const regex = String(e.msg).match(/第(\d+)集/)
      e.reply(`收到请求，第${regex[1]}集正在下载中`)
      const BILIBILIOBJECT = global.BILIBILIOBJECT
      BILIBILIOBJECT.Episode = regex[1]
      await new BiLiBiLi(e, BILIBILIOBJECT).RESOURCES(BILIBILIOBJECT, true)
    }
    return true
  }

  async bilib (e) {
    const urlRex = /(?:https?:\/\/)?www\.bilibili\.com\/[A-Za-z\d._?%&+\-=\/#]*/g
    const bShortRex = /(http:|https:)\/\/b23.tv\/[A-Za-z\d._?%&+\-=\/#]*/g
    let url = e.msg === undefined ? e.message.shift().data.replaceAll('\\', '') : e.msg.trim().replaceAll('\\', '')
    if (url.includes('b23.tv')) {
      url = bShortRex.exec(url)?.[0]
    } else if (url.includes('www.bilibili.com')) {
      url = urlRex.exec(url)[0]
    }
    const bvid = await GetID(url)
    const data = await new Bilidata(bvid.type).GetData(bvid)
    await new BiLiBiLi(e, data).RESOURCES(data)
    user[this.e.user_id] = 'bilib'
    setTimeout(() => {
      delete user[this.e.user_id]
    }, 1000 * 60)
    return true
  }

  async uploadrecord (e) {
    const music_id = String(e.msg).match(/BGM(\d+)/)
    await new DouYin(e).uploadrecord(music_id[1])
    return true
  }

  async douy (e) {
    const url = String(e.msg).match(/(http|https):\/\/.*\.(douyin|iesdouyin)\.com\/[^ ]+/g)
    const iddata = await GetID(url)
    const data = await new IKun(iddata.type).GetData(iddata)
    const res = await new DouYin(e, iddata).RESOURCES(data)
    if (res) return true
  }

  async setpushbili (e) {
    if (e.isPrivate) return true
    const data = await new Bilidata('用户名片信息').GetData(/^#设置[bB]站推送(?:UID:)?(\d+)$/.exec(e.msg)[1])
    await e.reply(await new Bilibilipush(e).setting(data))
    return true
  }

  async setpushdouy (e) {
    if (e.isPrivate) return true
    const data = await new IKun('Search').GetData({ query: e.msg.replace(/^#设置抖音推送/, '') })
    await e.reply(await new DouYinpush(e).setting(data))
    return true
  }
}

const user = {}
