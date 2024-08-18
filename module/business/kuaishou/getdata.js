import { Base, Config, Networks } from '../../components/index.js'
import  KuaishouAPI  from './API.js'
import logger from '../../lib/public/logger.js'

export default class KuaishouData extends Base {
  constructor (type) {
    super()
    this.type = type
    this.headers.Referer = 'https://www.kuaishou.com/'
    this.headers['Content-Type'] = 'application/json'
    this.headers.Host = 'www.kuaishou.com'
    this.headers.Origin = this.headers.Referer
    this.headers['X-Requested-With'] = 'mixiaba.com.Browser'
    /** 默认游客ck */
    this.headers.Cookie = Config.cookies.kuaishou || 'did=web_50424132d556424eb8fa8d27a612fda9; didv=1720860549000; kpf=PC_WEB; clientid=3; kpn=KUAISHOU_VISION'
  }

  /**
   *
   * @param {any} data param
   * @returns
   */
  async GetData (data) {
    switch (this.type) {
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

  /**
   * @param {*} options opt
   * @returns
   */
  async GlobalGetData (options) {
    const result = await new Networks(options).getData()
    if (!result || result === '') {
      logger.error('获取响应数据失败！\n请求类型：' + this.type + '\n请求URL：' + options.url)
    }
    return result
  }
}
