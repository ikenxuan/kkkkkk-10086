import { Networks, logger } from '../../model/index.js'
/**
 * return aweme_id
 * @param {string} url 分享连接
 * @returns
 */
export default async function GetBilibiliID (url) {
  const longLink = await new Networks({ url }).getLongLink()
  let result = {}
  switch (true) {
    case /video\/([A-Za-z0-9]+)/.test(longLink): {
      const bvideoMatch = longLink.match(/video\/([A-Za-z0-9]+)/)
      result = {
        type: "\u5355\u4E2A\u89C6\u9891\u4F5C\u54C1\u6570\u636E" /* BilibiliDataType.单个视频作品数据 */,
        id: bvideoMatch ? bvideoMatch[1] : ''
      }
      break
    }
    case /play\/(\S+?)\??/.test(longLink): {
      const playMatch = longLink.match(/play\/(\w+)/)
      result = {
        type: "\u756A\u5267\u57FA\u672C\u4FE1\u606F\u6570\u636E" /* BilibiliDataType.番剧基本信息数据 */,
        id: playMatch ? playMatch[1] : ''
      }
      break
    }
    case /^https:\/\/t\.bilibili\.com\/(\d+)/.test(longLink) || /^https:\/\/www\.bilibili\.com\/opus\/(\d+)/.test(longLink): {
      const tMatch = longLink.match(/^https:\/\/t\.bilibili\.com\/(\d+)/)
      const opusMatch = longLink.match(/^https:\/\/www\.bilibili\.com\/opus\/(\d+)/)
      const dynamic_id = tMatch || opusMatch
      result = {
        type: "\u52A8\u6001\u8BE6\u60C5\u6570\u636E" /* BilibiliDataType.动态详情数据 */,
        dynamic_id: dynamic_id ? dynamic_id[1] : ''
      }
      break
    }
    default:
      break
  }
  logger.mark(result)
  return result
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0aWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvYnVzaW5lc3MvYmlsaWJpbGkvZ2V0aWQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsTUFBTSxhQUFhLENBQUE7QUFzQjlDOzs7O0dBSUc7QUFDSCxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssVUFBVSxhQUFhLENBQUUsR0FBVztJQUN0RCxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksUUFBUSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQTtJQUMxRCxJQUFJLE1BQU0sR0FBRyxFQUFpQixDQUFBO0lBRTlCLFFBQVEsSUFBSSxFQUFFLENBQUM7UUFDYixLQUFLLHVCQUF1QixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsTUFBTSxXQUFXLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxDQUFBO1lBQzNELE1BQU0sR0FBRztnQkFDUCxJQUFJLG9GQUEyQjtnQkFDL0IsRUFBRSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO2FBQ3RDLENBQUE7WUFDRCxNQUFLO1FBQ1AsQ0FBQztRQUNELEtBQUssaUJBQWlCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN0QyxNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFBO1lBQy9DLE1BQU0sR0FBRztnQkFDUCxJQUFJLG9GQUEyQjtnQkFDL0IsRUFBRSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO2FBQ2xDLENBQUE7WUFDRCxNQUFLO1FBQ1AsQ0FBQztRQUNELEtBQUssb0NBQW9DLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLDRDQUE0QyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDeEgsTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFBO1lBQ25FLE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsNENBQTRDLENBQUMsQ0FBQTtZQUM5RSxNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUksU0FBUyxDQUFBO1lBQ3RDLE1BQU0sR0FBRztnQkFDUCxJQUFJLHNFQUF5QjtnQkFDN0IsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO2FBQzVDLENBQUE7WUFDRCxNQUFLO1FBQ1AsQ0FBQztRQUNEO1lBQ0UsTUFBSztJQUNULENBQUM7SUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFBO0lBQ25CLE9BQU8sTUFBTSxDQUFBO0FBQ2YsQ0FBQyJ9