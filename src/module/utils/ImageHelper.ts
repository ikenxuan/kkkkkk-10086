import fs from 'node:fs'
import path from 'node:path'
import axios, { type AxiosRequestConfig } from 'axios'
import Common from './Common.js'
import Config from './Config.js'
import { runWithDownloadSlot } from './Network/DownloadBudget.js'
import { getErrorMessage } from './error-message.js'
import { sanitizeFilenameSegment } from './filename.js'
import { baseHeaders } from './Networks.js'

const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|bmp)$/i

// 这里只清洗标题本身，扩展名由 getExtension 单独决定，所以用 segment 版。
// 清洗规则（含 shell 元字符）统一在 utils/filename.ts，理由见那里的说明。
const sanitizeFilename = (filename: string): string => sanitizeFilenameSegment(filename, 50, 'image')

const getExtension = (imageUrl: string): string => {
  try {
    const ext = path.extname(new URL(imageUrl).pathname)
    if (IMAGE_EXT_RE.test(ext)) return ext
  } catch {
    // URL 解析失败时使用默认扩展名。
  }
  return '.jpg'
}

const buildImageFilePath = (imageUrl: string, title: string, index?: number): string => {
  const ext = getExtension(imageUrl)
  const suffix = index === undefined ? '' : `_${index}`
  const basename = Config.app.removeCache
    ? `tmp_${Date.now()}${suffix}`
    : `${sanitizeFilename(title)}${suffix}`
  return path.join(Common.tempDri.images, `${basename}${ext}`)
}

const downloadImageBuffer = async (
  imageUrl: string,
  headers: AxiosRequestConfig['headers'] = {}
): Promise<Buffer> => {
  if (imageUrl.startsWith('base64://')) return Buffer.from(imageUrl.replace(/^base64:\/\//, ''), 'base64')
  if (/^data:image\/\w+;base64,/.test(imageUrl)) {
    return Buffer.from(imageUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64')
  }
  if (fs.existsSync(imageUrl)) return await fs.promises.readFile(imageUrl)

  // 记入所属平台的连接预算：processImageUrls 是 Promise.all 全量展开的，
  // 一个 30 图的图集在这里会一次性开 30 条连接。额度由桶统一压住。
  const response = await runWithDownloadSlot(async () => await axios.get<ArrayBuffer>(imageUrl, {
    responseType: 'arraybuffer',
    timeout: Config.request?.timeout || 30000,
    maxRedirects: 5,
    headers: { ...baseHeaders, ...headers },
    proxy: Config.request?.proxy?.switch
      ? { host: Config.request.proxy.host, port: Number(Config.request.proxy.port), protocol: Config.request.proxy.protocol, auth: Config.request.proxy.auth }
      : false
  }))
  return Buffer.from(response.data)
}

const scheduleImageDelete = (filePath: string): void => {
  if (!Config.app.removeCache) return
  setTimeout(() => {
    Common.removeFile(filePath, true).catch((error: unknown) => {
      logger.debug(`[ImageHelper] 删除临时图片失败: ${getErrorMessage(error)}`)
    })
  }, 10 * 60 * 1000)
}

export const processImageUrl = async (
  imageUrl: string,
  title: string,
  index?: number,
  headers: AxiosRequestConfig['headers'] = {}
): Promise<string> => {
  if (!imageUrl) return imageUrl
  const mode = Config.upload?.imageSendMode || Config.app?.imageSendMode || 'url'
  if (mode === 'url' || imageUrl.startsWith('base64://') || imageUrl.startsWith('file://')) return imageUrl

  try {
    const buffer = await downloadImageBuffer(imageUrl, headers)
    if (mode === 'base64') return `base64://${buffer.toString('base64')}`
    const filePath = buildImageFilePath(imageUrl, title, index)
    await Common.mkdir(path.dirname(filePath))
    await fs.promises.writeFile(filePath, buffer)
    scheduleImageDelete(filePath)
    return `file://${filePath}`
  } catch (error: unknown) {
    logger.warn(`[ImageHelper] 图片处理失败，回退原始地址: ${getErrorMessage(error)}`)
    return imageUrl
  }
}

export const processImageUrls = async (
  imageUrls: string[] | null | undefined,
  title: string,
  headers: AxiosRequestConfig['headers'] = {}
): Promise<string[]> => {
  return await Promise.all((imageUrls || []).map(async (url, index) => await processImageUrl(url, title, index, headers)))
}
