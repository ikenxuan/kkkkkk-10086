import { logger, Networks } from '../../model/index.js'
/**
 * return aweme_id
 * @param {string} url 视频分享连接
 * @returns
 */
export default async function GetDouyinID (url) {
  const longLink = await new Networks({ url }).getLongLink()
  let result = {}
  switch (true) {
    case /share\/slides\/(\d+)/.test(longLink): {
      const newres = await new Networks({ url }).getLocation()
      const match = newres.match(/share\/slides\/(\d+)/)
      result = {
        type: "\u5B9E\u51B5\u56FE\u7247\u56FE\u96C6\u6570\u636E" /* DouyinDataType.实况图片图集数据 */,
        aweme_id: match ? match[1] : ''
      }
      break
    }
    case /video\/(\d+)/.test(longLink): {
      const videoMatch = longLink.match(/video\/(\d+)/)
      result = {
        type: "\u5355\u4E2A\u89C6\u9891\u4F5C\u54C1\u6570\u636E" /* DouyinDataType.单个视频作品数据 */,
        aweme_id: videoMatch ? videoMatch[1] : ''
      }
      break
    }
    case /note\/(\d+)/.test(longLink): {
      const noteMatch = longLink.match(/note\/(\d+)/)
      result = {
        type: "\u56FE\u96C6\u4F5C\u54C1\u6570\u636E" /* DouyinDataType.图集作品数据 */,
        aweme_id: noteMatch ? noteMatch[1] : ''
      }
      break
    }
    case /user\/(\S+?)\?/.test(longLink): {
      const userMatch = longLink.match(/user\/(\S+?)\?/)
      result = {
        type: "\u7528\u6237\u4E3B\u9875\u89C6\u9891\u5217\u8868\u6570\u636E" /* DouyinDataType.用户主页视频列表数据 */,
        sec_uid: userMatch ? userMatch[1] : ''
      }
      break
    }
    default:
      break
  }
  logger.mark(result)
  return result
}
