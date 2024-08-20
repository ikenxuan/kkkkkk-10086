import { BilibiliResult } from '../business/bilibili/index.js'
import { DouyinResult } from '../business/douyin/index.js'
import Fastify from 'fastify'
export class client {
  /** douyin cookies */
  douyin
  /** bilibili cookes */
  bilibili
  /**
     *
     * @param cookies 包含抖音和B站cookie的参数对象
     */
  constructor (cookies) {
    /** 抖音ck */
    this.douyin = cookies.douyin
    /** B站ck */
    this.bilibili = cookies.bilibili
  }
  /**
     * 初始化 fastify 实例
     * @param log 是否启用日志
     * @returns fastify 实例
     */
  async initServer (log = false) {
    const client = Fastify({
      logger: log && {
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
    client.get('/', async (_request, reply) => {
      reply.redirect('https://amagi.apifox.cn', 301)
    })
    client.get('/docs', async (_request, reply) => {
      reply.redirect('https://amagi.apifox.cn', 301)
    })
    client.get('/api/douyin/aweme', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u5355\u4E2A\u89C6\u9891\u4F5C\u54C1\u6570\u636E" /* DouyinDataType.单个视频作品数据 */,
        cookie: this.douyin
      }, { url: request.query.url }))
    })
    client.get('/api/douyin/comments', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u8BC4\u8BBA\u6570\u636E" /* DouyinDataType.评论数据 */,
        cookie: this.douyin
      }, { url: request.query.url }))
    })
    client.get('/api/douyin/comments/reply', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u4E8C\u7EA7\u8BC4\u8BBA\u6570\u636E" /* DouyinDataType.二级评论数据 */,
        cookie: this.douyin
      }, { aweme_id: request.query.aweme_id, comment_id: request.query.comment_id }))
    })
    client.get('/api/douyin/userinfo', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u7528\u6237\u4E3B\u9875\u6570\u636E" /* DouyinDataType.用户主页数据 */,
        cookie: this.douyin
      }, { sec_uid: request.query.sec_uid }))
    })
    client.get('/api/douyin/uservideoslist', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u7528\u6237\u4E3B\u9875\u89C6\u9891\u5217\u8868\u6570\u636E" /* DouyinDataType.用户主页视频列表数据 */,
        cookie: this.douyin
      }, { sec_uid: request.query.sec_uid }))
    })
    client.get('/api/douyin/suggestwords', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u70ED\u70B9\u8BCD\u6570\u636E" /* DouyinDataType.热点词数据 */,
        cookie: this.douyin
      }, { query: request.query.query }))
    })
    client.get('/api/douyin/search', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u641C\u7D22\u6570\u636E" /* DouyinDataType.搜索数据 */,
        cookie: this.douyin
      }, { query: request.query.query }))
    })
    client.get('/api/douyin/emoji', async (_request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u5B98\u65B9emoji\u6570\u636E" /* DouyinDataType.官方emoji数据 */,
        cookie: this.douyin
      }))
    })
    client.get('/api/douyin/expressionplus', async (_request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u52A8\u6001\u8868\u60C5\u6570\u636E" /* DouyinDataType.动态表情数据 */,
        cookie: this.douyin
      }))
    })
    client.get('/api/douyin/music', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u97F3\u4E50\u6570\u636E" /* DouyinDataType.音乐数据 */,
        cookie: this.douyin
      }, { music_id: request.query.music_id }))
    })
    client.get('/api/douyin/liveimages', async (request, reply) => {
      reply.type('application/json').send(await DouyinResult({
        type: "\u5B9E\u51B5\u56FE\u7247\u56FE\u96C6\u6570\u636E" /* DouyinDataType.实况图片图集数据 */,
        cookie: this.douyin
      }, { url: request.query.url }))
    })
    client.get('/api/bilibili/generateqrcode', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u7533\u8BF7\u4E8C\u7EF4\u7801" /* BilibiliDataType.申请二维码 */,
        cookie: ''
      }, {}))
    })
    client.get('/api/bilibili/qrcodepoll', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u4E8C\u7EF4\u7801\u72B6\u6001" /* BilibiliDataType.二维码状态 */,
        cookie: ''
      }, { qrcode_key: request.query.qrcode_key }))
    })
    client.get('/api/bilibili/login', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u767B\u5F55\u57FA\u672C\u4FE1\u606F" /* BilibiliDataType.登录基本信息 */,
        cookie: request.headers.cookie
      }, {}))
    })
    client.get('/api/bilibili/work', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u5355\u4E2A\u89C6\u9891\u4F5C\u54C1\u6570\u636E" /* BilibiliDataType.单个视频作品数据 */,
        cookie: this.bilibili
      }, { url: request.query.url }))
    })
    client.get('/api/bilibili/downloadwork', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u5355\u4E2A\u89C6\u9891\u4E0B\u8F7D\u4FE1\u606F\u6570\u636E" /* BilibiliDataType.单个视频下载信息数据 */,
        cookie: this.bilibili
      }, { avid: request.query.avid, cid: request.query.cid }))
    })
    client.get('/api/bilibili/comment', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u8BC4\u8BBA\u6570\u636E" /* BilibiliDataType.评论数据 */,
        cookie: this.bilibili
      }, { bvid: request.query.bvid }))
    })
    client.get('/api/bilibili/emoji', async (_request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "emoji\u6570\u636E" /* BilibiliDataType.emoji数据 */,
        cookie: this.bilibili
      }, {}))
    })
    client.get('/api/bilibili/bangumivideoinfo', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u756A\u5267\u57FA\u672C\u4FE1\u606F\u6570\u636E" /* BilibiliDataType.番剧基本信息数据 */,
        cookie: this.bilibili
      }, { url: request.query.url }))
    })
    client.get('/api/bilibili/bangumivideodownloadlink', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u756A\u5267\u4E0B\u8F7D\u4FE1\u606F\u6570\u636E" /* BilibiliDataType.番剧下载信息数据 */,
        cookie: this.bilibili
      }, { cid: request.query.cid, ep_id: request.query.ep_id }))
    })
    client.get('/api/bilibili/dynamiclist', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u7528\u6237\u4E3B\u9875\u52A8\u6001\u5217\u8868\u6570\u636E" /* BilibiliDataType.用户主页动态列表数据 */,
        cookie: this.bilibili
      }, { host_mid: request.query.host_mid }))
    })
    client.get('/api/bilibili/dynamicinfo', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u52A8\u6001\u8BE6\u60C5\u6570\u636E" /* BilibiliDataType.动态详情数据 */,
        cookie: this.bilibili
      }, { dynamic_id: request.query.dynamic_id }))
    })
    client.get('/api/bilibili/dynamicdard', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u52A8\u6001\u5361\u7247\u6570\u636E" /* BilibiliDataType.动态卡片数据 */,
        cookie: this.bilibili
      }, { dynamic_id: request.query.dynamic_id }))
    })
    client.get('/api/bilibili/userinfo', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u7528\u6237\u4E3B\u9875\u6570\u636E" /* BilibiliDataType.用户主页数据 */,
        cookie: this.bilibili
      }, { host_mid: request.query.host_mid }))
    })
    client.get('/api/bilibili/liveroominfo', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u76F4\u64AD\u95F4\u4FE1\u606F" /* BilibiliDataType.直播间信息 */,
        cookie: this.bilibili
      }, { room_id: request.query.room_id }))
    })
    client.get('/api/bilibili/liveroominit', async (request, reply) => {
      reply.type('application/json').send(await BilibiliResult({
        type: "\u76F4\u64AD\u95F4\u521D\u59CB\u5316\u4FE1\u606F" /* BilibiliDataType.直播间初始化信息 */,
        cookie: this.bilibili
      }, { room_id: request.query.room_id }))
    })
    return {
      Instance: client,
      GetDouyinData: this.GetDouyinData,
      GetBilibiliData: this.GetBilibiliData
    }
  }
  GetDouyinData = (data) => {
    return {
      result: () => {
        throw new Error('该方法已废弃！请直接导入 GetBilibiliData 方法使用')
      }
    }
  }
  GetBilibiliData = (data) => {
    return {
      /**
             * @deprecated
             */
      result: async () => {
        throw new Error('该方法已废弃！请直接导入 GetBilibiliData 方法使用')
      }
    }
  }
}
