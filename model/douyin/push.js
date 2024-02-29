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

    if (cache == '[]' || !cache) {
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
        } else if (data.create_time > cachedata.create_time) {
          const result = await this.getdata(data[i])
          await redis.set('kkk:douyPush', JSON.stringify({ create_time: result.create_time, aweme_id: result.aweme_id, sec_id: cachedata[i].sec_id }))
          logger.info(`[kkkkkk-10086-douyPush] 更新视频aweme_id: [${cachedata[i].create_time}] -> [${data[i].create_time}]`)
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
    for (let i = 0; i < data.group_id.length; i++) {
      await Bot.pickGroup(Number(data.group_id[i])).sendMsg([Msg, segment.image(user_img), share_url])
    }
    return { aweme_id, create_time: Array[0].aweme_list[0].create_time }
  }

  async getuserdata() {
    let result = []

    for (let i = 0; i < this.Config.douyinpushlist.length; i++) {
      const group_id = this.Config.douyinpushlist[i].group_id
      const secUid = this.Config.douyinpushlist[i].sec_uid
      const data = await new iKun('UserVideosList').GetData({ user_id: secUid })
      const awemeId = data.aweme_list[0].aweme_id
      const createTime = data.aweme_list[0].create_time
      result.push({ create_time: createTime, group_id: group_id, sec_id: secUid, aweme_id: awemeId })
    }
    await redis.set('kkk:douyPush', JSON.stringify(result))

    return result
  }
  async setting(data) {
    let msg
    const sec_uid = data.data[0].user_list[0].user_info.sec_uid
    const UserInfoData = await new iKun('UserInfoData').GetData({ user_id: sec_uid })

    const config = JSON.parse(fs.readFileSync(this.ConfigPath, 'utf8'))
    const group_id = this.e.group_id

    // 初始化 group_id 对应的数组
    if (!config.douyinpushlist) {
      config.douyinpushlist = []
    }

    // 查找是否存在相同的 sec_uid
    const existingItem = config.douyinpushlist.find((item) => item.sec_uid === sec_uid)

    if (existingItem) {
      // 如果已经存在相同的 sec_uid，则检查是否存在相同的 group_id
      const existingGroupIdIndex = existingItem.group_id.indexOf(group_id)
      if (existingGroupIdIndex !== -1) {
        // 如果存在相同的 group_id，则删除它
        existingItem.group_id.splice(existingGroupIdIndex, 1)
        logger.info(`\n删除成功！${UserInfoData.user.nickname}\n抖音号：${UserInfoData.user.unique_id}\nsec_id：${UserInfoData.user.sec_uid}`)
        msg = `群：${group_id}\n删除成功！${UserInfoData.user.nickname}\n抖音号：${UserInfoData.user.unique_id}`

        // 如果删除后 group_id 数组为空，则删除整个属性
        if (existingItem.group_id.length === 0) {
          const index = config.douyinpushlist.indexOf(existingItem)
          config.douyinpushlist.splice(index, 1)
        }
      } else {
        // 否则，将新的 group_id 添加到该 sec_uid 对应的数组中
        existingItem.group_id.push(group_id)
        logger.info(`\n设置成功！${UserInfoData.user.nickname}\n抖音号：${UserInfoData.user.unique_id}\nsec_id：${UserInfoData.user.sec_uid}`)
      }
    } else {
      // 如果不存在相同的 sec_uid，则新增一个属性
      config.douyinpushlist.push({ sec_uid, group_id: [group_id], remark: UserInfoData.user.nickname })
      msg = `群：${group_id}\n添加成功！${UserInfoData.user.nickname}\n抖音号：${UserInfoData.user.unique_id}`
    }

    fs.writeFileSync(this.ConfigPath, JSON.stringify(config, null, 2), 'utf8')
    return msg
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
