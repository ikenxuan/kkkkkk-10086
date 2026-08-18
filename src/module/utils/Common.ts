import fs from 'node:fs'
import path, { join, sep } from 'node:path'
import { scan } from '@ikenxuan/qrcode'
import type { MessageElement, MessageEvent } from '../../types/message.js'
import { Base } from './Base.js'
import Config from './Config.js'
import { Networks } from './Networks.js'
import Version from './Version.js'
import { XIAOHONGSHU_LINK_PATTERN } from '../platform/xiaohongshu/link.js'

interface VideoPreview {
  filename: string
  filePath: string
  removeCache: boolean
  createdAt: number
  expireAt?: number
  removedAt?: number
}

const supportedLinkPatterns = [
  /(https?:\/\/)?(www|v|jx|m|jingxuan)\.(douyin|iesdouyin)\.com/i,
  /https:\/\/aweme\.snssdk\.com\/aweme\/v1\/play/i,
  /(bilibili\.com|b23\.tv|t\.bilibili\.com|bili2233\.cn|\bBV[1-9a-zA-Z]{10}\b|\bav\d+\b)/i,
  /(快手.*快手|v\.kuaishou\.com|kuaishou\.com)/,
  XIAOHONGSHU_LINK_PATTERN
]

export interface CoverThemeStats {
  averageLuma: number
  darkRatio?: number
  brightRatio?: number
  vividRatio?: number
}

export interface CoverThemePixel {
  r: number
  g: number
  b: number
  alpha?: number
}

export interface CoverThemeDecision {
  useDarkTheme: boolean
  averageLuma: number
  darkRatio: number
  brightRatio: number
  vividRatio: number
}

type CoverThemeInput = CoverThemeStats | Uint8Array | readonly CoverThemePixel[] | null | undefined

type NormalizedPixel = CoverThemePixel

const relativeLuma = ({ r, g, b }: NormalizedPixel): number =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

const rgbToHsl = ({ r, g, b }: NormalizedPixel): { h: number; s: number; l: number } => {
  const nr = r / 255
  const ng = g / 255
  const nb = b / 255
  const max = Math.max(nr, ng, nb)
  const min = Math.min(nr, ng, nb)
  const l = (max + min) / 2
  const d = max - min

  if (d === 0) return { h: 0, s: 0, l }

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  switch (max) {
    case nr:
      h = (ng - nb) / d + (ng < nb ? 6 : 0)
      break
    case ng:
      h = (nb - nr) / d + 2
      break
    default:
      h = (nr - ng) / d + 4
      break
  }

  return { h: h / 6, s, l }
}

const isValidChannel = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 255

const summarizePixels = (
  pixelCount: number,
  readPixel: (index: number) => NormalizedPixel | null
): CoverThemeStats | null => {
  if (!Number.isInteger(pixelCount) || pixelCount <= 0) return null

  const pixelStep = Math.max(1, Math.floor(pixelCount / 1800))
  let total = 0
  let lumaSum = 0
  let darkCount = 0
  let brightCount = 0
  let vividCount = 0

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += pixelStep) {
    const pixel = readPixel(pixelIndex)
    if (!pixel) continue
    const alpha = pixel.alpha ?? 255
    if (!Number.isFinite(alpha) || alpha < 20 || alpha > 255) continue
    if (!isValidChannel(pixel.r) || !isValidChannel(pixel.g) || !isValidChannel(pixel.b)) continue

    const luma = relativeLuma(pixel)
    const { s, l } = rgbToHsl(pixel)
    total += 1
    lumaSum += luma
    if (luma < 0.38) darkCount += 1
    if (luma > 0.72) brightCount += 1
    if (s > 0.42 && l > 0.16 && l < 0.86) vividCount += 1
  }

  if (!total) return null

  return {
    averageLuma: lumaSum / total,
    darkRatio: darkCount / total,
    brightRatio: brightCount / total,
    vividRatio: vividCount / total
  }
}

const ratioOrFallback = (value: number | undefined, fallback: number): number | null => {
  if (value === undefined) return fallback
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null
}

const decisionFromStats = (stats: CoverThemeStats): CoverThemeDecision | null => {
  const { averageLuma } = stats
  if (!Number.isFinite(averageLuma) || averageLuma < 0 || averageLuma > 1) return null

  const darkRatio = ratioOrFallback(stats.darkRatio, averageLuma < 0.38 ? 1 : 0)
  const brightRatio = ratioOrFallback(stats.brightRatio, averageLuma > 0.72 ? 1 : 0)
  const vividRatio = ratioOrFallback(stats.vividRatio, 0)
  if (darkRatio === null || brightRatio === null || vividRatio === null) return null

  const shouldUseLight = averageLuma > 0.72 && brightRatio > 0.48 && vividRatio < 0.28 && darkRatio < 0.18
  const shouldUseDark = averageLuma < 0.54 || darkRatio > 0.34 || (vividRatio > 0.38 && averageLuma < 0.72)

  return {
    useDarkTheme: shouldUseLight ? false : shouldUseDark,
    averageLuma,
    darkRatio,
    brightRatio,
    vividRatio
  }
}

/** 根据封面像素或预计算统计值判断整张图的明暗倾向。 */
export const decideCoverTheme = (input: CoverThemeInput): CoverThemeDecision | null => {
  if (input instanceof Uint8Array) {
    if (input.byteLength === 0 || input.byteLength % 4 !== 0) return null
    const stats = summarizePixels(input.byteLength / 4, pixelIndex => {
      const offset = pixelIndex * 4
      return {
        r: input[offset] ?? 0,
        g: input[offset + 1] ?? 0,
        b: input[offset + 2] ?? 0,
        alpha: input[offset + 3] ?? 0
      }
    })
    return stats ? decisionFromStats(stats) : null
  }

  if (Array.isArray(input)) {
    const stats = summarizePixels(input.length, pixelIndex => {
      const pixel = input[pixelIndex]
      if (!pixel || typeof pixel !== 'object') return null
      return pixel
    })
    return stats ? decisionFromStats(stats) : null
  }

  if (input && typeof input === 'object' && 'averageLuma' in input) {
    return decisionFromStats(input as CoverThemeStats)
  }
  return null
}

const useDarkThemeByTime = (now: Date | number = new Date()): boolean => {
  const date = now instanceof Date ? now : new Date(now)
  const hour = date.getHours()
  return !(hour >= 6 && hour < 18)
}

/** 解析配置的主题模式；智能主题在封面不可用时回退到按时间自动切换。 */
export const resolveUseDarkTheme = (
  theme: number | undefined,
  cover?: Exclude<CoverThemeInput, undefined>,
  now: Date | number = new Date()
): boolean => {
  if (theme === 1) return false
  if (theme === 2) return true
  if (theme === 3) return decideCoverTheme(cover)?.useDarkTheme ?? useDarkThemeByTime(now)
  return useDarkThemeByTime(now)
}
class Tools {
  readonly tempDri: { default: string; video: string; images: string }
  readonly videoPreviews = new Map<string, VideoPreview>()

  constructor () {
    const defaultPath = join(Version.clientPath, 'temp', Version.pluginName)
    this.tempDri = {
      default: defaultPath,
      video: join(defaultPath, 'kkkdownload', 'video') + sep,
      images: join(defaultPath, 'kkkdownload', 'images') + sep
    }
  }

  registerVideoPreview (filePath: string, removeCache = Config.app.removeCache, ttlMs = 10 * 60 * 1000): VideoPreview {
    const filename = path.basename(filePath)
    const createdAt = Date.now()
    const info: VideoPreview = {
      filename,
      filePath,
      removeCache: Boolean(removeCache),
      createdAt,
      expireAt: removeCache ? createdAt + ttlMs : undefined
    }
    this.videoPreviews.set(filename, info)
    return info
  }

  getVideoPreview (filename: string): VideoPreview | undefined {
    return this.videoPreviews.get(path.basename(filename))
  }

  markVideoPreviewRemoved (filename: string): void {
    const safeName = path.basename(filename)
    const info = this.videoPreviews.get(safeName)
    if (info) {
      info.removedAt = Date.now()
      this.videoPreviews.set(safeName, info)
    }
  }

  validateVideoRequest (filename: string): string | null {
    if (!filename) return null
    const safeName = path.basename(filename)
    if (safeName !== filename || filename.includes('/') || filename.includes('\\')) return null
    const previewInfo = this.getVideoPreview(safeName)
    const videoPath = previewInfo?.filePath || path.join(this.tempDri.video, safeName)
    const resolvedVideoDir = path.resolve(this.tempDri.video)
    const resolvedPath = path.resolve(videoPath)
    if (!resolvedPath.startsWith(resolvedVideoDir + path.sep) && resolvedPath !== resolvedVideoDir) return null
    if (!fs.existsSync(resolvedPath)) return null
    return resolvedPath
  }

  async tryScanImageQrCode (image: string, source = '消息图片'): Promise<string | null> {
    if (!image) return null
    try {
      logger.debug(`检测到${source}，尝试识别二维码`)
      const buffer = await this.getImageBuffer(image)
      if (!buffer) return null
      const qrContent = await scan(buffer)
      if (qrContent && supportedLinkPatterns.some(pattern => pattern.test(qrContent))) {
        logger.debug(`从${source}二维码中识别到支持的平台链接: ${qrContent}`)
        return qrContent
      }
      if (qrContent) logger.debug(`识别到二维码内容但不是支持的平台: ${qrContent}`)
    } catch (error: unknown) {
      logger.warn(`识别${source}二维码失败: ${getErrorMessage(error)}`)
    }
    return null
  }

  async getImageBuffer (image: string): Promise<Buffer | null> {
    if (!image) return null
    if (image.startsWith('base64://')) return Buffer.from(image.replace(/^base64:\/\//, ''), 'base64')
    if (/^data:image\/\w+;base64,/.test(image)) {
      return Buffer.from(image.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    }
    if (/^https?:\/\//i.test(image)) {
      const data = await new Networks({ url: image, type: 'arraybuffer' }).getData<ArrayBuffer>()
      return Buffer.from(data)
    }
    if (fs.existsSync(image)) return await fs.promises.readFile(image)
    return null
  }

  async extractMessageText (messages: MessageElement[] | null | undefined, source = '消息'): Promise<string> {
    for (const msg of messages || []) {
      if (msg.type === 'text' || msg.type === 'json') {
        const data = isRecord(msg.data) ? msg.data : undefined
        const text = msg.text || (typeof msg.data === 'string' ? msg.data : '') || data?.text || data?.data || ''
        const normalized = typeof text === 'string' ? text : ''
        const markdownText = await this.extractMarkdownText(normalized, source)
        if (markdownText) return markdownText
        if (normalized) return normalized
      }
      if (msg.type === 'image') {
        const data = isRecord(msg.data) ? msg.data : undefined
        const image = msg.file || msg.url || stringValue(data?.file) || stringValue(data?.url)
        if (image) {
          const qrResult = await this.tryScanImageQrCode(image, source)
          if (qrResult) return qrResult
        }
      }
    }
    return ''
  }

  async extractMarkdownText (text: string, source: string): Promise<string> {
    if (!text) return ''
    let content = text
    try {
      const parsed: unknown = JSON.parse(text)
      if (isRecord(parsed) && parsed.type === 'markdown' && isRecord(parsed.data) && typeof parsed.data.content === 'string') {
        content = parsed.data.content
      }
    } catch {
      // 普通文本不需要 JSON 解析
    }
    const imageRegex = /!\[.*?\]\((.*?)\)/g
    let match: RegExpExecArray | null
    while ((match = imageRegex.exec(content)) !== null) {
      const image = match[1]
      if (!image) continue
      const qrResult = await this.tryScanImageQrCode(image, `${source}中的 markdown 图片`)
      if (qrResult) return qrResult
    }
    return content === text ? '' : content
  }

  async getReplyMessage (event: MessageEvent): Promise<string> {
    const legacyEvent = event as MessageEvent & Record<string, unknown>
    const botAdapter = new Base(legacyEvent).botadapter
    const messages = Array.isArray(event.message) ? event.message : []
    const currentMessageText = await this.extractMessageText(messages, '当前消息')
    if (currentMessageText && supportedLinkPatterns.some(pattern => pattern.test(currentMessageText))) return currentMessageText

    if (Version.BotName === 'TRSS-Yunzai' && event.reply_id && event.getReply) {
      const replyMsg = await event.getReply()
      if (replyMsg) {
        const sourceArray = Array.isArray(replyMsg) ? replyMsg : [replyMsg]
        const replyElements = sourceArray.flatMap(item => isRecord(item) && Array.isArray(item.message) ? item.message as MessageElement[] : [])
        const replyText = await this.extractMessageText(replyElements, '引用消息')
        if (replyText) event.msg = replyText
      }
    }
    if (botAdapter === 'ICQQ' && event.source) {
      const history = await (event.group || event.friend)?.getChatHistory?.(event.isGroup ? event.source.seq : event.source.time, 1)
      const message = history?.pop()?.message
      const replyText = await this.extractMessageText(message, '引用消息')
      if (replyText) event.msg = replyText
    }
    if (['LagrangeCore', 'Lagrange.OneBot', 'OneBotv11'].includes(botAdapter)) {
      const replyMsg = messages.find(msg => msg.type === 'reply')
      if (replyMsg && event.bot?.sendApi) {
        const replyData = await event.bot.sendApi('get_msg', { message_id: replyMsg.id })
        const data = isRecord(replyData) && isRecord(replyData.data) ? replyData.data.message : undefined
        const replyText = await this.extractMessageText(Array.isArray(data) ? data as MessageElement[] : [], '引用消息')
        if (replyText) event.msg = replyText
      }
    }
    return event.msg || ''
  }

  chineseToArabic (chineseNumber: string): number {
    const numbers: Record<string, number> = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
    const units: Record<string, number> = { 十: 10, 百: 100, 千: 1000, 万: 10000, 亿: 100000000 }
    let result = 0
    let temp = 0
    let unit = 1
    for (let i = chineseNumber.length - 1; i >= 0; i--) {
      const char = chineseNumber[i]
      if (!char) continue
      if (char in units) {
        unit = units[char] ?? 1
        if (unit >= 10000) {
          result += temp * unit
          temp = 0
        }
      } else if (char in numbers) {
        temp += (numbers[char] ?? 0) * (unit > 1 ? unit : 1)
        unit = 1
      }
    }
    return result + temp
  }

  formatCookies (cookies: string[]): string {
    return cookies.map(cookie => {
      const [nameValue] = cookie.split(';').map(part => part.trim())
      const [name, value] = (nameValue || '').split('=')
      return `${name}=${value}`
    }).join('; ')
  }

  calculateBitrate (targetSizeMB: number, duration: number): number {
    return (targetSizeMB * 1024 * 1024 * 8) / duration / 1024
  }

  async getVideoFileSize (filePath: string): Promise<number> {
    try {
      return (await fs.promises.stat(filePath)).size / (1024 * 1024)
    } catch (error: unknown) {
      logger.error('获取文件大小时发生错误:', error)
      throw error
    }
  }

  count (count: number | null | undefined): string {
    if (count && count > 10000) return (count / 10000).toFixed(1) + '万'
    return count?.toString() || '无法获取'
  }

  async mkdir (dirname: string): Promise<boolean> {
    try {
      await fs.promises.mkdir(dirname, { recursive: true })
      return true
    } catch {
      return false
    }
  }

  async removeFile (dirname: string, force = false): Promise<boolean> {
    if (!Config.app.removeCache && !force) return true
    const normalizedPath = dirname.replace(/\\/g, '/')
    try {
      await fs.promises.unlink(normalizedPath)
      logger.mark(`缓存文件: ${normalizedPath} 删除成功！`)
      return true
    } catch (error: unknown) {
      logger.error(`缓存文件: ${normalizedPath} 删除失败！`, error)
      return false
    }
  }

  convertTimestampToDateTime (timestamp: number): string {
    const date = new Date(timestamp * 1000)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  getCurrentTime (): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  }

  useDarkTheme (): boolean {
    return resolveUseDarkTheme(Config.app.Theme)
  }

  timeSince (timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const remainingSeconds = seconds % 60
    const remainingMinutes = minutes % 60
    if (hours > 0) return `${hours}小时${remainingMinutes}分钟${remainingSeconds}秒`
    if (minutes > 0) return `${minutes}分钟${remainingSeconds}秒`
    return `${seconds}秒`
  }

  async sleep (ms: number): Promise<void> {
    setTimeout(() => {}, ms)
  }
}

function getErrorMessage (error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue (value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export default new Tools()
