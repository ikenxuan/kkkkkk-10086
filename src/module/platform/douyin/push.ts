import { Base, baseHeaders, Networks, Render, Config, Common, downloadFile, downloadVideo, Version, processImageUrl } from '@/module/utils/index'
import type { BaseEvent } from '@/module/utils/Base'
import { cleanOldDynamicCache, douyinDB } from '@/module/db/index'
import type { DouyinFilterPushItem } from '@/module/db/douyin'
import type { DouyinPushType } from '@/types/database'
import type { DouyinPushItem as DouyinPushConfigItem } from '@/types/config'
import type { DouyinIdData } from './getid.js'
import { getDouyinID, douyinProcessVideos } from './index.js'
import { getDouyinData } from './api.js'
import { buildLivePhotoMessages, buildLivePhotoTipMessage } from '@/module/platform/common/livePhoto'
import { buildPushListGroupInfo } from '@/module/platform/common/pushList'
import { buildDouyinLivePayload, type DouyinLiveItem, type DouyinRoomData } from './live.js'
import { getDouyinWorkCoverUrl, isDouyinArticle, isDouyinImage, isDouyinVideo } from './workType.js'
import common from '@/runtime/host/common'

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
  video?: {
    play_addr_h264?: { uri?: string }
    play_addr?: { uri?: string }
  }
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
  play_addr: DouyinVideoAddress
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

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

/** 取 Live 图的视频地址，优先 h264 */
export const getDouyinLiveVideoUrl = (imageItem: DouyinLiveImageItem | undefined): string => {
  const uri = imageItem?.video?.play_addr_h264?.uri || imageItem?.video?.play_addr?.uri
  return uri ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${uri}&ratio=1080p&line=0` : ''
}

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
    if (this.botadapter === 'QQBot') {
      // 定时任务路径没有事件，此时 botadapter 也取不到，走不到这个分支
      e?.reply?.('不支持QQBot，请使用其他适配器')
      return
    }
    this.force = force
  }

  /**
   * 执行主要的操作流程
   */
  async action (): Promise<boolean | void> {
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
   * @param {douyinPushItem[]} pushList 推送配置列表
   */
  async ensureConfigFields (pushList: DouyinPushConfigItem[]): Promise<void> {
    if (!pushList.length) return

    let hasChanges = false
    for (const item of pushList) {
      if (!item.sec_uid && item.short_id) {
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
            item.sec_uid = user.sec_uid
            item.remark ||= user.nickname
            hasChanges = true
            logger.info(`已为 ${item.remark || item.short_id} 补全 sec_uid: ${item.sec_uid}`)
          }
        } catch (error) {
          logger.warn(`自动补全 ${item.short_id} 的 sec_uid 失败: ${error}`)
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

    if (hasChanges) Config.modify('pushlist', 'douyin', pushList)
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

        // Render 返回 false 表示本次渲染失败，保留未推送状态供下次重试。
        if (!skip && img === false) continue

        // 遍历目标群组，并发送消息
        for (const target of pushItem.targets) {
          try {
            const { groupId, botId } = target
            if (!skip) {
              // 发送消息,如果bot不存在或群组不存在,则默认message_id为1,防止bot上线发一堆消息
              const status = Bot?.[botId]?.pickGroup(groupId)
                ? await Bot[botId].pickGroup(groupId).sendMsg(img as never)
                : (logger.warn(`bot${botId}不存在或群${groupId}不存在`), { message_id: '1' })
              const messageId = isRecord(status) ? status.message_id : undefined

              // 如果是直播推送，更新直播状态
              if (pushItem.living && 'room_data' in pushItem.Detail_Data && messageId) {
                await douyinDB?.updateLiveStatus(pushItem.sec_uid, true)
              }

              // 是否一同解析该新作品？
              if (Config.douyin?.push?.parsedynamic && messageId) {
                // 如果新作品是视频
                if (isVideo) {
                  try {
                    /** 默认视频下载地址 */
                    let downloadUrl = `https://aweme.snssdk.com/aweme/v1/play/?video_id=${workData.video.play_addr.uri}&ratio=1080p&line=0`
                    // 根据配置文件自动选择分辨率
                    if (Config.douyin.autoResolution) {
                      logger.debug(`开始排除不符合条件的视频分辨率；\n
                      共拥有${logger.yellow(workData.video.bit_rate.length)}个视频源\n
                      视频ID：${logger.green(workData.aweme_id)}\n
                      分享链接：${logger.green(workData.share_url)}
                      `)
                      const videoObj = douyinProcessVideos(workData.video.bit_rate as never, Config.upload.filelimit || 100)
                      downloadUrl = await new Networks({
                        url: videoObj?.[0]?.play_addr?.url_list?.[0] || '',
                        headers: {
                          ...douyinBaseHeaders,
                          Cookie: ''
                        }
                      }).getLongLink()
                    } else {
                      downloadUrl = await new Networks({
                        url: (workData.video.bit_rate[0]?.play_addr.url_list?.[0] || workData.video.play_addr_h264.url_list[0] || workData.video.play_addr_h264.url_list[0]) as string,
                        headers: {
                          ...douyinBaseHeaders,
                          Cookie: ''
                        }
                      }).getLongLink()
                    }
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
                  let bgmContext: Parameters<typeof buildLivePhotoMessages>[0]['context']
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
                    for (const [imageIndex, item] of (workData.images || []).entries()) {
                      if ((item.clip_type ?? 2) !== 2) {
                        const livePhoto = await buildLivePhotoMessages({
                          platform: 'douyin',
                          staticUrl: item.url_list?.[0] || item.url_list?.[2] || item.url_list?.[1],
                          liveVideoUrl: getDouyinLiveVideoUrl(item),
                          index: imageIndex,
                          headers: douyinBaseHeaders,
                          bgmPath: liveimgbgm?.filepath,
                          mergeMode,
                          context: bgmContext,
                          loopCount: item.clip_type === 4 ? 1 : 3
                        })
                        bgmContext = livePhoto.context || bgmContext
                        temp.push(...livePhoto.tempFiles)
                        hasGeneratedLivePhoto = hasGeneratedLivePhoto || livePhoto.generatedLivePhoto
                        if (livePhoto.messages.length > 0) {
                          imageres.push(...livePhoto.messages)
                          continue
                        }
                      }

                      const imageUrl = item.url_list?.[2] || item.url_list?.[1] || item.url_list?.[0]
                      const processedImageUrl = await processImageUrl(imageUrl as string, workData.desc || '抖音作品图片', imageIndex, douyinBaseHeaders)
                      imageres.push(segment.image(processedImageUrl))
                    }
                    if (hasGeneratedLivePhoto) imageres.push(await buildLivePhotoTipMessage())
                    if (!imageres.length) return false
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
            // 无论推送是否成功，都添加作品缓存以防止重复推送（直播除外）
            // 这确保即使在消息发送失败或跳过的情况下，也不会在下次运行时重复推送相同的作品
            if (!pushItem.living) await douyinDB?.addAwemeCache(actualAwemeId, pushItem.sec_uid, target.groupId, pushType)
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
        const sec_uid = item.sec_uid
        if (!sec_uid) {
          logger.warn(`用户 ${item.remark || item.short_id || '未知'} 缺少 sec_uid，跳过抖音推送`)
          continue
        }

        const pushTypes = normalizePushTypes(item.pushTypes)
        logger.debug(`开始获取用户：${item.remark}（${sec_uid}）的抖音内容，推送类型：${pushTypes.join(', ')}`)
        const userinfo = await this.amagi.getDouyinData('用户主页数据', { sec_uid, typeMode: 'strict' }) as DouyinProfileResponse

        const targets = item.group_id.map(groupWithBot => {
          const [groupId = '', botId = ''] = groupWithBot.split(':')
          return { groupId, botId }
        }).filter(target => target.groupId && target.botId)

        // 如果没有订阅群组，跳过该用户
        if (targets.length === 0) continue

        for (const pushType of pushTypes) {
          if (pushType === 'live') {
            const liveItem = await this.buildLivePushItem(sec_uid, userinfo, item, targets)
            if (liveItem) willbepushlist[`live_${sec_uid}`] = liveItem
            continue
          }

          const contentList = await this.fetchContentList(pushType, sec_uid, item)
          for (const [index, aweme] of contentList.entries()) {
            logger.debug(`开始处理${DOUYIN_PUSH_TYPE_LABELS[pushType]}作品：${aweme.aweme_id}`)
            const validTargets = await this.getValidTargets(aweme, sec_uid, targets, pushType, index)
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
   * 过滤指定作品需要推送的群组。
   * @param {DouyinAweme} aweme 作品数据
   * @param {string} sec_uid 用户sec_uid
   * @param {Array<{groupId: string, botId: string}>} targets 推送目标
   * @param {'post'|'favorite'|'recommend'|'live'} pushType 推送类型
   * @param {number} index 列表序号
   * @returns {Promise<Array<{groupId: string, botId: string}>>}
   */
  async getValidTargets (
    aweme: DouyinAweme,
    sec_uid: string,
    targets: PushTarget[],
    pushType: Exclude<DouyinPushType, 'live'>,
    index: number
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

      const hasHistory = await douyinDB?.hasHistory(sec_uid, target.groupId, pushType)
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
    const config = Config.pushlist // 读取配置文件
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

    // 初始化 douyin 数组：确保配置中存在douyin数组
    config.douyin = config.douyin || []

    // 查找用户配置：检查是否已存在该用户的订阅配置
    const existingItem = config.douyin.find((item) => item.sec_uid === sec_uid)

    if (existingItem) {
      // 使用findIndex快速定位群组配置，提高查找效率
      const groupIndex = existingItem.group_id.findIndex(item => {
        const existingGroupId = item?.split(':')[0]
        return existingGroupId === String(groupId)
      })

      if (groupIndex >= 0) {
        // 删除订阅：移除群组配置并更新数据库
        existingItem.group_id.splice(groupIndex, 1)

        // 顺序执行数据库操作和消息发送
        if (isSubscribed) {
          await douyinDB?.unsubscribeDouyinUser(groupId, sec_uid)
        }
        await event.reply(`群：${event.group_name}(${groupId})\n删除成功！${UserInfoData.data.user.nickname}\n抖音号：${user_shortid}`)

        // 清理空配置：如果用户没有群组订阅了，删除整个用户配置
        if (existingItem.group_id.length === 0) {
          const index = config.douyin.indexOf(existingItem)
          config.douyin.splice(index, 1)
        }
      } else {
        // 添加订阅：向现有用户配置添加新群组
        existingItem.group_id.push(`${groupId}:${botId}`)
        existingItem.pushTypes = normalizePushTypes(existingItem.pushTypes)

        // 顺序执行数据库操作和消息发送
        if (!isSubscribed) {
          await douyinDB?.subscribeDouyinUser(groupId, botId, sec_uid, user_shortid, UserInfoData.data.user.nickname)
        }
        await event.reply(`群：${event.group_name}(${groupId})\n添加成功！${UserInfoData.data.user.nickname}\n抖音号：${user_shortid}`)

        // 检查推送状态：如果推送未开启，发送提示消息
        if (Config.douyin.push && Config.douyin.push.switch === false) {
          await event.reply('请发送「#kkk设置抖音推送开启」以进行推送')
        }
      }
    } else {
      // 新增用户：创建新的用户订阅配置
      config.douyin.push({
        switch: true,
        sec_uid,
        group_id: [`${groupId}:${botId}`],
        remark: UserInfoData.data.user.nickname,
        short_id: user_shortid,
        pushTypes: [...DEFAULT_DOUYIN_PUSH_TYPES]
      })

      // 顺序执行数据库操作和消息发送
      if (!isSubscribed) {
        await douyinDB?.subscribeDouyinUser(groupId, botId, sec_uid, user_shortid, UserInfoData.data.user.nickname)
      }
      await event.reply(`群：${event.group_name}(${groupId})\n添加成功！${UserInfoData.data.user.nickname}\n抖音号：${user_shortid}`)

      // 检查推送状态：如果推送未开启，发送提示消息
      if (Config.douyin.push && Config.douyin.push.switch === false) {
        await event.reply('请发送「#kkk设置抖音推送开启」以进行推送')
      }
    }

    // 顺序执行配置保存和界面渲染
    if (config.douyin) {
      Config.modify('pushlist', 'douyin', config.douyin)
    }
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
    const currentGroupId = String(event.group_id || event.groupId || '')
    const currentBotId = String(event.self_id || event.selfId || '')

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
    // 读取配置文件内容
    /** @type {import('../../utils/Config.js').PushlistConfig} */
    const config = Config.pushlist
    /** @type {{ sec_uid: string }[]} */
    const updateList = []

    if (!Config.pushlist?.douyin || Config.pushlist.douyin.length === 0) return true

    // 遍历配置文件中的用户列表，收集需要更新备注信息的用户
    for (const i of Config.pushlist.douyin) {
      const remark = i.remark
      const sec_uid = i.sec_uid

      if (remark === undefined || remark === '') {
        updateList.push({ sec_uid })
      }
    }

    // 如果有需要更新备注的用户，则逐个获取备注信息并更新到配置文件中
    if (updateList.length > 0) {
      for (const i of updateList) {
        // 从外部数据源获取用户备注信息
        const userinfo = await this.amagi.getDouyinData('用户主页数据', { sec_uid: i.sec_uid, typeMode: 'strict' }) as DouyinProfileResponse
        const remark = userinfo.data.user.nickname

        // 在配置文件中找到对应的用户，并更新其备注信息
        const matchingItemIndex = config.douyin?.findIndex((item) => item.sec_uid === i.sec_uid) || 0
        if (matchingItemIndex !== -1 && config.douyin && config.douyin[matchingItemIndex]) {
          config.douyin[matchingItemIndex].remark = remark
        }
      }

      // 将更新后的配置文件内容写回文件
      Config.modify('pushlist', 'douyin', config.douyin)
    }

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
