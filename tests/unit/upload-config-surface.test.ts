/**
 * `upload` 配置面的四方对齐测试。
 *
 * 一个 upload 配置键要真正可用，得同时出现在四个地方：
 *
 * 1. `config/default_config/upload.yaml` —— 用户拿到的默认值；
 * 2. `UploadConfig`（`src/types/config.ts`）—— 读取侧的类型；
 * 3. `APP_UPLOAD_KEYS`（`src/module/utils/Config.ts`）—— 老版本把这些键写在 `app`
 *    段里，写入时要被分流回 upload.yaml；
 * 4. 锅巴面板的 `upload.*` 表单项 —— 没有这一条，用户只能手改 yaml。
 *
 * 少任何一处都不会报错，只会静默失效，而且四处分散在四个文件里，靠 review 盯不住。
 * 之前 `downloadConcurrency` 就是这么漏过一轮的：yaml 和类型都有，面板上没有。
 *
 * 另外冻结「面板的 min/max 必须等于运行时真正的夹取区间」：面板允许填、运行时
 * 又悄悄夹掉的值，是最难查的一类配置故障——用户看到的和生效的不是一回事。
 */
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import YAML from 'yaml'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { upload as uploadSchemas } from '../../src/module/guoba/schemas/upload.js'
import {
  MAX_DOWNLOAD_CONCURRENCY,
  MIN_DOWNLOAD_CONCURRENCY
} from '../../src/module/utils/Network/DownloadBudget.js'
import {
  DEFAULT_SLOW_FLOOR_BYTES,
  DEFAULT_SUSTAIN_MS,
  SAMPLE_INTERVAL_MS
} from '../../src/module/utils/Network/DownloadWatchdog.js'
import { MULTIPART_MIN_SIZE } from '../../src/module/utils/Network/MultipartDownloader.js'
import { Cfg } from '../../src/module/utils/Config.js'
import type { UploadConfig } from '../../src/types/config.js'

/**
 * `UploadConfig` 的键清单。
 *
 * `satisfies` 是这里的全部意义：接口里加了键而这里没加，TS 报缺字段；这里写了
 * 接口里没有的键，TS 报多字段。于是下面那条 yaml 对比就同时管住了类型这一侧，
 * 不需要在运行时反射类型（TS 类型在运行时不存在，反射不出来）。
 */
const UPLOAD_CONFIG_KEYS = {
  sendbase64: null,
  videoSendMode: null,
  usefilelimit: null,
  filelimit: null,
  compress: null,
  compresstrigger: null,
  compressvalue: null,
  usegroupfile: null,
  groupfilevalue: null,
  imageSendMode: null,
  downloadMultiThread: null,
  downloadConcurrency: null,
  downloadThrottle: null,
  downloadMaxSpeed: null,
  downloadAutoReduce: null,
  downloadMinSpeed: null,
  downloadSlowRestart: null,
  downloadSlowFloor: null,
  downloadSlowSustain: null,
  downloadExternalTool: null,
  downloadExternalMinSize: null
} satisfies Record<keyof UploadConfig, null>

/**
 * 允许「没有面板表单项」的 yaml 键。
 *
 * 现在是空的：upload.yaml 的 21 个键在面板上都有对应表单项。留着这个常量是为了
 * 让将来真有一个纯内部键时，有地方写下「为什么它不该出现在面板上」，而不是把
 * 下面的断言改松。
 */
const KEYS_WITHOUT_PANEL_ROW: readonly string[] = []

/** 说明文案的最短长度（字符）。低于这个长度的文案基本都只是把 label 重复一遍。 */
const MIN_HELP_LENGTH = 30

/**
 * 在「文案要讲清楚什么时候改、改错了会怎样」这条约定之前就写好的表单项。
 *
 * 列成清单而不是把门槛调低：门槛一低，新键也能糊一句话过关。这些老键的文案该补，
 * 但补文案不属于任何一次功能改动的范围，所以先在这里记为已知欠账。补完之后
 * 上面那条测试会要求把对应的键从清单里删掉，清单只会缩短，不会悄悄变长。
 */
const TERSE_LEGACY_HELP: readonly string[] = [
  'sendbase64',
  'videoSendMode',
  'usefilelimit',
  'compress',
  'downloadMultiThread',
  'downloadAutoReduce',
  'downloadMinSpeed'
]

const MB = 1024 * 1024
const temporaryDirectories: string[] = []

const readDefaultUploadConfig = async (): Promise<Record<string, unknown>> =>
  YAML.parse(
    await readFile(join(process.cwd(), 'config', 'default_config', 'upload.yaml'), 'utf8')
  ) as Record<string, unknown>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** 面板上 `upload.` 打头的表单项，按去掉前缀后的键索引。 */
const panelRowByKey = new Map(
  uploadSchemas
    .filter(schema => typeof schema.field === 'string' && schema.field.startsWith('upload.'))
    .map(schema => [String(schema.field).slice('upload.'.length), schema])
)

const componentPropsOf = (key: string): Record<string, unknown> => {
  const row = panelRowByKey.get(key)
  return isRecord(row?.componentProps) ? row.componentProps : {}
}

beforeEach(() => {
  // Cfg 走 YamlReader，解析失败时会调 logger.error。vitest 并行跑时另一个 worker
  // 可能正在写同一个 yaml，没有这个替身就会炸成 `logger is not defined`，
  // 把一次配置读写竞争伪装成本文件的断言失败。
  globalThis.logger = {
    warn: vi.fn(),
    error: vi.fn(),
    mark: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  } as never
})

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(
    temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))
  )
})

/**
 * 拿真实的 default_config 造一个临时插件根。
 *
 * 刻意不调 `initCfg()`：那会装 chokidar 监听器，而本文件只用到 `ModifyPro`
 * → `writeModuleConfig`，后者只要求目标文件存在。少一个监听器就少一份清理负担。
 */
const createRealConfigRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'kkkkkk-upload-surface-'))
  temporaryDirectories.push(root)
  const source = join(process.cwd(), 'config', 'default_config')
  await cp(source, join(root, 'config', 'default_config'), { recursive: true })
  await cp(source, join(root, 'config', 'config'), { recursive: true })
  return root
}

describe('upload config surface', () => {
  it('declares every default_config key in the UploadConfig type', async () => {
    const config = await readDefaultUploadConfig()

    expect(Object.keys(config).sort()).toEqual(Object.keys(UPLOAD_CONFIG_KEYS).sort())
  })

  it('gives every default_config key a guoba panel row', async () => {
    const config = await readDefaultUploadConfig()
    const expected = Object.keys(config)
      .filter(key => !KEYS_WITHOUT_PANEL_ROW.includes(key))
      .sort()

    expect([...panelRowByKey.keys()].sort()).toEqual(expected)
  })

  it('gives every panel row a substantive Chinese help message', () => {
    // 说明文案是面板上唯一能解释「什么时候该改、改错了会怎样」的地方。30 字不是
    // 美学要求：短于这个长度的文案基本都只是把 label 换个说法重复一遍，用户照样
    // 不知道该填什么。新增键必须过这条线；上面那批老键在这条约定之前就写好了，
    // 逐条列进 TERSE_LEGACY_HELP，这样它们不会拖低门槛，而重写文案时清单会自己缩短。
    const short: string[] = []
    for (const [key, row] of panelRowByKey) {
      if (TERSE_LEGACY_HELP.includes(key)) continue
      const help = row.bottomHelpMessage ?? ''
      if (help.length <= MIN_HELP_LENGTH) short.push(`${key}(${String(help.length)})`)
    }
    expect(short).toEqual([])
  })

  it('keeps the terse-legacy list from outliving the rows it excuses', () => {
    // 允许清单本身也要被盯着：文案重写之后忘记从清单里删，下一个人就会以为
    // 这一条仍然是「已知欠账」，于是照着它再写一条短文案。
    const stillTerse = TERSE_LEGACY_HELP.filter(key => {
      const help = panelRowByKey.get(key)?.bottomHelpMessage ?? ''
      return help.length <= MIN_HELP_LENGTH
    })

    expect(stillTerse).toEqual([...TERSE_LEGACY_HELP])
  })

  it('routes every upload key out of a legacy app-section write', async () => {
    const config = await readDefaultUploadConfig()
    const keys = Object.keys(config)
    // 老版本把这些键写在 app 段里，ModifyPro('app', ...) 要按 APP_UPLOAD_KEYS 把它们
    // 分流回 upload.yaml。漏一个键就会在 app.yaml 里长出一个永远不被读取的野字段。
    const payload: Record<string, unknown> = Object.fromEntries(
      keys.map(key => [key, '__routed__'])
    )
    // videoSendMode 会派生 sendbase64，给个真实值才能顺带验证那条派生还在
    payload.videoSendMode = 'base64'

    const cfg = new Cfg(await createRealConfigRoot())
    expect(cfg.ModifyPro('app', payload)).toBe(true)

    const root = cfg.pluginRoot
    const app = YAML.parse(await readFile(join(root, 'config', 'config', 'app.yaml'), 'utf8'))
    const upload = YAML.parse(await readFile(join(root, 'config', 'config', 'upload.yaml'), 'utf8'))

    for (const key of keys) {
      expect(Object.hasOwn(app as object, key), `app.yaml must not keep ${key}`).toBe(false)
    }
    for (const key of keys) {
      if (key === 'videoSendMode' || key === 'sendbase64') continue
      expect((upload as Record<string, unknown>)[key], key).toBe('__routed__')
    }
    expect((upload as Record<string, unknown>).videoSendMode).toBe('base64')
    expect((upload as Record<string, unknown>).sendbase64).toBe(true)
  })
})

describe('upload panel bounds match the runtime clamps', () => {
  it('bounds the download budget exactly like clampConcurrency', () => {
    expect(componentPropsOf('downloadConcurrency')).toMatchObject({
      min: MIN_DOWNLOAD_CONCURRENCY,
      max: MAX_DOWNLOAD_CONCURRENCY
    })
  })

  it('lets the slow-speed floor reach zero, which is how the guard is disabled', () => {
    // normalizeSlowGuard 用 Math.max(0, ...) 收下界，而 0 是 yaml 写明的「关掉判定」。
    // 下界开到 1 会把这个语义从面板上抹掉。
    expect(componentPropsOf('downloadSlowFloor')).toMatchObject({ min: 0, addonAfter: 'KB/s' })
  })

  it('floors the sustain window at the sampling interval', () => {
    // normalizeSlowGuard 的 Math.max(SAMPLE_INTERVAL_MS, ...) 会把更小的值抬回 2 秒
    expect(componentPropsOf('downloadSlowSustain')).toMatchObject({
      min: SAMPLE_INTERVAL_MS / 1000,
      addonAfter: '秒'
    })
  })

  it('floors the external-tool size gate at the multipart threshold', () => {
    expect(componentPropsOf('downloadExternalMinSize')).toMatchObject({
      min: MULTIPART_MIN_SIZE / MB,
      addonAfter: 'MB'
    })
  })

  it('offers exactly the four external downloader values the type allows', () => {
    const allowed: Array<NonNullable<UploadConfig['downloadExternalTool']>> = ['off', 'auto', 'curl', 'wget']

    expect(panelRowByKey.get('downloadExternalTool')?.component).toBe('RadioGroup')
    expect(componentPropsOf('downloadExternalTool').options).toEqual([
      { label: '关闭', value: 'off' },
      { label: '自动', value: 'auto' },
      { label: 'curl', value: 'curl' },
      { label: 'wget', value: 'wget' }
    ])
    const values = (componentPropsOf('downloadExternalTool').options as Array<{ value: string }>)
      .map(option => option.value)
    expect(values.sort()).toEqual([...allowed].sort())
  })
})

describe('upload defaults agree across yaml, runtime constants, and panel copy', () => {
  it('ships the slow-guard defaults the runtime constants define', async () => {
    const config = await readDefaultUploadConfig()

    expect(config.downloadSlowRestart).toBe(true)
    expect(config.downloadSlowFloor).toBe(DEFAULT_SLOW_FLOOR_BYTES / 1024)
    expect(config.downloadSlowSustain).toBe(DEFAULT_SUSTAIN_MS / 1000)
    expect(config.downloadExternalTool).toBe('off')
    expect(config.downloadExternalMinSize).toBe(64)
  })

  it('quotes the same default figures in the panel help text', async () => {
    const config = await readDefaultUploadConfig()

    // 面板文案和 yaml 注释各写一遍默认值，两边对不上时用户按面板填、按注释理解，
    // 排障时谁都不知道该信哪个。所以把数字本身也冻结起来。
    expect(panelRowByKey.get('downloadSlowFloor')?.bottomHelpMessage)
      .toContain(`${String(config.downloadSlowFloor)}KB/s`)
    expect(panelRowByKey.get('downloadSlowSustain')?.bottomHelpMessage)
      .toContain(`${String(config.downloadSlowSustain)} 秒`)
    expect(panelRowByKey.get('downloadExternalMinSize')?.bottomHelpMessage)
      .toContain(`${String(config.downloadExternalMinSize)}MB`)
  })
})
