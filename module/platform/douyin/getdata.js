import { getDouyinData } from '@ikenxuan/amagi'
import Config from '../../utils/Config.js'
import Base from '../../utils/Base.js'

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
        const VideoData = await getDouyinData('聚合解析', Config.cookies.douyin, { aweme_id: data.id })
        const CommentsData = Config.douyin.comments
          ? await getDouyinData('评论数据', Config.cookies.douyin, {
            aweme_id: data.id,
            number: Config.douyin.numcomments
          })
          : { data: null }
        if (VideoData !== '') VideoData.is_mp4 = data.is_mp4
        return { VideoData, CommentsData }
      }

      case 'LiveImage': {
        const LiveImageData = await getDouyinData('合辑作品数据', Config.cookies.douyin, { aweme_id: data.id })
        return { LiveImageData }
      }
      case 'Live':
      case 'UserInfoData': {
        const UserInfoData = await getDouyinData('用户主页数据', Config.cookies.douyin, { sec_uid: data.user_id })
        return UserInfoData
      }
      case 'Emoji': {
        const EmojiData = await getDouyinData('Emoji数据')
        return EmojiData
      }
      case 'UserVideosList': {
        const UserVideoListData = await getDouyinData('用户主页视频列表数据', Config.cookies.douyin, { sec_uid: data.user_id })
        return UserVideoListData
      }
      case 'SuggestWords': {
        const SuggestWordsData = await getDouyinData('热点词数据', Config.cookies.douyin, { query: data.query })
        return SuggestWordsData
      }
      case 'Search': {
        const SearchData = await getDouyinData('搜索数据', Config.cookies.douyin, { query: data.query })
        return SearchData
      }
      case 'Music': {
        const MusicData = await getDouyinData('音乐数据', Config.cookies.douyin, { music_id: data.music_id })
        return MusicData
      }
      default:
        break
    }
  }
}
