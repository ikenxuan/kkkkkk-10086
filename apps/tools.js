import { Config, Pushlist } from '../module/components/index.js'
import { BiLiBiLi, Bilidata, Bilibilipush, GetBilibiliID } from '../module/business/bilibili/index.js'
import { DouYin, DouYinpush, DouyinData, GetDouyinID } from '../module/business/douyin/index.js'
import { KuaiShou, GetKuaishouID, KuaishouData } from '../module/business/kuaishou/index.js'
import plugin from '../module/lib/public/plugin.js'



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
        { reg: '^#?第(\\d{1,3})集$', fnc: 'next' },
        { reg: '^#?BGM', fnc: 'uploadrecord' },
        { reg: '^(?!#?kkk设置\\b)#?(解析|kkk|kkk解析)', fnc: 'prefix' }
      ]
    })
    this.task = task
  }

  async prefix (e) {
    if (reg.douyin.test(e.msg)) {
      return await this.douy(e)
    } else if (reg.bilibili.test(e.msg)) {
      return await this.bilib(e)
    } else if (reg.kuaishou.test(e.msg)) {
      return await this.kuais(e)
    }
    return true
  }
  async kuais (e) {
    const Iddata = await GetKuaishouID(String(e.msg).match((/(http|https):\/\/.*\.(kuaishou)\.com\/[^ ]+/g)))
    const WorkData = await new KuaishouData(Iddata.type).GetData({ photoId: Iddata.id })
    await new KuaiShou(e, Iddata).Action(WorkData)
    return true
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
    } else if (/^BV[1-9a-zA-Z]{10}$/.exec(url)?.[0]) {
      url = `https://www.bilibili.com/video/${ url }`
    }
    const bvid = await GetBilibiliID(url)
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
    const iddata = await GetDouyinID(url)
    const data = await new DouyinData(iddata.type).GetData(iddata)
    const res = await new DouYin(e, iddata).RESOURCES(data)
    if (res) return true
  }

  async setpushbili (e) {
    if (e.isPrivate) return true
    const data = await new Bilidata('用户名片信息').GetData({ host_mid: /^#设置[bB]站推送(?:UID:)?(\d+)$/.exec(e.msg)[1] })
    await e.reply(await new Bilibilipush(e).setting(data))
    return true
  }

  async setpushdouy (e) {
    if (e.isPrivate) return true
    const data = await new DouyinData('Search').GetData({ query: e.msg.replace(/^#设置抖音推送/, '') })
    await e.reply(await new DouYinpush(e).setting(data))
    return true
  }
}

const user = {}
const task = []
const rule = []

const reg = {
  douyin: new RegExp('^.*((www|v|jx)\\.(douyin|iesdouyin)\\.com|douyin\\.com\\/(video|note)).*'),
  bilibili: new RegExp('(bilibili.com|b23.tv|t.bilibili.com|BV[a-zA-Z0-9]{10})'),
  kuaishou: new RegExp('^((.*)快手(.*)快手(.*)|(.*)v.kuaishou(.*))$')
}

if (Config.app.videotool) {
  if (Config.douyin.douyintool) {
    rule.push({
      reg: reg.douyin,
      fnc: 'douy'
    })
  }

  if (Config.bilibili.bilibilitool) {
    rule.push({
      reg: reg.bilibili,
      fnc: 'bilib'
    })
  }

  if (Config.kuaishou.kuaishoutool) {
    rule.push({
      reg: reg.kuaishou,
      fnc: 'kuais'
    })
  }
}
