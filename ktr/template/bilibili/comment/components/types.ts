/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */
import type { CommentItem } from '../../components/types'

/**
 * B站评论组件属性接口
 */
export interface BilibiliCommentData {
  /** 作品类型：视频/图集/动态 */
  Type: '视频' | '动态'
  /** 评论数量 */
  CommentLength: string
  /** 视频大小(MB) */
  VideoSize?: string
  /** 视频画质 */
  Clarity?: string
  /** 图片数量 */
  ImageLength?: number
  /** 分享链接 */
  shareurl: string
  /** 分享URL */
  share_url: string
  /** 视频分辨率 */
  Resolution: string | null
  /** 评论数据 */
  CommentsData: CommentItem[]
}
