import { BiLiBiLi, Bilidata, Bilibilipush, GetBilibiliID } from '../module/platform/bilibili/index.js'
import { DouYin, DouYinpush, DouyinData, GetDouyinID } from '../module/platform/douyin/index.js'
import { KuaiShou, GetKuaishouID, KuaishouData } from '../module/platform/kuaishou/index.js'
import { Config, Pushlist, Common } from '../module/utils/index.js'

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
        { reg: /^#设置[bB]站推送(?:[Uu][Ii][Dd]:)?(\d+)$/, fnc: 'setpushbili', permission: Config.douyin.douyinpushGroup },
        { reg: '^#抖音强制推送$', fnc: 'pushdouy', permission: 'master' },
        { reg: '^#B站强制推送$', fnc: 'pushbili', permission: 'master' },
        { reg: /^#(抖音|[bB]站)推送列表$/, fnc: 'pushlist' },
        { reg: '^#?第(\\d{1,3})集$', fnc: 'next' },
        { reg: '^#?BGM', fnc: 'uploadRecord' },
        { reg: '^#?(解析|kkk解析)', fnc: 'prefix' }
      ]
    })
    this.task = task
  }

  async prefix (e) {
    e.msg = await Common.getReplyMessage(e)

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
    const Iddata = await GetKuaishouID(String(e.msg.replaceAll('\\', '')).match(/https:\/\/v\.kuaishou\.com\/\w+/g))
    const WorkData = await new KuaishouData(Iddata.type).GetData({ photoId: Iddata.id })
    await new KuaiShou(e, Iddata).Action(WorkData)
    return true
  }

  async pushlist (e) {
    // 根据消息内容判断显示哪个平台的推送列表
    const platform = e.msg.includes('抖音') ? 'douyin' : 'bilibili'
    const obj = {
      [platform]: []
    }
    
    const list = Config.pushlist[platform] || []
    
    // 遍历推送列表,只获取当前群的推送配置
    for (const item of list) {
      const key = platform === 'douyin' ? 'sec_uid' : 'host_mid'
      // 检查group_id是否包含当前群号
      if (item[key] && item.group_id.some(gid => gid.split(':')[0] === String(e.group_id))) {
        obj[platform].push({
          group_id: item.group_id.filter(gid => gid.split(':')[0] === String(e.group_id)),
          remark: item.remark,
          [key]: item[key]
        })
      }
    }

    const img = await Pushlist(e, obj, platform)
    if (img) await e.reply(img)
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
    const urlRex = /(?:https?:\/\/)?(?:www\.bilibili\.com|m\.bilibili\.com|bili2233\.cn)\/[A-Za-z\d._?%&+\-=\/#]*/g
    const bShortRex = /(http:|https:)\/\/b23.tv\/[A-Za-z\d._?%&+\-=\/#]*/g
    let url = e.msg === undefined ? e.message.shift().data.replaceAll('\\', '') : e.msg.trim().replaceAll('\\', '')
    if (url.includes('b23.tv')) {
      url = bShortRex.exec(url)[0]
    } else if (url.includes('www.bilibili.com') || url.includes('m.bilibili.com') || url.includes('bili2233.cn')) {
      url = urlRex.exec(url)?.[0]
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

  async uploadRecord (e) {
    const music_id = String(e.msg).match(/BGM(\d+)/)
    await new DouYin(e).uploadRecord(music_id[1])
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
  bilibili: new RegExp(/(bilibili.com|b23.tv|t.bilibili.com|bili2233.cn|BV[a-zA-Z0-9]{10}$)/),
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
