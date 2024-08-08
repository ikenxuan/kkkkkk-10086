import { Base, Config, Networks } from '#components'
import { logger } from '#lib'
import { DouyinAPI, Sign } from '@ikenxuan/amagi'

export default class DouyinData extends Base {
  constructor (type) {
    super()
    this.type = type
    this.headers.Referer = 'https://www.douyin.com/'
    this.headers.Cookie = Config.cookies.douyin
  }

  async GetData (data) {
    if (!this.allow) throw new Error('请使用 [#kkk设置抖音ck] 以设置抖音ck')
    switch (this.type) {
    case 'video':
    case 'note': {
      this.URL = DouyinAPI.视频或图集({ aweme_id: data.id })
      const VideoData = await this.GlobalGetData(
        {
          url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
          method: 'GET',
          headers: this.headers
        },
        data.is_mp4
      )

      this.URL = DouyinAPI.评论({ aweme_id: data.id, number: Config.douyin.numcomments })
      const CommentsData = Config.douyin.comments
        ? await this.GlobalGetData({
          url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
          method: 'GET',
          headers: this.headers
        })
        : { data: null }

      if (!VideoData.aweme_detail) {
        logger.error('获取作品响应数据失败！可能该分享链接有误\n请检查该分享链接是否正确（复制分享链接打开抖音。。。）')
      }
      return { VideoData, CommentsData }
    }

    case 'LiveImage': {
      this.URL = DouyinAPI.动图({ aweme_id: data.id })
      const LiveImageData = await this.GlobalGetData(
        {
          url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
          method: 'GET',
          headers: {
            ...this.headers,
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1 Edg/126.0.0.0'
          }
        },
        data.is_mp4
      )
      return { LiveImageData }
    }
    case 'UserInfoData': {
      this.URL = DouyinAPI.用户主页信息({ sec_uid: data.user_id })
      const UserInfoData = await this.GlobalGetData({
        url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
        headers: {
          ...this.headers,
          Referer: `https://www.douyin.com/user/${data.user_id}`
        }
      })
      return UserInfoData
    }
    case 'Emoji': {
      this.URL = DouyinAPI.表情()
      const EmojiData = await this.GlobalGetData({
        url: this.URL,
        headers: this.headers
      })
      return EmojiData
    }
    case 'UserVideosList': {
      this.URL = DouyinAPI.用户主页视频({ sec_uid: data.user_id })
      const UserVideoListData = await this.GlobalGetData({
        url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
        headers: {
          ...this.headers,
          Referer: `https://www.douyin.com/user/${data.user_id}`
        }
      })
      return UserVideoListData
    }
    case 'SuggestWords': {
      this.URL = DouyinAPI.热点词({ query: data.query })
      const SuggestWordsData = await this.GlobalGetData({
        url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
        headers: {
          ...this.headers,
          Referer: `https://www.douyin.com/search/${encodeURIComponent(data.query)}`
        }
      })
      return SuggestWordsData
    }
    case 'Search': {
      this.URL = DouyinAPI.搜索({ query: data.query })
      const SearchData = await this.GlobalGetData({
        url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
        headers: {
          ...this.headers,
          Referer: `https://www.douyin.com/https://www.douyin.com/search/${encodeURIComponent(data.query)}`
        }
      })
      return SearchData
    }
    case 'Music': {
      this.URL = DouyinAPI.背景音乐({ music_id: data.music_id })
      const MusicData = await this.GlobalGetData({
        url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
        headers: this.headers
      })
      return MusicData
    }
    default:
      break
    }
  }

  /**
   * @param {*} options opt
   * @param {*} is_mp4 boolean
   * @returns
   */
  async GlobalGetData (options, is_mp4 = true) {
    const result = await new Networks(options).getData()
    if (!result || result === '') {
      logger.error('获取响应数据失败！抖音ck可能已经失效！\n请求类型：' + this.type + '\n请求URL：' + options.url)
    }
    if (this.type === 'video' || this.type === 'note') {
      result.is_mp4 = is_mp4
    }
    return result
  }
}
