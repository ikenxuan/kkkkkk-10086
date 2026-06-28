import fs from 'node:fs'
import path from 'node:path'
import axios from 'axios'
import Common from './Common.js'
import Config from './Config.js'
import { baseHeaders } from './Networks.js'

const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|bmp)$/i

const sanitizeFilename = (filename) => {
  return String(filename || 'image')
    .replace(/[\\/:*?"<>|\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50) || 'image'
}

const getExtension = (imageUrl) => {
  try {
    const ext = path.extname(new URL(imageUrl).pathname)
    if (IMAGE_EXT_RE.test(ext)) return ext
  } catch {
    // URL 解析失败时使用默认扩展名。
  }
  return '.jpg'
}

const buildImageFilePath = (imageUrl, title, index) => {
  const ext = getExtension(imageUrl)
  const suffix = index === undefined ? '' : `_${index}`
  const basename = Config.app.removeCache
    ? `tmp_${Date.now()}${suffix}`
    : `${sanitizeFilename(title)}${suffix}`
  return path.join(Common.tempDri.images, `${basename}${ext}`)
}

const downloadImageBuffer = async (imageUrl, headers = {}) => {
  if (imageUrl.startsWith('base64://')) {
    return Buffer.from(imageUrl.replace(/^base64:\/\//, ''), 'base64')
  }
  if (/^data:image\/\w+;base64,/.test(imageUrl)) {
    return Buffer.from(imageUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64')
  }
  if (fs.existsSync(imageUrl)) return await fs.promises.readFile(imageUrl)

  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: Config.request?.timeout || 30000,
    maxRedirects: 5,
    headers: {
      ...baseHeaders,
      ...headers
    },
    proxy: Config.request?.proxy?.switch ? {
      host: Config.request.proxy.host,
      port: Number(Config.request.proxy.port),
      protocol: Config.request.proxy.protocol,
      auth: Config.request.proxy.auth
    } : false
  })

  return Buffer.from(response.data)
}

const scheduleImageDelete = (filePath) => {
  if (!Config.app.removeCache) return
  setTimeout(() => {
    Common.removeFile(filePath, true).catch(error => {
      logger.debug(`[ImageHelper] 删除临时图片失败: ${error?.message || error}`)
    })
  }, 10 * 60 * 1000)
}

export const processImageUrl = async (imageUrl, title, index, headers = {}) => {
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
  } catch (error) {
    logger.warn(`[ImageHelper] 图片处理失败，回退原始地址: ${error?.message || error}`)
    return imageUrl
  }
}

export const processImageUrls = async (imageUrls, title, headers = {}) => {
  return await Promise.all((imageUrls || []).map((url, index) => processImageUrl(url, title, index, headers)))
}
