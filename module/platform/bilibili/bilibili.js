import { Base, Render, Config, Networks, mergeFile, Common, baseHeaders, downloadFile, uploadFile, downloadVideo, processImageUrl } from '../../utils/index.js'
import { bilibiliApiUrls, DynamicType, AdditionalType } from '@ikenxuan/amagi'
import { getBilibiliData } from './api.js'
import { burnDanmaku } from '../common/danmaku.js'
import common from '../../../../../lib/common/common.js'
import { bilibiliComments, checkCk, genParams } from './index.js'
import { formatBilibiliDynamicText, formatBilibiliVideoDescText, getHotBilibiliDanmaku } from './dynamicText.js'
import { extractBilibiliArticleImages, formatBilibiliArticleBody } from './article.js'
import { buildLivePhotoMessages as buildCommonLivePhotoMessages, buildLivePhotoTipMessage } from '../common/livePhoto.js'
import fs from 'fs'

/**
 * B站视频列表
 * @typedef {import('@ikenxuan/amagi').BiliVideoPlayurlIsLogin['data']['dash']['video']} videoDownloadUrlList - 视频下载地址列表
 */

/** @type {import('../../utils/Render.js').ImageData[]} */
let img

const hasUserConfigKey = (key) => Object.prototype.hasOwnProperty.call(Config.getConfig?.('bilibili') || {}, key)
const hasBilibiliContent = (legacyKey, modernKey) => {
  const sendContent = Config.bilibili.sendContent
  if (modernKey && hasUserConfigKey('sendContent') && Array.isArray(sendContent) && sendContent.length > 0) {
    return sendContent.includes(modernKey)
  }
  return (Config.bilibili.bilibiliTip || []).includes(legacyKey)
}

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
   * @param {{ forceBurnDanmaku?: boolean }} [options]
   */
  constructor(e, data, options) {
    super(e)
    this.e = e
    this.isVIP = false
    this.Type = data?.type
    this.islogin = data?.USER?.STATUS === 'isLogin'
    this.downloadfilename = ''
    this.forceBurnDanmaku = options?.forceBurnDanmaku ?? false
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
    try {
      if (this.Type === 'undefined') return true
      !iddata?.Episode && (Config.app.parseTip || hasBilibiliContent('提示信息')) && await this.e.reply('检测到B站链接，开始解析')
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

          const videoStreamUrl = !this.islogin && bilibiliApiUrls.视频流信息({
            avid: infoData.data.data.aid,
            cid: iddata.p ? (infoData.data.data.pages[iddata.p - 1]?.cid || infoData.data.data.cid) : infoData.data.data.cid
          })
          const Params = !this.islogin && await genParams(videoStreamUrl || '')
          const nockData = !this.islogin && await new Networks({
            url: `${videoStreamUrl}${Params}`,
            headers: {
              ...baseHeaders,
              Referer: 'https://www.bilibili.com',
              Cookie: ''
            }
          }).getData()

          // 构建回复内容数组
          /**
           * @type {(string | import('../../utils/Render.js').ImageData)[]}
           */
          const replyContent = []

          // 如果配置项不存在，则不显示任何内容
          if (hasBilibiliContent('简介', 'info') && (Config.bilibili?.displayContent || []).length > 0) {
            if (Config.bilibili.videoInfoMode === 'image') {
              const userProfileData = await this.amagi.getBilibiliData('用户主页数据', { host_mid: owner.mid, typeMode: 'strict' })
              let hotDanmaku = []
              if (Config.bilibili.showDanmakuInVideoInfo) {
                const danmakuCid = iddata.p ? (infoData.data.data.pages[iddata.p - 1]?.cid || infoData.data.data.cid) : infoData.data.data.cid
                const danmakuDuration = iddata.p ? (infoData.data.data.pages[iddata.p - 1]?.duration || infoData.data.data.duration) : infoData.data.data.duration
                hotDanmaku = getHotBilibiliDanmaku(await this.fetchVideoDanmakuList(danmakuCid, danmakuDuration), 20)
              }

              await this.e.reply(await Render('bilibili/videoInfo', {
                share_url: 'https://b23.tv/' + infoData.data.data.bvid,
                title,
                desc: formatBilibiliVideoDescText(infoData.data.data.desc_v2, desc, { useDarkTheme: Common.useDarkTheme() }),
                stat,
                stats: {
                  view: Common.count(stat.view),
                  danmaku: Common.count(stat.danmaku),
                  reply: Common.count(stat.reply),
                  like: Common.count(stat.like),
                  coin: Common.count(stat.coin),
                  favorite: Common.count(stat.favorite),
                  share: Common.count(stat.share)
                },
                bvid: infoData.data.data.bvid,
                ctime: Common.convertTimestampToDateTime(infoData.data.data.ctime),
                pic,
                hotDanmaku,
                owner: {
                  ...owner,
                  frame: userProfileData.data.data.card.pendant?.image || '',
                  name: userProfileData.data.data.card.name || owner.name,
                  face: userProfileData.data.data.card.face || owner.face
                }
              }))
            } else {
              /**
               * @type {Object.<string, any>}
               */
              const processedCover = await processImageUrl(pic, title || 'B站视频封面', 0, {
                Referer: 'https://www.bilibili.com/',
                Cookie: Config.cookies.bilibili || ''
              })
              const contentMap = {
                cover: await segment.image(processedCover),
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
            videoSize = (nockData.data.durl[0].size / (1024 * 1024)).toFixed(2)
          }
          if (hasBilibiliContent('评论图', 'comment')) {
            const commentsData = await this.amagi.getBilibiliData('评论数据', {
              number: Config.bilibili.bilibilinumcomments,
              type: 1,
              oid: infoData.data.data.aid.toString(),
              typeMode: 'strict'
            })
            const commentsdata = Config.bilibili.bilibilinumcomments && Config.bilibili?.bilibilinumcomments > 0 && bilibiliComments(commentsData.data)
            if (commentsdata?.length) {
              img = await Render('bilibili/comment', {
                Type: '视频',
                CommentsData: commentsdata,
                CommentLength: Config.bilibili.realCommentCount ? Common.count(infoData.data.data.stat.reply) : String(commentsdata.length),
                share_url: 'https://b23.tv/' + infoData.data.data.bvid,
                Clarity: Config.bilibili.videopriority === true || !this.islogin ? nockData.data.accept_description[0] : correctList?.selectedQuality,
                VideoSize: Config.bilibili.videopriority === true || !this.islogin ? (nockData.data.durl[0]?.size / (1024 * 1024) || 0).toFixed(2) : videoSize,
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

          let danmakuList = []
          if (this.forceBurnDanmaku || Config.bilibili.burnDanmaku) {
            const cid = iddata.p ? (infoData.data.data.pages[iddata.p - 1]?.cid || infoData.data.data.cid) : infoData.data.data.cid
            const duration = iddata.p ? (infoData.data.data.pages[iddata.p - 1]?.duration || infoData.data.data.duration) : infoData.data.data.duration
            danmakuList = await this.fetchVideoDanmakuList(cid, duration)
          }

          if (hasBilibiliContent('视频', 'video')) {
            if (Config.upload.usefilelimit && Number(videoSize) > Number(Config.upload.filelimit)) {
              await this.e.reply(`设定的最大上传大小为 ${Config.upload.filelimit}MB\n当前解析到的视频大小为 ${Number(videoSize)}MB\n` + '视频太大了，还是去B站看吧~', { reply: true })
            } else {
              await this.getvideo(
                Config.bilibili.videopriority === true
                  ? { playUrlData: nockData, danmakuList }
                  : {
                    infoData: infoData.data, playUrlData: playUrlData.data, danmakuList
                  })
            }
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
          if (!hasBilibiliContent('动态')) break
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
              const tempFiles = []
              let hasGeneratedLivePhoto = false
              const pics = dynamicInfo.data.data.item.modules.module_dynamic.major.opus.pics || []

              for (const [index, item] of pics.entries()) {
                if (!item?.url) continue

                if (item.live_url) {
                  const livePhoto = await buildCommonLivePhotoMessages({
                    platform: 'bilibili',
                    staticUrl: item.url,
                    liveVideoUrl: item.live_url,
                    index,
                    headers: {
                      ...baseHeaders,
                      Referer: 'https://www.bilibili.com/'
                    }
                  })
                  tempFiles.push(...livePhoto.tempFiles)
                  hasGeneratedLivePhoto = hasGeneratedLivePhoto || livePhoto.generatedLivePhoto
                  if (livePhoto.messages.length > 0) {
                    imgArray.push(...livePhoto.messages)
                    continue
                  }
                }

                const imageUrl = await processImageUrl(item.url, dynamicInfo.data.data.item.modules.module_author?.name || 'B站动态图片', index, {
                  Referer: 'https://www.bilibili.com/',
                  Cookie: Config.cookies.bilibili || ''
                })
                imgArray.push(segment.image(imageUrl))
              }

              if (hasGeneratedLivePhoto) {
                imgArray.push(await buildLivePhotoTipMessage())
              }

              try {
                if (imgArray.length === 1) await this.e.reply(imgArray[0])
                if (imgArray.length > 1) await this.e.reply(['QQBot', 'KOOKBot'].includes(this.botadapter) ? imgArray : await common.makeForwardMsg(this.e, imgArray, '动态图片'))
              } finally {
                for (const item of tempFiles) {
                  if (item?.filepath) await Common.removeFile(item.filepath, true)
                }
              }

              if (hasBilibiliContent('评论图', 'comment') && commentsData) {
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
            /** 文章/专栏动态 */
            case DynamicType.ARTICLE: {
              const articleIdValue = dynamicInfo.data.data.item.basic?.rid_str ||
                dynamicInfo.data.data.item.basic?.rid?.toString?.() ||
                dynamicInfo.data.data.item.modules?.module_dynamic?.major?.article?.id?.toString?.()
              const articleId = articleIdValue ? String(articleIdValue) : ''

              if (!articleId) {
                await this.e.reply('该专栏动态缺少专栏 ID，暂时无法解析')
                break
              }

              const [articleInfoBase, articleInfo] = await Promise.all([
                this.amagi.getBilibiliData('专栏文章基本信息', { id: articleId, typeMode: 'strict' }),
                this.amagi.getBilibiliData('专栏正文内容', { id: articleId, typeMode: 'strict' })
              ])
              const articleData = articleInfoBase.data.data
              const articleContent = articleInfo.data.data
              const articleImages = extractBilibiliArticleImages(articleContent)
              const processedArticleImages = await Promise.all(articleImages.map((url, index) => processImageUrl(url, articleData.title || 'B站专栏图片', index, {
                Referer: 'https://www.bilibili.com/',
                Cookie: Config.cookies.bilibili || ''
              })))
              const imageMessages = processedArticleImages.map(url => segment.image(url))

              if (imageMessages.length === 1) await this.e.reply(imageMessages[0])
              if (imageMessages.length > 1) await this.e.reply(await common.makeForwardMsg(this.e, imageMessages, '专栏图片'))

              const stats = articleData.stats || {}
              const shareUrl = articleContent.dyn_id_str
                ? `https://www.bilibili.com/opus/${articleContent.dyn_id_str}`
                : `https://www.bilibili.com/read/cv${articleContent.id || articleId}`
              const categories = Array.isArray(articleData.categories)
                ? articleData.categories.map(item => item?.name || item).filter(Boolean)
                : []

              img = await Render('bilibili/dynamic/DYNAMIC_TYPE_ARTICLE', {
                username: checkvip(userProfileData.data.data.card),
                avatar_url: userProfileData.data.data.card.face,
                frame: dynamicInfo.data.data.item.modules.module_author.pendant.image,
                create_time: dynamicInfo.data.data.item.modules.module_author.pub_time ||
                  Common.convertTimestampToDateTime(dynamicInfo.data.data.item.modules.module_author.pub_ts),
                title: articleData.title || dynamicInfo.data.data.item.modules.module_dynamic?.major?.article?.title || 'B站专栏',
                summary: articleData.summary || '',
                banner_url: articleData.banner_url || articleData.image_urls?.[0] || '',
                categories,
                words: articleData.words || 0,
                body: formatBilibiliArticleBody(articleContent, { useDarkTheme: Common.useDarkTheme() }),
                view: Common.count(stats.view),
                like: Common.count(stats.like),
                favorite: Common.count(stats.favorite),
                reply: Common.count(stats.reply),
                share: Common.count(stats.dynamic || stats.share),
                render_time: Common.getCurrentTime(),
                share_url: shareUrl,
                dynamicTYPE: '专栏动态解析',
                user_shortid: userProfileData.data.data.card.mid,
                total_favorited: Common.count(userProfileData.data.data.like_num),
                following_count: Common.count(userProfileData.data.data.card.attention),
                fans: Common.count(userProfileData.data.data.follower)
              })
              await this.e.reply(img)

              Config.bilibili.bilibilinumcomments && commentsData && await this.e.reply(
                await Render('bilibili/comment', {
                  Type: '动态',
                  CommentsData: bilibiliComments(commentsData.data),
                  CommentLength: String((bilibiliComments(commentsData.data)?.length || 0)),
                  share_url: shareUrl,
                  ImageLength: articleImages.length || '动态中没有附带图片',
                  shareurl: '动态分享链接'
                })
              )
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
    } catch (e) {
      logger.warn(`Bilibili解析错误：${e}`)
      return false
    }
  }

  /**
   * 获取B站视频弹幕列表
   * @param {number|string} cid 视频cid
   * @param {number} duration 视频时长，单位秒
   * @returns {Promise<Array<{progress:number, mode:number, fontsize:number, color:number, content:string}>>}
   */
  async fetchVideoDanmakuList(cid, duration) {
    try {
      if (!cid) return []
      const xml = await new Networks({
        url: `https://comment.bilibili.com/${cid}.xml`,
        headers: {
          ...baseHeaders,
          Referer: `https://www.bilibili.com/video/${cid}`,
          Cookie: Config.cookies.bilibili || ''
        }
      }).getData()

      const text = typeof xml === 'string' ? xml : String(xml)
      const list = []
      const regex = /<d\s+p="([^"]+)">([\s\S]*?)<\/d>/g
      let match
      while ((match = regex.exec(text))) {
        const p = match[1].split(',')
        const seconds = Number(p[0] || 0)
        if (duration && seconds > duration) continue
        list.push({
          progress: Math.max(0, seconds * 1000),
          mode: Number(p[1] || 1),
          fontsize: Number(p[2] || 25),
          color: Number(p[3] || 16777215),
          content: match[2]
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
        })
      }
      logger.debug(`[B站] 获取到 ${list.length} 条弹幕`)
      return list
    } catch (error) {
      logger.warn('[B站] 获取弹幕失败，将发送原视频', error)
      return []
    }
  }

  /**
   * 获取视频并处理的方法
   * @param {Object} videoData - 视频数据对象
   * @param {import('@ikenxuan/amagi').BiliBangumiVideoInfo | import('@ikenxuan/amagi').BiliOneWork} [videoData.infoData] - 视频信息数据
   * @param {import('@ikenxuan/amagi').BiliVideoPlayurlIsLogin | import('@ikenxuan/amagi').BiliBiliVideoPlayurlNoLogin | import('@ikenxuan/amagi').BiliBangumiVideoPlayurlIsLogin | import('@ikenxuan/amagi').BiliBangumiVideoPlayurlNoLogin} [videoData.playUrlData] - 播放URL数据
   * @param {Array<any>} [videoData.danmakuList] - 弹幕列表
   * @returns {Promise<void>}
   */
  async getvideo({ infoData, playUrlData, danmakuList = [] }) {
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
            Cookie: ''
          }
        }),
        downloadFile(audioUrl, {
          title: `Bil_A_${videoId}.mp3`,
          headers: {
            Referer: this.headers.Referer,
            Cookie: ''
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

            let sourcePath = resultPath
            if ((this.forceBurnDanmaku || Config.bilibili.burnDanmaku) && danmakuList.length > 0) {
              const burnPath = Common.tempDri.video + `Bil_Danmaku_${Date.now()}.mp4`
              const ok = await burnDanmaku('bilibili', resultPath, danmakuList, burnPath, {
                danmakuArea: Config.bilibili.danmakuArea,
                danmakuFontSize: Config.bilibili.danmakuFontSize,
                danmakuOpacity: Config.bilibili.danmakuOpacity
              })
              if (ok) {
                await Common.removeFile(resultPath, true)
                sourcePath = burnPath
              }
            }

            const filePath = Common.tempDri.video + `${Config.app.removeCache ? 'tmp_' + Date.now() : this.downloadfilename}.mp4`
            fs.renameSync(sourcePath, filePath)
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
        const videoUrl = playUrlData?.data.durl[0].url
        if ((this.forceBurnDanmaku || Config.bilibili.burnDanmaku) && danmakuList.length > 0) {
          const videoFile = await downloadFile(videoUrl, {
            title: `Bil_V_tmp_${Date.now()}.mp4`,
            headers: this.headers
          })
          if (videoFile.filepath) {
            const resultPath = Common.tempDri.video + `Bil_Danmaku_${Date.now()}.mp4`
            const ok = await burnDanmaku('bilibili', videoFile.filepath, danmakuList, resultPath, {
              danmakuArea: Config.bilibili.danmakuArea,
              danmakuFontSize: Config.bilibili.danmakuFontSize,
              danmakuOpacity: Config.bilibili.danmakuOpacity
            })
            await Common.removeFile(videoFile.filepath, true)
            if (ok) {
              const size = await Common.getVideoFileSize(resultPath)
              await uploadFile(this.e, { filepath: resultPath, totalBytes: size, originTitle: this.downloadfilename }, '')
              return
            }
          }
        }
        await downloadVideo(this.e, { video_url: videoUrl, title: { timestampTitle: `tmp_${Date.now()}.mp4`, originTitle: `${this.downloadfilename}.mp4` } })
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
  return formatBilibiliDynamicText(text, rich_text_nodes, { useDarkTheme: Common.useDarkTheme() })
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
