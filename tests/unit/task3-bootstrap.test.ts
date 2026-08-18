import { afterEach, describe, expect, it, vi } from 'vitest'

const bootstrapMocks = vi.hoisted(() => {
  let resolveDirectoryCreation: (() => void) | undefined
  const directoryCreation = new Promise<void>(resolve => {
    resolveDirectoryCreation = resolve
  })
  return {
    directoryCreation,
    mkdir: vi.fn(() => directoryCreation),
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

vi.mock('../../src/module/db/index.js', () => ({
  initAllDatabases: bootstrapMocks.initAllDatabases
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
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(bootstrapMocks.initAllDatabases).toHaveBeenCalledOnce()
    expect(bootstrapMocks.mkdir).toHaveBeenCalledTimes(2)
    expect(bootstrapMocks.loadApps).not.toHaveBeenCalled()

    bootstrapMocks.resolveDirectoryCreation()
    await entryPromise

    expect(bootstrapMocks.loadApps).toHaveBeenCalledOnce()
  })
})
