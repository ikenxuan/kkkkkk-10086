import { createRequire } from 'node:module'
import type {
  BilibiliFetcher,
  DouyinFetcher,
  KuaishouFetcher,
  Result,
  XiaohongshuFetcher
} from '@ikenxuan/amagi'
import type { ProxyAuth } from '@/types/config'
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
/**
 * -352 到达时把信封的**键名**记下来（不记值，里面有 cookie 指纹一类东西）。
 *
 * 放在这里而不是 riskControl：那个策略的 `match` 要求 `readRiskVoucher(error)` 非空，
 * 没有 voucher 的 -352 根本进不到它的 `handle`（`ErrorHandler/handler.ts:33` 直接 continue），
 * 日志写在里面等于永远不执行。而实测的 -352 响应体只有 `{code, message, ttl}`、
 * 没有 `data` —— 也就是说「取不到 voucher」才是常态，正是这条日志要留证的情形。
 */
const logRiskControlShape = (result: Extract<Result<unknown>, { success: false }>): void => {
  if (result.code !== -352) return
  try {
    const keysOf = (value: unknown): string =>
      isRecord(value) ? Object.keys(value).join(',') || '(空对象)' : String(value)
    logger.warn(
      `[amagi] -352 风控信封形状: data={${keysOf(result.data)}} error={${keysOf(result.error)}}`
    )
  } catch {
    // 宿主没注入 logger 时（单测、或加载早期）不能让留证把错误本身带崩：
    // 已有用例「白名单外的 -352 继续抛 AmagiError」正是在无 logger 下跑的
  }
}

const toAmagiError = (result: Extract<Result<unknown>, { success: false }>): AmagiError => {
  logRiskControlShape(result)
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

/**
 * 传给 amagi fetcher 的请求配置。
 *
 * `auth` 写 `ProxyAuth` 而不是 `unknown`：amagi 的 `RequestConfig` 是
 * `Omit<AxiosRequestConfig, …>`，`unknown` 过不了 `AxiosProxyConfig.auth` 的赋值检查，
 * 于是每个调用点都是 TS2769。旧的 `api.ts` 看不出来是因为它把 fetcher 收窄成了本地类型。
 */
export interface AmagiRequestConfig {
  timeout: number
  headers: Record<string, string>
  proxy: false | {
    host: string
    port: number
    protocol: string
    auth: ProxyAuth
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

interface AmagiModule {
  bilibiliFetcher: BilibiliFetcher
  douyinFetcher: DouyinFetcher
  kuaishouFetcher: KuaishouFetcher
  xiaohongshuFetcher: XiaohongshuFetcher
  /** 抖音二次验证方式判定。纯函数，不在 fetcher 接口上 */
  isSmsCodeVerifyWay: (typeof import('@ikenxuan/amagi'))['isSmsCodeVerifyWay']
}

const require = createRequire(import.meta.url)
let amagiModule: AmagiModule | undefined

/** amagi 的 package exports 在 Vite 下解析失败，沿用 api.ts 的 CommonJS 兜底 */
const loadAmagiModule = (): AmagiModule => {
  amagiModule ??= require('@ikenxuan/amagi') as AmagiModule
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

/**
 * 抖音二次验证的方式判定。
 *
 * 四个 passport 取数方法都在 `douyinFetcher` 上（因此天然过 {@link wrapAmagiClient}，
 * 失败统一抛 `AmagiError`），只有这个纯函数是模块级裸导出。
 *
 * 仍然从这里转口而不是让调用点直接 `import { isSmsCodeVerifyWay } from '@ikenxuan/amagi'`：
 * 那样写会让任何 import 到调用点的单测在 **Vite 解析阶段**就失败 —— amagi 的 exports map
 * 里 `development` 条件指向未发布的 `src/index.ts`，`vi.mock` 都来不及生效（实测
 * `packageEntryFailure`）。走这里则沿用 `loadAmagiModule` 的 CommonJS 兜底，且首次调用
 * 才真的 require。
 * @param verifyWay 服务端下发的 verify_way
 */
export const isSmsCodeVerifyWay = (verifyWay: string): boolean =>
  loadAmagiModule().isSmsCodeVerifyWay(verifyWay)
