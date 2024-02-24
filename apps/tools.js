import plugin from '../../../lib/plugins/plugin.js'
import common from '../../../lib/common/common.js'
import TikHub from '../model/douyin/tikhub.js'
import { Config } from '../model/config.js'
import Argument from '../model/douyin/getdata.js'
import { GetID } from '../model/douyin/judgment.js'
import cfg from '../../../lib/config/config.js'

let getPriority = 800
if (Config.defaulttool) {
	getPriority = -1145141919180
}

export class example extends plugin {
	constructor() {
		const rule = Config.videotool
			? [
					{
						reg: '^.*((www|v|jx)\\.douyin\\.com|douyin\\.com\\/(video|note)).*',
						fnc: 'douy',
					},
			  ]
			: []
		super({
			name: 'kkkkkk-10086-视频功能',
			dsc: '视频',
			event: 'message',
			priority: getPriority,
			rule: rule,
		})
	}

	async douy(e) {
		if (Config.ck === '') {
			e.reply('抖音未设置ck，无法解析', true)
			console.log('使用 [#kkk设置抖音ck] 以设置抖音ck')
			return true
		}

		const regexp = /(http|https):\/\/.*\.douyin\.com\/[^ ]+/g
		const url = e.toString().match(regexp)

		const iddata = await GetID(url)
		const data = await new Argument().GetData(iddata)

		const res = await new TikHub(e).GetData(iddata.type, data)
		// await e.reply(await (!cfg.bot.skip_login ? common.makeForwardMsg(e, res.res, res.dec) : Promise.resolve()))
		// if (iddata.is_mp4) {
		//   await new TikHub(e).DownLoadVideo(res.g_video_url, res.g_title)
		// }
	}
}
