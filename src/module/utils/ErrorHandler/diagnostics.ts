import Version from '@/module/utils/Version'
import { isRecord } from '@/module/utils/record'

/**
 * 把栈帧里的绝对路径压成相对路径。
 *
 * 错误卡片会直接回到群里，绝对路径会连带把服务器的目录结构和系统用户名
 * （`C:/Users/某人/...`）一起贴出去。只保留插件目录以内的相对位置，定位能力不受影响。
 *
 * 住在 ErrorHandler 而不是 Base.ts：两条出卡路径都要用它，而 Base.ts 本来就在
 * import ErrorHandler 里的东西，反向依赖会成环。
 */
export const scrubStackPaths = (stack: string): string => {
  // 两边都先归一成正斜杠再比：Windows 上 `Version.pluginPath` 带的是反斜杠，
  // 而栈已经被归一化过，不统一的话 replaceAll 一个都匹配不上、清洗静默失效。
  const pluginPath = Version.pluginPath?.replace(/\\/g, '/')
  if (!pluginPath) return stack
  const yunzaiRoot = pluginPath.replace(/\/plugins\/[^/]+$/, '')
  const normalized = stack.replace(/\\/g, '/').replaceAll(pluginPath, '.')
  return yunzaiRoot && yunzaiRoot !== pluginPath
    ? normalized.replaceAll(yunzaiRoot, '<yunzai>')
    : normalized
}

/** 只认字符串 / 数字，其余（对象、null、undefined）一律当空 —— 别让 `[object Object]` 印到卡片上 */
const asText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''

/** 按顺序取第一个能印在卡片上的值 */
export const pick = (...values: unknown[]): string => values.map(asText).find(Boolean) || ''

/** 纯限流/反爬类的业务码：没有交互式恢复动作，用户唯一能做的就是等 */
const THROTTLED_CODES: Readonly<Record<string, readonly number[]>> = {
  bilibili: [-412, -509, -799]
}

/**
 * 认得出来的失败给一句人话。
 *
 * 起因是 amagi 把抖音失败的 `code` 恒写成 500、`data` 与 `rawError` 都是 undefined，
 * 卡片上除了「抖音数据获取失败」什么都没有；而 B站 的 -412 又常被当成 -352 的同类，
 * 可它没有 voucher、也没有验证码可过（riskControl 只认 -352）。
 *
 * 认不出来就返回空串，由调用方 filter 掉 —— 猜一句比不说更糟。
 */
const resolveFailureAdvice = (platform: string, code: string, inner: Record<string, unknown>): string => {
  const numeric = Number(code)
  if (THROTTLED_CODES[platform]?.includes(numeric)) {
    return '当前出口 IP 被服务端风控，没有验证码可过，等一会儿再试；反复触发就得换出口或配代理'
  }
  // amagi 对抖音失败一律折叠成 500，且这时候 rawError 是空的：真实业务码在 api:error
  // 事件里（见 amagiClient 的 ensureAmagiEventBridge），卡片这边只能如实说不知道
  if (platform === 'douyin' && numeric === 500 && Object.keys(inner).length === 0) {
    return '接口没有返回可用原因，通常是接口侧临时拒答，稍后再试'
  }
  return ''
}

/**
 * 把 amagi 的结构化报错字段整理成键值对，供模板的故障详情区独立展示。
 *
 * 两条出卡路径共用：`Base.ts` 的 `buildApiErrorImage`（无事件的推送路径）和
 * `render.ts` 的 `renderErrorReport`（业务路径）。后者原来一个诊断字段都没有 ——
 * `normalizeError` 只读 name / message / stack，`AmagiError` 上的 code / data / rawError
 * 全丢，而抖音与 B站 唯一有定位价值的 `requestUrl`、`errorDescription` 只活在这里。
 *
 * @param platform 平台名，用来选那句建议
 * @param method 接口方法名。业务路径给不出（它只有 businessName），留空即不渲染这一行
 * @param error 抛出来的 `AmagiError`，或任意对象
 */
export const collectApiDiagnostics = (
  platform: string,
  method: string | undefined,
  error: unknown
): Array<{ label: string, value: string }> => {
  const record = isRecord(error) ? error : {}
  // amagi 把结构化字段放 `error`（信封）或 `rawError`（AmagiError），两种都认
  const inner = isRecord(record.rawError)
    ? record.rawError
    : isRecord(record.error)
      ? record.error
      : isRecord(record.data)
        ? record.data
        : {}
  const code = pick(record.code, inner.code, inner.errorCode, inner.responseCode)

  return [
    { label: '平台', value: platform },
    { label: '接口', value: method ?? '' },
    { label: '业务码', value: code },
    { label: '请求类型', value: pick(inner.requestType, inner.request_type) },
    { label: '错误描述', value: pick(inner.errorDescription, inner.amagiMessage) },
    { label: '接口地址', value: pick(inner.requestUrl, inner.request_url) },
    { label: '建议', value: resolveFailureAdvice(platform, code, inner) }
  ].filter(item => item.value !== '')
}
