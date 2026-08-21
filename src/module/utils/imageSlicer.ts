import sharp from 'sharp'

import { readImageBytes, replaceImageBytes, type ImageMessage } from './Watermark.js'

/**
 * 超高成图的分片。
 *
 * 为什么不用宿主自带的分片：TRSS-Yunzai 只要看到 `multiPage` 为真，就把编码强制改成
 * jpeg（renderers/puppeteer/lib/puppeteer.js:212-215，我们传的 imgType: 'png' 被覆盖），
 * 而 jpeg 没有 alpha —— 卡片圆角外那圈透明像素会被合成成纯白，也就是成图四角的白三角。
 * 想同时要「圆角」和「分片」，就只能自己拿单张 png 来切。
 *
 * 宿主分片的另一处代价：num > 1 时它改用 `page.screenshot()` 截视口而不是截元素，
 * 视口宽度取的是 `#container` 的盒宽，页面上任何没被卡片盖住的区域都会一起进图。
 * 自己切是从元素截图的那张 png 上裁，不存在这个问题。
 */

/** 每片之间的重叠像素：接缝处留一点重叠，读的时候不容易觉得漏了一行 */
const OVERLAP = 0

/**
 * 把一张过高的图按最大高度纵向切片。
 *
 * @param image 单张成图消息段
 * @param maxHeight 每片的最大高度；小于等于 0 视为不限制
 * @returns 切好的消息段数组；不需要切、或者切失败时原样返回单元素数组
 */
export const sliceTallImage = async (image: ImageMessage, maxHeight: number): Promise<ImageMessage[]> => {
  if (!Number.isFinite(maxHeight) || maxHeight <= 0) return [image]

  const bytes = readImageBytes(image)
  if (!bytes) return [image]

  try {
    const { height = 0, width = 0 } = await sharp(bytes).metadata()
    if (!height || !width || height <= maxHeight) return [image]

    // 向上取整，保证每片都不超过 maxHeight（宿主用的是 Math.round，
    // 四舍五入到下时最后一片会比 pageHeight 高出一截）
    const count = Math.ceil(height / maxHeight)
    const sliceHeight = Math.ceil(height / count)

    const slices: ImageMessage[] = []
    for (let index = 0; index < count; index++) {
      const top = index * sliceHeight
      const remaining = height - top
      if (remaining <= 0) break
      const extractHeight = Math.min(sliceHeight + (index === count - 1 ? 0 : OVERLAP), remaining)
      // 每片都重新走一次 sharp：png 编码器保留 alpha，圆角在首片和末片上照常成立
      const buffer = await sharp(bytes)
        .extract({ left: 0, top, width, height: extractHeight })
        .png()
        .toBuffer()
      slices.push(replaceImageBytes(image, buffer))
    }

    return slices.length > 0 ? slices : [image]
  } catch (error: unknown) {
    // 分片只是为了迁就上传限制，失败时把整张发出去，好过一张都发不出去
    const hostLogger = globalThis.logger as { warn?: (message: string) => unknown } | undefined
    hostLogger?.warn?.(`[Render] 成图分片失败，改为发送整张：${error instanceof Error ? error.message : String(error)}`)
    return [image]
  }
}
