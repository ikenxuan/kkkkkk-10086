import { iKun } from '#douyin'
import { base, Render, GetID, common, Config } from '#modules'
import fs from 'fs'

export default class push extends base {
  constructor(e = {}, force) {
    super()
    if (this.botadapter === 'QQBot') {
      return true
    }
    this.e = e
    this.headers['Referer'] = 'https://www.douyin.com'
    this.headers['Cookie'] = Config.ck
    this.force = force
  }
  async action() {
    await this.checkremark()
    const cache = await redis.get('kkk:douyPush')
    let data

    try {
      if (cache == '[]' || !cache) {
        /** 如果redis里没有，就重新获取并写入 */
        data = await this.getuserdata(true)
        await redis.set('kkk:douyPush', JSON.stringify(data))
      } else {
        let cachedata = JSON.parse(cache)
        /** 获取最新那一条 */
        data = await this.getuserdata(false)
        cachedata = await this.findMismatchedAwemeIds(data, cachedata)

        if (data.length == 0) return true

        if (this.force) {
          return await this.forcepush(data)
        }

        for (let i = 0; i < data.length; i++) {
          if (data[i].create_time == cachedata[i]?.create_time) {
            for (const key of data[i].group_id) {
              if (!(await redis.get(`kkk:douyPush-${key}-${data[i].aweme_id}`))) {
                await this.getdata(data[i])
                logger.info(`aweme_id: [${cachedata[i]?.aweme_id}] ➩ [${data[i]?.aweme_id}]`)
              }
            }
          } else if (data[i].create_time > cachedata[i]?.create_time || (data[i].create_time && !cachedata[i]?.create_time)) {
            await this.getdata(data[i])
            logger.info(`aweme_id: [${cachedata[i]?.aweme_id}] ➩ [${data[i]?.aweme_id}]`)
          }
        }
        await redis.set('kkk:douyPush', JSON.stringify(data))
      }
    } catch (error) {
      logger.error(error)
      await redis.set('kkk:douyPush', JSON.stringify(data))
    }
  }

  async getdata(data) {
    const videolist = await new iKun('UserVideosList').GetData({ user_id: data.sec_id })
    const userinfo = await new iKun('UserInfoData').GetData({ user_id: data.sec_id })
    let Array = [videolist, userinfo]
    let img

    let nonTopIndex = 0,
      user_shortid

    /** 跳过所有置顶视频 */
    while (nonTopIndex < Array[0].aweme_list.length && Array[0].aweme_list[nonTopIndex].is_top === 1) {
      nonTopIndex++
    }
    /** 处理抖音号 */
    Array[1].user.unique_id == '' ? (user_shortid = Array[1].user.short_id) : (user_shortid = Array[1].user.unique_id)

    for (let i = 0; i < data.group_id.length; i++) {
      let key
      if (data.live) {
        key = `kkk:douyPush-live${data.room_id}`
        await redis.set(`kkk:douyPush-live${data.room_id}`, 1)
        const roominfo = await new iKun('直播间信息').GetData(data.room_id)
        img = await Render.render(
          'html/douyin/douyinlive',
          {
            image_url: [{ image_src: roominfo.data.cover.url_list[0] }],
            text: roominfo.data.title,
            liveinf: `${roominfo.data.dynamic_label.splice_label.text} | 房间号: ${roominfo.data.owner.web_rid}`,
            在线观众: this.count(roominfo.data.stats.user_count_str),
            总观看次数: this.count(roominfo.data.stats.total_user_str),
            username: Array[1].user.nickname,
            avater_url: Array[1].user.avatar_larger.url_list[0],
            fans: this.count(Array[1].user.follower_count),
            create_time: this.convertTimestampToDateTime(new Date().getTime()),
            now_time: this.convertTimestampToDateTime(new Date().getTime()),
            share_url: 'https://live.douyin.com/' + roominfo.data.owner.web_rid,
            dynamicTYPE: '直播推送',
          },
          { e: this.e, scale: 1.4, retType: 'base64' },
        )
      } else {
        key = `kkk:douyPush-${data.group_id[i]}-${data.aweme_id}`
        const iddata = await GetID(Array[0].aweme_list[nonTopIndex].share_url)
        const videodata = await new iKun(iddata.type).GetData(iddata)
        img = await Render.render(
          'html/douyin/douyininfo',
          {
            image_url: Array[0].aweme_list[nonTopIndex].video?.animated_cover?.url_list[0] || Array[0].aweme_list[nonTopIndex].video?.cover?.url_list[0],
            desc: this.desc(Array[0].aweme_list[nonTopIndex].text_extra, Array[0].aweme_list[nonTopIndex].desc),
            dianzan: this.count(Array[0].aweme_list[nonTopIndex].statistics.digg_count),
            pinglun: this.count(Array[0].aweme_list[nonTopIndex].statistics.comment_count),
            share: this.count(Array[0].aweme_list[nonTopIndex].statistics.share_count),
            shouchang: this.count(Array[0].aweme_list[nonTopIndex].statistics.collect_count),
            create_time: this.convertTimestampToDateTime(Array[0].aweme_list[nonTopIndex].create_time),
            avater_url: Array[1].user.avatar_larger.url_list[0],
            share_url: iddata.is_mp4
              ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${videodata.VideoData.aweme_detail.video.play_addr.uri}&ratio=1080p&line=0`
              : videodata.VideoData.aweme_detail.share_url,
            username: Array[0].aweme_list[nonTopIndex].author.nickname,
            fans: this.count(Array[1].user.follower_count),
            user_shortid: Array[1].user.unique_id == '' ? Array[1].user.short_id : Array[1].user.unique_id,
            total_favorited: this.count(Array[1].user.total_favorited),
            following_count: this.count(Array[1].user.following_count),
          },
          { e: this.e, scale: 1.4, retType: 'base64' },
        )
      }
      await Bot.pickGroup(Number(data.group_id[i])).sendMsg(img)
      await redis.set(key, 1)
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
        const group_id = Config.douyinpushlist[i].group_id
        const secUid = sec_idlist[i].sec_uid || sec_idlist[i]
        const data = await new iKun('UserVideosList').GetData({ user_id: secUid })
        let awemeId,
          createTime,
          nonTopIndex = 0
        /** 跳过所有置顶视频 */
        while (nonTopIndex < data.aweme_list.length && data.aweme_list[nonTopIndex].is_top === 1) {
          nonTopIndex++
        }
        if (nonTopIndex < data.aweme_list.length) {
          createTime = data.aweme_list[nonTopIndex].create_time
          awemeId = data.aweme_list[nonTopIndex].aweme_id
        }
        result.push({ create_time: createTime, group_id: group_id, sec_id: secUid, aweme_id: awemeId })
      }
    } else {
      for (let i = 0; i < Config.douyinpushlist.length; i++) {
        const group_id = Config.douyinpushlist[i].group_id
        const secUid = Config.douyinpushlist[i].sec_uid
        const data = await new iKun('UserVideosList').GetData({ user_id: secUid })
        await common.sleep(200)
        let awemeId,
          createTime,
          nonTopIndex = 0
        /** 跳过所有置顶视频 */
        while (nonTopIndex < data.aweme_list.length && data.aweme_list[nonTopIndex].is_top === 1) {
          nonTopIndex++
        }
        if (nonTopIndex < data.aweme_list.length) {
          createTime = data.aweme_list[nonTopIndex].create_time
          awemeId = data.aweme_list[nonTopIndex].aweme_id
        }
        const livedata = await new iKun('直播间ID').GetData(data.aweme_list[0].author.uid)

        // 首先检查是否开播
        if (livedata.data[0]?.user_live[0]?.live_status == 1) {
          if (this.force) {
            result.push({
              create_time: createTime + 1,
              group_id: group_id,
              sec_id: secUid,
              room_id: livedata.data[0]?.user_live[0]?.room_id_str,
              live: true,
            })
          } else if (!(await redis.get(`kkk:douyPush-live${livedata.data[0]?.user_live[0]?.room_id_str}`))) {
            result.push({
              create_time: createTime + 1,
              group_id: group_id,
              sec_id: secUid,
              room_id: livedata.data[0]?.user_live[0]?.room_id_str,
              live: true,
            })
          }
        } else {
          result.push({
            create_time: createTime,
            group_id: group_id,
            sec_id: secUid,
            aweme_id: awemeId,
          })
          await redis.del(`kkk:douyPush-live${livedata.data[0]?.user_live[0]?.room_id_str}`)
        }
      }
    }
    if (write) {
      await redis.set('kkk:douyPush', JSON.stringify(result))
    }
    return result
  }

  async setting(data) {
    try {
      let index = 0
      while (data.data[index].card_unique_name !== 'user') {
        index++
      }
      let msg
      const sec_uid = data.data[index].user_list[0].user_info.sec_uid
      const UserInfoData = await new iKun('UserInfoData').GetData({ user_id: sec_uid })

      const config = JSON.parse(fs.readFileSync(this.ConfigPath))
      const group_id = this.e.group_id
      /** 处理抖音号 */
      let user_shortid
      UserInfoData.user.unique_id == '' ? (user_shortid = UserInfoData.user.short_id) : (user_shortid = UserInfoData.user.unique_id)

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
          logger.info(`\n删除成功！${UserInfoData.user.nickname}\n抖音号：${user_shortid}\nsec_id：${UserInfoData.user.sec_uid}`)
          msg = `群：${group_id}\n删除成功！${UserInfoData.user.nickname}\n抖音号：${user_shortid}`

          // 如果删除后 group_id 数组为空，则删除整个属性
          if (existingItem.group_id.length === 0) {
            const index = config.douyinpushlist.indexOf(existingItem)
            config.douyinpushlist.splice(index, 1)
          }
        } else {
          // 否则，将新的 group_id 添加到该 sec_uid 对应的数组中
          existingItem.group_id.push(group_id)
          msg = `群：${group_id}\n添加成功！${UserInfoData.user.nickname}\n抖音号：${user_shortid}`
          logger.info(`\n设置成功！${UserInfoData.user.nickname}\n抖音号：${user_shortid}\nsec_id：${UserInfoData.user.sec_uid}`)
        }
      } else {
        // 如果不存在相同的 sec_uid，则新增一个属性
        config.douyinpushlist.push({ sec_uid, group_id: [group_id], remark: UserInfoData.user.nickname })
        msg = `群：${group_id}\n添加成功！${UserInfoData.user.nickname}\n抖音号：${user_shortid}`
      }

      fs.writeFileSync(this.ConfigPath, JSON.stringify(config, null, 2))
      return msg
    } catch {
      return '无法获取用户信息，请确认抖音号是否正确'
    }
  }

  convertTimestampToDateTime(timestamp) {
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
    } else {
      // 过滤掉cachedata中data.sec_id不存在的对象
      let filteredCacheData = cachedata.filter((item) => {
        return data.some((dataItem) => dataItem.sec_id === item.sec_id)
      })
      // 重新排序cachedata，使得其顺序与data的顺序相匹配
      let reorderedCacheData = data.map((dataItem) => {
        return filteredCacheData.find((cacheItem) => cacheItem.sec_id === dataItem.sec_id)
      })
      cachedata = reorderedCacheData
    }

    return sec_idlist.length > 0 ? resources : cachedata
  }

  async checkremark() {
    let config = JSON.parse(fs.readFileSync(this.ConfigPath))
    const abclist = []
    for (let i = 0; i < Config.douyinpushlist.length; i++) {
      const remark = Config.douyinpushlist[i].remark
      const group_id = Config.douyinpushlist[i].group_id
      const sec_uid = Config.douyinpushlist[i].sec_uid

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

  desc(video_obj, text) {
    if (Array.isArray(video_obj) && video_obj.length > 0) {
      const regex = new RegExp(video_obj.map((obj) => `#${obj.hashtag_name}`).join('|'), 'g')
      // 使用正则表达式替换匹配到的话题标签
      text = text.replace(regex, (match) => {
        // 对于每个匹配的话题标签，检查它是否在video_obj中存在
        const matchedObj = video_obj.find((obj) => `#${obj.hashtag_name}` === match)
        if (matchedObj) {
          return `<span style="font-weight: bold; color: #cfcfcf">${match}</span>`
        }
        return match
      })
    }
    return text
  }

  async forcepush(data) {
    for (const item of data) {
      item.group_id = [...[this.e.group_id]]
      await this.getdata(item)
    }
  }
}
