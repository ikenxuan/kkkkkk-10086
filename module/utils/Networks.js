import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import Config from './Config.js'
import { Transform } from 'stream'
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
      maxRedirects: this.maxRetries,
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
  async returnResult(retryCount = 0) {
    try {
      return await this.axiosInstance(this.config)
    } catch (error) {
      const axiosError = /** @type {AxiosError} */ (error)
      if (retryCount < this.maxRetries && axiosError.code === 'ECONNRESET') {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.returnResult(retryCount + 1)
      }
      logger.error('请求失败:', this.handleError(axiosError))
      throw axiosError
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
    // 使用传入的url参数，如果没有则使用this.url作为初始URL
    const currentUrl = url || this.url
    if (redirectCount > 10) return currentUrl // 防止无限重定向
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
          return currentUrl
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
   * 流式下载文件，支持进度回调、自动重试、分片并发、断点恢复（重试时）
   * @param {(downloadedBytes: number, totalBytes: number) => void} progressCallback
   * @param {number} [retryCount=0] 内部重试计数，调用方无需传入
   * @returns {Promise<{filepath:string,totalBytes:number}>} 本地路径与最终字节数
   * @throws {Error} 超过最大重试次数或不可恢复错误
   */
  async downloadStream(progressCallback, retryCount = 0) {
    const startTime = Date.now()               // 用于未知大小时的速度估算
    const controller = new AbortController()   // 可取消请求
    // 超时随重试次数递增：首次 60 s，上限 180 s
    const timeoutDuration = retryCount === 0
      ? 60000
      : Math.min(60000 + retryCount * 60000, 180000)
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration)
    const resources = new Set()                // 跟踪所有可销毁资源

    /** 创建节流进度更新器；当 totalSize<=0 时动态估算总大小 */
    const createProgressUpdater = (/** @type {number} */ totalSize, minInterval = 1000) => {
      let lastUpdateTime = 0
      let lastPercentage = -1

      return (/** @type {number} */ downloadedBytes) => {
        const now = Date.now()
        if (now - lastUpdateTime < minInterval) return   // 节流

        const validDown = Math.max(0, isFinite(downloadedBytes) ? downloadedBytes : 0)
        const validTotal = totalSize > 0 ? totalSize : validDown + 1

        let estimatedTotal = validTotal
        // 已下载 ≥512 KB 且未拿到 Content-Length 时，按速度估算剩余
        if (totalSize <= 0 && validDown > 512 * 1024) {
          const elapsed = (Date.now() - startTime) / 1000 || 1
          const speed = validDown / elapsed               // bytes/s
          const remaining = Math.min(speed * 30, 100 * 1024 * 1024) // 上限 100 MB
          estimatedTotal = Math.max(validDown * 1.5, validDown + remaining)
        }

        const progress = Math.min(validDown / estimatedTotal, 0.99)
        const percentage = Math.floor(progress * 100)

        if (percentage !== lastPercentage) {          // 防重复
          progressCallback(validDown, estimatedTotal)
          lastPercentage = percentage
          lastUpdateTime = now
        }
      }
    }

    /** 统一释放资源：取消超时、销毁流、清空集合 */
    const cleanupResources = () => {
      clearTimeout(timeoutId)
      resources.forEach(r => r.destroy?.())
      resources.clear()
    }

    try {
      const response = await axios({
        ...this.config,
        url: this.url,
        responseType: 'stream',
        signal: controller.signal,
        maxContentLength: Number.MAX_SAFE_INTEGER,
        maxBodyLength: Number.MAX_SAFE_INTEGER,
        timeout: timeoutDuration,
        maxRedirects: 10,
        headers: {
          ...this.headers,
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
        }
      })

      clearTimeout(timeoutId)   // 请求头响应成功则取消超时器

      if (!(response.status >= 200 && response.status < 300))
        throw new Error(`无法获取 ${this.url}。状态: ${response.status} ${response.statusText}`)

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
      if (!this.filepath) throw new Error('文件路径未设置')

      /**
       * 通用流处理：将 source → transform（计数）→ writer 并报告进度
       * @returns 最终写入字节数
       */
      const processStream = async (/** @type {any} */ source, /** @type {fs.WriteStream} */ writer, /** @type {{ (downloadedBytes: number): void; (downloadedBytes: number): void; (arg0: number): void; }} */ onProgress) => {
        let downloadedBytes = 0
        const transform = new Transform({
          highWaterMark: 1024 * 1024,
          transform(chunk, enc, cb) {
            downloadedBytes += chunk.length
            onProgress(downloadedBytes)
            cb(null, chunk)
          }
        })

        resources.add(source)
        resources.add(transform)
        resources.add(writer)
        await pipeline(source, transform, writer)
        return downloadedBytes
      }

      // 1. 服务器未返回 Content-Length：单线程直存
      if (isNaN(totalBytes) || totalBytes <= 0) {
        const writer = fs.createWriteStream(this.filepath, { highWaterMark: 1024 * 1024 })
        const updateProgress = createProgressUpdater(0)
        const downloadedBytes = await processStream(response.data, writer, updateProgress)
        progressCallback(downloadedBytes, downloadedBytes) // 最终 100%
        return { filepath: this.filepath, totalBytes: downloadedBytes }
      }

      // 2. 小文件 (<10 MB)：单线程，带确定性进度
      if (totalBytes < 10 * 1024 * 1024) {
        const writer = fs.createWriteStream(this.filepath, { highWaterMark: 1024 * 1024 })
        const updateProgress = createProgressUpdater(totalBytes)
        await processStream(response.data, writer, updateProgress)
        return { filepath: this.filepath, totalBytes }
      }

      // 3. 大文件：分片并发下载 → 临时目录 → 合并
      const chunkSize = totalBytes > 50 * 1024 * 1024
        ? Math.ceil(totalBytes / 10)          // >50 MB 分 10 片
        : 5 * 1024 * 1024                     // 否则每片 5 MB
      const concurrent = retryCount > 0 ? 1   // 重试时退避单线程
        : Math.min(4, Math.ceil(totalBytes / (10 * 1024 * 1024)))
      const chunksCount = Math.ceil(totalBytes / chunkSize)
      const tempDir = `${this.filepath}.tmp`
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

      let totalDown = 0
      const updateProgress = createProgressUpdater(totalBytes)

      /** 下载指定 Range 分片并写临时文件 */
      const downloadChunk = async (/** @type {number} */ start, /** @type {number} */ end, /** @type {number} */ index) => {
        const chunkRes = await axios({
          ...this.config,
          url: this.url,
          responseType: 'stream',
          timeout: Math.min(60000 + (chunkSize / (1024 * 1024)) * 5000, 120000),
          headers: { ...this.config.headers, Range: `bytes=${start}-${end}` }
        })

        const chunkPath = `${tempDir}/chunk_${index}`
        const writer = fs.createWriteStream(chunkPath, { highWaterMark: 1024 * 1024 })

        let chunkDown = 0
        const transform = new Transform({
          highWaterMark: 1024 * 1024,
          transform(chunk, enc, cb) {
            chunkDown += chunk.length
            totalDown += chunk.length
            updateProgress(totalDown)
            cb(null, chunk)
          }
        })

        resources.add(chunkRes.data)
        resources.add(transform)
        resources.add(writer)
        await pipeline(chunkRes.data, transform, writer)
        return { chunkPath, size: end - start + 1 }
      }

      // 分批并发下载
      const chunkResults = []
      for (let i = 0; i < chunksCount; i += concurrent) {
        const batch = []
        for (let j = 0; j < concurrent && i + j < chunksCount; j++) {
          const start = (i + j) * chunkSize
          const end = Math.min((i + j + 1) * chunkSize - 1, totalBytes - 1)
          batch.push(downloadChunk(start, end, i + j))
        }
        chunkResults.push(...await Promise.all(batch))
      }

      // 顺序合并 → 目标文件
      const finalWriter = fs.createWriteStream(this.filepath, { highWaterMark: 20 * 1024 * 1024 })
      resources.add(finalWriter)

      for (const { chunkPath } of chunkResults) {
        const reader = fs.createReadStream(chunkPath, { highWaterMark: 1024 * 1024 })
        await new Promise((resolve, reject) => {
          reader.pipe(finalWriter, { end: false })
          reader.on('end', () => resolve('处理成功'))
          reader.on('error', reject)
        })
        fs.unlink(chunkPath, () => { }) // 异步删除临时片
      }
      finalWriter.end()

      // 异步清理临时目录
      fs.rm(tempDir, { recursive: true, force: true }, () => { })
      return { filepath: this.filepath, totalBytes }
    } catch (error) {
      cleanupResources()

      const axiosError = /** @type {AxiosError} */(error)

      // 对“aborted”特殊重试（网络瞬断）
      if (axiosError.code === 'ERR_BAD_RESPONSE' && axiosError.message.includes('aborted')) {
        logger.error(`下载被中止，可能是网络超时: ${this.url}`)
        if (retryCount < this.maxRetries + 2) {
          const delay = Math.min(2 ** retryCount * 3000, 10000)
          logger.warn(`网络连接问题，正在重试... (${retryCount + 1}/${this.maxRetries + 2})，将在 ${delay / 1000} 秒后重试`)
          await new Promise(r => setTimeout(r, delay))
          return this.downloadStream(progressCallback, retryCount + 1)
        }
      }

      const err = this.handleError(axiosError)

      // 常规重试
      if (retryCount < this.maxRetries) {
        const delay = Math.min(2 ** retryCount * 2000, 8000)
        logger.warn(`正在重试下载... (${retryCount + 1}/${this.maxRetries})，将在 ${delay / 1000} 秒后重试`)
        await new Promise(r => setTimeout(r, delay))
        return this.downloadStream(progressCallback, retryCount + 1)
      }

      throw new Error(`在 ${this.maxRetries} 次尝试后下载失败: ${err.message}`)
    } finally {
      this.cleanup() // 销毁连接池
    }
  }
}
