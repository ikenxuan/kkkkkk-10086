/**
 * 用系统上的 `curl` / `wget` 下载，替代内建的 axios 流式下载。
 *
 * ## 为什么值得引入
 *
 * 这两个工具在**慢速与断连**这件事上比我们自己写的强，而那正是本仓库反复出问题的地方：
 *
 * - `curl --speed-limit N --speed-time S` 是原生的低速中断：连续 S 秒低于 N 字节/秒
 *   就以退出码 28 结束。等于把 {@link module:DownloadWatchdog} 那套判定交给 C 代码做，
 *   而且不占 Node 的事件循环。wget 没有等价物（`--read-timeout` 只兜完全断流），
 *   所以那条路仍由本模块自己拿 `DownloadWatchdog` 盯着轮询出来的体积判 —— 两条路
 *   的地板速和持续窗口取的是同一组配置值，判定口径一致。
 * - 两者都自带成熟的断点续传（`--continue-at -` / `--continue`）和重定向处理，
 *   不需要我们再判一次 `Content-Range` 起始位置对不对。
 * - 长时间大文件下载不再和渲染、FFmpeg 抢同一个 Node 进程的事件循环。
 *
 * ## 为什么默认不开
 *
 * 两个工具都**不是**跨平台必然存在的：Windows 10 1803+ 自带 `curl.exe`（但不带 wget），
 * 精简版系统和一些容器镜像里两个都没有。所以默认走内建下载，开关在
 * `upload.downloadExternalTool`；选 `auto` 时探测不到可用工具会静默回落内建，
 * 而不是把一次解析炸掉。
 *
 * ## 进度为什么靠轮询文件体积
 *
 * 不解析 curl / wget 的进度输出。它们的进度条写在 stderr、格式随版本和 locale 变
 * （`wget` 的中文 locale 会输出本地化单位），拿正则去啃是一条注定要坏的路。
 * 轮询目标文件的 `fs.stat().size` 得到的是**同一个事实**，而且对两个工具、
 * 所有版本、所有语言都成立。
 *
 * ## 安全
 *
 * 一律 `execFile` + 参数数组，绝不拼 shell 字符串 —— URL 和请求头都来自远端响应，
 * 拼进 shell 就是命令注入。这和 `FFmpeg.ts` 定下的规矩一致。
 */
import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import type { AxiosProxyConfig, AxiosRequestConfig } from 'axios'
import type { FileInfo } from '@/types/platform'
import { createSlowDownloadError, createSlowSpeedGuard } from './DownloadWatchdog.js'
import { isRecord } from '@/module/utils/record'

const execFileAsync = promisify(execFile)

/** 可选的下载工具。`builtin` 是内建的 axios 流式下载。 */
export type DownloadToolName = 'builtin' | 'curl' | 'wget' | 'auto'

/** 外部工具的实际名字（`auto` 解析之后的结果）。 */
export type ExternalToolName = 'curl' | 'wget'

/** 探测缓存。同一个进程里不重复 spawn 去问「你在不在」。 */
const availability = new Map<ExternalToolName, boolean>()

/** 轮询目标文件体积的间隔：1 秒。比进度回调的 2 秒节流窗口密一档，免得回调总在等采样。 */
const PROGRESS_POLL_MS = 1000

/**
 * curl 的低速中断退出码。
 *
 * curl 用 28 同时表示「操作超时」和「低速中断」，分不开 —— 对调用方来说这没关系：
 * 两者都该换个地址重试。
 */
const CURL_EXIT_TIMEOUT = 28

/** curl 的 HTTP 错误退出码（配合 `--fail` 时，4xx/5xx 走这个）。 */
const CURL_EXIT_HTTP_ERROR = 22

/** wget 的服务器返回错误退出码（含 4xx/5xx）。 */
const WGET_EXIT_SERVER_ERROR = 8

/** wget 的网络失败退出码。 */
const WGET_EXIT_NETWORK_FAILURE = 4

export interface ExternalDownloadOptions {
  /** 下载地址 */
  url: string
  /** 落盘路径 */
  filepath: string
  /** 要带上的请求头 */
  headers?: AxiosRequestConfig['headers']
  /** 代理配置，`false` 表示不走代理 */
  proxy?: AxiosProxyConfig | false
  /** 单次连接的超时（建连阶段），毫秒 */
  connectTimeoutMs?: number
  /**
   * 低速中断：连续 `slowSustainMs` 毫秒低于这个字节/秒就中断。0 表示不启用。
   *
   * 两个工具都生效，但实现不同：curl 交给它自己的 `--speed-limit`（在 C 代码里判，
   * 判到了以退出码 28 结束），wget 没有等价物，由本模块轮询文件体积自己盯。
   */
  slowFloorBytesPerSecond?: number
  /** 低速判定的持续窗口，毫秒 */
  slowSustainMs?: number
  /** 限速，字节/秒。0 表示不限 */
  maxSpeedBytesPerSecond?: number
  /**
   * 文件总字节数，调用方 Range 探测的产物。未知时给 -1 或不填。
   *
   * 两个用处：进度回调能报出真实总量（外部下载靠轮询文件体积拿进度，自己量不出总量），
   * 以及让 wget 那条路的低速看守做「快下完了就别掐」的豁免。
   */
  totalBytes?: number
  /** 断点续传：目标文件已存在时接着下 */
  resume?: boolean
  /** 进度回调，签名和内建下载一致 */
  onProgress?: (downloadedBytes: number, totalBytes: number, isLiveStream: boolean) => void
  /** 外部取消信号 */
  signal?: AbortSignal
}

/** 外部工具失败时抛出的错误，带上足够的信息让上层决定要不要换地址。 */
export interface ExternalDownloadError extends Error {
  code: string
  /** 工具的退出码 */
  exitCode: number | null
  /** 从工具输出里解析出的 HTTP 状态码，解析不到时 undefined */
  status?: number
  /** 是不是低速/超时中断 */
  slow: boolean
  /** stderr 的尾部，用于日志 */
  stderr: string
}

/**
 * 系统上有没有这个工具。结果缓存在进程内。
 *
 * 用 `--version` 而不是 `which` / `where`：后者在 Windows 与各发行版上的行为和退出码
 * 都不一样，而 `--version` 是工具自己的行为，两个工具都支持。
 *
 * @param tool 工具名
 */
export const isToolAvailable = async (tool: ExternalToolName): Promise<boolean> => {
  const cached = availability.get(tool)
  if (cached !== undefined) return cached
  const found = await execFileAsync(tool, ['--version'], { timeout: 5000, windowsHide: true })
    .then(() => true)
    .catch(() => false)
  availability.set(tool, found)
  return found
}

/**
 * 把配置里的工具选择解析成实际要用的工具。
 *
 * `auto` 优先 curl：它的 `--speed-limit` 正是我们最想要的能力，而 wget 没有等价物。
 * 都不可用时返回 `builtin`，让调用方走内建下载 —— 静默回落是对的，
 * 用户装没装 curl 不该决定一次解析成不成功。
 *
 * @param configured 配置里的值
 */
export const resolveDownloadTool = async (
  configured: unknown
): Promise<ExternalToolName | 'builtin'> => {
  const wanted = typeof configured === 'string' ? configured.trim().toLowerCase() : 'builtin'
  if (wanted === 'curl' || wanted === 'wget') {
    if (await isToolAvailable(wanted)) return wanted
    logger.warn(`[下载] 配置指定用 ${wanted} 下载，但系统上找不到它，本次回落内建下载`)
    return 'builtin'
  }
  if (wanted === 'auto') {
    if (await isToolAvailable('curl')) return 'curl'
    if (await isToolAvailable('wget')) return 'wget'
    logger.debug('[下载] 自动挡没探测到 curl / wget，使用内建下载')
    return 'builtin'
  }
  return 'builtin'
}

/** 请求头拍平成 `Name: value` 数组。数组值按 HTTP 语义拆成多行同名头。 */
const flattenHeaders = (headers: AxiosRequestConfig['headers']): string[] => {
  if (!isRecord(headers)) return []
  const lines: string[] = []
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || value === null) continue
    // 空 Cookie 是本仓库表达「这次别带 ck」的方式（见 bilibili 的 streamHeaders）。
    // 传 `Cookie: ` 给 curl 反而会发一个空头出去，所以直接跳过。
    if (value === '') continue
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === undefined || item === null || item === '') continue
      lines.push(`${name}: ${String(item)}`)
    }
  }
  return lines
}

/** 代理配置拼成 `protocol://[user:pass@]host:port`。 */
const formatProxy = (proxy: AxiosProxyConfig | false | undefined): string | null => {
  if (!proxy || !proxy.host) return null
  const protocol = proxy.protocol || 'http'
  const auth = proxy.auth?.username
    ? `${encodeURIComponent(proxy.auth.username)}:${encodeURIComponent(proxy.auth.password ?? '')}@`
    : ''
  return `${protocol}://${auth}${proxy.host}${proxy.port ? `:${proxy.port}` : ''}`
}

const buildCurlArgs = (options: ExternalDownloadOptions, resume: boolean): string[] => {
  const args = [
    '--location',
    // --fail 让 4xx/5xx 以退出码 22 结束，而不是把错误页写进目标文件。
    // 没有它的话「下载成功但文件是一段 HTML」这种最难查的故障就会出现。
    '--fail',
    '--silent',
    '--show-error',
    '--max-redirs', '5',
    // 明确要求不压缩：本仓库的内建下载也发 `Accept-Encoding: identity`，
    // 保持一致才能让两条路下出来的字节数可比。
    '--header', 'Accept-Encoding: identity',
    '--output', options.filepath
  ]

  const connectTimeout = Math.max(1, Math.round((options.connectTimeoutMs ?? 30000) / 1000))
  args.push('--connect-timeout', String(connectTimeout))

  // 刻意不设 --max-time：那是整次传输的上限，大文件在慢网络上会被它拦腰砍断。
  // 「慢到没意义」这件事交给 --speed-limit 判，它判的是速率而不是总时长。
  const floor = Math.round(options.slowFloorBytesPerSecond ?? 0)
  if (floor > 0) {
    const sustain = Math.max(1, Math.round((options.slowSustainMs ?? 20000) / 1000))
    args.push('--speed-limit', String(floor), '--speed-time', String(sustain))
  }

  const maxSpeed = Math.round(options.maxSpeedBytesPerSecond ?? 0)
  if (maxSpeed > 0) args.push('--limit-rate', String(maxSpeed))

  if (resume) args.push('--continue-at', '-')

  for (const header of flattenHeaders(options.headers)) args.push('--header', header)

  const proxy = formatProxy(options.proxy)
  if (proxy) args.push('--proxy', proxy)

  args.push('--', options.url)
  return args
}

const buildWgetArgs = (options: ExternalDownloadOptions, resume: boolean): string[] => {
  const args = [
    '--quiet',
    '--max-redirect', '5',
    '--tries', '1',
    '--header', 'Accept-Encoding: identity',
    '--output-document', options.filepath
  ]

  const connectTimeout = Math.max(1, Math.round((options.connectTimeoutMs ?? 30000) / 1000))
  args.push('--connect-timeout', String(connectTimeout))
  // wget 没有 curl 那种「按速率中断」的能力，只有「多久没读到东西就算超时」。
  // 拿它当低速看守用是错的（限速时数据一直在来），所以这里只用它兜断流，
  // 低速判定仍由 Node 侧的看守负责。
  args.push('--read-timeout', '60')

  const maxSpeed = Math.round(options.maxSpeedBytesPerSecond ?? 0)
  if (maxSpeed > 0) args.push(`--limit-rate=${maxSpeed}`)

  if (resume) args.push('--continue')

  for (const header of flattenHeaders(options.headers)) args.push('--header', header)

  const proxy = formatProxy(options.proxy)
  if (proxy) {
    args.push('--execute', 'use_proxy=yes')
    args.push('--execute', `http_proxy=${proxy}`)
    args.push('--execute', `https_proxy=${proxy}`)
  }

  args.push('--', options.url)
  return args
}

/**
 * 从工具的 stderr 里捞 HTTP 状态码。
 *
 * curl `--fail` 的文案是 `curl: (22) The requested URL returned error: 403`，
 * wget 是 `ERROR 403: Forbidden.`。两个都匹配得到就够上层分类了；
 * 捞不到时返回 undefined，由退出码决定性质。
 */
const parseStatus = (stderr: string): number | undefined => {
  const match = stderr.match(/(?:returned error:?|ERROR)\s+(\d{3})/i)
  const status = match?.[1] ? Number(match[1]) : Number.NaN
  return Number.isFinite(status) ? status : undefined
}

const createError = (
  tool: ExternalToolName,
  exitCode: number | null,
  stderr: string
): ExternalDownloadError => {
  const status = parseStatus(stderr)
  const slow = tool === 'curl'
    ? exitCode === CURL_EXIT_TIMEOUT
    : exitCode === WGET_EXIT_NETWORK_FAILURE
  const detail = stderr.trim().split('\n').slice(-3).join(' ').slice(0, 300)
  const error = new Error(
    `${tool} 下载失败（退出码 ${exitCode ?? '未知'}${status ? `, HTTP ${status}` : ''}）${detail ? `: ${detail}` : ''}`
  )
  return Object.assign(error, {
    code: slow ? 'KKK_EXTERNAL_DOWNLOAD_SLOW' : 'KKK_EXTERNAL_DOWNLOAD_FAILED',
    exitCode,
    status,
    slow,
    stderr: detail
  })
}

/**
 * 这次外部下载失败该不该换个 CDN 地址。
 *
 * 判定口径刻意和 `CdnRegistry.classifyCdnFailure` 对齐：能确证是「这个节点的问题」
 * 才换。拿不到状态码时只有低速/网络失败算，退出码本身不足以说明是节点问题。
 *
 * @param error 外部下载抛出的错误
 */
export const isRetryableExternalFailure = (error: unknown): boolean => {
  if (!isRecord(error)) return false
  if (error.slow === true) return true
  const status = typeof error.status === 'number' ? error.status : undefined
  if (status !== undefined) return status === 401 || status === 403 || status === 404 || status === 410
  const exitCode = typeof error.exitCode === 'number' ? error.exitCode : undefined
  return exitCode === CURL_EXIT_HTTP_ERROR || exitCode === WGET_EXIT_SERVER_ERROR
}

/**
 * 跑一次外部工具下载。
 *
 * 成功时返回落盘路径与实际字节数（`fs.stat` 量的，不是工具自报的）。
 * 失败时抛 {@link ExternalDownloadError}。
 *
 * @param tool 用哪个工具
 * @param options 下载参数
 */
export const downloadWithTool = async (
  tool: ExternalToolName,
  options: ExternalDownloadOptions
): Promise<FileInfo> => {
  await fs.promises.mkdir(path.dirname(options.filepath), { recursive: true })

  const resume = Boolean(options.resume) && await fs.promises.access(options.filepath).then(() => true, () => false)
  const args = tool === 'curl' ? buildCurlArgs(options, resume) : buildWgetArgs(options, resume)

  logger.debug(`[下载] 调用 ${tool} 下载${resume ? '（断点续传）' : ''}: ${options.url}`)

  return await new Promise<FileInfo>((resolve, reject) => {
    const child = spawn(tool, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    let settled = false
    let poller: NodeJS.Timeout | undefined
    // 低速看守掐掉子进程时留下的错误。必须留这么一份引用：SIGTERM 之后 wget
    // 是以「被信号打断」的非零码退出的，光看退出码只能报一个泛泛的失败，
    // 说不出「是我们判它太慢才掐的」。
    let slowAbort: (Error & { slow: true }) | undefined

    const cleanup = (): void => {
      if (poller) clearInterval(poller)
      options.signal?.removeEventListener('abort', onAbort)
    }

    function onAbort (): void {
      // SIGTERM 而不是 SIGKILL：让工具有机会把已写的字节 flush 到盘上，
      // 下一次重试才能真的断点续传。
      child.kill('SIGTERM')
    }

    if (options.signal) {
      if (options.signal.aborted) {
        child.kill('SIGTERM')
      } else {
        options.signal.addEventListener('abort', onAbort, { once: true })
      }
    }

    child.stderr?.on('data', (chunk: Buffer) => {
      // 只留尾部：某些失败下 curl 会刷很多行，无上限地攒会把内存和日志都撑坏
      stderr = (stderr + chunk.toString()).slice(-4096)
    })

    // wget 那条路的低速看守。curl 不需要：它的 --speed-limit 在 C 代码里判，
    // 判到了自己以退出码 28 结束。wget 没有等价物（--read-timeout 只兜断流），
    // 所以那条路得由我们自己盯 —— 不盯的话选了 wget 就等于把限速重下整个关掉，
    // 而那正是引入外部下载器要解决的毛病之一。
    const floor = Math.round(options.slowFloorBytesPerSecond ?? 0)
    const slowGuard = tool === 'wget' && floor > 0
      ? createSlowSpeedGuard({ floorBytesPerSecond: floor, sustainMs: options.slowSustainMs })
      : undefined
    slowGuard?.reset(Date.now())

    // 采样和进度共用这一次 stat：两边要的都是「现在落盘多少字节」，
    // 各轮询一遍等于把同一个系统调用做两次。
    if (options.onProgress || slowGuard) {
      poller = setInterval(() => {
        fs.promises.stat(options.filepath).then(
          stats => {
            const total = options.totalBytes !== undefined && options.totalBytes > 0 ? options.totalBytes : -1
            options.onProgress?.(stats.size, total, false)
            if (!slowGuard) return
            const verdict = slowGuard.sample({ downloadedBytes: stats.size, totalBytes: total, now: Date.now() })
            if (!verdict.triggered) return
            slowAbort = Object.assign(
              createSlowDownloadError(verdict.bytesPerSecond, floor),
              // 补上 ExternalDownloadError 的形状，好让上层那套「要不要换地址」的判定
              // 对两个工具用同一个口径（`isRetryableExternalFailure` 读的是 `slow`）。
              { exitCode: null, slow: true as const, stderr: '' }
            )
            logger.warn(`[下载] ${slowAbort.message}，掐掉 wget 重来并换一个地址`)
            child.kill('SIGTERM')
          },
          () => {}
        )
      }, PROGRESS_POLL_MS)
    }

    child.once('error', (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      // spawn 本身失败（ENOENT 之类）说明这个工具其实不可用，
      // 把探测缓存打掉，后续调用会重新探测并回落内建。
      availability.delete(tool)
      reject(Object.assign(error, { code: 'KKK_EXTERNAL_DOWNLOAD_SPAWN_FAILED', exitCode: null, slow: false, stderr }))
    })

    child.once('close', (exitCode: number | null) => {
      if (settled) return
      settled = true
      cleanup()
      // 我们自己掐的要认领自己那份错误，别被退出码盖成一个泛泛的「wget 失败了」。
      // 放在退出码判定之前：掐掉之后退出码一定非零，反过来就永远走不到这里。
      if (slowAbort) {
        reject(slowAbort)
        return
      }
      if (exitCode !== 0) {
        reject(createError(tool, exitCode, stderr))
        return
      }
      fs.promises.stat(options.filepath).then(
        stats => {
          if (stats.size <= 0) {
            reject(createError(tool, exitCode, `${stderr}\n目标文件为空`))
            return
          }
          options.onProgress?.(stats.size, stats.size, false)
          resolve({ filepath: options.filepath, totalBytes: stats.size })
        },
        (error: unknown) => reject(error)
      )
    })
  })
}

/** 清掉工具探测缓存。测试用。 */
export const resetToolAvailability = (): void => {
  availability.clear()
}

/** 覆盖工具探测结果。测试用，免得单测依赖跑测机器上装没装 curl。 */
export const setToolAvailability = (tool: ExternalToolName, available: boolean): void => {
  availability.set(tool, available)
}
