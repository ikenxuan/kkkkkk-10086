import { Base, baseHeaders, Common, Config, downloadFile, mergeFile, Render, uploadFile, Version, processImageUrl, sanitizeFilenameSegment } from '@/module/utils/index'
import { bilibiliProcessVideos, cover, generateDecorationCard, getBilibiliDash, getBilibiliPayload, getvideosize, replacetext } from './bilibili.js'
import { buildBilibiliLiveSessionId, parseBilibiliLiveStartedAt } from './live-status.js'
import {
  applyBilibiliEmojiTable,
  buildBilibiliArticleCategories,
  buildBilibiliArticleRichText,
  buildBilibiliRichTextForwardNodes,
  formatBilibiliVideoDescRichText,
  getUsernameMetadata
} from './dynamicText.js'
import { createBilibiliRichTextForwardMessage } from './richtext-message.js'
import { bilibiliFetcher, buildAmagiRequestConfig } from '@/module/utils/amagiClient'
import { buildLivePhotoMessagesBatch as buildCommonLivePhotoMessagesBatch, buildLivePhotoTipMessage } from '@/module/platform/common/livePhoto'
import type { LivePhotoBatchItem } from '@/module/platform/common/types'
import { withDownloadBucket } from '@/module/utils/Network/DownloadBudget'
import { buildPushListGroupInfo, matchesGroup } from '@/module/platform/common/pushList'
import { bilibiliDB, cleanOldDynamicCache } from '@/module/db/index'
import type { BilibiliFilterPushItem } from '@/module/db/bilibili'
import common from '@/runtime/host/common'
import type { BilibiliPushItem as BilibiliPushConfigItem } from '@/types/config'
import fs from 'node:fs'
import { getErrorMessage } from '@/module/utils/error-message'
import { loadAmagiRuntime } from './amagi-runtime.js'
import type { AmagiResponse, BiliUserDynamic, BiliUserProfile, BilibiliArticleContent, BilibiliArticleInfo, BilibiliDynamicItem, BilibiliDynamicPayload, BilibiliLiveCard, BilibiliLiveRoomInfo, BilibiliPushEvent, BilibiliPushTarget, BilibiliUserLiveStatus, BilibiliVideoInfo, ForwardNodes, GroupSendable, RenderResult, WillBePushList } from './types.js'

const { DynamicType, MajorType } = loadAmagiRuntime()

const asAmagiResponse = <T>(value: unknown): AmagiResponse<T> => value as AmagiResponse<T>

/** 将直播状态接口适配为现有动态推送链路使用的直播推荐项。 */
const createLiveDynamicItem = (
  sessionId: string,
  liveStartedAt: string,
  liveInfo: BilibiliLiveRoomInfo['data'],
  liveStatus: BilibiliUserLiveStatus['data']
): BilibiliDynamicItem => {
  const content = JSON.stringify({
    live_play_info: {
      area_name: liveInfo.area_name || '',
      cover: liveInfo.user_cover || liveStatus.cover || '',
      online: liveInfo.online || 0,
      room_id: liveInfo.room_id,
      title: liveInfo.title || liveStatus.title || '',
      watched_show: {
        text_large: liveInfo.watched_show?.text_large || `${liveInfo.online || 0}人观看`
      }
    }
  })

  return {
    id_str: sessionId,
    type: DynamicType.LIVE_RCMD,
    modules: {
      module_author: {
        face: '',
        mid: 0,
        name: '',
        pendant: { image: '' },
        pub_ts: Math.floor(Date.parse(liveStartedAt) / 1000)
      },
      module_dynamic: {
        major: {
          type: MajorType.LIVE_RCMD,
          live_rcmd: { content }
        },
        topic: null
      },
      module_stat: {
        comment: { count: 0 },
        forward: { count: 0 },
        like: { count: 0 }
      }
    },
    orig: undefined as unknown as BilibiliDynamicPayload
  }
}

/**
 * @typedef {import('@ikenxuan/amagi').BiliUserDynamic} BiliUserDynamic
 * @typedef {import('@ikenxuan/amagi').BiliUserProfile} BiliUserProfile
 */

/**
 * 下载文件选项
 * @typedef {import('../../utils/Base.js').downloadFileOptions} downloadFileOptions
 */

/**
 * 定义推送列表项的接口
 * @typedef {import('../../utils/Config.js').bilibiliPushItem} bilibiliPushItem
 */

/** 已支持推送的动态类型 */
export { DynamicType }

/**
 * 每个推送项的类型定义
 * @typedef {Object} BilibiliPushItem
 * @property {string} remark - 该UP主的昵称
 * @property {number} host_mid - UP主UID
 * @property {number} create_time - 动态发布时间
 * @property {Array<{groupId: string, botId: string}>} targets - 要推送到的群组和机器人ID
 * @property {BiliUserDynamic['data']['items'][number]} Dynamic_Data - 动态详情信息
 * @property {string} avatar_img - UP主头像url
 * @property {DynamicType} dynamic_type - 动态类型
 */

/**
 * Bilibili基础请求头配置
 * @type {downloadFileOptions['headers']}
 */
const bilibiliBaseHeaders = {
  ...baseHeaders,
  Referer: 'https://api.bilibili.com/',
  Cookie: Config.cookies.bilibili
}

const DEFAULT_BILIBILI_PUSH_TYPES = ['video', 'draw', 'word', 'live', 'forward', 'article'] as const
type BilibiliPushType = typeof DEFAULT_BILIBILI_PUSH_TYPES[number]

const BILIBILI_PUSH_TYPE_TO_DYNAMIC_TYPE: Record<BilibiliPushType, string> = {
  video: DynamicType.AV,
  draw: DynamicType.DRAW,
  word: DynamicType.WORD,
  live: DynamicType.LIVE_RCMD,
  forward: DynamicType.FORWARD,
  article: DynamicType.ARTICLE
}

const isBilibiliPushType = (value: unknown): value is BilibiliPushType => (
  typeof value === 'string' && (DEFAULT_BILIBILI_PUSH_TYPES as readonly string[]).includes(value)
)

/**
 * 推送时的「二次解析」是否覆盖该动态类型。
 *
 * 配置缺省时按「全部允许」处理：`Config` 对 default_config 与用户配置只做浅合并，
 * 用户只要写了 `push:` 这一层就可能读不到 parseDynamicTypes，这时必须保持加这道
 * 开关之前的行为，不能因为读不到配置就把二次解析整个关掉。
 * 显式配成空数组是「一个都不解析」，照配置执行。
 */
const isParseDynamicTypeAllowed = (dynamicType: string): boolean => {
  const configured = Config.bilibili?.push?.parseDynamicTypes
  if (!Array.isArray(configured)) return true
  return (configured as string[]).includes(dynamicType)
}

export const normalizeBilibiliPushTypes = (pushTypes: unknown): BilibiliPushType[] => {
  if (!Array.isArray(pushTypes) || pushTypes.length === 0) return [...DEFAULT_BILIBILI_PUSH_TYPES]
  const result: BilibiliPushType[] = []
  for (const type of pushTypes) {
    if (isBilibiliPushType(type) && !result.includes(type)) result.push(type)
  }
  return result.length > 0 ? result : [...DEFAULT_BILIBILI_PUSH_TYPES]
}

export class Bilibilipush extends Base {
  declare e: BilibiliPushEvent | undefined
  force = false
  /**
   * 构造函数
   * @param {*} [e] - 事件对象，定时任务触发时没有事件
   * @param {boolean} [force=false] - 是否强制推送
   */
  constructor (e?: BilibiliPushEvent, force = false) {
    super(e)
    // 这里原来直接拦掉 QQBot：`if (this.botadapter === 'QQBot') { reply('不支持QQBot'); return }`。
    // QQBot 开启全量消息后主动推送不再受限，所以这道拦截去掉。
    //
    // 顺带说明原来那段还有个坑：它是在构造函数里 `return`，对象照样被造出来，
    // 只是漏掉了 `this.force = force` —— 调用方拿到的是一个「看着正常但 force 恒为 false」
    // 的实例，然后继续往下跑。
    this.force = force
  }

  /**
   * 执行主要的操作流程
   */
  /**
   * 执行主要的操作流程。
   *
   * 整段包在 `withDownloadBucket()` 里，是因为主动推送**不走** `runCoordinatedParse`，
   * 于是 ParseCoordinator 铺的下载桶上下文在这条路上是空的 —— 不套的话这一轮推送里
   * 所有下载都会落到 default 兜底桶，和别的平台抢同一份额度。
   */
  async action (): Promise<boolean | void> {
    return await withDownloadBucket('bilibili', async () => {
      try {
        await this.syncConfigToDatabase()
        this.ensureConfigFields(Config.pushlist.bilibili || [])
        // 清理旧的动态缓存记录
        const deletedCount = await cleanOldDynamicCache('bilibili', 1)
        if (deletedCount > 0) {
          logger.info(`已清理 ${deletedCount} 条过期的B站动态缓存记录`)
        }

        const data = await this.getDynamicList(Config.pushlist.bilibili || [])
        const pushdata = await this.excludeAlreadyPushed(data.willbepushlist)

        if (Object.keys(pushdata).length === 0) return true

        if (this.force) {
          return await this.forcepush(pushdata)
        } else {
          return await this.getdata(pushdata)
        }
      } catch (error) {
        logger.error(error)
      }
    })
  }

  /**
   * 同步配置文件中的订阅信息到数据库
   */
  async syncConfigToDatabase (): Promise<void> {
    // 如果配置文件中没有B站推送列表，直接返回
    if (!Config.pushlist.bilibili || Config.pushlist.bilibili.length === 0) {
      return
    }

    await bilibiliDB?.syncConfigSubscriptions(Config.pushlist.bilibili)
  }

  /**
   * 补全新版 B站推送字段，保持旧配置可直接运行。
   * @param {bilibiliPushItem[]} pushList 推送配置列表
   */
  ensureConfigFields (pushList: BilibiliPushConfigItem[]): void {
    if (!pushList.length) return

    // 改动直接算在磁盘上的最新值上，不用参数里那份快照落盘（那样会覆盖掉这期间别处的写入）。
    // 参数只用来判断「值不值得开一次读写」，省掉每轮推送都读一遍 yaml。
    const needsFix = pushList.some(item =>
      item.switch === undefined ||
      !Array.isArray(item.pushTypes) ||
      item.pushTypes.join(',') !== normalizeBilibiliPushTypes(item.pushTypes).join(',')
    )
    if (!needsFix) return

    Config.update('pushlist', 'bilibili', (current: BilibiliPushConfigItem[] | undefined) => {
      const list = Array.isArray(current) ? current : []
      let changed = false
      for (const item of list) {
        const pushTypes = normalizeBilibiliPushTypes(item.pushTypes)
        if (!Array.isArray(item.pushTypes) || item.pushTypes.join(',') !== pushTypes.join(',')) {
          item.pushTypes = pushTypes
          changed = true
        }
        if (item.switch === undefined) {
          item.switch = true
          changed = true
        }
      }
      return changed ? list : undefined
    })
  }

  /**
   * @typedef {Record<string, BilibiliPushItem>} WillBePushList
   */

  /**
   * 异步获取数据并根据动态类型处理和发送动态信息。
   * @param {WillBePushList} data - 包含动态相关信息的对象
   * @returns {Promise<boolean>} - 返回处理结果，成功返回true，失败返回false
   */
  async getdata (data: WillBePushList): Promise<boolean> {
    try {
      for (const dynamicId in data) {
        const dynamicItem = data[dynamicId]
        if (!dynamicItem) continue

        logger.mark(`
        ${logger.blue('开始处理并渲染B站动态图片')}
        ${logger.cyan('UP')}: ${logger.green(dynamicItem.remark)}
        ${logger.cyan('动态id')}：${logger.yellow(dynamicId)}
        ${logger.cyan('访问地址')}：${logger.green('https://t.bilibili.com/' + dynamicId)}`)

        let skip = await skipDynamic(dynamicItem)
        let send_video = true
        /** @type {import ('@kaguyajs/trss-yunzai-types').icqq.segment[]} */
        let img: RenderResult = []
        let dycrad: BilibiliVideoInfo | undefined
        let articleForwardPayload: {
          body: ReturnType<typeof buildBilibiliArticleRichText>
          forwardNodes: Awaited<ReturnType<typeof buildBilibiliRichTextForwardNodes>>
          title: string
          summary: string
          shareUrl: string
        } | null = null

        // 放在 `if (!skip)` 之外：跳过的动态虽然当前不发接口请求，但那是巧合而非约束
        // ——一旦有人在这个方法里加一个不受 skip 保护的 amagi 调用，留在 if 里面就会让
        // 卡片挂上**上一条**动态的群号。这一层拿到的是已解析的 targets，而 pushContext
        // 收配置原文，所以拼回 `群号:机器人账号`，让 Base 侧只有一套解析口径
        // （见 Base.ts 的 parsePushTargets）。
        this.pushContext = {
          groupWithBot: dynamicItem.targets.map(target => `${target.groupId}:${target.botId}`)
        }

        if (!skip) {
          const userINFO = asAmagiResponse<BiliUserProfile>(await this.amagi.bilibili.fetchUserCard({ host_mid: dynamicItem.host_mid, typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig()))
          const emojiResponse = asAmagiResponse<{ data?: { packages?: unknown } }>(await this.amagi.bilibili.fetchEmojiList({}, Config.cookies.bilibili, buildAmagiRequestConfig()))
          const emojiDATA = extractEmojisData(emojiResponse?.data?.data?.packages || [])

          switch (dynamicItem.dynamic_type) {
            /** 处理图文动态 */
            case DynamicType.DRAW: {
              if (dynamicItem.Dynamic_Data.modules.module_dynamic?.topic !== null && dynamicItem.Dynamic_Data.modules.module_dynamic && dynamicItem.Dynamic_Data.modules.module_dynamic.topic !== null) {
                const name = dynamicItem.Dynamic_Data.modules.module_dynamic.topic?.name
                dynamicItem.Dynamic_Data.modules.module_dynamic.major?.opus?.summary?.rich_text_nodes?.unshift({
                  orig_text: name,
                  text: name,
                  type: 'topic',
                  rid: dynamicItem.Dynamic_Data.modules.module_dynamic.topic?.id?.toString() || ''
                })
                if (dynamicItem.Dynamic_Data.modules.module_dynamic.major?.opus?.summary) {
                  dynamicItem.Dynamic_Data.modules.module_dynamic.major.opus.summary.text = `${name}\n\n` + (dynamicItem.Dynamic_Data.modules.module_dynamic.major?.opus?.summary?.text || '')
                }
              }
              img = await Render('bilibili/dynamic/DYNAMIC_TYPE_DRAW',
                {
                  image_url: cover(dynamicItem.Dynamic_Data.modules.module_dynamic.major?.opus?.pics ||
                    dynamicItem.Dynamic_Data.modules.module_dynamic.major?.draw?.items || []),
                  text: replacetext(
                    dynamicItem.Dynamic_Data.modules.module_dynamic.major?.opus?.summary?.text || '',
                    dynamicItem.Dynamic_Data.modules.module_dynamic.major?.opus?.summary?.rich_text_nodes || []
                  ),
                  // 'auto' 让模板按图片数自己挑布局，规则在 DYNAMIC_TYPE_DRAW.tsx 里
                  imageLayout: 'auto',
                  dianzan: Common.count(dynamicItem.Dynamic_Data.modules.module_stat.like.count),
                  pinglun: Common.count(dynamicItem.Dynamic_Data.modules.module_stat.comment.count),
                  share: Common.count(dynamicItem.Dynamic_Data.modules.module_stat.forward.count),
                  create_time: Common.convertTimestampToDateTime(dynamicItem.Dynamic_Data.modules.module_author.pub_ts),
                  avatar_url: dynamicItem.Dynamic_Data.modules.module_author.face,
                  frame: dynamicItem.Dynamic_Data.modules.module_author.pendant.image,
                  share_url: 'https://t.bilibili.com/' + dynamicItem.Dynamic_Data.id_str,
                  dynamic_id: String(dynamicItem.Dynamic_Data.id_str),
                  usernameMeta: getUsernameMetadata(userINFO?.data?.data?.card ?? {}),
                  fans: Common.count(userINFO?.data?.data?.follower),
                  user_shortid: dynamicItem.host_mid,
                  total_favorited: Common.count(userINFO?.data?.data?.like_num),
                  following_count: Common.count(userINFO?.data?.data?.card?.attention),
                  decoration_card: generateDecorationCard(dynamicItem.Dynamic_Data.modules.module_author?.decoration_card),
                  render_time: Common.getCurrentTime(),
                  dynamicTYPE: '图文动态推送'
                }
              )
              break
            }
            /** 处理纯文动态 */
            case DynamicType.WORD: {
              // 表情先交给富文本构建（B 站的 rich_text_nodes 一般已带 emoji 节点），
              // 剩下的 `[表情名]` 字面量再用表情表补一遍
              const text = applyBilibiliEmojiTable(
                replacetext(
                  dynamicItem.Dynamic_Data.modules.module_dynamic.desc?.text || '',
                  dynamicItem.Dynamic_Data.modules.module_dynamic.desc?.rich_text_nodes || []
                ),
                emojiDATA
              )
              img = await Render('bilibili/dynamic/DYNAMIC_TYPE_WORD',
                {
                  text,
                  dianzan: Common.count(dynamicItem.Dynamic_Data.modules.module_stat.like.count),
                  pinglun: Common.count(dynamicItem.Dynamic_Data.modules.module_stat.comment.count),
                  share: Common.count(dynamicItem.Dynamic_Data.modules.module_stat.forward.count),
                  create_time: Common.convertTimestampToDateTime(dynamicItem.Dynamic_Data.modules.module_author.pub_ts),
                  avatar_url: dynamicItem.Dynamic_Data.modules.module_author.face,
                  frame: dynamicItem.Dynamic_Data.modules.module_author.pendant.image,
                  share_url: 'https://t.bilibili.com/' + dynamicItem.Dynamic_Data.id_str,
                  dynamic_id: String(dynamicItem.Dynamic_Data.id_str),
                  usernameMeta: getUsernameMetadata(userINFO.data.data.card),
                  fans: Common.count(userINFO.data.data.follower),
                  user_shortid: dynamicItem.host_mid,
                  total_favorited: Common.count(userINFO.data.data.like_num),
                  following_count: Common.count(userINFO.data.data.card.attention),
                  decoration_card: generateDecorationCard(dynamicItem.Dynamic_Data.modules.module_author?.decoration_card),
                  render_time: Common.getCurrentTime(),
                  dynamicTYPE: '纯文动态推送'
                }
              )
              break
            }
            /** 处理视频动态 */
            case DynamicType.AV: {
              if (dynamicItem.Dynamic_Data.modules.module_dynamic.major?.type === 'MAJOR_TYPE_ARCHIVE') {
                const bvid = dynamicItem.Dynamic_Data?.modules.module_dynamic.major?.archive?.bvid || ''
                const INFODATA = asAmagiResponse<{ data: BilibiliVideoInfo }>(await bilibiliFetcher.fetchVideoInfo({ bvid, typeMode: 'strict' }, '', buildAmagiRequestConfig()))
                dycrad = INFODATA.data.data

                if (INFODATA.data.data.redirect_url) {
                  send_video = false
                  logger.debug(`UP主：${INFODATA.data.data.owner.name} 的该动态类型为${logger.yellow('番剧或影视')}，默认跳过不下载，直达：${logger.green(INFODATA.data.data.redirect_url)}`)
                } else {
                  // const noCkData = await bilibiliFetcher.fetchVideoStreamUrl({ avid: Number(aid), cid: INFODATA.data.data.cid, typeMode: 'strict' }, '', buildAmagiRequestConfig())
                }
                img = await Render('bilibili/dynamic/DYNAMIC_TYPE_AV',
                  {
                    // 契约是单张封面字符串，不是数组
                    image_url: INFODATA.data.data.pic,
                    text: replacetext(INFODATA.data.data.title, []),
                    desc: formatBilibiliVideoDescRichText(INFODATA.data.data.desc_v2, dycrad.desc || ''),
                    dynamic_text: replacetext(
                      dynamicItem.Dynamic_Data.modules.module_dynamic.desc?.text || '',
                      dynamicItem.Dynamic_Data.modules.module_dynamic.desc?.rich_text_nodes || []
                    ),
                    dianzan: Common.count(INFODATA.data.data.stat.like),
                    pinglun: Common.count(INFODATA.data.data.stat.reply),
                    share: Common.count(INFODATA.data.data.stat.share),
                    view: Common.count(dycrad.stat.view),
                    coin: Common.count(dycrad.stat.coin),
                    duration_text: dynamicItem.Dynamic_Data.modules.module_dynamic.major?.archive?.duration_text || '0:00',
                    page_length: INFODATA.data.data.pages?.length || 1,
                    create_time: Common.convertTimestampToDateTime(INFODATA.data.data.ctime),
                    avatar_url: INFODATA.data.data.owner.face,
                    frame: dynamicItem.Dynamic_Data.modules.module_author.pendant.image,
                    share_url: 'https://www.bilibili.com/video/' + bvid,
                    dynamic_id: String(dynamicItem.Dynamic_Data.id_str),
                    usernameMeta: getUsernameMetadata(userINFO.data.data.card),
                    fans: Common.count(userINFO.data.data.follower),
                    user_shortid: dynamicItem.host_mid,
                    total_favorited: Common.count(userINFO.data.data.like_num),
                    following_count: Common.count(userINFO.data.data.card.attention),
                    decoration_card: generateDecorationCard(dynamicItem.Dynamic_Data.modules.module_author?.decoration_card),
                    render_time: Common.getCurrentTime(),
                    dynamicTYPE: '视频动态推送'
                  }
                )
              }
              break
            }
            /** 处理直播动态 */
            case DynamicType.LIVE_RCMD: {
              const liveContent = dynamicItem.Dynamic_Data.modules.module_dynamic.major?.live_rcmd?.content
              if (!liveContent) {
                skip = true
                break
              }
              const liveCard = JSON.parse(liveContent) as BilibiliLiveCard
              img = await Render('bilibili/dynamic/DYNAMIC_TYPE_LIVE_RCMD',
                {
                  // 契约是单张封面字符串，不是数组
                  image_url: liveCard.live_play_info.cover,
                  text: replacetext(liveCard.live_play_info.title, []),
                  liveinf: `${liveCard.live_play_info.area_name} | 房间号: ${liveCard.live_play_info.room_id}`,
                  usernameMeta: getUsernameMetadata(userINFO.data.data.card),
                  avatar_url: userINFO.data.data.card.face,
                  frame: dynamicItem.Dynamic_Data.modules.module_author.pendant.image,
                  fans: Common.count(userINFO.data.data.follower),
                  create_time: Common.convertTimestampToDateTime(dynamicItem.Dynamic_Data.modules.module_author.pub_ts),
                  now_time: Common.getCurrentTime(),
                  share_url: 'https://live.bilibili.com/' + liveCard.live_play_info.room_id,
                  dynamicTYPE: '直播动态推送'
                }
              )
              break
            }
            /** 处理转发动态 */
            case DynamicType.FORWARD: {
              const text = replacetext(dynamicItem.Dynamic_Data.modules.module_dynamic.desc?.text || '', dynamicItem.Dynamic_Data.modules.module_dynamic.desc?.rich_text_nodes || [])
              const originalMajor = dynamicItem.Dynamic_Data.orig.modules.module_dynamic.major
              const originalAuthor = dynamicItem.Dynamic_Data.orig.modules.module_author
              // 同 bilibili.ts：用 IIFE 而不是 `let param = {}` + 逐分支赋值。
              // 那种写法 param 的类型是 `{}`，塞进 original_content 时编译期什么都拦不住，
              // 漏字段全留到运行时；这里每个分支直接 return 对应的键，TS 按联合类型逐个校验。
              const originalContent = (() => {
                const authorBase = {
                  usernameMeta: getUsernameMetadata(originalAuthor),
                  avatar_url: originalAuthor.face,
                  frame: originalAuthor.pendant?.image,
                  create_time: Common.convertTimestampToDateTime(originalAuthor.pub_ts),
                  decoration_card: generateDecorationCard(originalAuthor.decoration_card)
                }
                switch (dynamicItem.Dynamic_Data.orig.type) {
                  case DynamicType.AV: {
                    const origDesc = dynamicItem.Dynamic_Data.orig.modules.module_dynamic.desc
                    return {
                      DYNAMIC_TYPE_AV: {
                        ...authorBase,
                        cover: originalMajor?.archive?.cover ?? '',
                        duration_text: originalMajor?.archive?.duration_text ?? '',
                        // 契约要 string，模板直接拼在「{play}观看 {danmaku}弹幕」里
                        play: Common.count(originalMajor?.archive?.stat?.play ?? 0),
                        danmaku: Common.count(originalMajor?.archive?.stat?.danmaku ?? 0),
                        // 模板对 title 走 renderRichTextToReact，必须是富文本
                        title: replacetext(originalMajor?.archive?.title ?? '', []),
                        // 模板读的是 `content.text.nodes.length`，没有短路。
                        // 之前这个分支根本不传 text，转发视频动态必抛 reading 'nodes'。
                        text: replacetext(origDesc?.text || '', origDesc?.rich_text_nodes || [])
                      }
                    }
                  }
                  case DynamicType.DRAW: {
                    const summary = originalMajor?.opus?.summary
                    return {
                      DYNAMIC_TYPE_DRAW: {
                        ...authorBase,
                        text: replacetext(summary?.text || '', summary?.rich_text_nodes || []),
                        image_url: cover(originalMajor?.opus?.pics || originalMajor?.draw?.items || [])
                      }
                    }
                  }
                  case DynamicType.WORD: {
                    const summary = originalMajor?.opus?.summary
                    return {
                      DYNAMIC_TYPE_WORD: {
                        ...authorBase,
                        text: replacetext(summary?.text || '', summary?.rich_text_nodes || [])
                      }
                    }
                  }
                  case DynamicType.LIVE_RCMD: {
                    const liveContent = originalMajor?.live_rcmd?.content
                    if (!liveContent) {
                      logger.warn(`UP主：${dynamicItem.remark}的转发直播动态缺少直播卡片数据`)
                      return {}
                    }
                    const liveData = JSON.parse(liveContent) as BilibiliLiveCard
                    return {
                      DYNAMIC_TYPE_LIVE_RCMD: {
                        ...authorBase,
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
                    logger.warn(`UP主：${dynamicItem.remark}的${logger.green('转发动态')}转发的原动态类型为「${logger.yellow(dynamicItem.Dynamic_Data.orig.type)}」暂未支持解析`)
                    return {}
                  }
                }
              })()
              img = await Render('bilibili/dynamic/DYNAMIC_TYPE_FORWARD', {
                text,
                // 转发动态本身不带图，模板用 `props.imgList &&` 短路；契约要求这个键存在
                imgList: null,
                dianzan: Common.count(dynamicItem.Dynamic_Data.modules.module_stat.like.count),
                pinglun: Common.count(dynamicItem.Dynamic_Data.modules.module_stat.comment.count),
                share: Common.count(dynamicItem.Dynamic_Data.modules.module_stat.forward.count),
                // 跟同文件其他推送路由保持一致：pub_time 是可选的，pub_ts 才是必填时间戳
                create_time: Common.convertTimestampToDateTime(dynamicItem.Dynamic_Data.modules.module_author.pub_ts),
                avatar_url: dynamicItem.Dynamic_Data.modules.module_author.face,
                frame: dynamicItem.Dynamic_Data.modules.module_author.pendant.image,
                share_url: 'https://t.bilibili.com/' + dynamicItem.Dynamic_Data.id_str,
                dynamic_id: String(dynamicItem.Dynamic_Data.id_str),
                usernameMeta: getUsernameMetadata(userINFO.data.data.card),
                fans: Common.count(userINFO.data.data.follower),
                user_shortid: dynamicItem.Dynamic_Data.modules.module_author.mid,
                total_favorited: Common.count(userINFO.data.data.like_num),
                following_count: Common.count(userINFO.data.data.card.attention),
                dynamicTYPE: '转发动态推送',
                decoration_card: generateDecorationCard(dynamicItem.Dynamic_Data.modules.module_author.decorate),
                render_time: Common.getCurrentTime(),
                original_content: originalContent
              })
              break
            }
            case DynamicType.ARTICLE: {
              const articleIdValue = dynamicItem.Dynamic_Data.basic?.rid_str ||
                dynamicItem.Dynamic_Data.basic?.rid?.toString?.() ||
                dynamicItem.Dynamic_Data.modules?.module_dynamic?.major?.article?.id?.toString?.()
              const articleId = articleIdValue ? String(articleIdValue) : ''

              if (!articleId) {
                skip = true
                logger.warn(`UP主：${dynamicItem.remark} 的专栏动态缺少专栏 ID，跳过推送`)
                break
              }

              const [articleInfoBaseRaw, articleInfoRaw] = await Promise.all([
                this.amagi.bilibili.fetchArticleInfo({ id: articleId, typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig()),
                this.amagi.bilibili.fetchArticleContent({ id: articleId, typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig())
              ])
              const articleInfoBase = asAmagiResponse<{ data: BilibiliArticleInfo }>(articleInfoBaseRaw)
              const articleInfo = asAmagiResponse<{ data: BilibiliArticleContent }>(articleInfoRaw)
              const articleData = articleInfoBase.data.data
              const articleContent = articleInfo.data.data
              const title = articleData.title || dynamicItem.Dynamic_Data.modules.module_dynamic?.major?.article?.title || 'B站专栏'
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
              articleForwardPayload = { body, forwardNodes, title, summary, shareUrl }

              const stats = articleData.stats || {}
              const categories = buildBilibiliArticleCategories(articleData.categories)

              img = await Render('bilibili/dynamic/DYNAMIC_TYPE_ARTICLE', {
                usernameMeta: getUsernameMetadata(userINFO.data.data.card),
                avatar_url: userINFO.data.data.card.face,
                frame: dynamicItem.Dynamic_Data.modules.module_author.pendant.image,
                create_time: dynamicItem.Dynamic_Data.modules.module_author.pub_time ||
                  Common.convertTimestampToDateTime(dynamicItem.Dynamic_Data.modules.module_author.pub_ts),
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
                dynamicTYPE: '专栏动态推送',
                user_shortid: userINFO.data.data.card.mid,
                total_favorited: Common.count(userINFO.data.data.like_num),
                following_count: Common.count(userINFO.data.data.card.attention),
                fans: Common.count(userINFO.data.data.follower)
              })
              break
            }
            /** 未处理的动态类型 */
            default: {
              skip = true
              logger.warn(`UP主：${dynamicItem.remark}「${dynamicItem.dynamic_type}」动态类型的暂未支持推送\n动态地址：${'https://t.bilibili.com/' + dynamicItem.Dynamic_Data.id_str}`)
              break
            }
          }
        }

        // Render 返回 false 表示这一轮渲染失败（截图超时、模板报错等）。
        // 原来会一路落到下面 `status = img ? … : { message_id: '1' }` 的兜底分支，
        // 拿到一个假 message_id 之后照样写已推缓存，于是这条动态再也不会重试 ——
        // 线上表现是「浏览器抖一下就永久漏推一条」。douyin/push.ts 早就这么拦了，这里漏了。
        if (!skip && img === false) {
          logger.warn(`[Bilibili 推送] 动态 ${dynamicId} 渲染失败，保留未推送状态等待下一轮重试`)
          continue
        }

        // 遍历 targets 数组，并发送消息
        for (const target of dynamicItem.targets) {
          // 这条卡片是否已经「不必再重发」：被过滤跳过、发送成功、或 bot/群不存在的兜底。
          // 二次解析（视频/图集/专栏）失败不改变它 —— 卡片已经出去了，重发只会让群里看到两遍。
          let cardDelivered = skip
          try {
            let status
            if (!skip) {
              const { groupId, botId } = target
              const group = Bot?.[botId]?.pickGroup(groupId)
              // 发送消息,如果bot不存在或群组不存在,则默认message_id为1,防止bot上线发一堆消息
              if (group) {
                if (dynamicItem.dynamic_type === DynamicType.ARTICLE && articleForwardPayload) {
                  const forwardMessage = await createBilibiliRichTextForwardMessage(
                    articleForwardPayload.forwardNodes,
                    {
                      segmentFactory: {
                        text: value => segment.text?.(value) ?? value,
                        image: url => segment.image(url)
                      },
                      makeForwardMsg: async (messages, title) => {
                        if (Version.BotName === 'Miao-Yunzai') {
                          return await Bot.makeForwardMsg(messages.map(message => ({
                            user_id: 2854196310,
                            message
                          })) as ForwardNodes)
                        }
                        return await common.makeForwardMsg(Bot?.[botId], messages, title)
                      },
                      title: '专栏内容'
                    }
                  )
                  if (forwardMessage) await group.sendMsg(forwardMessage as GroupSendable)
                }
                status = img ? await group.sendMsg(img as GroupSendable) : { message_id: '1' }
              } else {
                logger.warn(`bot${botId}不存在或群${groupId}不存在`)
                status = { message_id: '1' }
              }
              cardDelivered = Boolean(status?.message_id)
              // parsedynamic 只是「要不要顺带解析」的总开关，parseDynamicTypes 才是「解析哪些类型」。
              // 后者 config/default_config 和锅巴面板都暴露了，但这里原来只读总开关，
              // 于是用户取消勾选的类型照样会被二次解析、在卡片之后多发一条视频/图集消息。
              if (Config.bilibili?.push?.parsedynamic && isParseDynamicTypeAllowed(dynamicItem.dynamic_type)) {
                switch (dynamicItem.dynamic_type) {
                  case 'DYNAMIC_TYPE_AV': {
                    if (send_video) {
                      if (!dycrad) break
                      let videoSize = ''
                      const playUrlData = await this.amagi.bilibili.fetchVideoStreamUrl({
                        avid: dycrad.aid,
                        cid: dycrad.cid,
                        typeMode: 'strict'
                      }, Config.cookies.bilibili, buildAmagiRequestConfig())
                      const playUrlPayload = getBilibiliPayload(playUrlData)
                      const playUrlDash = getBilibiliDash(playUrlData)
                      /** 提取出视频流信息对象，并排除清晰度重复的视频流 */
                      const simplify = (playUrlDash.video || []).filter((/** @type {{id: number}} */item, /** @type {number} */index, /** @type {{id: number}[]} */self) => {
                        return self.findIndex((/** @type {{id: number}} */ t) => {
                          return t.id === item.id
                        }) === index
                      })
                      /** 替换原始的视频信息对象 */
                      playUrlDash.video = simplify
                      const correctList = await bilibiliProcessVideos({
                        accept_description: playUrlPayload.accept_description ?? [],
                        bvid: dycrad.bvid,
                        qn: Config.bilibili.push.pushVideoQuality,
                        maxAutoVideoSize: Config.bilibili.push.pushMaxAutoVideoSize
                      }, simplify, playUrlDash.audio?.[0]?.base_url || '')
                      playUrlDash.video = correctList.videoList
                      playUrlPayload.accept_description = correctList.accept_description
                      /** 获取第一个视频流的大小 */
                      videoSize = await getvideosize(
                        correctList.videoList?.[0]?.base_url || '',
                        playUrlDash.audio?.[0]?.base_url || '',
                        dycrad.bvid || ''
                      )
                      if ((Config.upload.usefilelimit && Number(videoSize) > Number(Config.upload.filelimit)) && !Config.upload.compress) {
                        Bot?.[botId]?.pickGroup(groupId) && await Bot?.[botId]?.pickGroup(groupId)?.sendMsg(
                          [
                            `设定的最大上传大小为 ${Config.upload.filelimit}MB\n当前解析到的视频大小为 ${Number(videoSize)}MB\n视频太大了，还是去B站看吧~`,
                            segment.reply(
                              status && typeof status === 'object' && 'message_id' in status
                                ? String(status.message_id)
                                : '1'
                            )
                          ]
                        )
                        break
                      }
                      logger.mark(`当前处于自动推送状态，解析到的视频大小为 ${logger.yellow(Number(videoSize))} MB`)
                      const infoData = asAmagiResponse<{ data: BilibiliVideoInfo }>(await this.amagi.bilibili.fetchVideoInfo({ bvid: dycrad.bvid, typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig()))
                      const mp4File = await downloadFile(
                        playUrlDash.video?.[0]?.base_url || '',
                        {
                          title: `Bil_V_${infoData.data.data.bvid}.mp4`,
                          headers: bilibiliBaseHeaders
                        }
                      )
                      const mp3File = await downloadFile(
                        playUrlDash.audio?.[0]?.base_url || '',
                        {
                          title: `Bil_A_${infoData.data.data.bvid}.mp3`,
                          headers: bilibiliBaseHeaders
                        }
                      )

                      if (mp4File.filepath && mp3File.filepath) {
                        await mergeFile('二合一（视频 + 音频）', {
                          path: mp4File.filepath,
                          path2: mp3File.filepath,
                          resultPath: Common.tempDri.video + `Bil_Result_${infoData.data.data.bvid}.mp4`,
                          callback: async (/** @type {boolean} */ success, /** @type {string} */ resultPath) => {
                            if (success) {
                              const filePath = Common.tempDri.video + `tmp_${Date.now()}.mp4`
                              fs.renameSync(resultPath, filePath)
                              logger.mark(`视频文件重命名完成: ${resultPath.split('/').pop()} -> ${filePath.split('/').pop()}`)
                              logger.mark('正在尝试删除缓存文件')
                              await Common.removeFile(mp4File.filepath, true)
                              await Common.removeFile(mp3File.filepath, true)

                              const stats = fs.statSync(filePath)
                              const fileSizeInMB = Number((stats.size / (1024 * 1024)).toFixed(2))
                              if (fileSizeInMB > (Config.upload?.groupfilevalue || 100)) {
                                // 使用文件上传
                                return await uploadFile(
                                  this.e ?? {},
                                  { filepath: filePath, totalBytes: fileSizeInMB, originTitle: sanitizeFilenameSegment(infoData.data.data.desc, 50, 'B站视频') },
                                  '',
                                  { useGroupFile: true, active: true, activeOption: { group_id: groupId, uin: botId } }
                                )
                              } else {
                                /** 因为本地合成，没有视频直链 */
                                return await uploadFile(
                                  this.e ?? {},
                                  { filepath: filePath, totalBytes: fileSizeInMB },
                                  '',
                                  { active: true, activeOption: { group_id: groupId, uin: botId } }
                                )
                              }
                            } else {
                              await Common.removeFile(mp4File.filepath, true)
                              await Common.removeFile(mp3File.filepath, true)
                              return true
                            }
                          }
                        })
                      }
                    }
                    break
                  }
                  case 'DYNAMIC_TYPE_DRAW': {
                    /** @type {import ('@kaguyajs/trss-yunzai-types').icqq.segment[]} */
                    const imgArray = []
                    const tempFiles = []
                    let hasGeneratedLivePhoto = false
                    const images = (
                      dynamicItem.Dynamic_Data.modules.module_dynamic?.major &&
                      dynamicItem.Dynamic_Data.modules.module_dynamic?.major?.draw?.items
                    ) || dynamicItem.Dynamic_Data.modules.module_dynamic?.major?.opus?.pics || []

                    try {
                      // 非实况图的位置传空条目，让结果和 images 逐位对齐 ——
                      // imgArray 的顺序就是转发消息里图片的顺序。
                      const livePhotoItems: LivePhotoBatchItem[] = images.map(img2 => {
                        const imageSrc = img2.src ?? img2.url
                        return imageSrc && img2.live_url
                          ? { staticUrl: imageSrc, liveVideoUrl: img2.live_url }
                          : {}
                      })
                      const livePhotoBatch = await buildCommonLivePhotoMessagesBatch(livePhotoItems, {
                        platform: 'bilibili',
                        headers: {
                          ...bilibiliBaseHeaders,
                          Referer: 'https://www.bilibili.com/'
                        }
                      })
                      tempFiles.push(...livePhotoBatch.tempFiles)
                      hasGeneratedLivePhoto = livePhotoBatch.generatedLivePhoto

                      for (const [imageIndex, img2] of images.entries()) {
                        const imageSrc = img2.src ?? img2.url
                        if (!imageSrc) continue

                        const livePhoto = livePhotoBatch.results[imageIndex]
                        if (livePhoto !== undefined && livePhoto.messages.length > 0) {
                          imgArray.push(...livePhoto.messages)
                          continue
                        }

                        const imageUrl = await processImageUrl(imageSrc, dynamicItem.remark || 'B站动态图片', imageIndex, bilibiliBaseHeaders)
                        imgArray.push(segment.image(imageUrl))
                      }

                      if (hasGeneratedLivePhoto) imgArray.push(await buildLivePhotoTipMessage())

                      // 发送必须留在 try 内、清理之前。实况图的消息段在非 base64 模式下只带
                      // `file://` 路径（见 common/livePhoto.ts：videoSendMode/imageSendMode
                      // 不为 'base64' 时拼的是 `file://${path}`），文件删了路径就失效。
                      // 原先 finally 收在发送之前，等于「先删文件再拿废路径去发」。
                      // 只有 videoSendMode/imageSendMode === 'base64' 时字节已经内联进消息段，
                      // 才不受影响 —— 而 default_config/upload.yaml 默认是 file / url，
                      // 所以默认配置下这个顺序就是坏的。
                      // 一张都没解析出来时只放弃这次二次解析。
                      // 原来这里是 `return false`：直接从 getdata 返回，把同一轮里后面所有
                      // UP 的动态一起丢掉（它们没写缓存，线上表现是「这一轮只推了前几条」），
                      // 而当前这条的动态卡片其实已经发出去了。
                      if (imgArray.length) {
                        const forwardMsg = Version.BotName === 'Miao-Yunzai'
                          ? Bot?.makeForwardMsg(imgArray.map(img => ({
                            user_id: 2854196310,
                            message: img
                          })) as ForwardNodes)
                          : common?.makeForwardMsg(Bot?.[botId], imgArray, '动态图片')
                        // 如果bot不存在或群组不存在,则默认message_id为1,防止bot上线发一堆消息
                        if (Bot?.[botId]?.pickGroup(groupId) && forwardMsg) {
                          await Bot[botId].pickGroup(groupId).sendMsg(forwardMsg as GroupSendable)
                        } else {
                          logger.warn(`bot${botId}不存在或群${groupId}不存在`)
                        }
                      } else {
                        logger.warn(`[Bilibili 推送] 动态 ${dynamicId} 没有可发送的图片内容，跳过二次解析`)
                      }
                    } finally {
                      for (const item of tempFiles) {
                        if (item?.filepath) await Common.removeFile(item.filepath, true)
                      }
                    }
                    break
                  }
                }
              }
            }
          } catch (e) {
            logger.error(e)
          } finally {
            // 只有确实送达（或被过滤跳过）才写已推标记。
            // 原来这里是无条件写的，理由是「防止重复推送」—— 但 bot 上线补推那个场景已经由
            // 上面 bot/群不存在时的 message_id: '1' 兜底覆盖了。发送本身抛错（风控、网络抖动、
            // 消息过长）时无条件写缓存，等于把这条动态永久吞掉，群里永远收不到。
            if (cardDelivered) {
              await bilibiliDB?.addDynamicCache(
                dynamicId,
                dynamicItem.host_mid,
                target.groupId,
                dynamicItem.dynamic_type
              )
            }
          }
        }
      }
    } catch (e) {
      logger.error('推送动态列表失败', e)
      return false
    } finally {
      // 这个循环逐条覆盖 pushContext，出了循环就不该再有值 ——
      // 留着会让后续任何走同一实例的接口错误挂上最后那条动态的群号
      this.pushContext = undefined
    }
    return true
  }

  /**
   * 根据配置文件获取UP当天的动态列表。
   * @param {bilibiliPushItem[]} userList - 用户列表
   * @returns {Promise<{willbepushlist: WillBePushList}>}
   */
  async getDirectLivePushItems (
    userList: BilibiliPushConfigItem[]
  ): Promise<{ handledUids: Set<number>, willBePushList: WillBePushList }> {
    const handledUids = new Set<number>()
    const willBePushList: WillBePushList = {}
    const liveSubscriptions = userList.filter(item => (
      item.switch !== false && normalizeBilibiliPushTypes(item.pushTypes).includes('live')
    ))

    for (const item of liveSubscriptions) {
      // 这个方法在 getDynamicList 的第一行就被调用，早于那边的 pushContext 赋值，
      // 所以直播直查这条路径原来出错也拿不到群号和适配器 —— 和主动推送那个症状是同一个。
      // 包一层 try/finally 而不是在两个 catch 里各清一次：底下两个 try 都有 continue，
      // 漏一个就会把这条订阅的群号带给下一条。
      this.pushContext = { groupWithBot: item.group_id }
      try {
        await this.collectDirectLivePushItem(item, handledUids, willBePushList)
      } finally {
        this.pushContext = undefined
      }
    }

    return { handledUids, willBePushList }
  }

  /**
   * 直查单个 UP 的直播状态并落入待推送列表。
   *
   * 从 {@link getDirectLivePushItems} 的循环体里拆出来，只为了让 `pushContext`
   * 能用一个 try/finally 覆盖整段 —— 里面两个 try 各自带 continue，
   * 原来那种写法没法用单个 finally 收口。
   */
  private async collectDirectLivePushItem (
    item: BilibiliPushConfigItem,
    handledUids: Set<number>,
    willBePushList: WillBePushList
  ): Promise<void> {
    let liveStatus: BilibiliUserLiveStatus['data']
    try {
      const response = asAmagiResponse<BilibiliUserLiveStatus>(await this.amagi.bilibili.fetchUserLiveStatus({
        host_mid: item.host_mid,
        typeMode: 'strict'
      }, Config.cookies.bilibili, buildAmagiRequestConfig()))
      liveStatus = response.data.data
    } catch (error) {
      const message = getErrorMessage(error)
      logger.warn(`[Bilibili 推送] UP主 ${item.remark || item.host_mid}（${item.host_mid}）直播状态直查失败，本轮回退到直播动态检测：${message}`)
      return
    }

    if (liveStatus.roomStatus !== 1 || liveStatus.liveStatus !== 1 || liveStatus.roomid <= 0) {
      handledUids.add(item.host_mid)
      return
    }

    try {
      const response = asAmagiResponse<BilibiliLiveRoomInfo>(await this.amagi.bilibili.fetchLiveRoomInfo({
        room_id: String(liveStatus.roomid),
        typeMode: 'strict'
      }, Config.cookies.bilibili, buildAmagiRequestConfig()))
      const liveInfo = response.data.data

      /** 两个直播接口状态不一致时，以直播间详情为准。 */
      if (liveInfo.live_status !== 1) {
        handledUids.add(item.host_mid)
        return
      }

      const sessionId = buildBilibiliLiveSessionId(item.host_mid, liveInfo.room_id, liveInfo.live_time)
      const liveStartedAt = parseBilibiliLiveStartedAt(liveInfo.live_time)
      if (!sessionId || !liveStartedAt) {
        throw new Error(`直播间 ${liveInfo.room_id} 未返回可用于场次去重的开播时间`)
      }

      const dynamic = createLiveDynamicItem(sessionId, liveStartedAt, liveInfo, liveStatus)
      willBePushList[sessionId] = {
        remark: item.remark || String(item.host_mid),
        host_mid: item.host_mid,
        create_time: dynamic.modules.module_author.pub_ts,
        targets: item.group_id.map(groupWithBot => {
          const [groupId, botId] = groupWithBot.split(':')
          return { groupId: groupId || '', botId: botId || '' }
        }),
        Dynamic_Data: dynamic,
        avatar_img: '',
        dynamic_type: DynamicType.LIVE_RCMD
      }
      handledUids.add(item.host_mid)
    } catch (error) {
      const message = getErrorMessage(error)
      logger.warn(`[Bilibili 推送] UP主 ${item.remark || item.host_mid}（${item.host_mid}）直播场次信息不完整，本轮回退到直播动态检测：${message}`)
    }
  }

  /** 为动态列表降级路径生成与直播状态直查一致的场次缓存键。 */
  async resolveLiveDynamicCacheId (dynamic: BilibiliDynamicItem, hostMid: number): Promise<string> {
    try {
      const content = dynamic.modules.module_dynamic.major?.live_rcmd?.content
      if (!content) return dynamic.id_str
      const liveData = JSON.parse(content) as BilibiliLiveCard
      const roomId = Number(liveData.live_play_info.room_id)
      if (!Number.isFinite(roomId) || roomId <= 0) return dynamic.id_str

      const response = asAmagiResponse<BilibiliLiveRoomInfo>(await this.amagi.bilibili.fetchLiveRoomInfo({
        room_id: String(roomId),
        typeMode: 'strict'
      }, Config.cookies.bilibili, buildAmagiRequestConfig()))
      const liveInfo = response.data.data
      return buildBilibiliLiveSessionId(hostMid, liveInfo.room_id, liveInfo.live_time) || dynamic.id_str
    } catch (error) {
      const message = getErrorMessage(error)
      logger.warn(`[Bilibili 推送] 直播动态 ${dynamic.id_str} 无法解析统一场次键，将使用动态ID去重：${message}`)
      return dynamic.id_str
    }
  }

  async getDynamicList (userList: BilibiliPushConfigItem[]): Promise<{ willbepushlist: WillBePushList }> {
    const directLiveItems = await this.getDirectLivePushItems(userList)
    /** @type {WillBePushList} */
    const willbepushlist: WillBePushList = { ...directLiveItems.willBePushList }

    try {
      /** 过滤掉不启用的订阅项 */
      const filteredUserList = userList.filter(item => item.switch !== false)
      for (const item of filteredUserList) {
        try {
          const pushTypes = normalizeBilibiliPushTypes(item.pushTypes)
          const allowedDynamicTypes = new Set(pushTypes.map(type => BILIBILI_PUSH_TYPE_TO_DYNAMIC_TYPE[type]))
          if (directLiveItems.handledUids.has(item.host_mid)) {
            allowedDynamicTypes.delete(DynamicType.LIVE_RCMD)
          }
          if (allowedDynamicTypes.size === 0) continue
          logger.debug(`[Bilibili 推送] 开始获取UP: ${item.remark}（${item.host_mid}） 的动态列表，推送类型：${pushTypes.join(', ')}`)
          // 同 douyin/push.ts：错误卡片从 amagi 的 Proxy 里出，那里够不到 item，
          // 先把订阅的 `群号:机器人账号` 记到实例上。
          this.pushContext = { groupWithBot: item.group_id }
          const dynamic_list = asAmagiResponse<BiliUserDynamic>(await this.amagi.bilibili.fetchUserDynamicList({ host_mid: item.host_mid, typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig()))
          if (dynamic_list.data.data.items.length > 0) {
            // 遍历接口返回的视频列表
            for (const dynamic of dynamic_list.data.data.items) {
              const now = Date.now()
              // 获取动态发布时间戳(毫秒)
              const createTime = dynamic.modules.module_author.pub_ts * 1000
              const timeDifference = (now - createTime)

              const is_top = dynamic.modules.module_tag?.text === '置顶' // 是否为置顶
              let shouldPush = false // 是否列入推送数组

              const timeDiffSeconds = Math.round(timeDifference / 1000)
              const timeDiffHours = Math.round((timeDifference / 1000 / 60 / 60) * 100) / 100 // 保留2位小数

              // 条件判断，以下任何一项成立都将进行推送：如果是置顶且发布时间在一天内 || 如果是置顶作品且有新的群组且发布时间在一天内 || 如果有新的群组且发布时间在一天内
              logger.debug(`
                前期获取该动态基本信息：
                UP主：${dynamic.modules.module_author.name}
                动态ID：${dynamic.id_str}
                发布时间：${Common.convertTimestampToDateTime(createTime / 1000)}
                发布时间戳（ms）：${createTime}
                当前时间戳（ms）：${now}
                时间差（ms）：${timeDifference} ms (${timeDiffSeconds}s) (${timeDiffHours}h)
                是否置顶：${is_top}
                是否在一天内：${timeDifference < 86400000 ? logger.green('true') : logger.red('false')}
                `)

              if ((is_top && timeDifference < 86400000) || (timeDifference < 86400000)) {
                shouldPush = true
                logger.debug(logger.green(`根据以上判断，shoulPush 为 true，将对该动态纳入当天推送列表：https://t.bilibili.com/${dynamic.id_str}\n`))
              } else {
                logger.debug(logger.yellow(`根据以上判断，shoulPush 为 false，跳过该动态：https://t.bilibili.com/${dynamic.id_str}\n`))
              }

              // 如果 shouldPush 为 true，或该作品距现在的时间差小于一天，则将该动态添加到 willbepushlist 中
              if (timeDifference < 86400000 || shouldPush) {
                if (!allowedDynamicTypes.has(dynamic.type)) {
                  logger.debug(`UP主 ${item.remark || item.host_mid} 的动态 ${dynamic.id_str} 类型为「${dynamic.type}」，不在推送类型配置中，跳过`)
                  continue
                }

                // 将群组ID和机器人ID分离
                const targets = item.group_id.map(groupWithBot => {
                  const [groupId, botId] = groupWithBot.split(':')
                  return { groupId: groupId || '', botId: botId || '' }
                })

                const pushId = dynamic.type === DynamicType.LIVE_RCMD
                  ? await this.resolveLiveDynamicCacheId(dynamic, item.host_mid)
                  : dynamic.id_str

                // 确保 willbepushlist[pushId] 是一个对象
                if (!willbepushlist[pushId]) {
                  willbepushlist[pushId] = {
                    remark: item?.remark || dynamic.modules.module_author.name,
                    host_mid: item.host_mid,
                    create_time: dynamic.modules.module_author.pub_ts,
                    targets,
                    Dynamic_Data: dynamic, // 存储 dynamic 对象
                    avatar_img: dynamic.modules.module_author.face,
                    dynamic_type: dynamic.type
                  }
                }
              }
            }
          } else {
            logger.error(`「${item.remark}」的动态列表数量为零！`)
          }
        } catch (error) {
          // 单个 UP 失败不再中断整轮推送。
          // Base.ts 的 amagi 代理在接口返回非零 code 时会 throw，原来这个 try 在循环
          // 外面，于是第一个接口失败的 UP 就把 for 整个终止掉，后面所有订阅当轮都不推 ——
          // 线上表现就是每轮固定报一次「B站数据获取失败」然后什么都没推。
          // 与上游一致：按 UP 隔离，记一条 warn 然后跳过这一个。
          logger.warn(
            `[Bilibili 推送] UP主 ${item.remark}（${item.host_mid}）本轮跳过：${getErrorMessage(error)}`
          )
          continue
        } finally {
          // 循环里有多个 continue，不清的话下一个 UP 出错时卡片会挂上上一个 UP 的群号
          this.pushContext = undefined
        }
      }
    } catch (error) {
      logger.error(error)
    }
    return { willbepushlist }
  }

  /**
   * 排除已推送过的群组并返回更新后的推送列表
   * @param {WillBePushList} willBePushList - 将要推送的列表
   * @returns {Promise<WillBePushList>} 更新后的推送列表
   */
  async excludeAlreadyPushed (willBePushList: WillBePushList): Promise<WillBePushList> {
    // 遍历推送列表中的作品ID
    for (const dynamicId in willBePushList) {
      const pushItem = willBePushList[dynamicId]
      if (!pushItem) continue
      const newTargets: BilibiliPushTarget[] = []

      // 遍历作品对应的目标群组
      for (const target of pushItem.targets) {
        // 检查该动态是否已经推送给该群组
        const isPushed = await bilibiliDB?.isDynamicPushed(dynamicId, pushItem.host_mid, target.groupId)

        // 如果未被推送过，则保留此目标
        if (!isPushed) {
          newTargets.push(target)
        }
      }

      // 更新作品的目标数组
      if (newTargets.length > 0) {
        pushItem.targets = newTargets
      } else {
        // 如果没有剩余目标，移除该作品
        delete willBePushList[dynamicId]
      }
    }

    return willBePushList
  }

  /**
   * 设置或更新特定 host_mid 的群组信息。
   * @param {BiliUserProfile} data - 包含 card 对象
   * @returns {Promise<void>}
   */
  async setting (data: BiliUserProfile): Promise<void> {
    const event = this.e
    if (!event) return
    const host_mid = Number(data.data.card.mid)
    const groupId = String(event.group_id ?? '')
    const botId = String(event.self_id ?? '')

    // 检查该群组是否已订阅该UP主
    const isSubscribed = await bilibiliDB?.isSubscribed(host_mid, groupId)

    // 这条命令是开关式的：群里已经订阅了就取消，没订阅就添加。判断用快照就够 ——
    // 真正落盘时会拿磁盘上的最新值重新定位一次，所以快照过期不影响写入的正确性。
    const snapshotItem = (Config.pushlist.bilibili ?? []).find(item => item.host_mid === host_mid)
    const isRemove = Boolean(snapshotItem?.group_id.some(entry => matchesGroup(entry, groupId)))

    // 顺序执行数据库操作和消息发送
    if (isRemove) {
      if (isSubscribed) {
        await bilibiliDB?.unsubscribeBilibiliUser(groupId, host_mid)
      }
      await event.reply?.(`群：${event.group_name ?? ''}(${groupId})\n删除成功！${data.data.card.name}\nUID：${host_mid}`)
    } else {
      await bilibiliDB?.subscribeBilibiliUser(groupId, botId, host_mid, data.data.card.name)
      await event.reply?.(`群：${event.group_name ?? ''}(${groupId})\n添加成功！${data.data.card.name}\nUID：${host_mid}`)

      // 检查推送状态
      if (Config.bilibili?.push?.switch === false) {
        await event.reply?.('请发送「#kkk设置B站推送开启」以进行推送')
      }
    }

    // 落盘：从磁盘上的最新值重新定位条目，改动写成幂等的（有则删 / 无则加）。
    // 这样即使这期间别的群也在订阅同一个 UP，两边的改动都能留下来 —— 换成整份数组
    // 覆盖写就会用一份过期快照把对方抹掉。
    Config.update('pushlist', 'bilibili', (current: BilibiliPushConfigItem[] | undefined) => {
      const list = Array.isArray(current) ? current : []
      const index = list.findIndex(item => item.host_mid === host_mid)

      const item = index >= 0 ? list[index] : undefined

      if (isRemove) {
        // 条目已经不在了：别处已经删过，直接认账
        if (!item) return list
        const groupIndex = item.group_id.findIndex(entry => matchesGroup(entry, groupId))
        if (groupIndex >= 0) item.group_id.splice(groupIndex, 1)
        // 如果删除后 group_id 数组为空，则删除整个条目
        if (item.group_id.length === 0) list.splice(index, 1)
        return list
      }

      if (item) {
        if (!item.group_id.some(entry => matchesGroup(entry, groupId))) {
          item.group_id.push(`${groupId}:${botId}`)
        }
        item.pushTypes = normalizeBilibiliPushTypes(item.pushTypes)
        return list
      }

      // 不存在相同的 host_mid，新增一个配置项
      list.push({
        switch: true,
        host_mid,
        group_id: [`${groupId}:${botId}`],
        remark: data.data.card.name,
        pushTypes: [...DEFAULT_BILIBILI_PUSH_TYPES]
      })
      return list
    })

    await this.renderPushList()
  }

  /**
   * 检查并更新配置文件中指定用户的备注信息。
   * 该函数会遍历配置文件中的用户列表，对于没有备注或备注为空的用户，会从外部数据源获取其备注信息，并更新到配置文件中。
   */
  async checkremark (): Promise<boolean> {
    const pushList = Config.pushlist.bilibili
    if (!pushList || pushList.length === 0) return true

    // 先把要补的备注全查回来，再一次性落盘。中间隔着网络请求，不能拿着配置快照原地改 ——
    // 那样最后整份覆盖写会把这期间别处的订阅改动抹掉。
    const remarks = new Map<number, string>()
    for (const item of pushList) {
      if (item.remark !== undefined && item.remark !== '') continue
      // 从外部数据源获取用户备注信息
      const resp = asAmagiResponse<BiliUserProfile>(await this.amagi.bilibili.fetchUserCard({ host_mid: item.host_mid, typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig()))
      remarks.set(item.host_mid, resp.data.data.card.name)
    }

    if (remarks.size === 0) return true

    Config.update('pushlist', 'bilibili', (current: BilibiliPushConfigItem[] | undefined) => {
      const list = Array.isArray(current) ? current : []
      let changed = false
      for (const item of list) {
        const remark = remarks.get(item.host_mid)
        // 只补空备注：这期间用户可能已经自己改了名字，别用查来的昵称盖掉
        if (remark && (item.remark === undefined || item.remark === '')) {
          item.remark = remark
          changed = true
        }
      }
      return changed ? list : undefined
    })

    return true
  }

  /**
   * 强制推送
   * @param {WillBePushList} data - 处理完成的推送列表
   */
  async forcepush (data: WillBePushList): Promise<void> {
    const event = this.e
    if (!event) return
    const currentGroupId = String(event.group_id || '')
    const currentBotId = String(event.self_id || '')

    // 如果不是全部强制推送，需要过滤数据
    if (!(event.msg ?? '').includes('全部')) {
      // 获取当前群组订阅的所有UP主
      const subscriptions = await bilibiliDB?.getGroupSubscriptions(currentGroupId)
      const subscribedUids = subscriptions?.map(sub => sub.host_mid) || []

      /** 创建一个新的推送列表，只包含当前群组订阅的UP主的动态 */
      const filteredData: WillBePushList = {}

      for (const dynamicId in data) {
        const item = data[dynamicId]
        // 检查该动态的UP主是否被当前群组订阅
        if (item && subscribedUids.includes(item.host_mid)) {
          // 复制该动态到过滤后的列表，并将目标设置为当前群组
          filteredData[dynamicId] = {
            ...item,
            targets: [{
              groupId: currentGroupId,
              botId: currentBotId
            }]
          }
        }
      }

      // 使用过滤后的数据进行推送
      await this.getdata(filteredData)
    } else {
      // 全部强制推送，保持原有逻辑
      await this.getdata(data)
    }
  }

  /** 渲染推送列表图片 */
  async renderPushList (): Promise<void> {
    const event = this.e
    if (!event) return
    await this.syncConfigToDatabase()
    // 获取当前群组的所有订阅
    const subscriptions = await bilibiliDB?.getGroupSubscriptions(String(event.group_id ?? ''))

    if (!subscriptions || subscriptions.length === 0) {
      await event.reply?.(`当前群：${event.group_name ?? ''}(${event.group_id ?? ''})\n没有设置任何B站UP推送！\n可使用「#设置B站推送 + UP主UID」进行设置`)
      return
    }

    /** 用户的今日动态列表 */
    const renderOpt = []

    // 获取所有订阅UP主的信息
    for (const subscription of subscriptions) {
      const host_mid = subscription.host_mid
      const userInfo = asAmagiResponse<BiliUserProfile>(await this.amagi.bilibili.fetchUserCard({ host_mid, typeMode: 'strict' }, Config.cookies.bilibili, buildAmagiRequestConfig()))
      const configItem = Config.pushlist.bilibili?.find(item => item.host_mid === host_mid)

      renderOpt.push({
        avatar_img: userInfo.data.data.card.face,
        username: userInfo.data.data.card.name,
        // card.mid 是数字，契约要字符串（模板直接把它当文本渲染）
        host_mid: String(userInfo.data.data.card.mid),
        fans: Common.count(userInfo.data.data.follower),
        total_favorited: Common.count(userInfo.data.data.like_num),
        following_count: Common.count(userInfo.data.data.card.attention),
        // 原来漏了这个字段，卡片右上角那颗 ON/OFF 灯永远是 OFF
        switch: configItem?.switch !== false,
        // 契约要的是原始类型键数组：模板里是 `props.pushTypes ?? Object.keys(pushTypeConfig)`
        // 再按键取 label。原来传的是 '视频 / 直播' 这种拼好的中文串，
        // 建不出 Set 里的键，六个推送类型的图标全是灰的
        pushTypes: normalizeBilibiliPushTypes(configItem?.pushTypes)
      })
    }

    const img = await Render('bilibili/userlist', {
      groupInfo: buildPushListGroupInfo(event),
      renderOpt
    })
    await event.reply?.(img)
  }
}

/**
 * 处理并提取表情数据，返回一个包含表情名称和URL的对象数组。
 * @param {unknown[]} data - 表情数据的数组，每个元素包含一个表情包的信息
 * @returns {Array<{text: string, url: string}>} 返回一个对象数组，每个对象包含text(表情名称)和url(表情图片地址)属性
 */
export const extractEmojisData = (data: unknown): Array<{ text: string, url: string }> => {
  if (!Array.isArray(data)) return []

  const emojis: Array<{ text: string, url: string }> = []
  for (const paragraph of data) {
    if (typeof paragraph !== 'object' || paragraph === null || !('emote' in paragraph) || !Array.isArray(paragraph.emote)) continue
    for (const emoji of paragraph.emote) {
      if (typeof emoji !== 'object' || emoji === null || !('text' in emoji) || !('url' in emoji)) continue
      if (emoji.text && emoji.url) emojis.push({ text: String(emoji.text), url: String(emoji.url) })
    }
  }
  return emojis
}

/**
 * 判断标题是否有屏蔽词或屏蔽标签
 * @param {BilibiliPushItem} PushItem - 推送项
 * @returns {Promise<boolean>} 是否应该跳过推送
 */
export const skipDynamic = async (PushItem: BilibiliFilterPushItem): Promise<boolean> => {
  const tags: string[] = []

  // 提取标签
  const moduleDynamic = PushItem.Dynamic_Data.modules?.module_dynamic
  if (moduleDynamic?.desc?.rich_text_nodes) {
    for (const node of moduleDynamic.desc.rich_text_nodes) {
      if (node.type === 'topic') {
        if (node.orig_text) {
          tags.push(node.orig_text)
        }
      }
    }
  }

  // 检查转发的原动态标签
  const originalMajor = PushItem.Dynamic_Data.orig?.modules?.module_dynamic?.major
  if (PushItem.Dynamic_Data.type === DynamicType.FORWARD && originalMajor) {
    const majorType = 'type' in originalMajor ? originalMajor.type : undefined
    if (
      majorType === MajorType.DRAW ||
      majorType === MajorType.OPUS ||
      majorType === MajorType.LIVE_RCMD
    ) {
      for (const node of originalMajor.opus?.summary?.rich_text_nodes ?? []) {
        if (node.type === 'topic' && node.orig_text) {
          tags.push(node.orig_text)
        }
      }
    }
  }

  logger.debug(`检查动态是否需要过滤：https://t.bilibili.com/${PushItem.Dynamic_Data.id_str}`)
  const shouldFilter = await bilibiliDB?.shouldFilter(PushItem, tags)
  return Boolean(shouldFilter)
}
