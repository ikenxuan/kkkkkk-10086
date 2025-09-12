import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import lodash from 'lodash'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)

const __dirname = dirname(__filename)

const packageJson = JSON.parse(fs.readFileSync(join(process.cwd(), 'package.json'), 'utf8'))

/**
 * @param {string} line
 * @returns {string}
 */
const getLine = function (line) {
  line = line.replace(/(^\s*\*|\r)/g, '')
  line = line.replace(/\s*`([^`]+`)/g, '<span class="cmd">$1')
  line = line.replace(/`\s*/g, '</span>')
  line = line.replace(/\s*\*\*([^\\*]+\*\*)/g, '<span class="strong">$1')
  line = line.replace(/\*\*\s*/g, '</span>')
  line = line.replace(/ⁿᵉʷ/g, '<span class="new"></span>')
  return line
}

/**
 * @param {string} root
 * @param {number} versionCount
 * @returns {{changelogs: any[], currentVersion: string | undefined}}
 */
const readLogFile = function (root, versionCount = 4) {
  const logPath = `${root}/CHANGELOG.md`
  const packagePath = `${root}/package.json`
  /** @type {string[]} */
  let logs = []
  const changelogs = []
  /** @type {string | undefined} */
  let currentVersion
  const ver = JSON.parse(fs.readFileSync(packagePath, 'utf8'))

  try {
    if (fs.existsSync(logPath)) {
      const logContent = fs.readFileSync(logPath, 'utf8') || ''
      logs = logContent.split('\n')

      let temp = /** @type {any} */ ({})
      let lastLine = /** @type {any} */ ({})
      lodash.forEach(logs, (/** @type {string} */ line) => {
        if (versionCount <= -1) {
          return
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
            if (temp.logs) {
              temp.logs.push(lastLine)
            }
          } else if (/^\s{2,}\*/.test(line)) {
            if (lastLine.logs) {
              lastLine.logs.push(getLine(line))
            }
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
 * @returns {'Miao-Yunzai'|'TRSS-Yunzai'}
 */
// cSpell:ignore Miao Yunzai TRSS
const getBotName = () => {
  try {
    const { Bot } = require('./index.js')
    if (Array.isArray(Bot?.uin)) {
      return 'TRSS-Yunzai'
    }
  } catch { }
  return 'Miao-Yunzai'
}

const BotVersion = packageJson.version

const { changelogs, currentVersion } = readLogFile(pluginPath)

const clientPath = process.cwd()

export default {
  /**
   * @type {string} 插件版本号
   */
  get version() {
    return JSON.parse(fs.readFileSync(`${pluginPath}/package.json`, 'utf8')).version
  },

  /**
   * @type {any[]} 插件更新日志
   */
  get changelogs() {
    return changelogs
  },

  /**
   * @type {function} 匹配更新日志函数
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
   * @type {'Miao-Yunzai'|'TRSS-Yunzai'} Bot名称
   */
  get BotName() {
    return getBotName()
  },

  /**
   * @type {string} Bot版本
   */
  BotVersion,

  /**
   * @type {string} 机器人程序/客户端路径
   */
  clientPath
}
