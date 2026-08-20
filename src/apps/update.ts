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
          // 不再收「日志」：`#kkk更新日志` 归 help.ts 出 other/changelog 卡片，
          // 与上游一致。本文件优先级 1000 比 help 的 2000 靠前，两条规则重叠时
          // 这边先返回 true，卡片就永远进不去。
          reg: /^#kkk(插件)?(强制)?更新$/,
          fnc: 'update'
        }
      ]
    })
  }

  async update (e: CommandEvent): Promise<boolean> {
    // 更新是主人专属；非主人直接放行，让后面的插件有机会处理
    if (!e.isMaster) return false
    let msg = e.msg
    msg = msg.replace(/kkk(插件)?/, '')
    msg += Version.pluginName
    e.msg = msg
    const up = new HostUpdate(e)
    up.e = e
    up.update()
    return true
  }
}
