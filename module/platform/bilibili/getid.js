import { Networks, baseHeaders } from '../../utils/Networks.js'

/**
 * return aweme_id
 * @param {string} url 分享连接
 * @returns
 */
export default async function GetBilibiliID (url, log = true) {
  try {
    // 获取长链接
    const longLink = await new Networks({
      headers: {
        ...baseHeaders,
        Referer: 'https://www.bilibili.com',
        Cookies: ''
      }
    }).getLongLink(url)

    // 处理获取长链接失败的情况
    if (!longLink || longLink === '') {
      logger.error('获取B站长链接失败，请稍后再试')
      return true
    }

    if (longLink.includes('失败')) {
      logger.error(longLink)
      return true
    }

    // 统一的URL模式匹配表
    const urlPatterns = [
      // 视频链接
      [
        'video',
        (url) => /(video\/|video-)([A-Za-z0-9]+)/.test(url),
        (url) => {
          const bvideoMatch = /video\/([A-Za-z0-9]+)|bvid=([A-Za-z0-9]+)/.exec(url)
          const pParam = new URL(url).searchParams.get('p')
          const pValue = pParam ? parseInt(pParam, 10) : undefined
          return {
            type: 'one_video',
            bvid: bvideoMatch ? bvideoMatch[1] || bvideoMatch[2] : undefined,
            ...(pValue !== undefined && { p: pValue })
          }
        }
      ],
      // 活动视频链接
      [
        'festival',
        (url) => /festival\/([A-Za-z0-9]+)/.test(url),
        (url) => {
          const festivalMatch = /festival\/([A-Za-z0-9]+)\?bvid=([A-Za-z0-9]+)/.exec(url)
          return {
            type: 'one_video',
            id: festivalMatch ? festivalMatch[2] : undefined
          }
        }
      ],
      // 番剧链接
      [
        'bangumi',
        (url) => /play\/(\S+?)\??/.test(url),
        (url) => {
          const playMatch = /play\/(\w+)/.exec(url)
          const id = playMatch ? playMatch[1] : ''
          let realid = ''
          if (id.startsWith('ss')) realid = 'season_id'
          else if (id.startsWith('ep')) realid = 'ep_id'
          return {
            type: 'bangumi_video_info',
            isEpid: false,
            realid
          }
        }
      ],
      // 动态链接
      [
        'dynamic',
        (url) => /^https:\/\/t\.bilibili\.com\/(\d+)/.test(url) || /^https:\/\/www\.bilibili\.com\/opus\/(\d+)/.test(url),
        (url) => {
          const tMatch = /^https:\/\/t\.bilibili\.com\/(\d+)/.exec(url)
          const opusMatch = /^https:\/\/www\.bilibili\.com\/opus\/(\d+)/.exec(url)
          const dynamic_id = tMatch ?? opusMatch
          return {
            type: 'dynamic_info',
            dynamic_id: dynamic_id ? dynamic_id[1] : dynamic_id
          }
        }
      ],
      // 直播间链接
      [
        'live',
        (url) => url.includes('live.bilibili.com'),
        (url) => {
          const match = /https?:\/\/live\.bilibili\.com\/(\d+)/.exec(url)
          return {
            type: 'live_room_detail',
            room_id: match ? match[1] : undefined
          }
        }
      ]
    ]

    // 统一的链接处理逻辑
    let result = {}
    for (const [name, test, extract] of urlPatterns) {
      if (test(longLink)) {
        result = extract(longLink)
        if (log) logger.info(`[B站链接] 类型: ${name}`, result)
        break
      }
    }

    // 处理未匹配到任何模式的情况
    if (Object.keys(result).length === 0 && log) {
      logger.warn('[B站链接] 无法识别的链接:', longLink)
    }

    return result
  } catch (error) {
    logger.error(`[B站链接] 解析失败:`, error)
    return true
  }
}
