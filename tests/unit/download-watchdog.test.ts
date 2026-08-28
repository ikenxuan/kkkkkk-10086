import { describe, expect, it, vi } from 'vitest'

import {
  createSlowDownloadError,
  createSlowSpeedGuard,
  DEFAULT_GRACE_MS,
  DEFAULT_SLOW_FLOOR_BYTES,
  DEFAULT_SUSTAIN_MS,
  isSlowDownloadAbort,
  MIN_REMAINING_BYTES,
  SAMPLE_INTERVAL_MS,
  SLOW_DOWNLOAD_ABORT_CODE
} from '../../src/module/utils/DownloadWatchdog.js'
import type { SlowSpeedGuard, SlowSpeedVerdict } from '../../src/module/utils/DownloadWatchdog.js'

// 凡是会碰 Config / 宿主日志的模块都要先备一个 logger：vitest 并行跑多个 worker 时
// 少了它会炸成 `ReferenceError: logger is not defined`，把别的问题伪装成本文件的断言失败。
globalThis.logger = {
  warn: vi.fn(),
  error: vi.fn(),
  mark: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
} as never

const T0 = 1_700_000_000_000

const FLOOR = DEFAULT_SLOW_FLOOR_BYTES

/** 每拍 32KB / 2 秒 = 16KB/s，远在地板速之下 */
const SLOW_STEP = 32 * 1024

/** 每拍 512KB / 2 秒 = 256KB/s，正好压在地板速上 */
const FLOOR_STEP = FLOOR * (SAMPLE_INTERVAL_MS / 1000)

/** 仍然落在宽限期里的拍数：8 秒宽限期下是第 1~3 拍 */
const GRACE_STEPS = DEFAULT_GRACE_MS / SAMPLE_INTERVAL_MS - 1

/** 宽限期之后攒够 sustain 需要的拍数 */
const SUSTAIN_STEPS = DEFAULT_SUSTAIN_MS / SAMPLE_INTERVAL_MS

/** 判定成立时刻的累计下载量，收尾豁免的两条边界用它算 totalBytes */
const BYTES_AT_VERDICT = (GRACE_STEPS + SUSTAIN_STEPS) * SLOW_STEP

interface Driver {
  /** 推一拍：前进 stepMs 毫秒、累计 bytes 字节 */
  step: (bytes: number, stepMs?: number) => SlowSpeedVerdict
  /** 连推 count 拍，拿回每一拍的判定 */
  steps: (count: number, bytes: number, stepMs?: number) => SlowSpeedVerdict[]
  /** 在当前时刻重新计时 */
  reset: () => void
}

/**
 * 按固定节拍喂采样。看守只吃「累计字节数 + 时刻」，所以整套判定都能这样逐拍驱动，
 * 不需要真开一条 HTTP 连接、也不需要假定时器。
 */
const drive = (guard: SlowSpeedGuard, totalBytes = -1): Driver => {
  let now = T0
  let downloadedBytes = 0
  guard.reset(now)
  const step = (bytes: number, stepMs = SAMPLE_INTERVAL_MS): SlowSpeedVerdict => {
    now += stepMs
    downloadedBytes += bytes
    return guard.sample({ downloadedBytes, totalBytes, now })
  }
  return {
    step,
    steps: (count, bytes, stepMs) => Array.from({ length: count }, () => step(bytes, stepMs)),
    reset: () => { guard.reset(now) }
  }
}

describe('看守的各个窗口', () => {
  it('宽限期内只更新基线，不累计', () => {
    const guard = createSlowSpeedGuard({ floorBytesPerSecond: FLOOR })
    const driver = drive(guard)

    // 一个字节都不来也不该累计：TLS 握手 + TTFB + 慢启动本来就没有速率可言
    for (const verdict of driver.steps(GRACE_STEPS, 0)) {
      expect(verdict.triggered).toBe(false)
      expect(verdict.slowForMs).toBe(0)
    }

    // 宽限期到点的那一拍开始记账，记的是整个采样间隔
    expect(driver.step(0).slowForMs).toBe(SAMPLE_INTERVAL_MS)
  })

  it('宽限期内照样报当拍速率，只是不拿它判定', () => {
    const guard = createSlowSpeedGuard({ floorBytesPerSecond: FLOOR })
    const driver = drive(guard)

    expect(driver.step(SLOW_STEP)).toEqual({
      triggered: false,
      bytesPerSecond: SLOW_STEP / (SAMPLE_INTERVAL_MS / 1000),
      slowForMs: 0
    })
  })

  it('速率压在地板速上就算达标，累计清零', () => {
    const guard = createSlowSpeedGuard({ floorBytesPerSecond: FLOOR })
    const driver = drive(guard)
    driver.steps(GRACE_STEPS, SLOW_STEP)

    expect(driver.step(SLOW_STEP).slowForMs).toBe(SAMPLE_INTERVAL_MS)
    // 恰好等于地板速走的是 `>=` 那一支
    const recovered = driver.step(FLOOR_STEP)
    expect(recovered.bytesPerSecond).toBe(FLOOR)
    expect(recovered.slowForMs).toBe(0)
    // 清零是真清零，不是只把返回值改成 0
    expect(driver.step(SLOW_STEP).slowForMs).toBe(SAMPLE_INTERVAL_MS)
  })

  it('一次抖动不算故障：累计被打断后要从头攒', () => {
    const guard = createSlowSpeedGuard({ floorBytesPerSecond: FLOOR })
    const driver = drive(guard)
    driver.steps(GRACE_STEPS, SLOW_STEP)
    driver.steps(SUSTAIN_STEPS - 1, SLOW_STEP)
    driver.step(FLOOR_STEP)

    expect(driver.steps(SUSTAIN_STEPS - 1, SLOW_STEP).some(verdict => verdict.triggered)).toBe(false)
    expect(driver.step(SLOW_STEP).triggered).toBe(true)
  })

  it('持续低速攒够 sustain 才判定', () => {
    const guard = createSlowSpeedGuard({ floorBytesPerSecond: FLOOR })
    const driver = drive(guard)
    const verdicts = driver.steps(GRACE_STEPS + SUSTAIN_STEPS, SLOW_STEP)
    const last = verdicts[verdicts.length - 1]

    expect(verdicts.filter(verdict => verdict.triggered)).toHaveLength(1)
    expect(last?.triggered).toBe(true)
    expect(last?.slowForMs).toBe(DEFAULT_SUSTAIN_MS)
    expect(last?.bytesPerSecond).toBe(SLOW_STEP / (SAMPLE_INTERVAL_MS / 1000))
  })

  it('自定义窗口生效', () => {
    const guard = createSlowSpeedGuard({
      floorBytesPerSecond: FLOOR,
      graceMs: 0,
      sustainMs: SAMPLE_INTERVAL_MS * 2
    })

    expect(drive(guard).steps(2, SLOW_STEP).map(verdict => verdict.triggered)).toEqual([false, true])
  })
})

describe('判定自锁', () => {
  it('一次低速只触发一次', () => {
    const guard = createSlowSpeedGuard({ floorBytesPerSecond: FLOOR })
    const driver = drive(guard)
    driver.steps(GRACE_STEPS + SUSTAIN_STEPS, SLOW_STEP)

    // 调用方拿到判定后要去中断连接，这期间还会有采样进来；不自锁就会重复掐
    expect(driver.steps(5, SLOW_STEP).some(verdict => verdict.triggered)).toBe(false)
  })

  it('自锁期间报 0 速率，但保留已累计的时长', () => {
    const guard = createSlowSpeedGuard({ floorBytesPerSecond: FLOOR })
    const driver = drive(guard)
    driver.steps(GRACE_STEPS + SUSTAIN_STEPS, SLOW_STEP)

    expect(driver.step(SLOW_STEP)).toEqual({
      triggered: false,
      bytesPerSecond: 0,
      slowForMs: DEFAULT_SUSTAIN_MS
    })
  })

  it('reset() 之后重新计时，能再判一次', () => {
    const guard = createSlowSpeedGuard({
      floorBytesPerSecond: FLOOR,
      graceMs: 0,
      sustainMs: SAMPLE_INTERVAL_MS * 2
    })
    const driver = drive(guard)
    expect(driver.steps(2, SLOW_STEP).map(verdict => verdict.triggered)).toEqual([false, true])

    driver.reset()

    expect(driver.steps(2, SLOW_STEP).map(verdict => verdict.triggered)).toEqual([false, true])
  })
})

describe('时间没走的采样', () => {
  it('同一毫秒内的两次采样不产出速率', () => {
    const guard = createSlowSpeedGuard({ floorBytesPerSecond: FLOOR })
    guard.reset(T0)
    guard.sample({ downloadedBytes: 0, totalBytes: -1, now: T0 + SAMPLE_INTERVAL_MS })

    const same = guard.sample({ downloadedBytes: 5000, totalBytes: -1, now: T0 + SAMPLE_INTERVAL_MS })

    // 拿 0 当间隔算速率会得到 Infinity 或 NaN，两者都会让后面的比较失去意义
    expect(same.bytesPerSecond).toBe(0)
    expect(Number.isFinite(same.bytesPerSecond)).toBe(true)
    expect(same.triggered).toBe(false)
  })

  it('被忽略的采样不挪基线', () => {
    const guard = createSlowSpeedGuard({ floorBytesPerSecond: FLOOR })
    guard.reset(T0)
    guard.sample({ downloadedBytes: 0, totalBytes: -1, now: T0 + SAMPLE_INTERVAL_MS })
    guard.sample({ downloadedBytes: 5000, totalBytes: -1, now: T0 + SAMPLE_INTERVAL_MS })

    // 下一拍的速率仍按上一个有效采样起算：5000 字节 / 2 秒。
    // 要是那次同毫秒采样吃掉了基线，这里会算出 0。
    const next = guard.sample({ downloadedBytes: 5000, totalBytes: -1, now: T0 + SAMPLE_INTERVAL_MS * 2 })
    expect(next.bytesPerSecond).toBe(5000 / (SAMPLE_INTERVAL_MS / 1000))
  })

  it('时钟被回拨时不产出速率', () => {
    const guard = createSlowSpeedGuard({ floorBytesPerSecond: FLOOR })
    guard.reset(T0)
    guard.sample({ downloadedBytes: 0, totalBytes: -1, now: T0 + SAMPLE_INTERVAL_MS })

    const rolledBack = guard.sample({ downloadedBytes: 9000, totalBytes: -1, now: T0 - 60_000 })

    expect(rolledBack.bytesPerSecond).toBe(0)
    expect(Number.isNaN(rolledBack.bytesPerSecond)).toBe(false)
    expect(rolledBack.triggered).toBe(false)
  })

  it('没调 reset() 时第一次采样只立基线', () => {
    const guard = createSlowSpeedGuard({ floorBytesPerSecond: FLOOR })

    expect(guard.sample({ downloadedBytes: 12345, totalBytes: -1, now: T0 })).toEqual({
      triggered: false,
      bytesPerSecond: 0,
      slowForMs: 0
    })
  })

  it('回退的累计字节数当成 0 增量，不产出负速率', () => {
    const guard = createSlowSpeedGuard({ floorBytesPerSecond: FLOOR })
    guard.reset(T0)
    guard.sample({ downloadedBytes: 10_000, totalBytes: -1, now: T0 + SAMPLE_INTERVAL_MS })

    expect(guard.sample({ downloadedBytes: 4000, totalBytes: -1, now: T0 + SAMPLE_INTERVAL_MS * 2 }).bytesPerSecond).toBe(0)
  })
})

describe('收尾豁免', () => {
  it('剩余量不足 MIN_REMAINING_BYTES 时不动手', () => {
    const guard = createSlowSpeedGuard({ floorBytesPerSecond: FLOOR })
    const driver = drive(guard, BYTES_AT_VERDICT + MIN_REMAINING_BYTES - 1)
    const verdicts = driver.steps(GRACE_STEPS + SUSTAIN_STEPS, SLOW_STEP)

    expect(verdicts.some(verdict => verdict.triggered)).toBe(false)
    // 「慢」在算术上成立，只是收尾阶段重启一定是亏的，所以累计照记、判定不发
    expect(verdicts[verdicts.length - 1]?.slowForMs).toBe(DEFAULT_SUSTAIN_MS)
    expect(driver.steps(10, SLOW_STEP).some(verdict => verdict.triggered)).toBe(false)
  })

  it('剩余量正好等于 MIN_REMAINING_BYTES 时照判', () => {
    const guard = createSlowSpeedGuard({ floorBytesPerSecond: FLOOR })
    const driver = drive(guard, BYTES_AT_VERDICT + MIN_REMAINING_BYTES)

    expect(driver.steps(GRACE_STEPS + SUSTAIN_STEPS, SLOW_STEP).some(verdict => verdict.triggered)).toBe(true)
  })

  it.each([
    ['未知总量', -1],
    ['总量为 0', 0]
  ])('%s 时不豁免 —— 算不出剩多少，但限速照样存在', (_label, totalBytes) => {
    const guard = createSlowSpeedGuard({ floorBytesPerSecond: FLOOR })

    expect(drive(guard, totalBytes).steps(GRACE_STEPS + SUSTAIN_STEPS, SLOW_STEP).some(verdict => verdict.triggered)).toBe(true)
  })

  it('minRemainingBytes 为 0 等于关掉豁免', () => {
    const guard = createSlowSpeedGuard({
      floorBytesPerSecond: FLOOR,
      graceMs: 0,
      sustainMs: SAMPLE_INTERVAL_MS,
      minRemainingBytes: 0
    })

    // 只剩 1 个字节也判
    expect(guard.sample({ downloadedBytes: 0, totalBytes: 1, now: T0 }).triggered).toBe(false)
    guard.reset(T0)
    expect(guard.sample({ downloadedBytes: 1, totalBytes: 2, now: T0 + SAMPLE_INTERVAL_MS }).triggered).toBe(true)
  })
})

describe('地板速为 0 时看守关闭', () => {
  it.each([
    ['0', 0],
    ['负数', -1024],
    ['NaN', Number.NaN],
    ['undefined', undefined as unknown as number]
  ])('%s 一律当关掉处理', (_label, floorBytesPerSecond) => {
    const guard = createSlowSpeedGuard({ floorBytesPerSecond })
    const driver = drive(guard)

    for (const verdict of driver.steps(GRACE_STEPS + SUSTAIN_STEPS + 5, 0)) {
      expect(verdict).toEqual({ triggered: false, bytesPerSecond: 0, slowForMs: 0 })
    }
  })
})

describe('isSlowDownloadAbort', () => {
  it('认 code', () => {
    expect(isSlowDownloadAbort(Object.assign(new Error('x'), { code: SLOW_DOWNLOAD_ABORT_CODE }))).toBe(true)
  })

  it('认 kkkSlowAbort —— axios 把 code 盖成 ERR_CANCELED 之后只剩这一份', () => {
    expect(isSlowDownloadAbort(Object.assign(new Error('x'), { code: 'ERR_CANCELED', kkkSlowAbort: true }))).toBe(true)
    expect(isSlowDownloadAbort({ kkkSlowAbort: true })).toBe(true)
  })

  it.each([
    ['普通取消', Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' })],
    ['断流', Object.assign(new Error('reset'), { code: 'ECONNRESET' })],
    ['裸 Error', new Error('boom')],
    ['字符串形状的标记', { kkkSlowAbort: 'true' }],
    ['null', null],
    ['undefined', undefined],
    ['字符串', SLOW_DOWNLOAD_ABORT_CODE],
    ['数字', 1]
  ])('%s 不算低速中断', (_label, error) => {
    expect(isSlowDownloadAbort(error)).toBe(false)
  })
})

describe('createSlowDownloadError', () => {
  it('两个标记都打上，且能被自己认出来', () => {
    const error = createSlowDownloadError(100 * 1024, FLOOR)

    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe(SLOW_DOWNLOAD_ABORT_CODE)
    expect(error.kkkSlowAbort).toBe(true)
    expect(isSlowDownloadAbort(error)).toBe(true)
  })

  it('文案里带上观测速率与地板速', () => {
    expect(createSlowDownloadError(100 * 1024, 256 * 1024).message).toBe('下载速度持续低于下限（100KB/s < 256KB/s）')
  })

  it('速率取整到 KB，不出现小数', () => {
    expect(createSlowDownloadError(0.1 * 1024 * 1024, FLOOR).message).toContain('102KB/s')
  })
})

describe('常量之间的约束', () => {
  it('宽限期盖得住 workType.ts 记过的 5.7 秒冷握手', () => {
    expect(DEFAULT_GRACE_MS).toBeGreaterThan(5700)
  })

  it('sustain 比宽限期长，且是采样间隔的整数倍', () => {
    expect(DEFAULT_SUSTAIN_MS).toBeGreaterThan(DEFAULT_GRACE_MS)
    expect(DEFAULT_SUSTAIN_MS % SAMPLE_INTERVAL_MS).toBe(0)
  })

  it('注释里那笔账：0.1MB/s 熬过 sustain 正好下了 2MB，即收尾豁免的那个量', () => {
    expect(0.1 * 1024 * 1024 * (DEFAULT_SUSTAIN_MS / 1000)).toBe(MIN_REMAINING_BYTES)
  })
})
