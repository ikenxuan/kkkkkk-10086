import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const MB = 1024 * 1024
export const MULTIPART_MIN_SIZE = 8 * MB

export const clampConcurrency = (value) => {
  const parsed = Math.trunc(Number(value))
  return Number.isFinite(parsed) ? Math.min(8, Math.max(2, parsed)) : 4
}

export const parseContentRange = (value) => {
  const match = String(value || '').match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i)
  if (!match) return null
  const [, start, end, total] = match.map(Number)
  if (![start, end, total].every(Number.isSafeInteger) || start > end || end >= total) return null
  return { start, end, total }
}

export const createRanges = (total, concurrency) => {
  const count = Math.min(clampConcurrency(concurrency), total)
  const size = Math.ceil(total / count)
  return Array.from({ length: count }, (_, index) => {
    const start = index * size
    return { start, end: Math.min(total - 1, start + size - 1) }
  }).filter(range => range.start <= range.end)
}

const getValidator = (headers) => {
  const etag = String(headers.etag || '')
  if (etag && !etag.startsWith('W/')) return { name: 'etag', value: etag }
  const modified = String(headers['last-modified'] || '')
  return modified ? { name: 'last-modified', value: modified } : null
}

const isRetryable = (error) => {
  const status = error?.response?.status
  return !status || status === 429 || status === 503 || status >= 500
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

class RateLimitStream extends Transform {
  constructor (bytesPerSecond) {
    super()
    this.bytesPerSecond = bytesPerSecond
    this.startedAt = Date.now()
    this.bytes = 0
  }

  _transform (chunk, _encoding, callback) {
    this.bytes += chunk.length
    const expected = this.bytes / this.bytesPerSecond * 1000
    const wait = Math.max(0, expected - (Date.now() - this.startedAt))
    if (wait > 0) return setTimeout(() => callback(null, chunk), wait)
    callback(null, chunk)
  }
}

const publishFile = async (stagingPath, filepath) => {
  const backupPath = `${stagingPath}.previous`
  const exists = await fs.promises.access(filepath).then(() => true, () => false)
  if (exists) await fs.promises.rename(filepath, backupPath)
  try {
    await fs.promises.rename(stagingPath, filepath)
    if (exists) await fs.promises.rm(backupPath, { force: true })
  } catch (error) {
    if (exists) await fs.promises.rename(backupPath, filepath).catch(() => {})
    throw error
  }
}

/**
 * 探测服务器是否支持稳定的字节范围请求。
 * @param {object} options
 * @returns {Promise<{total: number, validator: {name: string, value: string}|null}>}
 */
export const probeRangeSupport = async (options) => {
  const response = await options.request({
    headers: { ...options.headers, 'Accept-Encoding': 'identity', Range: 'bytes=0-0' },
    responseType: 'stream',
    signal: options.signal
  })
  const range = parseContentRange(response.headers['content-range'])
  response.data.destroy?.()
  if (response.status !== 206 || !range || range.start !== 0 || range.end !== 0) {
    throw Object.assign(new Error('服务器不支持分片下载'), { code: 'MULTIPART_UNSUPPORTED' })
  }
  return { total: range.total, validator: getValidator(response.headers) }
}

/**
 * 将一个有限资源按 Range 分片下载到同目录临时文件，全部校验后发布。
 * @param {object} options
 * @param {string} options.filepath
 * @param {(config: object) => Promise<any>} options.request
 * @param {Record<string, any>} options.headers
 * @param {number} options.total
 * @param {{name: string, value: string}|null} options.validator
 * @param {number} options.concurrency
 * @param {number} options.maxRetries
 * @param {number} [options.maxSpeed]
 * @param {(downloaded: number, total: number, isLive: boolean) => void} options.onProgress
 */
export const downloadMultipart = async (options) => {
  const concurrency = clampConcurrency(options.concurrency)
  const ranges = createRanges(options.total, concurrency)
  const stagingPath = path.join(path.dirname(options.filepath), `.${path.basename(options.filepath)}.${process.pid}-${randomUUID()}.part`)
  const controller = new AbortController()
  const progress = new Array(ranges.length).fill(0)
  let lastProgressAt = 0

  const updateProgress = (index, bytes) => {
    progress[index] = bytes
    const now = Date.now()
    if (now - lastProgressAt >= 2000) {
      options.onProgress(progress.reduce((sum, value) => sum + value, 0), options.total, false)
      lastProgressAt = now
    }
  }

  await fs.promises.mkdir(path.dirname(options.filepath), { recursive: true })
  const staging = await fs.promises.open(stagingPath, 'w')
  await staging.truncate(options.total)
  await staging.close()

  const downloadPart = async (range, index) => {
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
        if (response.status !== 206 || !actual || actual.start !== range.start || actual.end !== range.end || actual.total !== options.total) {
          response.data.destroy?.()
          throw Object.assign(new Error('分片 Content-Range 校验失败'), { code: 'MULTIPART_INVALID_RANGE' })
        }
        if (options.validator && String(response.headers[options.validator.name] || '') !== options.validator.value) {
          response.data.destroy?.()
          throw Object.assign(new Error('下载资源在分片期间发生变化'), { code: 'MULTIPART_RESOURCE_CHANGED' })
        }

        const writer = fs.createWriteStream(stagingPath, {
          flags: 'r+',
          start: range.start,
          autoClose: true
        })
        let received = 0
        const counter = new Transform({
          transform (chunk, _encoding, callback) {
            received += chunk.length
            updateProgress(index, received)
            callback(null, chunk)
          }
        })
        const streams = [response.data]
        if (options.maxSpeed > 0) streams.push(new RateLimitStream(options.maxSpeed / concurrency))
        streams.push(counter, writer)
        await pipeline(...streams)
        if (received !== range.end - range.start + 1) {
          throw Object.assign(new Error(`分片长度校验失败: ${received}`), { code: 'MULTIPART_INVALID_LENGTH' })
        }
        return
      } catch (error) {
        const structural = String(error?.code || '').startsWith('MULTIPART_')
        if (structural || !isRetryable(error) || attempt >= options.maxRetries) throw error
        await delay(Math.min(3000, 500 * 2 ** attempt))
      }
    }
  }

  try {
    await Promise.all(ranges.map((range, index) => downloadPart(range, index)))
    const stats = await fs.promises.stat(stagingPath)
    if (stats.size !== options.total) throw new Error('多线程下载临时文件大小不匹配')
    await publishFile(stagingPath, options.filepath)
    options.onProgress(options.total, options.total, false)
    return { filepath: options.filepath, totalBytes: options.total }
  } catch (error) {
    controller.abort()
    await fs.promises.rm(stagingPath, { force: true }).catch(() => {})
    throw error
  }
}
