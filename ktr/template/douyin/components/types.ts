/** douyin板块共享类型（跨模板复用 / core 引用）。 */

import type { RichTextDocument } from '@kkk/richtext'

/**
 * 抖音子评论数据接口
 */
export interface DouyinSubComment {
  /** 创建时间戳（秒） */
  create_time: number
  /** 用户昵称 */
  nickname: string
  /** 用户头像URL */
  userimageurl: string
  /** 评论内容 */
  text: RichTextDocument
  /** 点赞数 */
  digg_count: number
  /** IP标签 */
  ip_label: string
  /** 文本额外信息 */
  text_extra: any[]
  /** 标签文本 */
  label_text: string
  /** 评论图片 */
  image_list: string[] | null
  /** 评论ID */
  cid: string
  /** 回复的评论ID */
  reply_to_reply_id: string
  /** 回复的用户昵称 */
  reply_to_username: string
}

/**
 * 抖音直播用户信息组件属性接口
 */
export interface DouyinLiveUserInfoProps {
  /** 用户头像URL */
  avater_url: string
  /** 用户名 */
  username: string
  /** 粉丝数 */
  fans: string
  /** 是否使用深色主题 */
  useDarkTheme?: boolean
}

/**
 * 抖音直播二维码组件属性接口
 */
export interface DouyinLiveQRCodeProps {
  /** 是否使用深色主题 */
  useDarkTheme?: boolean
}

/**
 * 音乐封面组件属性接口
 */
export interface MusicCoverProps {
  /** 音乐封面图片URL */
  imageUrl: string
  /** 音乐描述 */
  description: string
  /** 是否使用深色主题 */
  useDarkTheme?: boolean
}

/**
 * 音乐信息组件属性接口
 */
export interface MusicInfoProps {
  /** 音乐ID */
  musicId: string
  /** 使用用户数量 */
  userCount: string
  /** 创建时间 */
  createTime: string
  /** 是否使用深色主题 */
  useDarkTheme?: boolean
}

/**
 * 音乐作者信息组件属性接口
 */
export interface MusicAuthorInfoProps {
  /** 用户头像URL */
  avatarUrl: string
  /** 用户名 */
  username: string
  /** 用户短ID */
  userShortId: string
  /** 获赞数 */
  totalFavorited: number
  /** 关注数 */
  followingCount: number
  /** 粉丝数 */
  fans: number
  /** 是否使用深色主题 */
  useDarkTheme?: boolean
}

/**
 * 音乐二维码组件属性接口
 */
export interface MusicQRCodeProps {
  /** 二维码内容。 */
  share_url: string
  /** 音乐作者头像 URL。 */
  avatarUrl: string
  /** 是否使用深色主题 */
  useDarkTheme?: boolean
}
