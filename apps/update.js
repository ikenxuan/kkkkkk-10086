import { Update, Restart, plugin, makeForwardMsg, common } from '#lib'
import { Version } from '#components'
import _ from 'lodash'

let uping = false
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
    if (uping) {
      this.e.reply(`正在更新${Version.pluginName}，请稍后...`)
      return false
    }
    uping = true
    setTimeout(() => {
      uping = false
    }, 300 * 1000)
    switch (Version.BotName) {
      case 'Karin':
        let [name, cmd] = [Version.pluginName, 'git pull']
        if (this.e.msg.includes('强制')) cmd = 'git reset --hard && git pull --allow-unrelated-histories'
        try {
          const { data } = await Update.update(Version.pluginPath, cmd)
          let msg = `更新${name}...${_.isObject(data) ? `${data.message}\n${data.stderr}` : data}`
          await this.replyForward(common.makeForward(msg))
          if (!data.includes('更新成功')) return true
          try {
            await this.reply(`\n更新完成，开始重启 本次运行时间：${common.uptime()}`, { at: true })
            const restart = new Restart(this.e)
            restart.e = this.e
            await restart.CmdRestart()
            return true
          } catch (error) {
            return this.e.reply(`${Version.pluginName}重启失败，请手动重启以应用更新！`)
          }
        } catch (error) {
          return this.e.reply(`更新失败：${error.message}`, { at: true })
        } finally {
          uping = false
        }
      default:
        try {
          this.e.msg = `#kkk${this.e.msg.includes('强制') ? '强制' : ''}更新`
          const up = new Update(this.e)
          up.e = this.e
          return up.update()
        } catch (error) {
        } finally {
          uping = false
        }
    }
  }
  async update_log() {
    switch (Version.BotName) {
      case 'Karin':
        try {
          const data = (await Update.getCommit({ path: Version.pluginPath, count: 10 })).replace(/\n\s*\n/g, '\n')
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
      default:
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
