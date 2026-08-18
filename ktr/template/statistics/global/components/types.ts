/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */

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
}
