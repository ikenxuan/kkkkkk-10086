import networks from '../../utils/networks.js'
import { Sign } from './sign/Sign.js'
import base from '../base.js'
import { DouyinAPI } from './API.js'

export default class Argument extends base {
  async GetData(data) {
    switch (data.type) {
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
        this.URL = await DouyinAPI.用户主页视频(data.id)
        let UserVideoListData = await this.GlobalGetData({
          url: `${this.URL}&X-Bogus=${await Sign.XB(this.URL)}`,
          headers: {
            ...this.headers,
            Referer: `https://www.douyin.com/user/${data.id}`,
          },
        })
        return UserVideoListData

      case 'SuggestWords':
        this.URL = await DouyinAPI.热点词(data.query)
        let SuggestWordsData = await this.GlobalGetData({
          url: `${this.URL}&X-Bogus=${await Sign.XB(this.URL)}`,
          headers: {
            ...this.headers,
            Referer: `https://www.douyin.com/search/${encodeURIComponent(
              data.query
            )}?publish_time=0&sort_type=0&source=comment_named_entity_search&type=general`,
          },
        })
        return SuggestWordsData

      default:
    }
  }

  /**
   * @param {*} options opt
   * @param {*} is_mp4 boolean
   * @returns
   */
  async GlobalGetData(options, is_mp4) {
    let result = await new networks(options).getData()
    if (typeof is_mp4 === 'boolean') {
      result.is_mp4 = is_mp4
    }
    return result
  }
}
