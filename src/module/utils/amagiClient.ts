import { createRequire } from 'node:module'
import type {
  BilibiliFetcher,
  DouyinFetcher,
  KuaishouFetcher,
  Result,
  XiaohongshuFetcher
} from '@ikenxuan/amagi'
import { AmagiError } from '@/module/platform/common/softError'
import { buildSharedUserAgentHeader } from '@/module/platform/common/userAgent'
import Config from '@/module/utils/Config'
import { isRecord } from '@/module/utils/record'

/**
 * 两个都是重导出而**不是**本地新定义。
 *
 * `AmagiError` 定义第二份会让 `instanceof` 跨模块失效，而
 * `platform/bilibili/riskControl.ts` 与 `softFetch` 的白名单判定都按它 match。
 */
export { AmagiError, softFetch } from '@/module/platform/common/softError'

/** amagi 的 Result 信封：`success`(boolean) / `code` / `message` 三键同时在 */
const isResultEnvelope = (value: unknown): value is Result<unknown> =>
  isRecord(value) &&
  typeof value.success === 'boolean' &&
  'code' in value &&
  'message' in value

/**
 * 只抛，不渲染错误卡片。
 *
 * 卡片留在调用侧，因为两条投递通道不可互换：`sendMasterMessage` 从 `Config.pushlist`
 * 推 botId（无事件也能发），而 ErrorHandler 兜底走 `getBotId(ctx.event)` —— 推送路径
 * 的事件是 undefined，一张都发不出去。搬进来会让定时推送的告警彻底消失。
 */
const toAmagiError = (result: Extract<Result<unknown>, { success: false }>): AmagiError => {
  const rawError: unknown = result.error
  const amagiMessage = isRecord(rawError) && typeof rawError.amagiMessage === 'string'
    ? rawError.amagiMessage
    : ''

  // 上游把 util.inspect(..., { colors: true }) 的结果塞进 message。这里只放人读的那句：
  // message 会流进错误卡片和 SoftFailureResult，ANSI 转义在 HTML 里是一串乱码。
  return new AmagiError(result.code, result.message || amagiMessage || '请求失败', result.data, rawError)
}

/**
 * 递归代理所有嵌套对象的方法，把 `success !== true` 的信封统一抛成 {@link AmagiError}。
 *
 * 四平台统一处理，不像 `utils/Base.ts` 那样只特判两个方法名。
 * 非信封返回值原样透传。
 */
export const wrapAmagiClient = <T extends object> (client: T): T => {
  const createProxy = (target: object): object =>
    new Proxy(target, {
      get: (obj, prop) => {
        const value: unknown = (obj as Record<string | symbol, unknown>)[prop]

        if (isRecord(value)) return createProxy(value)

        if (typeof value === 'function') {
          return async (...args: unknown[]): Promise<unknown> => {
            // apply 到原始 target 而不是代理，避免方法内部的 this 调用被二次包装
            const result: unknown = await (value as (...a: unknown[]) => unknown).apply(obj, args)
            if (!isResultEnvelope(result) || result.success === true) return result
            throw toAmagiError(result)
          }
        }

        return value
      }
    })

  return createProxy(client) as T
}

/** 传给 amagi fetcher 的请求配置，形状对齐各平台 api.ts */
export interface AmagiRequestConfig {
  timeout: number
  headers: Record<string, string>
  proxy: false | {
    host: string
    port: number
    protocol: string
    auth: unknown
  }
}

/**
 * 每次调用现算，**不做模块级快照**。
 *
 * 所以不需要移植上游的 `reloadConfig` / `configSignature` /
 * `registerAmagiReloadListener` / `export let` 重绑 —— 那套是为它「client 是模块级单例、
 * 配置在构造时读一次」的形状服务的，这里没有陈旧配置可言。
 */
export const buildAmagiRequestConfig = (): AmagiRequestConfig => ({
  timeout: Config.request?.timeout || 15000,
  // 不透传 Config 的 UA。本机 request.yaml 可能锁着 Chrome/125 而 amagi 内置 bilibili 是 142，
  // 透传会把 UA 降级、Sec-Ch-Ua 跟着降 —— 那正是 B站 gaia 风控（-352）看的信号。
  // buildSharedUserAgentHeader 取四平台阈值里最高的，只有配置值比所有内置都新才敢覆盖。
  headers: { ...buildSharedUserAgentHeader() },
  proxy: Config.request?.proxy?.switch
    ? { host: Config.request.proxy.host, port: Number(Config.request.proxy.port), protocol: Config.request.proxy.protocol, auth: Config.request.proxy.auth }
    : false
})

interface AmagiFetcherModule {
  bilibiliFetcher: BilibiliFetcher
  douyinFetcher: DouyinFetcher
  kuaishouFetcher: KuaishouFetcher
  xiaohongshuFetcher: XiaohongshuFetcher
}

const require = createRequire(import.meta.url)
let amagiModule: AmagiFetcherModule | undefined

/** amagi 的 package exports 在 Vite 下解析失败，沿用 api.ts 的 CommonJS 兜底 */
const loadAmagiModule = (): AmagiFetcherModule => {
  amagiModule ??= require('@ikenxuan/amagi') as AmagiFetcherModule
  return amagiModule
}

/**
 * 首次属性访问时才 require amagi 并包装。
 * 让 `import` 这个模块不再有加载期副作用，否则任何引它的测试都会拖上 amagi 整份 dist。
 */
const lazyFetcher = <T extends object> (create: () => T): T => {
  let resolved: T | undefined
  const inner = (): Record<string | symbol, unknown> => {
    resolved ??= create()
    return resolved as Record<string | symbol, unknown>
  }

  return new Proxy({} as T, {
    get: (_target, prop) => inner()[prop],
    has: (_target, prop) => prop in inner()
  })
}

export const bilibiliFetcher = lazyFetcher(() => wrapAmagiClient(loadAmagiModule().bilibiliFetcher))

export const douyinFetcher = lazyFetcher(() => wrapAmagiClient(loadAmagiModule().douyinFetcher))

export const kuaishouFetcher = lazyFetcher(() => wrapAmagiClient(loadAmagiModule().kuaishouFetcher))

export const xiaohongshuFetcher = lazyFetcher(() => wrapAmagiClient(loadAmagiModule().xiaohongshuFetcher))
