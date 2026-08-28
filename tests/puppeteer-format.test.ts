import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import sharp from 'sharp'

import { convertScreenshotToPng, ensureImageSegment, withPngScreenshot } from '../src/runtime/host/screenshot-options'

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

/**
 * 适配器归一化消息段的那一句，各家适配器写法一致（OneBotv11.js:67、Satori.js、
 * Milky.js:911 ……）：没有 `data` 键就把整个对象摊进 `data`，然后 `switch (type)` 分发。
 *
 * 抄在这里是为了让「裸 Buffer 会被摊成数字键、type 变 undefined」这件事
 * 在测试里可验证，而不是只写在注释里。
 */
const normalizeLikeAdapter = (element: unknown): { type: unknown, data: unknown } => {
  let item = element as Record<string, unknown>
  if (!item.data) item = { type: item.type, data: { ...item, type: undefined } }
  return item as { type: unknown, data: unknown }
}

describe('ensureImageSegment', () => {
  const hostSegment = { image: (file: unknown, name?: string) => ({ type: 'image', file, name }) }

  beforeEach(() => {
    globalThis.segment = hostSegment as unknown as typeof segment
  })

  afterEach(() => {
    globalThis.segment = undefined as unknown as typeof segment
  })

  it('wraps the bare Buffer the host renderer returns so adapters see an image segment', () => {
    // 宿主 `screenshot()` 的注释就写着「不做segment包裹」，返回的是裸 Buffer
    const bare = Buffer.from([0x89, 0x50, 0x4e, 0x47])

    const result = ensureImageSegment(bare)

    expect(result).toMatchObject({ type: 'image' })
    expect(Buffer.isBuffer((result as unknown as { file: unknown }).file)).toBe(true)
    expect((result as unknown as { file: Buffer }).file.equals(bare)).toBe(true)
  })

  it('makes the adapter dispatch on type "image" instead of falling through to default', () => {
    const bare = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    // 没有包裹时：type 丢了，每个字节摊成一个数字键 —— 协议端只能报格式不兼容
    const unwrapped = normalizeLikeAdapter(bare)
    expect(unwrapped.type).toBeUndefined()
    expect(Object.keys(unwrapped.data as object)).toContain('0')

    // 包裹之后：命中 case 'image'
    const wrapped = normalizeLikeAdapter(ensureImageSegment(bare))
    expect(wrapped.type).toBe('image')
  })

  it('wraps a bare base64 string payload as well', () => {
    const result = ensureImageSegment('base64://aGVsbG8=')

    expect(result).toMatchObject({ type: 'image', file: 'base64://aGVsbG8=' })
  })

  it('converts a plain Uint8Array to Buffer so segment.image gets Buffer methods', () => {
    const view = new Uint8Array([1, 2, 3, 4])

    const file = (ensureImageSegment(view) as unknown as { file: unknown }).file

    expect(Buffer.isBuffer(file)).toBe(true)
    expect((file as Buffer).equals(Buffer.from(view))).toBe(true)
  })

  it('leaves an already-wrapped segment untouched', () => {
    const source = { type: 'image', file: Buffer.from([1, 2, 3]) }

    expect(ensureImageSegment(source)).toBe(source)
  })

  it('returns the payload unchanged when the host segment global is absent', () => {
    // 单测环境或宿主还没挂全局时，不能让缺 segment 把整条渲染链打断
    globalThis.segment = undefined as unknown as typeof segment
    const bare = Buffer.from([1, 2, 3])

    expect(ensureImageSegment(bare)).toBe(bare)
  })
})
