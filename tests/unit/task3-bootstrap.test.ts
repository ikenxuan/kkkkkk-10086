import { afterEach, describe, expect, it, vi } from 'vitest'

const bootstrapMocks = vi.hoisted(() => {
  let resolveDirectoryCreation: (() => void) | undefined
  let resolveDirectoriesRequested: (() => void) | undefined
  const directoryCreation = new Promise<void>(resolve => {
    resolveDirectoryCreation = resolve
  })
  const directoriesRequested = new Promise<void>(resolve => {
    resolveDirectoriesRequested = resolve
  })
  return {
    directoryCreation,
    directoriesRequested,
    mkdir: vi.fn(() => {
      resolveDirectoriesRequested?.()
      return directoryCreation
    }),
    loadApps: vi.fn(async () => ({ apps: {}, loadedFiles: [], failedFiles: [] })),
    initAllDatabases: vi.fn(async () => {}),
    resolveDirectoryCreation: () => resolveDirectoryCreation?.()
  }
})

vi.mock('../../src/module/loader/index.js', () => ({
  loadApps: bootstrapMocks.loadApps
}))

vi.mock('../../src/module/utils/Common.js', () => ({
  default: {
    tempDri: {
      images: '/tmp/kkkkkk-images/',
      video: '/tmp/kkkkkk-video/'
    },
    mkdir: bootstrapMocks.mkdir
  }
}))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: { app: { APIServer: false } }
}))

vi.mock('../../src/module/utils/cache/runtime.js', () => ({
  startCacheMaintenance: vi.fn()
}))

vi.mock('../../src/module/db/index.js', () => ({
  initAllDatabases: bootstrapMocks.initAllDatabases
}))

// 只为挡掉 db / FFmpeg 那条重依赖链，顺序断言在 tests/contracts/bootstrap.test.ts 里
vi.mock('../../src/module/platform/common/livePreview.js', () => ({
  restoreLivePreviewQueue: vi.fn(async () => 0)
}))

describe('Task 3 bootstrap ordering', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('waits for temporary directories before scanning apps', async () => {
    globalThis.logger = {
      info: vi.fn(),
      error: vi.fn(),
      red: (value: string) => value
    } as never

    const entryPromise = import('../../src/index.js')

    try {
      // 等待 mkdir 的明确信号，不把模块转译/加载耗时限制在轮询默认的 1 秒内。
      await bootstrapMocks.directoriesRequested
      expect(bootstrapMocks.initAllDatabases).toHaveBeenCalledOnce()
      expect(bootstrapMocks.mkdir).toHaveBeenCalledTimes(2)
      expect(bootstrapMocks.loadApps).not.toHaveBeenCalled()
    } finally {
      bootstrapMocks.resolveDirectoryCreation()
      await entryPromise
    }

    expect(bootstrapMocks.loadApps).toHaveBeenCalledOnce()
  })
})
