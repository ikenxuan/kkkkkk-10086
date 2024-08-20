import { DouyinAPI, Sign } from '../../business/douyin/index.js'
import { Networks } from '../../model/index.js'
export default class DouyinData {
  type
  headers
  URL
  constructor (type, cookie) {
    this.type = type
    this.headers = {
      Referer: 'https://www.douyin.com/',
      Cookie: cookie ? cookie.replace(/\s+/g, '') : '',
      Accept: '*/*',
      'Content-Type': 'application/json',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    }
  }
  async GetData (data = {}) {
    switch (this.type) {
      case "\u5355\u4E2A\u89C6\u9891\u4F5C\u54C1\u6570\u636E" /* DouyinDataType.单个视频作品数据 */:
      case "\u56FE\u96C6\u4F5C\u54C1\u6570\u636E" /* DouyinDataType.图集作品数据 */: {
        this.URL = DouyinAPI.视频或图集({ aweme_id: data.aweme_id })
        const VideoData = await this.GlobalGetData({
          url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
          method: 'GET',
          headers: this.headers
        })
        return VideoData
      }
      case "\u8BC4\u8BBA\u6570\u636E" /* DouyinDataType.评论数据 */: {
        this.URL = DouyinAPI.评论({ aweme_id: data.aweme_id, number: data.number })
        const CommentsData = await this.GlobalGetData({
          url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
          headers: this.headers
        })
        return CommentsData
      }
      case "\u4E8C\u7EA7\u8BC4\u8BBA\u6570\u636E" /* DouyinDataType.二级评论数据 */: {
        this.URL = DouyinAPI.二级评论({ aweme_id: data.aweme_id, comment_id: data.comment_id })
        const CommentReplyData = await this.GlobalGetData({
          url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
          headers: this.headers
        })
        return CommentReplyData
      }
      case "\u7528\u6237\u4E3B\u9875\u6570\u636E" /* DouyinDataType.用户主页数据 */: {
        this.URL = DouyinAPI.用户主页信息({ sec_uid: data.sec_uid })
        const UserInfoData = await this.GlobalGetData({
          url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
          headers: {
            ...this.headers,
            Referer: `https://www.douyin.com/user/${data.sec_uid}`
          }
        })
        return UserInfoData
      }
      case "\u5B98\u65B9emoji\u6570\u636E" /* DouyinDataType.官方emoji数据 */: {
        this.URL = DouyinAPI.表情()
        const EmojiData = await this.GlobalGetData({
          url: this.URL,
          headers: this.headers
        })
        return EmojiData
      }
      case "\u7528\u6237\u4E3B\u9875\u89C6\u9891\u5217\u8868\u6570\u636E" /* DouyinDataType.用户主页视频列表数据 */: {
        this.URL = DouyinAPI.用户主页视频({ sec_uid: data.sec_uid })
        const UserVideoListData = await this.GlobalGetData({
          url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
          headers: {
            ...this.headers,
            Referer: `https://www.douyin.com/user/${data.sec_uid}`
          }
        })
        return UserVideoListData
      }
      case "\u70ED\u70B9\u8BCD\u6570\u636E" /* DouyinDataType.热点词数据 */: {
        this.URL = DouyinAPI.热点词({ query: data.query })
        const SuggestWordsData = await this.GlobalGetData({
          url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
          headers: {
            ...this.headers,
            Referer: `https://www.douyin.com/search/${encodeURIComponent(String(data.query))}`
          }
        })
        return SuggestWordsData
      }
      case "\u641C\u7D22\u6570\u636E" /* DouyinDataType.搜索数据 */: {
        this.URL = DouyinAPI.搜索({ query: data.query })
        const SearchData = await this.GlobalGetData({
          url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
          headers: {
            ...this.headers,
            Referer: `https://www.douyin.com/https://www.douyin.com/search/${encodeURIComponent(String(data.query))}`
          }
        })
        return SearchData
      }
      case "\u52A8\u6001\u8868\u60C5\u6570\u636E" /* DouyinDataType.动态表情数据 */: {
        this.URL = DouyinAPI.互动表情()
        const ExpressionPlusData = await this.GlobalGetData({
          url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
          headers: this.headers
        })
        return ExpressionPlusData
      }
      case "\u97F3\u4E50\u6570\u636E" /* DouyinDataType.音乐数据 */: {
        this.URL = DouyinAPI.背景音乐({ music_id: data.music_id })
        const MusicData = await this.GlobalGetData({
          url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
          headers: this.headers
        })
        return MusicData
      }
      case "\u5B9E\u51B5\u56FE\u7247\u56FE\u96C6\u6570\u636E" /* DouyinDataType.实况图片图集数据 */: {
        this.URL = DouyinAPI.动图({ aweme_id: data.aweme_id })
        const LiveImages = await this.GlobalGetData({
          url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
          headers: {
            ...this.headers,
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1 Edg/126.0.0.0'
          }
        })
        return LiveImages
      }
      default:
        break
    }
  }
  async GlobalGetData (options) {
    const ResponseData = await new Networks(options).getData()
    if (ResponseData === '') {
      throw new Error('获取响应数据失败！抖音ck可能已经失效！\n请求类型：' + this.type + '\n请求URL：' + options.url)
    }
    return ResponseData
  }
}
