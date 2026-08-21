/* eslint-disable indent */
import { Base, Render, Config, Networks, mergeFile, Common, baseHeaders, downloadFile, uploadFile, downloadVideo, processImageUrl } from '@/module/utils/index'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { getBilibiliData } from './api.js'
import { burnDanmaku } from '@/module/platform/common/danmaku'
import common from '@/runtime/host/common'
import { bilibiliComments, checkCk, genParams } from './index.js'
import {
  buildBilibiliArticleCategories,
  buildBilibiliArticleRichText,
  buildBilibiliRichTextForwardNodes,
  formatBilibiliDynamicRichText,
  formatBilibiliVideoDescRichText,
  getHotBilibiliDanmaku,
  getUsernameMetadata
} from './dynamicText.js'
import type { BilibiliArticleCategoryInput } from './dynamicText.js'
import { extractBilibiliArticleImages } from './article.js'
import { createBilibiliRichTextForwardMessage } from './richtext-message.js'
import { buildLivePhotoMessages as buildCommonLivePhotoMessages, buildLivePhotoTipMessage } from '@/module/platform/common/livePhoto'
import { runMediaTasks } from '@/module/utils/MediaTasks'
import fs from 'fs'
import type { BaseEvent } from '@/module/utils/Base'
import type { RichTextDocument } from '@kkk/richtext'

const require = createRequire(import.meta.url)
interface AmagiRuntime {
  bilibiliApiUrls: {
    getBangumiStream: (params: { cid: number, ep_id: string }) => string
  }
  DynamicType: Record<string, string>
  AdditionalType: Record<string, string>
}
const loadAmagiRuntime = (): AmagiRuntime => {
  try {
    return require('@ikenxuan/amagi') as AmagiRuntime
  } catch {
    // Vite 会错误地跟随 amagi 的开发入口；从稳定导出的 axios 子路径定位 CJS 产物。
    const axiosEntry = require.resolve('@ikenxuan/amagi/axios')
    return require(resolve(axiosEntry, '../../default/index.cjs')) as AmagiRuntime
  }
}
const { bilibiliApiUrls, DynamicType, AdditionalType } = loadAmagiRuntime()

export interface BilibiliVideoStream {
  id: number
  base_url?: string
  url?: string
  size?: number
  [key: string]: unknown
}

type BilibiliDataType =
  | 'one_video'
  | 'bangumi_video_info'
  | 'dynamic_info'
  | 'live_room_detail'
  | 'undefined'
  | string

interface BilibiliIdData {
  type: BilibiliDataType
  Episode?: string
  bvid?: string
  p?: number
  isEpid?: boolean
  realid?: string
  dynamic_id?: string
  room_id?: string
}

interface BilibiliConstructorData extends Partial<BilibiliIdData> {
  USER?: { STATUS?: string }
}

type BilibiliEvent = BaseEvent & {
  reply: (message: unknown, options?: unknown) => Promise<unknown>
}

interface BilibiliDash {
  video?: Array<BilibiliVideoStream & { base_url: string }>
  audio?: Array<{ base_url?: string }>
}

interface BilibiliPayload {
  accept_description?: string[]
  durl?: BilibiliVideoStream[]
  dash?: BilibiliDash
}

interface ApiEnvelope<T> {
  code?: number | string
  message?: string
  data: T
}

interface VideoPage {
  cid: number
  duration: number
}

interface VideoOwner {
  mid: number | string
  name: string
  face: string
  [key: string]: unknown
}

interface VideoStat {
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

interface VideoInfoData {
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

type VideoInfoResponse = ApiEnvelope<{ data: VideoInfoData }>

interface UserCard {
  name: string
  face: string
  mid: number | string
  attention: number
  fans: number
  pendant: { image?: string }
  vip: { status?: number, nickname_color?: string }
  [key: string]: unknown
}

interface UserProfileData {
  card: UserCard
  follower: number
  like_num: number
}

type UserProfileResponse = ApiEnvelope<{ data: UserProfileData, card: UserCard }>
type CommentsPayload = NonNullable<Parameters<typeof bilibiliComments>[0]>
type CommentsResponse = ApiEnvelope<CommentsPayload>

interface BangumiEpisode {
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
interface BangumiUpInfo {
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
interface BangumiStat {
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

interface BangumiInfoData {
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

interface BangumiInfoResponse {
  code?: number | string
  message?: string
  data?: { result: BangumiInfoData }
}

interface BangumiPlayResponse {
  result: {
    dash: {
      video: Array<BilibiliVideoStream & { base_url: string }>
      audio: [{ base_url: string }, ...Array<{ base_url: string }>]
    }
    accept_description: string[]
    cept_description?: string[]
  }
}

interface BilibiliDanmakuItem {
  progress: number
  mode: number
  fontsize: number
  color: number
  content: string
}

interface GetVideoInput {
  infoData?: { data: VideoInfoData } | { result: BangumiInfoData }
  playUrlData: unknown
  danmakuList?: BilibiliDanmakuItem[]
}

interface RichTextNode {
  orig_text?: string
  jump_url?: string
  text?: string
  type?: string
  [key: string]: unknown
}

interface DynamicSummary {
  text?: string
  rich_text_nodes: RichTextNode[]
}

interface DynamicPicture {
  url?: string
  live_url?: string
  img_src?: string
  src?: string
}

interface DynamicDecoration {
  card_url?: string
  fan: {
    color_format?: { colors?: string[] }
    num_str?: string
    num_desc?: string
  }
}

interface DynamicAuthor extends UserCard {
  pub_action?: string
  pub_time: string
  pub_ts: number
  decoration_card?: DynamicDecoration
  decorate?: DynamicDecoration
}

interface DynamicMajor {
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

interface DynamicModules {
  module_author: DynamicAuthor
  module_dynamic: {
    major: DynamicMajor
    desc: { text: string, rich_text_nodes: RichTextNode[] }
    topic?: { name?: string } | null
    additional?: { type: string }
  }
  module_stat: {
    like: { count: number }
    comment: { count: number }
    forward: { count: number }
  }
}

interface DynamicItem {
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

interface DynamicDetailData {
  item: DynamicItem
  card?: UserCard
  follower: number
}

type DynamicInfoResponse = ApiEnvelope<{
  data: DynamicDetailData
  /** 兼容旧版 Amagi 转发动态的少一层 data 结构 */
  item: DynamicItem
}>

interface LiveCardData {
  live_play_info: {
    cover: string
    title: string
    area_name: string
    room_id: number | string
    online: number
    watched_show: { text_large: string }
  }
}

interface ArticleStats {
  view?: number
  like?: number
  favorite?: number
  reply?: number
  dynamic?: number
  share?: number
  coin?: number
}

interface ArticleData {
  title?: string
  summary?: string
  banner_url?: string
  image_urls?: string[]
  categories?: BilibiliArticleCategoryInput[]
  words?: number
  stats?: ArticleStats
}

type ArticleContent = {
  opus?: NonNullable<Parameters<typeof buildBilibiliArticleRichText>[0]>
  content?: string
  dyn_id_str?: string
  id?: number | string
}
type ArticleInfoResponse = ApiEnvelope<{ data: ArticleData }>
type ArticleContentResponse = ApiEnvelope<{ data: ArticleContent }>

interface LiveInfoData {
  user_cover: string
  title: string
  area_name: string
  room_id: number | string
  live_time: string
}

interface RoomInitData {
  uid: number | string
  live_status: number
}

type LiveInfoResponse = ApiEnvelope<{ data: LiveInfoData }>
type RoomInitResponse = ApiEnvelope<{ data: RoomInitData }>

/**
 * B站 PCDN 主机名。
 *
 * 播放地址接口在请求「看起来没有身份」时（`buvid=` 为空、`build=0`）会把 `base_url`
 * 指到 PCDN —— 主机名形如 `xy116x196x140x41xy.mcdn.bilivideo.cn`，把节点 IP 直接编进了
 * 域名里。这类域名只在国内、且走运营商 DNS 时才解析得出来：挂代理、用公共 DNS 或
 * 境外机器上一律 `getaddrinfo ENOENT`，视频下载直接失败（用户日志里五次全是这个）。
 *
 * `szbdyd.com` 是另一个 PCDN 域，判定方式相同。
 */
const BILIBILI_PCDN_HOST = /(^|\.)(mcdn\.bilivideo\.cn|szbdyd\.com)$/i

/** 流对象上可用的地址：`base_url` 加接口给的备用地址（`backup_url` 通常是 upos / akamai 正常域名）。 */
interface BilibiliStreamUrls {
  base_url?: string
  backup_url?: string[]
}

const isPcdnUrl = (url: string): boolean => {
  try {
    return BILIBILI_PCDN_HOST.test(new URL(url).hostname)
  } catch {
    return false
  }
}

/**
 * 挑一个能用的流地址：优先非 PCDN。
 *
 * 接口同时给 `base_url` 和 `backup_url[]`，本仓库（以及上游）一直只用 `base_url`，
 * 于是 B站 把 `base_url` 指到 PCDN 时就没有退路了。这里按 `[base_url, ...backup_url]`
 * 的顺序挑第一个非 PCDN 的；全是 PCDN 才退回 `base_url`（至少行为和以前一致）。
 *
 * @param stream 带 base_url / backup_url 的流对象
 * @returns 可用于下载的地址；一个都没有时返回空串
 */
export const pickBilibiliStreamUrl = (stream: BilibiliStreamUrls | undefined): string => {
  const candidates = [stream?.base_url, ...(stream?.backup_url ?? [])]
    .filter((url): url is string => typeof url === 'string' && url.length > 0)
  if (candidates.length === 0) return ''
  const direct = candidates.find(url => !isPcdnUrl(url))
  if (direct) return direct
  logger.warn('[Bilibili] 播放地址只给到 PCDN 节点，本机若解析不了该域名下载会失败：' + candidates[0])
  return candidates[0]!
}

/** 保留每个清晰度 ID 首次出现的视频流，不修改调用方数组。 */
export const dedupeBilibiliVideoStreams = <T extends BilibiliVideoStream>(streams?: readonly T[]): T[] => {
  if (!streams) return []
  const ids = new Set<number>()
  return streams.filter((stream) => {
    if (ids.has(stream.id)) return false
    ids.add(stream.id)
    return true
  })
}

/**
 * B站视频列表
 * @typedef {import('@ikenxuan/amagi').BiliVideoPlayurlIsLogin['data']['dash']['video']} videoDownloadUrlList - 视频下载地址列表
 */

let img: Awaited<ReturnType<typeof Render>>

type LegacyBilibiliContent = '提示信息' | '评论图' | '视频' | '简介' | '动态'
type ModernBilibiliContent = 'info' | 'comment' | 'video'

const hasUserConfigKey = (key: 'sendContent'): boolean => Object.prototype.hasOwnProperty.call(Config.getConfig?.('bilibili') || {}, key)
const hasBilibiliContent = (legacyKey: LegacyBilibiliContent, modernKey?: ModernBilibiliContent): boolean => {
  const sendContent = Config.bilibili.sendContent
  if (modernKey && hasUserConfigKey('sendContent') && Array.isArray(sendContent) && sendContent.length > 0) {
    return sendContent.includes(modernKey)
  }
  return (Config.bilibili.bilibiliTip || []).includes(legacyKey)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const getBilibiliPayload = (response: unknown): BilibiliPayload => {
  const root = isRecord(response) ? response : undefined
  const data = root && isRecord(root.data) ? root.data : undefined
  const candidate = (data && isRecord(data.data) && data.data) || data ||
    (root && isRecord(root.result) && root.result) || root

  // Amagi 的包装层级因接口而异；这里只声明本文件实际读取的播放字段。
  return candidate as BilibiliPayload | undefined || {}
}
export const getBilibiliDurl = (response: unknown): BilibiliVideoStream[] => getBilibiliPayload(response).durl || []
export const getBilibiliDash = (response: unknown): BilibiliDash => getBilibiliPayload(response).dash || {}
export const getBilibiliAcceptDescription = (response: unknown): string[] => getBilibiliPayload(response).accept_description || []
export const getBilibiliVideoStream = (response: unknown): BilibiliVideoStream | null => {
  const payload = getBilibiliPayload(response)
  return payload.durl?.[0] || payload.dash?.video?.[0] || null
}

/**
 * 组装 `bilibili/bangumi` 契约要的完整数据。
 *
 * 这里刻意不写返回类型标注：让 TS 推出字面量形状，`Render('bilibili/bangumi', …)`
 * 调用点就会拿契约来校验它。
 *
 * 原来调用点只传了 `saveId` / `bangumiData` / `title` 三个键 —— 契约里一个都没有
 * （标题的键是大写的 `Title`），而必填的 14 个字段全缺。模板里是
 * `[...props.Episodes].sort(...)` 和 `props.stat.views` 这样的无守卫访问，
 * 所以 `#番剧` 一执行就抛 `Cannot read properties of undefined`，从来没出过图。
 *
 * `Link` / `newEP` / `seasonID` / `Copyright` / `length` 这几个契约必填字段模板里
 * 没有任何消费者，照实填上，不额外造数据。
 */
const buildBangumiPayload = (result: BangumiInfoData) => {
  const stat = result.stat ?? {}
  return {
    mainCover: result.cover ?? '',
    Title: result.title ?? '',
    Actors: result.actors ?? '',
    Evaluate: result.evaluate ?? '',
    Link: result.link ?? '',
    Styles: result.styles ?? [],
    subtitle: result.subtitle ?? '',
    seasonID: Number(result.season_id) || 0,
    Copyright: '',
    newEP: {
      desc: result.new_ep?.desc ?? '',
      id: Number(result.new_ep?.id) || 0,
      is_new: Number(result.new_ep?.is_new) || 0,
      title: result.new_ep?.title ?? ''
    },
    Stat: {
      coins: stat.coins ?? 0,
      danmakus: stat.danmakus ?? 0,
      favorite: stat.favorite ?? 0,
      favorites: stat.favorites ?? 0,
      follow_text: stat.follow_text ?? '',
      likes: stat.likes ?? 0,
      reply: stat.reply ?? 0,
      share: stat.share ?? 0,
      views: stat.views ?? 0,
      vt: stat.vt ?? 0
    },
    // 契约把 UPInfo 写成必填，而模板两处消费都带守卫，外购番剧真缺了只是不显示这块。
    // 这里如实透传接口给的值，用断言让它对上契约，不造假的 UP 信息。
    UPInfo: result.up_info as NonNullable<BangumiInfoData['up_info']>,
    Episodes: (result.episodes ?? []).map(episode => ({
      // 模板拿 bvid 当 React key，还用 findIndex 比对它算集数，
      // 所以取不到 bvid 时得退回一个仍然唯一的值，否则所有集都会算成同一集
      bvid: episode.bvid || String(episode.ep_id),
      cover: episode.cover ?? '',
      link: episode.link || episode.short_link || '',
      long_title: episode.long_title ?? '',
      pub_time: Number(episode.pub_time) || 0,
      badge: episode.badge ?? '',
      badge_info: {
        bg_color: episode.badge_info?.bg_color ?? '',
        bg_color_night: episode.badge_info?.bg_color_night ?? '',
        text: episode.badge_info?.text ?? episode.badge ?? ''
      }
    })),
    length: (result.episodes ?? []).length
  }
}

/**
 * 视频流的分辨率文本，形如 `1920x1080`。
 *
 * `bilibili/comment` 契约里 `Resolution` 是必填的 `string | null`，模板在
 * `Type === '视频'` 且值非空时才显示那个「分辨率（px）」小方块。原来这个字段
 * 一个调用点都没传，所以视频评论图上从来没出现过分辨率。
 * dash 流的条目带 `width`/`height`，durl（旧版整段 mp4）不带，取不到就返回 null。
 */
export const getBilibiliStreamResolution = (stream: BilibiliVideoStream | null): string | null => {
  const width = Number(stream?.width)
  const height = Number(stream?.height)
  return width > 0 && height > 0 ? `${width}x${height}` : null
}

export class Bilibili extends Base {
  declare e: BilibiliEvent
  type: unknown
  STATUS: unknown
  isVIP: boolean
  Type: BilibiliDataType | undefined
  islogin: boolean
  downloadfilename: string
  forceBurnDanmaku: boolean
  override get botadapter (): string {
    // 测试和部分调用方会直接从原型创建轻量实例，此时构造器尚未设置 e。
    const adapter = (this.e as BilibiliEvent | undefined)?.bot?.adapter
    const adapterName = typeof adapter === 'string' ? adapter : adapter?.name
    // Base 的类型承诺为 string，但本子类迁移前在无事件时就返回 undefined；保留该运行时契约。
    return adapterName as string
  }

  /**
   * @param {*} e
   * @param {*} data
   * @param {{ forceBurnDanmaku?: boolean }} [options]
   */
  constructor (e: BaseEvent | undefined, data: BilibiliConstructorData = {}, options?: { forceBurnDanmaku?: boolean }) {
    super(e)
    // 资源解析只会由带 reply 的消息事件触发；公开参数仍保持 BaseEvent 以兼容宿主事件类型。
    this.e = e as BilibiliEvent
    this.isVIP = false
    this.Type = data?.type
    this.islogin = data?.USER?.STATUS === 'isLogin'
    this.downloadfilename = ''
    this.forceBurnDanmaku = options?.forceBurnDanmaku ?? false
    this.headers = this.headers || {}
    // 使用可选链和空值合并运算符
    this.headers.Referer ||= 'https://www.bilibili.com/'
    this.headers.Cookie ||= Config.cookies.bilibili || ''
  }

  /**
   * 处理B站资源的异步方法
   * @param {import('./getid.js').BilibiliId} iddata - 包含资源ID和相关数据的对象
   * @returns {Promise<boolean | void>}
   */
  async RESOURCES (iddata: BilibiliIdData): Promise<boolean | void> {
    try {
      if (this.Type === 'undefined') return true
      !iddata?.Episode && (Config.app.parseTip || hasBilibiliContent('提示信息')) && await this.e.reply('检测到B站链接，开始解析')
      switch (this.Type) {
        case 'one_video': {
          // Amagi 以方法名分派固定响应；第三方边界在各调用点收窄到本文件读取的字段。
          const infoData = await this.amagi.getBilibiliData('单个视频作品数据', { bvid: iddata.bvid, typeMode: 'strict' }) as VideoInfoResponse
          const playUrlData = await this.amagi.getBilibiliData('单个视频下载信息数据', {
            avid: infoData.data.data.aid,
            cid: iddata.p ? (infoData.data.data.pages[iddata.p - 1]?.cid || infoData.data.data.cid) : infoData.data.data.cid,
            typeMode: 'strict'
          })
          this.islogin = (await checkCk()).Status === 'isLogin'

          const { owner, pic, title, stat, desc } = infoData.data.data
          const { name } = owner
          const { coin, like, share, view, favorite, danmaku } = stat

          this.downloadfilename = title.substring(0, 50).replace(/[\\/:*?"<>|\r\n\s]/g, ' ')

          const playUrlPayload = getBilibiliPayload(playUrlData)
          const playUrlStream = getBilibiliVideoStream(playUrlData)

          let videoSize = ''
          /** @type {{ accept_description: string[], videoList: videoDownloadUrlList, selectedQuality: string }} */
          let correctList: BilibiliQualityResult<BilibiliVideoStream & { base_url: string }> = { accept_description: [], videoList: [], selectedQuality: '未知' } // 提供默认值
          let preparePlaybackPromise: Promise<void> | undefined
          const preparePlayback = (): Promise<void> => {
            preparePlaybackPromise ||= (async () => {
              if (this.islogin && Config.bilibili.videopriority === false && playUrlPayload.dash?.video?.length && playUrlPayload.dash?.audio?.length) {
                /** 过滤视频流信息对象，排除清晰度重复的视频流 */
                const simplify = dedupeBilibiliVideoStreams(playUrlPayload.dash.video)
                /** 替换原始的视频信息对象 */
                playUrlPayload.dash.video = simplify
                /** 给视频信息对象删除不符合条件的视频流 */
                correctList = await bilibiliProcessVideos({
                  accept_description: playUrlPayload.accept_description || [],
                  bvid: infoData.data.data.bvid,
                  qn: Config.bilibili.videoQuality
                }, simplify, pickBilibiliStreamUrl(playUrlPayload.dash.audio[0]))
                playUrlPayload.dash.video = correctList.videoList
                playUrlPayload.accept_description = correctList.accept_description
                /** 获取第一个视频流的大小 */
                videoSize = await getvideosize(pickBilibiliStreamUrl(correctList.videoList[0]), pickBilibiliStreamUrl(playUrlPayload.dash.audio[0]), infoData.data.data.bvid)
                return
              }
              videoSize = ((playUrlStream?.size || 0) / (1024 * 1024)).toFixed(2)
            })()
            return preparePlaybackPromise
          }

          const sendVideoInfo = hasBilibiliContent('简介', 'info') && (Config.bilibili?.displayContent || []).length > 0
            ? async (): Promise<void> => {
              if (Config.bilibili.videoInfoMode === 'image') {
                const userProfileData = await this.amagi.getBilibiliData('用户主页数据', { host_mid: owner.mid, typeMode: 'strict' }) as UserProfileResponse
                let hotDanmaku: ReturnType<typeof getHotBilibiliDanmaku> = []
                if (Config.bilibili.showDanmakuInVideoInfo) {
                  const danmakuCid = iddata.p ? (infoData.data.data.pages[iddata.p - 1]?.cid || infoData.data.data.cid) : infoData.data.data.cid
                  const danmakuDuration = iddata.p ? (infoData.data.data.pages[iddata.p - 1]?.duration || infoData.data.data.duration) : infoData.data.data.duration
                  hotDanmaku = getHotBilibiliDanmaku(await this.fetchVideoDanmakuList(danmakuCid, danmakuDuration), 20)
                }

                await this.e.reply(await Render('bilibili/videoInfo', {
                  share_url: 'https://b23.tv/' + infoData.data.data.bvid,
                  title,
                  // 必须是富文本：模板对 desc 做 `document.nodes.map()`，
                  // 传 HTML 字符串会当场抛 reading 'map'（实测 success=false）。
                  desc: formatBilibiliVideoDescRichText(infoData.data.data.desc_v2, desc),
                  stat: {
                    ...stat,
                    // 契约要 13 个必填，模板实际只读 7 个；剩下的补真实值或兜底 0，
                    // 不是凭空造数据 —— aid 就在同一份响应里
                    aid: stat.aid ?? infoData.data.data.aid,
                    now_rank: stat.now_rank ?? 0,
                    his_rank: stat.his_rank ?? 0,
                    dislike: stat.dislike ?? 0,
                    evaluation: stat.evaluation ?? '',
                    vt: stat.vt ?? 0
                  },
                  bvid: infoData.data.data.bvid,
                  // 契约要秒级时间戳，模板自己 fromUnixTime + format。
                  // 之前传的是 convertTimestampToDateTime() 的日期字符串，
                  // date-fns 拿到就抛 RangeError: Invalid time value（实测必炸）。
                  ctime: infoData.data.data.ctime,
                  pic,
                  hotDanmaku,
                  owner: {
                    ...owner,
                    // 契约要 number，本地 VideoOwner.mid 是 number | string
                    mid: Number(owner.mid),
                    frame: userProfileData.data.data.card.pendant?.image || '',
                    name: userProfileData.data.data.card.name || owner.name,
                    face: userProfileData.data.data.card.face || owner.face
                  }
                }))
                return
              }

              const processedCover = await processImageUrl(pic, title || 'B站视频封面', 0, {
                Referer: 'https://www.bilibili.com/',
                Cookie: Config.cookies.bilibili || ''
              })
              const contentMap = {
                cover: await segment.image(processedCover),
                title: `\n📺 标题: ${title}\n`,
                author: `\n👤 作者: ${name}\n`,
                stats: this.formatVideoStats(view, danmaku, like, coin, share, favorite),
                desc: `\n\n📝 简介: ${desc}`
              }
              const replyContent: unknown[] = []
              const fixedOrder: Array<keyof typeof contentMap> = ['cover', 'title', 'author', 'stats', 'desc']

              fixedOrder.forEach(item => {
                if ((Config.bilibili?.displayContent || []).includes(item) && contentMap[item]) {
                  replyContent.push(contentMap[item])
                }
              })

              if (replyContent.length > 0) {
                await this.e.reply(this.mkMsg(replyContent, [
                  {
                    text: '视频链接',
                    link: 'https://b23.tv/' + infoData.data.data.bvid
                  }
                ]))
              }
            }
            : undefined

          const sendVideo = hasBilibiliContent('视频', 'video')
            ? async (): Promise<void> => {
              await preparePlayback()
              let danmakuList: BilibiliDanmakuItem[] = []
              if (this.forceBurnDanmaku || Config.bilibili.burnDanmaku) {
                const cid = iddata.p ? (infoData.data.data.pages[iddata.p - 1]?.cid || infoData.data.data.cid) : infoData.data.data.cid
                const duration = iddata.p ? (infoData.data.data.pages[iddata.p - 1]?.duration || infoData.data.data.duration) : infoData.data.data.duration
                danmakuList = await this.fetchVideoDanmakuList(cid, duration)
              }

              if (Config.upload.usefilelimit && Number(videoSize) > Number(Config.upload.filelimit)) {
                await this.e.reply(`设定的最大上传大小为 ${Config.upload.filelimit}MB\n当前解析到的视频大小为 ${Number(videoSize)}MB\n` + '视频太大了，还是去B站看吧~', { reply: true })
                return
              }
              await this.getvideo(
                Config.bilibili.videopriority === true
                  ? { playUrlData, danmakuList }
                  : {
                      infoData: infoData.data, playUrlData, danmakuList
                    })
            }
            : undefined

          /**
           * 评论图自己取数、自己渲染、自己发送，和上面两条分支一起并发。
           *
           * 原来它排在 `await runMediaTasks(...)` 之后，于是视频上传多久、评论图就得等多久 ——
           * 而这三件事之间没有任何数据依赖。`preparePlayback()` 是记忆化的
           * （`preparePlaybackPromise ||=`），三条分支同时调也只会真的取一次播放地址，
           * 并且 await 它之后 `playUrlStream` / `videoSize` / `correctList` 都已赋值。
           */
          const sendComment = hasBilibiliContent('评论图', 'comment')
            ? async (): Promise<void> => {
              await preparePlayback()
              const commentsData = await this.amagi.getBilibiliData('评论数据', '', {
                number: Config.bilibili.bilibilinumcomments,
                type: 1,
                oid: infoData.data.data.aid.toString(),
                typeMode: 'strict'
              }) as CommentsResponse
              const commentsdata = Config.bilibili.bilibilinumcomments && Config.bilibili.bilibilinumcomments > 0
                ? bilibiliComments(commentsData.data)
                : null
              if (!commentsdata?.length) return
              const commentImage = await Render('bilibili/comment', {
                Type: '视频',
                CommentsData: commentsdata,
                CommentLength: Config.bilibili.realCommentCount ? Common.count(infoData.data.data.stat.reply) : String(commentsdata.length),
                share_url: 'https://b23.tv/' + infoData.data.data.bvid,
                Clarity: Config.bilibili.videopriority === true || !this.islogin ? (getBilibiliAcceptDescription(playUrlData)[0] || '未知') : correctList?.selectedQuality,
                VideoSize: Config.bilibili.videopriority === true || !this.islogin ? ((playUrlStream?.size || 0) / (1024 * 1024)).toFixed(2) : videoSize,
                Resolution: getBilibiliStreamResolution(playUrlStream),
                ImageLength: 0,
                shareurl: 'https://b23.tv/' + infoData.data.data.bvid
              })
              await this.e.reply(this.mkMsg(commentImage, [
                {
                  text: '视频链接',
                  link: 'https://b23.tv/' + infoData.data.data.bvid
                }
              ]))
            }
            : undefined

          await runMediaTasks({
            poster: sendVideoInfo,
            video: sendVideo,
            comment: sendComment
          }, {
            onTaskFailure: ({ task, error }) => {
              const taskLabel = task === 'poster'
                ? '视频信息海报/回复'
                : task === 'video' ? '视频下载、弹幕烧录与发送' : '评论图渲染与发送'
              logger.error(`[Bilibili] ${taskLabel}任务失败`, error)
            }
          })
          break
        }
        case 'bangumi_video_info': {
          const videoInfo = await this.amagi.getBilibiliData('番剧基本信息数据', { [iddata.isEpid ? 'ep_id' : 'season_id']: iddata.realid, typeMode: 'strict' }) as BangumiInfoResponse
          this.islogin = (await checkCk()).Status === 'isLogin'
          this.isVIP = (await checkCk()).isVIP

          const msg = []

          if (!videoInfo.data) {
            logger.warn(videoInfo.message, `错误码: ${videoInfo.code}`)
            return true
          }
          for (let i = 0; i < videoInfo.data.result.episodes.length; i++) {
            /** @type {string} */
            const long_title = videoInfo.data.result.episodes[i]?.long_title || ''
            /** @type {string} */
            const badge = videoInfo.data.result.episodes[i]?.badge || ''
            /** @type {string} */
            const short_link = videoInfo.data.result.episodes[i]?.short_link || ''
            msg.push([
              `\n> ## 第${i + 1}集`,
              `\n> 标题: ${long_title}`,
              `\n> 类型: ${badge !== '预告' ? '正片' : '预告'}`,
              `\n> 🔒 播放要求: ${badge === '预告' || badge === '' ? '暂无' : badge}`,
              this.botadapter !== 'QQBot' ? `\n> 🔗 分享链接: [🔗点击查看](${short_link})\r\r` : ''
            ])
          }
          img = await Render('bilibili/bangumi', buildBangumiPayload(videoInfo.data.result))
          await this.e.reply(
            this.mkMsg(this.botadapter === 'QQBot' ? `# ${videoInfo.data.result.season_title}\n---\n${msg}\r\r---\n请在60秒内输入 第?集 选择集数` : img, [
              { text: '第1集', callback: '第1集' },
              { text: '第2集', callback: '第2集' },
              { text: '第?集', input: '第' }
            ])
          )
          let Episode
          if (iddata?.Episode) {
            Episode = iddata.Episode
            // 检查是否为中文数字，如果是则转换为阿拉伯数字
            if (/^[一二三四五六七八九十百千万]+$/.test(Episode)) {
              Episode = Common.chineseToArabic(Episode).toString()
            }
            this.downloadfilename = videoInfo.data.result.episodes[Number(Episode) - 1]?.share_copy?.substring(0, 50).replace(/[\\/:*?"<>|\r\n\s]/g, ' ') || ''
            this.e.reply(`收到请求，第${Episode}集\n${this.downloadfilename}\n正在下载中`)
          } else {
            logger.debug(Episode)
            this.e.reply('匹配内容失败，请重新发送链接再次解析')
            return true
          }
          const bangumidataBASEURL = bilibiliApiUrls.getBangumiStream({
            cid: videoInfo.data.result.episodes[Number(Episode) - 1]?.cid || 0,
            ep_id: videoInfo.data.result.episodes[Number(Episode) - 1]?.ep_id.toString() || ''
          })
          const Params = await genParams(bangumidataBASEURL)
          if (!this.islogin) await this.e.reply('B站ck未配置或已失效，无法获取视频流，可尝试【#B站登录】以配置新ck')
          const playUrlData = await new Networks({
            url: bangumidataBASEURL + Params,
            headers: this.headers
          }).getData() as BangumiPlayResponse
          if (videoInfo.data.result.episodes[Number(Episode) - 1]?.badge === '会员' && !this.isVIP) {
            logger.warn('该CK不是大会员，无法获取视频流')
            return true
          }
          if (Config.bilibili.videoQuality === 0) {
            /** 提取出视频流信息对象，并排除清晰度重复的视频流 */
            const simplify = dedupeBilibiliVideoStreams(playUrlData.result.dash.video)
            /** 替换原始的视频信息对象 */
            playUrlData.result.dash.video = simplify
            /** 给视频信息对象删除不符合条件的视频流 */
            const correctList = await bilibiliProcessVideos({
              accept_description: playUrlData.result.accept_description,
              bvid: videoInfo.data.result.season_id.toString(),
              qn: Config.bilibili.videoQuality
            }, simplify, pickBilibiliStreamUrl(playUrlData.result.dash.audio[0]))
            playUrlData.result.dash.video = correctList.videoList
            playUrlData.result.cept_description = correctList.accept_description
            await this.getvideo({
              infoData: videoInfo.data,
              playUrlData
            })
          } else {
            await this.getvideo({
              infoData: videoInfo.data,
              playUrlData
            })
          }
          break
        }
        case 'dynamic_info': {
          if (!hasBilibiliContent('动态')) break
          const dynamicInfo = await this.amagi.getBilibiliData('动态详情数据', { dynamic_id: iddata.dynamic_id, typeMode: 'strict' }) as DynamicInfoResponse
          const commentsData: CommentsResponse | false = dynamicInfo.data.data.item.type !== DynamicType.LIVE_RCMD &&
            Boolean(Config.bilibili.bilibilinumcomments && Config.bilibili.bilibilinumcomments > 0)
            ? await this.amagi.getBilibiliData('评论数据', '', {
              type: mapping_table(dynamicInfo.data.data.item.type),
              oid: oid(dynamicInfo.data),
              number: Config.bilibili.bilibilinumcomments,
              typeMode: 'strict'
            }) as CommentsResponse
            : false
          const userProfileData = await this.amagi.getBilibiliData('用户主页数据', { host_mid: dynamicInfo.data.data.item.modules.module_author.mid, typeMode: 'strict' }) as UserProfileResponse

          switch (dynamicInfo.data.data.item.type) {
            /** 图文、纯图 */
            case DynamicType.DRAW: {
              const imgArray: unknown[] = []
              const tempFiles: Array<{ filepath?: string }> = []
              let hasGeneratedLivePhoto = false
              const pics = dynamicInfo.data.data.item.modules.module_dynamic.major.opus.pics || []

              for (const [index, item] of pics.entries()) {
                const itemUrl = item?.url
                if (!itemUrl) continue

                if (item.live_url) {
                  const livePhoto = await buildCommonLivePhotoMessages({
                    platform: 'bilibili',
                    staticUrl: itemUrl,
                    liveVideoUrl: item.live_url,
                    index,
                    headers: {
                      ...baseHeaders,
                      Referer: 'https://www.bilibili.com/'
                    }
                  })
                  tempFiles.push(...livePhoto.tempFiles)
                  hasGeneratedLivePhoto = hasGeneratedLivePhoto || livePhoto.generatedLivePhoto
                  if (livePhoto.messages.length > 0) {
                    imgArray.push(...livePhoto.messages)
                    continue
                  }
                }

                const imageUrl = await processImageUrl(itemUrl, dynamicInfo.data.data.item.modules.module_author?.name || 'B站动态图片', index, {
                  Referer: 'https://www.bilibili.com/',
                  Cookie: Config.cookies.bilibili || ''
                })
                imgArray.push(segment.image(imageUrl))
              }

              if (hasGeneratedLivePhoto) {
                imgArray.push(await buildLivePhotoTipMessage())
              }

              try {
                if (imgArray.length === 1) await this.e.reply(imgArray[0])
                if (imgArray.length > 1) await this.e.reply(['QQBot', 'KOOKBot'].includes(this.botadapter) ? imgArray : await common.makeForwardMsg(this.e, imgArray, '动态图片'))
              } finally {
                for (const item of tempFiles) {
                  if (item?.filepath) await Common.removeFile(item.filepath, true)
                }
              }

              if (hasBilibiliContent('评论图', 'comment') && commentsData) {
                const commentsdata = bilibiliComments(commentsData.data)
                img = await Render('bilibili/comment', {
                  Type: '动态',
                  CommentsData: commentsdata,
                  CommentLength: String(commentsdata?.length || 0),
                  share_url: 'https://t.bilibili.com/' + dynamicInfo.data.data.item.id_str,
                  ImageLength: dynamicInfo.data.data.item.modules?.module_dynamic?.major?.draw?.items?.length || 0,
                  // 契约里 Resolution 必填，动态没有视频流，模板也只在 Type === '视频' 时显示这一格
                  Resolution: null,
                  shareurl: '动态分享链接'
                })
                await this.e.reply(img)
              }

              if ('topic' in dynamicInfo.data.data.item.modules.module_dynamic && dynamicInfo.data.data.item.modules.module_dynamic.topic !== null) {
                const name = dynamicInfo.data.data.item.modules.module_dynamic.topic?.name
                dynamicInfo.data.data.item.modules.module_dynamic.major.opus.summary.rich_text_nodes.unshift({
                  orig_text: name,
                  jump_url: '',
                  text: name,
                  type: 'topic'
                })
                const summary = dynamicInfo.data.data.item.modules.module_dynamic.major.opus.summary
                if (summary) {
                  summary.text = `${name}\n\n` + (summary.text || '')
                }
              }

              await this.e.reply(await Render('bilibili/dynamic/DYNAMIC_TYPE_DRAW', {
                image_url: cover(pics),
                // 动态详情数据中，图文动态的描述文本在 major.opus.summary 中
                text: replacetext(
                  dynamicInfo.data.data.item.modules.module_dynamic.major?.opus?.summary?.text || '',
                  dynamicInfo.data.data.item.modules.module_dynamic.major?.opus?.summary?.rich_text_nodes || []
                ),
                // 'auto' 让模板按图片数自己挑 vertical/waterfall/grid，
                // 布局规则在 DYNAMIC_TYPE_DRAW.tsx 的 getLayoutType 里，不在这边重写一份
                imageLayout: 'auto',
                dianzan: Common.count(dynamicInfo.data.data.item.modules.module_stat.like.count),
                pinglun: Common.count(dynamicInfo.data.data.item.modules.module_stat.comment.count),
                share: Common.count(dynamicInfo.data.data.item.modules.module_stat.forward.count),
                create_time: dynamicInfo.data.data.item.modules.module_author.pub_time,
                avatar_url: dynamicInfo.data.data.item.modules.module_author.face,
                frame: dynamicInfo.data.data.item.modules.module_author.pendant.image,
                share_url: 'https://t.bilibili.com/' + dynamicInfo.data.data.item.id_str,
                dynamic_id: String(dynamicInfo.data.data.item.id_str),
                usernameMeta: getUsernameMetadata(userProfileData.data.data.card),
                fans: Common.count(userProfileData.data.data.follower),
                user_shortid: dynamicInfo.data.data.item.modules.module_author.mid,
                total_favorited: Common.count(userProfileData.data.data.like_num),
                following_count: Common.count(userProfileData.data.data.card.attention),
                decoration_card: generateDecorationCard(dynamicInfo.data.data.item.modules.module_author.decoration_card),
                render_time: Common.getCurrentTime(),
                dynamicTYPE: '图文动态'
              }))
              break
            }
            /** 纯文 */
            case DynamicType.WORD: {
              const summary = dynamicInfo.data.data.item.modules.module_dynamic.major.opus.summary
              const text = replacetext(summary?.text || '', summary?.rich_text_nodes || [])

              if (dynamicInfo.data.data.item.modules.module_dynamic.additional) {
                switch (dynamicInfo.data.data.item.modules.module_dynamic.additional.type) {
                  // TODO: 动态中的额外卡片元素，
                  // see: https://github.com/SocialSisterYi/bilibili-API-collect/blob/afc4349247ff7d59ac16dfe6eec8ff2b766a74f0/docs/dynamic/all.md
                  // find: data.items[n].modules.module_dynamic.additional
                  case AdditionalType.RESERVE: {
                    break
                  }
                  case AdditionalType.COMMON:
                  case AdditionalType.GOODS:
                  case AdditionalType.VOTE:
                  case AdditionalType.UGC:
                  case AdditionalType.MATCH:
                  case AdditionalType.UPOWER_LOTTERY:
                  default: {
                    break
                  }
                }
              }

              await this.e.reply(
                await Render('bilibili/dynamic/DYNAMIC_TYPE_WORD', {
                  text,
                  dianzan: Common.count(dynamicInfo.data.data.item.modules.module_stat.like.count),
                  pinglun: Common.count(dynamicInfo.data.data.item.modules.module_stat.comment.count),
                  share: Common.count(dynamicInfo.data.data.item.modules.module_stat.forward.count),
                  create_time: dynamicInfo.data.data.item.modules.module_author.pub_time,
                  avatar_url: dynamicInfo.data.data.item.modules.module_author.face,
                  frame: dynamicInfo.data.data.item.modules.module_author.pendant.image,
                  share_url: 'https://t.bilibili.com/' + dynamicInfo.data.data.item.id_str,
                  dynamic_id: String(dynamicInfo.data.data.item.id_str),
                  usernameMeta: getUsernameMetadata(dynamicInfo.data.data.card || userProfileData.data.data.card),
                  fans: Common.count(dynamicInfo.data.data.follower),
                  user_shortid: dynamicInfo.data.data.item.modules.module_author.mid,
                  total_favorited: Common.count(userProfileData.data.data.like_num),
                  following_count: Common.count(userProfileData.data.data.card.attention),
                  decoration_card: generateDecorationCard(dynamicInfo.data.data.item.modules.module_author.decoration_card),
                  render_time: Common.getCurrentTime(),
                  dynamicTYPE: '纯文动态'
                })
              )
              if (Config.bilibili.bilibilinumcomments && commentsData) {
                const commentsdata = bilibiliComments(commentsData.data)
                await this.e.reply(
                  await Render('bilibili/comment', {
                    Type: '动态',
                    CommentsData: commentsdata,
                    CommentLength: String(commentsdata.length),
                    share_url: 'https://t.bilibili.com/' + dynamicInfo.data.data.item.id_str,
                    ImageLength: dynamicInfo.data.data.item.modules?.module_dynamic?.major?.draw?.items?.length || 0,
                    // 契约里 Resolution 必填，动态没有视频流，模板也只在 Type === '视频' 时显示这一格
                    Resolution: null,
                    shareurl: '动态分享链接'
                  })
                )
              }
              break
            }
            /** 转发动态 */
            case DynamicType.FORWARD: {
              const text = replacetext(
                dynamicInfo.data.data.item.modules.module_dynamic.desc.text,
                dynamicInfo.data.data.item.modules.module_dynamic.desc.rich_text_nodes
              )
              // 用 IIFE 而不是 `let data = {}` + 逐分支赋值：那样 data 的类型是 `{}`，
              // 塞进 `original_content` 时编译期什么都拦不住，于是漏字段全留到运行时。
              // 这里每个分支直接 return 对应的键，TS 按联合类型逐个校验必填字段。
              const originalContent = (() => {
                const author = dynamicInfo.data.data.item.orig?.modules?.module_author
                switch (dynamicInfo.data.data.item.orig.type) {
                  case DynamicType.AV: {
                    const archive = dynamicInfo.data.data.item.orig.modules.module_dynamic.major.archive
                    const origDesc = dynamicInfo.data.data.item.orig.modules.module_dynamic.desc
                    return {
                      DYNAMIC_TYPE_AV: {
                        usernameMeta: getUsernameMetadata(author),
                        avatar_url: author.face,
                        frame: author.pendant?.image,
                        create_time: Common.convertTimestampToDateTime(author.pub_ts),
                        decoration_card: generateDecorationCard(author.decoration_card),
                        cover: archive.cover,
                        duration_text: archive.duration_text,
                        // 契约要 string，模板直接拼在「{play}观看 {danmaku}弹幕」里
                        play: Common.count(archive.stat.play ?? archive.stat.view),
                        danmaku: Common.count(archive.stat.danmaku),
                        // 模板对 title 走 renderRichTextToReact，必须是富文本
                        title: replacetext(archive.title, []),
                        // 模板读的是 `content.text.nodes.length`，没有短路。
                        // 之前这个分支根本不传 text，转发视频动态必抛 reading 'nodes'。
                        text: replacetext(origDesc?.text || '', origDesc?.rich_text_nodes || [])
                      }
                    }
                  }
                  case DynamicType.DRAW: {
                    const summary = dynamicInfo.data.data.item.orig.modules.module_dynamic.major.opus.summary
                    return {
                      DYNAMIC_TYPE_DRAW: {
                        usernameMeta: getUsernameMetadata(author),
                        avatar_url: author.face,
                        frame: author.pendant?.image,
                        create_time: Common.convertTimestampToDateTime(author.pub_ts),
                        decoration_card: generateDecorationCard(author.decoration_card),
                        text: replacetext(summary?.text || '', summary?.rich_text_nodes || []),
                        image_url: cover(dynamicInfo.data.data.item.orig.modules.module_dynamic.major?.opus?.pics ||
                          dynamicInfo.data.data.item.orig.modules.module_dynamic.major?.draw?.items || [])
                      }
                    }
                  }
                  case DynamicType.WORD: {
                    const summary = dynamicInfo.data.data.item.orig.modules.module_dynamic.major.opus.summary
                    return {
                      DYNAMIC_TYPE_WORD: {
                        usernameMeta: getUsernameMetadata(author),
                        avatar_url: author.face,
                        frame: author.pendant?.image,
                        create_time: Common.convertTimestampToDateTime(author.pub_ts),
                        decoration_card: generateDecorationCard(author.decoration_card),
                        text: replacetext(summary?.text || '', summary?.rich_text_nodes || [])
                      }
                    }
                  }
                  case DynamicType.LIVE_RCMD: {
                    const liveData = JSON.parse(dynamicInfo.data.data.item.orig.modules.module_dynamic.major.live_rcmd.content) as LiveCardData
                    return {
                      DYNAMIC_TYPE_LIVE_RCMD: {
                        usernameMeta: getUsernameMetadata(author),
                        avatar_url: author.face,
                        frame: author.pendant?.image,
                        create_time: Common.convertTimestampToDateTime(author.pub_ts),
                        decoration_card: generateDecorationCard(author.decoration_card),
                        cover: liveData.live_play_info.cover,
                        text_large: liveData.live_play_info.watched_show.text_large,
                        area_name: liveData.live_play_info.area_name,
                        online: Common.count(liveData.live_play_info.online),
                        // 同 AV：模板对 title 走 renderRichTextToReact
                        title: replacetext(liveData.live_play_info.title, [])
                      }
                    }
                  }
                  case DynamicType.FORWARD:
                  default: {
                    logger.warn(`UP主：${userProfileData.data.data.card.name}的${logger.green('转发动态')}转发的原动态类型为「${logger.yellow(dynamicInfo.data.data.item.orig.type)}」暂未支持解析`)
                    return {}
                  }
                }
              })()
              await this.e.reply(
                await Render('bilibili/dynamic/DYNAMIC_TYPE_FORWARD', {
                  text,
                  // 转发动态本身不带图，模板用 `props.imgList &&` 短路；契约要求这个键存在
                  imgList: null,
                  dianzan: Common.count(dynamicInfo.data.data.item.modules.module_stat.like.count),
                  pinglun: Common.count(dynamicInfo.data.data.item.modules.module_stat.comment.count),
                  share: Common.count(dynamicInfo.data.data.item.modules.module_stat.forward.count),
                  create_time: dynamicInfo.data.data.item.modules.module_author.pub_time,
                  avatar_url: dynamicInfo.data.data.item.modules.module_author.face,
                  frame: dynamicInfo.data.data.item.modules.module_author.pendant.image,
                  share_url: 'https://t.bilibili.com/' + dynamicInfo.data.data.item.id_str,
                  dynamic_id: String(dynamicInfo.data.data.item.id_str),
                  usernameMeta: getUsernameMetadata(userProfileData.data.data.card),
                  fans: Common.count(userProfileData.data.data.follower),
                  user_shortid: dynamicInfo.data.data.item.modules.module_author.mid,
                  total_favorited: Common.count(userProfileData.data.data.like_num),
                  following_count: Common.count(userProfileData.data.data.card.attention),
                  dynamicTYPE: '转发动态解析',
                  decoration_card: generateDecorationCard(dynamicInfo.data.data.item.modules.module_author.decorate),
                  render_time: Common.getCurrentTime(),
                  original_content: originalContent
                })
              )
              break
            }
            /** 视频动态 */
            case DynamicType.AV: {
              if (dynamicInfo.data.data.item.modules.module_dynamic.major.type === 'MAJOR_TYPE_ARCHIVE') {
                const bvid = dynamicInfo.data.data.item.modules.module_dynamic.major.archive.bvid
                const INFODATA = await getBilibiliData('单个视频作品数据', '', { bvid, typeMode: 'strict' }) as VideoInfoResponse
                if (Config.bilibili.bilibilinumcomments && commentsData) {
                  const commentsdata = bilibiliComments(commentsData.data)
                  await this.e.reply(
                    await Render('bilibili/comment', {
                      Type: '动态',
                      CommentsData: commentsdata,
                      CommentLength: String(commentsdata.length),
                      share_url: 'https://www.bilibili.com/video/' + bvid,
                      ImageLength: dynamicInfo.data.data.item.modules?.module_dynamic?.major?.draw?.items?.length || 0,
                      // 契约里 Resolution 必填，动态没有视频流，模板也只在 Type === '视频' 时显示这一格
                      Resolution: null,
                      shareurl: '动态分享链接'
                    })
                  )
                }

                img = await Render('bilibili/dynamic/DYNAMIC_TYPE_AV',
                  {
                    // 契约是单张封面字符串，不是数组
                    image_url: INFODATA.data.data.pic,
                    text: replacetext(INFODATA.data.data.title, []),
                    desc: formatBilibiliVideoDescRichText(INFODATA.data.data.desc_v2, INFODATA.data.data.desc || ''),
                    dynamic_text: replacetext(
                      dynamicInfo.data.data.item.modules.module_dynamic.desc?.text || '',
                      dynamicInfo.data.data.item.modules.module_dynamic.desc?.rich_text_nodes || []
                    ),
                    dianzan: Common.count(INFODATA.data.data.stat.like),
                    pinglun: Common.count(INFODATA.data.data.stat.reply),
                    share: Common.count(INFODATA.data.data.stat.share),
                    view: Common.count(INFODATA.data.data.stat.view),
                    coin: Common.count(INFODATA.data.data.stat.coin),
                    duration_text: dynamicInfo.data.data.item.modules.module_dynamic.major.archive.duration_text,
                    page_length: INFODATA.data.data.pages?.length || 1,
                    create_time: Common.convertTimestampToDateTime(INFODATA.data.data.ctime),
                    avatar_url: INFODATA.data.data.owner.face,
                    frame: dynamicInfo.data.data.item.modules.module_author.pendant.image,
                    share_url: 'https://www.bilibili.com/video/' + bvid,
                    dynamic_id: String(dynamicInfo.data.data.item.id_str),
                    usernameMeta: getUsernameMetadata(userProfileData.data.data.card),
                    fans: Common.count(userProfileData.data.data.follower),
                    user_shortid: userProfileData.data.data.card.mid,
                    total_favorited: Common.count(userProfileData.data.data.like_num),
                    following_count: Common.count(userProfileData.data.data.card.attention),
                    decoration_card: generateDecorationCard(dynamicInfo.data.data.item.modules.module_author.decoration_card),
                    render_time: Common.getCurrentTime(),
                    dynamicTYPE: '视频动态'
                  }
                )
                await this.e.reply(img)
              }
              break
            }
            /** 直播动态 */
            case DynamicType.LIVE_RCMD: {
              const dynamicCARD = JSON.parse(dynamicInfo.data.data.item.modules.module_dynamic.major.live_rcmd.content) as LiveCardData
              const userINFO = await getBilibiliData('用户主页数据', '', { host_mid: dynamicInfo.data.data.item.modules.module_author.mid, typeMode: 'strict' }) as UserProfileResponse
              img = await Render('bilibili/dynamic/DYNAMIC_TYPE_LIVE_RCMD',
                {
                  // 契约是单张封面字符串，不是数组
                  image_url: dynamicCARD.live_play_info.cover,
                  text: replacetext(dynamicCARD.live_play_info.title, []),
                  liveinf: `${dynamicCARD.live_play_info.area_name} | 房间号: ${dynamicCARD.live_play_info.room_id}`,
                  usernameMeta: getUsernameMetadata(userINFO.data.data.card),
                  avatar_url: userINFO.data.data.card.face,
                  frame: dynamicInfo.data.data.item.modules.module_author.pendant.image,
                  fans: Common.count(userINFO.data.data.follower),
                  create_time: Common.convertTimestampToDateTime(dynamicInfo.data.data.item.modules.module_author.pub_ts),
                  now_time: Common.getCurrentTime(),
                  share_url: 'https://live.bilibili.com/' + dynamicCARD.live_play_info.room_id,
                  dynamicTYPE: '直播动态'
                }
              )
              await this.e.reply(img)
              break
            }
            /** 文章/专栏动态 */
            case DynamicType.ARTICLE: {
              const articleIdValue = dynamicInfo.data.data.item.basic?.rid_str ||
                dynamicInfo.data.data.item.basic?.rid?.toString?.() ||
                dynamicInfo.data.data.item.modules?.module_dynamic?.major?.article?.id?.toString?.()
              const articleId = articleIdValue ? String(articleIdValue) : ''

              if (!articleId) {
                await this.e.reply('该专栏动态缺少专栏 ID，暂时无法解析')
                break
              }

              const [articleInfoBase, articleInfo] = await Promise.all([
                this.amagi.getBilibiliData('专栏文章基本信息', { id: articleId, typeMode: 'strict' }),
                this.amagi.getBilibiliData('专栏正文内容', { id: articleId, typeMode: 'strict' })
              ]) as [ArticleInfoResponse, ArticleContentResponse]
              const articleData = articleInfoBase.data.data
              const articleContent = articleInfo.data.data
              const articleImages = extractBilibiliArticleImages(articleContent)
              const title = articleData.title || dynamicInfo.data.data.item.modules.module_dynamic?.major?.article?.title || 'B站专栏'
              const summary = articleData.summary || ''
              const shareUrl = articleContent.dyn_id_str
                ? `https://www.bilibili.com/opus/${articleContent.dyn_id_str}`
                : `https://www.bilibili.com/read/cv${articleContent.id || articleId}`
              const body = buildBilibiliArticleRichText(
                articleContent.opus,
                articleContent.content,
                Common.useDarkTheme()
              )
              const forwardNodes = await buildBilibiliRichTextForwardNodes(body, {
                title,
                summary,
                shareUrl,
                imageResolver: (url, index) => processImageUrl(url, `${title}图片`, index, {
                  Referer: 'https://www.bilibili.com/',
                  Cookie: Config.cookies.bilibili || ''
                })
              })
              const forwardMessage = await createBilibiliRichTextForwardMessage(forwardNodes, {
                segmentFactory: {
                  text: value => segment.text?.(value) ?? value,
                  image: url => segment.image(url)
                },
                makeForwardMsg: (messages, forwardTitle) => common.makeForwardMsg(this.e, messages, forwardTitle),
                title: '专栏内容'
              })
              if (forwardMessage) await this.e.reply(forwardMessage)

              const stats = articleData.stats || {}
              const categories = buildBilibiliArticleCategories(articleData.categories)

              img = await Render('bilibili/dynamic/DYNAMIC_TYPE_ARTICLE', {
                usernameMeta: getUsernameMetadata(userProfileData.data.data.card),
                avatar_url: userProfileData.data.data.card.face,
                frame: dynamicInfo.data.data.item.modules.module_author.pendant.image,
                create_time: dynamicInfo.data.data.item.modules.module_author.pub_time ||
                  Common.convertTimestampToDateTime(dynamicInfo.data.data.item.modules.module_author.pub_ts),
                title,
                summary,
                banner_url: articleData.banner_url || articleData.image_urls?.[0] || '',
                categories,
                words: articleData.words || 0,
                body,
                stats: {
                  view: stats.view ?? 0,
                  like: stats.like ?? 0,
                  favorite: stats.favorite ?? 0,
                  reply: stats.reply ?? 0,
                  share: stats.dynamic ?? stats.share ?? 0,
                  dynamic: stats.dynamic ?? 0,
                  coin: stats.coin ?? 0
                },
                render_time: Common.getCurrentTime(),
                share_url: shareUrl,
                dynamicTYPE: '专栏动态解析',
                user_shortid: userProfileData.data.data.card.mid,
                total_favorited: Common.count(userProfileData.data.data.like_num),
                following_count: Common.count(userProfileData.data.data.card.attention),
                fans: Common.count(userProfileData.data.data.follower)
              })
              await this.e.reply(img)

              if (Config.bilibili.bilibilinumcomments && commentsData) {
                const commentsdata = bilibiliComments(commentsData.data)
                await this.e.reply(
                  await Render('bilibili/comment', {
                    Type: '动态',
                    CommentsData: commentsdata,
                    CommentLength: String(commentsdata.length),
                    share_url: shareUrl,
                    ImageLength: articleImages.length,
                    // 契约里 Resolution 必填，专栏没有视频流，模板也只在 Type === '视频' 时显示这一格
                    Resolution: null,
                    shareurl: '动态分享链接'
                  })
                )
              }
              break
            }
            default: {
              const unknownItem = dynamicInfo.data.data.item
              this.e.reply(`该动态类型「${unknownItem.type}」暂未支持解析`)
              break
            }
          }
          break
        }
        case 'live_room_detail': {
          const liveInfo = await this.amagi.getBilibiliData('直播间信息', { room_id: iddata.room_id, typeMode: 'strict' }) as LiveInfoResponse
          const roomInitInfo = await this.amagi.getBilibiliData('直播间初始化信息', { room_id: iddata.room_id, typeMode: 'strict' }) as RoomInitResponse
          const userProfileData = await this.amagi.getBilibiliData('用户主页数据', { host_mid: roomInitInfo.data.data.uid, typeMode: 'strict' }) as UserProfileResponse

          if (roomInitInfo.data.data.live_status === 0) {
            await this.e.reply(`「${userProfileData.data.data.card.name}」\n未开播，正在休息中~`)
            return true
          }
          const img = await Render('bilibili/dynamic/DYNAMIC_TYPE_LIVE_RCMD',
            {
              image_url: liveInfo.data.data.user_cover,
              text: replacetext(liveInfo.data.data.title, []),
              liveinf: `${liveInfo.data.data.area_name} | 房间号: ${liveInfo.data.data.room_id}`,
              usernameMeta: getUsernameMetadata(userProfileData.data.data.card),
              avatar_url: userProfileData.data.data.card.face,
              frame: userProfileData.data.data.card.pendant.image,
              fans: Common.count(userProfileData.data.data.card.fans),
              create_time: liveInfo.data.data.live_time === '-62170012800' ? '获取失败' : liveInfo.data.data.live_time,
              now_time: Common.getCurrentTime(),
              share_url: 'https://live.bilibili.com/' + liveInfo.data.data.room_id,
              dynamicTYPE: '直播'
            }
          )
          await this.e.reply(img)
          break
        }
        default:
          return true
      }
    } catch (error) {
      // 同 douyin.ts 的 RESOURCES：调用点（tools.ts 383/492）都在 wrapWithErrorHandler 内，
      // 返回值没人读，吞掉异常等于把解析失败从统一错误处理层手里拿走——不出卡片、不通知主人。
      // 日志留在 try 内才能进日志上下文；传 error 对象保住堆栈。
      logger.error(`[B站] ${this.Type} 解析失败`, error)
      throw error
    }
  }

  /**
   * 获取B站视频弹幕列表
   * @param {number|string} cid 视频cid
   * @param {number} duration 视频时长，单位秒
   * @returns {Promise<Array<{progress:number, mode:number, fontsize:number, color:number, content:string}>>}
   */
  async fetchVideoDanmakuList (cid: number | string, duration: number): Promise<BilibiliDanmakuItem[]> {
    try {
      if (!cid) return []
      const xml = await new Networks({
        url: `https://comment.bilibili.com/${cid}.xml`,
        headers: {
          ...baseHeaders,
          Referer: `https://www.bilibili.com/video/${cid}`,
          Cookie: Config.cookies.bilibili || ''
        }
      }).getData()

      const text = typeof xml === 'string' ? xml : String(xml)
      const list: BilibiliDanmakuItem[] = []
      const regex = /<d\s+p="([^"]+)">([\s\S]*?)<\/d>/g
      let match
      while ((match = regex.exec(text))) {
        const p = (match[1] || '').split(',')
        const seconds = Number(p[0] || 0)
        if (duration && seconds > duration) continue
        list.push({
          progress: Math.max(0, seconds * 1000),
          mode: Number(p[1] || 1),
          fontsize: Number(p[2] || 25),
          color: Number(p[3] || 16777215),
          content: (match[2] || '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
        })
      }
      logger.debug(`[B站] 获取到 ${list.length} 条弹幕`)
      return list
    } catch (error) {
      logger.warn('[B站] 获取弹幕失败，将发送原视频', error)
      return []
    }
  }

  /**
   * 获取视频并处理的方法
   * @param {Object} videoData - 视频数据对象
   * @param {import('@ikenxuan/amagi').BiliBangumiVideoInfo | import('@ikenxuan/amagi').BiliOneWork} [videoData.infoData] - 视频信息数据
   * @param {import('@ikenxuan/amagi').BiliVideoPlayurlIsLogin | import('@ikenxuan/amagi').BiliBiliVideoPlayurlNoLogin | import('@ikenxuan/amagi').BiliBangumiVideoPlayurlIsLogin | import('@ikenxuan/amagi').BiliBangumiVideoPlayurlNoLogin} [videoData.playUrlData] - 播放URL数据
   * @param {BilibiliDanmakuItem[]} [videoData.danmakuList] - 弹幕列表
   * @returns {Promise<void>}
   */
  async getvideo ({ infoData, playUrlData, danmakuList = [] }: GetVideoInput): Promise<void> {
    /** 获取视频 => FFMPEG合成 */
    // 如果配置了视频优先，则设置为未登录状态
    if (Config.bilibili.videopriority === true) this.islogin = false

    // 如果已登录
    if (this.islogin) {
      // 获取视频和音频的基础URL和ID
      const isOneVideo = this.Type === 'one_video'
      const videoId = isOneVideo
        ? infoData && 'data' in infoData ? infoData.data.bvid : undefined
        : infoData && 'result' in infoData ? infoData.result.season_id : undefined
      const seasonId = videoId
      const dash = getBilibiliDash(playUrlData)
      // 优先非 PCDN 地址，否则挂代理 / 非国内 DNS 时会 getaddrinfo ENOENT
      const videoUrl = pickBilibiliStreamUrl(dash?.video?.[0])
      const audioUrl = pickBilibiliStreamUrl(dash?.audio?.[0])
      if (!videoUrl || !audioUrl) {
        const videoStream = getBilibiliVideoStream(playUrlData)
        if (videoStream?.url) {
          await downloadVideo(this.e, { video_url: videoStream.url, title: { timestampTitle: `tmp_${Date.now()}.mp4`, originTitle: `${this.downloadfilename}.mp4` } })
        } else {
          logger.error('无法下载视频,请配置CooKie后重试')
        }
        return
      }

      // 并行下载视频和音频
      const [bmp4, bmp3] = await Promise.all([
        downloadFile(videoUrl, {
          title: `Bil_V_${videoId}.mp4`,
          headers: {
            Referer: this.headers?.Referer,
            Cookie: ''
          }
        }),
        downloadFile(audioUrl, {
          title: `Bil_A_${videoId}.mp3`,
          headers: {
            Referer: this.headers?.Referer,
            Cookie: ''
          }
        })
      ])

      const videoFilePath = bmp4.filepath
      const audioFilePath = bmp3.filepath
      if (videoFilePath && audioFilePath) {
        await mergeFile('二合一（视频 + 音频）', {
          path: videoFilePath,
          path2: audioFilePath,
          resultPath: Common.tempDri.video + `Bil_Result_${seasonId}.mp4`,
          callback: async (/** @type {boolean} */ success, /** @type {string} */ resultPath) => {
            if (!success) {
              await Common.removeFile(videoFilePath, true)
              await Common.removeFile(audioFilePath, true)
              return true
            }

            let sourcePath = resultPath
            if ((this.forceBurnDanmaku || Config.bilibili.burnDanmaku) && danmakuList.length > 0) {
              const burnPath = Common.tempDri.video + `Bil_Danmaku_${Date.now()}.mp4`
              const ok = await burnDanmaku('bilibili', resultPath, danmakuList, burnPath, {
                danmakuArea: Config.bilibili.danmakuArea,
                danmakuFontSize: Config.bilibili.danmakuFontSize,
                danmakuOpacity: Config.bilibili.danmakuOpacity
              })
              if (ok) {
                await Common.removeFile(resultPath, true)
                sourcePath = burnPath
              }
            }

            const filePath = Common.tempDri.video + `${Config.app.removeCache ? 'tmp_' + Date.now() : this.downloadfilename}.mp4`
            fs.renameSync(sourcePath, filePath)
            logger.mark(`视频文件重命名完成: ${resultPath.split('/').pop()} -> ${filePath.split('/').pop()}`)
            logger.mark('正在尝试删除缓存文件')
            await Common.removeFile(videoFilePath, true)
            await Common.removeFile(audioFilePath, true)

            const stats = fs.statSync(filePath)
            const fileSizeInMB = Number((stats.size / (1024 * 1024)).toFixed(2))

            // 根据文件大小选择上传方式
            return fileSizeInMB > (Config.upload?.filelimit || 100)
              ? await uploadFile(this.e, { filepath: filePath, totalBytes: fileSizeInMB, originTitle: this.downloadfilename }, '', { useGroupFile: true })
              : await uploadFile(this.e, { filepath: filePath, totalBytes: fileSizeInMB, originTitle: this.downloadfilename }, '')
          }
        })
      }
    } else {
      /** 没登录（没配置ck）情况下直接发直链，传直链在DownLoadVideo()处理 */
      const durl = getBilibiliDurl(playUrlData)
      const videoUrl = durl[0]?.url
      if (videoUrl) {
        if ((this.forceBurnDanmaku || Config.bilibili.burnDanmaku) && danmakuList.length > 0) {
          const videoFile = await downloadFile(videoUrl, {
            title: `Bil_V_tmp_${Date.now()}.mp4`,
            headers: this.headers
          })
          if (videoFile.filepath) {
            const resultPath = Common.tempDri.video + `Bil_Danmaku_${Date.now()}.mp4`
            const ok = await burnDanmaku('bilibili', videoFile.filepath, danmakuList, resultPath, {
              danmakuArea: Config.bilibili.danmakuArea,
              danmakuFontSize: Config.bilibili.danmakuFontSize,
              danmakuOpacity: Config.bilibili.danmakuOpacity
            })
            await Common.removeFile(videoFile.filepath, true)
            if (ok) {
              const size = await Common.getVideoFileSize(resultPath)
              await uploadFile(this.e, { filepath: resultPath, totalBytes: size, originTitle: this.downloadfilename }, '')
              return
            }
          }
        }
        await downloadVideo(this.e, { video_url: videoUrl, title: { timestampTitle: `tmp_${Date.now()}.mp4`, originTitle: `${this.downloadfilename}.mp4` } })
      } else {
        logger.error('无法下载视频,请配置CooKie后重试')
      }
    }
  }

  /**
   * 格式化视频统计信息为三行，每行两个数据项，并保持对齐
   * @param {number} view - 播放量
   * @param {number} danmaku - 弹幕数
   * @param {number} like - 点赞数
   * @param {number} coin - 投币数
   * @param {number} share - 转发数
   * @param {number} favorite - 收藏数
   * @returns {string} 格式化后的统计信息字符串
   */
  formatVideoStats (view: number, danmaku: number, like: number, coin: number, share: number, favorite: number): string {
    // 计算每个数据项的文本
    const viewText = `📊 播放量: ${Common.count(view)}`
    const danmakuText = `💬 弹幕: ${Common.count(danmaku)}`
    const likeText = `👍 点赞: ${Common.count(like)}`
    const coinText = `🪙 投币: ${Common.count(coin)}`
    const shareText = `🔄 转发: ${Common.count(share)}`
    const favoriteText = `⭐ 收藏: ${Common.count(favorite)}`

    // 找出第一列中最长的项的长度
    const firstColItems = [viewText, likeText, shareText]
    const maxFirstColLength = Math.max(...firstColItems.map(item => this.getStringDisplayWidth(item)))

    // 构建三行文本，确保第二列对齐
    const line1 = this.alignTwoColumns(viewText, danmakuText, maxFirstColLength)
    const line2 = this.alignTwoColumns(likeText, coinText, maxFirstColLength)
    const line3 = this.alignTwoColumns(shareText, favoriteText, maxFirstColLength)

    return `${line1}\n${line2}\n${line3}`
  }

  /**
   * 对齐两列文本
   * @param {string} col1 - 第一列文本
   * @param {string} col2 - 第二列文本
   * @param {number} targetLength - 目标长度
   * @returns {string} 对齐后的文本
   */
  alignTwoColumns (col1: string, col2: string, targetLength: number): string {
    // 计算需要添加的空格数量
    const col1Width = this.getStringDisplayWidth(col1)
    const spacesNeeded = targetLength - col1Width + 5 // 5是两列之间的固定间距

    // 添加空格使两列对齐
    return col1 + ' '.repeat(spacesNeeded) + col2
  }

  /**
   * 获取字符串在显示时的实际宽度
   * 考虑到不同字符的显示宽度不同（如中文、emoji等）
   * @param {string} str - 要计算宽度的字符串
   * @returns {number} 字符串的显示宽度
   */
  getStringDisplayWidth (str: string): number {
    let width = 0
    for (let i = 0; i < str.length; i++) {
      const code = str.codePointAt(i)
      if (!code) continue

      // 处理emoji和特殊Unicode字符
      if (code > 0xFFFF) {
        width += 2 // emoji通常占用2个字符宽度
        i++ // 跳过代理对的后半部分
      } else if ( // 处理中文字符和其他全角字符
        (code >= 0x3000 && code <= 0x9FFF) || // 中文字符范围
        (code >= 0xFF00 && code <= 0xFFEF) || // 全角ASCII、全角标点
        code === 0x2026 || // 省略号
        code === 0x2014 || // 破折号
        (code >= 0x2E80 && code <= 0x2EFF) || // CJK部首补充
        (code >= 0x3000 && code <= 0x303F) || // CJK符号和标点
        (code >= 0x31C0 && code <= 0x31EF) || // CJK笔画
        (code >= 0x3200 && code <= 0x32FF) || // 封闭式CJK字母和月份
        (code >= 0x3300 && code <= 0x33FF) || // CJK兼容
        (code >= 0xAC00 && code <= 0xD7AF) || // 朝鲜文音节
        (code >= 0xF900 && code <= 0xFAFF) || // CJK兼容表意文字
        (code >= 0xFE30 && code <= 0xFE4F)    // CJK兼容形式
      ) {
        width += 2
      } else if (code === 0x200D || (code >= 0xFE00 && code <= 0xFE0F) || (code >= 0x1F3FB && code <= 0x1F3FF)) { // emoji修饰符和连接符
        width += 0 // 这些字符不增加宽度，它们是修饰符
      } else { // 普通ASCII字符
        width += 1
      }
    }
    return width
  }
}

/**
 * 动态正文 → 富文本文档，模板契约要的就是这个类型。
 *
 * 旧版叫 `replacetext`，返回的是一段自带 `<span style="color:...">` 的 HTML 字符串。
 * React 模板对它做 `document.nodes.map()`，拿到字符串直接抛
 * `Cannot read properties of undefined (reading 'map')`；配色也不该由生产方决定，
 * `renderRichTextToReact` 会按节点类型上样式，所以这里连主题都不用传了。
 *
 * @param text 原始文本内容
 * @param rich_text_nodes 富文本节点数组
 */
export function replacetext (
  text: string | undefined,
  rich_text_nodes: NonNullable<Parameters<typeof formatBilibiliDynamicRichText>[1]>
): RichTextDocument {
  return formatBilibiliDynamicRichText(text, rich_text_nodes)
}

/**
 * 生成图片数组
 * @param { { img_src: string }[] } pic 一个包含图片源字符串的数组
 * @returns {Object[]} imgArray - 包含图片源地址的对象数组。
 */
export const cover = (pic: DynamicPicture[]): Array<{ image_src: string }> => {
  // 初始化一个空数组来存放图片对象
  const imgArray: Array<{ image_src: string }> = []
  // 遍历dycrad.item.pictures数组，将每个图片的img_src存入对象，并将该对象加入imgArray
  for (const i of pic) {
    const src = i.img_src || i.src || i.url
    // 三个字段都没有就跳过：契约要的是 string，塞 undefined 进去等于给模板埋个空 <img>
    if (!src) continue
    imgArray.push({ image_src: src })
  }
  // 返回包含所有图片对象的数组
  return imgArray
}

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

/**
 * 把 B 站粉丝装饰卡片整理成模板要的数据。
 *
 * 旧版返回的是一整段 HTML `<div>`，React 模板的 `DecorationCard` 拿到字符串会在
 * `data.colors.length` 上抛错；而且「没有装饰」时旧版返回 `'<div></div>'` —— 一个
 * **真值**字符串，模板 `{props.decoration_card && ...}` 那道短路根本挡不住，
 * 于是没戴装饰的用户反而必炸。这里没装饰就返回 undefined，让短路生效。
 *
 * @param decorate 装饰对象，包含卡片的 URL 和粉丝牌颜色信息
 */
export const generateDecorationCard = (
  decorate: DynamicDecoration | undefined
): BilibiliDecorationCard | undefined => {
  if (!decorate?.card_url) return undefined
  return {
    card_url: decorate.card_url,
    colors: decorate.fan?.color_format?.colors ?? [],
    text: decorate.fan?.num_str || decorate.fan?.num_desc || ''
  }
}

const qnd: Record<number, string> = {
  6: '极速 240P',
  16: '流畅 360P',
  32: '清晰480P',
  64: '高清720P',
  74: '高帧率 720P60',
  80: '高清 1080P',
  112: '高码率 1080P+',
  116: '高帧率 1080P60',
  120: '超清 4K',
  125: '真彩色 HDR ',
  126: '杜比视界',
  127: '超高清 8K'
}

/**
 * 根据动态类型映射到对应的数字ID
 * @param {*} type - 动态类型字符串
 * @returns {number} 对应的数字ID
 */
function mapping_table (type: string): number {
  const typeMap: Record<string, string[]> = {
    1: ['DYNAMIC_TYPE_AV', 'DYNAMIC_TYPE_PGC', 'DYNAMIC_TYPE_UGC_SEASON'],
    11: ['DYNAMIC_TYPE_DRAW'],
    12: ['DYNAMIC_TYPE_ARTICLE'],
    17: ['DYNAMIC_TYPE_LIVE_RCMD', 'DYNAMIC_TYPE_FORWARD', 'DYNAMIC_TYPE_WORD', 'DYNAMIC_TYPE_COMMON_SQUARE'],
    19: ['DYNAMIC_TYPE_MEDIALIST']
  }
  for (const key in typeMap) {
    if (typeMap[key] && typeMap[key].includes(type)) {
      return parseInt(key, 10)
    }
  }
  return 1
}

/**
 * @param {import ('@ikenxuan/amagi').BiliDynamicInfo<DynamicType>} dynamicINFO
 * @returns
 */
interface DynamicOidData {
  data: {
    item: {
      type: string
      id_str: string
      basic?: { comment_id_str?: string, rid_str?: string }
    }
  }
}

const oid = (dynamicINFO: DynamicOidData): string => {
  switch (dynamicINFO.data.item.type) {
    case 'DYNAMIC_TYPE_WORD':
    case 'DYNAMIC_TYPE_FORWARD': {
      return dynamicINFO.data.item.id_str
    }
    default: {
      return dynamicINFO.data.item.basic?.comment_id_str ||
        dynamicINFO.data.item.basic?.rid_str ||
        dynamicINFO.data.item.id_str
    }
  }
}

/**
 * 检出符合大小的视频流信息对象
 * @param {Object} qualityOptions - 视频质量选项
 * @param {number} [qualityOptions.qn] - qn值，视频清晰度标识
 * @param {number} [qualityOptions.maxAutoVideoSize] - 可接受的最大视频文件大小，单位：MB
 * @param {string} qualityOptions.bvid - 视频BV号
 * @param {string[]} qualityOptions.accept_description - 视频流清晰度列表
 * @param {videoDownloadUrlList} videoList - 包含所有清晰度的视频流信息对象
 * @param {string} audioUrl - 音频流地址
 * @returns {Promise<{ accept_description: string[]; videoList: videoDownloadUrlList; selectedQuality: string }>} 包含处理后的视频列表和清晰度描述的对象
 * @property {string[]} returns.accept_description - 处理后的清晰度描述列表
 * @property {Object[]} returns.videoList - 处理后的视频流信息对象列表
 * @property {string} returns.selectedQuality - 选中的视频画质值
 */
interface BilibiliQualityOptions {
  qn?: number
  maxAutoVideoSize?: number
  bvid: string
  accept_description: string[]
}

interface BilibiliQualityResult<T extends BilibiliVideoStream> {
  accept_description: string[]
  videoList: T[]
  selectedQuality: string
}

export const bilibiliProcessVideos = async <T extends BilibiliVideoStream & { base_url: string }> (
  qualityOptions: BilibiliQualityOptions,
  videoList: T[],
  audioUrl: string
): Promise<BilibiliQualityResult<T>> => {
  // 如果不是自动选择模式，直接根据配置的清晰度选择视频
  if (qualityOptions.qn !== 0 && Config.bilibili.videoQuality !== 0) {
    const targetQuality = qualityOptions.qn || Config.bilibili.videoQuality || 80

    // 尝试找到完全匹配的清晰度
    let matchedVideo = videoList.find(video => video?.id === targetQuality)

    // 如果没有完全匹配的清晰度，找最接近的
    if (!matchedVideo) {
      // 按照清晰度ID排序
      const sortedVideos = [...videoList].sort((a, b) => a.id - b.id)

      // 找到小于目标清晰度的最大值
      const lowerVideos = sortedVideos.filter(video => video.id < targetQuality)
      const higherVideos = sortedVideos.filter(video => video.id > targetQuality)

      if (lowerVideos.length > 0) {
        // 有小于目标清晰度的，取最大的
        matchedVideo = lowerVideos[lowerVideos.length - 1]
      } else if (higherVideos.length > 0) {
        // 没有小于目标清晰度的，取最小的
        matchedVideo = higherVideos[0]
      } else {
        // 如果都没有，取第一个（应该不会发生）
        matchedVideo = sortedVideos[0]
      }
    }

    // 更新视频列表和清晰度描述
    const matchedQuality = (matchedVideo?.id && qnd[matchedVideo?.id]) || qualityOptions.accept_description[0] || '未知'
    qualityOptions.accept_description = [matchedQuality]
    videoList = matchedVideo ? [matchedVideo] : []

    return {
      accept_description: qualityOptions.accept_description,
      videoList,
      selectedQuality: matchedQuality
    }
  }

  // 自动选择逻辑（videoQuality === 0）
  const results: Record<number, string> = {}
  logger.info('开始获取视频大小...')

  for (const video of videoList) {
    try {
      const size = await getvideosize(pickBilibiliStreamUrl(video), audioUrl, qualityOptions.bvid)
      results[video.id] = size
      logger.info(`视频ID ${video.id} (${qnd[video.id]}) 大小: ${size}`)
    } catch (error) {
      logger.error(`获取视频ID ${video.id} 大小时出错:`, error)
      // 设置一个默认的大值，确保它不会被选中
      results[video.id] = '999999MB'
    }
  }

  logger.info('所有视频大小结果:', results)

  // 将结果对象的值转换为数字，并找到最接近但不超过 qualityOptions.maxAutoVideoSize 或 Config.bilibili.maxAutoVideoSize 的值
  const maxSize = qualityOptions?.maxAutoVideoSize || Config.bilibili.maxAutoVideoSize || 100
  logger.info('最大允许大小:', maxSize, 'MB')

  let closestId: number | null = null
  let smallestDifference = Infinity
  let largestUnderLimit: number | null = null // 新增：记录小于限制的最大视频ID

  Object.entries(results).forEach(([id, sizeStr]) => {
    const idNum = Number(id)
    const size = parseFloat(sizeStr.replace('MB', ''))
    logger.info(`检查视频ID ${idNum} (${qnd[idNum]}), 大小: ${size}MB`)

    if (size <= maxSize) {
      // 记录小于限制的最大视频ID
      if (largestUnderLimit === null) {
        // 第一次找到符合条件的视频，直接记录
        largestUnderLimit = Number(idNum)
      } else {
        // 已经有记录，比较大小
        const currentSize = parseFloat(results[largestUnderLimit]?.replace('MB', '') || '0')
        if (size > currentSize) {
          largestUnderLimit = Number(idNum)
        }
      }

      // 计算与最大限制的差值
      const difference = maxSize - size
      if (difference < smallestDifference) {
        smallestDifference = difference
        closestId = Number(idNum)
      }
    }
  })

  // 如果没有找到最接近的，但有小于限制的视频，选择最大的那个
  if (closestId === null && largestUnderLimit !== null) {
    closestId = largestUnderLimit
  }

  logger.info('选中的视频ID:', closestId)

  let selectedQuality = '' // 添加选中的画质值变量

  if (closestId !== null) {
    // 找到最接近但不超过文件大小限制的视频清晰度
    const closestQuality = qnd[Number(closestId)] || '未知'
    // 更新 OBJECT.DATA.data.accept_description
    qualityOptions.accept_description = qualityOptions.accept_description.filter(desc => desc === closestQuality)
    if (qualityOptions.accept_description.length === 0) {
      qualityOptions.accept_description = [closestQuality]
    }
    // 找到对应的视频对象
    const video = videoList.find(video => video.id === Number(closestId))
    if (video) {
      // 更新 OBJECT.DATA.data.dash.video 数组
      videoList = [video]
    }
    selectedQuality = closestQuality // 设置选中的画质值
  } else {
    // 如果没有找到符合条件的视频，使用最低画质的视频对象
    const lastVideo = [...videoList].pop()
    if (lastVideo) {
      videoList = [lastVideo]
    }
    // 更新 OBJECT.DATA.data.accept_description 为最低画质的描述
    const lastDescription = [...qualityOptions.accept_description].pop()
    if (lastDescription) {
      qualityOptions.accept_description = [lastDescription]
      selectedQuality = lastDescription // 设置选中的画质值
    }
  }

  logger.warn('最终选中的画质:', selectedQuality)
  return {
    accept_description: qualityOptions.accept_description,
    videoList,
    selectedQuality  // 添加选中的画质值到返回对象
  }
}

/**
 * [bilibili] 获取视频和音频的总大小
 * @param {string} videourl - 视频流URL
 * @param {string} audiourl - 音频流URL
 * @param {string} bvid - 视频BV号
 * @returns  返回视频和音频总大小(MB),保留2位小数
 */
const getContentRangeSize = (contentRange: string | undefined): number => {
  const match = contentRange?.match(/\/(\d+)/)
  return match?.[1] ? parseInt(match[1], 10) : 0
}

export const getvideosize = async (videourl: string, audiourl: string, bvid: string): Promise<string> => {
  const videoheaders = await new Networks({
    url: videourl,
    headers: {
      ...baseHeaders,
      Referer: `https://api.bilibili.com/video/${bvid}`,
      Cookie: Config.cookies.bilibili
    }
  }).getHeaders()
  const audioheaders = await new Networks({
    url: audiourl,
    headers: {
      ...baseHeaders,
      Referer: `https://api.bilibili.com/video/${bvid}`,
      Cookie: Config.cookies.bilibili
    }
  }).getHeaders()

  const videoSize = getContentRangeSize(videoheaders['content-range'])
  const audioSize = getContentRangeSize(audioheaders['content-range'])

  const videoSizeInMB = (videoSize / (1024 * 1024)).toFixed(2)
  const audioSizeInMB = (audioSize / (1024 * 1024)).toFixed(2)

  const totalSizeInMB = parseFloat(videoSizeInMB) + parseFloat(audioSizeInMB)
  return totalSizeInMB.toFixed(2)
}
