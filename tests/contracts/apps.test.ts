/**
 * Yunzai app 契约测试。
 *
 * 迁移期间 app 的「对外表现」必须逐字段冻结：Yunzai 通过文件名注册 app，
 * 通过 `name` / `event` / `priority` 排序调度，通过 `rule[].reg` 匹配消息，
 * 通过 `rule[].fnc` 派发，通过 `rule[].permission` 鉴权，通过 `task[]` 注册定时任务。
 * 任何一项漂移都是用户可见的行为变更。
 *
 * 这里在运行时实例化 7 个 app（而不是静态分析源码），因为 `tools` 的规则来自
 * `...generateRules()` 展开、`push` / `admin` 的 task 在 `super()` 之后由
 * `this.task = ...` 赋值——只有真正执行构造函数才能看到最终形态。
 *
 * 更新基线：`UPDATE_APP_CONTRACT=1 pnpm vitest run tests/contracts/apps.test.ts`
 * （仅在有意变更行为时使用，且必须在 review 中说明原因）
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

import { getPluginConstructor } from '../../src/module/loader/index.js'

const FIXTURE = fileURLToPath(new URL('../fixtures/baseline/app-contract.json', import.meta.url))

/**
 * 确定性的 Config 替身：所有平台与推送全部开启，从而让每一条「条件规则」
 * 和每一个「条件 task」都实例化出来——契约覆盖面最大的那一种配置。
 * `defaulttool: false` 让 `priority` 落在数值分支而非 `-Infinity`。
 */
const config = vi.hoisted(() => ({
  app: {
    removeCache: true,
    videotool: true,
    videoTool: true,
    defaulttool: false,
    priority: 500,
    sendforwardmsg: true,
    Theme: false,
    renderScale: 100,
    APIServer: false,
    APIServerPort: 3000,
    parseTip: true
  },
  douyin: {
    switch: true,
    douyintool: true,
    numcomments: 5,
    push: { switch: true, cron: '0 */5 * * * *', log: true, permission: 'master', parsedynamic: false }
  },
  bilibili: {
    switch: true,
    bilibilitool: true,
    bilibilinumcomments: 5,
    push: { switch: true, cron: '0 */3 * * * *', log: false, permission: 'all', parsedynamic: false }
  },
  kuaishou: { switch: true, kuaishoutool: true, kuaishounumcomments: 5 },
  xiaohongshu: { switch: true },
  upload: {},
  cookies: {},
  pushlist: {}
}))

vi.mock('../../src/module/utils/index.js', () => ({
  Config: config,
  Render: vi.fn(),
  Version: { BotName: 'TRSS-Yunzai', version: 'test', pluginName: 'kkkkkk-10086' },
  Common: { tempDri: { images: '', video: '' } },
  UploadRecord: vi.fn(),
  wrapWithErrorHandler: (fn: unknown) => fn,
  downloadVideo: vi.fn(),
  baseHeaders: {}
}))

vi.mock('../../src/module/utils/Version.js', () => ({
  default: { BotName: 'TRSS-Yunzai', version: 'test', pluginName: 'kkkkkk-10086' }
}))

vi.mock('../../src/module/db/index.js', () => ({
  bilibiliDB: {},
  douyinDB: {},
  getStatisticsDB: vi.fn()
}))

vi.mock('../../src/module/platform/bilibili/index.js', () => ({
  Bilibili: class {},
  Bilibilipush: class {},
  getBilibiliID: vi.fn()
}))
// 两个平台合到一份替身里：amagiClient 是同一个模块，分两次 vi.mock 同一路径
// 后一次会静默盖掉前一次。任何方法都返回 undefined，同旧的 `getXData: vi.fn()`。
vi.mock('../../src/module/utils/amagiClient.js', () => ({
  bilibiliFetcher: new Proxy({}, { get: () => vi.fn() }),
  douyinFetcher: new Proxy({}, { get: () => vi.fn() }),
  douyinGuest: vi.fn(() => undefined),
  buildAmagiRequestConfig: vi.fn(() => ({}))
}))
vi.mock('../../src/module/platform/bilibili/login.js', () => ({ bilibiliLogin: vi.fn() }))

vi.mock('../../src/module/platform/douyin/index.js', () => ({
  DouYin: class {},
  DouYinpush: class {},
  getDouyinID: vi.fn()
}))
// 直播录制流水线只在 rule 命中时才跑，契约测试只实例化 app。挡掉它是因为它的真实
// 依赖链（FFmpeg / Base / bilibili 取流）会绕过上面那个 utils barrel 替身去要真的
// Config，而真的 Config 要读宿主的 lib/config。
vi.mock('../../src/module/platform/common/liveRecord.js', () => ({ recordLiveRoom: vi.fn() }))
vi.mock('../../src/module/platform/douyin/login.js', () => ({ dylogin: vi.fn() }))
vi.mock('../../src/module/platform/douyin/pushPreview.js', () => ({ DouyinPushPreview: class {} }))

vi.mock('../../src/module/platform/kuaishou/index.js', () => ({
  KuaiShou: class {},
  KuaishouData: vi.fn(),
  GetKuaishouID: vi.fn()
}))

vi.mock('../../src/module/platform/xiaohongshu/index.js', () => ({
  Xiaohongshu: class {},
  getXiaohongshuID: vi.fn()
}))

vi.mock('../../src/runtime/host/update.js', () => ({ update: class {} }))

/** Yunzai `plugin` 基类的最小替身：把构造参数原样挂到实例上 */
class PluginDouble {
  constructor (options: Record<string, unknown> = {}) {
    Object.assign(this, options)
  }
}

Object.assign(globalThis, { plugin: PluginDouble as unknown as typeof plugin })
globalThis.logger = {
  debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), mark: vi.fn()
} as unknown as typeof logger

// app 模块在求值时就会读取 `plugin` 与 `Config`，因此必须在替身安装之后再导入。
// 留整个命名空间而不是当场解构：解构会把多出来的导出藏起来，而 `module/loader`
// 要求 app 文件有且仅有一个具名导出。
const appModules = {
  admin: await import('../../src/apps/admin.js'),
  help: await import('../../src/apps/help.js'),
  push: await import('../../src/apps/push.js'),
  statistics: await import('../../src/apps/statistics.js'),
  testPush: await import('../../src/apps/testPush.js'),
  tools: await import('../../src/apps/tools.js'),
  update: await import('../../src/apps/update.js')
}

/** 文件名 → 导出类。文件名即 Yunzai 的注册名，顺序也是契约的一部分。 */
const apps = {
  admin: appModules.admin.kkkAdmin,
  help: appModules.help.kkkHelp,
  push: appModules.push.kkkPush,
  statistics: appModules.statistics.kkkStatistics,
  testPush: appModules.testPush.kkkTestPush,
  tools: appModules.tools.kkkTools,
  update: appModules.update.kkkUpdate
} as const

interface RuleContract {
  reg: string
  /** 区分 `/re/` 与 `'re'`——Yunzai 两者都接受，但语义不同 */
  regType: string
  fnc: unknown
  permission: unknown
}

interface TaskContract {
  name: unknown
  cron: unknown
  log: unknown
  /** 函数本身不可序列化，只冻结「是否提供了回调」 */
  fnc: string
}

interface AppContract {
  className: string
  name: unknown
  dsc: unknown
  event: unknown
  /** 经 `String()`，因为 `-Infinity` 不能表示为 JSON */
  priority: string
  rule: RuleContract[]
  task: TaskContract[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const describeContract = (className: string, instance: Record<string, unknown>): AppContract => ({
  className,
  name: instance.name,
  dsc: instance.dsc ?? null,
  event: instance.event,
  priority: String(instance.priority),
  rule: (Array.isArray(instance.rule) ? instance.rule : []).map((rule): RuleContract => {
    const entry = isRecord(rule) ? rule : {}
    return {
      reg: String(entry.reg),
      regType: entry.reg instanceof RegExp ? 'RegExp' : typeof entry.reg,
      fnc: entry.fnc ?? null,
      permission: entry.permission ?? null
    }
  }),
  task: (Array.isArray(instance.task) ? instance.task : []).map((task): TaskContract => {
    const entry = isRecord(task) ? task : {}
    return {
      name: entry.name ?? null,
      cron: entry.cron ?? null,
      log: entry.log ?? null,
      fnc: typeof entry.fnc
    }
  })
})

const contract = Object.fromEntries(
  Object.entries(apps).map(([fileName, AppClass]) => [
    fileName,
    describeContract(AppClass.name, new AppClass() as unknown as Record<string, unknown>)
  ])
)

if (process.env.UPDATE_APP_CONTRACT) {
  writeFileSync(FIXTURE, JSON.stringify(contract, null, 2) + '\n')
}

const baseline = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, AppContract>

describe('app 契约', () => {
  it('注册的 app 文件名集合未变', () => {
    expect(Object.keys(contract)).toEqual(Object.keys(baseline))
  })

  for (const fileName of Object.keys(baseline)) {
    describe(fileName, () => {
      it('类名、name、event、priority 与基线一致', () => {
        const { rule: _rule, task: _task, ...scalars } = contract[fileName]!
        const { rule: _baseRule, task: _baseTask, ...baseScalars } = baseline[fileName]!
        expect(scalars).toEqual(baseScalars)
      })

      it('rule 的 reg / fnc / permission 与基线逐条一致', () => {
        expect(contract[fileName]!.rule).toEqual(baseline[fileName]!.rule)
      })

      it('task 的数量与定义与基线一致', () => {
        expect(contract[fileName]!.task).toEqual(baseline[fileName]!.task)
      })
    })
  }
})

describe('app 契约的结构约束', () => {
  // 多一个导出就整文件拒载，用户看到的是命令凭空消失：`buildHelpGroups` 为了让测试
  // 读到菜单数据挂在 help.ts 上，`#kkk帮助` 和 `#kkk版本` 就这么一起没了一整个版本。
  it('每个 app 文件只有一个具名导出，且 loader 认它是插件构造函数', () => {
    for (const [fileName, appModule] of Object.entries(appModules)) {
      expect(Object.keys(appModule), fileName).toEqual([baseline[fileName]!.className])
      expect(getPluginConstructor(appModule, `${fileName}.js`), fileName)
        .toBe(apps[fileName as keyof typeof apps])
    }
  })

  it('每个 app 都声明了 message 事件与非空 rule', () => {
    for (const [fileName, app] of Object.entries(contract)) {
      expect(app.event, fileName).toBe('message')
      expect(app.rule.length, fileName).toBeGreaterThan(0)
    }
  })

  it('每条 rule 都有 fnc，且该方法在类上存在', () => {
    for (const [fileName, AppClass] of Object.entries(apps)) {
      for (const rule of contract[fileName]!.rule) {
        expect(rule.fnc, `${fileName}: rule 缺少 fnc`).toBeTruthy()
        expect(
          typeof (AppClass.prototype as Record<string, unknown>)[rule.fnc as string],
          `${fileName}.${String(rule.fnc)}`
        ).toBe('function')
      }
    }
  })

  it('每个 task 都提供了 cron、name 和回调', () => {
    for (const [fileName, app] of Object.entries(contract)) {
      for (const task of app.task) {
        expect(task.cron, `${fileName}: task 缺少 cron`).toBeTruthy()
        expect(task.name, `${fileName}: task 缺少 name`).toBeTruthy()
        expect(task.fnc, `${fileName}: task 缺少回调`).toBe('function')
      }
    }
  })
})
