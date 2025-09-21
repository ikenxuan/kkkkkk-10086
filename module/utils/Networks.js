import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import Config from './Config.js'
import { Transform } from 'stream'
import { logger } from './index.js'
import axios, { AxiosError } from 'axios'
import { pipeline } from 'stream/promises'

/**
 * 基础请求头配置
 * @type {import('axios').AxiosRequestConfig['headers']}
 */
export const baseHeaders = {
  Accept: '*/*',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0'
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
      keepAliveMsecs: 30000
    }

    this.httpAgent = new http.Agent(socketOptions)

    this.httpsAgent = new https.Agent({
      ...socketOptions,
      rejectUnauthorized: false
    })

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
    if (error.response) {
      switch (error.response.status) {
        case 429:
          return new Error('请求过于频繁，请稍后重试')
        case 403:
          return new Error('访问被禁止，请检查权限')
        case 404:
          return new Error('请求的资源不存在')
        case 502:
        case 503:
        case 504:
          return new Error('服务器暂时不可用，请稍后重试')
        default:
          return new Error(`请求失败: ${error.response.status}`)
      }
    } else if (error.request) {
      if (error.code === 'ECONNRESET') {
        return new Error('连接被重置')
      } else if (error.code === 'ETIMEDOUT') {
        return new Error('请求超时')
      } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        return new Error('SSL证书验证失败，但请求已继续')
      }
      return new Error('网络连接错误')
    }
    return new Error('请求配置错误: ' + error.message)
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
      validateStatus: (/** @type {number} */ status) => {
        return (status >= 200 && status < 300) || status === 406 || (status >= 500)
      },
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
   * @returns {Promise<string>} 返回最终的重定向链接地址或错误信息
   */
  async getLongLink(url = '') {
    let errorMsg = `获取链接重定向失败: ${this.url || url}`
    try {
      const response = await this.axiosInstance({
        method: 'HEAD',
        url: this.url || url,
        headers: this.headers,
        timeout: this.timeout,
        httpAgent: this.httpAgent,
        httpsAgent: this.httpsAgent
      })
      return response.request.res.responseUrl
    } catch (error) {
      const axiosError = /** @type {AxiosError} */ (error)
      if (axiosError.response) {
        if (axiosError.response.status === 302) {
          const redirectUrl = axiosError.response.headers.location
          logger.info(`检测到302重定向，目标地址: ${redirectUrl}`)
          return await this.getLongLink(redirectUrl)
        } else if (axiosError.response.status === 403) {
          errorMsg = `403 Forbidden 禁止访问！${this.url || url}`
          logger.error(errorMsg)
          return errorMsg
        }
      }
      logger.error(this.handleError(axiosError))
      return errorMsg
    }
  }

  /**
   * 获取首个302重定向地址
   * @returns {Promise<import('axios').AxiosResponse['headers']['location'] | string>} 返回重定向地址或原始URL
   */
  async getLocation() {
    try {
      const response = await this.axiosInstance({
        method: 'GET',
        url: this.url,
        maxRedirects: 0,
        httpAgent: this.httpAgent,
        httpsAgent: this.httpsAgent
      })

      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        return response.headers.location
      }
      return this.url
    } catch (error) {
      logger.error('获取重定向地址失败:', this.handleError(/** @type {AxiosError} */(error)))
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
      const response = await this.axiosInstance({
        ...this.config,
        method: 'GET',
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
      const response = await this.axiosInstance({
        ...this.config,
        method: 'GET'
      })
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
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)
    let resources = new Set()

    try {
      const response = await this.axiosInstance({
        ...this.config,
        url: this.url,
        responseType: 'stream',
        signal: controller.signal,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        })
      })

      // 如果请求成功，清除超时定时器
      clearTimeout(timeoutId)

      // 检查响应状态，如果请求失败则抛出错误
      if (!(response.status >= 200 && response.status < 300)) {
        throw new Error(`无法获取 ${this.url}。状态: ${response.status} ${response.statusText}`)
      }

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
      if (isNaN(totalBytes)) {
        throw new Error('无效的 content-length 头')
      }

      if (!this.filepath) {
        throw new Error('文件路径未设置')
      }

      // 对于小文件，使用单线程下载
      if (totalBytes < 10 * 1024 * 1024) { // 小于10MB
        const writer = fs.createWriteStream(this.filepath, {
          highWaterMark: 1024 * 1024
        })

        let downloadedBytes = 0
        let lastPrintedPercentage = -1
        /** @type {NodeJS.Timeout | null} */
        let progressInterval = null
        const minUpdateInterval = 100 // 最小更新间隔(ms)
        let lastUpdateTime = 0

        // 使用 setInterval 更新进度
        progressInterval = /** @type {NodeJS.Timeout} */(setInterval(() => {
          const now = Date.now()
          // 只在达到最小更新间隔时才更新进度
          if (now - lastUpdateTime >= minUpdateInterval) {
            const progressPercentage = Math.floor((downloadedBytes / totalBytes) * 100)
            if (progressPercentage !== lastPrintedPercentage) {
              progressCallback(downloadedBytes, totalBytes)
              lastPrintedPercentage = progressPercentage
              lastUpdateTime = now
            }
            if (downloadedBytes >= totalBytes && progressInterval) {
              clearInterval(progressInterval)
              progressInterval = null
            }
          }
        }, 50)) // 更频繁地检查，但只在达到最小更新间隔时才实际更新

        const transform = new Transform({
          transform(chunk, encoding, callback) {
            downloadedBytes += chunk.length
            this.push(chunk)
            callback()
          },
          highWaterMark: 1024 * 1024
        })

        resources.add(response.data)
        resources.add(transform)
        resources.add(writer)

        try {
          await pipeline(
            response.data,
            transform,
            writer
          )
        } finally {
          if (progressInterval) {
            clearInterval(progressInterval)
            progressInterval = null
          }
          resources.forEach(resource => {
            if (resource.destroy) {
              resource.destroy()
            }
          })
          resources.clear()
        }

        return { filepath: this.filepath, totalBytes }
      }

      // 对于大文件，使用分片并发下载
      // 根据文件大小动态调整分片大小和并发数
      const chunkSize = totalBytes > 50 * 1024 * 1024
        ? 10 * 1024 * 1024 // 大于50MB的文件使用10MB分片
        : 5 * 1024 * 1024  // 其他文件使用5MB分片

      const concurrentDownloads = totalBytes > 50 * 1024 * 1024
        ? 5 // 大文件使用更多并发
        : 3 // 小文件使用较少并发

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
        const progressPercentage = Math.floor((totalDownloadedBytes / totalBytes) * 100)
        if (progressPercentage !== lastPrintedPercentage) {
          progressCallback(totalDownloadedBytes, totalBytes)
          lastPrintedPercentage = progressPercentage
        }
      }

      // 并发下载函数
      const downloadChunk = async (/** @type {number} */ start, /** @type {number} */ end, /** @type {number} */ index) => {
        const chunkResponse = await this.axiosInstance({
          ...this.config,
          url: this.url,
          responseType: 'stream',
          headers: {
            ...this.headers,
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

      // 分批并发下载
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
        highWaterMark: 10 * 1024 * 1024
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
      const cleanupTempDir = (/** @type {string} */ dir, retries = 3) => {
        // 检查目录是否存在
        if (!fs.existsSync(dir)) return

        // 使用推荐的 fs.rm 方法删除目录
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
      // 清理连接池
      this.cleanup()

      resources.forEach(resource => {
        if (resource.destroy) {
          resource.destroy()
        }
      })
      resources.clear()

      const err = this.handleError(/** @type {AxiosError} */(error))

      if (retryCount < this.maxRetries) {
        const delay = Math.min(Math.pow(2, retryCount) * 1000, 1000)
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
