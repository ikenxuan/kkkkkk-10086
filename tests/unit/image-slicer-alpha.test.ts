import { describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

import { sliceTallImage } from '../../src/module/utils/imageSlicer.js'

/**
 * 分片必须留住 alpha。
 *
 * 卡片根元素带 `rounded-[5rem]` + `overflow-hidden`，圆角外那圈是**透明像素**；
 * 截图侧靠 `imgType: 'png'` + `omitBackground: true` 把它带出来。
 * 分片是这条链路的最后一环：重新编码时丢掉 alpha，四角就变成白三角
 * （宿主自带的分片正是这么坏的，理由见 `imageSlicer.ts` 开头）。
 *
 * 这一条没有别的测试覆盖 —— 把 `.png()` 改成 `.jpeg()`，全套用例在此之前都是绿的。
 */
globalThis.segment = { image: (file: unknown) => ({ type: 'image', file }) } as unknown as typeof segment
globalThis.logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } as unknown as typeof logger

const WIDTH = 60
const RADIUS = 8

/** 造一张四角透明的高图，正是圆角卡片被 multiPageHeight 切开时的形状 */
const roundedTallPng = async (height: number): Promise<Buffer> => {
  const raw = Buffer.alloc(WIDTH * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const index = (y * WIDTH + x) * 4
      const corner =
        (x < RADIUS && y < RADIUS) ||
        (x >= WIDTH - RADIUS && y < RADIUS) ||
        (x < RADIUS && y >= height - RADIUS) ||
        (x >= WIDTH - RADIUS && y >= height - RADIUS)
      raw[index] = 220
      raw[index + 1] = 40
      raw[index + 2] = 40
      raw[index + 3] = corner ? 0 : 255
    }
  }
  return await sharp(raw, { raw: { width: WIDTH, height, channels: 4 } }).png().toBuffer()
}

const alphaAt = async (buffer: Buffer, corner: 'tl' | 'tr' | 'bl' | 'br'): Promise<number> => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const x = corner === 'tl' || corner === 'bl' ? 0 : info.width - 1
  const y = corner === 'tl' || corner === 'tr' ? 0 : info.height - 1
  return data[(y * info.width + x) * info.channels + 3] as number
}

const fileOf = (image: unknown): Buffer => (image as { file: Buffer }).file

describe('sliceTallImage 保留圆角的透明像素', () => {
  it('切出来的每片都还是 png', async () => {
    const slices = await sliceTallImage({ type: 'image', file: await roundedTallPng(300) }, 120)

    expect(slices.length).toBeGreaterThan(1)
    for (const slice of slices) {
      const metadata = await sharp(fileOf(slice)).metadata()
      expect(metadata.format).toBe('png')
      expect(metadata.hasAlpha).toBe(true)
    }
  })

  it('首片留住上面两角、末片留住下面两角', async () => {
    const slices = await sliceTallImage({ type: 'image', file: await roundedTallPng(300) }, 120)
    const first = fileOf(slices[0])
    const last = fileOf(slices[slices.length - 1] as unknown)

    // 0 = 完全透明。jpeg 编码会把它合成成 255（纯白），也就是成图四角的白三角
    expect(await alphaAt(first, 'tl')).toBe(0)
    expect(await alphaAt(first, 'tr')).toBe(0)
    expect(await alphaAt(last, 'bl')).toBe(0)
    expect(await alphaAt(last, 'br')).toBe(0)
  })

  it('不需要分片时原样返回，那张图的四角一个都不动', async () => {
    const png = await roundedTallPng(100)
    const slices = await sliceTallImage({ type: 'image', file: png }, 120)

    expect(slices).toHaveLength(1)
    expect(await alphaAt(fileOf(slices[0]), 'tl')).toBe(0)
    expect(await alphaAt(fileOf(slices[0]), 'br')).toBe(0)
  })
})
