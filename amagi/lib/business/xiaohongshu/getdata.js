import { XiaohongshuAPI } from '../../business/xiaohongshu/index.js'
import { Networks, logger } from '../../model/index.js'
import { XiaohongshuSign } from '../../business/xiaohongshu/index.js'
export default class XiaohongshuData {
  type
  headers
  constructor (type, cookie) {
    this.type = type
    this.headers = headers
    this.headers.cookie = cookie
  }
  async GetData (data = {}) {
    switch (this.type) {
      case "\u5355\u4E2A\u7B14\u8BB0" /* XiaohongshuDataType.单个笔记 */: {
        const API = XiaohongshuAPI.单个笔记({ source_note_id: data.source_note_id, xsec_token: data.xsec_token || 'xsec_token' })
        const xs = XiaohongshuSign.x_s(API.url, this.headers.cookie, API.body)
        const WorkData = await this.GlobalGetData({
          url: API.url,
          method: 'POST',
          headers: {
            ...this.headers,
            'x-s': xs,
            'x-b3-traceid': XiaohongshuSign.x_b3_traceid(),
            'x-s-common': XiaohongshuSign.x_s_common({ x_s: xs, cookie: this.headers.cookie }),
            'x-t': Date.now()
          },
          body: API.body
        })
        return WorkData
      }
      default:
        break
    }
  }
  async GlobalGetData (options) {
    const result = await new Networks(options).getData()
    if (!result || result === '') {
      logger.error('获取响应数据失败！\n请求类型：' + this.type + '\n请求URL：' + options.url)
    }
    return result
  }
}
const headers = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'zh-CN,zh;q=0.9',
  'content-type': 'application/json;charset=UTF-8',
  'origin': 'https://www.xiaohongshu.com',
  'priority': 'u=1, i',
  'referer': 'https://www.xiaohongshu.com/',
  'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0ZGF0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9idXNpbmVzcy94aWFvaG9uZ3NodS9nZXRkYXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQTtBQUUzRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxNQUFNLGFBQWEsQ0FBQTtBQUM5QyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNEJBQTRCLENBQUE7QUFFNUQsTUFBTSxDQUFDLE9BQU8sT0FBTyxlQUFlO0lBQ2xDLElBQUksQ0FBSztJQUNULE9BQU8sQ0FBSztJQUNaLFlBQWEsSUFBc0MsRUFBRSxNQUFjO1FBQ2pFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFBO1FBQ2hCLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFBO1FBQ3RCLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQTtJQUM5QixDQUFDO0lBRUQsS0FBSyxDQUFDLE9BQU8sQ0FBRSxPQUFPLEVBQTRCO1FBQ2hELFFBQVEsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2xCLDhEQUE2QixDQUFDLENBQUMsQ0FBQztnQkFDOUIsTUFBTSxHQUFHLEdBQUcsY0FBYyxDQUFDLElBQUksQ0FBQyxFQUFFLGNBQWMsRUFBRSxJQUFJLENBQUMsY0FBd0IsRUFBRSxVQUFVLEVBQUUsSUFBSSxDQUFDLFVBQVUsSUFBSSxZQUFZLEVBQUUsQ0FBQyxDQUFBO2dCQUMvSCxNQUFNLEVBQUUsR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFBO2dCQUN0RSxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQ3ZDO29CQUNFLEdBQUcsRUFBRSxHQUFHLENBQUMsR0FBRztvQkFDWixNQUFNLEVBQUUsTUFBTTtvQkFDZCxPQUFPLEVBQUU7d0JBQ1AsR0FBRyxJQUFJLENBQUMsT0FBTzt3QkFDZixLQUFLLEVBQUUsRUFBRTt3QkFDVCxjQUFjLEVBQUUsZUFBZSxDQUFDLFlBQVksRUFBRTt3QkFDOUMsWUFBWSxFQUFFLGVBQWUsQ0FBQyxVQUFVLENBQUMsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDO3dCQUNsRixLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtxQkFDbEI7b0JBQ0QsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJO2lCQUNmLENBQ0YsQ0FBQTtnQkFDRCxPQUFPLFFBQVEsQ0FBQTtZQUNqQixDQUFDO1lBRUQ7Z0JBQ0UsTUFBSztRQUNULENBQUM7SUFFSCxDQUFDO0lBRUQsS0FBSyxDQUFDLGFBQWEsQ0FBRSxPQUFvRTtRQUN2RixNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFBO1FBQ3BELElBQUksQ0FBQyxNQUFNLElBQUksTUFBTSxLQUFLLEVBQUUsRUFBRSxDQUFDO1lBQzdCLE1BQU0sQ0FBQyxLQUFLLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBRyxVQUFVLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFBO1FBQ3pFLENBQUM7UUFDRCxPQUFPLE1BQU0sQ0FBQTtJQUNmLENBQUM7Q0FDRjtBQUVELE1BQU0sT0FBTyxHQUFHO0lBQ2QsUUFBUSxFQUFFLG1DQUFtQztJQUM3QyxpQkFBaUIsRUFBRSxnQkFBZ0I7SUFDbkMsY0FBYyxFQUFFLGdDQUFnQztJQUNoRCxRQUFRLEVBQUUsNkJBQTZCO0lBQ3ZDLFVBQVUsRUFBRSxRQUFRO0lBQ3BCLFNBQVMsRUFBRSw4QkFBOEI7SUFDekMsV0FBVyxFQUFFLG1FQUFtRTtJQUNoRixrQkFBa0IsRUFBRSxJQUFJO0lBQ3hCLG9CQUFvQixFQUFFLFdBQVc7SUFDakMsZ0JBQWdCLEVBQUUsT0FBTztJQUN6QixnQkFBZ0IsRUFBRSxNQUFNO0lBQ3hCLGdCQUFnQixFQUFFLFdBQVc7SUFDN0IsWUFBWSxFQUFFLGlIQUFpSDtDQUNoSSxDQUFBIn0=