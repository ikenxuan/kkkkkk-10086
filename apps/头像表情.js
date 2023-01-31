import plugin from '../../../lib/plugins/plugin.js'
import { segment } from 'oicq'

export class wenan extends plugin {
    constructor () {
      super({
        name: '头像表情',
        dsc: '表情',
        event: 'message',
        priority: 5000,
        rule: [
          {
            reg: `^(证书)(.*)`,
            fnc: 'zhengshu'
          },
        ]
      })
    }
    
    async zhengshu(e) {
        let msg = e.msg
		    let text = msg.replace(/#|证书/g, "").trim();
        let url = `https://xiaobai.klizi.cn/API/ce/zs.php?qq=${text}`;
        let data = [
            // segment.at(e.user_id),
            segment.image(url),
        ]
      //发送消息
      e.reply(data);

    }
}