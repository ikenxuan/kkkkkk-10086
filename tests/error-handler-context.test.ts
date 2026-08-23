import { afterEach, describe, expect, it } from 'vitest'

import {
  createLogContext,
  parseLogsToStructured
} from '../src/module/utils/ErrorHandler/log-context.js'
import {
  getAdapterInfo,
  getAdapterLogoPath
} from '../src/module/utils/ErrorHandler/adapter.js'
import { formatBuildTime } from '../src/module/tooling/build-metadata.js'

// globalThis.logger 在全局声明里是必填的 Logger，所以只能先转成 unknown 再转成
// 带可选 logger 的形状，否则塞部分实现的 mock 会报 TS2740。
const globalWithLogger = globalThis as unknown as { logger?: unknown }

const originalLogger = globalWithLogger.logger

afterEach(() => {
  globalWithLogger.logger = originalLogger
})

describe('error handler context logs', () => {
  it('captures logs from concurrent async contexts without mixing entries', async () => {
    const hostLogger = {
      info: (...args: unknown[]) => args,
      warn: (...args: unknown[]) => args
    }
    globalWithLogger.logger = hostLogger

    const first = createLogContext()
    const second = createLogContext()

    await Promise.all([
      first.run(async () => {
        globalThis.logger?.info('first:start')
        await new Promise(resolve => setTimeout(resolve, 5))
        globalThis.logger?.warn('first:end')
      }),
      second.run(async () => {
        globalThis.logger?.info('second:start')
        await new Promise(resolve => setTimeout(resolve, 1))
        globalThis.logger?.warn('second:end')
      })
    ])

    expect(first.logs().map(log => log.message)).toEqual(['first:start', 'first:end'])
    expect(second.logs().map(log => log.message)).toEqual(['second:start', 'second:end'])
  })

  it('converts host log lines into handler error entries', () => {
    expect(parseLogsToStructured([
      '[12:00:00.123][INFO] 请求开始',
      '[12:00:00.124][ERRO] 请求失败',
      '[12:00:00.125][TRAC] 不应显示'
    ])).toEqual([
      { timestamp: '12:00:00.123', level: 'INFO', message: '请求开始', raw: '[12:00:00.123][INFO] 请求开始' },
      { timestamp: '12:00:00.124', level: 'ERRO', message: '请求失败', raw: '[12:00:00.124][ERRO] 请求失败' }
    ])
  })
})

describe('adapter metadata', () => {
  it('uses bot.version.app_name when an adapter has no display name', () => {
    const info = getAdapterInfo({
      adapter_name: 'OneBotv11',
      bot: {
        adapter: { id: 'onebot', platform: 'qq', version: '11' },
        version: { app_name: 'NapCat', version: '4.8.12' }
      }
    })

    expect(info?.name).toBe('NapCat')
    expect(info?.version).toBe('11')
    expect(info?.standard).toBe('OneBot')
  })

  it('matches protocol logos using all adapter metadata fields', () => {
    expect(getAdapterLogoPath({ name: 'Milky', version: '1.0', standard: 'unknown' })).toBe(
      '/image/other/handlerError/Milky.png'
    )
    expect(getAdapterLogoPath({ name: 'Lagrange.OneBot', version: '1.0', standard: 'OneBot' })).toBe(
      '/image/other/handlerError/lagrange.webp'
    )
  })
})

describe('build metadata', () => {
  it('formats ISO build timestamps for the error report', () => {
    expect(formatBuildTime('2026-08-19T06:30:00.000Z')).toMatch(/^2026年08月19日 /)
  })
})
