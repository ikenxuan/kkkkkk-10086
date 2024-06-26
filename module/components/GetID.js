import { Networks } from '#components'
import { logger } from '#lib'

/**
 * return aweme_id
 * @param {string} url 分享连接
 * @returns
 */
export default async function GetID (url) {
  const longLink = await new Networks({ url }).getLongLink()
  let result

  switch (true) {
    case longLink.includes('webcast.amemv.com'):
      result = {
        type: 'Live',
        baseurl: url
      }
      logger.warn('暂未支持解析')
      return {}

    case /video\/(\d+)/.test(longLink): {
      const videoMatch = longLink.match(/video\/(\d+)/)
      result = {
        type: 'video',
        id: videoMatch[1],
        is_mp4: true,
        Platform: '抖音'
      }
      break
    }
    case /note\/(\d+)/.test(longLink): {
      const noteMatch = longLink.match(/note\/(\d+)/)
      result = {
        type: 'note',
        id: noteMatch[1],
        is_mp4: false,
        Platform: '抖音'
      }
      break
    }
    case /https:\/\/(?:www\.douyin\.com|www\.iesdouyin\.com)\/share\/user\/(\S+)/.test(longLink): {
      const userMatch = longLink.match(/user\/([a-zA-Z0-9_]+)\b/)
      result = {
        type: 'UserVideosList',
        user_id: userMatch[1],
        Platform: '抖音'
      }
      break
    }
    case /music\/(\d+)/.test(longLink): {
      const musicMatch = longLink.match(/music\/(\d+)/)
      result = {
        type: 'Music',
        music_id: musicMatch[1],
        Platform: '抖音'
      }
      break
    }
    case /video\/([A-Za-z0-9]+)/.test(longLink): {
      const bvideoMatch = longLink.match(/video\/([A-Za-z0-9]+)/)
      result = {
        type: 'bilibilivideo',
        id: bvideoMatch[1],
        Platform: '哔哩哔哩'
      }
      break
    }
    case /play\/(\S+?)\??/.test(longLink): {
      const playMatch = longLink.match(/play\/(\w+)/)
      result = {
        type: 'bangumivideo',
        id: playMatch[1],
        Platform: '哔哩哔哩'
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
        Platform: '哔哩哔哩'
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
