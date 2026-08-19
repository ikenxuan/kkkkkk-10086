import { readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { AppsPath } from '@/dir'

export type AppModule = Record<string, unknown>
export type PluginConstructor = typeof plugin

export interface LoadAppsResult {
  apps: Record<string, PluginConstructor>
  loadedFiles: string[]
  failedFiles: Array<{ file: string; error: unknown }>
}

function isConstructable (value: unknown): value is PluginConstructor {
  if (typeof value !== 'function' || !value.prototype) return false

  try {
    Reflect.construct(String, [], value)
    return true
  } catch {
    return false
  }
}

function getPluginConstructor (module: AppModule, file: string): PluginConstructor {
  const exports = Object.entries(module)
  const pluginExport = exports[0]
  if (exports.length !== 1 || !pluginExport || pluginExport[0] === 'default' || !isConstructable(pluginExport[1])) {
    throw new Error(`${file} must export exactly one named plugin constructor`)
  }
  return pluginExport[1]
}

export function compareAppFilenames (left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export async function loadAppsFrom (appsDir: string): Promise<LoadAppsResult> {
  const entries = await readdir(appsDir, { withFileTypes: true })
  const files = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
    .map(entry => entry.name)
    .sort(compareAppFilenames)
  const imports = files.map(file => import(pathToFileURL(join(appsDir, file)).href) as Promise<AppModule>)
  const results = await Promise.allSettled(imports)
  const apps: Record<string, PluginConstructor> = {}
  const loadedFiles: string[] = []
  const failedFiles: Array<{ file: string; error: unknown }> = []

  files.forEach((file, index) => {
    const result = results[index]
    if (!result || result.status === 'rejected') {
      failedFiles.push({ file, error: result?.reason ?? new Error(`Missing import result for ${file}`) })
      return
    }

    try {
      Object.defineProperty(apps, basename(file, '.js'), {
        value: getPluginConstructor(result.value, file),
        enumerable: true,
        writable: true,
        configurable: true
      })
      loadedFiles.push(file)
    } catch (error) {
      failedFiles.push({ file, error })
    }
  })

  return { apps, loadedFiles, failedFiles }
}

export async function loadApps (): Promise<LoadAppsResult> {
  return await loadAppsFrom(AppsPath)
}
