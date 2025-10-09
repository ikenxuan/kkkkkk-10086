import { Base, Render, Config, Networks, mergeFile, Common, baseHeaders, downloadFile, uploadFile, downloadVideo } from '../../utils/index.js'
import { bilibiliApiUrls, getBilibiliData, DynamicType, AdditionalType } from '@ikenxuan/amagi'
import common from '../../../../../lib/common/common.js'
import { bilibiliComments, checkCk, genParams } from './index.js'
import fs from 'fs'

/**
 * B站视频列表
 * @typedef {import('@ikenxuan/amagi').BiliVideoPlayurlIsLogin['data']['dash']['video']} videoDownloadUrlList - 视频下载地址列表
 */

/** @type {import('../../utils/Render.js').ImageData[]} */
let img

export class Bilibili extends Base {
  /** @type {*} */
  type
  /** @type {*} */
  STATUS
  /** @type {boolean} */
  isVIP
  /**
   * b站数据类型
   * @type {import('./getid.js').BilibiliDataTypes[keyof import('./getid.js').BilibiliDataTypes]}
   */
  Type
  /** @type {boolean} */
  islogin
  /** @type {string} */
  downloadfilename
  /** @type {string} */
  get botadapter() {
    return this.e.bot?.adapter?.name
  }
  /**
   * @param {*} e
   * @param {*} data
   */
  constructor(e, data) {
    super(e)
    this.e = e
    this.isVIP = false
    this.Type = data?.type
    this.islogin = data?.USER?.STATUS === 'isLogin'
    this.downloadfilename = ''
    this.headers = this.headers || {};
    // 使用可选链和空值合并运算符
    this.headers.Referer ||= 'https://www.bilibili.com/'
    this.headers.Cookie ||= Config.cookies.bilibili || ''
  }

  /**
   * 处理B站资源的异步方法
   * @param {import('./getid.js').BilibiliId} iddata - 包含资源ID和相关数据的对象
   * @returns {Promise<boolean | void>}
   */
  async RESOURCES(iddata) {
    if (this.Type === 'undefined') return true
    !iddata?.Episode && (Config.bilibili?.bilibiliTip || []).includes('提示信息') && await this.e.reply('检测到B站链接，开始解析')
    switch (this.Type) {
      case 'one_video': {
        const infoData = await this.amagi.getBilibiliData('单个视频作品数据', { bvid: iddata.bvid, typeMode: 'strict' })
        const playUrlData = await this.amagi.getBilibiliData('单个视频下载信息数据', {
          avid: infoData.data.data.aid,
          cid: iddata.p ? (infoData.data.data.pages[iddata.p - 1]?.cid || infoData.data.data.cid) : infoData.data.data.cid,
          typeMode: 'strict'
        })
        // const playUrl = bilibiliApiUrls.视频流信息({ avid: infoData.data.aid, cid: infoData.data.cid })
        this.islogin = (await checkCk()).Status === 'isLogin'

        const { owner, pic, title, stat, desc } = infoData.data.data
        const { name } = owner
        const { coin, like, share, view, favorite, danmaku } = stat

        this.downloadfilename = title.substring(0, 50).replace(/[\\/:*?"<>|\r\n\s]/g, ' ')

        const nockData = await new Networks({
          url: bilibiliApiUrls.视频流信息({
            avid: infoData.data.data.aid,
            cid: iddata.p ? (infoData.data.data.pages[iddata.p - 1]?.cid || infoData.data.data.cid) : infoData.data.data.cid
          }) + '&platform=html5',
          headers: {
            ...baseHeaders,
            Referer: 'https://www.bilibili.com/',
            Cookie: ''
          }
        }).getData()

        // 构建回复内容数组
        /**
         * @type {(string | import('../../utils/Render.js').ImageData)[]}
         */
        const replyContent = []

        // 如果配置项不存在，则不显示任何内容
        if ((Config.bilibili?.bilibiliTip || []).includes('简介') && (Config.bilibili?.displayContent || []).length > 0) {
          /**
           * @type {Object.<string, any>}
           */
          const contentMap = {
            cover: await segment.image(pic),
            title: `\n📺 标题: ${title}\n`,
            author: `\n👤 作者: ${name}\n`,
            stats: this.formatVideoStats(view, danmaku, like, coin, share, favorite),
            desc: `\n\n📝 简介: ${desc}`
          }

          // 重新排序
          const fixedOrder = ['cover', 'title', 'author', 'stats', 'desc']

          fixedOrder.forEach(item => {
            if ((Config.bilibili?.displayContent || []).includes(item) && contentMap[item]) {
              replyContent.push(contentMap[item])
            }
          })

          if (replyContent.length > 0) {
            await this.e.reply(this.mkMsg(replyContent, [
              {
                text: "视频链接",
                link: 'https://b23.tv/' + infoData.data.data.bvid
              }
            ]))
          }
        }

        let videoSize = ''
        /** @type {{ accept_description: string[], videoList: videoDownloadUrlList, selectedQuality: string }} */
        let correctList = { accept_description: [], videoList: [], selectedQuality: '未知' } // 提供默认值

        if (this.islogin && Config.bilibili.videopriority === false) {
          /** 过滤视频流信息对象，排除清晰度重复的视频流 */
          const simplify = playUrlData.data.data.dash.video.filter((/** @type {{ id: number }} */ item, /** @type {any} */ index, /** @type {any[]}[]} */ self) => {
            return self.findIndex((/** @type {{ id: any }} */ t) => {
              return t.id === item.id
            }) === index
          })
          /** 替换原始的视频信息对象 */
          playUrlData.data.data.dash.video = simplify
          /** 给视频信息对象删除不符合条件的视频流 */
          correctList = await bilibiliProcessVideos({
            accept_description: playUrlData.data.data.accept_description,
            bvid: infoData.data.data.bvid,
            qn: Config.bilibili.videoQuality
          }, simplify, playUrlData.data.data.dash.audio[0].base_url)
          playUrlData.data.data.dash.video = correctList.videoList
          playUrlData.data.data.accept_description = correctList.accept_description
          /** 获取第一个视频流的大小 */
          videoSize = await getvideosize(correctList.videoList[0]?.base_url || '', playUrlData.data.data.dash.audio[0].base_url, infoData.data.data.bvid)
        } else {
          videoSize = (nockData.data.data.durl[0].size / (1024 * 1024)).toFixed(2)
        }
        if ((Config.bilibili?.bilibiliTip || []).includes('评论图')) {
          const commentsData = await this.amagi.getBilibiliData('评论数据', {
            number: Config.bilibili.bilibilinumcomments,
            type: 1,
            oid: infoData.data.data.aid.toString(),
            typeMode: 'strict'
          })
          const commentsdata = bilibiliComments(commentsData.data)
          if (!commentsdata?.length) {
            await this.e.reply('这个视频没有评论 ~')
          } else {
            img = await Render('bilibili/comment', {
              Type: '视频',
              CommentsData: commentsdata,
              CommentLength: Config.bilibili.realCommentCount ? Common.count(infoData.data.data.stat.reply) : String(commentsdata.length),
              share_url: 'https://b23.tv/' + infoData.data.data.bvid,
              Clarity: Config.bilibili.videopriority === true ? nockData.data.data.accept_description[0] : correctList?.selectedQuality,
              VideoSize: Config.bilibili.videopriority === true ? (nockData.data.data.durl[0]?.size / (1024 * 1024) || 0).toFixed(2) : videoSize,
              ImageLength: 0,
              shareurl: 'https://b23.tv/' + infoData.data.data.bvid
            })
            await this.e.reply(this.mkMsg(img, [
              {
                text: "视频链接",
                link: 'https://b23.tv/' + infoData.data.data.bvid
              }
            ]))
          }
        }

        if ((Config.upload.usefilelimit && Number(videoSize) > Number(Config.upload.filelimit)) && (Config.bilibili?.bilibiliTip || []).includes('视频')) {
          await this.e.reply(`设定的最大上传大小为 ${Config.upload.filelimit}MB\n当前解析到的视频大小为 ${Number(videoSize)}MB\n` + '视频太大了，还是去B站看吧~', { reply: true })
        } else {
          await this.getvideo(
            Config.bilibili.videopriority === true
              ? { playUrlData: nockData.data }
              : {
                infoData: infoData.data, playUrlData: playUrlData.data
              })
        }
        break
      }
      case 'bangumi_video_info': {
        const videoInfo = await this.amagi.getBilibiliData('番剧基本信息数据', { [iddata.isEpid ? 'ep_id' : 'season_id']: iddata.realid, typeMode: 'strict' })
        this.islogin = (await checkCk()).Status === 'isLogin'
        this.isVIP = (await checkCk()).isVIP

        const barray = []
        const msg = []

        if (!videoInfo.data) {
          logger.warn(videoInfo.message, `错误码: ${videoInfo.code}`)
          return true
        }
        for (let i = 0; i < videoInfo.data.result.episodes.length; i++) {
          const totalEpisodes = videoInfo.data.result.episodes.length
          /** @type {string} */
          const long_title = videoInfo.data.result.episodes[i]?.long_title || ''
          /** @type {string} */
          const badge = videoInfo.data.result.episodes[i]?.badge || ''
          /** @type {string} */
          const short_link = videoInfo.data.result.episodes[i]?.short_link || ''
          barray.push({
            id: i + 1,
            totalEpisodes,
            long_title,
            badge: badge === '' ? '暂无' : badge,
            short_link
          })
          msg.push([
            `\n> ## 第${i + 1}集`,
            `\n> 标题: ${long_title}`,
            `\n> 类型: ${badge !== '预告' ? '正片' : '预告'}`,
            `\n> 🔒 播放要求: ${badge === '预告' || badge === '' ? '暂无' : badge}`,
            this.botadapter !== 'QQBot' ? `\n> 🔗 分享链接: [🔗点击查看](${short_link})\r\r` : ''
          ])
        }
        img = await Render('bilibili/bangumi', {
          saveId: 'bangumi',
          bangumiData: barray,
          title: videoInfo.data.result.title
        })
        await this.e.reply(
          this.mkMsg(this.botadapter === 'QQBot' ? `# ${videoInfo.data.result.season_title}\n---\n${msg}\r\r---\n请在60秒内输入 第?集 选择集数` : img, [
            { text: '第1集', callback: '第1集' },
            { text: '第2集', callback: '第2集' },
            { text: '第?集', input: '第' }
          ])
        )
        let Episode
        if (iddata?.Episode) {
          Episode = iddata.Episode
          // 检查是否为中文数字，如果是则转换为阿拉伯数字
          if (/^[一二三四五六七八九十百千万]+$/.test(Episode)) {
            Episode = Common.chineseToArabic(Episode).toString()
          }
          this.downloadfilename = videoInfo.data.result.episodes[Number(Episode) - 1]?.share_copy?.substring(0, 50).replace(/[\\/:*?"<>|\r\n\s]/g, ' ') || ''
          this.e.reply(`收到请求，第${Episode}集\n${this.downloadfilename}\n正在下载中`)
        } else {
          logger.debug(Episode)
          this.e.reply('匹配内容失败，请重新发送链接再次解析')
          return true
        }
        const bangumidataBASEURL = bilibiliApiUrls.番剧视频流信息({
          cid: videoInfo.data.result.episodes[Number(Episode) - 1]?.cid || 0,
          ep_id: videoInfo.data.result.episodes[Number(Episode) - 1]?.ep_id.toString() || ''
        })
        const Params = await genParams(bangumidataBASEURL)
        if (!this.islogin) await this.e.reply('B站ck未配置或已失效，无法获取视频流，可尝试【#B站登录】以配置新ck')
        const playUrlData = await new Networks({
          url: bangumidataBASEURL + Params,
          headers: this.headers
        }).getData()
        if (videoInfo.data.result.episodes[Number(Episode) - 1]?.badge === '会员' && !this.isVIP) {
          logger.warn('该CK不是大会员，无法获取视频流')
          return true
        }
        if (Config.bilibili.videoQuality === 0) {
          /** 提取出视频流信息对象，并排除清晰度重复的视频流 */
          const simplify = playUrlData.result.dash.video.filter((/** @type {{ id: number }} */ item, /** @type {any} */ index, /** @type {any[]} */ self) => {
            return self.findIndex((t) => {
              return t.id === item.id
            }) === index
          })
          /** 替换原始的视频信息对象 */
          playUrlData.result.dash.video = simplify
          /** 给视频信息对象删除不符合条件的视频流 */
          const correctList = await bilibiliProcessVideos({
            accept_description: playUrlData.result.accept_description,
            bvid: videoInfo.data.result.season_id.toString(),
            qn: Config.bilibili.videoQuality
          }, simplify, playUrlData.result.dash.audio[0].base_url)
          playUrlData.result.dash.video = correctList.videoList
          playUrlData.result.cept_description = correctList.accept_description
          await this.getvideo({
            infoData: videoInfo.data,
            playUrlData
          })
        } else {
          await this.getvideo({
            infoData: videoInfo.data,
            playUrlData
          })
        }
        break
      }
      case 'dynamic_info': {
        if (!(Config.bilibili?.bilibiliTip || []).includes('动态')) break
        const dynamicInfo = await this.amagi.getBilibiliData('动态详情数据', { dynamic_id: iddata.dynamic_id, typeMode: 'strict' })
        const dynamicInfoCard = await this.amagi.getBilibiliData('动态卡片数据', { dynamic_id: dynamicInfo.data.data.item.id_str, typeMode: 'strict' })
        const commentsData = dynamicInfo.data.data.item.type !== DynamicType.LIVE_RCMD && Config.bilibili.bilibilinumcomments && Config.bilibili?.bilibilinumcomments > 0 && await this.amagi.getBilibiliData('评论数据', {
          type: mapping_table(dynamicInfo.data.data.item.type),
          oid: oid(dynamicInfo.data, dynamicInfoCard.data),
          number: Config.bilibili.bilibilinumcomments,
          typeMode: 'strict'
        })
        const dynamicCARD = JSON.parse(dynamicInfoCard.data.data.card.card)
        const userProfileData = await this.amagi.getBilibiliData('用户主页数据', { host_mid: dynamicInfo.data.data.item.modules.module_author.mid, typeMode: 'strict' })

        switch (dynamicInfo.data.data.item.type) {
          /** 图文、纯图 */
          case DynamicType.DRAW: {
            const imgArray = []
            for (const img of dynamicInfo.data.data.item.modules.module_dynamic.major.opus.pics) {
              img?.url && imgArray.push(segment.image(img.url))
            }

            if (imgArray.length === 1) await this.e.reply(imgArray[0])
            if (imgArray.length > 1) await this.e.reply(['QQBot', 'KOOKBot'].includes(this.botadapter) ? imgArray : await common.makeForwardMsg(this.e, imgArray, '动态图片'))

            if ((Config.bilibili?.bilibiliTip || []).includes('评论图') && commentsData) {
              const commentsdata = bilibiliComments(commentsData.data)
              img = await Render('bilibili/comment', {
                Type: '动态',
                CommentsData: commentsdata,
                CommentLength: String(commentsdata?.length || 0),
                share_url: 'https://t.bilibili.com/' + dynamicInfo.data.data.item.id_str,
                ImageLength: dynamicInfo.data.data.item.modules?.module_dynamic?.major?.draw?.items?.length || '动态中没有附带图片',
                shareurl: '动态分享链接'
              })
              await this.e.reply(img)
            }

            const dynamicCARD = JSON.parse(dynamicInfoCard.data.data.card.card)

            if ('topic' in dynamicInfo.data.data.item.modules.module_dynamic && dynamicInfo.data.data.item.modules.module_dynamic.topic !== null) {
              const name = dynamicInfo.data.data.item.modules.module_dynamic.topic?.name
              dynamicInfo.data.data.item.modules.module_dynamic.major.opus.summary.rich_text_nodes.unshift({
                orig_text: name,
                jump_url: '',
                text: name,
                type: 'topic'
              })
              const summary = dynamicInfo.data.data.item.modules.module_dynamic.major.opus.summary
              if (summary) {
                summary.text = `${name}\n\n` + (summary.text || '')
              }
            }

            await this.e.reply(await Render('bilibili/dynamic/DYNAMIC_TYPE_DRAW', {
              image_url: cover(dynamicCARD.item.pictures),
              // TIP: 2025/08/20, 动态卡片数据中，图文动态的描述文本在 major.opus.summary 中
              text: dynamicInfo.data.data.item.modules.module_dynamic.major
                ? replacetext(
                  br(dynamicInfo.data.data.item.modules.module_dynamic.major.opus?.summary?.text || ''),
                  dynamicInfo.data.data.item.modules.module_dynamic.major.opus?.summary?.rich_text_nodes || []
                )
                : '',
              dianzan: Common.count(dynamicInfo.data.data.item.modules.module_stat.like.count),
              pinglun: Common.count(dynamicInfo.data.data.item.modules.module_stat.comment.count),
              share: Common.count(dynamicInfo.data.data.item.modules.module_stat.forward.count),
              create_time: dynamicInfo.data.data.item.modules.module_author.pub_time,
              avatar_url: dynamicInfo.data.data.item.modules.module_author.face,
              frame: dynamicInfo.data.data.item.modules.module_author.pendant.image,
              share_url: 'https://t.bilibili.com/' + dynamicInfo.data.data.item.id_str,
              username: checkvip(userProfileData.data.data.card),
              fans: Common.count(userProfileData.data.data.follower),
              user_shortid: dynamicInfo.data.data.item.modules.module_author.mid,
              total_favorited: Common.count(userProfileData.data.data.like_num),
              following_count: Common.count(userProfileData.data.data.card.attention),
              decoration_card: generateDecorationCard(dynamicInfo.data.data.item.modules.module_author.decoration_card),
              render_time: Common.getCurrentTime(),
              dynamicTYPE: '图文动态'
            }))
            break
          }
          /** 纯文 */
          case DynamicType.WORD: {
            const summary = dynamicInfo.data.data.item.modules.module_dynamic.major.opus.summary
            const text = replacetext(br(summary?.text || ''), summary?.rich_text_nodes || [])

            if (dynamicInfo.data.data.item.modules.module_dynamic.additional) {
              switch (dynamicInfo.data.data.item.modules.module_dynamic.additional.type) {
                // TODO: 动态中的额外卡片元素，
                // see: https://github.com/SocialSisterYi/bilibili-API-collect/blob/afc4349247ff7d59ac16dfe6eec8ff2b766a74f0/docs/dynamic/all.md
                // find: data.items[n].modules.module_dynamic.additional
                case AdditionalType.RESERVE: {
                  break
                }
                case AdditionalType.COMMON:
                case AdditionalType.GOODS:
                case AdditionalType.VOTE:
                case AdditionalType.UGC:
                case AdditionalType.MATCH:
                case AdditionalType.UPOWER_LOTTERY:
                default: {
                  break
                }
              }
            }

            await this.e.reply(
              await Render('bilibili/dynamic/DYNAMIC_TYPE_WORD', {
                text,
                dianzan: Common.count(dynamicInfo.data.data.item.modules.module_stat.like.count),
                pinglun: Common.count(dynamicInfo.data.data.item.modules.module_stat.comment.count),
                share: Common.count(dynamicInfo.data.data.item.modules.module_stat.forward.count),
                create_time: dynamicInfo.data.data.item.modules.module_author.pub_time,
                avatar_url: dynamicInfo.data.data.item.modules.module_author.face,
                frame: dynamicInfo.data.data.item.modules.module_author.pendant.image,
                share_url: 'https://t.bilibili.com/' + dynamicInfo.data.data.item.id_str,
                username: checkvip(dynamicInfo.data.data.card || userProfileData.data.data.card),
                fans: Common.count(dynamicInfo.data.data.follower),
                user_shortid: dynamicInfo.data.data.item.modules.module_author.mid,
                total_favorited: Common.count(userProfileData.data.data.like_num),
                following_count: Common.count(userProfileData.data.data.card.attention),
                dynamicTYPE: '纯文动态'
              })
            )
            Config.bilibili.bilibilinumcomments && commentsData && await this.e.reply(
              await Render('bilibili/comment', {
                Type: '动态',
                CommentsData: bilibiliComments(commentsData.data),
                CommentLength: String((bilibiliComments(commentsData.data)?.length) ? bilibiliComments(commentsData.data)?.length : 0),
                share_url: 'https://t.bilibili.com/' + dynamicInfo.data.data.item.id_str,
                ImageLength: dynamicInfo.data.data.item.modules?.module_dynamic?.major?.draw?.items?.length || '动态中没有附带图片',
                shareurl: '动态分享链接'
              })
            )
            break
          }
          /** 转发动态 */
          case DynamicType.FORWARD: {
            const text = replacetext(
              br(dynamicInfo.data.data.item.modules.module_dynamic.desc.text),
              dynamicInfo.data.data.item.modules.module_dynamic.desc.rich_text_nodes
            )
            let data = {}
            switch (dynamicInfo.data.data.item.orig.type) {
              case DynamicType.AV: {
                data = {
                  username: checkvip(dynamicInfo.data.data.item.orig.modules.module_author),
                  pub_action: dynamicInfo.data.data.item.orig.modules.module_author.pub_action,
                  avatar_url: dynamicInfo.data.data.item.orig.modules.module_author.face,
                  duration_text: dynamicInfo.data.data.item.orig.modules.module_dynamic.major.archive.duration_text,
                  title: dynamicInfo.data.data.item.orig.modules.module_dynamic.major.archive.title,
                  danmaku: dynamicInfo.data.data.item.orig.modules.module_dynamic.major.archive.stat.danmaku,
                  view: dynamicInfo.data.data.item.orig.modules.module_dynamic.major.archive.stat.view,
                  play: dynamicInfo.data.data.item.orig.modules.module_dynamic.major.archive.stat.play,
                  cover: dynamicInfo.data.data.item.orig.modules.module_dynamic.major.archive.cover,
                  create_time: Common.convertTimestampToDateTime(dynamicInfo.data.data.item.orig.modules.module_author.pub_ts),
                  decoration_card: generateDecorationCard(dynamicInfo.data.data.item.orig.modules.module_author.decoration_card),
                  frame: dynamicInfo.data.data.item.orig.modules.module_author.pendant.image
                }
                break
              }
              case DynamicType.DRAW: {
                const dynamicCARD2 = await this.amagi.getBilibiliData('动态卡片数据', { dynamic_id: dynamicInfo.data.data.item.orig.id_str, typeMode: 'strict' })
                const cardData = JSON.parse(dynamicCARD2.data.data.card.card)
                const summary = dynamicInfo.data.data.item.orig.modules.module_dynamic.major.opus.summary
                data = {
                  username: checkvip(dynamicInfo.data.data.item.orig.modules.module_author),
                  create_time: Common.convertTimestampToDateTime(dynamicInfo.data.data.item.orig.modules.module_author.pub_ts),
                  avatar_url: dynamicInfo.data.data.item.orig.modules.module_author.face,
                  text: replacetext(br(summary?.text || ''), summary?.rich_text_nodes || []),
                  image_url: cardData.item.pictures ? cover(cardData.item.pictures) : [],
                  decoration_card: generateDecorationCard(dynamicInfo.data.data.item.orig.modules.module_author.decoration_card),
                  frame: dynamicInfo.data.data.item.orig.modules.module_author.pendant.image
                }
                break
              }
              case DynamicType.WORD: {
                const summary = dynamicInfo.data.data.item.orig.modules.module_dynamic.major.opus.summary
                data = {
                  username: checkvip(dynamicInfo.data.data.item.orig.modules.module_author),
                  create_time: Common.convertTimestampToDateTime(dynamicInfo.data.data.item.orig.modules.module_author.pub_ts),
                  avatar_url: dynamicInfo.data.data.item.orig.modules.module_author.face,
                  text: replacetext(br(summary?.text || ''), summary?.rich_text_nodes || []),
                  decoration_card: generateDecorationCard(dynamicInfo.data.data.item.orig.modules.module_author.decoration_card),
                  frame: dynamicInfo.data.data.item.orig.modules.module_author.pendant.image
                }
                break
              }
              case DynamicType.LIVE_RCMD: {
                const liveData = JSON.parse(dynamicInfo.data.data.item.orig.modules.module_dynamic.major.live_rcmd.content)
                data = {
                  username: checkvip(dynamicInfo.data.data.item.orig.modules.module_author),
                  create_time: Common.convertTimestampToDateTime(dynamicInfo.data.data.item.orig.modules.module_author.pub_ts),
                  avatar_url: dynamicInfo.data.data.item.orig.modules.module_author.face,
                  decoration_card: generateDecorationCard(dynamicInfo.data.data.item.orig.modules.module_author.decoration_card),
                  frame: dynamicInfo.data.data.item.orig.modules.module_author.pendant.image,
                  cover: liveData.live_play_info.cover,
                  text_large: liveData.live_play_info.watched_show.text_large,
                  area_name: liveData.live_play_info.area_name,
                  title: liveData.live_play_info.title,
                  online: liveData.live_play_info.online
                }
                break
              }
              case DynamicType.FORWARD:
              default: {
                logger.warn(`UP主：${userProfileData.data.data.card.name}的${logger.green('转发动态')}转发的原动态类型为「${logger.yellow(dynamicInfo.data.item.orig.type)}」暂未支持解析`)
                break
              }
            }
            await this.e.reply(
              await Render('bilibili/dynamic/DYNAMIC_TYPE_FORWARD', {
                text,
                dianzan: Common.count(dynamicInfo.data.data.item.modules.module_stat.like.count),
                pinglun: Common.count(dynamicInfo.data.data.item.modules.module_stat.comment.count),
                share: Common.count(dynamicInfo.data.data.item.modules.module_stat.forward.count),
                create_time: dynamicInfo.data.data.item.modules.module_author.pub_time,
                avatar_url: dynamicInfo.data.data.item.modules.module_author.face,
                frame: dynamicInfo.data.data.item.modules.module_author.pendant.image,
                share_url: 'https://t.bilibili.com/' + dynamicInfo.data.data.item.id_str,
                username: checkvip(userProfileData.data.data.card),
                fans: Common.count(userProfileData.data.data.follower),
                user_shortid: dynamicInfo.data.data.item.modules.module_author.mid,
                total_favorited: Common.count(userProfileData.data.data.like_num),
                following_count: Common.count(userProfileData.data.data.card.attention),
                dynamicTYPE: '转发动态解析',
                decoration_card: generateDecorationCard(dynamicInfo.data.data.item.modules.module_author.decorate),
                render_time: Common.getCurrentTime(),
                original_content: { [dynamicInfo.data.data.item.orig.type]: data }
              })
            )
            break
          }
          /** 视频动态 */
          case DynamicType.AV: {
            if (dynamicInfo.data.data.item.modules.module_dynamic.major.type === 'MAJOR_TYPE_ARCHIVE') {
              const bvid = dynamicInfo.data.data.item.modules.module_dynamic.major.archive.bvid
              const INFODATA = await getBilibiliData('单个视频作品数据', '', { bvid, typeMode: 'strict' })
              const dycrad = dynamicInfoCard.data.data.card && dynamicInfoCard.data.data.card.card && JSON.parse(dynamicInfoCard.data.data.card.card)

              Config.bilibili.bilibilinumcomments && commentsData && await this.e.reply(
                await Render('bilibili/comment', {
                  Type: '动态',
                  CommentsData: bilibiliComments(commentsData.data),
                  CommentLength: String((bilibiliComments(commentsData.data)?.length || 0)),
                  share_url: 'https://www.bilibili.com/video/' + bvid,
                  ImageLength: dynamicInfo.data.data.item.modules?.module_dynamic?.major?.draw?.items?.length || '动态中没有附带图片',
                  shareurl: '动态分享链接'
                })
              )

              img = await Render('bilibili/dynamic/DYNAMIC_TYPE_AV',
                {
                  image_url: [{ image_src: INFODATA.data.data.pic }],
                  text: br(INFODATA.data.data.title),
                  desc: br(dycrad.desc),
                  dianzan: Common.count(INFODATA.data.data.stat.like),
                  pinglun: Common.count(INFODATA.data.data.stat.reply),
                  share: Common.count(INFODATA.data.data.stat.share),
                  view: Common.count(dycrad.stat.view),
                  coin: Common.count(dycrad.stat.coin),
                  duration_text: dynamicInfo.data.data.item.modules.module_dynamic.major.archive.duration_text,
                  create_time: Common.convertTimestampToDateTime(INFODATA.data.data.ctime),
                  avatar_url: INFODATA.data.data.owner.face,
                  frame: dynamicInfo.data.data.item.modules.module_author.pendant.image,
                  share_url: 'https://www.bilibili.com/video/' + bvid,
                  username: checkvip(userProfileData.data.data.card),
                  fans: Common.count(userProfileData.data.data.follower),
                  user_shortid: userProfileData.data.data.card.mid,
                  total_favorited: Common.count(userProfileData.data.data.like_num),
                  following_count: Common.count(userProfileData.data.data.card.attention),
                  dynamicTYPE: '视频动态'
                }
              )
              await this.e.reply(img)
            }
            break
          }
          /** 直播动态 */
          case DynamicType.LIVE_RCMD: {
            const userINFO = await getBilibiliData('用户主页数据', '', { host_mid: dynamicInfo.data.data.item.modules.module_author.mid, typeMode: 'strict' })
            img = await Render('bilibili/dynamic/DYNAMIC_TYPE_LIVE_RCMD',
              {
                image_url: [{ image_src: dynamicCARD.live_play_info.cover }],
                text: br(dynamicCARD.live_play_info.title),
                liveinf: br(`${dynamicCARD.live_play_info.area_name} | 房间号: ${dynamicCARD.live_play_info.room_id}`),
                username: checkvip(userINFO.data.data.card),
                avatar_url: userINFO.data.card.face,
                frame: dynamicInfo.data.data.item.modules.module_author.pendant.image,
                fans: Common.count(userINFO.data.data.follower),
                create_time: Common.convertTimestampToDateTime(dynamicInfo.data.data.item.modules.module_author.pub_ts),
                now_time: Common.getCurrentTime(),
                share_url: 'https://live.bilibili.com/' + dynamicCARD.live_play_info.room_id,
                dynamicTYPE: '直播动态'
              }
            )
            await this.e.reply(img)
            break
          }
          default: {
            /** @type {any} */
            const unknownItem = dynamicInfo.data.data.item
            this.e.reply(`该动态类型「${unknownItem.type}」暂未支持解析`)
            break
          }
        }
        break
      }
      case 'live_room_detail': {
        const liveInfo = await this.amagi.getBilibiliData('直播间信息', { room_id: iddata.room_id, typeMode: 'strict' })
        const roomInitInfo = await this.amagi.getBilibiliData('直播间初始化信息', { room_id: iddata.room_id, typeMode: 'strict' })
        const userProfileData = await this.amagi.getBilibiliData('用户主页数据', { host_mid: roomInitInfo.data.data.uid, typeMode: 'strict' })

        if (roomInitInfo.data.data.live_status === 0) {
          await this.e.reply(`「${userProfileData.data.data.card.name}」\n未开播，正在休息中~`)
          return true
        }
        const img = await Render('bilibili/dynamic/DYNAMIC_TYPE_LIVE_RCMD',
          {
            image_url: [{ image_src: liveInfo.data.data.user_cover }],
            text: br(liveInfo.data.data.title),
            liveinf: br(`${liveInfo.data.data.area_name} | 房间号: ${liveInfo.data.data.room_id}`),
            username: userProfileData.data.data.card.name,
            avatar_url: userProfileData.data.data.card.face,
            frame: userProfileData.data.data.card.pendant.image,
            fans: Common.count(userProfileData.data.data.card.fans),
            create_time: liveInfo.data.data.live_time === '-62170012800' ? '获取失败' : liveInfo.data.data.live_time,
            now_time: Common.getCurrentTime(),
            share_url: 'https://live.bilibili.com/' + liveInfo.data.data.room_id,
            dynamicTYPE: '直播'
          }
        )
        await this.e.reply(img)
        break
      }
      default:
        return true
    }
  }

  /**
   * 获取视频并处理的方法
   * @param {Object} videoData - 视频数据对象
   * @param {import('@ikenxuan/amagi').BiliBangumiVideoInfo | import('@ikenxuan/amagi').BiliOneWork} [videoData.infoData] - 视频信息数据
   * @param {import('@ikenxuan/amagi').BiliVideoPlayurlIsLogin | import('@ikenxuan/amagi').BiliBiliVideoPlayurlNoLogin | import('@ikenxuan/amagi').BiliBangumiVideoPlayurlIsLogin | import('@ikenxuan/amagi').BiliBangumiVideoPlayurlNoLogin} [videoData.playUrlData] - 播放URL数据
   * @returns {Promise<void>}
   */
  async getvideo({ infoData, playUrlData }) {
    /** 获取视频 => FFMPEG合成 */
    // 如果配置了视频优先，则设置为未登录状态
    if (Config.bilibili.videopriority === true) this.islogin = false

    // 如果已登录
    if (this.islogin) {
      // 获取视频和音频的基础URL和ID
      const isOneVideo = this.Type === 'one_video'
      const videoId = isOneVideo ? infoData && infoData.data.bvid : infoData && infoData.result.season_id
      const seasonId = isOneVideo ? infoData && infoData.data.bvid : infoData && infoData.result.season_id
      const videoUrl = isOneVideo && playUrlData && playUrlData.data?.dash?.video[0]?.base_url ? playUrlData.data.dash.video[0].base_url : playUrlData?.result?.dash.video[0]?.base_url
      const audioUrl = isOneVideo && playUrlData && playUrlData.data?.dash?.audio[0]?.base_url ? playUrlData.data.dash.audio[0].base_url : playUrlData?.result?.dash.audio[0]?.base_url

      // 并行下载视频和音频
      const [bmp4, bmp3] = await Promise.all([
        downloadFile(videoUrl, {
          title: `Bil_V_${videoId}.mp4`,
          headers: {
            Referer: this.headers.Referer,
            Cookie: this.headers.Cookie
          }
        }),
        downloadFile(audioUrl, {
          title: `Bil_A_${videoId}.mp3`,
          headers: {
            Referer: this.headers.Referer,
            Cookie: this.headers.Cookie
          }
        })
      ])

      if (bmp4.filepath && bmp3.filepath) {
        await mergeFile('二合一（视频 + 音频）', {
          path: bmp4.filepath,
          path2: bmp3.filepath,
          resultPath: Common.tempDri.video + `Bil_Result_${seasonId}.mp4`,
          callback: async (/** @type {boolean} */ success, /** @type {string} */ resultPath) => {
            if (!success) {
              await Common.removeFile(bmp4.filepath, true)
              await Common.removeFile(bmp3.filepath, true)
              return true
            }

            const filePath = Common.tempDri.video + `${Config.app.removeCache ? 'tmp_' + Date.now() : this.downloadfilename}.mp4`
            fs.renameSync(resultPath, filePath)
            logger.mark(`视频文件重命名完成: ${resultPath.split('/').pop()} -> ${filePath.split('/').pop()}`)
            logger.mark('正在尝试删除缓存文件')
            await Common.removeFile(bmp4.filepath, true)
            await Common.removeFile(bmp3.filepath, true)

            const stats = fs.statSync(filePath)
            const fileSizeInMB = Number((stats.size / (1024 * 1024)).toFixed(2))

            // 根据文件大小选择上传方式
            return fileSizeInMB > (Config.upload?.filelimit || 100)
              ? await uploadFile(this.e, { filepath: filePath, totalBytes: fileSizeInMB, originTitle: this.downloadfilename }, '', { useGroupFile: true })
              : await uploadFile(this.e, { filepath: filePath, totalBytes: fileSizeInMB, originTitle: this.downloadfilename }, '')
          }
        })
      }
    } else {
      /** 没登录（没配置ck）情况下直接发直链，传直链在DownLoadVideo()处理 */
      const hasValidUrl = playUrlData?.data?.durl?.length > 0
      if (hasValidUrl) {
        await downloadVideo(this.e, { video_url: playUrlData?.data.durl[0].url, title: { timestampTitle: `tmp_${Date.now()}.mp4`, originTitle: `${this.downloadfilename}.mp4` } })
      } else {
        logger.error("无法下载视频,请配置CooKie后重试")
      }
    }
  }

  /**
   * 格式化视频统计信息为三行，每行两个数据项，并保持对齐
   * @param {number} view - 播放量
   * @param {number} danmaku - 弹幕数
   * @param {number} like - 点赞数
   * @param {number} coin - 投币数
   * @param {number} share - 转发数
   * @param {number} favorite - 收藏数
   * @returns {string} 格式化后的统计信息字符串
   */
  formatVideoStats(view, danmaku, like, coin, share, favorite) {
    // 计算每个数据项的文本
    const viewText = `📊 播放量: ${Common.count(view)}`
    const danmakuText = `💬 弹幕: ${Common.count(danmaku)}`
    const likeText = `👍 点赞: ${Common.count(like)}`
    const coinText = `🪙 投币: ${Common.count(coin)}`
    const shareText = `🔄 转发: ${Common.count(share)}`
    const favoriteText = `⭐ 收藏: ${Common.count(favorite)}`

    // 找出第一列中最长的项的长度
    const firstColItems = [viewText, likeText, shareText]
    const maxFirstColLength = Math.max(...firstColItems.map(item => this.getStringDisplayWidth(item)))

    // 构建三行文本，确保第二列对齐
    const line1 = this.alignTwoColumns(viewText, danmakuText, maxFirstColLength)
    const line2 = this.alignTwoColumns(likeText, coinText, maxFirstColLength)
    const line3 = this.alignTwoColumns(shareText, favoriteText, maxFirstColLength)

    return `${line1}\n${line2}\n${line3}`
  }

  /**
   * 对齐两列文本
   * @param {string} col1 - 第一列文本
   * @param {string} col2 - 第二列文本
   * @param {number} targetLength - 目标长度
   * @returns {string} 对齐后的文本
   */
  alignTwoColumns(col1, col2, targetLength) {
    // 计算需要添加的空格数量
    const col1Width = this.getStringDisplayWidth(col1)
    const spacesNeeded = targetLength - col1Width + 5 // 5是两列之间的固定间距

    // 添加空格使两列对齐
    return col1 + ' '.repeat(spacesNeeded) + col2
  }

  /**
   * 获取字符串在显示时的实际宽度
   * 考虑到不同字符的显示宽度不同（如中文、emoji等）
   * @param {string} str - 要计算宽度的字符串
   * @returns {number} 字符串的显示宽度
   */
  getStringDisplayWidth(str) {
    let width = 0
    for (let i = 0; i < str.length; i++) {
      const code = str.codePointAt(i)
      if (!code) continue

      // 处理emoji和特殊Unicode字符
      if (code > 0xFFFF) {
        width += 2 // emoji通常占用2个字符宽度
        i++ // 跳过代理对的后半部分
      } else if ( // 处理中文字符和其他全角字符
        (code >= 0x3000 && code <= 0x9FFF) || // 中文字符范围
        (code >= 0xFF00 && code <= 0xFFEF) || // 全角ASCII、全角标点
        code === 0x2026 || // 省略号
        code === 0x2014 || // 破折号
        (code >= 0x2E80 && code <= 0x2EFF) || // CJK部首补充
        (code >= 0x3000 && code <= 0x303F) || // CJK符号和标点
        (code >= 0x31C0 && code <= 0x31EF) || // CJK笔画
        (code >= 0x3200 && code <= 0x32FF) || // 封闭式CJK字母和月份
        (code >= 0x3300 && code <= 0x33FF) || // CJK兼容
        (code >= 0xAC00 && code <= 0xD7AF) || // 朝鲜文音节
        (code >= 0xF900 && code <= 0xFAFF) || // CJK兼容表意文字
        (code >= 0xFE30 && code <= 0xFE4F)    // CJK兼容形式
      ) {
        width += 2
      } else if (code === 0x200D || (code >= 0xFE00 && code <= 0xFE0F) || (code >= 0x1F3FB && code <= 0x1F3FF)) { // emoji修饰符和连接符
        width += 0 // 这些字符不增加宽度，它们是修饰符
      } else { // 普通ASCII字符
        width += 1
      }
    }
    return width
  }

}

/**
 * 替换文本中的特殊标记为对应的HTML元素
 * @param {string} text - 原始文本内容
 * @param {any[]} rich_text_nodes - 富文本节点数组
 * @returns {string} - 替换后的文本内容
 */
export function replacetext(text, rich_text_nodes) {
  for (const tag of rich_text_nodes) {
    // 对正则表达式中的特殊字符进行转义
    const escapedText = tag.orig_text.replace(/([.*+?^${}()|[\]\\])/g, '\\$1').replace(/\n/g, '\\n')
    const regex = new RegExp(escapedText, 'g')
    switch (tag.type) {
      case 'topic': {
        text = text.replace(regex, `<span style="color: ${Common.useDarkTheme() ? '#58B0D5' : '#006A9E'};"><svg style="width: 80px;height: 80px;margin: 0 -25px -25px 0;" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="opus-module-topic__icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.4302 2.57458C11.4416 2.51023 11.4439 2.43974 11.4218 2.3528C11.3281 1.98196 10.9517 1.72037 10.5284 1.7527C10.432 1.76018 10.3599 1.78383 10.297 1.81376C10.2347 1.84398 10.1832 1.88155 10.1401 1.92465C10.1195 1.94485 10.1017 1.96692 10.0839 1.98897L10.0808 1.99289L10.0237 2.06277L9.91103 2.2033C9.76177 2.39141 9.61593 2.58191 9.47513 2.77556C9.33433 2.96936 9.19744 3.16585 9.06672 3.36638C9.00275 3.46491 8.93968 3.56401 8.87883 3.66461L8.56966 3.6613C8.00282 3.6574 7.43605 3.65952 6.86935 3.67034C6.80747 3.56778 6.74325 3.46677 6.67818 3.3664C6.54732 3.16585 6.41045 2.96934 6.26968 2.77568C6.12891 2.58186 5.98309 2.39134 5.83387 2.20322L5.72122 2.06268L5.66416 1.99279L5.6622 1.99036C5.64401 1.96783 5.62586 1.94535 5.60483 1.92454C5.56192 1.88144 5.51022 1.84388 5.44797 1.81364C5.38522 1.78386 5.31305 1.76006 5.21665 1.75273C4.80555 1.72085 4.4203 1.97094 4.32341 2.35273C4.30147 2.43968 4.30358 2.51018 4.31512 2.57453C4.32715 2.63859 4.34975 2.69546 4.38112 2.74649C4.39567 2.77075 4.41283 2.79315 4.42999 2.81557C4.43104 2.81694 4.43209 2.81831 4.43314 2.81968L4.48759 2.89122L4.59781 3.03355C4.74589 3.22242 4.89739 3.40905 5.05377 3.59254C5.09243 3.63788 5.13136 3.68306 5.17057 3.72785C4.99083 3.73681 4.81112 3.7467 4.63143 3.75756C4.41278 3.771 4.19397 3.78537 3.97547 3.80206L3.64757 3.82786L3.48362 3.84177L3.39157 3.85181C3.36984 3.8543 3.34834 3.8577 3.32679 3.86111C3.31761 3.86257 3.30843 3.86402 3.29921 3.86541C3.05406 3.90681 2.81526 3.98901 2.59645 4.10752C2.37765 4.22603 2.17867 4.38039 2.00992 4.56302C1.84117 4.74565 1.70247 4.95593 1.60144 5.18337C1.50025 5.4105 1.43687 5.65447 1.41362 5.90153C1.33103 6.77513 1.27663 7.6515 1.25742 8.5302C1.23758 9.40951 1.25835 10.2891 1.3098 11.1655C1.32266 11.3846 1.33738 11.6035 1.35396 11.8223L1.38046 12.1505L1.39472 12.3144L1.39658 12.335L1.39906 12.3583L1.40417 12.4048C1.40671 12.4305 1.41072 12.4558 1.41473 12.4811C1.41561 12.4866 1.41648 12.4922 1.41734 12.4977C1.45717 12.7449 1.53806 12.9859 1.65567 13.2074C1.77314 13.4289 1.92779 13.6304 2.11049 13.8022C2.29319 13.974 2.50441 14.1159 2.73329 14.2197C2.96201 14.3235 3.2084 14.3901 3.45836 14.4135C3.47066 14.415 3.48114 14.4159 3.49135 14.4167C3.49477 14.417 3.49817 14.4173 3.50159 14.4176L3.5425 14.4212L3.62448 14.4283L3.78843 14.4417L4.11633 14.4674C4.33514 14.4831 4.55379 14.4983 4.7726 14.5111C6.52291 14.6145 8.27492 14.6346 10.0263 14.5706C10.4642 14.5547 10.9019 14.5332 11.3396 14.5062C11.5584 14.4923 11.7772 14.4776 11.9959 14.4604L12.3239 14.434L12.4881 14.4196L12.5813 14.4093C12.6035 14.4065 12.6255 14.403 12.6474 14.3995C12.6565 14.3981 12.6655 14.3966 12.6746 14.3952C12.9226 14.3527 13.1635 14.2691 13.3844 14.1486C13.6052 14.0284 13.8059 13.8716 13.9759 13.6868C14.1463 13.5022 14.2861 13.2892 14.3874 13.0593C14.4381 12.9444 14.4793 12.8253 14.5108 12.7037C14.519 12.6734 14.5257 12.6428 14.5322 12.612L14.5421 12.566L14.55 12.5196C14.5556 12.4887 14.5607 12.4578 14.5641 12.4266C14.5681 12.3959 14.5723 12.363 14.5746 12.3373C14.6642 11.4637 14.7237 10.5864 14.7435 9.70617C14.764 8.825 14.7347 7.94337 14.6719 7.06715C14.6561 6.8479 14.6385 6.62896 14.6183 6.41033L14.5867 6.08246L14.5697 5.91853L14.5655 5.87758C14.5641 5.86445 14.5618 5.8473 14.5599 5.83231C14.5588 5.8242 14.5578 5.81609 14.5567 5.80797C14.5538 5.78514 14.5509 5.76229 14.5466 5.7396C14.5064 5.49301 14.4252 5.25275 14.3067 5.03242C14.1886 4.81208 14.0343 4.61153 13.8519 4.44095C13.6695 4.27038 13.4589 4.12993 13.2311 4.02733C13.0033 3.92458 12.7583 3.85907 12.5099 3.83636C12.4974 3.83492 12.4865 3.83394 12.4759 3.833C12.4729 3.83273 12.4698 3.83246 12.4668 3.83219L12.4258 3.82879L12.3438 3.82199L12.1798 3.80886L11.8516 3.78413C11.633 3.76915 11.4143 3.75478 11.1955 3.74288C10.993 3.73147 10.7904 3.72134 10.5878 3.71243L10.6914 3.59236C10.8479 3.40903 10.9992 3.22242 11.1473 3.03341L11.2576 2.89124L11.312 2.81971C11.3136 2.81773 11.3151 2.81575 11.3166 2.81377C11.3333 2.79197 11.3501 2.77013 11.3641 2.74653C11.3954 2.6955 11.418 2.63863 11.4302 2.57458ZM9.33039 5.49268C9.38381 5.16945 9.67705 4.95281 9.98536 5.00882L9.98871 5.00944C10.2991 5.06783 10.5063 5.37802 10.4524 5.70377L10.2398 6.99039L11.3846 6.9904C11.7245 6.9904 12 7.27925 12 7.63557C12 7.99188 11.7245 8.28073 11.3846 8.28073L10.0266 8.28059L9.7707 9.82911L11.0154 9.82913C11.3553 9.82913 11.6308 10.118 11.6308 10.4743C11.6308 10.8306 11.3553 11.1195 11.0154 11.1195L9.55737 11.1195L9.32807 12.5073C9.27465 12.8306 8.98141 13.0472 8.6731 12.9912L8.66975 12.9906C8.35937 12.9322 8.1522 12.622 8.20604 12.2962L8.40041 11.1195H6.89891L6.66961 12.5073C6.61619 12.8306 6.32295 13.0472 6.01464 12.9912L6.01129 12.9906C5.7009 12.9322 5.49374 12.622 5.54758 12.2962L5.74196 11.1195L4.61538 11.1195C4.27552 11.1195 4 10.8306 4 10.4743C4 10.118 4.27552 9.82913 4.61538 9.82913L5.95514 9.82911L6.21103 8.28059L4.98462 8.28073C4.64475 8.28073 4.36923 7.99188 4.36923 7.63557C4.36923 7.27925 4.64475 6.9904 4.98462 6.9904L6.42421 6.99039L6.67193 5.49268C6.72535 5.16945 7.01859 4.95281 7.3269 5.00882L7.33025 5.00944C7.64063 5.06783 7.8478 5.37802 7.79396 5.70377L7.58132 6.99039H9.08281L9.33039 5.49268ZM8.61374 9.82911L8.86963 8.28059H7.36813L7.11225 9.82911H8.61374Z" fill="currentColor"></path></svg> ${tag.orig_text}</span>`)
        break
      }
      case 'RICH_TEXT_NODE_TYPE_TOPIC':
      case 'RICH_TEXT_NODE_TYPE_AT': {
        text = text.replace(regex, `<span style="color: ${Common.useDarkTheme() ? '#58B0D5' : '#006A9E'};">${tag.orig_text}</span>`)
        break
      }
      case 'RICH_TEXT_NODE_TYPE_LOTTERY': {
        text = text.replace(regex, `<span style="color: ${Common.useDarkTheme() ? '#58B0D5' : '#006A9E'};"><svg style="width: 65px;height: 65px;margin: 0 -15px -12px 0;" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 20 20" width="20" height="20"><path d="M3.7499750000000005 9.732083333333334C4.095158333333333 9.732083333333334 4.374975 10.011875000000002 4.374975 10.357083333333334L4.374975 15.357083333333334C4.374975 15.899458333333335 4.8147 16.339166666666667 5.357116666666667 16.339166666666667L14.642833333333334 16.339166666666667C15.185250000000002 16.339166666666667 15.625 15.899458333333335 15.625 15.357083333333334L15.625 10.357083333333334C15.625 10.011875000000002 15.904791666666668 9.732083333333334 16.25 9.732083333333334C16.595166666666668 9.732083333333334 16.875 10.011875000000002 16.875 10.357083333333334L16.875 15.357083333333334C16.875 16.589833333333335 15.875625000000001 17.589166666666667 14.642833333333334 17.589166666666667L5.357116666666667 17.589166666666667C4.124341666666667 17.589166666666667 3.124975 16.589833333333335 3.124975 15.357083333333334L3.124975 10.357083333333334C3.124975 10.011875000000002 3.4048 9.732083333333334 3.7499750000000005 9.732083333333334z" fill="currentColor"></path><path d="M2.4106916666666667 7.3214250000000005C2.4106916666666667 6.384516666666666 3.1702083333333335 5.625 4.107116666666667 5.625L15.892833333333334 5.625C16.82975 5.625 17.58925 6.384516666666666 17.58925 7.3214250000000005L17.58925 8.917583333333335C17.58925 9.74225 16.987583333333337 10.467208333333334 16.13125 10.554C15.073666666666668 10.661208333333335 13.087708333333333 10.803583333333334 10 10.803583333333334C6.912275 10.803583333333334 4.9263 10.661208333333335 3.8687250000000004 10.554C3.0123833333333336 10.467208333333334 2.4106916666666667 9.74225 2.4106916666666667 8.917583333333335L2.4106916666666667 7.3214250000000005zM4.107116666666667 6.875C3.8605666666666667 6.875 3.6606916666666667 7.0748750000000005 3.6606916666666667 7.3214250000000005L3.6606916666666667 8.917583333333335C3.6606916666666667 9.135250000000001 3.8040833333333333 9.291041666666667 3.9947583333333334 9.310375C5.0068 9.412958333333334 6.950525000000001 9.553583333333334 10 9.553583333333334C13.049458333333334 9.553583333333334 14.993166666666669 9.412958333333334 16.005166666666668 9.310375C16.195875 9.291041666666667 16.33925 9.135250000000001 16.33925 8.917583333333335L16.33925 7.3214250000000005C16.33925 7.0748750000000005 16.139375 6.875 15.892833333333334 6.875L4.107116666666667 6.875z" fill="currentColor"></path><path d="M5.446408333333333 4.464341666666667C5.446408333333333 3.1329416666666665 6.525716666666667 2.0536333333333334 7.857116666666667 2.0536333333333334C9.188541666666666 2.0536333333333334 10.267833333333334 3.1329416666666665 10.267833333333334 4.464341666666667L10.267833333333334 6.875058333333333L7.857116666666667 6.875058333333333C6.525716666666667 6.875058333333333 5.446408333333333 5.795741666666666 5.446408333333333 4.464341666666667zM7.857116666666667 3.3036333333333334C7.216075000000001 3.3036333333333334 6.696408333333334 3.8233 6.696408333333334 4.464341666666667C6.696408333333334 5.105391666666667 7.216075000000001 5.6250583333333335 7.857116666666667 5.6250583333333335L9.017833333333334 5.6250583333333335L9.017833333333334 4.464341666666667C9.017833333333334 3.8233 8.498166666666668 3.3036333333333334 7.857116666666667 3.3036333333333334z" fill="currentColor"></path><path d="M9.732083333333334 4.464341666666667C9.732083333333334 3.1329416666666665 10.811416666666666 2.0536333333333334 12.142833333333334 2.0536333333333334C13.474250000000001 2.0536333333333334 14.553583333333336 3.1329416666666665 14.553583333333336 4.464341666666667C14.553583333333336 5.795741666666666 13.474250000000001 6.875058333333333 12.142833333333334 6.875058333333333L9.732083333333334 6.875058333333333L9.732083333333334 4.464341666666667zM12.142833333333334 3.3036333333333334C11.501791666666666 3.3036333333333334 10.982083333333334 3.8233 10.982083333333334 4.464341666666667L10.982083333333334 5.6250583333333335L12.142833333333334 5.6250583333333335C12.783875 5.6250583333333335 13.303583333333334 5.105391666666667 13.303583333333334 4.464341666666667C13.303583333333334 3.8233 12.783875 3.3036333333333334 12.142833333333334 3.3036333333333334z" fill="currentColor"></path><path d="M10 4.732058333333334C10.345166666666666 4.732058333333334 10.625 5.011875 10.625 5.357058333333334L10.625 16.428500000000003C10.625 16.773666666666667 10.345166666666666 17.053500000000003 10 17.053500000000003C9.654791666666668 17.053500000000003 9.375 16.773666666666667 9.375 16.428500000000003L9.375 5.357058333333334C9.375 5.011875 9.654791666666668 4.732058333333334 10 4.732058333333334z" fill="currentColor"></path></svg> ${tag.orig_text}</span>`)
        break
      }
      case 'RICH_TEXT_NODE_TYPE_WEB': {
        text = text.replace(regex, `<span style="color: ${Common.useDarkTheme() ? '#58B0D5' : '#006A9E'};"><svg style="width: 60px;height: 60px;margin: 0 -15px -12px 0;" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 20 20" width="20" height="20"><path d="M9.571416666666666 7.6439C9.721125 7.33675 10.091416666666667 7.209108333333334 10.398583333333335 7.358808333333333C10.896041666666667 7.540316666666667 11.366333333333333 7.832000000000001 11.767333333333333 8.232975C13.475833333333334 9.941541666666668 13.475833333333334 12.711625 11.767333333333333 14.420166666666669L9.704916666666666 16.482583333333334C7.996383333333334 18.191125000000003 5.226283333333334 18.191125000000003 3.5177416666666668 16.482583333333334C1.8091916666666668 14.774041666666669 1.8091916666666668 12.003916666666667 3.5177416666666668 10.295375L5.008791666666667 8.804333333333334C5.252875 8.56025 5.6486 8.56025 5.892683333333334 8.804333333333334C6.136758333333334 9.048416666666668 6.136758333333334 9.444125000000001 5.892683333333334 9.688208333333334L4.401625 11.179250000000001C3.1812333333333336 12.399666666666667 3.1812333333333336 14.378291666666668 4.401625 15.598708333333335C5.622000000000001 16.819083333333335 7.60065 16.819083333333335 8.821041666666668 15.598708333333335L10.883416666666667 13.536291666666667C12.103833333333334 12.315916666666666 12.103833333333334 10.337250000000001 10.883416666666667 9.116875C10.582458333333333 8.815875 10.229416666666667 8.600908333333333 9.856458333333334 8.471066666666667C9.549333333333333 8.321375 9.421708333333335 7.9510499999999995 9.571416666666666 7.6439z" fill="currentColor"></path><path d="M15.597541666666668 4.402641666666667C14.377166666666668 3.1822500000000002 12.398541666666667 3.1822500000000002 11.178125000000001 4.402641666666667L9.11575 6.465033333333333C7.895358333333333 7.685425 7.895358333333333 9.664041666666668 9.11575 10.884458333333333C9.397666666666668 11.166375 9.725916666666667 11.371583333333334 10.073083333333333 11.500958333333333C10.376583333333334 11.658083333333334 10.495291666666667 12.031416666666667 10.338208333333332 12.334875C10.181083333333333 12.638375 9.80775 12.757083333333334 9.504291666666667 12.6C9.042416666666666 12.420333333333334 8.606383333333333 12.142833333333334 8.231858333333333 11.768333333333334C6.523316666666667 10.059791666666667 6.523316666666667 7.289691666666666 8.231858333333333 5.58115L10.29425 3.5187583333333334C12.002791666666667 1.8102083333333334 14.772875 1.8102083333333334 16.481458333333336 3.5187583333333334C18.19 5.2273000000000005 18.19 7.997400000000001 16.481458333333336 9.705916666666667L15.054916666666667 11.132458333333334C14.810875000000001 11.3765 14.415166666666668 11.3765 14.171041666666667 11.132458333333334C13.927 10.888333333333334 13.927 10.492625 14.171041666666667 10.248541666666666L15.597541666666668 8.822041666666667C16.81791666666667 7.601666666666667 16.81791666666667 5.623025 15.597541666666668 4.402641666666667z" fill="currentColor"></path></svg> ${tag.text}</span>`)
        break
      }
      case 'RICH_TEXT_NODE_TYPE_EMOJI': {
        const regex = new RegExp(tag.orig_text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
        text = text.replace(regex, `<img src='${tag.emoji.icon_url}' style='height: 160px; margin: 0 0 -10px 0;'>`)
        break
      }
    }
  }
  return text
}

/**
 * 拼接B站动态卡片的html字符串
 * @param {string[]} colors 颜色数组
 * @param {string} text 卡片的文字
 * @returns {string} 拼接好的html字符串
 */
export const generateGradientStyle = (colors, text) => {
  if (!colors) return ''
  const gradientString = colors.map((color) => {
    return `${color}`
  }).join(', ')

  // 返回完整的CSS样式字符串
  return `<span style="font-family: bilifont; color: transparent; background-clip: text; margin: 0 200px 0 0; font-size: 43px; background-image: linear-gradient(135deg, ${gradientString} 0%, ${gradientString} 100%); ">${text}</span>`
}

/**
 * 生成图片数组
 * @param { { img_src: string }[] } pic 一个包含图片源字符串的数组
 * @returns {Object[]} imgArray - 包含图片源地址的对象数组。
 */
export const cover = (pic) => {
  // 初始化一个空数组来存放图片对象
  const imgArray = []
  // 遍历dycrad.item.pictures数组，将每个图片的img_src存入对象，并将该对象加入imgArray
  for (const i of pic) {
    const obj = {
      image_src: i.img_src
    }
    imgArray.push(obj)
  }
  // 返回包含所有图片对象的数组
  return imgArray
}

/**
 * 生成装饰卡片的HTML字符串
 * @param {*} decorate 装饰对象，包含卡片的URL和颜色信息
 * @returns 返回装饰卡片的HTML字符串或空div字符串
 */
export const generateDecorationCard = (decorate) => {
  return decorate
    ? `<div style="display: flex; width: 500px; height: 150px; background-position: center; background-attachment: fixed; background-repeat: no-repeat; background-size: contain; align-items: center; justify-content: flex-end; background-image: url('${decorate.card_url}')">${generateGradientStyle(decorate.fan?.color_format?.colors, decorate.fan.num_str || decorate.fan.num_desc)}</div>`
    : '<div></div>'
}

/**
 * 检查用户是否为VIP会员并返回相应样式的HTML标签
 * @param {*} member - 用户对象，包含用户信息和VIP状态
 * @returns {string} 返回一个带有样式的HTML span标签，显示用户名
 */
function checkvip(member) {
  return member.vip.status === 1
    ? `<span style="color: ${member.vip.nickname_color || '#FB7299'}; font-weight: 700;">${member.name}</span>`
    : `<span style="color: ${Common.useDarkTheme() ? '#e9e9e9' : '#313131'}; font-weight: 700;">${member.name}</span>`
}

/**
 * 将文本中的换行符转换为HTML换行标签<br>
 * @param {string} data - 需要处理的文本数据
 * @returns {string} 处理后的文本，其中换行符被替换为<br>标签
 */
function br(data) {
  return (data = data.replace(/\n/g, '<br>'))  // 使用正则表达式将所有换行符\n替换为<br>标签
}

/** @type {Record<number, string>} */
const qnd = {
  6: '极速 240P',
  16: '流畅 360P',
  32: '清晰480P',
  64: '高清720P',
  74: '高帧率 720P60',
  80: '高清 1080P',
  112: '高码率 1080P+',
  116: '高帧率 1080P60',
  120: '超清 4K',
  125: '真彩色 HDR ',
  126: '杜比视界',
  127: '超高清 8K'
}

/**
 * 根据动态类型映射到对应的数字ID
 * @param {*} type - 动态类型字符串
 * @returns {number} 对应的数字ID
 */
function mapping_table(type) {
  /** @type {Record<string, string[]>} */
  const typeMap = {
    1: ['DYNAMIC_TYPE_AV', 'DYNAMIC_TYPE_PGC', 'DYNAMIC_TYPE_UGC_SEASON'],
    11: ['DYNAMIC_TYPE_DRAW'],
    12: ['DYNAMIC_TYPE_ARTICLE'],
    17: ['DYNAMIC_TYPE_LIVE_RCMD', 'DYNAMIC_TYPE_FORWARD', 'DYNAMIC_TYPE_WORD', 'DYNAMIC_TYPE_COMMON_SQUARE'],
    19: ['DYNAMIC_TYPE_MEDIALIST']
  }
  for (const key in typeMap) {
    if (typeMap[key] && typeMap[key].includes(type)) {
      return parseInt(key, 10)
    }
  }
  return 1
}

/**
 * @param {import ('@ikenxuan/amagi').BiliDynamicInfo<DynamicType>} dynamicINFO 
 * @param {import ('@ikenxuan/amagi').BiliDynamicCard} dynamicInfoCard 
 * @returns 
 */
const oid = (dynamicINFO, dynamicInfoCard) => {
  switch (dynamicINFO.data.item.type) {
    case 'DYNAMIC_TYPE_WORD':
    case 'DYNAMIC_TYPE_FORWARD': {
      return dynamicINFO.data.item.id_str
    }
    default: {
      return dynamicInfoCard.data.card.desc.rid.toString()
    }
  }
}

/**
 * 检出符合大小的视频流信息对象
 * @param {Object} qualityOptions - 视频质量选项
 * @param {number} [qualityOptions.qn] - qn值，视频清晰度标识
 * @param {number} [qualityOptions.maxAutoVideoSize] - 可接受的最大视频文件大小，单位：MB
 * @param {string} qualityOptions.bvid - 视频BV号
 * @param {string[]} qualityOptions.accept_description - 视频流清晰度列表
 * @param {videoDownloadUrlList} videoList - 包含所有清晰度的视频流信息对象
 * @param {string} audioUrl - 音频流地址
 * @returns {Promise<{ accept_description: string[]; videoList: videoDownloadUrlList; selectedQuality: string }>} 包含处理后的视频列表和清晰度描述的对象
 * @property {string[]} returns.accept_description - 处理后的清晰度描述列表
 * @property {Object[]} returns.videoList - 处理后的视频流信息对象列表
 * @property {string} returns.selectedQuality - 选中的视频画质值
 */
export const bilibiliProcessVideos = async (qualityOptions, videoList, audioUrl) => {
  // 如果不是自动选择模式，直接根据配置的清晰度选择视频
  if (qualityOptions.qn !== 0 && Config.bilibili.videoQuality !== 0) {
    /** @type {number} */
    const targetQuality = qualityOptions.qn || Config.bilibili.videoQuality || 80

    // 尝试找到完全匹配的清晰度
    let matchedVideo = videoList.find(video => video?.id === targetQuality)

    // 如果没有完全匹配的清晰度，找最接近的
    if (!matchedVideo) {
      // 按照清晰度ID排序
      const sortedVideos = [...videoList].sort((a, b) => a.id - b.id)

      // 找到小于目标清晰度的最大值
      const lowerVideos = sortedVideos.filter(video => video.id < targetQuality)
      const higherVideos = sortedVideos.filter(video => video.id > targetQuality)

      if (lowerVideos.length > 0) {
        // 有小于目标清晰度的，取最大的
        matchedVideo = lowerVideos[lowerVideos.length - 1]
      } else if (higherVideos.length > 0) {
        // 没有小于目标清晰度的，取最小的
        matchedVideo = higherVideos[0]
      } else {
        // 如果都没有，取第一个（应该不会发生）
        matchedVideo = sortedVideos[0]
      }
    }

    // 更新视频列表和清晰度描述
    /** @type {string} */
    const matchedQuality = (matchedVideo?.id && qnd[matchedVideo?.id]) || qualityOptions.accept_description[0] || '未知'
    qualityOptions.accept_description = [matchedQuality]
    videoList = matchedVideo ? [matchedVideo] : []

    return {
      accept_description: qualityOptions.accept_description,
      videoList,
      selectedQuality: matchedQuality
    }
  }

  // 自动选择逻辑（videoQuality === 0）
  /** @type {Record<number, string>} */
  const results = {}
  logger.info('开始获取视频大小...')

  for (const video of videoList) {
    try {
      const size = await getvideosize(video.base_url, audioUrl, qualityOptions.bvid)
      results[video.id] = size
      logger.info(`视频ID ${video.id} (${qnd[video.id]}) 大小: ${size}`)
    } catch (error) {
      logger.error(`获取视频ID ${video.id} 大小时出错:`, error)
      // 设置一个默认的大值，确保它不会被选中
      results[video.id] = '999999MB'
    }
  }

  logger.info('所有视频大小结果:', results)

  // 将结果对象的值转换为数字，并找到最接近但不超过 qualityOptions.maxAutoVideoSize 或 Config.bilibili.maxAutoVideoSize 的值
  const maxSize = qualityOptions?.maxAutoVideoSize || Config.bilibili.maxAutoVideoSize || 100
  logger.info('最大允许大小:', maxSize, 'MB')

  /** @type {number | null} */
  let closestId = null
  let smallestDifference = Infinity
  /** @type {number | null} */
  let largestUnderLimit = null // 新增：记录小于限制的最大视频ID

  Object.entries(results).forEach(([id, sizeStr]) => {
    /** @type {number} */
    const idNum = Number(id)
    /** @type {string} */
    const sizeStrVal = sizeStr
    /** @type {number} */
    const size = parseFloat(sizeStrVal.replace('MB', ''))
    logger.info(`检查视频ID ${idNum} (${qnd[idNum]}), 大小: ${size}MB`)

    if (size <= maxSize) {
      // 记录小于限制的最大视频ID
      if (largestUnderLimit === null) {
        // 第一次找到符合条件的视频，直接记录
        largestUnderLimit = Number(idNum)
      } else {
        // 已经有记录，比较大小
        /** @type {number} */
        const currentSize = parseFloat(results[largestUnderLimit]?.replace('MB', '') || '0')
        if (size > currentSize) {
          largestUnderLimit = Number(idNum)
        }
      }

      // 计算与最大限制的差值
      const difference = maxSize - size
      if (difference < smallestDifference) {
        smallestDifference = difference
        closestId = Number(idNum)
      }
    }
  })


  // 如果没有找到最接近的，但有小于限制的视频，选择最大的那个
  if (closestId === null && largestUnderLimit !== null) {
    closestId = largestUnderLimit
  }

  logger.info('选中的视频ID:', closestId)

  /** @type {string} */
  let selectedQuality = '' // 添加选中的画质值变量

  if (closestId !== null) {
    // 找到最接近但不超过文件大小限制的视频清晰度
    /** @type {string} */
    const closestQuality = qnd[Number(closestId)] || '未知'
    // 更新 OBJECT.DATA.data.accept_description
    qualityOptions.accept_description = qualityOptions.accept_description.filter(desc => desc === closestQuality)
    if (qualityOptions.accept_description.length === 0) {
      qualityOptions.accept_description = [closestQuality]
    }
    // 找到对应的视频对象
    const video = videoList.find(video => video.id === Number(closestId))
    if (video) {
      // 更新 OBJECT.DATA.data.dash.video 数组
      videoList = [video]
    }
    selectedQuality = closestQuality // 设置选中的画质值
  } else {
    // 如果没有找到符合条件的视频，使用最低画质的视频对象
    const lastVideo = [...videoList].pop()
    if (lastVideo) {
      videoList = [lastVideo]
    }
    // 更新 OBJECT.DATA.data.accept_description 为最低画质的描述
    const lastDescription = [...qualityOptions.accept_description].pop()
    if (lastDescription) {
      qualityOptions.accept_description = [lastDescription]
      selectedQuality = lastDescription // 设置选中的画质值
    }
  }

  logger.warn('最终选中的画质:', selectedQuality)
  return {
    accept_description: qualityOptions.accept_description,
    videoList,
    selectedQuality  // 添加选中的画质值到返回对象
  }
}

/**
 * [bilibili] 获取视频和音频的总大小
 * @param {string} videourl - 视频流URL
 * @param {string} audiourl - 音频流URL
 * @param {string} bvid - 视频BV号
 * @returns  返回视频和音频总大小(MB),保留2位小数
 */
export const getvideosize = async (videourl, audiourl, bvid) => {
  const videoheaders = await new Networks({
    url: videourl,
    headers: {
      ...baseHeaders,
      Referer: `https://api.bilibili.com/video/${bvid}`,
      Cookie: Config.cookies.bilibili
    }
  }).getHeaders()
  const audioheaders = await new Networks({
    url: audiourl,
    headers: {
      ...baseHeaders,
      Referer: `https://api.bilibili.com/video/${bvid}`,
      Cookie: Config.cookies.bilibili
    }
  }).getHeaders()

  const videoSize = videoheaders['content-range']?.match(/\/(\d+)/) ? parseInt(videoheaders['content-range']?.match(/\/(\d+)/)[1], 10) : 0
  const audioSize = audioheaders['content-range']?.match(/\/(\d+)/) ? parseInt(audioheaders['content-range']?.match(/\/(\d+)/)[1], 10) : 0

  const videoSizeInMB = (videoSize / (1024 * 1024)).toFixed(2)
  const audioSizeInMB = (audioSize / (1024 * 1024)).toFixed(2)

  const totalSizeInMB = parseFloat(videoSizeInMB) + parseFloat(audioSizeInMB)
  return totalSizeInMB.toFixed(2)
}
