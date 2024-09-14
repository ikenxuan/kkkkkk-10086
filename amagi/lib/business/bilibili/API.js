class BiLiBiLiAPI {
  登录基本信息 () {
    return 'https://api.bilibili.com/x/web-interface/nav'
  }
  视频详细信息 (data) {
    return `https://api.bilibili.com/x/web-interface/view?${data.id_type === 'bvid' ? 'bvid=' + data.id : 'aid=' + data.id}`
  }
  视频流信息 (data) {
    return `https://api.bilibili.com/x/player/playurl?avid=${data.avid}&cid=${data.cid}`
  }
  /** type参数详见https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/comment/readme.md#评论区类型代码 */
  评论区明细 (data) {
    return `https://api.bilibili.com/x/v2/reply?sort=1&ps=${data.number || 20}&type=${data.commentstype}&oid=${data.oid}`
  }
  表情列表 () {
    return 'https://api.bilibili.com/x/emote/user/panel/web?business=reply&web_location=0.0'
  }
  番剧明细 (data) {
    return `https://api.bilibili.com/pgc/view/web/season?${data.isep ? 'ep_id' : 'season_id'}=${data.id}`
  }
  番剧视频流信息 (data) {
    return `https://api.bilibili.com/pgc/player/web/playurl?cid=${data.cid}&ep_id=${data.ep_id}`
  }
  用户空间动态 (data) {
    return `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=${data.host_mid}`
  }
  动态详情 (data) {
    return `https://api.bilibili.com/x/polymer/web-dynamic/v1/detail?id=${data.dynamic_id}`
  }
  动态卡片信息 (data) {
    return `https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/get_dynamic_detail?dynamic_id=${data.dynamic_id}`
  }
  用户名片信息 (data) {
    return `https://api.bilibili.com/x/web-interface/card?mid=${data.host_mid}&photo=true`
  }
  直播间信息 (data) {
    return `https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${data.room_id}`
  }
  直播间初始化信息 (data) {
    return `https://api.live.bilibili.com/room/v1/Room/room_init?id=${data.room_id}`
  }
  申请二维码 () {
    return 'https://passport.bilibili.com/x/passport-login/web/qrcode/generate'
  }
  二维码状态 (data) {
    return `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${data.qrcode_key}`
  }
}
/** 该类下的所有方法只会返回拼接好参数后的 Url 地址，需要手动请求该地址以获取数据 */
export default new BiLiBiLiAPI()
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQVBJLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2J1c2luZXNzL2JpbGliaWxpL0FQSS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxNQUFNLFdBQVc7SUFFZixNQUFNO1FBQ0osT0FBTyw4Q0FBOEMsQ0FBQTtJQUN2RCxDQUFDO0lBRUQsTUFBTSxDQUFFLElBQTBDO1FBQ2hELE9BQU8saURBQWlELElBQUksQ0FBQyxPQUFPLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQTtJQUMxSCxDQUFDO0lBRUQsS0FBSyxDQUFFLElBQTRDO1FBQ2pELE9BQU8sa0RBQWtELElBQUksQ0FBQyxJQUFJLFFBQVEsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFBO0lBQ3RGLENBQUM7SUFFRCxnSEFBZ0g7SUFDaEgsS0FBSyxDQUFFLElBQXdDO1FBQzdDLE9BQU8saURBQWlELElBQUksQ0FBQyxNQUFNLElBQUksRUFBRSxTQUFTLElBQUksQ0FBQyxZQUFZLFFBQVEsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFBO0lBQ3ZILENBQUM7SUFFRCxJQUFJO1FBQ0YsT0FBTyxpRkFBaUYsQ0FBQTtJQUMxRixDQUFDO0lBRUQsSUFBSSxDQUFFLElBQTRDO1FBQ2hELE9BQU8sZ0RBQWdELElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQTtJQUN2RyxDQUFDO0lBRUQsT0FBTyxDQUFFLElBQThDO1FBQ3JELE9BQU8sdURBQXVELElBQUksQ0FBQyxHQUFHLFVBQVUsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFBO0lBQzlGLENBQUM7SUFFRCxNQUFNLENBQUUsSUFBcUM7UUFDM0MsT0FBTyx5RUFBeUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFBO0lBQ2pHLENBQUM7SUFFRCxJQUFJLENBQUUsSUFBd0M7UUFDNUMsT0FBTywrREFBK0QsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFBO0lBQ3pGLENBQUM7SUFFRCxNQUFNLENBQUUsSUFBd0M7UUFDOUMsT0FBTyx3RkFBd0YsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFBO0lBQ2xILENBQUM7SUFFRCxNQUFNLENBQUUsSUFBcUM7UUFDM0MsT0FBTyxxREFBcUQsSUFBSSxDQUFDLFFBQVEsYUFBYSxDQUFBO0lBQ3hGLENBQUM7SUFFRCxLQUFLLENBQUUsSUFBeUM7UUFDOUMsT0FBTywrREFBK0QsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFBO0lBQ3RGLENBQUM7SUFFRCxRQUFRLENBQUUsSUFBeUM7UUFDakQsT0FBTywyREFBMkQsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFBO0lBQ2xGLENBQUM7SUFFRCxLQUFLO1FBQ0gsT0FBTyxvRUFBb0UsQ0FBQTtJQUM3RSxDQUFDO0lBRUQsS0FBSyxDQUFFLElBQXVDO1FBQzVDLE9BQU8sNkVBQTZFLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQTtJQUN2RyxDQUFDO0NBQ0Y7QUFDRCxnREFBZ0Q7QUFDaEQsZUFBZSxJQUFJLFdBQVcsRUFBRSxDQUFBIn0=