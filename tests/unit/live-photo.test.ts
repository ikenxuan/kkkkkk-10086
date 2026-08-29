import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

/** 最小可解析 JPEG：SOI + SOF0(height=64, width=96) + EOI */
const jpegFixture = Buffer.from([
  0xff, 0xd8,
  0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x40, 0x00, 0x60,
  0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  0xff, 0xd9
])
const mp4Fixture = Buffer.from('fake-mp4-bytes-for-live-photo', 'utf8')

const workspace = mkdtempSync(join(tmpdir(), 'kkkkkk-livephoto-'))

const configMock = vi.hoisted(() => ({
  app: {} as Record<string, unknown>,
  upload: {} as Record<string, unknown>,
  cookies: {} as Record<string, unknown>
}))

const renderMock = vi.hoisted(() => vi.fn())
const loopVideoWithTransitionMock = vi.hoisted(() => vi.fn())
const ffmpegMock = vi.hoisted(() => vi.fn())

vi.mock('../../src/module/utils/Network/index.js', () => ({
  baseHeaders: {},
  Networks: class {
    private readonly filepath: string
    private readonly url: string

    constructor (options: { url: string, filepath: string }) {
      this.url = options.url
      this.filepath = options.filepath
    }

    async downloadStream (): Promise<{ filepath: string, totalBytes: number }> {
      const payload = this.url.includes('not-an-image')
        ? Buffer.from('this is not a jpeg', 'utf8')
        : this.url.includes('live') ? mp4Fixture : jpegFixture
      mkdirSync(dirname(this.filepath), { recursive: true })
      writeFileSync(this.filepath, payload)
      return { filepath: this.filepath, totalBytes: payload.length }
    }
  }
}))

vi.mock('../../src/module/utils/Common.js', () => ({
  default: {
    mkdir: async (directory: string) => {
      mkdirSync(directory, { recursive: true })
      return true
    },
    tempDri: {
      images: join(workspace, 'images'),
      video: join(workspace, 'video')
    }
  }
}))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: configMock
}))

vi.mock('../../src/module/utils/Render.js', () => ({
  Render: renderMock
}))

vi.mock('../../src/module/utils/FFmpeg.js', () => ({
  ffmpeg: ffmpegMock,
  loopVideoWithTransition: loopVideoWithTransitionMock
}))

globalThis.logger = {
  warn: vi.fn(),
  debug: vi.fn(),
  mark: vi.fn(),
  error: vi.fn()
} as unknown as typeof logger

globalThis.segment = {
  image: (file: string) => ({ type: 'image', file }),
  video: (file: string) => ({ type: 'video', file })
} as unknown as typeof segment

const { buildLivePhotoMessages, buildLivePhotoTipMessage } = await import('../../src/module/platform/common/livePhoto.js')

const staticUrl = 'https://example.com/static.jpg'
const liveVideoUrl = 'https://example.com/live-video.mp4'

/** 取出实况图产物的字节内容 */
const readMotionPhoto = (messages: Array<{ type: string, file: string }>): Buffer => {
  const image = messages.find(message => message.type === 'image')
  if (!image) throw new Error('未生成实况图消息')
  return readFileSync(image.file.replace(/^file:\/\//, ''))
}

beforeEach(() => {
  configMock.app = { livePhotoMode: 'video_and_livephoto', livePhotoSystem: 'google' }
  configMock.upload = {}
  configMock.cookies = {}
  renderMock.mockReset()
  ffmpegMock.mockReset()
  loopVideoWithTransitionMock.mockReset()
  loopVideoWithTransitionMock.mockResolvedValue({ success: true })
})

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('buildLivePhotoMessages system modes', () => {
  const systems = [
    {
      system: 'google',
      expected: ['GCamera:MotionPhoto="1"'],
      absent: ['MiCamera:XMPMeta', 'OpCamera:MotionPhotoOwner']
    },
    {
      system: 'xiaomi',
      expected: ['MiCamera:XMPMeta', 'GCamera:MicroVideoOffset'],
      absent: ['OpCamera:MotionPhotoOwner']
    },
    {
      system: 'oppo',
      expected: ['OpCamera:MotionPhotoOwner="oplus"', 'OpCamera:OLivePhotoVersion="2"'],
      absent: ['MiCamera:XMPMeta']
    }
  ]

  for (const { system, expected, absent } of systems) {
    it(`writes the ${system} motion photo metadata`, async () => {
      configMock.app.livePhotoSystem = system

      const result = await buildLivePhotoMessages({ platform: 'test', staticUrl, liveVideoUrl, index: 0 })
      const motionPhoto = readMotionPhoto(result.messages as Array<{ type: string, file: string }>)
      const text = motionPhoto.toString('binary')

      for (const marker of expected) expect(text).toContain(marker)
      for (const marker of absent) expect(text).not.toContain(marker)
      // 实况图由 JPEG 与视频拼接而成
      expect(motionPhoto.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]))
      expect(motionPhoto.subarray(-mp4Fixture.length)).toEqual(mp4Fixture)
      expect(result.generatedLivePhoto).toBe(true)
    })
  }

  it('appends the huawei/honor trailer instead of XMP metadata', async () => {
    configMock.app.livePhotoSystem = 'huawei_honor'

    const result = await buildLivePhotoMessages({ platform: 'test', staticUrl, liveVideoUrl, index: 0 })
    const motionPhoto = readMotionPhoto(result.messages as Array<{ type: string, file: string }>)
    const text = motionPhoto.toString('binary')

    expect(text).toContain('LIVE_1915884')
    expect(text).not.toContain('x:xmpmeta')
    expect(motionPhoto.subarray(0, jpegFixture.length)).toEqual(jpegFixture)
  })

  it('falls back to google metadata for an unknown system', async () => {
    configMock.app.livePhotoSystem = 'nokia'

    const result = await buildLivePhotoMessages({ platform: 'test', staticUrl, liveVideoUrl, index: 0 })
    const text = readMotionPhoto(result.messages as Array<{ type: string, file: string }>).toString('binary')

    expect(text).toContain('GCamera:MotionPhoto="1"')
    expect(text).not.toContain('MiCamera:XMPMeta')
  })

  it('injects an EXIF segment only for systems that require one', async () => {
    // 与生产代码 hasExifApp1 相同的 APP1 标记
    const exifApp1Marker = 'Exif' + String.fromCharCode(0, 0)

    configMock.app.livePhotoSystem = 'google'
    const google = readMotionPhoto((await buildLivePhotoMessages({
      platform: 'test', staticUrl, liveVideoUrl, index: 1
    })).messages as Array<{ type: string, file: string }>)

    configMock.app.livePhotoSystem = 'oppo'
    const oppo = readMotionPhoto((await buildLivePhotoMessages({
      platform: 'test', staticUrl, liveVideoUrl, index: 2
    })).messages as Array<{ type: string, file: string }>)

    expect(google.toString('binary')).not.toContain(exifApp1Marker)
    expect(oppo.toString('binary')).toContain(exifApp1Marker)
  })
})

describe('buildLivePhotoMessages generation modes', () => {
  it('produces both a looped video and a live photo by default', async () => {
    const result = await buildLivePhotoMessages({ platform: 'test', staticUrl, liveVideoUrl, index: 0 })

    expect((result.messages as Array<{ type: string }>).map(message => message.type)).toEqual(['video', 'image'])
    expect(result.generatedLivePhoto).toBe(true)
  })

  it('produces only the looped video in video_only mode', async () => {
    configMock.app.livePhotoMode = 'video_only'

    const result = await buildLivePhotoMessages({ platform: 'test', staticUrl, liveVideoUrl, index: 0 })

    expect((result.messages as Array<{ type: string }>).map(message => message.type)).toEqual(['video'])
    expect(result.generatedLivePhoto).toBe(false)
  })

  it('produces only the live photo in livephoto_only mode', async () => {
    configMock.app.livePhotoMode = 'livephoto_only'

    const result = await buildLivePhotoMessages({ platform: 'test', staticUrl, liveVideoUrl, index: 0 })

    expect((result.messages as Array<{ type: string }>).map(message => message.type)).toEqual(['image'])
    expect(loopVideoWithTransitionMock).not.toHaveBeenCalled()
  })

  it('treats an unknown mode as video_and_livephoto', async () => {
    configMock.app.livePhotoMode = 'something_else'

    const result = await buildLivePhotoMessages({ platform: 'test', staticUrl, liveVideoUrl, index: 0 })

    expect((result.messages as Array<{ type: string }>).map(message => message.type)).toEqual(['video', 'image'])
  })

  it('skips the looped video when ffmpeg reports a failure', async () => {
    loopVideoWithTransitionMock.mockResolvedValue({ success: false })

    const result = await buildLivePhotoMessages({ platform: 'test', staticUrl, liveVideoUrl, index: 0 })

    expect((result.messages as Array<{ type: string }>).map(message => message.type)).toEqual(['image'])
  })

  const missingFieldCases = [
    { name: 'a missing static url', options: { liveVideoUrl } },
    { name: 'a missing live video url', options: { staticUrl } },
    { name: 'no options at all', options: {} }
  ]

  for (const { name, options } of missingFieldCases) {
    it(`returns no messages for ${name}`, async () => {
      const result = await buildLivePhotoMessages({ platform: 'test', index: 0, ...options })

      expect(result.messages).toEqual([])
      expect(result.generatedLivePhoto).toBe(false)
    })
  }

  it('falls back to no messages when the static image cannot become a JPEG', async () => {
    configMock.app.livePhotoSystem = 'google'
    // ffmpeg 转换失败时 buildGoogleMotionPhoto 抛错，整个流程回退
    ffmpegMock.mockResolvedValue({ status: false })

    const result = await buildLivePhotoMessages({
      platform: 'test',
      staticUrl: 'https://example.com/not-an-image.bin',
      liveVideoUrl,
      index: 0
    })

    expect(result.messages).toEqual([])
    expect(result.generatedLivePhoto).toBe(false)
    expect(ffmpegMock).toHaveBeenCalledTimes(1)
  })
})

describe('buildLivePhotoTipMessage', () => {
  it('returns the rendered tip image when rendering succeeds', async () => {
    renderMock.mockResolvedValue(['rendered-tip'])

    expect(await buildLivePhotoTipMessage()).toEqual(['rendered-tip'])
    // 不带 payload 是契约的一部分：这张图纯静态，组件不读 props.data。
    // 传了字段就会让调用方以为能改文案，而实际改不动（见 components/types.ts）。
    expect(renderMock).toHaveBeenCalledWith('other/live-photo-tip')
  })

  it('falls back to plain text when rendering throws', async () => {
    renderMock.mockRejectedValue(new Error('render down'))

    // 回退文本要跟图上写死的那两句说同一件事，别一个让点「查看原图」、一个让直接存相册。
    expect(await buildLivePhotoTipMessage()).toBe('保存原图：点击「查看原图」后保存到相册即可识别为实况照片')
  })
})
