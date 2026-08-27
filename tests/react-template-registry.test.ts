import { access } from 'node:fs/promises'

import { expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({
  failStandaloneLookup: true
}))

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {
    ...actual,
    existsSync: (value: Parameters<typeof actual.existsSync>[0]): boolean => {
      const normalized = String(value).replaceAll('\\', '/')
      if (state.failStandaloneLookup && normalized.endsWith('/lib/react-template/index.mjs')) {
        state.failStandaloneLookup = false
        return false
      }
      return actual.existsSync(value)
    }
  }
})

const runtimeData = {
  snapshotAt: '2026-08-19T00:00:00.000Z',
  identity: {
    pluginName: 'kkkkkk-10086',
    pluginVersion: '2.36.0',
    karinVersion: '4.0.0',
    releaseType: 'Stable',
    requiredNodeVersion: '>=22',
    requiredKarinVersion: '>=4'
  },
  build: { state: 'matched', version: '2.36.0', buildTime: 'now', shortCommitHash: 'local' },
  runtime: {
    nodeVersion: 'v22.18.0',
    nodeEnv: 'test',
    os: 'Windows',
    platform: 'win32',
    arch: 'x64',
    timezone: 'Asia/Shanghai',
    container: false,
    systemUptime: '1h',
    processUptime: '1m'
  },
  adapter: {
    name: 'TestAdapter',
    version: '1.0.0',
    platform: 'test',
    protocol: 'test',
    standard: 'test',
    communication: 'test',
    connectedFor: '1m'
  },
  renderer: { scale: '100%', timeout: '60s', multiPage: true },
  resources: {
    cpuModel: 'Test CPU',
    cpuCores: 8,
    totalMemory: '16 GB',
    usedMemory: '4 GB',
    memoryUsagePercent: '25%',
    processRss: '100 MB',
    heapUsed: '50 MB'
  },
  // 形状照抄 collectRuntimeReport() 的输出（src/module/utils/runtime-report.ts）。
  // 这个用例只验「构建产物缺失后能重试加载」，但模板会真的读这些字段，
  // 少一层就是渲染期 TypeError，而不是断言失败——所以这里必须给全。
  concurrency: {
    cache: {
      enabled: true,
      sampled: true,
      hitRate: '78.4%',
      hits: 132,
      coalesced: 47,
      misses: 49,
      entries: 63,
      capacity: 128,
      negativeEntries: 2,
      inflight: 1,
      tiers: [
        { label: '准静态接口', hitRate: '96.2%', detail: '命中 48 · 合并 2 · 未命中 2 · 缓存 4 条' }
      ]
    },
    download: {
      limit: 8,
      buckets: [{ label: '抖音', running: 3, queued: 0 }]
    }
  },
  releaseNotes: { markdown: 'Build works.', available: true }
}

const context = {
  scale: 1,
  theme: { mode: 'light' as const },
  version: {
    plugin: 'yunzai-plugin',
    pluginName: 'kkkkkk-10086',
    pluginVersion: '2.36.0',
    releaseType: 'Stable' as const,
    poweredBy: 'Yunzai',
    frameworkVersion: '4.0.0',
    hasUpdate: false
  }
}

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

test('retries standalone loading after a transient missing artifact', async () => {
  const { renderReactTemplate } = await import('../src/module/utils/react-template/registry.js')

  await expect(renderReactTemplate('other/runtime', runtimeData, context)).rejects.toThrow('React standalone')

  const result = await renderReactTemplate('other/runtime', runtimeData, context)
  expect(await pathExists(result.htmlPath)).toBe(true)

  await result.cleanup()
  expect(await pathExists(result.htmlPath)).toBe(false)
}, 20_000)
