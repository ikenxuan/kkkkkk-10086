/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */

/**
 * 抖音音乐信息组件属性接口
 */
export interface DouyinMusicInfoData {
  /** 音乐封面图片URL */
  image_url: string
  /** 音乐描述/标题 */
  desc: string
  /** 音乐ID */
  music_id: string
  /** 创建时间 */
  create_time: string
  /** 使用该音乐的用户数量 */
  user_count: string
  /** 用户头像URL */
  avater_url: string
  /** 用户名 */
  username: string
  /** 用户短ID */
  user_shortid: string
  /** 获赞数 */
  total_favorited: number
  /** 关注数 */
  following_count: number
  /** 粉丝数 */
  fans: number
  /** 分享链接 */
  share_url: string
}
