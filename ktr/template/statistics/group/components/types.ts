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
  /**
   * 本群用户解析排行，按总次数从多到少。
   *
   * 本地新增（上游 karin-plugin-kkk 没有这个字段）：同步上游时请保留，
   * 连带 GroupStatistics.tsx 里那段「用户排行」区块一起 —— 抹掉字段会让
   * `#kkk解析统计` 的排行整块消失，抹掉字段但留下组件则过不了契约校验。
   *
   * 整个字段是可选的，组件那边也带守卫（`userRanking?.length` 为假就整块不渲染），
   * 因此老调用点不传、或者这个群一条记录都没有，卡片都照常出图。
   */
  userRanking?: Array<{
    /** 用户 ID。QQ 是纯数字 uin，QQBot 适配器给的是一长串 openid */
    userId: string
    /** 昵称。取不到时由调用点回落成（必要时截断的）userId，模板不再自己兜底 */
    nickname: string
    /** 该用户在本群的总解析次数 */
    totalParses: number
    /**
     * 头像直链。只有纯数字 userId（QQ 号）才拼得出来，
     * QQBot 的 openid 拿不到，此时由调用点缺省、模板那格整个不渲染，
     * 而不是塞一个必然 404 的地址进去。
     */
    avatar?: string
    /** 该用户各平台解析次数。缺省时不渲染平台徽标那一行 */
    platforms?: {
      douyin: number
      bilibili: number
      kuaishou: number
      xiaohongshu: number
    }
  }>
}
