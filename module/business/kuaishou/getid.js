import { Networks } from '#components'
import { logger } from '#lib'

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
      type: '单个作品信息',
      id: workid[1],
      P: '快手'
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
