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

    try {
      let data = await this.getuserdata()
      data = this.findMismatchedAwemeIds(data)

      if (Object.keys(data).length === 0) return true

      if (this.force) return await this.forcepush(data)
      else return await this.getdata(data)
    } catch (error) {
      logger.error(error)
    }
  }

  async getdata(data) {
    if (Object.keys(data).length === 0) return true
    for (const awemeId in data) {
      const Detail_Data = data[awemeId].Detail_Data
      const iddata = await GetID(Detail_Data.share_url)
      let img = await Render.render(
        'html/douyin/douyininfo',
        {
          image_url: Detail_Data.video.animated_cover.url_list[0] || Detail_Data.video.cover.url_list[0],
          desc: this.desc(Detail_Data, Detail_Data.desc),
          dianzan: this.count(Detail_Data.statistics.digg_count),
          pinglun: this.count(Detail_Data.statistics.comment_count),
          share: this.count(Detail_Data.statistics.share_count),
          shouchang: this.count(Detail_Data.statistics.collect_count),
          create_time: this.convertTimestampToDateTime(data[awemeId].create_time),
          avater_url: 'https://p3-pc.douyinpic.com/aweme/1080x1080/' + Detail_Data.author.avatar_uri,
          share_url: iddata.is_mp4
            ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${Detail_Data.video.play_addr.uri}&ratio=1080p&line=0`
            : Detail_Data.share_url,
          username: Detail_Data.author.nickname,
          fans: this.count(Detail_Data.author.follower_count),
          user_shortid: Detail_Data.author.sec_uid.substring(0, 15) + '...',
          total_favorited: this.count(Detail_Data.author.total_favorited),
          following_count: this.count(Detail_Data.author.follower_count),
        },
        { e: this.e, scale: 1.4, retType: 'base64' },
      )

      // 遍历 group_id 数组，并发送消息
      try {
        for (const groupId of data[awemeId].group_id) {
          let status = await Bot.pickGroup(Number(groupId)).sendMsg(img)
          if (status) {
            const DBdata = await DB.FindGroup('douyin', groupId)

            /**
             * 检查 DBdata 中是否存在与给定 sec_uid 匹配的项
             * @param {Object} DBdata - 包含数据的对象
             * @param {string} secUidToCheck - 要检查的 sec_uid
             * @returns {string} 匹配的 sec_uid
             */
            const findMatchingSecUid = (DBdata, secUidToCheck) => {
              for (const sec_uid in DBdata) {
                if (DBdata.hasOwnProperty(sec_uid) && DBdata[sec_uid].sec_uid === secUidToCheck) {
                  return secUidToCheck
                }
              }
              return false // 未找到匹配的 sec_uid，返回 false
            }
            let newEntry
            if (DBdata) {
              // 如果 DBdata 存在，遍历 DBdata 来查找对应的 sec_uid
              let found = false

              if (data[awemeId].sec_uid === findMatchingSecUid(DBdata, data[awemeId].sec_uid)) {
                // 如果找到了对应的 sec_uid，将 awemeId 添加到 aweme_idlist 数组中
                const isSecUidFound = findMatchingSecUid(DBdata, data[awemeId].sec_uid)
                if (isSecUidFound && this.force ? true : !DBdata[data[awemeId].sec_uid].aweme_idlist.includes(awemeId)) {
                  DBdata[isSecUidFound].aweme_idlist.push(awemeId)
                  await DB.UpdateGroupData('douyin', groupId, DBdata)
                  found = true
                }
              }

              if (!found) {
                // 如果没有找到对应的 sec_uid，创建一个新的条目
                newEntry = {
                  remark: data[awemeId].remark,
                  create_time: data[awemeId].create_time,
                  sec_uid: data[awemeId].sec_uid,
                  aweme_idlist: [awemeId],
                  avatar_img: 'https://p3-pc.douyinpic.com/aweme/1080x1080/' + data[awemeId].Detail_Data.author.avatar_uri,
                }
                DBdata[data[awemeId].sec_uid] = newEntry
                // 更新数据库
                await DB.UpdateGroupData('douyin', groupId, DBdata)
              }
            } else {
              // 如果 DBdata 为空，创建新的条目
              await DB.CreateSheet('douyin', groupId, {
                [data[awemeId].sec_uid]: {
                  remark: data[awemeId].remark,
                  create_time: data[awemeId].create_time,
                  sec_uid: data[awemeId].sec_uid,
                  aweme_idlist: [awemeId],
                  avatar_img: 'https://p3-pc.douyinpic.com/aweme/1080x1080/' + data[awemeId].Detail_Data.author.avatar_uri,
                },
              })
            }
          }
        }
      } catch (error) {
        logger.error(error)
      }
    }
  }

  /**
   *
   * @param {*} write 是否写入
   * @param {*} sec_uidlist 要获取aweme_id的用户uid列表
   * @returns 获取用户一天内的所有视频对象
   */
  async getuserdata() {
    let willbepushlist = {}

    try {
      for (const item of Config.douyinpushlist) {
        const videolist = await new iKun('UserVideosList').GetData({ user_id: item.sec_uid })
        const ALL_DBdata = await DB.FindAll('douyin')
        // 检查配置文件中的群组列表与数据库中的群组列表是否一致
        const dbGroupIds = new Set(Object.keys(ALL_DBdata).map(Number)) // 将数据库中的群组ID转换为数字并去重
        const configGroupIds = Array.from(new Set(item.group_id)) // 配置文件中的群组ID集合

        // 找出新添加的群组ID
        const newGroupIds = configGroupIds.filter((groupId) => !dbGroupIds.has(groupId))
        if (videolist.aweme_list.length > 0) {
          // 遍历接口返回的视频列表
          for (const aweme of videolist.aweme_list) {
            const now = new Date().getTime()
            const createTime = parseInt(aweme.create_time, 10) * 1000
            const timeDifference = (now - createTime) / 1000 // 时间差，单位秒

            let is_top = aweme.is_top === 1, // 是否为置顶
              shouldPush = false, // 是否列入推送数组
              shouldBreak = false, // 是否跳出循环
              exitTry = false // 是否退出 try 块
            try {
              if (exitTry) {
                // 如果需要退出 try 块，跳过此次循环的剩余部分
                continue
              }
              if (is_top) {
                if (Object.keys(ALL_DBdata).length === 0) {
                  shouldPush = true
                  exitTry = true
                  continue
                }
                // 遍历数据库中的每个群对象
                for (const groupId in ALL_DBdata) {
                  if (Object.keys(ALL_DBdata[groupId]).length === 0) {
                    shouldBreak = true
                    break
                  }
                  // 遍历当前群的推送用户对象
                  for (const sec_uid in ALL_DBdata[groupId]) {
                    if (ALL_DBdata[groupId][sec_uid].sec_uid === item.sec_uid) {
                      // 找到对应用户，如果 aweme_id 不在在 aweme_idlist 中，也就是没推送过
                      if (!ALL_DBdata[groupId][sec_uid].aweme_idlist?.includes(aweme.aweme_id) && timeDifference < 86400) {
                        shouldPush = true
                        break // 跳出内部循环，判定为该视频要进行推送
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

            // 如果 置顶视频的 aweme_id 不在数据库中，或者视频是新发布的（1天内），则 push 到 willbepushlist
            if ((newGroupIds.length > 0 && timeDifference < 86400) || shouldPush || timeDifference < 86400) {
              // 确保 willbepushlist[aweme.aweme_id] 是一个对象
              if (!willbepushlist[aweme.aweme_id]) {
                willbepushlist[aweme.aweme_id] = {
                  remark: item.remark,
                  sec_uid: item.sec_uid,
                  create_time: aweme.create_time,
                  group_id: [], // 初始化 group_id 为数组
                  Detail_Data: aweme, // 存储 detail 对象
                  avatar_img: 'https://p3-pc.douyinpic.com/aweme/1080x1080/' + aweme.author.avatar_uri,
                }
              }
              willbepushlist[aweme.aweme_id].group_id = newGroupIds.length > 0 ? [...newGroupIds] : [...item.group_id] // item.group_id 为配置文件的 group_id
            }
          }
        } else {
          throw new Error(`「${item.remark}」的主页视频列表数量为零！`)
        }
      }
    } catch (error) {
      console.log(error)
    }

    const DBdata = await DB.FindAll('douyin')
    // 这里是强制数组的第一个对象中的内容 DBdata[0]?.data 因为调用这个函数的上层有遍历群组逻辑
    // DBdata[0]?.data 则是当前群组的推送用户数据
    return { willbepushlist, DBdata }
  }

  /**
   * 进行新旧作品判定，通过 inputData.DBdata
   * @param {obj} inputData 要处理的数据
   * @returns 获取推送对象列表，已经过新旧作品判定
   */
  findMismatchedAwemeIds(inputData) {
    if (!inputData.DBdata) return inputData.willbepushlist
    const willbepushByGroupId = {}
    for (const videoId in inputData.willbepushlist) {
      inputData.willbepushlist[videoId].group_id.forEach((groupId) => {
        if (!willbepushByGroupId[groupId]) {
          willbepushByGroupId[groupId] = []
        }
        willbepushByGroupId[groupId].push(videoId)
      })
    }

    // 遍历 DBdata，找出存在于 willbepushByGroupId 中的 group_id
    for (const groupId in inputData.DBdata) {
      if (willbepushByGroupId[groupId]) {
        // 遍历每个 group_id 下的 sec_uid
        for (const secUid in inputData.DBdata[groupId]) {
          // 检查 aweme_idlist 中的每个 aweme_id
          inputData.DBdata[groupId][secUid].aweme_idlist.forEach((awemeId) => {
            // 如果 aweme_id 存在于 willbepushByGroupId[groupId] 中
            if (willbepushByGroupId[groupId].includes(awemeId)) {
              // 移除 willbepushlist 中对应的视频对象
              delete inputData.willbepushlist[awemeId]
            }
          })
        }
      }
    }

    return inputData.willbepushlist
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

  /**
   *
   * @param {string} timestamp 时间戳
   * @returns 获取 年-月-日 时:分
   */
  convertTimestampToDateTime(timestamp) {
    const date = new Date(timestamp * 1000)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}`
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
    for (const detail in data) {
      data[detail].group_id = [...[this.e.group_id]]
    }
    await this.getdata(data)
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
