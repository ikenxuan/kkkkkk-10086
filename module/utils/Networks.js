import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import Config from './Config.js'
import { Transform } from 'stream'
import { logger } from './index.js'
import axios, { AxiosError } from 'axios'
import { pipeline } from 'stream/promises'

/**
 * User-Agent 列表及权重配置
 * @type {{ua: string, weight: number}[]}
 */
const userAgents = [
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.10 Safari/605.1.1', weight: 43.03 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.3', weight: 21.05 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.3', weight: 17.34 },
  { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.3', weight: 3.72 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Trailer/93.3.8652.5', weight: 2.48 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.', weight: 2.48 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.', weight: 2.48 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 OPR/117.0.0.', weight: 2.48 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.', weight: 1.24 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.1958', weight: 1.24 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.', weight: 1.24 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.3', weight: 1.24 }
]

/**
 * 根据权重随机获取 User-Agent
 * @returns {string} 随机的 User-Agent 字符串
 */
const getRandomUserAgent = () => {
  const validAgents = userAgents.filter(a => a?.ua && typeof a.weight === 'number' && a.weight > 0)
  if (!validAgents.length) return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0'

  const totalWeight = validAgents.reduce((sum, a) => sum + a.weight, 0)
  let random = Math.random() * totalWeight

  return validAgents.find(a => (random -= a.weight) <= 0)?.ua || validAgents.at(-1)?.ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0'
}

/**
 * 基础请求头配置
 * @type {import('axios').AxiosRequestConfig['headers']}
 */
export const baseHeaders = {
  Accept: '*/*',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
  'User-Agent': getRandomUserAgent()
}

/**
 * 网络请求类，提供HTTP请求、文件下载等功能
 */
export class Networks {
  /** @type {import('axios').AxiosInstance} */
  axiosInstance
  /** @type {import('axios').AxiosProxyConfig | false} */
  proxy

  /**
   * 创建网络请求实例
   * @param {object} data 请求配置对象
   * @param {string} data.url 请求的URL地址
   * @param {import('axios').AxiosRequestConfig['headers']} [data.headers = {}] 请求头对象
   * @param {import('axios').ResponseType} [data.type = 'json'] 返回的数据类型
   * @param {string} [data.method = 'GET'] 请求方法
   * @param {*} [data.body = ''] POST请求时的请求体
   * @param {number} [data.timeout = 60000] 请求超时时间，默认60秒
   * @param {number} [data.maxRetries = 3] 最大重试次数
   * @param {string} [data.filepath] 流下载时的文件路径
   * @param {object} [data.proxy] 代理配置
   */
  constructor(data) {
    // 初始化请求头
    this.headers = data.headers
      ? Object.fromEntries(
        Object.entries(data.headers).map(([key, value]) => {
          try {
            return [key, value != null ? String(value) : '']
          } catch (e) {
            logger.warn(`请求头值转换失败: ${key}`, e)
            return [key, '']
          }
        })
      )
      : {}

    // 初始化请求参数
    this.url = data.url
    this.type = data.type || 'json'
    this.method = data.method || 'GET'
    this.body = data.body || ''
    this.timeout = data.timeout || 60000
    this.filepath = data.filepath
    this.maxRetries = data.maxRetries || 3
    this.proxy = Config.request?.proxy?.switch ? {
      host: Config.request.proxy.host,
      port: parseInt(Config.request.proxy.port),
      protocol: Config.request.proxy.protocol,
      auth: Config.request.proxy.auth
    } : false

    // 创建连接池
    const socketOptions = {
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 20,
      maxFreeSockets: 10,
      timeout: 120000,
      /** @type {"fifo" | "lifo"} */
      scheduling: 'fifo',
      rejectUnauthorized: false
    }

    this.httpAgent = new http.Agent(socketOptions)
    this.httpsAgent = new https.Agent(socketOptions)

    // 创建axios实例
    this.axiosInstance = axios.create({
      timeout: this.timeout,
      headers: this.headers,
      maxRedirects: 5,
      validateStatus: (status) => {
        return (status >= 200 && status < 300) || status === 406 || (status >= 500)
      }
    })
  }

  /**
   * 清理资源
   * @returns {void}
   */
  cleanup() {
    // 清理连接池
    if (this.httpAgent) {
      this.httpAgent.destroy()
    }
    if (this.httpsAgent) {
      this.httpsAgent.destroy()
    }
  }

  /**
   * 析构方法，确保资源被释放
   */
  [Symbol.dispose]() {
    this.cleanup()
  }

  /**
   * 错误处理方法
   * @param {AxiosError} error 错误对象
   * @returns {Error} 处理后的错误对象
   */
  handleError(error) {
    const url = error.config?.url || this.url

    // 统一错误映射
    /** @type {Object.<string, string>} */
    const errors = {
      'ERR_INVALID_URL': `无效的URL格式: ${url}`,
      'ECONNRESET': `连接被重置: ${url}`,
      'ETIMEDOUT': `请求超时: ${url}`,
      'ENOTFOUND': `DNS解析失败: ${url}`,
      'ECONNREFUSED': `连接被拒绝: ${url}`,
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE': `SSL证书验证失败，但请求已继续: ${url}`,
      'AbortError': `请求被中止，可能是网络超时: ${url}`
    }

    // HTTP状态码映射
    /** @type {Object.<number, string>} */
    const httpStatus = {
      429: '请求过于频繁', 403: '访问被禁止', 404: '请求的资源不存在',
      408: '请求超时', 502: '服务器暂时不可用', 503: '服务器暂时不可用', 504: '服务器暂时不可用'
    }

    // 检查错误码
    if (error.code && errors[error.code]) return new Error(errors[error.code])
    if (error.name && errors[error.name]) return new Error(errors[error.name])

    // 特殊处理中止错误
    if (error.code === 'ERR_BAD_RESPONSE' && error.message?.includes('aborted')) {
      return new Error(`网络连接被中止，可能是超时或网络不稳定: ${url}`)
    }

    // HTTP响应错误
    if (error.response) {
      const { status, statusText = '' } = error.response
      const msg = httpStatus[status] || '请求失败'
      return new Error(`${msg} (${status}): ${url}${statusText ? ` - ${statusText}` : ''}`)
    }

    // 网络请求错误
    if (error.request) return new Error(`网络连接错误: ${url}`)

    return new Error(`请求配置错误: ${error.message}`)
  }

  /**
   * 获取请求配置
   * @returns {import('axios').AxiosRequestConfig} axios请求配置对象
   */
  get config() {
    /** @type {import('axios').AxiosRequestConfig} */
    const config = {
      url: this.url,
      method: this.method,
      headers: this.headers,
      responseType: this.type,
      timeout: this.timeout,
      maxRedirects: this.maxRetries,
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent,
      proxy: this.proxy
    }

    if (this.method === 'POST' && this.body) {
      config.data = this.body
    }

    return config
  }

  /**
   * 发起网络请求
   * @returns {Promise<import('axios').AxiosResponse | boolean>} 返回请求结果或false
   */
  async getfetch() {
    try {
      const result = await this.returnResult()
      if (result.status === 504) {
        return result
      }
      return result
    } catch (error) {
      logger.error('获取失败:', this.handleError(/** @type {AxiosError} */(error)))
      return false
    }
  }

  /**
   * 基础请求方法
   * @returns {Promise<import('axios').AxiosResponse>} 返回axios响应对象
   * @throws {Error} 请求失败时抛出错误
   */
  async returnResult() {
    try {
      return await this.axiosInstance(this.config)
    } catch (error) {
      logger.error('请求失败:', this.handleError(/** @type {AxiosError} */(error)))
      throw error
    }
  }

  /**
   * 获取重定向后的最终链接地址
   * @param {string} [url = ''] 可选参数，要获取重定向链接的URL地址
   * @param {number} [redirectCount = 0] 重定向计数器
   * @param {Set<string>} [visitedUrls = new Set()] 已访问的URL集合
   * @returns {Promise<string>} 返回最终的重定向链接地址或错误信息
   */
  async getLongLink(url = '', redirectCount = 0, visitedUrls = new Set()) {
    // 限制最多10次重定向，防止循环重定向
    if (redirectCount > 10) {
      throw new Error('重定向次数过多，可能存在循环重定向')
    }

    // 使用传入的url参数，如果没有则使用this.url作为初始URL
    const currentUrl = url || this.url
    // 检查是否已经访问过这个URL
    if (visitedUrls.has(currentUrl)) {
      logger.warn(`检测到循环重定向，停止在: ${currentUrl}`)
      return currentUrl
    }
    visitedUrls.add(currentUrl)

    let errorMsg = `获取链接重定向失败: ${currentUrl}`
    try {
      const response = await this.axiosInstance.get(currentUrl, this.config)
      // 如果服务器返回的重定向URL与当前URL相同，也视为循环重定向
      const finalUrl = response.request.res.responseUrl
      if (finalUrl === currentUrl) {
        logger.warn(`检测到服务器返回相同的重定向URL，停止在: ${currentUrl}`)
        return currentUrl
      }
      return finalUrl
    } catch (error) {
      const axiosError = /** @type {AxiosError} */ (error)
      if (axiosError.response) {
        if (axiosError.response.status === 302) {
          const redirectUrl = axiosError.response.headers.location
          logger.info(`检测到302重定向，目标地址: ${redirectUrl}`)
          // 递归调用时只传递新的重定向URL，不再包含this.url
          return await this.getLongLink(redirectUrl, redirectCount + 1, visitedUrls)
        } else if (axiosError.response.status === 403) {
          errorMsg = `403 Forbidden 禁止访问！${currentUrl}`
          logger.error(errorMsg)
          return errorMsg
        }
      }
      logger.error(this.handleError(axiosError))
      return currentUrl // 返回原始URL，因为发生了错误
    }
  }

  /**
   * 获取首个302重定向地址
   * @returns {Promise<import('axios').AxiosResponse['headers']['location'] | string>} 返回重定向地址或原始URL
   */
  async getLocation() {
    try {
      const response = await this.axiosInstance.get(this.url, {
        ...this.config,
        maxRedirects: 0, // 禁止自动重定向
        validateStatus: (status) => status >= 300 && status < 400 // 仅处理3xx响应
      })

      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        return response.headers.location
      }
      return this.url
    } catch (error) {
      const axiosError = /** @type {AxiosError} */ (error)
      if (axiosError.response && axiosError.response.status === 302 && axiosError.response.headers.location) {
        return axiosError.response.headers.location
      }
      logger.error('获取重定向地址失败:', this.handleError(axiosError))
      return this.url
    }
  }

  /**
   * 获取响应数据
   * @returns {Promise<import('axios').AxiosResponse['data'] | boolean>} 返回响应数据或false
   */
  async getData() {
    try {
      const result = await this.returnResult()
      if (result.status === 504) {
        return result
      }
      if (result.status === 429) {
        logger.error('HTTP 响应状态码: 429')
        throw new Error('ratelimit triggered, 触发 https://www.douyin.com/ 的速率限制！！！')
      }
      return result.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.stack || error.message)
      }
      return false
    }
  }

  /**
   * 获取响应头信息（仅首个字节）
   * @returns {Promise<import('axios').AxiosResponse['headers']>} 返回响应头信息
   */
  async getHeaders() {
    try {
      const response = await this.axiosInstance.get(this.url, {
        ...this.config,
        headers: {
          ...this.headers,
          Range: 'bytes=0-0'
        }
      })
      return response.headers
    } catch (error) {
      logger.error(this.handleError(/** @type {AxiosError} */(error)))
      throw error
    }
  }

  /**
   * 获取响应头信息（完整）
   * @returns {Promise<import('axios').AxiosResponse['headers']>} 返回响应头信息
   */
  async getHeadersFull() {
    try {
      const response = await this.axiosInstance.get(this.url, this.config)
      return response.headers
    } catch (error) {
      logger.error(this.handleError(/** @type {AxiosError} */(error)))
      throw error
    }
  }

  /**
   * 异步下载流方法
   * @param {(downloadedBytes: number, totalBytes: number) => void} progressCallback - 下载进度回调函数
   * @param {number} [retryCount = 0] - 当前重试次数
   * @returns {Promise<{filepath: string, totalBytes: number}>} 返回包含文件路径和总字节数的对象
   * @throws {Error} 下载失败时抛出错误
   */
  async downloadStream(progressCallback, retryCount = 0) {
    const controller = new AbortController()
    // 动态调整超时时间：首次请求60秒，重试时延长到180秒
    const timeoutDuration = retryCount === 0 ? 60000 : Math.min(60000 + (retryCount * 60000), 180000)
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration)
    let resources = new Set()

    try {
      const response = await axios({
        ...this.config,
        url: this.url,
        responseType: 'stream',
        signal: controller.signal,
        maxContentLength: Number.MAX_SAFE_INTEGER,
        maxBodyLength: Number.MAX_SAFE_INTEGER,
        // 增加额外的容错配置
        timeout: timeoutDuration,
        // 允许更多的重定向
        maxRedirects: 10,
        // 增加请求头，模拟浏览器行为
        headers: {
          ...this.headers,
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })

      // 如果请求成功，清除超时定时器
      clearTimeout(timeoutId)

      // 检查响应状态，如果请求失败则抛出错误
      if (!(response.status >= 200 && response.status < 300)) {
        throw new Error(`无法获取 ${this.url}。状态: ${response.status} ${response.statusText}`)
      }

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10)

      if (!this.filepath) {
        throw new Error('文件路径未设置')
      }

      // 验证参数的辅助函数
      const validateProgressParams = (/** @type {number} */ downloadedBytes, /** @type {number} */ totalBytes) => {
        const validDownloadedBytes = isFinite(downloadedBytes) && downloadedBytes >= 0 ? downloadedBytes : 0
        const validTotalBytes = isFinite(totalBytes) && totalBytes > 0 ? totalBytes : validDownloadedBytes + 1
        return { validDownloadedBytes, validTotalBytes }
      }

      // 创建Transform流的辅助函数
      const createTransformStream = (/** @type {number} */ bytesTracker) => {
        return new Transform({
          transform(chunk, encoding, callback) {
            bytesTracker += chunk.length
            this.push(chunk)
            callback()
          },
          highWaterMark: 1024 * 1024
        })
      }

      // 管理资源的辅助函数
      const manageResources = (/** @type {any[]} */ streams, progressInterval = null) => {
        streams.forEach(stream => resources.add(stream))
        return {
          cleanup: () => {
            if (progressInterval) {
              clearInterval(progressInterval)
            }
            resources.forEach(resource => {
              if (resource.destroy) {
                resource.destroy()
              }
            })
            resources.clear()
          }
        }
      }

      // 处理流管道的辅助函数
      const handleStreamPipeline = async (/** @type {any} */ source, /** @type {Transform} */ transform, /** @type {fs.WriteStream} */ writer, onComplete = () => { }) => {
        const resourceManager = manageResources([source, transform, writer])
        try {
          await pipeline(source, transform, writer)
          onComplete()
        } finally {
          resourceManager.cleanup()
        }
      }

      // 设置进度更新的辅助函数
      const setupProgressUpdater = (/** @type {number} */ bytesTracker, /** @type {number} */ totalSize, minUpdateInterval = 500) => {
        let lastPrintedPercentage = -1
        let lastUpdateTime = 0

        const updateFn = () => {
          const now = Date.now()
          if (now - lastUpdateTime >= minUpdateInterval) {
            const { validDownloadedBytes, validTotalBytes } = validateProgressParams(bytesTracker, totalSize)

            // 对于未知大小的文件，使用基于时间和速度的估算
            let estimatedTotal = validTotalBytes
            if (totalSize <= 0 && bytesTracker > 1024 * 1024) {
              estimatedTotal = Math.max(bytesTracker * 3, bytesTracker + 10 * 1024 * 1024)
            }

            const progress = Math.min(bytesTracker / estimatedTotal, 0.99)
            const progressPercentage = Math.floor(progress * 100)

            if (progressPercentage !== lastPrintedPercentage) {
              progressCallback(validDownloadedBytes, estimatedTotal)
              lastPrintedPercentage = progressPercentage
              lastUpdateTime = now
            }
          }
        }

        const interval = /** @type {NodeJS.Timeout} */ (setInterval(updateFn, 100))

        return {
          interval,
          cleanup: () => clearInterval(interval)
        }
      }

      // 智能选择下载策略
      if (isNaN(totalBytes) || totalBytes <= 0) {
        // 处理无文件大小信息的情况 - 使用流式下载
        const writer = fs.createWriteStream(this.filepath, {
          highWaterMark: 1024 * 1024
        })

        let downloadedBytes = 0
        const progressUpdater = setupProgressUpdater(downloadedBytes, totalBytes)
        const transform = createTransformStream(downloadedBytes)

        await handleStreamPipeline(response.data, transform, writer, () => {
          // 下载完成后，使用实际下载大小作为总大小
          const finalDownloadedBytes = validateProgressParams(downloadedBytes, 0).validDownloadedBytes
          progressCallback(finalDownloadedBytes, finalDownloadedBytes)
          progressUpdater.cleanup()
        })

        return { filepath: this.filepath, totalBytes: downloadedBytes }
      }

      // 对于小文件，使用单线程下载
      if (totalBytes < 10 * 1024 * 1024) { // 小于10MB
        const writer = fs.createWriteStream(this.filepath, {
          highWaterMark: 1024 * 1024
        })

        let downloadedBytes = 0
        let lastPrintedPercentage = -1
        const minUpdateInterval = 500 // 最小更新间隔(ms)
        let lastUpdateTime = 0

        // 小文件专用的进度更新器
        const progressInterval = /** @type {NodeJS.Timeout} */ (setInterval(() => {
          const now = Date.now()
          if (now - lastUpdateTime >= minUpdateInterval) {
            const { validDownloadedBytes, validTotalBytes } = validateProgressParams(downloadedBytes, totalBytes)
            const progressPercentage = Math.floor((validDownloadedBytes / validTotalBytes) * 100)

            if (progressPercentage !== lastPrintedPercentage) {
              progressCallback(validDownloadedBytes, validTotalBytes)
              lastPrintedPercentage = progressPercentage
              lastUpdateTime = now
            }

            if (downloadedBytes >= totalBytes) {
              clearInterval(progressInterval)
            }
          }
        }, 50))

        const transform = createTransformStream(downloadedBytes)
        await handleStreamPipeline(response.data, transform, writer, () => {
          clearInterval(progressInterval)
        })

        return { filepath: this.filepath, totalBytes }
      }

      // 对于大文件，使用分片并发下载
      // 大于50MB的文件：10个分片 0-50MB的文件：5MB分片
      const chunkSize = totalBytes > 50 * 1024 * 1024 ? Math.ceil(totalBytes / 10) : 5 * 1024 * 1024

      // 优化：根据文件大小和系统性能动态调整并发数
      const concurrentDownloads = retryCount > 0
        ? 1 // 重试时使用单线程
        : Math.min(4, Math.ceil(totalBytes / (10 * 1024 * 1024))) // 动态计算并发数，最多4个并发
      const chunks = Math.ceil(totalBytes / chunkSize)

      // 创建临时目录
      const tempDir = `${this.filepath}.tmp`
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      // 跟踪总下载进度
      let totalDownloadedBytes = 0
      let lastPrintedPercentage = -1

      // 更新进度的函数
      const updateProgress = () => {
        // 验证文件大小
        if (!isFinite(totalBytes) || totalBytes <= 0) {
          logger.warn('无效的文件大小，跳过进度更新')
          return
        }

        // 验证下载字节数
        if (!isFinite(totalDownloadedBytes) || totalDownloadedBytes < 0) {
          logger.warn('无效的下载字节数，跳过进度更新')
          return
        }

        // 确保进度不超过100%
        const progress = Math.min(totalDownloadedBytes / totalBytes, 1)
        const progressPercentage = Math.floor(progress * 100)

        if (progressPercentage !== lastPrintedPercentage) {
          progressCallback(totalDownloadedBytes, totalBytes)
          lastPrintedPercentage = progressPercentage
        }
      }

      // 并发下载函数
      const downloadChunk = async (/** @type {number} */ start, /** @type {number} */ end, /** @type {number} */ index) => {
        const chunkResponse = await axios({
          ...this.config,
          url: this.url,
          responseType: 'stream',
          timeout: Math.min(60000 + (chunkSize / (1024 * 1024)) * 5000, 120000),
          headers: {
            ...this.config.headers,
            Range: `bytes=${start}-${end}`
          }
        })

        const chunkPath = `${tempDir}/chunk_${index}`
        const chunkWriter = fs.createWriteStream(chunkPath, {
          highWaterMark: 1024 * 1024
        })

        let chunkDownloadedBytes = 0
        const chunkTransform = new Transform({
          transform(chunk, encoding, callback) {
            chunkDownloadedBytes += chunk.length
            totalDownloadedBytes += chunk.length
            updateProgress()
            this.push(chunk)
            callback()
          },
          highWaterMark: 1024 * 1024
        })

        resources.add(chunkResponse.data)
        resources.add(chunkTransform)
        resources.add(chunkWriter)

        await pipeline(chunkResponse.data, chunkTransform, chunkWriter)
        return { chunkPath, size: end - start + 1 }
      }

      const chunkResults = []
      for (let i = 0; i < chunks; i += concurrentDownloads) {
        const batchPromises = []
        for (let j = 0; j < concurrentDownloads && i + j < chunks; j++) {
          const start = (i + j) * chunkSize
          const end = Math.min((i + j + 1) * chunkSize - 1, totalBytes - 1)
          batchPromises.push(downloadChunk(start, end, i + j))
        }

        const batchResults = await Promise.all(batchPromises)
        chunkResults.push(...batchResults)
      }

      // 合并分块
      const finalWriter = fs.createWriteStream(this.filepath, {
        highWaterMark: 20 * 1024 * 1024
      })
      resources.add(finalWriter)

      // 使用流式处理合并分块，减少内存使用
      for (const { chunkPath } of chunkResults) {
        const chunkReader = fs.createReadStream(chunkPath, {
          highWaterMark: 1024 * 1024
        })

        await new Promise((resolve, reject) => {
          chunkReader.pipe(finalWriter, { end: false })
          chunkReader.on('end', () => {
            // 异步删除临时文件，不等待完成
            fs.unlink(chunkPath, (err) => {
              if (err) logger.warn(`删除临时文件失败: ${chunkPath}`, err)
            })
            resolve('处理完成')
          })
          chunkReader.on('error', reject)
        })
      }

      finalWriter.end()

      // 清理临时目录
      const cleanupTempDir = (/** @type {fs.PathLike} */ dir, retries = 3) => {
        // 检查目录是否存在
        if (!fs.existsSync(dir)) return

        // 删除临时目录
        fs.rm(dir, { recursive: true, force: true }, (err) => {
          if (err) {
            if (retries > 0) {
              logger.warn(`清理临时目录失败，重试中... (${retries}次剩余)`)
              setTimeout(() => cleanupTempDir(dir, retries - 1), 1000)
            } else {
              logger.error(`清理临时目录失败: ${dir}`, err)
            }
          }
        })
      }

      // 异步清理临时目录，不等待完成
      cleanupTempDir(tempDir)

      return { filepath: this.filepath, totalBytes }
    } catch (error) {
      clearTimeout(timeoutId)
      resources.forEach(resource => {
        if (resource.destroy) {
          resource.destroy()
        }
      })
      resources.clear()

      const axiosError = /** @type {AxiosError} */(error)

      // 特殊处理中止错误
      if (axiosError.code === 'ERR_BAD_RESPONSE' && axiosError.message.includes('aborted')) {
        logger.error(`下载被中止，可能是网络超时: ${this.url}`)

        // 对于中止错误，总是允许重试，不受重试次数限制
        if (retryCount < this.maxRetries + 2) { // 给中止错误更多重试机会
          const delay = Math.min(Math.pow(2, retryCount) * 3000, 10000) // 更长的延迟
          logger.warn(`网络连接问题，正在重试... (${retryCount + 1}/${this.maxRetries + 2})，将在 ${delay / 1000} 秒后重试`)
          await new Promise(resolve => setTimeout(resolve, delay))
          return this.downloadStream(progressCallback, retryCount + 1)
        }
      }

      const err = this.handleError(axiosError)

      // 进行重试
      if (retryCount < this.maxRetries) {
        const delay = Math.min(Math.pow(2, retryCount) * 2000, 8000)
        logger.warn(`正在重试下载... (${retryCount + 1}/${this.maxRetries})，将在 ${delay / 1000} 秒后重试`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.downloadStream(progressCallback, retryCount + 1)
      }
      throw new Error(`在 ${this.maxRetries} 次尝试后下载失败: ${err.message}`)
    } finally {
      // 清理连接池
      this.cleanup()
    }
  }
}
