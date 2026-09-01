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
    longLink = await new Networks({
      url,
      headers: baseHeaders
    }).getLongLink()

    if (!longLink || longLink === '') {
      logger.error('获取抖音长链接失败，请稍后再试')
      return { type: 'undefined' }
    }

    if (longLink === url) {
      const response = await fetch(longLink, { redirect: 'follow' })
      if (response.url && response.url !== url) longLink = response.url
    }

    const urlPatterns: UrlPattern[] = [
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
        url => {
          // 用正则取路径首段，不能用 `url.split('/').pop()`：真实分享链接普遍带 query
          // （`live.douyin.com/26139686?unique_k=2333` → `26139686?unique_k=2333`），
          // 带尾斜杠时 pop() 更是直接得到空串。两种情况都会把脏值当房间号发出去。
          //
          // 注意这里取到的是 **web_rid**（可直接访问 live.douyin.com/{web_rid} 的展示号），
          // 不是接口要的 room_id_str。字段名沿用 `room_id` 是为了兼容既有消费方
          // （pushPreview.ts 就把它当 webRid 用），真正的 room_id 由消费方向接口反查。
          const match = /live\.douyin\.com\/([A-Za-z\d_-]+)/.exec(url)
          return {
            type: 'live_room_detail',
            room_id: match?.[1]
          }
        }
      ],
      [
        'work',
        url => /(?:video|article|note)\/\d+/.test(url),
        url => ({
          type: 'one_work',
          aweme_id: url.match(/(?:video|article|note)\/(\d+)/)?.[1]
        })
      ],
      [
        'slides',
        url => /slides\/\d+/.test(url),
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
      [
        'user',
        url => /https:\/\/(?:www\.douyin\.com|www\.iesdouyin\.com)\/(?:share\/)?user\/\S+/.test(url),
        url => ({
          type: 'user_dynamic',
          sec_uid: url.match(/user\/([a-zA-Z0-9_-]+)\b/)?.[1]
        })
      ],
      [
        'music',
        url => /music\/\d+/.test(url),
        url => ({
          type: 'music_work',
          music_id: url.match(/music\/(\d+)/)?.[1]
        })
      ]
    ]

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
  if (result.type === 'undefined' && log) {
    logger.warn(`[抖音链接] 无法识别的链接: ${longLink}`)
  }
  return result
}
