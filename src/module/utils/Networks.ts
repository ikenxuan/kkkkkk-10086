import { constants as cryptoConstants } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import os from 'node:os'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosProxyConfig,
  type AxiosRequestConfig,
  type AxiosResponse,
  type Method,
  type ResponseType
} from 'axios'
import type { Readable } from 'node:stream'
import type {
  DownloadOptions,
  DownloadUploadConfig,
  FileInfo,
  NormalizedDownloadOptions,
  NormalizedSlowGuardOptions
} from '@/types/platform'
import {
  classifyCdnFailure,
  reportCdnFailure,
  reportCdnSuccess,
  resolveCdnCandidates
} from './CdnRegistry.js'
import { probeAndOrderCdnUrls } from './CdnProbe.js'
import Config from './Config.js'
import {
  clampConcurrency,
  getDownloadBudgetLimit,
  runWithDownloadSlot
} from './DownloadBudget.js'
import {
  createSlowDownloadError,
  createSlowSpeedGuard,
  DEFAULT_SLOW_FLOOR_BYTES,
  DEFAULT_SUSTAIN_MS,
  isSlowDownloadAbort,
  SAMPLE_INTERVAL_MS
} from './DownloadWatchdog.js'
import { getErrorMessage } from './error-message.js'
import {
  downloadWithTool,
  isRetryableExternalFailure,
  resolveDownloadTool
} from './ExternalDownloader.js'
import {
  downloadMultipart,
  MULTIPART_MIN_SIZE,
  probeRangeSupport
} from './MultipartDownloader.js'
import { isRecord } from './record.js'

class ThrottleStream extends Transform {
  private readonly bytesPerSecond: number
  private readonly startTime = Date.now()
  private totalBytes = 0

  constructor (bytesPerSecond: number) {
    super()
    this.bytesPerSecond = bytesPerSecond
  }

  override _transform (
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    this.totalBytes += chunk.length
    const elapsed = (Date.now() - this.startTime) / 1000
    const expectedTime = this.totalBytes / this.bytesPerSecond
    const wait = Math.max(0, (expectedTime - elapsed) * 1000)
    if (wait > 0) {
      setTimeout(() => {
        this.push(chunk)
        callback()
      }, wait)
      return
    }
    this.push(chunk)
    callback()
  }
}

const MB = 1024 * 1024

export const normalizeDownloadOptions = (
  options: DownloadOptions,
  uploadConfig: DownloadUploadConfig
): NormalizedDownloadOptions => {
  const isLiveStream = options.isLiveStream === true
  const minSpeed = Math.max(0.1, Number(uploadConfig.downloadMinSpeed || 1)) * MB
  const maxSpeed = Math.max(0.1, Number(uploadConfig.downloadMaxSpeed || 10)) * MB
  return {
    isLiveStream,
    liveStreamMaxSize: options.liveStreamMaxSize ?? 10 * MB,
    multiThread: !isLiveStream && uploadConfig.downloadMultiThread === true,
    concurrency: clampConcurrency(uploadConfig.downloadConcurrency),
    throttle: {
      enabled: Boolean(uploadConfig.downloadThrottle),
      currentSpeed: Math.max(minSpeed, Number(options.currentSpeed || maxSpeed)),
      minSpeed,
      autoReduce: uploadConfig.downloadAutoReduce !== false
    },
    slowGuard: normalizeSlowGuard(uploadConfig)
  }
}

/**
 * 低速看守的参数归一化。
 *
 * 关掉的方式有两条，两条都得认：开关置 false，或者把地板速填 0。后者是给
 * 「想留着开关、只是暂时不判」的人用的，YAML 注释里也是这么写的。
 *
 * 主动限速开着的时候要额外让一步：地板速不能高于用户自己设的限速值，否则我们
 * 会把**自己**限出来的速度当成对端在限速，一路重启到重试次数用完。
 */
const normalizeSlowGuard = (uploadConfig: DownloadUploadConfig): NormalizedSlowGuardOptions => {
  const enabled = uploadConfig.downloadSlowRestart !== false
  const configured = uploadConfig.downloadSlowFloor
  const floorKb = configured === undefined ? DEFAULT_SLOW_FLOOR_BYTES / 1024 : Math.max(0, Number(configured) || 0)
  let floorBytesPerSecond = enabled ? floorKb * 1024 : 0
  if (floorBytesPerSecond > 0 && uploadConfig.downloadThrottle) {
    const cap = Math.max(0.1, Number(uploadConfig.downloadMaxSpeed || 10)) * MB
    // 留一半余量：限速流的实际吞吐总在设定值下面浮动，贴着设定值判会误伤
    floorBytesPerSecond = Math.min(floorBytesPerSecond, cap / 2)
  }
  const sustainSeconds = uploadConfig.downloadSlowSustain
  const sustainMs = sustainSeconds === undefined
    ? DEFAULT_SUSTAIN_MS
    : Math.max(SAMPLE_INTERVAL_MS, Number(sustainSeconds) * 1000 || DEFAULT_SUSTAIN_MS)
  return {
    enabled: enabled && floorBytesPerSecond > 0,
    floorBytesPerSecond,
    sustainMs
  }
}

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes)) return 'unknown'
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)}MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${bytes}B`
}

/**
 * 挑下一个还没试过的候选地址。
 *
 * 「试过」按**地址**算而不是按主机算：B站 的 `backup_url` 里同一个主机可能给出
 * 不同路径的两条地址，把主机拉黑会把还没试的那条也一起丢掉。
 *
 * @param candidates 排序后的候选地址
 * @param tried 已经试过的地址
 * @returns 下一个能试的地址；都试过了返回 undefined
 */
const nextCdnCandidate = (
  candidates: readonly string[],
  tried: ReadonlySet<string>
): string | undefined => candidates.find(url => !tried.has(url))

/**
 * 剩下还没试过的候选地址，保持原有次序。
 *
 * 给测速用：已经试过并失败的地址没有测的价值，把它们一起交给测速等于花时间
 * 给已知的坏节点排名。
 *
 * @param candidates 排序后的候选地址
 * @param tried 已经试过的地址
 */
const nextCdnCandidates = (
  candidates: readonly string[],
  tried: ReadonlySet<string>
): string[] => candidates.filter(url => !tried.has(url))

/**
 * 外部下载器的体积门槛，字节。配置里以 MB 计。
 *
 * 拿不到体积时按「没够到门槛」处理：外部工具的收益全在长时间下载上，
 * 为一个体积未知、可能只有几十 KB 的文件多 spawn 一个进程是净亏。
 */
const externalMinBytes = (uploadConfig: DownloadUploadConfig): number => {
  const configured = Number(uploadConfig.downloadExternalMinSize)
  return (Number.isFinite(configured) && configured > 0 ? configured : 64) * MB
}

/** 只取主机名给日志用。整条下载地址带着签名参数，打进日志既长又没有可读性。 */
const readUrlHost = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

interface WeightedUserAgent {
  ua: string
  pct: number
}

const userAgentsByPlatform: Record<'windows' | 'mac' | 'linux', WeightedUserAgent[]> = {
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
    { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36', pct: 3.72 },
    { ua: 'Mozilla/5.0 (X11; Linux i686; rv:136.0) Gecko/20100101 Firefox/136.0', pct: 3.6 }
  ]
}

const getRandomUserAgent = (): string => {
  const agents = os.platform() === 'win32'
    ? userAgentsByPlatform.windows
    : os.platform() === 'darwin'
      ? userAgentsByPlatform.mac
      : userAgentsByPlatform.linux
  const totalWeight = agents.reduce((sum, agent) => sum + agent.pct, 0)
  let random = Math.random() * totalWeight
  const found = agents.find(agent => (random -= agent.pct) <= 0)
  return found?.ua || agents[0]?.ua || ''
}

export const baseHeaders: AxiosRequestConfig['headers'] = {
  Accept: '*/*',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'User-Agent': getRandomUserAgent()
}

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

  async getfetch (): Promise<AxiosResponse | false> {
    try {
      return await this.request()
    } catch {
      return false
    }
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
    progressCallback: (downloadedBytes: number, totalBytes: number, isLiveStream: boolean) => void,
    retryCount = 0,
    options: DownloadOptions = {}
  ): Promise<FileInfo> {
    if (retryCount > 0) return await this.attemptDownloadStream(progressCallback, retryCount, options)
    return await runWithDownloadSlot(
      async () => await this.attemptDownloadStream(progressCallback, 0, options),
      { bucket: this.downloadBucket }
    )
  }

  private async attemptDownloadStream (
    progressCallback: (downloadedBytes: number, totalBytes: number, isLiveStream: boolean) => void,
    retryCount: number,
    options: DownloadOptions
  ): Promise<FileInfo> {
    const { isLiveStream = false, liveStreamMaxSize = 10 * MB } = options
    const normalized = normalizeDownloadOptions(options, Config.upload)
    const throttle = normalized.throttle
    const filepath = this.filepath
    if (!filepath) throw new TypeError('下载文件路径不能为空')

    // 候选地址：`this.url` 永远排在最前（它是调用方明确指定的那一条），后面跟上
    // 接口给的镜像和地址簿里记着的。`this.url` 是 readonly，所以换地址不能改实例，
    // 只能让每次尝试自己算出「这次用哪条」。
    const candidates = resolveCdnCandidates(
      options.resource ?? '',
      [this.url, ...(options.candidates ?? [])]
    )
    const tried = new Set(options.triedUrls ?? [])
    // 测速重排。放在挑地址**之前**：地址簿的排序只知道「谁拒过我们」，
    // 测速知道「谁现在快」—— 而 0.1MB/s 那个毛病里节点从没拒过我们，它一直在正常响应。
    //
    // 直播流不测：那些地址是 m3u8 / flv 流，Range 取样对它们没有意义，而且直播本来只有一条地址。
    const ordered = options.probeCdn === true && !isLiveStream && candidates.length > 1
      ? await probeAndOrderCdnUrls(nextCdnCandidates(candidates, tried), {
        headers: this.headers,
        proxy: this.proxy
      })
      : candidates
    const url = nextCdnCandidate(ordered, tried) ?? this.url

    const request = async (requestOptions: AxiosRequestConfig): Promise<Pick<AxiosResponse<Readable>, 'status' | 'headers' | 'data'>> => {
      const config: AxiosRequestConfig = {
        url,
        method: 'GET',
        responseType: requestOptions.responseType,
        signal: requestOptions.signal,
        timeout: 0,
        maxRedirects: 5,
        decompress: false,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        proxy: this.proxy,
        headers: {
          'User-Agent': this.userAgent,
          Accept: '*/*',
          ...this.headers,
          ...requestOptions.headers
        }
      }
      if (url.startsWith('https:')) config.httpsAgent = this.httpsAgent
      else if (url.startsWith('http:')) config.httpAgent = this.httpAgent
      return await this.axiosInstance<Readable>(config)
    }

    // 外部下载器要不要上，先看系统里有没有那个工具 —— 探测结果按进程缓存，
    // 所以这一步只有本进程第一次下载时才真的 spawn 一次 `curl --version`。
    // 直播流一律不交给外部工具：那是没有总长的持续流，`--speed-limit` 和体积门槛都无从谈起。
    const externalTool = isLiveStream
      ? 'builtin'
      : await resolveDownloadTool(Config.upload?.downloadExternalTool)
    const externalMinSize = externalMinBytes(Config.upload)
    const wantsMultipart = !isLiveStream && retryCount === 0 && Config.upload?.downloadMultiThread === true

    // Range 探测只做一次，两边共用：多线程要它决定切几片，外部下载器要它判够不够体积门槛。
    // 各探一遍等于为同一个事实多付一次往返。
    let rangeProbe: Awaited<ReturnType<typeof probeRangeSupport>> | undefined
    if (wantsMultipart || externalTool !== 'builtin') {
      try {
        rangeProbe = await probeRangeSupport({ request, headers: this.headers })
      } catch (error: unknown) {
        logger.debug(`服务器不满足分片下载条件，按单线程内建下载处理: ${getErrorMessage(error)}`)
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), isLiveStream ? 120000 : 90000)
    // 低速看守掐断时留下的错误。声明在 try 外面是为了让 catch 也看得见 ——
    // `abort()` 之后 axios 抛的是它自己的 ERR_CANCELED，得靠这个引用把「为什么被取消」找回来。
    let slowAbort: Error | undefined
    try {
      let totalBytes = -1
      let startByte = 0
      // 换过地址就不能续传：断点续传的前提是「后面的字节接得上前面的」，而两个镜像
      // 未必给出同一份字节流（抖音 `url_list[2]` 那种包装地址甚至可能给到另一个码率）。
      // 接错了不会报错，只会产出一个能落盘、播不动的文件 —— 比重下一遍糟得多。
      if (options.lastUrl !== undefined && options.lastUrl !== url && fs.existsSync(filepath)) {
        fs.unlinkSync(filepath)
        logger.debug('[下载] 换了 CDN 地址，丢弃上一个地址下到的部分数据')
      }
      // 多线程下载。和外部下载器一样放在 try 里面共用下面那套 catch —— 之前它在 try
      // 外面直接 return，于是分片路上的 403 / 404 和低速判定都到不了「换地址重试」那一步，
      // 一个坏节点就能把整次下载判死，而地址簿里还躺着几条没试过的镜像。
      //
      // 排在断点续传之前：分片下载是重建到独立的 staging 文件再整体替换的，
      // 对已经落了一半的目标文件既不读也不接，先把它截短纯属白做。
      if (wantsMultipart && rangeProbe?.total !== undefined && rangeProbe.total >= MULTIPART_MIN_SIZE) {
        clearTimeout(timeoutId)
        // 这里报的是「桶的额度上限」，不是实际分片数：分片要在这个上限内、
        // 扣掉本次文件级已占的那一格之后再抢，抢到几格由 downloadMultipart 决定。
        logger.debug(`启用多线程下载: 平台额度上限 ${getDownloadBudgetLimit()} 路, ${formatBytes(rangeProbe.total)}`)
        const result = await downloadMultipart({
          filepath,
          request,
          headers: this.headers,
          total: rangeProbe.total,
          validator: rangeProbe.validator,
          concurrency: getDownloadBudgetLimit(),
          bucket: this.downloadBucket,
          maxRetries: this.maxRetries,
          maxSpeed: throttle.enabled ? throttle.currentSpeed : 0,
          // 低速阈值和另外两条路同源，判的是所有分片的合计速率 —— 细节见 MultipartDownloader。
          slowFloorBytesPerSecond: normalized.slowGuard.enabled ? normalized.slowGuard.floorBytesPerSecond : 0,
          slowSustainMs: normalized.slowGuard.sustainMs,
          onProgress: progressCallback
        })
        reportCdnSuccess(url)
        return result
      }

      if (!isLiveStream && fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath)
        startByte = Math.max(0, stats.size - 256 * 1024)
        if (startByte > 0 && startByte < stats.size) {
          fs.truncateSync(filepath, startByte)
          logger.debug(`检测到部分下载文件，截断到 ${formatBytes(startByte)} 后断点续传`)
        }
      }

      // 外部下载器。放在 try 里面是为了共用下面那套 catch：换地址、报地址簿、
      // 退避重试的判定对「谁下的」并不关心，只关心「为什么没下成」。
      //
      // 体积门槛在这里判而不是在探测之前判，因为门槛比的是**文件体积**，
      // 而文件体积正是 Range 探测的产物；探不到体积时（服务器不支持 Range）
      // 一律回落内建下载 —— 那种服务器上外部工具的断点续传同样使不上。
      if (externalTool !== 'builtin' && rangeProbe?.total !== undefined && rangeProbe.total >= externalMinSize) {
        clearTimeout(timeoutId)
        logger.debug(`[下载] 交给 ${externalTool} 下载，${formatBytes(rangeProbe.total)}`)
        try {
          const result = await downloadWithTool(externalTool, {
            url,
            filepath,
            headers: this.headers,
            proxy: this.proxy,
            connectTimeoutMs: this.timeout,
            // 低速阈值原样交下去，三条路（内建 / curl / wget）的判定口径才一致。
            // curl 上它会变成 --speed-limit，由 curl 自己在 C 代码里判；wget 没有等价物，
            // 那条路由 ExternalDownloader 里的看守盯着办 —— 细节见那个模块。
            slowFloorBytesPerSecond: normalized.slowGuard.enabled ? normalized.slowGuard.floorBytesPerSecond : 0,
            slowSustainMs: normalized.slowGuard.sustainMs,
            maxSpeedBytesPerSecond: throttle.enabled ? throttle.currentSpeed : 0,
            // 总长交下去，wget 那条路的看守才做得出「快下完了就别判」的豁免，
            // 进度条也才有分母。这个值是上面 Range 探测量出来的，不必再问一次。
            totalBytes: rangeProbe.total,
            resume: startByte > 0,
            onProgress: progressCallback
          })
          reportCdnSuccess(url)
          return result
        } catch (error: unknown) {
          // curl 判出的低速要补上本仓的低速标记，好让下面的 catch 和「重试用尽时抛什么」
          // 走同一条路。不换成 createSlowDownloadError 是因为 curl 自己的文案
          // （带退出码）比我们凭空造一个速率数值更有用。
          if (isRecord(error) && error.slow === true && error instanceof Error) {
            slowAbort = Object.assign(error, { kkkSlowAbort: true as const })
            throw slowAbort
          }
          throw error
        }
      }

      const httpsAgent = retryCount > 0
        ? new https.Agent({ keepAlive: false, timeout: 60000, rejectUnauthorized: false })
        : this.httpsAgent
      const httpAgent = retryCount > 0
        ? new http.Agent({ keepAlive: false, timeout: 60000 })
        : this.httpAgent
      const downloadConfig: AxiosRequestConfig = {
        url,
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
          Accept: '*/*',
          'Accept-Encoding': 'identity',
          Connection: retryCount > 0 ? 'close' : 'keep-alive',
          ...(startByte > 0 ? { Range: `bytes=${startByte}-` } : {}),
          ...this.headers
        }
      }
      if (url.startsWith('https:')) downloadConfig.httpsAgent = httpsAgent
      else if (url.startsWith('http:')) downloadConfig.httpAgent = httpAgent
      const response = await axios<Readable>(downloadConfig)
      clearTimeout(timeoutId)
      if (response.status < 200 || response.status >= 300) throw new Error(`下载失败，状态码: ${response.status}`)
      if (startByte > 0 && response.status !== 206) {
        logger.warn('服务器不支持断点续传，将重新下载整个文件')
        startByte = 0
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
      }
      if (response.status === 206 && response.headers['content-range']) {
        const rangeStart = Number(String(response.headers['content-range']).match(/bytes\s+(\d+)-/)?.[1])
        if (Number.isFinite(rangeStart) && rangeStart !== startByte) {
          logger.warn(`Content-Range 起始位置不匹配: 请求 ${startByte}, 实际 ${rangeStart}，将重新下载`)
          if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
          response.data.destroy?.()
          throw new Error('Content-Range 起始位置不匹配')
        }
      }
      if (!isLiveStream && response.headers['content-length']) {
        const contentLength = parseInt(String(response.headers['content-length'])) || -1
        totalBytes = response.status === 206 && contentLength > 0 ? startByte + contentLength : contentLength
      }

      const bufferSize = totalBytes > 50 * MB ? 32 * MB : 16 * MB
      const writer = fs.createWriteStream(filepath, {
        flags: startByte > 0 ? 'r+' : 'w',
        start: startByte > 0 ? startByte : undefined,
        highWaterMark: bufferSize
      })
      let downloadedBytes = startByte
      let lastUpdate = 0
      let lastChunkTime = Date.now()
      let stuckCheckInterval: NodeJS.Timeout | undefined
      const transform = new Transform({
        highWaterMark: bufferSize,
        transform (chunk: Buffer, _encoding, callback): void {
          downloadedBytes += chunk.length
          lastChunkTime = Date.now()
          if (isLiveStream && downloadedBytes >= liveStreamMaxSize) {
            controller.abort()
            callback(null, chunk)
            return
          }
          const now = Date.now()
          if (now - lastUpdate > 2000) {
            progressCallback(downloadedBytes, isLiveStream ? liveStreamMaxSize : totalBytes > 0 ? totalBytes : -1, isLiveStream)
            lastUpdate = now
          }
          callback(null, chunk)
        }
      })
      stuckCheckInterval = setInterval(() => {
        if (Date.now() - lastChunkTime > 30000) {
          controller.abort()
          if (stuckCheckInterval) clearInterval(stuckCheckInterval)
        }
      }, 5000)

      // 低速看守。和上面的断流看守并存，两个盯的是两件事：断流是「连接死了」，
      // 低速是「连接活着但被掐着脖子」，后者数据一直在来，断流看守永远不会响。
      //
      // 直播流一律不判：那种下载的速率就是对端的推流码率，本来就可能低于任何地板速，
      // 判它等于每次录播都自杀式重启。
      const { floorBytesPerSecond, sustainMs } = normalized.slowGuard
      const slowGuard = normalized.slowGuard.enabled && !isLiveStream
        ? createSlowSpeedGuard({ floorBytesPerSecond, sustainMs })
        : undefined
      // `slowAbort` 声明在 try 外面（方法作用域），因为认领它的 catch 在 try 之外：
      // abort() 之后 axios 抛的是它自己的 ERR_CANCELED，我们造的那个错误不会自动传出去。
      let slowCheckInterval: NodeJS.Timeout | undefined
      if (slowGuard) {
        slowGuard.reset(Date.now())
        slowCheckInterval = setInterval(() => {
          const verdict = slowGuard.sample({ downloadedBytes, totalBytes, now: Date.now() })
          if (!verdict.triggered) return
          const reason = createSlowDownloadError(verdict.bytesPerSecond, normalized.slowGuard.floorBytesPerSecond)
          slowAbort = reason
          logger.warn(`[下载] ${reason.message}，掐掉重来并换一个地址`)
          controller.abort()
          if (slowCheckInterval) clearInterval(slowCheckInterval)
        }, SAMPLE_INTERVAL_MS)
      }

      try {
        if (throttle.enabled) {
          logger.debug(`启用限速下载: ${formatBytes(throttle.currentSpeed)}/s`)
          await pipeline(response.data, new ThrottleStream(throttle.currentSpeed), transform, writer)
        } else {
          await pipeline(response.data, transform, writer)
        }
      } finally {
        if (stuckCheckInterval) clearInterval(stuckCheckInterval)
        if (slowCheckInterval) clearInterval(slowCheckInterval)
      }
      // 掐掉的那一刻可能正好是最后一个块落盘：abort() 和流的自然结束是并发的，
      // 于是 pipeline 有可能照样 resolve，而文件其实是完整的。这时候把它当失败扔掉
      // 就是白下一遍，所以只在**真的没下完**时才认领这次中断。
      const complete = totalBytes > 0 && downloadedBytes >= totalBytes
      if (slowAbort && !complete) throw slowAbort
      const finalTotal = totalBytes > 0 ? totalBytes : downloadedBytes
      progressCallback(downloadedBytes, finalTotal, isLiveStream)
      reportCdnSuccess(url)
      return { filepath, totalBytes: downloadedBytes }
    } catch (error: unknown) {
      clearTimeout(timeoutId)
      const axiosError = toAxiosError(error)
      if (isLiveStream && axiosError.code === 'ERR_CANCELED') {
        const stats = await fs.promises.stat(filepath).catch(() => ({ size: 0 }))
        return { filepath, totalBytes: stats.size }
      }
      // 低速中断要认我们自己留的那份引用：走到这里时 axios 已经把 ERR_CANCELED
      // 盖在 code 上了，光看 axiosError 分不出「被限速掐掉」和「别的取消」。
      const slow = slowAbort !== undefined || isSlowDownloadAbort(error)
      // 换地址的判定：节点级失败（403/404/连不上）换，限流和源站错误不换 ——
      // 理由写在 classifyCdnFailure 里。低速单独算一类，状态码是 200 但节点没法用。
      //
      // 外部工具的失败要拿原始 error 判，不能拿 axiosError：`toAxiosError` 只搬运
      // message 和 code，`status` / `exitCode` 都留在原对象上。带得出状态码的那些
      // classifyCdnFailure 本来就认（它读的是 `error.status`），这里补的是只剩退出码
      // 的情况 —— curl 22 / wget 8 说明是 HTTP 层拒绝，但具体是几百没法从输出里解析。
      const failureKind = slow
        ? 'slow'
        : classifyCdnFailure(error) ?? (isRetryableExternalFailure(error) ? 'blocked' : null)
      if (failureKind !== null) reportCdnFailure(url, failureKind)
      const nextTried = failureKind !== null ? [...tried, url] : [...tried]
      const switchTo = failureKind !== null
        ? nextCdnCandidate(resolveCdnCandidates(options.resource ?? '', candidates), new Set(nextTried))
        : undefined

      if (retryCount < this.maxRetries) {
        const is403or429 = axiosError.response?.status === 403 || axiosError.response?.status === 429
        const isReset = axiosError.code === 'ECONNRESET' || axiosError.code === 'ECONNABORTED'
        const isTimeout = axiosError.code === 'ETIMEDOUT'
        const sslError = isSslError(axiosError)
        const nextSpeed = isReset && throttle.enabled && throttle.autoReduce
          ? Math.max(throttle.currentSpeed * 0.6, throttle.minSpeed)
          : throttle.currentSpeed
        if (nextSpeed < throttle.currentSpeed) {
          logger.warn(`检测到下载断流，自动降速: ${formatBytes(throttle.currentSpeed)}/s -> ${formatBytes(nextSpeed)}/s`)
        }
        // 换到新地址时不必退避：慢/坏的是刚才那个节点，新节点没有理由为它的问题等待。
        // 但 429 例外 —— 那是按 IP 算的，换节点也躲不掉，还是要等。
        const wait = switchTo !== undefined && !is403or429
          ? 0
          : is403or429
            ? 3000 + Math.random() * 2000
            : isReset
              ? 2000 + retryCount * 1000
              : isTimeout
                ? 2000
                : sslError
                  ? 1500 + retryCount * 500
                  : 1500 * (retryCount + 1)
        const reason = slow ? '下载持续低速' : `下载失败(${axiosError.code || axiosError.message})`
        if (switchTo !== undefined) {
          logger.warn(`${reason}，换地址重试 (${retryCount + 1}/${this.maxRetries}): ${readUrlHost(switchTo)}`)
        } else {
          logger.warn(`${reason}，${Math.round(wait)}ms后重试 (${retryCount + 1}/${this.maxRetries})`)
        }
        if (wait > 0) await delay(wait)
        return await this.downloadStream(progressCallback, retryCount + 1, {
          ...options,
          currentSpeed: nextSpeed,
          candidates,
          triedUrls: nextTried,
          lastUrl: url
        })
      }
      // 重试次数用完时优先抛我们自己那份错误，因为 `axiosError` 到这儿已经把原因丢干净了：
      // 内建路上 abort() 让 axios 抛的是 `ERR_CANCELED` + 「canceled」，观测速率和地板速
      // 全没了，排障时看不出这次是被限速掐死的还是网络炸了。
      //
      // 只有内建和外部这两条路需要这份引用。多线程那条不用：它抛的本来就是我们造的错误，
      // `toAxiosError` 会把 `code` 原样搬过去（见 `getErrorCode`），所以 `KKK_DOWNLOAD_TOO_SLOW`
      // 穿得过去，`isSlowDownloadAbort` 照样认得出来。
      if (slow && slowAbort !== undefined) throw slowAbort
      throw axiosError
    }
  }
}

export function toAxiosError (error: unknown): AxiosError {
  if (axios.isAxiosError(error)) return error
  if (error instanceof Error) {
    return AxiosError.from(error, getErrorCode(error))
  }
  return new AxiosError(String(error))
}

function getErrorCode (error: Error): string | undefined {
  const code = Reflect.get(error, 'code') as unknown
  return typeof code === 'string' ? code : undefined
}

function isSslError (error: AxiosError): boolean {
  return error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    error.code === 'ERR_SSL_WRONG_VERSION_NUMBER' ||
    Boolean(error.message?.includes('SSL'))
}

async function delay (ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}
