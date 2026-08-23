import fs from 'node:fs'
import { basename, join } from 'node:path'
import { ClientPath, PluginPath } from '@/dir'

interface PackageMetadata {
  version: string
}

const hostPackageJson = readPackageMetadata(join(ClientPath, 'package.json'))

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
const clientPath = ClientPath

export default {
  get version (): string {
    return readPackageMetadata(`${pluginPath}/package.json`).version
  },
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
