import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import Config from './Config.js'
import constants from 'node:constants'
import axios, { AxiosError } from 'axios'
import { pipeline } from 'stream/promises'
import { Transform, Readable } from 'node:stream'

/**
 * User-Agent 列表及权重配置
 * @type {{ua: string, weight: number}[]}
 */
const userAgents = [
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36', weight: 17.34 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.3124.85', weight: 2.48 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edge/44.18363.8131', weight: 2.48 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0', weight: 2.48 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0', weight: 2.48 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0', weight: 1.24 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 OPR/118.0.0.0', weight: 1.24 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; WOW64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 OPR/118.0.0.0', weight: 1.24 },
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
   * @param {number} [data.timeout = 30000] 请求超时时间，默认30秒
   * @param {number} [data.maxRetries = 3] 最大重试次数
   * @param {string|fs.PathLike|*} [data.filepath] 流下载时的文件路径
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
    this.timeout = data.timeout || 30000
    this.filepath = data.filepath
    this.maxRetries = data.maxRetries || 3
    this.proxy = Config.request?.proxy?.switch ? {
      host: Config.request.proxy.host,
      port: parseInt(Config.request.proxy.port),
      protocol: Config.request.proxy.protocol,
      auth: Config.request.proxy.auth
    } : false

    // 创建连接池
    /** @type {'fifo'} */
    const scheduling = 'fifo'
    const socketOptions = {
      keepAlive: true,
      keepAliveMsecs: 15000,
      maxSockets: 30,
      maxFreeSockets: 10,
      timeout: 60000,
      scheduling,
      // 添加更多网络优化选项
      noDelay: true,
      keepAliveInitialDelay: 0
    }
    const httpsOptions = {
      ...socketOptions,
      rejectUnauthorized: false,
      ciphers: [
        'TLS_AES_128_GCM_SHA256',
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-ECDSA-AES128-GCM-SHA256',
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'DHE-RSA-AES128-GCM-SHA256',
        'DHE-RSA-AES256-GCM-SHA384'
      ].join(':'),
      honorCipherOrder: true,
      secureOptions: constants.SSL_OP_NO_SSLv2 |
        constants.SSL_OP_NO_SSLv3 |
        constants.SSL_OP_NO_TLSv1 |
        constants.SSL_OP_NO_TLSv1_1 |
        constants.SSL_OP_NO_COMPRESSION,
      // 添加更多SSL选项
      sessionTimeout: 300,
      handshakeTimeout: 30000
    }
    this.baseSocketOptions = socketOptions
    this.httpsSocketOptions = httpsOptions
    this.httpAgent = new http.Agent(socketOptions)
    this.httpsAgent = new https.Agent(httpsOptions)

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

  /** 重建连接池 */
  rebuildAgents() {
    this.cleanup()
    this.httpAgent = new http.Agent(this.baseSocketOptions)
    this.httpsAgent = new https.Agent(this.httpsSocketOptions)
    logger.info('连接池已重建')
  }

  /**
   * 清理资源
   * @returns {void}
   */
  cleanup() {
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
      'AbortError': `请求被中止，可能是网络超时: ${url}`,
      'EPROTO': `SSL/TLS握手失败，可能是协议不兼容: ${url}`,
      'ECONNABORTED': `连接被中止: ${url}`,
      'ESOCKETTIMEDOUT': `套接字超时，可能需要重建连接池: ${url}`,
      'EHOSTUNREACH': `主机不可达: ${url}`,
      'ENETUNREACH': `网络不可达: ${url}`,
      'EAI_AGAIN': `DNS查询临时失败: ${url}`,
      'EPIPE': `管道破裂，连接异常关闭: ${url}`
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
   * 处理重试时的请求头配置
   * @param {number} retryCount 当前重试次数
   * @param {import('axios').AxiosRequestConfig['headers']} [baseHeaders] 基础请求头
   * @returns {import('axios').AxiosRequestConfig['headers']} 处理后的请求头
   */
  getRetryHeaders(retryCount, baseHeaders) {
    /** @type {import('axios').AxiosRequestConfig['headers']} */
    const headers = { ...baseHeaders }
    headers['User-Agent'] = getRandomUserAgent()
    if (retryCount > 0) {
      headers['Cache-Control'] = 'no-cache'
      headers.Pragma = 'no-cache'
      headers.Connection = 'close'
      const randomHeaders = [
        { 'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="134"', 'sec-ch-ua-mobile': '?0' },
        { 'sec-ch-ua': '"Chromium";v="134", "Not A(Brand";v="99"', 'sec-ch-ua-mobile': '?0' },
        { 'sec-ch-ua': '"Google Chrome";v="134", "Chromium";v="134"', 'sec-ch-ua-mobile': '?0' }
      ]
      const randomHeader = randomHeaders[Math.floor(Math.random() * randomHeaders.length)]
      Object.assign(headers, randomHeader)

      headers['sec-ch-ua-platform'] = '"Windows"'
      headers['sec-fetch-dest'] = 'empty'
      headers['sec-fetch-mode'] = 'cors'
      headers['sec-fetch-site'] = 'same-site'

      if (retryCount > 1) {
        headers['Accept-Language'] = 'zh-CN,zh;q=0.9,en;q=0.8'
        headers['Accept-Encoding'] = 'gzip, deflate, br'
        delete headers['Range'] // 临时移除Range头部
      }
    }
    return headers
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
      return await this.returnResult()
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
      const config = { ...this.config, headers: this.getRetryHeaders(retryCount, this.config.headers || this.headers) }
      return await this.axiosInstance(config)
    } catch (error) {
      const axiosError = /** @type {AxiosError} */(error)
      if (axiosError.response?.status === 403 && retryCount < this.maxRetries + 2) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 3000)
        logger.warn(`遇到403错误，${delay}ms后重试 (${retryCount + 1}/${this.maxRetries + 2})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.returnResult(retryCount + 1)
      }
      if (axiosError.code === 'ESOCKETTIMEDOUT' || axiosError.code === 'ECONNRESET') {
        logger.warn(`连接池问题(${axiosError.code})，重建连接池后重试`)
        this.rebuildAgents()
      }
      if (retryCount < this.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.returnResult(retryCount + 1)
      }
      logger.error('请求失败:', this.handleError(axiosError))
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
    const currentUrl = url || this.url
    if (redirectCount > 5) return currentUrl
    if (visitedUrls.has(currentUrl)) {
      logger.warn(`检测到循环重定向，停止在: ${currentUrl}`)
      return currentUrl
    }
    visitedUrls.add(currentUrl)

    try {
      const config = {
        ...this.config,
        timeout: 8000,
        headers: this.getRetryHeaders(redirectCount, this.config.headers || this.headers)
      }
      const response = await this.axiosInstance.get(currentUrl, config)
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
          return await this.getLongLink(redirectUrl, redirectCount + 1, visitedUrls)
        } else if (axiosError.response.status === 403 && redirectCount < 2) {
          logger.warn(`遇到403错误，尝试重试 (${redirectCount + 1}/2)`)
          await new Promise(r => setTimeout(r, 500))
          return await this.getLongLink(currentUrl, redirectCount + 1, visitedUrls)
        }
      }
      logger.error(this.handleError(axiosError))
      return currentUrl
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
        timeout: 5000,
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
      if (result.status === 429) {
        throw new Error('ratelimit triggered, 触发速率限制')
      }
      return result.data
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.stack || error.message)
      }
      throw error
    }
  }

  /**
   * 获取响应头信息（仅首个字节）
   * @returns {Promise<import('axios').AxiosResponse['headers']>} 返回响应头信息
   */
  async getHeaders(retryCount = 0) {
    try {
      const config = { ...this.config, timeout: 6000, headers: this.getRetryHeaders(retryCount, this.config.headers || this.headers) }
      const response = await this.axiosInstance.get(this.url, {
        ...config,
        headers: {
          ...config.headers,
          Range: 'bytes=0-0',
          Accept: '*/*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br'
        }
      })
      return response.headers
    } catch (error) {
      const axiosError = /** @type {AxiosError} */(error)
      if (axiosError.response?.status === 403 && retryCount < 2) {
        const delay = Math.min(1000 * (retryCount + 1), 2000)
        logger.warn(`获取Headers遇到403，${delay}ms后重试 (${retryCount + 1}/2)`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.getHeaders(retryCount + 1)
      }
      if (retryCount < 2) {
        const delay = Math.min(1000 * (retryCount + 1), 3000)
        logger.warn(`获取Headers失败，正在重试... (${retryCount + 1}/2)`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.getHeaders(retryCount + 1)
      }
      logger.error(this.handleError(axiosError))
      throw error
    }
  }

  /**
   * 获取响应头信息（完整）
   * @returns {Promise<import('axios').AxiosResponse['headers']>} 返回响应头信息
   */
  async getHeadersFull(retryCount = 0) {
    try {
      const config = { ...this.config, timeout: 8000, headers: this.getRetryHeaders(retryCount, this.config.headers || this.headers) }
      const response = await this.axiosInstance.get(this.url, config)
      return response.headers
    } catch (error) {
      const axiosError = /** @type {AxiosError} */(error)
      if (axiosError.response?.status === 403 && retryCount < 2) {
        const delay = Math.min(1000 * (retryCount + 1), 2000)
        logger.warn(`获取完整Headers遇到403，${delay}ms后重试 (${retryCount + 1}/2)`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.getHeadersFull(retryCount + 1)
      }
      if (retryCount < 2) {
        const delay = Math.min(1000 * (retryCount + 1), 3000)
        logger.warn(`获取完整Headers失败，正在重试... (${retryCount + 1}/2)`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.getHeadersFull(retryCount + 1)
      }
      logger.error(this.handleError(axiosError))
      throw error
    }
  }

  /**
   * 下载文件流
   * @param {(downloadedBytes: number, totalBytes: number, isLiveStream: boolean) => void} progressCallback
   * @param {number} retryCount
   * @param {{ isLiveStream?: boolean, liveStreamMaxSize?: number }} options - 额外选项
   * @property {boolean} options.isLiveStream - 是否为直播流
   * @property {number} options.liveStreamMaxSize - 直播流最大下载大小(字节)
   * @returns {Promise<import('axios').AxiosResponse['data'] | boolean>} 返回响应数据或false
   */
  async downloadStream(progressCallback, retryCount = 0, options = { isLiveStream: false, liveStreamMaxSize: 10 * 1024 * 1024 }) {
    const { isLiveStream = false, liveStreamMaxSize = 10 * 1024 * 1024 } = options
    const controller = new AbortController()
    const timeoutDuration = retryCount === 0 ? 30000 : Math.min(30000 + retryCount * 30000, 60000)
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration)
    const resources = new Set()
    let existingFileSize = 0, supportRange = false, resumeFromByte = 0

    /** 检查是否支持断点续传 */
    const checkResumeSupport = async () => {
      try {
        try {
          await fs.promises.access(this.filepath)
          const stats = await fs.promises.stat(this.filepath)
          existingFileSize = stats.size
          logger.info(`检测到已存在部分文件，大小: ${existingFileSize} 字节`)
        } catch { }
        let totalSize = 0, isSizeValid = false
        try {
          const headers = await this.getHeadersFull()
          supportRange = headers['accept-ranges'] === 'bytes' || headers['accept-ranges'] === '*'
          if (headers['content-length']) {
            totalSize = parseInt(headers['content-length'], 10)
            isSizeValid = totalSize > 0
          }
          if (!isSizeValid && headers['content-range']) {
            const rangeMatch = headers['content-range'].match(/\/(\d+)$/)
            if (rangeMatch && rangeMatch[1]) {
              totalSize = parseInt(rangeMatch[1], 10)
              isSizeValid = totalSize > 0
            }
          }
        } catch (headerError) {
          logger.warn('获取头信息失败:', headerError)
        }
        if (isLiveStream) {
          logger.info('直播流下载模式，不支持断点续传')
          return { skipDownload: false, totalBytes: 0, isSizeValid: false }
        }
        if (existingFileSize > 0 && existingFileSize === totalSize) {
          logger.info(`文件已完整存在: ${this.filepath}`)
          progressCallback(totalSize, totalSize, isLiveStream)
          return { skipDownload: true, totalBytes: totalSize, isSizeValid: true }
        }
        if (supportRange && existingFileSize > 0 && (totalSize === 0 || existingFileSize < totalSize)) {
          resumeFromByte = existingFileSize
          logger.info(`检测到可断点续传，从字节 ${resumeFromByte} 继续下载`)
        }
        return { skipDownload: false, totalBytes: (isSizeValid || totalSize > 1) ? totalSize : -1, isSizeValid }
      } catch (error) {
        logger.warn('断点续传检查失败，将重新开始下载:', error)
        return { skipDownload: false, totalBytes: -1, isSizeValid: false }
      }
    }

    /**
     * 下载完成后处理实际文件大小
     * @param {number} reportedSize - 报告的大小
     * @param {boolean} isSizeValid - 初始大小是否有效
     */
    const handleFinalFileSize = async (reportedSize, isSizeValid) => {
      const isValidReportedSize = !isNaN(reportedSize) && isFinite(reportedSize) && reportedSize > 0
      if (!isValidReportedSize || (isSizeValid && reportedSize <= 1024)) {
        try {
          const stats = await fs.promises.stat(this.filepath)
          const safeActualSize = Math.max(1, stats.size)
          progressCallback(safeActualSize, safeActualSize, isLiveStream)
          return { filepath: this.filepath, totalBytes: safeActualSize }
        } catch (statError) {
          logger.warn('获取实际文件大小失败，将使用备用大小:', statError)
        }
      }
      const safeReportedSize = Math.max(1, isValidReportedSize ? reportedSize : 1)
      progressCallback(safeReportedSize, safeReportedSize, isLiveStream)
      return { filepath: this.filepath, totalBytes: safeReportedSize }
    }

    /** 创建节流进度更新器 */
    const createProgressUpdater = (/** @type {number} */ totalSize, minInterval = 500) => {
      let lastUpdateTime = 0, lastPercentage = -1, lastReportedBytes = 0
      return (/** @type {number} */ downloadedBytes) => {
        const now = Date.now()
        const currentDownloaded = downloadedBytes + resumeFromByte

        const displayTotal = (!isLiveStream && (totalSize <= 1 || isNaN(totalSize) || !isFinite(totalSize))) ? -1 : totalSize

        if (displayTotal > 1 && !isLiveStream) {
          // 已知大小：按百分比更新
          const percentage = Math.floor((currentDownloaded / displayTotal) * 100)
          const timeSinceLastUpdate = now - lastUpdateTime
          if ((percentage !== lastPercentage && timeSinceLastUpdate >= minInterval) || timeSinceLastUpdate >= minInterval * 2) {
            progressCallback(currentDownloaded, displayTotal, isLiveStream)
            lastPercentage = percentage
            lastUpdateTime = now
          }
        } else {
          // 未知大小或直播流：每次增长超过512KB或时间间隔达到时更新
          const bytesGrowth = currentDownloaded - lastReportedBytes
          const timeSinceLastUpdate = now - lastUpdateTime
          if (bytesGrowth >= 512 * 1024 || timeSinceLastUpdate >= minInterval || lastReportedBytes === 0) {
            // 确保传递正确的displayTotal值，未知大小使用-1
            const safeDisplayTotal = isLiveStream ? liveStreamMaxSize : -1
            progressCallback(currentDownloaded, safeDisplayTotal, isLiveStream)
            lastReportedBytes = currentDownloaded
            lastUpdateTime = now
          }
        }
      }
    }

    /** 统一释放资源：取消超时、销毁流、清空集合 */
    const cleanupResources = () => {
      clearTimeout(timeoutId)
      resources.forEach(r => {
        try {
          if (typeof r.destroy === 'function') r.destroy()
          if (r instanceof Readable) r.unpipe()
        } catch (err) { }
      })
      resources.clear()
    }

    try {
      const resumeCheck = await checkResumeSupport()
      if (resumeCheck.skipDownload) return { filepath: this.filepath, totalBytes: resumeCheck.totalBytes }
      const totalBytes = resumeCheck.totalBytes, isSizeValid = resumeCheck.isSizeValid
      const requestHeaders = this.getRetryHeaders(retryCount, this.headers) || this.headers
      if (supportRange && resumeFromByte > 0 && !isLiveStream) requestHeaders['Range'] = `bytes=${resumeFromByte}-`
      const response = await axios({
        url: this.url,
        method: 'GET',
        responseType: 'stream',
        signal: controller.signal,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: timeoutDuration,
        maxRedirects: 10,
        httpAgent: this.httpAgent,
        httpsAgent: this.httpsAgent,
        decompress: true,
        headers: {
          ...requestHeaders,
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: retryCount > 0 ? 'close' : 'keep-alive',
          Referer: this.url.split('?')[0],
          'Upgrade-Insecure-Requests': '1',
          'DNT': '1'
        }
      })
      clearTimeout(timeoutId)
      if (!(response.status >= 200 && response.status < 300) && response.status !== 206) {
        throw new Error(`无法获取 ${this.url}。状态: ${response.status} ${response.statusText}`)
      }
      if (!this.filepath) throw new Error('文件路径未设置')

      /**
       * 通用流处理：将 source → transform（计数）→ writer 并报告进度
       * @returns 最终写入字节数
       */
      const processStream = async (/** @type {any} */ source, /** @type {fs.WriteStream} */ writer, /** @type {{ (downloadedBytes: number): void; (downloadedBytes: number): void; (downloadedBytes: number): void; (arg0: number): void; }} */ onProgress) => {
        let downloadedBytes = 0
        const transform = new Transform({
          highWaterMark: 1024 * 1024,
          transform(chunk, enc, cb) {
            downloadedBytes += chunk.length
            onProgress(downloadedBytes)
            if (isLiveStream && downloadedBytes + resumeFromByte >= liveStreamMaxSize) {
              logger.info(`直播流预览已达到最大大小限制 ${liveStreamMaxSize} 字节`)
              setImmediate(() => controller.abort())
            }
            cb(null, chunk)
          }
        })
        resources.add(source)
        resources.add(transform)
        resources.add(writer)
        try {
          await pipeline(source, transform, writer)
        } finally {
          resources.delete(source)
          resources.delete(transform)
          resources.delete(writer)
        }
        return downloadedBytes
      }

      // 1. 服务器未返回 Content-Length：单线程直存
      if (isNaN(totalBytes) || totalBytes <= 1) {
        const flags = supportRange && resumeFromByte > 0 && !isLiveStream ? 'a' : 'w'
        const writer = fs.createWriteStream(this.filepath, { highWaterMark: 1024 * 1024, flags: flags, start: supportRange && resumeFromByte > 0 && !isLiveStream ? resumeFromByte : undefined })
        const updateProgress = createProgressUpdater(isLiveStream ? liveStreamMaxSize : -1)
        let downloadedBytes = 0
        try {
          downloadedBytes = await processStream(response.data, writer, updateProgress)
        } catch (error) {
          if (isLiveStream && error instanceof Error && 'code' in error && error.code === 'ERR_CANCELED') {
            logger.info('直播流预览已完成')
          } else {
            throw error
          }
        }
        const finalSize = downloadedBytes + resumeFromByte
        return await handleFinalFileSize(finalSize, false)
      }

      // 2. 小文件 (<10 MB)：单线程，带确定性进度
      if (totalBytes > 1 && totalBytes < 10 * 1024 * 1024) {
        const flags = supportRange && resumeFromByte > 0 ? 'a' : 'w'
        const writer = fs.createWriteStream(this.filepath, { highWaterMark: 1024 * 1024, flags: flags, start: supportRange && resumeFromByte > 0 ? resumeFromByte : undefined })
        const updateProgress = createProgressUpdater(totalBytes)
        await processStream(response.data, writer, updateProgress)
        return await handleFinalFileSize(totalBytes, isSizeValid)
      }

      // 3. 大文件：分片并发下载 → 临时目录 → 合并
      const chunkSize = totalBytes > 50 * 1024 * 1024 ? Math.ceil(totalBytes / 10) : 5 * 1024 * 1024
      const concurrent = retryCount > 0 ? 1 : Math.min(4, Math.ceil(totalBytes / (10 * 1024 * 1024)))
      const chunksCount = Math.ceil(totalBytes / chunkSize)
      const tempDir = `${this.filepath}.tmp`

      try {
        await fs.promises.mkdir(tempDir, { recursive: true })
      } catch (mkdirError) {
        const err = /** @type {NodeJS.ErrnoException} */(mkdirError)
        if (err.code !== 'EEXIST') {
          logger.error('创建临时目录失败:', mkdirError)
          const flags = supportRange && resumeFromByte > 0 ? 'a' : 'w'
          const writer = fs.createWriteStream(this.filepath, { highWaterMark: 1024 * 1024, flags: flags, start: supportRange && resumeFromByte > 0 ? resumeFromByte : undefined })
          const updateProgress = createProgressUpdater(totalBytes)
          await processStream(response.data, writer, updateProgress)
          return await handleFinalFileSize(totalBytes, isSizeValid)
        }
      }

      let totalDown = resumeFromByte
      const updateProgress = createProgressUpdater(totalBytes)

      /** 下载指定 Range 分片并写临时文件 */
      const downloadChunk = async (/** @type {number} */ start, /** @type {number} */ end, /** @type {number} */ index, chunkRetryCount = 0) => {
        try {
          const chunkHeaders = this.getRetryHeaders(retryCount + chunkRetryCount, this.config.headers || {})

          // 分片下载时的特殊处理
          /** @type {import('axios').AxiosRequestConfig['headers']} */
          const chunkRequestHeaders = { ...chunkHeaders }
          chunkRequestHeaders['Range'] = `bytes=${start}-${end}`
          chunkRequestHeaders['Connection'] = (retryCount > 0 || chunkRetryCount > 0) ? 'close' : 'keep-alive'

          // 为分片请求添加随机延迟以避免被限制
          if (retryCount > 0 || chunkRetryCount > 0) {
            await new Promise(r => setTimeout(r, Math.random() * 1000 + chunkRetryCount * 500))
          }

          const chunkRes = await axios({
            url: this.url,
            method: 'GET',
            responseType: 'stream',
            timeout: Math.min(60000 + (chunkSize / (1024 * 1024)) * 5000, 120000),
            httpAgent: this.httpAgent,
            httpsAgent: this.httpsAgent,
            headers: chunkRequestHeaders
          })

          const chunkPath = `${tempDir}/chunk_${index}`
          const writer = fs.createWriteStream(chunkPath, { highWaterMark: 1024 * 1024 })
          let chunkDown = 0
          const transform = new Transform({
            highWaterMark: 1024 * 1024,
            transform(chunk, enc, cb) {
              chunkDown += chunk.length
              totalDown += chunk.length
              updateProgress(totalDown - resumeFromByte)
              cb(null, chunk)
            }
          })
          resources.add(chunkRes.data)
          resources.add(transform)
          resources.add(writer)
          try {
            await pipeline(chunkRes.data, transform, writer)
            return { chunkPath, size: end - start + 1 }
          } finally {
            resources.delete(chunkRes.data)
            resources.delete(transform)
            resources.delete(writer)
          }
        } catch (chunkError) {
          const chunkAxiosError = /** @type {AxiosError} */(chunkError)

          // 分片下载的重试逻辑
          if (chunkRetryCount < 3) {
            if (chunkAxiosError.response?.status === 403 ||
              chunkAxiosError.code === 'ECONNRESET' ||
              chunkAxiosError.code === 'ESOCKETTIMEDOUT') {
              const chunkDelay = Math.min(1000 * (chunkRetryCount + 1), 3000)
              logger.warn(`分片${index}下载失败，${chunkDelay}ms后重试 (${chunkRetryCount + 1}/3)`)
              await new Promise(r => setTimeout(r, chunkDelay))
              return downloadChunk(start, end, index, chunkRetryCount + 1)
            }
          }

          logger.error(`分片${index}下载失败:`, chunkError instanceof Error ? chunkError.message : String(chunkError))
          throw chunkError
        }
      }

      const chunkResults = []
      try {
        for (let i = 0; i < chunksCount; i += concurrent) {
          const batch = []
          for (let j = 0; j < concurrent && i + j < chunksCount; j++) {
            const start = (i + j) * chunkSize
            const end = Math.min((i + j + 1) * chunkSize - 1, totalBytes - 1)
            batch.push(downloadChunk(start, end, i + j))
          }
          chunkResults.push(...await Promise.all(batch))
        }
      } catch (batchError) {
        logger.warn('分片下载失败，尝试清理临时文件', batchError)
        fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => { })
        throw batchError
      }

      const finalWriter = fs.createWriteStream(this.filepath, { highWaterMark: 20 * 1024 * 1024 })
      resources.add(finalWriter)
      try {
        for (const { chunkPath } of chunkResults) {
          const reader = fs.createReadStream(chunkPath, { highWaterMark: 1024 * 1024 })
          await new Promise((resolve, reject) => {
            reader.on('error', reject)
            reader.on('end', () => resolve('处理成功'))
            reader.pipe(finalWriter, { end: false })
          })
          fs.promises.unlink(chunkPath).catch(() => { })
        }
        await new Promise((resolve, reject) => {
          finalWriter.on('finish', () => resolve('处理成功'))
          finalWriter.on('error', reject)
          finalWriter.end()
        })
      } finally {
        resources.delete(finalWriter)
      }
      fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => { })
      return await handleFinalFileSize(totalBytes, isSizeValid)
    } catch (error) {
      cleanupResources()
      const axiosError = /** @type {AxiosError} */(error)
      if (isLiveStream) {
        const err = this.handleError(axiosError)
        throw new Error(`直播流下载失败: ${err.message}`)
      }
      // 定义重试配置
      const retryConfigs = {
        403: { maxRetries: this.maxRetries + 5, delay: () => Math.min(2000 + retryCount * 1500, 8000), rebuild: retryCount > 1 },
        'ERR_BAD_RESPONSE': { maxRetries: this.maxRetries + 3, delay: () => Math.min(3000 + retryCount * 2000, 12000), rebuild: true },
        'EPROTO': { maxRetries: this.maxRetries + 1, delay: () => Math.min(2 ** retryCount * 2000, 8000), rebuild: true },
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE': { maxRetries: this.maxRetries + 1, delay: () => Math.min(2 ** retryCount * 2000, 8000), rebuild: true },
        'ECONNRESET': { maxRetries: this.maxRetries + 2, delay: () => Math.min(2000 + retryCount * 1000, 6000), rebuild: true }
      }
      const errorKey = axiosError.response?.status === 403 ? 403 :
        (axiosError.code === 'ERR_BAD_RESPONSE' && axiosError.message?.includes('aborted')) ? 'ERR_BAD_RESPONSE' :
          axiosError.code
      const config = errorKey && errorKey in retryConfigs ? retryConfigs[/** @type {keyof typeof retryConfigs} */(errorKey)] : undefined
      if (config && retryCount < config.maxRetries) {
        const delay = config.delay()
        const errorMsg = errorKey === 403 ? '403错误' : errorKey === 'ERR_BAD_RESPONSE' ? '下载被中止' :
          errorKey === 'ECONNRESET' ? '连接重置' : `${errorKey}错误`
        logger.warn(`${errorMsg}，${delay / 1000}秒后重试 (${retryCount + 1}/${config.maxRetries})`)

        if (config.rebuild) this.rebuildAgents()
        await new Promise(r => setTimeout(r, delay))
        return this.downloadStream(progressCallback, retryCount + 1, options)
      }
      // 连接池问题处理
      if (axiosError.code === 'ESOCKETTIMEDOUT' || axiosError.code === 'ECONNRESET') {
        logger.warn(`连接池问题(${axiosError.code})，重建连接池`)
        this.rebuildAgents()
      }
      // 通用重试
      if (retryCount < this.maxRetries) {
        const delay = Math.min(2 ** retryCount * 2000, 8000)
        logger.warn(`下载失败，${delay / 1000}秒后重试 (${retryCount + 1}/${this.maxRetries})`)
        await new Promise(r => setTimeout(r, delay))
        return this.downloadStream(progressCallback, retryCount + 1, options)
      }
      const err = this.handleError(axiosError)
      throw new Error(`${this.maxRetries}次重试后下载失败: ${err.message}`)
    } finally {
      cleanupResources()
    }
  }

}
