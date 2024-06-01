import { iKun } from '#douyin'
import { base, Render, GetID, Config, DB } from '#modules'
import fs from 'fs'

export default class push extends base {
  constructor(e = {}, force) {
    super(e)
    if (this.botadapter === 'QQBot') {
      return true
    }
    this.headers.Referer = 'https://www.douyin.com'
    this.headers.Cookie = Config.ck
    this.force = force
  }

  async action() {
    await this.checkremark()
    let cachedata = await DB.FindAll('douyin'),
      data

    try {
      /** 获取最新那一条 */
      data = await this.getuserdata(false)
      cachedata = await this.findMismatchedAwemeIds(data, cachedata)

      if (data.length == 0) return true

      if (this.force) {
        await this.forcepush(data)
        return await redis.set('kkk:douyPush', JSON.stringify(data))
      }

      for (let i = 0; i < data.length; i++) {
        if (data[i].create_time == cachedata[i]?.create_time) {
          for (const key of data[i].group_id) {
            const cackey = await redis.get(`kkk:douyPush-${key}-${data[i].aweme_id}`)
            if (!cackey) {
              data[i].group_id = [key]
              await this.getdata(data[i])
              logger.info(`${data[i].remark} aweme_id: [${cachedata[i]?.aweme_id}] ➩ [${data[i]?.aweme_id}]`)
            }
          }
        } else if (data[i].create_time > cachedata[i]?.create_time || (data[i].create_time && !cachedata[i]?.create_time)) {
          await this.getdata(data[i])
          logger.info(`${data[i].remark} aweme_id: [${cachedata[i]?.aweme_id}] ➩ [${data[i]?.aweme_id}]`)
        }
      }
      await redis.set('kkk:douyPush', JSON.stringify(data))
    } catch (error) {
      logger.error(error)
      await redis.set('kkk:douyPush', JSON.stringify(data))
    }
  }

  async getdata(data) {
    let Array = [data.VideoList, data.UserInfo]
    let img,
      nonTopIndex = 0,
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
      try {
        await Bot.pickGroup(Number(data.group_id[i])).sendMsg(img)
      } catch (error) {
        logger.error(error)
        await redis.set(key, 1)
      }
      await redis.set(key, 1)
    }
  }

  /**
   *
   * @param {*} write 是否写入
   * @param {*} sec_uidlist 要获取aweme_id的用户uid列表
   * @returns
   */
  async getuserdata(write, sec_uidlist) {
    let willbepushlist = {}

    try {
      for (const item of Config.douyinpushlist) {
        const videolist = await new iKun('UserVideosList').GetData({ user_id: item.sec_uid })
        if (videolist.aweme_list.length > 0) {
          // 遍历接口返回的视频列表
          for (const aweme of videolist.aweme_list) {
            let is_top = aweme.is_top === 1,
              shouldPush = false,
              exitTry = false
            try {
              if (exitTry) {
                // 如果需要退出 try 块，跳过此次循环的剩余部分
                continue
              }
              if (is_top) {
                const idlist = await DB.FindAll('douyin')
                if (idlist.length === 0) {
                  shouldPush = true
                  exitTry = true
                  continue
                }
                // 遍历数据库中的每个群对象
                for (const group of idlist) {
                  // 遍历当前群的推送用户对象
                  for (const userInfo of group.data) {
                    if (userInfo.sec_uid === item.sec_uid) {
                      // 找到对应用户，如果 aweme_id 不在在 aweme_idlist 中
                      if (!userInfo.aweme_idlist?.includes(aweme.aweme_id)) {
                        shouldPush = true
                        break // 跳出内部循环
                      }
                    }
                  }
                  if (shouldPush) {
                    break // 跳出外部循环
                  }
                }
              }
            } catch (error) {
              logger.error('数据库查询失败:', error)
              break
            }

            const now = new Date().getTime()
            const createTime = parseInt(aweme.create_time, 10) * 1000
            const timeDifference = (now - createTime) / 1000 // 时间差，单位秒

            // 如果 置顶视频的 aweme_id 不在数据库中，或者视频是新发布的（1天内），则 push 到 willbepushlist
            if (shouldPush || timeDifference < 86400) {
              // 确保 willbepushlist[aweme.aweme_id] 是一个对象
              if (!willbepushlist[aweme.aweme_id]) {
                willbepushlist[aweme.aweme_id] = {
                  remark: item.remark,
                  sec_uid: item.sec_uid,
                  create_time: aweme.create_time,
                  group_id: [], // 初始化 group_id 为数组
                  Detail_Data: aweme, // 存储 aweme 对象
                }
              }
              willbepushlist[aweme.aweme_id].group_id = [...item.group_id]
            }
          }
          willbepushlist
          console.log(willbepushlist)
        } else {
          throw new Error(`「${item.remark}」的主页视频列表数量为零！`)
        }

        // for (const group_id of item.group_id) {
        //   if (!data[group_id]) {
        //     data[group_id] = []
        //   }
        //   data[group_id].push({ remark: item.remark, sec_uid: item.sec_uid })
        // }
      }
    } catch (error) {
      console.log(error)
    }

    const DBdata = await this.transformedData(willbepushlist)
    for (const item of DBdata) {
      await DB.CreateSheet('douyin', item.group_id, item.data)
    }
    // ...
    return willbepushlist
  }

  async transformedData(data) {
    const secUidMap = {}

    for (const key in data) {
      const item = data[key]
      if (!secUidMap[item.sec_uid]) {
        secUidMap[item.sec_uid] = {
          remark: item.remark,
          sec_uid: item.sec_uid,
          aweme_idlist: [key],
        }
      } else {
        secUidMap[item.sec_uid].aweme_idlist.push(key)
      }
    }

    const finalOutput = []

    // 根据每个sec_uid的group_id，构建最终的输出格式
    for (const secUid in secUidMap) {
      const userObj = secUidMap[secUid]
      userObj.group_id = new Set() // 使用Set来自动去重group_id

      // 遍历原始数据，找到此sec_uid对应的所有group_id
      for (const key in data) {
        const item = data[key]
        if (item.sec_uid === secUid) {
          item.group_id.forEach((groupId) => userObj.group_id.add(groupId)) // 添加group_id到Set中
        }
      }

      // 将Set转换为数组
      userObj.group_id = Array.from(userObj.group_id)

      // 为每个group_id创建一个对象，并将其添加到finalOutput中
      userObj.group_id.forEach((groupId) => {
        const groupObj = finalOutput.find((obj) => obj.group_id === groupId)
        if (!groupObj) {
          finalOutput.push({
            group_id: groupId,
            data: [userObj],
          })
        } else {
          // 如果已经存在该group_id的对象，则直接添加用户信息
          groupObj.data.push(userObj)
        }
      })
    }
    return finalOutput
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
    const sec_uidlist = []
    let resources = []
    if (data.length > cachedata.length) {
      for (let i = 0; i < data.length; i++) {
        if (data[i].sec_uid !== cachedata[i]?.sec_uid) {
          mismatchedIds.push(data[i].aweme_id)
          sec_uidlist.push(data[i].sec_uid)
        }
      }
      if (sec_uidlist.length > 0) {
        let newdata = []
        newdata = await this.getuserdata(false, sec_uidlist)
        resources = cachedata.concat(newdata)
        await redis.set('kkk:douyPush', JSON.stringify(resources))
      }
    } else {
      // 过滤掉cachedata中data.sec_uid不存在的对象
      let filteredCacheData = cachedata.filter((item) => {
        return data.some((dataItem) => dataItem.sec_uid === item.sec_uid)
      })
      // 重新排序cachedata，使得其顺序与data的顺序相匹配
      let reorderedCacheData = data.map((dataItem) => {
        return filteredCacheData.find((cacheItem) => cacheItem.sec_uid === dataItem.sec_uid)
      })
      cachedata = reorderedCacheData
    }

    return sec_uidlist.length > 0 ? resources : cachedata
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
          logger.info(`\n删除成功！${UserInfoData.user.nickname}\n抖音号：${user_shortid}\sec_uid${UserInfoData.user.sec_uid}`)
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
          logger.info(`\n设置成功！${UserInfoData.user.nickname}\n抖音号：${user_shortid}\sec_uid${UserInfoData.user.sec_uid}`)
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
}
