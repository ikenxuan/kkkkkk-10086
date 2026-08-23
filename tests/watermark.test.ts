import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { embedWatermark } from '../src/module/utils/Watermark'

// globalThis.logger 在全局声明里是必填的 Logger，所以只能先转成 unknown 再转成
// 带可选 logger 的形状，否则 delete 会报 TS2790、塞部分实现的 mock 会报 TS2740。
const globalWithLogger = globalThis as unknown as { logger?: unknown }

describe('embedWatermark', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete globalWithLogger.logger
  })

  it('returns a PNG buffer when the encoder returns a result object', async () => {
    const input = readFileSync(fileURLToPath(new URL('../resources/image/logo.png', import.meta.url)))

    const result = await embedWatermark(input, 'watermark-test')

    expect(Buffer.isBuffer(result)).toBe(true)
    expect(result?.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  })

  it('does not duplicate warnings when the host logger returns undefined', async () => {
    const hostWarn = vi.fn()
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    globalWithLogger.logger = { warn: hostWarn }

    const result = await embedWatermark(Buffer.from('not-an-image'), 'watermark-test')

    expect(result).toBeNull()
    expect(hostWarn).toHaveBeenCalledTimes(1)
    expect(consoleWarn).not.toHaveBeenCalled()
  })
})
