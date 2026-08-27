import { Base, baseHeaders, Networks, Render, Config, Common, downloadFile, downloadVideo, Version, processImageUrl } from '@/module/utils/index'
import type { BaseEvent } from '@/module/utils/Base'
import { cleanOldDynamicCache, douyinDB } from '@/module/db/index'
import type { DouyinFilterPushItem } from '@/module/db/douyin'
import type { DouyinPushType } from '@/types/database'
import type { DouyinPushItem as DouyinPushConfigItem } from '@/types/config'
import type { DouyinIdData } from './getid.js'
import { getDouyinID, douyinProcessVideos, pickDouyinPlayUrl } from './index.js'
import { getDouyinData } from './api.js'
import { buildLivePhotoMessagesBatch, buildLivePhotoTipMessage, type LivePhotoBatchItem } from '@/module/platform/common/livePhoto'
import { withDownloadBucket } from '@/module/utils/DownloadBudget'
import { buildPushListGroupInfo, matchesGroup } from '@/module/platform/common/pushList'
import { buildDouyinFavoritePayload, buildDouyinRecommendPayload } from './listCard.js'
import { buildDouyinLivePayload, type DouyinLiveItem, type DouyinRoomData } from './live.js'
import { getDouyinLiveVideoUrl, getDouyinWorkCoverUrl, isDouyinArticle, isDouyinImage, isDouyinVideo, type DouyinLiveImageVideo } from './workType.js'
import common from '@/runtime/host/common'
import { getErrorMessage } from '@/module/utils/error-message'
import { isRecord } from '@/module/utils/record'

/**
 * @typedef {import('@ikenxuan/amagi').ApiResponse} ApiResponse
 * @typedef {import('@ikenxuan/amagi').DySearchInfo} DySearchInfo
 * @typedef {import('@ikenxuan/amagi').DyUserInfo} DyUserInfo
 * @typedef {import('@ikenxuan/amagi').DyUserLiveVideos} DyUserLiveVideos
 */

/**
 * 下载文件选项
 * @typedef {import('../../utils/Base.js').downloadFileOptions} downloadFileOptions
 */

/**
 * 定义推送列表项的接口
 * @typedef {import('../../utils/Config.js').douyinPushItem} douyinPushItem
 */

/**
 * 作品详情信息
 * @typedef {Record<string, unknown>} DetailData
 * @property {import('@ikenxuan/amagi').ApiResponse<import('@ikenxuan/amagi').DyUserInfo>} user_info - 博主主页信息
 * @property {{ liveStatus: 'open' | 'close', isChanged: boolean, isliving: boolean }} [liveStatus] - 直播状态信息
 * @property {import('@ikenxuan/amagi').ApiResponse<import('@ikenxuan/amagi').DyUserLiveVideos>} [live_data] - 直播数据
 */

/**
 * @typedef {Object} DouyinPushItem
 * @property {string} remark - 博主的昵称
 * @property {string} sec_uid - 博主UID
 * @property {number} create_time - 作品发布时间
 * @property {Array<{groupId: string, botId: string}>} targets - 要推送到的群组和机器人ID
 * @property {'post'|'favorite'|'recommend'|'live'} [pushType] - 推送类型
 * @property {DetailData} Detail_Data - 作品详情信息
 * @property {string} avatar_img - 博主头像url
 * @property {boolean} living - 是否正在直播
 * @exports DouyinPushItem
 */

/**
 * 推送列表的类型定义
 * @typedef {Record<string, DouyinPushItem>} WillBePushList
 */

/**
 * 抖音基础请求头配置
 * @type {downloadFileOptions['headers']}
 */
const douyinBaseHeaders = {
  ...baseHeaders,
  Referer: 'https://www.douyin.com',
  Cookie: Config.cookies.douyin
}

/** 抖音推送支持的类型，与数据库层共用同一套字面量 */
export type { DouyinPushType } from '@/types/database'

/** 作品里的话题标签 */
interface DouyinTextExtra {
  hashtag_name?: string
}

/** 作品背景音乐，取播放地址时用到的字段 */
interface DouyinMusic {
  play_url?: { uri?: string }
  /** 原曲信息，抖音以 JSON 字符串下发 */
  extra?: string
}

/** 图集中的单张 Live 图，取视频地址时用到的字段 */
interface DouyinLiveImageItem {
  clip_type?: number
  url_list?: string[]
  video?: DouyinLiveImageVideo
}

interface DouyinPushEvent extends BaseEvent {
  group_id?: string | number
  groupId?: string | number
  self_id?: string | number
  selfId?: string | number
  group_name?: string
  msg?: string
}

interface PushTarget {
  groupId: string
  botId: string
}

interface DouyinAvatar {
  uri?: string
  url_list?: string[]
}

interface DouyinUser {
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

interface DouyinProfileUser extends DouyinUser {
  nickname: string
  avatar_larger: DouyinAvatar
  /** 账号已注销/封禁时抖音返回 special_state=1，配合 user_deleted 判定 */
  special_state_info?: { special_state?: number, title?: string }
  user_deleted?: boolean
}

interface DouyinProfileResponse {
  data: { user: DouyinProfileUser }
}

interface DouyinSearchUser extends DouyinUser {
  user_info?: DouyinUser
}

interface DouyinSearchCard {
  card_unique_name?: string
  user_list?: DouyinSearchUser[]
}

interface DouyinSearchResponse {
  data?: DouyinSearchCard[] | { user_list?: DouyinSearchUser[] }
}

interface DouyinVideoAddress {
  uri?: string
  url_list?: string[]
}

interface DouyinBitRate {
  format?: string
  gear_name?: string
  HDR_bit?: string
  HDR_type?: string
  video_extra?: string
  /** 挑源要按体积排序，所以这一层必须带上 data_size */
  play_addr: DouyinVideoAddress & { data_size: number }
}

interface DouyinAweme {
  aweme_id: string
  create_time: number
  is_top?: number
  author?: DouyinUser
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
  music?: DouyinMusic
  images?: DouyinLiveImageItem[]
}

interface DouyinLiveInfo {
  data?: {
    data?: DouyinLiveItem[] | DouyinLivePayload
    partition_road_map?: { partition?: { title?: string } }
  }
}

interface DouyinLivePayload {
  data?: DouyinLiveItem[]
  partition_road_map?: { partition?: { title?: string } }
}

interface DouyinDetailData extends Omit<DouyinAweme, 'aweme_id' | 'create_time'> {
  aweme_id?: string
  create_time?: number
  user_info: DouyinProfileResponse
  source_user_info?: DouyinProfileResponse
  room_data?: DouyinRoomData
  live_data?: DouyinLiveInfo
  liveStatus?: { liveStatus: 'open' | 'close', isChanged?: boolean, isliving?: boolean }
  text_extra?: DouyinTextExtra[]
}

interface DouyinWorkDetailData extends DouyinDetailData {
  aweme_id: string
  share_url: string
  desc: string
  author: DouyinUser & { nickname: string }
  statistics: NonNullable<DouyinAweme['statistics']>
  video: {
    play_addr: DouyinVideoAddress & { uri: string }
    play_addr_h264: DouyinVideoAddress & { url_list: string[] }
    bit_rate: DouyinBitRate[]
  }
}

interface DouyinPushItem extends DouyinFilterPushItem {
  remark: string
  sec_uid: string
  create_time: number
  targets: PushTarget[]
  pushType?: DouyinPushType
  Detail_Data: DouyinDetailData
  avatar_img: string
  living: boolean
}

type WillBePushList = Record<string, DouyinPushItem>

interface DouyinListResponse {
  data?: { aweme_list?: DouyinAweme[] }
}

/** `skipDynamic` 读取的推送项字段：数据库过滤所需字段 + 直播标记与话题标签 */
export interface DouyinSkipCheckItem extends DouyinFilterPushItem {
  Detail_Data: DouyinFilterPushItem['Detail_Data'] & {
    liveStatus?: { liveStatus: 'open' | 'close', isChanged?: boolean, isliving?: boolean }
    text_extra?: DouyinTextExtra[]
  }
}

const DEFAULT_DOUYIN_PUSH_TYPES: DouyinPushType[] = ['post', 'live']
const DOUYIN_PUSH_TYPE_LABELS: Record<DouyinPushType, string> = {
  post: '作品列表',
  favorite: '喜欢列表',
  recommend: '推荐列表',
  live: '直播'
}

/** 逐个字面量比较，等价于旧实现的 VALID_DOUYIN_PUSH_TYPES.includes() */
const isDouyinPushType = (value: unknown): value is DouyinPushType =>
  value === 'post' || value === 'favorite' || value === 'recommend' || value === 'live'

/**
 * 把配置里的推送类型收敛成合法列表。
 *
 * 非数组、空数组、以及全部非法的情况都回退到默认值；返回的始终是新数组，
 * 调用方改动结果不会污染默认值。
 */
export const normalizePushTypes = (pushTypes: unknown): DouyinPushType[] => {
  if (!Array.isArray(pushTypes) || pushTypes.length === 0) return [...DEFAULT_DOUYIN_PUSH_TYPES]
  const result: DouyinPushType[] = []
  for (const type of pushTypes) {
    if (isDouyinPushType(type) && !result.includes(type)) result.push(type)
  }
  return result.length > 0 ? result : [...DEFAULT_DOUYIN_PUSH_TYPES]
}

/** 取背景音乐播放地址，优先直链，其次 extra 里的原曲地址 */
export const getDouyinMusicUrl = (music: DouyinMusic | undefined): string => {
  if (!music) return ''
  if (music.play_url?.uri) return music.play_url.uri
  try {
    const extra: unknown = JSON.parse(music.extra || '{}')
    const originalSongUrl = isRecord(extra) ? extra.original_song_url : undefined
    return typeof originalSongUrl === 'string' ? originalSongUrl : ''
  } catch {
    return ''
  }
}

/**
 * 取 Live 图的视频地址。
 *
 * 实现在 `workType.ts`，这里只做 re-export 保持既有导入路径 ——
 * 之前这里和 `douyin.ts` 各有一份自己拼 snssdk 地址的副本，两份都会踩同样的坑。
 */
export { getDouyinLiveVideoUrl }

export class DouYinpush extends Base {
  declare e: DouyinPushEvent | undefined

  /** 是否强制推送（忽略已推送记录） */
  force = false

  /**
   * 构造函数
   * @param e 事件对象，定时任务触发时没有事件
   * @param force 是否强制推送
   */
  constructor (e?: DouyinPushEvent, force = false) {
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
   * 执行主要的操作流程。
   *
   * 整段包在 `withDownloadBucket()` 里，是因为主动推送**不走** `runCoordinatedParse`，
   * 于是 ParseCoordinator 铺的下载桶上下文在这条路上是空的 —— 不套的话这一轮推送里
   * 所有下载都会落到 default 兜底桶，和别的平台抢同一份额度。
   */
  async action (): Promise<boolean | void> {
    return await withDownloadBucket('douyin', async () => {
      try {
        await this.syncConfigToDatabase()

        // 清理旧的作品缓存记录
        const deletedCount = await cleanOldDynamicCache('douyin', 1)
        if (deletedCount > 0) {
          logger.info(`已清理 ${deletedCount} 条过期的抖音作品缓存记录`)
        }

        await this.ensureConfigFields(Config.pushlist.douyin || [])

        // 检查备注信息
        if (await this.checkremark()) return true

        const data = await this.getDynamicList(Config.pushlist.douyin || [])

        if (Object.keys(data).length === 0) return true

        if (this.force) return await this.forcepush(data)
        else return await this.getdata(data)
      } catch (error) {
        logger.error(error)
      }
    })
  }

  /**
   * 同步配置文件中的订阅信息到数据库
   */
  async syncConfigToDatabase (): Promise<void> {
    // 如果配置文件中没有抖音推送列表，直接返回
    if (!Config.pushlist.douyin || Config.pushlist.douyin.length === 0) {
      return
    }

    await douyinDB?.syncConfigSubscriptions(Config.pushlist.douyin)
  }

  /**
   * 补全新版推送字段，保持旧配置可直接运行。
   *
   * 分两段：先把要联网的搜索做完，再一次性同步落盘。之前是边 await 边原地改
   * `Config.pushlist.douyin`（那时候拿到的就是缓存原件），最后整份数组覆盖写 ——
   * 这个方法每个推送周期都跑，中间任意一次超时都会留下「内存改了、磁盘没改」的状态。
   *
   * @param {douyinPushItem[]} pushList 推送配置列表，只用来决定要查哪些短号
   */
  async ensureConfigFields (pushList: DouyinPushConfigItem[]): Promise<void> {
    if (!pushList.length) return

    // 联网阶段：老配置只有抖音号没有 sec_uid，得走搜索接口换。
    // 结果先攒在 map 里，落盘那一步才能保持同步、中间没有 await 的余地。
    const resolved = new Map<string, { sec_uid: string, nickname?: string }>()
    for (const item of pushList) {
      if (item.sec_uid || !item.short_id) continue
      try {
        const searchResult = await this.amagi.getDouyinData('搜索数据', {
          query: item.short_id,
          type: 'user',
          typeMode: 'strict'
        }) as DouyinSearchResponse
        const users = this.getSearchUsers(searchResult)
        const matchedUser = users.find(userItem => {
          const user = userItem.user_info || userItem
          return [user.unique_id, user.short_id].filter(Boolean).includes(item.short_id)
        }) || users[0]
        const user = matchedUser?.user_info || matchedUser
        if (user?.sec_uid) {
          resolved.set(item.short_id, { sec_uid: user.sec_uid, nickname: user.nickname })
          logger.info(`已为 ${item.remark || item.short_id} 补全 sec_uid: ${user.sec_uid}`)
        }
      } catch (error) {
        logger.warn(`自动补全 ${item.short_id} 的 sec_uid 失败: ${error}`)
      }
    }

    Config.update('pushlist', 'douyin', (current: DouyinPushConfigItem[] | undefined) => {
      const list = Array.isArray(current) ? current : []
      let hasChanges = false
      for (const item of list) {
        if (!item.sec_uid && item.short_id) {
          const found = resolved.get(item.short_id)
          if (found) {
            item.sec_uid = found.sec_uid
            item.remark ||= found.nickname
            hasChanges = true
          }
        }

        const pushTypes = normalizePushTypes(item.pushTypes)
        if (!Array.isArray(item.pushTypes) || item.pushTypes.join(',') !== pushTypes.join(',')) {
          item.pushTypes = pushTypes
          hasChanges = true
        }
        if (item.switch === undefined) {
          item.switch = true
          hasChanges = true
        }
      }
      // 没改动就不写：这个方法每轮推送都跑，无条件写会白白触发
      // 文件监听 → 缓存失效 → 下次读重新解析，还会反复重排 yaml
      return hasChanges ? list : undefined
    })
  }

  /**
   * 兼容不同版本 amagi 的搜索结果结构。
   * @param {DouyinSearchResponse} searchResult 搜索结果
   * @returns {DouyinSearchUser[]}
   */
  getSearchUsers (searchResult: DouyinSearchResponse): DouyinSearchUser[] {
    if (!Array.isArray(searchResult.data) && Array.isArray(searchResult.data?.user_list)) return searchResult.data.user_list
    const userCard = Array.isArray(searchResult?.data)
      ? searchResult.data.find(item => item.card_unique_name === 'user')
      : null
    return userCard?.user_list || []
  }

  /**
   * 获取并处理抖音动态数据
   * @param {WillBePushList} data - 待推送的抖音动态数据列表
   * @returns {Promise<boolean>} - 返回处理结果，成功返回true
   */
  async getdata (data: WillBePushList): Promise<boolean> {
    try {
      // 检查数据是否为空，为空则直接返回true
      if (Object.keys(data).length === 0) return true

      // 遍历每个动态数据
      for (const awemeId in data) {
        const pushItem = data[awemeId]
        if (!pushItem) continue
        const pushType = pushItem.pushType || (pushItem.living ? 'live' : 'post')
        const actualAwemeId = awemeId.replace(/^(post|favorite|recommend|live)_/, '')
        // 记录开始处理动态的日志信息
        logger.mark(`
        ${logger.blue('开始处理并渲染抖音动态图片')}
        ${logger.blue('博主')}: ${logger.green(pushItem.remark)}${' '}
        ${logger.blue('推送类型')}: ${logger.magenta(DOUYIN_PUSH_TYPE_LABELS[pushType] || pushType)}
        ${logger.cyan('作品id')}：${logger.yellow(actualAwemeId)}
        ${logger.cyan('访问地址')}：${logger.green(pushType === 'live' ? 'https://live.douyin.com/' + (pushItem.Detail_Data?.room_data?.owner?.web_rid || '') : 'https://www.douyin.com/video/' + actualAwemeId)}`)

        // 获取当前动态项
        const Detail_Data = pushItem.Detail_Data
        // 检查是否跳过该动态
        const skip = await skipDynamic(pushItem)
        /**
         * @type {import('@kaguyajs/trss-yunzai-types').icqq.segment[]}
         */
        let img: Awaited<ReturnType<typeof Render>> = false
        let iddata: DouyinIdData = { is_mp4: true, type: 'one_work' }

        // 如果不跳过，获取抖音ID数据
        if (!skip) {
          iddata = await getDouyinID(Detail_Data?.share_url || 'https://live.douyin.com/' + Detail_Data?.room_data?.owner?.web_rid, false)
        }
        const workData = Detail_Data as DouyinWorkDetailData
        const workDetail = workData as Parameters<typeof isDouyinArticle>[0]
        const isArticle = isDouyinArticle(workDetail)
        const isVideo = isDouyinVideo(workDetail)
        const isImage = isDouyinImage(workDetail)
        if (!pushItem.living && iddata.type === 'one_work') iddata.is_mp4 = isVideo

        // 如果不跳过，处理动态内容
        if (!skip) {
          // 处理直播推送
          if (pushItem.living && 'room_data' in pushItem.Detail_Data && Detail_Data.live_data) {
            const liveResponse = Detail_Data.live_data.data
            const livePayload = liveResponse?.data
            const liveItem = Array.isArray(livePayload) ? livePayload[0] : livePayload?.data?.[0]
            const partitionTitle = liveResponse?.partition_road_map?.partition?.title ||
              (!Array.isArray(livePayload) ? livePayload?.partition_road_map?.partition?.title : undefined)
            const profile = Detail_Data.user_info.data.user
            // 处理直播推送
            img = await Render('douyin/live', buildDouyinLivePayload({
              anchor: profile,
              dynamicTYPE: '直播动态推送',
              liveItem,
              partitionTitle: partitionTitle || '',
              webRid: Detail_Data.room_data?.owner?.web_rid || liveItem?.owner?.web_rid || ''
            }))
          } else {
            // 处理普通作品推送
            const realUrl = Config.douyin?.push?.shareType === 'web' && await new Networks({
              url: workData.share_url,
              headers: {
                ...douyinBaseHeaders,
                Referer: 'https://www.douyin.com',
                Cookie: ''
              }
            }).getLocation()
            const shareUrl = Config.douyin?.push?.shareType === 'web'
              // getLocation() 拿不到跳转地址时返回 false，而契约里 share_url 必填 string、
              // 模板又直接把它塞进二维码 `value={props.share_url}`，所以得退回作品页地址
              ? realUrl || workData.share_url
              : workData.video.play_addr.uri
                ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${workData.video.play_addr.uri}&ratio=1080p&line=0`
                : workData.share_url

            // 喜欢/推荐列表有专用卡片：通用卡只有一个作者区，装不下
            // 「甲喜欢了乙的作品」里的甲。source_user_info 就是甲（订阅者）。
            if (pushType === 'favorite' || pushType === 'recommend') {
              const listCardWork = {
                author: workData.author,
                coverUrl: getDouyinWorkCoverUrl(workDetail),
                createTime: Common.convertTimestampToDateTime(pushItem.create_time / 1000),
                desc: workData.desc,
                remark: pushItem.remark,
                shareUrl,
                statistics: workData.statistics
              }
              const subscriber = Detail_Data.source_user_info?.data?.user
              img = pushType === 'favorite'
                ? await Render('douyin/favorite-list', buildDouyinFavoritePayload({ ...listCardWork, liker: subscriber }))
                : await Render('douyin/recommend-list', buildDouyinRecommendPayload({ ...listCardWork, recommender: subscriber }))
            } else {
              img = await Render('douyin/dynamic', {
                image_url: getDouyinWorkCoverUrl(workDetail),
                desc: this.desc(workData, workData.desc),
                dianzan: Common.count(workData.statistics.digg_count),
                pinglun: Common.count(workData.statistics.comment_count),
                share: Common.count(workData.statistics.share_count),
                shouchang: Common.count(workData.statistics.collect_count),
                create_time: Common.convertTimestampToDateTime(pushItem.create_time / 1000),
                avater_url: 'https://p3-pc.douyinpic.com/aweme/1080x1080/' + (workData.user_info.data.user.avatar_larger.uri || ''),
                share_url: shareUrl,
                username: workData.author.nickname,
                // unique_id 和 short_id 都是可选字段，契约必填 string；
                // 原来 unique_id 为 undefined（不是 ''）时直接把 undefined 传给模板
                抖音号: (workData.user_info.data.user.unique_id || workData.user_info.data.user.short_id) || '无法获取',
                粉丝: Common.count(workData.user_info.data.user.follower_count),
                获赞: Common.count(workData.user_info.data.user.total_favorited),
                关注: Common.count(workData.user_info.data.user.following_count),
                dynamicTYPE: `抖音${DOUYIN_PUSH_TYPE_LABELS[pushType] || '作品'}推送`
              })
            }
          }
        }

        // Render 返回 false 表示本次渲染失败，保留未推送状态供下次重试。
        if (!skip && img === false) continue

        // 遍历目标群组，并发送消息
        for (const target of pushItem.targets) {
          // 这条卡片是否已经「不必再重发」：被过滤跳过、发送成功、或 bot/群不存在的兜底。
          // 二次解析（视频/图集）失败不改变它 —— 卡片已经出去了，重发只会让群里看到两遍。
          let cardDelivered = skip
          try {
            const { groupId, botId } = target
            if (!skip) {
              // 发送消息,如果bot不存在或群组不存在,则默认message_id为1,防止bot上线发一堆消息
              const status = Bot?.[botId]?.pickGroup(groupId)
                ? await Bot[botId].pickGroup(groupId).sendMsg(img as never)
                : (logger.warn(`bot${botId}不存在或群${groupId}不存在`), { message_id: '1' })
              const messageId = isRecord(status) ? status.message_id : undefined
              cardDelivered = Boolean(messageId)

              // 如果是直播推送，更新直播状态
              if (pushItem.living && 'room_data' in pushItem.Detail_Data && messageId) {
                await douyinDB?.updateLiveStatus(pushItem.sec_uid, true)
              }

              // 是否一同解析该新作品？
              if (Config.douyin?.push?.parsedynamic && messageId) {
                // 如果新作品是视频
                if (isVideo) {
                  try {
                    /**
                     * 视频下载地址：直接用 `url_list` 的签名直链，不再 `getLongLink()` 跟随跳转。
                     *
                     * 解析路径（`pickDouyinPlayUrl`）早就改成这样了，推送路径漏了。跟随跳转有两个代价：
                     * 一是 302 会落到 cjjd14.com 这类 CDN，返回非 MP4 字节，下下来放不出来；
                     * 二是 `getLongLink()` 用的是完整 GET，为了拿最终 URL 把整条视频缓冲了一遍。
                     */
                    let downloadUrl = ''
                    // 根据配置文件自动选择分辨率
                    if (Config.douyin.autoResolution) {
                      logger.debug(`开始排除不符合条件的视频分辨率；\n
                      共拥有${logger.yellow(workData.video.bit_rate.length)}个视频源\n
                      视频ID：${logger.green(workData.aweme_id)}\n
                      分享链接：${logger.green(workData.share_url)}
                      `)
                      const videoObj = douyinProcessVideos(workData.video.bit_rate, {
                        videoQuality: Config.douyin.push?.pushVideoQuality,
                        maxAutoVideoSize: Config.douyin.push?.pushMaxAutoVideoSize,
                        filelimit: Config.upload.filelimit || 100
                      })
                      downloadUrl = pickDouyinPlayUrl(videoObj?.[0]?.play_addr)
                    } else {
                      downloadUrl = pickDouyinPlayUrl(workData.video.bit_rate[0]?.play_addr) ||
                        pickDouyinPlayUrl(workData.video.play_addr_h264)
                    }
                    if (!downloadUrl) throw new Error('取不到可用的视频下载地址')
                    // 下载视频
                    await downloadVideo(this.e as BaseEvent, {
                      video_url: downloadUrl,
                      title: { timestampTitle: `tmp_${Date.now()}.mp4`, originTitle: `${workData.desc}.mp4` },
                      headers: {
                        ...douyinBaseHeaders,
                        Referer: downloadUrl,
                        Cookie: ''
                      }
                    }, { active: true, activeOption: { uin: botId, group_id: groupId } })
                  } catch (error) {
                    logger.error(error)
                  }
                } else if (isImage && iddata.type === 'one_work') { // 如果新作品是图集
                  /** @type {import ('@kaguyajs/trss-yunzai-types').icqq.segment[]} */
                  const imageres = []
                  const temp = []
                  let hasGeneratedLivePhoto = false
                  const mergeMode = Config.douyin.liveImageMergeMode || 'independent'
                  const musicUrl = getDouyinMusicUrl(workData.music)
                  const liveimgbgm = musicUrl
                    ? await downloadFile(musicUrl, {
                      title: `Douyin_tmp_A_${Date.now()}.mp3`,
                      headers: douyinBaseHeaders
                    })
                    : null
                  if (liveimgbgm?.filepath) temp.push(liveimgbgm)

                  try {
                    const pushImages = workData.images || []
                    const livePhotoItems: LivePhotoBatchItem[] = pushImages.map(item => {
                      if ((item.clip_type ?? 2) === 2) return {}
                      return {
                        staticUrl: item.url_list?.[0] || item.url_list?.[2] || item.url_list?.[1],
                        liveVideoUrl: getDouyinLiveVideoUrl(item),
                        loopCount: item.clip_type === 4 ? 1 : 3
                      }
                    })
                    const livePhotoBatch = await buildLivePhotoMessagesBatch(livePhotoItems, {
                      platform: 'douyin',
                      headers: douyinBaseHeaders,
                      bgmPath: liveimgbgm?.filepath,
                      mergeMode
                    })
                    temp.push(...livePhotoBatch.tempFiles)
                    hasGeneratedLivePhoto = livePhotoBatch.generatedLivePhoto

                    for (const [imageIndex, item] of pushImages.entries()) {
                      const livePhoto = livePhotoBatch.results[imageIndex]
                      if (livePhoto !== undefined && livePhoto.messages.length > 0) {
                        imageres.push(...livePhoto.messages)
                        continue
                      }

                      const imageUrl = item.url_list?.[2] || item.url_list?.[1] || item.url_list?.[0]
                      const processedImageUrl = await processImageUrl(imageUrl as string, workData.desc || '抖音作品图片', imageIndex, douyinBaseHeaders)
                      imageres.push(segment.image(processedImageUrl))
                    }
                    if (hasGeneratedLivePhoto) imageres.push(await buildLivePhotoTipMessage())
                    // 一张都没解析出来时只放弃这次二次解析。
                    // 原来这里是 `return false`：直接从 getdata 返回，把同一轮里后面所有
                    // 博主的作品一起丢掉（它们没写缓存，线上表现是「这一轮只推了前几条」），
                    // 而当前这条的动态卡片其实已经发出去了。
                    if (imageres.length) {
                      const forwardMsg = Version.BotName === 'Miao-Yunzai'
                        ? Bot?.makeForwardMsg(imageres.map(img => ({
                          user_id: 2854196310,
                          message: img
                        })) as never)
                        : common?.makeForwardMsg(Bot?.[botId], imageres, '作品图片')
                      // 如果bot不存在或群组不存在,则默认message_id为1,防止bot上线发一堆消息
                      if (Bot?.[botId]?.pickGroup(groupId) && forwardMsg) {
                        await Bot[botId].pickGroup(groupId).sendMsg(forwardMsg as never)
                      } else {
                        logger.warn(`bot${botId}不存在或群${groupId}不存在`)
                      }
                    } else {
                      logger.warn(`[抖音推送] 作品 ${workData.aweme_id || actualAwemeId} 没有可发送的图集内容，跳过二次解析`)
                    }
                  } finally {
                    for (const item of temp) await Common.removeFile(item.filepath, true)
                  }
                } else if (isArticle) {
                  logger.debug(`[抖音推送] 文章作品 ${workData.aweme_id || actualAwemeId} 已发送动态卡片，跳过二次媒体解析`)
                }
              }
            }
          } catch (error) {
            logger.error(error)
          } finally {
            // 只有确实送达（或被过滤跳过）才写已推标记。
            // 原来这里是无条件写的，理由是「防止 bot 上线发一堆消息」—— 但那个场景已经由
            // 上面 bot/群不存在时的 message_id: '1' 兜底覆盖了。发送本身抛错（风控、网络抖动、
            // 图片上传失败）时无条件写缓存，等于把这条作品永久吞掉，群里永远收不到。
            // 直播不写作品缓存，它的去重走 updateLiveStatus。
            if (!pushItem.living && cardDelivered) {
              await douyinDB?.addAwemeCache(actualAwemeId, pushItem.sec_uid, target.groupId, pushType)
            }
          }
        }
      }
    } catch (e) {
      logger.error('获取抖音动态列表失败', e)
      return false
    }
    return true
  }

  /**
   * 根据配置文件获取用户当天的作品列表。
   * @param {douyinPushItem[]} userList - 抖音推送项列表
   * @returns {Promise<WillBePushList>} 将要推送的列表
   */
  async getDynamicList (userList: DouyinPushConfigItem[]): Promise<WillBePushList> {
    const willbepushlist: WillBePushList = {} // 初始化将要推送的列表对象

    try {
      /** 过滤掉不启用的订阅项 */
      const filteredUserList = userList.filter(item => item.switch !== false)
      for (const item of filteredUserList) {
        try {
          const sec_uid = item.sec_uid
          if (!sec_uid) {
            logger.warn(`用户 ${item.remark || item.short_id || '未知'} 缺少 sec_uid，跳过抖音推送`)
            continue
          }

          const pushTypes = normalizePushTypes(item.pushTypes)
          logger.debug(`开始获取用户：${item.remark}（${sec_uid}）的抖音内容，推送类型：${pushTypes.join(', ')}`)
          // 下面这个接口调用挂掉时，错误卡片是从 amagi 的 Proxy 里出的，那里够不到 item。
          // 先把订阅的 `群号:机器人账号` 记到实例上，卡片才能显示目标群号和推送用的适配器。
          this.pushContext = { groupWithBot: item.group_id }
          const userinfo = await this.amagi.getDouyinData('用户主页数据', { sec_uid, typeMode: 'strict' }) as DouyinProfileResponse

          const targets = item.group_id.map(groupWithBot => {
            const [groupId = '', botId = ''] = groupWithBot.split(':')
            return { groupId, botId }
          }).filter(target => target.groupId && target.botId)

          // 如果没有订阅群组，跳过该用户
          if (targets.length === 0) continue

          // 账号注销后主页接口照样有响应，但作品/直播列表恒空，再往下走等于每轮推送都白打一遍
          // 接口、白吃一次风控额度。上游在这里就 continue，本仓库原来没拦。
          if (userinfo.data.user.special_state_info?.special_state === 1 && userinfo.data.user.user_deleted === true) {
            logger.warn(`${item.remark}（${sec_uid}）${userinfo.data.user.special_state_info.title || '账号已注销'}，跳过推送`)
            continue
          }

          for (const pushType of pushTypes) {
            if (pushType === 'live') {
              const liveItem = await this.buildLivePushItem(sec_uid, userinfo, item, targets)
              if (liveItem) willbepushlist[`live_${sec_uid}`] = liveItem
              continue
            }

            const contentList = await this.fetchContentList(pushType, sec_uid, item)
            // 冷启动判定必须在遍历作品之前一次性快照。
            // hasHistory 查的是 AwemeCaches，而 getValidTargets 给「新订阅群跳过的旧作品」
            // 写的已读标记也落在同一张表里：边遍历边现查的话，第 2 条作品写完标记后，
            // 第 3 条起 hasHistory 就变成 true，整个新订阅的历史作品会被当成老订阅全量推一遍。
            const historySnapshot = pushType === 'post'
              ? undefined
              : await this.snapshotPushHistory(sec_uid, targets, pushType)
            for (const [index, aweme] of contentList.entries()) {
              logger.debug(`开始处理${DOUYIN_PUSH_TYPE_LABELS[pushType]}作品：${aweme.aweme_id}`)
              const validTargets = await this.getValidTargets(aweme, sec_uid, targets, pushType, index, historySnapshot)
              if (validTargets.length === 0) continue

              const authorUserinfo = pushType === 'post' ? userinfo : await this.getAuthorUserInfo(aweme, userinfo)
              willbepushlist[`${pushType}_${aweme.aweme_id}`] = {
                remark: item?.remark || aweme.author?.nickname || sec_uid,
                sec_uid,
                create_time: aweme.create_time * 1000,
                targets: validTargets,
                pushType,
                Detail_Data: {
                  ...aweme,
                  user_info: authorUserinfo,
                  source_user_info: userinfo
                },
                avatar_img: 'https://p3-pc.douyinpic.com/aweme/1080x1080/' + (authorUserinfo.data.user.avatar_larger?.uri || ''),
                living: false
              }
            }
          }
        } catch (error) {
          // 单个博主失败不再中断整轮推送，理由同 bilibili/push.ts 里那处：
          // Base.ts 的 amagi 代理在接口返回非零 code 时会 throw，try 原来在循环外面，
          // 第一个接口失败的博主就会把 for 整个终止，后面所有订阅当轮都不推。
          logger.warn(
            `[抖音推送] 用户 ${item.remark || item.short_id || item.sec_uid || '未知'}本轮跳过：${getErrorMessage(error)}`
          )
          continue
        } finally {
          // 必须清掉：这个循环里有多个 continue，留着的话下一个订阅（乃至这一轮之后
          // 任何走同一实例的接口调用）出错时，卡片会挂上上一个订阅的群号。
          this.pushContext = undefined
        }
      }
    } catch (error) {
      logger.error('获取抖音用户主页作品列表失败:', error)
    }

    return willbepushlist
  }

  /**
   * 获取指定推送类型的作品列表。
   * @param {'post'|'favorite'|'recommend'|'live'} pushType 推送类型
   * @param {string} sec_uid 用户sec_uid
   * @param {douyinPushItem} item 推送配置
   * @returns {Promise<DouyinAweme[]>}
   */
  async fetchContentList (
    pushType: Exclude<DouyinPushType, 'live'>,
    sec_uid: string,
    item: DouyinPushConfigItem
  ): Promise<DouyinAweme[]> {
    const method = pushType === 'post'
      ? '用户主页视频列表数据'
      : pushType === 'favorite'
        ? 'fetchUserFavoriteList'
        : 'fetchUserRecommendList'
    const result = await getDouyinData(method, {
      sec_uid,
      number: 15,
      typeMode: 'strict'
    }) as DouyinListResponse

    const awemeList = result?.data?.aweme_list || []
    if (awemeList.length === 0 && pushType !== 'post') {
      logger.warn(`${item.remark || item.short_id || sec_uid} 的${DOUYIN_PUSH_TYPE_LABELS[pushType]}为空，可能未公开`)
    }
    return awemeList
  }

  /**
   * 在遍历作品列表之前，快照每个目标群的「是否老订阅」。
   *
   * 必须一次性取完：{@link getValidTargets} 会给新订阅群跳过的旧作品写已读标记，
   * 而 `hasHistory` 读的是同一张 AwemeCaches 表，边遍历边查会被自己刚写的标记污染。
   *
   * @param sec_uid 用户sec_uid
   * @param targets 推送目标
   * @param pushType 推送类型
   * @returns groupId → 是否已有推送历史
   */
  async snapshotPushHistory (
    sec_uid: string,
    targets: PushTarget[],
    pushType: Exclude<DouyinPushType, 'live'>
  ): Promise<Map<string, boolean>> {
    const snapshot = new Map<string, boolean>()
    for (const target of targets) {
      snapshot.set(target.groupId, Boolean(await douyinDB?.hasHistory(sec_uid, target.groupId, pushType)))
    }
    return snapshot
  }

  /**
   * 过滤指定作品需要推送的群组。
   * @param {DouyinAweme} aweme 作品数据
   * @param {string} sec_uid 用户sec_uid
   * @param {Array<{groupId: string, botId: string}>} targets 推送目标
   * @param {'post'|'favorite'|'recommend'|'live'} pushType 推送类型
   * @param {number} index 列表序号
   * @param {Map<string, boolean>} [historySnapshot] 遍历列表前取好的订阅历史快照
   * @returns {Promise<Array<{groupId: string, botId: string}>>}
   */
  async getValidTargets (
    aweme: DouyinAweme,
    sec_uid: string,
    targets: PushTarget[],
    pushType: Exclude<DouyinPushType, 'live'>,
    index: number,
    historySnapshot?: Map<string, boolean>
  ): Promise<PushTarget[]> {
    const validTargets: PushTarget[] = []
    const now = Date.now()
    const createTime = Number(aweme.create_time || 0) * 1000
    const timeDifference = now - createTime
    const isTop = aweme.is_top === 1

    if (pushType === 'post') {
      const inOneDay = timeDifference < 86400000
      logger.debug(`
        前期获取该作品基本信息：
        推送类型：${DOUYIN_PUSH_TYPE_LABELS[pushType]}
        作者：${aweme.author?.nickname || '未知'}
        作品ID：${aweme.aweme_id}
        发布时间：${Common.convertTimestampToDateTime(aweme.create_time)}
        是否置顶：${isTop}
        是否在一天内：${inOneDay ? logger.green('true') : logger.red('false')}
        `)
      if (!inOneDay) return validTargets
    }

    for (const target of targets) {
      const isPushed = await douyinDB?.isAwemePushed(aweme.aweme_id, sec_uid, target.groupId, pushType)
      if (isPushed) continue

      if (pushType === 'post' || this.force) {
        validTargets.push(target)
        continue
      }

      // 冷启动判定读快照而不是现查：hasHistory 与 addAwemeCache 共用 AwemeCaches，
      // 现查会把本轮刚写下的「跳过旧作品」标记误当成历史记录。
      // 没传快照时（单测直调等）才退回现查，行为与加快照前一致。
      const hasHistory = historySnapshot?.has(target.groupId)
        ? historySnapshot.get(target.groupId)
        : await douyinDB?.hasHistory(sec_uid, target.groupId, pushType)
      if (hasHistory || index === 0) {
        validTargets.push(target)
      } else {
        await douyinDB?.addAwemeCache(aweme.aweme_id, sec_uid, target.groupId, pushType)
        logger.debug(`新订阅群组 ${target.groupId} 跳过旧${DOUYIN_PUSH_TYPE_LABELS[pushType]}作品 ${aweme.aweme_id} 并标记为已读`)
      }
    }

    return validTargets
  }

  /**
   * 获取作品作者主页数据。失败时回退订阅者主页数据，保证渲染不中断。
   * @param {DouyinAweme} aweme 作品数据
   * @param {ApiResponse<DyUserInfo>} fallbackUserInfo 回退用户数据
   * @returns {Promise<ApiResponse<DyUserInfo>>}
   */
  async getAuthorUserInfo (
    aweme: DouyinAweme,
    fallbackUserInfo: DouyinProfileResponse
  ): Promise<DouyinProfileResponse> {
    try {
      const authorSecUid = aweme.author?.sec_uid
      if (!authorSecUid) return fallbackUserInfo
      return await this.amagi.getDouyinData('用户主页数据', { sec_uid: authorSecUid, typeMode: 'strict' }) as DouyinProfileResponse
    } catch (error) {
      logger.warn(`获取作品作者用户信息失败: ${error}`)
      return fallbackUserInfo
    }
  }

  /**
   * 构建直播推送项。
   * @param {string} sec_uid 用户sec_uid
   * @param {ApiResponse<DyUserInfo>} userinfo 用户主页数据
   * @param {douyinPushItem} item 推送配置
   * @param {Array<{groupId: string, botId: string}>} targets 推送目标
   * @returns {Promise<DouyinPushItem|null>}
   */
  async buildLivePushItem (
    sec_uid: string,
    userinfo: DouyinProfileResponse,
    item: DouyinPushConfigItem,
    targets: PushTarget[]
  ): Promise<DouyinPushItem | null> {
    const liveStatus = await douyinDB?.getLiveStatus(sec_uid)

    if (userinfo.data.user.live_status === 1) {
      if (!userinfo.data.user.room_data) {
        logger.warn(`用户 ${item.remark || sec_uid} 正在直播，但未获取到直播间信息`)
        return null
      }

      const roomData = JSON.parse(userinfo.data.user.room_data) as DouyinRoomData
      const liveInfo = await getDouyinData('直播间信息数据', {
        room_id: userinfo.data.user.room_id_str || '',
        web_rid: roomData.owner?.web_rid || '',
        typeMode: 'strict'
      }) as DouyinLiveInfo

      if (!liveStatus?.living) {
        return {
          remark: item.remark || sec_uid,
          sec_uid,
          create_time: Date.now(),
          targets,
          pushType: 'live',
          Detail_Data: {
            user_info: userinfo,
            room_data: roomData,
            live_data: liveInfo,
            liveStatus: {
              liveStatus: 'open',
              isChanged: true,
              isliving: true
            }
          },
          avatar_img: 'https://p3-pc.douyinpic.com/aweme/1080x1080/' + (userinfo.data.user.avatar_larger.uri || ''),
          living: true
        }
      }
    } else if (liveStatus?.living) {
      await douyinDB?.updateLiveStatus(sec_uid, false)
      logger.info(`用户 ${item.remark || sec_uid} 已关播，更新直播状态`)
    }

    return null
  }

  /**
   * 检查作品是否已经推送过
   * @async
   * @function checkIfAlreadyPushed
   * @param {string} aweme_id - 作品ID
   * @param {string} sec_uid - 用户sec_uid
   * @param {string[]} groupIds - 群组ID列表
   * @param {'post'|'favorite'|'recommend'|'live'} [pushType='post'] - 推送类型
   * @returns {Promise<boolean>} 是否已经推送过
   */
  async checkIfAlreadyPushed (
    aweme_id: string,
    sec_uid: string,
    groupIds: string[],
    pushType: DouyinPushType = 'post'
  ): Promise<boolean> {
    for (const groupId of groupIds) {
      const isPushed = await douyinDB?.isAwemePushed(aweme_id, sec_uid, groupId, pushType)
      if (!isPushed) {
        return false
      }
    }
    return true
  }

  /**
   * 设置或更新特定 sec_uid 的群组信息。
   * @param {DySearchInfo} data 抖音的搜索结果数据。需要接口返回的原始数据
   * @returns {Promise<void>} 操作成功或失败的消息字符串。
   */
  async setting (data: DouyinSearchResponse): Promise<void> {
    const event = this.e as DouyinPushEvent & {
      group_id: string | number
      self_id: string | number
      reply: NonNullable<BaseEvent['reply']>
    }
    const groupId = String(event.group_id)
    const botId = String(event.self_id)
    // 使用数组find方法快速定位用户信息卡片，避免循环遍历导致的性能问题
    const userCard = Array.isArray(data.data)
      ? data.data.find(item => item.card_unique_name === 'user')
      : undefined
    if (!userCard) {
      throw new Error('未找到用户信息')
    }
    const sec_uid = userCard.user_list?.[0]?.user_info?.sec_uid
    if (!sec_uid) {
      throw new Error('无法获取用户sec_uid')
    }

    // 顺序获取用户数据和检查订阅状态
    const UserInfoData = await this.amagi.getDouyinData('用户主页数据', { sec_uid, typeMode: 'strict' }) as DouyinProfileResponse
    const isSubscribed = await douyinDB?.isSubscribed(sec_uid, groupId)

    if (!UserInfoData?.data?.user) {
      throw new Error('获取用户信息失败')
    }

    // 处理抖音号：优先使用unique_id，如果为空则使用short_id
    const user_shortid = UserInfoData.data.user.unique_id || UserInfoData.data.user.short_id
    if (!user_shortid) {
      throw new Error('无法获取用户抖音号')
    }

    // 这条命令是开关式的：群里已经订阅了就取消，没订阅就添加。判断用快照就够 ——
    // 真正落盘时会拿磁盘上的最新值重新定位一次，所以快照过期不影响写入的正确性。
    const snapshotItem = (Config.pushlist.douyin ?? []).find(item => item.sec_uid === sec_uid)
    const isRemove = Boolean(snapshotItem?.group_id.some(entry => matchesGroup(entry, groupId)))

    // 顺序执行数据库操作和消息发送
    if (isRemove) {
      if (isSubscribed) {
        await douyinDB?.unsubscribeDouyinUser(groupId, sec_uid)
      }
      await event.reply(`群：${event.group_name}(${groupId})\n删除成功！${UserInfoData.data.user.nickname}\n抖音号：${user_shortid}`)
    } else {
      if (!isSubscribed) {
        await douyinDB?.subscribeDouyinUser(groupId, botId, sec_uid, user_shortid, UserInfoData.data.user.nickname)
      }
      await event.reply(`群：${event.group_name}(${groupId})\n添加成功！${UserInfoData.data.user.nickname}\n抖音号：${user_shortid}`)

      // 检查推送状态：如果推送未开启，发送提示消息
      if (Config.douyin.push && Config.douyin.push.switch === false) {
        await event.reply('请发送「#kkk设置抖音推送开启」以进行推送')
      }
    }

    // 落盘：从磁盘上的最新值重新定位条目，改动写成幂等的（有则删 / 无则加）。
    // 这样即使这期间别的群也在订阅同一个博主，两边的改动都能留下来 —— 换成整份数组
    // 覆盖写就会用一份过期快照把对方抹掉。
    Config.update('pushlist', 'douyin', (current: DouyinPushConfigItem[] | undefined) => {
      const list = Array.isArray(current) ? current : []
      const index = list.findIndex(item => item.sec_uid === sec_uid)

      const item = index >= 0 ? list[index] : undefined

      if (isRemove) {
        // 条目已经不在了：别处已经删过，直接认账
        if (!item) return list
        const groupIndex = item.group_id.findIndex(entry => matchesGroup(entry, groupId))
        if (groupIndex >= 0) item.group_id.splice(groupIndex, 1)
        // 清理空配置：如果用户没有群组订阅了，删除整个用户配置
        if (item.group_id.length === 0) list.splice(index, 1)
        return list
      }

      if (item) {
        // 添加订阅：向现有用户配置添加新群组
        if (!item.group_id.some(entry => matchesGroup(entry, groupId))) {
          item.group_id.push(`${groupId}:${botId}`)
        }
        item.pushTypes = normalizePushTypes(item.pushTypes)
        return list
      }

      // 新增用户：创建新的用户订阅配置
      list.push({
        switch: true,
        sec_uid,
        group_id: [`${groupId}:${botId}`],
        remark: UserInfoData.data.user.nickname,
        short_id: user_shortid,
        pushTypes: [...DEFAULT_DOUYIN_PUSH_TYPES]
      })
      return list
    })

    await this.renderPushList()
  }

  /** 渲染推送列表图片 */
  async renderPushList (): Promise<void> {
    const event = this.e as DouyinPushEvent & {
      group_id: string | number
      reply: NonNullable<BaseEvent['reply']>
    }
    await this.syncConfigToDatabase()
    const groupId = String(event.group_id)

    // 获取当前群组的所有订阅
    const subscriptions = await douyinDB?.getGroupSubscriptions(groupId)

    if (!subscriptions || subscriptions.length === 0) {
      await event.reply(`当前群：${event.group_name}(${groupId})\n没有设置任何抖音博主推送！\n可使用「#设置抖音推送 + 抖音号」进行设置`)
      return
    }

    /** @type {Record<string, string>[]} */
    const renderOpt = []

    for (const subscription of subscriptions) {
      const sec_uid = subscription.sec_uid
      const userInfo = await this.amagi.getDouyinData('用户主页数据', { sec_uid, typeMode: 'strict' }) as DouyinProfileResponse
      const configItem = Config.pushlist.douyin?.find(item => item.sec_uid === sec_uid)

      renderOpt.push({
        avatar_img: userInfo.data.user.avatar_larger.url_list?.[0] || '',
        username: userInfo.data.user.nickname,
        // unique_id 和 short_id 都是可选字段，契约必填 string
        short_id: (userInfo.data.user.unique_id || userInfo.data.user.short_id) || '无法获取',
        fans: Common.count(userInfo.data.user.follower_count),
        total_favorited: Common.count(userInfo.data.user.total_favorited),
        following_count: Common.count(userInfo.data.user.following_count),
        // 原来漏了这个字段，卡片右上角那颗 ON/OFF 灯永远是 OFF
        switch: configItem?.switch !== false,
        // 契约要的是原始类型键数组：模板里是 `props.pushTypes?.includes('post')` 这样按
        // pushTypeConfig 的键匹配。原来传的是 '作品列表 / 直播' 这种拼好的中文串，
        // includes 永远匹配不上，四个推送类型的图标全是灰的
        pushTypes: normalizePushTypes(configItem?.pushTypes)
      })
    }
    const img = await Render('douyin/userlist', {
      groupInfo: buildPushListGroupInfo(event),
      renderOpt
    })
    await event.reply(img)
  }

  /**
   * 强制推送
   * @param {WillBePushList} data 处理完成的推送列表
   */
  async forcepush (data: WillBePushList): Promise<void> {
    const event = this.e as DouyinPushEvent
    const currentGroupId = String(event.group_id || '')
    const currentBotId = String(event.self_id || '')

    // 如果不是全部强制推送，需要过滤数据
    if (!event.msg?.includes('全部')) {
      // 获取当前群组订阅的所有抖音用户
      const subscriptions = await douyinDB?.getGroupSubscriptions(currentGroupId)
      const subscribedUids = subscriptions?.map(sub => sub.sec_uid) || []

      // 创建一个新的推送列表，只包含当前群组订阅的用户的作品
      const filteredData: WillBePushList = {}

      for (const awemeId in data) {
        // 检查该作品的用户是否被当前群组订阅
        const pushItem = data[awemeId]
        if (pushItem && subscribedUids.includes(pushItem.sec_uid)) {
          // 复制该作品到过滤后的列表，并将目标设置为当前群组
          filteredData[awemeId] = {
            ...pushItem,
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

  /**
   * 检查并更新备注信息
   */
  async checkremark (): Promise<boolean> {
    const pushList = Config.pushlist.douyin
    if (!pushList || pushList.length === 0) return true

    // 先收集缺备注的用户，取备注要走网络，不能在落盘的改动函数里做。
    // 没有 sec_uid 的条目查不了，跳过 —— 那种旧配置由 ensureConfigFields 负责补全
    const pending = pushList
      .filter(item => !item.remark)
      .map(item => item.sec_uid)
      .filter((sec_uid): sec_uid is string => Boolean(sec_uid))
    if (pending.length === 0) return false

    const remarks = new Map<string, string>()
    for (const sec_uid of pending) {
      const userinfo = await this.amagi.getDouyinData('用户主页数据', { sec_uid, typeMode: 'strict' }) as DouyinProfileResponse
      const remark = userinfo.data.user.nickname
      if (remark) remarks.set(sec_uid, remark)
    }
    if (remarks.size === 0) return false

    // 只补备注这一个字段，其余按磁盘上的现状原样留下。原来是整份数组覆盖写，
    // 期间有人订阅 / 退订就会被这份快照抹掉。
    Config.update('pushlist', 'douyin', (current: DouyinPushConfigItem[] | undefined) => {
      if (!Array.isArray(current)) return undefined
      let changed = false
      for (const item of current) {
        const remark = item.sec_uid ? remarks.get(item.sec_uid) : undefined
        if (remark && !item.remark) {
          item.remark = remark
          changed = true
        }
      }
      return changed ? current : undefined
    })

    return false
  }

  /**
   * 处理作品描述
   * @param {DouyinDetailData} Detail_Data - 作品详细数据
   * @param {string} desc - 作品描述文本
   * @returns {string} 处理后的描述文本
   */
  desc (_Detail_Data: DouyinDetailData, desc: string): string {
    if (desc === '') {
      return '该作品没有描述'
    }
    return desc
  }
}

/**
 * 判断标题是否有屏蔽词或屏蔽标签
 * @param PushItem 推送项
 * @returns 是否应该跳过推送
 */
export const skipDynamic = async (PushItem: DouyinSkipCheckItem): Promise<boolean> => {
  // 如果是直播动态，不跳过
  if ('liveStatus' in PushItem.Detail_Data) {
    return false
  }

  const tags: string[] = []

  // 提取标签
  if (PushItem.Detail_Data.text_extra) {
    for (const item of PushItem.Detail_Data.text_extra) {
      if (item.hashtag_name) {
        tags.push(item.hashtag_name)
      }
    }
  }

  logger.debug(`检查作品是否需要过滤：${PushItem.Detail_Data.share_url}`)
  // 数据库未就绪时旧实现返回 undefined 并断言成 boolean，调用方只判真假，这里补 false 与之等价
  const shouldFilter = await douyinDB?.shouldFilter(PushItem, tags)
  return shouldFilter ?? false
}
