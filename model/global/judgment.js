import { networks } from '#modules'

/**
 * return aweme_id
 * @param {*} url 分享连接
 * @returns
 */
export async function GetID(url) {
  let longLink = await new networks({ url: url }).getLongLink()
  let result

  switch (true) {
    case longLink.includes('webcast.amemv.com'):
      result = {
        type: 'Live',
        baseurl: url,
      }
      logger.warn('暂未支持解析')
      return {}

    case /video\/(\d+)/.test(longLink):
      const videoMatch = longLink.match(/video\/(\d+)/)
      result = {
        type: 'video',
        id: videoMatch[1],
        is_mp4: true,
      }
      break

    case /note\/(\d+)/.test(longLink):
      const noteMatch = longLink.match(/note\/(\d+)/)
      result = {
        type: 'note',
        id: noteMatch[1],
        is_mp4: false,
      }
      break

    case /https:\/\/(?:www\.douyin\.com|www\.iesdouyin\.com)\/share\/user\/(\S+)/.test(longLink):
      const userMatch = longLink.match(/user\/([a-zA-Z0-9_]+)\b/)
      result = {
        type: 'UserVideosList',
        user_id: userMatch[1],
      }
      break

    case /music\/(\d+)/.test(longLink):
      const musicMatch = longLink.match(/music\/(\d+)/)
      result = {
        type: 'Music',
        music_id: musicMatch[1],
      }
      break

    case /video\/([A-Za-z0-9]+)/.test(longLink):
      const bvideoMatch = longLink.match(/video\/([A-Za-z0-9]+)/)
      result = {
        type: 'bilibilivideo',
        id: bvideoMatch[1],
      }
      break

    case /play\/(\S+?)\??/.test(longLink):
      const playMatch = longLink.match(/play\/(\w+)/)
      result = {
        type: 'bangumivideo',
        id: playMatch[1],
      }
      break

    case /^https:\/\/t\.bilibili\.com\/(\d+)/.test(longLink):
      const dynamic_id = longLink.match(/^https:\/\/t\.bilibili\.com\/(\d+)/)
      result = {
        type: 'bilibilidynamic',
        dynamic_id: dynamic_id[1],
      }
      break

    default:
      logger.warn('无法获取作品ID')
      break
  }

  console.log(result)
  return result
}
