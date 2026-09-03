/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */
import type { RichTextDocument } from '@kkk/richtext'

import type { UsernameMetadata } from '../../types'

/**
 * B站直播动态组件属性接口
 */
export interface BilibiliLiveDynamicData {
  /** 直播封面 */
  image_url: string
  /** 直播标题 */
  text: RichTextDocument
  /** 直播房间信息（分区 | 房间号） */
  liveinf: string
  /** 用户名元数据 */
  usernameMeta: UsernameMetadata
  /** 用户头像URL */
  avatar_url: string
  /** 头像框 */
  frame?: string
  /** 粉丝数 */
  fans: string
  /**
   * 当前在看人数，已格式化成展示文本。
   *
   * 声明成可选是因为三个渲染点里只有直播间链接解析那条拿得到它：
   * 动态流（`DYNAMIC_TYPE_LIVE_RCMD`）和推送两条走的是动态卡片，
   * 那份响应里没有房间的实时人数。缺了就整格不渲染。
   */
  online?: string
  /** 时间信息 */
  create_time: string
  /** 直播开始时间 */
  now_time: string
  /** 分享和配置 */
  share_url: string
  /** 动态类型 */
  dynamicTYPE: string
}
