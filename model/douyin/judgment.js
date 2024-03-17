import networks from '../../utils/networks.js'

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

    case /user\/(\S+?)\?/.test(longLink):
      const userMatch = longLink.match(/user\/(\S+?)\?/)
      result = {
        type: 'UserVideosList',
        user_id: userMatch[1],
      }
      break

    default:
      break
  }

  console.log(result)
  return result
}
