import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Readable } from 'node:stream'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import type { FileInfo } from '@/types/platform'
import { clampConcurrency, tryAcquireDownloadSlots } from './DownloadBudget.js'
import {
  createSlowDownloadError,
  createSlowSpeedGuard,
  SAMPLE_INTERVAL_MS
} from './DownloadWatchdog.js'
import { isRecord } from './record.js'

const MB = 1024 * 1024
export const MULTIPART_MIN_SIZE = 8 * MB

export interface ByteRange {
  start: number
  end: number
}

export interface ContentRange extends ByteRange {
  total: number
}

export interface ResourceValidator {
  name: 'etag' | 'last-modified'
  value: string
}

interface StreamResponse extends Pick<AxiosResponse<Readable>, 'status' | 'headers' | 'data'> {}

type StreamRequest = (config: AxiosRequestConfig) => Promise<StreamResponse>

interface ProbeOptions {
  request: StreamRequest
  headers?: AxiosRequestConfig['headers']
  signal?: AbortSignal
}

interface MultipartDownloadOptions {
  filepath: string
  request: StreamRequest
  headers: AxiosRequestConfig['headers']
  total: number
  validator: ResourceValidator | null
  /** 该平台桶的额度上限；分片只能在这个上限内、且要扣掉文件级已占的那一格 */
  concurrency: number
  /** 显式桶名，缺省时由 AsyncLocalStorage 的解析上下文决定 */
  bucket?: string
  maxRetries: number
  maxSpeed?: number
  /**
   * 低速中断的地板速，字节/秒。0 表示不判。
   *
   * 判的是**所有分片合起来**的速率，不是单个分片的：分片之间快慢不均是正常的
   * （对端给每条连接的带宽本来就不一样），用户感知到的只有总速率。
   */
  slowFloorBytesPerSecond?: number
  /** 低速判定的持续窗口，毫秒 */
  slowSustainMs?: number
  onProgress: (downloaded: number, total: number, isLive: boolean) => void
}

export const parseContentRange = (value: unknown): ContentRange | null => {
  const match = String(value || '').match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i)
  if (!match?.[1] || !match[2] || !match[3]) return null
  const start = Number(match[1])
  const end = Number(match[2])
  const total = Number(match[3])
  if (![start, end, total].every(Number.isSafeInteger) || start > end || end >= total) return null
  return { start, end, total }
}

/**
 * 切分片区间。`concurrency` 是**已经和桶额度对齐过**的实际分片数，这里不再夹一次：
 * 抢不到额度时它就是 1，而旧的 clamp 会把 1 抬回 2，等于让「退化成单线程」失效。
 */
export const createRanges = (total: number, concurrency: number): ByteRange[] => {
  const requested = Math.trunc(Number(concurrency))
  const count = Math.max(1, Math.min(Number.isFinite(requested) ? requested : 1, total))
  const size = Math.ceil(total / count)
  return Array.from({ length: count }, (_, index) => {
    const start = index * size
    return { start, end: Math.min(total - 1, start + size - 1) }
  }).filter(range => range.start <= range.end)
}

const getValidator = (headers: AxiosResponse['headers']): ResourceValidator | null => {
  const etag = String(headers.etag || '')
  if (etag && !etag.startsWith('W/')) return { name: 'etag', value: etag }
  const modified = String(headers['last-modified'] || '')
  return modified ? { name: 'last-modified', value: modified } : null
}

const isRetryable = (error: unknown): boolean => {
  const status = getErrorResponseStatus(error)
  return !status || status === 429 || status === 503 || status >= 500
}

const delay = async (ms: number): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms))

class RateLimitStream extends Transform {
  private readonly bytesPerSecond: number
  private readonly startedAt = Date.now()
  private bytes = 0

  constructor (bytesPerSecond: number) {
    super()
    this.bytesPerSecond = bytesPerSecond
  }

  override _transform (
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null, data?: Buffer) => void
  ): void {
    this.bytes += chunk.length
    const expected = this.bytes / this.bytesPerSecond * 1000
    const wait = Math.max(0, expected - (Date.now() - this.startedAt))
    if (wait > 0) {
      setTimeout(() => callback(null, chunk), wait)
      return
    }
    callback(null, chunk)
  }
}

const publishFile = async (stagingPath: string, filepath: string): Promise<void> => {
  const backupPath = `${stagingPath}.previous`
  const exists = await fs.promises.access(filepath).then(() => true, () => false)
  if (exists) await fs.promises.rename(filepath, backupPath)
  try {
    await fs.promises.rename(stagingPath, filepath)
    if (exists) await fs.promises.rm(backupPath, { force: true })
  } catch (error: unknown) {
    if (exists) await fs.promises.rename(backupPath, filepath).catch(() => {})
    throw error
  }
}

export const probeRangeSupport = async (options: ProbeOptions): Promise<{
  total: number
  validator: ResourceValidator | null
}> => {
  const response = await options.request({
    headers: { ...options.headers, 'Accept-Encoding': 'identity', Range: 'bytes=0-0' },
    responseType: 'stream',
    signal: options.signal
  })
  const range = parseContentRange(response.headers['content-range'])
  response.data.destroy?.()
  if (response.status !== 206 || !range || range.start !== 0 || range.end !== 0) {
    throw createMultipartError('服务器不支持分片下载', 'MULTIPART_UNSUPPORTED')
  }
  return { total: range.total, validator: getValidator(response.headers) }
}

export const downloadMultipart = async (options: MultipartDownloadOptions): Promise<FileInfo> => {
  const budget = clampConcurrency(options.concurrency)
  // 文件级下载已经占了这个桶的一格额度，所以分片最多再要 budget - 1 格。
  // 用非阻塞的 tryAcquire：分片排队等额度会互相等死（桶里的额度全被这些
  // 等着开分片的文件本身占着）。一格都抢不到就只开一条 range，退化成
  // 单线程下载 —— 那是正确的降级，不是错误。
  const shardSlots = tryAcquireDownloadSlots(budget - 1, { bucket: options.bucket })
  const concurrency = 1 + shardSlots.length
  const ranges = createRanges(options.total, concurrency)
  const stagingPath = path.join(
    path.dirname(options.filepath),
    `.${path.basename(options.filepath)}.${process.pid}-${randomUUID()}.part`
  )
  const controller = new AbortController()
  const progress = new Array<number>(ranges.length).fill(0)
  let lastProgressAt = 0

  const downloadedSoFar = (): number => progress.reduce((sum, value) => sum + value, 0)

  const updateProgress = (index: number, bytes: number): void => {
    progress[index] = bytes
    const now = Date.now()
    if (now - lastProgressAt >= 2000) {
      options.onProgress(downloadedSoFar(), options.total, false)
      lastProgressAt = now
    }
  }

  // 低速看守。这条路也得有：多线程命中时是直接 return 的，如果只有单线程那边判低速，
  // 开了多线程等于把「限速自动重下」整个关掉 —— 而分片下载恰恰更容易撞上限速，
  // 因为同一个节点上开几条连接本来就更招限。
  //
  // 判的是所有分片的**合计**速率：分片之间快慢不均是正常的（对端分给每条连接的带宽
  // 本来就不一样），用户感知到的、也是我们要救的，只有总速率。
  const slowFloor = Math.round(options.slowFloorBytesPerSecond ?? 0)
  const slowGuard = slowFloor > 0
    ? createSlowSpeedGuard({ floorBytesPerSecond: slowFloor, sustainMs: options.slowSustainMs })
    : undefined
  let slowAbort: Error | undefined
  let slowCheckInterval: NodeJS.Timeout | undefined
  if (slowGuard) {
    slowGuard.reset(Date.now())
    slowCheckInterval = setInterval(() => {
      // 分片重试会把自己那格清零（`progress[index] = 0`），于是合计值会往回跳一下。
      // 看守拿 `Math.max(0, delta)` 收下界，所以那一跳只会得到一次 0 速率采样，
      // 而判定要连续低速满 sustainMs 才动手 —— 一次重试造成的凹陷吃不掉这个窗口。
      const verdict = slowGuard.sample({
        downloadedBytes: downloadedSoFar(),
        totalBytes: options.total,
        now: Date.now()
      })
      if (!verdict.triggered) return
      slowAbort = createSlowDownloadError(verdict.bytesPerSecond, slowFloor)
      logger.warn(`[下载] ${slowAbort.message}，掐掉分片下载重来并换一个地址`)
      controller.abort()
      if (slowCheckInterval) clearInterval(slowCheckInterval)
    }, SAMPLE_INTERVAL_MS)
  }

  await fs.promises.mkdir(path.dirname(options.filepath), { recursive: true })
  const staging = await fs.promises.open(stagingPath, 'w')
  await staging.truncate(options.total)
  await staging.close()

  const downloadPart = async (range: ByteRange, index: number): Promise<void> => {
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      progress[index] = 0
      try {
        const response = await options.request({
          headers: {
            ...options.headers,
            'Accept-Encoding': 'identity',
            Range: `bytes=${range.start}-${range.end}`
          },
          responseType: 'stream',
          signal: controller.signal
        })
        const actual = parseContentRange(response.headers['content-range'])
        if (
          response.status !== 206 || !actual || actual.start !== range.start ||
          actual.end !== range.end || actual.total !== options.total
        ) {
          response.data.destroy?.()
          throw createMultipartError('分片 Content-Range 校验失败', 'MULTIPART_INVALID_RANGE')
        }
        if (options.validator && String(response.headers[options.validator.name] || '') !== options.validator.value) {
          response.data.destroy?.()
          throw createMultipartError('下载资源在分片期间发生变化', 'MULTIPART_RESOURCE_CHANGED')
        }

        const writer = fs.createWriteStream(stagingPath, {
          flags: 'r+',
          start: range.start,
          autoClose: true
        })
        let received = 0
        const counter = new Transform({
          transform (chunk: Buffer, _encoding, callback): void {
            received += chunk.length
            updateProgress(index, received)
            callback(null, chunk)
          }
        })
        if (options.maxSpeed && options.maxSpeed > 0) {
          await pipeline(response.data, new RateLimitStream(options.maxSpeed / concurrency), counter, writer)
        } else {
          await pipeline(response.data, counter, writer)
        }
        if (received !== range.end - range.start + 1) {
          throw createMultipartError(`分片长度校验失败: ${received}`, 'MULTIPART_INVALID_LENGTH')
        }
        return
      } catch (error: unknown) {
        const structural = getErrorCode(error).startsWith('MULTIPART_')
        if (structural || !isRetryable(error) || attempt >= options.maxRetries) throw error
        await delay(Math.min(3000, 500 * 2 ** attempt))
      }
    }
  }

  try {
    await Promise.all(ranges.map(downloadPart))
    const stats = await fs.promises.stat(stagingPath)
    if (stats.size !== options.total) throw new Error('多线程下载临时文件大小不匹配')
    await publishFile(stagingPath, options.filepath)
    options.onProgress(options.total, options.total, false)
    return { filepath: options.filepath, totalBytes: options.total }
  } catch (error: unknown) {
    controller.abort()
    await fs.promises.rm(stagingPath, { force: true }).catch(() => {})
    // 我们自己掐的要抛自己那份错误：abort() 之后每个分片抛的都是 axios 的 ERR_CANCELED，
    // 直接往上扔的话上层只看到「请求被取消」，分不出是低速掐的还是别的原因取消的，
    // 于是 Networks 那边既不会记地址簿也不会换地址 —— 正好把这道判定的目的抹掉。
    if (slowAbort) throw slowAbort
    throw error
  } finally {
    if (slowCheckInterval) clearInterval(slowCheckInterval)
    for (const slot of shardSlots) slot.release()
  }
}

function createMultipartError (message: string, code: string): Error & { code: string } {
  return Object.assign(new Error(message), { code })
}

function getErrorCode (error: unknown): string {
  return isRecord(error) && typeof error.code === 'string' ? error.code : ''
}

function getErrorResponseStatus (error: unknown): number | undefined {
  if (!isRecord(error) || !isRecord(error.response)) return undefined
  return typeof error.response.status === 'number' ? error.response.status : undefined
}
