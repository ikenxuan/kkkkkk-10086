import { base, image, Config, common } from '#modules'
import { BiLiBiLiAPI, bilidata, bilicomments, checkuser } from '#bilibili'
import ffmpeg from '../ffmpeg.js'
import fs from 'fs'
import exp from 'constants'

export default class BiLiBiLi extends base {
  constructor(e = {}, data) {
    super()
    this.e = e
    this.STATUS = data.USER?.STATUS
    this.ISVIP = data.USER?.isvip
    this.TYPE = data.TYPE
    this.islogin = data.USER?.STATUS === 'isLogin' ? true : false
    this.downloadfilename = ''
    this.headers['Referer'] = 'https://api.bilibili.com/'
    this.headers['Cookie'] = this.Config.bilibilick
  }

  async RESOURCES(OBJECT, Episode = false) {
    Config.bilibilitip ? this.e.reply('检测到B站链接，开始解析') : null
    switch (this.TYPE) {
      case 'bilibilivideo':
        const { desc, owner, pic, title, stat } = OBJECT.INFODATA.data
        const { name, face } = owner
        const { coin, like, share, view, favorite, danmaku } = stat
        this.downloadfilename = title.substring(0, 50).replace(/[\\/:\*\?"<>\|\r\n\s]/g, ' ')

        await this.e.reply(
          this.mkMsg(
            [
              segment.image(pic),
              `\n# 标题: ${title}\n`,
              `\n作者: ${name}\n播放量: ${await this.count(view)},    弹幕: ${await this.count(danmaku)}\n点赞: ${await this.count(
                like,
              )},    投币: ${await this.count(coin)}\n转发: ${await this.count(share)},    收藏: ${await this.count(favorite)}`,
            ],
            [
              {
                text: this.islogin ? 'https://b23.tv/' + OBJECT.INFODATA.data.bvid : '视频直链',
                link: this.islogin ? 'https://b23.tv/' + OBJECT.INFODATA.data.bvid : OBJECT.DATA.data.durl[0].url,
              },
            ],
          ),
        )

        let videoSize
        if (this.islogin) {
          videoSize = await this.getvideosize(OBJECT.DATA.data.dash.video[0].base_url, OBJECT.DATA.data.dash.audio[0].base_url)
        } else {
          videoSize = (OBJECT.DATA.data.durl[0].size / (1024 * 1024)).toFixed(2)
        }
        const commentsdata = await bilicomments(OBJECT)
        let img = await image(this.e, 'bilibili/bilicomment', 'kkkkkk-10086/bilibili/bilicomment', {
          saveId: 'bilicomment',
          Type: '视频',
          CommentsData: commentsdata,
          CommentLength: String(commentsdata?.length ? commentsdata.length : 0),
          VideoUrl: this.islogin ? 'https://www.bilibili.com/' + OBJECT.INFODATA.data.bvid : OBJECT.DATA.data.durl[0].url,
          Clarity: OBJECT.DATA.data.accept_description[0],
          VideoSize: videoSize,
          ImageLength: 0,
          shareurl: this.islogin ? 'https://b23.tv/' + OBJECT.INFODATA.data.bvid : '视频直链(永久)',
          Botadapter: this.botadapter,
        })
        Config.commentsimg
          ? await this.e.reply(
              this.mkMsg(img, [
                {
                  text: this.islogin ? 'https://b23.tv/' + OBJECT.INFODATA.data.bvid : '视频直链',
                  link: this.islogin ? 'https://b23.tv/' + OBJECT.INFODATA.data.bvid : OBJECT.DATA.data.durl[0].url,
                },
              ]),
            )
          : null
        await this.getvideo(OBJECT)
        break
      case 'bangumivideo':
        if (!Episode) {
          let barray = []
          let msg = []
          for (var i = 0; i < OBJECT.INFODATA.result.episodes.length; i++) {
            const totalEpisodes = OBJECT.INFODATA.result.episodes.length
            const long_title = OBJECT.INFODATA.result.episodes[i].long_title
            const badge = OBJECT.INFODATA.result.episodes[i].badge
            const short_link = OBJECT.INFODATA.result.episodes[i].short_link
            barray.push({
              id: i + 1,
              totalEpisodes,
              long_title,
              badge: badge === '' ? '暂无' : badge,
              short_link,
            })
            msg.push([
              `\n> ## 第${i + 1}集`,
              `\n> 标题: ${long_title}`,
              `\n> 类型: ${badge !== '预告' ? '正片' : '预告'}`,
              `\n> 🔒 播放要求: ${badge === '预告' || badge === '' ? '暂无' : badge}`,
              this.botadapter !== 'QQBot' ? `\n> 🔗 分享链接: [🔗点击查看](${short_link})\r\r` : '',
            ])
          }
          let img = await image(this.e, 'bilibili/bangumi', 'kkkkkk-10086/bilibili/bangumi', {
            saveId: 'bangumi',
            bangumiData: barray,
            Botadapter: this.botadapter,
            title: OBJECT.INFODATA.result.title,
          })
          global.BILIBILIOBJECT = OBJECT
          msg = msg
            .flat(Infinity)
            .map((str) => {
              return str.replace(/,\s*$/, '')
            })
            .join('')
          this.e.reply(
            this.mkMsg(this.botadapter === 'ICQQ' ? img : `# ${OBJECT.INFODATA.result.season_title}\n---\n${msg}\r\r---\n请在60秒内输入 第?集 选择集数`, [
              { text: '第1集', callback: '第1集' },
              { text: '第2集', callback: '第2集' },
              { text: '第?集', input: '第' },
            ]),
          )
        } else {
          this.downloadfilename = OBJECT.INFODATA.result.episodes[Number(OBJECT.Episode - 1)].share_copy.substring(0, 50).replace(/[\\/:\*\?"<>\|\r\n\s]/g, ' ')
          const bangumidataBASEURL = BiLiBiLiAPI.bangumidata(
            OBJECT.INFODATA.result.episodes[Number(OBJECT.Episode - 1)].cid,
            OBJECT.INFODATA.result.episodes[Number(OBJECT.Episode - 1)].ep_id,
          )
          const QUERY = await checkuser(bangumidataBASEURL)
          const bangumiDATA = await new bilidata().GlobalGetData({
            url: bangumidataBASEURL + QUERY.QUERY,
            headers: this.headers,
          })
          if (OBJECT.INFODATA.result.episodes[Number(OBJECT.Episode - 1)].badge === '会员' && !this.ISVIP) return logger.warn('该CK不是大会员，无法获取视频流')
          OBJECT.DATA = bangumiDATA
          await this.getvideo({
            ...OBJECT,
            video_url: this.ISVIP ? OBJECT.DATA.result.dash.video[0].base_url : OBJECT.DATA.result.dash.video[0].base_url,
            audio_url: OBJECT.DATA.result.dash.audio[0].base_url,
          })
        }
      case 'bilibilidynamic':
        switch (OBJECT.dynamicINFO.data.item.type) {
          /** 图文、纯图 */
          case 'DYNAMIC_TYPE_DRAW':
            const imgArray = []
            for (const img of OBJECT.dynamicINFO.data.item.modules.module_dynamic.major.draw.items) {
              imgArray.push(segment.image(img.src))
            }
            const commentsdata = await bilicomments(OBJECT)
            let img = await image(this.e, 'bilibili/bilicomment', 'kkkkkk-10086/bilibili/bilicomment', {
              saveId: 'bilicomment',
              Type: '动态',
              CommentsData: commentsdata,
              CommentLength: String(commentsdata?.length ? commentsdata.length : 0),
              VideoUrl: 'https://t.bilibili.com/' + OBJECT.dynamicINFO.data.item.id_str,
              ImageLength: OBJECT.dynamicINFO.data.item.modules?.module_dynamic?.major?.draw?.items?.length || '动态中没有附带图片',
              shareurl: '动态分享链接',
              Botadapter: this.botadapter,
            })
            switch (this.botadapter) {
              case 'ICQQ':
              case 'LagrangeCore':
              case 'OneBotv11':
                imgArray.length > 1 ? await this.e.reply(await common.makeForwardMsg(this.e, imgArray)) : await this.e.reply(imgArray[0])
                Config.bilibilicommentsimg ? await this.e.reply(img) : null
                break
              case 'QQBot':
              case 'KOOKBot':
                imgArray.length > 1 ? this.e.reply(await common.makeForwardMsg(this.e, imgArray)) : await this.e.reply(imgArray[0])
                Config.bilibilicommentsimg ? await this.e.reply(img) : null
                break
            }
            break
          /** 纯文 */
          case 'DYNAMIC_TYPE_WORD':
            const text = OBJECT.dynamicINFO.data.item.modules.module_dynamic.desc.text
            this.e.reply(
              await image(this.e, 'bilibili/biliinfo', 'kkkkkk-10086/douyin/musicinfo', {
                saveId: 'biliinfo',
                text: text,
                dianzan: await this.count(OBJECT.dynamicINFO.data.item.modules.module_stat.like.count),
                pinglun: await this.count(OBJECT.dynamicINFO.data.item.modules.module_stat.comment.count),
                share: await this.count(OBJECT.dynamicINFO.data.item.modules.module_stat.forward.count),
                create_time: OBJECT.dynamicINFO.data.item.modules.module_author.pub_time,
                avater_url: OBJECT.dynamicINFO.data.item.modules.module_author.face,
                share_url: 'https://t.bilibili.com/' + OBJECT.dynamicINFO.data.item.id_str,
                username: checkvip(OBJECT.USERDATA.data.card),
                fans: await this.count(OBJECT.USERDATA.data.follower),
                user_shortid: OBJECT.dynamicINFO.data.item.modules.module_author.mid,
                total_favorited: await this.count(OBJECT.USERDATA.data.like_num),
                following_count: await this.count(OBJECT.USERDATA.data.card.attention),
                Botadapter: this.botadapter,
              }),
            )
            this.e.reply(
              await image(this.e, 'bilibili/bilicomment', 'kkkkkk-10086/douyin/musicinfo', {
                saveId: 'bilicomment',
                Type: '动态',
                CommentsData: await bilicomments(OBJECT),
                CommentLength: String((await bilicomments(OBJECT)?.length) ? await bilicomments(OBJECT).length : 0),
                VideoUrl: 'https://t.bilibili.com/' + OBJECT.dynamicINFO.data.item.id_str,
                ImageLength: OBJECT.dynamicINFO.data.item.modules?.module_dynamic?.major?.draw?.items?.length || '动态中没有附带图片',
                shareurl: '动态分享链接',
                Botadapter: this.botadapter,
              }),
            )
            break
          /** 转发 */
          case 'DYNAMIC_TYPE_FORWARD':
        }
    }
  }

  async getvideo(OBJECT) {
    /** 获取视频 => FFMPEG合成 */
    await ffmpeg.checkEnv()
    switch (this.STATUS) {
      case 'isLogin':
        const bmp4 = await this.DownLoadFile(
          this.TYPE === 'bilibilivideo' ? OBJECT.DATA.data?.dash?.video[0].base_url : OBJECT.video_url,
          `Bil_V_${this.TYPE === 'bilibilivideo' ? OBJECT.INFODATA.data.bvid : OBJECT.INFODATA.result.episodes[0].bvid}`,
          this.headers,
          '.mp4',
        )
        const bmp3 = await this.DownLoadFile(
          this.TYPE === 'bilibilivideo' ? OBJECT.DATA.data?.dash?.audio[0].base_url : OBJECT.audio_url,
          `Bil_A_${this.TYPE === 'bilibilivideo' ? OBJECT.INFODATA.data.bvid : OBJECT.INFODATA.result.episodes[0].bvid}`,
          this.headers,
          '.mp3',
        )
        if (bmp4.filepath && bmp3.filepath) {
          ffmpeg.VideoComposite(
            bmp4.filepath,
            bmp3.filepath,
            this._path +
              `/resources/kkkdownload/video/Bil_Result_${
                this.TYPE === 'bilibilivideo' ? OBJECT.INFODATA.data.bvid : OBJECT.INFODATA.result.episodes[0].bvid
              }.mp4`,
            /** 根据配置文件 `rmmp4` 重命名 */
            async () => {
              const filePath = this._path + `/resources/kkkdownload/video/${Config.rmmp4 ? 'ktmp_' + Date.now() : this.downloadfilename}.mp4`
              fs.renameSync(
                this._path +
                  `/resources/kkkdownload/video/Bil_Result_${
                    this.TYPE === 'bilibilivideo' ? OBJECT.INFODATA.data.bvid : OBJECT.INFODATA.result.episodes[0].bvid
                  }.mp4`,
                filePath,
              )
              await this.removeFileOrFolder(bmp4.filepath, true)
              await this.removeFileOrFolder(bmp3.filepath, true)

              const stats = fs.statSync(filePath)
              const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2)
              if (fileSizeInMB > 75) {
                this.botname === 'trss-yunzai' ? null : this.e.reply(`视频大小: ${fileSizeInMB}MB 正通过群文件上传中...`)
                await this.upload_file({ filepath: filePath, totalBytes: fileSizeInMB }, null, true)
              } else {
                /** 因为本地合成，没有视频直链 */
                await this.upload_file({ filepath: filePath, totalBytes: fileSizeInMB }, null)
              }
            },
            async () => {
              throw new Error('FFMPEG 合成失败')
            },
          )
        }
        break
      case '!isLogin':
        /** 没登录（没配置ck）情况下直接发直链，传直链在DownLoadVideo()处理 */
        await this.DownLoadVideo(OBJECT.DATA.data.durl[0].url, Config.rmmp4 ? 'ktmp_' + Date.now() : this.downloadfilename)
        break
    }
  }

  async getvideosize(videourl, audiourl) {
    const videoheaders = await new this.networks({ url: videourl, headers: { ...this.headers, Referer: 'https://api.bilibili.com/' } }).getHeaders()
    const audioheaders = await new this.networks({ url: audiourl, headers: { ...this.headers, Referer: 'https://api.bilibili.com/' } }).getHeaders()

    const videoSize = videoheaders['content-length'] ? parseInt(videoheaders['content-length'], 10) : 0
    const audioSize = audioheaders['content-length'] ? parseInt(audioheaders['content-length'], 10) : 0

    const videoSizeInMB = (videoSize / (1024 * 1024)).toFixed(2)
    const audioSizeInMB = (audioSize / (1024 * 1024)).toFixed(2)

    const totalSizeInMB = parseFloat(videoSizeInMB) + parseFloat(audioSizeInMB)
    return totalSizeInMB.toFixed(2)
  }
}
function checkvip(member) {
  return member.vip.vipStatus === 1
    ? `<span style="color: ${member.vip.nickname_color || '#FB7299'}; font-weight: bold;">${member.name}</span>`
    : `<span style="color: #606060">${member.name}</span>`
}
