import checkuser from './cookie.js'
import { BiLiBiLiAPI, GetBilibiliData, wbi_sign } from '@ikenxuan/amagi'
import Config from '../../components/Config.js'
import Base from '../../components/Base.js'


export default class Bilidata extends Base {
  constructor (type) {
    super()
    this.type = type
    this.headers.Referer = 'https://api.bilibili.com/'
    this.headers.Cookie = Config.cookies.bilibili
  }

  async GetData (data) {
    let result, COMMENTSDATA, EMOJIDATA, PARAM
    switch (this.type) {
      case 'bilibilivideo': {
        const INFODATA = await GetBilibiliData('单个视频作品数据', Config.cookies.bilibili, { id_type: 'bvid', id: data.id })
        const DATA = await GetBilibiliData('单个视频下载信息数据', Config.cookies.bilibili, { avid: INFODATA.data.aid, cid: INFODATA.data.cid })
        const BASEURL = BiLiBiLiAPI.视频流信息({ avid: INFODATA.data.aid, cid: INFODATA.data.cid })
        const SIGN = await checkuser(BASEURL)
        PARAM = await wbi_sign(BiLiBiLiAPI.评论区明细({ number: Config.bilibili.bilibilinumcomments, type: 1, oid: INFODATA.data.aid }), Config.cookies.bilibili)
        COMMENTSDATA = await GetBilibiliData('评论数据', Config.cookies.bilibili, { number: Config.bilibili.bilibilinumcomments, commentstype: 1, oid: INFODATA.data.aid })
        EMOJIDATA = await GetBilibiliData('emoji数据', Config.cookies.bilibili)
        return { INFODATA, DATA, COMMENTSDATA, EMOJIDATA, USER: SIGN, TYPE: 'bilibilivideo' }
      }
      case 'workonly': {
        const data = await  GetBilibiliData('单个视频下载信息数据', '', { avid: data.avid, cid: data.cid })
      }
      case 'COMMENTS': {
        const INFODATA = await GetBilibiliData('单个视频作品数据', Config.cookies.bilibili, { id_type: 'bvid', id: data.id })
        const aCOMMENTSDATA = await GetBilibiliData('评论数据', Config.cookies.bilibili, { number: Config.bilibili.bilibilinumcomments, commentstype: 1, oid: INFODATA.data.aid })
        return aCOMMENTSDATA
      }
      case 'EMOJI':
        return await GetBilibiliData('emoji数据')
      case '申请二维码':
        return await GetBilibiliData('申请二维码', Config.cookies.bilibili)

      case '判断二维码状态': {
        result = await GetBilibiliData('二维码状态', Config.cookies.bilibili, { qrcode_key: data.qrcode_key })
        return result
      }

      case 'bangumivideo': {
        const INFO = await GetBilibiliData('番剧基本信息数据', Config.cookies.bilibili, { id: data.id })
        let isep
        if (data.id.startsWith('ss')) {
          data.id = data.id.replace('ss', '')
          isep = false
        } else if (data.id.startsWith('ep')) {
          data.id = data.id.replace('ep', '')
          isep = true
        }
        const QUERY = await checkuser(BiLiBiLiAPI.番剧明细({ id: data.id, isep }))
        result = { INFODATA: INFO, USER: QUERY, TYPE: 'bangumivideo' }
        return result
      }
      case '获取用户空间动态': {
        result = await GetBilibiliData('用户主页动态列表数据', Config.cookies.bilibili, { host_mid: data.host_mid })
        return result
      }

      case 'bilibilidynamic': {
        delete this.headers.Referer
        const dynamicINFO = await GetBilibiliData('动态详情数据', Config.cookies.bilibili, { dynamic_id: data.dynamic_id })
        const dynamicINFO_CARD = await GetBilibiliData('动态卡片数据', Config.cookies.bilibili, { dynamic_id: dynamicINFO.data.item.id_str })
        PARAM = await wbi_sign(BiLiBiLiAPI.评论区明细({ type: 1, oid: dynamicINFO_CARD.data.card.desc.rid, number: Config.bilibili.bilibilinumcomments }), Config.cookies.bilibili)
        this.headers.Referer = 'https://api.bilibili.com/'
        COMMENTSDATA = await GetBilibiliData('评论数据', Config.cookies.bilibili, { commentstype: mapping_table(dynamicINFO.data.item.type), oid: oid(dynamicINFO, dynamicINFO_CARD), number: Config.bilibili.bilibilinumcomments })
        EMOJIDATA = await GetBilibiliData('emoji数据')
        const USERDATA = await GetBilibiliData('用户主页数据', Config.cookies.bilibili, { host_mid: dynamicINFO.data.item.modules.module_author.mid })
        return { dynamicINFO, dynamicINFO_CARD, COMMENTSDATA, EMOJIDATA, USERDATA, TYPE: 'bilibilidynamic' }
      }

      case '用户名片信息': {
        result = await GetBilibiliData('用户主页数据', Config.cookies.bilibili, { host_mid: data.host_mid })
        return result
      }

      case '动态详情': {
        delete this.headers.Referer
        result = await GetBilibiliData('动态详情数据', Config.cookies.bilibili, { dynamic_id: data.dynamic_id })
        return result
      }

      case '动态卡片信息': {
        delete this.headers.Referer
        result = await GetBilibiliData('动态卡片数据', Config.cookies.bilibili, { dynamic_id: data.dynamic_id })
        return result
      }

      case '直播live': {
        const live_info = await GetBilibiliData('直播间信息', Config.cookies.bilibili, { room_id: data.room_id })
        const room_init_info = await GetBilibiliData('直播间初始化信息', Config.cookies.bilibili, { room_id: data.room_id })
        const USERDATA = await GetBilibiliData('用户主页数据', Config.cookies.bilibili, { host_mid: room_init_info.data.uid })
        return { TYPE: this.type, live_info, room_init_info, USERDATA }
      }
      default:
        break
    }
  }
}
function mapping_table (type) {
  const Array = {
    1: [ 'DYNAMIC_TYPE_AV', 'DYNAMIC_TYPE_PGC', 'DYNAMIC_TYPE_UGC_SEASON' ],
    11: [ 'DYNAMIC_TYPE_DRAW' ],
    12: [ 'DYNAMIC_TYPE_ARTICLE' ],
    17: [ 'DYNAMIC_TYPE_LIVE_RCMD', 'DYNAMIC_TYPE_FORWARD', 'DYNAMIC_TYPE_WORD', 'DYNAMIC_TYPE_COMMON_SQUARE' ],
    19: [ 'DYNAMIC_TYPE_MEDIALIST' ]
  }
  for (const key in Array) {
    if (Array[key].includes(type)) {
      return key
    }
  }
  return 1
}

function oid (dynamicINFO, dynamicINFO_CARD) {
  if (dynamicINFO.data.item.type == 'DYNAMIC_TYPE_WORD') {
    return dynamicINFO.data.item.id_str
  } else return dynamicINFO_CARD.data.card.desc.rid
}
