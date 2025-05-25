import puppeteer from '../../../../lib/puppeteer/puppeteer.js'
import Version from './Version.js'
import Common from './Common.js'
import Config from './Config.js'
import { join } from 'node:path'

function scale (pct = 1) {
  const scale = Math.min(2, Math.max(0.5, Number(Config.app.renderScale) / 100))
  pct = pct * scale
  return `style=transform:scale(${pct})`
}

async function gitstatus () {
  const status = await Version.checkCommitIdAndUpdateStatus()
  if (status.latest) {
    return ` & <span class="name">Id</span><span class="version">${status.currentCommitId}</span>`
  } else {
    return `& <span class="name">Id</span><span class="commit_id_old">${status.currentCommitId}</span> & <span class="name">新版本</span><span class="tip">${status.remoteCommitId}</span>`
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
    const basePaths = {
      douyin: 'douyin/html',
      bilibili: 'bilibili/html',
      admin: 'admin/html',
      kuaishou: 'kuaishou/html',
      help: 'help/html',
      version: 'version/html'
    }
    const platform = Object.keys(basePaths).find(key => path.startsWith(key)) || ''
    let newPath = path.substring(platform.length)
    // 如果 newPath 以斜杠开头，去掉这个斜杠
    if (newPath.startsWith('/')) {
      newPath = newPath.substring(1)
    }
    path = `${basePaths[platform]}/${newPath}`
    const data = {
      // 资源路径
      _res_path: join(Version.pluginPath, 'resources').replace(/\\/g, '/') + '/',
      // 布局模板路径
      _layout_path: join(Version.pluginPath, 'resources', 'template', 'extend').replace(/\\/g, '/') + '/',
      // 默认布局文件路径
      defaultLayout: join(Version.pluginPath, 'resources', 'template', 'extend', 'html', 'default.html').replace(/\\/g, '/'),
      sys: {
        scale: scale(params?.scale ?? 1)
      },
      copyright: `<span class="name">${Version.BotName}</span><span class="version">${Version.BotVersion}</span> & <span class="name">${Version.pluginName}</span><span class="version">${Version.version}</span> ${await gitstatus()}`,
      pageGotoParams: {
        waitUntil: 'load'
      },
      useDarkTheme: Common.useDarkTheme(),
      tplFile: `${Version.pluginPath}/resources/template/${path}.html`,
      pluResPath: `${Version.pluginPath}/resources/`,
      saveId: path.split('/').pop(),
      imgType: 'jpeg',
      multiPage: true,
      multiPageHeight: 12000,
      ...params
    }
    return await puppeteer.screenshots(join(Version.pluginName, path), data)
  }
}

export default Render
