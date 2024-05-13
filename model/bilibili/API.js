import { Config } from '#modules'

export default class API {
  申请二维码() {
    return 'https://passport.bilibili.com/x/passport-login/web/qrcode/generate'
  }

  判断二维码状态(qrcode_key) {
    return `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${qrcode_key}`
  }

  检查是否需要刷新(csrf) {
    return `https://passport.bilibili.com/x/passport-login/web/cookie/info?csrf=${csrf}`
  }

  refresh_csrf(correspondPath) {
    return `https://www.bilibili.com/correspond/1/${correspondPath}`
  }

  刷新Cookie() {
    return 'https://passport.bilibili.com/x/passport-login/web/cookie/refresh'
  }

  确认更新() {
    return 'https://passport.bilibili.com/x/passport-login/web/confirm/refresh'
  }

  LOGIN_INFO() {
    return 'https://api.bilibili.com/x/web-interface/nav'
  }
  INFO(id_type, id) {
    return `https://api.bilibili.com/x/web-interface/view?${id_type == 'bvid' ? 'bvid=' + id : 'aid=' + id}`
  }

  VIDEO(avid, cid) {
    return `https://api.bilibili.com/x/player/playurl?avid=${avid}&cid=${cid}`
  }

  /** type参数详见https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/comment/readme.md#评论区类型代码 */
  COMMENTS(type, oid) {
    return `https://api.bilibili.com/x/v2/reply?sort=1&ps=${Config.bilibilinumcomments}&type=${type}&oid=${oid}`
  }

  EMOJI() {
    return 'https://api.bilibili.com/x/emote/user/panel/web?business=reply&web_location=0.0'
  }

  bangumivideo(id, isep) {
    return `https://api.bilibili.com/pgc/view/web/season?${isep ? 'ep_id' : 'season_id'}=${id}`
  }

  bangumidata(cid, ep_id) {
    return `https://api.bilibili.com/pgc/player/web/playurl?cid=${cid}&ep_id=${ep_id}`
  }

  获取用户空间动态(host_mid) {
    return `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=${host_mid}`
  }

  动态详情(dynamic_id) {
    return `https://api.bilibili.com/x/polymer/web-dynamic/v1/detail?id=${dynamic_id}`
  }

  动态卡片信息(dynamic_id) {
    return `https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/get_dynamic_detail?dynamic_id=${dynamic_id}`
  }

  用户名片信息(mid) {
    return `https://api.bilibili.com/x/web-interface/card?mid=${mid}&photo=true`
  }
}
export const BiLiBiLiAPI = new API()
