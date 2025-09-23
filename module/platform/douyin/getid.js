import { logger, baseHeaders } from '../../utils/index.js'
import axios from 'axios'

/**
 * @typedef {object} DouyinDataTypes
 * @property {'one_work'} one_work - 单个视频
 * @property {'work_comments'} work_comments
 * @property {'user_mix_videos'} user_mix_videos
 * @property {'user_dynamic'} user_dynamic
 * @property {'user_profile'} user_profile
 * @property {'live_room_detail'} live_room_detail
 * @property {'liveroom_def'} liveroom_def
 * @property {'emoji_list'} emoji_list
 * @property {'music_work'} music_work
 * @property {'suggest_words'} suggest_words
 * @property {'search_info'} search_info
 * @property {'undefined'} undefined
 */

/**
 * @typedef {Object.<string, any>} DouyinIdData
 * @property {DouyinDataTypes[keyof DouyinDataTypes]} type
 * @property {boolean} [is_mp4] - 该作品是否为视频
 */

/**
 * 解析抖音分享链接，返回作品ID对象
 * @param {string} url 分享链接
 * @param {boolean} [log=true] 是否记录日志
 * @returns {Promise<DouyinIdData>} 成功返回作品信息对象，失败返回true（已回复错误）或空对象
 */
export const getDouyinID = async (url, log = true) => {
  /** @type {DouyinIdData} */
  let result = { type: 'undefined' }
  let longLink = ''
  try {
    // 获取长链接
    const resp = await axios.get(url, {
      headers: {
        ...baseHeaders,
        'Host': 'v.douyin.com',
        'Connection': 'keep-alive'
      }
    })
    longLink = resp.request.res.responseUrl

    // 处理获取长链接失败的情况
    if (!longLink || longLink === '') {
      logger.error('获取抖音长链接失败，请稍后再试')
      return { type: 'undefined' }
    }

    if (longLink.includes('失败')) {
      logger.error(longLink)
      return { type: 'undefined' }
    }

    /** 
     * 统一的URL模式匹配表 [类型名称, 匹配函数, 提取函数]
     * @typedef {[string, (url: string) => boolean, (url: string) => DouyinIdData]} UrlPattern
     * @type {UrlPattern[]}
     */
    const urlPatterns = [
      // 直播间链接
      [
        'live_webcast',
        (url) => url.includes('webcast.amemv.com'),
        (url) => {
          const sec_uid = /sec_user_id=([^&]+)/.exec(url)
          return {
            type: 'live_room_detail',
            sec_uid: sec_uid?.[1]
          }
        }
      ],
      [
        'live_direct',
        (url) => url.includes('live.douyin.com'),
        (url) => ({
          type: 'live_room_detail',
          room_id: url.split('/').pop()
        })
      ],
      // 视频作品链接
      [
        'video',
        (url) => /video\/\d+/.test(url),
        (url) => ({
          type: 'one_work',
          aweme_id: url.match(/video\/(\d+)/)?.[1],
          is_mp4: true
        })
      ],
      // 图文作品链接
      [
        'note',
        (url) => /note\/\d+/.test(url),
        (url) => ({
          type: 'one_work',
          aweme_id: url.match(/note\/(\d+)/)?.[1],
          is_mp4: false
        })
      ],
      // 图集/幻灯片作品链接 (slides)
      [
        'slides',
        (url) => /slides\/\d+/.test(url), // 匹配 /slides/ 后跟数字的模式
        (url) => ({
          type: 'one_work',
          aweme_id: url.match(/slides\/(\d+)/)?.[1],
          is_mp4: false
        })
      ],
      // 用户主页链接
      [
        'user',
        (url) => /https:\/\/(?:www\.douyin\.com|www\.iesdouyin\.com)\/share\/user\/\S+/.test(url),
        (url) => ({
          type: 'user_dynamic',
          sec_uid: url.match(/user\/([a-zA-Z0-9_-]+)\b/)?.[1]
        })
      ],
      // 音乐作品链接
      [
        'music',
        (url) => /music\/\d+/.test(url),
        (url) => ({
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
    logger.error(`[抖音链接] 解析失败:`, error)
  }
  // 处理未匹配到任何模式的情况
  if (result.type === 'undefined' && log) {
    logger.warn(`[抖音链接] 无法识别的链接: ${longLink}`)
  }
  return result
}
