import { describe, expect, it } from 'vitest'

import {
  formatBytes,
  formatDuration,
  formatDurationClock,
  formatPercent
} from '../../ktr/utils/media-format'

describe('formatDuration', () => {
  it('按「读起来自然」进位：满 1 分才用分，满 1 小时才用小时', () => {
    // 阈值不是数学整齐而是可读性：`90分` 比 `1.5小时` 难心算，
    // `0.8分` 更是没人这么读
    expect(formatDuration(45_000)).toEqual({ value: '45', unit: '秒' })
    expect(formatDuration(59_999)).toEqual({ value: '60', unit: '秒' })
    expect(formatDuration(60_000)).toEqual({ value: '1', unit: '分' })
    expect(formatDuration(90_000)).toEqual({ value: '1.5', unit: '分' })
    expect(formatDuration(3_600_000)).toEqual({ value: '1', unit: '小时' })
    expect(formatDuration(5_400_000)).toEqual({ value: '1.5', unit: '小时' })
  })

  it('整数不留 `.0` 尾巴', () => {
    expect(formatDuration(120_000).value).toBe('2')
    expect(formatDuration(7_200_000).value).toBe('2')
  })

  it('脏数据渲染成 0 秒而不是 NaN小时', () => {
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatDuration(value)).toEqual({ value: '0', unit: '秒' })
    }
  })
})

describe('formatDurationClock', () => {
  it('满 1 小时带小时段，不满则只有分秒', () => {
    expect(formatDurationClock(754_000)).toBe('12:34')
    expect(formatDurationClock(5_025_000)).toBe('1:23:45')
  })

  it('分秒补零，秒数向下取整', () => {
    expect(formatDurationClock(65_900)).toBe('1:05')
    expect(formatDurationClock(3_605_000)).toBe('1:00:05')
  })

  it('脏数据落到 0:00', () => {
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatDurationClock(value)).toBe('0:00')
    }
  })
})

describe('formatBytes', () => {
  it('走 1024 进制，与平台侧的体积阈值口径一致', () => {
    expect(formatBytes(1024)).toEqual({ value: '1', unit: 'KB' })
    expect(formatBytes(1024 * 1024)).toEqual({ value: '1', unit: 'MB' })
    expect(formatBytes(1024 * 1024 * 1024)).toEqual({ value: '1', unit: 'GB' })
    expect(formatBytes(1.5 * 1024 * 1024)).toEqual({ value: '1.5', unit: 'MB' })
  })

  it('B 不带小数：`1.5B` 是无意义的精度', () => {
    expect(formatBytes(512)).toEqual({ value: '512', unit: 'B' })
    expect(formatBytes(1023.6)).toEqual({ value: '1024', unit: 'B' })
  })

  it('顶到 TB 就不再往上进，超大值也不会越界取到 undefined 单位', () => {
    expect(formatBytes(1024 ** 5)).toEqual({ value: '1024', unit: 'TB' })
  })

  it('脏数据渲染成 0 B', () => {
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatBytes(value)).toEqual({ value: '0', unit: 'B' })
    }
  })
})

describe('formatPercent', () => {
  it('保留一位小数，整数不留尾巴', () => {
    expect(formatPercent(1)).toBe('100%')
    expect(formatPercent(0.995)).toBe('99.5%')
    expect(formatPercent(0)).toBe('0%')
  })

  it('超出 0~1 的值夹回区间，不渲染 `-50%` 或 `250%`', () => {
    expect(formatPercent(1.5)).toBe('100%')
    expect(formatPercent(-0.5)).toBe('0%')
    expect(formatPercent(Number.NaN)).toBe('0%')
  })
})
