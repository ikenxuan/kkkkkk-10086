import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import Config from './Config.js'
import constants from 'node:constants'
import { Transform } from 'node:stream'
import axios, { AxiosError } from 'axios'
import { pipeline } from 'stream/promises'

/**
 * User-Agent 列表及权重配置
 * @type {{ua: string, weight: number}[]}
 */
const userAgents = [
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36', weight: 17.34 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.3124.85', weight: 2.48 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0', weight: 2.48 }
]

/**
 * 根据权重随机获取 User-Agent
 * @returns {string | undefined} 随机的 User-Agent 字符串
 */
const getRandomUserAgent = () => {
  const totalWeight = userAgents.reduce((sum, a) => sum + a.weight, 0)
  let random = Math.random() * totalWeight
  const found = userAgents.find(a => (random -= a.weight) <= 0)
  return found?.ua || userAgents[0]?.ua
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
    this.maxRetries = data.maxRetries || 2
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
      maxSockets: 100,
      maxFreeSockets: 10,
      timeout: 30000,
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
      'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="134"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      ...this.headers
    }

    if (retryCount > 0) {
      headers['Cache-Control'] = 'no-cache'
      headers.Connection = 'close'
    }

    return {
      url: this.url,
      method: this.method,
      headers,
      responseType: this.type,
      timeout: this.timeout,
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent,
      proxy: this.proxy,
      data: this.method === 'POST' ? this.body : undefined
    }
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
      throw error
    }
  }

  /**
   * 获取重定向后的最终链接地址
   * @param {string} [url = ''] 可选参数，要获取重定向链接的URL地址
   * @returns {Promise<string>} 返回最终的重定向链接地址
   */
  async getLongLink(url = '') {
    const targetUrl = url || this.url
    try {
      const response = await this.axiosInstance.get(targetUrl, {
        ...this.getConfig(),
        timeout: 3000,
        maxRedirects: 3
      })
      return response.request.res.responseUrl || targetUrl
    } catch (error) {
      return targetUrl
    }
  }

  /**
   * 获取首个302重定向地址
   * @returns {Promise<string>} 返回重定向地址或原始URL
   */
  async getLocation() {
    try {
      const response = await this.axiosInstance.get(this.url, {
        ...this.getConfig(),
        timeout: 3000,
        maxRedirects: 0,
        validateStatus: (status) => status >= 300 && status < 400
      })
      return response.headers.location || this.url
    } catch (error) {
      const axiosError = /** @type {AxiosError} */(error)
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
      // 发起下载请求
      const response = await axios({
        url: this.url,
        method: 'GET',
        responseType: 'stream',
        signal: controller.signal,
        timeout,
        maxRedirects: 5,
        httpAgent: this.httpAgent,
        httpsAgent: this.httpsAgent,
        headers: {
          ...this.getConfig(retryCount).headers,
          'Accept-Encoding': 'gzip, deflate, br'
        }
      })

      clearTimeout(timeoutId)

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`下载失败，状态码: ${response.status}`)
      }

      // 从响应头获取文件大小
      if (!isLiveStream && response.headers['content-length']) {
        totalBytes = parseInt(response.headers['content-length']) || -1
      }

      // 创建写入流
      const writer = fs.createWriteStream(this.filepath, { highWaterMark: 2 * 1024 * 1024 })
      let downloadedBytes = 0
      let lastUpdate = 0

      // 创建转换流用于进度跟踪
      const transform = new Transform({
        highWaterMark: 2 * 1024 * 1024,
        transform(chunk, _enc, cb) {
          downloadedBytes += chunk.length
          const now = Date.now()
          // 节流更新进度
          if (now - lastUpdate > 500 || downloadedBytes === chunk.length) {
            const displayTotal = isLiveStream ? liveStreamMaxSize : (totalBytes > 0 ? totalBytes : -1)
            progressCallback(downloadedBytes, displayTotal, isLiveStream)
            lastUpdate = now
          }
          // 直播流大小限制
          if (isLiveStream && downloadedBytes >= liveStreamMaxSize) {
            logger.info(`直播流已达到最大限制 ${liveStreamMaxSize} 字节`)
            controller.abort()
          }
          cb(null, chunk)
        }
      })

      // 执行下载
      await pipeline(response.data, transform, writer)

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
        const axiosError = /** @type {AxiosError} */(error)
        const is403or429 = axiosError.response?.status === 403 || axiosError.response?.status === 429
        const delay = is403or429 ? 3000 + Math.random() * 2000 : 1500 * (retryCount + 1)
        logger.warn(`下载失败，${Math.round(delay)}ms后重试 (${retryCount + 1}/${this.maxRetries})`)
        await new Promise(r => setTimeout(r, delay))
        return this.downloadStream(progressCallback, retryCount + 1, options)
      }
      throw error
    }
  }
}
