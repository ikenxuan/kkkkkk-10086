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
    const controller = new AbortController()  // 创建新的AbortController用于控制请求
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)  // 设置请求超时定时器

    try {
      const response = await fetch(this.url, {
        ...this.config,
        signal: controller.signal  // 将AbortController的signal传入fetch请求
      })

      clearTimeout(timeoutId)  // 请求成功后清除超时定时器

      if (!response.ok) {
        throw new Error(`无法获取 ${this.url}。状态: ${response.status} ${response.statusText}`)
      }

      const totalBytes = parseInt(response.headers.get('content-length'), 10)  // 获取响应体的总字节数
      let downloadedBytes = 0
      let lastPrintedPercentage = -1
      const writer = fs.createWriteStream(this.filepath)  // 创建文件写入流

      // 打印下载进度的函数
      const printProgress = () => {
        // 计算当前下载进度百分比
        const progressPercentage = Math.floor((downloadedBytes / totalBytes) * 100)
        // 控制日志打印频率，只在百分比变化时打印日志
        if (progressPercentage !== lastPrintedPercentage) {
          progressCallback(downloadedBytes, totalBytes)  // 更新下载进度
          lastPrintedPercentage = progressPercentage
        }
      }

      // 设置每0.5秒打印一次下载进度
      const intervalId = setInterval(printProgress, 500)

      // 监听数据流的'data'事件
      response.body.on('data', chunk => {
        downloadedBytes += chunk.length
        // progress.tick(chunk.length) // 暂时停用
        // 如果writer.write(chunk)返回false，表示缓冲区已满，暂停读取数据流
        if (!writer.write(chunk)) {
          response.body.pause()  // 暂停读取数据流

          // 等待'writer'缓冲区腾出空间后继续读取数据
          writer.once('drain', () => {
            response.body.resume()  // 恢复读取数据流
          })
        }
      })

      // 将响应数据流直接管道到文件写入流中
      response.body.pipe(writer)

      // 返回一个Promise，在下载完成或出错时解析或拒绝
      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          clearInterval(intervalId)  // 下载完成后清除进度打印定时器
          printProgress()  // 打印最终的进度
          resolve({ filepath: this.filepath, totalBytes })  // 返回文件路径和下载的总字节数
        })

        writer.on('error', reject)  // 出现错误时拒绝Promise
      })
    } catch (error) {
      clearTimeout(timeoutId)  // 请求出错时清除超时定时器
      if (error.name === 'AbortError') {
        logger.error(`请求在 ${this.timeout / 1000} 秒后超时`)
      } else {
        logger.error('下载失败:', error.message)
      }
      if (retryCount < this.maxRetries) {
        logger.warn(`正在重试下载... (${retryCount + 1}/${this.maxRetries})`)
        return this.downloadStream(progressCallback, retryCount + 1)  // 重试下载
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
