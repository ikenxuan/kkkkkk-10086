import plugin from '../../../lib/plugins/plugin.js'
import { segment } from 'oicq'
import ArkMsg from '../model/ArkMsg.js';
const _path = process.cwd();

export class wenan extends plugin {
    constructor () {
      super({
        name: '手写文本',
        dsc: '手写',
        event: 'message',
        priority: 1000,
        rule: [
          {
            reg: `^(手写)(.*)`,
            fnc: 'realtext'
          },
          {
            reg: `^开团$`,
            fnc: 'kt'
          },

        ]
      })
    }
    
    async realtext(e) {
        let msg = e.msg
		    let text = msg.replace(/#|手写/g, "").trim();
        let url = `https://zj.v.api.aa1.cn/api/zuoye/?msg=${encodeURIComponent(text)}`;
        let data = [
            // segment.at(e.user_id),
            segment.image(url),
        ]
      //发送消息
      e.reply(data);
    }

}