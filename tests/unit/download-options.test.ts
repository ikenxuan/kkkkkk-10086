import { describe, expect, it, vi } from 'vitest'
import { Networks, normalizeDownloadOptions, toAxiosError } from '../../src/module/utils/Networks.js'
import { clampConcurrency } from '../../src/module/utils/DownloadBudget.js'

// `new Networks()` 会读 Config.request，第一次读就触发 Config 单例初始化 ——
// 而 initCfg 里的 YamlReader 在解析失败时走 logger.error。vitest 并行跑多个文件时
// 另一个 worker 可能正在写同一个 yaml，于是这里踩到半截文件、
// 然后因为没有 logger 全局而炸成 `ReferenceError: logger is not defined`，
// 把一个「配置读写竞争」伪装成本文件的断言失败。凡是会碰 Config 的测试都要备一个 logger。
globalThis.logger = {
  warn: vi.fn(),
  error: vi.fn(),
  mark: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
} as never

// 区间和默认值必须和三处逐字一致：DownloadBudget 的 MIN/MAX/DEFAULT 常量、
// guoba schema 里 upload.downloadConcurrency 的 min/max、default_config/upload.yaml。
describe('clampConcurrency', () => {
  it.each([
    [1, 2],
    [2, 2],
    [4.9, 4],
    [8, 8],
    [16, 16],
    [17, 16],
    ['6', 6],
    [Number.NaN, 8],
    [Number.POSITIVE_INFINITY, 8]
  ])('normalizes %j to %d', (value, expected) => {
    expect(clampConcurrency(value)).toBe(expected)
  })
})

describe('Networks request compatibility', () => {
  it('preserves Axios-compatible array-valued headers', () => {
    const network = new Networks({
      url: 'https://example.com',
      headers: { Foo: ['a', 'b'], 'X-Test': 'ok' }
    })

    expect(network.getConfig().headers).toMatchObject({
      Foo: ['a', 'b'],
      'X-Test': 'ok'
    })
  })

  it('preserves Node stream error codes during conversion', () => {
    const error = Object.assign(new Error('connection reset'), { code: 'ECONNRESET' })

    expect(toAxiosError(error)).toMatchObject({
      message: 'connection reset',
      code: 'ECONNRESET'
    })
  })
})

describe('normalizeDownloadOptions', () => {
  it('normalizes single-thread defaults', () => {
    expect(normalizeDownloadOptions({}, {})).toEqual({
      isLiveStream: false,
      liveStreamMaxSize: 10 * 1024 * 1024,
      multiThread: false,
      concurrency: 8,
      throttle: {
        enabled: false,
        currentSpeed: 10 * 1024 * 1024,
        minSpeed: 1024 * 1024,
        autoReduce: true
      }
    })
  })

  it('normalizes multipart and throttle settings within boundaries', () => {
    expect(normalizeDownloadOptions({ currentSpeed: 20 * 1024 * 1024 }, {
      downloadMultiThread: true,
      downloadConcurrency: 99,
      downloadThrottle: true,
      downloadMaxSpeed: 8,
      downloadMinSpeed: 2,
      downloadAutoReduce: false
    })).toEqual({
      isLiveStream: false,
      liveStreamMaxSize: 10 * 1024 * 1024,
      multiThread: true,
      concurrency: 16,
      throttle: {
        enabled: true,
        currentSpeed: 20 * 1024 * 1024,
        minSpeed: 2 * 1024 * 1024,
        autoReduce: false
      }
    })
  })

  it('disables multipart mode for live streams', () => {
    expect(normalizeDownloadOptions({ isLiveStream: true }, {
      downloadMultiThread: true,
      downloadConcurrency: 6
    }).multiThread).toBe(false)
  })
})
