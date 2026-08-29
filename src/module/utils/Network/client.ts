import { constants as cryptoConstants } from 'node:crypto'
import http from 'node:http'
import https from 'node:https'
import axios, {
  type AxiosInstance,
  type AxiosProxyConfig,
  type AxiosRequestConfig,
  type AxiosResponse,
  type Method,
  type ResponseType
} from 'axios'
import type { DownloadOptions, FileInfo } from '@/types/platform'
import Config from '@/module/utils/Config'
import { runWithDownloadSlot } from './DownloadBudget.js'
import {
  attemptDownloadStream,
  type DownloadProgressCallback
} from './download-pipeline.js'
import { delay, isSslError, toAxiosError } from './errors.js'
import { getRandomUserAgent } from './user-agent.js'

/**
 * 一次请求 / 下载的构造参数。
 *
 * 不进 `index.ts` 的公开面：全仓库没有一个调用点显式标注这个类型，都是直接把
 * 对象字面量交给 `new Networks({...})`，由构造函数的形参去约束。
 */
export interface NetworkRequestOptions {
  url: string
  headers?: AxiosRequestConfig['headers']
  type?: ResponseType
  method?: Method
  body?: unknown
  timeout?: number
  maxRetries?: number
  filepath?: string
  proxy?: AxiosProxyConfig | false
  /**
   * 显式指定这次下载记入哪个平台的连接预算桶。
   *
   * 缺省时由 `withDownloadBucket()` 铺的 AsyncLocalStorage 上下文决定（解析走
   * ParseCoordinator、主动推送走各平台 push 的 action()）。只有拿不到上下文、
   * 又不方便套 wrapper 的调用点才需要自己填。
   */
  downloadBucket?: string
}

export class Networks {
  readonly axiosInstance: AxiosInstance
  readonly proxy: AxiosProxyConfig | false
  readonly headers: AxiosRequestConfig['headers']
  readonly url: string
  readonly type: ResponseType
  readonly method: Method
  readonly body: unknown
  readonly timeout: number
  readonly filepath: string | undefined
  readonly maxRetries: number
  readonly userAgent: string
  readonly httpAgent: http.Agent
  readonly httpsAgent: https.Agent
  readonly downloadBucket: string | undefined

  constructor (data: NetworkRequestOptions) {
    this.headers = data.headers || {}
    this.url = data.url
    this.type = data.type || 'json'
    this.method = data.method || 'GET'
    this.body = data.body || ''
    this.timeout = data.timeout || 30000
    this.filepath = data.filepath
    this.maxRetries = data.maxRetries || 3
    this.downloadBucket = data.downloadBucket
    this.userAgent = getRandomUserAgent()
    this.proxy = Config.request?.proxy?.switch
      ? { host: Config.request.proxy.host, port: parseInt(Config.request.proxy.port), protocol: Config.request.proxy.protocol, auth: Config.request.proxy.auth }
      : false

    const agentOptions: http.AgentOptions = {
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 64,
      maxFreeSockets: 32,
      timeout: this.timeout,
      scheduling: 'fifo'
    }
    const httpsAgentOptions: https.AgentOptions = {
      ...agentOptions,
      rejectUnauthorized: false,
      minVersion: 'TLSv1',
      maxVersion: 'TLSv1.3',
      secureOptions: cryptoConstants.SSL_OP_NO_SSLv2 | cryptoConstants.SSL_OP_NO_SSLv3 | cryptoConstants.SSL_OP_NO_COMPRESSION
    }
    this.httpAgent = new http.Agent(agentOptions)
    this.httpsAgent = new https.Agent(httpsAgentOptions)
    this.axiosInstance = axios.create({
      timeout: this.timeout,
      maxRedirects: 5,
      validateStatus: status => status >= 200 && status < 300
    })
  }

  getConfig (retryCount = 0): AxiosRequestConfig {
    const headers: AxiosRequestConfig['headers'] = {
      'User-Agent': this.userAgent,
      Accept: '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      ...this.headers,
      ...(retryCount > 0 ? { 'Cache-Control': 'no-cache', Connection: 'close' } : {})
    }
    const config: AxiosRequestConfig = {
      url: this.url,
      method: this.method,
      headers,
      responseType: this.type,
      timeout: this.timeout,
      proxy: this.proxy,
      data: this.method === 'POST' ? this.body : undefined
    }
    if (this.url.startsWith('https:')) config.httpsAgent = this.httpsAgent
    else if (this.url.startsWith('http:')) config.httpAgent = this.httpAgent
    return config
  }

  async request (retryCount = 0): Promise<AxiosResponse> {
    try {
      return await this.axiosInstance(this.getConfig(retryCount))
    } catch (error: unknown) {
      const axiosError = toAxiosError(error)
      const isSSLError = isSslError(axiosError)
      if (axiosError.response?.status === 429 || axiosError.response?.status === 403) {
        if (retryCount < this.maxRetries) {
          await delay(2000 + Math.random() * 1000 + retryCount * 1000)
          return await this.request(retryCount + 1)
        }
      } else if (retryCount < this.maxRetries && (isSSLError || !axiosError.response)) {
        await delay(1000 * (retryCount + 1))
        return await this.request(retryCount + 1)
      }
      // 必须抛 Error 而不是 axiosError.message：抛裸字符串时 normalizeError
      // （ErrorHandler/render.ts:15）拿不到 stack，错误卡片的堆栈区直接不渲染。
      // toAxiosError 保证这里一定是带真实调用栈的 AxiosError。
      throw axiosError
    }
  }

  async getLongLink (url = '', retryCount = 0): Promise<string> {
    const targetUrl = url || this.url
    try {
      const response = await this.axiosInstance.get(targetUrl, {
        ...this.getConfig(retryCount),
        timeout: 5000,
        maxRedirects: 5
      })
      return response.request?.res?.responseUrl || response.config?.url || targetUrl
    } catch (error: unknown) {
      const axiosError = toAxiosError(error)
      if (retryCount < this.maxRetries) {
        await delay(1000 * (retryCount + 1))
        return await this.getLongLink(targetUrl, retryCount + 1)
      }
      logger.error(`获取重定向链接失败: ${axiosError.message}`)
      return targetUrl
    }
  }

  async getLocation (retryCount = 0): Promise<string> {
    try {
      const response = await this.axiosInstance.get(this.url, {
        ...this.getConfig(retryCount),
        timeout: 3000,
        maxRedirects: 0,
        validateStatus: status => status >= 300 && status < 400
      })
      return String(response.headers.location || this.url)
    } catch (error: unknown) {
      const axiosError = toAxiosError(error)
      if (retryCount < this.maxRetries && axiosError.code !== 'ERR_BAD_REQUEST') {
        await delay(1000 * (retryCount + 1))
        return await this.getLocation(retryCount + 1)
      }
      logger.error(`获取首个302重定向地址失败: ${axiosError.message}`)
      return String(axiosError.response?.headers.location || this.url)
    }
  }

  async getData<T = unknown> (): Promise<T> {
    const result = await this.request()
    if (result.status === 429) throw new Error('触发速率限制')
    return result.data as T
  }

  async getHeaders (retryCount = 0): Promise<AxiosResponse['headers']> {
    try {
      const config = this.getConfig(retryCount)
      const response = await this.axiosInstance.get(this.url, {
        ...config,
        timeout: 3000,
        headers: { ...config.headers, Range: 'bytes=0-0' }
      })
      return response.headers
    } catch (error: unknown) {
      const axiosError = toAxiosError(error)
      if (retryCount < this.maxRetries) {
        await delay(1000 * (retryCount + 1))
        return await this.getHeaders(retryCount + 1)
      }
      throw axiosError
    }
  }

  /**
   * 下载到 `filepath`，整个过程占用一格所属平台桶的连接额度。
   *
   * 额度只在最外层那一次调用申请：重试是这个方法自己递归调用的（下面 catch 里
   * `this.downloadStream(progressCallback, retryCount + 1, ...)`），如果每层都申请，
   * 重试就会在持有额度的同时再抢一格 —— 一个桶被同平台的下载占满时，
   * 所有重试都在等着永远不会释放的额度，整批下载互相等死。
   */
  async downloadStream (
    progressCallback: DownloadProgressCallback,
    retryCount = 0,
    options: DownloadOptions = {}
  ): Promise<FileInfo> {
    if (retryCount > 0) return await this.attemptDownloadStream(progressCallback, retryCount, options)
    return await runWithDownloadSlot(
      async () => await this.attemptDownloadStream(progressCallback, 0, options),
      { bucket: this.downloadBucket }
    )
  }

  /**
   * 把这次尝试要读的实例状态摊成一个上下文交给 `download-pipeline`。
   *
   * `retry` 打回 `downloadStream` 而不是直接打回 pipeline，是为了让重试继续走
   * 上面那个「`retryCount > 0` 就不再申请额度」的分支。
   */
  private async attemptDownloadStream (
    progressCallback: DownloadProgressCallback,
    retryCount: number,
    options: DownloadOptions
  ): Promise<FileInfo> {
    return await attemptDownloadStream(
      {
        url: this.url,
        headers: this.headers,
        userAgent: this.userAgent,
        proxy: this.proxy,
        httpAgent: this.httpAgent,
        httpsAgent: this.httpsAgent,
        axiosInstance: this.axiosInstance,
        timeout: this.timeout,
        maxRetries: this.maxRetries,
        filepath: this.filepath,
        downloadBucket: this.downloadBucket,
        retry: async (nextRetryCount, nextOptions) =>
          await this.downloadStream(progressCallback, nextRetryCount, nextOptions)
      },
      progressCallback,
      retryCount,
      options
    )
  }
}
