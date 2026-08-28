import { describe, expect, it } from 'vitest'

import {
  formatBytes,
  formatDuration,
  formatDurationClock,
  formatPercent,
  valueSizeClass
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

describe('valueSizeClass', () => {
  /*
    这几个阈值是量出来的，不是调出来的：卡内可用宽 261.3px，数字等宽每位 63.8px，
    最宽单位 `小时` 72px + gap 12px。所以 7rem 下只有 3 字装得下，4 字起必然被
    根节点的 overflow-hidden 切断。改这里的任何一档都要重新量，别照感觉调。
  */
  it('按字符数分档，档位边界不能漂', () => {
    expect(valueSizeClass('1.9')).toBe('text-[7rem]')
    expect(valueSizeClass('347.7')).toBe('text-[4rem]')
    expect(valueSizeClass('1232.6')).toBe('text-[3rem]')
  })

  it('每一档的上下边界都钉住，避免 off-by-one 把 4 字放回 7rem', () => {
    // 3 字及以下同档：`0`~`1.9` 都是最大号
    expect(valueSizeClass('0')).toBe('text-[7rem]')
    expect(valueSizeClass('12')).toBe('text-[7rem]')
    expect(valueSizeClass('512')).toBe('text-[7rem]')
    // 边界：第 4 个字符就必须降档
    expect(valueSizeClass('61.6')).toBe('text-[5rem]')
    expect(valueSizeClass('1024')).toBe('text-[5rem]')
    // 6 字以上不再细分，统一最小档
    expect(valueSizeClass('12345678')).toBe('text-[3rem]')
  })

  it('用户截图里那一组：只有体积需要降档，两个时长本来就装得下', () => {
    /*
      这条是回归锚点：线上出问题的是 1.9小时 / 6.8分 / 347.7MB 这一组。
      三个数里**只有体积**是 5 字、真的超宽（281.2px > 可用 261.3px），
      两个时长都是 3 字，7rem 下分别还剩 +23.7 / +71.7 的余量 —— 它们那一格
      看着「溢出」是另一条失效路径：单位 `小时` 被挤到在 小/时 之间折行，
      已经用 whitespace-nowrap + shrink-0 单独修掉了，不归字号管。
      所以这里必须断言时长**留在** 7rem：要是哪天顺手把它们也降档，
      就是在为一个不存在的宽度问题牺牲字号。

      不写死 '347.7'，而是从 formatBytes / formatDuration 的真实产出取值 ——
      否则哪天进位阈值或小数位数改了、字符数跟着变，这里还是绿的，而卡片又溢出了。
    */
    expect(valueSizeClass(formatBytes(364_612_812).value)).toBe('text-[4rem]')
    expect(valueSizeClass(formatDuration(6_840_000).value)).toBe('text-[7rem]')
    expect(valueSizeClass(formatDuration(408_000).value)).toBe('text-[7rem]')
  })

  it('每一档都有真实格式化能产出的值，没有一档是死代码', () => {
    // 反过来验：如果某档再也走不到，说明阈值和格式化产出脱节了
    const reachable = new Set([
      valueSizeClass(formatDuration(3_600_000).value), // `1`      → 7rem
      valueSizeClass(formatDuration(221_868_000).value), // `61.6` → 5rem
      valueSizeClass(formatBytes(364_612_812).value), // `347.7`   → 4rem
      valueSizeClass(formatBytes(1024 ** 5).value) // `1024`（TB 顶格）
    ])
    expect(reachable.has('text-[7rem]')).toBe(true)
    expect(reachable.has('text-[5rem]')).toBe(true)
    expect(reachable.has('text-[4rem]')).toBe(true)
  })
})
