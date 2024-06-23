import { join } from 'path'
import { Version, Config } from '#components'
import { puppeteer } from '#lib'

function scale(pct = 1) {
  const scale = Math.min(2, Math.max(0.5, Number(Config.renderScale) / 100))
  pct = pct * scale
  return `style=transform:scale(${pct})`
}

const Render = {
  /**
   *
   * @param {string} path html模板路径
   * @param {*} params 模板参数
   * @param {*} cfg 渲染参数
   * @returns
   */
  async render(path, params, cfg = {}) {
    path = path.replace(/.html$/, '')
    const savePath = '/' + path.replace('html/', '') + '/'
    const data = {
      _res_path: (join(Version.pluginPath, '/resources') + '/').replace(/\\/g, '/'),
      _layout_path: (join(Version.pluginPath, '/resources', 'html', 'COMMON', 'layout') + '/').replace(/\\/g, '/'),
      defaultLayout: (join(Version.pluginPath, '/resources', 'html', 'COMMON', 'layout') + '/default.html').replace(/\\/g, '/'),
      elemLayout: (join(Version.pluginPath, '/resources', 'html', 'COMMON', 'layout') + '/elem.html').replace(/\\/g, '/'),
      sys: {
        scale: scale(cfg.scale || 1),
      },
      copyright: `${Version.BotName}<span class="version">${Version.BotVersion}</span> & ${Version.pluginName}<span class="version">${Version.version}`,
      pageGotoParams: {
        waitUntil: 'load',
      },
      tplFile: `${Version.pluginPath}/resources/${path}.html`,
      pluResPath: `${Version.pluginPath}/resources/`,
      saveId: path.split('/').pop(),
      imgType: 'jpeg',
      ...params,
    }
    return await puppeteer.screenshot(Version.BotName === 'Karin' ? savePath : Version.pluginName + savePath, data)
  },
}

export default Render
