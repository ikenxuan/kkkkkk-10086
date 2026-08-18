/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */
import type { RichTextDocument } from '@kkk/richtext'

import type { BilibiliHotDanmaku, BilibiliVideoOwner, BilibiliVideoStat } from '../../components/types'

/**
 * B站视频信息数据接口
 */
export interface BilibiliVideoInfoData {
  /** 分享链接 */
  share_url: string
  /** 视频标题 */
  title: string
  /** 视频简介（富文本格式） */
  desc: RichTextDocument
  /** 统计数据 */
  stat: BilibiliVideoStat
  /** 视频BV号 */
  bvid: string
  /** 创建时间戳 */
  ctime: number
  /** 视频封面图片URL */
  pic: string
  /** UP主信息 */
  owner: BilibiliVideoOwner
  /** 出现次数最多的热门弹幕（可选，按次数降序） */
  hotDanmaku?: BilibiliHotDanmaku[]
}
