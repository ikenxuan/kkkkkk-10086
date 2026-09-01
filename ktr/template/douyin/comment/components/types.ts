/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */
import type { DouyinComment } from '@/module/utils/template-contracts'

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
  CommentsData: DouyinComment[]
  /** 最大嵌套层级 */
  maxDepth?: number
}
