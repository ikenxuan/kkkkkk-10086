import fs from 'fs'
import lodash from 'lodash'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import simpleGit from 'simple-git'

const __filename = fileURLToPath(import.meta.url)

const __dirname = dirname(__filename)

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))

const getLine = function (line) {
  line = line.replace(/(^\s*\*|\r)/g, '')
  line = line.replace(/\s*`([^`]+`)/g, '<span class="cmd">$1')
  line = line.replace(/`\s*/g, '</span>')
  line = line.replace(/\s*\*\*([^\\*]+\*\*)/g, '<span class="strong">$1')
  line = line.replace(/\*\*\s*/g, '</span>')
  line = line.replace(/ⁿᵉʷ/g, '<span class="new"></span>')
  return line
}

const readLogFile = function (root, versionCount = 4) {
  const logPath = `${root}/CHANGELOG.md`
  const packagePath = `${root}/package.json`
  let logs = {}
  const changelogs = []
  let currentVersion
  const ver = JSON.parse(fs.readFileSync(packagePath))

  try {
    if (fs.existsSync(logPath)) {
      logs = fs.readFileSync(logPath, 'utf8') || ''
      logs = logs.split('\n')

      let temp = {}
      let lastLine = {}
      lodash.forEach(logs, (line) => {
        if (versionCount <= -1) {
          return false
        }
        const versionRet = /^#\s*([0-9a-zA-Z\\.~\s]+?)\s*$/.exec(line)
        if (versionRet && versionRet[1]) {
          const v = versionRet[1].trim()
          if (!currentVersion) {
            currentVersion = v || ver.version
          } else {
            changelogs.push(temp)
            if (/0\s*$/.test(v) && versionCount > 0) {
              versionCount = 0
            } else {
              versionCount--
            }
          }

          temp = {
            version: v,
            logs: []
          }
        } else {
          if (!line.trim()) {
            return
          }
          if (/^\*/.test(line)) {
            lastLine = {
              title: getLine(line),
              logs: []
            }
            temp.logs.push(lastLine)
          } else if (/^\s{2,}\*/.test(line)) {
            lastLine.logs.push(getLine(line))
          }
        }
      })

      if (Object.keys(temp).length > 0) {
        changelogs.push(temp)
      }
    }
  } catch (e) {
    // do nth
  }
  return { changelogs, currentVersion }
}
const pluginPath = join(__dirname, '..', '..').replace(/\\/g, '/')

const pluginName = basename(pluginPath)

/**
 * @type {'Karin'|'Miao-Yunzai'|'Trss-Yunzai'|'yunzai'}
 */
const BotName = (() => {
  if (/^karin/i.test(pluginName)) {
    return 'Karin'
  } else if (packageJson.name === 'yunzai-next') {
    return 'yunzai'
  } else if (Array.isArray(global.Bot?.uin)) {
    return 'TRSS-Yunzai'
  } else if (packageJson.dependencies.sequelize) {
    return 'Miao-Yunzai'
  } else {
    throw new Error('还有人玩Yunzai-Bot??')
  }
})()

const BotVersion = async () => {
  if (BotName === 'Karin') {
    const { Cfg } = await import('node-karin')
    return Cfg.package.version
  } else {
    return packageJson.version
  }
}

const { changelogs, currentVersion } = readLogFile(pluginPath)

const clientPath = process.cwd()

async function checkCommitIdAndUpdateStatus () {
  const git = simpleGit({ baseDir: pluginPath })
  let result = {
    currentCommitId: null,
    remoteCommitId: null,
    latest: false,
    error: null,
    commitLog: null
  }

  try {
    // 尝试获取当前commit ID的短版本
    const stdout = execSync(`git -C "${pluginPath}" rev-parse --short=6 HEAD`).toString().trim()
    result.currentCommitId = stdout

    // 执行git fetch
    await git.fetch()

    // 获取远程commit ID的短版本
    const remoteCommitId = (await git.revparse([ 'HEAD@{u}' ])).substring(0, 7)
    result.remoteCommitId = remoteCommitId

    // 比较本地和远程commit ID
    if (result.currentCommitId === result.remoteCommitId) {
      result.latest = true
      const log = await git.log({ from: result.currentCommitId, to: result.currentCommitId })
      if (log && log.all && log.all.length > 0) {
        result.commitLog = log.all[0].message
      }
    }
  } catch (error) {
    console.error(`检查更新状态失败: ${error.message}`)
    result.error = '检查更新状态失败'
  }

  return result
}

export default {
  /**
   * @type {string} 插件版本号
   */
  get version () {
    return JSON.parse(fs.readFileSync(`${pluginPath}/package.json`, 'utf8')).version
  },

  /**
   * @type {string} 插件更新日志
   */
  get changelogs () {
    return changelogs
  },

  /**
   * @type {string} 匹配更新日志函数
   */
  readLogFile,

  /**
   * @type {string} 插件名称
   */
  pluginName,

  /**
   * @type {string} 插件路径
   */
  pluginPath,

  /**
   * @type {'Karin'|'Miao-Yunzai'|'TRSS-Yunzai'|'yunzai'} Bot名称
   */
  BotName,

  /**
   * @type {string} Bot版本
   */
  BotVersion,

  /**
   * @type {string} 机器人程序/客户端路径
   */
  clientPath,
  checkCommitIdAndUpdateStatus
}
