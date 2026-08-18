import { createRequire } from 'node:module'
import type { XiaohongshuMethodToFetcher as XiaohongshuMethodToFetcherType } from '@ikenxuan/amagi'
import Config from '../../utils/Config.js'
import { DEFAULT_REQUEST_TIMEOUT_MS, runWithRequestGuard } from '../../utils/RequestGuard.js'

/** 旧版 amagi v5 使用的中文方法名 */
export type XiaohongshuMethodName = keyof typeof XiaohongshuMethodToFetcherType

/** amagi fetcher 方法，参数在 wrapper 边界收窄 */
type XiaohongshuFetcherMethod = (
  options: Record<string, unknown>,
  cookie: string,
  requestConfig: XiaohongshuRequestConfig
) => Promise<unknown>

/** 传给 fetcher 的请求配置 */
export interface XiaohongshuRequestConfig {
  timeout: number
  headers: { 'User-Agent'?: string }
  signal?: AbortSignal
  proxy: false | {
    host: string
    port: number
    protocol: string
    auth: unknown
  }
}

/** api wrapper 的可注入依赖，仅用于测试替换真实 amagi */
export interface XiaohongshuApiDependencies {
  methodMap: Record<string, string | undefined>
  fetcher: Record<string, XiaohongshuFetcherMethod | undefined>
}

interface AmagiXiaohongshuModule {
  XiaohongshuMethodToFetcher: Record<string, string | undefined>
  xiaohongshuFetcher: Record<string, XiaohongshuFetcherMethod | undefined>
}

const require = createRequire(import.meta.url)
let defaultDependencies: XiaohongshuApiDependencies | undefined

/** amagi 的 package exports 在 Vite 下解析失败，沿用现有平台 wrapper 的 CommonJS 兜底 */
const getDefaultDependencies = (): XiaohongshuApiDependencies => {
  if (!defaultDependencies) {
    const amagi = require('@ikenxuan/amagi') as AmagiXiaohongshuModule
    defaultDependencies = {
      methodMap: amagi.XiaohongshuMethodToFetcher,
      fetcher: amagi.xiaohongshuFetcher
    }
  }
  return defaultDependencies
}

const buildRequestConfig = (): XiaohongshuRequestConfig => ({
  timeout: Config.request?.timeout || 15000,
  headers: {
    'User-Agent': Config.request?.['User-Agent']
  },
  proxy: Config.request?.proxy?.switch
    ? { host: Config.request.proxy.host, port: Number(Config.request.proxy.port), protocol: Config.request.proxy.protocol, auth: Config.request.proxy.auth }
    : false
})

const normalizeArgs = (
  arg1?: string | Record<string, unknown>,
  arg2?: Record<string, unknown>
): { cookie: string, options: Record<string, unknown> } => {
  if (typeof arg1 === 'string') {
    return {
      cookie: arg1,
      options: arg2 || {}
    }
  }

  return {
    cookie: Config.cookies.xiaohongshu || '',
    options: arg1 || {}
  }
}

/**
 * 兼容旧版中文方法名并统一通过 RequestGuard 调用 amagi v6 原始 fetcher。
 * 每次尝试都获得独立 AbortSignal，单次硬超时最多一分钟，网络错误按配置重试。
 */
export const getXiaohongshuData = async (
  method: XiaohongshuMethodName | string,
  arg1?: string | Record<string, unknown>,
  arg2?: Record<string, unknown>,
  dependencies: XiaohongshuApiDependencies = getDefaultDependencies()
): Promise<unknown> => {
  const fetcherMethod = dependencies.methodMap[method]
  const fetcher = fetcherMethod ? dependencies.fetcher[fetcherMethod] : undefined
  if (!fetcherMethod || typeof fetcher !== 'function') {
    throw new Error(`Unsupported Xiaohongshu API method: ${method}`)
  }

  const { cookie, options } = normalizeArgs(arg1, arg2)
  return await runWithRequestGuard(
    async signal => await fetcher(options, cookie, {
      ...buildRequestConfig(),
      signal
    }),
    {
      timeoutMs: Math.min(Config.request?.amagiTimeout ?? DEFAULT_REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS),
      maxRetries: Config.request?.amagiMaxRetries
    }
  )
}
