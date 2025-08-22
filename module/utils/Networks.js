import fs from 'node:fs'
import axios from 'axios'
import { pipeline } from 'stream/promises'

export const baseHeaders = {
  Accept: '*/*',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0'
}

export class Networks {
  /**
   * 构造网络请求对象
   * @param {string} data.url 请求的URL地址
   * @param {object} [data.headers = {}] 请求头对象
   * @param {string} [data.type = 'json'] 返回的数据类型，支持 'json', 'text', 'arrayBuffer', 'blob'
   * @param {string} [data.method = 'GET'] 请求方法，支持 'GET' 和 'POST'
   * @param {*} [data.body = ''] POST请求时的请求体
   * @param {number} [data.timeout = 30000] 请求超时时间，单位为毫秒，默认30秒
   * @param {number} [data.maxRetries = 3] 最大重试次数
   */
  constructor(data) {
    // 初始化请求头
    this.headers = new Headers()
    if (data.headers && Object.keys(data.headers).length > 0) {
      for (const [key, value] of Object.entries(data.headers)) {
        this.headers.append(key, value)
      }
    }
    // 初始化请求参数
    this.url = data.url // 请求的URL地址
    this.type = data.type || 'json' // 返回的数据类型，默认为JSON
    this.method = data.method || 'GET' // 请求方法，默认为GET
    this.body = data.body || '' // POST请求的请求体
    this.timeout = data.timeout || 30000 // 请求超时时间，默认30秒
    this.isGetResult = false // 是否已经获取到结果
    this.filepath = data.filepath // 流下载时的文件路径
    this.redirect = 'follow' // 默认跟随重定向
    this.maxRetries = data.maxRetries || 3 // 最大重试次数，默认为3次

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
   * 获取请求配置
   * 根据请求方法返回配置对象
   */
  get config() {
    return {
      headers: this.headers,
      method: this.method,
      ...(this.method === 'POST' && { body: JSON.stringify(this.body) }) // 如果是POST请求，添加请求体
    }
  }

  /**
   * 发起网络请求并返回结果
   * 捕获请求中的异常并记录日志
   */
  async getfetch() {
    try {
      const result = await this.returnResult()
      // 如果返回状态码不是200系列，记录警告日志
      if (!result.ok) {
        if (result.status === 504) return result
        logger.warn(`请求失败，状态码: ${result.status}`)
        return null
      }
      this.isGetResult = true // 标记为已获取到结果
      return result
    } catch (error) {
      logger.error('获取失败:', error)
      return null
    }
  }

  /**
   * 基础请求方法
   * 返回 axios 请求的结果
   */
  async returnResult() {
    try {
      return await this.axiosInstance(this.config) // 使用axios发起请求
    } catch (error) {
      logger.error('请求失败:', error)
      throw error // 抛出错误，方便上层调用处理
    }
  }

  /**
   * 获取最终地址（跟随重定向）
   */
  async getLongLink() {
    try {
      const result = await this.returnResult()
      return result.request.res.responseUrl // 返回最终的URL地址
    } catch (error) {
      logger.error('获取最终地址失败:', error)
      return ''
    }
  }

  /**
   * 获取首个302重定向地址
   */
  async getLocation() {
    try {
      const response = await this.axiosInstance({
        method: 'GET',
        url: this.url,
        maxRedirects: 0, // 不跟随重定向
        validateStatus: (status) => status >= 300 && status < 400 // 仅处理3xx响应
      })
      return response.headers.location // 返回Location头中的重定向地址
    } catch (error) {
      logger.error('获取重定向地址失败:', error)
      return ''
    }
  }

  /**
   * 获取数据并处理为指定格式
   * @param {Response} [new_fetch=''] 可选的自定义fetch对象
   */
  async getData(new_fetch = '') {
    try {
      this.fetch = new_fetch || await this.returnResult() // 如果提供了自定义fetch对象则使用，否则发起新请求
      // 处理非200系列响应状态码
      if (!this.fetch.ok) {
        if (this.fetch.status === 429) {
          throw new Error('触发速率限制，无法访问网站！')
        }
        logger.warn(`请求失败，状态码: ${this.fetch.status}`)
        return null
      }
      this.isGetResult = true
      return this.fetch.data // 返回响应数据
    } catch (error) {
      logger.error('获取数据失败:', error)
      return null
    }
  }

  /**
   * 获取响应头信息（仅首个字节）
   * 适用于获取视频流的完整大小
   * @returns 返回响应头信息
   */
  async getHeaders() {
    try {
      const response = await this.axiosInstance({
        ...this.config,
        method: 'GET',
        headers: {
          ...this.config.headers,
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
   * @returns
   */
  async getHeadersFull() {
    try {
      const response = await this.axiosInstance({
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
   * 流下载方法
   * @param {Function} progressCallback 下载进度回调函数
   * @param {number} [retryCount = 0] 当前重试次数
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
      const intervalId = setInterval(printProgress, interval)

      // 监听数据事件，更新下载进度和哈希值
      const onData = (chunk) => {
        downloadedBytes += chunk.length // 累加已下载的字节数
      }

      response.data.on('data', onData)

      // 使用 pipeline 方法将响应体数据写入文件
      await pipeline(
        response.data,
        writer
      )

      clearInterval(intervalId)
      response.data.off('data', onData)
      writer.end()

      // 返回包含文件路径和总字节数的对象
      return { filepath: this.filepath, totalBytes }
    } catch (error) {
      clearTimeout(timeoutId) // 请求失败，清除超时定时器

      // 如果错误是由于请求超时引起的
      if (error.name === 'AbortError') {
        logger.error(`请求在 ${this.timeout / 1000} 秒后超时`)
      } else {
        logger.error('下载失败:', error.message)
      }

      // 如果未达到最大重试次数，则进行重试
      if (retryCount < this.maxRetries) {
        const delay = Math.min(Math.pow(2, retryCount) * 1000, 1000) // 指数回退，最大延迟1秒
        logger.warn(`正在重试下载... (${retryCount + 1}/${this.maxRetries})，将在 ${delay / 1000} 秒后重试`)
        await new Promise(resolve => setTimeout(resolve, delay)) // 添加重试前的延迟
        return this.downloadStream(progressCallback, retryCount + 1)
      } else {
        throw new Error(`在 ${this.maxRetries} 次尝试后下载失败: ${error.message}`)
      }
    }
  }
}
