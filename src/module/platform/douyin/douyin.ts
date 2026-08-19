import { Base, Config, UploadRecord, Networks, Render, Common, downloadFile, downloadVideo, uploadFile, baseHeaders, processImageUrl } from '@/module/utils/index'
import { runMediaTasks } from '@/module/utils/MediaTasks'
import common from '@/runtime/host/common'
import { markdown } from '@karinjs/md-html'
import {
  burnDouyinDanmaku,
  type DouyinDanmakuElem,
  type DouyinEmojiInfo
} from './danmaku.js'
import { buildLivePhotoMessages, buildLivePhotoTipMessage } from '@/module/platform/common/livePhoto'
import { douyinComments } from './index.js'
import { getDouyinWorkCoverUrl, isDouyinArticle, isDouyinVideo, parseJsonSafely, type DouyinAweme as WorkTypeDouyinAweme } from './workType.js'
import type { DouyinDataType, DouyinIdData } from './getid.js'
import type { DyEmojiList } from '@ikenxuan/amagi'
import fs from 'fs'

interface UrlResource {
  uri?: string
  url_list: string[]
}

interface PlayAddress extends UrlResource {
  data_size: number
}

interface DyVideo {
  FPS?: number
  format: string
  play_addr: PlayAddress
}

interface DouyinMusic {
  author?: string
  cover_hd?: UrlResource
  cover_large?: UrlResource
  cover_thumb?: UrlResource
  play_url?: UrlResource
  extra?: string
  title?: string
}

interface DouyinLiveImageItem {
  clip_type?: number
  url_list: string[]
  video?: {
    play_addr_h264?: UrlResource
    play_addr?: UrlResource
  }
}

interface DouyinUser {
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
  sec_uid?: string
  short_id?: string
  signature?: string
  total_favorited?: number
  unique_id?: string
}

interface DouyinMusicInfo {
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

interface LiveItem {
  cover?: UrlResource
  room_view_stats?: { display_value?: string }
  stats?: { total_user_str?: string }
  title?: string
}

interface LivePartition {
  partition?: { title?: string }
}

interface RoomData {
  owner?: { web_rid?: string }
}

interface DouyinVideo {
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

interface DouyinStatistics {
  collect_count?: number
  comment_count?: number
  digg_count?: number
  recommend_count?: number
  share_count?: number
}

interface DouyinAweme extends WorkTypeDouyinAweme {
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
  share_url?: string
  statistics: DouyinStatistics
  video: DouyinVideo
}

type DouyinResourceType = DouyinDataType
type BaseDouyinEvent = NonNullable<ConstructorParameters<typeof Base>[0]>
type DouyinEvent = BaseDouyinEvent & {
  message_id?: string | number
}
type DouyinRuntimeEvent = DouyinEvent & {
  reply: (...args: unknown[]) => Promise<unknown>
}
type DouyinConstructorData = Omit<DouyinIdData, 'type'> & { type: string }
type CommentsPayload = Parameters<typeof douyinComments>[0]
type DanmakuList = readonly DouyinDanmakuElem[]
type UploadRecordEvent = Parameters<typeof UploadRecord>[0]
type LegacyContent = '提示信息' | '评论图' | '视频' | '背景音乐' | '图集'
type ModernContent = 'info' | 'comment' | 'video'

interface WorkResponse {
  data: { aweme_detail: DouyinAweme }
}

interface NullableWorkResponse {
  data: { aweme_detail: DouyinAweme | null }
}

interface UserInfoResponse {
  data: { user: DouyinUser }
}

interface UserVideoListResponse {
  data?: { aweme_list?: DouyinAweme[] }
  aweme_list?: DouyinAweme[]
}

interface MusicResponse {
  data: { music_info: DouyinMusicInfo }
}

interface DanmakuResponse {
  data?: { danmaku_list?: DanmakuList }
  danmaku_list?: DanmakuList
}

interface EmojiResponse {
  data: DyEmojiList
}

interface LiveResponse {
  data: Record<string, unknown>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isDouyinDataType = (value: string): value is DouyinDataType => [
  'one_work',
  'work_comments',
  'user_mix_videos',
  'user_dynamic',
  'user_profile',
  'live_room_detail',
  'liveroom_def',
  'emoji_list',
  'music_work',
  'suggest_words',
  'search_info',
  'undefined'
].includes(value)

const narrowApiResponse = <T extends object>(value: unknown, label: string): T => {
  if (!isRecord(value)) throw new Error(`${label}返回格式异常`)
  return value as T
}

const getUploadRecordEvent = (event: DouyinRuntimeEvent): UploadRecordEvent => {
  if (!isRecord(event.bot)) throw new Error('消息事件缺少机器人实例')
  return event as unknown as UploadRecordEvent
}

const getLivePayload = (response: LiveResponse): { items: LiveItem[], partition: LivePartition } => {
  const responseData = response.data
  const payload = isRecord(responseData.data) ? responseData.data : responseData
  const items = Array.isArray(payload.data)
    ? payload.data.filter((item): item is LiveItem => isRecord(item))
    : []
  const partition = isRecord(payload.partition_road_map)
    ? payload.partition_road_map as LivePartition
    : {}
  return { items, partition }
}

let mp4size = ''
let img: Awaited<ReturnType<typeof Render>>

const getFirstUrl = (data?: UrlResource): string => data?.url_list?.find(Boolean) || ''
const formatVideoDuration = (duration?: number): string => {
  const seconds = Math.floor((duration || 0) / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}
const formatVideoStats = (statistics: DouyinAweme['statistics'] = {}): string => [
  `\n点赞：${Common.count(statistics.digg_count)}`,
  `评论：${Common.count(statistics.comment_count)}`,
  `收藏：${Common.count(statistics.collect_count)}`,
  `分享：${Common.count(statistics.share_count)}`,
  statistics.recommend_count !== undefined ? `推荐：${Common.count(statistics.recommend_count)}` : ''
].filter(Boolean).join('\n')

const hasUserConfigKey = (key: string): boolean => Object.prototype.hasOwnProperty.call(Config.getConfig('douyin') || {}, key)
const hasDouyinContent = (legacyKey: LegacyContent, modernKey?: ModernContent): boolean => {
  const sendContent = Config.douyin.sendContent
  if (modernKey && hasUserConfigKey('sendContent') && Array.isArray(sendContent) && sendContent.length > 0) {
    return sendContent.includes(modernKey)
  }
  return (Config.douyin.douyinTip || []).includes(legacyKey)
}

const getDouyinMusicUrl = (music?: DouyinMusic): string => {
  if (!music) return ''
  if (music.play_url?.uri) return music.play_url.uri
  try {
    const extra: unknown = JSON.parse(music.extra || '{}')
    return isRecord(extra) && typeof extra.original_song_url === 'string' ? extra.original_song_url : ''
  } catch {
    return ''
  }
}

const getDouyinLiveVideoUrl = (imageItem?: DouyinLiveImageItem): string => {
  const uri = imageItem?.video?.play_addr_h264?.uri || imageItem?.video?.play_addr?.uri
  return uri ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${uri}&ratio=1080p&line=0` : ''
}

export class DouYin extends Base {
  declare e: DouyinRuntimeEvent
  type: DouyinResourceType
  is_mp4: boolean | undefined
  is_slides: boolean
  forceBurnDanmaku: boolean
  hasProcessedLiveImage: boolean

  constructor (
    e: DouyinEvent,
    iddata: DouyinConstructorData,
    options?: { forceBurnDanmaku?: boolean }
  ) {
    super(e)
    if (!e.reply) throw new Error('抖音解析事件缺少回复方法')
    this.e = e as DouyinRuntimeEvent
    this.type = isDouyinDataType(iddata.type) ? iddata.type : 'undefined'
    this.is_mp4 = iddata?.is_mp4
    this.is_slides = false
    this.forceBurnDanmaku = options?.forceBurnDanmaku ?? false
    this.hasProcessedLiveImage = false
  }

  async handleArticleWork (VideoData: WorkResponse): Promise<boolean> {
    const aweme = VideoData.data.aweme_detail
    const content = parseJsonSafely<{ markdown?: string }>(aweme.article_info?.article_content)
    const feData = parseJsonSafely<{ image_list?: unknown[], read_time?: number }>(aweme.article_info?.fe_data)
    const articleHtml = markdown(content.markdown || aweme.desc || '', {})

    const img = await Render('douyin/article-work', {
      title: aweme.article_info?.article_title || aweme.desc || '抖音文章',
      html: articleHtml,
      images: feData.image_list || [],
      read_time: feData.read_time || 0,
      dianzan: Common.count(aweme.statistics?.digg_count),
      pinglun: Common.count(aweme.statistics?.comment_count),
      shouchang: Common.count(aweme.statistics?.collect_count),
      share: Common.count(aweme.statistics?.share_count),
      create_time: Common.convertTimestampToDateTime(aweme.create_time),
      avater_url: getFirstUrl(aweme.author?.avatar_thumb) || getFirstUrl(aweme.author?.avatar_larger),
      username: aweme.author?.nickname || '无法获取',
      douyin_id: aweme.author?.unique_id || aweme.author?.short_id || '无法获取',
      total_favorited: Common.count(aweme.author?.total_favorited),
      following_count: Common.count(aweme.author?.following_count),
      follower_count: Common.count(aweme.author?.follower_count),
      share_url: aweme.share_url || `https://www.douyin.com/article/${aweme.aweme_id}`
    })
    await this.e.reply(img)
    return true
  }

  async RESOURCES (data: DouyinConstructorData): Promise<boolean | {
    type: 'douyin_user_selection'
    timeoutSeconds: number
    videos: Array<{ aweme_id: string, title: string, index: number }>
  } | undefined> {
    try {
      if (this.type === 'undefined') return true
      if (Config.app.parseTip || hasDouyinContent('提示信息')) {
        await this.e.reply('检测到抖音链接，开始解析')
      }
      switch (this.type) {
        case 'one_work': {
          const VideoResponse = narrowApiResponse<NullableWorkResponse>(await this.amagi.getDouyinData('聚合解析', {
            aweme_id: data.aweme_id,
            typeMode: 'strict'
          }), '作品详情')
          if (VideoResponse.data.aweme_detail === null) {
            throw new Error('获取作品详情失败，可能是因为该作品已被删除或设置为私密。')
          }
          const VideoData: WorkResponse = { data: { aweme_detail: VideoResponse.data.aweme_detail } }
          const isArticle = isDouyinArticle(VideoData.data.aweme_detail)
          const isVideo = isDouyinVideo(VideoData.data.aweme_detail)
          if (typeof this.is_mp4 !== 'boolean') this.is_mp4 = isVideo
          const CommentsData = narrowApiResponse<CommentsPayload>(await this.amagi.getDouyinData('评论数据', {
            aweme_id: data.aweme_id,
            number: Config.douyin.numcomments,
            typeMode: 'strict'
          }), '评论数据')
          let emojiListPromise: Promise<DouyinEmojiInfo[]> | undefined
          const getEmojiList = (): Promise<DouyinEmojiInfo[]> => {
            emojiListPromise ??= (async () => {
              try {
                const emojiData = narrowApiResponse<EmojiResponse>(
                  await this.amagi.getDouyinData('Emoji数据', { typeMode: 'strict' }),
                  'Emoji数据'
                )
                return Emoji(emojiData.data).filter(
                  (item): item is DouyinEmojiInfo => typeof item.url === 'string' && item.url.length > 0
                )
              } catch (error) {
                logger.warn('[抖音] 获取表情列表失败，降级为纯文字', error)
                return []
              }
            })()
            return emojiListPromise
          }
          this.is_slides = VideoData.data.aweme_detail.is_slides === true
          let g_video_url = ''
          let g_title: string | undefined

          /** 图集 */
          let imagenum = 0
          const image_res = []
          if (!isVideo && !isArticle && hasDouyinContent('图集')) {
            switch (true) {
              // 图集
              case this.is_slides === false && VideoData.data.aweme_detail.images !== null: {
                const image_data = []
                const imageres = []
                let image_url = ''
                // 使用可选链和空值合并操作符确保安全访问
                const images = VideoData.data.aweme_detail.images || []
                const hasLiveImage = images.some(item => (item.clip_type ?? 2) !== 2)
                const title = VideoData.data.aweme_detail.preview_title.substring(0, 50).replace(/[\\/:*?"<>|\r\n]/g, ' ')
                g_title = title

                if (hasLiveImage) {
                  const processedImages = []
                  const temp = []
                  let hasGeneratedLivePhoto = false
                  let bgmContext
                  const mergeMode = Config.douyin.liveImageMergeMode || 'independent'
                  const musicUrl = getDouyinMusicUrl(VideoData.data.aweme_detail.music)
                  const liveimgbgm = musicUrl
                    ? await downloadFile(musicUrl, {
                      title: `Douyin_tmp_A_${Date.now()}.mp3`,
                      headers: {
                        ...this.headers,
                        Referer: 'https://www.douyin.com/',
                        Cookie: ''
                      }
                    })
                    : null
                  if (liveimgbgm?.filepath) temp.push(liveimgbgm)

                  for (const [index, imageItem] of images.entries()) {
                    imagenum++
                    if (imageItem.clip_type === 2 || imageItem.clip_type === undefined) {
                      image_url = imageItem.url_list?.[2] || imageItem.url_list?.[1] || imageItem.url_list?.[0] || ''
                      const processedImageUrl = await processImageUrl(image_url, g_title, index, {
                        Referer: 'https://www.douyin.com/',
                        Cookie: Config.cookies.douyin || ''
                      })
                      processedImages.push(segment.image(processedImageUrl))
                      continue
                    }

                    const livePhoto = await buildLivePhotoMessages({
                      platform: 'douyin',
                      staticUrl: imageItem.url_list?.[0] || imageItem.url_list?.[2] || imageItem.url_list?.[1],
                      liveVideoUrl: getDouyinLiveVideoUrl(imageItem),
                      index,
                      headers: {
                        ...this.headers,
                        Referer: 'https://www.douyin.com/',
                        Cookie: ''
                      },
                      bgmPath: liveimgbgm?.filepath,
                      mergeMode,
                      context: bgmContext,
                      loopCount: imageItem.clip_type === 4 ? 1 : 3
                    })
                    bgmContext = livePhoto.context || bgmContext
                    temp.push(...livePhoto.tempFiles)
                    hasGeneratedLivePhoto = hasGeneratedLivePhoto || livePhoto.generatedLivePhoto

                    if (livePhoto.messages.length > 0) {
                      processedImages.push(...livePhoto.messages)
                    } else if (imageItem.url_list?.[0]) {
                      const imageUrl = await processImageUrl(imageItem.url_list[0], g_title, index, {
                        Referer: 'https://www.douyin.com/',
                        Cookie: Config.cookies.douyin || ''
                      })
                      processedImages.push(segment.image(imageUrl))
                    }
                  }

                  if (hasGeneratedLivePhoto) processedImages.push(await buildLivePhotoTipMessage())
                  try {
                    await this.e.reply(await common.makeForwardMsg(this.e, processedImages, '图集内容'))
                  } finally {
                    for (const item of temp) await Common.removeFile(item.filepath, true)
                  }
                  this.hasProcessedLiveImage = true
                  break
                }

                for (const [index, imageItem] of images.entries()) {
                  // 获取图片地址，优先使用第三个URL，其次使用第二个URL
                  image_url = imageItem.url_list[2] || imageItem.url_list[1] || ''

                  // 处理标题，去除特殊字符
                  const processedImageUrl = await processImageUrl(image_url, title, index, {
                    Referer: 'https://www.douyin.com/',
                    Cookie: Config.cookies.douyin || ''
                  })
                  imageres.push(segment.image(processedImageUrl))
                  imagenum++

                  if (Config.app.removeCache === false) {
                    Common.mkdir(`${Common.tempDri.images}${g_title}`)
                    const path = `${Common.tempDri.images}${g_title}/${index + 1}.png`
                    await new Networks({ url: image_url, type: 'arraybuffer' }).getData<Buffer>().then((data) => fs.promises.writeFile(path, data))
                  }
                }
                const res = common.makeForwardMsg(this.e, imageres, '解析完的图集图片')
                image_data.push(res)
                image_res.push(image_data)
                if (imageres.length === 1) {
                  await this.e.reply(segment.image(await processImageUrl(image_url, g_title, 0, {
                    Referer: 'https://www.douyin.com/',
                    Cookie: Config.cookies.douyin || ''
                  })))
                } else {
                  await this.e.reply(res)
                }
                break
              }
              // 合辑
              case VideoData.data.aweme_detail.is_slides === true && VideoData.data.aweme_detail.images !== null: {
                const images = []
                const temp = []
                let hasGeneratedLivePhoto = false
                let bgmContext
                const mergeMode = Config.douyin.liveImageMergeMode || 'independent'
                const musicUrl = getDouyinMusicUrl(VideoData.data.aweme_detail.music)
                const liveimgbgm = musicUrl
                  ? await downloadFile(musicUrl, {
                    title: `Douyin_tmp_A_${Date.now()}.mp3`,
                    headers: {
                      ...this.headers,
                      Referer: 'https://www.douyin.com/',
                      Cookie: ''
                    }
                  })
                  : null
                if (liveimgbgm?.filepath) temp.push(liveimgbgm)

                const images1 = VideoData.data.aweme_detail.images || []
                if (!images1.length) {
                  logger.debug('未获取到合辑的图片数据')
                }
                g_title = VideoData.data.aweme_detail.preview_title?.substring(0, 50).replace(/[\\/:*?"<>|\r\n]/g, ' ') || '抖音图集'
                for (const [index, item] of images1.entries()) {
                  imagenum++
                  // 静态图片，clip_type为2或undefined
                  if (item.clip_type === 2 || item.clip_type === undefined) {
                    if (item.url_list[0]) {
                      const processedImageUrl = await processImageUrl(item.url_list[0], VideoData.data.aweme_detail.preview_title || '抖音图集', imagenum, {
                        Referer: 'https://www.douyin.com/',
                        Cookie: Config.cookies.douyin || ''
                      })
                      images.push(segment.image(processedImageUrl))
                    }
                    continue
                  }

                  const livePhoto = await buildLivePhotoMessages({
                    platform: 'douyin',
                    staticUrl: item.url_list?.[0] || item.url_list?.[2] || item.url_list?.[1],
                    liveVideoUrl: getDouyinLiveVideoUrl(item),
                    index,
                    headers: {
                      ...this.headers,
                      Referer: 'https://www.douyin.com/',
                      Cookie: ''
                    },
                    bgmPath: liveimgbgm?.filepath,
                    mergeMode,
                    context: bgmContext,
                    loopCount: item.clip_type === 4 ? 1 : 3
                  })
                  bgmContext = livePhoto.context || bgmContext
                  temp.push(...livePhoto.tempFiles)
                  hasGeneratedLivePhoto = hasGeneratedLivePhoto || livePhoto.generatedLivePhoto

                  if (livePhoto.messages.length > 0) {
                    images.push(...livePhoto.messages)
                  } else if (item.url_list?.[0]) {
                    const imageUrl = await processImageUrl(item.url_list[0], g_title, index, {
                      Referer: 'https://www.douyin.com/',
                      Cookie: Config.cookies.douyin || ''
                    })
                    images.push(segment.image(imageUrl))
                  }
                }
                if (hasGeneratedLivePhoto) images.push(await buildLivePhotoTipMessage())
                const Element = common.makeForwardMsg(this.e, images, '合辑内容')
                try {
                  await this.e.reply(Element)
                } catch (error) {
                  logger.error(error)
                } finally {
                  for (const item of temp) {
                    await Common.removeFile(item.filepath, true)
                  }
                }
                this.hasProcessedLiveImage = true
                break
              }
            }
          }

          /** 背景音乐 */
          if (!isArticle && VideoData.data.aweme_detail.music && hasDouyinContent('背景音乐') && !this.hasProcessedLiveImage) {
            const music = VideoData.data.aweme_detail.music
            const music_url = getDouyinMusicUrl(music) // BGM link
            if (this.is_mp4 === false && Config.app.removeCache === false && music_url !== undefined) {
              try {
                const path = Common.tempDri.images + `${g_title}/BGM.mp3`
                await new Networks({ url: music_url, type: 'arraybuffer' }).getData<Buffer>().then((data) => fs.promises.writeFile(path, data))
              } catch (error) {
                logger.error(error)
              }
            }
            const haspath = music_url && this.is_mp4 === false && music_url !== undefined
            if (haspath) {
              await this.e.reply(await UploadRecord(getUploadRecordEvent(this.e), music_url, 0, !Config.douyin.sendHDrecord))
            }
          }

          /** 视频 */
          let FPS
          const sendvideofile = true
          let video = null
          let cover = ''
          if (isVideo) {
            // 视频地址特殊判断：play_addr_h264、play_addr、
            video = VideoData.data.aweme_detail.video
            FPS = video.bit_rate[0]?.FPS || '获取失败' // FPS
            if (Config.douyin.autoResolution) {
              logger.debug(`开始排除不符合条件的视频分辨率；\n
              共拥有${logger.yellow(video.bit_rate.length)}个视频源\n
              视频ID：${logger.green(VideoData.data.aweme_detail.aweme_id)}\n
              分享链接：${logger.green(VideoData.data.aweme_detail.share_url)}
              `)
              video.bit_rate = douyinProcessVideos(video.bit_rate, Config.upload.filelimit || 100)
              g_video_url = await new Networks({
                url: video.bit_rate[0].play_addr.url_list[2] || '',
                headers: {
                  ...this.headers,
                  Referer: video.bit_rate[0].play_addr.url_list[0] || '',
                  Cookie: ''
                }
              }).getLongLink()
            } else {
              g_video_url = await new Networks({
                url: video.play_addr_h264.url_list[2] || '',
                headers: {
                  ...this.headers,
                  Referer: video.play_addr_h264.url_list[0] || video.play_addr_h264.url_list[0],
                  Cookie: ''
                }
              }).getLongLink()
            }
            cover = getFirstUrl(video.animated_cover) || getFirstUrl(video.dynamic_cover) || getFirstUrl(video.cover_original_scale) || getFirstUrl(video.cover) || getFirstUrl(video.origin_cover)

            const title = VideoData.data.aweme_detail.preview_title.substring(0, 80).replace(/[\\/:*?"<>|\r\n]/g, ' ') // video title
            g_title = title
            mp4size = (video.bit_rate[0].play_addr.data_size / (1024 * 1024)).toFixed(2)
            logger.info('视频地址', `https://aweme.snssdk.com/aweme/v1/play/?video_id=${VideoData.data.aweme_detail.video.play_addr.uri}&ratio=1080p&line=0`)
          }

          const sendVideoInfo = isVideo && hasDouyinContent('视频', 'info')
            ? async (): Promise<void> => {
              const aweme = VideoData.data.aweme_detail
              const statistics = aweme.statistics || {}
              const displayContent: string[] = Config.douyin.displayContent || ['cover', 'title', 'author', 'stats']
              if (Config.douyin.videoInfoMode === 'text') {
                const processedCover = await processImageUrl(cover, aweme.desc || g_title || '抖音视频封面', 0, {
                  Referer: 'https://www.douyin.com/',
                  Cookie: Config.cookies.douyin || ''
                })
                const contentMap = {
                  cover: segment.image(processedCover),
                  title: `\n标题：${aweme.desc || g_title}\n`,
                  author: `\n作者：${aweme.author?.nickname || '无法获取'}\n`,
                  stats: formatVideoStats(statistics)
                }
                const replyContent = []
                for (const item of Object.keys(contentMap) as Array<keyof typeof contentMap>) {
                  if (displayContent.includes(item) && contentMap[item]) replyContent.push(contentMap[item])
                }
                if (replyContent.length) await this.e.reply(replyContent)
              } else {
                let userProfile: DouyinUser | undefined
                try {
                  const userProfileData = narrowApiResponse<UserInfoResponse>(await this.amagi.getDouyinData('用户主页数据', {
                    sec_uid: aweme.author.sec_uid,
                    typeMode: 'strict'
                  }), '用户主页数据')
                  userProfile = userProfileData.data.user
                } catch (error) {
                  logger.warn('[抖音] 获取作者主页信息失败，继续渲染视频信息图', error)
                }
                let userProfileView
                if (userProfile) {
                  userProfileView = {
                    ip_location: userProfile.ip_location,
                    follower_count: Common.count(userProfile.follower_count),
                    total_favorited: Common.count(userProfile.total_favorited),
                    aweme_count: Common.count(userProfile.aweme_count)
                  }
                }
                let musicInfo
                if (aweme.music) {
                  musicInfo = {
                    author: aweme.music.author,
                    title: aweme.music.title,
                    cover: getFirstUrl(aweme.music.cover_hd) || getFirstUrl(aweme.music.cover_large) || getFirstUrl(aweme.music.cover_thumb)
                  }
                }
                let videoInfo
                if (video) {
                  videoInfo = {
                    duration: formatVideoDuration(video.duration),
                    width: video.width,
                    height: video.height,
                    ratio: video.ratio
                  }
                }
                const videoInfoImg = await Render('douyin/videoInfo', {
                  desc: aweme.desc || g_title,
                  aweme_id: aweme.aweme_id,
                  share_url: aweme.share_url,
                  image_url: cover,
                  create_time: Common.convertTimestampToDateTime(aweme.create_time),
                  showCover: displayContent.includes('cover'),
                  showTitle: displayContent.includes('title'),
                  showAuthor: displayContent.includes('author'),
                  showStats: displayContent.includes('stats'),
                  statistics: {
                    digg_count: Common.count(statistics.digg_count),
                    comment_count: Common.count(statistics.comment_count),
                    collect_count: Common.count(statistics.collect_count),
                    share_count: Common.count(statistics.share_count),
                    recommend_count: Common.count(statistics.recommend_count)
                  },
                  author: {
                    name: aweme.author?.nickname || '无法获取',
                    avatar: getFirstUrl(aweme.author?.avatar_thumb) || getFirstUrl(aweme.author?.avatar_larger),
                    short_id: aweme.author?.unique_id || aweme.author?.short_id || '无法获取'
                  },
                  user_profile: userProfileView,
                  music: musicInfo,
                  video: videoInfo
                })
                await this.e.reply(videoInfoImg)
              }
            }
            : undefined

          /** 发送视频 */
          const sendVideo = isVideo && hasDouyinContent('视频', 'video') && sendvideofile
            ? async (): Promise<void> => {
              let danmakuList: DanmakuList = []
              const sendOriginalVideo = async (): Promise<void> => {
                await downloadVideo(
                  this.e,
                  {
                    video_url: g_video_url,
                    title: {
                      timestampTitle: `tmp_${Date.now()}.mp4`,
                      originTitle: `${g_title}.mp4`
                    },
                    headers: {
                      ...baseHeaders,
                      Referer: g_video_url,
                      Cookies: ''
                    }
                  },
                  {
                    message_id: this.e.message_id === undefined ? undefined : String(this.e.message_id)
                  }
                )
              }

              if (this.forceBurnDanmaku || Config.douyin.burnDanmaku) {
                try {
                  const danmakuData = narrowApiResponse<DanmakuResponse>(await this.amagi.getDouyinData('弹幕数据', {
                    aweme_id: data.aweme_id,
                    duration: video?.duration || 0,
                    typeMode: 'strict'
                  }), '弹幕数据')
                  danmakuList = danmakuData?.data?.danmaku_list || danmakuData?.danmaku_list || []
                  logger.debug(`[抖音] 获取到 ${danmakuList.length} 条弹幕`)
                } catch (error) {
                  logger.warn('[抖音] 获取弹幕失败，将发送原视频', error)
                }
              }

              if ((this.forceBurnDanmaku || Config.douyin.burnDanmaku) && danmakuList.length > 0) {
                let downloadedVideoPath: string | undefined
                let resultPath: string | undefined
                try {
                  const videoFile = await downloadFile(g_video_url, {
                    title: `Douyin_V_tmp_${Date.now()}.mp4`,
                    headers: {
                      ...baseHeaders,
                      Referer: 'https://www.douyin.com'
                    }
                  })
                  downloadedVideoPath = videoFile.filepath
                  if (downloadedVideoPath) {
                    resultPath = Common.tempDri.video + `Douyin_Danmaku_${Date.now()}.mp4`
                    const emojiList = await getEmojiList()
                    const burnSucceeded = await burnDouyinDanmaku(downloadedVideoPath, danmakuList, resultPath, {
                      danmakuArea: Config.douyin.danmakuArea,
                      verticalMode: Config.douyin.verticalMode,
                      videoCodec: Config.douyin.videoCodec,
                      danmakuFontSize: Config.douyin.danmakuFontSize,
                      danmakuOpacity: Config.douyin.danmakuOpacity,
                      emojiList
                    })
                    if (burnSucceeded) {
                      const size = await Common.getVideoFileSize(resultPath)
                      await uploadFile(this.e, { filepath: resultPath, totalBytes: size, originTitle: g_title }, '')
                      return
                    }
                  }
                } catch (error) {
                  logger.warn('[抖音] 弹幕视频处理失败，将发送原视频', error)
                } finally {
                  if (downloadedVideoPath) await Common.removeFile(downloadedVideoPath, true)
                }
                if (resultPath) await Common.removeFile(resultPath, true)
                await sendOriginalVideo()
              } else {
                await sendOriginalVideo()
              }
            }
            : undefined

          await runMediaTasks({
            poster: sendVideoInfo,
            video: sendVideo
          }, {
            onTaskFailure: ({ task, error }) => {
              const taskLabel = task === 'poster' ? '视频信息海报/回复' : '视频下载、弹幕烧录与发送'
              logger.error(`[抖音] ${taskLabel}任务失败`, error)
            }
          })

          if (isArticle) {
            await this.handleArticleWork(VideoData)
          }

          if (hasDouyinContent('评论图', 'comment')) {
            const list = await getEmojiList()
            const commentsArray = await douyinComments(CommentsData, list)
            if (!commentsArray || Array.isArray(commentsArray) || !commentsArray.jsonArray?.length) {
              await this.e.reply('这个作品没有评论 ~')
            } else {
              const img = await Render('douyin/comment',
                {
                  Type: isArticle ? '文章' : isVideo ? '视频' : this.is_slides ? '合辑' : '图集',
                  CommentsData: commentsArray,
                  CommentLength: Config.douyin.realCommentCount ? VideoData.data.aweme_detail.statistics.comment_count : commentsArray.jsonArray?.length ?? 0,
                  share_url: this.is_mp4
                    ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${VideoData.data.aweme_detail.video.play_addr.uri}&ratio=1080p&line=0`
                    : VideoData.data.aweme_detail.share_url,
                  Title: g_title,
                  VideoSize: mp4size,
                  VideoFPS: FPS,
                  ImageLength: imagenum
                }
              )
              await this.e.reply(img)
            }
          }
          return true
        }

        case 'user_dynamic': {
          const UserVideoListData = narrowApiResponse<UserVideoListResponse>(await this.amagi.getDouyinData('用户主页视频列表数据', {
            sec_uid: data.sec_uid,
            typeMode: 'strict'
          }), '用户主页视频列表数据')
          const UserInfoData = narrowApiResponse<UserInfoResponse>(await this.amagi.getDouyinData('用户主页数据', {
            sec_uid: data.sec_uid,
            typeMode: 'strict'
          }), '用户主页数据')

          const awemeList = UserVideoListData?.data?.aweme_list || UserVideoListData?.aweme_list || []
          const user = UserInfoData.data.user
          const timeoutSeconds = 120
          const displayVideos = awemeList.slice(0, 16).map((aweme, index) => {
            const isVideo = isDouyinVideo(aweme)
            return {
              aweme_id: aweme.aweme_id,
              index: index + 1,
              title: aweme.desc || aweme.item_title || '无标题',
              cover: getDouyinWorkCoverUrl(aweme),
              duration: aweme.video?.duration || 0,
              create_time: Common.convertTimestampToDateTime(aweme.create_time),
              is_top: aweme.is_top === 1,
              is_video: isVideo,
              type_text: isVideo ? '视频' : isDouyinArticle(aweme) ? '文章' : '图集',
              statistics: {
                like_count: Common.count(aweme.statistics?.digg_count),
                comment_count: Common.count(aweme.statistics?.comment_count),
                share_count: Common.count(aweme.statistics?.share_count),
                collect_count: Common.count(aweme.statistics?.collect_count)
              },
              music: aweme.music
                ? { title: aweme.music.title || '', author: aweme.music.author || '' }
                : undefined
            }
          })

          const img = await Render('douyin/user_profile', {
            user: {
              head_image: user.cover_and_head_image_info?.profile_cover_list?.[0]?.cover_url?.url_list?.[0] || '',
              nickname: user.nickname || '未知用户',
              short_id: user.unique_id || user.short_id || '无法获取',
              avatar: user.avatar_larger?.url_list?.[0] || user.avatar_thumb?.url_list?.[0] || '',
              signature: user.signature || '这个用户很懒，还没有签名',
              follower_count: Common.count(user.follower_count),
              following_count: Common.count(user.following_count),
              total_favorited: Common.count(user.total_favorited),
              verified: Boolean(user.custom_verify || user.enterprise_verify_reason),
              ip_location: user.ip_location || ''
            },
            videos: displayVideos,
            timeoutSeconds
          })
          img && await this.e.reply(img)
          if (!displayVideos.length) return true
          return {
            type: 'douyin_user_selection',
            timeoutSeconds,
            videos: displayVideos.map(item => ({
              aweme_id: item.aweme_id,
              title: item.title,
              index: item.index
            }))
          }
        }
        case 'music_work': {
          const MusicData = narrowApiResponse<MusicResponse>(await this.amagi.getDouyinData('音乐数据', {
            music_id: data.music_id,
            typeMode: 'strict'
          }), '音乐数据')
          const sec_uid = MusicData.data.music_info.sec_uid
          const UserData = narrowApiResponse<UserInfoResponse>(await this.amagi.getDouyinData('用户主页数据', { sec_uid, typeMode: 'strict' }), '用户主页数据')
          // if (userdata.status_code === 2) {
          //   const new_userdata = await getDouyinData('搜索数据', { query: data.music_info.author })
          //   if (new_userdata.data[0].type === 4 && new_userdata.data[0].card_unique_name === 'user') {
          //     userdata = { user: new_userdata.data[0].user_list[0].user_info }
          //   }
          //   const search_data = new_userdata
          // }
          if (!MusicData.data.music_info.play_url) {
            await this.e.reply('解析错误！该音乐抖音未提供下载链接，无法下载', { reply: true })
            return true
          }
          img = await Render('douyin/musicinfo',
            {
              image_url: MusicData.data.music_info.cover_hd.url_list[0],
              desc: MusicData.data.music_info.title,
              music_id: MusicData.data.music_info.id,
              create_time: Time(0),
              user_count: Common.count(MusicData.data.music_info.user_count),
              avater_url: MusicData.data.music_info.avatar_large?.url_list[0] || UserData.data.user.avatar_larger.url_list[0],
              fans: UserData.data.user.mplatform_followers_count || UserData.data.user.follower_count,
              following_count: UserData.data.user.following_count,
              total_favorited: UserData.data.user.total_favorited,
              user_shortid: UserData.data.user.unique_id === '' ? UserData.data.user.short_id : UserData.data.user.unique_id,
              share_url: MusicData.data.music_info.play_url.uri,
              username: MusicData.data.music_info?.original_musician_display_name || MusicData.data.music_info.owner_nickname === '' ? MusicData.data.music_info.author : MusicData.data.music_info.owner_nickname
            }
          )
          if (!img) return false
          await this.e.reply(
            this.mkMsg(
              [
                ...img,
                `\n正在上传 ${MusicData.data.music_info.title}\n`,
                `作曲: ${MusicData.data.music_info.original_musician_display_name || MusicData.data.music_info.owner_nickname === '' ? MusicData.data.music_info.author : MusicData.data.music_info.owner_nickname}\n`,
                `music_id: ${MusicData.data.music_info.id}\n`,
                `BGM_Id: ${data.music_id}`
              ],
              [{ text: '音乐文件', link: MusicData.data.music_info.play_url.uri }]
            )
          )
          await this.e.reply(await UploadRecord(getUploadRecordEvent(this.e), MusicData.data.music_info.play_url.uri || '', 0, !Config.douyin.sendHDrecord))
          return true
        }
        case 'live_room_detail': {
          const UserInfoData = narrowApiResponse<UserInfoResponse>(await this.amagi.getDouyinData('用户主页数据', {
            sec_uid: data.sec_uid,
            typeMode: 'strict'
          }), '用户主页数据')
          if (UserInfoData.data.user.live_status === 1) {
            // 直播中
            const liveData = narrowApiResponse<LiveResponse>(await this.amagi.getDouyinData('直播间信息数据', { sec_uid: UserInfoData.data.user.sec_uid, typeMode: 'strict' }), '直播间信息数据')
            const { items: liveItems, partition } = getLivePayload(liveData)
            const liveItem = liveItems[0]
            if (!liveItem) throw new Error('直播间信息数据返回格式异常')
            const roomData = narrowApiResponse<RoomData>(JSON.parse(UserInfoData.data.user.room_data || '{}'), '直播间房间数据')
            const img = await Render('douyin/live',
              {
                image_url: [{ image_src: liveItem.cover?.url_list?.[0] }],
                text: liveItem.title,
                liveinf: `${partition.partition?.title || liveItem.title || ''} | 房间号: ${roomData.owner?.web_rid || ''}`,
                在线观众: Common.count(Number(liveItem.room_view_stats?.display_value)),
                总观看次数: Common.count(Number(liveItem.stats?.total_user_str)),
                username: UserInfoData.data.user.nickname,
                avater_url: UserInfoData.data.user.avatar_larger.url_list[0],
                fans: Common.count(UserInfoData.data.user.follower_count),
                create_time: Common.convertTimestampToDateTime(new Date().getTime()),
                now_time: Common.convertTimestampToDateTime(new Date().getTime()),
                share_url: 'https://live.douyin.com/' + (roomData.owner?.web_rid || ''),
                dynamicTYPE: '直播间信息'
              }
            )
            await this.e.reply(img)
          } else {
            await this.e.reply(`「${UserInfoData.data.user.nickname}」\n未开播，正在休息中~`)
          }
          return true
        }
        default:
          break
      }
    } catch (e) {
      logger.warn(`抖音解析错误：${e}`)
      return false
    }
  }
}

/**
 * 处理抖音视频数据，根据大小限制筛选合适的视频
 * @param {dyVideo[]} videos - 视频数组
 * @param {number} filelimit - 文件大小限制(MB)
 * @returns {dyVideo[]} 处理后的视频数组，只包含一个最合适的视频
 */
export const douyinProcessVideos = (videos: DyVideo[], filelimit: number): [DyVideo] => {
  const sizeLimitBytes = filelimit * 1024 * 1024 // 将 MB 转换为字节
  logger.debug(videos)
  // 过滤掉 format 为 'dash' 的视频，并且过滤出小于等于大小限制的视频
  const validVideos = videos.filter(video => video.format !== 'dash' && video.play_addr.data_size <= sizeLimitBytes)

  if (validVideos.length > 0) {
    // 如果有符合条件的视频，找到 data_size 最大的视频
    return [validVideos.reduce((maxVideo, currentVideo) => {
      return currentVideo.play_addr.data_size > maxVideo.play_addr.data_size ? currentVideo : maxVideo
    })]
  } else {
    // 如果没有符合条件的视频，返回 data_size 最小的那个视频（排除 'dash' 格式）
    const allValidVideos = videos.filter(video => video.format !== 'dash')
    return [allValidVideos.reduce((minVideo, currentVideo) => {
      return currentVideo.play_addr.data_size < minVideo.play_addr.data_size ? currentVideo : minVideo
    })]
  }
}

/**
 * 传递整数，返回x小时后的时间
 * @param {number} delay - 延迟的小时数
 * @returns {string} - 返回格式化后的时间字符串
 */
function Time (delay: number): string {
  const currentDate = new Date()
  currentDate.setHours(currentDate.getHours() + delay)

  const year = currentDate.getFullYear().toString()
  const month = (currentDate.getMonth() + 1).toString()
  const day = String(currentDate.getDate()).padStart(2, '0')
  const hours = String(currentDate.getHours()).padStart(2, '0')
  const minutes = String(currentDate.getMinutes()).padStart(2, '0')
  const seconds = String(currentDate.getSeconds()).padStart(2, '0')

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
}

/**
 * 处理抖音表情数据
 * @param {import('@ikenxuan/amagi').DyEmojiList} data 表情数据对象
 * @returns {Array<{name: string, url: string | undefined}>} 处理后的表情数组,包含name和url属性
 */
export const Emoji = (data: DyEmojiList): Array<{ name: string, url: string | undefined }> => {
  const ListArray: Array<{ name: string, url: string | undefined }> = []

  for (const i of data.emoji_list) {
    const display_name = i.display_name
    const url = i.emoji_url.url_list[0]

    const Objject = {
      name: display_name,
      url
    }
    ListArray.push(Objject)
  }
  return ListArray
}
