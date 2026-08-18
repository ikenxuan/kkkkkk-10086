/** bilibili dynamic 板块共享类型（跨模板复用 / core 引用）。 */
import type { RichTextDocument } from '@kkk/richtext'

/**
 * 装饰卡片数据
 */
export interface DecorationCardData {
  /** 卡片背景图片URL */
  card_url: string
  /** 渐变颜色数组 */
  colors: string[]
  /** 卡片显示文字 */
  text: string
}

/**
 * 用户名元数据，用于传递 VIP 状态和颜色信息
 */
export interface UsernameMetadata {
  /** 用户名 */
  name: string
  /** VIP状态，1为年度大会员 */
  vipStatus: number
  /** 昵称颜色，VIP用户特有 */
  nicknameColor: string | null
}

/**
 * B站动态基础数据接口（所有动态类型共有的字段）
 */
export interface BilibiliDynamicBaseData {
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
  /** 点赞数 */
  dianzan: string | number
  /** 评论数 */
  pinglun: string | number
  /** 分享数 */
  share: string | number
  /** 渲染时间 */
  render_time: string
  /** 用户短ID */
  user_shortid: string | number
  /** 获赞总数 */
  total_favorited: string | number
  /** 关注数 */
  following_count: string | number
  /** 粉丝数 */
  fans: string | number
  /** 动态类型 */
  dynamicTYPE: string
  /** 动态ID */
  dynamic_id: string
  /** 分享链接 */
  share_url: string
}

/**
 * B站预约卡片数据接口
 */
export interface BilibiliReserveData {
  /** 预约标题 */
  title: string
  /** 时间信息 */
  desc1: string
  /** 预约人数 */
  desc2: string
  /** 预约奖励信息（可选） */
  desc3?: string
  /** 按钮文本 */
  buttonText: string
}

/**
 * B站投票卡片数据接口
 */
export interface BilibiliVoteData {
  /** 投票标题 */
  title: string
  /** 参与人数描述（如 "1703人参与"） */
  desc: string
  /** 投票状态: 4-已结束 */
  status: number
}

/**
 * B站通用卡片数据接口（游戏等）
 */
export interface BilibiliCommonData {
  /** 封面图 */
  cover: string
  /** 标题 */
  title: string
  /** 描述1（标签） */
  desc1: string
  /** 描述2（副标题） */
  desc2: string
  /** 按钮文本 */
  button_text?: string
  /** 头部文本（如"相关游戏"） */
  head_text?: string
  /** 子类型 */
  sub_type?: string
}

/**
 * B站视频跳转卡片数据接口（UGC）
 */
export interface BilibiliUgcData {
  /** 封面图 */
  cover: string
  /** 标题 */
  title: string
  /** 时长（如 "08:01"） */
  duration: string
  /** 播放量（如 "12.6万播放"） */
  play: string
  /** 弹幕数（如 "1061弹幕"） */
  danmaku: string
}

/**
 * B站相关内容卡片联合类型
 */
export interface BilibiliAdditionalData {
  /** 卡片类型 */
  type:
    | 'ADDITIONAL_TYPE_RESERVE'
    | 'ADDITIONAL_TYPE_VOTE'
    | 'ADDITIONAL_TYPE_COMMON'
    | 'ADDITIONAL_TYPE_UGC'
    | 'ADDITIONAL_TYPE_GOODS'
    | 'ADDITIONAL_TYPE_UPOWER_LOTTERY'
    | 'ADDITIONAL_TYPE_NONE'
  /** 预约数据 */
  reserve?: BilibiliReserveData
  /** 投票数据 */
  vote?: BilibiliVoteData
  /** 通用卡片数据 */
  common?: BilibiliCommonData
  /** 视频跳转数据 */
  ugc?: BilibiliUgcData
}

/**
 * B站动态内容组件属性接口
 */
export interface BilibiliDynamicContentProps {
  /** 图文动态标题 */
  title?: string
  /** 动态文本内容（富文本文档） */
  text: RichTextDocument | null
  /** 图片URL数组 */
  image_url: Array<{ image_src: string }>
  /** 是否使用深色主题 */
  useDarkTheme?: boolean
  /** 图片布局方式 */
  imageLayout: string
  /** 相关内容卡片 */
  additional?: BilibiliAdditionalData
}

/**
 * B站动态状态组件属性接口
 */
export interface BilibiliDynamicStatusProps {
  /** 点赞数 */
  dianzan: string | number
  /** 评论数 */
  pinglun: string | number
  /** 分享数 */
  share: string | number
  /** 渲染时间 */
  render_time: string
  /** 是否使用深色主题 */
  useDarkTheme?: boolean
}

/**
 * B站动态底部信息组件属性接口
 */
export interface BilibiliDynamicFooterProps {
  /** 用户短ID */
  user_shortid: string | number
  /** 获赞总数 */
  total_favorited: string | number
  /** 关注数 */
  following_count: string | number
  /** 粉丝数 */
  fans: string | number
  /** 动态类型 */
  dynamicTYPE: string
  /** 分享链接 */
  share_url: string
  /** 头像URL */
  avatar_url: string
  /** 头像框URL */
  frame?: string
  /** 用户名元数据 */
  usernameMeta: {
    /** 用户名 */
    name: string
    /** VIP状态，1为年度大会员 */
    vipStatus: number
    /** 昵称颜色 */
    nicknameColor: string | null
  }
  /** 是否使用深色主题 */
  useDarkTheme?: boolean
}

/**
 * B站纯文动态内容组件属性接口
 */
export interface BilibiliWordContentProps {
  /** 动态文本内容（富文本文档） */
  text: RichTextDocument | null
  /** 相关内容卡片 */
  additional?: BilibiliAdditionalData
}

/**
 * 原始内容AV类型接口
 */
export interface OriginalContentAV {
  /** 用户头像URL */
  avatar_url: string
  /** 头像框 */
  frame?: string
  /** 用户名元数据 */
  usernameMeta: UsernameMetadata
  /** 创建时间 */
  create_time: string
  /** 装饰卡片 */
  decoration_card?: DecorationCardData
  /** 视频封面 */
  cover: string
  /** 视频时长文本 */
  duration_text: string
  /** 播放量 */
  play: string
  /** 弹幕数 */
  danmaku: string
  /** 视频标题 */
  title: RichTextDocument
  /** 动态文本内容（富文本文档） */
  text: RichTextDocument
}

/**
 * 原始内容图文类型接口
 */
export interface OriginalContentDraw {
  /** 标题 */
  title?: string
  /** 用户头像URL */
  avatar_url: string
  /** 头像框 */
  frame?: string
  /** 用户名元数据 */
  usernameMeta: UsernameMetadata
  /** 创建时间 */
  create_time: string
  /** 装饰卡片 */
  decoration_card?: DecorationCardData
  /** 动态文本内容（富文本文档） */
  text: RichTextDocument
  /** 图片URL数组 */
  image_url: Array<{ image_src: string }>
}

/**
 * 原始内容文字类型接口
 */
export interface OriginalContentWord {
  /** 用户头像URL */
  avatar_url: string
  /** 头像框 */
  frame?: string
  /** 用户名元数据 */
  usernameMeta: UsernameMetadata
  /** 创建时间 */
  create_time: string
  /** 装饰卡片 */
  decoration_card?: DecorationCardData
  /** 动态文本内容（富文本文档） */
  text: RichTextDocument
  /** 相关内容卡片 */
  additional?: BilibiliAdditionalData
}

/**
 * 原始内容直播推荐类型接口
 */
export interface OriginalContentLiveRcmd {
  /** 用户头像URL */
  avatar_url: string
  /** 头像框 */
  frame?: string
  /** 用户名元数据 */
  usernameMeta: UsernameMetadata
  /** 创建时间 */
  create_time: string
  /** 装饰卡片 */
  decoration_card?: DecorationCardData
  /** 直播封面 */
  cover: string
  /** 分区名称 */
  area_name: string
  /** 大文本 */
  text_large: string
  /** 在线人数 */
  online: string
  /** 直播标题 */
  title: RichTextDocument
}

/**
 * 转发动态原始内容Props接口
 */
export interface BilibiliForwardOriginalContentProps {
  /** 原始内容 */
  original_content: {
    /** AV类型内容 */
    DYNAMIC_TYPE_AV?: OriginalContentAV
    /** 图文类型内容 */
    DYNAMIC_TYPE_DRAW?: OriginalContentDraw
    /** 文字类型内容 */
    DYNAMIC_TYPE_WORD?: OriginalContentWord
    /** 直播推荐类型内容 */
    DYNAMIC_TYPE_LIVE_RCMD?: OriginalContentLiveRcmd
  }
}

/**
 * 转发动态内容Props接口
 */
export interface BilibiliForwardContentProps {
  /** 动态文本内容（富文本文档） */
  text: RichTextDocument
  /** 原始内容 */
  original_content: BilibiliForwardOriginalContentProps['original_content']
}

/**
 * B站直播动态内容组件属性接口
 */
export interface BilibiliLiveDynamicContentProps {
  /** 直播封面 */
  image_url: string
  /** 直播标题 */
  text: RichTextDocument
  /** 直播房间信息（分区 | 房间号） */
  liveinf: string
  /** 用户名元数据 */
  usernameMeta: UsernameMetadata
  avatar_url: string
  frame?: string
  fans: string
  /** 时间信息 */
  create_time: string
}

/**
 * B站直播动态底部信息组件属性接口
 */
export interface BilibiliLiveDynamicFooterProps {
  /** 用户头像URL */
  avatar_url: string
  /** 头像框 */
  frame?: string
  /** 用户名元数据 */
  usernameMeta: UsernameMetadata
  /** 粉丝数 */
  fans: string
  /** 动态类型 */
  dynamicTYPE: string
  /** 分享链接 */
  share_url: string
}
