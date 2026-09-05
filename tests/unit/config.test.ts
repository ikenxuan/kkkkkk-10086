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
import { getDegradedConfigSnapshot, resetConfigHealth } from '../../src/module/utils/configHealth.js'

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
  // 登记表是模块级的，本文件有好几个用例故意写坏 yaml，不清就会串到别人的断言里
  resetConfigHealth()
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
    // set 与同类的 rm 一个约定：返回「到底写进磁盘了没有」
    expect(reader.set('nested.enabled', true)).toBe(true)
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

  // Cookie 一律收敛成字符串，「没配置」在插件内部只有空串这一种表示。
  // 下游 amagi 对 cookie 只有两种处理，两者都只认字符串：
  // `cookie?.trim()` 拼请求头（`?.` 挡不住 number，传数字直接 TypeError），
  // 以及 `cookie === ''` 判未登录（传 null 时这个判断不成立，它会按已登录去要 dash 流）。
  describe('cookies 归一化', () => {
    /** 直接写一份 cookies.yaml，绕开 fixture（fixture 里本来没有这个文件） */
    async function cfgWithCookies (yaml: string): Promise<Cfg> {
      const root = await createConfigRoot()
      await writeFile(join(root, 'config', 'config', 'cookies.yaml'), yaml)
      await writeFile(join(root, 'config', 'default_config', 'cookies.yaml'), 'douyin:\nbilibili:\nkuaishou:\nxiaohongshu:\n')
      return createCfg(root)
    }

    it('把误填的数字转成字符串，而不是让它崩在 amagi 的 cookie.trim() 上', async () => {
      // `xiaohongshu: 114514` 是 YAML 的 number。归一化只负责「让它是个字符串」，
      // 不替 amagi 判有效性——小红书那边本就不强鉴权，这串数字照样发得出请求。
      const cfg = await cfgWithCookies('xiaohongshu: 114514\n')

      expect(cfg.cookies.xiaohongshu).toBe('114514')
      expect(() => cfg.cookies.xiaohongshu.trim()).not.toThrow()
    })

    it('留空的 ck 读出来是空串而不是 null', async () => {
      // `bilibili:` 解析成 null。amagi 的 qtparam 判的是 `cookie === ''`，
      // 传 null 会让它按「已登录」去请求，回来只有 dash 没有 durl。
      const cfg = await cfgWithCookies('bilibili:\n')

      expect(cfg.cookies.bilibili).toBe('')
      expect(cfg.cookies.bilibili).not.toBeNull()
    })

    it('整份文件缺失时四个平台都是空串', async () => {
      const root = await createConfigRoot()
      const cfg = createCfg(root)

      expect(cfg.cookies).toEqual({ bilibili: '', douyin: '', kuaishou: '', xiaohongshu: '' })
    })

    it('去掉首尾空白，纯空白视为没配置', async () => {
      // '   ' 是真值，会骗过所有 `|| ''` 和 `if (!ck)` 守卫，
      // 然后让 amagi 按已登录去请求 —— 表现和填了失效 ck 一样。
      const cfg = await cfgWithCookies('douyin: "  SESSDATA=abc  "\nkuaishou: "   "\n')

      expect(cfg.cookies.douyin).toBe('SESSDATA=abc')
      expect(cfg.cookies.kuaishou).toBe('')
    })

    it('true / 对象这类不可能是 ck 的值按没配置处理', async () => {
      const cfg = await cfgWithCookies('bilibili: true\nxiaohongshu:\n  nested: value\n')

      expect(cfg.cookies.bilibili).toBe('')
      expect(cfg.cookies.xiaohongshu).toBe('')
    })

    it('有效 cookie 一个字符都不改', async () => {
      // 真 ck 里有分号、等号、逗号、URL 编码，归一化不能碰它们
      const raw = 'SESSDATA=abc%2Cdef; bili_jct=xyz123; DedeUserID=456'
      const cfg = await cfgWithCookies(`bilibili: "${raw}"\n`)

      expect(cfg.cookies.bilibili).toBe(raw)
    })
  })

  it('returns an empty object and logs when parsed YAML is not a record', async () => {
    const root = await createConfigRoot()
    await writeFile(join(root, 'config', 'config', 'app.yaml'), '- invalid\n- shape\n')
    const cfg = createCfg(root)

    expect(cfg.getConfig('app')).toEqual({})
    // error 而不是 warn：解析失败返回的 `{}` 会被写进缓存并一直命中，
    // 该文件的配置就整份退回默认值（cookies.yaml 写错一处 = 四个 ck 全没了），
    // 后果比 warn 应有的分量重，日志级别要对得上
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('app.yaml'), expect.anything())
  })

  it('preserves malformed user YAML during initialization', async () => {
    const root = await createConfigRoot()
    const file = join(root, 'config', 'config', 'app.yaml')
    const malformed = 'broken: [yaml\n'
    await writeFile(file, malformed)
    const cfg = createCfg(root)

    cfg.initCfg()

    expect(await readFile(file, 'utf8')).toBe(malformed)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('app.yaml'), expect.anything())
  })

  /*
    坏掉的文件既不会被自动修好（覆盖等于清空用户配置），也不会再被提醒第二次 ——
    上面那两个用例钉的就是「不改文件」和「只有一行日志」。所以那一行日志必须有个
    补救出口：登记进健康快照，由 `#kkk版本` 的诊断卡列出来。
  */
  describe('解析失败要登记给诊断卡', () => {
    it('登记文件名和所在目录，诊断卡据此告警', async () => {
      const root = await createConfigRoot()
      await writeFile(join(root, 'config', 'config', 'app.yaml'), 'broken: [yaml\n')
      const cfg = createCfg(root)

      cfg.getConfig('app')

      expect(getDegradedConfigSnapshot().map(entry => ({ file: entry.file, directory: entry.directory })))
        .toEqual([{ file: 'app.yaml', directory: 'config' }])
    })

    it('改好之后重新解析会把登记摘掉，诊断卡不再挂着修好的告警', async () => {
      const root = await createConfigRoot()
      const file = join(root, 'config', 'config', 'app.yaml')
      await writeFile(file, 'broken: [yaml\n')
      createCfg(root).getConfig('app')
      expect(getDegradedConfigSnapshot()).toHaveLength(1)

      await writeFile(file, 'sendforwardmsg: true\n')
      createCfg(root).getConfig('app')

      expect(getDegradedConfigSnapshot()).toEqual([])
    })

    it('全都能解析时快照是空的，正常那张卡不会凭空多出告警', async () => {
      const root = await createConfigRoot()
      const cfg = createCfg(root)

      cfg.initCfg()

      expect(getDegradedConfigSnapshot()).toEqual([])
    })
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
