import sharp from 'sharp'

type ScreenshotRecord = Record<string, unknown>
type ScreenshotValue = ScreenshotRecord | Uint8Array | string

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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
