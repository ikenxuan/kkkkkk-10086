/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */

/**
 * 用户视频列表页面的数据类型定义
 */
export type VideoListItem = {
  /** 视频ID */
  aweme_id: string
  /** 视频索引 */
  index?: number
  /** 是否置顶 */
  is_top: boolean
  /** 视频标题/描述 */
  title: string
  /** 视频封面URL */
  cover: string
  /** 视频时长（秒） */
  duration: number
  /** 创建时间戳 */
  create_time: number
  /** 统计数据 */
  statistics: {
    /** 点赞数 */
    like_count: number
    /** 评论数 */
    comment_count: number
    /** 分享数 */
    share_count: number
    /** 收藏数 */
    collect_count: number
  }
  /** 是否为视频(true)还是图集(false) */
  is_video: boolean
  /** 背景音乐信息 */
  music?: {
    /** 音乐标题 */
    title: string
    /** 音乐作者 */
    author: string
  }
}

export type DouyinUserVideoListData = {
  /** 用户基本信息 */
  user: {
    /** 头像图片（可能为 null） */
    head_image: string | null
    /** 用户昵称 */
    nickname: string
    /** 抖音号 */
    short_id: string
    /** 头像URL */
    avatar: string
    /** 用户签名/简介 */
    signature: string
    /** 粉丝数 */
    follower_count: number
    /** 关注数 */
    following_count: number
    /** 获赞总数 */
    total_favorited: number
    /** 是否认证 */
    verified: boolean
    /** IP属地 */
    ip_location: string
  }
  /** 视频列表 */
  videos: Array<VideoListItem>
  /** 超时秒数 */
  timeoutSeconds?: number
}
