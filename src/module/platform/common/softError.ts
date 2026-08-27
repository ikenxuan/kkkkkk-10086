import { isRecord } from '@/module/utils/record'
import type { AmagiPlatform } from './userAgent.js'

/**
 * amagi 业务失败的本地等价错误类型。
 *
 * 上游 `karin-plugin-kkk` 在 `amagiClient.ts` 里用一层递归 Proxy 把
 * `success === false` 统一抛成 `AmagiError`，所以它的调用点只需要在 catch 里读
 * `err.code`。本仓库**没有**那层 Proxy：各平台的 `api.ts` 直接调 amagi v6 的原始
 * fetcher，失败的 `Result` 是**原样返回**的（`runWithRequestGuard` 只管超时与重试，
 * 不看 `success`），只有 `utils/Base.ts` 里那个 Proxy 会在特定条件下抛。
 *
 * 于是同一个业务码在本仓库既可能是**返回值**、也可能是**抛出来的对象**
 * （`platform/bilibili/riskControl.ts` 的 `getFailureCode` 注释里记录了同一件事）。
 * 这个类只用于**软错误路径**：把一次「本该抛出、但业务上属于正常拒绝」的失败
 * 归一成可判定的形状，方便调用点降级。它不参与硬失败路径 —— 硬失败依旧原样抛，
 * 见 {@link softFetch}。
 */
export class AmagiError extends Error {
  /** 平台业务码，例如 B站 的 12061 */
  readonly code: number
  /** 失败响应里的业务数据（通常是 amagi 归一化后的 rawData） */
  readonly data: unknown
  /** amagi 的结构化错误对象，透传给错误卡片 / riskControl 复核 */
  readonly rawError: unknown

  constructor (code: number, message: string, data?: unknown, rawError?: unknown) {
    super(message)
    this.name = 'AmagiError'
    this.code = code
    this.data = data
    this.rawError = rawError
  }
}

/**
 * 「业务上的正常拒绝」错误码白名单，按平台分。
 *
 * 判定标准（主会话定的，不要放宽）：**只收能确证的码** —— 确证 = 在 amagi 的类型定义
 * 或实现、上游 `karin-plugin-kkk` 的代码、或官方/一手文档里能找到依据。社区整理但没有
 * 一手依据的写进注释、不生效。
 *
 * 理由：猜错会把真故障吞成「正常结果」，用户看到的是「解析静默没反应」，
 * 比弹一张错误卡糟得多。宁可漏放行，不要错放行。
 *
 * ---
 *
 * ## 为什么只有 B站 有码
 *
 * amagi 6.5.0 只在 B站 这条路径上把平台业务码透传到 `Result.code`：
 *
 * - B站：`dist/default/index.cjs:1465`
 *   `createErrorResponse(amagiError, errorMessage, rawData.code, rawData)` —— 第三个参数
 *   就是 B站 原始业务码。
 * - 抖音：`dist/default/index.cjs:4169`
 *   `createErrorResponse(rawData.amagiError, rawData.status_msg ?? '抖音数据获取失败')`
 * - 快手：`dist/default/index.cjs:6860`
 *   `createErrorResponse(rawData.amagiError, '快手数据获取失败')`
 * - 小红书：`dist/default/index.cjs:7246`
 *   `createErrorResponse(rawData.amagiError, '小红书数据获取失败')`
 *
 * 后三者都**没传 code 参数**，而 `createSuccessResponse` / `createErrorResponse` 的签名是
 * `(error, message, code = 500, data)`（`dist/default/index.cjs:1421`），所以它们的失败
 * `Result.code` 恒为 500 —— 500 是「这次请求失败了」，不携带任何业务语义。把 500 放进
 * 白名单等于把这三个平台的**所有**失败都当成正常拒绝，正是上面那条约束要防的事。
 *
 * 所以这三个平台的白名单是**空的**，且这不是「还没调研」，是 amagi 当前版本在
 * wrapper 边界上不具备按码区分的能力。等 amagi 补上 code 透传再回来加。
 */
export const SOFT_ERROR_CODES = {
  /**
   * ### 12061 —— UP 主已关闭评论区
   *
   * 依据：上游 `karin-plugin-kkk`
   * `packages/core/src/module/utils/amagiClient.ts:126`（注释「12061 - UP主已关闭评论区」）
   * 与 `:129`（`BILIBILI_COMMENTS_DISABLED: 12061`），并在
   * `packages/core/src/platform/bilibili/bilibili.ts:228` / `:1012` 被当作软错误放行。
   *
   * 社区侧佐证：`selinyi123/DPMS-Platform` 的 `worker/app/bilibili/errors.py:122`
   * 把 12061 标为 `(Outcome.SKIP, 'UP 主已关闭评论区')`。
   *
   * 注意：12061 **没有**出现在 bilibili-API-collect 的评论区文档里（见下面 12002 的
   * 链接），所以它的一手依据只有上游代码。上游是主会话认可的确证来源，故生效。
   *
   * ### 12002 —— 评论区已关闭
   *
   * 依据：bilibili-API-collect `docs/comment/list.md`，「获取评论区明细_懒加载」一节
   * （`https://api.bilibili.com/x/v2/reply/wbi/main`，文件第 859 行起）的根对象 `code`
   * 字段明确列出 `12002：评论区已关闭`。原仓库 `SocialSisterYi/bilibili-API-collect`
   * 已归档清空，正文现读自其镜像 `ILoveScratch2/bilibili-api-collect-new`
   * （同一份文档，第 917 行）。
   *
   * 而 `wbi/main` **正是** amagi 取评论用的那个接口
   * （`@ikenxuan/amagi@6.5.0` `dist/default/index.cjs:55`），所以这条依据是端到端对得上的，
   * 不是从别的接口的错误码表里挪过来的。
   *
   * ---
   *
   * ## 查到但**故意不生效**的码
   *
   * - **12009 评论主体的type不合法**：出现在同一张表里，但它是**调用方参数错**
   *   （`bilibili.ts` 的 `mapping_table()` 给出了错误的评论区类型），不是业务拒绝。
   *   软化它等于把我们自己的 bug 静默成「这条动态没有评论」，正好是最难查的那类问题。
   * - **-404 无此项**：同一张表里有，但 -404 在 amagi 的 `bilibiliErrorCodeMap`
   *   里已登记（`dist/default/index.cjs:8392` 起，`-404: '啥都木有'`），也就是
   *   `utils/Base.ts` 的 Proxy 已经会为它出错误卡；而且 -404 是 B站 全站通用码，
   *   软化它会连带吞掉「视频已删除」这种应该告诉用户的情况。
   * - **12022 已经被删除了 / 12035 评论黑名单 / 12051 重复评论 / 12052 评论区已关闭 /
   *   12053 黑名单用户无法互动 / 12078 需关注 UP 主 7 天以上 / 12015 需要验证码**：
   *   这些来自 `docs/comment/action.md`（发表、删除、点赞、置顶、举报评论等**写操作**）。
   *   本插件只读评论列表、从不写评论，这些码在我们调的接口上不会出现。
   *   12052 虽然文案也是「评论区已关闭」，但同样只见于写操作的表，没有读接口的依据，
   *   所以不进白名单。
   */
  bilibili: [12061, 12002],

  /**
   * 空：amagi 6.5.0 不把抖音的 `status_code` 透传到 `Result.code`
   * （`dist/default/index.cjs:4169`，失败恒为 500）。
   *
   * 候选（**未生效**，等 amagi 补 code 透传）：抖音用 `status_code` 表达业务拒绝，
   * 例如作品被设为私密 / 仅好友可见时返回非 0 的 `status_code`。但在 wrapper 这一层
   * 我们只能看到 500，无法区分它和「网络挂了」，所以现在无码可放。
   */
  douyin: [],

  /**
   * 空：amagi 6.5.0 不把快手错误透传成数字码（`dist/default/index.cjs:6860`，恒为 500），
   * 而且快手 GraphQL **本身就没有**数字业务码 —— 它用两种方式表达拒绝：
   *
   * - 响应体的 `result: 2`（amagi 在 `dist/default/index.cjs:6791` 把它归一成失败）
   * - `visionVideoDetail.status`（`!== 1` 时本插件回「不支持解析的视频」，
   *   见 `platform/kuaishou/kuaishou.ts` 的 `Action`）
   *
   * 而 amagi 的 `kuaishouAPIErrorCode` 枚举（`dist/default/index.cjs:2290`）只有两个
   * **字符串**值 `INVALID_COOKIE` / `UNKNOWN_ERROR`，两者都是故障而非业务拒绝。
   * 所以这里没有可确证的数字码。
   */
  kuaishou: [],

  /**
   * 空：amagi 6.5.0 不透传小红书的码（`dist/default/index.cjs:7246`，恒为 500）。
   *
   * 即便透传了也没有可放行的：amagi 的 `xiaohongshuAPIErrorCode` 枚举
   * （`dist/default/index.cjs:2298`）列的是 500 非法请求、300011 帐号异常、
   * 300012 网络连接异常、300013 访问频次异常、300015 浏览器异常 ——
   * **五个全是故障**，一个业务拒绝都没有。故障必须弹错误卡，不能软化。
   */
  xiaohongshu: []
} as const satisfies Record<AmagiPlatform, readonly number[]>

/** 软化后返回给调用方的失败结果，形状对齐 amagi 的 `ErrorResult` */
export interface SoftFailureResult {
  success: false
  code: number
  message: string
  data: unknown
  error: unknown
  /**
   * 软错误标记。
   *
   * amagi 自己返回的失败 `Result` 上没有这个字段，所以它能把「白名单放行的业务拒绝」
   * 和「amagi 原样返回的失败」区分开 —— 调用点据此决定是降级还是照常走错误路径。
   */
  soft: true
}

/**
 * 从一次失败（返回值或抛出的对象都行）里取出业务码。
 *
 * 读取层级已按 amagi 源码核对：`createErrorResponse(error, message, code, data)`
 * 把业务码放在**顶层** `code`；`error.code` 是 `APIErrorType` 上的同名字段，作为第二顺位；
 * `rawError.code` 覆盖 {@link AmagiError} 与 `utils/Base.ts` 自造错误对象那条路径。
 *
 * 与 `platform/bilibili/riskControl.ts` 的 `getFailureCode` 是**有意平行**的两份实现：
 * 那边服务于风控验证码流程、要认 amagi 枚举里的字符串字面量码；这边只服务于软错误判定。
 * 合并成一份会让任一侧的口径变化牵动另一侧，而两者的失败面完全不同。
 *
 * @param value 失败的 `Result`、抛出的错误对象，或任意值
 * @returns 归一成数字的业务码；取不到时 undefined
 */
export const readAmagiFailureCode = (value: unknown): number | undefined => {
  if (!isRecord(value)) return undefined

  const nested = isRecord(value.error) ? value.error.code : undefined
  const raw = isRecord(value.rawError) ? value.rawError.code : undefined
  const code = value.code ?? nested ?? raw

  // 枚举里的码是字符串字面量（例如 CSRF_ERROR = '-111'），响应里的是数字，两种都归一
  const numeric = typeof code === 'string' ? Number(code) : code
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return undefined
  return numeric
}

/**
 * 判断一个**返回值**是不是白名单内的软失败。
 *
 * 为什么需要它：amagi 表达业务拒绝的主要方式是**返回**失败 `Result`，而不是抛异常
 * （见 {@link AmagiError} 的说明）。{@link softFetch} 只能软化「抛出来」的那一半，
 * 剩下的一半要靠调用点自己判定 —— 就是这个函数。
 *
 * @param value `getBilibiliData` 之类 wrapper 的返回值
 * @param allowedCodes 该平台的白名单，取自 {@link SOFT_ERROR_CODES}
 * @returns 是白名单内的业务拒绝时为 true
 */
export const isSoftFailure = (value: unknown, allowedCodes: readonly number[]): boolean => {
  if (!isRecord(value) || value.success !== false) return false
  const code = readAmagiFailureCode(value)
  return code !== undefined && allowedCodes.includes(code)
}

/** 把一次抛出来的软失败归一成 {@link SoftFailureResult} */
const toSoftFailureResult = (code: number, error: unknown): SoftFailureResult => {
  const record = isRecord(error) ? error : undefined
  const message = error instanceof Error
    ? error.message
    : typeof record?.message === 'string' ? record.message : '业务拒绝'

  return {
    success: false,
    code,
    message,
    data: record?.data,
    error: record?.error ?? record?.rawError ?? record?.amagiError ?? error,
    soft: true
  }
}

/**
 * 在 amagi wrapper 边界上放行「业务上的正常拒绝」。
 *
 * 白名单内的码不抛，改成 {@link SoftFailureResult} 返回，让调用点优雅降级
 * （例：B站 12061 —— UP 主关了评论区，那就只是没有评论，不该弹错误卡）。
 * 白名单外的一切**原样抛出**，包括：
 *
 * - `RequestTimeoutError` / `AbortError`：它们的 `code` 不是数字，取不到码就直接重抛，
 *   身份不变 —— `utils/RequestGuard.ts` 的重试判定和现有测试都依赖这个身份。
 * - 带数字码但不在白名单里的失败：也**不**转成 {@link AmagiError}。
 *   转类型会打掉 `platform/bilibili/riskControl.ts` 与 `utils/Base.ts` 里那些按
 *   鸭子类型读 `code` / `rawError` / `amagiError` 的路径，而它们正是错误卡和
 *   风控验证码流程的入口。软错误设施只该**放行**，不该重塑硬失败。
 *
 * @param fn 真正发请求的 thunk，通常是 `() => runWithRequestGuard(...)`
 * @param allowedCodes 该平台的白名单，取自 {@link SOFT_ERROR_CODES}
 */
export const softFetch = async <T> (
  fn: () => Promise<T>,
  allowedCodes: readonly number[]
): Promise<T | SoftFailureResult> => {
  try {
    return await fn()
  } catch (error: unknown) {
    const code = readAmagiFailureCode(error)
    if (code === undefined || !allowedCodes.includes(code)) throw error
    return toSoftFailureResult(code, error)
  }
}
