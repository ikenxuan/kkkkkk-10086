import update from '../../../plugins/other/update.js'
import Version from '../module/utils/Version.js'
import _ from 'lodash'
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

  async update (e) {
    let msg = e.msg
    if (!msg.includes('日志') && !e.isMaster) return false
    if (msg.includes('强制') && msg.includes('日志')) {
      msg = msg.replace('强制', '')
    }
    msg = msg.replace(/kkk(插件)?/, '')
    msg += Version.pluginName
    e.msg = msg
    const up = await new update(e)
    up.e = e
    e.msg.includes('日志') ? up.updateLog() : up.update()
    return true
  }
}
