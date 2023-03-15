import plugin from '../../../lib/plugins/plugin.js'


export class help extends plugin {
  constructor (e) {
    super({
      name: 'kkk帮助',
      dsc: '云崽帮助',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: '^(KKK|kkk)*(命令|帮助|菜单|help|说明|功能|指令|使用说明)$',
          fnc: 'help'
        }
      ]
    })
  }

  async help (e) {
    let text = '引用图片发大图\n语音盒\n解析抖音快手tiktok视频\n手写<文本>\n开奖\n'
    e.reply(text)
  }

}
