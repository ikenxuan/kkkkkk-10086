import _ from 'lodash'
import { Render, Version } from '#components'
import { helpCfg, helpList } from '../config/system/help_cfg.js'

export class Help extends plugin {
  constructor() {
    super({
      name: 'kkk帮助',
      event: 'message',
      priority: 2000,
      rule: [
        {
          reg: '^#?kkk帮助$',
          fnc: 'help',
        },
        {
          reg: '^#?kkk版本$',
          fnc: 'version',
        },
      ],
    })
  }

  async version(e) {
    return await Render.render(
      'html/help/version-info',
      {
        currentVersion: Version.version,
        changelogs: Version.changelogs,
        elem: 'cryo',
      },
      { e, scale: 1.8 },
    )
  }

  async help(e) {
    let helpConfig = _.defaults(helpCfg)
    let helpGroup = []
    _.forEach(helpList, (group) => {
      if (group.auth && group.auth === 'master' && !e.isMaster) {
        return true
      }
      _.forEach(group.list, (help) => {
        let icon = help.icon * 1
        if (!icon) {
          help.css = 'display:none'
        } else {
          let x = (icon - 1) % 10
          let y = (icon - x - 1) / 10
          help.css = `background-position:-${x * 50}px -${y * 50}px`
        }
      })

      helpGroup.push(group)
    })

    return await Render.render(
      'html/help/index',
      {
        helpCfg: helpConfig,
        helpGroup,
        bg: 'default.png',
        colCount: 3,
        element: 'default',
      },
      { e, scale: 1.8 },
    )
  }
}
