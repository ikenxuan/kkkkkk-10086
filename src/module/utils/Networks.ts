import { constants as cryptoConstants } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import os from 'node:os'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosProxyConfig,
  type AxiosRequestConfig,
  type AxiosResponse,
  type Method,
  type ResponseType
} from 'axios'
import type { Readable } from 'node:stream'
import type {
  DownloadOptions,
  DownloadUploadConfig,
  FileInfo,
  NormalizedDownloadOptions,
  NormalizedThrottleOptions
} from '@/types/platform'
import Config from './Config.js'
import {
  clampConcurrency,
  downloadMultipart,
  MULTIPART_MIN_SIZE,
  probeRangeSupport
} from './MultipartDownloader.js'

class ThrottleStream extends Transform {
  private readonly bytesPerSecond: number
  private readonly startTime = Date.now()
  private totalBytes = 0

  constructor (bytesPerSecond: number) {
    super()
    this.bytesPerSecond = bytesPerSecond
  }

  override _transform (
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    this.totalBytes += chunk.length
    const elapsed = (Date.now() - this.startTime) / 1000
    const expectedTime = this.totalBytes / this.bytesPerSecond
    const wait = Math.max(0, (expectedTime - elapsed) * 1000)
    if (wait > 0) {
      setTimeout(() => {
        this.push(chunk)
        callback()
      }, wait)
      return
    }
    this.push(chunk)
    callback()
  }
}

const MB = 1024 * 1024

export const normalizeDownloadOptions = (
  options: DownloadOptions,
  uploadConfig: DownloadUploadConfig
): NormalizedDownloadOptions => {
  const isLiveStream = options.isLiveStream === true
  const minSpeed = Math.max(0.1, Number(uploadConfig.downloadMinSpeed || 1)) * MB
  const maxSpeed = Math.max(0.1, Number(uploadConfig.downloadMaxSpeed || 10)) * MB
  return {
    isLiveStream,
    liveStreamMaxSize: options.liveStreamMaxSize ?? 10 * MB,
    multiThread: !isLiveStream && uploadConfig.downloadMultiThread === true,
    concurrency: clampConcurrency(uploadConfig.downloadConcurrency),
    throttle: {
      enabled: Boolean(uploadConfig.downloadThrottle),
      currentSpeed: Math.max(minSpeed, Number(options.currentSpeed || maxSpeed)),
      minSpeed,
      autoReduce: uploadConfig.downloadAutoReduce !== false
    }
  }
}

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes)) return 'unknown'
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)}MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${bytes}B`
}

const getThrottleOptions = (options: DownloadOptions): NormalizedThrottleOptions => {
  return normalizeDownloadOptions(options, Config.upload).throttle
}

interface WeightedUserAgent {
  ua: string
  pct: number
}

const userAgentsByPlatform: Record<'windows' | 'mac' | 'linux', WeightedUserAgent[]> = {
  windows: [
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36', pct: 17.34 },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0', pct: 2.48 },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0', pct: 2.48 },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 OPR/117.0.0.0', pct: 2.48 },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Trailer/93.3.8652.5', pct: 2.48 },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0', pct: 1.24 },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0', pct: 1.24 },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36', pct: 1.24 },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.19582', pct: 1.24 }
  ],
  mac: [
    { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.10 Safari/605.1.15', pct: 43.03 },
    { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36', pct: 21.05 }
  ],
  linux: [
    { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36', pct: 3.72 },
    { ua: 'Mozilla/5.0 (X11; Linux i686; rv:136.0) Gecko/20100101 Firefox/136.0', pct: 3.6 }
  ]
}

const getRandomUserAgent = (): string => {
  const agents = os.platform() === 'win32'
    ? userAgentsByPlatform.windows
    : os.platform() === 'darwin'
      ? userAgentsByPlatform.mac
      : userAgentsByPlatform.linux
  const totalWeight = agents.reduce((sum, agent) => sum + agent.pct, 0)
  let random = Math.random() * totalWeight
  const found = agents.find(agent => (random -= agent.pct) <= 0)
  return found?.ua || agents[0]?.ua || ''
}

export const baseHeaders: AxiosRequestConfig['headers'] = {
  Accept: '*/*',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'User-Agent': getRandomUserAgent()
}

export interface NetworkRequestOptions {
  url: string
  headers?: AxiosRequestConfig['headers']
  type?: ResponseType
  method?: Method
  body?: unknown
  timeout?: number
  maxRetries?: number
  filepath?: string
  proxy?: AxiosProxyConfig | false
}

export class Networks {
  readonly axiosInstance: AxiosInstance
  readonly proxy: AxiosProxyConfig | false
  readonly headers: AxiosRequestConfig['headers']
  readonly url: string
  readonly type: ResponseType
  readonly method: Method
  readonly body: unknown
  readonly timeout: number
  readonly filepath: string | undefined
  readonly maxRetries: number
  readonly userAgent: string
  readonly httpAgent: http.Agent
  readonly httpsAgent: https.Agent

  constructor (data: NetworkRequestOptions) {
    this.headers = data.headers || {}
    this.url = data.url
    this.type = data.type || 'json'
    this.method = data.method || 'GET'
    this.body = data.body || ''
    this.timeout = data.timeout || 30000
    this.filepath = data.filepath
    this.maxRetries = data.maxRetries || 3
    this.userAgent = getRandomUserAgent()
    this.proxy = Config.request?.proxy?.switch
      ? { host: Config.request.proxy.host, port: parseInt(Config.request.proxy.port), protocol: Config.request.proxy.protocol, auth: Config.request.proxy.auth }
      : false

    const agentOptions: http.AgentOptions = {
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 64,
      maxFreeSockets: 32,
      timeout: this.timeout,
      scheduling: 'fifo'
    }
    const httpsAgentOptions: https.AgentOptions = {
      ...agentOptions,
      rejectUnauthorized: false,
      minVersion: 'TLSv1',
      maxVersion: 'TLSv1.3',
      secureOptions: cryptoConstants.SSL_OP_NO_SSLv2 | cryptoConstants.SSL_OP_NO_SSLv3 | cryptoConstants.SSL_OP_NO_COMPRESSION
    }
    this.httpAgent = new http.Agent(agentOptions)
    this.httpsAgent = new https.Agent(httpsAgentOptions)
    this.axiosInstance = axios.create({
      timeout: this.timeout,
      maxRedirects: 5,
      validateStatus: status => status >= 200 && status < 300
    })
  }

  getConfig (retryCount = 0): AxiosRequestConfig {
    const headers: AxiosRequestConfig['headers'] = {
      'User-Agent': this.userAgent,
      Accept: '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      ...this.headers,
      ...(retryCount > 0 ? { 'Cache-Control': 'no-cache', Connection: 'close' } : {})
    }
    const config: AxiosRequestConfig = {
      url: this.url,
      method: this.method,
      headers,
      responseType: this.type,
      timeout: this.timeout,
      proxy: this.proxy,
      data: this.method === 'POST' ? this.body : undefined
    }
    if (this.url.startsWith('https:')) config.httpsAgent = this.httpsAgent
    else if (this.url.startsWith('http:')) config.httpAgent = this.httpAgent
    return config
  }

  async getfetch (): Promise<AxiosResponse | false> {
    try {
      return await this.request()
    } catch {
      return false
    }
  }

  async request (retryCount = 0): Promise<AxiosResponse> {
    try {
      return await this.axiosInstance(this.getConfig(retryCount))
    } catch (error: unknown) {
      const axiosError = toAxiosError(error)
      const isSSLError = isSslError(axiosError)
      if (axiosError.response?.status === 429 || axiosError.response?.status === 403) {
        if (retryCount < this.maxRetries) {
          await delay(2000 + Math.random() * 1000 + retryCount * 1000)
          return await this.request(retryCount + 1)
        }
      } else if (retryCount < this.maxRetries && (isSSLError || !axiosError.response)) {
        await delay(1000 * (retryCount + 1))
        return await this.request(retryCount + 1)
      }
      // 必须抛 Error 而不是 axiosError.message：抛裸字符串时 normalizeError
      // （ErrorHandler/render.ts:15）拿不到 stack，错误卡片的堆栈区直接不渲染。
      // toAxiosError 保证这里一定是带真实调用栈的 AxiosError。
      throw axiosError
    }
  }

  async getLongLink (url = '', retryCount = 0): Promise<string> {
    const targetUrl = url || this.url
    try {
      const response = await this.axiosInstance.get(targetUrl, {
        ...this.getConfig(retryCount),
        timeout: 5000,
        maxRedirects: 5
      })
      return response.request?.res?.responseUrl || response.config?.url || targetUrl
    } catch (error: unknown) {
      const axiosError = toAxiosError(error)
      if (retryCount < this.maxRetries) {
        await delay(1000 * (retryCount + 1))
        return await this.getLongLink(targetUrl, retryCount + 1)
      }
      logger.error(`获取重定向链接失败: ${axiosError.message}`)
      return targetUrl
    }
  }

  async getLocation (retryCount = 0): Promise<string> {
    try {
      const response = await this.axiosInstance.get(this.url, {
        ...this.getConfig(retryCount),
        timeout: 3000,
        maxRedirects: 0,
        validateStatus: status => status >= 300 && status < 400
      })
      return String(response.headers.location || this.url)
    } catch (error: unknown) {
      const axiosError = toAxiosError(error)
      if (retryCount < this.maxRetries && axiosError.code !== 'ERR_BAD_REQUEST') {
        await delay(1000 * (retryCount + 1))
        return await this.getLocation(retryCount + 1)
      }
      logger.error(`获取首个302重定向地址失败: ${axiosError.message}`)
      return String(axiosError.response?.headers.location || this.url)
    }
  }

  async getData<T = unknown> (): Promise<T> {
    const result = await this.request()
    if (result.status === 429) throw new Error('触发速率限制')
    return result.data as T
  }

  async getHeaders (retryCount = 0): Promise<AxiosResponse['headers']> {
    try {
      const config = this.getConfig(retryCount)
      const response = await this.axiosInstance.get(this.url, {
        ...config,
        timeout: 3000,
        headers: { ...config.headers, Range: 'bytes=0-0' }
      })
      return response.headers
    } catch (error: unknown) {
      const axiosError = toAxiosError(error)
      if (retryCount < this.maxRetries) {
        await delay(1000 * (retryCount + 1))
        return await this.getHeaders(retryCount + 1)
      }
      throw axiosError
    }
  }

  async downloadStream (
    progressCallback: (downloadedBytes: number, totalBytes: number, isLiveStream: boolean) => void,
    retryCount = 0,
    options: DownloadOptions = {}
  ): Promise<FileInfo> {
    const { isLiveStream = false, liveStreamMaxSize = 10 * MB } = options
    const throttle = getThrottleOptions(options)
    const filepath = this.filepath
    if (!filepath) throw new TypeError('下载文件路径不能为空')

    if (!isLiveStream && retryCount === 0 && Config.upload?.downloadMultiThread === true) {
      const request = async (requestOptions: AxiosRequestConfig): Promise<Pick<AxiosResponse<Readable>, 'status' | 'headers' | 'data'>> => {
        const config: AxiosRequestConfig = {
          url: this.url,
          method: 'GET',
          responseType: requestOptions.responseType,
          signal: requestOptions.signal,
          timeout: 0,
          maxRedirects: 5,
          decompress: false,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          proxy: this.proxy,
          headers: {
            'User-Agent': this.userAgent,
            Accept: '*/*',
            ...this.headers,
            ...requestOptions.headers
          }
        }
        if (this.url.startsWith('https:')) config.httpsAgent = this.httpsAgent
        else if (this.url.startsWith('http:')) config.httpAgent = this.httpAgent
        return await this.axiosInstance<Readable>(config)
      }

      let probe: Awaited<ReturnType<typeof probeRangeSupport>> | undefined
      try {
        probe = await probeRangeSupport({ request, headers: this.headers })
      } catch (error: unknown) {
        logger.debug(`服务器不满足多线程下载条件，自动回退单线程: ${getErrorMessage(error)}`)
      }
      if (probe?.total && probe.total >= MULTIPART_MIN_SIZE) {
        logger.debug(`启用多线程下载: ${Config.upload.downloadConcurrency || 4} 路, ${formatBytes(probe.total)}`)
        return await downloadMultipart({
          filepath,
          request,
          headers: this.headers,
          total: probe.total,
          validator: probe.validator,
          concurrency: Config.upload.downloadConcurrency || 4,
          maxRetries: this.maxRetries,
          maxSpeed: throttle.enabled ? throttle.currentSpeed : 0,
          onProgress: progressCallback
        })
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), isLiveStream ? 120000 : 90000)
    try {
      let totalBytes = -1
      let startByte = 0
      if (!isLiveStream && fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath)
        startByte = Math.max(0, stats.size - 256 * 1024)
        if (startByte > 0 && startByte < stats.size) {
          fs.truncateSync(filepath, startByte)
          logger.debug(`检测到部分下载文件，截断到 ${formatBytes(startByte)} 后断点续传`)
        }
      }

      const httpsAgent = retryCount > 0
        ? new https.Agent({ keepAlive: false, timeout: 60000, rejectUnauthorized: false })
        : this.httpsAgent
      const httpAgent = retryCount > 0
        ? new http.Agent({ keepAlive: false, timeout: 60000 })
        : this.httpAgent
      const downloadConfig: AxiosRequestConfig = {
        url: this.url,
        method: 'GET',
        responseType: 'stream',
        signal: controller.signal,
        timeout: 0,
        maxRedirects: 5,
        decompress: false,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
          'User-Agent': this.userAgent,
          Accept: '*/*',
          'Accept-Encoding': 'identity',
          Connection: retryCount > 0 ? 'close' : 'keep-alive',
          ...(startByte > 0 ? { Range: `bytes=${startByte}-` } : {}),
          ...this.headers
        }
      }
      if (this.url.startsWith('https:')) downloadConfig.httpsAgent = httpsAgent
      else if (this.url.startsWith('http:')) downloadConfig.httpAgent = httpAgent
      const response = await axios<Readable>(downloadConfig)
      clearTimeout(timeoutId)
      if (response.status < 200 || response.status >= 300) throw new Error(`下载失败，状态码: ${response.status}`)
      if (startByte > 0 && response.status !== 206) {
        logger.warn('服务器不支持断点续传，将重新下载整个文件')
        startByte = 0
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
      }
      if (response.status === 206 && response.headers['content-range']) {
        const rangeStart = Number(String(response.headers['content-range']).match(/bytes\s+(\d+)-/)?.[1])
        if (Number.isFinite(rangeStart) && rangeStart !== startByte) {
          logger.warn(`Content-Range 起始位置不匹配: 请求 ${startByte}, 实际 ${rangeStart}，将重新下载`)
          if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
          response.data.destroy?.()
          throw new Error('Content-Range 起始位置不匹配')
        }
      }
      if (!isLiveStream && response.headers['content-length']) {
        const contentLength = parseInt(String(response.headers['content-length'])) || -1
        totalBytes = response.status === 206 && contentLength > 0 ? startByte + contentLength : contentLength
      }

      const bufferSize = totalBytes > 50 * MB ? 32 * MB : 16 * MB
      const writer = fs.createWriteStream(filepath, {
        flags: startByte > 0 ? 'r+' : 'w',
        start: startByte > 0 ? startByte : undefined,
        highWaterMark: bufferSize
      })
      let downloadedBytes = startByte
      let lastUpdate = 0
      let lastChunkTime = Date.now()
      let stuckCheckInterval: NodeJS.Timeout | undefined
      const transform = new Transform({
        highWaterMark: bufferSize,
        transform (chunk: Buffer, _encoding, callback): void {
          downloadedBytes += chunk.length
          lastChunkTime = Date.now()
          if (isLiveStream && downloadedBytes >= liveStreamMaxSize) {
            controller.abort()
            callback(null, chunk)
            return
          }
          const now = Date.now()
          if (now - lastUpdate > 2000) {
            progressCallback(downloadedBytes, isLiveStream ? liveStreamMaxSize : totalBytes > 0 ? totalBytes : -1, isLiveStream)
            lastUpdate = now
          }
          callback(null, chunk)
        }
      })
      stuckCheckInterval = setInterval(() => {
        if (Date.now() - lastChunkTime > 30000) {
          controller.abort()
          if (stuckCheckInterval) clearInterval(stuckCheckInterval)
        }
      }, 5000)
      try {
        if (throttle.enabled) {
          logger.debug(`启用限速下载: ${formatBytes(throttle.currentSpeed)}/s`)
          await pipeline(response.data, new ThrottleStream(throttle.currentSpeed), transform, writer)
        } else {
          await pipeline(response.data, transform, writer)
        }
      } finally {
        if (stuckCheckInterval) clearInterval(stuckCheckInterval)
      }
      const finalTotal = totalBytes > 0 ? totalBytes : downloadedBytes
      progressCallback(downloadedBytes, finalTotal, isLiveStream)
      return { filepath, totalBytes: downloadedBytes }
    } catch (error: unknown) {
      clearTimeout(timeoutId)
      const axiosError = toAxiosError(error)
      if (isLiveStream && axiosError.code === 'ERR_CANCELED') {
        const stats = await fs.promises.stat(filepath).catch(() => ({ size: 0 }))
        return { filepath, totalBytes: stats.size }
      }
      if (retryCount < this.maxRetries) {
        const is403or429 = axiosError.response?.status === 403 || axiosError.response?.status === 429
        const isReset = axiosError.code === 'ECONNRESET' || axiosError.code === 'ECONNABORTED'
        const isTimeout = axiosError.code === 'ETIMEDOUT'
        const sslError = isSslError(axiosError)
        const nextSpeed = isReset && throttle.enabled && throttle.autoReduce
          ? Math.max(throttle.currentSpeed * 0.6, throttle.minSpeed)
          : throttle.currentSpeed
        if (nextSpeed < throttle.currentSpeed) {
          logger.warn(`检测到下载断流，自动降速: ${formatBytes(throttle.currentSpeed)}/s -> ${formatBytes(nextSpeed)}/s`)
        }
        const wait = is403or429
          ? 3000 + Math.random() * 2000
          : isReset
            ? 2000 + retryCount * 1000
            : isTimeout
              ? 2000
              : sslError
                ? 1500 + retryCount * 500
                : 1500 * (retryCount + 1)
        logger.warn(`下载失败(${axiosError.code || axiosError.message})，${Math.round(wait)}ms后重试 (${retryCount + 1}/${this.maxRetries})`)
        await delay(wait)
        return await this.downloadStream(progressCallback, retryCount + 1, { ...options, currentSpeed: nextSpeed })
      }
      throw axiosError
    }
  }
}

export function toAxiosError (error: unknown): AxiosError {
  if (axios.isAxiosError(error)) return error
  if (error instanceof Error) {
    return AxiosError.from(error, getErrorCode(error))
  }
  return new AxiosError(String(error))
}

function getErrorCode (error: Error): string | undefined {
  const code = Reflect.get(error, 'code') as unknown
  return typeof code === 'string' ? code : undefined
}

function isSslError (error: AxiosError): boolean {
  return error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    error.code === 'ERR_SSL_WRONG_VERSION_NUMBER' ||
    Boolean(error.message?.includes('SSL'))
}

function getErrorMessage (error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function delay (ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}
