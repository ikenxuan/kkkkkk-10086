import { Base, Config, Networks } from '#components'
import { KuaishouAPI } from '#kuaishou'
import { logger } from '#lib'

export default class KuaishouData extends Base {
  constructor (type) {
    super()
    this.type = type
    this.headers.Referer = 'https://www.kuaishou.com/'
    this.headers['Content-Type'] = 'application/json'
    this.headers.Host = 'www.kuaishou.com'
    this.headers.Origin = this.headers.Referer
    this.headers['X-Requested-With'] = 'mixiaba.com.Browser'
    /** 游客 */
    this.headers.Cookie = 'did=web_50424132d556424eb8fa8d27a612fda9; didv=1720860549000'
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
          },
        )
        return VideoData
      }
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