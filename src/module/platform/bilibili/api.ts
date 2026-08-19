import { createRequire } from 'node:module'
import type { BilibiliMethodToFetcher as BilibiliMethodToFetcherType } from '@ikenxuan/amagi'
import Config from '@/module/utils/Config'
import { DEFAULT_REQUEST_TIMEOUT_MS, runWithRequestGuard } from '@/module/utils/RequestGuard'

/** 旧版 amagi v5 使用的中文方法名 */
export type BilibiliMethodName = keyof typeof BilibiliMethodToFetcherType

/** amagi fetcher 方法，参数在 wrapper 边界收窄 */
type BilibiliFetcherMethod = (
  options: Record<string, unknown>,
  cookie: string,
  requestConfig: BilibiliRequestConfig
) => Promise<unknown>

/** 传给 fetcher 的请求配置 */
export interface BilibiliRequestConfig {
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
export interface BilibiliApiDependencies {
  /** amagi v6 的中文方法名解析函数 */
  getEnglishMethodName: (platform: string, method: string) => string | undefined
  /** 解析失败时回退使用的静态映射表 */
  methodMap: Record<string, string | undefined>
  fetcher: Record<string, BilibiliFetcherMethod | undefined>
}

interface AmagiBilibiliModule {
  BilibiliMethodToFetcher: Record<string, string | undefined>
  bilibiliFetcher: Record<string, BilibiliFetcherMethod | undefined>
  getEnglishMethodName: (platform: string, method: string) => string | undefined
}

const require = createRequire(import.meta.url)
let defaultDependencies: BilibiliApiDependencies | undefined

/** amagi 的 package exports 在 Vite 下解析失败，沿用 Base.ts 的 CommonJS 兜底 */
const getDefaultDependencies = (): BilibiliApiDependencies => {
  if (!defaultDependencies) {
    const amagi = require('@ikenxuan/amagi') as AmagiBilibiliModule
    defaultDependencies = {
      getEnglishMethodName: amagi.getEnglishMethodName,
      methodMap: amagi.BilibiliMethodToFetcher,
      fetcher: amagi.bilibiliFetcher
    }
  }
  return defaultDependencies
}

const buildRequestConfig = (): BilibiliRequestConfig => ({
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
    cookie: Config.cookies.bilibili || '',
    options: arg1 || {}
  }
}

/**
 * 兼容已移除的 amagi v5 `getBilibiliData` API。
 * 插件内部保留旧调用形态，内部改为分发到 v6 fetcher 方法。
 *
 * @param method 旧版 amagi 使用的中文方法名
 * @param arg1 Cookie 或请求参数
 * @param arg2 当 arg1 为 Cookie 时的请求参数
 * @param dependencies 可注入的方法解析、映射与 fetcher，缺省使用真实 amagi
 */
export const getBilibiliData = async (
  method: BilibiliMethodName | string,
  arg1?: string | Record<string, unknown>,
  arg2?: Record<string, unknown>,
  dependencies: BilibiliApiDependencies = getDefaultDependencies()
): Promise<unknown> => {
  const fetcherMethod = dependencies.getEnglishMethodName('bilibili', method) || dependencies.methodMap[method]
  const fetcher = fetcherMethod ? dependencies.fetcher[fetcherMethod] : undefined
  if (!fetcherMethod || typeof fetcher !== 'function') {
    throw new Error(`Unsupported Bilibili API method: ${method}`)
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
