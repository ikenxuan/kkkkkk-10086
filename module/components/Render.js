import { join } from 'path'
import Version from './Version.js'
import Config from './Config.js'
import puppeteer from '../lib/public/puppeteer.js'

function scale (pct = 1) {
  const scale = Math.min(2, Math.max(0.5, Number(Config.app.renderScale) / 100))
  pct = pct * scale
  return `style=transform:scale(${pct})`
}

async function gitstatus () {
  const status = await Version.checkCommitIdAndUpdateStatus()
  if (status.latest) {
    return ` SHA: <span class="version">${status.currentCommitId}</span>`
  } else {
    return ` SHA: <span class="version">${status.currentCommitId}</span> <span class="tip">(有新版本: ${status.remoteCommitId})</span>`
  }
}

const Render = {
  /**
   *
   * @param {string} path html模板路径
   * @param {*} params 模板参数
   * @param {*} cfg 渲染参数
   * @param {boolean} multiPage 是否分页截图，默认false
   * @returns
   */
  async render (path, params) {
    path = path.replace(/.html$/, '')
    const savePath = '/' + path.replace('html/', '') + '/'
    const data = {
      _res_path: (join(Version.pluginPath, '/resources') + '/').replace(/\\/g, '/'),
      _layout_path: (join(Version.pluginPath, '/resources', 'html', 'COMMON', 'layout') + '/').replace(/\\/g, '/'),
      defaultLayout: (join(Version.pluginPath, '/resources', 'html', 'COMMON', 'layout') + '/default.html').replace(/\\/g, '/'),
      elemLayout: (join(Version.pluginPath, '/resources', 'html', 'COMMON', 'layout') + '/elem.html').replace(/\\/g, '/'),
      sys: {
        scale: scale(params.scale || 1)
      },
      copyright: `${Version.BotName}<span class="version"> v${await Version.BotVersion()}</span> & ${Version.pluginName}<span class="version"> v${Version.version}</span>${await gitstatus()}`,
      pageGotoParams: {
        waitUntil: 'load'
      },
      tplFile: `${Version.pluginPath}/resources/${path}.html`,
      pluResPath: `${Version.pluginPath}/resources/`,
      saveId: path.split('/').pop(),
      imgType: 'jpeg',
      multiPage: true,
      multiPageHeight: 12000,
      ...params
    }
    return await puppeteer.screenshots(Version.BotName === 'Karin' ? savePath : Version.pluginName + savePath, data)
  }
}

export default Render
