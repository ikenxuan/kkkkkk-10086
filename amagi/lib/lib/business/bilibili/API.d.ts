import { BilibiliDataOptionsMapKeys } from '../../types/index.js';
declare class BiLiBiLiAPI {
    登录基本信息(): string;
    视频详细信息(data: BilibiliDataOptionsMapKeys['VideoInfoParams']): string;
    视频流信息(data: BilibiliDataOptionsMapKeys['VideoStreamParams']): string;
    /** type参数详见https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/comment/readme.md#评论区类型代码 */
    评论区明细(data: BilibiliDataOptionsMapKeys['CommentParams']): string;
    表情列表(): string;
    番剧明细(data: BilibiliDataOptionsMapKeys['BangumiInfoParams']): string;
    番剧视频流信息(data: BilibiliDataOptionsMapKeys['BangumiStreamParams']): string;
    用户空间动态(data: BilibiliDataOptionsMapKeys['UserParams']): string;
    动态详情(data: BilibiliDataOptionsMapKeys['DynamicParams']): string;
    动态卡片信息(data: BilibiliDataOptionsMapKeys['DynamicParams']): string;
    用户名片信息(data: BilibiliDataOptionsMapKeys['UserParams']): string;
    直播间信息(data: BilibiliDataOptionsMapKeys['LiveRoomParams']): string;
    直播间初始化信息(data: BilibiliDataOptionsMapKeys['LiveRoomParams']): string;
    申请二维码(): string;
    二维码状态(data: BilibiliDataOptionsMapKeys['QrcodeParams']): string;
}
/** 该类下的所有方法只会返回拼接好参数后的 Url 地址，需要手动请求该地址以获取数据 */
declare const _default: BiLiBiLiAPI;
export default _default;
