/** sqlite3 `run` 回调暴露的执行结果 */
export interface RunResult {
  lastID: number
  changes: number
}

/** 支持统计的平台 */
export type StatisticsPlatform = 'douyin' | 'bilibili' | 'kuaishou' | 'xiaohongshu'

/** 过滤模式 */
export type FilterMode = 'blacklist' | 'whitelist'

/** 抖音推送类型 */
export type DouyinPushType = 'post' | 'favorite' | 'recommend' | 'live'

/** 机器人表行 */
export interface BotRow {
  id: string
  createdAt: string
  updatedAt: string
}

/** 群组表行 */
export interface GroupRow {
  id: string
  botId: string
  createdAt: string
  updatedAt: string
}

/** ParseStatistics 表行 */
export interface ParseStatisticsRow {
  id: number
  groupId: string
  userId: string
  platform: StatisticsPlatform
  parseCount: number
  createdAt: string
  updatedAt: string
}

/** ParseHistory 表行 */
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

/** GlobalStatistics 表行 */
export interface GlobalStatisticsRow {
  key: string
  value: string
  updatedAt: string
}

/** 全局统计汇总 */
export interface GlobalStatisticsSummary {
  totalGroups: number
  totalParses: number
  totalUsers: number
  platformStats: Record<StatisticsPlatform, number>
}

/** DouyinUsers 表行 */
export interface DouyinUserRow {
  sec_uid: string
  short_id?: string
  remark?: string
  living: boolean
  filterMode: FilterMode
  createdAt: string
  updatedAt: string
}

/** 抖音群组订阅关系行 */
export interface DouyinSubscriptionRow {
  groupId: string
  sec_uid: string
  createdAt: string
  updatedAt: string
}

/** 携带用户信息的抖音订阅关系 */
export interface DouyinSubscriptionWithUser extends DouyinSubscriptionRow {
  douyinUser: DouyinUserRow
}

/** AwemeCaches 表行 */
export interface AwemeCacheRow {
  id: number
  aweme_id: string
  sec_uid: string
  groupId: string
  pushType: string
  createdAt: string
  updatedAt: string
}

/** 抖音过滤词行 */
export interface DouyinFilterWordRow {
  id: number
  sec_uid: string
  douyinUserSecUid: string
  word: string
  createdAt: string
  updatedAt: string
}

/** 抖音过滤标签行 */
export interface DouyinFilterTagRow {
  id: number
  sec_uid: string
  douyinUserSecUid: string
  tag: string
  createdAt: string
  updatedAt: string
}

/** 抖音过滤配置 */
export interface DouyinFilterConfig {
  filterMode: FilterMode
  filterWords: string[]
  filterTags: string[]
}

/** BilibiliUsers 表行 */
export interface BilibiliUserRow {
  host_mid: number
  remark?: string
  filterMode: FilterMode
  createdAt: string
  updatedAt: string
}

/** B站群组订阅关系行 */
export interface BilibiliSubscriptionRow {
  groupId: string
  host_mid: number
  createdAt: string
  updatedAt: string
}

/** 携带用户信息的 B站订阅关系 */
export interface BilibiliSubscriptionWithUser extends BilibiliSubscriptionRow {
  bilibiliUser: BilibiliUserRow
}

/** DynamicCaches 表行 */
export interface DynamicCacheRow {
  id: number
  dynamic_id: string
  host_mid: number
  groupId: string
  dynamic_type?: string
  createdAt: string
  updatedAt: string
}

/** B站过滤词行 */
export interface BilibiliFilterWordRow {
  id: number
  host_mid: number
  bilibiliUserHostMid: number
  word: string
  createdAt: string
  updatedAt: string
}

/** B站过滤标签行 */
export interface BilibiliFilterTagRow {
  id: number
  host_mid: number
  bilibiliUserHostMid: number
  tag: string
  createdAt: string
  updatedAt: string
}

/** B站过滤配置 */
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

/** 计数查询结果 */
export interface CountResult {
  count: number
}

/** 求和查询结果 */
export interface SumResult {
  total: number | null
}
