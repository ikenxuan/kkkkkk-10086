/** bilibili板块共享类型（跨模板复用 / core 引用）。 */
import type { RichTextDocument } from '@kkk/richtext'

import type { UsernameMetadata } from '../dynamic/types'

/**
 * 粉丝卡片信息接口
 */
export interface FanCardInfo {
  /** 卡片背景图片 */
  image: string | null
  /** 序号前缀 */
  numPrefix: string
  /** 序号描述 */
  numDesc: string
  /** 渐变色样式 */
  gradientStyle: string
}

/**
 * B站二级评论项数据接口
 */
export interface SubCommentItem {
  /** 用户头像URL */
  avatar: string
  /** 用户昵称 */
  uname: string
  /** 用户昵称颜色 */
  unameColor?: string | null
  /** 用户等级 */
  level: number
  /** 头像框 */
  frame?: string
  /** 评论内容 */
  message: RichTextDocument
  /** 评论所有图片 */
  pictures: string[]
  /** 创建时间戳（秒） */
  ctime: number
  /** IP标签/地理位置 */
  location: string
  /** 点赞数 */
  like: number
  /** 是否为UP主评论 */
  isUP: boolean
  /** VIP状态 */
  vipstatus?: number
  /** 粉丝卡片信息 */
  fanCard?: FanCardInfo | null
  /** 粉丝勋章详情 */
  fansDetail?: FansDetail | null
}

/**
 * 粉丝勋章详情
 */
export interface FansDetail {
  /** 用户ID */
  uid: number
  /** 勋章ID */
  medal_id: number
  /** 勋章名称 */
  medal_name: string
  /** 分数 */
  score: number
  /** 等级 */
  level: number
  /** 亲密度 */
  intimacy: number
  /** 主播状态 */
  master_status: number
  /** 是否领取 */
  is_receive: number
  /** 勋章颜色（起始） */
  medal_color: number
  /** 勋章颜色（结束） */
  medal_color_end: number
  /** 边框颜色 */
  medal_color_border: number
  /** 名称颜色 */
  medal_color_name: number
  /** 等级颜色 */
  medal_color_level: number
  /** 守护等级 */
  guard_level: number
  /** 守护图标 */
  guard_icon: string
  /** 荣誉图标 */
  honor_icon: string
  /** 首图标（可选） */
  first_icon?: string
  /** 等级背景色 */
  medal_level_bg_color: number
}

/**
 * B站评论项数据接口
 */
export interface CommentItem {
  /** 用户头像URL */
  avatar: string
  /** 用户昵称 */
  uname: string
  /** 用户昵称颜色 */
  unameColor?: string | null
  /** 用户等级 */
  level: number
  /** 头像框 */
  frame?: string
  /** 标签类型 (1=作者) */
  label_type?: number
  /** 状态标签 */
  status_label?: string | null
  /** 评论内容 */
  message: RichTextDocument
  /** 评论所有图片 */
  pictures: string[]
  /** VIP状态 */
  vipstatus?: number
  /** 贴纸 */
  sticker?: string
  /** 创建时间戳（秒） */
  ctime: number
  /** IP标签/地理位置 */
  location: string
  /** 回复数量 */
  replylength: number
  /** 点赞数 */
  like: number
  /** 是否置顶评论 */
  isTop: boolean
  /** 是否为UP主评论 */
  isUP: boolean
  /** 二级评论列表 */
  replies?: SubCommentItem[]
  /** 粉丝卡片信息 */
  fanCard?: FanCardInfo | null
  /** 粉丝勋章详情 */
  fansDetail?: FansDetail | null
}

/**
 * B站视频统计数据接口
 */
export interface BilibiliVideoStat {
  /** 视频AV号 */
  aid: number
  /** 播放量 */
  view: number
  /** 弹幕数 */
  danmaku: number
  /** 评论数 */
  reply: number
  /** 收藏数 */
  favorite: number
  /** 投币数 */
  coin: number
  /** 分享数 */
  share: number
  /** 当前排名 */
  now_rank: number
  /** 历史最高排名 */
  his_rank: number
  /** 点赞数 */
  like: number
  /** 点踩数 */
  dislike: number
  /** 评价 */
  evaluation: string
  /** VT标识 */
  vt: number
}

/**
 * B站视频UP主信息接口
 */
export interface BilibiliVideoOwner {
  /** UP主用户ID */
  mid: number
  /** UP主昵称 */
  name: string
  /** UP主头像URL */
  face: string
  /** 用户名元数据（VIP颜色等） */
  usernameMeta?: UsernameMetadata
  /** 头像框图片URL */
  frame?: string
}

/**
 * 热门弹幕项接口（相同内容的弹幕聚合）
 */
export interface BilibiliHotDanmaku {
  /** 弹幕内容 */
  content: string
  /** 出现次数 */
  count: number
}

/**
 * 视频统计项组件属性接口
 */
export interface VideoStatItemProps {
  /** 图标组件 */
  icon: React.ReactNode
  /** 标签文本 */
  label: string
  /** 数值 */
  value: number | string
}

/**
 * 视频头部信息组件属性接口
 */
export interface VideoHeaderProps {
  /** 视频标题 */
  title: string
  /** UP主信息 */
  owner: BilibiliVideoOwner
  /** 创建时间戳 */
  ctime: number
}

/**
 * 二维码区域组件属性接口
 */
export interface QRCodeSectionProps {
  /** 分享链接 */
  share_url: string
  /** 是否使用深色主题 */
  useDarkTheme?: boolean
}

/**
 * 徽章信息接口
 */
export interface BangumiBilibiliEpisodeBadgeInfo {
  /** 背景颜色 */
  bg_color: string
  /** 夜间模式背景颜色 */
  bg_color_night: string
  /** 徽章文本 */
  text: string
}

/**
 * 番剧剧集信息接口
 */
export interface BangumiBilibiliEpisode {
  /** 剧集封面图片URL */
  cover: string
  /** 视频BV号 */
  bvid: string
  /** 剧集链接 */
  link: string
  /** 剧集完整标题 */
  long_title: string
  /** 发布时间戳 */
  pub_time: number
  /** 徽章标识（如：限免、会员） */
  badge: string
  /** 徽章详细信息 */
  badge_info: BangumiBilibiliEpisodeBadgeInfo
}

/**
 * 番剧最新剧集信息接口
 */
export interface BangumiBilibiliNewEP {
  /** 剧集描述 */
  desc: string
  /** 剧集ID */
  id: number
  /** 是否为新剧集 */
  is_new: number
  /** 剧集标题 */
  title: string
}

/**
 * 番剧统计数据接口
 */
export interface BangumiBilibiliStat {
  /** 硬币数 */
  coins: number
  /** 弹幕数 */
  danmakus: number
  /** 收藏数 */
  favorite: number
  /** 总收藏数 */
  favorites: number
  /** 追番文本 */
  follow_text: string
  /** 点赞数 */
  likes: number
  /** 评论数 */
  reply: number
  /** 分享数 */
  share: number
  /** 播放量 */
  views: number
  /** VT标识 */
  vt: number
}

/**
 * UP主挂件信息接口
 */
export interface BangumiBilibiliPendant {
  /** 挂件图片URL */
  image: string
  /** 挂件名称 */
  name: string
  /** 挂件ID */
  pid: number
}

/**
 * UP主VIP标签信息接口
 */
export interface BangumiBilibiliVipLabel {
  /** 背景颜色 */
  bg_color: string
  /** 背景样式 */
  bg_style: number
  /** 边框颜色 */
  border_color: string
  /** 标签文本 */
  text: string
  /** 文本颜色 */
  text_color: string
}

/**
 * UP主信息接口
 */
export interface BangumiBilibiliUPInfo {
  /** 头像URL */
  avatar: string
  /** 头像角标URL */
  avatar_subscript_url: string
  /** 粉丝数 */
  follower: number
  /** 是否已关注 */
  is_follow: number
  /** 用户ID */
  mid: number
  /** 昵称颜色 */
  nickname_color: string
  /** 挂件信息 */
  pendant: BangumiBilibiliPendant
  /** 主题类型 */
  theme_type: number
  /** 用户名 */
  uname: string
  /** 认证类型 */
  verify_type: number
  /** VIP标签信息 */
  vip_label: BangumiBilibiliVipLabel
  /** VIP状态 */
  vip_status: number
  /** VIP类型 */
  vip_type: number
}

/**
 * 番剧头部组件属性接口
 */
export interface BangumiBilibiliHeaderProps {
  /** 番剧标题 */
  title: string
  /** 主封面图片URL */
  mainCover: string
  /** 番剧评价描述 */
  evaluate: string
  /** 演员信息 */
  actors: string
  /** 番剧风格标签 */
  styles: string[]
  /** 副标题信息 */
  subtitle: string
  /** UP主信息 */
  upInfo?: BangumiBilibiliUPInfo
  /** 统计数据 */
  stat: BangumiBilibiliStat
  /** 版权信息 */
  copyright: string
  /** 季度ID */
  seasonID: number
}
