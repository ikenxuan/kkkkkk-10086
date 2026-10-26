import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AsyncResource } from 'node:async_hooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  app: { removeCache: true, cache: {} as Record<string, unknown> },
  create: vi.fn(), release: vi.fn(), sweep: vi.fn(), close: vi.fn(),
  roots: [] as string[]
}))
vi.mock('../../src/module/utils/Config.js', () => ({ default: { app: state.app } }))
vi.mock('../../src/module/utils/cache/workspace.js', () => ({
  CacheManager: class {
    createWorkspace = state.create
    sweep = state.sweep
    close = state.close
  }
}))

import { getCachePolicy, getMediaCacheDirectories, startCacheMaintenance, withMediaCacheScope } from '../../src/module/utils/cache/runtime.js'

let stop: (() => void) | undefined
beforeEach(() => {
  vi.clearAllMocks()
  state.app.removeCache = true
  state.app.cache = {}
  state.create.mockImplementation(async () => {
    const path = mkdtempSync(join(tmpdir(), 'kkkkkk-media-scope-'))
    state.roots.push(path)
    return { path, cleanup: vi.fn(), release: state.release }
  })
  state.release.mockResolvedValue(undefined)
  state.sweep.mockResolvedValue({ scanned: 0, deleted: 0, bytes: 0, failed: 0 })
  state.close.mockResolvedValue(undefined)
  vi.stubGlobal('logger', { warn: vi.fn(), info: vi.fn() })
})
afterEach(() => {
  stop?.()
  stop = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
  for (const root of state.roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('media cache scopes', () => {
  it('does not relocate removeCache=false archives', async () => {
    state.app.removeCache = false
    await withMediaCacheScope(async () => {
      expect(getMediaCacheDirectories()).toBeUndefined()
    })
    expect(state.create).not.toHaveBeenCalled()
    expect(state.release).not.toHaveBeenCalled()
  })

  it('shares one workspace for nested consumers and releases after the last actual promise', async () => {
    let finish!: () => void
    let late: Promise<void> | undefined
    let outerPath: string | undefined
    await withMediaCacheScope(async () => {
      outerPath = getMediaCacheDirectories()?.video
      late = withMediaCacheScope(async () => {
        expect(getMediaCacheDirectories()?.video).toBe(outerPath)
        await new Promise<void>(resolve => { finish = resolve })
      })
    })
    // 上层已经超时/返回，后台任务实际仍未结束。
    expect(state.release).not.toHaveBeenCalled()
    expect(getMediaCacheDirectories()).toBeUndefined()
    finish()
    await late
    expect(state.create).toHaveBeenCalledTimes(1)
    expect(state.release).toHaveBeenCalledTimes(1)
  })

  it('isolates simultaneous parse workspaces', async () => {
    const paths = await Promise.all([1, 2].map(async () => await withMediaCacheScope(async () => getMediaCacheDirectories()?.video)))
    expect(paths[0]).not.toBe(paths[1])
    expect(state.release).toHaveBeenCalledTimes(2)
  })

  it('allocates a new lease for a delayed callback inherited from a completed scope', async () => {
    let later!: () => Promise<string | undefined>
    let first: string | undefined
    await withMediaCacheScope(async () => {
      first = getMediaCacheDirectories()?.video
      later = AsyncResource.bind(async () => await withMediaCacheScope(async () => getMediaCacheDirectories()?.video))
    })
    expect(state.release).toHaveBeenCalledTimes(1)
    expect(await later()).not.toBe(first)
    expect(state.create).toHaveBeenCalledTimes(2)
    expect(state.release).toHaveBeenCalledTimes(2)
  })

  it('keeps the business exception when releasing the lease fails', async () => {
    state.release.mockRejectedValue(Object.assign(new Error('secret message and path'), { code: 'EACCES' }))
    const failure = new Error('upload failed')
    await expect(withMediaCacheScope(async () => { throw failure })).rejects.toBe(failure)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('EACCES'))
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain('secret')
  })

  it('clamps invalid policy values and provides a media reuse window', () => {
    state.app.cache = { mediaMinutes: -5, maxSizeMB: Infinity, maxFiles: 1e10, debugHours: 1e10 }
    expect(getCachePolicy()).toMatchObject({
      mediaTtlMs: 600000, maxBytes: 256 * 1024 * 1024, maxFiles: 100000, debugTtlMs: 168 * 3600000
    })
  })
})

describe('asynchronous cache maintenance', () => {
  it('continues a partial scan after yielding and backs off after a cleanup failure', async () => {
    vi.useFakeTimers()
    state.sweep
      .mockResolvedValueOnce({ scanned: 250, deleted: 0, bytes: 0, failed: 0, more: true })
      .mockResolvedValueOnce({ scanned: 20, deleted: 0, bytes: 0, failed: 1, more: true })
    stop = startCacheMaintenance()
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.sweep).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.sweep).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.sweep).toHaveBeenCalledTimes(2)
  })

  it('starts once after bootstrap and does not overlap periodic passes', async () => {
    vi.useFakeTimers()
    let finish!: (value: { scanned: number, deleted: number, bytes: number, failed: number }) => void
    state.sweep.mockReturnValue(new Promise(resolve => { finish = resolve }))
    stop = startCacheMaintenance()
    expect(startCacheMaintenance()).toBe(stop)
    expect(state.sweep).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.sweep).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(30 * 60000)
    expect(state.sweep).toHaveBeenCalledTimes(1)
    finish({ scanned: 3, deleted: 2, bytes: 128, failed: 0 })
    await vi.advanceTimersByTimeAsync(0)
    expect(logger.info).toHaveBeenCalledWith('[缓存清理] 删除 2 项，释放 128 字节，失败 0 项')
    await vi.advanceTimersByTimeAsync(30 * 60000)
    expect(state.sweep).toHaveBeenCalledTimes(2)
    stop()
    stop = undefined
    expect(vi.getTimerCount()).toBe(0)
  })
})
