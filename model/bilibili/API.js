export default class API {
  async 申请二维码() {
    return 'https://passport.bilibili.com/x/passport-login/web/qrcode/generate'
  }

  async 判断二维码状态(qrcode_key) {
    return `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${qrcode_key}`
  }

  async 检查是否需要刷新(csrf) {
    return `https://passport.bilibili.com/x/passport-login/web/cookie/info?csrf=${csrf}`
  }

  async refresh_csrf(correspondPath) {
    return `https://www.bilibili.com/correspond/1/${correspondPath}`
  }

  async 刷新Cookie() {
    return 'https://passport.bilibili.com/x/passport-login/web/cookie/refresh'
  }

  async 确认更新() {
    return 'https://passport.bilibili.com/x/passport-login/web/confirm/refresh'
  }

  async LOGIN_INFO() {
    return 'https://api.bilibili.com/x/web-interface/nav'
  }
  async INFO(bvid) {
    return `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`
  }

  /** 参数在后续逻辑补全 */
  async VIDEO(avid, cid) {
    return `https://api.bilibili.com/x/player/playurl?avid=${avid}&cid=${cid}`
  }

  async COMMENTS(type, oid) {
    return `https://api.bilibili.com/x/v2/reply?sort=1&ps=20&type=${type}&oid=${oid}`
  }

  async EMOJI() {
    return 'https://api.bilibili.com/x/emote/user/panel/web?business=reply&web_location=0.0'
  }
}
export const BiLiBiLiAPI = new API()
