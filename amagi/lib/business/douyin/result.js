import { DouyinData, GetDouyinID } from '../../business/douyin/index.js';
export default async function DouyinResult(config = { cookie: '' }, options = {}) {
    let result;
    switch (config.type) {
        case "\u4E8C\u7EA7\u8BC4\u8BBA\u6570\u636E" /* DouyinDataType.二级评论数据 */:
        case "\u7528\u6237\u4E3B\u9875\u6570\u636E" /* DouyinDataType.用户主页数据 */:
        case "\u7528\u6237\u4E3B\u9875\u89C6\u9891\u5217\u8868\u6570\u636E" /* DouyinDataType.用户主页视频列表数据 */:
        case "\u70ED\u70B9\u8BCD\u6570\u636E" /* DouyinDataType.热点词数据 */:
        case "\u641C\u7D22\u6570\u636E" /* DouyinDataType.搜索数据 */:
        case "\u5B98\u65B9emoji\u6570\u636E" /* DouyinDataType.官方emoji数据 */:
        case "\u52A8\u6001\u8868\u60C5\u6570\u636E" /* DouyinDataType.动态表情数据 */:
        case "\u97F3\u4E50\u6570\u636E" /* DouyinDataType.音乐数据 */:
        case "\u76F4\u64AD\u95F4\u4FE1\u606F\u6570\u636E" /* DouyinDataType.直播间信息数据 */:
        case "\u7533\u8BF7\u4E8C\u7EF4\u7801\u6570\u636E" /* DouyinDataType.申请二维码数据 */: {
            result = await new DouyinData(config.type, config.cookie).GetData(options);
            break;
        }
        case "\u8BC4\u8BBA\u6570\u636E" /* DouyinDataType.评论数据 */: {
            if (!options?.url) {
                result = await new DouyinData(config.type, config.cookie).GetData(options);
            }
            else {
                const iddata = await GetDouyinID(String(options.url));
                result = await new DouyinData(config.type, config.cookie).GetData({ ...options, ...iddata });
            }
            break;
        }
        case "\u5B9E\u51B5\u56FE\u7247\u56FE\u96C6\u6570\u636E" /* DouyinDataType.实况图片图集数据 */:
        case "\u5355\u4E2A\u89C6\u9891\u4F5C\u54C1\u6570\u636E" /* DouyinDataType.单个视频作品数据 */:
        case "\u56FE\u96C6\u4F5C\u54C1\u6570\u636E" /* DouyinDataType.图集作品数据 */: {
            if (!options?.url) {
                result = await new DouyinData(config.type, config.cookie).GetData(options);
            }
            else {
                const iddata = await GetDouyinID(String(options.url));
                result = await new DouyinData(config.type, config.cookie).GetData({ ...options, ...iddata });
            }
            break;
        }
        default:
            result = '';
            break;
    }
    return {
        code: result !== false && result !== '' ? 200 : 503,
        message: result !== false && result !== '' ? 'success' : 'error',
        data: result !== false && result !== '' ? result : null
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzdWx0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2J1c2luZXNzL2RvdXlpbi9yZXN1bHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQTtBQVEvRCxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssVUFBVSxZQUFZLENBQ3hDLFNBQXVCLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBa0IsRUFDckQsVUFBVSxFQUF1QjtJQUNqQyxJQUFJLE1BQVcsQ0FBQTtJQUNmLFFBQVEsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3BCLHdFQUEyQjtRQUMzQix3RUFBMkI7UUFDM0Isb0dBQStCO1FBQy9CLGlFQUEwQjtRQUMxQiwwREFBeUI7UUFDekIsb0VBQThCO1FBQzlCLHdFQUEyQjtRQUMzQiwwREFBeUI7UUFDekIsK0VBQTRCO1FBQzVCLDhFQUEyQixDQUFDLENBQUMsQ0FBQztZQUM1QixNQUFNLEdBQUcsTUFBTSxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUE7WUFDMUUsTUFBSztRQUNQLENBQUM7UUFDRCx5REFBd0IsQ0FBQyxDQUFDLENBQUM7WUFDekIsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQztnQkFDbEIsTUFBTSxHQUFHLE1BQU0sSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBQzVFLENBQUM7aUJBQU0sQ0FBQztnQkFDTixNQUFNLE1BQU0sR0FBRyxNQUFNLFdBQVcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUE7Z0JBQ3JELE1BQU0sR0FBRyxNQUFNLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEdBQUcsT0FBTyxFQUFFLEdBQUcsTUFBTSxFQUFFLENBQUMsQ0FBQTtZQUM5RixDQUFDO1lBQ0QsTUFBSztRQUNQLENBQUM7UUFDRCxzRkFBNkI7UUFDN0Isc0ZBQTZCO1FBQzdCLHVFQUEwQixDQUFDLENBQUMsQ0FBQztZQUMzQixJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDO2dCQUNsQixNQUFNLEdBQUcsTUFBTSxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUE7WUFDNUUsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLE1BQU0sTUFBTSxHQUFHLE1BQU0sV0FBVyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtnQkFDckQsTUFBTSxHQUFHLE1BQU0sSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsR0FBRyxPQUFPLEVBQUUsR0FBRyxNQUFNLEVBQUUsQ0FBQyxDQUFBO1lBQzlGLENBQUM7WUFDRCxNQUFLO1FBQ1AsQ0FBQztRQUNEO1lBQ0UsTUFBTSxHQUFHLEVBQUUsQ0FBQTtZQUNYLE1BQUs7SUFDVCxDQUFDO0lBQ0QsT0FBTztRQUNMLElBQUksRUFBRSxNQUFNLEtBQUssS0FBSyxJQUFJLE1BQU0sS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRztRQUNuRCxPQUFPLEVBQUUsTUFBTSxLQUFLLEtBQUssSUFBSSxNQUFNLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU87UUFDaEUsSUFBSSxFQUFFLE1BQU0sS0FBSyxLQUFLLElBQUksTUFBTSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJO0tBQ3hELENBQUE7QUFFSCxDQUFDIn0=