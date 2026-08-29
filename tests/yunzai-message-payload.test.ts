import { describe, expect, it, vi } from 'vitest'
import { Readable } from 'node:stream'

vi.stubGlobal('logger', { debug: vi.fn(), warn: vi.fn() })
vi.mock('@ikenxuan/qrcode', () => ({ scan: vi.fn(async (image: Buffer) => image.toString()) }))
vi.mock('../src/module/utils/Base.js', () => ({ Base: class Base {} }))
vi.mock('../src/module/utils/Config.js', () => ({
  default: { app: { removeCache: false, Theme: 0 } }
}))
vi.mock('../src/module/utils/Network/index.js', () => ({
  Networks: class Networks {}
}))
vi.mock('../src/module/utils/Version.js', () => ({
  default: { clientPath: process.cwd(), pluginName: 'kkkkkk-10086' }
}))

const { default: Common } = await import('../src/module/utils/Common.js')

describe('Yunzai message payload compatibility', () => {
  it('extracts a link from a single message segment', async () => {
    const event = {
      message: { type: 'text', text: 'https://v.douyin.com/video/123' },
      msg: ''
    } as any

    await expect(Common.getReplyMessage(event)).resolves.toBe('https://v.douyin.com/video/123')
  })

  it('accepts a Buffer from an image segment as an already decoded image', async () => {
    const image = Buffer.from('image-payload')

    await expect(Common.getImageBuffer(image as unknown as string)).resolves.toEqual(image)
  })

  it('falls back to a usable image URL when file is a Readable stream', async () => {
    const event = {
      message: {
        type: 'image',
        file: Readable.from('stream-payload'),
        url: Buffer.from('https://v.douyin.com/video/456')
      },
      msg: ''
    } as any

    await expect(Common.getReplyMessage(event)).resolves.toBe('https://v.douyin.com/video/456')
  })
})
