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
        priority: 5000,
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

    async kt(e) {
      //e.group = Bot.pickGroup(Number(groupID))
      e.isGroup = true
      e.group = Bot.pickGroup(e.group_id)
      let imgpath = `${_path}/plugins/kkkkkk-10086/resources/鸽鸽的照片/开团.jpg`
      let imgurl = await ArkMsg.upload_image(imgpath, true)
      console.log(imgurl)
      let imgjson = ArkMsg.ShareImage_JSON(imgurl)
      await ArkMsg.Share(JSON.stringify(imgjson.data, this.e))
    }
}