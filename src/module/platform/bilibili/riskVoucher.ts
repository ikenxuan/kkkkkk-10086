import { isRecord } from '@/module/utils/record'

/**
 * B站风控（-352）voucher 的**唯一**提取口。
 *
 * 两个调用点在依赖图上离得很远：`platform/bilibili/riskControl.ts` 是 ErrorHandler
 * 策略链的一员，`utils/ErrorHandler/diagnostics.ts` 是错误卡片那句「建议」的产出处。
 * 两边必须对同一个失败对象给出同一个答案 —— 一边判「有 voucher」去发二维码、另一边
 * 判「没有」在卡片上写「没有验证码可过」，用户会同时收到两条互相打脸的消息。
 *
 * 所以这里做成一个零依赖的叶子模块，而不是让 diagnostics 去 import riskControl：
 * 后者会把 ErrorHandler 策略链、@ikenxuan/qrcode 以及 `registerErrorStrategy` 那个
 * 模块级副作用一起拉进错误卡片这条路 —— 而 diagnostics 正是被策略链调用的一方，会成环。
 */

/** 按路径读取嵌套字段，任意一层缺失时返回 undefined */
export const readPath = (value: unknown, path: string[]): unknown => {
  let current = value
  for (const key of path) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }
  return current
}

/** 读取指定路径上的非空字符串 */
export const readString = (value: unknown, path: string[]): string | undefined => {
  const found = readPath(value, path)
  return typeof found === 'string' && found ? found : undefined
}

/**
 * 候选路径是**刻意撒的网**，不是对某一条的猜测。
 *
 * -352 不能按需复现，所以真实响应体究竟把 voucher 放在哪无法确证：实测拿到的
 * -352 信封只有 `{code, message, ttl}`，`data` 压根不存在（`utils/amagiClient.ts`
 * 的 `logRiskControlShape` 就是为了在下一次遇到时留下键名）。
 *
 * 前四条覆盖 `AmagiError` 的两个字段各自嵌一层或两层 `data`
 * （`AmagiError.data` = amagi `Result.data`，`AmagiError.rawError` = `Result.error`），
 * 中间两条覆盖 amagi 把原始失败又包了一层 `error` 的形态，最后两条覆盖
 * 「voucher 直接挂在错误对象上」——`ctx.error` 在 ErrorHandler 那层不保证是
 * AmagiError，可能是某个平台原样返回的 Result。
 */
const VOUCHER_PATHS: readonly string[][] = [
  ['data', 'data', 'v_voucher'],
  ['data', 'v_voucher'],
  ['rawError', 'data', 'data', 'v_voucher'],
  ['rawError', 'data', 'v_voucher'],
  ['rawError', 'error', 'data', 'data', 'v_voucher'],
  ['rawError', 'error', 'data', 'v_voucher'],
  ['rawError', 'v_voucher'],
  ['v_voucher']
]

/**
 * @param value 一次失败：抛出来的 `AmagiError`、amagi 原样返回的失败 `Result`，或任意值
 * @returns 取到的 voucher；一条都不命中时 undefined
 */
export const readRiskVoucher = (value: unknown): string | undefined => {
  for (const path of VOUCHER_PATHS) {
    const voucher = readString(value, path)
    if (voucher) return voucher
  }
  return undefined
}
