import { Config } from '#components'
import Base from '../../components/Base.js'
import { GetDouyinData } from '@ikenxuan/amagi'

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
        const VideoData = await GetDouyinData('单个视频作品数据', Config.cookies.douyin, { aweme_id:  data.id })
        const CommentsData = Config.douyin.comments
          ? await GetDouyinData('评论数据', Config.cookies.douyin, {
            aweme_id: data.id,
            number: Config.douyin.numcomments
          })
          : { data: null }
        if(VideoData!== '') VideoData.is_mp4 = data.is_mp4
        return { VideoData, CommentsData }
      }

      case 'LiveImage': {
        const LiveImageData = await GetDouyinData('实况图片图集数据', Config.cookies.douyin, { aweme_id: data.id })
        return { LiveImageData }
      }
      case 'UserInfoData': {
        const UserInfoData = await GetDouyinData('用户主页数据', Config.cookies.douyin, { sec_uid: data.user_id })
        return UserInfoData
      }
      case 'Emoji': {
        const EmojiData = await GetDouyinData('官方emoji数据')
        return EmojiData
      }
      case 'UserVideosList': {
        const UserVideoListData = await GetDouyinData('用户主页视频列表数据', Config.cookies.douyin, { sec_uid: data.user_id })
        return UserVideoListData
      }
      case 'SuggestWords': {
        const SuggestWordsData = await GetDouyinData('热点词数据', Config.cookies.douyin, { query: data.query })
        return SuggestWordsData
      }
      case 'Search': {
        const SearchData = await GetDouyinData('搜索数据', Config.cookies.douyin, { query: data.query })
        return SearchData
      }
      case 'Music': {
        const MusicData = await GetDouyinData('音乐数据', Config.cookies.douyin, { music_id: data.music_id })
        return MusicData
      }
      default:
        break
    }
  }
}
