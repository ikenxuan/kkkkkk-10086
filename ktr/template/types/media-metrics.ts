/**
 * 媒体度量的模板视图，statistics/group 与 statistics/global 共用。
 *
 * 放在 `types/` 而不是某一个模板的 `components/types.ts` 里：两个统计模板都要这个形状，
 * 而模板之间互相 import 对方的 components 目录在本仓没有先例（现有的跨目录引用只指向
 * `components/` 和 `types/` 这两个公共位置）。`types/ctx.ts` 的 PosterProps 就是这么共用的。
 *
 * 所有时长都是**毫秒**，格式化留给模板：`1h23m` / `45s` 这类排版属于展示层，
 * 共用一套实现比两个模板各写一遍更不容易漂移。单位在数据源侧就已归一
 * （见 src/module/utils/media-metrics.ts 的 fromSeconds / fromMilliseconds）。
 *
 * 平均值一律「可缺」：分母为 0 时是 undefined 而不是 0 ——
 * 「没有采到数据」和「平均 0 秒」在卡片上必须能区分，后者会让人以为解析出了空视频。
 */
export interface MediaMetricsView {
  /** 媒体条数。一次解析可能产出多条（图集里的实况图各算一条） */
  mediaCount: number
  videoCount: number
  audioCount: number
  /** 总时长毫秒（视频 + 音频） */
  totalDurationMs: number
  videoDurationMs: number
  audioDurationMs: number
  /**
   * 真正带到时长的条数，平均时长的分母。
   *
   * 不能用 mediaCount 代替：快手、小红书当前的解析路径上拿不到时长字段，
   * 那些条目只增 mediaCount 不增这里。用 mediaCount 当分母会把它们按 0 秒算进平均值。
   */
  durationSamples: number
  /** 平均时长毫秒。durationSamples 为 0 时缺省 */
  averageDurationMs?: number
  /** 最长单条时长毫秒。没有样本时缺省 */
  maxDurationMs?: number
  /** 总字节数 */
  totalBytes: number
  /** 平均解析耗时毫秒。没有样本时缺省 */
  averageProcessingMs?: number
  /** 成功率 0~1。一次尝试都没有时缺省 */
  successRate?: number
  /** 各平台时长分布，用于排行条 */
  platforms: Record<MediaMetricsPlatform, MediaMetricsPlatformView>
}

/** 四个平台，和 StatisticsPlatform 保持一致 */
export type MediaMetricsPlatform = 'douyin' | 'bilibili' | 'kuaishou' | 'xiaohongshu'

/** 单个平台的媒体度量 */
export interface MediaMetricsPlatformView {
  mediaCount: number
  /** 总时长毫秒 */
  totalDurationMs: number
  /** 带到时长的条数。为 0 表示这个平台一条时长都没采到（不是「时长为 0」） */
  durationSamples: number
  /** 平均时长毫秒。durationSamples 为 0 时缺省 */
  averageDurationMs?: number
  maxDurationMs?: number
  totalBytes: number
}
