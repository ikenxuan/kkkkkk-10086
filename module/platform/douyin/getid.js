import { Networks, baseHeaders } from '../../utils/Networks.js'

/**
 * 解析抖音分享链接，返回作品ID对象
 * @param {string} url 分享链接
 * @param {boolean} log 是否记录日志
 * @returns {Promise<object|boolean>} 成功返回作品信息对象，失败返回true（已回复错误）或空对象
 */
export default async function GetDouyinID (url, log = true) {
  try {
    // 获取长链接
    const longLink = await new Networks({
      headers: {
        ...baseHeaders,
        Referer: 'https://www.douyin.com/',
        Cookies: ''
      }
    }).getLongLink(url)

    // 处理获取长链接失败的情况
    if (!longLink || longLink === '') {
      logger.error('获取抖音长链接失败，请稍后再试')
      return true
    }

    if (longLink.includes('失败')) {
      logger.error(longLink)
      return true
    }

    // 统一的URL模式匹配表
    const urlPatterns = [
      // [类型名称, 匹配函数, 提取函数]
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
    let result = {}
    for (const [name, test, extract] of urlPatterns) {
      if (test(longLink)) {
        result = extract(longLink)
        if (log) logger.info(`[抖音链接] 类型: ${name}`, result)
        break
      }
    }

    // 处理未匹配到任何模式的情况
    if (Object.keys(result).length === 0) log & logger.warn(`[抖音链接] 无法识别的链接: ${longLink}`)

    return result
  } catch (error) {
    logger.error(`[抖音链接] 解析失败:`, error)
    return true
  }
}
