import { describe, expect, it, vi } from 'vitest'
import {
  decideCoverTheme,
  resolveUseDarkTheme,
  type CoverThemePixel,
  type CoverThemeStats
} from '../../src/module/utils/Common.js'

vi.mock('../../src/module/utils/Base.js', () => ({
  Base: { getBotAdapterName: () => '' }
}))
vi.mock('../../src/module/utils/Config.js', () => ({
  default: { app: { Theme: 0 } }
}))
vi.mock('../../src/module/utils/Networks.js', () => ({
  Networks: class NetworksMock {}
}))
vi.mock('../../src/module/utils/Version.js', () => ({
  default: { clientPath: process.cwd(), pluginName: 'theme-test' }
}))
const pixels = (...colors: Array<[number, number, number, number?]>): Uint8Array =>
  new Uint8Array(colors.flatMap(([r, g, b, alpha = 255]) => [r, g, b, alpha]))

const localDate = (hour: number): Date => new Date(2026, 0, 1, hour, 0, 0, 0)

describe('cover-driven theme decisions', () => {
  it('classifies black covers as dark and white covers as light', () => {
    const black = decideCoverTheme(pixels([0, 0, 0], [8, 8, 8]))
    const white = decideCoverTheme(pixels([255, 255, 255], [248, 248, 248]))

    expect(black?.useDarkTheme).toBe(true)
    expect(white?.useDarkTheme).toBe(false)
  })

  it('keeps highly saturated dark-color covers on the dark theme', () => {
    const red = decideCoverTheme(pixels([220, 20, 30], [180, 10, 20]))

    expect(red?.vividRatio).toBe(1)
    expect(red?.useDarkTheme).toBe(true)
  })

  it('accepts precomputed statistics and rejects failed or invalid cover reads', () => {
    const lightStats: CoverThemeStats = {
      averageLuma: 0.95,
      darkRatio: 0,
      brightRatio: 1,
      vividRatio: 0
    }
    const darkPixel: CoverThemePixel = { r: 0, g: 0, b: 0, alpha: 255 }

    expect(decideCoverTheme(lightStats)?.useDarkTheme).toBe(false)
    expect(decideCoverTheme([darkPixel])?.useDarkTheme).toBe(true)
    expect(decideCoverTheme(null)).toBeNull()
    expect(decideCoverTheme(new Uint8Array())).toBeNull()
    expect(decideCoverTheme(new Uint8Array([0, 0, 0]))).toBeNull()
    expect(decideCoverTheme({ averageLuma: Number.NaN })).toBeNull()
  })

  it('resolves Theme 0 by time, Theme 1 as light, and Theme 2 as dark', () => {
    expect(resolveUseDarkTheme(0, undefined, localDate(12))).toBe(false)
    expect(resolveUseDarkTheme(0, undefined, localDate(23))).toBe(true)
    expect(resolveUseDarkTheme(1, undefined, localDate(23))).toBe(false)
    expect(resolveUseDarkTheme(2, undefined, localDate(12))).toBe(true)
  })

  it('uses the cover for Theme 3 and falls back to Theme 0 when reading fails', () => {
    const white = pixels([255, 255, 255], [255, 255, 255])
    const black = pixels([0, 0, 0], [0, 0, 0])

    expect(resolveUseDarkTheme(3, white, localDate(23))).toBe(false)
    expect(resolveUseDarkTheme(3, black, localDate(12))).toBe(true)
    expect(resolveUseDarkTheme(3, null, localDate(12))).toBe(false)
    expect(resolveUseDarkTheme(3, null, localDate(23))).toBe(true)
  })
})
