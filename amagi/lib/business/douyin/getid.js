import { logger, Networks } from '../../model/index.js';
/**
 * return aweme_id
 * @param {string} url 视频分享连接
 * @returns
 */
export default async function GetDouyinID(url) {
    const longLink = await new Networks({ url }).getLongLink();
    let result = {};
    switch (true) {
        case /share\/slides\/(\d+)/.test(longLink): {
            const newres = await new Networks({ url }).getLocation();
            const match = newres.match(/share\/slides\/(\d+)/);
            result = {
                type: "\u5B9E\u51B5\u56FE\u7247\u56FE\u96C6\u6570\u636E" /* DouyinDataType.实况图片图集数据 */,
                aweme_id: match ? match[1] : '',
            };
            break;
        }
        case /video\/(\d+)/.test(longLink): {
            const videoMatch = longLink.match(/video\/(\d+)/);
            result = {
                type: "\u5355\u4E2A\u89C6\u9891\u4F5C\u54C1\u6570\u636E" /* DouyinDataType.单个视频作品数据 */,
                aweme_id: videoMatch ? videoMatch[1] : ''
            };
            break;
        }
        case /note\/(\d+)/.test(longLink): {
            const noteMatch = longLink.match(/note\/(\d+)/);
            result = {
                type: "\u56FE\u96C6\u4F5C\u54C1\u6570\u636E" /* DouyinDataType.图集作品数据 */,
                aweme_id: noteMatch ? noteMatch[1] : ''
            };
            break;
        }
        case /user\/(\S+?)\?/.test(longLink): {
            const userMatch = longLink.match(/user\/(\S+?)\?/);
            result = {
                type: "\u7528\u6237\u4E3B\u9875\u89C6\u9891\u5217\u8868\u6570\u636E" /* DouyinDataType.用户主页视频列表数据 */,
                sec_uid: userMatch ? userMatch[1] : ''
            };
            break;
        }
        default:
            break;
    }
    logger.mark(result);
    return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0aWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvYnVzaW5lc3MvZG91eWluL2dldGlkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLE1BQU0sYUFBYSxDQUFBO0FBUzlDOzs7O0dBSUc7QUFFSCxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssVUFBVSxXQUFXLENBQUUsR0FBVztJQUNwRCxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksUUFBUSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQTtJQUMxRCxJQUFJLE1BQU0sR0FBRyxFQUFpQixDQUFBO0lBQzlCLFFBQVEsSUFBSSxFQUFFLENBQUM7UUFDYixLQUFLLHNCQUFzQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0MsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLFFBQVEsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUE7WUFDeEQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFBO1lBQ2xELE1BQU0sR0FBRztnQkFDUCxJQUFJLGtGQUF5QjtnQkFDN0IsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO2FBQ2hDLENBQUE7WUFDRCxNQUFLO1FBQ1AsQ0FBQztRQUNELEtBQUssY0FBYyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbkMsTUFBTSxVQUFVLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQTtZQUNqRCxNQUFNLEdBQUc7Z0JBQ1AsSUFBSSxrRkFBeUI7Z0JBQzdCLFFBQVEsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTthQUMxQyxDQUFBO1lBQ0QsTUFBSztRQUNQLENBQUM7UUFFRCxLQUFLLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2xDLE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUE7WUFDL0MsTUFBTSxHQUFHO2dCQUNQLElBQUksb0VBQXVCO2dCQUMzQixRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7YUFDeEMsQ0FBQTtZQUNELE1BQUs7UUFDUCxDQUFDO1FBRUQsS0FBSyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3JDLE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsQ0FBQTtZQUNsRCxNQUFNLEdBQUc7Z0JBQ1AsSUFBSSxnR0FBMkI7Z0JBQy9CLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTthQUN2QyxDQUFBO1lBQ0QsTUFBSztRQUNQLENBQUM7UUFDRDtZQUNFLE1BQUs7SUFDVCxDQUFDO0lBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQTtJQUNuQixPQUFPLE1BQU0sQ0FBQTtBQUNmLENBQUMifQ==