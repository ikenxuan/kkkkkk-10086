import plugin from '../../../lib/plugins/plugin.js'
import { segment } from 'oicq'
import fetch from 'node-fetch'

export class wenan extends plugin {
  constructor () {
    super({
      name: '添加头像框',
      dsc: '头像框',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: `^(头像框)(.*)`,
          fnc: 'cb'
        },
      ]
    })
  }
  async cb(e) {
    let msg = e.msg
		let place = msg.replace(/#|头像框/g, "").trim();
    let url = `https://v.api.aa1.cn/api/api-tksc/sc.php?qq=${place}`;
    let data = [
      segment.at(e.user_id),
      segment.image(url),
      ]
      //发送消息
      e.reply(data);
      // return true

    if (!data) {
    logger.error('[添加头像框] 接口请求失败')
    return await this.reply(logger)
  }
}}
