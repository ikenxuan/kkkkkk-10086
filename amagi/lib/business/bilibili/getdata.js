import { BiLiBiLiAPI, qtparam, wbi_sign } from '../../business/bilibili/index.js'
import { Networks, logger } from '../../model/index.js'
export default class BilibiliData {
  type
  headers
  URL
  constructor (type, cookie) {
    this.type = type
    this.headers = {}
    this.headers.Referer = 'https://api.bilibili.com/'
    this.headers.Cookie = cookie ? cookie.replace(/\s+/g, '') : ''
    this.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0'
  }
  async GetData (data = {}) {
    let result
    switch (this.type) {
      case "\u5355\u4E2A\u89C6\u9891\u4F5C\u54C1\u6570\u636E" /* BilibiliDataType.单个视频作品数据 */: {
        const INFODATA = await this.GlobalGetData({ url: BiLiBiLiAPI.视频详细信息({ id_type: 'bvid', id: data.id }) })
        return INFODATA
      }
      case "\u5355\u4E2A\u89C6\u9891\u4E0B\u8F7D\u4FE1\u606F\u6570\u636E" /* BilibiliDataType.单个视频下载信息数据 */: {
        const BASEURL = BiLiBiLiAPI.视频流信息({ avid: data.avid, cid: data.cid })
        const SIGN = await qtparam(BASEURL, this.headers.Cookie)
        const DATA = await this.GlobalGetData({
          url: BiLiBiLiAPI.视频流信息({ avid: data.avid, cid: data.cid }) + SIGN.QUERY,
          headers: this.headers
        })
        return DATA
      }
      case "\u8BC4\u8BBA\u6570\u636E" /* BilibiliDataType.评论数据 */: {
        let COMMENTSDATA
        if (!data.bvid) {
          COMMENTSDATA = await this.GlobalGetData({ url: BiLiBiLiAPI.评论区明细({ commentstype: Number(data.commentstype), oid: data.oid, number: data.number }), headers: this.headers })
        }
        else {
          const INFODATA = await this.GlobalGetData({ url: BiLiBiLiAPI.视频详细信息({ id_type: 'bvid', id: data.bvid }) })
          const PARAM = await wbi_sign(BiLiBiLiAPI.评论区明细({ type: 1, oid: INFODATA.data.aid }), this.headers.Cookie)
          COMMENTSDATA = await this.GlobalGetData({ url: BiLiBiLiAPI.评论区明细({ commentstype: 1, oid: INFODATA.data.aid, number: data.number }) + PARAM, headers: this.headers })
        }
        return COMMENTSDATA
      }
      case "emoji\u6570\u636E" /* BilibiliDataType.emoji数据 */:
        return await this.GlobalGetData({ url: BiLiBiLiAPI.表情列表() })
      case "\u756A\u5267\u57FA\u672C\u4FE1\u606F\u6570\u636E" /* BilibiliDataType.番剧基本信息数据 */: {
        let isep
        if (data?.id?.startsWith('ss')) {
          data.id = data.id.replace('ss', '')
          isep = false
        }
        else if (data?.id?.startsWith('ep')) {
          data.id = data?.id?.replace('ep', '')
          isep = true
        }
        const INFO = await this.GlobalGetData({
          url: BiLiBiLiAPI.番剧明细({ id: data.id, isep }),
          headers: this.headers
        })
        return INFO
      }
      case "\u756A\u5267\u4E0B\u8F7D\u4FE1\u606F\u6570\u636E" /* BilibiliDataType.番剧下载信息数据 */:
        return await this.GlobalGetData({ url: BiLiBiLiAPI.番剧视频流信息({ cid: data.cid, ep_id: data.ep_id }) })
      case "\u7528\u6237\u4E3B\u9875\u52A8\u6001\u5217\u8868\u6570\u636E" /* BilibiliDataType.用户主页动态列表数据 */:
        delete this.headers.Referer
        result = await this.GlobalGetData({
          url: BiLiBiLiAPI.用户空间动态({ host_mid: data.host_mid }),
          headers: this.headers
        })
        return result
      case "\u52A8\u6001\u8BE6\u60C5\u6570\u636E" /* BilibiliDataType.动态详情数据 */: {
        delete this.headers.Referer
        const dynamicINFO = await this.GlobalGetData({
          url: BiLiBiLiAPI.动态详情({ dynamic_id: data.dynamic_id }),
          headers: this.headers
        })
        return dynamicINFO
      }
      case "\u52A8\u6001\u5361\u7247\u6570\u636E" /* BilibiliDataType.动态卡片数据 */: {
        delete this.headers.Referer
        const dynamicINFO_CARD = await this.GlobalGetData({
          url: BiLiBiLiAPI.动态卡片信息({ dynamic_id: data.dynamic_id }),
          headers: this.headers
        })
        return dynamicINFO_CARD
      }
      case "\u7528\u6237\u4E3B\u9875\u6570\u636E" /* BilibiliDataType.用户主页数据 */: {
        result = await this.GlobalGetData({
          url: BiLiBiLiAPI.用户名片信息({ host_mid: data.host_mid }),
          headers: this.headers
        })
        return result
      }
      case "\u76F4\u64AD\u95F4\u4FE1\u606F" /* BilibiliDataType.直播间信息 */: {
        result = await this.GlobalGetData({
          url: BiLiBiLiAPI.直播间信息({ room_id: data.room_id }),
          headers: this.headers
        })
        return result
      }
      case "\u76F4\u64AD\u95F4\u521D\u59CB\u5316\u4FE1\u606F" /* BilibiliDataType.直播间初始化信息 */: {
        result = await this.GlobalGetData({
          url: BiLiBiLiAPI.直播间初始化信息({ room_id: data.room_id }),
          headers: this.headers
        })
        return result
      }
      case "\u7533\u8BF7\u4E8C\u7EF4\u7801" /* BilibiliDataType.申请二维码 */: {
        result = await this.GlobalGetData({
          url: BiLiBiLiAPI.申请二维码(),
          headers: this.headers
        })
        return result
      }
      case "\u4E8C\u7EF4\u7801\u72B6\u6001" /* BilibiliDataType.二维码状态 */: {
        result = await new Networks({
          url: BiLiBiLiAPI.二维码状态({ qrcode_key: data.qrcode_key }),
          headers: this.headers
        }).getHeadersAndData()
        return result
      }
      case "\u767B\u5F55\u57FA\u672C\u4FE1\u606F" /* BilibiliDataType.登录基本信息 */: {
        result = await this.GlobalGetData({
          url: BiLiBiLiAPI.登录基本信息(),
          headers: this.headers
        })
        return result
      }
      default:
        return null
    }
  }
  async GlobalGetData (options) {
    const result = await new Networks(options).getData()
    if (result && result.code !== 0) {
      const errorMessage = errorMap[result.code] || '未知错误'
      logger.warn(`响应数据失败！\n请求接口类型：${this.type}\n请求URL：${options.url}\n错误代码：${result.code}，\n含义：${errorMessage}`)
      return result
    }
    else {
      return result
    }
  }
}
const errorMap = {
  '-1': '应用程序不存在或已被封禁',
  '-2': 'Access Key 错误',
  '-3': 'API 校验密匙错误',
  '-4': '调用方对该 Method 没有权限',
  '-101': '账号未登录',
  '-102': '账号被封停',
  '-103': '积分不足',
  '-104': '硬币不足',
  '-105': '验证码错误',
  '-106': '账号非正式会员或在适应期',
  '-107': '应用不存在或者被封禁',
  '-108': '未绑定手机',
  '-110': '未绑定手机',
  '-111': 'csrf 校验失败',
  '-112': '系统升级中',
  '-113': '账号尚未实名认证',
  '-114': '请先绑定手机',
  '-115': '请先完成实名认证',
  '-304': '木有改动',
  '-307': '撞车跳转',
  '-352': '风控校验失败 (UA 或 wbi 参数不合法)',
  '-400': '请求错误',
  '-401': '未认证 (或非法请求)',
  '-403': '访问权限不足',
  '-404': '啥都木有',
  '-405': '不支持该方法',
  '-409': '冲突',
  '-412': '请求被拦截 (客户端 ip 被服务端风控)',
  '-500': '服务器错误',
  '-503': '过载保护,服务暂不可用',
  '-504': '服务调用超时',
  '-509': '超出限制',
  '-616': '上传文件不存在',
  '-617': '上传文件太大',
  '-625': '登录失败次数太多',
  '-626': '用户不存在',
  '-628': '密码太弱',
  '-629': '用户名或密码错误',
  '-632': '操作对象数量限制',
  '-643': '被锁定',
  '-650': '用户等级太低',
  '-652': '重复的用户',
  '-658': 'Token 过期',
  '-662': '密码时间戳过期',
  '-688': '地理区域限制',
  '-689': '版权限制',
  '-701': '扣节操失败',
  '-799': '请求过于频繁，请稍后再试',
  '-8888': '对不起，服务器开小差了~ (ಥ﹏ಥ)'
}
