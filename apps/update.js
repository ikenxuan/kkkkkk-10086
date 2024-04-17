import plugin from '../../../lib/plugins/plugin.js'
import { update } from '../../other/update.js'
import { exec, execSync } from 'child_process'
const Plugin_Name = 'kkkkkk-10086'
export class example extends plugin {
  constructor() {
    super({
      name: 'kkkkkk-10086-更新',
      event: 'message',
      priority: 1000,
      rule: [
        {
          reg: '^#?(kkkkkk|kkk|k)(插件)?(强制)?更新$',
          fnc: 'update_plugin',
          permission: 'master',
        },
        {
          reg: '^#?(kkkkkk|kkk|k)(插件)?更新(日志|记录)$',
          fnc: 'update_log',
          permission: 'master',
        },
      ],
    })
  }

  async update_plugin() {
    let Update_Plugin = new update()
    Update_Plugin.e = this.e
    Update_Plugin.reply = this.reply

    if (Update_Plugin.getPlugin(Plugin_Name)) {
      if (this.e.msg.includes('强制')) {
        execSync('git reset --hard', {
          cwd: `${process.cwd()}/plugins/${Plugin_Name}/`,
        })
      }
      await Update_Plugin.runUpdate(Plugin_Name)
      if (Update_Plugin.isUp) {
        setTimeout(() => Update_Plugin.restart(), 2000)
      }
    }
    return true
  }

  async update_log() {
    let Update_Plugin = new update()
    Update_Plugin.e = this.e
    Update_Plugin.reply = this.reply

    if (Update_Plugin.getPlugin(Plugin_Name)) {
      this.e.reply(await Update_Plugin.getLog(Plugin_Name))
    }
    return true
  }
}
