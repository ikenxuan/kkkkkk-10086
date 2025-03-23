import { BiLiBiLiAPI, qtparam, } from '../../business/bilibili/index.js';
import { Networks, logger } from '../../model/index.js';
export default class BilibiliData {
    type;
    headers;
    URL;
    constructor(type, cookie) {
        this.type = type;
        this.headers = {
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
          'cache-control': 'max-age=0',
          'priority': 'u=0, i',
          'sec-ch-ua': '\'Microsoft Edge\';v=\'131\', \'Chromium\';v=\'131\', \'Not_A Brand\';v=\'24\'',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '\'Windows\'',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'none',
          'sec-fetch-user': '?1',
          'upgrade-insecure-requests': '1',
          referer: 'https://www.bilibili.com/',
          cookie: cookie ? cookie.replace(/\s+/g, '') : ''
        }
    }
    async GetData(data = {}) {
        let result;
        switch (this.type) {
            case '单个视频作品数据': {
                const INFODATA = await this.GlobalGetData({ url: BiLiBiLiAPI.视频详细信息({ id_type: data.id_type, id: data.id }) });
                return INFODATA;
            }
            case '单个视频下载信息数据': {
                const BASEURL = BiLiBiLiAPI.视频流信息({ avid: data.avid, cid: data.cid });
                const SIGN = await qtparam(BASEURL, this.headers.Cookie);
                const DATA = await this.GlobalGetData({
                    url: BiLiBiLiAPI.视频流信息({ avid: data.avid, cid: data.cid }) + SIGN.QUERY,
                    headers: this.headers
                });
                return DATA;
            }
            case '评论数据': {
                let fetchedComments = [];
                let pn = data.pn || 1; // 页码从1开始
                const maxRequestCount = 100; // 设置一个最大请求次数限制
                const commentGrowthStabilized = 5; // 设置一个连续几次请求评论增长相同的阈值
                let lastFetchedCount = 0; // 上一次请求获取的评论数量
                let stabilizedCount = 0; // 连续几次请求评论增长相同的计数器
                let requestCount = 0; // 初始化请求计数器
                let tmpresp;
                if (!data.bvid) {
                    while (fetchedComments.length < Number(data.number || 20) && requestCount < maxRequestCount) {
                        if (data.number === 0) {
                            // 如果请求的评论数量为0，那么不需要进行请求
                            requestCount = 0;
                        }
                        else {
                            // 否则，计算需要请求的评论数量
                            requestCount = Math.min(20, Number(data.number) - fetchedComments.length);
                        }
                        const url = BiLiBiLiAPI.评论区明细({
                            type: data.type,
                            oid: data.oid,
                            number: requestCount,
                            pn
                        });
                        const response = await this.GlobalGetData({
                            url: url,
                            headers: this.headers
                        });
                        tmpresp = response;
                        // 当请求0条评论的时候，replies为null，需额外判断
                        const currentCount = response.data.replies ? response.data.replies.length : 0;
                        fetchedComments.push(...(response.data.replies || []));
                        // 检查评论增长是否稳定
                        if (currentCount === lastFetchedCount) {
                            stabilizedCount++;
                        }
                        else {
                            stabilizedCount = 0;
                        }
                        lastFetchedCount = currentCount;
                        // 如果增长稳定，并且增长量为0，或者请求次数达到最大值，则停止请求
                        if (stabilizedCount >= commentGrowthStabilized || requestCount >= maxRequestCount) {
                            break;
                        }
                        pn++;
                        requestCount++;
                    }
                }
                else {
                    const INFODATA = await this.GlobalGetData({ url: BiLiBiLiAPI.视频详细信息({ id_type: data.id_type, id: data.bvid }) });
                    while (fetchedComments.length < Number(data.number || 20) && requestCount < maxRequestCount) {
                        let requestCount = Math.min(20, Number(data.number) - fetchedComments.length);
                        const url = BiLiBiLiAPI.评论区明细({
                            type: data.type,
                            oid: INFODATA.data.oid,
                            number: requestCount,
                            pn
                        });
                        const response = await this.GlobalGetData({
                            url: url,
                            headers: this.headers
                        });
                        tmpresp = response;
                        // 当请求0条评论的时候，replies为null，需额外判断
                        const currentCount = response.data.replies ? response.data.replies.length : 0;
                        fetchedComments.push(...(response.data.replies || []));
                        // 检查评论增长是否稳定
                        if (currentCount === lastFetchedCount) {
                            stabilizedCount++;
                        }
                        else {
                            stabilizedCount = 0;
                        }
                        lastFetchedCount = currentCount;
                        // 如果增长稳定，并且增长量为0，或者请求次数达到最大值，则停止请求
                        if (stabilizedCount >= commentGrowthStabilized || requestCount >= maxRequestCount) {
                            break;
                        }
                        pn++;
                        requestCount++;
                    }
                }
                const finalResponse = {
                    ...tmpresp,
                    data: {
                        ...tmpresp.data,
                        // 去重
                        replies: Array.from(new Map(fetchedComments.map(item => [item.rpid, item])).values()).slice(0, Number(data.number))
                    }
                };
                return finalResponse;
            }
            case 'emoji数据':
                return await this.GlobalGetData({ url: BiLiBiLiAPI.表情列表() });
            case '番剧基本信息数据': {
                let isep;
                if (data?.id?.startsWith('ss')) {
                    data.id = data.id.replace('ss', '');
                    isep = false;
                }
                else if (data?.id?.startsWith('ep')) {
                    data.id = data?.id?.replace('ep', '');
                    isep = true;
                }
                const INFO = await this.GlobalGetData({
                    url: BiLiBiLiAPI.番剧明细({ id: data.id, isep }),
                    headers: this.headers
                });
                return INFO;
            }
            case '番剧下载信息数据':
                return await this.GlobalGetData({ url: BiLiBiLiAPI.番剧视频流信息({ cid: data.cid, ep_id: data.ep_id }) });
            case '用户主页动态列表数据':
                delete this.headers.Referer;
                result = await this.GlobalGetData({
                    url: BiLiBiLiAPI.用户空间动态({ host_mid: data.host_mid }),
                    headers: this.headers
                });
                return result;
            case '动态详情数据': {
                delete this.headers.Referer;
                const dynamicINFO = await this.GlobalGetData({
                    url: BiLiBiLiAPI.动态详情({ dynamic_id: data.dynamic_id }),
                    headers: this.headers
                });
                return dynamicINFO;
            }
            case '动态卡片数据': {
                delete this.headers.Referer;
                const dynamicINFO_CARD = await this.GlobalGetData({
                    url: BiLiBiLiAPI.动态卡片信息({ dynamic_id: data.dynamic_id }),
                    headers: this.headers
                });
                return dynamicINFO_CARD;
            }
            case '用户主页数据': {
                result = await this.GlobalGetData({
                    url: BiLiBiLiAPI.用户名片信息({ host_mid: data.host_mid }),
                    headers: this.headers
                });
                return result;
            }
            case '直播间信息': {
                result = await this.GlobalGetData({
                    url: BiLiBiLiAPI.直播间信息({ room_id: data.room_id }),
                    headers: this.headers
                });
                return result;
            }
            case '直播间初始化信息': {
                result = await this.GlobalGetData({
                    url: BiLiBiLiAPI.直播间初始化信息({ room_id: data.room_id }),
                    headers: this.headers
                });
                return result;
            }
            case '申请二维码': {
                result = await this.GlobalGetData({
                    url: BiLiBiLiAPI.申请二维码(),
                    headers: this.headers
                });
                return result;
            }
            case '二维码状态': {
                result = await new Networks({
                    url: BiLiBiLiAPI.二维码状态({ qrcode_key: data.qrcode_key }),
                    headers: this.headers
                }).getHeadersAndData();
                return result;
            }
            case '登录基本信息': {
                result = await this.GlobalGetData({
                    url: BiLiBiLiAPI.登录基本信息(),
                    headers: this.headers
                });
                return result;
            }
            default:
                return null;
        }
    }
    async GlobalGetData(options) {
        const result = await new Networks(options).getData();
        if (result && result.code !== 0) {
            const errorMessage = errorMap[result.code] || '未知错误';
            logger.warn(`获取响应数据失败！\n请求接口类型：${this.type}\n请求URL：${options.url}\n错误代码：${result.code}，\n含义：${errorMessage}`);
            return result;
        }
        else {
            return result;
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
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0ZGF0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9idXNpbmVzcy9iaWxpYmlsaS9nZXRkYXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxXQUFXLEVBQUUsT0FBTyxHQUFHLE1BQU0seUJBQXlCLENBQUE7QUFDL0QsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsTUFBTSxhQUFhLENBQUE7QUFPOUMsTUFBTSxDQUFDLE9BQU8sT0FBTyxZQUFZO0lBQy9CLElBQUksQ0FBK0I7SUFDbkMsT0FBTyxDQUFLO0lBQ1osR0FBRyxDQUFvQjtJQUN2QixZQUFhLElBQW1DLEVBQUUsTUFBMEI7UUFDMUUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUE7UUFDaEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUE7UUFDakIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEdBQUcsMkJBQTJCLENBQUE7UUFDbEQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFBO1FBQzlELElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLEdBQUcsK0hBQStILENBQUE7SUFDOUosQ0FBQztJQUVELEtBQUssQ0FBQyxPQUFPLENBQUUsT0FBTyxFQUF5QjtRQUM3QyxJQUFJLE1BQVcsQ0FBQTtRQUNmLFFBQVEsSUFBSSxDQUFDLElBQXFDLEVBQUUsQ0FBQztZQUNuRCxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hCLE1BQU0sUUFBUSxHQUFRLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFLEdBQUcsRUFBRSxXQUFXLENBQUMsTUFBTSxDQUFDLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUUs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
