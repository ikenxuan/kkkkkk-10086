import { Update, Restart, plugin, makeForwardMsg } from '#lib'
import { Version } from '#components'

export class MusicUpdate extends plugin {
  constructor() {
    super({
      name: '更新',
      event: 'message',
      priority: 1000,
      rule: [
        {
          reg: '^#?(kkk|kkkkkk-10086)(强制)?更新$',
          fnc: 'update',
          permission: 'master',
        },
        {
          reg: '^#?(kkk|kkkkkk-10086)更新日志$',
          fnc: 'update_log',
          permission: 'master',
        },
      ],
    })
  }

  async update() {
    if (Version.BotName === 'Karin') {
      let [name, cmd] = [Version.pluginName, 'git pull']
      if (this.e.msg.includes('强制')) cmd = 'git reset --hard && git pull --allow-unrelated-histories'
      try {
        const { data } = await Update.update(Version.pluginPath, cmd)
        await this.reply(`\n${name}${data}`, { at: true })
        if (!data.includes('更新成功')) return true
        if (Restart) {
          await this.reply(`\n更新完成，开始重启 本次运行时间：${common.uptime()}`, { at: true })
          try {
            const restart = new Restart()
            restart.e = this.e
            await restart.CmdRestart()
            return true
          } catch (error) {
            return this.reply(`\n重启失败\n${error.message}`, { at: true })
          }
        } else {
          return this.reply(`${Version.pluginName}更新成功，请重启应用更新！`)
        }
      } catch (error) {
        return this.reply(`更新失败：${error.message}`, { at: true })
      }
    } else {
      this.e.msg = `#${Version.pluginName}${this.e.msg.includes('强制') ? '强制' : ''}更新`
      const up = new Update(e)
      up.e = e
      return up.update()
    }
  }

  async update_log() {
    if (Version.BotName === 'Karin') {
      let count
      if (!count) {
        count = 10
      }
      try {
        const data = (await Update.getCommit({ path: Version.pluginPath, count })).replace(/\n\s*\n/g, '\n')
        let commitlist
        commitlist = data
          .split('\n')
          .filter(Boolean)
          .map((item) => item.trimEnd())
        this.e.reply(await makeForwardMsg(this.e, commitlist))
        return true
      } catch {
        return this.e.reply(`\n获取更新日志失败：\n${this.e.msg}`, { at: true })
      }
    } else {
      let Update_Plugin = new Update(this.e)
      Update_Plugin.e = this.e
      Update_Plugin.reply = this.reply

      if (Update_Plugin.getPlugin(Version.pluginName)) {
        this.e.reply(await Update_Plugin.getLog(Version.pluginName))
      }
      return true
    }
  }
}
