import axios, { AxiosError } from 'axios'
import logger from './logger.js'
export default class Networks {
  url
  method
  headers
  type
  body
  axiosInstance
  isGetResult
  timeout
  timer
  data
  constructor (data) {
    this.headers = data.headers || {}
    this.url = data.url || ''
    this.type = data.type || 'json'
    this.method = data.method || 'GET'
    this.body = data.body || null
    this.data = {}
    this.timeout = data.timeout || 5000
    this.isGetResult = false
    this.timer = undefined
    // 创建axios实例
    this.axiosInstance = axios.create({
      timeout: this.timeout,
      headers: this.headers,
      maxRedirects: 5
    })
  }
  get config () {
    let config = {
      url: this.url,
      method: this.method,
      headers: this.headers
    }
    if (this.method === 'POST' && this.body) {
      config.data = this.body
    }
    return config
  }
  async getfetch () {
    try {
      const result = await this.returnResult()
      if (result.status === 504) {
        return result
      }
      this.isGetResult = true
      return result
    }
    catch (error) {
      logger.info(error)
      return false
    }
  }
  async returnResult () {
    return await this.axiosInstance(this.config)
  }
  /** 最终地址（跟随重定向） */
  async getLongLink () {
    try {
      const response = await this.axiosInstance({
        method: 'GET',
        url: this.url
      })
      return response.request.res.responseUrl // axios中获取最终的请求URL
    }
    catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.stack)
      }
      return ''
    }
  }
  /** 获取首个302 */
  async getLocation () {
    try {
      const response = await this.axiosInstance({
        method: 'GET',
        url: this.url,
        maxRedirects: 0, // 禁止跟随重定向
        validateStatus: (status) => status >= 300 && status < 400 // 仅处理3xx响应
      })
      return response.headers['location']
    }
    catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.stack)
      }
      return ''
    }
  }
  /** 获取数据并处理数据的格式化，默认json */
  async getData (new_fetch = '') {
    try {
      if (!new_fetch) {
        const result = await this.returnResult()
        if (result.status === 504) {
          return result
        }
        if (result.status === 429) {
          logger.error('HTTP 响应状态码: 429')
          throw new Error('ratelimit triggered, 触发 https://www.douyin.com/ 的速率限制！！！')
        }
        this.axiosInstance = result
        this.isGetResult = true
      }
      else {
        this.axiosInstance = new_fetch
      }
      return this.axiosInstance.data
    }
    catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(error.stack)
      }
      return false
    }
  }
  async getHeadersAndData () {
    try {
      // 发起网络请求获取响应对象
      const result = await this.axiosInstance(this.config)
      // 初始化响应头和响应数据
      let headers = {}
      const fetchHeaders = result.headers
      for (const [ key, value ] of Object.entries(fetchHeaders)) {
        headers[key] = value
      }
      return { headers, data: result.data }
    }
    catch (error) {
      console.error('获取响应头和数据失败:', error)
      return { headers: null, data: null }
    }
  }
}
