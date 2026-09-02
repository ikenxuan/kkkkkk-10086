// 从 utils 的 barrel 取 Config，而不是直连 './Config.js'：
// bilibili.ts / douyin.ts 这两个调用方本来就是从 '@/module/utils/index' 拿 Config 的，
// 走同一个入口才能保证 helper 看到的配置和调用方完全一致（单测也只 mock 了这个入口）。
// barrel 只是 `export { default as Config } from './Config.js'`，运行时是同一个单例，
// 且 utils/index 不反向依赖 platform/，不会成环。
import { Config } from '@/module/utils/index'

/**
 * 依据 `config/default_config/{douyin,bilibili,kuaishou}.yaml`：新键 `numcomment` 和各自的旧键
 * （`numcomments` / `bilibilinumcomments` / `kuaishounumcomments`）默认值全都写的 5。
 * 所以两个键都读不到时取 5，与 default_config 保持一致 —— 而不是取 0，
 * 否则用户手动删掉某个键就会静默变成「不出评论图」。
 */
const DEFAULT_COMMENT_LIMIT = 5

/**
 * **为什么用 `??` 而不是 `||`**：锅巴面板把新旧两个键都注册成了 `num(..., 0, 9999, ...)`，
 * 最小值就是 0；而 B站侧一直拿「数量 > 0」当「要不要发评论图」的开关。
 * 也就是说 0 是用户选得出来、且语义明确（不发评论图）的值，不等于「没配置」。
 * 若用 `||`，用户把新键设成 0 会掉进旧键（默认 5），评论图照发 ——
 * 那正是本次要修的「面板里设了不生效」的同一类 bug。
 * 只有 null/undefined（键根本不存在）才该回落到旧键。
 *
 * @param preferred 新项目配置名 `numcomment` 的值
 * @param legacy 旧配置名的值，仅当新键为 null/undefined 时兜底
 * @returns 有效评论数量；0 表示不需要评论
 */
export const resolveCommentLimit = (
  preferred: number | undefined,
  legacy: number | undefined
): number => preferred ?? legacy ?? DEFAULT_COMMENT_LIMIT

/**
 * 写成函数而不是常量：`Config.douyin` 是 getter，每次访问都重新读配置，
 * 热改配置后不用重启才能生效。
 */
export const douyinCommentLimit = (): number =>
  resolveCommentLimit(Config.douyin.numcomment, Config.douyin.numcomments)

/**
 * 同上，保持 getter 的惰性读取语义。
 */
export const bilibiliCommentLimit = (): number =>
  resolveCommentLimit(Config.bilibili.numcomment, Config.bilibili.bilibilinumcomments)

/**
 * 同上。快手原来是在 `kuaishou/comments.ts` 里就地写 `numcomment || kuaishounumcomments || 5`，
 * 于是面板里把数量设成 0 的用户会一路掉到默认 5、评论图照发 —— 正是这个 helper
 * 存在的理由（见 {@link resolveCommentLimit} 的 `??` 说明）。
 */
export const kuaishouCommentLimit = (): number =>
  resolveCommentLimit(Config.kuaishou.numcomment, Config.kuaishou.kuaishounumcomments)
