import { Base, baseHeaders, Networks, Render, Config, Common, downloadFile, downloadVideo, Version, processImageUrl } from '../../utils/index.js'
import { cleanOldDynamicCache, douyinDB } from '../../db/index.js'
import { getDouyinID, douyinProcessVideos } from './index.js'
import { buildLivePhotoMessages, buildLivePhotoTipMessage } from '../common/livePhoto.js'
import { getDouyinWorkCoverUrl, isDouyinArticle, isDouyinImage, isDouyinVideo } from './workType.js'
import common from '../../../../../lib/common/common.js'

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
 * @typedef {Object.<string, any>} DetailData
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

const DEFAULT_DOUYIN_PUSH_TYPES = ['post', 'live']
const VALID_DOUYIN_PUSH_TYPES = ['post', 'favorite', 'recommend', 'live']
const DOUYIN_PUSH_TYPE_LABELS = {
  post: '作品列表',
  favorite: '喜欢列表',
  recommend: '推荐列表',
  live: '直播'
}

const normalizePushTypes = (pushTypes) => {
  if (!Array.isArray(pushTypes) || pushTypes.length === 0) return [...DEFAULT_DOUYIN_PUSH_TYPES]
  const result = []
  for (const type of pushTypes) {
    if (VALID_DOUYIN_PUSH_TYPES.includes(type) && !result.includes(type)) result.push(type)
  }
  return result.length > 0 ? result : [...DEFAULT_DOUYIN_PUSH_TYPES]
}

const getDouyinMusicUrl = (music) => {
  if (!music) return ''
  if (music.play_url?.uri) return music.play_url.uri
  try {
    return JSON.parse(music.extra || '{}')?.original_song_url || ''
  } catch {
    return ''
  }
}

const getDouyinLiveVideoUrl = (imageItem) => {
  const uri = imageItem?.video?.play_addr_h264?.uri || imageItem?.video?.play_addr?.uri
  return uri ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${uri}&ratio=1080p&line=0` : ''
}

export class DouYinpush extends Base {
  /**
   * 构造函数
   * @param {*} e - 事件对象
   * @param {boolean} [force=false] - 是否强制推送
   */
  constructor(e, force = false) {
    super(e)
    if (this.botadapter === 'QQBot') {
      e.reply('不支持QQBot，请使用其他适配器')
      return
    }
    this.force = force
  }


  /**
   * 执行主要的操作流程
   */
  async action() {
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
  async syncConfigToDatabase() {
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
  async ensureConfigFields(pushList) {
    if (!pushList.length) return

    let hasChanges = false
    for (const item of pushList) {
      if (!item.sec_uid && item.short_id) {
        try {
          const searchResult = await this.amagi.getDouyinData('搜索数据', {
            query: item.short_id,
            type: 'user',
            typeMode: 'strict'
          })
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
   * @param {any} searchResult 搜索结果
   * @returns {any[]}
   */
  getSearchUsers(searchResult) {
    if (Array.isArray(searchResult?.data?.user_list)) return searchResult.data.user_list
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
  async getdata(data) {
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
        ${logger.blue('博主')}: ${logger.green(pushItem.remark)} 
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
        let img = []
        /** @type {import('./getid.js').DouyinIdData} 抖音数据类型 */
        let iddata = { is_mp4: true, type: 'one_work' }

        // 如果不跳过，获取抖音ID数据
        if (!skip) {
          iddata = await getDouyinID(Detail_Data?.share_url || 'https://live.douyin.com/' + Detail_Data?.room_data?.owner?.web_rid, false)
        }
        const isArticle = isDouyinArticle(Detail_Data)
        const isVideo = isDouyinVideo(Detail_Data)
        const isImage = isDouyinImage(Detail_Data)
        if (!pushItem.living && iddata.type === 'one_work') iddata.is_mp4 = isVideo

        // 如果不跳过，处理动态内容
        if (!skip) {
          // 处理直播推送
          if (pushItem.living && 'room_data' in pushItem.Detail_Data && Detail_Data.live_data) {
            // 处理直播推送
            img = await Render('douyin/live', {
              image_url: [{ image_src: Detail_Data?.live_data?.data?.data?.data[0]?.cover?.url_list[0] || '' }],
              text: Detail_Data?.live_data?.data?.data?.data[0]?.title || '',
              liveinf: `${Detail_Data.live_data?.data?.data?.partition_road_map?.partition?.title || Detail_Data.live_data?.data?.data?.data[0].title || ''} | 房间号: ${Detail_Data?.room_data?.owner?.web_rid || ''}`,
              在线观众: Common.count(Detail_Data.live_data?.data?.data?.data[0].room_view_stats?.display_value),
              总观看次数: Common.count(Number(Detail_Data.live_data?.data?.data?.data[0].stats?.total_user_str)),
              username: Detail_Data.user_info.data.user.nickname,
              avater_url: 'https://p3-pc.douyinpic.com/aweme/1080x1080/' + Detail_Data.user_info.data.user.avatar_larger.uri,
              fans: Common.count(Detail_Data.user_info.data.user.follower_count),
              create_time: Common.convertTimestampToDateTime(Date.now() / 1000),
              now_time: Common.convertTimestampToDateTime(Date.now() / 1000),
              share_url: 'https://live.douyin.com/' + Detail_Data.room_data.owner.web_rid,
              dynamicTYPE: '直播动态推送'
            })
          } else {
            // 处理普通作品推送
            const realUrl = Config.douyin?.push?.shareType === 'web' && await new Networks({
              url: Detail_Data.share_url,
              headers: {
                ...douyinBaseHeaders,
                Referer: 'https://www.douyin.com',
                Cookie: ''
              }
            }).getLocation()
            const shareUrl = Config.douyin?.push?.shareType === 'web'
              ? realUrl
              : Detail_Data.video?.play_addr?.uri
                ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${Detail_Data.video.play_addr.uri}&ratio=1080p&line=0`
                : Detail_Data.share_url
            img = await Render('douyin/dynamic', {
              image_url: getDouyinWorkCoverUrl(Detail_Data),
              desc: this.desc(Detail_Data, Detail_Data.desc),
              dianzan: Common.count(Detail_Data.statistics.digg_count),
              pinglun: Common.count(Detail_Data.statistics.comment_count),
              share: Common.count(Detail_Data.statistics.share_count),
              shouchang: Common.count(Detail_Data.statistics.collect_count),
              create_time: Common.convertTimestampToDateTime(pushItem.create_time / 1000),
              avater_url: 'https://p3-pc.douyinpic.com/aweme/1080x1080/' + Detail_Data.user_info.data.user.avatar_larger.uri,
              share_url: shareUrl,
              username: Detail_Data.author.nickname,
              抖音号: Detail_Data.user_info.data.user.unique_id === '' ? Detail_Data.user_info.data.user.short_id : Detail_Data.user_info.data.user.unique_id,
              粉丝: Common.count(Detail_Data.user_info.data.user.follower_count),
              获赞: Common.count(Detail_Data.user_info.data.user.total_favorited),
              关注: Common.count(Detail_Data.user_info.data.user.following_count),
              dynamicTYPE: `抖音${DOUYIN_PUSH_TYPE_LABELS[pushType] || '作品'}推送`
            })
          }
        }

        // 遍历目标群组，并发送消息
        for (const target of pushItem.targets) {
          try {
            const { groupId, botId } = target
            let status = { message_id: '' }
            if (!skip) {
              // 发送消息,如果bot不存在或群组不存在,则默认message_id为1,防止bot上线发一堆消息
              status = Bot?.[botId]?.pickGroup(groupId)
                ? img && await Bot[botId].pickGroup(groupId).sendMsg(img)
                : (logger.warn(`bot${botId}不存在或群${groupId}不存在`), { message_id: '1' })

              // 如果是直播推送，更新直播状态
              if (pushItem.living && 'room_data' in pushItem.Detail_Data && status.message_id) {
                await douyinDB?.updateLiveStatus(pushItem.sec_uid, true)
              }

              // 是否一同解析该新作品？
              if (Config.douyin?.push?.parsedynamic && status.message_id) {
                // 如果新作品是视频
                if (isVideo) {
                  try {
                    /** 默认视频下载地址 */
                    let downloadUrl = `https://aweme.snssdk.com/aweme/v1/play/?video_id=${Detail_Data.video.play_addr.uri}&ratio=1080p&line=0`
                    // 根据配置文件自动选择分辨率
                    if (Config.douyin.autoResolution) {
                      logger.debug(`开始排除不符合条件的视频分辨率；\n
                      共拥有${logger.yellow(Detail_Data.video.bit_rate.length)}个视频源\n
                      视频ID：${logger.green(Detail_Data.aweme_id)}\n
                      分享链接：${logger.green(Detail_Data.share_url)}
                      `)
                      const videoObj = douyinProcessVideos(Detail_Data.video.bit_rate, Config.upload.filelimit || 100)
                      downloadUrl = await new Networks({
                        url: videoObj?.[0]?.play_addr?.url_list?.[0] || '',
                        headers: {
                          ...douyinBaseHeaders,
                          Cookie: ''
                        }
                      }).getLongLink()
                    } else {
                      downloadUrl = await new Networks({
                        url: Detail_Data.video.bit_rate[0].play_addr.url_list[0] || Detail_Data.video.play_addr_h264.url_list[0] || Detail_Data.video.play_addr_h264.url_list[0],
                        headers: {
                          ...douyinBaseHeaders,
                          Cookie: ''
                        }
                      }).getLongLink()
                    }
                    // 下载视频
                    await downloadVideo(this.e, {
                      video_url: downloadUrl,
                      title: { timestampTitle: `tmp_${Date.now()}.mp4`, originTitle: `${Detail_Data.desc}.mp4` },
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
                  let bgmContext = null
                  let hasGeneratedLivePhoto = false
                  const mergeMode = Config.douyin.liveImageMergeMode || 'independent'
                  const musicUrl = getDouyinMusicUrl(Detail_Data.music)
                  const liveimgbgm = musicUrl
                    ? await downloadFile(musicUrl, {
                      title: `Douyin_tmp_A_${Date.now()}.mp3`,
                      headers: douyinBaseHeaders
                    })
                    : null
                  if (liveimgbgm?.filepath) temp.push(liveimgbgm)

                  try {
                    for (const [imageIndex, item] of (Detail_Data.images || []).entries()) {
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
                      const processedImageUrl = await processImageUrl(imageUrl, Detail_Data.desc || '抖音作品图片', imageIndex, douyinBaseHeaders)
                      imageres.push(segment.image(processedImageUrl))
                    }
                    if (hasGeneratedLivePhoto) imageres.push(await buildLivePhotoTipMessage())
                    if (!imageres.length) return false
                    const forwardMsg = Version.BotName === 'Miao-Yunzai'
                      ? Bot?.makeForwardMsg(imageres.map(img => ({
                        user_id: 2854196310,
                        message: img
                      })))
                      : common?.makeForwardMsg(Bot?.[botId], imageres, '作品图片')
                    // 如果bot不存在或群组不存在,则默认message_id为1,防止bot上线发一堆消息
                    Bot?.[botId]?.pickGroup(groupId) && forwardMsg
                      ? await Bot[botId].pickGroup(groupId).sendMsg(forwardMsg)
                      : (logger.warn(`bot${botId}不存在或群${groupId}不存在`), { message_id: '1' })
                  } finally {
                    for (const item of temp) await Common.removeFile(item.filepath, true)
                  }
                } else if (isArticle) {
                  logger.debug(`[抖音推送] 文章作品 ${Detail_Data.aweme_id || actualAwemeId} 已发送动态卡片，跳过二次媒体解析`)
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
  async getDynamicList(userList) {
    /** @type {WillBePushList} */
    const willbepushlist = {} // 初始化将要推送的列表对象

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
        const userinfo = await this.amagi.getDouyinData('用户主页数据', { sec_uid, typeMode: 'strict' })

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
   * @returns {Promise<any[]>}
   */
  async fetchContentList(pushType, sec_uid, item) {
    const fetcher = this.amagi.douyin?.fetcher
    let result

    if (pushType === 'post') {
      result = fetcher?.fetchUserVideoList
        ? await fetcher.fetchUserVideoList({ sec_uid, number: 15, typeMode: 'strict' })
        : await this.amagi.getDouyinData('用户主页视频列表数据', { sec_uid, typeMode: 'strict' })
    } else if (pushType === 'favorite') {
      if (!fetcher?.fetchUserFavoriteList) {
        logger.warn('@ikenxuan/amagi 当前版本未暴露抖音喜欢列表接口，已跳过 favorite 推送')
        return []
      }
      result = await fetcher.fetchUserFavoriteList({ sec_uid, number: 15, typeMode: 'strict' })
    } else if (pushType === 'recommend') {
      if (!fetcher?.fetchUserRecommendList) {
        logger.warn('@ikenxuan/amagi 当前版本未暴露抖音推荐列表接口，已跳过 recommend 推送')
        return []
      }
      result = await fetcher.fetchUserRecommendList({ sec_uid, number: 15, typeMode: 'strict' })
    }

    const awemeList = result?.data?.aweme_list || []
    if (awemeList.length === 0 && pushType !== 'post') {
      logger.warn(`${item.remark || item.short_id || sec_uid} 的${DOUYIN_PUSH_TYPE_LABELS[pushType]}为空，可能未公开`)
    }
    return awemeList
  }

  /**
   * 过滤指定作品需要推送的群组。
   * @param {any} aweme 作品数据
   * @param {string} sec_uid 用户sec_uid
   * @param {Array<{groupId: string, botId: string}>} targets 推送目标
   * @param {'post'|'favorite'|'recommend'|'live'} pushType 推送类型
   * @param {number} index 列表序号
   * @returns {Promise<Array<{groupId: string, botId: string}>>}
   */
  async getValidTargets(aweme, sec_uid, targets, pushType, index) {
    const validTargets = []
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
   * @param {any} aweme 作品数据
   * @param {ApiResponse<DyUserInfo>} fallbackUserInfo 回退用户数据
   * @returns {Promise<ApiResponse<DyUserInfo>>}
   */
  async getAuthorUserInfo(aweme, fallbackUserInfo) {
    try {
      const authorSecUid = aweme.author?.sec_uid
      if (!authorSecUid) return fallbackUserInfo
      return await this.amagi.getDouyinData('用户主页数据', { sec_uid: authorSecUid, typeMode: 'strict' })
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
  async buildLivePushItem(sec_uid, userinfo, item, targets) {
    const liveStatus = await douyinDB?.getLiveStatus(sec_uid)

    if (userinfo.data.user.live_status === 1) {
      if (!userinfo.data.user.room_data) {
        logger.warn(`用户 ${item.remark || sec_uid} 正在直播，但未获取到直播间信息`)
        return null
      }

      const roomData = JSON.parse(userinfo.data.user.room_data)
      const liveInfo = await this.amagi.douyin.fetcher.fetchLiveRoomInfo({
        room_id: userinfo.data.user.room_id_str,
        web_rid: roomData.owner.web_rid,
        typeMode: 'strict'
      })

      if (!liveStatus?.living) {
        return {
          remark: item.remark,
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
          avatar_img: 'https://p3-pc.douyinpic.com/aweme/1080x1080/' + userinfo.data.user.avatar_larger.uri,
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
  async checkIfAlreadyPushed(aweme_id, sec_uid, groupIds, pushType = 'post') {
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
  async setting(data) {
    const config = Config.pushlist // 读取配置文件
    const groupId = this.e.group_id
    const botId = this.e.self_id
    // 使用数组find方法快速定位用户信息卡片，避免循环遍历导致的性能问题
    const userCard = data.data?.find(item => item.card_unique_name === 'user')
    if (!userCard) {
      throw new Error('未找到用户信息')
    }
    const sec_uid = userCard.user_list?.[0]?.user_info?.sec_uid
    if (!sec_uid) {
      throw new Error('无法获取用户sec_uid')
    }

    // 顺序获取用户数据和检查订阅状态
    const UserInfoData = await this.amagi.getDouyinData('用户主页数据', { sec_uid, typeMode: 'strict' })
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
        await this.e.reply(`群：${this.e.group_name}(${groupId})\n删除成功！${UserInfoData.data.user.nickname}\n抖音号：${user_shortid}`)

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
        await this.e.reply(`群：${this.e.group_name}(${groupId})\n添加成功！${UserInfoData.data.user.nickname}\n抖音号：${user_shortid}`)

        // 检查推送状态：如果推送未开启，发送提示消息
        if (Config.douyin.push && Config.douyin.push.switch === false) {
          await this.e.reply('请发送「#kkk设置抖音推送开启」以进行推送')
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
      await this.e.reply(`群：${this.e.group_name}(${groupId})\n添加成功！${UserInfoData.data.user.nickname}\n抖音号：${user_shortid}`)

      // 检查推送状态：如果推送未开启，发送提示消息
      if (Config.douyin.push && Config.douyin.push.switch === false) {
        await this.e.reply('请发送「#kkk设置抖音推送开启」以进行推送')
      }
    }

    // 顺序执行配置保存和界面渲染
    if (config.douyin) {
      Config.modify('pushlist', 'douyin', config.douyin)
    }
    await this.renderPushList()
  }

  /** 渲染推送列表图片 */
  async renderPushList() {
    await this.syncConfigToDatabase()
    const groupId = this.e.group_id

    // 获取当前群组的所有订阅
    const subscriptions = await douyinDB?.getGroupSubscriptions(groupId)

    if (!subscriptions || subscriptions.length === 0) {
      await this.e.reply(`当前群：${this.e.group_name}(${groupId})\n没有设置任何抖音博主推送！\n可使用「#设置抖音推送 + 抖音号」进行设置`)
      return
    }

    /** @type {Record<string, string>[]} */
    const renderOpt = []

    for (const subscription of subscriptions) {
      const sec_uid = subscription.sec_uid
      const userInfo = await this.amagi.getDouyinData('用户主页数据', { sec_uid, typeMode: 'strict' })
      const configItem = Config.pushlist.douyin?.find(item => item.sec_uid === sec_uid)

      renderOpt.push({
        avatar_img: userInfo.data.user.avatar_larger.url_list[0] || '',
        username: userInfo.data.user.nickname,
        short_id: userInfo.data.user.unique_id === '' ? userInfo.data.user.short_id : userInfo.data.user.unique_id,
        fans: Common.count(userInfo.data.user.follower_count),
        total_favorited: Common.count(userInfo.data.user.total_favorited),
        following_count: Common.count(userInfo.data.user.following_count),
        pushTypes: normalizePushTypes(configItem?.pushTypes).map(type => DOUYIN_PUSH_TYPE_LABELS[type] || type).join(' / ')
      })
    }
    const img = await Render('douyin/userlist', { renderOpt })
    await this.e.reply(img)
  }

  /**
   * 强制推送
   * @param {WillBePushList} data 处理完成的推送列表
   */
  async forcepush(data) {
    const currentGroupId = this.e.group_id || this.e.groupId || ''
    const currentBotId = this.e.self_id || this.e.selfId || ''

    // 如果不是全部强制推送，需要过滤数据
    if (!this.e.msg.includes('全部')) {
      // 获取当前群组订阅的所有抖音用户
      const subscriptions = await douyinDB?.getGroupSubscriptions(currentGroupId)
      const subscribedUids = subscriptions?.map(sub => sub.sec_uid) || []

      // 创建一个新的推送列表，只包含当前群组订阅的用户的作品
      /** @type {WillBePushList} */
      const filteredData = {}

      for (const awemeId in data) {
        // 检查该作品的用户是否被当前群组订阅
        if (data[awemeId] && subscribedUids.includes(data[awemeId].sec_uid)) {
          // 复制该作品到过滤后的列表，并将目标设置为当前群组
          filteredData[awemeId] = {
            ...data[awemeId],
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
  async checkremark() {
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
        const userinfo = await this.amagi.getDouyinData('用户主页数据', { sec_uid: i.sec_uid, typeMode: 'strict' })
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
   * @param {any} Detail_Data - 作品详细数据
   * @param {string} desc - 作品描述文本
   * @returns {string} 处理后的描述文本
   */
  desc(Detail_Data, desc) {
    if (desc === '') {
      return '该作品没有描述'
    }
    return desc
  }

}

/**
 * 判断标题是否有屏蔽词或屏蔽标签
 * @param {DouyinPushItem} PushItem - 推送项
 * @returns {Promise<boolean>} 是否应该跳过推送
 */
const skipDynamic = async (PushItem) => {
  // 如果是直播动态，不跳过
  if ('liveStatus' in PushItem.Detail_Data) {
    return false
  }

  /** @type {string[]} */
  const tags = []

  // 提取标签
  if (PushItem.Detail_Data.text_extra) {
    for (const item of PushItem.Detail_Data.text_extra) {
      if (item.hashtag_name) {
        tags.push(item.hashtag_name)
      }
    }
  }

  logger.debug(`检查作品是否需要过滤：${PushItem.Detail_Data.share_url}`)
  const shouldFilter = await douyinDB?.shouldFilter(PushItem, tags)
  return /** @type {boolean} */ (shouldFilter)
}
