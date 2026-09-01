/**
 * B站平台的类型声明。
 *
 * 从 `bilibili.ts` 与 `push.ts` 搬过来的接口与别名，形状保持原样。两个文件里同名不同形状的
 * 那几个，push 侧统一加 `Push` 前缀区分；`bilibili.ts` 里跟 `getid.ts` 撞名的两个宽松副本
 * 改叫 `BilibiliResource*`，因为 barrel 里 `getid.js` 的那份才是规范定义。
 */

import type { bilibiliComments } from './comments.js'
import type { BilibiliArticleCategoryInput, BilibiliDescV2Item, buildBilibiliArticleRichText, formatBilibiliVideoDescRichText } from './dynamicText.js'
import type { BilibiliFilterPushItem } from '@/module/db/bilibili'
import type { Render } from '@/module/utils/index'
import type { BaseEvent } from '@/module/utils/types'
import type { MessageEvent } from '@/types/message'

// ==================== 来自 bilibili.ts ====================

export interface AmagiRuntime {
  bilibiliApiUrls: {
    getBangumiStream: (params: { cid: number, ep_id: string }) => string
  }
  DynamicType: Record<string, string>
  AdditionalType: Record<string, string>
}

export interface BilibiliVideoStream {
  id: number
  base_url?: string
  url?: string
  size?: number
  [key: string]: unknown
}

export type BilibiliResourceDataType =
  | 'one_video'
  | 'bangumi_video_info'
  | 'dynamic_info'
  | 'live_room_detail'
  | 'undefined'
  | string

export interface BilibiliResourceIdData {
  type: BilibiliResourceDataType
  Episode?: string
  bvid?: string
  p?: number
  isEpid?: boolean
  realid?: string
  dynamic_id?: string
  room_id?: string
}

export interface BilibiliConstructorData extends Partial<BilibiliResourceIdData> {
  USER?: { STATUS?: string }
}

export type BilibiliEvent = BaseEvent & {
  reply: (message: unknown, options?: unknown) => Promise<unknown>
}

export interface BilibiliDash {
  video?: Array<BilibiliVideoStream & { base_url: string }>
  audio?: Array<{ base_url?: string }>
}

export interface BilibiliPayload {
  accept_description?: string[]
  durl?: BilibiliVideoStream[]
  dash?: BilibiliDash
}

export interface ApiEnvelope<T> {
  code?: number | string
  message?: string
  data: T
}

export interface VideoPage {
  cid: number
  duration: number
}

export interface VideoOwner {
  mid: number | string
  name: string
  face: string
  [key: string]: unknown
}

export interface VideoStat {
  coin: number
  like: number
  share: number
  view: number
  favorite: number
  danmaku: number
  reply: number
  /**
   * 下面这几个 view 接口也会返回，但模板只读上面 7 个。
   * 声明成可选是为了让 `bilibili/videoInfo` 的契约（13 个必填）能在调用点补齐兜底值，
   * 而不是假装接口一定给。
   */
  aid?: number
  now_rank?: number
  his_rank?: number
  dislike?: number
  evaluation?: string
  vt?: number
  [key: string]: unknown
}

export interface VideoInfoData {
  aid: number
  bvid: string
  cid: number
  duration: number
  pages: VideoPage[]
  owner: VideoOwner
  pic: string
  title: string
  stat: VideoStat
  desc: string
  desc_v2?: Parameters<typeof formatBilibiliVideoDescRichText>[0]
  ctime: number
}

export type VideoInfoResponse = ApiEnvelope<{ data: VideoInfoData }>

export interface UserCard {
  name: string
  face: string
  mid: number | string
  attention: number
  fans: number
  pendant: { image?: string }
  vip: { status?: number, nickname_color?: string }
  [key: string]: unknown
}

export interface UserProfileData {
  card: UserCard
  follower: number
  like_num: number
}

export type UserProfileResponse = ApiEnvelope<{ data: UserProfileData, card: UserCard }>

export type CommentsPayload = NonNullable<Parameters<typeof bilibiliComments>[0]>

export type CommentsResponse = ApiEnvelope<CommentsPayload>

export interface BangumiEpisode {
  long_title?: string
  badge?: string
  /** 徽章配色，pgc 接口原样给出，`bilibili/bangumi` 契约要求必填 */
  badge_info?: { bg_color?: string, bg_color_night?: string, text?: string }
  bvid?: string
  cover?: string
  link?: string
  /** 发布时间戳（秒），模板按它把剧集分组到时间轴上 */
  pub_time?: number
  short_link?: string
  share_copy?: string
  cid?: number
  ep_id: number | string
}

/** 番剧 UP 主信息，字段名与 pgc 接口的 `result.up_info` 对齐 */
export interface BangumiUpInfo {
  avatar: string
  avatar_subscript_url: string
  follower: number
  is_follow: number
  mid: number
  nickname_color: string
  pendant: { image: string, name: string, pid: number }
  theme_type: number
  uname: string
  verify_type: number
  vip_label: { bg_color: string, bg_style: number, border_color: string, text: string, text_color: string }
  vip_status: number
  vip_type: number
}

/** 番剧统计，模板无守卫地读 views / favorites / danmakus / coins */
export interface BangumiStat {
  coins?: number
  danmakus?: number
  favorite?: number
  favorites?: number
  follow_text?: string
  likes?: number
  reply?: number
  share?: number
  views?: number
  vt?: number
}

export interface BangumiInfoData {
  episodes: BangumiEpisode[]
  title: string
  season_title: string
  season_id: number | string
  actors?: string
  cover?: string
  evaluate?: string
  link?: string
  new_ep?: { desc?: string, id?: number, is_new?: number, title?: string }
  stat?: BangumiStat
  styles?: string[]
  subtitle?: string
  /**
   * pgc 接口对自制/独播番剧给 `up_info`，外购番剧可能整个缺失。
   * 契约把 UPInfo 写成必填，但模板两处消费都带守卫
   * （`props.upInfo && …` 和 `props.UPInfo ? … : props.mainCover`），
   * 所以真缺了只是不显示这一块，不会炸。
   */
  up_info?: BangumiUpInfo
}

export interface BangumiInfoResponse {
  code?: number | string
  message?: string
  data?: { result: BangumiInfoData }
}

export interface BangumiPlayResponse {
  result: {
    /**
     * 复用 `BilibiliDash`，不再自己写一份。
     *
     * 这里曾经是 `audio: [{ base_url: string }, ...]` 这个非空元组，于是
     * `dash.audio[0]` 在类型上完全合法（`noUncheckedIndexedAccess` 不给元组 0 号位
     * 补 `undefined`），而番剧这条分支没有 fan-out，取不到音轨就是整条解析失败。
     * 普通视频路径走的一直是 `BilibiliDash`（audio 可选），两条路对同一个接口
     * 给出两种形状本身就是 bug 源。
     */
    dash: BilibiliDash
    accept_description?: string[]
    cept_description?: string[]
  }
}

export interface BilibiliDanmakuItem {
  progress: number
  mode: number
  fontsize: number
  color: number
  content: string
}

export interface GetVideoInput {
  infoData?: { data: VideoInfoData } | { result: BangumiInfoData }
  playUrlData: unknown
  danmakuList?: BilibiliDanmakuItem[]
}

export interface RichTextNode {
  orig_text?: string
  jump_url?: string
  text?: string
  type?: string
  [key: string]: unknown
}

export interface DynamicSummary {
  text?: string
  rich_text_nodes: RichTextNode[]
}

export interface DynamicPicture {
  url?: string
  live_url?: string
  img_src?: string
  src?: string
}

export interface DynamicDecoration {
  card_url?: string
  fan: {
    color_format?: { colors?: string[] }
    num_str?: string
    num_desc?: string
  }
}

export interface DynamicAuthor extends UserCard {
  pub_action?: string
  pub_time: string
  pub_ts: number
  decoration_card?: DynamicDecoration
  decorate?: DynamicDecoration
}

export interface DynamicMajor {
  type?: string
  opus: { pics: DynamicPicture[], summary: DynamicSummary }
  draw?: { items?: DynamicPicture[] }
  archive: {
    bvid: string
    duration_text: string
    title: string
    cover: string
    stat: { danmaku: number, view: number, play: number }
  }
  live_rcmd: { content: string }
  article?: { id?: number | string, title?: string }
}

/** 相关内容卡片的按钮。视频预约、游戏卡只给 `jump_style`；直播预约、追番卡按 `status` 在两套文案里选。 */
export interface DynamicAdditionalButton {
  /** 1：未选中，用 `uncheck`；2：已选中，用 `check` */
  status?: number
  check?: { text?: string }
  uncheck?: { text?: string }
  jump_style?: { text?: string }
}

/** 动态的相关内容卡片。四个子对象按 `type` 互斥出现，其余类型（商品、赛事、充电抽奖）这里不声明。 */
export interface DynamicAdditional {
  type: string
  reserve?: {
    title?: string
    /** 预约时间，如「11-05 20:00 直播」 */
    desc1?: { text?: string }
    /** 预约观看量。`visible` 为 false 时该换成「已结束」 */
    desc2?: { text?: string, visible?: boolean }
    /** 预约有奖信息 */
    desc3?: { text?: string }
    button?: DynamicAdditionalButton
  }
  vote?: {
    title?: string
    /** 投票标题的另一处来源，`title` 缺失时用它 */
    desc?: string
    /** 已参与人数 */
    join_num?: number
    /** 4：已结束 */
    status?: number
  }
  common?: {
    cover?: string
    title?: string
    desc1?: string
    desc2?: string
    head_text?: string
    /** `game` / `decoration` / `ogv` */
    sub_type?: string
    button?: DynamicAdditionalButton
  }
  ugc?: {
    cover?: string
    title?: string
    duration?: string
    /** 播放量与弹幕数合在一起，形如「8054播放 · 15弹幕」 */
    desc_second?: string
  }
}

export interface DynamicModules {
  module_author: DynamicAuthor
  module_dynamic: {
    major: DynamicMajor
    desc: { text: string, rich_text_nodes: RichTextNode[] }
    topic?: { name?: string } | null
    additional?: DynamicAdditional | null
  }
  module_stat: {
    like: { count: number }
    comment: { count: number }
    forward: { count: number }
  }
}

export interface DynamicItem {
  type: string
  id_str: string
  basic?: {
    comment_id_str?: string
    rid_str?: string
    rid?: number | string
  }
  modules: DynamicModules
  orig: DynamicItem
}

export interface DynamicDetailData {
  item: DynamicItem
  card?: UserCard
  follower: number
}

export type DynamicInfoResponse = ApiEnvelope<{
  data: DynamicDetailData
  /** 兼容旧版 Amagi 转发动态的少一层 data 结构 */
  item: DynamicItem
}>

export interface LiveCardData {
  live_play_info: {
    cover: string
    title: string
    area_name: string
    room_id: number | string
    online: number
    watched_show: { text_large: string }
  }
}

export interface ArticleStats {
  view?: number
  like?: number
  favorite?: number
  reply?: number
  dynamic?: number
  share?: number
  coin?: number
}

export interface ArticleData {
  title?: string
  summary?: string
  banner_url?: string
  image_urls?: string[]
  categories?: BilibiliArticleCategoryInput[]
  words?: number
  stats?: ArticleStats
}

export type ArticleContent = {
  opus?: NonNullable<Parameters<typeof buildBilibiliArticleRichText>[0]>
  content?: string
  dyn_id_str?: string
  id?: number | string
}

export type ArticleInfoResponse = ApiEnvelope<{ data: ArticleData }>

export type ArticleContentResponse = ApiEnvelope<{ data: ArticleContent }>

export interface LiveInfoData {
  user_cover: string
  title: string
  area_name: string
  room_id: number | string
  live_time: string
}

export interface RoomInitData {
  uid: number | string
  live_status: number
}

export type LiveInfoResponse = ApiEnvelope<{ data: LiveInfoData }>

export type RoomInitResponse = ApiEnvelope<{ data: RoomInitData }>

/** 流对象上可用的地址：`base_url` 加接口给的备用地址（`backup_url` 通常是 upos / akamai 正常域名）。 */
export interface BilibiliStreamUrls {
  base_url?: string
  /**
   * `durl` 那一路流把地址放在这个键上（dash 用的是 `base_url`）。
   *
   * 两个键都认是必要的：未登录 / ck 失效时接口回的是 durl，而那条路恰恰最常撞上 PCDN
   * （请求「看起来没有身份」时 B站 更倾向把地址指到 PCDN 节点）。只读 `base_url`
   * 会让 durl 的主地址整条漏掉，只剩 `backup_url` 被当成候选。
   */
  url?: string
  backup_url?: string[]
}

export type LegacyBilibiliContent = '提示信息' | '评论图' | '视频' | '简介' | '动态'

export type ModernBilibiliContent = 'info' | 'comment' | 'video'

/**
 * 粉丝装饰卡片数据。
 *
 * 这是 `ktr/template/bilibili/dynamic/types.ts` 里 `DecorationCardData` 的手抄副本
 * （`ktr/**` 的 .ts 进不了根 program，理由见 contracts/template-data-map.ts）。
 * 两边由 contracts/hand-copied-contracts.ts 的断言钉住，形状对不上就编译报错。
 */
export interface BilibiliDecorationCard {
  card_url: string
  colors: string[]
  text: string
}

export interface DynamicOidData {
  data: {
    item: {
      type: string
      id_str: string
      basic?: { comment_id_str?: string, rid_str?: string }
    }
  }
}

export interface BilibiliQualityOptions {
  qn?: number
  maxAutoVideoSize?: number
  bvid: string
  accept_description: string[]
}

export interface BilibiliQualityResult<T extends BilibiliVideoStream> {
  accept_description: string[]
  videoList: T[]
  /**
   * 本仓库比上游多返回的字段。上游只返回 accept_description + videoList，
   * 调用方要显示「实际发出去的画质」就得自己再从 accept_description[0] 反推，
   * 而自动挡下 accept_description 被 filter 改写过、可能与真正选中的流不一致。
   * 这里直接把选中的那一档带出来，供视频信息卡片的 Clarity 字段使用。
   */
  selectedQuality: string
}

// ==================== 来自 push.ts ====================

export interface PushAmagiRuntime {
  DynamicType: {
    AV: string
    DRAW: string
    WORD: string
    LIVE_RCMD: string
    FORWARD: string
    ARTICLE: string
    [key: string]: string
  }
  MajorType: {
    DRAW: string
    OPUS: string
    LIVE_RCMD: string
    [key: string]: string
  }
}

export interface DynamicRichTextNode {
  type?: string
  orig_text?: string
  text?: string
  rid?: string
}

export interface DynamicImage {
  src?: string
  url?: string
  live_url?: string
}

export interface PushDynamicDecoration {
  card_url?: string
  fan: {
    color_format?: { colors?: string[] }
    num_desc?: string
    num_str?: string
  }
}

export interface PushDynamicMajor {
  type?: string
  archive?: {
    bvid?: string
    cover?: string
    duration_text?: string
    stat?: { danmaku?: number, play?: number }
    title?: string
  }
  article?: { id?: string | number, title?: string }
  draw?: { items?: DynamicImage[] }
  live_rcmd?: { content?: string }
  opus?: {
    pics?: DynamicImage[]
    summary?: { rich_text_nodes?: DynamicRichTextNode[], text?: string }
  }
}

export interface DynamicModule {
  desc?: { rich_text_nodes?: DynamicRichTextNode[], text?: string }
  major?: PushDynamicMajor
  topic?: { id?: string | number, name?: string } | null
}

export interface PushDynamicAuthor {
  decoration_card?: PushDynamicDecoration
  decorate?: PushDynamicDecoration
  face: string
  mid: number
  name: string
  pendant: { image: string }
  pub_action?: string
  pub_time?: string
  pub_ts: number
}

export interface DynamicStats {
  comment: { count: number }
  forward: { count: number }
  like: { count: number }
}

export interface BilibiliDynamicPayload {
  basic?: { rid?: number, rid_str?: string }
  id_str: string
  modules: {
    module_author: PushDynamicAuthor
    module_dynamic: DynamicModule
    module_stat: DynamicStats
    module_tag?: { text?: string }
  }
  orig: BilibiliDynamicPayload
  type: string
}

export interface BiliUserDynamic {
  data: { items: BilibiliDynamicPayload[] }
}

export interface BiliUserProfile {
  data: {
    card: {
      attention: number
      face: string
      mid: number
      name: string
      vip: { nickname_color?: string, status?: number }
    }
    follower: number
    like_num: number
  }
}

export interface BilibiliUserLiveStatus {
  data: {
    roomStatus: number
    liveStatus: number
    roomid: number
    cover?: string
    title?: string
  }
}

export interface BilibiliLiveRoomInfo {
  data: {
    live_status: number
    live_time: string
    room_id: number
    area_name?: string
    user_cover?: string
    title?: string
    online?: number
    watched_show?: { text_large?: string }
  }
}

export type BilibiliDynamicItem = BiliUserDynamic['data']['items'][number]

export type RenderResult = Awaited<ReturnType<typeof Render>>

export type BotClient = NonNullable<(typeof Bot)[string]>

export type BotGroup = ReturnType<BotClient['pickGroup']>

export type GroupSendable = Parameters<BotGroup['sendMsg']>[0]

export type ForwardNodes = Parameters<typeof Bot.makeForwardMsg>[0]

export interface BilibiliPushEvent extends MessageEvent {
  group_name?: string
}

export interface BilibiliPushTarget {
  groupId: string
  botId: string
}

export type BilibiliPushEntry = Omit<BilibiliFilterPushItem, 'Dynamic_Data'> & {
  remark: string
  create_time: number
  targets: BilibiliPushTarget[]
  Dynamic_Data: BilibiliDynamicItem & BilibiliFilterPushItem['Dynamic_Data']
  avatar_img: string
  dynamic_type: string
}

export type WillBePushList = Record<string, BilibiliPushEntry>

export interface AmagiResponse<T> {
  data: T
}

export interface BilibiliVideoInfo {
  aid: number
  bvid: string
  cid: number
  ctime: number
  desc: string
  /** 结构化简介，走 formatBilibiliVideoDescRichText；缺失时回落到 desc */
  desc_v2?: BilibiliDescV2Item[]
  /** 分P列表，模板只用它的长度 */
  pages?: unknown[]
  pic: string
  redirect_url?: string
  title: string
  owner: { face: string, name: string }
  stat: { coin: number, like: number, reply: number, share: number, view: number }
}

export interface BilibiliArticleInfo {
  banner_url?: string
  categories?: BilibiliArticleCategoryInput[]
  image_urls?: string[]
  summary?: string
  title?: string
  words?: number
  stats?: {
    dynamic?: number
    favorite?: number
    like?: number
    reply?: number
    share?: number
    view?: number
    coin?: number
  }
}

export type BilibiliArticleContent = {
  opus?: Parameters<typeof buildBilibiliArticleRichText>[0]
  content?: string
  dyn_id_str?: string
  id?: string | number
}

export interface BilibiliLiveCard {
  live_play_info: {
    area_name: string
    cover: string
    online: number
    room_id: string | number
    title: string
    watched_show: { text_large: string }
  }
}
