import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import YAML from 'yaml'
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { Cfg } from '../../src/module/utils/Config.js'
import type {
  PushlistConfig,
  bilibiliPushItem,
  douyinPushItem
} from '../../src/module/utils/Config.js'
import YamlReader from '../../src/module/utils/YamlReader.js'

const fixtureRoot = join(process.cwd(), 'tests', 'fixtures', 'config')
const temporaryDirectories: string[] = []
const configurations: Cfg[] = []
const dbMocks = vi.hoisted(() => ({
  getFilterWords: vi.fn(),
  getFilterTags: vi.fn(),
  getDouyinUser: vi.fn()
}))

vi.mock('../../src/module/db/index.js', () => ({
  getDouyinDB: async () => dbMocks,
  getBilibiliDB: async () => null
}))

async function createConfigRoot (): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'kkkkkk-config-'))
  temporaryDirectories.push(root)
  await cp(fixtureRoot, join(root, 'config'), { recursive: true })
  return root
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.logger = {
    warn: vi.fn(),
    error: vi.fn(),
    mark: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  } as never
})

afterEach(async () => {
  await Promise.all(configurations.splice(0).flatMap(cfg => Object.values(cfg.watcher).map(watcher => watcher.close())))
  vi.restoreAllMocks()
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

function createCfg (root: string): Cfg {
  const cfg = new Cfg(root)
  configurations.push(cfg)
  return cfg
}

describe('YamlReader', () => {
  it('reads, modifies, and removes nested values in a temporary file', async () => {
    const root = await createConfigRoot()
    const file = join(root, 'config', 'config', 'app.yaml')
    const reader = new YamlReader(file)

    expect(reader.get<number>('priority')).toBe(900)
    expect(reader.set('nested.enabled', true)).toBeUndefined()
    expect(new YamlReader(file).get<boolean>('nested.enabled')).toBe(true)
    expect(reader.rm('nested.enabled')).toBe(true)
    expect(new YamlReader(file).get('nested.enabled')).toBeUndefined()
  })

  it('falls back to an empty document and logs invalid YAML', async () => {
    const root = await createConfigRoot()
    const file = join(root, 'invalid.yaml')
    await writeFile(file, 'broken: [yaml\n')

    const reader = new YamlReader(file)

    expect(reader.get('broken')).toBeUndefined()
    expect(logger.error).toHaveBeenCalled()
  })
})

describe('Cfg', () => {
  it('preserves legacy Config module type exports', () => {
    expectTypeOf<PushlistConfig>().toBeObject()
    expectTypeOf<douyinPushItem>().toBeObject()
    expectTypeOf<bilibiliPushItem>().toBeObject()
  })

  it('merges user overrides while preserving old and new keys', async () => {
    const root = await createConfigRoot()
    const cfg = createCfg(root)

    expect(cfg.app.priority).toBe(900)
    expect(cfg.app.videotool).toBe(true)
    expect(cfg.app.videoTool).toBe(false)
    expect(cfg.douyin.douyintool).toBe(true)
    expect(cfg.douyin.switch).toBe(false)
    expect(cfg.douyin.numcomments).toBe(6)
    expect(cfg.douyin.numcomment).toBe(7)
  })

  it('returns an empty object and logs when parsed YAML is not a record', async () => {
    const root = await createConfigRoot()
    await writeFile(join(root, 'config', 'config', 'app.yaml'), '- invalid\n- shape\n')
    const cfg = createCfg(root)

    expect(cfg.getConfig('app')).toEqual({})
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('app.yaml'))
  })

  it('preserves malformed user YAML during initialization', async () => {
    const root = await createConfigRoot()
    const file = join(root, 'config', 'config', 'app.yaml')
    const malformed = 'broken: [yaml\n'
    await writeFile(file, malformed)
    const cfg = createCfg(root)

    cfg.initCfg()

    expect(await readFile(file, 'utf8')).toBe(malformed)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('app.yaml'))
  })

  it('ignores falsey subscription IDs during filter synchronization', async () => {
    const root = await createConfigRoot()
    const cfg = createCfg(root)
    const db = {
      getFilterWords: vi.fn(),
      getFilterTags: vi.fn()
    }

    await cfg.syncFilterConfigToDb([{ switch: true, host_mid: 0 }], db, 'host_mid')

    expect(db.getFilterWords).not.toHaveBeenCalled()
    expect(db.getFilterTags).not.toHaveBeenCalled()
  })

  it('attempts to enrich short-ID-only Douyin push entries', async () => {
    const root = await createConfigRoot()
    const pushlist = join(root, 'config', 'default_config', 'pushlist.yaml')
    await writeFile(pushlist, YAML.stringify({
      douyin: [{ switch: true, short_id: '123456', group_id: ['10000'] }],
      bilibili: null
    }))
    const cfg = createCfg(root)

    await cfg.All()

    expect(dbMocks.getFilterWords).toHaveBeenCalledWith(undefined)
    expect(dbMocks.getFilterTags).toHaveBeenCalledWith(undefined)
    expect(dbMocks.getDouyinUser).toHaveBeenCalledWith(undefined)
  })

  it('modifies nested values and invalidates the cache', async () => {
    const root = await createConfigRoot()
    const cfg = createCfg(root)

    expect(cfg.getConfig('app').priority).toBe(900)
    cfg.modify('app', 'feature.enabled', true)

    expect(cfg.getConfig('app')).toMatchObject({ priority: 900, feature: { enabled: true } })
  })

  it('writes Guoba app fields to app and upload without losing compatibility keys', async () => {
    const root = await createConfigRoot()
    const cfg = createCfg(root)

    expect(cfg.ModifyPro('app', {
      priority: 950,
      videoSendMode: 'base64',
      downloadConcurrency: 6
    })).toBe(true)

    const app = YAML.parse(await readFile(join(root, 'config', 'config', 'app.yaml'), 'utf8'))
    const upload = YAML.parse(await readFile(join(root, 'config', 'config', 'upload.yaml'), 'utf8'))
    expect(app.priority).toBe(950)
    expect(upload.videoSendMode).toBe('base64')
    expect(upload.sendbase64).toBe(true)
    expect(upload.downloadConcurrency).toBe(6)
  })
})
