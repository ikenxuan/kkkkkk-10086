import { base, Config, networks } from '#modules'
import { DouyinAPI, Sign } from '#douyin'

export default class iKun extends base {
  constructor(type) {
    super()
    this.type = type
    this.headers['Referer'] = 'https://www.douyin.com/'
    this.headers['Cookie'] = Config.ck
  }

  async GetData(data) {
    if (!this.allow) throw new Error('请使用 [#kkk设置抖音ck] 以设置抖音ck')
    switch (this.type) {
      case 'video':
      case 'note':
        this.URL = DouyinAPI.视频或图集(data.id)
        let VideoData = await this.GlobalGetData(
          {
            url: `${this.URL}&X-Bogus=${Sign.XB(this.URL)}`,
            method: 'GET',
            headers: this.headers,
          },
          data.is_mp4,
        )

        this.URL = DouyinAPI.评论(data.id)
        let CommentsData = Config.comments
          ? await this.GlobalGetData({
              url: `${this.URL}&X-Bogus=${Sign.XB(this.URL)}`,
              method: 'GET',
              headers: this.headers,
            })
          : {
              code: 405,
              msg: '你没开评论解析的开关',
              data: null,
            }
        return { VideoData, CommentsData }

      case 'CommentReplyData':
        this.URL = DouyinAPI.二级评论(data.id, data.cid)
        let CommentReplyData = await this.GlobalGetData({
          url: `${this.URL}&X-Bogus=${Sign.XB(this.URL)}`,
          headers: this.headers,
        })
        return CommentReplyData

      case 'UserInfoData':
        this.URL = DouyinAPI.用户主页信息(data.user_id)
        let UserInfoData = await this.GlobalGetData({
          url: `${this.URL}&X-Bogus=${Sign.XB(this.URL)}`,
          headers: {
            ...this.headers,
            Referer: `https://www.douyin.com/user/${data.user_id}`,
          },
        })
        return UserInfoData

      case 'Emoji':
        this.URL = DouyinAPI.表情()
        let EmojiData = await this.GlobalGetData({
          url: this.URL,
          headers: this.headers,
        })
        return EmojiData

      case 'UserVideosList':
        this.URL = DouyinAPI.用户主页视频(data.user_id)
        let UserVideoListData = await this.GlobalGetData({
          url: `${this.URL}&X-Bogus=${Sign.XB(this.URL)}`,
          headers: {
            ...this.headers,
            Referer: `https://www.douyin.com/user/${data.user_id}`,
          },
        })
        return UserVideoListData

      case 'SuggestWords':
        this.URL = DouyinAPI.热点词(data.query)
        let SuggestWordsData = await this.GlobalGetData({
          url: `${this.URL}&X-Bogus=${Sign.XB(this.URL)}`,
          headers: {
            ...this.headers,
            Referer: `https://www.douyin.com/search/${encodeURIComponent(data.query)}`,
          },
        })
        return SuggestWordsData

      case 'Search':
        this.URL = DouyinAPI.搜索(data.query)
        let SearchData = await this.GlobalGetData({
          url: `${this.URL}&X-Bougs=${Sign.XB(this.URL)}`,
          headers: {
            ...this.headers,
            Referer: `https://www.douyin.com/https://www.douyin.com/search/${encodeURIComponent(data.query)}`,
          },
        })
        return SearchData

      /** 无法实现 */
      case 'ShortUrl':
        let a = new URL(data.target)
        this.URL = DouyinAPI.制作短链(protocol + encodeURIComponent('//' + a.host + a.pathname + a.search))
        let ShortUrlData = await this.GlobalGetData({
          url: `${this.URL}&X-Bougs=${Sign.XB(this.URL)}`,
          headers: this.headers,
        })
        return ShortUrlData

      case 'Music':
        this.URL = DouyinAPI.音乐(data.music_id)
        let MusicData = await this.GlobalGetData({
          url: `${this.URL}&X-Bougs=${Sign.XB(this.URL)}`,
          headers: this.headers,
        })
        return MusicData

      case '直播间ID':
        this.URL = DouyinAPI.直播间ID(data)
        let LiveIDData = await this.GlobalGetData({
          url: `${this.URL}&X-Bougs=${Sign.XB(this.URL)}`,
          headers: this.headers,
        })
        return LiveIDData

      case '直播间信息':
        this.URL = DouyinAPI.直播间信息(data)
        let LiveInfoData = await this.GlobalGetData({
          url: `${this.URL}&X-Bougs=${Sign.XB(this.URL)}`,
          headers: this.headers,
        })
        return LiveInfoData

      default:
        break
    }
  }

  /**
   * @param {*} options opt
   * @param {*} is_mp4 boolean
   * @returns
   */
  async GlobalGetData(options, is_mp4) {
    let result = await new networks(options).getData()
    if (result === '') {
      logger.error('获取响应数据失败！抖音ck可能已经失效！\n请求类型：' + this.type + '\n请求URL：' + options.url)
      Config.ck = ''
    } else null
    if (typeof is_mp4 === 'boolean') {
      result.is_mp4 = is_mp4
    }
    return result
  }
}
