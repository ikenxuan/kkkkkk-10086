/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */
import type { RichTextDocument } from '@kkk/richtext'

import type { DouyinSubComment } from '../../components/types'

/**
 * 抖音评论模板数据
 */
export interface DouyinCommentData {
  /** 作品类型：视频/图集/合辑/文章 */
  Type: '视频' | '图集' | '合辑' | '文章'
  /** 评论数量 */
  CommentLength: number
  /** 视频大小(MB) */
  VideoSize?: string
  /** 视频帧率(Hz) */
  VideoFPS?: number
  /** 图片数量 */
  ImageLength?: number
  /** 区域 */
  Region: string
  /** 相关搜索（大家都在搜） */
  suggestWrod: string[]
  /** 视频分辨率 */
  Resolution: string | null
  /** 分享链接 */
  share_url: string
  /** 作者昵称 */
  Author: string
  /** 作者头像 */
  AuthorAvatar: string
  /** 作品统计 */
  Statistics: {
    digg_count: number
    comment_count: number
    share_count: number
    collect_count: number
  }
  /** 发布时间戳（秒） */
  CreateTime: number
  /** 评论数据列表 */
  CommentsData: Array<{
    /** 评论ID */
    id?: number
    /** 评论CID */
    cid?: string
    /** 作品ID */
    aweme_id?: string
    /** 用户头像URL */
    userimageurl: string
    /** 用户昵称 */
    nickname: string
    /** 标签类型 (1=作者) */
    label_type?: number
    /** 状态标签 */
    status_label?: string
    /** 评论内容 */
    text: RichTextDocument
    /** 评论图片 */
    commentimage?: string
    /** 贴纸 */
    sticker?: string
    /** 创建时间戳（秒） */
    create_time: number
    /** IP标签 */
    ip_label: string
    /** 点赞数 */
    digg_count: number
    /** 搜索文本 */
    search_text?: Array<{
      /** 搜索文本内容 */
      search_text: string
      /** 搜索查询ID */
      search_query_id: string
    }> | null
    /** 是否@用户ID */
    is_At_user_id?: any
    /** 回复评论数据 */
    replyComment?: DouyinSubComment[]
    /** 作者是否点赞 */
    is_author_digged?: boolean
  }>
  /** 最大嵌套层级 */
  maxDepth?: number
}
