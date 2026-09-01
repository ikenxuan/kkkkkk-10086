/* eslint-disable indent */
import { Base, Render, Config, Networks, mergeFile, Common, baseHeaders, downloadFile, uploadFile, downloadVideo, needsGroupFileChannel, processImageUrl, sanitizeFilenameSegment } from '@/module/utils/index'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { buildAmagiRequestConfig } from '@/module/utils/amagiClient'
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
import { extractBilibiliArticleImages } from './article.js'
import { createBilibiliRichTextForwardMessage } from './richtext-message.js'
import { buildLivePhotoMessagesBatch as buildCommonLivePhotoMessagesBatch, buildLivePhotoTipMessage } from '@/module/platform/common/livePhoto'
import type { LivePhotoBatchItem } from '@/module/platform/common/types'
import { bilibiliCommentLimit } from '@/module/platform/common/commentLimit'
import { runMediaTasks } from '@/module/utils/MediaTasks'
import { isSoftFailure, softFetch, SOFT_ERROR_CODES } from '@/module/platform/common/softError'
import { fromSeconds, reportMedia } from '@/module/utils/media-metrics'
import fs from 'fs'
import type { BaseEvent } from '@/module/utils/types'
import type { RichTextDocument } from '@kkk/richtext'
import { at, isRecord } from '@/module/utils/record'
import { expandBilibiliCdnCandidates, isUposMirrorUrl } from './cdn.js'
import type { AmagiRuntime, ArticleContentResponse, ArticleInfoResponse, BangumiInfoData, BangumiInfoResponse, BangumiPlayResponse, BilibiliConstructorData, BilibiliDanmakuItem, BilibiliDash, BilibiliResourceDataType as BilibiliDataType, BilibiliDecorationCard, BilibiliEvent, BilibiliResourceIdData as BilibiliIdData, BilibiliPayload, BilibiliQualityOptions, BilibiliQualityResult, BilibiliStreamUrls, BilibiliVideoStream, CommentsResponse, DynamicDecoration, DynamicInfoResponse, DynamicOidData, DynamicPicture, GetVideoInput, LegacyBilibiliContent, LiveCardData, LiveInfoResponse, ModernBilibiliContent, RoomInitResponse, UserProfileResponse, VideoInfoResponse } from './types.js'

const require = createRequire(import.meta.url)
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

/** 一路流上的全部地址，按「主地址在前」排好。两种流的键名不同，见 {@link BilibiliStreamUrls.url}。 */
const readStreamUrls = (stream: BilibiliStreamUrls | undefined): string[] =>
  [stream?.base_url, stream?.url, ...(stream?.backup_url ?? [])]
    .filter((url): url is string => typeof url === 'string' && url.length > 0)

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
  const candidates = readStreamUrls(stream)
  if (candidates.length === 0) return ''
  const direct = candidates.find(url => !isPcdnUrl(url))
  if (direct) return direct
  logger.warn('[Bilibili] 播放地址只给到 PCDN 节点，本机若解析不了该域名下载会失败：' + candidates[0])
  return candidates[0]!
}

/**
 * 取一路流的**全部**可用地址，按偏好排好。
 *
 * `pickBilibiliStreamUrl` 只返回一条，是为了兼容既有调用点（体积探测、直链发送那些
 * 只需要一个地址的地方）。下载要用这一个：它把接口给的镜像**和**改写出来的地址
 * 一起交给下载层，于是某个节点 403 / 404 / 被限速时还有下一条可以换。
 *
 * 三种模式的差别只在「要不要改写主机名」，见 `bilibili.yaml` 的 `bilibiliCdnMode`：
 * - `origin`：一个字都不改，只做去重
 * - `mirror`：把 upos 镜像顶到最前，接口给的地址退居备用
 * - `auto`（默认）：接口给的地址在前，只在它指到 PCDN 时才补上改写地址
 *
 * @param stream 带 base_url / backup_url 的流对象
 * @returns 排好序的候选地址；一条都没有时返回空数组
 */
export const collectBilibiliStreamUrls = (stream: BilibiliStreamUrls | undefined): string[] => {
  const raw = readStreamUrls(stream)
  if (raw.length === 0) return []

  const mode = Config.bilibili.bilibiliCdnMode ?? 'auto'
  if (mode === 'origin') return [...new Set(raw)]

  const expanded = expandBilibiliCdnCandidates(raw)
  if (mode !== 'mirror') return expanded

  // mirror 模式：改写出来的镜像地址顶到最前，接口原地址留在后面当备用。
  // 不把原地址丢掉 —— 万一镜像那边没有这份文件（404），还得靠它们兜底。
  const mirrors = expanded.filter(url => isUposMirrorUrl(url))
  const rest = expanded.filter(url => !isUposMirrorUrl(url))
  return mirrors.length > 0 ? [...mirrors, ...rest] : expanded
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

const hasUserConfigKey = (key: 'sendContent'): boolean => Object.prototype.hasOwnProperty.call(Config.getConfig?.('bilibili') || {}, key)
const hasBilibiliContent = (legacyKey: LegacyBilibiliContent, modernKey?: ModernBilibiliContent): boolean => {
  const sendContent = Config.bilibili.sendContent
  if (modernKey && hasUserConfigKey('sendContent') && Array.isArray(sendContent) && sendContent.length > 0) {
    return sendContent.includes(modernKey)
  }
  return (Config.bilibili.bilibiliTip || []).includes(legacyKey)
}

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
    this.headers.Referer ||= 'https://www.bilibili.com/'
    this.headers.Cookie ||= Config.cookies.bilibili || ''
  }

  /**
   * @param {import('./getid.js').BilibiliId} iddata - 包含资源ID和相关数据的对象
   * @returns {Promise<boolean | void>}
   */
  async RESOURCES (iddata: BilibiliIdData): Promise<boolean | void> {
    try {
      if (this.Type === 'undefined') return true
      !iddata?.Episode && (Config.app.parseTip || hasBilibiliContent('提示信息')) && await this.e.reply('检测到B站链接，开始解析')
      switch (this.Type) {
        case 'one_video': {
          // getid 的匹配函数比提取正则宽松，能判成 one_video 却提不出 BV 号
          if (!iddata.bvid) {
            await this.e.reply('该视频链接缺少 BV 号，无法解析')
            return true
          }
          // Amagi 以方法名分派固定响应；第三方边界在各调用点收窄到本文件读取的字段。
          const infoData = await this.amagi.bilibili.fetchVideoInfo({ bvid: iddata.bvid, typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig()) as VideoInfoResponse
          const playUrlData = await this.amagi.bilibili.fetchVideoStreamUrl({
            avid: infoData.data.data.aid,
            cid: iddata.p ? (infoData.data.data.pages[iddata.p - 1]?.cid || infoData.data.data.cid) : infoData.data.data.cid,
            typeMode: 'strict'
          }, Config.cookies.bilibili, buildAmagiRequestConfig())
          this.islogin = (await checkCk()).Status === 'isLogin'

          const { owner, pic, title, stat, desc } = infoData.data.data
          const { name } = owner
          const { coin, like, share, view, favorite, danmaku } = stat

          this.downloadfilename = sanitizeFilenameSegment(title, 50, 'B站视频')

          const playUrlPayload = getBilibiliPayload(playUrlData)
          const playUrlStream = getBilibiliVideoStream(playUrlData)

          let videoSize = ''
          let correctList: BilibiliQualityResult<BilibiliVideoStream & { base_url: string }> = { accept_description: [], videoList: [], selectedQuality: '未知' }
          let preparePlaybackPromise: Promise<void> | undefined
          const preparePlayback = (): Promise<void> => {
            preparePlaybackPromise ||= (async () => {
              if (this.islogin && Config.bilibili.videopriority === false && playUrlPayload.dash?.video?.length && playUrlPayload.dash?.audio?.length) {
                const simplify = dedupeBilibiliVideoStreams(playUrlPayload.dash.video)
                playUrlPayload.dash.video = simplify
                correctList = await bilibiliProcessVideos({
                  accept_description: playUrlPayload.accept_description || [],
                  bvid: infoData.data.data.bvid,
                  qn: Config.bilibili.videoQuality
                }, simplify, pickBilibiliStreamUrl(playUrlPayload.dash.audio[0]))
                playUrlPayload.dash.video = correctList.videoList
                playUrlPayload.accept_description = correctList.accept_description
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
                const userProfileData = await this.amagi.bilibili.fetchUserCard({ host_mid: Number(owner.mid), typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig()) as UserProfileResponse
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
              /*
                媒体度量上报（本地增量，上游没有）。位置在体积检查之后、真正发送之前：
                超限那条分支上面已经 return，视频压根没发出去，不该计入统计。

                时长走 fromSeconds —— B站的 `data.duration` 单位是秒
                （fetchVideoDanmakuList 的 JSDoc 写明这点，它拿弹幕秒数直接和它比大小），
                而收集器内部统一存毫秒。分P视频取当前那一P的时长，和上面弹幕那段同源。

                体积用 videoSize 而不是 playUrlStream.size：videopriority 关闭且已登录时
                videoSize 是「视频 + 音频」两条流加起来的真实大小（getvideosize 算的），
                只取 video 流会漏掉音频那部分。它是 MB 字符串，这里换回字节。
              */
              const metricsDuration = iddata.p
                ? (infoData.data.data.pages[iddata.p - 1]?.duration || infoData.data.data.duration)
                : infoData.data.data.duration
              const metricsBytes = Number(videoSize) > 0 ? Math.round(Number(videoSize) * 1024 * 1024) : undefined
              reportMedia({
                kind: 'video',
                durationMs: fromSeconds(metricsDuration),
                bytes: metricsBytes
              })
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
              // 取一次有效数量复用：取值和「要不要出评论图」的判断必须来自同一个键，
              // 否则会出现「新键设了 5，判断却读旧键的 undefined 而整块跳过」。
              const commentLimit = bilibiliCommentLimit()
              // softFetch 不能省：下面的 isSoftFailure 只认返回值，而裸 fetcher 遇到
              // 失败信封会抛。不包的话 12061 变成抛出，判定永远 false，用户拿到错误卡。
              const commentsData = await softFetch(
                async () => await this.amagi.bilibili.fetchComments({
                  number: commentLimit,
                  type: 1,
                  oid: infoData.data.data.aid.toString(),
                  typeMode: 'strict'
                }, '', buildAmagiRequestConfig()),
                SOFT_ERROR_CODES.bilibili
              ) as CommentsResponse
              // UP 主关了评论区是业务上的正常拒绝，不是故障：软错误码不会弹错误卡，
              // 而 bilibiliComments 对它只会返回空数组，于是原来表现成「评论图静默不出」，
              // 用户看不出是关了评论区还是解析坏了。这里明确告知一句再收工。
              if (isSoftFailure(commentsData, SOFT_ERROR_CODES.bilibili)) {
                await this.e.reply('UP主已关闭评论区，无法获取评论')
                return
              }
              const commentsdata = commentLimit > 0
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
          const videoInfo = await this.amagi.bilibili.fetchBangumiInfo({ [iddata.isEpid ? 'ep_id' : 'season_id']: iddata.realid, typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig()) as BangumiInfoResponse
          this.islogin = (await checkCk()).Status === 'isLogin'
          this.isVIP = (await checkCk()).isVIP

          const msg = []

          if (!videoInfo.data) {
            logger.warn(videoInfo.message, `错误码: ${videoInfo.code}`)
            return true
          }
          for (let i = 0; i < videoInfo.data.result.episodes.length; i++) {
            const long_title = videoInfo.data.result.episodes[i]?.long_title || ''
            const badge = videoInfo.data.result.episodes[i]?.badge || ''
            const short_link = videoInfo.data.result.episodes[i]?.short_link || ''
            msg.push([
              `\n> ## 第${i + 1}集`,
              `\n> 标题: ${long_title}`,
              `\n> 类型: ${badge !== '预告' ? '正片' : '预告'}`,
              `\n> 🔒 播放要求: ${badge === '预告' || badge === '' ? '暂无' : badge}`,
              this.botadapter !== 'QQBot' ? `\n> 🔗 分享链接: [🔗点击查看](${short_link})\r\r` : ''
            ])
          }
          const img = await Render('bilibili/bangumi', buildBangumiPayload(videoInfo.data.result))
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
            if (/^[一二三四五六七八九十百千万]+$/.test(Episode)) {
              Episode = Common.chineseToArabic(Episode).toString()
            }
            this.downloadfilename = sanitizeFilenameSegment(
              videoInfo.data.result.episodes[Number(Episode) - 1]?.share_copy,
              50,
              ''
            )
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
            const simplify = dedupeBilibiliVideoStreams(playUrlData.result.dash.video)
            playUrlData.result.dash.video = simplify
            const correctList = await bilibiliProcessVideos({
              accept_description: playUrlData.result.accept_description || [],
              bvid: videoInfo.data.result.season_id.toString(),
              qn: Config.bilibili.videoQuality
            }, simplify, pickBilibiliStreamUrl(at(playUrlData.result.dash.audio)))
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
          // getid 的匹配函数比提取正则宽松，能判成 dynamic_info 却提不出动态 ID
          if (!iddata.dynamic_id) {
            await this.e.reply('该动态链接缺少动态 ID，无法解析')
            break
          }
          const dynamicInfo = await this.amagi.bilibili.fetchDynamicDetail({ dynamic_id: iddata.dynamic_id, typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig()) as DynamicInfoResponse
          // 整个 dynamic_info 分支共用这一个有效数量：下面取数、以及各动态类型里
          // 「要不要发评论图」的判断都得用它，不能一半读新键一半读旧键。
          const commentLimit = bilibiliCommentLimit()
          const rawCommentsData: CommentsResponse | false = dynamicInfo.data.data.item.type !== DynamicType.LIVE_RCMD &&
            commentLimit > 0
            // 同上：下面的 isSoftFailure 读返回值，裸 fetcher 会抛，所以这里也要包。
            ? await softFetch(
              async () => await this.amagi.bilibili.fetchComments({
                type: mapping_table(dynamicInfo.data.data.item.type),
                oid: oid(dynamicInfo.data),
                number: commentLimit,
                typeMode: 'strict'
              }, '', buildAmagiRequestConfig()),
              SOFT_ERROR_CODES.bilibili
            ) as CommentsResponse
            : false
          /*
            软失败（UP 主关了评论区）塌回 `false` 这个既有哨兵，下面各动态类型里
            `&& commentsData` 那几处守卫就会照原样跳过评论块 —— 不塌的话它是个真对象，
            守卫放行、bilibiliComments 又只能给出空数组，结果是**发出一张空评论卡**。
            视频分支那边表现为静默不发，这里比它更糟，所以要单独处理。
          */
          const commentsSoftClosed = rawCommentsData !== false &&
            isSoftFailure(rawCommentsData, SOFT_ERROR_CODES.bilibili)
          if (commentsSoftClosed) await this.e.reply('UP主已关闭评论区，无法获取评论')
          const commentsData: CommentsResponse | false = commentsSoftClosed ? false : rawCommentsData
          const userProfileData = await this.amagi.bilibili.fetchUserCard({ host_mid: Number(dynamicInfo.data.data.item.modules.module_author.mid), typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig()) as UserProfileResponse

          switch (dynamicInfo.data.data.item.type) {
            /** 图文、纯图 */
            case DynamicType.DRAW: {
              const imgArray: unknown[] = []
              const tempFiles: Array<{ filepath?: string }> = []
              let hasGeneratedLivePhoto = false
              const pics = dynamicInfo.data.data.item.modules.module_dynamic.major.opus.pics || []

              // 非实况图的位置传空条目，让结果和 pics 逐位对齐 ——
              // imgArray 的顺序就是转发消息里图片的顺序。
              const livePhotoItems: LivePhotoBatchItem[] = pics.map(item => (
                item?.url && item.live_url
                  ? { staticUrl: item.url, liveVideoUrl: item.live_url }
                  : {}
              ))
              const livePhotoBatch = await buildCommonLivePhotoMessagesBatch(livePhotoItems, {
                platform: 'bilibili',
                headers: {
                  ...baseHeaders,
                  Referer: 'https://www.bilibili.com/'
                }
              })
              tempFiles.push(...livePhotoBatch.tempFiles)
              hasGeneratedLivePhoto = livePhotoBatch.generatedLivePhoto

              for (const [index, item] of pics.entries()) {
                const itemUrl = item?.url
                if (!itemUrl) continue

                const livePhoto = livePhotoBatch.results[index]
                if (livePhoto !== undefined && livePhoto.messages.length > 0) {
                  imgArray.push(...livePhoto.messages)
                  continue
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
                const img = await Render('bilibili/comment', {
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
              if (commentLimit > 0 && commentsData) {
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
                const INFODATA = await this.amagi.bilibili.fetchVideoInfo({ bvid, typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig()) as VideoInfoResponse
                if (commentLimit > 0 && commentsData) {
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

                const img = await Render('bilibili/dynamic/DYNAMIC_TYPE_AV',
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
              const userINFO = await this.amagi.bilibili.fetchUserCard({ host_mid: Number(dynamicInfo.data.data.item.modules.module_author.mid), typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig()) as UserProfileResponse
              const img = await Render('bilibili/dynamic/DYNAMIC_TYPE_LIVE_RCMD',
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
                this.amagi.bilibili.fetchArticleInfo({ id: articleId, typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig()),
                this.amagi.bilibili.fetchArticleContent({ id: articleId, typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig())
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

              const img = await Render('bilibili/dynamic/DYNAMIC_TYPE_ARTICLE', {
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

              if (commentLimit > 0 && commentsData) {
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
          // getid 只用 includes('live.bilibili.com') 判型，提取正则却要求尾随数字
          if (!iddata.room_id) {
            await this.e.reply('该直播间链接缺少房间号，无法解析')
            return true
          }
          const liveInfo = await this.amagi.bilibili.fetchLiveRoomInfo({ room_id: iddata.room_id, typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig()) as LiveInfoResponse
          const roomInitInfo = await this.amagi.bilibili.fetchLiveRoomInitInfo({ room_id: iddata.room_id, typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig()) as RoomInitResponse
          const userProfileData = await this.amagi.bilibili.fetchUserCard({ host_mid: Number(roomInitInfo.data.data.uid), typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig()) as UserProfileResponse

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
   * 下载 dash 分离流并合成一个文件发出去。
   *
   * 从 `getvideo()` 的已登录分支里提出来的：未登录分支现在也可能拿到 dash
   * （ck 填了但失效时 B站只回 dash 不回 durl），两边需要同一套合流逻辑，
   * 不然「无声视频」和「上传通道选错」这类毛病要修两遍。
   *
   * @param videoUrl dash 的视频流地址（无音轨）
   * @param audioUrl dash 的音频流地址
   * @param danmakuList 需要烧进画面的弹幕；空数组表示不烧
   * @param tag 临时文件名里的区分段，取 bvid / season_id 这类；缺省用时间戳
   * @param videoCandidates 视频流的备用地址（含镜像与改写地址），缺省表示只有 `videoUrl` 一条
   * @param audioCandidates 音频流的备用地址
   */
  private async downloadMergedStream ({ videoUrl, audioUrl, danmakuList, tag, videoCandidates, audioCandidates, resourceKey }: {
    videoUrl: string
    audioUrl: string
    danmakuList: BilibiliDanmakuItem[]
    tag?: string
    videoCandidates?: readonly string[]
    audioCandidates?: readonly string[]
    resourceKey?: string
  }): Promise<void> {
    const suffix = tag || String(Date.now())
    // 这两个流地址自带鉴权参数，再带 Cookie 反而会被判风控
    const streamHeaders = { Referer: this.headers?.Referer, Cookie: '' }
    // 资源键带上流类型：视频和音频的候选地址不能混。两者的主机名往往相同，
    // 只有路径不同，混在一起会把音频地址当成视频的备胎试一遍（下得到、但是错的文件）。
    //
    // 键由调用方给，不从 `tag` 推：`tag` 拿不到 bvid 时会退化成时间戳，
    // 用它当键等于每次下载都造一个只用一次的条目，把地址簿填满却一次也命中不了。
    const resourceBase = resourceKey ?? ''
    // 测速只开给视频流。音频流一路才几兆，为它多等最多 3 秒握手不值得；
    // 而且两路流的主机名基本相同，视频那一路测出来的结果已经进了按主机缓存的表，
    // 音频真的换到同一批主机上时直接命中缓存，不必自己再测一遍。
    const probeCdn = Config.bilibili.bilibiliCdnProbe === true
    const [bmp4, bmp3] = await Promise.all([
      downloadFile(videoUrl, {
        title: `Bil_V_${suffix}.mp4`,
        headers: streamHeaders,
        candidates: videoCandidates,
        resource: resourceBase ? `${resourceBase}:video` : undefined,
        probeCdn
      }),
      downloadFile(audioUrl, {
        title: `Bil_A_${suffix}.mp3`,
        headers: streamHeaders,
        candidates: audioCandidates,
        resource: resourceBase ? `${resourceBase}:audio` : undefined
      })
    ])

    const videoFilePath = bmp4.filepath
    const audioFilePath = bmp3.filepath
    if (!videoFilePath || !audioFilePath) {
      await Common.removeFile(videoFilePath, true)
      await Common.removeFile(audioFilePath, true)
      logger.error('[Bilibili] 视频或音频流下载失败，无法合成')
      return
    }

    await mergeFile('二合一（视频 + 音频）', {
      path: videoFilePath,
      path2: audioFilePath,
      resultPath: Common.tempDri.video + `Bil_Result_${suffix}.mp4`,
      callback: async (success: boolean, resultPath: string) => {
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

        /**
         * 根据文件大小选择上传方式。
         *
         * 原来的分流线错用了 `upload.filelimit` —— 那是「多大就直接放弃上传」的闸门，
         * 已经放开到 1536MB，于是 `useGroupFile: true` 那条分支实际上永远走不到，
         * 几百 MB 的合流视频会被塞进消息段然后发送失败（这条路径不经过 downloadVideo，
         * 拿不到那边按适配器算的判据，所以必须在这里自己算）。
         *
         * 现在只回答「消息段装不下吗」这一个问题；装得下时传 false，
         * 由 uploadFile 再按 usegroupfile / groupfilevalue 决定要不要走群文件。
         *
         * 适配器名字取 `new Base(this.e).botadapter` 而不是本类的 `this.botadapter`：
         * 本类的 override 返回的是**未归一化**的原始名字（Lagrange 系会是 'Lagrange'），
         * 无事件时还会返回 undefined，拿去比对名单会得出错误的上限。
         */
        return await uploadFile(
          this.e,
          { filepath: filePath, totalBytes: fileSizeInMB, originTitle: this.downloadfilename },
          '',
          { useGroupFile: needsGroupFileChannel(new Base(this.e).botadapter, fileSizeInMB) }
        )
      }
    })
  }

  /**
   * @param {Object} videoData - 视频数据对象
   * @param {import('@ikenxuan/amagi').BiliBangumiVideoInfo | import('@ikenxuan/amagi').BiliOneWork} [videoData.infoData] - 视频信息数据
   * @param {import('@ikenxuan/amagi').BiliVideoPlayurlIsLogin | import('@ikenxuan/amagi').BiliBiliVideoPlayurlNoLogin | import('@ikenxuan/amagi').BiliBangumiVideoPlayurlIsLogin | import('@ikenxuan/amagi').BiliBangumiVideoPlayurlNoLogin} [videoData.playUrlData] - 播放URL数据
   * @param {BilibiliDanmakuItem[]} [videoData.danmakuList] - 弹幕列表
   * @returns {Promise<void>}
   */
  async getvideo ({ infoData, playUrlData, danmakuList = [] }: GetVideoInput): Promise<void> {
    if (Config.bilibili.videopriority === true) this.islogin = false

    // 单个视频取 bvid，番剧取 season_id。两个用途：临时文件名的区分段，以及
    // CDN 地址簿的资源键。提到分支外面是因为未登录那条路同样需要它当键——
    // 它手里的 infoData 和已登录分支是同一个，只是以前没用过。
    const isOneVideo = this.Type === 'one_video'
    const videoId = isOneVideo
      ? infoData && 'data' in infoData ? infoData.data.bvid : undefined
      : infoData && 'result' in infoData ? infoData.result.season_id : undefined

    if (this.islogin) {
      const dash = getBilibiliDash(playUrlData)
      // 全部候选地址，不只是第一条：某个节点 403 / 404 / 被限速时下载层才有下一条可换。
      // 首位仍然是「优先非 PCDN」那条，所以正常情况下的行为和以前一致。
      const videoCandidates = collectBilibiliStreamUrls(dash?.video?.[0])
      const audioCandidates = collectBilibiliStreamUrls(dash?.audio?.[0])
      const videoUrl = videoCandidates[0] ?? ''
      const audioUrl = audioCandidates[0] ?? ''
      if (!videoUrl || !audioUrl) {
        const videoStream = getBilibiliVideoStream(playUrlData)
        if (videoStream?.url) {
          await downloadVideo(this.e, { video_url: videoStream.url, title: { timestampTitle: `tmp_${Date.now()}.mp4`, originTitle: `${this.downloadfilename}.mp4` } })
        } else {
          logger.error('无法下载视频,请配置CooKie后重试')
        }
        return
      }

      await this.downloadMergedStream({
        videoUrl,
        audioUrl,
        videoCandidates,
        audioCandidates,
        resourceKey: videoId ? `bili:${videoId}` : undefined,
        danmakuList,
        tag: String(videoId ?? Date.now())
      })
    } else {
      /**
       * 没登录（或 ck 已失效、或配了视频优先）的情况下发直链。
       *
       * 这里必须同时认 `durl` 和 `dash`，不能只读 `durl`：
       * 「插件认为未登录」和「B站返回哪种流」是两个独立的判据。amagi 的 qtparam 按
       * `cookie === ''` 分流 —— 空串才请求 `&platform=html5`（回 durl 直链），
       * 只要 ck 非空它就按已登录去请求（回 dash 分离流）。而本插件的 checkCk()
       * 判的是「ck 有不有效」。两者在「ck 填了但失效 / 过期」时必然打架：
       * 实测该场景下响应是 durl=0、dash.video=4、dash.audio=3，
       * 旧代码只读 durl 就直接报「请配置CooKie后重试」——用户明明配了 ck，
       * 错误提示还把人往配置方向带，而真实原因是 ck 失效。
       *
       * dash 的 video 流没有音轨，所以取到 dash 时优先和 audio 合流；
       * 只有 video 没有 audio 时才退化成发无声视频（好过什么都发不出去）。
       */
      const durl = getBilibiliDurl(playUrlData)[0]
      const durlUrl = durl?.url
      const dash = getBilibiliDash(playUrlData)
      const dashVideoCandidates = collectBilibiliStreamUrls(dash?.video?.[0])
      const dashAudioCandidates = collectBilibiliStreamUrls(dash?.audio?.[0])

      // durl 也给 backup_url，形状和 dash 的一样，所以能共用同一套候选逻辑。
      // 这条路（未登录 / ck 失效）恰恰是最常撞上 PCDN 的：请求「看起来没有身份」时
      // B站 更倾向于把地址指到 PCDN 节点上。
      const durlCandidates = collectBilibiliStreamUrls(durl)

      // durl 是单文件直链（自带音轨），优先用；dash 需要合流，代价更高
      const videoUrl = durlUrl || dashVideoCandidates[0] || ''
      // 只有走 dash 且拿到音频流时才需要合流
      const audioUrl = durlUrl ? '' : (dashAudioCandidates[0] ?? '')
      const videoCandidates = durlUrl ? durlCandidates : dashVideoCandidates

      if (!videoUrl) {
        logger.error('无法下载视频：B站没有返回任何可用的视频流（durl 与 dash 均为空）')
        await this.e.reply('没能取到该视频的下载地址，可能是分区限制或接口变更，可稍后再试。', true)
        return
      }

      if (!durlUrl) {
        logger.mark(
          Config.cookies.bilibili
            ? '[Bilibili] 接口只返回了 dash 分离流，但本插件判定为未登录（ck 大概率已失效）；先按 dash 下载，建议用【#B站登录】更新 ck'
            : '[Bilibili] 接口只返回了 dash 分离流，将走合流下载'
        )
      }

      if (audioUrl) {
        // 走到这里必然是 dash（durlUrl 为空才会有 audioUrl），所以候选地址取 dash 那两路
        await this.downloadMergedStream({
          videoUrl,
          audioUrl,
          videoCandidates: dashVideoCandidates,
          audioCandidates: dashAudioCandidates,
          resourceKey: videoId ? `bili:${videoId}` : undefined,
          danmakuList
        })
        return
      }

      if ((this.forceBurnDanmaku || Config.bilibili.burnDanmaku) && danmakuList.length > 0) {
        const videoFile = await downloadFile(videoUrl, {
          title: `Bil_V_tmp_${Date.now()}.mp4`,
          headers: this.headers,
          candidates: videoCandidates,
          // 单文件流（durl 自带音轨）用 `:full` 区别于 dash 的 `:video`——
          // 同一个 bvid 下两者是不同的资源，共用键会互相污染候选清单
          resource: videoId ? `bili:${videoId}:${durlUrl ? 'full' : 'video'}` : undefined
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
      await downloadVideo(this.e, {
        video_url: videoUrl,
        title: { timestampTitle: `tmp_${Date.now()}.mp4`, originTitle: `${this.downloadfilename}.mp4` },
        candidates: videoCandidates,
        resource: videoId ? `bili:${videoId}:${durlUrl ? 'full' : 'video'}` : undefined
      })
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
    const viewText = `📊 播放量: ${Common.count(view)}`
    const danmakuText = `💬 弹幕: ${Common.count(danmaku)}`
    const likeText = `👍 点赞: ${Common.count(like)}`
    const coinText = `🪙 投币: ${Common.count(coin)}`
    const shareText = `🔄 转发: ${Common.count(share)}`
    const favoriteText = `⭐ 收藏: ${Common.count(favorite)}`

    const firstColItems = [viewText, likeText, shareText]
    const maxFirstColLength = Math.max(...firstColItems.map(item => this.getStringDisplayWidth(item)))

    const line1 = this.alignTwoColumns(viewText, danmakuText, maxFirstColLength)
    const line2 = this.alignTwoColumns(likeText, coinText, maxFirstColLength)
    const line3 = this.alignTwoColumns(shareText, favoriteText, maxFirstColLength)

    return `${line1}\n${line2}\n${line3}`
  }

  /**
   * @param {string} col1 - 第一列文本
   * @param {string} col2 - 第二列文本
   * @param {number} targetLength - 目标长度
   * @returns {string} 对齐后的文本
   */
  alignTwoColumns (col1: string, col2: string, targetLength: number): string {
    const col1Width = this.getStringDisplayWidth(col1)
    const spacesNeeded = targetLength - col1Width + 5 // 5是两列之间的固定间距

    return col1 + ' '.repeat(spacesNeeded) + col2
  }

  /**
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
 * @param { { img_src: string }[] } pic 一个包含图片源字符串的数组
 * @returns {Object[]} imgArray - 包含图片源地址的对象数组。
 */
export const cover = (pic: DynamicPicture[]): Array<{ image_src: string }> => {
  const imgArray: Array<{ image_src: string }> = []
  for (const i of pic) {
    const src = i.img_src || i.src || i.url
    // 三个字段都没有就跳过：契约要的是 string，塞 undefined 进去等于给模板埋个空 <img>
    if (!src) continue
    imgArray.push({ image_src: src })
  }
  return imgArray
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

export const bilibiliProcessVideos = async <T extends BilibiliVideoStream & { base_url: string }> (
  qualityOptions: BilibiliQualityOptions,
  videoList: T[],
  audioUrl: string
): Promise<BilibiliQualityResult<T>> => {
  // 如果不是自动选择模式，直接根据配置的清晰度选择视频
  //
  // 这里的 `&&` 是刻意不跟上游的 `||`。上游写 `qn !== 0 || videoQuality !== 0`，
  // 而 qn 是可选参数：qn 为 undefined 时 `undefined !== 0` 恒为 true，于是
  // 「配置成自动挡（videoQuality: 0）」永远进不了自动挡分支；更糟的是显式传
  // `qn: 0` 也会落进手动挡，此时 targetQuality 算出 0，下面 find/filter 全部落空，
  // 最终选到**最低**画质 —— 用户要自动挡，拿到的是 240P。
  // 本仓库的语义是：0 表示「自动挡」这个模式，模式归配置管，qn 只是画质提示，
  // 所以两者任一为 0 就走自动挡。tests/unit/bilibili-quality.test.ts 里
  // 「automatic branch wins over an explicit qn」「treats an explicit qn: 0 as automatic」
  // 两条用例分别钉住这两个方向，换成上游的 `||` 会同时失败。
  if (qualityOptions.qn !== 0 && Config.bilibili.videoQuality !== 0) {
    // `|| 80` 也是刻意不跟上游的裸 `??`：videoQuality 在 src/types/config.ts 里是可选字段，
    // 配置文件缺这一项时 targetQuality 会是 undefined，
    // 而 `id < undefined` / `id > undefined` 全为 false，会让下面三个分支一路落到
    // `sortedVideos[0]`（升序后的最低画质）。给个 1080P 的默认值比静默降到 240P 合理。
    const targetQuality = qualityOptions.qn || Config.bilibili.videoQuality || 80

    let matchedVideo = videoList.find(video => video?.id === targetQuality)

    // 如果没有完全匹配的清晰度，找最接近的
    if (!matchedVideo) {
      const sortedVideos = [...videoList].sort((a, b) => a.id - b.id)

      const lowerVideos = sortedVideos.filter(video => video.id < targetQuality)
      const higherVideos = sortedVideos.filter(video => video.id > targetQuality)

      if (lowerVideos.length > 0) {
        matchedVideo = lowerVideos[lowerVideos.length - 1]
      } else if (higherVideos.length > 0) {
        matchedVideo = higherVideos[0]
      } else {
        matchedVideo = sortedVideos[0]
      }
    }

    // 更新视频列表和清晰度描述
    //
    // 上游这里是 `qnd[matchedVideo.id]` 无守卫直取。videoList 为空时上面三个分支会
    // 一路落到 `sortedVideos[0]`，也就是 undefined，上游会当场 TypeError；
    // 而调用方拿到的 `videoList` 还会是 `[undefined]`，错误被推迟到下载阶段才炸。
    // 空列表在「未登录 / ck 失效 / 番剧无权限」时是真实可达的，所以这层守卫保留：
    // 取不到就退回 accept_description[0]，再退回 '未知'，videoList 保持空数组。
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
      // 上游没有这个 try/catch：任意一条流的 HEAD 请求失败（PCDN 域名解析不了、
      // 鉴权参数过期、超时）就会把整个解析流程带崩，用户什么都收不到。
      // 这里把失败的那条记成一个必然超限的体积，让它自然落选，其余清晰度照常参选。
      logger.error(`获取视频ID ${video.id} 大小时出错:`, error)
      results[video.id] = '999999MB'
    }
  }

  logger.info('所有视频大小结果:', results)

  // 在所有不超过体积上限的清晰度里挑体积最大的那个（也就是画质最好的那个）。
  // `maxSize - size` 最小 等价于 size 最大，严格小于比较让并列时保留先遍历到的；
  // results 的键是数字字符串，JS 按数字升序枚举，所以并列时留下的是较低清晰度。
  //
  // `|| 100` 同样是刻意不跟上游的裸 `??`：maxAutoVideoSize 在 src/types/config.ts 里是
  // 可选字段，缺省时上游算出 undefined，`size <= undefined` 恒为 false，
  // 于是每条流都被判超限、直接掉进最低画质兜底 —— 自动挡形同废掉。
  const maxSize = qualityOptions?.maxAutoVideoSize || Config.bilibili.maxAutoVideoSize || 100
  logger.info('最大允许大小:', maxSize, 'MB')

  let closestId: number | null = null
  let smallestDifference = Infinity

  Object.entries(results).forEach(([id, sizeStr]) => {
    const idNum = Number(id)
    const size = parseFloat(sizeStr.replace('MB', ''))
    logger.info(`检查视频ID ${idNum} (${qnd[idNum]}), 大小: ${size}MB`)

    if (size <= maxSize) {
      const difference = maxSize - size
      if (difference < smallestDifference) {
        smallestDifference = difference
        closestId = idNum
      }
    }
  })

  logger.info('选中的视频ID:', closestId)

  let selectedQuality = ''

  if (closestId !== null) {
    const closestQuality = qnd[Number(closestId)] || '未知'
    qualityOptions.accept_description = qualityOptions.accept_description.filter(desc => desc === closestQuality)
    if (qualityOptions.accept_description.length === 0) {
      qualityOptions.accept_description = [closestQuality]
    }
    const video = videoList.find(video => video.id === Number(closestId))
    if (video) {
      videoList = [video]
    }
    selectedQuality = closestQuality
  } else {
    // 没有任何清晰度符合体积上限，退回最低画质。
    //
    // 上游是 `[[...videoList].pop()!]` / `[[...accept_description].pop()!]` 两个非空断言。
    // 空数组 pop() 得到 undefined，上游会把 `[undefined]` 交给下载阶段，
    // 报出来的是「读不到 base_url」这种离现场很远的错。这里改成取到才替换：
    // 空列表就保持为空，让调用方的空流检查去报「没有可用的视频流」。
    const lastVideo = [...videoList].pop()
    if (lastVideo) {
      videoList = [lastVideo]
    }
    const lastDescription = [...qualityOptions.accept_description].pop()
    if (lastDescription) {
      qualityOptions.accept_description = [lastDescription]
      selectedQuality = lastDescription
    }
  }

  logger.warn('最终选中的画质:', selectedQuality)
  return {
    accept_description: qualityOptions.accept_description,
    videoList,
    selectedQuality
  }
}

const getContentRangeSize = (contentRange: string | undefined): number => {
  const match = contentRange?.match(/\/(\d+)/)
  return match?.[1] ? parseInt(match[1], 10) : 0
}

/**
 * [bilibili] 获取视频和音频的总大小
 * @param {string} videourl - 视频流URL
 * @param {string} audiourl - 音频流URL
 * @param {string} bvid - 视频BV号
 * @returns  返回视频和音频总大小(MB),保留2位小数
 */
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
