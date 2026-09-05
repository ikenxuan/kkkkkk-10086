/**
 * 消息段里图片字节的读写。
 *
 * 适配器给回来的图片段形状不统一（`file` / `data.file` / 裸 `data`，值又可能是
 * Buffer、`base64://` 串或 data URL），而本仓有三处要在成图之后再动一次字节：
 * 分片（{@link ../imageSlicer}）、扫码登录取二维码、live photo 提示图。
 * 三处共用这一套读写，免得各自实现、对段形状的理解还不一样。
 *
 * 这里刻意只依赖 `record.js`：`Render` 的调用链上谁都可能引它，
 * 拖进 Config 或渲染层会让一批单测要先摆 mock 才 import 得动。
 */
import { isRecord } from './record.js'

type ImagePayload = Buffer | Uint8Array | string

/** 一条图片消息段，或者一段裸图片载荷 */
export type ImageMessage = object | ImagePayload

const toImageBuffer = (image: unknown): Buffer | null => {
  if (!image) return null
  if (Buffer.isBuffer(image)) return image
  if (image instanceof Uint8Array) return Buffer.from(image)
  if (typeof image === 'string') {
    const base64 = image.replace(/^base64:\/\//, '').replace(/^data:image\/\w+;base64,/, '')
    return Buffer.from(base64, 'base64')
  }
  return null
}

const getImagePayload = (image: ImageMessage): unknown => {
  if (!isRecord(image)) return image
  return image.file ??
    (isRecord(image.data) ? image.data.file : undefined) ??
    image.url ??
    (isRecord(image.data) ? image.data.url : undefined) ??
    image.data ??
    image
}

/** 写回时保持原段的编码形式：原来是 `base64://` 就还给 `base64://`，是 Buffer 就还 Buffer */
const encodeImagePayload = (source: unknown, payload: Buffer): Buffer | string => {
  if (typeof source !== 'string') return payload
  if (/^base64:\/\//i.test(source)) return `base64://${payload.toString('base64')}`
  if (/^data:image\//i.test(source)) return `data:image/png;base64,${payload.toString('base64')}`
  return payload
}

const setImagePayload = (image: ImageMessage, payload: Buffer): ImageMessage => {
  if (!isRecord(image)) return segment.image(payload) as ImageMessage
  if (Object.prototype.hasOwnProperty.call(image, 'file')) {
    return { ...image, file: encodeImagePayload(image.file, payload) }
  }
  if (isRecord(image.data) && Object.prototype.hasOwnProperty.call(image.data, 'file')) {
    return {
      ...image,
      data: { ...image.data, file: encodeImagePayload(image.data.file, payload) }
    }
  }
  if (Object.prototype.hasOwnProperty.call(image, 'data')) {
    return { ...image, data: encodeImagePayload(image.data, payload) }
  }
  return segment.image(payload) as ImageMessage
}

/** 取出消息段里的图片字节，取不到返回 null */
export const readImageBytes = (image: ImageMessage): Buffer | null => toImageBuffer(getImagePayload(image))

/** 把新的图片字节写回消息段，保持原段的字段形状与编码形式 */
export const replaceImageBytes = (image: ImageMessage, payload: Buffer): ImageMessage => setImagePayload(image, payload)
