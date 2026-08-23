// 从 utils 的 barrel 取 Config，而不是直连 './Config.js'：
// bilibili.ts / douyin.ts 这两个调用方本来就是从 '@/module/utils/index' 拿 Config 的，
// 走同一个入口才能保证 helper 看到的配置和调用方完全一致（单测也只 mock 了这个入口）。
// barrel 只是 `export { default as Config } from './Config.js'`，运行时是同一个单例，
// 且 utils/index 不反向依赖 platform/，不会成环。
import { Config } from '../../../module/utils/index.js';
/**
 * 评论数量的兜底值。
 *
 * 依据 `config/default_config/{douyin,bilibili,kuaishou}.yaml`：新键 `numcomment` 和各自的旧键
 * （`numcomments` / `bilibilinumcomments` / `kuaishounumcomments`）默认值全都写的 5。
 * 所以两个键都读不到时取 5，与 default_config 保持一致 —— 而不是取 0，
 * 否则用户手动删掉某个键就会静默变成「不出评论图」。
 */
const DEFAULT_COMMENT_LIMIT = 5;
/**
 * 在「新配置名」与「旧配置名」之间取有效的评论数量。
 *
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
export const resolveCommentLimit = (preferred, legacy) => preferred ?? legacy ?? DEFAULT_COMMENT_LIMIT;
/**
 * 抖音有效评论数量：新键 `douyin.numcomment` 优先，回落到旧键 `douyin.numcomments`。
 *
 * 写成函数而不是常量：`Config.douyin` 是 getter，每次访问都重新读配置，
 * 热改配置后不用重启才能生效。
 */
export const douyinCommentLimit = () => resolveCommentLimit(Config.douyin.numcomment, Config.douyin.numcomments);
/**
 * B站有效评论数量：新键 `bilibili.numcomment` 优先，回落到旧键 `bilibili.bilibilinumcomments`。
 *
 * 同上，保持 getter 的惰性读取语义。
 */
export const bilibiliCommentLimit = () => resolveCommentLimit(Config.bilibili.numcomment, Config.bilibili.bilibilinumcomments);
