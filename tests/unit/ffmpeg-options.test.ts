import { afterEach, describe, expect, it, vi } from 'vitest'

const commonMock = vi.hoisted(() => ({
  calculateBitrate: vi.fn(() => 100),
  getVideoFileSize: vi.fn(async () => 1),
  removeFile: vi.fn(),
  registerVideoPreview: vi.fn(),
  tempDri: { video: '' }
}))

const configMock = vi.hoisted(() => ({
  cookies: {} as Record<string, string | null | undefined>,
  request: {} as Record<string, unknown>,
  pushlist: {},
  upload: {} as Record<string, unknown>,
  app: {} as Record<string, unknown>
}))

const mergeFileMock = vi.hoisted(() => vi.fn())

vi.mock('../../src/module/utils/Common.js', () => ({
  default: commonMock
}))

vi.mock('../../src/module/platform/bilibili/api.js', () => ({
  getBilibiliData: vi.fn()
}))

vi.mock('../../src/module/platform/douyin/api.js', () => ({
  getDouyinData: vi.fn()
}))

vi.mock('../../src/module/utils/FFmpeg.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/module/utils/FFmpeg.js')>()
  return {
    ...actual,
    mergeFile: mergeFileMock
  }
})

vi.mock('../../src/module/utils/Networks.js', () => ({
  Networks: class {},
  baseHeaders: {}
}))

vi.mock('../../src/runtime/host/config.js', () => ({
  default: { masterQQ: [] }
}))

vi.mock('../../src/module/utils/Render.js', () => ({
  Render: vi.fn()
}))

vi.mock('../../src/module/utils/Version.js', () => ({
  default: {
    BotName: 'TRSS-Yunzai',
    BotVersion: 'test',
    version: 'test'
  }
}))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: configMock
}))

vi.mock('@ikenxuan/watermark', () => ({
  embedWatermarkToPngBytes: vi.fn(() => ({
    buffer: Buffer.from('watermarked'),
    wmSize: 8
  }))
}))

import {
  normalizeCompressionOptions,
  normalizeLoopVideoOptions
} from '../../src/module/utils/FFmpeg.js'
import {
  Base,
  uploadFile
} from '../../src/module/utils/Base.js'
import { embedWatermark } from '../../src/module/utils/Watermark.js'

const amagiDependencies = {
  default: vi.fn(() => ({})),
  bilibiliErrorCodeMap: {},
  getBilibiliData: vi.fn(),
  getDouyinData: vi.fn()
}

const createUploadEvent = (
  reply?: (message: unknown) => Promise<unknown>,
  friend?: object
) => ({
  isGroup: false,
  bot: {
    adapter: { name: 'ICQQ' }
  },
  friend,
  reply
})

const uploadDependencies = {
  resolveBotAdapter: () => 'ICQQ'
}

const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
const loggerError = vi.fn()
const loggerWarn = vi.fn()
const defaultLogger = {
  error: loggerError,
  mark: vi.fn(),
  warn: loggerWarn,
  yellow: (message: string) => message,
  debug: vi.fn(),
  info: vi.fn(),
  hex: (color: string) => (message: string) => `${color}${message}`
}
const defaultSegment = {
  file: vi.fn(file => ({ type: 'file', file })),
  video: vi.fn(file => ({ type: 'video', file })),
  reply: vi.fn(messageId => ({ type: 'reply', messageId }))
}

globalThis.logger = defaultLogger as unknown as typeof logger
globalThis.segment = defaultSegment as unknown as typeof segment

afterEach(() => {
  globalThis.logger = defaultLogger as unknown as typeof logger
  globalThis.segment = defaultSegment as unknown as typeof segment
  warnSpy.mockClear()
  loggerError.mockClear()
  loggerWarn.mockClear()
  defaultLogger.mark.mockClear()
  defaultLogger.debug.mockClear()
  defaultLogger.info.mockClear()
  defaultSegment.file.mockClear()
  defaultSegment.video.mockClear()
  defaultSegment.reply.mockClear()
  configMock.cookies = {}
  configMock.request = {}
  configMock.pushlist = {}
  configMock.upload = {}
  configMock.app = {}
  mergeFileMock.mockReset()
})

describe('Base compatibility', () => {
  it('falls back to ICQQ when a scheduled task has no event', () => {
    expect(new Base(undefined, amagiDependencies).botadapter).toBe('ICQQ')
  })

  it('keeps handling truthy non-object Douyin responses as API errors', async () => {
    const getDouyinData = vi.fn().mockResolvedValue('unexpected')
    const base = new Base(undefined, {
      ...amagiDependencies,
      getDouyinData
    })
    const call = base.amagi.getDouyinData as () => Promise<unknown>

    await expect(call()).rejects.toThrow()
  })

  it('uses the event reply even when no contact target is attached', async () => {
    const reply = vi.fn().mockResolvedValue({ message_id: 'sent' })

    await expect(uploadFile(
      createUploadEvent(reply),
      { filepath: 'preview.mp4', totalBytes: 1 },
      '',
      undefined,
      uploadDependencies
    )).resolves.toBe(true)
    expect(reply).toHaveBeenCalledTimes(1)
  })

  it('keeps falsy message IDs classified as failed sends', async () => {
    const reply = vi.fn().mockResolvedValue({ message_id: 0 })

    await expect(uploadFile(
      createUploadEvent(reply, {}),
      { filepath: 'preview.mp4', totalBytes: 1 },
      '',
      undefined,
      uploadDependencies
    )).resolves.toBe(false)
  })

  it('logs the original upload error when an event has no reply method', async () => {
    await expect(uploadFile(
      createUploadEvent(undefined, {}),
      { filepath: 'preview.mp4', totalBytes: 1 },
      '',
      undefined,
      uploadDependencies
    )).resolves.toBe(false)
    expect(loggerError).toHaveBeenCalledTimes(1)
  })

  it('preserves Amagi accessor receivers', () => {
    class GetterClient {
      #value = 'ready'

      get status (): string {
        return this.#value
      }
    }

    const base = new Base(undefined, {
      ...amagiDependencies,
      default: vi.fn(() => new GetterClient()) as unknown as typeof amagiDependencies.default
    })

    expect(base.amagi.status).toBe('ready')
  })

  it('forwards configured null cookies unchanged', () => {
    configMock.cookies = {
      douyin: null,
      bilibili: null,
      kuaishou: null,
      xiaohongshu: null
    }
    const Client = vi.fn(() => ({}))

    expect(new Base(undefined, {
      ...amagiDependencies,
      default: Client
    }).amagi).toBeTruthy()

    expect(Client).toHaveBeenCalledWith(expect.objectContaining({
      cookies: {
        douyin: null,
        bilibili: null,
        kuaishou: null,
        xiaohongshu: null
      }
    }))
  })

  it('keeps handling string-valued Bilibili error codes', async () => {
    const getBilibiliData = vi.fn().mockResolvedValue({
      code: '-400',
      message: 'unexpected'
    })
    const reply = vi.fn()
    const base = new Base({ reply }, {
      ...amagiDependencies,
      bilibiliErrorCodeMap: { [-400]: true },
      getBilibiliData
    })
    const call = base.amagi.getBilibiliData as () => Promise<unknown>

    await expect(call()).rejects.toThrow('unexpected')
    expect(reply).toHaveBeenCalledTimes(1)
  })

  it('keeps numeric compression reply IDs unchanged', async () => {
    configMock.upload = {
      compress: true,
      compresstrigger: 1,
      compressvalue: 1,
      videoSendMode: 'url'
    }
    mergeFileMock
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce('compressed.mp4')
    const reply = vi.fn()
      .mockResolvedValueOnce({ message_id: 123 })
      .mockResolvedValueOnce({ message_id: 'compression-result' })
      .mockResolvedValueOnce({ message_id: 'video-result' })

    await uploadFile(
      createUploadEvent(reply, {}),
      { filepath: 'preview.mp4', totalBytes: 2 },
      '',
      undefined,
      uploadDependencies
    )

    expect(defaultSegment.reply).toHaveBeenCalledWith(123)
  })

  it('keeps compression notice reply failures observable', async () => {
    configMock.upload = {
      compress: true,
      compresstrigger: 1,
      compressvalue: 1,
      videoSendMode: 'url'
    }
    mergeFileMock.mockResolvedValueOnce(10)

    await expect(uploadFile(
      createUploadEvent(undefined, {}),
      { filepath: 'preview.mp4', totalBytes: 2 },
      '',
      undefined,
      uploadDependencies
    )).rejects.toThrow()
  })
})

describe('normalizeCompressionOptions', () => {
  it('derives ffmpeg rate defaults without replacing explicit zero CRF', () => {
    expect(normalizeCompressionOptions({
      path: 'input.mp4',
      resultPath: 'output.mp4',
      targetBitrate: 800,
      crf: 0
    })).toEqual({
      path: 'input.mp4',
      resultPath: 'output.mp4',
      targetBitrate: 800,
      maxRate: 1200,
      bufSize: 1600,
      crf: 0
    })
  })

  it('rejects a missing target bitrate', () => {
    expect(() => normalizeCompressionOptions({
      path: 'input.mp4',
      resultPath: 'output.mp4'
    })).toThrow('压缩视频需要指定目标比特率')
  })
})

describe('normalizeLoopVideoOptions', () => {
  it('clamps loop count and keeps existing transition defaults', () => {
    expect(normalizeLoopVideoOptions({
      inputPath: 'input.mp4',
      outputPath: 'output.mp4',
      loopCount: 0,
      staticImagePath: 'still.jpg'
    })).toEqual({
      inputPath: 'input.mp4',
      outputPath: 'output.mp4',
      loopCount: 1,
      staticImagePath: 'still.jpg',
      transitionEnabled: true,
      mergeMode: 'independent',
      bgmPath: undefined,
      context: undefined
    })
  })
})

describe('embedWatermark', () => {
  it('preserves the logger receiver while falling back to console warnings', async () => {
    const receiverAwareLogger = {
      calls: 0,
      warn (this: { calls: number }): void {
        this.calls++
      }
    }
    globalThis.logger = receiverAwareLogger as unknown as typeof logger
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    expect(await embedWatermark(png, 'watermark')).toBeNull()
    expect(receiverAwareLogger.calls).toBe(1)
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('preserves the pre-migration fallback and warning channels for wrapped encoder results', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    expect(await embedWatermark(png, 'watermark')).toBeNull()
    expect(globalThis.logger.warn).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })
})
