import { BilibiliData, GetBilibiliID } from '../../business/bilibili/index.js'
/**
 *
 * @param options
 * @param config
 * @returns
 */
export default async function BilibiliResult (config = { cookie: '' }, options) {
  let data
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
    case "\u5355\u4E2A\u89C6\u9891\u4E0B\u8F7D\u4FE1\u606F\u6570\u636E" /* BilibiliDataType.单个视频下载信息数据 */:
    case "\u4E8C\u7EF4\u7801\u72B6\u6001" /* BilibiliDataType.二维码状态 */:
    case "\u7533\u8BF7\u4E8C\u7EF4\u7801" /* BilibiliDataType.申请二维码 */:
    case "\u767B\u5F55\u57FA\u672C\u4FE1\u606F" /* BilibiliDataType.登录基本信息 */:
      data = await new BilibiliData(config.type, config.cookie).GetData(options)
      break
    case "\u5355\u4E2A\u89C6\u9891\u4F5C\u54C1\u6570\u636E" /* BilibiliDataType.单个视频作品数据 */:
    case "\u756A\u5267\u57FA\u672C\u4FE1\u606F\u6570\u636E" /* BilibiliDataType.番剧基本信息数据 */: {
      const hasid = options.id || null
      if (hasid) {
        data = await new BilibiliData(config.type, config.cookie).GetData({ id: options.id })
      }
      else {
        const iddata = await GetBilibiliID(options.url)
        data = await new BilibiliData(config.type, config.cookie).GetData(iddata)
      }
      break
    }
    default:
      data = ''
      break
  }
  return {
    code: data !== '' ? 200 : 503,
    message: data !== '' ? 'success' : 'error',
    data: data !== '' ? data : null
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzdWx0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2J1c2luZXNzL2JpbGliaWxpL3Jlc3VsdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxNQUFNLHlCQUF5QixDQUFBO0FBV3JFOzs7OztHQUtHO0FBQ0gsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLFVBQVUsY0FBYyxDQUMxQyxTQUF1QixFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQWtCLEVBQ3JELE9BQTRCO0lBQzVCLElBQUksSUFBWSxDQUFBO0lBQ2hCLFFBQVEsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3BCLDBFQUE2QjtRQUM3Qix3REFBOEI7UUFDOUIsNERBQTJCO1FBQzNCLHdGQUErQjtRQUMvQixzR0FBaUM7UUFDakMsMEVBQTZCO1FBQzdCLDBFQUE2QjtRQUM3QixtRUFBNEI7UUFDNUIsd0ZBQStCO1FBQy9CLHNHQUFpQztRQUNqQyxtRUFBNEI7UUFDNUIsbUVBQTRCO1FBQzVCO1lBQ0UsSUFBSSxHQUFHLE1BQU0sSUFBSSxZQUFZLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBQzFFLE1BQUs7UUFDUCx3RkFBK0I7UUFDL0IsdUZBQThCLENBQUMsQ0FBQyxDQUFDO1lBQy9CLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxFQUFFLElBQUksSUFBSSxDQUFBO1lBQ2hDLElBQUksS0FBSyxFQUFFLENBQUM7Z0JBQ1YsSUFBSSxHQUFHLE1BQU0sSUFBSSxZQUFZLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFBO1lBQ3ZGLENBQUM7aUJBQU0sQ0FBQztnQkFDTixNQUFNLE1BQU0sR0FBRyxNQUFNLGFBQWEsQ0FBQyxPQUFPLENBQUMsR0FBYSxDQUFDLENBQUE7Z0JBQ3pELElBQUksR0FBRyxNQUFNLElBQUksWUFBWSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQTtZQUMzRSxDQUFDO1lBQ0QsTUFBSztRQUNQLENBQUM7UUFDRDtZQUNFLElBQUksR0FBRyxFQUFFLENBQUE7WUFDVCxNQUFLO0lBQ1QsQ0FBQztJQUNELE9BQU87UUFDTCxJQUFJLEVBQUUsSUFBSSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHO1FBQzdCLE9BQU8sRUFBRSxJQUFJLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU87UUFDMUMsSUFBSSxFQUFFLElBQUksS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSTtLQUNoQyxDQUFBO0FBQ0gsQ0FBQyJ9