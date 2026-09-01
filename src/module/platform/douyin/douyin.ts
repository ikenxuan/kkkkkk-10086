import { Base, Config, UploadRecord, Networks, Render, Common, downloadFile, downloadVideo, uploadFile, baseHeaders, processImageUrl, sanitizeFilenameSegment } from '@/module/utils/index'
import { buildAmagiRequestConfig } from '@/module/utils/amagiClient'
import { runMediaTasks } from '@/module/utils/MediaTasks'
import { fromMilliseconds, reportMedia } from '@/module/utils/media-metrics'
import common from '@/runtime/host/common'
import { burnDouyinDanmaku, type DouyinEmojiInfo } from './danmaku.js'
import { buildLivePhotoMessagesBatch, buildLivePhotoTipMessage } from '@/module/platform/common/livePhoto'
import type { LivePhotoBatchItem } from '@/module/platform/common/types'
import { douyinCommentLimit } from '@/module/platform/common/commentLimit'
import { douyinComments } from './index.js'
import { renderWorkImage } from './render.js'
import { buildDouyinLivePayload } from './live.js'
import { resolveDouyinLiveRoom } from './live-room.js'
import { getDouyinLiveVideoUrl, getDouyinWorkCoverUrl, isDouyinArticle, isDouyinVideo } from './workType.js'
import { buildDouyinPlayUrl, douyinProcessVideos } from './videoQuality.js'
import type { DouyinDataType } from './getid.js'
import type { DouyinLiveRoomOptions, DouyinUserOptions, DyEmojiList } from '@ikenxuan/amagi'
import fs from 'fs'
import { at, firstUrl, isRecord } from '@/module/utils/record'
import type { CommentsPayload, DanmakuList, DanmakuResponse, DouyinAweme, DouyinConstructorData, DouyinEvent, DouyinMusic, DouyinResourceType, DouyinRuntimeEvent, DouyinUser, DyVideo, EmojiResponse, LegacyContent, ModernContent, MusicResponse, NullableWorkResponse, UploadRecordEvent, UserInfoResponse, UserVideoListResponse, WorkResponse } from './types.js'

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

/**
 * 从 play_addr 里挑真正能下载的视频直链。
 *
 * url_list[2] 是 www.douyin.com/aweme/v1/play 的包装 URL，会按抖音负载均衡 302 到任意 CDN，
 * 部分 CDN（如 cjjd14.com、n98-v-ncdnon）返回非 MP4 乱码字节 —— 下下来的文件放不出来。
 * 所以优先取 url_list[0] 的签名直链绕开这层跳转，拿不到再按下标往后退。
 * 之前这里取的是 [2] 并且还用 getLongLink 主动跟随那个 302，等于把落到坏 CDN 的概率全吃下来。
 */
export const pickDouyinPlayUrl = (playAddr?: { url_list?: string[] }): string =>
  playAddr?.url_list?.[0] || playAddr?.url_list?.[1] || playAddr?.url_list?.[2] || ''

/**
 * 把 play_addr 的宽高折成评论图页头那行「分辨率」。
 *
 * 传的必须是**选中那一路**的 play_addr：抖音每个档位各带自己的宽高，
 * 拿顶层 `video.play_addr` 或 `bit_rate[0]` 会和实际下载的那一路对不上。
 * @param playAddr - 选中那一路的 play_addr
 * @returns 形如 `1080 x 1920`；宽高缺任意一边时返回 null，让模板整行不印
 */
const formatResolution = (playAddr?: { width?: number, height?: number }): string | null => {
  const { width, height } = playAddr ?? {}
  if (!width || !height) return null
  return `${width} x ${height}`
}

/**
 * 把 play_addr 的字节数折成评论图页头那行「视频大小」。
 *
 * 接口给的多路 play_addr 里任意一路都可能缺 `data_size`，所以按
 * 「选中那一路 -> h264 -> 顶层默认档」的顺序退，取到第一个正数就用它。
 *
 * 全都取不到时返回 `'0.00'` 而不是空串或 undefined：契约里 `VideoSize` 是
 * 可选 string，但模板那句 `{props.VideoSize}MB` 没有守卫，空串/undefined 会印出
 * 光秃秃的「MB」，看着像渲染坏了。`'0.00'` 也是同仓 B站 侧对「探不到体积」的既有取值
 * （`bilibili.ts` 的 `(playUrlStream?.size || 0)`），两个平台的卡片对同一种失败
 * 说同一句话比各自发明一个更好。
 *
 * @param addrs - 按优先级排好的 play_addr 候选，允许其中任意一项不存在
 * @returns 保留两位小数的 MB 数字串
 */
const formatVideoSize = (...addrs: Array<{ data_size?: number } | undefined>): string => {
  for (const addr of addrs) {
    const size = Number(addr?.data_size)
    if (Number.isFinite(size) && size > 0) return (size / (1024 * 1024)).toFixed(2)
  }
  return '0.00'
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
          const VideoResponse = narrowApiResponse<NullableWorkResponse>(await this.amagi.douyin.parseWork({
            aweme_id: data.aweme_id ?? '',
            typeMode: 'strict'
          }, Config.cookies.douyin, buildAmagiRequestConfig()), '作品详情')
          if (VideoResponse.data.aweme_detail === null) {
            throw new Error('获取作品详情失败，可能是因为该作品已被删除或设置为私密。')
          }
          const VideoData: WorkResponse = { data: { aweme_detail: VideoResponse.data.aweme_detail } }
          const isArticle = isDouyinArticle(VideoData.data.aweme_detail)
          const isVideo = isDouyinVideo(VideoData.data.aweme_detail)
          if (typeof this.is_mp4 !== 'boolean') this.is_mp4 = isVideo
          let emojiListPromise: Promise<DouyinEmojiInfo[]> | undefined
          const getEmojiList = (): Promise<DouyinEmojiInfo[]> => {
            emojiListPromise ??= (async () => {
              try {
                const emojiData = narrowApiResponse<EmojiResponse>(
                  await this.amagi.douyin.fetchEmojiList({ typeMode: 'strict' }, Config.cookies.douyin, buildAmagiRequestConfig()),
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
          /**
           * 下载候选清单，顺序即优先级。
           *
           * `orderCdnCandidates` 刻意保留调用方给的顺序（只把近期失败过的主机往后挪），
           * 所以这里排第几就是第几个被试。签名直链在前、拼出来的 snssdk 地址垫最后。
           */
          let g_video_candidates: string[] = []
          let g_title: string | undefined
          /** 按画质配置选中、即将下载发送的那一路视频源，卡片上的清晰度从它派生 */
          let selectedVideo: DyVideo | undefined

          let imagenum = 0
          const image_res = []
          if (!isVideo && !isArticle && hasDouyinContent('图集')) {
            switch (true) {
              // 图集
              case this.is_slides === false && VideoData.data.aweme_detail.images !== null: {
                const image_data = []
                const imageres = []
                let image_url = ''
                const images = VideoData.data.aweme_detail.images || []
                const hasLiveImage = images.some(item => (item.clip_type ?? 2) !== 2)
                const title = sanitizeFilenameSegment(VideoData.data.aweme_detail.preview_title, 50, '抖音图集')
                g_title = title

                if (hasLiveImage) {
                  const processedImages = []
                  const temp = []
                  let hasGeneratedLivePhoto = false
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

                  // 静态图的位置传空条目，让结果和 images 逐位对齐；
                  // 连续 BGM 模式的 context 链由批量入口在内部按序串下去。
                  const livePhotoItems: LivePhotoBatchItem[] = images.map(imageItem => {
                    if (imageItem.clip_type === 2 || imageItem.clip_type === undefined) return {}
                    return {
                      staticUrl: imageItem.url_list?.[0] || imageItem.url_list?.[2] || imageItem.url_list?.[1],
                      liveVideoUrl: getDouyinLiveVideoUrl(imageItem),
                      loopCount: imageItem.clip_type === 4 ? 1 : 3
                    }
                  })
                  const livePhotoBatch = await buildLivePhotoMessagesBatch(livePhotoItems, {
                    platform: 'douyin',
                    headers: {
                      ...this.headers,
                      Referer: 'https://www.douyin.com/',
                      Cookie: ''
                    },
                    bgmPath: liveimgbgm?.filepath,
                    mergeMode
                  })
                  temp.push(...livePhotoBatch.tempFiles)
                  hasGeneratedLivePhoto = livePhotoBatch.generatedLivePhoto

                  for (const [index, imageItem] of images.entries()) {
                    imagenum++
                    const livePhoto = livePhotoBatch.results[index]
                    if (livePhoto !== undefined && livePhoto.messages.length > 0) {
                      processedImages.push(...livePhoto.messages)
                      continue
                    }

                    // 静态图和「实况图失败后的回退」挑的 url_list 下标不一样
                    // （静态图优先 [2]，实况图回退只认 [0]），这个区分不能合并掉。
                    if (imageItem.clip_type === 2 || imageItem.clip_type === undefined) {
                      image_url = imageItem.url_list?.[2] || imageItem.url_list?.[1] || imageItem.url_list?.[0] || ''
                      const processedImageUrl = await processImageUrl(image_url, g_title, index, {
                        Referer: 'https://www.douyin.com/',
                        Cookie: Config.cookies.douyin || ''
                      })
                      processedImages.push(segment.image(processedImageUrl))
                      continue
                    }

                    if (imageItem.url_list?.[0]) {
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
                  // 同文件上方 `:257`/`:286` 两处同字段早就写的是 `url_list?.[2]`，
                  // 只有这条漏了；`url_list` 整条缺失时它自己就是崩点。
                  image_url = at(imageItem.url_list, 2) || at(imageItem.url_list, 1) || ''

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
                g_title = sanitizeFilenameSegment(VideoData.data.aweme_detail.preview_title, 50, '抖音图集')

                const mixLivePhotoItems: LivePhotoBatchItem[] = images1.map(item => {
                  if (item.clip_type === 2 || item.clip_type === undefined) return {}
                  return {
                    staticUrl: item.url_list?.[0] || item.url_list?.[2] || item.url_list?.[1],
                    liveVideoUrl: getDouyinLiveVideoUrl(item),
                    loopCount: item.clip_type === 4 ? 1 : 3
                  }
                })
                const mixLivePhotoBatch = await buildLivePhotoMessagesBatch(mixLivePhotoItems, {
                  platform: 'douyin',
                  headers: {
                    ...this.headers,
                    Referer: 'https://www.douyin.com/',
                    Cookie: ''
                  },
                  bgmPath: liveimgbgm?.filepath,
                  mergeMode
                })
                temp.push(...mixLivePhotoBatch.tempFiles)
                hasGeneratedLivePhoto = mixLivePhotoBatch.generatedLivePhoto

                for (const [index, item] of images1.entries()) {
                  imagenum++
                  const livePhoto = mixLivePhotoBatch.results[index]
                  if (livePhoto !== undefined && livePhoto.messages.length > 0) {
                    images.push(...livePhoto.messages)
                    continue
                  }

                  if (item.clip_type === 2 || item.clip_type === undefined) {
                    // 这行原本是 `if (item.url_list[0])`，拿来当守卫的表达式自己会抛 ——
                    // 而紧邻的 `:411` 同字段写的就是 `url_list?.[0]`。
                    const staticUrl = at(item.url_list)
                    if (staticUrl) {
                      const processedImageUrl = await processImageUrl(staticUrl, VideoData.data.aweme_detail.preview_title || '抖音图集', imagenum, {
                        Referer: 'https://www.douyin.com/',
                        Cookie: Config.cookies.douyin || ''
                      })
                      images.push(segment.image(processedImageUrl))
                    }
                    continue
                  }

                  const liveFallbackUrl = at(item.url_list)
                  if (liveFallbackUrl) {
                    const imageUrl = await processImageUrl(liveFallbackUrl, g_title, index, {
                      Referer: 'https://www.douyin.com/',
                      Cookie: Config.cookies.douyin || ''
                    })
                    images.push(segment.image(imageUrl))
                  }
                }
                if (hasGeneratedLivePhoto) images.push(await buildLivePhotoTipMessage())
                try {
                  // 每张图都下载失败时 images 是空的，照发就是一条空合并转发，
                  // 用户只看到一个点不开的卡片。上游在这里改成记一条 warn 后跳过。
                  if (images.length === 0) {
                    logger.warn(`抖音合辑解析未生成可发送内容，aweme_id=${VideoData.data.aweme_detail.aweme_id}`)
                  } else {
                    await this.e.reply(common.makeForwardMsg(this.e, images, '合辑内容'))
                  }
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

          if (!isArticle && VideoData.data.aweme_detail.music && hasDouyinContent('背景音乐') && !this.hasProcessedLiveImage) {
            const music = VideoData.data.aweme_detail.music
            const music_url = getDouyinMusicUrl(music)
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

          let FPS: number | undefined
          /**
           * 视频体积，评论图页头那行「视频大小」。
           *
           * 必须留在 `one_work` 这一层：原来它是模块级 `let`，两条抖音解析并发时
           * 后进来的那条会把前一条的值覆盖掉，卡片上印出别人视频的体积。
           * 这个作用域同时罩住下面 `if (isVideo)` 里的唯一写入和 `sendComment`
           * 闭包里的唯一读取，所以挪进来不用改任何签名。
           */
          let mp4size = ''
          const sendvideofile = true
          let video = null
          let cover = ''
          if (isVideo) {
            video = VideoData.data.aweme_detail.video
            /*
              `bit_rate` 整条可能不下发（线上那条 `reading '0'` 就是它），所以先收成
              一个本地数组再用。三处消费（FPS、日志里的条数、传给 douyinProcessVideos）
              都读这个变量，不再各自去解 `video.bit_rate` —— 原来 FPS 那行排在最前面，
              它一抛就把视频、封面、评论三条支线一起带走，而后面两处「看起来安全」
              仅仅因为轮不到它们执行。
            */
            const bitRates = video.bit_rate ?? []
            // 契约里 VideoFPS 是 number；原来拿不到时给 '获取失败'，模板那句
            // `{props.VideoFPS}Hz` 没有守卫，会印成「获取失败Hz」
            FPS = Number(at(bitRates)?.FPS) || undefined
            // 一条源都没有时 `douyinProcessVideos` 会抛「接口没有返回任何视频源」，
            // 那是挑源函数的正常契约；但这条路径上我们还能退回顶层 play_addr_h264
            // 把视频发出去，所以空列表时干脆不进自动画质分支。
            if (Config.douyin.autoResolution && bitRates.length > 0) {
              logger.debug(`开始排除不符合条件的视频分辨率；\n
              共拥有${logger.yellow(bitRates.length)}个视频源\n
              视频ID：${logger.green(VideoData.data.aweme_detail.aweme_id)}\n
              分享链接：${logger.green(VideoData.data.aweme_detail.share_url)}
              `)
              /*
                先接进局部再回写。`douyinProcessVideos` 返回 `[T]`（单元素元组）、
                内部已保证非空，所以 `picked[0]` 是类型上真正的非空；而
                `video.bit_rate` 现在是可选数组，赋值后再读回来会把这份非空信息丢掉，
                逼出一句本不该有的可选链。
              */
              const picked = douyinProcessVideos(bitRates, {
                videoQuality: Config.douyin.videoQuality,
                maxAutoVideoSize: Config.douyin.maxAutoVideoSize,
                filelimit: Config.upload.filelimit || 100
              })
              video.bit_rate = picked
              selectedVideo = picked[0]
              g_video_url = pickDouyinPlayUrl(selectedVideo.play_addr)
            } else {
              g_video_url = pickDouyinPlayUrl(video.play_addr_h264)
            }
            /*
              候选清单 = 该 play_addr 的全部签名直链 + 垫在最后的 snssdk 兜底。

              前半段照抄 `pickDouyinPlayUrl` 的偏好顺序（[0] 优先），后半段是这次跟进
              上游新加的 `buildDouyinPlayUrl`。它**只能垫最后**：那个域名要先过一次抖音
              侧的负载均衡再 302，实测冷握手比签名直链多花 ~5.7s，而且 302 常落到
              返回非 MP4 字节的坏 CDN。放前面等于把这两样代价都吃下来。
            */
            const primaryAddr = selectedVideo?.play_addr ?? video.play_addr_h264
            g_video_candidates = [
              ...(primaryAddr?.url_list ?? []).filter(Boolean),
              buildDouyinPlayUrl(primaryAddr)
            ].filter(Boolean)
            cover = firstUrl(video.animated_cover) || firstUrl(video.dynamic_cover) || firstUrl(video.cover_original_scale) || firstUrl(video.cover) || firstUrl(video.origin_cover)

            const title = sanitizeFilenameSegment(VideoData.data.aweme_detail.preview_title, 80, '抖音视频')
            g_title = title
            /*
              这一行原来是 `video.bit_rate[0].play_addr.data_size` 裸取，而且它在
              `if (Config.douyin.autoResolution)` **之外** —— 关掉自动画质时
              `bit_rate` 没被 `douyinProcessVideos` 重写过，取的是接口原样下发的数组，
              整条缺失时当场抛，视频/封面/评论三条支线一起没了。

              取值顺序也跟着修正：优先选中那一路，其次真正要下载的 h264，
              最后才是接口给的第一条。原写法恒取 `[0]`，在自动画质退档后
              卡片上印的体积会比实际发出去的那条大。
            */
            mp4size = formatVideoSize(selectedVideo?.play_addr, video.play_addr_h264, at(bitRates)?.play_addr)
            // 打真正要下载的那条地址。原来印的是顶层 play_addr 拼的 snssdk 串，
            // 那条既不是实际下载的地址、也不是选中的档位，排查时会把人带偏。
            logger.info('视频地址', g_video_url)
          }

          // 上游这里只看 sendContent 是否含 'info'，不看作品类型（up douyin.ts:568）。
          // renderWorkImage() 是 douyin/image-work 与 douyin/article-work 的唯一入口，
          // 加上 `isVideo &&` 之后图集/合辑/文章就再也走不到它，整张作品信息图连带封面
          // 根本不生成 —— 这正是「非视频类型封面渲染不出来」的真因。
          const sendVideoInfo = hasDouyinContent('视频', 'info')
            ? async (): Promise<void> => {
              const aweme = VideoData.data.aweme_detail
              const statistics = aweme.statistics || {}
              const displayContent: string[] = Config.douyin.displayContent || ['cover', 'title', 'author', 'stats']
              if (Config.douyin.videoInfoMode === 'text') {
                // `cover` 声明在上方 `let cover = ''`，只在 `if (isVideo)` 里赋过值，
                // 图集/合辑/文章走到这里还是空串，segment.image('') 等于没有封面。
                // 按上游 up douyin.ts:573-577 的三分支各自取封面。
                const coverImageUrl = isArticle
                  ? firstUrl(aweme.video?.origin_cover)
                  : isVideo
                    ? cover
                    : firstUrl(at(aweme.images))
                const processedCover = await processImageUrl(coverImageUrl, aweme.desc || g_title || '抖音作品封面', 0, {
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
                  const userProfileData = narrowApiResponse<UserInfoResponse>(await this.amagi.douyin.fetchUserProfile({
                    sec_uid: aweme.author.sec_uid ?? '',
                    typeMode: 'strict'
                  }, Config.cookies.douyin, buildAmagiRequestConfig()), '用户主页数据')
                  userProfile = userProfileData.data.user
                } catch (error) {
                  logger.warn('[抖音] 获取作者主页信息失败，继续渲染视频信息图', error)
                }
                const workInfoImg = await renderWorkImage({
                  // 上游把 fetchUserProfile() 的整条响应原样挂在 user_info 上，这里已经取到
                  // .data.user 了，所以按模板契约再包回去，render.ts 才读得到主页的高清头像和粉丝数。
                  Detail_Data: userProfile ? { ...aweme, user_info: { data: { user: userProfile } } } : aweme,
                  create_time: aweme.create_time,
                  /*
                    页脚二维码：视频指向播放地址；非视频作品用不带追踪参数的规范短链，
                    免得二维码内容过长影响扫码识别（照搬上游 up douyin.ts:600-605）。

                    从**选中那一路**的 play_addr 拼，不用顶层 `video.play_addr`：顶层那份是
                    服务端默认档，而且旧写法带的 `ratio=1080p` 会让服务端按 ratio 重新给流，
                    等于把选好的档位覆盖掉 —— 扫码看到的和实际下载的不是同一条。
                    这也是上游 417ad3c 那条提交的主旨（「确保二维码与下载一致性」）。
                  */
                  shareLink: isVideo
                    ? buildDouyinPlayUrl(selectedVideo?.play_addr ?? aweme.video.play_addr) ||
                      `https://www.douyin.com/video/${aweme.aweme_id}`
                    : `https://www.douyin.com/${isArticle ? 'article' : 'note'}/${aweme.aweme_id}`,
                  dynamicTypeLabel: isArticle ? '文章作品' : isVideo ? '视频作品' : this.is_slides ? '合辑作品' : '图文作品',
                  // 卡片清晰度从选中那一路派生。关了 autoResolution 时没有「选中」这回事，
                  // selectedVideo 保持 undefined，卡片就不印清晰度。
                  videoSource: selectedVideo
                })
                if (workInfoImg.length) await this.e.reply(workInfoImg)
              }
            }
            : undefined

          const sendVideo = isVideo && hasDouyinContent('视频', 'video') && sendvideofile
            ? async (): Promise<void> => {
              /*
                媒体度量上报（本地新增，上游没有）。放在这条分支开头：走到这里就代表
                这次解析确实要发一条视频出去，而下面无论走原视频还是烧弹幕的分支，
                发出去的都是同一条媒体，只该记一次。

                `video.duration` 是**毫秒**（同仓 ktr/template/douyin/video-work 的
                formatDuration 就是先除 1000），所以用 fromMilliseconds；B站那边是秒、
                走 fromSeconds。单位搞反会让抖音的时长大 1000 倍。
              */
              reportMedia({ kind: 'video', durationMs: fromMilliseconds(video?.duration) })
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
                    },
                    candidates: g_video_candidates,
                    resource: `douyin:${data.aweme_id}:video`
                  },
                  {
                    message_id: this.e.message_id === undefined ? undefined : String(this.e.message_id)
                  }
                )
              }

              if (this.forceBurnDanmaku || Config.douyin.burnDanmaku) {
                try {
                  const danmakuData = narrowApiResponse<DanmakuResponse>(await this.amagi.douyin.fetchDanmakuList({
                    aweme_id: data.aweme_id ?? '',
                    duration: video?.duration || 0,
                    typeMode: 'strict'
                  }, Config.cookies.douyin, buildAmagiRequestConfig()), '弹幕数据')
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
                    },
                    candidates: g_video_candidates,
                    resource: `douyin:${data.aweme_id}:video`
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

          /**
           * 评论图自己取数、自己渲染、自己发送，和海报/视频两条分支一起并发。
           * 原来它排在 `await runMediaTasks(...)` 之后，视频上传多久评论图就得等多久，
           * 而这三件事之间没有数据依赖。顺序不再保证，谁先好谁先发。
           */
          const sendComment = hasDouyinContent('评论图', 'comment')
            ? async (): Promise<void> => {
              /*
                取数必须留在这个闭包里：原来它在 fan-out 之前裸 await，评论接口挂掉时
                narrowApiResponse 当场抛，视频和海报还没启动就一起没了。搬进来之后
                失败只由 runMediaTasks 记一条评论支线错误，视频照发。
                放在表情表之前是为了失败时省掉那次没人要的 Emoji 请求（它自带降级，不会抛）。
              */
              const CommentsData = narrowApiResponse<CommentsPayload>(await this.amagi.douyin.fetchWorkComments({
                aweme_id: data.aweme_id ?? '',
                // 面板上「评论解析数量」写的是新键 douyin.numcomment，这里原来只读旧键 numcomments，
                // 于是用户在面板里改了数量却没有任何效果。走 helper 统一「新键优先、旧键兜底」。
                number: douyinCommentLimit(),
                typeMode: 'strict'
              }, Config.cookies.douyin, buildAmagiRequestConfig()), '评论数据')
              const list = await getEmojiList()
              const commentsResult = await douyinComments(CommentsData, list)
              if (!commentsResult.CommentsData.length) {
                await this.e.reply('这个作品没有评论 ~')
              } else {
                const aweme = VideoData.data.aweme_detail
                // 「大家都在搜」：只取评论区顶部那一组，其余场景（搜索页等）不是这张图要的
                const suggest: string[] = []
                for (const item of aweme.suggest_words?.suggest_words ?? []) {
                  if (item.scene !== 'comment_top_rec') continue
                  for (const word of item.words ?? []) {
                    if (word.word) suggest.push(word.word)
                  }
                }

                const img = await Render('douyin/comment',
                  {
                    Type: isArticle ? '文章' : isVideo ? '视频' : this.is_slides ? '合辑' : '图集',
                    // 扁平数组，不是 { jsonArray } 包装：模板里 CommentsData.length / .map 直接读这个字段
                    CommentsData: commentsResult.CommentsData,
                    CommentLength: Config.douyin.realCommentCount
                      ? aweme.statistics.comment_count ?? 0
                      : commentsResult.CommentsData.length,
                    // 同 renderWorkImage 的 shareLink：从选中那一路拼，别拿顶层默认档 + ratio=1080p，
                    // 那会让服务端按 ratio 重新给流，扫码拿到的和实际下载的不是同一条。
                    // 契约必填 string，而模板把它塞进二维码 `value={props.share_url}`；
                    // 拼不出来时退回作品页地址，别让二维码收到 undefined
                    share_url: this.is_mp4
                      ? buildDouyinPlayUrl(selectedVideo?.play_addr ?? aweme.video.play_addr) ||
                        `https://www.douyin.com/video/${aweme.aweme_id}`
                      : aweme.share_url || `https://www.douyin.com/video/${aweme.aweme_id}`,
                    VideoSize: mp4size,
                    VideoFPS: FPS,
                    ImageLength: imagenum,
                    Region: aweme.region ?? '',
                    suggestWrod: suggest,
                    // 同上：宽高取选中那一路的 play_addr。抖音每个档位各带自己的宽高，
                    // 拿 `bit_rate[0]`（接口给的顺序）会和实际下载的那一路对不上。
                    // 契约是 `string | null`，宽高缺一边就给 null —— 原写法会印出
                    // 「undefined x undefined」，比不印更像渲染坏了。
                    Resolution: isVideo ? formatResolution(selectedVideo?.play_addr ?? at(video?.bit_rate)?.play_addr) : null,
                    maxDepth: 6,
                    Author: aweme.author.nickname ?? '',
                    AuthorAvatar: firstUrl(aweme.author.avatar_thumb),
                    // 线上 SSR 崩溃就是缺了这一个字段：VideoInfoHeader 直接读
                    // props.Statistics.digg_count（Comment.tsx:147），拿 undefined 解属性当场抛。
                    // 拿 HEAD 上的旧 payload 实测复现过，报错正是 reading 'digg_count'。
                    Statistics: {
                      digg_count: aweme.statistics.digg_count ?? 0,
                      comment_count: aweme.statistics.comment_count ?? 0,
                      share_count: aweme.statistics.share_count ?? 0,
                      collect_count: aweme.statistics.collect_count ?? 0
                    },
                    CreateTime: aweme.create_time
                  }
                )

                if (Config.douyin.commentImageCollection && commentsResult.image_url.length > 0) {
                  const imageMessages = await Promise.all(
                    commentsResult.image_url.map(async (url, index) =>
                      segment.image(await processImageUrl(url, aweme.desc || g_title || '抖音评论图片', index, {
                        ...this.headers,
                        Referer: 'https://www.douyin.com/'
                      }))
                    )
                  )
                  await this.e.reply(await common.makeForwardMsg(this.e, imageMessages, '评论图片收集'))
                }

                await this.e.reply(img)
              }
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
              logger.error(`[抖音] ${taskLabel}任务失败`, error)
            }
          })

          return true
        }

        case 'user_dynamic': {
          const UserVideoListData = narrowApiResponse<UserVideoListResponse>(await this.amagi.douyin.fetchUserVideoList({
            sec_uid: data.sec_uid ?? '',
            typeMode: 'strict'
          }, Config.cookies.douyin, buildAmagiRequestConfig()), '用户主页视频列表数据')
          const UserInfoData = narrowApiResponse<UserInfoResponse>(await this.amagi.douyin.fetchUserProfile({
            sec_uid: data.sec_uid ?? '',
            typeMode: 'strict'
          }, Config.cookies.douyin, buildAmagiRequestConfig()), '用户主页数据')

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
              // 原始秒级时间戳，不是格式化好的日期串：模板走
              // formatDouyinPublishTime(video.create_time) 出「3 天前」这种相对时间，
              // 它对非数字字符串是 `Number(...)` -> NaN -> 直接返回「发布时间未知」，
              // 所以列表里每条作品的发布时间一直都是这四个字
              create_time: Number(aweme.create_time) || 0,
              is_top: aweme.is_top === 1,
              is_video: isVideo,
              // 统计数给原始数字：模板自己有 formatCount 做万/亿换算，
              // 这边先用 Common.count 转成 '1.2万' 再传，等于把它的换算搞成字符串比较
              statistics: {
                like_count: Number(aweme.statistics?.digg_count) || 0,
                comment_count: Number(aweme.statistics?.comment_count) || 0,
                share_count: Number(aweme.statistics?.share_count) || 0,
                collect_count: Number(aweme.statistics?.collect_count) || 0
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
              // 同上：模板里 formatCount(count: number) 自己做万/亿换算
              follower_count: Number(user.follower_count) || 0,
              following_count: Number(user.following_count) || 0,
              total_favorited: Number(user.total_favorited) || 0,
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
          const MusicData = narrowApiResponse<MusicResponse>(await this.amagi.douyin.fetchMusicInfo({
            music_id: data.music_id ?? '',
            typeMode: 'strict'
          }, Config.cookies.douyin, buildAmagiRequestConfig()), '音乐数据')
          const sec_uid = MusicData.data.music_info.sec_uid
          const UserData = narrowApiResponse<UserInfoResponse>(await this.amagi.douyin.fetchUserProfile({ sec_uid, typeMode: 'strict' }, Config.cookies.douyin, buildAmagiRequestConfig()), '用户主页数据')
          // if (userdata.status_code === 2) {
          //   const new_userdata = await douyinFetcher.searchContent({ query: data.music_info.author }, Config.cookies.douyin, buildAmagiRequestConfig())
          //   if (new_userdata.data[0].type === 4 && new_userdata.data[0].card_unique_name === 'user') {
          //     userdata = { user: new_userdata.data[0].user_list[0].user_info }
          //   }
          //   const search_data = new_userdata
          // }
          if (!MusicData.data.music_info.play_url) {
            await this.e.reply('解析错误！该音乐抖音未提供下载链接，无法下载', { reply: true })
            return true
          }
          const img = await Render('douyin/musicinfo',
            {
              image_url: firstUrl(MusicData.data.music_info.cover_hd),
              desc: MusicData.data.music_info.title,
              music_id: MusicData.data.music_info.id,
              create_time: Time(0),
              user_count: Common.count(MusicData.data.music_info.user_count),
              avater_url: firstUrl(MusicData.data.music_info.avatar_large) || firstUrl(UserData.data.user.avatar_larger),
              // 契约里这三个是必填 number、下面两个是必填 string，
              // 接口这几个字段都可选，模板又是直接印（`粉丝: {fans}`），漏出来就是 undefined
              fans: Number(UserData.data.user.mplatform_followers_count || UserData.data.user.follower_count) || 0,
              following_count: Number(UserData.data.user.following_count) || 0,
              total_favorited: Number(UserData.data.user.total_favorited) || 0,
              user_shortid: (UserData.data.user.unique_id || UserData.data.user.short_id) ?? '',
              share_url: MusicData.data.music_info.play_url.uri ?? '',
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
          // 「先把手上没有的号补齐、再拉直播间」那套时序连同它的坑（room_id 是内部房间号、
          // 不是 URL 里的 web_rid）在 `live-room.ts` 里只写一份 —— 录制入口
          // （apps/tools.ts 的 recordLive）走的是同一个函数，抄第二份的话两条路
          // 迟早在同一个 amagi zod 校验上分头翻车。
          //
          // 取数客户端仍然传 this.amagi 而不是裸 fetcher：this.amagi 是 Base 里那层 Proxy，
          // 负责把接口报错渲染成错误卡片，换掉等于解析失败时不再出卡片。
          const room = await resolveDouyinLiveRoom(
            { sec_uid: data.sec_uid, room_id: data.room_id },
            async (method, options) => method === 'fetchLiveRoomInfo'
              ? await this.amagi.douyin.fetchLiveRoomInfo(
                options as unknown as DouyinLiveRoomOptions & { typeMode: 'strict' },
                Config.cookies.douyin,
                buildAmagiRequestConfig()
              )
              : await this.amagi.douyin.fetchUserProfile(
                options as unknown as DouyinUserOptions & { typeMode: 'strict' },
                Config.cookies.douyin,
                buildAmagiRequestConfig()
              )
          )
          if (!room.living) {
            await this.e.reply(`「${room.anchor.nickname}」\n未开播，正在休息中~`)
            return true
          }
          const img = await Render('douyin/live', buildDouyinLivePayload({
            anchor: room.anchor,
            dynamicTYPE: '直播间信息',
            liveItem: room.liveItem,
            partitionTitle: room.partitionTitle,
            webRid: room.webRid
          }))
          await this.e.reply(img)
          return true
        }
        default:
          break
      }
    } catch (error) {
      // 不能在这里把异常吃掉。四个调用点（tools.ts 的 305/345/383/492）全都跑在
      // wrapWithErrorHandler 里，没有一个在看这里的返回值，所以 `return false` 传不出任何信息，
      // 只是让统一错误处理层永远收不到东西——解析失败既不出错误卡片也不通知主人。
      // 上面那些刻意抛出的提示（比如「该作品已被删除或设置为私密」）因此对用户完全静默。
      //
      // 这条日志必须留在 try 内部：wrapWithErrorHandler 自己的 logger.error 在
      // logContext.run() 之外执行，那时 AsyncLocalStorage 的 store 已经没了，写不进日志上下文。
      // 只有这里的记录会被采集进错误卡片的日志区。传 error 对象而不是 `${error}`，堆栈才不会丢。
      logger.error(`[抖音] ${this.type} 解析失败`, error)
      throw error
    }
  }
}

/**
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
 * @param {import('@ikenxuan/amagi').DyEmojiList} data 表情数据对象
 * @returns {Array<{name: string, url: string | undefined}>} 处理后的表情数组,包含name和url属性
 */
export const Emoji = (data: DyEmojiList): Array<{ name: string, url: string | undefined }> => {
  const ListArray: Array<{ name: string, url: string | undefined }> = []

  for (const i of data.emoji_list) {
    const display_name = i.display_name
    // `emoji_url` 的形状来自 amagi 的 DyEmojiList，那边声明成必填，所以 tsc 不会在
    // 这里报错 —— 但接口真缺这一层时照样抛。返回类型的 url 本来就是 `string | undefined`，
    // 取不到给 undefined 正好是它承诺的形状，不用另造兜底值。
    const url = at(i.emoji_url?.url_list)

    const Objject = {
      name: display_name,
      url
    }
    ListArray.push(Objject)
  }
  return ListArray
}
