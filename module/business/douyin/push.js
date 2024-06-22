import { iKun } from '#douyin'
import { Base, Render, GetID, Config, DB } from '#components'
import fs from 'fs'

export default class push extends Base {
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
          image_url: iddata.is_mp4 ? Detail_Data.video.animated_cover.url_list[0] || Detail_Data.video.cover.url_list[0] : Detail_Data.images[0].url_list[0],
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
          following_count: this.count(Detail_Data.author.following_count),
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
                  DBdata[isSecUidFound].create_time = Number(data[awemeId].create_time)
                  await DB.UpdateGroupData('douyin', groupId, DBdata)
                  found = true
                }
              }

              if (!found) {
                // 如果没有找到对应的 sec_uid，创建一个新的条目
                newEntry = {
                  remark: data[awemeId].remark,
                  create_time: Number(data[awemeId].create_time),
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
let bba = {
  aweme_id: '7382883226563415323',
  desc: '这就是二命流萤的实力吗 #精神状态群舞#流萤 #ooc致歉#崩坏星穹铁道#再见匹诺康尼',
  create_time: 1718961462,
  author: {
    uid: '64453308034',
    show_nearby_active: false,
    nickname: '兔丸儿',
    disable_image_comment_saved: 0,
    card_sort_priority: null,
    ky_only_predict: 0,
    avatar_thumb: {
      uri: '100x100/aweme-avatar/tos-cn-avt-0015_5951b6309d669aab6efc2ee2a14bb942',
      url_list: ['https://p3-pc.douyinpic.com/aweme/100x100/aweme-avatar/tos-cn-avt-0015_5951b6309d669aab6efc2ee2a14bb942.jpeg?from=327834062'],
      width: 720,
      height: 720,
    },
    data_label_list: null,
    batch_unfollow_relation_desc: null,
    close_friend_type: 0,
    follow_status: 0,
    aweme_count: 376,
    following_count: 138,
    follower_count: 5449059,
    favoriting_count: 4700,
    total_favorited: 141974103,
    im_role_ids: null,
    hide_search: false,
    constellation: 9,
    verification_permission_ids: null,
    not_seen_item_id_list: null,
    weibo_verify: '',
    custom_verify: '',
    follower_request_status: 0,
    account_cert_info: '{}',
    special_lock: 1,
    need_recommend: 0,
    is_binded_weibo: false,
    weibo_name: '',
    weibo_schema: '',
    weibo_url: '',
    story_open: false,
    is_not_show: false,
    has_facebook_token: false,
    has_twitter_token: false,
    fb_expire_time: 0,
    tw_expire_time: 0,
    has_youtube_token: false,
    youtube_expire_time: 0,
    creator_tag_list: null,
    live_verify: 0,
    is_ban: false,
    card_entries_not_display: null,
    shield_follow_notice: 0,
    shield_digg_notice: 0,
    shield_comment_notice: 0,
    profile_mob_params: null,
    avatar_schema_list: null,
    awemehts_greet_info: '',
    share_info: {
      share_url: '',
      share_weibo_desc: '',
      share_desc: '',
      share_title: '',
      share_qrcode_url: {
        uri: '2efe0049e9d677be96f6',
        url_list: [
          'https://p3-pc-sign.douyinpic.com/obj/2efe0049e9d677be96f6?x-expires=1719064800&x-signature=xDIdOa0FO3eHLq8pQt0mq5KZpbs%3D&from=327834062',
          'https://p9-pc-sign.douyinpic.com/obj/2efe0049e9d677be96f6?x-expires=1719064800&x-signature=hsVvOaMQdjVRrArNHqviQUUUgsY%3D&from=327834062',
        ],
        width: 720,
        height: 720,
      },
      share_title_myself: '',
      share_title_other: '',
      share_desc_info: '',
    },
    user_not_see: 0,
    display_info: null,
    user_not_show: 1,
    enterprise_verify_reason: '',
    is_ad_fake: false,
    live_high_value: 0,
    search_impr: {
      entity_id: '64453308034',
    },
    account_region: '',
    offline_info_list: null,
    not_seen_item_id_list_v2: null,
    live_agreement: 0,
    link_item_list: null,
    with_shop_entry: false,
    cf_list: null,
    interest_tags: null,
    has_orders: false,
    prevent_download: false,
    show_image_bubble: false,
    contacts_status: 2,
    unique_id_modify_time: 1719046408,
    card_entries: null,
    ins_id: '',
    google_account: '',
    youtube_channel_id: '',
    youtube_channel_title: '',
    apple_account: 0,
    with_dou_entry: false,
    with_fusion_shop_entry: true,
    is_phone_binded: false,
    accept_private_policy: false,
    twitter_id: '',
    twitter_name: '',
    user_canceled: false,
    has_email: false,
    personal_tag_list: null,
    live_agreement_time: 0,
    status: 1,
    create_time: 0,
    avatar_uri: 'aweme-avatar/tos-cn-avt-0015_5951b6309d669aab6efc2ee2a14bb942',
    follower_status: 0,
    neiguang_shield: 0,
    endorsement_info_list: null,
    risk_notice_text: '',
    reflow_page_gid: 0,
    reflow_page_uid: 0,
    user_rate: 1,
    follower_list_secondary_information_struct: null,
    download_prompt_ts: 0,
    react_setting: 0,
    live_commerce: false,
    cover_url: [
      {
        uri: 'c8510002be9a3a61aad2',
        url_list: [
          'https://p3-pc-sign.douyinpic.com/obj/c8510002be9a3a61aad2?x-expires=1720252800&x-signature=EwkucnxyWQlStOBz2lm5DJTYay8%3D&from=327834062',
          'https://p9-pc-sign.douyinpic.com/obj/c8510002be9a3a61aad2?x-expires=1720252800&x-signature=lnDvx07aWQ%2FbqEb6xEnlg9J5jjQ%3D&from=327834062',
        ],
        width: 720,
        height: 720,
      },
    ],
    is_blocking_v2: false,
    has_insights: false,
    share_qrcode_uri: '2efe0049e9d677be96f6',
    is_blocked_v2: false,
    user_mode: 0,
    user_period: 0,
    private_relation_list: null,
    user_permissions: null,
    signature_extra: null,
    cv_level: '',
    is_cf: 0,
    familiar_visitor_user: null,
    text_extra: null,
    special_follow_status: 0,
    special_people_labels: null,
    batch_unfollow_contain_tabs: null,
    contrail_list: null,
    sec_uid: 'MS4wLjABAAAAWVwhAs0MqebSA0nqyswZZXZZACn2Z8JOjGXuUlPNeaY',
    need_points: null,
    homepage_bottom_toast: null,
    aweme_hotsoon_auth: 1,
    can_set_geofencing: null,
    room_id_str: '0',
    white_cover_url: null,
    user_tags: null,
    aweme_control: {
      can_forward: true,
      can_share: true,
      can_comment: true,
      can_show_comment: true,
    },
    max_follower_count: 0,
    enable_nearby_visible: true,
    ban_user_functions: [],
  },
  music: {
    id: 7381787158287273000,
    id_str: '7381787158287272741',
    title: '@阿哲什么都会创作的原声',
    author: '阿哲什么都会',
    album: '',
    cover_hd: {
      uri: '1080x1080/aweme-avatar/tos-cn-i-0813_4236987176844942ae90a559b88e9bfc',
      url_list: ['https://p3-pc.douyinpic.com/aweme/1080x1080/aweme-avatar/tos-cn-i-0813_4236987176844942ae90a559b88e9bfc.jpeg?from=327834062'],
      width: 720,
      height: 720,
    },
    cover_large: {
      uri: '1080x1080/aweme-avatar/tos-cn-i-0813_4236987176844942ae90a559b88e9bfc',
      url_list: ['https://p3-pc.douyinpic.com/aweme/1080x1080/aweme-avatar/tos-cn-i-0813_4236987176844942ae90a559b88e9bfc.jpeg?from=327834062'],
      width: 720,
      height: 720,
    },
    cover_medium: {
      uri: '720x720/aweme-avatar/tos-cn-i-0813_4236987176844942ae90a559b88e9bfc',
      url_list: ['https://p3-pc.douyinpic.com/aweme/720x720/aweme-avatar/tos-cn-i-0813_4236987176844942ae90a559b88e9bfc.jpeg?from=327834062'],
      width: 720,
      height: 720,
    },
    cover_thumb: {
      uri: '100x100/aweme-avatar/tos-cn-i-0813_4236987176844942ae90a559b88e9bfc',
      url_list: ['https://p3-pc.douyinpic.com/aweme/100x100/aweme-avatar/tos-cn-i-0813_4236987176844942ae90a559b88e9bfc.jpeg?from=327834062'],
      width: 720,
      height: 720,
    },
    play_url: {
      uri: 'https://sf5-hl-cdn-tos.douyinstatic.com/obj/ies-music/7381787164813675273.mp3',
      url_list: [
        'https://sf5-hl-cdn-tos.douyinstatic.com/obj/ies-music/7381787164813675273.mp3',
        'https://sf6-cdn-tos.douyinstatic.com/obj/ies-music/7381787164813675273.mp3',
      ],
      width: 720,
      height: 720,
      url_key: '7381787158287272741',
    },
    schema_url: '',
    source_platform: 23,
    start_time: 0,
    end_time: 0,
    duration: 29,
    extra:
      '{"reviewed":0,"beats":{},"music_label_id":null,"extract_item_id":7381787140461448482,"is_high_follow_user":false,"cover_colors":null,"is_red":0,"with_aed_model":1,"hit_high_follow_original":false,"dsp_switch":0,"douyin_beats_info":{},"schedule_search_time":0,"hotsoon_review_time":-1,"music_tagging":{"Languages":["Indonesian"],"Moods":["Happy","Dynamic"],"Genres":["DJ","Others"],"Themes":["Summer","Dance"],"AEDs":["Vocal"],"SingingVersions":null,"Instruments":null},"is_subsidy_exp":false,"aggregate_exempt_conf":[],"hit_high_follow_extend":false,"has_edited":0,"review_unshelve_reason":0,"is_aed_music":1}',
    user_count: 0,
    position: null,
    collect_stat: 0,
    status: 1,
    offline_desc: '',
    owner_id: '1891607220071063',
    owner_nickname: '阿哲什么都会',
    is_original: false,
    mid: '7381787158287272741',
    binded_challenge_id: 0,
    redirect: false,
    is_restricted: false,
    author_deleted: false,
    is_del_video: false,
    is_video_self_see: false,
    owner_handle: '84177635728',
    author_position: null,
    prevent_download: false,
    strong_beat_url: {
      uri: 'https://sf5-hl-cdn-tos.douyinstatic.com/obj/ies-music/pattern/5fbba23f7b1e324add523b7aabb85c8e.json',
      url_list: [
        'https://sf5-hl-cdn-tos.douyinstatic.com/obj/ies-music/pattern/5fbba23f7b1e324add523b7aabb85c8e.json',
        'https://sf27-cdn-tos.douyinstatic.com/obj/ies-music/pattern/5fbba23f7b1e324add523b7aabb85c8e.json',
      ],
      width: 720,
      height: 720,
    },
    unshelve_countries: null,
    prevent_item_download_status: 0,
    external_song_info: [],
    sec_uid: 'MS4wLjABAAAAK7AfPRmpMhdFkX2yBaSY7aAfR3PQOSaIzcevjRr2qQU7eM1z1MsH5XBY1NFApHC8',
    avatar_thumb: {
      uri: '100x100/aweme-avatar/tos-cn-i-0813_4236987176844942ae90a559b88e9bfc',
      url_list: ['https://p3-pc.douyinpic.com/aweme/100x100/aweme-avatar/tos-cn-i-0813_4236987176844942ae90a559b88e9bfc.jpeg?from=327834062'],
      width: 720,
      height: 720,
    },
    avatar_medium: {
      uri: '720x720/aweme-avatar/tos-cn-i-0813_4236987176844942ae90a559b88e9bfc',
      url_list: ['https://p3-pc.douyinpic.com/aweme/720x720/aweme-avatar/tos-cn-i-0813_4236987176844942ae90a559b88e9bfc.jpeg?from=327834062'],
      width: 720,
      height: 720,
    },
    avatar_large: {
      uri: '1080x1080/aweme-avatar/tos-cn-i-0813_4236987176844942ae90a559b88e9bfc',
      url_list: ['https://p3-pc.douyinpic.com/aweme/1080x1080/aweme-avatar/tos-cn-i-0813_4236987176844942ae90a559b88e9bfc.jpeg?from=327834062'],
      width: 720,
      height: 720,
    },
    preview_start_time: 0,
    preview_end_time: 0,
    is_commerce_music: false,
    is_original_sound: true,
    audition_duration: 29,
    shoot_duration: 29,
    reason_type: 0,
    artists: [],
    lyric_short_position: null,
    mute_share: false,
    tag_list: null,
    dmv_auto_show: false,
    is_pgc: false,
    is_matched_metadata: false,
    is_audio_url_with_cookie: false,
    matched_pgc_sound: {
      author: 'Alekset',
      title: 'Легенды (feat. Griffonus)',
      mixed_title: '',
      mixed_author: '',
      cover_medium: {
        uri: 'tos-cn-v-2774c002/owGXAInAWEKDBL8aZgBeAe9sCfANCzAyGMEFFD',
        url_list: [
          'https://p11.douyinpic.com/aweme/200x200/tos-cn-v-2774c002/owGXAInAWEKDBL8aZgBeAe9sCfANCzAyGMEFFD.jpeg',
          'https://p26.douyinpic.com/aweme/200x200/tos-cn-v-2774c002/owGXAInAWEKDBL8aZgBeAe9sCfANCzAyGMEFFD.jpeg',
          'https://p3.douyinpic.com/aweme/200x200/tos-cn-v-2774c002/owGXAInAWEKDBL8aZgBeAe9sCfANCzAyGMEFFD.jpeg',
        ],
        width: 720,
        height: 720,
      },
    },
    music_chart_ranks: null,
    can_background_play: true,
    music_status: 1,
    video_duration: 29,
    pgc_music_type: 2,
    author_status: 1,
    search_impr: {
      entity_id: '7381787158287272741',
    },
    song: {
      id: 7338449007771355000,
      id_str: '7338449007771355138',
      artists: null,
      chorus_v3_infos: null,
    },
    artist_user_infos: null,
    dsp_status: 10,
    musician_user_infos: null,
    luna_info: {
      is_luna_user: false,
      has_copyright: false,
    },
    music_collect_count: 0,
    music_cover_atmosphere_color_value: '',
  },
  friend_interaction: 0,
  video: {
    play_addr: {
      uri: 'v0d00fg10000cpqka5fog65vjudclcsg',
      url_list: [
        'http://v95-web-sz.douyinvod.com/9342a7f5221747e56144b0b78f088586/6676ad31/video/tos/cn/tos-cn-ve-15c001-alinc2/oYZqrPoIPz7WgI6QkCLMAjDGAyaWJBJeeo6BVf/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=3974&bt=3974&cs=0&ds=4&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=0&rc=Zzs6aGk3aGg2NzZlOzgzZEBpamZmeHk5cjhuczMzNGkzM0BeYTRhXmAvNmMxYC0yMWJjYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100o_101r_100B_100x_100z&dy_q=1719046408&feature_id=46a7bb47b4fd1280f3d3825bf2b29388&l=20240622165328B7D68783CF42A0A3D6FD',
        'http://v3-web.douyinvod.com/d09e7e0551b0dc5df0c66dbc92281341/6676ad31/video/tos/cn/tos-cn-ve-15c001-alinc2/oYZqrPoIPz7WgI6QkCLMAjDGAyaWJBJeeo6BVf/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=3974&bt=3974&cs=0&ds=4&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=0&rc=Zzs6aGk3aGg2NzZlOzgzZEBpamZmeHk5cjhuczMzNGkzM0BeYTRhXmAvNmMxYC0yMWJjYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100z_100o_101r_100B_100x&dy_q=1719046408&feature_id=46a7bb47b4fd1280f3d3825bf2b29388&l=20240622165328B7D68783CF42A0A3D6FD',
        'https://www.douyin.com/aweme/v1/play/?video_id=v0d00fg10000cpqka5fog65vjudclcsg&line=0&file_id=fae045580bc344f39e2ec4afde77d8ad&sign=f76858207e38f40356eb5c7457c616c1&is_play_url=1&source=PackSourceEnum_PUBLISH',
      ],
      width: 1080,
      height: 1920,
      url_key: 'v0d00fg10000cpqka5fog65vjudclcsg_h264_1080p_4069698',
      data_size: 4842432,
      file_hash: 'f76858207e38f40356eb5c7457c616c1',
      file_cs: 'c:0-9318-c53b|d:0-2421215-607e,2421216-4842431-85b4|a:v0d00fg10000cpqka5fog65vjudclcsg',
    },
    cover: {
      uri: 'tos-cn-i-0813/oMf9EAUOf10zBAb1rNCQIL3RgAFTAmAUdTDNAE',
      url_list: [
        'https://p3-pc-sign.douyinpic.com/tos-cn-i-0813/oMf9EAUOf10zBAb1rNCQIL3RgAFTAmAUdTDNAE~tplv-dy-cropcenter:323:430.jpeg?x-expires=2034403200&x-signature=aFHddQhsa3Hn2t5VSU5EdRe9gJw%3D&from=327834062&s=PackSourceEnum_PUBLISH&se=true&sh=323_430&sc=cover&biz_tag=pcweb_cover&l=20240622165328B7D68783CF42A0A3D6FD',
        'https://p3-pc-sign.douyinpic.com/obj/tos-cn-i-0813/oMf9EAUOf10zBAb1rNCQIL3RgAFTAmAUdTDNAE?x-expires=2034403200&x-signature=U4V0oAr1jV17mZoqzHphf5k7eBY%3D&from=327834062&s=PackSourceEnum_PUBLISH&se=false&sc=cover&biz_tag=pcweb_cover&l=20240622165328B7D68783CF42A0A3D6FD',
        'https://p9-pc-sign.douyinpic.com/obj/tos-cn-i-0813/oMf9EAUOf10zBAb1rNCQIL3RgAFTAmAUdTDNAE?x-expires=2034403200&x-signature=ivL2dNTgeYTKVKPQGJhT%2FKrBgDk%3D&from=327834062&s=PackSourceEnum_PUBLISH&se=false&sc=cover&biz_tag=pcweb_cover&l=20240622165328B7D68783CF42A0A3D6FD',
      ],
      width: 720,
      height: 720,
    },
    height: 1920,
    width: 1080,
    dynamic_cover: {
      uri: 'tos-cn-i-0813/oMf9EAUOf10zBAb1rNCQIL3RgAFTAmAUdTDNAE',
      url_list: [
        'https://p3-pc-sign.douyinpic.com/obj/tos-cn-i-0813/oMf9EAUOf10zBAb1rNCQIL3RgAFTAmAUdTDNAE?x-expires=1720252800&x-signature=0L5IXE%2BQZ%2FXZH0Vj7fC9s514XHg%3D&from=327834062_large&s=PackSourceEnum_PUBLISH&se=false&sc=dynamic_cover&biz_tag=pcweb_cover&l=20240622165328B7D68783CF42A0A3D6FD',
        'https://p9-pc-sign.douyinpic.com/obj/tos-cn-i-0813/oMf9EAUOf10zBAb1rNCQIL3RgAFTAmAUdTDNAE?x-expires=1720252800&x-signature=waQfYEbGP8AxX7q%2FRwdKLKsVKIE%3D&from=327834062_large&s=PackSourceEnum_PUBLISH&se=false&sc=dynamic_cover&biz_tag=pcweb_cover&l=20240622165328B7D68783CF42A0A3D6FD',
      ],
      width: 720,
      height: 720,
    },
    origin_cover: {
      uri: 'tos-cn-p-0015/owBR9WDRdVUfUyMr1nr5NjVEC5fFIAmKAIgATs',
      url_list: [
        'https://p3-pc-sign.douyinpic.com/tos-cn-p-0015/owBR9WDRdVUfUyMr1nr5NjVEC5fFIAmKAIgATs~tplv-dy-360p.jpeg?x-expires=1720252800&x-signature=stvAtGRK1DtLzmJEUTPVj5mJXVY%3D&from=327834062&s=PackSourceEnum_PUBLISH&se=false&sc=origin_cover&biz_tag=pcweb_cover&l=20240622165328B7D68783CF42A0A3D6FD',
        'https://p9-pc-sign.douyinpic.com/tos-cn-p-0015/owBR9WDRdVUfUyMr1nr5NjVEC5fFIAmKAIgATs~tplv-dy-360p.jpeg?x-expires=1720252800&x-signature=Bd3qWQ5zR61ibf1oUNXKqazNs%2Fw%3D&from=327834062&s=PackSourceEnum_PUBLISH&se=false&sc=origin_cover&biz_tag=pcweb_cover&l=20240622165328B7D68783CF42A0A3D6FD',
      ],
      width: 360,
      height: 640,
    },
    ratio: '1080p',
    bit_rate_audio: null,
    big_thumbs: null,
    use_static_cover: true,
    bit_rate: [
      {
        gear_name: 'normal_1080_0',
        quality_type: 1,
        bit_rate: 4069698,
        play_addr: {
          uri: 'v0d00fg10000cpqka5fog65vjudclcsg',
          url_list: [
            'http://v95-web-sz.douyinvod.com/9342a7f5221747e56144b0b78f088586/6676ad31/video/tos/cn/tos-cn-ve-15c001-alinc2/oYZqrPoIPz7WgI6QkCLMAjDGAyaWJBJeeo6BVf/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=3974&bt=3974&cs=0&ds=4&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=0&rc=Zzs6aGk3aGg2NzZlOzgzZEBpamZmeHk5cjhuczMzNGkzM0BeYTRhXmAvNmMxYC0yMWJjYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100o_101r_100B_100x_100z&dy_q=1719046408&feature_id=46a7bb47b4fd1280f3d3825bf2b29388&l=20240622165328B7D68783CF42A0A3D6FD',
            'http://v3-web.douyinvod.com/d09e7e0551b0dc5df0c66dbc92281341/6676ad31/video/tos/cn/tos-cn-ve-15c001-alinc2/oYZqrPoIPz7WgI6QkCLMAjDGAyaWJBJeeo6BVf/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=3974&bt=3974&cs=0&ds=4&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=0&rc=Zzs6aGk3aGg2NzZlOzgzZEBpamZmeHk5cjhuczMzNGkzM0BeYTRhXmAvNmMxYC0yMWJjYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100z_100o_101r_100B_100x&dy_q=1719046408&feature_id=46a7bb47b4fd1280f3d3825bf2b29388&l=20240622165328B7D68783CF42A0A3D6FD',
            'https://www.douyin.com/aweme/v1/play/?video_id=v0d00fg10000cpqka5fog65vjudclcsg&line=0&file_id=fae045580bc344f39e2ec4afde77d8ad&sign=f76858207e38f40356eb5c7457c616c1&is_play_url=1&source=PackSourceEnum_PUBLISH',
          ],
          width: 1080,
          height: 1920,
          url_key: 'v0d00fg10000cpqka5fog65vjudclcsg_h264_1080p_4069698',
          data_size: 4842432,
          file_hash: 'f76858207e38f40356eb5c7457c616c1',
          file_cs: 'c:0-9318-c53b|d:0-2421215-607e,2421216-4842431-85b4|a:v0d00fg10000cpqka5fog65vjudclcsg',
        },
        is_h265: 0,
        is_bytevc1: 0,
        HDR_type: '',
        HDR_bit: '',
        FPS: 30,
        video_extra:
          '{"PktOffsetMap":"[{\\"time\\": 1, \\"offset\\": 752135}, {\\"time\\": 2, \\"offset\\": 1289739}, {\\"time\\": 3, \\"offset\\": 1821269}, {\\"time\\": 4, \\"offset\\": 2321593}, {\\"time\\": 5, \\"offset\\": 2799201}]","format":"mp4","applog_map":{"feature_id":"46a7bb47b4fd1280f3d3825bf2b29388"}}',
        format: 'mp4',
      },
      {
        gear_name: 'low_720_0',
        quality_type: 11,
        bit_rate: 2838889,
        play_addr: {
          uri: 'v0d00fg10000cpqka5fog65vjudclcsg',
          url_list: [
            'http://v95-web-sz.douyinvod.com/64cf582d223885a28593111a8e5e083b/6676ad31/video/tos/cn/tos-cn-ve-15/ooTBokGeLGZr6Krjc7ryACVBPfWQIageAMozqI/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=2772&bt=2772&cs=0&ds=3&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=1&rc=N2hkN2Q0ZjY3ODk4NTU0aEBpamZmeHk5cjhuczMzNGkzM0AtMy0uMGBeNmExYGBeNmIzYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100z_100o_101r_100B_100x&dy_q=1719046408&feature_id=46a7bb47b4fd1280f3d3825bf2b29388&l=20240622165328B7D68783CF42A0A3D6FD',
            'http://v3-web.douyinvod.com/affb27610e6fbbfab1c2dab28a788634/6676ad31/video/tos/cn/tos-cn-ve-15/ooTBokGeLGZr6Krjc7ryACVBPfWQIageAMozqI/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=2772&bt=2772&cs=0&ds=3&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=1&rc=N2hkN2Q0ZjY3ODk4NTU0aEBpamZmeHk5cjhuczMzNGkzM0AtMy0uMGBeNmExYGBeNmIzYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=101r_100B_100x_100z_100o&dy_q=1719046408&feature_id=46a7bb47b4fd1280f3d3825bf2b29388&l=20240622165328B7D68783CF42A0A3D6FD',
            'https://www.douyin.com/aweme/v1/play/?video_id=v0d00fg10000cpqka5fog65vjudclcsg&line=0&file_id=6ee192a2c5c645d493acc13a140a6e04&sign=e2f7a8f7e5a5396d44e0bb7f1ce056fa&is_play_url=1&source=PackSourceEnum_PUBLISH',
          ],
          width: 720,
          height: 1280,
          url_key: 'v0d00fg10000cpqka5fog65vjudclcsg_h264_720p_2838889',
          data_size: 3377924,
          file_hash: 'e2f7a8f7e5a5396d44e0bb7f1ce056fa',
          file_cs: 'c:0-9316-d5f9|d:0-1688961-8e9e,1688962-3377923-f7b2|a:v0d00fg10000cpqka5fog65vjudclcsg',
        },
        is_h265: 0,
        is_bytevc1: 0,
        HDR_type: '',
        HDR_bit: '',
        FPS: 30,
        video_extra:
          '{"PktOffsetMap":"[{\\"time\\": 1, \\"offset\\": 528289}, {\\"time\\": 2, \\"offset\\": 900929}, {\\"time\\": 3, \\"offset\\": 1264482}, {\\"time\\": 4, \\"offset\\": 1610641}, {\\"time\\": 5, \\"offset\\": 1947563}]","format":"mp4","applog_map":{"feature_id":"46a7bb47b4fd1280f3d3825bf2b29388"}}',
        format: 'mp4',
      },
      {
        gear_name: 'normal_720_0',
        quality_type: 10,
        bit_rate: 2666279,
        play_addr: {
          uri: 'v0d00fg10000cpqka5fog65vjudclcsg',
          url_list: [
            'http://v95-web-sz.douyinvod.com/2b616620db84c77fb2911ee86fa6a7a9/6676ad31/video/tos/cn/tos-cn-ve-15/o4GIAIfg7oWQMAieqDy6ToopzZeGBCLraP2BFV/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=2603&bt=2603&cs=0&ds=3&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=0&rc=ZWkzZTw7Zjk6NjU7OTs5aUBpamZmeHk5cjhuczMzNGkzM0AwYzQyMzI1Ni4xXzIuLWNgYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100x_100z_100o_101r_100B&dy_q=1719046408&feature_id=f0150a16a324336cda5d6dd0b69ed299&l=20240622165328B7D68783CF42A0A3D6FD',
            'http://v3-web.douyinvod.com/8e3a7ccb29aa4262480943bf8129c4ad/6676ad31/video/tos/cn/tos-cn-ve-15/o4GIAIfg7oWQMAieqDy6ToopzZeGBCLraP2BFV/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=2603&bt=2603&cs=0&ds=3&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=0&rc=ZWkzZTw7Zjk6NjU7OTs5aUBpamZmeHk5cjhuczMzNGkzM0AwYzQyMzI1Ni4xXzIuLWNgYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=101r_100B_100x_100z_100o&dy_q=1719046408&feature_id=f0150a16a324336cda5d6dd0b69ed299&l=20240622165328B7D68783CF42A0A3D6FD',
            'https://www.douyin.com/aweme/v1/play/?video_id=v0d00fg10000cpqka5fog65vjudclcsg&line=0&file_id=cff6081658b24317968c58695b70ff3b&sign=32c3563f4f8d9e01bc661095226dd785&is_play_url=1&source=PackSourceEnum_PUBLISH',
          ],
          width: 720,
          height: 1280,
          url_key: 'v0d00fg10000cpqka5fog65vjudclcsg_h264_720p_2666279',
          data_size: 3172539,
          file_hash: '32c3563f4f8d9e01bc661095226dd785',
          file_cs: 'c:0-11789-4009|d:0-1586268-5a5a,1586269-3172538-15fc',
        },
        is_h265: 0,
        is_bytevc1: 0,
        HDR_type: '',
        HDR_bit: '',
        FPS: 30,
        video_extra:
          '{"PktOffsetMap":"[{\\"time\\": 1, \\"offset\\": 421337}, {\\"time\\": 2, \\"offset\\": 789279}, {\\"time\\": 3, \\"offset\\": 1114853}, {\\"time\\": 4, \\"offset\\": 1497152}, {\\"time\\": 5, \\"offset\\": 1939189}]","format":"mp4","applog_map":{"feature_id":"f0150a16a324336cda5d6dd0b69ed299"}}',
        format: 'mp4',
      },
      {
        gear_name: 'low_540_0',
        quality_type: 292,
        bit_rate: 2617218,
        play_addr: {
          uri: 'v0d00fg10000cpqka5fog65vjudclcsg',
          url_list: [
            'http://v95-web-sz.douyinvod.com/07f18b856c425c30fe53945b1c1269c7/6676ad31/video/tos/cn/tos-cn-ve-15c001-alinc2/oEe7QBoPyfrIFFz1ZHCdIXWlAgLSBMAo6VGaeI/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=2555&bt=2555&cs=0&ds=6&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=1&rc=NzY1N2U7ZTUzNGdnZjMzZkBpamZmeHk5cjhuczMzNGkzM0A2YzExMl5fXzYxYTQwL2NgYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100x_100z_100o_101r_100B&dy_q=1719046408&feature_id=46a7bb47b4fd1280f3d3825bf2b29388&l=20240622165328B7D68783CF42A0A3D6FD',
            'http://v3-web.douyinvod.com/d92c46c2271f4b3b7a2384b19d6f3f54/6676ad31/video/tos/cn/tos-cn-ve-15c001-alinc2/oEe7QBoPyfrIFFz1ZHCdIXWlAgLSBMAo6VGaeI/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=2555&bt=2555&cs=0&ds=6&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=1&rc=NzY1N2U7ZTUzNGdnZjMzZkBpamZmeHk5cjhuczMzNGkzM0A2YzExMl5fXzYxYTQwL2NgYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100B_100x_100z_100o_101r&dy_q=1719046408&feature_id=46a7bb47b4fd1280f3d3825bf2b29388&l=20240622165328B7D68783CF42A0A3D6FD',
            'https://www.douyin.com/aweme/v1/play/?video_id=v0d00fg10000cpqka5fog65vjudclcsg&line=0&file_id=ccf0203c7ddd4190b2bba85b4442f394&sign=1b08677d8943428cad772c8ca30744af&is_play_url=1&source=PackSourceEnum_PUBLISH',
          ],
          width: 576,
          height: 1024,
          url_key: 'v0d00fg10000cpqka5fog65vjudclcsg_h264_540p_2617218',
          data_size: 3114163,
          file_hash: '1b08677d8943428cad772c8ca30744af',
          file_cs: 'c:0-9324-a8a8|d:0-1557080-7fef,1557081-3114162-a37c|a:v0d00fg10000cpqka5fog65vjudclcsg',
        },
        is_h265: 0,
        is_bytevc1: 0,
        HDR_type: '',
        HDR_bit: '',
        FPS: 30,
        video_extra:
          '{"PktOffsetMap":"[{\\"time\\": 1, \\"offset\\": 466764}, {\\"time\\": 2, \\"offset\\": 819996}, {\\"time\\": 3, \\"offset\\": 1158789}, {\\"time\\": 4, \\"offset\\": 1488540}, {\\"time\\": 5, \\"offset\\": 1801834}]","format":"mp4","applog_map":{"feature_id":"46a7bb47b4fd1280f3d3825bf2b29388"}}',
        format: 'mp4',
      },
      {
        gear_name: 'normal_540_0',
        quality_type: 20,
        bit_rate: 2434713,
        play_addr: {
          uri: 'v0d00fg10000cpqka5fog65vjudclcsg',
          url_list: [
            'http://v95-web-sz.douyinvod.com/8d4e2b970f958b6b467340509f77b823/6676ad31/video/tos/cn/tos-cn-ve-15c001-alinc2/oofr1sVAAQBEwKgnfQDsNmE7dICUt99IUF5A15/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=2377&bt=2377&cs=0&ds=6&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=0&rc=Njc7aDU8ZmlpZzNmMzU8ZEBpamZmeHk5cjhuczMzNGkzM0BfYi8uXzNeNjAxLV5iNGItYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=101r_100B_100x_100z_100o&dy_q=1719046408&feature_id=f0150a16a324336cda5d6dd0b69ed299&l=20240622165328B7D68783CF42A0A3D6FD',
            'http://v3-web.douyinvod.com/3893c781e2aa0af19976abe195981ee9/6676ad31/video/tos/cn/tos-cn-ve-15c001-alinc2/oofr1sVAAQBEwKgnfQDsNmE7dICUt99IUF5A15/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=2377&bt=2377&cs=0&ds=6&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=0&rc=Njc7aDU8ZmlpZzNmMzU8ZEBpamZmeHk5cjhuczMzNGkzM0BfYi8uXzNeNjAxLV5iNGItYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100x_100z_100o_101r_100B&dy_q=1719046408&feature_id=f0150a16a324336cda5d6dd0b69ed299&l=20240622165328B7D68783CF42A0A3D6FD',
            'https://www.douyin.com/aweme/v1/play/?video_id=v0d00fg10000cpqka5fog65vjudclcsg&line=0&file_id=0ae972e0ac004d3f9fac69b21e28e4b3&sign=6361abccbe782aef8a2f311bc7f35d0a&is_play_url=1&source=PackSourceEnum_PUBLISH',
          ],
          width: 576,
          height: 1024,
          url_key: 'v0d00fg10000cpqka5fog65vjudclcsg_h264_540p_2434713',
          data_size: 2897005,
          file_hash: '6361abccbe782aef8a2f311bc7f35d0a',
          file_cs: 'c:0-11806-fa18|d:0-1448501-695c,1448502-2897004-224c|a:v0d00fg10000cpqka5fog65vjudclcsg',
        },
        is_h265: 0,
        is_bytevc1: 0,
        HDR_type: '',
        HDR_bit: '',
        FPS: 30,
        video_extra:
          '{"PktOffsetMap":"[{\\"time\\": 1, \\"offset\\": 379167}, {\\"time\\": 2, \\"offset\\": 754678}, {\\"time\\": 3, \\"offset\\": 1027529}, {\\"time\\": 4, \\"offset\\": 1371363}, {\\"time\\": 5, \\"offset\\": 1648434}]","format":"mp4","applog_map":{"feature_id":"f0150a16a324336cda5d6dd0b69ed299"}}',
        format: 'mp4',
      },
      {
        gear_name: 'adapt_lowest_1080_1',
        quality_type: 2,
        bit_rate: 1734491,
        play_addr: {
          uri: 'v0d00fg10000cpqka5fog65vjudclcsg',
          url_list: [
            'http://v95-web-sz.douyinvod.com/fe168f97414c41bd290165f9db41d8a2/6676ad31/video/tos/cn/tos-cn-ve-15c001-alinc2/ooWrrZA6eAQgQo7UgG7MzfCyOIBaLB7VPoDI2f/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=1693&bt=1693&cs=2&ds=4&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=15&rc=MzwzNWVpODY0OmVoZWhkZ0BpamZmeHk5cjhuczMzNGkzM0BiYV4uX2NjNmIxMmJfNi9jYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100o_101r_100B_100x_100z&dy_q=1719046408&feature_id=8129a1729e50e93a9e951d2e5fa96ae4&l=20240622165328B7D68783CF42A0A3D6FD',
            'http://v3-web.douyinvod.com/f55b33fb410b35b9902c5e28d482fac3/6676ad31/video/tos/cn/tos-cn-ve-15c001-alinc2/ooWrrZA6eAQgQo7UgG7MzfCyOIBaLB7VPoDI2f/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=1693&bt=1693&cs=2&ds=4&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=15&rc=MzwzNWVpODY0OmVoZWhkZ0BpamZmeHk5cjhuczMzNGkzM0BiYV4uX2NjNmIxMmJfNi9jYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=101r_100B_100x_100z_100o&dy_q=1719046408&feature_id=8129a1729e50e93a9e951d2e5fa96ae4&l=20240622165328B7D68783CF42A0A3D6FD',
            'https://www.douyin.com/aweme/v1/play/?video_id=v0d00fg10000cpqka5fog65vjudclcsg&line=0&file_id=fd2a9ebbee5b47e193f5ffbb12a0d9e0&sign=f76849367f824f53dc174d31d7c190d2&is_play_url=1&source=PackSourceEnum_PUBLISH',
          ],
          width: 1080,
          height: 1920,
          url_key: 'v0d00fg10000cpqka5fog65vjudclcsg_bytevc1_1080p_1734491',
          data_size: 2063828,
          file_hash: 'f76849367f824f53dc174d31d7c190d2',
          file_cs: 'c:0-9482-8e49|d:0-1031913-7463,1031914-2063827-5379|a:v0d00fg10000cpqka5fog65vjudclcsg',
        },
        is_h265: 1,
        is_bytevc1: 1,
        HDR_type: '',
        HDR_bit: '',
        FPS: 30,
        video_extra:
          '{"PktOffsetMap":"[{\\"time\\": 1, \\"offset\\": 461082}, {\\"time\\": 2, \\"offset\\": 655874}, {\\"time\\": 3, \\"offset\\": 840006}, {\\"time\\": 4, \\"offset\\": 1019092}, {\\"time\\": 5, \\"offset\\": 1241264}]","format":"mp4","applog_map":{"feature_id":"8129a1729e50e93a9e951d2e5fa96ae4"}}',
        format: 'mp4',
      },
      {
        gear_name: 'adapt_low_540_0',
        quality_type: 291,
        bit_rate: 1646054,
        play_addr: {
          uri: 'v0d00fg10000cpqka5fog65vjudclcsg',
          url_list: [
            'http://v95-web-sz.douyinvod.com/9904451208578f89a10c59fd207f57f7/6676ad31/video/tos/cn/tos-cn-ve-15c001-alinc2/o4Zr7oyWMQaDBvBfZC6LeDoIIWGgPvAVrAe38z/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=1607&bt=1607&cs=0&ds=6&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=12&rc=O2lmaTs5ZGhpOWk4M2Q2Z0BpamZmeHk5cjhuczMzNGkzM0BfLS1eYTRgNS8xYTYwNi5jYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=101r_100B_100x_100z_100o&dy_q=1719046408&feature_id=46a7bb47b4fd1280f3d3825bf2b29388&l=20240622165328B7D68783CF42A0A3D6FD',
            'http://v3-web.douyinvod.com/2c1fd57ab57e1ad87b7919d8b2746796/6676ad31/video/tos/cn/tos-cn-ve-15c001-alinc2/o4Zr7oyWMQaDBvBfZC6LeDoIIWGgPvAVrAe38z/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=1607&bt=1607&cs=0&ds=6&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=12&rc=O2lmaTs5ZGhpOWk4M2Q2Z0BpamZmeHk5cjhuczMzNGkzM0BfLS1eYTRgNS8xYTYwNi5jYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=101r_100B_100x_100z_100o&dy_q=1719046408&feature_id=46a7bb47b4fd1280f3d3825bf2b29388&l=20240622165328B7D68783CF42A0A3D6FD',
            'https://www.douyin.com/aweme/v1/play/?video_id=v0d00fg10000cpqka5fog65vjudclcsg&line=0&file_id=fd139a3095df462f8eca76d8af0c0fb8&sign=102eb50824b3aa95d6e85357c7715627&is_play_url=1&source=PackSourceEnum_PUBLISH',
          ],
          width: 576,
          height: 1024,
          url_key: 'v0d00fg10000cpqka5fog65vjudclcsg_h264_540p_1646054',
          data_size: 1958599,
          file_hash: '102eb50824b3aa95d6e85357c7715627',
          file_cs: 'c:0-9323-fc36|d:0-979298-7a78,979299-1958598-4964|a:v0d00fg10000cpqka5fog65vjudclcsg',
        },
        is_h265: 0,
        is_bytevc1: 0,
        HDR_type: '',
        HDR_bit: '',
        FPS: 30,
        video_extra:
          '{"PktOffsetMap":"[{\\"time\\": 1, \\"offset\\": 305034}, {\\"time\\": 2, \\"offset\\": 522445}, {\\"time\\": 3, \\"offset\\": 727457}, {\\"time\\": 4, \\"offset\\": 931404}, {\\"time\\": 5, \\"offset\\": 1128214}]","format":"mp4","applog_map":{"feature_id":"46a7bb47b4fd1280f3d3825bf2b29388"}}',
        format: 'mp4',
      },
      {
        gear_name: 'lower_540_0',
        quality_type: 24,
        bit_rate: 1627881,
        play_addr: {
          uri: 'v0d00fg10000cpqka5fog65vjudclcsg',
          url_list: [
            'http://v95-web-sz.douyinvod.com/52b21d16d5457b0541fc3814c611beec/6676ad31/video/tos/cn/tos-cn-ve-15/oAfmNK9NAODdr1IEBnFUVI2YA5B5EgBfUsQNnA/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=1589&bt=1589&cs=0&ds=6&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=4&rc=ZWhoNjZmOjVnOmU6aGg5NUBpamZmeHk5cjhuczMzNGkzM0A0NC1jMzNgNTExMjA2NS4tYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100x_100z_100o_101r_100B&dy_q=1719046408&feature_id=eb29b1b3aca69db49524c333df8caaf7&l=20240622165328B7D68783CF42A0A3D6FD',
            'http://v3-web.douyinvod.com/6ded644d8a90d0c057e8b4f10524b179/6676ad31/video/tos/cn/tos-cn-ve-15/oAfmNK9NAODdr1IEBnFUVI2YA5B5EgBfUsQNnA/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=1589&bt=1589&cs=0&ds=6&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=4&rc=ZWhoNjZmOjVnOmU6aGg5NUBpamZmeHk5cjhuczMzNGkzM0A0NC1jMzNgNTExMjA2NS4tYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100o_101r_100B_100x_100z&dy_q=1719046408&feature_id=eb29b1b3aca69db49524c333df8caaf7&l=20240622165328B7D68783CF42A0A3D6FD',
            'https://www.douyin.com/aweme/v1/play/?video_id=v0d00fg10000cpqka5fog65vjudclcsg&line=0&file_id=02168e9e375b474d82c76c63f30e7e7b&sign=466783202153520d39fc8e6df91919a2&is_play_url=1&source=PackSourceEnum_PUBLISH',
          ],
          width: 576,
          height: 1024,
          url_key: 'v0d00fg10000cpqka5fog65vjudclcsg_h264_540p_1627881',
          data_size: 1936975,
          file_hash: '466783202153520d39fc8e6df91919a2',
          file_cs: 'c:0-9332-b705|d:0-968486-3ab2,968487-1936974-fbee|a:v0d00fg10000cpqka5fog65vjudclcsg',
        },
        is_h265: 0,
        is_bytevc1: 0,
        HDR_type: '',
        HDR_bit: '',
        FPS: 30,
        video_extra: '{"PktOffsetMap":"","format":"mp4","applog_map":{"feature_id":"eb29b1b3aca69db49524c333df8caaf7"}}',
        format: 'mp4',
      },
      {
        gear_name: 'adapt_lowest_720_1',
        quality_type: 15,
        bit_rate: 1270684,
        play_addr: {
          uri: 'v0d00fg10000cpqka5fog65vjudclcsg',
          url_list: [
            'http://v95-web-sz.douyinvod.com/e7135f2d833ba201d4dbdf7a1beb1f95/6676ad31/video/tos/cn/tos-cn-ve-15c001-alinc2/o8fogakfrMAiGmFexoX8B7MAHBqAzCY6Rs8JVQ/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=1240&bt=1240&cs=2&ds=3&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=15&rc=O2U2M2g6M2k4NzxlNWk0M0BpamZmeHk5cjhuczMzNGkzM0AtLjZiXzVhNl4xYjQ0YjZjYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=101r_100B_100x_100z_100o&dy_q=1719046408&feature_id=8129a1729e50e93a9e951d2e5fa96ae4&l=20240622165328B7D68783CF42A0A3D6FD',
            'http://v3-web.douyinvod.com/02610380e4feadbd69fa78ef8c9f78e8/6676ad31/video/tos/cn/tos-cn-ve-15c001-alinc2/o8fogakfrMAiGmFexoX8B7MAHBqAzCY6Rs8JVQ/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=1240&bt=1240&cs=2&ds=3&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=15&rc=O2U2M2g6M2k4NzxlNWk0M0BpamZmeHk5cjhuczMzNGkzM0AtLjZiXzVhNl4xYjQ0YjZjYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=101r_100B_100x_100z_100o&dy_q=1719046408&feature_id=8129a1729e50e93a9e951d2e5fa96ae4&l=20240622165328B7D68783CF42A0A3D6FD',
            'https://www.douyin.com/aweme/v1/play/?video_id=v0d00fg10000cpqka5fog65vjudclcsg&line=0&file_id=f091ef727be944a59fd087bee0931b08&sign=5e86b7a06562dcc234488aa1a0fcab2c&is_play_url=1&source=PackSourceEnum_PUBLISH',
          ],
          width: 720,
          height: 1280,
          url_key: 'v0d00fg10000cpqka5fog65vjudclcsg_bytevc1_720p_1270684',
          data_size: 1511956,
          file_hash: '5e86b7a06562dcc234488aa1a0fcab2c',
          file_cs: 'c:0-9482-d4fc|d:0-755977-7a53,755978-1511955-1194|a:v0d00fg10000cpqka5fog65vjudclcsg',
        },
        is_h265: 1,
        is_bytevc1: 1,
        HDR_type: '',
        HDR_bit: '',
        FPS: 30,
        video_extra:
          '{"PktOffsetMap":"[{\\"time\\": 1, \\"offset\\": 321924}, {\\"time\\": 2, \\"offset\\": 467909}, {\\"time\\": 3, \\"offset\\": 599864}, {\\"time\\": 4, \\"offset\\": 733553}, {\\"time\\": 5, \\"offset\\": 888919}]","format":"mp4","applog_map":{"feature_id":"8129a1729e50e93a9e951d2e5fa96ae4"}}',
        format: 'mp4',
      },
      {
        gear_name: 'adapt_540_1',
        quality_type: 28,
        bit_rate: 1096842,
        play_addr: {
          uri: 'v0d00fg10000cpqka5fog65vjudclcsg',
          url_list: [
            'http://v95-web-sz.douyinvod.com/efbe945fef9f405090b88f28d8dad5ae/6676ad31/video/tos/cn/tos-cn-ve-15/ownA5fU1Kgr9DnBEQrfEAVBNRAdFI7H5msUnPp/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=1071&bt=1071&cs=2&ds=6&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=11&rc=OWRlOjY0Ozo8Ojc2ODY4NEBpamZmeHk5cjhuczMzNGkzM0A0XjE2MGJjXzIxMzNiYWNeYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100o_101r_100B_100x_100z&dy_q=1719046408&feature_id=8129a1729e50e93a9e951d2e5fa96ae4&l=20240622165328B7D68783CF42A0A3D6FD',
            'http://v3-web.douyinvod.com/fc45cabcd54b91761dda3fda5f7e8425/6676ad31/video/tos/cn/tos-cn-ve-15/ownA5fU1Kgr9DnBEQrfEAVBNRAdFI7H5msUnPp/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=1071&bt=1071&cs=2&ds=6&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=11&rc=OWRlOjY0Ozo8Ojc2ODY4NEBpamZmeHk5cjhuczMzNGkzM0A0XjE2MGJjXzIxMzNiYWNeYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100z_100o_101r_100B_100x&dy_q=1719046408&feature_id=8129a1729e50e93a9e951d2e5fa96ae4&l=20240622165328B7D68783CF42A0A3D6FD',
            'https://www.douyin.com/aweme/v1/play/?video_id=v0d00fg10000cpqka5fog65vjudclcsg&line=0&file_id=a1f5d3e563644759b7f8e133974baa76&sign=d4f9830ca5ea8fdd42e3432bea38b31a&is_play_url=1&source=PackSourceEnum_PUBLISH',
          ],
          width: 576,
          height: 1024,
          url_key: 'v0d00fg10000cpqka5fog65vjudclcsg_bytevc1_540p_1096842',
          data_size: 1305105,
          file_hash: 'd4f9830ca5ea8fdd42e3432bea38b31a',
          file_cs: 'c:0-9482-3a48|d:0-652551-34e6,652552-1305104-9a94|a:v0d00fg10000cpqka5fog65vjudclcsg',
        },
        is_h265: 1,
        is_bytevc1: 1,
        HDR_type: '',
        HDR_bit: '',
        FPS: 30,
        video_extra:
          '{"PktOffsetMap":"[{\\"time\\": 1, \\"offset\\": 270739}, {\\"time\\": 2, \\"offset\\": 400191}, {\\"time\\": 3, \\"offset\\": 515808}, {\\"time\\": 4, \\"offset\\": 634153}, {\\"time\\": 5, \\"offset\\": 767746}]","format":"mp4","applog_map":{"feature_id":"8129a1729e50e93a9e951d2e5fa96ae4"}}',
        format: 'mp4',
      },
      {
        gear_name: 'adapt_lower_540_1',
        quality_type: 21,
        bit_rate: 984052,
        play_addr: {
          uri: 'v0d00fg10000cpqka5fog65vjudclcsg',
          url_list: [
            'http://v95-web-sz.douyinvod.com/908b7c0ef93b016f1a03d34c4093d547/6676ad31/video/tos/cn/tos-cn-ve-15c001-alinc2/oUKoQayPrGA3OzCeOoLfB7Mg7BVAZCz6IWehrI/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=960&bt=960&cs=2&ds=6&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=14&rc=OzxnNjRnZmc5Ozo7ZzRlZ0BpamZmeHk5cjhuczMzNGkzM0AzLzUyLi5iX18xYi1hMDVgYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=101r_100B_100x_100z_100o&dy_q=1719046408&feature_id=568fcfa9aebdfc5b08846cbdae38e6f8&l=20240622165328B7D68783CF42A0A3D6FD',
            'http://v3-web.douyinvod.com/d39dfe9703fe0b1f3382f517c50c8372/6676ad31/video/tos/cn/tos-cn-ve-15c001-alinc2/oUKoQayPrGA3OzCeOoLfB7Mg7BVAZCz6IWehrI/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=960&bt=960&cs=2&ds=6&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=14&rc=OzxnNjRnZmc5Ozo7ZzRlZ0BpamZmeHk5cjhuczMzNGkzM0AzLzUyLi5iX18xYi1hMDVgYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100o_101r_100B_100x_100z&dy_q=1719046408&feature_id=568fcfa9aebdfc5b08846cbdae38e6f8&l=20240622165328B7D68783CF42A0A3D6FD',
            'https://www.douyin.com/aweme/v1/play/?video_id=v0d00fg10000cpqka5fog65vjudclcsg&line=0&file_id=cd8b31dd08e748b6bdec1d11538d2968&sign=e57d8adc1b291855134b4068c41657fd&is_play_url=1&source=PackSourceEnum_PUBLISH',
          ],
          width: 576,
          height: 1024,
          url_key: 'v0d00fg10000cpqka5fog65vjudclcsg_bytevc1_540p_984052',
          data_size: 1170899,
          file_hash: 'e57d8adc1b291855134b4068c41657fd',
          file_cs: 'c:0-9482-f10e|d:0-585448-bd14,585449-1170898-a793|a:v0d00fg10000cpqka5fog65vjudclcsg',
        },
        is_h265: 1,
        is_bytevc1: 1,
        HDR_type: '',
        HDR_bit: '',
        FPS: 30,
        video_extra:
          '{"PktOffsetMap":"[{\\"time\\": 1, \\"offset\\": 247004}, {\\"time\\": 2, \\"offset\\": 367802}, {\\"time\\": 3, \\"offset\\": 469065}, {\\"time\\": 4, \\"offset\\": 570733}, {\\"time\\": 5, \\"offset\\": 689397}]","format":"mp4","applog_map":{"feature_id":"568fcfa9aebdfc5b08846cbdae38e6f8"}}',
        format: 'mp4',
      },
    ],
    duration: 9519,
    gaussian_cover: {
      uri: 'tos-cn-p-0015/owBR9WDRdVUfUyMr1nr5NjVEC5fFIAmKAIgATs',
      url_list: [
        'https://p9-pc-sign.douyinpic.com/tos-cn-p-0015/owBR9WDRdVUfUyMr1nr5NjVEC5fFIAmKAIgATs~tplv-tsj2vxp0zn-gaosi:40.jpeg?x-expires=1750579200&x-signature=1hN13fKr6TOVydOguBgZ5kdMfts%3D&from=327834062',
        'https://p3-pc-sign.douyinpic.com/tos-cn-p-0015/owBR9WDRdVUfUyMr1nr5NjVEC5fFIAmKAIgATs~tplv-tsj2vxp0zn-gaosi:40.jpeg?x-expires=1750579200&x-signature=dNJ1Bu7nKBg1ZRC0%2BogcHAHdHZk%3D&from=327834062',
      ],
      width: 720,
      height: 720,
    },
    audio: {
      original_sound_infos: null,
    },
    play_addr_265: {
      uri: 'v0d00fg10000cpqka5fog65vjudclcsg',
      url_list: [
        'http://v95-web-sz.douyinvod.com/efbe945fef9f405090b88f28d8dad5ae/6676ad31/video/tos/cn/tos-cn-ve-15/ownA5fU1Kgr9DnBEQrfEAVBNRAdFI7H5msUnPp/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=1071&bt=1071&cs=2&ds=6&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=11&rc=OWRlOjY0Ozo8Ojc2ODY4NEBpamZmeHk5cjhuczMzNGkzM0A0XjE2MGJjXzIxMzNiYWNeYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100o_101r_100B_100x_100z&dy_q=1719046408&feature_id=8129a1729e50e93a9e951d2e5fa96ae4&l=20240622165328B7D68783CF42A0A3D6FD',
        'http://v3-web.douyinvod.com/fc45cabcd54b91761dda3fda5f7e8425/6676ad31/video/tos/cn/tos-cn-ve-15/ownA5fU1Kgr9DnBEQrfEAVBNRAdFI7H5msUnPp/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=1071&bt=1071&cs=2&ds=6&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=11&rc=OWRlOjY0Ozo8Ojc2ODY4NEBpamZmeHk5cjhuczMzNGkzM0A0XjE2MGJjXzIxMzNiYWNeYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100z_100o_101r_100B_100x&dy_q=1719046408&feature_id=8129a1729e50e93a9e951d2e5fa96ae4&l=20240622165328B7D68783CF42A0A3D6FD',
        'https://www.douyin.com/aweme/v1/play/?video_id=v0d00fg10000cpqka5fog65vjudclcsg&line=0&file_id=a1f5d3e563644759b7f8e133974baa76&sign=d4f9830ca5ea8fdd42e3432bea38b31a&is_play_url=1&source=PackSourceEnum_PUBLISH',
      ],
      width: 576,
      height: 1024,
      url_key: 'v0d00fg10000cpqka5fog65vjudclcsg_bytevc1_540p_1096842',
      data_size: 1305105,
      file_hash: 'd4f9830ca5ea8fdd42e3432bea38b31a',
      file_cs: 'c:0-9482-3a48|d:0-652551-34e6,652552-1305104-9a94|a:v0d00fg10000cpqka5fog65vjudclcsg',
    },
    is_source_HDR: 0,
    play_addr_h264: {
      uri: 'v0d00fg10000cpqka5fog65vjudclcsg',
      url_list: [
        'http://v95-web-sz.douyinvod.com/9342a7f5221747e56144b0b78f088586/6676ad31/video/tos/cn/tos-cn-ve-15c001-alinc2/oYZqrPoIPz7WgI6QkCLMAjDGAyaWJBJeeo6BVf/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=3974&bt=3974&cs=0&ds=4&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=0&rc=Zzs6aGk3aGg2NzZlOzgzZEBpamZmeHk5cjhuczMzNGkzM0BeYTRhXmAvNmMxYC0yMWJjYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100o_101r_100B_100x_100z&dy_q=1719046408&feature_id=46a7bb47b4fd1280f3d3825bf2b29388&l=20240622165328B7D68783CF42A0A3D6FD',
        'http://v3-web.douyinvod.com/d09e7e0551b0dc5df0c66dbc92281341/6676ad31/video/tos/cn/tos-cn-ve-15c001-alinc2/oYZqrPoIPz7WgI6QkCLMAjDGAyaWJBJeeo6BVf/?a=6383&ch=10010&cr=3&dr=0&lr=all&cd=0%7C0%7C0%7C3&cv=1&br=3974&bt=3974&cs=0&ds=4&ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~&mime_type=video_mp4&qs=0&rc=Zzs6aGk3aGg2NzZlOzgzZEBpamZmeHk5cjhuczMzNGkzM0BeYTRhXmAvNmMxYC0yMWJjYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D&btag=c0000e00008000&cquery=100z_100o_101r_100B_100x&dy_q=1719046408&feature_id=46a7bb47b4fd1280f3d3825bf2b29388&l=20240622165328B7D68783CF42A0A3D6FD',
        'https://www.douyin.com/aweme/v1/play/?video_id=v0d00fg10000cpqka5fog65vjudclcsg&line=0&file_id=fae045580bc344f39e2ec4afde77d8ad&sign=f76858207e38f40356eb5c7457c616c1&is_play_url=1&source=PackSourceEnum_PUBLISH',
      ],
      width: 1080,
      height: 1920,
      url_key: 'v0d00fg10000cpqka5fog65vjudclcsg_h264_1080p_4069698',
      data_size: 4842432,
      file_hash: 'f76858207e38f40356eb5c7457c616c1',
      file_cs: 'c:0-9318-c53b|d:0-2421215-607e,2421216-4842431-85b4|a:v0d00fg10000cpqka5fog65vjudclcsg',
    },
    format: 'mp4',
    animated_cover: {
      uri: 'tos-cn-i-0813/oMf9EAUOf10zBAb1rNCQIL3RgAFTAmAUdTDNAE',
      url_list: [
        'https://p3-pc-sign.douyinpic.com/obj/tos-cn-i-0813/oMf9EAUOf10zBAb1rNCQIL3RgAFTAmAUdTDNAE?x-expires=1720252800&x-signature=0L5IXE%2BQZ%2FXZH0Vj7fC9s514XHg%3D&from=327834062_large&s=PackSourceEnum_PUBLISH&se=false&sc=dynamic_cover&biz_tag=pcweb_cover&l=20240622165328B7D68783CF42A0A3D6FD',
        'https://p9-pc-sign.douyinpic.com/obj/tos-cn-i-0813/oMf9EAUOf10zBAb1rNCQIL3RgAFTAmAUdTDNAE?x-expires=1720252800&x-signature=waQfYEbGP8AxX7q%2FRwdKLKsVKIE%3D&from=327834062_large&s=PackSourceEnum_PUBLISH&se=false&sc=dynamic_cover&biz_tag=pcweb_cover&l=20240622165328B7D68783CF42A0A3D6FD',
      ],
    },
    meta: '{"bright_ratio_mean":"0.1","brightness_mean":"135.9821","diff_overexposure_ratio":"0.0054","format":"mp4","gear_vqm":"{\\"1080p_720p\\":-1,\\"720p_540p\\":-1}","hrids":"500000002","isad":"0","loudness":"-18.1","overexposure_ratio_mean":"0.0112","peak":"0.71614","qprf":"1.000","sdgs":"[\\"normal_1080_0\\",\\"low_720_0\\",\\"normal_720_0\\",\\"low_540_0\\",\\"normal_540_0\\",\\"adapt_lowest_1080_1\\",\\"adapt_low_540_0\\",\\"lower_540_0\\",\\"adapt_lowest_720_1\\",\\"adapt_540_1\\",\\"adapt_lower_540_1\\"]","sr_potential":"{\\"v1.0\\":{\\"score\\":31.883}}","sr_score":"1.000","std_brightness":"1.6275","strategy_tokens":"[\\"online\\",\\"strategy_iteration_ab02_0611\\",\\"strategy_iteration_ab01_0611\\"]","title_info":"{\\"bottom_res_add\\":[11.09,11.27,9.09,10.45,7.91,7.45,6.18,3,2.64,4.91,15.36,13.18,22.18,14.09,12.55],\\"bullet_zone\\":21.57,\\"progress_bar\\":[93.24,111.62,171.26],\\"ratio_br_l\\":[0,0,0,0,0,0],\\"ratio_edge_l\\":[0.82,0.76,0.7,0.76,0.76,0.76],\\"top_res_add\\":[4,4,8.45,11.73,9.18,2.82,2.27],\\"version\\":\\"v1.0\\"}","vqs_origin":"69.42"}',
    misc_download_addrs:
      '{"suffix_scene":{"uri":"v0d00fg10000cpqka5fog65vjudclcsg","url_list":["http://v95-web-sz.douyinvod.com/d2bfa446c69671cde50425b95add499b/6676ad31/video/tos/cn/tos-cn-ve-15/oIMgZBeIiA6rMryaPICo7VAeHzQILWB6Gf7okq/?a=6383\\u0026ch=10010\\u0026cr=3\\u0026dr=0\\u0026lr=all\\u0026cd=0%7C0%7C0%7C3\\u0026cv=1\\u0026br=2587\\u0026bt=2587\\u0026cs=0\\u0026ds=3\\u0026ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~\\u0026mime_type=video_mp4\\u0026qs=0\\u0026rc=NGQ2Z2Y7OTY6ZWY3NGloM0BpamZmeHk5cjhuczMzNGkzM0A2M2IyYDA1NjYxLS1fYDUuYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D\\u0026btag=c0000e00008000\\u0026cquery=100o_101r_100B_100x_100z\\u0026dy_q=1719046408\\u0026feature_id=f0150a16a324336cda5d6dd0b69ed299\\u0026l=20240622165328B7D68783CF42A0A3D6FD","http://v3-web.douyinvod.com/ca713c6b8d9b117d02c8a532ff44ebb3/6676ad31/video/tos/cn/tos-cn-ve-15/oIMgZBeIiA6rMryaPICo7VAeHzQILWB6Gf7okq/?a=6383\\u0026ch=10010\\u0026cr=3\\u0026dr=0\\u0026lr=all\\u0026cd=0%7C0%7C0%7C3\\u0026cv=1\\u0026br=2587\\u0026bt=2587\\u0026cs=0\\u0026ds=3\\u0026ft=-Uocfp9WiiuGgurMydOC~49Zyo3nOz7fvZTbpMy-v8VvHrP2B226A8Tkzp2NIZd.o~\\u0026mime_type=video_mp4\\u0026qs=0\\u0026rc=NGQ2Z2Y7OTY6ZWY3NGloM0BpamZmeHk5cjhuczMzNGkzM0A2M2IyYDA1NjYxLS1fYDUuYSNwaWFnMmRjXm5gLS1kLWFzcw%3D%3D\\u0026btag=c0000e00008000\\u0026cquery=100x_100z_100o_101r_100B\\u0026dy_q=1719046408\\u0026feature_id=f0150a16a324336cda5d6dd0b69ed299\\u0026l=20240622165328B7D68783CF42A0A3D6FD","https://www.douyin.com/aweme/v1/play/?video_id=v0d00fg10000cpqka5fog65vjudclcsg\\u0026line=0\\u0026ratio=540p\\u0026watermark=1\\u0026media_type=4\\u0026vr_type=0\\u0026improve_bitrate=0\\u0026biz_sign=NRPI1lC4AlkgB1YZ_o3JkfAfESRKvePEcuHTt9U1IXuwTcZpH5NElMkb8afT9VaaOzLa7CA0Ou-V1V2BgV4bfdIV6U_NDGbNHaUZIZuaRMUGyO7s5wbVW7et0I2xs1hA\\u0026logo_name=aweme_toutiao_dy_suffix\\u0026source=PackSourceEnum_PUBLISH"],"width":720,"height":720,"data_size":4152476,"file_cs":"c:0-11806-fa18"}}',
    video_model: '',
  },
  share_url:
    'https://www.iesdouyin.com/share/video/7382883226563415323/?region=CN&mid=7381787158287272741&u_code=khlde5m6&did=MS4wLjABAAAAr416lBR9zUJ7cc0HaC_dcXxPzB4xdtk8vS7vuKpmSfI5OARgcsinnFvOOV6sqVch&iid=MS4wLjABAAAANwkJuWIRFOzg5uCpDRpMj4OX-QryoDgn-yYlXQnRwQQ&with_sec_did=1&titleType=title&share_sign=UG1uv_L3r83PIyCD_3sdHkwu.uTEZI7KmL6sibBW42A-&share_version=170400&ts=1719046408&from_aid=6383&from_ssr=1',
  user_digged: 0,
  statistics: {
    admire_count: 3,
    comment_count: 201,
    digg_count: 80434,
    collect_count: 4980,
    play_count: 0,
    share_count: 1780,
  },
  status: {
    listen_video_status: 0,
    is_delete: false,
    allow_share: true,
    is_prohibited: false,
    in_reviewing: false,
    part_see: 0,
    private_status: 0,
    review_result: {
      review_status: 0,
    },
  },
  ref_tts_id_list: null,
  text_extra: [
    {
      start: 12,
      end: 19,
      type: 1,
      hashtag_name: '精神状态群舞',
      hashtag_id: '7382436474639091712',
      is_commerce: false,
      caption_start: 0,
      caption_end: 7,
    },
    {
      start: 19,
      end: 22,
      type: 1,
      hashtag_name: '流萤',
      hashtag_id: '1593931034454023',
      is_commerce: false,
      caption_start: 7,
      caption_end: 10,
    },
    {
      start: 23,
      end: 29,
      type: 1,
      hashtag_name: 'ooc致歉',
      hashtag_id: '1640045501338631',
      is_commerce: false,
      caption_start: 11,
      caption_end: 17,
    },
    {
      start: 29,
      end: 36,
      type: 1,
      hashtag_name: '崩坏星穹铁道',
      hashtag_id: '1711242902507592',
      is_commerce: false,
      caption_start: 17,
      caption_end: 24,
    },
    {
      start: 36,
      end: 43,
      type: 1,
      hashtag_name: '再见匹诺康尼',
      hashtag_id: '7366556426170271756',
      is_commerce: false,
      caption_start: 24,
      caption_end: 31,
    },
  ],
  is_top: 0,
  dislike_dimension_list_v2: null,
  share_info: {
    share_url:
      'https://www.iesdouyin.com/share/video/7382883226563415323/?region=CN&mid=7381787158287272741&u_code=khlde5m6&did=MS4wLjABAAAAr416lBR9zUJ7cc0HaC_dcXxPzB4xdtk8vS7vuKpmSfI5OARgcsinnFvOOV6sqVch&iid=MS4wLjABAAAANwkJuWIRFOzg5uCpDRpMj4OX-QryoDgn-yYlXQnRwQQ&with_sec_did=1&titleType=title&share_sign=UG1uv_L3r83PIyCD_3sdHkwu.uTEZI7KmL6sibBW42A-&share_version=170400&ts=1719046408&from_aid=6383&from_ssr=1',
    share_link_desc:
      '7.64 01/21 R@x.SY lpd:/ 这就是二命流萤的实力吗 # 精神状态群舞# 流萤 # ooc致歉# 崩坏星穹铁道# 再见匹诺康尼  %s 复制此链接，打开Dou音搜索，直接观看视频！',
  },
  xigua_base_info: {
    status: 0,
    star_altar_order_id: 0,
    star_altar_type: 0,
  },
  video_labels: [],
  jump_tab_info_list: null,
  duration: 9519,
  aweme_type: 0,
  caption: '#精神状态群舞#流萤 #ooc致歉#崩坏星穹铁道#再见匹诺康尼',
  is_24_story: 0,
  image_infos: null,
  risk_infos: {
    vote: false,
    warn: false,
    risk_sink: false,
    type: 0,
    content: '',
  },
  media_type: 4,
  tts_id_list: null,
  position: null,
  uniqid_position: null,
  comment_list: null,
  author_user_id: 64453308034,
  trends_infos: null,
  geofencing: [],
  live_appointment_info: {},
  activity_video_type: 0,
  region: 'CN',
  video_text: [],
  is_share_post: false,
  collect_stat: 0,
  label_top_text: null,
  promotions: [],
  group_id: '7382883226563415323',
  prevent_download: false,
  nickname_position: null,
  challenge_position: null,
  slides_music_beats: null,
  mark_largely_following: false,
  collection_corner_mark: 0,
  author_mask_tag: 0,
  long_video: null,
  yumme_recreason: null,
  image_crop_ctrl: 0,
  user_recommend_status: 0,
  enable_comment_sticker_rec: false,
  interaction_stickers: null,
  video_game_data_channel_config: {},
  origin_comment_ids: null,
  commerce_config_data: null,
  original: 0,
  video_control: {
    allow_download: true,
    share_type: 1,
    show_progress_bar: 0,
    draft_progress_bar: 0,
    allow_duet: true,
    allow_react: true,
    prevent_download_type: 0,
    allow_dynamic_wallpaper: true,
    timer_status: 1,
    allow_music: true,
    allow_stitch: true,
    allow_douplus: true,
    allow_share: true,
    share_grayed: false,
    download_ignore_visibility: true,
    duet_ignore_visibility: true,
    share_ignore_visibility: true,
    download_info: {
      level: 0,
    },
    duet_info: {
      level: 0,
    },
    allow_record: true,
    disable_record_reason: '',
  },
  aweme_control: {
    can_forward: true,
    can_share: true,
    can_comment: true,
    can_show_comment: true,
  },
  is_use_music: true,
  hot_list: {
    title: '精神状态群舞',
    image_url: '',
    schema:
      'sslocal://hot/spot?keyword=%E7%B2%BE%E7%A5%9E%E7%8A%B6%E6%80%81%E7%BE%A4%E8%88%9E&word_type=0&board_type=0&board_sub_type=&hotlist_param={"relativity":100,"version":1,"rank":0,"item":7382480775221923113,"t":1719046408,"hotspot_id":1731106,"gid":7382883226563415323}',
    type: 0,
    i18n_title: '',
    header: '热榜',
    footer: '1110.3万人在看',
    pattern_type: 0,
    rank: 51,
    hot_score: 4435672,
    view_count: 11102765,
    group_id: '7369141943781643530',
    sentence: '精神状态群舞',
    sentence_id: 1731106,
    extra: '{"board_name":"热榜","entrance_relativity":"100","display_style":"0","sentence_tag":"1001"}',
  },
  video_share_edit_status: 0,
  book_bar: {},
  reply_smart_emojis: null,
  anchors: null,
  hybrid_label: null,
  geofencing_regions: null,
  item_title: '这就是二命流萤的实力吗',
  voice_modify_id_list: null,
  is_story: 0,
  report_action: false,
  distribute_circle: {
    distribute_type: 0,
    campus_block_interaction: false,
    is_campus: false,
  },
  visual_search_info: {
    is_show_entrance: false,
    extra: '',
    visual_search_longpress: 0,
  },
  cf_recheck_ts: 0,
  cover_labels: null,
  entertainment_product_info: {
    sub_title: null,
    market_info: {
      limit_free: {
        in_free: false,
      },
      marketing_tag: null,
    },
    biz: 0,
  },
  authentication_token:
    'MS4wLjAAAAAAMfENLzEteswL7LKizueUAuLS3WJym1sjyGICfFw-zva8Tsm2DiyVlMwcrVK6GPeVV4IzAMCKMUCzBfj-DvG38xVUofVCYiBR3RwnBDhZfnqmPmQ7YNvBl3wce536OTvfy6CFsg97PQ__yQJoUFBuTx5zCwiZNMkXTLycuWfWTlH4yTn9vsLcjsPT3sVnh5YhjxV2USyGfEOVCJt02AdfALpoIkUraKmKw-BHzT9lMxviD8SbVGPzcPaJ6xBOIFjsYfK_40u5KzsgWeMsVNnjVQ',
  guide_btn_type: 0,
  create_scale_type: null,
  ref_voice_modify_id_list: null,
  images: null,
  relation_labels: null,
  boost_status: 0,
  impression_data: {
    group_id_list_a: [],
    group_id_list_b: [],
    similar_id_list_a: null,
    similar_id_list_b: null,
    group_id_list_c: [],
  },
  comment_words_recommend: {
    zero_comment: null,
  },
  image_comment: {},
  social_tag_list: null,
  suggest_words: {
    suggest_words: [
      {
        words: [
          {
            word: '流萤',
            word_id: '6543301669159982340',
            info: '{"qrec_for_search":"{}"}',
          },
        ],
        scene: 'detail_inbox_rex',
        icon_url: '',
        hint_text: '',
        extra_info: '{"is_life_intent":1,"resp_from":"normal"}',
      },
      {
        words: [
          {
            word: '流萤流水',
            word_id: '6896113418957264139',
            info: '{"qrec_for_search":"{}"}',
          },
        ],
        scene: 'comment_top_rec',
        icon_url: '',
        hint_text: '大家都在搜：',
        extra_info: '{"resp_from":"normal"}',
      },
      {
        words: [
          {
            word: '流萤cos',
            word_id: '6613043003001378061',
            info: '{"qrec_for_search":"{\\"query_ecom\\":\\"1\\"}"}',
          },
        ],
        scene: 'feed_bottom_rec',
        icon_url: '',
        hint_text: '相关搜索',
        extra_info: '{"resp_from":"normal"}',
      },
    ],
  },
  show_follow_button: {},
  duet_aggregate_in_music_tab: false,
  is_duet_sing: false,
  search_impr: {
    entity_id: '7382883226563415323',
    entity_type: 'GENERAL',
  },
  comment_permission_info: {
    comment_permission_status: 0,
    can_comment: true,
    item_detail_entry: false,
    press_entry: false,
    toast_guide: false,
  },
  original_images: null,
  series_paid_info: {
    series_paid_status: 0,
    item_price: 0,
  },
  img_bitrate: null,
  comment_gid: 7382883226563415000,
  image_album_music_info: {
    begin_time: -1,
    end_time: -1,
    volume: -1,
  },
  video_tag: [
    {
      tag_id: 2014,
      tag_name: '二次元',
      level: 1,
    },
    {
      tag_id: 2014002,
      tag_name: '二次元内容',
      level: 2,
    },
    {
      tag_id: 2014002001,
      tag_name: '动漫IP',
      level: 3,
    },
  ],
  is_collects_selected: 0,
  chapter_list: null,
  should_open_ad_report: false,
  cooperation_info: {
    tag: '',
    extra: '{"is_cooperation":1,"author_mix_follower_count":5484883}',
    co_creators: [
      {
        uid: '59582076223',
        sec_uid: 'MS4wLjABAAAAPyzgrSFYl_5tbXn-IJbr2mS5hXKr-U1fH9cMg2R9Z2g',
        nickname: '小米没脾气',
        avatar_thumb: {
          uri: '100x100/aweme-avatar/tos-cn-avt-0015_d40f1e73a3fdcd28180d67c253ed4640',
          url_list: [
            'https://p3.douyinpic.com/aweme/100x100/aweme-avatar/tos-cn-avt-0015_d40f1e73a3fdcd28180d67c253ed4640.jpeg?from=3782654143',
            'https://p11.douyinpic.com/aweme/100x100/aweme-avatar/tos-cn-avt-0015_d40f1e73a3fdcd28180d67c253ed4640.jpeg?from=3782654143',
            'https://p26.douyinpic.com/aweme/100x100/aweme-avatar/tos-cn-avt-0015_d40f1e73a3fdcd28180d67c253ed4640.jpeg?from=3782654143',
          ],
          width: 720,
          height: 720,
        },
        role_id: 13,
        role_title: '出镜',
        invite_status: 1,
        index: 0,
        follow_status: 0,
        follower_status: 0,
        extra: '{"dx_upgraded_info":{"dx_upgraded":false,"xg_user_id":0}}',
        follower_count: 3146774,
        custom_verify: '',
        enterprise_verify_reason: '',
      },
      {
        uid: '91691887538',
        sec_uid: 'MS4wLjABAAAAhCRFYCgYnvlIQJM_fi2jW4VkgwRCyTfqg2HMlChAmqE',
        nickname: '蔓蔓快醒醒',
        avatar_thumb: {
          uri: '100x100/aweme-avatar/tos-cn-avt-0015_18b90f8a8f2d89931942f4159e8807d0',
          url_list: [
            'https://p3.douyinpic.com/aweme/100x100/aweme-avatar/tos-cn-avt-0015_18b90f8a8f2d89931942f4159e8807d0.jpeg?from=3782654143',
            'https://p11.douyinpic.com/aweme/100x100/aweme-avatar/tos-cn-avt-0015_18b90f8a8f2d89931942f4159e8807d0.jpeg?from=3782654143',
            'https://p26.douyinpic.com/aweme/100x100/aweme-avatar/tos-cn-avt-0015_18b90f8a8f2d89931942f4159e8807d0.jpeg?from=3782654143',
          ],
          width: 720,
          height: 720,
        },
        role_id: 13,
        role_title: '出镜',
        invite_status: 1,
        index: 2,
        follow_status: 0,
        follower_status: 0,
        extra: '{"dx_upgraded_info":{"dx_upgraded":false,"xg_user_id":0}}',
        follower_count: 57992,
        custom_verify: '',
        enterprise_verify_reason: '',
      },
    ],
    co_creator_nums: 3,
    accepted_nums: 2,
    cursor: 2,
  },
  is_image_beat: false,
  dislike_dimension_list: null,
  standard_bar_info_list: null,
  photo_search_entrance: {
    ecom_type: 0,
  },
  danmaku_control: {
    enable_danmaku: true,
    post_privilege_level: 0,
    is_post_denied: false,
    post_denied_reason: '',
    skip_danmaku: false,
    danmaku_cnt: 5,
    activities: null,
  },
  is_life_item: false,
  seo_info: {},
  image_list: null,
  component_info_v2: '{"desc_lines_limit":0,"hide_marquee":false}',
  common_bar_info: '[]',
  item_warn_notification: {
    type: 0,
    show: false,
    content: '',
  },
  origin_text_extra: [],
  preview_title: '这就是二命流萤的实力吗 #精神状态群舞#流萤 #ooc致歉#崩坏星穹铁道#再见匹诺康尼',
  preview_video_status: 1,
  guide_scene_info: {
    guide_scene_type: 0,
    feed_origin_gid_info_str: '',
    diamond_expose_info_str: '',
  },
  disable_relation_bar: 0,
  packed_clips: null,
}
