import { Update, plugin } from '#lib'
import { Version } from '#components'

export class MusicUpdate extends plugin {
  constructor() {
    super({
      name: '更新',
      event: 'message',
      priority: 1000,
      rule: [
        {
          reg: '^#?kkk(强制)?更新$',
          fnc: 'update',
          permission: 'master',
        },
        {
          reg: '^#?kkk更新日志$',
          fnc: 'update_log',
          permission: 'master',
        },
      ],
    })
  }

  async update(e = this.e) {
    if (Version.BotName === 'Karin') {
      let [name, cmd] = [Version.pluginName, 'git pull']
      if (e.msg.includes('强制')) cmd = 'git reset --hard && git pull --allow-unrelated-histories'
      try {
        const { data } = await Update.update(Version.pluginPath, cmd)
        await this.reply(`\n${name}${data}`, { at: true })
        if (!data.includes('更新成功')) return true
        return this.reply(`${Version.pluginName}更新成功，请重启应用更新！`)
      } catch (error) {
        return this.reply(`更新失败：${error.message}`, { at: true })
      }
    } else {
      let Update_Plugin = new Update()
      Update_Plugin.e = e
      Update_Plugin.reply = e.reply

      if (Update_Plugin.getPlugin(Version.pluginName)) {
        if (e.msg.includes('强制')) {
          execSync('git reset --hard', {
            cwd: `${Version.pluginPath}/`,
          })
        }
        await Update_Plugin.runUpdate(Version.pluginName)
        if (Update_Plugin.isUp) {
          setTimeout(() => Update_Plugin.restart(), 2000)
        }
      }
      return true
    }
  }

  async update_log(e = this.e) {
    let Update_Plugin = new Update(e)
    Update_Plugin.e = e
    Update_Plugin.reply = this.reply

    if (Update_Plugin.getPlugin(Version.pluginName)) {
      this.e.reply(await Update_Plugin.getLog(Version.pluginName))
    }
    return true
  }
}
