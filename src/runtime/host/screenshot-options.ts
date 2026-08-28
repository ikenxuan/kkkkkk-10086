import sharp from 'sharp'
import { isRecord } from '@/module/utils/record'

type ScreenshotRecord = Record<string, unknown>
type ScreenshotValue = ScreenshotRecord | Uint8Array | string

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const toBuffer = (value: unknown): Buffer | null => {
  if (Buffer.isBuffer(value)) return value
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (typeof value !== 'string') return null

  const base64 = value.replace(/^base64:\/\//, '').replace(/^data:image\/\w+;base64,/, '')
  if (base64 === value && !value.startsWith('data:image/')) return null

  try {
    return Buffer.from(base64, 'base64')
  } catch {
    return null
  }
}

const encodeLike = (source: string, payload: Buffer): string => {
  if (source.startsWith('base64://')) {
    return `base64://${payload.toString('base64')}`
  }
  if (source.startsWith('data:image/')) {
    return `data:image/png;base64,${payload.toString('base64')}`
  }
  return source
}

const getPayload = (image: ScreenshotValue): unknown => {
  if (!isRecord(image)) return image
  if ('file' in image) return image.file
  if (isRecord(image.data) && 'file' in image.data) return image.data.file
  if (typeof image.data === 'string') return image.data
  return image
}

const setPayload = <T extends ScreenshotValue>(image: T, payload: Buffer): T => {
  if (typeof image === 'string') return encodeLike(image, payload) as T
  if (!isRecord(image)) return payload as unknown as T
  if ('file' in image) {
    return {
      ...image,
      file: typeof image.file === 'string' ? encodeLike(image.file, payload) : payload
    } as unknown as T
  }
  if (isRecord(image.data) && 'file' in image.data) {
    return {
      ...image,
      data: {
        ...image.data,
        file: typeof image.data.file === 'string' ? encodeLike(image.data.file, payload) : payload
      }
    } as unknown as T
  }
  if (typeof image.data === 'string') {
    return { ...image, data: encodeLike(image.data, payload) } as unknown as T
  }
  return { ...image, file: payload } as unknown as T
}

/** Request PNG encoding for all KKK-generated screenshots. */
export const withPngScreenshot = <T extends Record<string, unknown>> (
  data: T
): T & { imgType: 'png' } => ({
    ...data,
    imgType: 'png'
  })

/** 裸图片载荷：宿主截图接口真正会返回的东西。Buffer 继承 Uint8Array，所以一并覆盖 */
const isBareImagePayload = (value: unknown): value is Uint8Array | string =>
  typeof value === 'string' || value instanceof Uint8Array

/**
 * 给宿主返回的裸载荷补上 `segment.image()` 包裹。
 *
 * 宿主的截图接口在注释里就写明「不做segment包裹」
 * （renderers/puppeteer/lib/puppeteer.js:166），返回的是 `ret[0]`，一个裸 Buffer。
 * 而适配器归一化消息段用的是这一句：
 *
 * ```js
 * if (!i.data) i = { type: i.type, data: { ...i, type: undefined } }
 * ```
 *
 * Buffer `typeof` 是 object，又没有 `data` 键，于是被当成一个「缺 data 的消息段」展开：
 * `i.type` 取到 undefined，`{ ...buffer }` 把每个字节摊成一个数字键
 * （一张 500KB 的图会变成 50 万个键、序列化后放大约 10 倍）。
 * 接着 `switch (item.type)` 落到 `default`，图片再也不会被当图片处理 ——
 * 协议端收到的是个既不是文本也不是图片的段，只能报格式不兼容/不支持。
 *
 * 包裹放在宿主边界这一层，而不是各个 `e.reply()` 调用点：
 * 越过这条线之后内部一律按消息段处理，`Watermark` 的读写、`imageSlicer` 的分片
 * 都已经是照着消息段形状写的（`getImagePayload` 认 `file`），
 * 不必让四十多个 `Render()` 调用点各自记得包一次。
 *
 * 已经是消息段的（别的渲染器可能直接返回段）原样放过。
 */
export const ensureImageSegment = <T extends ScreenshotValue> (image: T): T => {
  if (!isBareImagePayload(image)) return image
  // segment 是宿主 loader 挂的全局（lib/plugins/loader.js:15）。
  // 单测里可能没有，那就退回原样，别让缺全局把渲染整条链打断。
  const toImageSegment = globalThis.segment?.image
  if (typeof toImageSegment !== 'function') return image
  // 宿主 `screenshot()` 已经保证是 Buffer（puppeteer.js:222 有 `Buffer.from` 兜底），
  // 但类型上放开到了 Uint8Array，这里补一次零拷贝的视图转换，
  // 免得真来了个普通 Uint8Array 时 `segment.image` 拿不到 Buffer 的方法。
  const payload = typeof image === 'string' || Buffer.isBuffer(image)
    ? image
    : Buffer.from(image.buffer, image.byteOffset, image.byteLength)
  return toImageSegment(payload) as unknown as T
}

/**
 * Yunzai's multi-page renderer currently overrides imgType to JPEG. Convert
 * the returned segment payload after rendering so the plugin's public output
 * remains PNG without modifying the host renderer.
 */
export const convertScreenshotToPng = async <T extends ScreenshotValue> (image: T): Promise<T> => {
  const input = toBuffer(getPayload(image))
  if (!input || input.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return image
  try {
    const output = await sharp(input).png().toBuffer()
    return setPayload(image, output)
  } catch {
    // A protocol may return a non-image payload alongside an image segment.
    // Do not make an otherwise successful render fail in the compatibility layer.
    return image
  }
}
