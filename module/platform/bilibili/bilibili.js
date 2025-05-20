import { Base, Render, Config, Networks, FFmpeg } from '../../utils/index.js'
import { Bilidata, bilicomments, checkuser } from './index.js'
import common from '../../../../../lib/common/common.js'
import { bilibiliAPI } from '@ikenxuan/amagi'
import fs from 'fs'

let img

export default class BiLiBiLi extends Base {
  constructor (e = {}, data) {
    super()
    /**
     * @type {import('node-karin').KarinMessage}
     */
    this.e = e
    this.STATUS = data?.USER?.STATUS
    this.ISVIP = data?.USER?.isvip
    this.TYPE = data?.TYPE
    this.islogin = data?.USER?.STATUS === 'isLogin'
    this.downloadfilename = ''
    this.headers.Referer = 'https://api.bilibili.com/'
    this.headers.Cookie = Config.cookies.bilibili
  }

  async RESOURCES (OBJECT, Episode = false) {
    !Episode && Config.bilibili.bilibilitip && await this.e.reply('检测到B站链接，开始解析')
    switch (this.TYPE) {
      case 'bilibilivideo': {
        const { owner, pic, title, stat } = OBJECT.INFODATA.data
        const { name } = owner
        const { coin, like, share, view, favorite, danmaku } = stat

        this.downloadfilename = title.substring(0, 50).replace(/[\\/:\*\?"<>\|\r\n\s]/g, ' ')

        const nocd_data = await new Networks({
          url: bilibiliAPI.视频流信息({ avid: OBJECT.INFODATA.data.aid, cid: OBJECT.INFODATA.data.cid }) + '&platform=html5',
          headers: this.headers
        }).getData()

        await this.e.reply(
          this.mkMsg(
            [
              segment.image(pic),
              `\n# 标题: ${title}\n`,
              `\n作者: ${name}\n播放量: ${this.count(view)},    弹幕: ${this.count(danmaku)}\n点赞: ${this.count(like)},    投币: ${this.count(coin)}\n转发: ${this.count(
                share
              )},    收藏: ${this.count(favorite)}`
            ],
            [
              {
                text: "视频直链 ['流畅 360P']",
                link: nocd_data.data.durl[0].url
              }
            ]
          )
        )

        const simplify = OBJECT.DATA.data.dash.video.filter((item, index, self) => {
          return self.findIndex((t) => {
            return t.id === item.id
          }) === index
        })
        if (this.islogin) OBJECT.DATA.data.dash.video = simplify
        OBJECT = await this.processVideos(OBJECT)
        let videoSize
        if (this.islogin) {
          videoSize = await this.getvideosize(OBJECT.DATA.data.dash.video[0].base_url, OBJECT.DATA.data.dash.audio[0].base_url, OBJECT.INFODATA.data.bvid)
        } else {
          if (OBJECT.DATA.data.durl && OBJECT.DATA.data.durl[0]) {
            videoSize = (OBJECT.DATA.data.durl[0].size / (1024 * 1024)).toFixed(2)
          } else {
            throw new Error('缺少视频下载信息,请配置Cookie后重试')
          }
        }
        const commentsdata = await bilicomments(OBJECT)
        img = await Render.render('bilibili/comment', {
          Type: '视频',
          CommentsData: commentsdata,
          CommentLength: String(commentsdata?.length ? commentsdata.length : 0),
          VideoUrl: 'https://b23.tv/' + OBJECT.INFODATA.data.bvid,
          Clarity: Config.bilibili.videopriority === true ? nocd_data.data.accept_description[0] : OBJECT.DATA.data.accept_description[0],
          VideoSize: Config.bilibili.videopriority === true ? (nocd_data.data.durl[0].size / (1024 * 1024)).toFixed(2) : videoSize,
          ImageLength: 0,
          shareurl: 'https://b23.tv/' + OBJECT.INFODATA.data.bvid
        })
        Config.bilibili.bilibilicommentsimg &&
          (await this.e.reply(
            this.mkMsg(img, [
              {
                text: "视频直链 ['流畅 360P']",
                link: nocd_data.data.durl[0].url
              }
            ])
          ))
        if (Config.app.usefilelimit && Number(videoSize) > Number(Config.app.filelimit)) {
          await this.e.reply(`设定的最大上传大小为 ${Config.app.filelimit}MB\n当前解析到的视频大小为 ${Number(videoSize)}MB\n` + '视频太大了，还是去B站看吧~', true)
        } else await this.getvideo(Config.bilibili.videopriority === true ? { DATA: nocd_data } : OBJECT)
        break
      }
      case 'bangumivideo': {
        if (!Episode) {
          const barray = []
          let msg = []
          for (let i = 0; i < OBJECT.INFODATA.result.episodes.length; i++) {
            const totalEpisodes = OBJECT.INFODATA.result.episodes.length
            const long_title = OBJECT.INFODATA.result.episodes[i].long_title
            const badge = OBJECT.INFODATA.result.episodes[i].badge
            const short_link = OBJECT.INFODATA.result.episodes[i].short_link
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
          img = await Render.render('bilibili/bangumi', {
            saveId: 'bangumi',
            bangumiData: barray,
            Botadapter: this.botadapter,
            title: OBJECT.INFODATA.result.title
          })
          global.BILIBILIOBJECT = OBJECT
          msg = msg
            .flat(Infinity)
            .map((str) => {
              return str.replace(/,\s*$/, '')
            })
            .join('')
          await this.e.reply(
            this.mkMsg(this.botadapter === 'QQBot' ? `# ${OBJECT.INFODATA.result.season_title}\n---\n${msg}\r\r---\n请在60秒内输入 第?集 选择集数` : img, [
              { text: '第1集', callback: '第1集' },
              { text: '第2集', callback: '第2集' },
              { text: '第?集', input: '第' }
            ])
          )
        } else {

          this.downloadfilename = OBJECT.INFODATA.result.episodes[Number(OBJECT.Episode - 1)].share_copy.substring(0, 50).replace(/[\\/:\*\?"<>\|\r\n\s]/g, ' ')
          const bangumidataBASEURL = bilibiliAPI.番剧视频流信息({
            cid: OBJECT.INFODATA.result.episodes[Number(OBJECT.Episode - 1)].cid,
            ep_id: OBJECT.INFODATA.result.episodes[Number(OBJECT.Episode - 1)].ep_id
          })
          const QUERY = await checkuser(bangumidataBASEURL)
          const bangumiDATA = await new Bilidata().GlobalGetData({
            url: bangumidataBASEURL + QUERY.QUERY,
            headers: this.headers
          })
          if (OBJECT.INFODATA.result.episodes[Number(OBJECT.Episode - 1)].badge === '会员' && !this.ISVIP) return logger.warn('该CK不是大会员，无法获取视频流')
          const BILIBILIOBJECT = global.BILIBILIOBJECT
          BILIBILIOBJECT.DATA = bangumiDATA
          await this.getvideo({
            ...OBJECT,
            video_url: this.ISVIP ? OBJECT.DATA.result.dash.video[0].base_url : OBJECT.DATA.result.dash.video[0].base_url,
            audio_url: OBJECT.DATA.result.dash.audio[0].base_url
          })
        }
        break
      }
      case 'bilibilidynamic': {
        switch (OBJECT.dynamicINFO.data.item.type) {
          /** 图文、纯图 */
          case 'DYNAMIC_TYPE_DRAW': {
            const imgArray = []
            for (const img of OBJECT.dynamicINFO.data.item.modules.module_dynamic.major && OBJECT.dynamicINFO.data.item.modules.module_dynamic?.major?.draw?.items) {
              imgArray.push(segment.image(img.src))
            }
            const commentsdata = await bilicomments(OBJECT)
            img = await Render.render('bilibili/comment', {
              Type: '动态',
              CommentsData: commentsdata,
              CommentLength: String(commentsdata?.length ? commentsdata.length : 0),
              VideoUrl: 'https://t.bilibili.com/' + OBJECT.dynamicINFO.data.item.id_str,
              ImageLength: OBJECT.dynamicINFO.data.item.modules?.module_dynamic?.major?.draw?.items?.length || '动态中没有附带图片',
              shareurl: '动态分享链接'
            })
            if (imgArray.length === 1) await this.e.reply(imgArray[0])
            if (imgArray.length > 1) await this.e.reply(['QQBot', 'KOOKBot'].includes(this.botadapter) ? imgArray : await common.makeForwardMsg(this.e, imgArray))
            if (Config.bilibili.bilibilicommentsimg) await this.e.reply(img)

            const dynamicCARD = JSON.parse(OBJECT.dynamicINFO_CARD.data.card.card)
            const cover = () => {
              const imgArray = []
              for (let i = 0; i < dynamicCARD.item.pictures.length; i++) {
                const obj = {
                  image_src: dynamicCARD.item.pictures[i].img_src
                }
                imgArray.push(obj)
              }
              return imgArray
            }
            await this.e.reply(await Render.render('bilibili/dynamic/DYNAMIC_TYPE_DRAW', {
              image_url: cover(),
              text: replacetext(br(OBJECT.dynamicINFO.data.item.modules.module_dynamic.desc.text), OBJECT.dynamicINFO),
              dianzan: this.count(OBJECT.dynamicINFO.data.item.modules.module_stat.like.count),
              pinglun: this.count(OBJECT.dynamicINFO.data.item.modules.module_stat.comment.count),
              share: this.count(OBJECT.dynamicINFO.data.item.modules.module_stat.forward.count),
              create_time: OBJECT.dynamicINFO.data.item.modules.module_author.pub_time,
              avater_url: OBJECT.dynamicINFO.data.item.modules.module_author.face,
              share_url: 'https://t.bilibili.com/' + OBJECT.dynamicINFO.data.item.id_str,
              username: checkvip(OBJECT.USERDATA.data.card),
              fans: this.count(OBJECT.USERDATA.data.follower),
              user_shortid: OBJECT.dynamicINFO.data.item.modules.module_author.mid,
              total_favorited: this.count(OBJECT.USERDATA.data.like_num),
              following_count: this.count(OBJECT.USERDATA.data.card.attention),
              Botadapter: this.botadapter,
              dynamicTYPE: '图文动态'
            }))
            break
          }
          /** 纯文 */
          case 'DYNAMIC_TYPE_WORD': {
            const text = replacetext(br(OBJECT.dynamicINFO.data.item.modules.module_dynamic.desc.text), OBJECT.dynamicINFO)
            await this.e.reply(
              await Render.render('bilibili/dynamic/DYNAMIC_TYPE_WORD', {
                text,
                dianzan: this.count(OBJECT.dynamicINFO.data.item.modules.module_stat.like.count),
                pinglun: this.count(OBJECT.dynamicINFO.data.item.modules.module_stat.comment.count),
                share: this.count(OBJECT.dynamicINFO.data.item.modules.module_stat.forward.count),
                create_time: OBJECT.dynamicINFO.data.item.modules.module_author.pub_time,
                avater_url: OBJECT.dynamicINFO.data.item.modules.module_author.face,
                share_url: 'https://t.bilibili.com/' + OBJECT.dynamicINFO.data.item.id_str,
                username: checkvip(OBJECT.USERDATA.data.card),
                fans: this.count(OBJECT.USERDATA.data.follower),
                user_shortid: OBJECT.dynamicINFO.data.item.modules.module_author.mid,
                total_favorited: this.count(OBJECT.USERDATA.data.like_num),
                following_count: this.count(OBJECT.USERDATA.data.card.attention),
                Botadapter: this.botadapter,
                dynamicTYPE: '纯文动态'
              })
            )
            await this.e.reply(
              await Render.render('bilibili/comment', {
                Type: '动态',
                CommentsData: await bilicomments(OBJECT),
                CommentLength: String((await bilicomments(OBJECT)?.length) ? await bilicomments(OBJECT).length : 0),
                VideoUrl: 'https://t.bilibili.com/' + OBJECT.dynamicINFO.data.item.id_str,
                ImageLength: OBJECT.dynamicINFO.data.item.modules?.module_dynamic?.major?.draw?.items?.length || '动态中没有附带图片',
                shareurl: '动态分享链接',
                Botadapter: this.botadapter
              })
            )
            break
          }
          default:
            break
        }
        break
      }
      case '直播live': {
        if (OBJECT.room_init_info.data.live_status === 0) {
          await this.e.reply(`${OBJECT.USERDATA.data.card.name} 未开播，正在休息中~`)
          return true
        }
        const img = await Render.render(
          'bilibili/dynamic/DYNAMIC_TYPE_LIVE_RCMD',
          {
            image_url: [{ image_src: OBJECT.live_info.data.user_cover }],
            text: br(OBJECT.live_info.data.title),
            liveinf: br(`${OBJECT.live_info.data.area_name} | 房间号: ${OBJECT.live_info.data.room_id}`),
            username: OBJECT.USERDATA.data.card.name,
            avater_url: OBJECT.USERDATA.data.card.face,
            fans: this.count(OBJECT.USERDATA.data.card.fans),
            create_time: OBJECT.live_info.data.live_time === -62170012800 ? '获取失败' : OBJECT.live_info.data.live_time,
            now_time: 114514,
            share_url: 'https://live.bilibili.com/' + OBJECT.live_info.data.room_id,
            dynamicTYPE: '直播'
          }
        )
        await this.e.reply(img)
        break
      }
      default:
        break
    }
  }

  async getvideo (OBJECT) {
    /** 获取视频 => FFMPEG合成 */
    await FFmpeg.checkEnv()
    if (Config.bilibili.videopriority === true) {
      this.STATUS = '!isLogin'
    }
    switch (this.STATUS) {
      case 'isLogin': {
        const bmp4 = await this.DownLoadFile(
          this.TYPE === 'bilibilivideo' ? OBJECT.DATA.data?.dash?.video[0].base_url : OBJECT.video_url,
          `Bil_V_${this.TYPE === 'bilibilivideo' ? OBJECT.INFODATA.data.bvid : OBJECT.INFODATA.result.episodes[0].bvid}`,
          this.headers,
          '.mp4'
        )
        const bmp3 = await this.DownLoadFile(
          this.TYPE === 'bilibilivideo' ? OBJECT.DATA.data?.dash?.audio[0].base_url : OBJECT.audio_url,
          `Bil_A_${this.TYPE === 'bilibilivideo' ? OBJECT.INFODATA.data.bvid : OBJECT.INFODATA.result.episodes[0].bvid}`,
          this.headers,
          '.mp3'
        )
        if (bmp4.filepath && bmp3.filepath) {
          await FFmpeg.VideoComposite(1,
            bmp4.filepath,
            bmp3.filepath,
            this._path + `/resources/kkkdownload/video/Bil_Result_${this.TYPE === 'bilibilivideo' ? OBJECT.INFODATA.data.bvid : OBJECT.INFODATA.result.episodes[0].bvid}.mp4`,
            /** 根据配置文件 `rmmp4` 重命名 */
            async () => {
              const filePath = this._path + `/resources/kkkdownload/video/${Config.app.rmmp4 ? 'tmp_' + Date.now() : this.downloadfilename}.mp4`
              fs.renameSync(
                this._path + `/resources/kkkdownload/video/Bil_Result_${this.TYPE === 'bilibilivideo' ? OBJECT.INFODATA.data.bvid : OBJECT.INFODATA.result.episodes[0].bvid}.mp4`,
                filePath
              )
              logger.mark('正在尝试删除缓存文件')
              await this.removeFile(bmp4.filepath, true)
              await this.removeFile(bmp3.filepath, true)

              const stats = fs.statSync(filePath)
              const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2)
              if (fileSizeInMB > 75) {
                if (this.botname !== 'TRSS-Yunzai') await this.e.reply(`视频大小: ${fileSizeInMB}MB 正通过群文件上传中...`)
                await this.upload_file({ filepath: filePath, totalBytes: fileSizeInMB }, null, true)
              } else {
                /** 因为本地合成，没有视频直链 */
                await this.upload_file({ filepath: filePath, totalBytes: fileSizeInMB }, null)
              }
            },
            async () => {
              throw new Error('FFMPEG 合成失败')
            }
          )
        }
        break
      }
      case '!isLogin': {
        /** 没登录（没配置ck）情况下直接发直链，传直链在DownLoadVideo()处理 */
        if (OBJECT && OBJECT.DATA && OBJECT.DATA.data && Array.isArray(OBJECT.DATA.data.durl) && OBJECT.DATA.data.durl.length > 0) {
          await this.DownLoadVideo(OBJECT.DATA.data.durl[0].url, Config.app.rmmp4 ? 'tmp_' + Date.now() : this.downloadfilename)
        } else {
          logger.error("无法下载视频,请配置CooKie后重试")
        }
        break
      }
      default:
        break
    }
  }

  async getvideosize (videourl, audiourl, bvid) {
    const videoheaders = await new Networks({ url: videourl, headers: { ...this.headers, Referer: `https://api.bilibili.com/video/${bvid}` } }).getHeaders()
    const audioheaders = await new Networks({ url: audiourl, headers: { ...this.headers, Referer: `https://api.bilibili.com/video/${bvid}` } }).getHeaders()

    const videoSize = videoheaders['content-range']?.match(/\/(\d+)/) ? parseInt(videoheaders['content-range']?.match(/\/(\d+)/)[1], 10) : 0
    const audioSize = audioheaders['content-range']?.match(/\/(\d+)/) ? parseInt(audioheaders['content-range']?.match(/\/(\d+)/)[1], 10) : 0

    const videoSizeInMB = (videoSize / (1024 * 1024)).toFixed(2)
    const audioSizeInMB = (audioSize / (1024 * 1024)).toFixed(2)

    const totalSizeInMB = parseFloat(videoSizeInMB) + parseFloat(audioSizeInMB)
    return totalSizeInMB.toFixed(2)
  }

  async processVideos (data) {
    let results = {}

    for (let video of data.DATA.data.dash.video) {
      let size = await this.getvideosize(video.base_url, data.DATA.data.dash.audio[0].base_url, data.INFODATA.data.bvid)
      results[video.id] = size
    }

    // 将结果对象的值转换为数字，并找到最接近但不超过 Config.app.filelimit 的值
    let sizes = Object.values(results).map(size => parseFloat(size.replace('MB', '')))
    let closestId = null
    let smallestDifference = Infinity

    sizes.forEach((size, index) => {
      if (size <= Config.app.filelimit) {
        let difference = Math.abs(size - Config.app.filelimit)
        if (difference < smallestDifference) {
          smallestDifference = difference
          closestId = Object.keys(results)[index]
        }
      }
    })

    if (closestId !== null) {
      // 找到最接近但不超过文件大小限制的视频清晰度
      const closestQuality = qnd[parseInt(closestId)]
      // 更新 OBJECT.DATA.data.accept_description
      data.DATA.data.accept_description = data.DATA.data.accept_description.filter(desc => desc === closestQuality)
      if (data.DATA.data.accept_description.length === 0) {
        data.DATA.data.accept_description = [closestQuality]
      }
      // 找到对应的视频对象
      const video = data.DATA.data.dash.video.find(video => video.id === parseInt(closestId))
      // 更新 OBJECT.DATA.data.dash.video 数组
      data.DATA.data.dash.video = [video]
    } else {
      // 如果没有找到符合条件的视频，使用最低画质的视频对象
      data.DATA.data.dash.video = [[...data.DATA.data.dash.video].pop()]
      // 更新 OBJECT.DATA.data.accept_description 为最低画质的描述
      data.DATA.data.accept_description = [...data.DATA.data.accept_description].pop()
    }
    return data
  }
}


function checkvip (member) {
  return member.vip.vipStatus === 1
    ? `<span style="color: ${member.vip.nickname_color || '#FB7299'}; font-weight: bold;">${member.name}</span>`
    : `<span style="color: #606060">${member.name}</span>`
}

function br (data) {
  return (data = data.replace(/\n/g, '<br>'))
}

function replacetext (text, obj) {
  for (const tag of obj.data.item.modules.module_dynamic.desc.rich_text_nodes) {
    // 对正则表达式中的特殊字符进行转义
    const escapedText = tag.orig_text.replace(/([.*+?^${}()|[\]\\])/g, '\\$1').replace(/\n/g, '\\n')
    const regex = new RegExp(escapedText, 'g')
    switch (tag.type) {
      case 'RICH_TEXT_NODE_TYPE_TOPIC':
      case 'RICH_TEXT_NODE_TYPE_AT': {
        text = text.replace(regex, `<span style="color: #0C6692;">${tag.orig_text}</span>`)
        break
      }
      case 'RICH_TEXT_NODE_TYPE_LOTTERY': {
        text = text.replace(regex, `<span style="color: #0C6692;"><svg style="width: 65px;height: 65px;margin: 0 -15px -12px 0;" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 20 20" width="20" height="20"><path d="M3.7499750000000005 9.732083333333334C4.095158333333333 9.732083333333334 4.374975 10.011875000000002 4.374975 10.357083333333334L4.374975 15.357083333333334C4.374975 15.899458333333335 4.8147 16.339166666666667 5.357116666666667 16.339166666666667L14.642833333333334 16.339166666666667C15.185250000000002 16.339166666666667 15.625 15.899458333333335 15.625 15.357083333333334L15.625 10.357083333333334C15.625 10.011875000000002 15.904791666666668 9.732083333333334 16.25 9.732083333333334C16.595166666666668 9.732083333333334 16.875 10.011875000000002 16.875 10.357083333333334L16.875 15.357083333333334C16.875 16.589833333333335 15.875625000000001 17.589166666666667 14.642833333333334 17.589166666666667L5.357116666666667 17.589166666666667C4.124341666666667 17.589166666666667 3.124975 16.589833333333335 3.124975 15.357083333333334L3.124975 10.357083333333334C3.124975 10.011875000000002 3.4048 9.732083333333334 3.7499750000000005 9.732083333333334z" fill="currentColor"></path><path d="M2.4106916666666667 7.3214250000000005C2.4106916666666667 6.384516666666666 3.1702083333333335 5.625 4.107116666666667 5.625L15.892833333333334 5.625C16.82975 5.625 17.58925 6.384516666666666 17.58925 7.3214250000000005L17.58925 8.917583333333335C17.58925 9.74225 16.987583333333337 10.467208333333334 16.13125 10.554C15.073666666666668 10.661208333333335 13.087708333333333 10.803583333333334 10 10.803583333333334C6.912275 10.803583333333334 4.9263 10.661208333333335 3.8687250000000004 10.554C3.0123833333333336 10.467208333333334 2.4106916666666667 9.74225 2.4106916666666667 8.917583333333335L2.4106916666666667 7.3214250000000005zM4.107116666666667 6.875C3.8605666666666667 6.875 3.6606916666666667 7.0748750000000005 3.6606916666666667 7.3214250000000005L3.6606916666666667 8.917583333333335C3.6606916666666667 9.135250000000001 3.8040833333333333 9.291041666666667 3.9947583333333334 9.310375C5.0068 9.412958333333334 6.950525000000001 9.553583333333334 10 9.553583333333334C13.049458333333334 9.553583333333334 14.993166666666669 9.412958333333334 16.005166666666668 9.310375C16.195875 9.291041666666667 16.33925 9.135250000000001 16.33925 8.917583333333335L16.33925 7.3214250000000005C16.33925 7.0748750000000005 16.139375 6.875 15.892833333333334 6.875L4.107116666666667 6.875z" fill="currentColor"></path><path d="M5.446408333333333 4.464341666666667C5.446408333333333 3.1329416666666665 6.525716666666667 2.0536333333333334 7.857116666666667 2.0536333333333334C9.188541666666666 2.0536333333333334 10.267833333333334 3.1329416666666665 10.267833333333334 4.464341666666667L10.267833333333334 6.875058333333333L7.857116666666667 6.875058333333333C6.525716666666667 6.875058333333333 5.446408333333333 5.795741666666666 5.446408333333333 4.464341666666667zM7.857116666666667 3.3036333333333334C7.216075000000001 3.3036333333333334 6.696408333333334 3.8233 6.696408333333334 4.464341666666667C6.696408333333334 5.105391666666667 7.216075000000001 5.6250583333333335 7.857116666666667 5.6250583333333335L9.017833333333334 5.6250583333333335L9.017833333333334 4.464341666666667C9.017833333333334 3.8233 8.498166666666668 3.3036333333333334 7.857116666666667 3.3036333333333334z" fill="currentColor"></path><path d="M9.732083333333334 4.464341666666667C9.732083333333334 3.1329416666666665 10.811416666666666 2.0536333333333334 12.142833333333334 2.0536333333333334C13.474250000000001 2.0536333333333334 14.553583333333336 3.1329416666666665 14.553583333333336 4.464341666666667C14.553583333333336 5.795741666666666 13.474250000000001 6.875058333333333 12.142833333333334 6.875058333333333L9.732083333333334 6.875058333333333L9.732083333333334 4.464341666666667zM12.142833333333334 3.3036333333333334C11.501791666666666 3.3036333333333334 10.982083333333334 3.8233 10.982083333333334 4.464341666666667L10.982083333333334 5.6250583333333335L12.142833333333334 5.6250583333333335C12.783875 5.6250583333333335 13.303583333333334 5.105391666666667 13.303583333333334 4.464341666666667C13.303583333333334 3.8233 12.783875 3.3036333333333334 12.142833333333334 3.3036333333333334z" fill="currentColor"></path><path d="M10 4.732058333333334C10.345166666666666 4.732058333333334 10.625 5.011875 10.625 5.357058333333334L10.625 16.428500000000003C10.625 16.773666666666667 10.345166666666666 17.053500000000003 10 17.053500000000003C9.654791666666668 17.053500000000003 9.375 16.773666666666667 9.375 16.428500000000003L9.375 5.357058333333334C9.375 5.011875 9.654791666666668 4.732058333333334 10 4.732058333333334z" fill="currentColor"></path></svg> ${tag.orig_text}</span>`)
        break
      }
      case 'RICH_TEXT_NODE_TYPE_WEB': {
        text = text.replace(regex, `<span style="color: #0C6692;"><svg style="width: 60px;height: 60px;margin: 0 -15px -12px 0;" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 20 20" width="20" height="20"><path d="M9.571416666666666 7.6439C9.721125 7.33675 10.091416666666667 7.209108333333334 10.398583333333335 7.358808333333333C10.896041666666667 7.540316666666667 11.366333333333333 7.832000000000001 11.767333333333333 8.232975C13.475833333333334 9.941541666666668 13.475833333333334 12.711625 11.767333333333333 14.420166666666669L9.704916666666666 16.482583333333334C7.996383333333334 18.191125000000003 5.226283333333334 18.191125000000003 3.5177416666666668 16.482583333333334C1.8091916666666668 14.774041666666669 1.8091916666666668 12.003916666666667 3.5177416666666668 10.295375L5.008791666666667 8.804333333333334C5.252875 8.56025 5.6486 8.56025 5.892683333333334 8.804333333333334C6.136758333333334 9.048416666666668 6.136758333333334 9.444125000000001 5.892683333333334 9.688208333333334L4.401625 11.179250000000001C3.1812333333333336 12.399666666666667 3.1812333333333336 14.378291666666668 4.401625 15.598708333333335C5.622000000000001 16.819083333333335 7.60065 16.819083333333335 8.821041666666668 15.598708333333335L10.883416666666667 13.536291666666667C12.103833333333334 12.315916666666666 12.103833333333334 10.337250000000001 10.883416666666667 9.116875C10.582458333333333 8.815875 10.229416666666667 8.600908333333333 9.856458333333334 8.471066666666667C9.549333333333333 8.321375 9.421708333333335 7.9510499999999995 9.571416666666666 7.6439z" fill="currentColor"></path><path d="M15.597541666666668 4.402641666666667C14.377166666666668 3.1822500000000002 12.398541666666667 3.1822500000000002 11.178125000000001 4.402641666666667L9.11575 6.465033333333333C7.895358333333333 7.685425 7.895358333333333 9.664041666666668 9.11575 10.884458333333333C9.397666666666668 11.166375 9.725916666666667 11.371583333333334 10.073083333333333 11.500958333333333C10.376583333333334 11.658083333333334 10.495291666666667 12.031416666666667 10.338208333333332 12.334875C10.181083333333333 12.638375 9.80775 12.757083333333334 9.504291666666667 12.6C9.042416666666666 12.420333333333334 8.606383333333333 12.142833333333334 8.231858333333333 11.768333333333334C6.523316666666667 10.059791666666667 6.523316666666667 7.289691666666666 8.231858333333333 5.58115L10.29425 3.5187583333333334C12.002791666666667 1.8102083333333334 14.772875 1.8102083333333334 16.481458333333336 3.5187583333333334C18.19 5.2273000000000005 18.19 7.997400000000001 16.481458333333336 9.705916666666667L15.054916666666667 11.132458333333334C14.810875000000001 11.3765 14.415166666666668 11.3765 14.171041666666667 11.132458333333334C13.927 10.888333333333334 13.927 10.492625 14.171041666666667 10.248541666666666L15.597541666666668 8.822041666666667C16.81791666666667 7.601666666666667 16.81791666666667 5.623025 15.597541666666668 4.402641666666667z" fill="currentColor"></path></svg> ${tag.text}</span>`)
        break
      }
      case 'RICH_TEXT_NODE_TYPE_EMOJI': {
        const regex = new RegExp(tag.orig_text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
        text = text.replace(regex, `<img src='${tag.emoji.icon_url}' style='height: 60px; margin: 0 0 -10px 0;'>`)
        break
      }
    }
  }
  return text
}

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
