import { DouyinAPI, Sign } from '../../business/douyin/index.js';
import { Networks } from '../../model/index.js';
export default class DouyinData {
    type;
    headers;
    URL;
    constructor(type, cookie) {
        this.type = type;
        this.headers = {
            Referer: 'https://www.douyin.com/',
            Cookie: cookie ? cookie.replace(/\s+/g, '') : '',
            Accept: '*/*',
            'Content-Type': 'application/json',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        };
    }
    async GetData(data = {}) {
        switch (this.type) {
            case '单个视频作品数据':
            case '图集作品数据': {
                this.URL = DouyinAPI.视频或图集({ aweme_id: data.aweme_id });
                const VideoData = await this.GlobalGetData({
                    url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
                    method: 'GET',
                    headers: this.headers
                });
                return VideoData;
            }
            case '评论数据': {
                let cursor = data.cursor || 50; // 初始游标值
                const maxPageSize = 50; // 接口单次请求的最大评论数量
                let fetchedComments = []; // 用于存储实际获取的所有评论
                let tmpresp = {};
                // 循环直到获取到足够数量的评论
                while (fetchedComments.length < Number(data.number || 50)) {
                    // 计算本次请求需要获取的评论数量，确保不超过剩余需要获取的数量
                    const requestCount = Math.min(Number(data.number || 50) - fetchedComments.length, maxPageSize);
                    // 构建请求URL
                    const url = DouyinAPI.评论({
                        aweme_id: data.aweme_id,
                        number: requestCount,
                        cursor
                    });
                    // 发起请求获取评论数据
                    const response = await this.GlobalGetData({
                        url: `${url}&a_bogus=${Sign.AB(url)}`,
                        headers: this.headers
                    });
                    if (!response.comments) {
                        response.comments = [];
                    }
                    // 将获取到的评论数据添加到数组中
                    fetchedComments.push(...response.comments);
                    // 更新tmpresp为最后一次请求的响应
                    tmpresp = response;
                    // 如果本次请求的评论数量小于请求的数量，说明已经没有更多评论了
                    if (response.comments.length < requestCount) {
                        break;
                    }
                    // 更新游标值，准备下一次请求
                    cursor = response.cursor;
                }
                // 使用最后一次请求的接口响应格式，替换其中的评论数据
                const finalResponse = {
                    ...tmpresp,
                    comments: data.number === 0 ? [] : fetchedComments.slice(0, Number(data.number || 50)),
                    cursor: data.number === 0 ? 0 : fetchedComments.length
                };
                return finalResponse;
            }
            case '二级评论数据': {
                this.URL = DouyinAPI.二级评论({ aweme_id: data.aweme_id, comment_id: data.comment_id });
                const CommentReplyData = await this.GlobalGetData({
                    url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
                    headers: this.headers
                });
                return CommentReplyData;
            }
            case '用户主页数据': {
                this.URL = DouyinAPI.用户主页信息({ sec_uid: data.sec_uid });
                const UserInfoData = await this.GlobalGetData({
                    url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
                    headers: {
                        ...this.headers,
                        Referer: `https://www.douyin.com/user/${data.sec_uid}`
                    }
                });
                return UserInfoData;
            }
            case '官方emoji数据': {
                this.URL = DouyinAPI.表情();
                const EmojiData = await this.GlobalGetData({
                    url: this.URL,
                    headers: this.headers
                });
                return EmojiData;
            }
            case '用户主页视频列表数据': {
                this.URL = DouyinAPI.用户主页视频({ sec_uid: data.sec_uid });
                const UserVideoListData = await this.GlobalGetData({
                    url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
                    headers: {
                        ...this.headers,
                        Referer: `https://www.douyin.com/user/${data.sec_uid}`
                    }
                });
                return UserVideoListData;
            }
            case '热点词数据': {
                this.URL = DouyinAPI.热点词({ query: data.query });
                const SuggestWordsData = await this.GlobalGetData({
                    url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
                    headers: {
                        ...this.headers,
                        Referer: `https://www.douyin.com/search/${encodeURIComponent(String(data.query))}`
                    }
                });
                return SuggestWordsData;
            }
            case '搜索数据': {
                this.URL = DouyinAPI.搜索({ query: data.query });
                const SearchData = await this.GlobalGetData({
                    url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
                    headers: {
                        ...this.headers,
                        Referer: `https://www.douyin.com/search/${encodeURIComponent(String(data.query))}`
                    }
                });
                return SearchData;
            }
            case '动态表情数据': {
                this.URL = DouyinAPI.互动表情();
                const ExpressionPlusData = await this.GlobalGetData({
                    url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
                    headers: this.headers
                });
                return ExpressionPlusData;
            }
            case '音乐数据': {
                this.URL = DouyinAPI.背景音乐({ music_id: data.music_id });
                const MusicData = await this.GlobalGetData({
                    url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
                    headers: this.headers
                });
                return MusicData;
            }
            case '实况图片图集数据': {
                this.URL = DouyinAPI.动图({ aweme_id: data.aweme_id });
                const LiveImages = await this.GlobalGetData({
                    url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
                    headers: {
                        ...this.headers,
                        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1 Edg/126.0.0.0'
                    }
                });
                return LiveImages;
            }
            case '直播间信息数据': {
                this.URL = DouyinAPI.用户主页信息({ sec_uid: data.sec_uid });
                const UserInfoData = await this.GlobalGetData({
                    url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
                    headers: {
                        ...this.headers,
                        Referer: `https://www.douyin.com/user/${data.sec_uid}`
                    }
                });
                if (UserInfoData.user.live_status !== 1)
                    throw new Error(UserInfoData.user.nickname + '未开启直播！');
                const room_data = JSON.parse(UserInfoData.user.room_data);
                this.URL = DouyinAPI.直播间信息({ room_id: UserInfoData.user.room_id_str, web_rid: room_data.owner.web_rid });
                const LiveRoomData = await this.GlobalGetData({
                    url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
                    headers: {
                        ...this.headers,
                        Referer: `https://live.douyin.com/${room_data.owner.web_rid}`
                    }
                });
                return LiveRoomData;
            }
            case '申请二维码数据': {
                this.URL = DouyinAPI.申请二维码({ verify_fp: data.verify_fp });
                const LoginQrcodeStatusData = await this.GlobalGetData({
                    url: `${this.URL}&a_bogus=${Sign.AB(this.URL)}`,
                    headers: this.headers
                });
            }
            default:
                break;
        }
    }
    async GlobalGetData(options) {
        const ResponseData = await new Networks(options).getData();
        if (ResponseData === '') {
            throw new Error('获取响应数据失败！接口返回内容为空\n你的抖音ck可能已经失效！\n请求类型：' + this.type + '\n请求URL：' + options.url);
        }
        return ResponseData;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0ZGF0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9idXNpbmVzcy9kb3V5aW4vZ2V0ZGF0YS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxNQUFNLHVCQUF1QixDQUFBO0FBQ3ZELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxhQUFhLENBQUE7QUFHdEMsTUFBTSxDQUFDLE9BQU8sT0FBTyxVQUFVO0lBQzdCLElBQUksQ0FBNkI7SUFDakMsT0FBTyxDQUFLO0lBQ1osR0FBRyxDQUFvQjtJQUN2QixZQUFhLElBQWlDLEVBQUUsTUFBMEI7UUFDeEUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUE7UUFDaEIsSUFBSSxDQUFDLE9BQU8sR0FBRztZQUNiLE9BQU8sRUFBRSx5QkFBeUI7WUFDbEMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDaEQsTUFBTSxFQUFFLEtBQUs7WUFDYixjQUFjLEVBQUUsa0JBQWtCO1lBQ2xDLGlCQUFpQixFQUFFLGlEQUFpRDtZQUNwRSxZQUFZLEVBQUUsaUhBQWlIO1NBQ2hJLENBQUE7SUFDSCxDQUFDO0lBRUQsS0FBSyxDQUFDLE9BQU8sQ0FBRSxPQUFPLEVBQXVCO1FBQzNDLFFBQVEsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2xCLEtBQUssVUFBVSxDQUFDO1lBQ2hCLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDZCxJQUFJLENBQUMsR0FBRyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQWtCLEVBQUUsQ0FBQyxDQUFBO2dCQUNqRSxNQUFNLFNBQVMsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUM7b0JBQ3pDLEdBQUcsRUFBRSxH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