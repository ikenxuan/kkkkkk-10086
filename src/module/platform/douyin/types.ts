/**
 * 抖音平台的类型声明。
 *
 * 从 `douyin.ts` 与 `push.ts` 搬过来的接口与别名，形状保持原样。两个文件里同名不同形状的
 * 那几个，push 侧统一加 `Push` 前缀区分。
 */

import type { douyinComments } from './comments.js'
import type { DouyinDanmakuElem } from './danmaku.js'
import type { DouyinDataType, DouyinIdData } from './getid.js'
import type { DouyinLiveItem, DouyinRoomData } from './live.js'
import type { DouyinAweme as WorkTypeDouyinAweme, DouyinLiveImageVideo } from './workType.js'
import type { DouyinFilterPushItem } from '@/module/db/douyin'
import type { Base, UploadRecord } from '@/module/utils/index'
import type { BaseEvent } from '@/module/utils/types'
import type { DouyinPushType } from '@/types/database'
import type { DyEmojiList } from '@ikenxuan/amagi'

// ==================== 来自 douyin.ts ====================

export interface UrlResource {
  uri?: string
  url_list: string[]
}

export interface PlayAddress extends UrlResource {
  data_size: number
  /** 该码率下的实际宽高，评论图页头的「分辨率」用这两个字段 */
  width?: number
  height?: number
}

export interface DyVideo {
  FPS?: number
  format: string
  play_addr: PlayAddress
  /** 梯级名，`definition` 缺失时的兜底判据，也是 HDR 标记的所在 */
  gear_name?: string
  /** 位深，HDR 档为 `'10'` */
  HDR_bit?: string
  HDR_type?: string
  /** JSON 字符串，里面的 `definition` 是官方档位名，挑清晰度的主判据 */
  video_extra?: string
}

export interface DouyinMusic {
  author?: string
  cover_hd?: UrlResource
  cover_large?: UrlResource
  cover_thumb?: UrlResource
  play_url?: UrlResource
  extra?: string
  title?: string
}

export interface DouyinLiveImageItem {
  clip_type?: number
  url_list: string[]
  video?: {
    play_addr_h264?: UrlResource
    play_addr?: UrlResource
  }
}

export interface DouyinUser {
  avatar_larger: UrlResource
  avatar_thumb?: UrlResource
  aweme_count?: number
  cover_and_head_image_info?: {
    profile_cover_list?: Array<{ cover_url?: UrlResource }>
  }
  custom_verify?: string
  enterprise_verify_reason?: string
  follower_count?: number
  following_count?: number
  ip_location?: string
  live_status?: number
  mplatform_followers_count?: number
  nickname?: string
  room_data?: string
  /** 直播间的内部房间号，「直播间信息数据」的 room_id 参数要用它（web_rid 是另一个号） */
  room_id_str?: string
  sec_uid?: string
  short_id?: string
  signature?: string
  total_favorited?: number
  unique_id?: string
}

export interface DouyinMusicInfo {
  author: string
  avatar_large?: UrlResource
  cover_hd: UrlResource
  id: string
  original_musician_display_name?: string
  owner_nickname: string
  play_url?: UrlResource
  sec_uid: string
  title: string
  user_count?: number
}

export interface LivePartition {
  partition?: { title?: string }
}

export interface DouyinVideo {
  animated_cover?: UrlResource
  bit_rate: [DyVideo, ...DyVideo[]]
  cover?: UrlResource
  cover_original_scale?: UrlResource
  duration?: number
  dynamic_cover?: UrlResource
  height?: number
  origin_cover?: UrlResource
  play_addr: PlayAddress
  play_addr_h264: PlayAddress
  ratio?: string
  width?: number
}

export interface DouyinStatistics {
  collect_count?: number
  comment_count?: number
  digg_count?: number
  recommend_count?: number
  share_count?: number
}

export interface DouyinAweme extends WorkTypeDouyinAweme {
  article_info?: WorkTypeDouyinAweme['article_info'] & { article_title?: string }
  author: DouyinUser
  aweme_id: string
  create_time: number
  desc?: string
  images?: DouyinLiveImageItem[]
  is_slides?: boolean
  is_top?: number
  item_title?: string
  music?: DouyinMusic
  preview_title: string
  /** 作品归属地区，评论图页头要显示 */
  region?: string
  share_url?: string
  statistics: DouyinStatistics
  /** 「大家都在搜」，评论图底部的相关搜索来自这里 */
  suggest_words?: {
    suggest_words?: Array<{
      scene?: string
      words?: Array<{ word?: string }>
    }>
  }
  video: DouyinVideo
}

export type DouyinResourceType = DouyinDataType

export type BaseDouyinEvent = NonNullable<ConstructorParameters<typeof Base>[0]>

export type DouyinEvent = BaseDouyinEvent & {
  message_id?: string | number
}

export type DouyinRuntimeEvent = DouyinEvent & {
  reply: (...args: unknown[]) => Promise<unknown>
}

export type DouyinConstructorData = Omit<DouyinIdData, 'type'> & { type: string }

export type CommentsPayload = Parameters<typeof douyinComments>[0]

export type DanmakuList = readonly DouyinDanmakuElem[]

export type UploadRecordEvent = Parameters<typeof UploadRecord>[0]

export type LegacyContent = '提示信息' | '评论图' | '视频' | '背景音乐' | '图集'

export type ModernContent = 'info' | 'comment' | 'video'

export interface WorkResponse {
  data: { aweme_detail: DouyinAweme }
}

export interface NullableWorkResponse {
  data: { aweme_detail: DouyinAweme | null }
}

export interface UserInfoResponse {
  data: { user: DouyinUser }
}

export interface UserVideoListResponse {
  data?: { aweme_list?: DouyinAweme[] }
  aweme_list?: DouyinAweme[]
}

export interface MusicResponse {
  data: { music_info: DouyinMusicInfo }
}

export interface DanmakuResponse {
  data?: { danmaku_list?: DanmakuList }
  danmaku_list?: DanmakuList
}

export interface EmojiResponse {
  data: DyEmojiList
}

export interface LiveResponse {
  data: Record<string, unknown>
}

// ==================== 来自 push.ts ====================

/** 作品里的话题标签 */
export interface DouyinTextExtra {
  hashtag_name?: string
}

/** 作品背景音乐，取播放地址时用到的字段 */
export interface PushDouyinMusic {
  play_url?: { uri?: string }
  /** 原曲信息，抖音以 JSON 字符串下发 */
  extra?: string
}

/** 图集中的单张 Live 图，取视频地址时用到的字段 */
export interface PushDouyinLiveImageItem {
  clip_type?: number
  url_list?: string[]
  video?: DouyinLiveImageVideo
}

export interface DouyinPushEvent extends BaseEvent {
  group_id?: string | number
  groupId?: string | number
  self_id?: string | number
  selfId?: string | number
  group_name?: string
  msg?: string
}

export interface PushTarget {
  groupId: string
  botId: string
}

export interface DouyinAvatar {
  uri?: string
  url_list?: string[]
}

export interface PushDouyinUser {
  sec_uid?: string
  unique_id?: string
  short_id?: string
  nickname?: string
  avatar_larger?: DouyinAvatar
  follower_count?: number
  total_favorited?: number
  following_count?: number
  live_status?: number
  room_data?: string
  room_id_str?: string
}

export interface DouyinProfileUser extends PushDouyinUser {
  nickname: string
  avatar_larger: DouyinAvatar
  /** 账号已注销/封禁时抖音返回 special_state=1，配合 user_deleted 判定 */
  special_state_info?: { special_state?: number, title?: string }
  user_deleted?: boolean
}

export interface DouyinProfileResponse {
  data: { user: DouyinProfileUser }
}

export interface DouyinSearchUser extends PushDouyinUser {
  user_info?: PushDouyinUser
}

export interface DouyinSearchCard {
  card_unique_name?: string
  user_list?: DouyinSearchUser[]
}

export interface DouyinSearchResponse {
  data?: DouyinSearchCard[] | { user_list?: DouyinSearchUser[] }
}

export interface DouyinVideoAddress {
  uri?: string
  url_list?: string[]
}

export interface DouyinBitRate {
  format?: string
  gear_name?: string
  HDR_bit?: string
  HDR_type?: string
  video_extra?: string
  /** 挑源要按体积排序，所以这一层必须带上 data_size */
  play_addr: DouyinVideoAddress & { data_size: number }
}

export interface PushDouyinAweme {
  aweme_id: string
  create_time: number
  is_top?: number
  author?: PushDouyinUser
  share_url?: string
  desc?: string
  statistics?: {
    digg_count?: number
    comment_count?: number
    share_count?: number
    collect_count?: number
  }
  video?: {
    play_addr?: DouyinVideoAddress
    play_addr_h264?: DouyinVideoAddress
    bit_rate?: DouyinBitRate[]
  }
  music?: PushDouyinMusic
  images?: PushDouyinLiveImageItem[]
}

export interface DouyinLiveInfo {
  data?: {
    data?: DouyinLiveItem[] | DouyinLivePayload
    partition_road_map?: { partition?: { title?: string } }
  }
}

export interface DouyinLivePayload {
  data?: DouyinLiveItem[]
  partition_road_map?: { partition?: { title?: string } }
}

export interface DouyinDetailData extends Omit<PushDouyinAweme, 'aweme_id' | 'create_time'> {
  aweme_id?: string
  create_time?: number
  user_info: DouyinProfileResponse
  source_user_info?: DouyinProfileResponse
  room_data?: DouyinRoomData
  live_data?: DouyinLiveInfo
  liveStatus?: { liveStatus: 'open' | 'close', isChanged?: boolean, isliving?: boolean }
  text_extra?: DouyinTextExtra[]
}

export interface DouyinWorkDetailData extends DouyinDetailData {
  aweme_id: string
  share_url: string
  desc: string
  author: PushDouyinUser & { nickname: string }
  statistics: NonNullable<PushDouyinAweme['statistics']>
  video: {
    play_addr: DouyinVideoAddress & { uri: string }
    play_addr_h264: DouyinVideoAddress & { url_list: string[] }
    bit_rate: DouyinBitRate[]
  }
}

export interface DouyinPushItem extends DouyinFilterPushItem {
  remark: string
  sec_uid: string
  create_time: number
  targets: PushTarget[]
  pushType?: DouyinPushType
  Detail_Data: DouyinDetailData
  avatar_img: string
  living: boolean
}

export type WillBePushList = Record<string, DouyinPushItem>

export interface DouyinListResponse {
  data?: { aweme_list?: PushDouyinAweme[] }
}

/** `skipDynamic` 读取的推送项字段：数据库过滤所需字段 + 直播标记与话题标签 */
export interface DouyinSkipCheckItem extends DouyinFilterPushItem {
  Detail_Data: DouyinFilterPushItem['Detail_Data'] & {
    liveStatus?: { liveStatus: 'open' | 'close', isChanged?: boolean, isliving?: boolean }
    text_extra?: DouyinTextExtra[]
  }
}
