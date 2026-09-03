/**
 * 主入口契约测试。
 *
 * `src/index.ts` 是 Yunzai 载入插件的唯一入口，它的启动顺序是行为契约的一部分：
 * 数据库必须先就绪（app 构造时就会读表），临时目录必须先建好（下载路径依赖它），
 * 之后才能扫描 app；API 服务是可选的，关闭时连模块都不该被导入——否则
 * express / puppeteer 这些重依赖会被无谓地加载进内存。
 *
 * `tests/unit/task3-bootstrap.test.ts` 用「卡住目录创建」的方式验证 apps 一定排在
 * 目录之后，这里补的是完整顺序、可选 server 的两种分支，以及单个 app 载入失败时
 * 的日志行为。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface FailedFile {
  file: string
  error: unknown
}

const state = vi.hoisted(() => ({
  /** Config.app.APIServer 的当前取值，每个用例自己设定 */
  apiServer: false,
  /** server 模块是否被求值过——比「startPluginServer 有没有被调用」更严格 */
  serverModuleLoaded: false,
  /** loadApps 要返回的失败清单 */
  failedFiles: [] as FailedFile[],
  /** 启动步骤的实际发生顺序 */
  calls: [] as string[]
}))

const spies = vi.hoisted(() => ({
  initAllDatabases: vi.fn(),
  mkdir: vi.fn(),
  loadApps: vi.fn(),
  startPluginServer: vi.fn(),
  restoreLivePreviewQueue: vi.fn()
}))

vi.mock('../../src/module/db/index.js', () => ({
  initAllDatabases: spies.initAllDatabases.mockImplementation(async () => {
    state.calls.push('database')
  })
}))

/*
  直播预览的重启恢复。这个替身不只是为了挡掉 db / FFmpeg 那条重依赖链，
  也是顺序断言的一部分：恢复出来的项会立刻录制并**主动**发消息，而主动发消息要
  `Bot[self_id]` 已经就位，所以它必须排在 apps 之后。
*/
vi.mock('../../src/module/platform/common/livePreview.js', () => ({
  restoreLivePreviewQueue: spies.restoreLivePreviewQueue.mockImplementation(async () => {
    state.calls.push('livePreview')
    return 0
  })
}))

vi.mock('../../src/module/utils/Common.js', () => ({
  default: {
    tempDri: { images: '/tmp/kkk-images/', video: '/tmp/kkk-video/' },
    mkdir: spies.mkdir.mockImplementation(async () => {
      state.calls.push('directory')
    })
  }
}))

vi.mock('../../src/module/loader/index.js', () => ({
  loadApps: spies.loadApps.mockImplementation(async () => {
    state.calls.push('apps')
    return { apps: { admin: class {} }, loadedFiles: [], failedFiles: state.failedFiles }
  })
}))

vi.mock('../../src/module/server/index.js', () => {
  // 工厂只在模块第一次被真正导入时求值，因此这里可以当作“是否导入过”的探针
  state.serverModuleLoaded = true
  return {
    startPluginServer: spies.startPluginServer.mockImplementation(() => {
      state.calls.push('server')
    })
  }
})

vi.mock('../../src/module/utils/Config.js', () => ({
  default: {
    get app () {
      return { APIServer: state.apiServer }
    }
  }
}))

const loggerSpies = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  mark: vi.fn()
}
globalThis.logger = loggerSpies as unknown as typeof logger

describe('plugin bootstrap', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    state.apiServer = false
    state.serverModuleLoaded = false
    state.failedFiles = []
    state.calls.length = 0
  })

  it('initialises the database, then the directories, then the apps', async () => {
    await import('../../src/index.js')

    expect(state.calls).toEqual(['database', 'directory', 'directory', 'apps', 'livePreview'])
  })

  it('exports the apps map the loader produced', async () => {
    const entry = await import('../../src/index.js')

    expect(Object.keys(entry.apps)).toEqual(['admin'])
  })

  it('does not even import the server module when APIServer is off', async () => {
    await import('../../src/index.js')

    expect(state.serverModuleLoaded).toBe(false)
    expect(spies.startPluginServer).not.toHaveBeenCalled()
  })

  it('starts the API server last when APIServer is on', async () => {
    state.apiServer = true

    await import('../../src/index.js')

    expect(state.serverModuleLoaded).toBe(true)
    expect(state.calls).toEqual(['database', 'directory', 'directory', 'apps', 'livePreview', 'server'])
  })

  it('logs each failed app instead of aborting the whole startup', async () => {
    const error = new Error('boom')
    state.failedFiles = [{ file: 'broken.js', error }]

    await import('../../src/index.js')

    // 一个 app 坏掉不能拖垮整个插件，只记日志
    expect(loggerSpies.error).toHaveBeenCalledWith('载入插件错误：broken.js', error)
    expect(state.calls).toContain('apps')
  })
})
