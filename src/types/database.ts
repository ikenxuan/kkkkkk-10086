/** sqlite3 `run` 回调暴露的执行结果 */
export interface RunResult {
  lastID: number
  changes: number
}

export type StatisticsPlatform = 'douyin' | 'bilibili' | 'kuaishou' | 'xiaohongshu'

export type FilterMode = 'blacklist' | 'whitelist'

export type DouyinPushType = 'post' | 'favorite' | 'recommend' | 'live'

export interface BotRow {
  id: string
  createdAt: string
  updatedAt: string
}

export interface GroupRow {
  id: string
  botId: string
  createdAt: string
  updatedAt: string
}

export interface ParseStatisticsRow {
  id: number
  groupId: string
  userId: string
  platform: StatisticsPlatform
  parseCount: number
  createdAt: string
  updatedAt: string
}

export interface ParseHistoryRow {
  id: number
  date: string
  totalParses: number
  douyin: number
  bilibili: number
  kuaishou: number
  xiaohongshu: number
  createdAt: string
}

/**
 * 群内单个用户的解析次数聚合行，`getGroupUserRanking()` 的返回元素。
 *
 * 不是某张表的行：`ParseStatistics` 里一个用户占四行（每个平台一行），
 * 这里是按 userId 合并之后的结果，所以 `totalParses` 与四个平台字段
 * 都由 SQL 的 `SUM()` 现算，表上并没有对应的列。
 */
export interface GroupUserRankingRow {
  userId: string
  /** 该用户在这个群的总解析次数，等于下面四个平台之和 */
  totalParses: number
  douyin: number
  bilibili: number
  kuaishou: number
  xiaohongshu: number
}

export interface GlobalStatisticsRow {
  key: string
  value: string
  updatedAt: string
}

export interface GlobalStatisticsSummary {
  totalGroups: number
  totalParses: number
  totalUsers: number
  platformStats: Record<StatisticsPlatform, number>
}

/**
 * MediaMetrics 表行：解析出去的媒体的时长 / 体积 / 耗时累计。
 *
 * 三组 `*Samples` 是各自的分母，不能用 `mediaCount` 代替：快手、小红书当前的
 * 解析路径上拿不到时长，那些条目只增 `mediaCount` 不增 `durationSamples`
 * （见 utils/media-metrics.ts）。拿 mediaCount 当分母会把这些「没有时长的条目」
 * 按 0 算进平均值。
 */
export interface MediaMetricsRow {
  id: number
  groupId: string
  platform: StatisticsPlatform
  /** 媒体条数。一次解析可能产出多条（图集里的实况图各算一条） */
  mediaCount: number
  videoCount: number
  audioCount: number
  /** 累计毫秒，已按平台单位归一（见 media-metrics.ts 的 fromSeconds / fromMilliseconds） */
  videoDurationMs: number
  audioDurationMs: number
  /** 真正带到时长的条数，平均时长的分母 */
  durationSamples: number
  /** 单条最长时长，毫秒 */
  maxDurationMs: number
  totalBytes: number
  /** 真正带到体积的条数，平均体积的分母 */
  bytesSamples: number
  processingMs: number
  /** 真正带到耗时的条数 */
  processingSamples: number
  successCount: number
  failureCount: number
  createdAt: string
  updatedAt: string
}

/**
 * 媒体度量的聚合结果，模板直接消费这个形状。
 *
 * 所有平均值都是「可缺」的：分母为 0 时是 undefined 而不是 0 ——
 * 「没有数据」和「平均 0 秒」在卡片上必须能区分开。
 */
export interface MediaMetricsSummary {
  /** 总媒体条数 */
  mediaCount: number
  videoCount: number
  audioCount: number
  /** 总时长毫秒（视频 + 音频） */
  totalDurationMs: number
  videoDurationMs: number
  audioDurationMs: number
  /** 带到时长的条数 */
  durationSamples: number
  /** 平均时长毫秒。durationSamples 为 0 时缺省 */
  averageDurationMs?: number
  /** 最长单条时长毫秒。没有样本时缺省 */
  maxDurationMs?: number
  totalBytes: number
  /** 平均耗时毫秒。processingSamples 为 0 时缺省 */
  averageProcessingMs?: number
  successCount: number
  failureCount: number
  /** 成功率 0~1。成功 + 失败为 0 时缺省 */
  successRate?: number
  /** 各平台时长分布，用于排行条 */
  platforms: Record<StatisticsPlatform, MediaMetricsPlatformSummary>
}

export interface MediaMetricsPlatformSummary {
  mediaCount: number
  /** 总时长毫秒 */
  totalDurationMs: number
  /** 带到时长的条数。为 0 表示这个平台一条时长都没拿到（不是「时长为 0」） */
  durationSamples: number
  /** 平均时长毫秒。durationSamples 为 0 时缺省 */
  averageDurationMs?: number
  maxDurationMs?: number
  totalBytes: number
}

export interface DouyinUserRow {
  sec_uid: string
  short_id?: string
  remark?: string
  living: boolean
  filterMode: FilterMode
  createdAt: string
  updatedAt: string
}

export interface DouyinSubscriptionRow {
  groupId: string
  sec_uid: string
  createdAt: string
  updatedAt: string
}

export interface DouyinSubscriptionWithUser extends DouyinSubscriptionRow {
  douyinUser: DouyinUserRow
}

export interface AwemeCacheRow {
  id: number
  aweme_id: string
  sec_uid: string
  groupId: string
  pushType: string
  createdAt: string
  updatedAt: string
}

export interface DouyinFilterWordRow {
  id: number
  sec_uid: string
  douyinUserSecUid: string
  word: string
  createdAt: string
  updatedAt: string
}

export interface DouyinFilterTagRow {
  id: number
  sec_uid: string
  douyinUserSecUid: string
  tag: string
  createdAt: string
  updatedAt: string
}

export interface DouyinFilterConfig {
  filterMode: FilterMode
  filterWords: string[]
  filterTags: string[]
}

export interface BilibiliUserRow {
  host_mid: number
  remark?: string
  filterMode: FilterMode
  createdAt: string
  updatedAt: string
}

export interface BilibiliSubscriptionRow {
  groupId: string
  host_mid: number
  createdAt: string
  updatedAt: string
}

export interface BilibiliSubscriptionWithUser extends BilibiliSubscriptionRow {
  bilibiliUser: BilibiliUserRow
}

export interface DynamicCacheRow {
  id: number
  dynamic_id: string
  host_mid: number
  groupId: string
  dynamic_type?: string
  createdAt: string
  updatedAt: string
}

export interface BilibiliFilterWordRow {
  id: number
  host_mid: number
  bilibiliUserHostMid: number
  word: string
  createdAt: string
  updatedAt: string
}

export interface BilibiliFilterTagRow {
  id: number
  host_mid: number
  bilibiliUserHostMid: number
  tag: string
  createdAt: string
  updatedAt: string
}

export interface BilibiliFilterConfig {
  filterMode: FilterMode
  filterWords: string[]
  filterTags: string[]
}

/** PRAGMA table_info 返回行 */
export interface TableColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: string | null
  pk: number
}

export interface CountResult {
  count: number
}

export interface SumResult {
  total: number | null
}
