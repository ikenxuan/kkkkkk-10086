import Version from '@/module/utils/Version'
// 宿主导出的类名是小写的 update，这里改名以便与本文件的 update 方法区分
import { update as HostUpdate } from '@/runtime/host/update'
import type { CommandEvent } from '@/types/message'

export class kkkUpdate extends plugin {
  constructor () {
    super({
      name: '更新',
      event: 'message',
      priority: 1000,
      rule: [
        {
          reg: /^#kkk(插件)?(强制)?更新(日志)?$/,
          fnc: 'update'
        }
      ]
    })
  }

  async update (e: CommandEvent): Promise<boolean> {
    let msg = e.msg
    if (!msg.includes('日志') && !e.isMaster) return false
    if (msg.includes('强制') && msg.includes('日志')) {
      msg = msg.replace('强制', '')
    }
    msg = msg.replace(/kkk(插件)?/, '')
    msg += Version.pluginName
    e.msg = msg
    const up = new HostUpdate(e)
    up.e = e
    e.msg.includes('日志') ? up.updateLog() : up.update()
    return true
  }
}
