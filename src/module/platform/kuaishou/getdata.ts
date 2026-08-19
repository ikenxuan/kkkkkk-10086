import { Base, Config, Networks } from '@/module/utils/index'
import type { NetworkRequestOptions } from '@/module/utils/Networks'
import KuaishouAPI, { type KuaishouApiRequest } from './api.js'

/** 快手数据请求类型 */
export type KuaishouDataType = 'one_work' | '单个作品信息' | '作品评论信息'

/** 单个作品聚合结果 */
export interface KuaishouWorkPayload {
  VideoData: unknown
  CommentData: unknown
  EmojiData: unknown
}

export default class KuaishouData extends Base {
  type: KuaishouDataType
  obj: KuaishouApiRequest | undefined

  constructor (type: KuaishouDataType) {
    super()
    this.type = type
    // 请求头在 Base 中初始化为 baseHeaders，这里按快手要求补充字段
    const headers = this.headers as Record<string, string>
    headers.Referer = 'https://www.kuaishou.com/'
    headers['Content-Type'] = 'application/json'
    headers.Host = 'www.kuaishou.com'
    headers.Origin = headers.Referer
    headers['X-Requested-With'] = 'mixiaba.com.Browser'
    /** 默认游客ck */
    headers.Cookie = Config.cookies.kuaishou || 'did=web_50424132d556424eb8fa8d27a612fda9; didv=1720860549000; kpf=PC_WEB; clientid=3; kpn=KUAISHOU_VISION'
  }

  async GetData (data: { photoId?: string }): Promise<KuaishouWorkPayload | unknown> {
    switch (this.type) {
      case 'one_work':
      case '单个作品信息': {
        this.obj = KuaishouAPI.单个作品信息(data.photoId)
        const VideoData = await this.GlobalGetData(
          {
            url: this.obj.url,
            method: 'POST',
            headers: this.headers,
            body: this.obj.body
          }
        )

        this.obj = KuaishouAPI.作品评论信息(data.photoId)
        const CommentData = await this.GlobalGetData(
          {
            url: this.obj.url,
            method: 'POST',
            headers: this.headers,
            body: this.obj.body
          }
        )

        this.obj = KuaishouAPI.表情()
        const EmojiData = await this.GlobalGetData(
          {
            url: this.obj.url,
            method: 'POST',
            headers: this.headers,
            body: this.obj.body
          }
        )

        return { VideoData, CommentData, EmojiData }
      }

      case '作品评论信息': {
        this.obj = KuaishouAPI.作品评论信息(data.photoId)
        const CommentData = await this.GlobalGetData(
          {
            url: this.obj.url,
            method: 'POST',
            headers: this.headers,
            body: this.obj.body
          }
        )
        return CommentData
      }
      default:
        break
    }
  }

  async GlobalGetData (options: NetworkRequestOptions): Promise<unknown> {
    const result = await new Networks(options).getData()
    if (!result || result === '') {
      logger.error('获取响应数据失败！\n请求类型：' + this.type + '\n请求URL：' + options.url)
    }
    return result
  }
}
