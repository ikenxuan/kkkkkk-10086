/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */

/**
 * 群组解析统计数据接口
 */
export interface GroupStatisticsData {
  /** 群组ID */
  groupId: string
  /** 群组名称 */
  groupName?: string
  /** 群组人数 */
  groupMemberCount?: number
  /** 群组头像 */
  groupAvatar?: string
  /** 群组总解析次数 */
  groupTotalParses: number
  /** 群组唯一用户数 */
  groupUniqueUsers: number
  /** 各平台解析数据 */
  platformData: {
    douyin: number
    bilibili: number
    kuaishou: number
    xiaohongshu: number
  }
  /** 全局总群组数 */
  globalTotalGroups: number
  /** 全局总解析次数 */
  globalTotalParses: number
}
