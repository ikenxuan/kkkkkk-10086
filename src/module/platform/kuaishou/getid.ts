import { Networks } from '@/module/utils/Networks'

/** 快手作品 ID 解析结果 */
export interface KuaishouWorkId {
  type: 'one_work'
  id?: string
  photoId?: string
  P: '快手'
}

/**
 * 解析快手分享链接，提取作品 ID
 * @param url 分享链接
 * @returns 解析结果，无法识别时为 undefined
 */
export default async function GetKuaishouID (url: string): Promise<KuaishouWorkId | undefined> {
  const longLink = await new Networks({ url }).getLongLink()
  let result: KuaishouWorkId | undefined

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
