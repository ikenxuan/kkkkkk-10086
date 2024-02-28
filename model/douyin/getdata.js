import { Sign } from './sign/Sign.js'
import base from '../base.js'
import { DouyinAPI } from './API.js'

export default class iKun extends base {
  /**
   *
   * @param {string} type [ video | note ] 视频或图集
   * @param {string} type [ CommentReplyData ] 二级评论
   * @param {string} type [ UserInfoData ] 用户主页信息
   * @param {string} type [ Emoji ] 表情
   * @param {string} type [ UserVideosList ] 用户主页视频
   * @param {string} type [ SuggestWords ] 热点词
   * @param {string} type [ Search ] 搜索
   */
  constructor(type) {
    super()
    this.type = type
  }
  async GetData(data) {
    if (!this.allow) throw new Error('请使用 [#kkk设置抖音ck] 以设置抖音ck')
    switch (this.type) {
      case 'video':
      case 'note':
        this.URL = await DouyinAPI.视频或图集(data.id)
        let VideoData = await this.GlobalGetData(
          {
            url: `${this.URL}&X-Bogus=${await Sign.XB(this.URL)}`,
            method: 'GET',
            headers: {
              ...this.headers,
              Cookie: this.Config.ck,
            },
          },
          data.is_mp4
        )

        this.URL = await DouyinAPI.评论(data.id)
        let CommentsData = this.comments
          ? await this.GlobalGetData({
              url: `${this.URL}&X-Bogus=${await Sign.XB(this.URL)}`,
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
        this.URL = await DouyinAPI.二级评论(data.id, data.cid)
        let CommentReplyData = await this.GlobalGetData({
          url: `${this.URL}&X-Bogus=${await Sign.XB(this.URL)}`,
          headers: this.headers,
        })
        return CommentReplyData

      case 'UserInfoData':
        this.URL = await DouyinAPI.用户主页信息(data.user_id)
        let UserInfoData = await this.GlobalGetData({
          url: `${this.URL}&X-Bogus=${await Sign.XB(this.URL)}`,
          headers: {
            ...this.headers,
            Referer: `https://www.douyin.com/user/${data.user_id}`,
          },
        })
        return UserInfoData

      case 'Emoji':
        this.URL = await DouyinAPI.表情()
        let EmojiData = await this.GlobalGetData({
          url: this.URL,
          headers: this.headers,
        })
        return EmojiData

      case 'UserVideosList':
        this.URL = await DouyinAPI.用户主页视频(data.user_id)
        // console.log(`${this.URL}&X-Bogus=${await Sign.XB(this.URL)}`)
        let UserVideoListData = await this.GlobalGetData({
          url: `${this.URL}&X-Bogus=${await Sign.XB(this.URL)}`,
          headers: {
            ...this.headers,
            Referer: `https://www.douyin.com/user/${data.user_id}`,
          },
        })
        return UserVideoListData

      case 'SuggestWords':
        this.URL = await DouyinAPI.热点词(data.query)
        let SuggestWordsData = await this.GlobalGetData({
          url: `${this.URL}&X-Bogus=${await Sign.XB(this.URL)}`,
          headers: {
            ...this.headers,
            Referer: `https://www.douyin.com/search/${encodeURIComponent(data.query)}`,
          },
        })
        return SuggestWordsData

      case 'Search':
        this.URL = await DouyinAPI.搜索(data.query)
        let SearchData = await this.GlobalGetData({
          url: `${this.URL}&X-Bougs=${await Sign.XB(this.URL)}`,
          headers: {
            ...this.headers,
            Referer: `https://www.douyin.com/https://www.douyin.com/search/${encodeURIComponent(data.query)}`,
          },
        })
        return SearchData

      default:
    }
  }

  /**
   * @param {*} options opt
   * @param {*} is_mp4 boolean
   * @returns
   */
  async GlobalGetData(options, is_mp4) {
    let result = await new this.networks(options).getData()
    if (typeof is_mp4 === 'boolean') {
      result.is_mp4 = is_mp4
    }
    return result
  }
}
