import fs from 'node:fs'
import { basename, join } from 'node:path'
import lodash from 'lodash'
import { ClientPath, PluginPath } from '@/dir'

interface ChangeLogLine {
  title: string
  logs: string[]
}

interface ChangeLog {
  version: string
  logs: ChangeLogLine[]
}

interface PackageMetadata {
  version: string
}

const hostPackageJson = readPackageMetadata(join(ClientPath, 'package.json'))

const getLine = (line: string): string => {
  line = line.replace(/(^\s*\*|\r)/g, '')
  line = line.replace(/\s*`([^`]+)`/g, '<span class="cmd">$1')
  line = line.replace(/`\s*/g, '</span>')
  line = line.replace(/\s*\*\*([^\\*]+\*\*)/g, '<span class="strong">$1')
  line = line.replace(/\*\*\s*/g, '</span>')
  line = line.replace(/ⁿᵉʷ/g, '<span class="new"></span>')
  return line
}

const readLogFile = (root: string, versionCount = 4): {
  changelogs: ChangeLog[]
  currentVersion: string | undefined
} => {
  const logPath = `${root}/CHANGELOG.md`
  const packagePath = `${root}/package.json`
  let logs: string[] = []
  const changelogs: ChangeLog[] = []
  let currentVersion: string | undefined
  const ver = readPackageMetadata(packagePath)

  try {
    if (fs.existsSync(logPath)) {
      const logContent = fs.readFileSync(logPath, 'utf8') || ''
      logs = logContent.split('\n')

      let temp: ChangeLog | undefined
      let lastLine: ChangeLogLine | undefined
      lodash.forEach(logs, (line: string) => {
        if (versionCount <= -1) return
        const versionRet = /^#\s*([0-9a-zA-Z.~\s]+?)\s*$/.exec(line)
        if (versionRet?.[1]) {
          const version = versionRet[1].trim()
          if (!currentVersion) {
            currentVersion = version || ver.version
          } else {
            if (temp) changelogs.push(temp)
            if (/0\s*$/.test(version) && versionCount > 0) versionCount = 0
            else versionCount--
          }
          temp = { version, logs: [] }
          lastLine = undefined
        } else if (line.trim()) {
          if (/^\*/.test(line)) {
            lastLine = { title: getLine(line), logs: [] }
            temp?.logs.push(lastLine)
          } else if (/^\s{2,}\*/.test(line)) {
            lastLine?.logs.push(getLine(line))
          }
        }
      })
      if (temp) changelogs.push(temp)
    }
  } catch {
    // do nth
  }
  return { changelogs, currentVersion }
}

const pluginPath = PluginPath.replace(/\\/g, '/')
const pluginName = basename(pluginPath)

const getBotName = (): 'Miao-Yunzai' | 'TRSS-Yunzai' => {
  try {
    const globalWithBot = globalThis as typeof globalThis & { Bot?: { uin?: unknown } }
    if (Array.isArray(globalWithBot.Bot?.uin)) return 'TRSS-Yunzai'
  } catch { }
  return 'Miao-Yunzai'
}

const BotVersion = hostPackageJson.version
const { changelogs } = readLogFile(pluginPath)
const clientPath = ClientPath

export default {
  get version (): string {
    return readPackageMetadata(`${pluginPath}/package.json`).version
  },
  get changelogs (): ChangeLog[] {
    return changelogs
  },
  readLogFile,
  pluginName,
  pluginPath,
  get BotName (): 'Miao-Yunzai' | 'TRSS-Yunzai' {
    return getBotName()
  },
  BotVersion,
  clientPath
}

function readPackageMetadata (file: string): PackageMetadata {
  const value: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!isRecord(value) || typeof value.version !== 'string') {
    throw new TypeError(`package.json version is invalid: ${file}`)
  }
  return { version: value.version }
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
