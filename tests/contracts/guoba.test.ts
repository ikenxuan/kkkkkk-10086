/**
 * 锅巴面板入口契约测试。
 *
 * 锅巴在框架启动后单独加载 `guoba.support.js`，这条路径只应该读写配置，
 * 绝对不能顺带初始化数据库、加载 app 或启动 API 服务——否则面板一打开就会
 * 重复执行插件的启动副作用（重复注册定时任务、端口占用、数据库并发写入）。
 * 这里把这条边界冻结下来，同时冻结面板的表单结构与保存逻辑的路由方式。
 */
import { describe, expect, it, vi } from 'vitest'

/** 被 Config.modify / ModifyPro 记录下来的调用，用于断言保存逻辑的路由 */
const modifyCalls: Array<[string, string, unknown]> = []
const modifyProCalls: Array<[string, Record<string, unknown>]> = []
const syncCalls: number[] = []
const configWriteState = vi.hoisted(() => ({ modifyProResult: true, modifyResult: true }))

const configDouble = vi.hoisted(() => ({
  app: { videotool: true },
  cookies: { douyin: 'ck' },
  douyin: { switch: true },
  bilibili: { switch: true },
  pushlist: { douyin: [], bilibili: [] },
  kuaishou: { switch: true },
  xiaohongshu: { switch: true },
  upload: { sendbase64: false },
  request: { timeout: 60000 }
}))

/** 这三个模块一旦被 guoba 入口（直接或间接）导入，间谍就会被调用 */
const initAllDatabases = vi.fn()
const loadApps = vi.fn()
const startPluginServer = vi.fn()

vi.mock('../../src/module/db/index.js', () => ({
  initAllDatabases,
  getStatisticsDB: vi.fn(),
  bilibiliDB: {},
  douyinDB: {}
}))
vi.mock('../../src/module/loader/index.js', () => ({ loadApps }))
vi.mock('../../src/module/server/index.js', () => ({ startPluginServer }))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: {
    ...configDouble,
    modify: (name: string, key: string, value: unknown) => {
      modifyCalls.push([name, key, value])
      // 必须照真实签名返回 boolean：Config.modify 报「写进去了没有」，
      // 保存路径现在会看这个值。桩返回 undefined 的话每次保存都被判成失败。
      return configWriteState.modifyResult
    },
    ModifyPro: (name: string, value: Record<string, unknown>) => {
      modifyProCalls.push([name, value])
      return configWriteState.modifyProResult
    },
    syncConfigToDatabase: async () => {
      syncCalls.push(1)
    }
  }
}))

globalThis.logger = {
  debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), mark: vi.fn()
} as unknown as typeof logger

// 必须在替身安装之后导入，否则拿到的是真实的 Config
const { supportGuoba } = await import('../../src/guoba.support.js')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** 收集一层 schema 的 `field`（不下钻子表单） */
const ownFields = (schemas: unknown): string[] => {
  if (!Array.isArray(schemas)) return []
  return schemas
    .filter(isRecord)
    .map(schema => schema.field)
    .filter((field): field is string => typeof field === 'string')
}

/** 收集所有 GSubForm 的子 schema 列表 */
const subFormSchemas = (schemas: unknown): unknown[] => {
  if (!Array.isArray(schemas)) return []
  return schemas
    .filter(isRecord)
    .filter(schema => isRecord(schema.componentProps) && Array.isArray(schema.componentProps.schemas))
    .map(schema => (schema.componentProps as Record<string, unknown>).schemas)
}

describe('guoba entry has no startup side effects', () => {
  it('does not initialise the database, load apps, or start the API server', () => {
    supportGuoba()

    expect(initAllDatabases).not.toHaveBeenCalled()
    expect(loadApps).not.toHaveBeenCalled()
    expect(startPluginServer).not.toHaveBeenCalled()
  })
})

describe('guoba plugin info', () => {
  it('keeps the identifiers guoba uses to key the plugin', () => {
    const { pluginInfo } = supportGuoba()

    // name 是锅巴侧的唯一标识，改了等于换了一个插件，用户已保存的面板状态会丢失
    expect(pluginInfo.name).toBe('kkkkkk-10086')
    expect(pluginInfo.title).toBe('kkkkkk-10086')
    expect(pluginInfo.isV3).toBe(true)
    expect(pluginInfo.isV2).toBe(false)
  })
})

describe('guoba config schemas', () => {
  const configInfo = supportGuoba().configInfo
  const schemaByField = (field: string) =>
    configInfo?.schemas?.find(schema => schema.field === field)

  it('exposes a schema list', () => {
    expect(Array.isArray(configInfo?.schemas)).toBe(true)
    expect(configInfo?.schemas?.length).toBeGreaterThan(0)
  })

  it('gives every schema a label and a component', () => {
    for (const schema of configInfo?.schemas ?? []) {
      expect(typeof schema.label).toBe('string')
      expect(schema.label.length).toBeGreaterThan(0)
      expect(typeof schema.component).toBe('string')
    }
  })

  it('prefixes every dotted field with a real config file name', () => {
    // 保存逻辑按 `field` 的第一段决定写哪个 yaml，前缀错了就会写出野文件
    const configNames = new Set([
      'app', 'bilibili', 'cookies', 'douyin', 'kuaishou',
      'pushlist', 'request', 'upload', 'xiaohongshu'
    ])

    for (const schema of configInfo?.schemas ?? []) {
      if (typeof schema.field !== 'string' || !schema.field.includes('.')) continue
      expect(configNames.has(schema.field.split('.')[0] ?? '')).toBe(true)
    }
  })

  it('never repeats a field within one form level', () => {
    // 子表单的字段名只在自己那张表里生效，两个推送列表复用 `switch` / `group_id`
    // 是正常的；同一层里重名才会让面板互相覆盖
    const levels = [configInfo?.schemas, ...subFormSchemas(configInfo?.schemas)]
    expect(levels.length).toBe(3)

    for (const level of levels) {
      const fields = ownFields(level)
      expect(fields.length).toBeGreaterThan(0)
      expect(new Set(fields).size).toBe(fields.length)
    }
  })

  it('declares both push lists as multi-row sub forms', () => {
    const pushLists = (configInfo?.schemas ?? []).filter(
      schema => schema.field === 'pushlist.douyin' || schema.field === 'pushlist.bilibili'
    )

    expect(pushLists).toHaveLength(2)
    for (const schema of pushLists) {
      expect(schema.component).toBe('GSubForm')
      expect(isRecord(schema.componentProps) && schema.componentProps.multiple).toBe(true)
    }
  })

  it('exposes parse concurrency as a bounded worker count', () => {
    const schema = schemaByField('app.parseConcurrency')

    expect(schema).toMatchObject({
      field: 'app.parseConcurrency',
      component: 'InputNumber',
      componentProps: {
        min: 1,
        max: 16,
        addonAfter: '路'
      }
    })
    expect(schema?.bottomHelpMessage).toContain('控制同时解析任务数')
  })

  it('offers intelligent scene as the fourth theme mode', () => {
    const schema = schemaByField('app.Theme')
    const componentProps = isRecord(schema?.componentProps) ? schema.componentProps : {}

    expect(schema).toMatchObject({
      field: 'app.Theme',
      component: 'RadioGroup'
    })
    expect(componentProps.options).toEqual([
      { label: '根据时间自动切换', value: 0 },
      { label: '浅色', value: 1 },
      { label: '深色', value: 2 },
      { label: '智能场景（根据封面）', value: 3 }
    ])
  })

  it('limits Bilibili push parsing to the three supported dynamic types', () => {
    const schema = schemaByField('bilibili.push.parseDynamicTypes')

    expect(schema).toMatchObject({
      field: 'bilibili.push.parseDynamicTypes',
      component: 'Select',
      componentProps: {
        mode: 'multiple',
        allowCreate: false,
        options: [
          { label: '视频动态', value: 'DYNAMIC_TYPE_AV' },
          { label: '图文动态', value: 'DYNAMIC_TYPE_DRAW' },
          { label: '文章动态', value: 'DYNAMIC_TYPE_ARTICLE' }
        ]
      }
    })
  })

  it('bounds all ambient-cover opacity controls from zero to one', () => {
    const fields = [
      'app.ambientCover.coverOpacity',
      'app.ambientCover.overlayEdgeOpacity',
      'app.ambientCover.overlayMiddleOpacity'
    ]

    for (const field of fields) {
      expect(schemaByField(field)).toMatchObject({
        field,
        component: 'InputNumber',
        componentProps: { min: 0, max: 1 }
      })
    }
  })

  it('exposes the per-attempt Amagi hard timeout with a one-minute ceiling', () => {
    const schema = schemaByField('request.amagiTimeout')

    expect(schema).toMatchObject({
      field: 'request.amagiTimeout',
      component: 'InputNumber',
      componentProps: {
        min: 1000,
        max: 60000,
        addonAfter: 'ms'
      }
    })
    expect(schema?.bottomHelpMessage).toContain('每次 Amagi 尝试的硬超时')
    expect(schema?.bottomHelpMessage).toContain('最多一分钟')
  })

  it('exposes Amagi retries as attempts after the initial request', () => {
    const schema = schemaByField('request.amagiMaxRetries')

    expect(schema).toMatchObject({
      field: 'request.amagiMaxRetries',
      component: 'InputNumber',
      componentProps: {
        min: 0,
        max: 5,
        addonAfter: '次'
      }
    })
    expect(schema?.bottomHelpMessage).toContain('初次请求之后的重试次数')
  })
})

describe('guoba getConfigData', () => {
  it('returns every config section the schemas write to', async () => {
    const data = await supportGuoba().configInfo?.getConfigData?.()

    expect(Object.keys(data ?? {}).sort()).toEqual([
      'app', 'bilibili', 'cookies', 'douyin', 'kuaishou',
      'pushlist', 'request', 'upload', 'xiaohongshu'
    ])
  })
})

describe('guoba setConfigData', () => {
  /** 锅巴注入的 Result 替身，只需要 ok / error 两个静态方法 */
  const Result = {
    ok: (result: unknown, message?: string) => ({ ok: true, result, message }),
    error: (message: unknown, error?: unknown) => ({ ok: false, message, error })
  }

  const save = async (
    data: Record<string, unknown>,
    modifyProResult = true,
    modifyResult = true
  ): Promise<unknown> => {
    configWriteState.modifyProResult = modifyProResult
    configWriteState.modifyResult = modifyResult
    modifyCalls.length = 0
    modifyProCalls.length = 0
    syncCalls.length = 0
    const configInfo = supportGuoba().configInfo
    return await configInfo?.setConfigData?.(
      data as Parameters<NonNullable<typeof configInfo.setConfigData>>[0],
      { Result } as unknown as Parameters<NonNullable<typeof configInfo.setConfigData>>[1]
    )
  }

  it('routes dotted keys to Config.modify with the file name split off', async () => {
    const result = await save({ 'douyin.push.cron': '0 */5 * * * *' })

    expect(modifyCalls).toEqual([['douyin', 'push.cron', '0 */5 * * * *']])
    expect(modifyProCalls).toEqual([])
    expect(result).toMatchObject({ ok: true, message: '保存成功' })
  })

  it('saves an empty value like any other write', async () => {
    // 「有些配置本来就是空的」：清空一个 ck 是正常写入，write() 照样返回 true，
    // 不该被下面那条失败上报误伤。degraded 只在 yaml 解析不动/根不是对象时才为真。
    const result = await save({ 'cookies.bilibili': '' })

    expect(modifyCalls).toEqual([['cookies', 'bilibili', '']])
    expect(result).toMatchObject({ ok: true, message: '保存成功' })
  })

  it('reports a failure instead of a fake success when the write is refused', async () => {
    // 用户 yaml 有语法错误时 YamlReader 会拒写以免拿空文档覆盖原文件。
    // 之前这里丢掉返回值无条件回「保存成功」——面板说存好了、磁盘一个字没动，
    // 用户于是以为 ck 配好了，解析时却被告知未配置。
    const result = await save({ 'cookies.bilibili': 'SESSDATA=abc' }, true, false)

    // 沿用本文件既有的失败形状：message 是统一的「保存失败」，细节挂在 error 上
    expect(result).toMatchObject({ ok: false, message: '保存失败' })
    expect(String((result as { error?: unknown }).error)).toContain('配置写入失败')
  })

  it('routes bare object keys to Config.ModifyPro', async () => {
    await save({ app: { videotool: false } })

    expect(modifyProCalls).toEqual([['app', { videotool: false }]])
    expect(modifyCalls).toEqual([])
  })

  it('treats an array value as a dotted write, not a section merge', async () => {
    // pushlist.douyin 是数组，必须走 modify 而不是 ModifyPro
    await save({ 'pushlist.douyin': [{ sec_uid: 'x' }] })

    expect(modifyCalls).toEqual([['pushlist', 'douyin', [{ sec_uid: 'x' }]]])
    expect(modifyProCalls).toEqual([])
  })

  it('syncs the database only when pushlist was touched', async () => {
    await save({ 'app.videotool': true })
    expect(syncCalls).toHaveLength(0)

    await save({ 'pushlist.bilibili': [] })
    expect(syncCalls).toHaveLength(1)
  })

  it('skips empty keys and single-segment non-object values', async () => {
    await save({ '': 1, app: 'not-an-object' })

    expect(modifyCalls).toEqual([])
    expect(modifyProCalls).toEqual([])
  })

  it('rejects unknown config sections without attempting a write', async () => {
    const result = await save({ 'unknown.foo': true })

    expect(modifyCalls).toEqual([])
    expect(modifyProCalls).toEqual([])
    expect(syncCalls).toEqual([])
    expect(result).toMatchObject({ ok: false, message: '保存失败' })
  })

  it('reports failure when Config.ModifyPro rejects a section merge', async () => {
    const result = await save({ app: { videotool: false } }, false)

    expect(modifyProCalls).toEqual([['app', { videotool: false }]])
    expect(modifyCalls).toEqual([])
    expect(result).toMatchObject({ ok: false, message: '保存失败' })
  })
})
