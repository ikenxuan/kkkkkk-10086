import { describe, expect, it } from 'vitest'
import sharp from 'sharp'

import { convertScreenshotToPng, withPngScreenshot } from '../src/runtime/host/screenshot-options'

describe('withPngScreenshot', () => {
  it('forces PNG without mutating the caller options', () => {
    const source = {
      imgType: 'jpeg',
      saveId: 'poster',
      omitBackground: true
    }

    const result = withPngScreenshot(source)

    expect(result).toEqual({
      imgType: 'png',
      saveId: 'poster',
      omitBackground: true
    })
    expect(source.imgType).toBe('jpeg')
    expect(result).not.toBe(source)
  })
})

describe('convertScreenshotToPng', () => {
  it('converts a multi-page JPEG segment while preserving the image segment shape', async () => {
    const jpeg = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    }).jpeg().toBuffer()

    const result = await convertScreenshotToPng({ type: 'image', file: jpeg })

    expect(result).toMatchObject({ type: 'image' })
    expect(Buffer.isBuffer((result as { file: unknown }).file)).toBe(true)
    await expect(sharp((result as { file: Buffer }).file).metadata()).resolves.toMatchObject({ format: 'png' })
  })

  it('converts the host data payload without changing its base64 transport shape', async () => {
    const jpeg = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 4,
        background: { r: 0, g: 128, b: 255, alpha: 1 }
      }
    }).jpeg().toBuffer()
    const source = { type: 'image', data: `base64://${jpeg.toString('base64')}` }

    const result = await convertScreenshotToPng(source)

    expect(result).toMatchObject({ type: 'image' })
    expect(typeof result.data).toBe('string')
    expect(result.data).toMatch(/^base64:\/\//)
    const png = Buffer.from((result.data as string).replace(/^base64:\/\//, ''), 'base64')
    await expect(sharp(png).metadata()).resolves.toMatchObject({ format: 'png' })
  })

  it('leaves an invalid encoded payload unchanged instead of failing rendering', async () => {
    const source = { type: 'image', data: 'base64://not-an-image' }

    await expect(convertScreenshotToPng(source)).resolves.toBe(source)
  })
})
