import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CodePath = dirname(fileURLToPath(import.meta.url))
export const PluginPath = dirname(CodePath)
export const AppsPath = join(CodePath, 'apps')
export const ResourcePath = join(PluginPath, 'resources')
export const DefaultConfigPath = join(PluginPath, 'config', 'default_config')
export const UserConfigPath = join(PluginPath, 'config', 'config')
export const DataPath = join(PluginPath, 'data')
export const ClientPath = process.cwd()
