import { base, GetID, common, Config } from '#modules'
import { DouYin, push, iKun } from '#douyin'
import { BiLiBiLi, bilidata } from '#bilibili'

export class Tools extends plugin {
  constructor() {
    const rule = Config.videotool
      ? [
          {
            reg: '^.*((www|v|jx)\\.(douyin|iesdouyin)\\.com|douyin\\.com\\/(video|note)).*',
            fnc: 'douy',
          },
          {
            reg: '(bilibili.com|b23.tv|t.bilibili.com)',
            fnc: 'bilib',
          },
          {
            reg: '第(\\d{1,3})集',
            fnc: 'next',
          },
        ]
      : []
    super({
      name: 'kkkkkk-10086-视频功能',
      dsc: '视频',
      event: 'message',
      priority: Config.defaulttool ? -Infinity : 800,
      rule: [...rule, { reg: '^#设置抖音推送', fnc: 'setpushdouy', permission: Config.douyinpushGroup }],
    })
    this.task = Config.douyinpush
      ? {
          cron: Config.douyinpushcron,
          name: '抖音更新推送',
          fnc: () => this.pushdouy(),
          log: Config.douyinpushlog,
        }
      : {}
  }

  async pushdouy() {
    await new push(this.e).action()
  }

  async next(e) {
    if (user[this.e.user_id] === 'bilib') {
      const regex = String(e.msg).match(/第(\d+)集/)
      e.reply(`收到请求，第${regex[1]}集正在下载中`)
      OBJECT.Episode = regex[1]
      await new BiLiBiLi(e, OBJECT).RESOURCES(OBJECT, true)
    }
  }

  async bilib(e) {
    const urlRex = /(?:https?:\/\/)?www\.bilibili\.com\/[A-Za-z\d._?%&+\-=\/#]*/g
    const bShortRex = /(http:|https:)\/\/b23.tv\/[A-Za-z\d._?%&+\-=\/#]*/g
    let url = e.msg === undefined ? e.message.shift().data.replaceAll('\\', '') : e.msg.trim().replaceAll('\\', '')
    if (url.includes('b23.tv')) {
      url = bShortRex.exec(url)?.[0]
    } else if (url.includes('www.bilibili.com')) {
      url = urlRex.exec(url)[0]
    }
    const bvid = await GetID(url)
    const data = await new bilidata(bvid.type).GetData(bvid)
    await new BiLiBiLi(e, data).RESOURCES(data)
    user[this.e.user_id] = 'bilib'
    setTimeout(() => {
      delete user[this.e.user_id]
    }, 1000 * 60)
  }

  async douy(e) {
    const url = String(e.msg).match(/(http|https):\/\/.*\.(douyin|iesdouyin)\.com\/[^ ]+/g)
    const iddata = await GetID(url)
    const data = await new iKun(iddata.type).GetData(iddata)
    const res = await new DouYin(e).GetData(iddata.type, data)
    Config.sendforwardmsg ? await e.reply(await new base(e).resultMsg(await common.makeForwardMsg(e, res.res, res.dec))) : null
    iddata.is_mp4 ? await new base(e).DownLoadVideo(res.g_video_url, Config.rmmp4 ? 'ktmp_' + Date.now() : res.g_title) : null
  }

  async setpushdouy(e) {
    if (e.isPrivate) return true
    const data = await new iKun('Search').GetData({ query: e.msg.match(/^#设置抖音推送(\w+)$/)[1] })
    data.data[0].type === 4 ? await e.reply(await new push(e).setting(data)) : e.reply('无法获取用户信息，请确认抖音号是否正确')
  }
}

let user = {}
