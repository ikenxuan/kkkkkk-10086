import { DouyinAPIParams } from '../../types/index.js'
declare class DouyinAPI {
  视频或图集(data: DouyinAPIParams["WorkParams"]): string;
  评论(data: DouyinAPIParams['WorkParams']): string;
  二级评论(data: DouyinAPIParams['CommentParams']): string;
  动图(data: DouyinAPIParams['WorkParams']): string;
  表情(): string;
  用户主页视频(data: DouyinAPIParams['UserParams']): string;
  用户主页信息(data: DouyinAPIParams['UserParams']): string;
  热点词(data: DouyinAPIParams['SearchParams']): string;
  搜索(data: DouyinAPIParams['SearchParams']): string;
  互动表情(): string;
  背景音乐(data: DouyinAPIParams['MusicParams']): string;
  直播间信息(data: DouyinAPIParams['LiveRoomParams']): string;
}
/** 该类下的所有方法只会返回拼接好参数后的 Url 地址，需要手动请求该地址以获取数据 */
declare const _default: DouyinAPI
export default _default
