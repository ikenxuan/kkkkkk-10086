import { Networks } from '#components'
import { logger } from '#lib'

/**
 * return aweme_id
 * @param {string} url 分享连接
 * @returns
 */
export default async function GetBilibiliID (url) {
  const longLink = await new Networks({ url }).getLongLink()
  let result

  switch (true) {
    case /video\/([A-Za-z0-9]+)/.test(longLink): {
      const bvideoMatch = longLink.match(/video\/([A-Za-z0-9]+)/)
      result = {
        type: 'bilibilivideo',
        id: bvideoMatch[1],
        P: '哔哩哔哩'
      }
      break
    }
    case /play\/(\S+?)\??/.test(longLink): {
      const playMatch = longLink.match(/play\/(\w+)/)
      result = {
        type: 'bangumivideo',
        id: playMatch[1],
        P: '哔哩哔哩'
      }
      break
    }
    case /^https:\/\/t\.bilibili\.com\/(\d+)/.test(longLink) || /^https:\/\/www\.bilibili\.com\/opus\/(\d+)/.test(longLink): {
      const tMatch = longLink.match(/^https:\/\/t\.bilibili\.com\/(\d+)/)
      const opusMatch = longLink.match(/^https:\/\/www\.bilibili\.com\/opus\/(\d+)/)
      const dynamic_id = tMatch || opusMatch
      result = {
        type: 'bilibilidynamic',
        dynamic_id: dynamic_id[1],
        P: '哔哩哔哩'
      }
      break
    }
    case /live\.bilibili\.com/.test(longLink): {
      const match = longLink.match(/https?:\/\/live\.bilibili\.com\/(\d+)/)
      result = {
        type: '直播live',
        room_id: match[1],
        P: '哔哩哔哩'
      }
      break
    }
    default:
      logger.warn('无法获取作品ID')
      break
  }

  console.log(result)
  return result
}
