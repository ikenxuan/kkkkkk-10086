/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */

import type { MediaMetricsView } from '../../../types/media-metrics'

/**
 * 全局解析统计数据接口
 */
export interface GlobalStatisticsData {
  /** 所有统计数据 */
  allStats: Array<{
    id: number
    groupId: string
    userId: string
    platform: 'douyin' | 'bilibili' | 'kuaishou' | 'xiaohongshu'
    parseCount: number
    createdAt: string
    updatedAt: string
  }>
  /** 历史数据（最近30天） */
  historyData: Array<{
    date: string
    totalParses: number
    douyin: number
    bilibili: number
    kuaishou: number
    xiaohongshu: number
  }>
  /** 群组信息映射 */
  groupInfoMap: Record<
    string,
    {
      groupName?: string
      groupAvatar?: string
    }
  >
  /**
   * 全量解析出去的媒体的时长 / 体积 / 耗时汇总。
   *
   * 本地新增（上游 karin-plugin-kkk 没有这个字段）：同步上游时连带
   * GlobalStatistics.tsx 的「媒体时长」区块一起保留。
   *
   * 整个字段可选、内部的平均值也各自可选：`durationSamples` 为 0 表示这批解析
   * 一条时长都没拿到（快手、小红书当前的解析路径上就没有时长字段），
   * 此时 `averageDurationMs` 缺省、模板那格不渲染 —— 不能拿 0 冒充「平均 0 秒」。
   */
  mediaMetrics?: MediaMetricsView
}
