import { bilidata, BiLiBiLiAPI } from '#bilibili'
import { Base, Config, Render, Networks, DB } from '#components'
import { Bot, sendMsg, segment, logger } from '#lib'
import fs from 'fs'

export default class push extends Base {
  /**
   * 构造函数
   * @param {Object} e 事件对象，提供给实例使用的事件相关信息，默认为空对象{}
   * @param {boolean} force 强制执行标志，用于控制实例行为，默认值未定义
   * @returns 无返回值
   */
  constructor(e = {}, force) {
    super(e) // 调用父类的构造函数
    // 判断当前bot适配器是否为'QQBot'，如果是，则直接返回true，否则继续执行
    if (this.botadapter === 'QQBot') {
      return true
    }
    this.force = force // 保存传入的强制执行标志
  }

  /**
   * 执行主要的操作流程，包括检查缓存并根据需要获取和更新用户数据。
   * 该函数首先检查Redis缓存中是否存在用户数据，如果不存在或已过时，则重新获取数据并更新缓存。
   * 数据不一致时，会进行强制推送或根据时间戳更新推送内容。
   *
   * @returns {Promise<boolean>} 操作完成的状态，成功为true，失败为false。
   */
  async action () {
    await this.checkremark()

    try {
      let data = await this.getuserdata()
      data = this.findMismatchedDynamicIds(data)

      if (Object.keys(data).length === 0) return true

      if (this.force) return await this.forcepush(data)
      else return await this.getdata(data)
    } catch (error) {
      logger.error(error)
    }
  }

  /**
   * 异步获取数据并根据动态类型处理和发送动态信息。
   * @param {Object} data - 包含动态相关信息的对象。
   * - data 动态信息对象，必须包含 dynamic_id, host_mid, group_id, type 等属性。
   */
  async getdata (data) {
    let nocd_data
    for (const dynamicId in data) {
      const dynamicCARDINFO = await new bilidata('动态卡片信息').GetData({ dynamic_id: dynamicId })
      const userINFO = await new bilidata('用户名片信息').GetData(data[dynamicId].host_mid)
      let emojiDATA = await new bilidata('EMOJI').GetData()
      emojiDATA = extractEmojisData(emojiDATA.data.packages)
      const dycrad = JSON.parse(dynamicCARDINFO.data.card.card)
      let img,
        send = true
      switch (data[dynamicId].dynamic_type) {
        /** 处理图文动态 */
        case 'DYNAMIC_TYPE_DRAW':
          /**
           * 生成图片数组
           * 该函数没有参数。
           * @returns {Object[]} imgArray - 包含图片源地址的对象数组。
           */
          const cover = () => {
            // 初始化一个空数组来存放图片对象
            const imgArray = []
            // 遍历dycrad.item.pictures数组，将每个图片的img_src存入对象，并将该对象加入imgArray
            for (let i = 0; i < dycrad.item.pictures.length; i++) {
              const obj = {
                image_src: dycrad.item.pictures[i].img_src,
              }
              imgArray.push(obj)
            }
            // 返回包含所有图片对象的数组
            return imgArray
          }
          img = await Render.render(
            'html/bilibili/dynamic/DYNAMIC_TYPE_DRAW',
            {
              image_url: cover(),
              text: replacetext(br(data[dynamicId].Dynamic_Data.modules.module_dynamic.desc.text), data[dynamicId].Dynamic_Data),
              dianzan: this.count(data[dynamicId].Dynamic_Data.modules.module_stat.like.count),
              pinglun: this.count(data[dynamicId].Dynamic_Data.modules.module_stat.comment.count),
              share: this.count(data[dynamicId].Dynamic_Data.modules.module_stat.forward.count),
              create_time: this.convertTimestampToDateTime(data[dynamicId].Dynamic_Data.modules.module_author.pub_ts),
              avater_url: data[dynamicId].Dynamic_Data.modules.module_author.face,
              share_url: 'https://t.bilibili.com/' + data[dynamicId].Dynamic_Data.id_str,
              username: checkvip(userINFO.data.card),
              fans: this.count(userINFO.data.follower),
              user_shortid: data[dynamicId].host_mid,
              total_favorited: this.count(userINFO.data.like_num),
              following_count: this.count(userINFO.data.card.attention),
              dynamicTYPE: '图文动态推送',
            },
            { e: this.e, scale: 1.4, retType: 'base64' },
          )
          break

        /** 处理纯文动态 */
        case 'DYNAMIC_TYPE_WORD':
          let text = replacetext(data[dynamicId].Dynamic_Data.modules.module_dynamic.desc.text, data[dynamicId].Dynamic_Data)
          for (const item of emojiDATA) {
            if (text.includes(item.text)) {
              if (text.includes('[') && text.includes(']')) {
                text = text.replace(/\[[^\]]*\]/g, `<img src="${item.url}"/>`).replace(/\\/g, '')
              }
              text += '&#160'
            }
          }
          img = await Render.render(
            'html/bilibili/dynamic/DYNAMIC_TYPE_WORD',
            {
              text: br(text),
              dianzan: this.count(data[dynamicId].Dynamic_Data.modules.module_stat.like.count),
              pinglun: this.count(data[dynamicId].Dynamic_Data.modules.module_stat.comment.count),
              share: this.count(data[dynamicId].Dynamic_Data.modules.module_stat.forward.count),
              create_time: this.convertTimestampToDateTime(data[dynamicId].Dynamic_Data.modules.module_author.pub_ts),
              avater_url: data[dynamicId].Dynamic_Data.modules.module_author.face,
              share_url: 'https://t.bilibili.com/' + data[dynamicId].Dynamic_Data.id_str,
              username: checkvip(userINFO.data.card),
              fans: this.count(userINFO.data.follower),
              user_shortid: data[dynamicId].host_mid,
              total_favorited: this.count(userINFO.data.like_num),
              following_count: this.count(userINFO.data.card.attention),
              dynamicTYPE: '纯文动态推送',
            },
            { e: this.e, scale: 1.4, retType: 'base64' },
          )
          break

        /** 处理视频动态 */
        case 'DYNAMIC_TYPE_AV':
          if (data[dynamicId].Dynamic_Data.modules.module_dynamic.major.type === 'MAJOR_TYPE_ARCHIVE') {
            const aid = data[dynamicId].Dynamic_Data.modules.module_dynamic.major.archive.aid
            const bvid = data[dynamicId].Dynamic_Data.modules.module_dynamic.major.archive.bvid
            const INFODATA = await new bilidata('bilibilivideo').GetData({ id: bvid })
            nocd_data = await new Networks({
              url: BiLiBiLiAPI.VIDEO(aid, INFODATA.INFODATA.data.cid) + '&platform=html5',
              headers: this.headers,
            }).getData()

            img = await Render.render(
              'html/bilibili/dynamic/DYNAMIC_TYPE_AV',
              {
                image_url: [{ image_src: INFODATA.INFODATA.data.pic }],
                text: br(INFODATA.INFODATA.data.title),
                desc: br(dycrad.desc),
                dianzan: this.count(INFODATA.INFODATA.data.stat.like),
                pinglun: this.count(INFODATA.INFODATA.data.stat.reply),
                share: this.count(INFODATA.INFODATA.data.stat.share),
                create_time: this.convertTimestampToDateTime(INFODATA.INFODATA.data.ctime),
                avater_url: INFODATA.INFODATA.data.owner.face,
                share_url: 'https://t.bilibili.com/' + bvid,
                username: checkvip(userINFO.data.card),
                fans: this.count(userINFO.data.follower),
                user_shortid: data[dynamicId].host_mid,
                total_favorited: this.count(userINFO.data.like_num),
                following_count: this.count(userINFO.data.card.attention),
                dynamicTYPE: '视频动态推送',
              },
              { e: this.e, scale: 1.4, retType: 'base64' },
            )
          }
          break

        /** 处理直播动态 */
        case 'DYNAMIC_TYPE_LIVE_RCMD':
          img = await Render.render(
            'html/bilibili/dynamic/DYNAMIC_TYPE_LIVE_RCMD',
            {
              image_url: [{ image_src: dycrad.live_play_info.cover }],
              text: br(dycrad.live_play_info.title),
              liveinf: br(`${dycrad.live_play_info.area_name} | 房间号: ${dycrad.live_play_info.room_id}`),
              username: userINFO.data.card.name,
              avater_url: userINFO.data.card.face,
              fans: this.count(userINFO.data.follower),
              create_time: this.convertTimestampToDateTime(data[dynamicId].Dynamic_Data.modules.module_author.pub_ts),
              now_time: this.getCurrentTime(),
              share_url: 'https://live.bilibili.com/' + dycrad.live_play_info.room_id,
              dynamicTYPE: '直播动态推送',
            },
            { e: this.e, scale: 1.4, retType: 'base64' },
          )
          break

        /** 未处理的动态类型 */
        default:
          send = false
          logger.warn(`UP主：${data[dynamicId].remark}「${data[dynamicId].dynamic_type}」动态类型的暂未支持推送`)
      }

      // 遍历 group_id 数组，并发送消息
      try {
        let status
        for (const groupId of data[dynamicId].group_id) {
          if (send) status = await sendMsg(Bot?.list?.[0]?.bot?.account?.uin ?? null, groupId, img)
          if (data[dynamicId].dynamic_type === 'DYNAMIC_TYPE_AV')
            try {
              send && await sendMsg(Bot?.list?.[0]?.bot?.account?.uin ?? null, groupId, segment.video(nocd_data.data.durl[0].url))
            } catch (error) {
              logger.error(error)
            }

          if (status || !send) {
            const DBdata = await DB.FindGroup('bilibili', groupId)

            /**
             * 检查 DBdata 中是否存在与给定 host_mid 匹配的项
             * @param {Object} DBdata - 包含数据的对象
             * @param {string} secUidToCheck - 要检查的 host_mid
             * @returns {string} 匹配的 host_mid
             */
            const findMatchingSecUid = (DBdata, host_midToCheck) => {
              for (const host_mid in DBdata) {
                if (DBdata.hasOwnProperty(host_mid) && DBdata[host_mid].host_mid === host_midToCheck) {
                  return host_midToCheck
                }
              }
              return false // 未找到匹配的 host_mid，返回 false
            }
            let newEntry
            if (DBdata) {
              // 如果 DBdata 存在，遍历 DBdata 来查找对应的 host_mid
              let found = false

              if (data[dynamicId].host_mid === findMatchingSecUid(DBdata, data[dynamicId].host_mid)) {
                // 如果找到了对应的 host_mid ，将 dynamicId 添加到 dynamic_idlist 数组中
                const isSecUidFound = findMatchingSecUid(DBdata, data[dynamicId].host_mid)
                if (isSecUidFound && this.force ? true : !DBdata[data[dynamicId].host_mid].dynamic_idlist.includes(dynamicId)) {
                  DBdata[isSecUidFound].dynamic_idlist.push(dynamicId)
                  DBdata[isSecUidFound].create_time = Number(data[dynamicId].create_time)
                  await DB.UpdateGroupData('bilibili', groupId, DBdata)
                  found = true
                }
              }

              if (!found) {
                // 如果没有找到对应的 host_mid ，创建一个新的条目
                newEntry = {
                  remark: data[dynamicId].remark,
                  create_time: data[dynamicId].create_time,
                  host_mid: data[dynamicId].host_mid,
                  dynamic_idlist: [dynamicId],
                  avatar_img: data[dynamicId].Dynamic_Data.modules.module_author.face,
                  dynamic_type: data[dynamicId].dynamic_type,
                }
                DBdata[data[dynamicId].host_mid] = newEntry
                // 更新数据库
                await DB.UpdateGroupData('bilibili', groupId, DBdata)
              }
            } else {
              // 如果 DBdata 为空，创建新的条目
              await DB.CreateSheet('bilibili', groupId, {
                [data[dynamicId].host_mid]: {
                  remark: data[dynamicId].remark,
                  create_time: data[dynamicId].create_time,
                  host_mid: data[dynamicId].host_mid,
                  dynamic_idlist: [dynamicId],
                  avatar_img: data[dynamicId].Dynamic_Data.modules.module_author.face,
                  dynamic_type: data[dynamicId].dynamic_type,
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
   * 异步获取用户动态数据，并可选择写入结果到redis
   *
   * @param {boolean} write 指示是否将结果写入redis
   * @param {Array} host_mid_list 包含要获取数据的用户uid列表的对象数组
   * @returns {Array} 返回一个包含用户动态信息的数组
   */
  async getuserdata () {
    let willbepushlist = {}

    try {
      for (const item of Config.bilibilipushlist) {
        const dynamic_list = await new bilidata('获取用户空间动态').GetData(item.host_mid)
        const ALL_DBdata = await DB.FindAll('bilibili')
        // 检查配置文件中的群组列表与数据库中的群组列表是否一致
        const dbGroupIds = new Set(Object.keys(ALL_DBdata).map(Number)) // 将数据库中的群组ID转换为数字并去重
        const configGroupIds = Array.from(new Set(item.group_id)) // 配置文件中的群组ID集合

        // 找出新添加的群组ID
        const newGroupIds = configGroupIds.filter((groupId) => !dbGroupIds.has(groupId))
        if (dynamic_list.data.items.length > 0) {
          // 遍历接口返回的视频列表
          for (const dynamic of dynamic_list.data.items) {
            const now = new Date().getTime()
            const createTime = parseInt(dynamic.modules.module_author.pub_ts, 10) * 1000
            const timeDifference = (now - createTime) / 1000 // 时间差，单位秒

            let is_top = dynamic.modules.module_tag?.text === '置顶', // 是否为置顶
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
                  for (const host_mid in ALL_DBdata[groupId]) {
                    if (ALL_DBdata[groupId][host_mid].host_mid === item.host_mid) {
                      // 找到对应用户，如果 aweme_id 不在在 dynamic_idlist 中，也就是没推送过
                      if (!ALL_DBdata[groupId][host_mid].dynamic_idlist?.includes(dynamic.id_str) && timeDifference < 86400) {
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
              if (!willbepushlist[dynamic.id_str]) {
                willbepushlist[dynamic.id_str] = {
                  remark: item.remark,
                  host_mid: item.host_mid,
                  create_time: dynamic.modules.module_author.pub_ts,
                  group_id: [], // 初始化 group_id 为数组
                  Dynamic_Data: dynamic, // 存储 dynamic 对象
                  avatar_img: dynamic.modules.module_author.face,
                  dynamic_type: dynamic.type,
                }
              }
              willbepushlist[dynamic.id_str].group_id = newGroupIds.length > 0 ? [...newGroupIds] : [...item.group_id] // item.group_id 为配置文件的 group_id
            }
          }
        } else {
          throw new Error(`「${item.remark}」的动态列表数量为零！`)
        }
      }
    } catch (error) {
      console.log(error)
    }

    const DBdata = await DB.FindAll('bilibili')
    // 这里是强制数组的第一个对象中的内容 DBdata[0]?.data 因为调用这个函数的上层有遍历群组逻辑
    // DBdata[0]?.data 则是当前群组的推送用户数据
    return { willbepushlist, DBdata }
  }

  /**
   * 设置或更新特定 host_mid 的群组信息。
   * @param {Object} data 包含 card 对象。
   * @returns {Promise<string>} 操作成功或失败的消息字符串。
   */
  async setting (data) {
    let msg
    const host_mid = data.data.card.mid
    const config = JSON.parse(fs.readFileSync(this.ConfigPath)) // 读取配置文件
    const group_id = this.e.group_id

    // 初始化或确保 bilibilipushlist 数组存在
    if (!config.bilibilipushlist) {
      config.bilibilipushlist = []
    }

    // 检查是否存在相同的 host_mid
    const existingItem = config.bilibilipushlist.find((item) => item.host_mid === host_mid)

    if (existingItem) {
      // 处理已存在的 host_mid
      const existingGroupIdIndex = existingItem.group_id.indexOf(group_id)
      if (existingGroupIdIndex !== -1) {
        // 如果已存在相同的 group_id，则删除它
        existingItem.group_id.splice(existingGroupIdIndex, 1)
        logger.info(`\n删除成功！${data.data.card.name}\nUID：${host_mid}`)
        msg = `群：${group_id}\n删除成功！${data.data.card.name}\nUID：${host_mid}`
      } else {
        // 否则，将新的 group_id 添加到该 host_mid 对应的数组中
        existingItem.group_id.push(group_id)
        msg = `群：${group_id}\n添加成功！${data.data.card.name}\nUID：${host_mid}`
        logger.info(`\n设置成功！${data.data.card.name}\nUID：${host_mid}`)
      }
    } else {
      // 不存在相同的 host_mid，新增一个配置项
      config.bilibilipushlist.push({ host_mid, group_id: [group_id], remark: data.data.card.name })
      msg = `群：${group_id}\n添加成功！${data.data.card.name}\nUID：${host_mid}`
    }

    // 更新配置文件
    fs.writeFileSync(this.ConfigPath, JSON.stringify(config, null, 2))
    return msg
  }

  /**
   * 将时间戳转换为日期时间字符串
   * @param {number} timestamp - 表示秒数的时间戳
   * @returns {string} 格式为YYYY-MM-DD HH:MM的日期时间字符串
   */
  convertTimestampToDateTime (timestamp) {
    // 创建一个Date对象，时间戳乘以1000是为了转换为毫秒
    const date = new Date(timestamp * 1000)
    const year = date.getFullYear() // 获取年份
    const month = String(date.getMonth() + 1).padStart(2, '0') // 获取月份，确保两位数显示
    const day = String(date.getDate()).padStart(2, '0') // 获取日，确保两位数显示
    const hours = String(date.getHours()).padStart(2, '0') // 获取小时，确保两位数显示
    const minutes = String(date.getMinutes()).padStart(2, '0') // 获取分钟，确保两位数显示

    // 返回格式化后的日期时间字符串
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

  /**
   * 获取当前时间，并格式化为年-月-日 时:分:秒的字符串形式
   * 参数：无
   * 返回值：格式化后的时间字符串，例如"2023-03-15 12:30:45"
   */
  getCurrentTime () {
    // 创建一个Date对象以获取当前时间
    let now = new Date()
    // 获取年、月、日、时、分、秒
    let year = now.getFullYear()
    let month = now.getMonth() + 1
    let day = now.getDate()
    let hour = now.getHours()
    let minute = now.getMinutes()
    let second = now.getSeconds()
    // 对月、日、时、分、秒进行两位数格式化
    month = month < 10 ? '0' + month : month
    day = day < 10 ? '0' + day : day
    hour = hour < 10 ? '0' + hour : hour
    minute = minute < 10 ? '0' + minute : minute
    second = second < 10 ? '0' + second : second
    // 拼接时间为字符串，并返回
    return year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second
  }

  findMismatchedDynamicIds (inputData) {
    if (!inputData.DBdata) return inputData.willbepushlist
    const willbepushByGroupId = {}
    for (const dynamicId in inputData.willbepushlist) {
      inputData.willbepushlist[dynamicId].group_id.forEach((groupId) => {
        if (!willbepushByGroupId[groupId]) {
          willbepushByGroupId[groupId] = []
        }
        willbepushByGroupId[groupId].push(dynamicId)
      })
    }

    // 遍历 DBdata，找出存在于 willbepushByGroupId 中的 group_id
    for (const groupId in inputData.DBdata) {
      if (willbepushByGroupId[groupId]) {
        // 遍历每个 group_id 下的 host_mid
        for (const host_mid in inputData.DBdata[groupId]) {
          // 检查 dynamic_idlist 中的每个 dynamic_id
          inputData.DBdata[groupId][host_mid].dynamic_idlist.forEach((dynamicId) => {
            // 如果 dynamic_id 存在于 willbepushByGroupId[groupId] 中
            if (willbepushByGroupId[groupId].includes(dynamicId)) {
              // 移除 willbepushlist 中对应的视频对象
              delete inputData.willbepushlist[dynamicId]
            }
          })
        }
      }
    }

    return inputData.willbepushlist
  }

  /**
   * 检查并更新配置文件中指定用户的备注信息。
   * 该函数会遍历配置文件中的用户列表，对于没有备注或备注为空的用户，会从外部数据源获取其备注信息，并更新到配置文件中。
   *
   * @returns {void} 无返回值。
   */
  async checkremark () {
    // 读取配置文件内容
    let config = JSON.parse(fs.readFileSync(this.ConfigPath))
    const abclist = []

    // 遍历配置文件中的用户列表，收集需要更新备注信息的用户
    for (let i = 0; i < Config.bilibilipushlist.length; i++) {
      const remark = Config.bilibilipushlist[i].remark
      const group_id = Config.bilibilipushlist[i].group_id
      const host_mid = Config.bilibilipushlist[i].host_mid

      if (remark == undefined || remark === '') {
        abclist.push({ host_mid, group_id })
      }
    }

    // 如果有需要更新备注的用户，则逐个获取备注信息并更新到配置文件中
    if (abclist.length > 0) {
      for (let i = 0; i < abclist.length; i++) {
        // 从外部数据源获取用户备注信息
        const resp = await new bilidata('用户名片信息').GetData(abclist[i].host_mid)
        const remark = resp.data.card.name
        // 在配置文件中找到对应的用户，并更新其备注信息
        const matchingItemIndex = config.bilibilipushlist.findIndex((item) => item.host_mid === abclist[i].host_mid)
        if (matchingItemIndex !== -1) {
          config.bilibilipushlist[matchingItemIndex].remark = remark
        }
      }
      // 将更新后的配置文件内容写回文件
      fs.writeFileSync(this.ConfigPath, JSON.stringify(config, null, 2))
    }
  }

  async forcepush (data) {
    for (const detail in data) {
      data[detail].group_id = [...[this.e.group_id]]
    }
    await this.getdata(data)
  }
}

/**
 * 将换行符替换为HTML的<br>标签。
 * @param {string} data 需要进行换行符替换的字符串。
 * @returns {string} 替换后的字符串，其中的换行符\n被<br>替换。
 */
function br (data) {
  // 使用正则表达式将所有换行符替换为<br>
  return (data = data.replace(/\n/g, '<br>'))
}

/**
 * 检查成员是否为VIP，并根据VIP状态改变其显示颜色。
 * @param {Object} member - 成员对象，需要包含vip属性，该属性应包含vipStatus和nickname_color（可选）。
 * @returns {String} 返回成员名称的HTML标签字符串，VIP成员将显示为特定颜色，非VIP成员显示为默认颜色。
 */
function checkvip (member) {
  // 根据VIP状态选择不同的颜色显示成员名称
  return member.vip.vipStatus === 1
    ? `<span style="color: ${member.vip.nickname_color || '#FB7299'}; font-weight: bold;">${member.name}</span>`
    : `<span style="color: #606060">${member.name}</span>`
}

/**
 * 处理并提取表情数据，返回一个包含表情名称和URL的对象数组。
 * @param {Array} data - 表情数据的数组，每个元素包含一个表情包的信息。
 * @returns {Array} 返回一个对象数组，每个对象包含text(表情名称)和url(表情图片地址)属性。
 */
function extractEmojisData (data) {
  const emojisData = []

  // 遍历data数组中的每个表情包
  data.forEach((packages) => {
    // 遍历每个表情包中的每个表情
    packages.emote.forEach((emote) => {
      try {
        // 尝试将表情的URL转换为URL对象，如果成功则将其添加到emojisData数组中
        new URL(emote.url)
        emojisData.push({ text: emote.text, url: emote.url })
      } catch { } // 如果URL无效，则忽略该表情
    })
  })

  return emojisData
}

function replacetext (text, obj) {
  for (const tag of obj.modules.module_dynamic.desc.rich_text_nodes) {
    if (tag.type === 'RICH_TEXT_NODE_TYPE_TOPIC') {
      // 使用 RegExp 构造函数来正确转义 orig_text 中的特殊字符
      const regex = new RegExp(tag.orig_text, 'g')
      // 替换文本并更新 text 变量
      text = text.replace(regex, `<span style="color: #0C6692;">${tag.orig_text}</span>`)
    }
  }
  return text
}
