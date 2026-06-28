import { Networks } from '../../utils/Networks.js'

/**
 * return aweme_id
 * @param {string} url 分享连接
 * @returns
 */
export default async function GetKuaishouID (url) {
  const longLink = await new Networks({ url }).getLongLink()
  let result

  switch (true) {
    case /photoId=(.*)/.test(longLink): {
      const workid = longLink.match(/photoId=([^&]+)/)
      result = {
        type: 'one_work',
        id: workid?.[1],
        photoId: workid?.[1],
        P: '快手'
      }
      break
    }

    case /kuaishou\.com\/short-video\/([^?]+)/.test(longLink): {
      const workid = longLink.match(/short-video\/([^?]+)/)
      result = {
        type: 'one_work',
        id: workid?.[1],
        photoId: workid?.[1],
        P: '快手'
      }
      break
    }

    default:
      logger.warn('无法获取作品ID')
      break
  }

  logger.debug?.(result)
  return result
}
