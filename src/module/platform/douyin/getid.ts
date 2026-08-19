import { baseHeaders, Networks } from '@/module/utils/index'

/** 抖音数据类型 */
export type DouyinDataType =
  | 'one_work'
  | 'work_comments'
  | 'user_mix_videos'
  | 'user_dynamic'
  | 'user_profile'
  | 'live_room_detail'
  | 'liveroom_def'
  | 'emoji_list'
  | 'music_work'
  | 'suggest_words'
  | 'search_info'
  | 'undefined'

/** 抖音链接解析结果 */
export interface DouyinIdData {
  type: DouyinDataType
  /** 该作品是否为视频 */
  is_mp4?: boolean
  aweme_id?: string
  sec_uid?: string
  room_id?: string
  music_id?: string
}

/** 链接模式匹配表项：[类型名称, 匹配函数, 提取函数] */
type UrlPattern = [string, (url: string) => boolean, (url: string) => DouyinIdData]

/**
 * 解析抖音分享链接，返回作品ID对象
 * @param url 分享链接
 * @param log 是否记录日志
 */
export const getDouyinID = async (url: string, log = true): Promise<DouyinIdData> => {
  let result: DouyinIdData = { type: 'undefined' }
  let longLink = ''
  try {
    // 获取长链接
    longLink = await new Networks({
      url,
      headers: baseHeaders
    }).getLongLink()

    // 处理获取长链接失败的情况
    if (!longLink || longLink === '') {
      logger.error('获取抖音长链接失败，请稍后再试')
      return { type: 'undefined' }
    }

    if (longLink === url) {
      const response = await fetch(longLink, { redirect: 'follow' })
      if (response.url && response.url !== url) longLink = response.url
    }

    /** 统一的URL模式匹配表 */
    const urlPatterns: UrlPattern[] = [
      // 直播间链接
      [
        'live_webcast',
        url => url.includes('webcast.amemv.com'),
        url => {
          const sec_uid = /sec_user_id=([^&]+)/.exec(url)
          return {
            type: 'live_room_detail',
            sec_uid: sec_uid?.[1]
          }
        }
      ],
      [
        'live_direct',
        url => url.includes('live.douyin.com'),
        url => ({
          type: 'live_room_detail',
          room_id: url.split('/').pop()
        })
      ],
      // 视频作品链接
      [
        'work',
        url => /(?:video|article|note)\/\d+/.test(url),
        url => ({
          type: 'one_work',
          aweme_id: url.match(/(?:video|article|note)\/(\d+)/)?.[1]
        })
      ],
      // 图集/幻灯片作品链接 (slides)
      [
        'slides',
        url => /slides\/\d+/.test(url), // 匹配 /slides/ 后跟数字的模式
        url => ({
          type: 'one_work',
          aweme_id: url.match(/slides\/(\d+)/)?.[1],
          is_mp4: false
        })
      ],
      [
        'modal',
        url => /modal_id=(\d+)/.test(url),
        url => ({
          type: 'one_work',
          aweme_id: url.match(/modal_id=(\d+)/)?.[1],
          is_mp4: true
        })
      ],
      // 用户主页链接
      [
        'user',
        url => /https:\/\/(?:www\.douyin\.com|www\.iesdouyin\.com)\/(?:share\/)?user\/\S+/.test(url),
        url => ({
          type: 'user_dynamic',
          sec_uid: url.match(/user\/([a-zA-Z0-9_-]+)\b/)?.[1]
        })
      ],
      // 音乐作品链接
      [
        'music',
        url => /music\/\d+/.test(url),
        url => ({
          type: 'music_work',
          music_id: url.match(/music\/(\d+)/)?.[1]
        })
      ]
    ]

    // 统一的链接处理逻辑 - 适配新的数组结构
    for (const [name, test, extract] of urlPatterns) {
      if (test(longLink)) {
        result = extract(longLink)
        if (log) logger.info(`[抖音链接] 类型: ${name}`, result)
        break
      }
    }
  } catch (error) {
    logger.error('[抖音链接] 解析失败:', error)
  }
  // 处理未匹配到任何模式的情况
  if (result.type === 'undefined' && log) {
    logger.warn(`[抖音链接] 无法识别的链接: ${longLink}`)
  }
  return result
}
