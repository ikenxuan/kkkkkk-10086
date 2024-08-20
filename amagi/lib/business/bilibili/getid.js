import { Networks, logger } from '../../model/index.js'
/**
 * return aweme_id
 * @param {string} url 分享连接
 * @returns
 */
export default async function GetBilibiliID (url) {
  const longLink = await new Networks({ url }).getLongLink()
  let result = {}
  switch (true) {
    case /video\/([A-Za-z0-9]+)/.test(longLink): {
      const bvideoMatch = longLink.match(/video\/([A-Za-z0-9]+)/)
      result = {
        type: "\u5355\u4E2A\u89C6\u9891\u4F5C\u54C1\u6570\u636E" /* BilibiliDataType.单个视频作品数据 */,
        id: bvideoMatch ? bvideoMatch[1] : ''
      }
      break
    }
    case /play\/(\S+?)\??/.test(longLink): {
      const playMatch = longLink.match(/play\/(\w+)/)
      result = {
        type: "\u756A\u5267\u57FA\u672C\u4FE1\u606F\u6570\u636E" /* BilibiliDataType.番剧基本信息数据 */,
        id: playMatch ? playMatch[1] : ''
      }
      break
    }
    case /^https:\/\/t\.bilibili\.com\/(\d+)/.test(longLink) || /^https:\/\/www\.bilibili\.com\/opus\/(\d+)/.test(longLink): {
      const tMatch = longLink.match(/^https:\/\/t\.bilibili\.com\/(\d+)/)
      const opusMatch = longLink.match(/^https:\/\/www\.bilibili\.com\/opus\/(\d+)/)
      const dynamic_id = tMatch || opusMatch
      result = {
        type: "\u52A8\u6001\u8BE6\u60C5\u6570\u636E" /* BilibiliDataType.动态详情数据 */,
        dynamic_id: dynamic_id ? dynamic_id[1] : ''
      }
      break
    }
    default:
      break
  }
  logger.mark(result)
  return result
}
