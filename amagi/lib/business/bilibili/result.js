import { BilibiliData, GetBilibiliID, av2bv, bv2av } from '../../business/bilibili/index.js';
/**
 *
 * @param options
 * @param config
 * @returns
 */
export default async function BilibiliResult(config = { cookie: '' }, options) {
    let data;
    switch (config.type) {
        case "\u7528\u6237\u4E3B\u9875\u6570\u636E" /* BilibiliDataType.用户主页数据 */:
        case "emoji\u6570\u636E" /* BilibiliDataType.emoji数据 */:
        case "\u8BC4\u8BBA\u6570\u636E" /* BilibiliDataType.评论数据 */:
        case "\u756A\u5267\u4E0B\u8F7D\u4FE1\u606F\u6570\u636E" /* BilibiliDataType.番剧下载信息数据 */:
        case "\u7528\u6237\u4E3B\u9875\u52A8\u6001\u5217\u8868\u6570\u636E" /* BilibiliDataType.用户主页动态列表数据 */:
        case "\u52A8\u6001\u8BE6\u60C5\u6570\u636E" /* BilibiliDataType.动态详情数据 */:
        case "\u52A8\u6001\u5361\u7247\u6570\u636E" /* BilibiliDataType.动态卡片数据 */:
        case "\u76F4\u64AD\u95F4\u4FE1\u606F" /* BilibiliDataType.直播间信息 */:
        case "\u76F4\u64AD\u95F4\u521D\u59CB\u5316\u4FE1\u606F" /* BilibiliDataType.直播间初始化信息 */:
        case "\u4E8C\u7EF4\u7801\u72B6\u6001" /* BilibiliDataType.二维码状态 */:
        case "\u7533\u8BF7\u4E8C\u7EF4\u7801" /* BilibiliDataType.申请二维码 */:
        case "\u767B\u5F55\u57FA\u672C\u4FE1\u606F" /* BilibiliDataType.登录基本信息 */: {
            data = await new BilibiliData(config.type, config.cookie).GetData(options);
            break;
        }
        case "\u5355\u4E2A\u89C6\u9891\u4E0B\u8F7D\u4FE1\u606F\u6570\u636E" /* BilibiliDataType.单个视频下载信息数据 */: {
            if (!options?.url) {
                data = await new BilibiliData(config.type, config.cookie).GetData(options);
            }
            else {
                const iddata = await GetBilibiliID(options?.url);
                const infoData = await new BilibiliData("\u5355\u4E2A\u89C6\u9891\u4F5C\u54C1\u6570\u636E" /* BilibiliDataType.单个视频作品数据 */, config.cookie).GetData(iddata);
                data = await new BilibiliData(config.type, config.cookie).GetData({ avid: infoData.data.aid, cid: infoData.data.cid });
            }
            break;
        }
        case "\u5355\u4E2A\u89C6\u9891\u4F5C\u54C1\u6570\u636E" /* BilibiliDataType.单个视频作品数据 */: {
            if (!options?.url) {
                data = await new BilibiliData(config.type, config.cookie).GetData(options);
            }
            else {
                const iddata = await GetBilibiliID(options?.url);
                data = await new BilibiliData(config.type, config.cookie).GetData(iddata);
            }
            break;
        }
        case "\u756A\u5267\u57FA\u672C\u4FE1\u606F\u6570\u636E" /* BilibiliDataType.番剧基本信息数据 */: {
            const hasid = options?.id || null;
            if (hasid) {
                data = await new BilibiliData(config.type, config.cookie).GetData({ id: options?.id });
            }
            else {
                const iddata = await GetBilibiliID(options?.url);
                data = await new BilibiliData(config.type, config.cookie).GetData(iddata);
            }
            break;
        }
        case 'AV转BV': {
            const replaceavid = options?.avid?.toString() ? (options?.avid?.toString()).replace(/^av/i, '') : '';
            data = av2bv(Number(replaceavid));
            break;
        }
        case 'BV转AV': {
            const bvid = options?.bvid || '';
            data = 'av' + bv2av(bvid);
            break;
        }
        default:
            data = '';
            break;
    }
    return {
        code: data !== '' ? 200 : 503,
        message: data !== '' ? 'success' : 'error',
        data: data !== '' ? data : null
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzdWx0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2J1c2luZXNzL2JpbGliaWxpL3Jlc3VsdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLE1BQU0seUJBQXlCLENBQUE7QUFXbkY7Ozs7O0dBS0c7QUFDSCxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssVUFBVSxjQUFjLENBQzFDLFNBQVMsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFrQixFQUN2QyxPQUE2QjtJQUM3QixJQUFJLElBQVMsQ0FBQTtJQUNiLFFBQVEsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3BCLDBFQUE2QjtRQUM3Qix3REFBOEI7UUFDOUIsNERBQTJCO1FBQzNCLHdGQUErQjtRQUMvQixzR0FBaUM7UUFDakMsMEVBQTZCO1FBQzdCLDBFQUE2QjtRQUM3QixtRUFBNEI7UUFDNUIsd0ZBQStCO1FBQy9CLG1FQUE0QjtRQUM1QixtRUFBNEI7UUFDNUIseUVBQTRCLENBQUMsQ0FBQyxDQUFDO1lBQzdCLElBQUksR0FBRyxNQUFNLElBQUksWUFBWSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLE1BQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUE7WUFDcEYsTUFBSztRQUNQLENBQUM7UUFDRCxxR0FBZ0MsQ0FBQyxDQUFDLENBQUM7WUFDakMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQztnQkFDbEIsSUFBSSxHQUFHLE1BQU0sSUFBSSxZQUFZLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsTUFBZ0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQTtZQUN0RixDQUFDO2lCQUFNLENBQUM7Z0JBQ04sTUFBTSxNQUFNLEdBQUcsTUFBTSxhQUFhLENBQUMsT0FBTyxFQUFF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