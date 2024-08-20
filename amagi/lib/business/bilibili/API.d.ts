import { BilibiliAPIParams } from '../../types/index.js'
declare class BiLiBiLiAPI {
  登录基本信息(): string;
  视频详细信息(data: BilibiliAPIParams['VideoInfoParams']): string;
  视频流信息(data: BilibiliAPIParams['VideoStreamParams']): string;
  /** type参数详见https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/comment/readme.md#评论区类型代码 */
  评论区明细(data: BilibiliAPIParams['CommentParams']): string;
  表情列表(): string;
  番剧明细(data: BilibiliAPIParams['BangumiInfoParams']): string;
  番剧视频流信息(data: BilibiliAPIParams['BangumiStreamParams']): string;
  用户空间动态(data: BilibiliAPIParams['UserParams']): string;
  动态详情(data: BilibiliAPIParams['DynamicParams']): string;
  动态卡片信息(data: BilibiliAPIParams['DynamicParams']): string;
  用户名片信息(data: BilibiliAPIParams['UserParams']): string;
  直播间信息(data: BilibiliAPIParams['LiveRoomParams']): string;
  直播间初始化信息(data: BilibiliAPIParams['LiveRoomParams']): string;
  申请二维码(): string;
  二维码状态(data: BilibiliAPIParams['QrcodeParams']): string;
}
/** 该类下的所有方法只会返回拼接好参数后的 Url 地址，需要手动请求该地址以获取数据 */
declare const _default: BiLiBiLiAPI
export default _default
