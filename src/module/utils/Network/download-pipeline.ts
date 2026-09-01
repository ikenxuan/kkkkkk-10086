/**
 * 一次下载尝试的全过程：挑地址、探 Range、三条下载路（多线程 / 外部工具 / 内建流）、
 * 两道看守、以及失败后的报地址簿与退避重试。
 *
 * 从 `Networks` 类里搬出来是为了让那个类回到「薄客户端」的体量。
 */

import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type {
  AxiosInstance,
  AxiosProxyConfig,
  AxiosRequestConfig,
  AxiosResponse
} from 'axios'
import type { Readable } from 'node:stream'
import type { DownloadOptions, FileInfo } from '@/types/platform'
import Config from '@/module/utils/Config'
import { getErrorMessage } from '@/module/utils/error-message'
import { isRecord } from '@/module/utils/record'
import { probeAndOrderCdnUrls } from './CdnProbe.js'
import {
  classifyCdnFailure,
  reportCdnFailure,
  reportCdnSuccess,
  resolveCdnCandidates
} from './CdnRegistry.js'
import { getDownloadBudgetLimit } from './DownloadBudget.js'
import {
  createSlowDownloadError,
  createSlowSpeedGuard,
  isSlowDownloadAbort,
  SAMPLE_INTERVAL_MS
} from './DownloadWatchdog.js'
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
import { nextCdnCandidate, nextCdnCandidates, readUrlHost } from './cdn-candidates.js'
import { externalMinBytes, normalizeDownloadOptions } from './download-options.js'
import { delay, toAxiosError } from './errors.js'
import { computeRetryPlan } from './retry-plan.js'
import { ThrottleStream } from './ThrottleStream.js'
import { formatBytes, MB } from './units.js'

/** 下载进度回调。`totalBytes` 为 -1 表示总长未知（对端没给 content-length）。 */
export type DownloadProgressCallback = (
  downloadedBytes: number,
  totalBytes: number,
  isLiveStream: boolean
) => void

/**
 * 一次下载尝试要用到的实例状态。
 *
 * 全是 `Networks` 上的只读字段，逐个显式传进来而不是交整个实例，是为了让这个
 * 函数的输入面在签名上就看得完 —— 它读了哪些状态、没读哪些，不必翻实现。
 */
export interface DownloadPipelineContext {
  /** 调用方最初指定的那条地址。永远排在候选列表最前面 */
  url: string
  headers: AxiosRequestConfig['headers']
  userAgent: string
  proxy: AxiosProxyConfig | false
  httpAgent: http.Agent
  httpsAgent: https.Agent
  axiosInstance: AxiosInstance
  timeout: number
  maxRetries: number
  filepath: string | undefined
  downloadBucket: string | undefined
  /**
   * 递归重试。必须打到 `Networks.downloadStream` 上而不是本函数上：
   * 连接额度只在最外层那一次申请，重试要走那个方法里的 `retryCount > 0` 分支。
   */
  retry: (retryCount: number, options: DownloadOptions) => Promise<FileInfo>
}

export const attemptDownloadStream = async (
  context: DownloadPipelineContext,
  progressCallback: DownloadProgressCallback,
  retryCount: number,
  options: DownloadOptions
): Promise<FileInfo> => {
  const {
    url: primaryUrl,
    headers,
    userAgent,
    proxy,
    axiosInstance,
    timeout: connectTimeout,
    maxRetries,
    downloadBucket,
    retry
  } = context
  const { isLiveStream = false } = options
  const normalized = normalizeDownloadOptions(options, Config.upload)
  // 直播上限只认归一化后的那一份。之前这里自己写了一遍 `?? 10 * MB` 默认值，
  // 和 `normalizeDownloadOptions` 里的那份是两个独立的字面量，改一处漏一处。
  const liveStreamMaxSize = normalized.liveStreamMaxSize
  // 直播流的 abort 时限同理：这个 120s 原来也是本文件的字面量，现在由归一化统一给出，
  // 调用方（录制路径）想录更久就传 `liveStreamMaxDurationMs`，不传还是原来那个默认值。
  const liveStreamMaxDurationMs = normalized.liveStreamMaxDurationMs
  const throttle = normalized.throttle
  const filepath = context.filepath
  if (!filepath) throw new TypeError('下载文件路径不能为空')

  // 候选地址：`primaryUrl` 永远排在最前（它是调用方明确指定的那一条），后面跟上
  // 接口给的镜像和地址簿里记着的。`Networks.url` 是 readonly，所以换地址不能改实例，
  // 只能让每次尝试自己算出「这次用哪条」。
  const candidates = resolveCdnCandidates(
    options.resource ?? '',
    [primaryUrl, ...(options.candidates ?? [])]
  )
  const tried = new Set(options.triedUrls ?? [])
  // 测速重排。放在挑地址**之前**：地址簿的排序只知道「谁拒过我们」，
  // 测速知道「谁现在快」—— 而 0.1MB/s 那个毛病里节点从没拒过我们，它一直在正常响应。
  //
  // 直播流不测：那些地址是 m3u8 / flv 流，Range 取样对它们没有意义，而且直播本来只有一条地址。
  const ordered = options.probeCdn === true && !isLiveStream && candidates.length > 1
    ? await probeAndOrderCdnUrls(nextCdnCandidates(candidates, tried), {
      headers,
      proxy
    })
    : candidates
  const url = nextCdnCandidate(ordered, tried) ?? primaryUrl

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
      proxy,
      headers: {
        'User-Agent': userAgent,
        Accept: '*/*',
        ...headers,
        ...requestOptions.headers
      }
    }
    if (url.startsWith('https:')) config.httpsAgent = context.httpsAgent
    else if (url.startsWith('http:')) config.httpAgent = context.httpAgent
    return await axiosInstance<Readable>(config)
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
      rangeProbe = await probeRangeSupport({ request, headers })
    } catch (error: unknown) {
      logger.debug(`服务器不满足分片下载条件，按单线程内建下载处理: ${getErrorMessage(error)}`)
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), isLiveStream ? liveStreamMaxDurationMs : 90000)
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
        headers,
        total: rangeProbe.total,
        validator: rangeProbe.validator,
        concurrency: getDownloadBudgetLimit(),
        bucket: downloadBucket,
        maxRetries,
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
          headers,
          proxy,
          connectTimeoutMs: connectTimeout,
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
      : context.httpsAgent
    const httpAgent = retryCount > 0
      ? new http.Agent({ keepAlive: false, timeout: 60000 })
      : context.httpAgent
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
        'User-Agent': userAgent,
        Accept: '*/*',
        'Accept-Encoding': 'identity',
        Connection: retryCount > 0 ? 'close' : 'keep-alive',
        ...(startByte > 0 ? { Range: `bytes=${startByte}-` } : {}),
        ...headers
      }
    }
    if (url.startsWith('https:')) downloadConfig.httpsAgent = httpsAgent
    else if (url.startsWith('http:')) downloadConfig.httpAgent = httpAgent
    const response = await axiosInstance<Readable>(downloadConfig)
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

    if (retryCount < maxRetries) {
      const { waitMs: wait, nextSpeed } = computeRetryPlan({
        error: axiosError,
        retryCount,
        throttle,
        willSwitchUrl: switchTo !== undefined
      })
      if (nextSpeed < throttle.currentSpeed) {
        logger.warn(`检测到下载断流，自动降速: ${formatBytes(throttle.currentSpeed)}/s -> ${formatBytes(nextSpeed)}/s`)
      }
      const reason = slow ? '下载持续低速' : `下载失败(${axiosError.code || axiosError.message})`
      if (switchTo !== undefined) {
        logger.warn(`${reason}，换地址重试 (${retryCount + 1}/${maxRetries}): ${readUrlHost(switchTo)}`)
      } else {
        logger.warn(`${reason}，${Math.round(wait)}ms后重试 (${retryCount + 1}/${maxRetries})`)
      }
      if (wait > 0) await delay(wait)
      return await retry(retryCount + 1, {
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
