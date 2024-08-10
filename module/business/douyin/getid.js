import { Networks } from '#components'
import { logger } from '#lib'

/**
 * 返回作品id对象
 * @param {string} url 分享连接
 * @returns
 */
export default async function GetDouyinID (url) {
  const longLink = await new Networks({ url }).getLongLink()
  let result

  switch (true) {
    case longLink === 'https://www.douyin.com/': {
      const newres = await new Networks({ url }).getLocation()
      const match = newres.match(/share\/slides\/(\d+)/)
      result = {
        type: 'LiveImage',
        id: match[1],
        is_mp4: true,
        P: '抖音'
      }
      break
    }

    case longLink.includes('webcast.amemv.com'):
      result = {
        type: 'Live',
        baseurl: url,
        P: '抖音'
      }
      logger.warn('直播间相关暂未支持解析')
      return {}

    case /video\/(\d+)/.test(longLink): {
      const videoMatch = longLink.match(/video\/(\d+)/)
      result = {
        type: 'video',
        id: videoMatch[1],
        is_mp4: true,
        P: '抖音'
      }
      break
    }
    case /note\/(\d+)/.test(longLink): {
      const noteMatch = longLink.match(/note\/(\d+)/)
      result = {
        type: 'note',
        id: noteMatch[1],
        is_mp4: false,
        P: '抖音'
      }
      break
    }
    case /https:\/\/(?:www\.douyin\.com|www\.iesdouyin\.com)\/share\/user\/(\S+)/.test(longLink): {
      const userMatch = longLink.match(/user\/([a-zA-Z0-9_]+)\b/)
      result = {
        type: 'UserVideosList',
        user_id: userMatch[1],
        P: '抖音'
      }
      break
    }
    case /music\/(\d+)/.test(longLink): {
      const musicMatch = longLink.match(/music\/(\d+)/)
      result = {
        type: 'Music',
        music_id: musicMatch[1],
        P: '抖音'
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
