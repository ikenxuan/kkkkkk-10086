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

// 两个平台必须合到一份替身里：amagiClient 是同一个模块，分两次 vi.mock 同一路径
// 后一次会静默盖掉前一次。
// importOriginal 只为拿到真的 wrapAmagiClient，不会拖上 amagi —— 那四个 fetcher 是
// lazyFetcher，只在属性访问时才 require，而这里两个都被替身盖掉了。
vi.mock('../../src/module/utils/amagiClient.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/module/utils/amagiClient.js')>()
  return {
    ...actual,
    bilibiliFetcher: new Proxy({}, { get: () => vi.fn() }),
    douyinFetcher: new Proxy({}, { get: () => vi.fn() }),
    buildAmagiRequestConfig: vi.fn(() => ({}))
  }
})

vi.mock('../../src/module/utils/FFmpeg.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/module/utils/FFmpeg.js')>()
  return {
    ...actual,
    mergeFile: mergeFileMock
  }
})

vi.mock('../../src/module/utils/Network/index.js', () => ({
  Networks: class {},
  baseHeaders: {}
}))

vi.mock('../../src/runtime/host/config.js', () => ({
  default: { masterQQ: [] }
}))

vi.mock('../../src/module/utils/Render.js', () => ({
  Render: vi.fn()
}))

// 推送路径的投递出口。这份用例只关心「卡片有没有被渲出来」，不关心发给了谁；
// 不挡掉它就会去碰宿主的 globalThis.Bot，在这里是 undefined。
vi.mock('../../src/module/utils/masterMessage.js', () => ({
  sendMasterMessage: vi.fn(async () => undefined)
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

import { embedWatermarkToPngBytes, type EmbedOutput } from '@ikenxuan/watermark'
import type { BilibiliFetcher } from '@ikenxuan/amagi'
import {
  normalizeCompressionOptions,
  normalizeLoopVideoOptions
} from '../../src/module/utils/FFmpeg.js'
import { wrapAmagiClient } from '../../src/module/utils/amagiClient.js'
import { Render } from '../../src/module/utils/Render.js'
import {
  Base,
  isRemoteVideoTooLargeForUrlSend,
  uploadFile
} from '../../src/module/utils/Base.js'
import { embedWatermark } from '../../src/module/utils/Watermark.js'

const encoderMock = vi.mocked(embedWatermarkToPngBytes)

// default + bilibiliErrorCodeMap 同时给齐，getAmagiDependencies 才走短路分支、
// 不去 require('@ikenxuan/amagi')；两个 fetcher 由上面的模块替身兜底。
const amagiDependencies = {
  default: vi.fn(() => ({})),
  bilibiliErrorCodeMap: {}
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
    // 字符串码必须按线上的方式进来：wrapAmagiClient 把失败信封抛成 AmagiError，
    // 而 AmagiError.code 声明是 number —— 直接 new 一个就得给 code 加 cast，
    // 那就把「运行期真的会收到字符串」这个前提盖掉了。
    // 归一化在 readAmagiFailureCode 里，Base 拿它的结果去查 bilibiliErrorCodeMap。
    //
    // 无事件驱动：有事件时 Base 一律原样抛、不出卡（卡片只有 ErrorHandler 一个出口），
    // 那条登记表判断如今只剩推送路径在用，所以要走推送路径才验得到。
    const stub = {
      fetchVideoInfo: async () => ({
        success: false,
        code: '-400',
        message: 'unexpected'
      })
      // satisfies 而不是 as：方法名照 BilibiliFetcher 校验，上游改名时这里会红
    } satisfies Partial<Record<keyof BilibiliFetcher, unknown>>
    const base = new Base(undefined, {
      ...amagiDependencies,
      bilibiliErrorCodeMap: { [-400]: true },
      bilibiliFetcher: wrapAmagiClient(stub) as unknown as BilibiliFetcher
    })

    await expect(base.amagi.bilibili.fetchVideoInfo({ bvid: 'BV1' })).rejects.toThrow('unexpected')
    // 过了登记表这道闸才会去渲卡片；字符串码没归一化的话这里是 0 次
    expect(vi.mocked(Render)).toHaveBeenCalledTimes(1)
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

  it('unwraps QQBot array message IDs before quoting the compression notice', async () => {
    // QQBot（wind-trace/Yunzai-QQBot-Plugin index.js:807）的 message_id 是数组，
    // 直接当标量塞给 segment.reply 会拼出坏引用
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
      .mockResolvedValueOnce({ message_id: ['notice-id'], data: [{ id: 'notice-id' }], error: [] })
      .mockResolvedValueOnce({ message_id: ['result-id'], data: [{ id: 'result-id' }], error: [] })
      .mockResolvedValueOnce({ message_id: ['video-id'], data: [{ id: 'video-id' }], error: [] })

    await uploadFile(
      createUploadEvent(reply, {}),
      { filepath: 'preview.mp4', totalBytes: 2 },
      '',
      undefined,
      uploadDependencies
    )

    expect(defaultSegment.reply).toHaveBeenCalledWith('notice-id')
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

describe('uploadFile 群文件分流', () => {
  const createGroupFileEvent = () => {
    const upload = vi.fn().mockResolvedValue(undefined)
    const reply = vi.fn().mockResolvedValue({ message_id: 'sent' })
    return {
      upload,
      reply,
      event: {
        isGroup: false,
        bot: { adapter: { name: 'ICQQ' } },
        friend: { fs: { upload } },
        reply
      }
    }
  }

  it('尊重调用方传入的 useGroupFile: true，即使 usegroupfile 开关是关着的', async () => {
    // 回归：旧实现在读取之前就用配置覆盖了这个入参，导致 filelimit 放到 1536 也永远走不到群文件
    configMock.upload = {}
    const { upload, reply, event } = createGroupFileEvent()

    await expect(uploadFile(
      event,
      { filepath: 'huge.mp4', totalBytes: 500 },
      '',
      { useGroupFile: true },
      uploadDependencies
    )).resolves.toBe(true)

    expect(upload).toHaveBeenCalledWith('huge.mp4')
    expect(reply).not.toHaveBeenCalled()
  })

  it('调用方传入的 false 只表示「不强制」，不会否决用户配置的分流线', async () => {
    // 如果这里写成 `options?.useGroupFile ?? 配置`，downloadVideo 对小文件传的 false
    // 会把用户设的 groupfilevalue 一起吃掉，这条断言就是防止那种退化
    configMock.upload = { usegroupfile: true, groupfilevalue: 50 }
    const { upload, event } = createGroupFileEvent()

    await expect(uploadFile(
      event,
      { filepath: 'mid.mp4', totalBytes: 60 },
      '',
      { useGroupFile: false },
      uploadDependencies
    )).resolves.toBe(true)

    expect(upload).toHaveBeenCalledWith('mid.mp4')
  })

  it('调用方没要求、配置也没开时仍然走消息段', async () => {
    configMock.upload = { usegroupfile: false }
    const { upload, reply, event } = createGroupFileEvent()

    await expect(uploadFile(
      event,
      { filepath: 'small.mp4', totalBytes: 500 },
      '',
      undefined,
      uploadDependencies
    )).resolves.toBe(true)

    expect(upload).not.toHaveBeenCalled()
    expect(reply).toHaveBeenCalledWith({ type: 'video', file: 'file://small.mp4' })
  })

  it('配置的分流线未越过时不会误走群文件', async () => {
    configMock.upload = { usegroupfile: true, groupfilevalue: 100 }
    const { upload, reply, event } = createGroupFileEvent()

    await expect(uploadFile(
      event,
      { filepath: 'small.mp4', totalBytes: 80 },
      '',
      { useGroupFile: false },
      uploadDependencies
    )).resolves.toBe(true)

    expect(upload).not.toHaveBeenCalled()
    expect(reply).toHaveBeenCalledTimes(1)
  })

  it('群文件接口缺失时如实报失败，不再假装发送成功', async () => {
    // icqq 只有 Group 有 fs（lib/group.d.ts 的 readonly fs: Gfs），私聊的 Friend 没有；
    // 旧实现被可选链吞掉后照样 return true，文件没发出去却报成功
    configMock.upload = {}
    const reply = vi.fn().mockResolvedValue({ message_id: 'sent' })
    const event = {
      isGroup: false,
      bot: { adapter: { name: 'ICQQ' } },
      friend: {},
      reply
    }

    await expect(uploadFile(
      event,
      { filepath: 'huge.mp4', totalBytes: 500 },
      '',
      { useGroupFile: true },
      uploadDependencies
    )).resolves.toBe(false)

    expect(loggerError).toHaveBeenCalledTimes(1)
    expect(reply).not.toHaveBeenCalled()
  })
})

describe('isRemoteVideoTooLargeForUrlSend', () => {
  it('体积探不到时一律放行，不许堵住远程直发', () => {
    // downloadVideo 探不到 content-range 时算出来的就是 0，这是常态而非异常：
    // 判成 true 会让所有不给响应头的源站永久失去远程直发能力
    expect(isRemoteVideoTooLargeForUrlSend(0)).toBe(false)
    expect(isRemoteVideoTooLargeForUrlSend(NaN)).toBe(false)
    expect(isRemoteVideoTooLargeForUrlSend(-1)).toBe(false)
    expect(isRemoteVideoTooLargeForUrlSend(Infinity)).toBe(false)
  })

  it('体积已知且超上限时才拦，且不再按适配器分档', () => {
    // 原来 QQBot 按 75MB、名单内适配器按 102MB；现在统一一个上限，
    // 「要不要走群文件」全交给 upload.usegroupfile / groupfilevalue
    expect(isRemoteVideoTooLargeForUrlSend(75.1)).toBe(false)
    expect(isRemoteVideoTooLargeForUrlSend(101.9)).toBe(false)
    expect(isRemoteVideoTooLargeForUrlSend(102)).toBe(false)
    expect(isRemoteVideoTooLargeForUrlSend(102.5)).toBe(true)
    expect(isRemoteVideoTooLargeForUrlSend(500)).toBe(true)
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
  const png = () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  it('unwraps the encoder EmbedOutput instead of discarding the watermark', async () => {
    // 真实的 embedWatermarkToPngBytes 返回 { buffer, wmSize }，从来不是裸 Buffer。
    // 迁移前的 toWatermarkBuffer 不认这层包装，于是每一张图都拿到 null——
    // 隐水印实际上一次都没嵌进去过，还顺带每次渲染都打一条 warn。
    expect(await embedWatermark(png(), 'watermark')).toEqual(Buffer.from('watermarked'))
    expect(loggerWarn).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('warns through the host logger with its receiver intact when the result is unusable', async () => {
    const receiverAwareLogger = {
      calls: 0,
      warn (this: { calls: number }): void {
        this.calls++
      }
    }
    globalThis.logger = receiverAwareLogger as unknown as typeof logger
    encoderMock.mockReturnValueOnce({ wmSize: 8 } as unknown as EmbedOutput)

    expect(await embedWatermark(png(), 'watermark')).toBeNull()
    // 以方法形式调用（而不是取下来的裸函数），否则 this.calls++ 会抛。
    expect(receiverAwareLogger.calls).toBe(1)
    // 宿主 logger 成功接收后不应再往 console 重复打一遍。
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('falls back to console warnings when the host logger rejects the message', async () => {
    globalThis.logger = {
      warn: () => {
        throw new Error('logger down')
      }
    } as unknown as typeof logger
    encoderMock.mockReturnValueOnce({ wmSize: 8 } as unknown as EmbedOutput)

    expect(await embedWatermark(png(), 'watermark')).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })
})
