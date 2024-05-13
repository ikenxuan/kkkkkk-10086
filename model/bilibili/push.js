import { bilidata, BiLiBiLiAPI, bilicomments } from '#bilibili'
import { base, Config, image, networks } from '#modules'
import fs from 'fs'

export default class push extends base {
  constructor(e) {
    super(e)
    if (this.botadapter === 'QQBot') {
      return true
    }
  }
  async action() {
    // await this.checkremark()
    const cache = await redis.get('kkk:biliPush')
    let data

    try {
      if (cache == '[]' || !cache) {
        /** 如果redis里没有，就重新获取并写入 */
        data = await this.getuserdata(true)
        await redis.set('kkk:biliPush', JSON.stringify(data))
        for (const key in data) {
          await this.getdata(key)
        }
      } else {
        let cachedata = JSON.parse(cache)
        /** 获取最新那一条 */
        data = await this.getuserdata(false)
        cachedata = await this.findMismatchedAwemeIds(data, cachedata)

        if (data.length == 0) {
          logger.warn('[kkkkkk-10086-推送]尚未配置哔哩哔哩推送列表，任务结束，推送失败')
          return true
        }
        for (let i = 0; i < data.length; i++) {
          if (data[i].create_time == cachedata[i]?.create_time) {
            for (const key of data[i].group_id) {
              /** 如果群：key 还没推送过这个动态 */
              if (!(await redis.get(`kkk:biliPush-${key}-${data[i].dynamic_id}`))) {
                await this.getdata(data[i])
                logger.info(`dynamic_id: [${cachedata[i].dynamic_id}] ➩ [${data[i].dynamic_id}]`)
              }
            }
            await this.getdata(data[i])
          } else if (data[i].create_time > cachedata[i]?.create_time || (data[i].create_time && !cachedata[i]?.create_time)) {
            await this.getdata(data[i])
            logger.info(`dynamic_id: [${cachedata[i].dynamic_id}] ➩ [${data[i].dynamic_id}]`)
          }
        }
      }
    } catch (error) {
      logger.error(error)
      await redis.set('kkk:biliPush', JSON.stringify(data))
    }
  }

  async getdata(data) {
    const dynamicCARDINFO = await new bilidata('动态卡片信息').GetData({ dynamic_id: data.dynamic_id })
    const dynamicINFO = await new bilidata('获取用户空间动态').GetData(data.host_mid)
    const userINFO = await new bilidata('用户名片信息').GetData(data.host_mid)
    let emojiDATA = await new bilidata('EMOJI').GetData()
    emojiDATA = extractEmojisData(emojiDATA.data.packages)
    const dycrad = JSON.parse(dynamicCARDINFO.data.card.card)

    let nonTopIndex = 0
    while (nonTopIndex < dynamicINFO.data.items.length && dynamicINFO.data.items[nonTopIndex].modules?.module_tag?.text === '置顶') {
      nonTopIndex++ // 跳过所有置顶视频
    }
    let img

    const user_img = dynamicINFO.data.items[nonTopIndex].modules.module_author.face
    for (let i = 0; i < data.group_id.length; i++) {
      let key = `kkk:biliPush-${data.group_id[i]}-${data.dynamic_id}`
      if (!(await redis.get(key))) {
        console.log(`这个视频在${data.group_id[i]}推送过了！`)
      } else {
        switch (data.type) {
          /** 图文动态 */
          case 'DYNAMIC_TYPE_DRAW':
            const cover = () => {
              const imgArray = []
              for (let i = 0; i < dycrad.item.pictures.length; i++) {
                const obj = {
                  image_src: dycrad.item.pictures[i].img_src,
                }
                imgArray.push(obj)
              }
              return imgArray
            }
            img = await image('bilibili/dynamic/DYNAMIC_TYPE_DRAW', 'kkkkkk-10086/bilibili/dynamic', {
              saveId: 'DYNAMIC_TYPE_DRAW',
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
              dynamicTYPE: '图文',
            })
            break

          /** 纯文动态 */
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
            img = await image('bilibili/dynamic/DYNAMIC_TYPE_WORD', 'kkkkkk-10086/bilibili/dynamic', {
              saveId: 'DYNAMIC_TYPE_WORD',
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
              dynamicTYPE: '纯文',
            })
            break

          /** 视频动态 */
          case 'DYNAMIC_TYPE_AV':
            if (dynamicINFO.data.items[nonTopIndex].modules.module_dynamic.major.type === 'MAJOR_TYPE_ARCHIVE') {
              const aid = dynamicINFO.data.items[nonTopIndex].modules.module_dynamic.major.archive.aid
              const bvid = dynamicINFO.data.items[nonTopIndex].modules.module_dynamic.major.archive.bvid
              const INFODATA = await new bilidata('bilibilivideo').GetData({ id: bvid })
              const nocd_data = await new networks({
                url: BiLiBiLiAPI.VIDEO(aid, INFODATA.INFODATA.data.cid) + '&platform=html5',
                headers: this.headers,
              }).getData()

              img = await image('bilibili/dynamic/DYNAMIC_TYPE_AV', 'kkkkkk-10086/bilibili/dynamic', {
                saveId: 'DYNAMIC_TYPE_AV',
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
                dynamicTYPE: '视频',
              })
              await Bot.pickGroup(Number(data.group_id[i])).sendMsg(segment.video(nocd_data.data.durl[0].url))
            }
            break

          /** 直播动态 */
          case 'DYNAMIC_TYPE_LIVE_RCMD':
            break
          default:
            logger.warn(`「${data.type}」动态类型的暂未支持推送`)
            break
        }

        await Bot.pickGroup(Number(data.group_id[i])).sendMsg(img)
        await redis.set(key, 1)
      }
    }
  }

  /**
   *
   * @param {*} write 是否写入
   * @param {*} host_mid_list 要获取aweme_id的用户uid列表
   * @returns
   */
  async getuserdata(write, host_mid_list) {
    let result = []

    if (host_mid_list) {
      for (let i = 0; i < host_mid_list.length; i++) {
        const group_id = Config.bilibilipushlist[i].group_id
        const host_mid = host_mid_list[i].host_mid || host_mid_list[i]
        const data = await new bilidata('获取用户空间动态').GetData(host_mid)
        let nonTopIndex = 0,
          dynamic_id,
          create_time
        /** 处理置顶 */
        while (data.data.items[nonTopIndex]?.modules?.module_tag?.text === '置顶' && nonTopIndex < data.data.items.length - 1) {
          nonTopIndex++
        }

        create_time = data.data.items[nonTopIndex].modules.module_author.pub_ts
        dynamic_id = data.data.items[nonTopIndex].id_str
        result.push({ create_time, group_id, host_mid, dynamic_id, type: data.data.items[nonTopIndex].type })
      }
    } else {
      for (let i = 0; i < Config.bilibilipushlist.length; i++) {
        const group_id = Config.bilibilipushlist[i].group_id
        const host_mid = Config.bilibilipushlist[i].host_mid
        const data = await new bilidata('获取用户空间动态').GetData(host_mid)
        let nonTopIndex = 0,
          dynamic_id,
          create_time
        /** 处理置顶 */
        while (data.data.items[nonTopIndex]?.modules?.module_tag?.text === '置顶' && nonTopIndex < data.data.items.length - 1) {
          nonTopIndex++
        }
        switch (data.data.items[nonTopIndex].type) {
          /** 投稿视频 */
          case 'DYNAMIC_TYPE_AV':
          /** 动态转发 */
          case 'DYNAMIC_TYPE_FORWARD':
          /** 带图动态 */
          case 'DYNAMIC_TYPE_DRAW':
          /** 纯文字动态 */
          case 'DYNAMIC_TYPE_WORD':
          /** 剧集（番剧、电影、纪录片）	 */
          case 'DYNAMIC_TYPE_PGC':
          /** 投稿专栏 */
          case 'DYNAMIC_TYPE_ARTICLE':
          /** 音乐 */
          case 'DYNAMIC_TYPE_MUSIC':
            dynamic_id = data.data.items[nonTopIndex].id_str
            create_time = data.data.items[nonTopIndex].modules.module_author.pub_ts
        }
        result.push({ create_time, group_id, host_mid, dynamic_id, type: data.data.items[nonTopIndex].type })
      }
    }
    if (write) {
      await redis.set('kkk:biliPush', JSON.stringify(result))
    }
    return result
  }

  async setting(data) {
    let msg
    const host_mid = data.data.card.mid
    // const UserInfoData = await new bilidata('UserInfoData').GetData({ user_id: host_mid })

    const config = JSON.parse(fs.readFileSync(this.ConfigPath))
    const group_id = this.e.group_id

    // 初始化 group_id 对应的数组
    if (!config.bilibilipushlist) {
      config.bilibilipushlist = []
    }

    // 查找是否存在相同的 host_mid
    const existingItem = config.bilibilipushlist.find((item) => item.host_mid === host_mid)

    if (existingItem) {
      // 如果已经存在相同的 host_mid，则检查是否存在相同的 group_id
      const existingGroupIdIndex = existingItem.group_id.indexOf(group_id)
      if (existingGroupIdIndex !== -1) {
        // 如果存在相同的 group_id，则删除它
        existingItem.group_id.splice(existingGroupIdIndex, 1)
        logger.info(`\n删除成功！${data.data.card.name}\nUID：${host_mid}`)
        msg = `群：${group_id}\n删除成功！${data.data.card.name}\nUID：${host_mid}`

        // 如果删除后 group_id 数组为空，则删除整个属性
        if (existingItem.group_id.length === 0) {
          const index = config.bilibilipushlist.indexOf(existingItem)
          config.bilibilipushlist.splice(index, 1)
        }
      } else {
        // 否则，将新的 group_id 添加到该 host_mid 对应的数组中
        existingItem.group_id.push(group_id)
        msg = `群：${group_id}\n添加成功！${data.data.card.name}\nUID：${host_mid}`
        logger.info(`\n设置成功！${data.data.card.name}\nUID：${host_mid}`)
      }
    } else {
      // 如果不存在相同的 host_mid，则新增一个属性
      config.bilibilipushlist.push({ host_mid, group_id: [group_id], remark: data.data.card.name })
      msg = `群：${group_id}\n添加成功！${data.data.card.name}\nUID：${host_mid}`
    }

    fs.writeFileSync(this.ConfigPath, JSON.stringify(config, null, 2))
    return msg
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
    const host_midlist = []
    let resources = []
    if (data.length > cachedata.length) {
      for (let i = 0; i < data.length; i++) {
        if (data[i].host_mid !== cachedata[i]?.host_mid) {
          mismatchedIds.push(data[i].dynamic_id)
          host_midlist.push(data[i].host_mid)
        }
      }
      if (host_midlist.length > 0) {
        let newdata = []
        newdata = await this.getuserdata(false, host_midlist)
        resources = cachedata.concat(newdata)
        await redis.set('kkk:douyPush', JSON.stringify(resources))
      }
    } else {
      // 过滤掉cachedata中data.sec_id不存在的对象
      let filteredCacheData = cachedata.filter((item) => {
        return data.some((dataItem) => dataItem.host_mid === item.host_mid)
      })
      // 重新排序cachedata，使得其顺序与data的顺序相匹配
      let reorderedCacheData = data.map((dataItem) => {
        return filteredCacheData.find((cacheItem) => cacheItem.host_mid === dataItem.host_mid)
      })
      cachedata = reorderedCacheData
    }

    return host_midlist.length > 0 ? resources : cachedata
  }

  async checkremark() {
    let config = JSON.parse(fs.readFileSync(this.ConfigPath))
    const abclist = []
    for (let i = 0; i < this.Config.bilibilipushlist.length; i++) {
      const remark = this.Config.bilibilipushlist[i].remark
      const group_id = this.Config.bilibilipushlist[i].group_id
      const host_mid = this.Config.bilibilipushlist[i].host_mid

      if (remark == undefined || remark === '') {
        abclist.push({ host_mid, group_id })
      }
    }
    if (abclist.length > 0) {
      for (let i = 0; i < abclist.length; i++) {
        const resp = await new bilidata('UserInfoData').动态卡片信息(abclist[i].host_mid)
        const remark = resp.data.card.name
        const matchingItemIndex = config.bilibilipushlist.findIndex((item) => item.host_mid === abclist[i].host_mid)
        if (matchingItemIndex !== -1) {
          // 更新匹配的对象的 remark
          config.bilibilipushlist[matchingItemIndex].remark = remark
        }
      }
      fs.writeFileSync(this.ConfigPath, JSON.stringify(config, null, 2))
    }
  }
}

/** 换行符转<br> */
function br(data) {
  return (data = data.replace(/\n/g, '<br>'))
}

function checkvip(member) {
  return member.vip.vipStatus === 1
    ? `<span style="color: ${member.vip.nickname_color || '#FB7299'}; font-weight: bold;">${member.name}</span>`
    : `<span style="color: #606060">${member.name}</span>`
}

/** 处理表情，返回[{text: 表情名字, url: 表情地址}] */
function extractEmojisData(data) {
  const emojisData = []

  // 遍历每个包
  data.forEach((packages) => {
    // 遍历每个表情
    packages.emote.forEach((emote) => {
      try {
        new URL(emote.url)
        emojisData.push({ text: emote.text, url: emote.url })
      } catch {}
    })
  })

  return emojisData
}
