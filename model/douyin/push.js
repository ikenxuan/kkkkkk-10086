import iKun from './getdata.js'
import base from '../base.js'
import fs from 'fs'

export default class push extends base {
  constructor(e) {
    super(e)
  }
  async action() {
    await this.checkremark()
    const cache = await redis.get('kkk:douyPush')
    let data

    if (cache == '[]' || !cache) {
      /** 如果redis里没有，就重新获取并写入 */
      data = await this.getuserdata(true)
      await redis.set('kkk:douyPush', JSON.stringify(data))
    } else {
      let cachedata = JSON.parse(cache)
      /** 获取最新那一条 */
      data = await this.getuserdata(false)
      cachedata = await this.findMismatchedAwemeIds(data, cachedata)

      if (data.length == 0) {
        logger.warn('[kkkkkk-10086-推送]尚未配置抖音推送列表，任务结束，推送失败')
        return true
      }
      for (let i = 0; i < data.length; i++) {
        if (data[i].create_time == cachedata[i].create_time) {
        } else if (data[i].create_time > cachedata[i].create_time) {
          await this.getdata(data[i])
          await redis.set('kkk:douyPush', JSON.stringify(data))
          logger.info(`aweme_id: [${cachedata[i].aweme_id}] --> [${data[i].aweme_id}]`)
        }
      }
    }
  }

  async getdata(data) {
    const videolist = await new iKun('UserVideosList').GetData({ user_id: data.sec_id })
    const userinfo = await new iKun('UserInfoData').GetData({ user_id: data.sec_id })
    let Array = [videolist, userinfo]
    let nickname,
      desc,
      share_url,
      create_time,
      a,
      shouldBreak = false
    for (let j = 0; j < Array[0].aweme_list.length; j++) {
      let isTop = Array[0].aweme_list[j].is_top
      /** 处理置顶 */
      while (isTop === 1 && j < Array[0].aweme_list.length - 1) {
        j++
        isTop = Array[0].aweme_list[j].is_top
      }
      shouldBreak = isTop !== 1
      if (shouldBreak) {
        a = j
        break
      }
    }
    nickname = Array[0].aweme_list[a].author.nickname
    desc = Array[0].aweme_list[a].desc
    share_url = Array[0].aweme_list[a].share_url
    create_time = await this.convertTimestampToDateTime(Array[0].aweme_list[a].create_time)

    const user_img = Array[1].user.avatar_larger.url_list[0]
    const Msg = `${nickname} 有新作品啦\n\n标题：${desc}\n发布时间：${create_time}\n\n`
    for (let i = 0; i < data.group_id.length; i++) {
      let key = `kkk:douyPush-${data.group_id[i]}-${data.aweme_id}`
      if (await redis.get(key)) {
        console.log(await redis.get(key))
        return true
      } else {
        /** node_modules/icqq/lib/internal/contactable.js#L507 */
        const forwardMsg = await Bot.pickGroup(Number(data.group_id[i])).makeForwardMsg({
          user_id: Bot.uin,
          message: [Msg, segment.image(user_img), share_url],
        })
        /** 处理描述 */
        if (typeof forwardMsg.data === 'object') {
          let detail = forwardMsg.data?.meta?.detail
          if (detail) {
            detail.news = [{ text: '点击查看详情' }]
            detail.source = `「${nickname}」\n在抖音发布新作品啦 ~`
            detail.summary = 'DouYin 推送'
          }
        }
        await Bot.pickGroup(Number(data.group_id[i])).sendMsg(forwardMsg)
        await redis.set(key, 1, { EX: 8 * 60 * 60 })
      }
    }
  }

  /**
   *
   * @param {*} write 是否写入
   * @param {*} sec_idlist 要获取aweme_id的用户uid列表
   * @returns
   */
  async getuserdata(write, sec_idlist) {
    let result = []

    if (sec_idlist) {
      for (let i = 0; i < sec_idlist.length; i++) {
        const group_id = this.Config.douyinpushlist[i].group_id
        const secUid = sec_idlist[i].sec_uid || sec_idlist[i]
        const data = await new iKun('UserVideosList').GetData({ user_id: secUid })
        let a,
          awemeId,
          isTop = data.aweme_list[i].is_top,
          shouldBreak = false
        for (let j = 0; j < data.aweme_list.length; j++) {
          /** 处理置顶 */
          while (isTop === 1 && j < data.aweme_list.length - 1) {
            j++
            awemeId = data.aweme_list[j].aweme_id
            isTop = data.aweme_list[j].is_top
          }
          shouldBreak = isTop !== 1
          if (shouldBreak) {
            a = j
            break
          }
        }
        const createTime = data.aweme_list[a].create_time
        result.push({ create_time: createTime, group_id: group_id, sec_id: secUid, aweme_id: awemeId })
      }
    } else {
      for (let i = 0; i < this.Config.douyinpushlist.length; i++) {
        const group_id = this.Config.douyinpushlist[i].group_id
        const secUid = this.Config.douyinpushlist[i].sec_uid
        const data = await new iKun('UserVideosList').GetData({ user_id: secUid })
        let a,
          awemeId,
          isTop = data.aweme_list[i].is_top,
          shouldBreak = false
        for (let j = 0; j < data.aweme_list.length; j++) {
          /** 处理置顶 */
          while (isTop === 1 && j < data.aweme_list.length - 1) {
            j++
            awemeId = data.aweme_list[j].aweme_id
            isTop = data.aweme_list[j].is_top
          }
          shouldBreak = isTop !== 1
          if (shouldBreak) {
            a = j
            break
          }
        }
        const createTime = data.aweme_list[a].create_time
        result.push({ create_time: createTime, group_id: group_id, sec_id: secUid, aweme_id: awemeId })
      }
    }
    if (write) {
      await redis.set('kkk:douyPush', JSON.stringify(result))
    }
    return result
  }

  async setting(data) {
    let msg
    const sec_uid = data.data[0].user_list[0].user_info.sec_uid
    const UserInfoData = await new iKun('UserInfoData').GetData({ user_id: sec_uid })

    const config = JSON.parse(fs.readFileSync(this.ConfigPath))
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
        msg = `群：${group_id}\n添加成功！${UserInfoData.user.nickname}\n抖音号：${UserInfoData.user.unique_id}`
        logger.info(`\n设置成功！${UserInfoData.user.nickname}\n抖音号：${UserInfoData.user.unique_id}\nsec_id：${UserInfoData.user.sec_uid}`)
      }
    } else {
      // 如果不存在相同的 sec_uid，则新增一个属性
      config.douyinpushlist.push({ sec_uid, group_id: [group_id], remark: UserInfoData.user.nickname })
      msg = `群：${group_id}\n添加成功！${UserInfoData.user.nickname}\n抖音号：${UserInfoData.user.unique_id}`
    }

    fs.writeFileSync(this.ConfigPath, JSON.stringify(config, null, 2))
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

  async findMismatchedAwemeIds(data, cachedata) {
    const mismatchedIds = []
    const sec_idlist = []
    let resources = []
    if (data.length > cachedata.length) {
      for (let i = 0; i < data.length; i++) {
        if (data[i].sec_id !== cachedata[i]?.sec_id) {
          mismatchedIds.push(data[i].aweme_id)
          sec_idlist.push(data[i].sec_id)
        }
      }
      if (sec_idlist.length > 0) {
        let newdata = []
        newdata = await this.getuserdata(false, sec_idlist)
        resources = cachedata.concat(newdata)
        await redis.set('kkk:douyPush', JSON.stringify(resources))
      }
    }

    return sec_idlist.length > 0 ? resources : cachedata
  }

  async checkremark() {
    let config = JSON.parse(fs.readFileSync(this.ConfigPath))
    const abclist = []
    for (let i = 0; i < this.Config.douyinpushlist.length; i++) {
      const remark = this.Config.douyinpushlist[i].remark
      const group_id = this.Config.douyinpushlist[i].group_id
      const sec_uid = this.Config.douyinpushlist[i].sec_uid

      if (remark == undefined || remark === '') {
        abclist.push({ sec_uid, group_id })
      }
    }
    if (abclist.length > 0) {
      for (let i = 0; i < abclist.length; i++) {
        const resp = await new iKun('UserInfoData').GetData({ user_id: abclist[i].sec_uid })
        const remark = resp.user.nickname
        const matchingItemIndex = config.douyinpushlist.findIndex((item) => item.sec_uid === abclist[i].sec_uid)
        if (matchingItemIndex !== -1) {
          // 更新匹配的对象的 remark
          config.douyinpushlist[matchingItemIndex].remark = remark
        }
      }
      fs.writeFileSync(this.ConfigPath, JSON.stringify(config, null, 2))
    }
  }
}
