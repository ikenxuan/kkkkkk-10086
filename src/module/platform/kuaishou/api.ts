import { createRequire } from 'node:module'
import type { KuaishouMethodToFetcher as KuaishouMethodToFetcherType } from '@ikenxuan/amagi'
import Config from '@/module/utils/Config'
import { buildUserAgentHeader } from '@/module/platform/common/userAgent'
import { SOFT_ERROR_CODES, softFetch } from '@/module/platform/common/softError'
import { DEFAULT_REQUEST_TIMEOUT_MS, runWithRequestGuard } from '@/module/utils/RequestGuard'

/** 旧版 amagi v5 使用的中文方法名 */
export type KuaishouMethodName = keyof typeof KuaishouMethodToFetcherType

/**
 * 没配 `Config.cookies.kuaishou` 时用的游客 ck。
 *
 * **不能删**：amagi 6.5.0 的 `getKuaishouDefaultConfig` 只做
 * `Cookie: cookie?.trim() ?? ''`（`dist/default/index.cjs:2241`），**没有**自己的游客兜底。
 * 而快手 GraphQL 在完全不带 Cookie 时会返回空响应，amagi 随后把它归一成
 * `INVALID_COOKIE`（`dist/default/index.cjs:6791` 起），于是没配 ck 的用户会直接坏掉。
 *
 * 这串值沿用迁移前 `getdata.ts` 里的那份（`kpn=KUAISHOU_VISION` 是快手 web 端必需的
 * 产品标识），迁移只是把它从「手工拼请求头」搬到「交给 amagi 的 cookie 参数」。
 */
const KUAISHOU_GUEST_COOKIE =
  'did=web_50424132d556424eb8fa8d27a612fda9; didv=1720860549000; kpf=PC_WEB; clientid=3; kpn=KUAISHOU_VISION'

/** amagi fetcher 方法，参数在 wrapper 边界收窄 */
type KuaishouFetcherMethod = (
  options: Record<string, unknown>,
  cookie: string,
  requestConfig: KuaishouRequestConfig
) => Promise<unknown>

/** 传给 fetcher 的请求配置 */
export interface KuaishouRequestConfig {
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
export interface KuaishouApiDependencies {
  methodMap: Record<string, string | undefined>
  fetcher: Record<string, KuaishouFetcherMethod | undefined>
}

interface AmagiKuaishouModule {
  KuaishouMethodToFetcher: Record<string, string | undefined>
  kuaishouFetcher: Record<string, KuaishouFetcherMethod | undefined>
}

const require = createRequire(import.meta.url)
let defaultDependencies: KuaishouApiDependencies | undefined

/** amagi 的 package exports 在 Vite 下解析失败，沿用现有平台 wrapper 的 CommonJS 兜底 */
const getDefaultDependencies = (): KuaishouApiDependencies => {
  if (!defaultDependencies) {
    const amagi = require('@ikenxuan/amagi') as AmagiKuaishouModule
    defaultDependencies = {
      methodMap: amagi.KuaishouMethodToFetcher,
      fetcher: amagi.kuaishouFetcher
    }
  }
  return defaultDependencies
}

const buildRequestConfig = (): KuaishouRequestConfig => ({
  timeout: Config.request?.timeout || 15000,
  // 只在配置的 UA 明确比 amagi 内置的更新时才覆盖；否则交回给 amagi。
  // 直接写 `'User-Agent': Config.request?.['User-Agent']` 有两个坑：这个 key 一旦存在就会
  // 覆盖 amagi 随版本更新的 UA，而 amagi 的 Sec-Ch-Ua 是从 UA 派生的，UA 落后会让整组
  // 客户端提示自相矛盾（B站 gaia 风控正看这个）；值为 undefined 时更糟，spread 之后
  // headers['User-Agent'] 是显式 undefined，axios 会发自己的 UA 或不带 UA。
  headers: {
    ...buildUserAgentHeader('kuaishou')
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
      cookie: arg1 || KUAISHOU_GUEST_COOKIE,
      options: arg2 || {}
    }
  }

  return {
    cookie: Config.cookies.kuaishou || KUAISHOU_GUEST_COOKIE,
    options: arg1 || {}
  }
}

/**
 * 兼容旧版中文方法名并统一通过 RequestGuard 调用 amagi v6 原始 fetcher。
 * 每次尝试都获得独立 AbortSignal，单次硬超时最多一分钟，网络错误按配置重试。
 *
 * 迁移前这三个请求是本仓库自己拼 GraphQL query 字符串、`new Networks(...).getData()`
 * POST 到 `https://www.kuaishou.com/graphql` 的，完全绕过 `RequestGuard` ——
 * 没有超时、没有重试、没有 AbortSignal，而且把快手专用请求头写进了模块级共享的
 * `baseHeaders`（连 ck 一起），污染其余三个平台的默认头。接 amagi 顺带把这些一并解决。
 *
 * @param method 旧版 amagi 使用的中文方法名
 * @param arg1 Cookie 或请求参数
 * @param arg2 当 arg1 为 Cookie 时的请求参数
 * @param dependencies 可注入的方法映射与 fetcher，缺省使用真实 amagi
 */
export const getKuaishouData = async (
  method: KuaishouMethodName | string,
  arg1?: string | Record<string, unknown>,
  arg2?: Record<string, unknown>,
  dependencies: KuaishouApiDependencies = getDefaultDependencies()
): Promise<unknown> => {
  const fetcherMethod = dependencies.methodMap[method]
  const fetcher = fetcherMethod ? dependencies.fetcher[fetcherMethod] : undefined
  if (!fetcherMethod || typeof fetcher !== 'function') {
    throw new Error(`Unsupported Kuaishou API method: ${method}`)
  }

  const { cookie, options } = normalizeArgs(arg1, arg2)
  return await softFetch(
    async () => await runWithRequestGuard(
      async signal => await fetcher(options, cookie, {
        ...buildRequestConfig(),
        signal
      }),
      {
        timeoutMs: Math.min(Config.request?.amagiTimeout ?? DEFAULT_REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS),
        maxRetries: Config.request?.amagiMaxRetries
      }
    ),
    SOFT_ERROR_CODES.kuaishou
  )
}
