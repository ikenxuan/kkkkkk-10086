import puppeteer from '../../../../lib/puppeteer/puppeteer.js'
import { Config, Common, logger } from './index.js'
import { execSync } from 'child_process'
import Version from './Version.js'
import simpleGit from 'simple-git'
import { join } from 'node:path'

/**
 * 计算渲染缩放比例
 * @param {number} pct 缩放百分比
 * @returns {string} 返回CSS样式字符串
 */
function scale(pct = 1) {
  const scale = Math.min(2, Math.max(0.5, Number(Config.app.renderScale) / 100))
  pct = pct * scale
  return `style=transform:scale(${pct})`
}

/**
 * 获取Git状态信息用于版权显示
 * @returns {Promise<string>} 返回格式化的Git状态HTML字符串
 */
const gitstatus = async () => {
  const status = await checkCommitIdAndUpdateStatus()

  // 如果有错误或无法获取远程信息，只显示当前提交ID
  if (status.error || !status.remoteCommitId) {
    return `& <span class="name">Id</span><span class="version">${status.currentCommitId || 'unknown'}</span>`
  }

  if (status.latest) {
    return `& <span class="name">Id</span><span class="version">${status.currentCommitId}</span>`
  } else {
    return `& <span class="name">Id</span><span class="commit_id_old">${status.currentCommitId}</span> & <span class="name">新版本</span><span class="tip">${status.remoteCommitId}</span>`
  }
}

/**
 * 检查提交ID和更新状态
 * @returns {Promise<{currentCommitId: string|null, remoteCommitId: string|null, latest: boolean, error: string|null, commitLog: string|null}>} 返回Git状态信息
 */
const checkCommitIdAndUpdateStatus = async () => {
  const git = simpleGit({ baseDir: Version.pluginPath })
  let result = {
    currentCommitId: /** @type {string | null} */ (null),
    remoteCommitId: /** @type {string | null} */ (null),
    latest: false,
    error: /** @type {string | null} */ (null),
    commitLog: /** @type {string | null} */ (null)
  }

  // 超时Promise
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('操作超时')), 5000)
  )

  // 主要逻辑包装在Promise中
  const mainLogic = (async () => {
    try {
      // 尝试获取当前提交ID（短版本）
      const stdout = execSync(`git -C "${Version.pluginPath}" rev-parse --short=7 HEAD`).toString().trim()
      result.currentCommitId = stdout

      // 执行git fetch
      await git.fetch()

      // 获取远程提交ID（短版本）
      const remoteCommitId = (await git.revparse(['HEAD@{u}'])).substring(0, 7)
      result.remoteCommitId = remoteCommitId

      // 比较本地和远程提交ID
      if (result.currentCommitId === result.remoteCommitId) {
        result.latest = true
        const log = await git.log({ from: result.currentCommitId || '', to: result.currentCommitId || '' })
        if (log && log.all && log.all.length > 0 && log.all[0]) {
          result.commitLog = log.all[0].message
        }
      }
    } catch (error) {
      logger.error(`检查更新状态失败: ${error instanceof Error ? error.message : String(error)}`)
      result.error = '检查更新状态失败'
    }

    return result
  })()

  // 主逻辑与超时竞争
  try {
    return await Promise.race([mainLogic, timeoutPromise])
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error))
    result.error = error instanceof Error ? error.message : String(error)
    return result
  }
}

/**
 * 渲染HTML模板为图片
 * @param {string} path html模板路径
 * @param {Object.<string, *>} params 模板参数
 * @property {number} [params.scale] 模板缩放比例
 * @returns {Promise<Buffer>} 返回渲染后的图片Buffer
 */
export const Render = async (path, params) => {
  const basePaths = {
    douyin: 'douyin/html',
    bilibili: 'bilibili/html',
    admin: 'admin/html',
    kuaishou: 'kuaishou/html',
    help: 'help/html',
    version: 'version/html'
  }
  const platform = Object.keys(basePaths).find(key => path.startsWith(key))
  if (platform) {
    let newPath = path.substring(platform.length)
    // 如果 newPath 以斜杠开头，去掉这个斜杠
    if (newPath.startsWith('/')) {
      newPath = newPath.substring(1)
    }
    path = `${basePaths[/** @type {keyof typeof basePaths} */ (platform)]}/${newPath}`
  }
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
