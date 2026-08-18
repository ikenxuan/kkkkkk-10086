/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */

/**
 * 抖音动态组件属性接口
 */
export interface DouyinDynamicData {
  /** 图片URL */
  image_url: string
  /** 描述内容 */
  desc: string
  /** 点赞数 */
  dianzan: string
  /** 评论数 */
  pinglun: string
  /** 收藏数 */
  shouchang: string
  /** 分享数 */
  share: string
  /** 创建时间 */
  create_time: string
  /** 用户头像URL */
  avater_url: string
  /** 用户名 */
  username: string
  /** 抖音号 */
  抖音号: string
  /** 获赞数 */
  获赞: string
  /** 关注数 */
  关注: string
  /** 粉丝数 */
  粉丝: string
  /** 分享链接 */
  share_url: string
  /** 动态类型 */
  dynamicTYPE?: string
  /** 合作信息 */
  cooperation_info?: {
    co_creator_nums: number
    co_creators: Array<{
      avatar_url?: string
      nickname: string
      role_title: string
    }>
  }
}
