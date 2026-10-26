import { AsyncLocalStorage } from 'node:async_hooks'
import { mkdir } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { ClientPath } from '@/dir'
import Config from '@/module/utils/Config'
import { warnCacheCleanupFailure } from './cleanup.js'
import { CacheManager, type CachePolicy } from './workspace.js'

const HOUR = 60 * 60 * 1000
const MB = 1024 * 1024
const bounded = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= min ? Math.min(max, parsed) : fallback
}

export const getCachePolicy = (): Partial<CachePolicy> => {
  const config = Config.app?.cache
  return {
    orphanTtlMs: bounded(config?.orphanHours, 24, 1, 720) * HOUR,
    legacyTtlMs: bounded(config?.legacyHours, 168, 1, 2160) * HOUR,
    mediaTtlMs: bounded(config?.mediaMinutes, 10, 1, 1440) * 60 * 1000,
    debugTtlMs: bounded(config?.debugHours, 24, 1, 168) * HOUR,
    maxFiles: Math.trunc(bounded(config?.maxFiles, 1000, 10, 100000)),
    maxBytes: bounded(config?.maxSizeMB, 256, 16, 10240) * MB,
    debugMaxFiles: Math.trunc(bounded(config?.debugMaxFiles, 50, 1, 1000)),
    debugMaxBytes: bounded(config?.debugMaxSizeMB, 64, 1, 1024) * MB
  }
}

let manager: CacheManager | undefined
const getManager = (): CacheManager => {
  manager ??= new CacheManager({
    htmlRoot: join(ClientPath, 'temp', 'html'),
    // 只扫描新建的专用工作区；传统 kkkdownload 中可能含 removeCache=false 的用户存档。
    mediaRoot: join(ClientPath, 'temp', 'kkkkkk-10086', '.cache'),
    policy: getCachePolicy(),
    onWarning: code => warnCacheCleanupFailure({ code })
  })
  return manager
}

export const createRenderCacheWorkspace = async () =>
  await getManager().createWorkspace(process.env.KKK_TEMPLATE_CAPTURE === '1' ? 'debug' : 'render')

type Workspace = Awaited<ReturnType<CacheManager['createWorkspace']>>
interface MediaScope {
  workspace: Workspace
  directories: { images: string, video: string }
  consumers: number
}
const mediaScopes = new AsyncLocalStorage<MediaScope>()

/** 作用域属于真实工作 Promise，外部 guard 超时不会结束仍在工作的消费者。 */
export const withMediaCacheScope = async <T> (consume: () => Promise<T>): Promise<T> => {
  let scope = mediaScopes.getStore()
  if (scope?.consumers === 0) scope = undefined
  if (!scope) {
    // 明确关闭删除时沿用原来的标题存档路径，不把存档迁入自动清扫区。
    if (Config.app?.removeCache !== true) return await consume()
    const workspace = await getManager().createWorkspace('media')
    const directories = {
      images: join(workspace.path, 'images') + sep,
      video: join(workspace.path, 'video') + sep
    }
    try {
      await Promise.all(Object.values(directories).map(path => mkdir(path)))
    } catch (error) {
      await workspace.release(0).catch(warnCacheCleanupFailure)
      throw error
    }
    scope = { workspace, directories, consumers: 0 }
  }
  const current = scope
  current.consumers += 1
  try {
    return await mediaScopes.run(current, consume)
  } finally {
    current.consumers -= 1
    if (current.consumers === 0) await current.workspace.release().catch(warnCacheCleanupFailure)
  }
}

export const getMediaCacheDirectories = (): MediaScope['directories'] | undefined =>
  (mediaScopes.getStore()?.consumers ?? 0) > 0 ? mediaScopes.getStore()?.directories : undefined

export const isManagedMediaFile = (path: string): boolean => getManager().isManaged(path)

export const retainMediaCacheFile = async (path: string): Promise<() => Promise<void>> =>
  await getManager().retainFile(path)

export const sweepPluginCache = async () => await getManager().sweep()

let stopMaintenance: (() => void) | undefined
/** 启动及周期清扫不阻塞插件加载，定时器不会阻止进程正常退出。 */
export const startCacheMaintenance = (): (() => void) => {
  if (stopMaintenance) return stopMaintenance
  let running = false
  let stopped = false
  let continuation: ReturnType<typeof setTimeout> | undefined
  const sweep = (): void => {
    if (running || stopped) return
    running = true
    sweepPluginCache().then(summary => {
      if (summary.deleted || summary.failed) {
        globalThis.logger?.info?.(`[缓存清理] 删除 ${summary.deleted} 项，释放 ${summary.bytes} 字节，失败 ${summary.failed} 项`)
      }
      // 有积压时分轮让出事件循环，再继续有限量工作，不等下一个半小时。
      if (!stopped && summary.failed === 0 && summary.more) {
        continuation = setTimeout(sweep, 1000)
        continuation.unref()
      }
    }).catch(warnCacheCleanupFailure).finally(() => { running = false })
  }
  const startup = setTimeout(sweep, 1000)
  const interval = setInterval(sweep, bounded(Config.app?.cache?.sweepMinutes, 30, 1, 1440) * 60 * 1000)
  startup.unref()
  interval.unref()
  stopMaintenance = () => {
    stopped = true
    clearTimeout(startup)
    clearTimeout(continuation)
    clearInterval(interval)
    stopMaintenance = undefined
    const closing = manager
    manager = undefined
    closing?.close().catch(warnCacheCleanupFailure)
  }
  return stopMaintenance
}
