import { Render, Version, Common } from '../module/utils/index.js'
import { markdown } from '@karinjs/md-html'
import { join } from 'node:path'
import fs from 'node:fs'

export class kkkHelp extends plugin {
  constructor() {
    super({
      name: 'kkk帮助',
      event: 'message',
      priority: 2000,
      rule: [
        {
          reg: '^#?kkk帮助$',
          fnc: 'help'
        },
        {
          reg: '^#?kkk版本$',
          fnc: 'version'
        }
      ]
    })
  }

  async version(e) {
    const changelogs = fs.readFileSync(Version.pluginPath + '/CHANGELOG.md', 'utf8')
    const html = markdown(changelogs, {
      gitcss: Common.useDarkTheme() ? 'github-markdown-dark.css' : 'github-markdown-light.css'
    })
    fs.mkdirSync(join(Version.pluginPath, 'resources', 'template', 'version', 'html'), { recursive: true })
    const htmlPath = join(Version.pluginPath, 'resources', 'template', 'version', 'html', 'index.html')
    fs.writeFileSync(htmlPath, html)
    const img = await Render('version/index')
    await e.reply(img)
    return true
  }

  async help(e) {
    const img = await Render('help/index')
    await e.reply(img)
    return true
  }
}
