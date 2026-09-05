import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MessageEvent } from '../../src/types/message'

/**
 * 运行诊断卡「配置告警」那一格的护栏。
 *
 * 这一格是坏掉的配置文件唯一的补救出口：`Config` 解析失败只在启动时打一行日志，
 * 而 `initCfg()` 刻意不覆盖那份文件（覆盖等于清空用户配置），于是它会一直失效。
 *
 * 不替 `configHealth` 模块，用真的 —— 它没有任何依赖，而这里要钉的正是
 * 「登记进去的东西能不能原样出现在卡上」这段接线。
 */
vi.mock('../../src/module/utils/Config.js', () => ({
  default: { app: {}, cookies: {}, bilibili: {} }
}))
vi.mock('../../src/module/utils/Version.js', () => ({
  default: { pluginPath: '.', pluginName: 'test', version: '0.0.0', BotName: 'Yunzai', BotVersion: '3.1.3' }
}))
vi.mock('../../src/module/tooling/build-metadata.js', () => ({
  getBuildMetadata: () => undefined,
  formatBuildTime: (value: string) => value
}))
vi.mock('../../src/module/tooling/release-channel.js', () => ({
  getReleaseChannel: () => 'Dev'
}))
vi.mock('../../src/module/utils/ErrorHandler/adapter.js', () => ({
  getAdapterInfo: () => undefined
}))
vi.mock('../../src/module/utils/ApiCache.js', () => ({
  getApiCacheSnapshot: () => ({
    enabled: true,
    capacity: 128,
    entries: 0,
    hits: 0,
    coalesced: 0,
    misses: 0,
    hitRate: 0,
    negativeEntries: 0,
    inflight: 0,
    tiers: []
  })
}))
vi.mock('../../src/module/utils/Network/DownloadBudget.js', () => ({
  getDownloadBudgetSnapshot: () => ({ limit: 8, buckets: [] })
}))
vi.mock('../../src/module/utils/ParseCoordinator.js', () => ({
  getParseCoordinatorSnapshot: () => undefined
}))
vi.mock('../../src/module/utils/Network/CdnRegistry.js', () => ({
  getCdnRegistrySnapshot: () => ({ resources: 0, hosts: 0, penalized: [] })
}))
vi.mock('../../src/module/utils/Network/CdnProbe.js', () => ({
  getCdnProbeSnapshot: () => ({ hosts: 0, entries: [] })
}))

const { collectRuntimeReport } = await import('../../src/module/utils/runtime-report.js')
const { recordConfigParseFailure, resetConfigHealth } = await import('../../src/module/utils/configHealth.js')

const event = { bot: { stat: {} } } as unknown as MessageEvent
const collect = () => collectRuntimeReport(event).configHealth

const CONFIG_DIR = 'E:/Yunzai/plugins/kkkkkk-10086/config'

beforeEach(() => {
  resetConfigHealth()
})

describe('配置告警', () => {
  it('一份都没坏时不告警，模板据此整段不画', () => {
    expect(collect()).toEqual({ degraded: false, files: [] })
  })

  it('登记过失败就翻成告警，并把原因带到卡上', () => {
    recordConfigParseFailure(`${CONFIG_DIR}/config/request.yaml`, new Error('Implicit keys need to be on a single line'))

    expect(collect()).toEqual({
      degraded: true,
      files: [
        {
          file: 'request.yaml',
          origin: '用户配置',
          reason: 'Implicit keys need to be on a single line'
        }
      ]
    })
  })

  it('默认模板换成另一句措辞：那是发布包的问题，处置和用户配置不一样', () => {
    recordConfigParseFailure(`${CONFIG_DIR}/default_config/upload.yaml`, new Error('boom'))

    expect(collect().files[0]?.origin).toBe('默认模板')
  })

  it('认不出的目录名原样显示，不让这一行凭空消失', () => {
    recordConfigParseFailure(`${CONFIG_DIR}/somewhere_else/request.yaml`, new Error('boom'))

    expect(collect().files[0]?.origin).toBe('somewhere_else')
  })

  it('多份一起坏时逐条列出，files 的条数就是卡上那个数字', () => {
    recordConfigParseFailure(`${CONFIG_DIR}/config/request.yaml`, new Error('boom'))
    recordConfigParseFailure(`${CONFIG_DIR}/config/cookies.yaml`, new Error('boom'))

    const health = collect()
    expect(health.degraded).toBe(true)
    expect(health.files.map(entry => entry.file)).toEqual(['cookies.yaml', 'request.yaml'])
  })
})
