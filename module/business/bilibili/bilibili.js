import { Base, Render, Config, Networks, FFmpeg } from '#components'
import { Bilidata, bilicomments, checkuser } from '#bilibili'
import { BiLiBiLiAPI } from '@ikenxuan/amagi'
import { makeForwardMsg, segment, logger } from '#lib'
import fs from 'fs'

let img

export default class BiLiBiLi extends Base {
  constructor (e = {}, data) {
    super()
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
    !Episode && Config.bilibili.bilibilitip && this.e.reply('检测到B站链接，开始解析')
    switch (this.TYPE) {
      case 'bilibilivideo': {
        const { owner, pic, title, stat } = OBJECT.INFODATA.data
        const { name } = owner
        const { coin, like, share, view, favorite, danmaku } = stat

        this.downloadfilename = title.substring(0, 50).replace(/[\\/:\*\?"<>\|\r\n\s]/g, ' ')

        const nocd_data = await new Networks({
          url: BiLiBiLiAPI.视频流信息({ avid: OBJECT.INFODATA.data.aid, cid: OBJECT.INFODATA.data.cid }) + '&platform=html5',
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

        let videoSize
        if (this.islogin) {
          videoSize = await this.getvideosize(OBJECT.DATA.data.dash.video[0].base_url, OBJECT.DATA.data.dash.audio[0].base_url)
        } else {
          videoSize = (OBJECT.DATA.data.durl[0].size / (1024 * 1024)).toFixed(2)
        }
        const commentsdata = await bilicomments(OBJECT)
        img = await Render.render('html/bilibili/bilicomment', {
          Type: '视频',
          CommentsData: commentsdata,
          CommentLength: String(commentsdata?.length ? commentsdata.length : 0),
          VideoUrl: 'https://b23.tv/' + OBJECT.INFODATA.data.bvid,
          Clarity: OBJECT.DATA.data.accept_description[0],
          VideoSize: videoSize,
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
          await this.e.reply('视频太大了，还是去B站看吧~', true)
        } else await this.getvideo(OBJECT)
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
          img = await Render.render('html/bilibili/bangumi', {
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
          this.e.reply(
            this.mkMsg(this.botadapter === 'QQBot' ? `# ${OBJECT.INFODATA.result.season_title}\n---\n${msg}\r\r---\n请在60秒内输入 第?集 选择集数` : img, [
              { text: '第1集', callback: '第1集' },
              { text: '第2集', callback: '第2集' },
              { text: '第?集', input: '第' }
            ])
          )
        } else {

          this.downloadfilename = OBJECT.INFODATA.result.episodes[Number(OBJECT.Episode - 1)].share_copy.substring(0, 50).replace(/[\\/:\*\?"<>\|\r\n\s]/g, ' ')
          const bangumidataBASEURL = BiLiBiLiAPI.番剧视频流信息({
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
            img = await Render.render('html/bilibili/bilicomment', {
              Type: '动态',
              CommentsData: commentsdata,
              CommentLength: String(commentsdata?.length ? commentsdata.length : 0),
              VideoUrl: 'https://t.bilibili.com/' + OBJECT.dynamicINFO.data.item.id_str,
              ImageLength: OBJECT.dynamicINFO.data.item.modules?.module_dynamic?.major?.draw?.items?.length || '动态中没有附带图片',
              shareurl: '动态分享链接'
            })
            if (imgArray.length === 1) this.e.reply(imgArray[0])
            if (imgArray.length > 1) await this.e.reply([ 'QQBot', 'KOOKBot' ].includes(this.botadapter) ? imgArray : await makeForwardMsg(this.e, imgArray))
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
            img = await Render.render('html/bilibili/dynamic/DYNAMIC_TYPE_DRAW', {
              image_url: cover(),
              text: br(OBJECT.dynamicINFO.data.item.modules.module_dynamic.desc.text),
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
            })
            if (Config.bilibili.bilibilicommentsimg) await this.e.reply(this.mkMsg(img, [ { text: '加纳~', send: true } ]))
            break
          }
          /** 纯文 */
          case 'DYNAMIC_TYPE_WORD': {
            const text = OBJECT.dynamicINFO.data.item.modules.module_dynamic.desc.text
            this.e.reply(
              await Render.render('html/bilibili/dynamic/DYNAMIC_TYPE_WORD', {
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
            this.e.reply(
              await Render.render('html/bilibili/bilicomment', {
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

      }
      case '直播live': {
        if (OBJECT.room_init_info.data.live_status === 0) {
          this.e.reply(`${OBJECT.USERDATA.data.card.name} 未开播，正在休息中~`)
          return true
        }
        const img = await Render.render(
          'html/bilibili/dynamic/DYNAMIC_TYPE_LIVE_RCMD',
          {
            image_url: [ { image_src: OBJECT.live_info.data.user_cover } ],
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
        this.e.reply(img)
        break

      }
      default:
        break
    }
  }

  async getvideo (OBJECT) {
    /** 获取视频 => FFMPEG合成 */
    await FFmpeg.checkEnv()
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
          FFmpeg.VideoComposite(1,
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
              await this.removeFile(bmp4.filepath, true)
              await this.removeFile(bmp3.filepath, true)

              const stats = fs.statSync(filePath)
              const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2)
              if (fileSizeInMB > 75) {
                if (this.botname !== 'trss-yunzai') this.e.reply(`视频大小: ${fileSizeInMB}MB 正通过群文件上传中...`)
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
      case '!isLogin':{
      /** 没登录（没配置ck）情况下直接发直链，传直链在DownLoadVideo()处理 */
        await this.DownLoadVideo(OBJECT.DATA.data.durl[0].url, Config.app.rmmp4 ? 'tmp_' + Date.now() : this.downloadfilename)
        break
      }
      default:
        break
    }
  }

  async getvideosize (videourl, audiourl) {
    const videoheaders = await new Networks({ url: videourl, headers: { ...this.headers, Referer: 'https://api.bilibili.com/' } }).getHeaders()
    const audioheaders = await new Networks({ url: audiourl, headers: { ...this.headers, Referer: 'https://api.bilibili.com/' } }).getHeaders()

    const videoSize = videoheaders['content-length'] ? parseInt(videoheaders['content-length'], 10) : 0
    const audioSize = audioheaders['content-length'] ? parseInt(audioheaders['content-length'], 10) : 0

    const videoSizeInMB = (videoSize / (1024 * 1024)).toFixed(2)
    const audioSizeInMB = (audioSize / (1024 * 1024)).toFixed(2)

    const totalSizeInMB = parseFloat(videoSizeInMB) + parseFloat(audioSizeInMB)
    return totalSizeInMB.toFixed(2)
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
