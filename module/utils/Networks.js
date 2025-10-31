import fs from 'node:fs'
import os from 'node:os'
import http from 'node:http'
import https from 'node:https'
import Config from './Config.js'
import constants from 'node:constants'
import { Transform } from 'node:stream'
import axios, { AxiosError } from 'axios'
import { pipeline } from 'stream/promises'

/**
 * User-Agent 列表及权重配置（按平台分类）
 * @type {{windows: {ua: string, pct: number}[], mac: {ua: string, pct: number}[], linux: {ua: string, pct: number}[]}}
 */
const userAgentsByPlatform = {
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
    { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36', pct: 3.72 }
  ]
}

/**
 * 根据系统平台和权重随机获取 User-Agent
 * @returns {string} 随机的 User-Agent 字符串
 */
const getRandomUserAgent = () => {
  const platform = os.platform()
  let agents

  if (platform === 'win32') {
    agents = userAgentsByPlatform.windows
  } else if (platform === 'darwin') {
    agents = userAgentsByPlatform.mac
  } else {
    agents = userAgentsByPlatform.linux
  }

  const totalWeight = agents.reduce((sum, a) => sum + a.pct, 0)
  let random = Math.random() * totalWeight
  const found = agents.find(a => (random -= a.pct) <= 0)
  return found?.ua || agents && agents[0]?.ua || ''
}

/**
 * 基础请求头配置
 * @type {import('axios').AxiosRequestConfig['headers']}
 */
export const baseHeaders = {
  Accept: '*/*',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
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
    this.headers = data.headers || {}
    this.url = data.url
    this.type = data.type || 'json'
    this.method = data.method || 'GET'
    this.body = data.body || ''
    this.timeout = data.timeout || 30000
    this.filepath = data.filepath
    this.maxRetries = data.maxRetries || 3
    this.userAgent = getRandomUserAgent()
    this.proxy = Config.request?.proxy?.switch ? {
      host: Config.request.proxy.host,
      port: parseInt(Config.request.proxy.port),
      protocol: Config.request.proxy.protocol,
      auth: Config.request.proxy.auth
    } : false

    /** @type {'fifo'} */
    const scheduling = 'fifo'
    const agentOptions = {
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 64,
      maxFreeSockets: 32,
      timeout: this.timeout,
      scheduling
    }

    this.httpAgent = new http.Agent(agentOptions)
    this.httpsAgent = new https.Agent({
      ...agentOptions,
      rejectUnauthorized: false,
      secureOptions: constants.SSL_OP_NO_SSLv2 | constants.SSL_OP_NO_SSLv3
    })

    this.axiosInstance = axios.create({
      timeout: this.timeout,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 300
    })
  }

  /**
   * 获取请求配置
   * @param {number} retryCount 重试次数
   * @returns {import('axios').AxiosRequestConfig} axios请求配置对象
   */
  getConfig(retryCount = 0) {
    /** @type {Record<string, any>} */
    const headers = {
      'User-Agent': this.userAgent,
      Accept: '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      ...this.headers
    }

    if (retryCount > 0) {
      headers['Cache-Control'] = 'no-cache'
      headers.Connection = 'close'
    }

    /** @type {import('axios').AxiosRequestConfig} */
    const config = {
      url: this.url,
      method: this.method,
      headers,
      responseType: this.type,
      timeout: this.timeout,
      proxy: this.proxy,
      data: this.method === 'POST' ? this.body : undefined
    }

    // 根据URL协议自动选择agent
    if (this.url.startsWith('https:')) {
      config.httpsAgent = this.httpsAgent
    } else if (this.url.startsWith('http:')) {
      config.httpAgent = this.httpAgent
    }

    return config
  }

  /**
   * 发起网络请求
   * @returns {Promise<import('axios').AxiosResponse | boolean>} 返回请求结果或false
   */
  async getfetch() {
    try {
      return await this.request()
    } catch (error) {
      logger.error('请求失败:', error)
      return false
    }
  }

  /**
   * 基础请求方法
   * @param {number} retryCount 重试次数
   * @returns {Promise<import('axios').AxiosResponse>} 返回axios响应对象
   * @throws {Error} 请求失败时抛出错误
   */
  async request(retryCount = 0) {
    try {
      return await this.axiosInstance(this.getConfig(retryCount))
    } catch (error) {
      const axiosError = /** @type {AxiosError} */(error)
      if (axiosError.response?.status === 429 || axiosError.response?.status === 403) {
        if (retryCount < this.maxRetries) {
          const delay = 2000 + Math.random() * 1000 + retryCount * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          return this.request(retryCount + 1)
        }
      } else if (retryCount < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
        return this.request(retryCount + 1)
      }
      throw axiosError.message
    }
  }

  /**
   * 获取重定向后的最终链接地址
   * @param {string} [url = ''] 可选参数，要获取重定向链接的URL地址
   * @param {number} [retryCount = 0] 重试次数
   * @returns {Promise<string>} 返回最终的重定向链接地址
   */
  async getLongLink(url = '', retryCount = 0) {
    const targetUrl = url || this.url
    try {
      const response = await this.axiosInstance.get(targetUrl, {
        ...this.getConfig(retryCount),
        timeout: 5000,
        maxRedirects: 5
      })
      return response.request?.res?.responseUrl || response.config?.url || targetUrl
    } catch (error) {
      const axiosError = /** @type {AxiosError} */(error)
      if (retryCount < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
        return this.getLongLink(targetUrl, retryCount + 1)
      }
      logger.error(`获取重定向链接失败: ${axiosError.message}`)
      return targetUrl
    }
  }

  /**
   * 获取首个302重定向地址
   * @param {number} [retryCount = 0] 重试次数
   * @returns {Promise<string>} 返回重定向地址或原始URL
   */
  async getLocation(retryCount = 0) {
    try {
      const response = await this.axiosInstance.get(this.url, {
        ...this.getConfig(retryCount),
        timeout: 3000,
        maxRedirects: 0,
        validateStatus: (status) => status >= 300 && status < 400
      })
      return response.headers.location || this.url
    } catch (error) {
      const axiosError = /** @type {AxiosError} */(error)
      if (retryCount < this.maxRetries && axiosError.code !== 'ERR_BAD_REQUEST') {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
        return this.getLocation(retryCount + 1)
      }
      logger.error(`获取首个302重定向地址失败: ${axiosError.message}`)
      return axiosError.response?.headers.location || this.url
    }
  }

  /**
   * 获取响应数据
   * @returns {Promise<import('axios').AxiosResponse['data']>} 返回响应数据
   */
  async getData() {
    const result = await this.request()
    if (result.status === 429) {
      throw new Error('触发速率限制')
    }
    return result.data
  }

  /**
   * 获取响应头信息
   * @returns {Promise<import('axios').AxiosResponse['headers']>} 返回响应头信息
   */
  async getHeaders() {
    const config = this.getConfig()
    const response = await this.axiosInstance.get(this.url, {
      ...config,
      timeout: 3000,
      headers: { ...config.headers, Range: 'bytes=0-0' }
    })
    return response.headers
  }

  /**
   * 下载文件流
   * @param {(downloadedBytes: number, totalBytes: number, isLiveStream: boolean) => void} progressCallback
   * @param {number} retryCount
   * @param {{ isLiveStream?: boolean, liveStreamMaxSize?: number }} options - 额外选项
   * @property {boolean} options.isLiveStream - 是否为直播流
   * @property {number} options.liveStreamMaxSize - 直播流最大下载大小(字节)
   * @returns {Promise<{filepath: string, totalBytes: number}>} 返回文件路径和总字节数
   */
  async downloadStream(progressCallback, retryCount = 0, options = {}) {
    const { isLiveStream = false, liveStreamMaxSize = 10 * 1024 * 1024 } = options
    const controller = new AbortController()
    const timeout = isLiveStream ? 120000 : 90000
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      let totalBytes = -1
      // 重试时销毁旧连接池并创建新agent
      let agent
      if (retryCount > 0) {
        // 销毁旧连接池
        this.httpsAgent.destroy()
        this.httpAgent.destroy()
        // 重新创建连接池
        const agentOpts = { keepAlive: false, timeout: 60000 }
        agent = this.url.startsWith('https:')
          ? new https.Agent({ ...agentOpts, rejectUnauthorized: false })
          : new http.Agent(agentOpts)
      } else {
        agent = this.url.startsWith('https:') ? this.httpsAgent : this.httpAgent
      }
      // 发起下载请求
      /** @type {import('axios').AxiosRequestConfig} */
      const downloadConfig = {
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
          'Accept': '*/*',
          'Accept-Encoding': 'identity',
          'Connection': retryCount > 0 ? 'close' : 'keep-alive',
          ...this.headers
        }
      }

      // 根据URL协议选择agent
      if (this.url.startsWith('https:')) {
        downloadConfig.httpsAgent = agent
      } else if (this.url.startsWith('http:')) {
        downloadConfig.httpAgent = agent
      }

      const response = await axios(downloadConfig)

      clearTimeout(timeoutId)

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`下载失败，状态码: ${response.status}`)
      }

      // 从响应头获取文件大小
      if (!isLiveStream && response.headers['content-length']) {
        totalBytes = parseInt(response.headers['content-length']) || -1
      }

      // 根据文件大小动态调整缓冲区
      const bufferSize = totalBytes > 50 * 1024 * 1024 ? 32 * 1024 * 1024 : 16 * 1024 * 1024
      const writer = fs.createWriteStream(this.filepath, { highWaterMark: bufferSize })
      let downloadedBytes = 0
      let lastUpdate = 0
      let lastChunkTime = Date.now()
      /** @type {NodeJS.Timeout | undefined} */
      let stuckCheckInterval

      const transform = new Transform({
        highWaterMark: bufferSize,
        transform(chunk, _enc, cb) {
          downloadedBytes += chunk.length
          lastChunkTime = Date.now()
          if (isLiveStream && downloadedBytes >= liveStreamMaxSize) {
            controller.abort()
            return cb(null, chunk)
          }
          const now = Date.now()
          if (now - lastUpdate > 2000) {
            progressCallback(downloadedBytes, isLiveStream ? liveStreamMaxSize : (totalBytes > 0 ? totalBytes : -1), isLiveStream)
            lastUpdate = now
          }
          cb(null, chunk)
        }
      })

      // 检测下载卡死
      stuckCheckInterval = setInterval(() => {
        if (Date.now() - lastChunkTime > 30000) {
          controller.abort()
          clearInterval(stuckCheckInterval)
        }
      }, 5000)

      try {
        await pipeline(response.data, transform, writer)
        clearInterval(stuckCheckInterval)
      } catch (err) {
        clearInterval(stuckCheckInterval)
        throw err
      }

      // 最终进度更新
      const finalTotal = totalBytes > 0 ? totalBytes : downloadedBytes
      progressCallback(downloadedBytes, finalTotal, isLiveStream)

      return { filepath: this.filepath, totalBytes: downloadedBytes }

    } catch (error) {
      clearTimeout(timeoutId)
      const axiosError = /** @type {AxiosError} */(error)
      // 直播流中止不算错误
      if (isLiveStream && axiosError.code === 'ERR_CANCELED') {
        const stats = await fs.promises.stat(this.filepath).catch(() => ({ size: 0 }))
        return { filepath: this.filepath, totalBytes: stats.size }
      }
      // 重试逻辑
      if (retryCount < this.maxRetries) {
        const is403or429 = axiosError.response?.status === 403 || axiosError.response?.status === 429
        const isReset = axiosError.code === 'ECONNRESET' || axiosError.code === 'ECONNABORTED'
        const isTimeout = axiosError.code === 'ETIMEDOUT'
        const delay = is403or429 ? 3000 + Math.random() * 2000 : isReset ? 2000 + retryCount * 1000 : isTimeout ? 2000 : 1500 * (retryCount + 1)
        logger.warn(`下载失败(${axiosError.code || axiosError.message})，${Math.round(delay)}ms后重试 (${retryCount + 1}/${this.maxRetries})`)
        await new Promise(r => setTimeout(r, delay))
        return this.downloadStream(progressCallback, retryCount + 1, options)
      }
      throw axiosError.message
    }
  }
}
