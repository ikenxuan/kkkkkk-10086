import { Base, Config, Render, DB, Version, Common } from '../../utils/index.js'
import { generateDecorationCard, cover, replacetext } from './bilibili.js'
import { getBilibiliData } from '@ikenxuan/amagi'
import YAML from 'yaml'
import fs from 'fs'

export default class Bilibilipush extends Base {
  /**
   * 构造函数
   * @param {Object} e 事件对象，提供给实例使用的事件相关信息，默认为空对象{}
   * @param {boolean} force 强制执行标志，用于控制实例行为，默认值未定义
   * @returns 无返回值
   */
  constructor (e = {}, force) {
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
    if (await this.checkremark()) return true

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
    let noCKData
    for (const dynamicId in data) {
      const dynamicCARDINFO = await getBilibiliData('动态卡片数据', Config.cookies.bilibili, { dynamic_id: dynamicId })
      const userINFO = await getBilibiliData('用户主页数据', Config.cookies.bilibili, { host_mid: data[dynamicId].host_mid, typeMode: 'strict' })
      let emojiDATA = await getBilibiliData('Emoji数据')
      emojiDATA = extractEmojisData(emojiDATA.data.packages)
      const dycrad = dynamicCARDINFO.data.card && dynamicCARDINFO.data.card.card && JSON.parse(dynamicCARDINFO.data.card.card)
      let img
      let send = true
      logger.debug(`UP: ${data[dynamicId].remark}\n动态id：${dynamicId}\nhttps://t.bilibili.com/${dynamicId}`)
      switch (data[dynamicId].dynamic_type) {
        /** 处理图文动态 */
        case 'DYNAMIC_TYPE_DRAW': {
          img = await Render.render(
            'bilibili/dynamic/DYNAMIC_TYPE_DRAW',
            {
              image_url: cover(dycrad.item.pictures),
              text: replacetext(br(data[dynamicId].Dynamic_Data.modules.module_dynamic.desc.text), data[dynamicId].Dynamic_Data.modules.module_dynamic.desc.rich_text_nodes),
              dianzan: Common.count(data[dynamicId].Dynamic_Data.modules.module_stat.like.count),
              pinglun: Common.count(data[dynamicId].Dynamic_Data.modules.module_stat.comment.count),
              share: Common.count(data[dynamicId].Dynamic_Data.modules.module_stat.forward.count),
              create_time: Common.convertTimestampToDateTime(data[dynamicId].Dynamic_Data.modules.module_author.pub_ts),
              avatar_url: data[dynamicId].Dynamic_Data.modules.module_author.face,
              frame: data[dynamicId].Dynamic_Data.modules.module_author.pendant.image,
              share_url: 'https://t.bilibili.com/' + data[dynamicId].Dynamic_Data.id_str,
              username: checkvip(userINFO.data.card),
              fans: Common.count(userINFO.data.follower),
              user_shortid: data[dynamicId].host_mid,
              total_favorited: Common.count(userINFO.data.like_num),
              following_count: Common.count(userINFO.data.card.attention),
              decoration_card: generateDecorationCard(data[dynamicId].Dynamic_Data.modules.module_author.decorate),
              render_time: Common.getCurrentTime(),
              dynamicTYPE: '图文动态推送'
            }
          )
          break
        }
        /** 处理纯文动态 */
        case 'DYNAMIC_TYPE_WORD': {
          let text = replacetext(data[dynamicId].Dynamic_Data.modules.module_dynamic.desc.text, data[dynamicId].Dynamic_Data.modules.module_dynamic.desc.rich_text_nodes)
          for (const item of emojiDATA) {
            if (text.includes(item.text)) {
              if (text.includes('[') && text.includes(']')) {
                text = text.replace(/\[[^\]]*\]/g, `<img src="${item.url}"/>`).replace(/\\/g, '')
              }
              text += '&#160'
            }
          }
          img = await Render.render(
            'bilibili/dynamic/DYNAMIC_TYPE_WORD',
            {
              text: br(text),
              dianzan: Common.count(data[dynamicId].Dynamic_Data.modules.module_stat.like.count),
              pinglun: Common.count(data[dynamicId].Dynamic_Data.modules.module_stat.comment.count),
              share: Common.count(data[dynamicId].Dynamic_Data.modules.module_stat.forward.count),
              create_time: Common.convertTimestampToDateTime(data[dynamicId].Dynamic_Data.modules.module_author.pub_ts),
              avatar_url: data[dynamicId].Dynamic_Data.modules.module_author.face,
              share_url: 'https://t.bilibili.com/' + data[dynamicId].Dynamic_Data.id_str,
              username: checkvip(userINFO.data.card),
              fans: Common.count(userINFO.data.follower),
              user_shortid: data[dynamicId].host_mid,
              total_favorited: Common.count(userINFO.data.like_num),
              following_count: Common.count(userINFO.data.card.attention),
              dynamicTYPE: '纯文动态推送'
            }
          )
          break
        }
        /** 处理视频动态 */
        case 'DYNAMIC_TYPE_AV': {
          if (data[dynamicId].Dynamic_Data.modules.module_dynamic.major.type === 'MAJOR_TYPE_ARCHIVE') {
            const aid = data[dynamicId].Dynamic_Data.modules.module_dynamic.major.archive.aid
            const bvid = data[dynamicId].Dynamic_Data.modules.module_dynamic.major.archive.bvid
            const INFODATA = await getBilibiliData('单个视频作品数据', Config.cookies.bilibili, { bvid, typeMode: 'strict' })
            /** 特殊字段，只有番剧和影视才会有，如果是该类型视频，默认不发送 */
            if (INFODATA.data.redirect_url) {
              send_video = false
              logger.debug(`UP主：${INFODATA.data.owner.name} 的该动态类型为${logger.yellow('番剧或影视')}，默认跳过不下载，直达：${logger.green(INFODATA.data.redirect_url)}`)
            } else {
              noCKData = await getBilibiliData('单个视频下载信息数据', '', { avid: aid, cid: INFODATA.data.cid })
            }

            img = await Render.render(
              'bilibili/dynamic/DYNAMIC_TYPE_AV',
              {
                image_url: [{ image_src: INFODATA.data.pic }],
                text: br(INFODATA.data.title),
                desc: br(dycrad.desc),
                dianzan: Common.count(INFODATA.data.stat.like),
                pinglun: Common.count(INFODATA.data.stat.reply),
                share: Common.count(INFODATA.data.stat.share),
                view: Common.count(dycrad.stat.view),
                coin: Common.count(dycrad.stat.coin),
                duration_text: data[dynamicId].Dynamic_Data.modules.module_dynamic.major.archive.duration_text,
                create_time: Common.convertTimestampToDateTime(INFODATA.data.ctime),
                avatar_url: INFODATA.data.owner.face,
                frame: data[dynamicId].Dynamic_Data.modules.module_author.pendant.image,
                share_url: 'https://www.bilibili.com/video/' + bvid,
                username: checkvip(userINFO.data.card),
                fans: Common.count(userINFO.data.follower),
                user_shortid: data[dynamicId].host_mid,
                total_favorited: Common.count(userINFO.data.like_num),
                following_count: Common.count(userINFO.data.card.attention),
                dynamicTYPE: '视频动态推送'
              }
            )
          }
          break
        }
        /** 处理直播动态 */
        case 'DYNAMIC_TYPE_LIVE_RCMD': {
          img = await Render.render(
            'bilibili/dynamic/DYNAMIC_TYPE_LIVE_RCMD',
            {
              image_url: [{ image_src: dycrad.live_play_info.cover }],
              text: br(dycrad.live_play_info.title),
              liveinf: br(`${dycrad.live_play_info.area_name} | 房间号: ${dycrad.live_play_info.room_id}`),
              username: checkvip(userINFO.data.card),
              avatar_url: userINFO.data.card.face,
              frame: data[dynamicId].Dynamic_Data.modules.module_author.pendant.image,
              fans: Common.count(userINFO.data.follower),
              create_time: Common.convertTimestampToDateTime(data[dynamicId].Dynamic_Data.modules.module_author.pub_ts),
              now_time: Common.getCurrentTime(),
              share_url: 'https://live.bilibili.com/' + dycrad.live_play_info.room_id,
              dynamicTYPE: '直播动态推送'
            }
          )
          break
        }
        /** 处理转发动态 */
        case 'DYNAMIC_TYPE_FORWARD': {
          const text = replacetext(br(data[dynamicId].Dynamic_Data.modules.module_dynamic.desc.text), data[dynamicId].Dynamic_Data.modules.module_dynamic.desc.rich_text_nodes)
          let param = {}
          switch (data[dynamicId].Dynamic_Data.orig.type) {
            case 'DYNAMIC_TYPE_AV': {
              param = {
                username: checkvip(data[dynamicId].Dynamic_Data.orig.modules.module_author),
                pub_action: data[dynamicId].Dynamic_Data.orig.modules.module_author.pub_action,
                avatar_url: data[dynamicId].Dynamic_Data.orig.modules.module_author.face,
                duration_text: data[dynamicId].Dynamic_Data.orig.modules.module_dynamic.major.archive.duration_text,
                title: data[dynamicId].Dynamic_Data.orig.modules.module_dynamic.major.archive.title,
                danmaku: data[dynamicId].Dynamic_Data.orig.modules.module_dynamic.major.archive.stat.danmaku,
                play: data[dynamicId].Dynamic_Data.orig.modules.module_dynamic.major.archive.stat.play,
                cover: data[dynamicId].Dynamic_Data.orig.modules.module_dynamic.major.archive.cover,
                create_time: Common.convertTimestampToDateTime(data[dynamicId].Dynamic_Data.orig.modules.module_author.pub_ts),
                decoration_card: generateDecorationCard(data[dynamicId].Dynamic_Data.orig.modules.module_author.decorate),
                frame: data[dynamicId].Dynamic_Data.orig.modules.module_author.pendant.image
              }
              break
            }
            case 'DYNAMIC_TYPE_DRAW': {
              const dynamicCARD = await getBilibiliData('动态卡片数据', Config.cookies.bilibili, { dynamic_id: data[dynamicId].Dynamic_Data.orig.id_str, typeMode: 'strict' })
              const cardData = JSON.parse(dynamicCARD.data.card.card)
              param = {
                username: checkvip(data[dynamicId].Dynamic_Data.orig.modules.module_author),
                create_time: Common.convertTimestampToDateTime(data[dynamicId].Dynamic_Data.orig.modules.module_author.pub_ts),
                avatar_url: data[dynamicId].Dynamic_Data.orig.modules.module_author.face,
                text: replacetext(br(data[dynamicId].Dynamic_Data.orig.modules.module_dynamic.desc.text), data[dynamicId].Dynamic_Data.orig.modules.module_dynamic.desc.rich_text_nodes),
                image_url: cover(cardData.item.pictures),
                decoration_card: generateDecorationCard(data[dynamicId].Dynamic_Data.orig.modules.module_author.decorate),
                frame: data[dynamicId].Dynamic_Data.orig.modules.module_author.pendant.image
              }
              break
            }
            case 'DYNAMIC_TYPE_WORD': {
              param = {
                username: checkvip(data[dynamicId].Dynamic_Data.orig.modules.module_author),
                create_time: Common.convertTimestampToDateTime(data[dynamicId].Dynamic_Data.orig.modules.module_author.pub_ts),
                avatar_url: data[dynamicId].Dynamic_Data.orig.modules.module_author.face,
                text: replacetext(br(data[dynamicId].Dynamic_Data.orig.modules.module_dynamic.desc.text), data[dynamicId].Dynamic_Data.orig.modules.module_dynamic.desc.rich_text_nodes),
                decoration_card: generateDecorationCard(data[dynamicId].Dynamic_Data.orig.modules.module_author.decorate),
                frame: data[dynamicId].Dynamic_Data.orig.modules.module_author.pendant.image
              }
              break
            }
            case 'DYNAMIC_TYPE_LIVE_RCMD': {
              const liveData = JSON.parse(data[dynamicId].Dynamic_Data.orig.modules.module_dynamic.major.live_rcmd.content)
              param = {
                username: checkvip(data[dynamicId].Dynamic_Data.orig.modules.module_author),
                create_time: Common.convertTimestampToDateTime(data[dynamicId].Dynamic_Data.orig.modules.module_author.pub_ts),
                avatar_url: data[dynamicId].Dynamic_Data.orig.modules.module_author.face,
                decoration_card: generateDecorationCard(data[dynamicId].Dynamic_Data.orig.modules.module_author.decorate),
                frame: data[dynamicId].Dynamic_Data.orig.modules.module_author.pendant.image,
                cover: liveData.live_play_info.cover,
                text_large: liveData.live_play_info.watched_show.text_large,
                area_name: liveData.live_play_info.area_name,
                title: liveData.live_play_info.title,
                online: liveData.live_play_info.online
              }
              break
            }
            case 'DYNAMIC_TYPE_FORWARD':
            default: {
              logger.warn(`UP主：${data[dynamicId].remark}的${logger.green('转发动态')}转发的原动态类型为「${logger.yellow(data[dynamicId].Dynamic_Data.orig.type)}」暂未支持解析`)
              break
            }
          }
          img = await Render.render('bilibili/dynamic/DYNAMIC_TYPE_FORWARD', {
            text,
            dianzan: Common.count(data[dynamicId].Dynamic_Data.modules.module_stat.like.count),
            pinglun: Common.count(data[dynamicId].Dynamic_Data.modules.module_stat.comment.count),
            share: Common.count(data[dynamicId].Dynamic_Data.modules.module_stat.forward.count),
            create_time: data[dynamicId].Dynamic_Data.modules.module_author.pub_time,
            avatar_url: data[dynamicId].Dynamic_Data.modules.module_author.face,
            frame: data[dynamicId].Dynamic_Data.modules.module_author.pendant.image,
            share_url: 'https://t.bilibili.com/' + data[dynamicId].Dynamic_Data.id_str,
            username: checkvip(userINFO.data.card),
            fans: Common.count(userINFO.data.follower),
            user_shortid: data[dynamicId].Dynamic_Data.modules.module_author.mid,
            total_favorited: Common.count(userINFO.data.like_num),
            following_count: Common.count(userINFO.data.card.attention),
            dynamicTYPE: '转发动态推送',
            decoration_card: generateDecorationCard(data[dynamicId].Dynamic_Data.modules.module_author.decorate),
            render_time: Common.getCurrentTime(),
            original_content: { [data[dynamicId].Dynamic_Data.orig.type]: param }
          })
          break
        }
        /** 未处理的动态类型 */
        default: {
          send = false
          logger.warn(`UP主：${data[dynamicId].remark}「${data[dynamicId].dynamic_type}」动态类型的暂未支持推送\n动态地址：${'https://t.bilibili.com/' + data[dynamicId].Dynamic_Data.id_str}`)
          break
        }
      }

      // 遍历 group_id 数组，并发送消息
      try {
        for (const groupId of data[dynamicId].group_id) {
          const [group_id, uin] = groupId.split(':')
          let status, video
          if (send) status = await Bot[uin].pickGroup(group_id).sendMsg(img)
          if (data[dynamicId].dynamic_type === 'DYNAMIC_TYPE_AV') {
            try {
              // 判断是否发送视频动态的视频
              if (send && Config.bilibili.senddynamicvideo) {
                // 下载视频
                video = await this.DownLoadVideo(noCKData.data.durl[0].url, 'tmp_' + Date.now(), false, { uin, group_id })
                if (video) await Bot[uin].pickGroup(group_id).sendMsg(segment.video(video.filepath))
              }
            } catch (error) {
              logger.error(error)
            } finally {
              if (send && Config.bilibili.senddynamicvideo && video) await this.removeFile(video?.filepath)
            }
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
                  dynamic_type: data[dynamicId].dynamic_type
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
                  dynamic_type: data[dynamicId].dynamic_type
                }
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
    const willbepushlist = {}

    try {
      for (const item of Config.pushlist.bilibili) {
        const dynamic_list = await getBilibiliData('用户主页动态列表数据', Config.cookies.bilibili, { host_mid: item.host_mid })
        const ALL_DBdata = await DB.FindAll('bilibili')

        // 将数据库中的 group_id 转换为 Set，便于后续检查是否存在
        const dbGroupIds = new Set(Object.keys(ALL_DBdata).map(groupIdStr => groupIdStr.split(':')[0]))

        // 配置文件中的 group_id 转换为对象数组，每个对象包含群号和机器人账号
        const configGroupIdObjs = item.group_id.map(groupIdStr => {
          const [groupId, robotId] = groupIdStr.split(':')
          return { groupId: Number(groupId), robotId }
        })

        // 找出新添加的群组ID
        const newGroupIds = configGroupIdObjs.filter(groupIdObj => !dbGroupIds.has(groupIdObj.groupId))

        if (dynamic_list.data.data.items.length > 0) {
          // 遍历接口返回的视频列表
          for (const dynamic of dynamic_list.data.data.items) {
            const now = new Date().getTime()
            const createTime = parseInt(dynamic.modules.module_author.pub_ts, 10) * 1000
            const timeDifference = (now - createTime) / 1000 // 时间差，单位秒

            const is_top = dynamic.modules.module_tag?.text === '置顶' // 是否为置顶
            let shouldPush = false // 是否列入推送数组
            // let shouldBreak = false // 是否跳出循环
            let exitTry = false // 是否退出 try 块
            if (is_top || (newGroupIds.length > 0 && timeDifference < 86400)) {
              shouldPush = true
            }
            // 如果 置顶视频的 aweme_id 不在数据库中，或者视频是新发布的（1天内），则 push 到 willbepushlist
            if ((newGroupIds.length > 0 && timeDifference < 86400) || shouldPush || timeDifference < 86400) {
              // 确保 willbepushlist[aweme.aweme_id] 是一个对象
              if (!willbepushlist[dynamic.id_str]) {
                willbepushlist[dynamic.id_str] = {
                  remark: item.remark,
                  host_mid: item.host_mid,
                  create_time: dynamic.modules.module_author.pub_ts,
                  group_id: newGroupIds.map(groupIdObj => `${groupIdObj.groupId}:${groupIdObj.robotId}`),
                  Dynamic_Data: dynamic, // 存储 dynamic 对象
                  avatar_img: dynamic.modules.module_author.face,
                  dynamic_type: dynamic.type
                }
              }
              // willbepushlist[dynamic.id_str].group_id = newGroupIds.length > 0 ? [...newGroupIds] : [...item.group_id] // item.group_id 为配置文件的 group_id
            }
          }
        } else {
          throw new Error(`「${item.remark}」的动态列表数量为零！`)
        }
      }
    } catch (error) {
      logger.error(error)
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
    const config = YAML.parse(fs.readFileSync(Version.pluginPath + '/config/config/pushlist.yaml', 'utf8')) // 读取配置文件
    const group_id = this.e.group_id

    // 初始化或确保 bilibilipushlist 数组存在
    if (!config.bilibili) {
      config.bilibili = []
    }

    // 检查是否存在相同的 host_mid
    const existingItem = config.bilibili.find((item) => item.host_mid === host_mid)

    if (existingItem) {
      // 如果已经存在相同的 host_mid ，则检查是否存在相同的 group_id
      let has = false
      let groupIndexToRemove = -1 // 用于记录要删除的 group_id 对象的索引
      for (let index = 0; index < existingItem.group_id.length; index++) {
        // 分割每个对象的 id 属性，并获取第一部分
        const item = existingItem.group_id[index]
        const existingGroupId = item.split(':')[0]

        // 检查分割后的第一部分是否与提供的 group_id 相同
        if (existingGroupId === String(group_id)) {
          has = true
          groupIndexToRemove = index
          break // 找到匹配项后退出循环
        }
      }
      if (has) {
        // 如果已存在相同的 group_id，则删除它
        existingItem.group_id.splice(groupIndexToRemove, 1)
        logger.info(`\n删除成功！${data.data.card.name}\nUID：${host_mid}`)
        msg = `群：${group_id}\n删除成功！${data.data.card.name}\nUID：${host_mid}`
      } else {
        const status = await DB.FindGroup('bilibili', `${group_id}:${this.e.self_id}`)
        if (!status) {
          await DB.CreateSheet('bilibili', `${group_id}:${this.e.self_id}`, {}, this.e.self_id)
        }
        // 否则，将新的 group_id 添加到该 host_mid 对应的数组中
        existingItem.group_id.push(`${group_id}:${this.e.self_id}`)
        msg = `群：${group_id}\n添加成功！${data.data.card.name}\nUID：${host_mid}`
        logger.info(`\n设置成功！${data.data.card.name}\nUID：${host_mid}`)
      }
    } else {
      const status = await DB.FindGroup('bilibili', `${group_id}:${this.e.self_id}`)
      if (!status) {
        await DB.CreateSheet('bilibili', `${group_id}:${this.e.self_id}`, {}, this.e.self_id)
      }
      // 不存在相同的 host_mid，新增一个配置项
      config.bilibili.push({ host_mid, group_id: [`${group_id}:${this.e.self_id}`], remark: data.data.card.name })
      msg = `群：${group_id}\n添加成功！${data.data.card.name}\nUID：${host_mid}`
    }

    // 更新配置文件
    Config.modify('pushlist', 'bilibili', config.bilibili)
    return msg
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
   */
  async checkremark () {
    // 读取配置文件内容
    const config = YAML.parse(fs.readFileSync(Version.pluginPath + '/config/config/pushlist.yaml', 'utf8'))
    const abclist = []
    if (Config.pushlist.bilibili === null || Config.pushlist.bilibili.length === 0) return true
    // 遍历配置文件中的用户列表，收集需要更新备注信息的用户
    for (let i = 0; i < Config.pushlist.bilibili.length; i++) {
      const remark = Config.pushlist.bilibili[i].remark
      const group_id = Config.pushlist.bilibili[i].group_id
      const host_mid = Config.pushlist.bilibili[i].host_mid

      if (remark == undefined || remark === '') {
        abclist.push({ host_mid, group_id })
      }
    }

    // 如果有需要更新备注的用户，则逐个获取备注信息并更新到配置文件中
    if (abclist.length > 0) {
      for (let i = 0; i < abclist.length; i++) {
        // 从外部数据源获取用户备注信息
        const resp = await getBilibiliData('用户主页数据', Config.cookies.bilibili, { host_mid: abclist[i].host_mid })
        const remark = resp.data.card.name
        // 在配置文件中找到对应的用户，并更新其备注信息
        const matchingItemIndex = config.bilibili.findIndex((item) => item.host_mid === abclist[i].host_mid)
        if (matchingItemIndex !== -1) {
          config.bilibili[matchingItemIndex].remark = remark
        }
      }
      // 将更新后的配置文件内容写回文件
      Config.modify('pushlist', 'bilibili', config.bilibili)
    }
  }

  async forcepush (data) {
    for (const detail in data) {
      data[detail].group_id = [...[`${this.e.group_id}:${this.e.self_id}`]]
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
  return member.vip.status === 1
    ? `<span style="color: ${member.vip.nickname_color ?? '#FB7299'}; font-weight: 700;">${member.name}</span>`
    : `<span style="color: ${Common.useDarkTheme() ? '#EDEDED' : '#606060'}">${member.name}</span>`
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
        // new URL(emote.url)
        emojisData.push({ text: emote.text, url: emote.url })
      } catch { } // 如果URL无效，则忽略该表情
    })
  })

  return emojisData
}
