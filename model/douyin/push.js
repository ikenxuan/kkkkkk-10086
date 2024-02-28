import iKun from './getdata.js'
import base from '../base.js'
import fs from 'fs'

export default class push extends base {
  constructor(e) {
    super(e)
  }
  async action() {
    let data
    const cache = await redis.get('kkk:douyPush')
    if (!cache) {
      /** 如果redis里没有，就重新获取并写入 */
      data = await this.getuserdata()
    } else {
      const cachedata = JSON.parse(cache)
      data = await this.getuserdata()
      if (data.length == 0) {
        logger.warn('[kkkkkk-10086-douyPush]尚未配置抖音推送列表，任务结束，推送失败')
        return true
      }
      for (let i = 0; i < data.length; i++) {
        if (data[i].aweme_id == cachedata[i].aweme_id) {
          return true
        } else if (data.create_time > cachedata.create_time) {
          const result = await this.getdata(data[i])
          await redis.set('kkk:douyPush', JSON.stringify({ create_time: result.create_time, aweme_id: result.aweme_id, sec_id: cachedata.sec_id }))
          logger.info(`[${cachedata.create_time}] => [${data.create_time}]`)
        }
      }
    }
  }

  async getdata(data) {
    const videolist = await new iKun('UserVideosList').GetData({ user_id: data.sec_id })
    const userinfo = await new iKun('UserInfoData').GetData({ user_id: data.sec_id })
    let Array = [videolist, userinfo]

    const aweme_id = Array[0].aweme_list[0].aweme_id
    const nickname = Array[0].aweme_list[0].author.nickname
    const desc = Array[0].aweme_list[0].desc
    const share_url = Array[0].aweme_list[0].share_url
    const create_time = await this.convertTimestampToDateTime(Array[0].aweme_list[0].create_time)
    const user_img = Array[1].user.avatar_larger.url_list[0]

    const Msg = `${nickname} 有新作品啦\n\n标题：${desc}\n发布时间：${create_time}\n\n`
    await Bot.pickGroup(Number(data.group_id)).sendMsg([Msg, segment.image(user_img), share_url])
    return { aweme_id, create_time: Array[0].aweme_list[0].create_time }
  }

  async getuserdata() {
    let aweme_idlist = []
    let Array = []

    for (const group_id in this.Config.douyinpushlist) {
      if (Object.hasOwnProperty.call(this.Config.douyinpushlist, group_id)) {
        const sec_uids = this.Config.douyinpushlist[group_id]
        for (let i = 0; i < sec_uids.length; i++) {
          const data = await new iKun('UserVideosList').GetData({ user_id: sec_uids[i] })
          const aweme_id = data.aweme_list[0].aweme_id
          const create_time = data.aweme_list[0].create_time
          aweme_idlist.push({ create_time: create_time, sec_id: sec_uids[i], aweme_id: aweme_id })
          Array.push({ create_time: create_time, group_id: group_id, sec_id: sec_uids[i], aweme_id: aweme_id })
        }
      }
    }
    await redis.set('kkk:douyPush', JSON.stringify(aweme_idlist))

    return Array
  }

  async setting(data) {
    logger.info('命令使用#设置抖音推送+抖音号即可自动获取uid，使用锅巴配置需访问网页端个人主页，地址栏user/后的便是uid')
    const sec_uid = data.data[0].user_list[0].user_info.sec_uid

    // 读取config.json文件
    const config = JSON.parse(fs.readFileSync(this.ConfigPath, 'utf8'))
    const group_id = this.e.group_id

    // 初始化 group_id 对应的数组
    if (!config.douyinpushlist) {
      config.douyinpushlist = {}
    }
    if (!config.douyinpushlist[group_id]) {
      config.douyinpushlist[group_id] = []
    }

    // 检查是否已经存在相同的 sec_uid
    const existingIndex = config.douyinpushlist[group_id].indexOf(sec_uid)

    if (existingIndex !== -1) {
      // 如果已经存在相同的 sec_uid，则删除已存在的项
      config.douyinpushlist[group_id].splice(existingIndex, 1)
      console.log('删除成功')
    } else {
      config.douyinpushlist[group_id].push(sec_uid)
    }

    fs.writeFileSync(this.ConfigPath, JSON.stringify(config, null, 2), 'utf8')
    return
  }
  async convertTimestampToDateTime(timestamp) {
    const date = new Date(timestamp * 1000)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}`
  }
}
