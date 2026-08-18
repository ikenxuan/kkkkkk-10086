/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */
import type { RichTextDocument } from '@kkk/richtext'

/** 抖音图文中单张媒体的类型。 */
export type DouyinImageMediaType = 'static' | 'live' | 'clip'

/**
 * 抖音图文作品组件属性接口
 */
export interface DouyinImageWorkData {
  /** 图文图片列表（首项为封面；组件从索引 1 起最多展示 3 张预览图） */
  image_list: {
    /** 图片列表，按原始顺序排列 */
    images: Array<{
      /** 图片 URL */
      url: string
      /** 媒体类型 */
      media_type: DouyinImageMediaType
    }>
    /** 作品总图片数（包含封面） */
    total_count: number
  }
  /** 标题（从描述中按首个句号拆分，含有效 @ 用户与 topic 节点） */
  title?: RichTextDocument
  /** 描述内容（去除标题后的正文，含有效 @ 用户、topic/lineBreak 节点） */
  desc: RichTextDocument
  /** IP 属地 */
  ip_location?: string
  /** 热点搜索词 */
  suggest_word?: {
    hint_text: string
    word: string
  }
  /** 背景音乐信息 */
  music?: {
    /** 音乐作者 */
    author: string
    /** 音乐标题 */
    title: string
    /** 音乐封面 URL */
    cover?: string
  }
  /** 点赞数 */
  dianzan: string
  /** 评论数 */
  pinglun: string
  /** 收藏数 */
  shouchang: string
  /** 分享数 */
  share: string
  /** 创建时间（Unix 时间戳，秒） */
  create_time: number
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
