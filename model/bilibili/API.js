export default class API {
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

  async COMMENTS() {
    return `https://api.bilibili.com/x/v2/reply/reply`
  }
}
export const BiLiBiLiAPI = new API()
