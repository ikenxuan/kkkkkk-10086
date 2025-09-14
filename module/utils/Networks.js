import fs from 'node:fs'
import { logger } from './index.js'
import axios, { AxiosError } from 'axios'
import { pipeline } from 'stream/promises'

/** @type {import('axios').AxiosRequestConfig['headers']} */
export const baseHeaders = {
  Accept: '*/*',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0'
}

export class Networks {
  /**
   * 构造网络请求对象
   * @param {object} data 请求配置对象
   * @param {string} data.url 请求的URL地址
   * @param {import('axios').AxiosRequestConfig['headers']} [data.headers = {}] 请求头对象
   * @param {import('axios').ResponseType} [data.type = 'json'] 返回的数据类型，支持 'arraybuffer' | 'blob' | 'document' | 'json' | 'text' | 'stream' | 'formdata'
   * @param {string} [data.method = 'GET'] 请求方法，支持 'GET' 和 'POST'
   * @param {*} [data.body = ''] POST请求时的请求体
   * @param {number} [data.timeout = 30000] 请求超时时间，单位为毫秒，默认30秒
   * @param {number} [data.maxRetries = 3] 最大重试次数
   * @param {string} [data.filepath] 流下载时的文件路径
   */
  constructor(data) {
    // 初始化请求头
    this.headers = data.headers
      ? Object.fromEntries(
        Object.entries(data.headers).map(([key, value]) => [key, String(value)])
      )
      : {}
    // 初始化请求参数
    this.url = data.url // 请求的URL地址
    this.type = data.type || 'json' // 返回的数据类型，默认为JSON
    this.method = data.method || 'GET' // 请求方法，默认为GET
    this.body = data.body || '' // POST请求的请求体
    this.timeout = data.timeout || 30000 // 请求超时时间，默认30秒
    this.isGetResult = false // 是否已经获取到结果
    this.filepath = data.filepath // 流下载时的文件路径
    this.maxRetries = data.maxRetries || 3 // 最大重试次数，默认为3次
  }

  /**
   * 获取请求配置
   * 根据请求方法返回配置对象
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
      }
    }

    if (this.method === 'POST' && this.body) {
      config.data = this.body
    }

    return config
  }

  /**
   * 发起网络请求并返回结果
   * 捕获请求中的异常并记录日志
   * @returns {Promise<import('axios').AxiosResponse | boolean>} 返回 axios 请求的结果
   */
  async getfetch() {
    try {
      const result = await this.returnResult()
      if (result.status === 504) {
        return result
      }
      this.isGetResult = true
      return result
    } catch (error) {
      logger.error('获取失败:', error)
      return false
    }
  }

  /**
   * 基础请求方法
   * @returns {Promise<import('axios').AxiosResponse>} 返回 axios 请求的结果
   */
  async returnResult() {
    /** @type {import('axios').AxiosResponse | any} */
    let response
    try {
      response = await axios(this.config) // 直接使用axios发起请求
    } catch (error) {
      logger.error('请求失败:', error)
    }
    return response
  }

  /**
   * 获取重定向后的最终链接地址
   * @param {string} url - 可选参数，要获取重定向链接的URL地址，如果不提供则使用实例中的this.url
   * @returns {Promise<string>} 返回一个Promise，解析值为最终的重定向链接地址或错误信息
   */
  async getLongLink(url = '') {
    let errorMsg = `获取链接重定向失败: ${this.url || url}`  // 初始化错误信息
    try {
      // 使用HEAD方法请求URL，获取重定向信息
      const response = await axios({
        method: 'HEAD',
        url: this.url || url,
        headers: this.headers,
        timeout: this.timeout
      })
      // 返回最终的重定向URL
      return response.request.res.responseUrl
    } catch (error) {
      const axiosError = /** @type {AxiosError} */ (error)
      if (axiosError.response) {
        // 如果是302重定向状态码
        if (axiosError.response.status === 302) {
          // 从响应头中获取重定向地址
          const redirectUrl = axiosError.response.headers.location
          logger.info(`检测到302重定向，目标地址: ${redirectUrl}`)
          // 递归调用自身，获取重定向后的链接
          return await this.getLongLink(redirectUrl)
        } else if (axiosError.response.status === 403) { // 403 Forbidden
          // 设置403错误的错误信息
          errorMsg = `403 Forbidden 禁止访问！${this.url || url}`
          logger.error(errorMsg)
          return errorMsg
        }
      }
      // 记录并返回错误信息
      logger.error(errorMsg)
      return errorMsg
    }
  }

  /**
   * 获取首个302重定向地址
   * @returns {Promise<import('axios').AxiosResponse['headers']['location']>}
   */
  async getLocation() {
    try {
      const response = await axios({
        method: 'GET',
        url: this.url,
        maxRedirects: 0, // 不跟随重定向
        validateStatus: (/** @type {number} */ status) => status >= 300 && status < 400 // 仅处理3xx响应
      })
      return response.headers.location // 返回Location头中的重定向地址
    } catch (error) {
      logger.error('获取重定向地址失败:', error)
      return ''
    }
  }

  /**
   * 获取数据并处理为指定格式
   * @returns {Promise<import('axios').AxiosResponse['data'] | boolean>} 返回处理后的数据或错误信息
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
        throw new Error(error.stack ?? error.message)
      }
      return false
    }
  }

  /**
   * 获取响应头信息（仅首个字节）
   * 适用于获取视频流的完整大小
   * @returns {Promise<import('axios').AxiosResponse['headers']>} 返回响应头信息
   */
  async getHeaders() {
    try {
      const response = await axios({
        ...this.config,
        method: 'GET',
        headers: {
          ...this.headers,
          Range: 'bytes=0-0'
        }
      })
      return response.headers
    } catch (error) {
      logger.error(error)
      throw error
    }
  }

  /**
   * 获取响应头信息（完整）
   * @returns {Promise<import('axios').AxiosResponse['headers']>} 返回响应头信息
   */
  async getHeadersFull() {
    try {
      const response = await axios({
        ...this.config,
        method: 'GET'
      })
      return response.headers
    } catch (error) {
      logger.error(error)
      throw error
    }
  }

  /**
   * 异步下载流方法
   * @param {(downloadedBytes: number, totalBytes: number) => void} progressCallback - 下载进度回调函数，接收已下载字节数和总字节数作为参数
   * @param {number} [retryCount = 0] - 当前重试次数，默认为0
   * @returns {Promise<{filepath: string, totalBytes: number}>} 返回一个Promise，解析为包含文件路径和总字节数的对象
   */
  async downloadStream(progressCallback, retryCount = 0) {
    // 创建用于取消请求的控制器和超时定时器
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      // 发起网络请求，并附加中止信号
      const response = await axios({
        ...this.config,
        url: this.url,
        responseType: 'stream',
        signal: controller.signal
      })

      // 如果请求成功，清除超时定时器
      clearTimeout(timeoutId)

      // 检查响应状态，如果请求失败则抛出错误
      if (!(response.status >= 200 && response.status < 300)) {
        throw new Error(`无法获取 ${this.url}。状态: ${response.status} ${response.statusText}`)
      }

      // 获取文件总大小（字节数）
      const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
      if (isNaN(totalBytes)) {
        throw new Error('无效的 content-length 头')
      }

      let downloadedBytes = 0 // 已下载的字节数
      let lastPrintedPercentage = -1 // 上一次打印的进度百分比

      // 创建用于写入文件的流
      if (!this.filepath) {
        throw new Error('文件路径未设置')
      }
      const writer = fs.createWriteStream(this.filepath)

      // 打印下载进度的辅助函数
      const printProgress = () => {
        const progressPercentage = Math.floor((downloadedBytes / totalBytes) * 100)
        if (progressPercentage !== lastPrintedPercentage) {
          // 当进度百分比变化时，调用进度回调函数
          progressCallback(downloadedBytes, totalBytes)
          lastPrintedPercentage = progressPercentage
        }
      }

      // 根据文件大小动态调整进度回调频率
      const interval = totalBytes < 10 * 1024 * 1024 ? 1000 : 500

      // 使用setTimeout递归实现定时器
      const scheduleProgressUpdate = () => {
        printProgress()
        intervalId = setTimeout(scheduleProgressUpdate, interval)
      }

      /** @type {NodeJS.Timeout} */
      let intervalId = setTimeout(scheduleProgressUpdate, interval)

      // 监听数据事件，更新下载进度和哈希值
      const onData = (/** @type {string | any[]} */ chunk) => {
        downloadedBytes += chunk.length // 累加已下载的字节数
      }

      response.data.on('data', onData)

      // 使用 pipeline 方法将响应体数据写入文件
      await pipeline(
        response.data,
        writer
      )

      clearTimeout(intervalId)
      response.data.off('data', onData)
      writer.end()

      // 返回包含文件路径和总字节数的对象
      return { filepath: this.filepath, totalBytes }
    } catch (error) {
      clearTimeout(timeoutId) // 请求失败，清除超时定时器

      const err = /** @type {AxiosError} */ (error)
      // 如果错误是由于请求超时引起的
      if (err.name === 'AbortError') {
        logger.error(`请求在 ${this.timeout / 1000} 秒后超时`)
      } else {
        logger.error('下载失败:', err.message)
      }

      // 如果未达到最大重试次数，则进行重试
      if (retryCount < this.maxRetries) {
        const delay = Math.min(Math.pow(2, retryCount) * 1000, 1000) // 指数回退，最大延迟1秒
        logger.warn(`正在重试下载... (${retryCount + 1}/${this.maxRetries})，将在 ${delay / 1000} 秒后重试`)
        await new Promise(resolve => setTimeout(resolve, delay)) // 添加重试前的延迟
        return this.downloadStream(progressCallback, retryCount + 1)
      } else {
        throw new Error(`在 ${this.maxRetries} 次尝试后下载失败: ${err.message}`)
      }
    }
  }
}
