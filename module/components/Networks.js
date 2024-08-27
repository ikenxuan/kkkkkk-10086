import fetch, { Response } from 'node-fetch'
import logger from '../lib/public/logger.js'
import fs from 'fs'

export default class Networks {
  /**
   * 构造网络请求对象
   * @param {string} data.url 请求的URL地址
   * @param {object} [data.headers = {}] 请求头对象
   * @param {string} [data.type = 'json'] 返回的数据类型，支持 'json', 'text', 'arrayBuffer', 'blob'
   * @param {string} [data.method = 'GET'] 请求方法，支持 'GET' 和 'POST'
   * @param {*} [data.body = ''] POST请求时的请求体
   * @param {boolean} [data.isAgent = false] 是否启用HTTPS代理
   * @param {AbortSignal} [data.issignal] 中止请求的信号对象
   * @param {number} [data.timeout = 30000] 请求超时时间，单位为毫秒，默认30秒
   * @param {number} [data.maxRetries = 3] 最大重试次数
   */
  constructor (data) {
    // 初始化请求头
    this.Headers = new Headers()
    if (data.headers && Object.keys(data.headers).length > 0) {
      for (const [ key, value ] of Object.entries(data.headers)) {
        this.Headers.append(key, value)
      }
    }
    // 初始化请求参数
    this.url = data.url  // 请求的URL地址
    this.type = data.type || 'json'  // 返回的数据类型，默认为JSON
    this.method = data.method || 'GET'  // 请求方法，默认为GET
    this.body = data.body || ''  // POST请求的请求体
    this.timeout = data.timeout || 30000  // 请求超时时间，默认30秒
    this.isGetResult = false  // 是否已经获取到结果
    this.filepath = data.filepath  // 流下载时的文件路径
    this.redirect = 'follow'  // 默认跟随重定向
    this.maxRetries = data.maxRetries || 3  // 最大重试次数，默认为3次
  }

  /**
   * 获取请求配置
   * 根据请求方法返回配置对象
   */
  get config () {
    return {
      headers: this.Headers,
      method: this.method,
      ...(this.method === 'POST' && { body: JSON.stringify(this.body) })  // 如果是POST请求，添加请求体
    }
  }

  /**
   * 发起网络请求并返回结果
   * 捕获请求中的异常并记录日志
   */
  async getfetch () {
    try {
      const result = await this.returnResult()
      // 如果返回状态码不是200系列，记录警告日志
      if (!result.ok) {
        if (result.status === 504) return result
        logger.warn(`请求失败，状态码: ${result.status}`)
        return null
      }
      this.isGetResult = true  // 标记为已获取到结果
      return result
    } catch (error) {
      logger.error('获取失败:', error)
      return null
    }
  }

  /**
   * 基础请求方法
   * 返回 fetch 请求的结果
   */
  async returnResult () {
    try {
      return await fetch(this.url, this.config)  // 使用fetch发起请求
    } catch (error) {
      logger.error('请求失败:', error)
      throw error  // 抛出错误，方便上层调用处理
    }
  }

  /**
   * 获取最终地址（跟随重定向）
   */
  async getLongLink () {
    try {
      const result = await this.returnResult()
      return result.url  // 返回最终的URL地址
    } catch (error) {
      logger.error('获取最终地址失败:', error)
      return ''
    }
  }

  /**
   * 获取首个302重定向地址
   */
  async getLocation () {
    try {
      const response = await fetch(this.url, {
        method: 'GET',
        redirect: 'manual' // 不跟随重定向
      })
      return response.headers.get('location')  // 返回Location头中的重定向地址
    } catch (error) {
      logger.error('获取重定向地址失败:', error)
      return ''
    }
  }

  /**
   * 获取数据并处理为指定格式
   * @param {Response} [new_fetch=''] 可选的自定义fetch对象
   */
  async getData (new_fetch = '') {
    try {
      this.fetch = new_fetch || await this.returnResult()  // 如果提供了自定义fetch对象则使用，否则发起新请求
      // 处理非200系列响应状态码
      if (!this.fetch.ok) {
        if (this.fetch.status === 429) {
          throw new Error('触发速率限制，无法访问网站！')
        }
        logger.warn(`请求失败，状态码: ${this.fetch.status}`)
        return null
      }
      this.isGetResult = true
      return await this.handleResponseByType()  // 根据指定类型处理响应数据
    } catch (error) {
      logger.error('获取数据失败:', error)
      return null
    }
  }

  /**
   * 获取响应头信息
   * 返回解析后的头部对象
   */
  async getHeaders () {
    try {
      this.fetch = await this.returnResult()  // 发起请求并获取响应
      return this.fetch.headers ? Object.fromEntries(this.fetch.headers.entries()) : null  // 将Headers转换为对象形式返回
    } catch (error) {
      logger.error('获取响应头失败:', error)
      return null
    }
  }

  /**
   * 一次性获取响应头和响应体
   * 返回包含头部和数据的对象
   */
  async getHeadersAndData () {
    try {
      this.fetch = await this.returnResult()  // 发起请求获取响应
      const headers = this.fetch.headers ? Object.fromEntries(this.fetch.headers.entries()) : null  // 获取并转换头部信息
      if(!headers) logger.warn('未获取到响应头')
      const data = await this.handleResponseByType()  // 获取响应体数据
      return { headers, data }  // 返回头部信息和响应数据
    } catch (error) {
      logger.error('获取响应头和数据失败:', error)
      return { headers: null, data: null }
    }
  }

  /**
   * 流下载方法
   * @param {Function} progressCallback 下载进度回调函数
   * @param {number} [retryCount=0] 当前重试次数
   */
  async downloadStream (progressCallback, retryCount = 0) {
    // 创建用于取消请求的控制器和超时定时器
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      // 发起网络请求，并附加中止信号
      const response = await fetch(this.url, {
        ...this.config,
        signal: controller.signal
      })

      // 如果请求成功，清除超时定时器
      clearTimeout(timeoutId)

      // 检查响应状态，如果请求失败则抛出错误
      if (!response.ok) {
        throw new Error(`无法获取 ${this.url}。状态: ${response.status} ${response.statusText}`)
      }

      // 获取文件总大小（字节数）
      const totalBytes = parseInt(response.headers.get('content-length'), 10)
      let downloadedBytes = 0  // 已下载的字节数
      let lastPrintedPercentage = -1  // 上一次打印的进度百分比

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

      // 每0.5秒打印一次下载进度
      const intervalId = setInterval(printProgress, 500)

      // 处理每个数据块的函数，使用背压机制来防止内存占用过多
      const processChunk = (chunk) => {
        downloadedBytes += chunk.length  // 累加已下载的字节数
        if (!writer.write(chunk)) {  // 如果写入流的缓冲区已满
          response.body.pause()  // 暂停数据流
          writer.once('drain', () => response.body.resume())  // 当缓冲区有空间时恢复数据流
        }
      }

      // 监听数据事件，逐块处理数据
      response.body.on('data', processChunk)

      // 确保数据全部写入文件后才完成操作
      return new Promise((resolve, reject) => {
        response.body.on('end', () => {
          writer.end(() => {
            clearInterval(intervalId)  // 停止进度定时器
            printProgress()  // 打印最终下载进度
            resolve({ filepath: this.filepath, totalBytes })  // 解析最终结果
          })
        })

        // 处理写入流的错误事件
        writer.on('error', (err) => {
          clearInterval(intervalId)  // 停止进度定时器
          reject(err)  // 拒绝Promise，并传递错误
        })
      })
    } catch (error) {
      clearTimeout(timeoutId)  // 请求失败，清除超时定时器

      // 如果错误是由于请求超时引起的
      if (error.name === 'AbortError') {
        logger.error(`请求在 ${this.timeout / 1000} 秒后超时`)
      } else {
        logger.error('下载失败:', error.message)
      }

      // 如果未达到最大重试次数，则进行重试
      if (retryCount < this.maxRetries) {
        logger.warn(`正在重试下载... (${retryCount + 1}/${this.maxRetries})`)
        return this.downloadStream(progressCallback, retryCount + 1)
      } else {
        throw new Error(`在 ${this.maxRetries} 次尝试后下载失败: ${error.message}`)
      }
    }
  }


  /**
   * 根据指定类型处理响应数据
   * 返回处理后的数据
   */
  async handleResponseByType () {
    switch (this.type) {
      case 'json':
        return this.fetch.headers.get('content-type').includes('json')
          ? this.fetch.json()  // 如果Content-Type包含json，则解析为JSON格式
          : this.fetch.text()  // 否则解析为文本格式
      case 'text':
        return this.fetch.text()  // 解析为文本格式
      case 'arrayBuffer':
        return this.fetch.arrayBuffer()  // 解析为ArrayBuffer格式
      case 'blob':
        return this.fetch.blob()  // 解析为Blob格式
      default:
        logger.error('未获取到响应对象')
        return null
    }
  }

  /**
   * 处理请求超时
   * 返回一个拒绝的Promise用于超时控制
   */
  async timeoutPromise (timeout) {
    const controller = new AbortController()  // 创建AbortController用于控制超时
    this.timer = setTimeout(() => {
      logger.warn('请求超时')
      controller.abort()  // 超时时中止请求
    }, timeout)

    try {
      return await new Promise((resolve, reject) => {
        reject(new Error('timeout'))  // 返回一个拒绝的Promise以表示超时
      })
    } finally {
      clearTimeout(this.timer)  // 最终清除定时器
    }
  }
}
