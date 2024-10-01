import { BilibiliResult } from '../business/bilibili/index.js'
import { DouyinResult } from '../business/douyin/index.js'
import { getDouyinData, getBilibiliData, getXiaohongshuData } from '../model/DataFetchers.js'
import Fastify from 'fastify'
import { logger } from '../model/index.js'
export class amagi {
  douyin
  bilibili
  xiaohongshu
  /**
     *
     * @param data 一个对象，里面包含 douyin 和 bilibili 两个字段，分别对应抖音和B站cookie
     */
  constructor (data) {
    /** 抖音ck */
    this.douyin = data.douyin || ''
    /** B站ck */
    this.bilibili = data.bilibili || ''
    /** 小红书ck */
    this.xiaohongshu = data.xiaohongshu || ''
  }
  /**
     *
     * @param port 监听端口
     * @default port 4567
     * @returns
     */
  startClient (port = 4567) {
    const Client = Fastify({
      logger: {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'yyyy-MM-dd HH:mm:ss',
            ignore: 'pid,hostname,reqId,res,responseTime,req.hostname,req.method,req.remotePort',
            messageFormat: '{msg}'
          }
        }
      }
    })
    Client.get('/', async (_request, reply) => {
      reply.redirect('https://amagi.apifox.cn', 301)
    })
    Client.get('/docs', async (_request, reply) => {
      reply.redirect('https://amagi.apifox.cn', 301)
    })
    Client.get('/api/douyin/aweme', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u5355\u4E2A\u89C6\u9891\u4F5C\u54C1\u6570\u636E" /* DouyinDataType.单个视频作品数据 */,
        cookie: this.douyin
      }, { url: request.query.url }))
    })
    Client.get('/api/douyin/comments', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u8BC4\u8BBA\u6570\u636E" /* DouyinDataType.评论数据 */,
        cookie: this.douyin
      }, { url: request.query.url }))
    })
    Client.get('/api/douyin/comments/reply', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u4E8C\u7EA7\u8BC4\u8BBA\u6570\u636E" /* DouyinDataType.二级评论数据 */,
        cookie: this.douyin
      }, { aweme_id: request.query.aweme_id, comment_id: request.query.comment_id }))
    })
    Client.get('/api/douyin/userinfo', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u7528\u6237\u4E3B\u9875\u6570\u636E" /* DouyinDataType.用户主页数据 */,
        cookie: this.douyin
      }, { sec_uid: request.query.sec_uid }))
    })
    Client.get('/api/douyin/uservideoslist', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u7528\u6237\u4E3B\u9875\u89C6\u9891\u5217\u8868\u6570\u636E" /* DouyinDataType.用户主页视频列表数据 */,
        cookie: this.douyin
      }, { sec_uid: request.query.sec_uid }))
    })
    Client.get('/api/douyin/suggestwords', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u70ED\u70B9\u8BCD\u6570\u636E" /* DouyinDataType.热点词数据 */,
        cookie: this.douyin
      }, { query: request.query.query }))
    })
    Client.get('/api/douyin/search', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u641C\u7D22\u6570\u636E" /* DouyinDataType.搜索数据 */,
        cookie: this.douyin
      }, { query: request.query.query }))
    })
    Client.get('/api/douyin/emoji', async (_request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u5B98\u65B9emoji\u6570\u636E" /* DouyinDataType.官方emoji数据 */,
        cookie: this.douyin
      }))
    })
    Client.get('/api/douyin/expressionplus', async (_request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u52A8\u6001\u8868\u60C5\u6570\u636E" /* DouyinDataType.动态表情数据 */,
        cookie: this.douyin
      }))
    })
    Client.get('/api/douyin/music', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u97F3\u4E50\u6570\u636E" /* DouyinDataType.音乐数据 */,
        cookie: this.douyin
      }, { music_id: request.query.music_id }))
    })
    Client.get('/api/douyin/liveimages', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u5B9E\u51B5\u56FE\u7247\u56FE\u96C6\u6570\u636E" /* DouyinDataType.实况图片图集数据 */,
        cookie: this.douyin
      }, { url: request.query.url }))
    })
    Client.get('/api/douyin/livedata', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u76F4\u64AD\u95F4\u4FE1\u606F\u6570\u636E" /* DouyinDataType.直播间信息数据 */,
        cookie: this.douyin
      }, { sec_uid: request.query.sec_uid }))
    })
    Client.get('/api/bilibili/generateqrcode', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u7533\u8BF7\u4E8C\u7EF4\u7801" /* BilibiliDataType.申请二维码 */,
        cookie: ''
      }, {}))
    })
    Client.get('/api/bilibili/qrcodepoll', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u4E8C\u7EF4\u7801\u72B6\u6001" /* BilibiliDataType.二维码状态 */,
        cookie: ''
      }, { qrcode_key: request.query.qrcode_key }))
    })
    Client.get('/api/bilibili/login', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u767B\u5F55\u57FA\u672C\u4FE1\u606F" /* BilibiliDataType.登录基本信息 */,
        cookie: request.headers.cookie
      }, {}))
    })
    Client.get('/api/bilibili/work', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u5355\u4E2A\u89C6\u9891\u4F5C\u54C1\u6570\u636E" /* BilibiliDataType.单个视频作品数据 */,
        cookie: this.bilibili
      }, { url: request.query.url }))
    })
    Client.get('/api/bilibili/downloadwork', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u5355\u4E2A\u89C6\u9891\u4E0B\u8F7D\u4FE1\u606F\u6570\u636E" /* BilibiliDataType.单个视频下载信息数据 */,
        cookie: this.bilibili
      }, { avid: request.query.avid, cid: request.query.cid }))
    })
    Client.get('/api/bilibili/comment', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u8BC4\u8BBA\u6570\u636E" /* BilibiliDataType.评论数据 */,
        cookie: this.bilibili
      }, { bvid: request.query.bvid }))
    })
    Client.get('/api/bilibili/emoji', async (_request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "emoji\u6570\u636E" /* BilibiliDataType.emoji数据 */,
        cookie: this.bilibili
      }, {}))
    })
    Client.get('/api/bilibili/bangumivideoinfo', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u756A\u5267\u57FA\u672C\u4FE1\u606F\u6570\u636E" /* BilibiliDataType.番剧基本信息数据 */,
        cookie: this.bilibili
      }, { url: request.query.url }))
    })
    Client.get('/api/bilibili/bangumivideodownloadlink', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u756A\u5267\u4E0B\u8F7D\u4FE1\u606F\u6570\u636E" /* BilibiliDataType.番剧下载信息数据 */,
        cookie: this.bilibili
      }, { cid: request.query.cid, ep_id: request.query.ep_id }))
    })
    Client.get('/api/bilibili/dynamiclist', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u7528\u6237\u4E3B\u9875\u52A8\u6001\u5217\u8868\u6570\u636E" /* BilibiliDataType.用户主页动态列表数据 */,
        cookie: this.bilibili
      }, { host_mid: request.query.host_mid }))
    })
    Client.get('/api/bilibili/dynamicinfo', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u52A8\u6001\u8BE6\u60C5\u6570\u636E" /* BilibiliDataType.动态详情数据 */,
        cookie: this.bilibili
      }, { dynamic_id: request.query.dynamic_id }))
    })
    Client.get('/api/bilibili/dynamicdard', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u52A8\u6001\u5361\u7247\u6570\u636E" /* BilibiliDataType.动态卡片数据 */,
        cookie: this.bilibili
      }, { dynamic_id: request.query.dynamic_id }))
    })
    Client.get('/api/bilibili/userinfo', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u7528\u6237\u4E3B\u9875\u6570\u636E" /* BilibiliDataType.用户主页数据 */,
        cookie: this.bilibili
      }, { host_mid: request.query.host_mid }))
    })
    Client.get('/api/bilibili/liveroominfo', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u76F4\u64AD\u95F4\u4FE1\u606F" /* BilibiliDataType.直播间信息 */,
        cookie: this.bilibili
      }, { room_id: request.query.room_id }))
    })
    Client.get('/api/bilibili/liveroominit', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u76F4\u64AD\u95F4\u521D\u59CB\u5316\u4FE1\u606F" /* BilibiliDataType.直播间初始化信息 */,
        cookie: this.bilibili
      }, { room_id: request.query.room_id }))
    })
    Client.listen({ port: port, host: '::' }, (_err, _address) => {
      if (_err)
        Client.log.error(_err)
      logger.mark(`amagi server ${logger.green(`listening on ${port}`)} port. ${logger.yellow('API docs: https://amagi.apifox.cn')}`)
    })
    return {
      /** Fastify 实例 */
      Instance: Client,
      getDouyinData: this.getDouyinData,
      getBilibiliData: this.getBilibiliData,
      getXiaohongshuData: this.getXiaohongshuData
    }
  }
  getDouyinData = async (type, options) => {
    return await getDouyinData(type, this.douyin, options)
  }
  getBilibiliData = async (type, options) => {
    return await getBilibiliData(type, this.bilibili, options)
  }
  getXiaohongshuData = async (type, options) => {
    return await getXiaohongshuData(type, this.xiaohongshu, options)
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3NlcnZlci9jbGllbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHlCQUF5QixDQUFBO0FBQ3hELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQTtBQVdwRCxPQUFPLEVBQ0wsYUFBYSxFQUNiLGVBQWUsRUFDZixrQkFBa0IsRUFDbkIsTUFBTSwwQkFBMEIsQ0FBQTtBQUNqQyxPQUFPLE9BQTRCLE1BQU0sU0FBUyxDQUFBO0FBQ2xELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxhQUFhLENBQUE7QUF5Q3BDLE1BQU0sT0FBTyxLQUFLO0lBQ1IsTUFBTSxDQUFRO0lBQ2QsUUFBUSxDQUFRO0lBQ2hCLFdBQVcsQ0FBUTtJQUUzQjs7O09BR0c7SUFDSCxZQUFhLElBQXNCO1FBQ2pDLFdBQVc7UUFDWCxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLElBQUksRUFBRSxDQUFBO1FBQy9CLFdBQVc7UUFDWCxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFBO1FBQ25DLFlBQVk7UUFDWixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLElBQUksRUFBRSxDQUFBO0lBQzNDLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILFdBQVcsQ0FBRSxPQUFlLElBQUk7UUFFOUIsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDO1lBQ3JCLE1BQU0sRUFBRTtnQkFDTixTQUFTLEVBQUU7b0JBQ1QsTUFBTSxFQUFFLGFBQWE7b0JBQ3JCLE9BQU8sRUFBRTt3QkFDUCxRQUFRLEVBQUUsSUFBSTt3QkFDZCxhQUFhLEVBQUUscUJBQXFCO3dCQUNwQyxNQUFNLEVBQUUsNEVBQTRFO3dCQUNwRixhQUFhLEVBQUUsT0FBTztxQkFDdkI7aUJBQ0Y7YUFDRjtTQUNGLENBQUMs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