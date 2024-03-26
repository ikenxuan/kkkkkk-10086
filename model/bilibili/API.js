export default class API {
  async INFO(bvid) {
    return `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`
  }

  async VIDEO(avid, cid) {
    return `https://api.bilibili.com/x/player/playurl?avid=${avid}&cid=${cid}&platform=html5`
  }
}
export const BiLiBiLiAPI = new API()
