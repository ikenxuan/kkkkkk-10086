import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const settings = vi.hoisted(() => ({ root: '', removeCache: true, now: Date.now() }))
vi.mock('../../src/dir.js', () => ({ get ClientPath () { return settings.root } }))
vi.mock('../../src/module/utils/Config.js', () => ({
  default: {
    get app () { return { removeCache: settings.removeCache, cache: { mediaMinutes: 1 } } },
    upload: {}
  }
}))
vi.mock('../../src/module/utils/Version.js', () => ({
  default: {
    get clientPath () { return settings.root },
    pluginName: 'kkkkkk-10086'
  }
}))
vi.mock('../../src/module/utils/Base.js', () => ({ Base: class {} }))
vi.mock('../../src/module/utils/Network/index.js', () => ({ Networks: class {} }))

const { runMediaTasks } = await import('../../src/module/utils/MediaTasks.js')
const { getMediaCacheDirectories, startCacheMaintenance, sweepPluginCache, withMediaCacheScope } = await import('../../src/module/utils/cache/runtime.js')
let Common: typeof import('../../src/module/utils/Common.js')['default']

beforeAll(async () => {
  settings.root = await mkdtemp(join(tmpdir(), 'kkkkkk-media-scopes-'))
  vi.spyOn(Date, 'now').mockImplementation(() => settings.now)
  Common = (await import('../../src/module/utils/Common.js')).default
  globalThis.logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as typeof logger
})
afterAll(async () => {
  startCacheMaintenance()()
  vi.restoreAllMocks()
  await rm(settings.root, { recursive: true, force: true })
})

describe('media task cache ownership', () => {
  it('keeps a timed out task alive until its actual file consumer finishes', async () => {
    let unblock!: () => void
    let started!: () => void
    const ready = new Promise<void>(resolve => { started = resolve })
    const gate = new Promise<void>(resolve => { unblock = resolve })
    let file = ''
    const execution = runMediaTasks({
      video: async () => {
        file = join(Common.tempDri.video, 'in-use.mp4')
        await writeFile(file, 'still in use')
        started()
        await gate
        expect(await readFile(file, 'utf8')).toBe('still in use')
      }
    }, { timeoutMs: 100 })
    const failure = expect(execution).rejects.toBeInstanceOf(AggregateError)
    await ready
    await failure
    settings.now += 24 * 60 * 60 * 1000
    await sweepPluginCache()
    expect(existsSync(file)).toBe(true)
    unblock()
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(existsSync(file)).toBe(true)
  })

  it('defers removal while a nested consumer is using the same workspace', async () => {
    let unblock!: () => void
    let nested!: Promise<void>
    let file = ''
    const gate = new Promise<void>(resolve => { unblock = resolve })
    await withMediaCacheScope(async () => {
      file = join(Common.tempDri.video, 'shared.mp4')
      await writeFile(file, 'shared source')
      nested = withMediaCacheScope(async () => {
        await gate
        expect(await readFile(file, 'utf8')).toBe('shared source')
      })
      expect(await Common.removeFile(file, true)).toBe(true)
      expect(existsSync(file)).toBe(true)
    })
    settings.now += 24 * 60 * 60 * 1000
    await sweepPluginCache()
    expect(existsSync(file)).toBe(true)
    unblock()
    await nested
    settings.now += 61_000
    await sweepPluginCache()
    expect(existsSync(file)).toBe(false)
  })

  it('preserves the original archive directory when cache removal is disabled', async () => {
    settings.removeCache = false
    try {
      await withMediaCacheScope(async () => {
        expect(getMediaCacheDirectories()).toBeUndefined()
        const directory = join(settings.root, 'temp', 'kkkkkk-10086', 'kkkdownload', 'video')
        expect(Common.tempDri.video).toBe(directory + (process.platform === 'win32' ? '\\' : '/'))
        await Common.mkdir(directory)
        const file = join(directory, 'saved.mp4')
        await writeFile(file, 'user archive')
        await Common.removeFile(file)
        settings.now += 8 * 24 * 60 * 60 * 1000
        await sweepPluginCache()
        expect(await readFile(file, 'utf8')).toBe('user archive')
      })
    } finally {
      settings.removeCache = true
    }
  })
})
