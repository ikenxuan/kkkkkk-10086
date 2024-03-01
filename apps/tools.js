import { GetID } from '../model/douyin/judgment.js'
import common from '../../../lib/common/common.js'
import cfg from '../../../lib/config/config.js'
import TikHub from '../model/douyin/tikhub.js'
import iKun from '../model/douyin/getdata.js'
import { Config } from '../model/config.js'
import push from '../model/douyin/push.js'

let getPriority = 800
if (Config.defaulttool) {
  getPriority = -1145141919180
}

export class example extends plugin {
  constructor() {
    const rule = Config.videotool
      ? [
          {
            reg: '^.*((www|v|jx)\\.(douyin|iesdouyin)\\.com|douyin\\.com\\/(video|note)).*',
            fnc: 'douy',
          },
        ]
      : []
    super({
      name: 'kkkkkk-10086-视频功能',
      dsc: '视频',
      event: 'message',
      priority: getPriority,
      rule: [...rule, { reg: '^#设置抖音推送', fnc: 'setpushdouy', permission: 'admin' }],
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

  async douy(e) {
    const regexp = /(http|https):\/\/.*\.(douyin|iesdouyin)\.com\/[^ ]+/g
    const url = e.toString().match(regexp)

    const iddata = await GetID(url)
    const data = await new iKun(iddata.type).GetData(iddata)

    const res = await new TikHub(e).GetData(iddata.type, data)
    await e.reply(await (!cfg.bot.skip_login ? common.makeForwardMsg(e, res.res, res.dec) : Promise.resolve()))
    if (iddata.is_mp4) {
      await new TikHub(e).DownLoadVideo(res.g_video_url, res.g_title)
    }
    return true
  }

  async pushdouy() {
    await new push(this.e).action()
  }

  async setpushdouy(e) {
    if (e.isPrivate) return true
    const data = await new iKun('Search').GetData({ query: e.msg.match(/^#设置抖音推送(\w+)$/)[1] })
    if (data.data[0].type === 4) {
      const resp = await new push(e).setting(data)
      await this.reply(resp)
    } else {
      e.reply('无法获取用户信息，请确认抖音号是否正确')
    }
  }
}
