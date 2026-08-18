/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */
import type { RichTextDocument } from '@kkk/richtext'

/**
 * 小红书笔记统计信息接口
 */
export interface XiaohongshuNoteStatistics {
  /** 分享数 */
  share_count: string | number
  /** 是否已关注 */
  followed: boolean
  /** 关系状态 */
  relation: string
  /** 是否已点赞 */
  liked: boolean
  /** 点赞数 */
  liked_count: string | number
  /** 是否已收藏 */
  collected: boolean
  /** 收藏数 */
  collected_count: string | number
  /** 评论数 */
  comment_count: string | number
}

/**
 * 小红书作者信息接口
 */
export interface XiaohongshuAuthor {
  /** xsec_token */
  xsec_token?: string
  /** 用户ID */
  user_id: string
  /** 用户昵称 */
  nickname: string
  /** 用户头像URL */
  avatar: string
}

/**
 * 小红书笔记信息数据接口
 */
export interface XiaohongshuNoteInfoData {
  /** 笔记标题 */
  title: string
  /** 笔记描述 */
  desc: RichTextDocument
  /** 统计信息 */
  statistics: XiaohongshuNoteStatistics
  /** 笔记ID */
  note_id: string
  /** 作者信息 */
  author: XiaohongshuAuthor
  /** 笔记封面图片URL */
  image_url: string
  /** 创建时间戳 */
  time: number | string
  /** IP位置 */
  ip_location: string
  /** 笔记分享链接（用于底部二维码） */
  share_url?: string
  /** 图集图片 URL 列表（视频笔记通常只包含封面） */
  image_list?: string[]
  /** 是否为视频笔记 */
  is_video?: boolean
}
