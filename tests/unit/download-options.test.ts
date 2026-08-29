import { describe, expect, it, vi } from 'vitest'
import { Networks, normalizeDownloadOptions, toAxiosError } from '../../src/module/utils/Network/index.js'
import { clampConcurrency } from '../../src/module/utils/Network/DownloadBudget.js'
// 默认值从源头 import，不抄字面量：抄了之后改常量测试照样绿，这组用例的意义就没了
import {
  DEFAULT_SLOW_FLOOR_BYTES,
  DEFAULT_SUSTAIN_MS,
  SAMPLE_INTERVAL_MS
} from '../../src/module/utils/Network/DownloadWatchdog.js'

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
      },
      slowGuard: {
        enabled: true,
        floorBytesPerSecond: 256 * 1024,
        sustainMs: 20000
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
      },
      // 主动限速开着、限速值 8MB/s，地板速取 min(默认 256KB/s, 8MB/s ÷ 2) = 256KB/s。
      // 这里没被压到是因为默认地板速本来就远低于一半限速值；把限速调到 256KB/s 以下
      // 才会看到压制生效，那条在下面「低速看守的参数归一化」里单独钉。
      slowGuard: {
        enabled: true,
        floorBytesPerSecond: 256 * 1024,
        sustainMs: 20000
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

// 这一组钉的是 normalizeSlowGuard。它不导出，只能从 normalizeDownloadOptions 走进去，
// 但它的每条分支都直接对应面板上一个能填错的格子，所以值得单独一组。
describe('低速看守的参数归一化', () => {
  it('两条关掉的路都认：开关置 false，或者地板速填 0', () => {
    // 关掉时 floorBytesPerSecond 必须一起归零，因为三条下载路都是拿
    // `slowGuard.enabled ? floorBytesPerSecond : 0` 往下传的，留个非零值在里面
    // 迟早会有人漏判 enabled 直接读它。
    expect(normalizeDownloadOptions({}, { downloadSlowRestart: false }).slowGuard).toEqual({
      enabled: false,
      floorBytesPerSecond: 0,
      sustainMs: DEFAULT_SUSTAIN_MS
    })

    // 地板速填 0 是 YAML 注释写明的另一种关法：开关留着，只是暂时不判
    expect(normalizeDownloadOptions({}, { downloadSlowFloor: 0 }).slowGuard).toMatchObject({
      enabled: false,
      floorBytesPerSecond: 0
    })
  })

  it('开关缺省算开着 —— 老配置文件升级上来不该静默少一道保护', () => {
    expect(normalizeDownloadOptions({}, {}).slowGuard.enabled).toBe(true)
  })

  it('主动限速开着时地板速被压到限速值的一半', () => {
    // 这正是 normalizes-multipart 那条用例里注释说「单独钉」的分支：把限速调到
    // 256KB/s 以下，默认地板速就高于一半限速值了。不压的话我们会把**自己**限出来的
    // 速度当成对端在限速，一路重启到重试次数用完。
    const { slowGuard } = normalizeDownloadOptions({}, {
      downloadThrottle: true,
      downloadMaxSpeed: 0.25
    })

    expect(slowGuard).toEqual({
      enabled: true,
      floorBytesPerSecond: 0.25 * 1024 * 1024 / 2,
      sustainMs: DEFAULT_SUSTAIN_MS
    })
    expect(slowGuard.floorBytesPerSecond).toBeLessThan(DEFAULT_SLOW_FLOOR_BYTES)
  })

  it('限速没开时不压地板速，用户填多少就是多少', () => {
    expect(normalizeDownloadOptions({}, {
      downloadMaxSpeed: 0.25,
      downloadSlowFloor: 512
    }).slowGuard.floorBytesPerSecond).toBe(512 * 1024)
  })

  it('持续窗口填不到一个采样间隔时抬回采样间隔', () => {
    // 比采样间隔还短的窗口判不出任何东西：看守要连续低速满 sustainMs 才动手，
    // 而它每 SAMPLE_INTERVAL_MS 才拿到一次读数。
    expect(normalizeDownloadOptions({}, { downloadSlowSustain: 1 }).slowGuard.sustainMs)
      .toBe(SAMPLE_INTERVAL_MS)
  })

  it('持续窗口填 0 是回落默认值，不是关掉判定', () => {
    // `Number(0) * 1000 || DEFAULT_SUSTAIN_MS` 走的是右边。要关请把地板速填 0 ——
    // guoba 的帮助文案也是这么写的，这条用例就是那句文案的凭据。
    expect(normalizeDownloadOptions({}, { downloadSlowSustain: 0 }).slowGuard).toMatchObject({
      enabled: true,
      sustainMs: DEFAULT_SUSTAIN_MS
    })
  })

  it('地板速填负数当 0 处理，等于关掉', () => {
    expect(normalizeDownloadOptions({}, { downloadSlowFloor: -100 }).slowGuard).toMatchObject({
      enabled: false,
      floorBytesPerSecond: 0
    })
  })
})
