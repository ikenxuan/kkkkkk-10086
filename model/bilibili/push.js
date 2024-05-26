import { bilidata, BiLiBiLiAPI } from '#bilibili'
import { base, Config, Render, networks } from '#modules'
import fs from 'fs'

export default class push extends base {
  /**
   * 构造函数
   * @param {Object} e 事件对象，提供给实例使用的事件相关信息，默认为空对象{}
   * @param {boolean} force 强制执行标志，用于控制实例行为，默认值未定义
   * @returns 无返回值
   */
  constructor(e = {}, force) {
    super() // 调用父类的构造函数
    // 判断当前bot适配器是否为'QQBot'，如果是，则直接返回true，否则继续执行
    if (this.botadapter === 'QQBot') {
      return true
    }
    this.e = e // 保存传入的事件对象
    this.force = force // 保存传入的强制执行标志
  }
  /**
   * 执行主要的操作流程，包括检查缓存并根据需要获取和更新用户数据。
   * 该函数首先检查Redis缓存中是否存在用户数据，如果不存在或已过时，则重新获取数据并更新缓存。
   * 数据不一致时，会进行强制推送或根据时间戳更新推送内容。
   *
   * @returns {Promise<boolean>} 操作完成的状态，成功为true，失败为false。
   */
  async action() {
    // 检查备注信息
    await this.checkremark()
    // 尝试从Redis获取当前缓存的数据
    const cache = await redis.get('kkk:biliPush')
    let data

    try {
      // 如果缓存为空或格式错误，重新获取并写入缓存
      if (cache == '[]' || !cache) {
        data = await this.getuserdata(true)
        await redis.set('kkk:biliPush', JSON.stringify(data))
        // 对获取到的每条数据执行额外操作
        for (const key in data) {
          await this.getdata(key)
        }
      } else {
        // 解析缓存数据
        let cachedata = JSON.parse(cache)
        // 获取最新数据，并与缓存中的数据进行比较
        data = await this.getuserdata(false)
        cachedata = await this.findMismatchedAwemeIds(data, cachedata)

        // 如果没有配置哔哩哔哩推送列表，则记录警告并结束任务
        if (data.length == 0) {
          logger.warn('[kkkkkk-10086-推送]尚未配置哔哩哔哩推送列表，任务结束，推送失败')
          return true
        }

        // 如果设置了强制推送，则执行强制推送流程
        if (this.force) {
          return await this.forcepush(data)
        }

        // 比较新旧数据的时间戳，决定是否需要更新或推送
        for (let i = 0; i < data.length; i++) {
          if (data[i].create_time == cachedata[i]?.create_time) {
            for (const key of data[i].group_id) {
              if (!(await redis.get(`kkk:biliPush-${key}-${data[i].dynamic_id}`))) {
                await this.getdata(data[i])
                logger.info(`dynamic_id: [${cachedata[i]?.dynamic_id}] ➩ [${data[i].dynamic_id}]`)
              }
            }
          } else if (data[i].create_time > cachedata[i]?.create_time || (data[i].create_time && !cachedata[i]?.create_time)) {
            await this.getdata(data[i])
            logger.info(`dynamic_id: [${cachedata[i]?.dynamic_id}] ➩ [${data[i].dynamic_id}]`)
          }
        }
        // 更新缓存中的数据
        await redis.set('kkk:biliPush', JSON.stringify(data))
      }
    } catch (error) {
      // 记录错误，并更新缓存中的数据
      logger.error(error)
      await redis.set('kkk:biliPush', JSON.stringify(data))
    }
  }

  /**
   * 异步获取数据并根据动态类型处理和发送动态信息。
   * @param {Object} data - 包含动态相关信息的对象。
   * - data 动态信息对象，必须包含 dynamic_id, host_mid, group_id, type 等属性。
   */
  async getdata(data) {
    // 获取动态卡片信息、用户空间动态信息、用户名片信息和表情包数据
    const dynamicCARDINFO = await new bilidata('动态卡片信息').GetData({ dynamic_id: data.dynamic_id })
    const dynamicINFO = await new bilidata('获取用户空间动态').GetData(data.host_mid)
    const userINFO = await new bilidata('用户名片信息').GetData(data.host_mid)
    let emojiDATA = await new bilidata('EMOJI').GetData()
    emojiDATA = extractEmojisData(emojiDATA.data.packages)
    const dycrad = JSON.parse(dynamicCARDINFO.data.card.card)

    // 跳过所有置顶动态
    let nonTopIndex = 0
    while (nonTopIndex < dynamicINFO.data.items.length && dynamicINFO.data.items[nonTopIndex].modules?.module_tag?.text === '置顶') {
      nonTopIndex++
    }
    let img

    // 遍历群组发送动态信息
    for (let i = 0; i < data.group_id.length; i++) {
      let key = `kkk:biliPush-${data.group_id[i]}-${data.dynamic_id}`
      let send = true
      switch (data.type) {
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
              text: br(dynamicINFO.data.items[nonTopIndex].modules.module_dynamic.desc.text),
              dianzan: this.count(dynamicINFO.data.items[nonTopIndex].modules.module_stat.like.count),
              pinglun: this.count(dynamicINFO.data.items[nonTopIndex].modules.module_stat.comment.count),
              share: this.count(dynamicINFO.data.items[nonTopIndex].modules.module_stat.forward.count),
              create_time: this.convertTimestampToDateTime(dynamicINFO.data.items[nonTopIndex].modules.module_author.pub_ts),
              avater_url: dynamicINFO.data.items[nonTopIndex].modules.module_author.face,
              share_url: 'https://t.bilibili.com/' + dynamicINFO.data.items[nonTopIndex].id_str,
              username: checkvip(userINFO.data.card),
              fans: this.count(userINFO.data.follower),
              user_shortid: data.host_mid,
              total_favorited: this.count(userINFO.data.like_num),
              following_count: this.count(userINFO.data.card.attention),
              Botadapter: this.botadapter,
              dynamicTYPE: '图文动态推送',
            },
            { e: this.e, scale: 1.4, retType: 'base64' },
          )
          break

        /** 处理纯文动态 */
        case 'DYNAMIC_TYPE_WORD':
          let text = dynamicINFO.data.items[nonTopIndex].modules.module_dynamic.desc.text
          for (const item of emojiDATA) {
            if (text.includes(item.text)) {
              if (text.includes('[') && text.includes(']')) {
                text = text.replace(/\[[^\]]*\]/g, `<img src="${item.url}"/>`).replace(/\\/g, '')
              }
              text += `&#160`
            }
          }
          img = await Render.render(
            'html/bilibili/dynamic/DYNAMIC_TYPE_WORD',
            {
              text: br(text),
              dianzan: this.count(dynamicINFO.data.items[nonTopIndex].modules.module_stat.like.count),
              pinglun: this.count(dynamicINFO.data.items[nonTopIndex].modules.module_stat.comment.count),
              share: this.count(dynamicINFO.data.items[nonTopIndex].modules.module_stat.forward.count),
              create_time: this.convertTimestampToDateTime(dynamicINFO.data.items[nonTopIndex].modules.module_author.pub_ts),
              avater_url: dynamicINFO.data.items[nonTopIndex].modules.module_author.face,
              share_url: 'https://t.bilibili.com/' + dynamicINFO.data.items[nonTopIndex].id_str,
              username: checkvip(userINFO.data.card),
              fans: this.count(userINFO.data.follower),
              user_shortid: data.host_mid,
              total_favorited: this.count(userINFO.data.like_num),
              following_count: this.count(userINFO.data.card.attention),
              Botadapter: this.botadapter,
              dynamicTYPE: '纯文动态推送',
            },
            { e: this.e, scale: 1.4, retType: 'base64' },
          )
          break

        /** 处理视频动态 */
        case 'DYNAMIC_TYPE_AV':
          if (dynamicINFO.data.items[nonTopIndex].modules.module_dynamic.major.type === 'MAJOR_TYPE_ARCHIVE') {
            const aid = dynamicINFO.data.items[nonTopIndex].modules.module_dynamic.major.archive.aid
            const bvid = dynamicINFO.data.items[nonTopIndex].modules.module_dynamic.major.archive.bvid
            const INFODATA = await new bilidata('bilibilivideo').GetData({ id: bvid })
            const nocd_data = await new networks({
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
                user_shortid: data.host_mid,
                total_favorited: this.count(userINFO.data.like_num),
                following_count: this.count(userINFO.data.card.attention),
                Botadapter: this.botadapter,
                dynamicTYPE: '视频动态推送',
              },
              { e: this.e, scale: 1.4, retType: 'base64' },
            )
            try {
              await Bot.pickGroup(Number(data.group_id[i])).sendMsg(segment.video(nocd_data.data.durl[0].url))
            } catch (error) {
              logger.error(error)
              await redis.set(key, 1)
            }
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
              create_time: this.convertTimestampToDateTime(dynamicINFO.data.items[0].modules.module_author.pub_ts),
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
          logger.warn(`「${data.type}」动态类型的暂未支持推送`)
          break
      }

      // 发送消息到群组
      try {
        if (send) {
          await Bot.pickGroup(Number(data.group_id[i])).sendMsg(img)
        }
      } catch (error) {
        logger.error(error)
        await redis.set(key, 1)
      }
      await redis.set(key, 1)
    }
  }

  /**
   * 异步获取用户动态数据，并可选择写入结果到redis
   *
   * @param {boolean} write 指示是否将结果写入redis
   * @param {Array} host_mid_list 包含要获取数据的用户uid列表的对象数组
   * @returns {Array} 返回一个包含用户动态信息的数组
   */
  async getuserdata(write, host_mid_list) {
    let result = []

    // 根据是否提供了host_mid_list进行不同的处理
    if (host_mid_list) {
      // 遍历host_mid_list以获取每个用户的动态数据
      for (let i = 0; i < host_mid_list.length; i++) {
        const group_id = Config.bilibilipushlist[i].group_id
        const host_mid = host_mid_list[i].host_mid || host_mid_list[i]
        const data = await new bilidata('获取用户空间动态').GetData(host_mid)
        let nonTopIndex = 0,
          dynamic_id,
          create_time

        /** 处理置顶动态，跳过所有的置顶动态 */
        while (data.data.items[nonTopIndex]?.modules?.module_tag?.text === '置顶' && nonTopIndex < data.data.items.length - 1) {
          nonTopIndex++
        }

        // 提取非置顶动态的相关信息
        create_time = data.data.items[nonTopIndex].modules.module_author.pub_ts
        dynamic_id = data.data.items[nonTopIndex].id_str
        result.push({ create_time, group_id, host_mid, dynamic_id, type: data.data.items[nonTopIndex].type })
      }
    } else {
      // 如果没有提供host_mid_list，则直接使用Config中的列表获取数据
      for (let i = 0; i < Config.bilibilipushlist.length; i++) {
        const group_id = Config.bilibilipushlist[i].group_id
        const host_mid = Config.bilibilipushlist[i].host_mid
        const data = await new bilidata('获取用户空间动态').GetData(host_mid)
        let nonTopIndex = 0,
          dynamic_id,
          create_time

        /** 同样处理置顶动态 */
        while (data.data.items[nonTopIndex]?.modules?.module_tag?.text === '置顶' && nonTopIndex < data.data.items.length - 1) {
          nonTopIndex++
        }

        // 提取非置顶动态信息
        dynamic_id = data.data.items[nonTopIndex].id_str
        create_time = data.data.items[nonTopIndex].modules.module_author.pub_ts
        result.push({ create_time, group_id, host_mid, dynamic_id, type: data.data.items[nonTopIndex].type })
      }
    }

    // 如果write参数为true，将结果写入redis
    if (write) {
      await redis.set('kkk:biliPush', JSON.stringify(result))
    }

    return result
  }

  /**
   * 设置或更新特定 host_mid 的群组信息。
   * @param {Object} data 包含 card 对象。
   * @returns {Promise<string>} 操作成功或失败的消息字符串。
   */
  async setting(data) {
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
  convertTimestampToDateTime(timestamp) {
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
  getCurrentTime() {
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

  /**
   * 查找不匹配的Aweme IDs
   *
   * 此函数比较给定的两组数据（data和cachedata），找出其中不匹配的Aweme IDs，并根据需要更新缓存数据。
   *
   * @param {Array} data - 最新的数据数组，每个元素包含host_mid和dynamic_id等属性。
   * @param {Array} cachedata - 缓存中的数据数组，结构同data。
   * @returns {Promise<Array>} 如果有不匹配的IDs，则返回更新后的资源数组；否则返回更新后的缓存数据数组。
   */
  async findMismatchedAwemeIds(data, cachedata) {
    const mismatchedIds = []
    const host_midlist = []
    let resources = []

    // 当data长度大于cachedata长度时，逐个比较元素，找出不匹配的IDs
    if (data.length > cachedata.length) {
      for (let i = 0; i < data.length; i++) {
        if (data[i].host_mid !== cachedata[i]?.host_mid) {
          mismatchedIds.push(data[i].dynamic_id)
          host_midlist.push(data[i].host_mid)
        }
      }

      // 如果存在不匹配的IDs，获取新数据并更新缓存
      if (host_midlist.length > 0) {
        let newdata = []
        newdata = await this.getuserdata(false, host_midlist)
        resources = cachedata.concat(newdata)
        await redis.set('kkk:douyPush', JSON.stringify(resources))
      }
    } else {
      // 过滤和重新排序cachedata，以匹配data顺序
      let filteredCacheData = cachedata.filter((item) => {
        return data.some((dataItem) => dataItem.host_mid === item.host_mid)
      })
      let reorderedCacheData = data.map((dataItem) => {
        return filteredCacheData.find((cacheItem) => cacheItem.host_mid === dataItem.host_mid)
      })
      cachedata = reorderedCacheData
    }

    // 返回更新后的资源或缓存数据
    return host_midlist.length > 0 ? resources : cachedata
  }

  /**
   * 检查并更新配置文件中指定用户的备注信息。
   * 该函数会遍历配置文件中的用户列表，对于没有备注或备注为空的用户，会从外部数据源获取其备注信息，并更新到配置文件中。
   *
   * @returns {void} 无返回值。
   */
  async checkremark() {
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

  /**
   * 强制推送数据到目标群体。
   * @param {Array} data - 待推送的数据数组，每个元素应包含至少一个可推送的项。
   * @returns {Promise<void>} 不返回任何内容。
   */
  async forcepush(data) {
    // 遍历传入的数据数组，并为每个元素设置组ID
    for (const item of data) {
      item.group_id = [...[this.e.group_id]] // 复制当前实例的group_id给每个item
      await this.getdata(item) // 异步获取数据，每个item分别执行
    }
  }
}

/**
 * 将换行符替换为HTML的<br>标签。
 * @param {string} data 需要进行换行符替换的字符串。
 * @returns {string} 替换后的字符串，其中的换行符\n被<br>替换。
 */
function br(data) {
  // 使用正则表达式将所有换行符替换为<br>
  return (data = data.replace(/\n/g, '<br>'))
}

/**
 * 检查成员是否为VIP，并根据VIP状态改变其显示颜色。
 * @param {Object} member - 成员对象，需要包含vip属性，该属性应包含vipStatus和nickname_color（可选）。
 * @returns {String} 返回成员名称的HTML标签字符串，VIP成员将显示为特定颜色，非VIP成员显示为默认颜色。
 */
function checkvip(member) {
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
function extractEmojisData(data) {
  const emojisData = []

  // 遍历data数组中的每个表情包
  data.forEach((packages) => {
    // 遍历每个表情包中的每个表情
    packages.emote.forEach((emote) => {
      try {
        // 尝试将表情的URL转换为URL对象，如果成功则将其添加到emojisData数组中
        new URL(emote.url)
        emojisData.push({ text: emote.text, url: emote.url })
      } catch {} // 如果URL无效，则忽略该表情
    })
  })

  return emojisData
}
