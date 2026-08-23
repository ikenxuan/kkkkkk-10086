import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'

const { embedWatermarkToPngBytes } = vi.hoisted(() => ({
  embedWatermarkToPngBytes: vi.fn(async (image: Buffer) => ({
    buffer: image,
    wmSize: 32
  }))
}))

vi.mock('@ikenxuan/watermark', () => ({ embedWatermarkToPngBytes }))

import { applyWatermarkToImages } from '../src/module/utils/Watermark'

describe('applyWatermarkToImages', () => {
  it('extracts and preserves a base64 data payload from a host image segment', async () => {
    const png = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 4,
        background: { r: 32, g: 64, b: 128, alpha: 1 }
      }
    }).png().toBuffer()
    const image = { type: 'image', data: `base64://${png.toString('base64')}` }

    const result = await applyWatermarkToImages([image], 'test-watermark')

    expect(embedWatermarkToPngBytes).toHaveBeenCalledOnce()
    expect(embedWatermarkToPngBytes).toHaveBeenCalledWith(png, 'test-watermark')
    expect(result).toEqual([
      expect.objectContaining({
        type: 'image',
        data: expect.stringMatching(/^base64:\/\//)
      })
    ])
  })
})
