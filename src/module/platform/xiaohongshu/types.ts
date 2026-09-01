/** 小红书笔记 ID 解析结果 */
export interface XiaohongshuNoteId {
  type: 'note'
  note_id: string
  xsec_token?: string
}

/** 小红书表情项 */
export interface XiaohongshuEmoji {
  name: string
  url?: string
}

/** 评论用户信息 */
export interface XiaohongshuUserInfo {
  nickname?: string
  nick_name?: string
  user_id?: string
  id?: string
  image?: string
  avatar?: string
  avatar_url?: string
  avatar_url_default?: string
  xsec_token?: string
}

/** 图片资源，可能是字符串或多种字段的对象 */
export type XiaohongshuPicture = string | {
  height?: number | string
  width?: number | string
  url_default?: string
  url_pre?: string
  url?: string
  info_list?: Array<{ image_scene?: string, url?: string }>
}

/** @ 用户项 */
export type XiaohongshuAtUser = string | {
  nickname?: string
  user_info?: { nickname?: string }
}

/** 评论标签项 */
export type XiaohongshuTag = string | { name?: string, tag?: string }

/** 评论原始数据 */
export interface XiaohongshuComment {
  id?: string
  comment_id?: string
  note_id?: string
  user_info?: XiaohongshuUserInfo
  content?: string
  at_users?: XiaohongshuAtUser[]
  create_time?: number | string
  ip_location?: string
  like_count?: number | string
  liked?: boolean
  status?: number | string
  show_tags?: XiaohongshuTag[]
  sub_comment_count?: number
  pictures?: XiaohongshuPicture[]
  sub_comments?: XiaohongshuComment[]
}

/** 小红书图片项中被实况图逻辑读取的字段 */
export interface XiaohongshuImageItem {
  url_default?: string
  url_pre?: string
  url?: string
  info_list?: Array<{ url?: string }>
  live_photo?: boolean
  stream?: XiaohongshuStreamData
}

/** 实况图视频流 */
export interface XiaohongshuLiveVideo {
  master_url?: string
  width?: number
  height?: number
  size?: number
}

/** 按编码分组的视频流 */
export type XiaohongshuStreamData = Partial<Record<'h264' | 'h265' | 'av1' | 'h266', XiaohongshuLiveVideo[]>>
