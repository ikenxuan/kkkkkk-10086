/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */
import type { RichTextDocument } from '@kkk/richtext'

import type { DecorationCardData, UsernameMetadata } from '../../types'

/**
 * B站专栏动态组件属性接口
 */
export interface BilibiliArticleDynamicData {
  /** 用户头像URL */
  avatar_url: string
  /** 头像框 */
  frame?: string
  /** 用户名元数据 */
  usernameMeta: UsernameMetadata
  /** 动态创建时间 */
  create_time: string
  /** 装饰卡片 */
  decoration_card?: DecorationCardData
  /** 专栏标题 */
  title: string
  /** 专栏摘要 */
  summary: string
  /** 专栏封面图片URL */
  banner_url?: string
  /** 专栏分类 */
  categories: Array<{
    id: number
    name: string
    parent_id: number
  }>
  /** 专栏字数 */
  words: number
  /** 专栏统计数据 */
  stats: {
    /** 阅读数 */
    view: number
    /** 点赞数 */
    like: number
    /** 收藏数 */
    favorite: number
    /** 评论数 */
    reply: number
    /** 分享数 */
    share: number
    /** 投币数 */
    coin: number
    /** 转发动态 */
    dynamic: number
  }
  /** 专栏正文（richtext 格式） */
  body: RichTextDocument
  /** 渲染时间 */
  render_time: string
  /** 动态类型 */
  dynamicTYPE: string
  /** 分享链接 */
  share_url: string
  /** 用户短ID */
  user_shortid: string | number
  /** 获赞总数 */
  total_favorited: string | number
  /** 关注数 */
  following_count: string | number
  /** 粉丝数 */
  fans: string | number
}
