import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ directory: '', removeCache: true }))
vi.mock('../../src/module/utils/Common.js', () => ({
  default: {
    get tempDri () { return { images: state.directory } },
    mkdir: async () => true,
    removeFile: async (filePath: string) => { await unlink(filePath); return true }
  }
}))
vi.mock('../../src/module/utils/Config.js', () => ({
  default: {
    get app () { return { removeCache: state.removeCache } },
    upload: { imageSendMode: 'file' },
    request: {}
  }
}))
vi.mock('../../src/module/utils/Network/index.js', () => ({ baseHeaders: {} }))
vi.mock('axios', () => ({ default: { get: async (url: string) => ({ data: Buffer.from(url) }) } }))
vi.mock('node:child_process', () => ({
  execFile: (_file: string, _args: string[], options: unknown, callback?: (error: null, stdout: string, stderr: string) => void) => {
    const done = typeof options === 'function' ? options as typeof callback : callback
    done?.(null, '', '')
  }
}))

const { mergeFile } = await import('../../src/module/utils/FFmpeg.js')
const { processImageUrl } = await import('../../src/module/utils/ImageHelper.js')

beforeAll(async () => {
  state.directory = await mkdtemp(path.join(tmpdir(), 'kkkkkk-media-owner-'))
  globalThis.logger = { mark: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as typeof logger
})
afterEach(() => vi.useRealTimers())
afterAll(async () => { await rm(state.directory, { recursive: true, force: true }) })

describe('media file ownership', () => {
  it('preserves a shared compression source for the next consumer', async () => {
    const source = path.join(state.directory, 'shared.mp4')
    await writeFile(source, 'recording shared by two recipients')
    await mergeFile('压缩视频', { path: source, resultPath: path.join(state.directory, 'compressed.mp4'), targetBitrate: 100 })
    await new Promise(resolve => setImmediate(resolve))
    expect(existsSync(source)).toBe(true)
    expect(await readFile(source, 'utf8')).toBe('recording shared by two recipients')
  })

  it('keeps concurrent images distinct when their timestamps and indices match', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-27T10:00:00Z'))
    const [first, second] = await Promise.all([
      processImageUrl('https://example.test/first.jpg', 'title', 0),
      processImageUrl('https://example.test/second.jpg', 'title', 0)
    ])
    expect(first).not.toBe(second)
    expect(await readFile(first.slice('file://'.length), 'utf8')).toBe('https://example.test/first.jpg')
    expect(await readFile(second.slice('file://'.length), 'utf8')).toBe('https://example.test/second.jpg')
  })
})
