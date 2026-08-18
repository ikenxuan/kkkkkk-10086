/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */

/**
 * 小红书评论组件属性接口
 */
export interface XiaohongshuCommentData {
  /** 笔记类型：图文/视频 */
  Type: '图文' | '视频'
  /** 评论数量 */
  CommentLength: number
  /** 图片数量 */
  ImageLength?: number
  /** 分享链接 */
  share_url: string
  /** 评论数据 - 简化为直接的评论数组 */
  CommentsData: XiaohongshuCommentItem[]
}

/** xiaohongshu板块共享类型（跨模板复用 / core 引用）。 */
import type { RichTextDocument } from '@kkk/richtext'

/**
 * 小红书评论项数据接口
 */
export interface XiaohongshuCommentItem {
  /** 评论ID */
  id: string
  /** 笔记ID */
  note_id: string
  /** 评论内容 */
  content: RichTextDocument
  /** 用户信息 */
  user_info: {
    user_id: string
    nickname: string
    image: string
    xsec_token: string
  }
  /** 创建时间戳（毫秒） */
  create_time: number
  /** IP位置 */
  ip_location: string
  /** 点赞数 */
  like_count: string
  /** 是否已点赞 */
  liked: boolean
  /** 评论图片 */
  pictures: Array<{
    height: number
    width: number
    url_pre: string
    url_default: string
    info_list: Array<{
      image_scene: string
      url: string
    }>
  }>
  /** 子评论数量 */
  sub_comment_count: string
  /** 子评论列表 */
  sub_comments: XiaohongshuSubComment[]
  /** 显示标签 */
  show_tags: string[]
  /** @用户列表 */
  at_users: string[]
  /** 状态 */
  status: number
}

/**
 * 小红书子评论数据接口
 */
export interface XiaohongshuSubComment {
  /** 子评论ID */
  id: string
  /** 笔记ID */
  note_id: string
  /** 评论内容 */
  content: RichTextDocument
  /** 用户信息 */
  user_info: {
    user_id: string
    nickname: string
    image: string
    xsec_token: string
  }
  /** 创建时间戳（毫秒） */
  create_time: number
  /** IP位置 */
  ip_location: string
  /** 点赞数 */
  like_count: string
  /** 是否已点赞 */
  liked: boolean
  /** 评论图片 */
  pictures: string[]
  /** 显示标签 */
  show_tags: string[]
  /** @用户列表 */
  at_users: string[]
  /** 状态 */
  status: number
  /** 目标评论 */
  target_comment?: {
    id: string
    user_info: {
      user_id: string
      nickname: string
      image: string
      xsec_token: string
    }
  }
}
