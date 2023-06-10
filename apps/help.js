import plugin from '../../../lib/plugins/plugin.js'


export class help extends plugin {
  constructor (e) {
    super({
      name: 'kkkkkk-菜单',
      dsc: 'help',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^(KKK|kkk|kkkkkk-10086)*(命令|帮助|菜单|help|说明|功能|指令|使用说明)$',
          fnc: 'help'
        }
      ]
    })
  }

  async help (e) {
    let text = '待开发，咕咕咕'
    e.reply(text)
  }

}
