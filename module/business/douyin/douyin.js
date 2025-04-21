import { Base, Config, UploadRecord, Networks, Render, FFmpeg, Version } from '../../components/index.js'
import { DouyinData, Emoji, comments } from './index.js'
import { makeForwardMsg, segment, logger } from '../../lib/public/index.js'
import fs from 'fs'
import { markdown } from '@karinjs/md-html'
import QRCode from 'qrcode'
import { getDouyinData } from '@ikenxuan/amagi'

let mp4size = ''
let img
let m_id

export default class DouYin extends Base {
  constructor (e = {}, iddata) {
    super()
    /**
     * @type { import('node-karin').KarinMessage }
     */
    this.e = e
    this.type = iddata?.type
    this.is_mp4 = iddata?.is_mp4
    if (Config.app.sendforwardmsg && this.botname === 'Karin') {
      Config.modify('app', 'sendforwardmsg', false)
    }
  }

  async RESOURCES (data) {
    switch (this.type) {
      case 'video':
      case 'note': {
        if (Config.douyin.douyintip) this.e.reply('检测到抖音链接，开始解析')
        let g_video_url
        let g_title
        const full_data = []

        /** 图集 */
        let imagenum = 0
        const image_res = []
        if (this.is_mp4 === false) {
          const image_data = []
          const imageres = []
          let image_url
          for (let i = 0; i < data.VideoData.aweme_detail.images.length; i++) {
            image_url = data.VideoData.aweme_detail.images[i].url_list[2] || data.VideoData.aweme_detail.images[i].url_list[1] // 图片地址

            const title = data.VideoData.aweme_detail.preview_title.substring(0, 50).replace(/[\\/:\*\?"<>\|\r\n]/g, ' ') // 标题，去除特殊字符
            g_title = title
            let imgresp
            if (this.botadapter === 'QQBot') {
              let sharp
              try {
                ; ({ default: sharp } = await import('sharp'))
                imgresp = new Uint8Array(await new Networks({ url: image_url, type: 'arrayBuffer' }).getData())
                imgresp = await sharp(imgresp).toFormat('jpeg').toBuffer()
              } catch {
                logger.error('依赖: sharp 未正确安装，QQBot发送图集图片可能出现异常')
              }
            }
            imageres.push(segment.image(this.botadapter === 'QQBot' ? imgresp : image_url))
            imagenum++
            if (Config.douyin.rmmp4 === false) {
              await this.mkdirs(process.cwd() + `/resources/kkkdownload/images/${g_title}`)
              const path = process.cwd() + `/resources/kkkdownload/images/${g_title}/${i + 1}.png`
              await new Networks({ url: image_url, type: 'arrayBuffer' }).getData().then((data) => fs.promises.writeFile(path, Buffer.from(data)))
            }
          }
          const dsc = '解析完的图集图片'
          const res = await makeForwardMsg(this.e, imageres, dsc)
          image_data.push(res)
          image_res.push(image_data)
          if (imageres.length === 1) {
            await this.e.reply(segment.image(image_url))
          } else {
            !Config.app.sendforwardmsg && (this.botname === 'Karin' ? res.length : res.data.length) > 1 && this.botname === 'Karin' ? await this.e.bot.sendForwardMessage(this.e.contact, res) : await this.e.reply(res)
          }
        } else {
          image_res.push('图集信息解析失败')
        }

        /** 作者 */
        const author_res = []
        if (data.VideoData.aweme_detail.author) {
          const author_data = []
          const authorres = []
          const author = data.VideoData.aweme_detail.author
          const sc = this.count(author.favoriting_count) // 收藏
          const gz = this.count(author.follower_count) // 关注
          const id = author.nickname // id
          const jj = author.signature // 简介
          const age = author.user_age // 年龄
          const sczs = author.total_favorited
          authorres.push(`创作者名称：${id}`)
          authorres.push(`创作者：${id}拥有${gz}个粉丝，${sc}个收藏和${sczs}个收藏总数`)
          authorres.push(`${id}今年${age}岁，Ta的简介是：\n${jj}`)
          const dsc = '创作者信息'
          const res = await makeForwardMsg(this.e, authorres, dsc)
          author_data.push(res)
          author_res.push(author_data)
        }

        /** 背景音乐 */
        const music_res = []
        if (data.VideoData.aweme_detail.music) {
          const music_data = []
          const musicres = []
          const music = data.VideoData.aweme_detail.music
          m_id = music.mid
          const music_name = music.author // BGM名字
          const music_img = music.cover_hd.url_list[0] // BGM作者头像
          const music_url = music.play_url.uri // BGM link
          if (this.is_mp4 === false && Config.douyin.rmmp4 === false && music_url !== undefined) {
            try {
              const path = process.cwd() + `/resources/kkkdownload/images/${g_title}/BGM.mp3`
              await new Networks({ url: music_url, type: 'arrayBuffer' }).getData().then((data) => fs.promises.writeFile(path, Buffer.from(data)))
            } catch (error) {
              console.log(error)
            }
          }
          musicres.push(`BGM名字：${music_name}`)
          musicres.push(`BGM下载直链：${music_url}`)
          musicres.push(segment.image(music_img))
          const dsc = 'BGM相关信息'
          const res = await makeForwardMsg(this.e, musicres, dsc)
          music_data.push(res)
          music_res.push(music_data)
          const haspath = music_url && this.is_mp4 === false && music_url !== undefined
          switch (this.botname) {
            case 'Miao-Yunzai':
            case 'yunzai': {
              if (haspath && this.botadapter === 'ICQQ') {
                if (Config.douyin.sendHDrecord) await this.e.reply(await UploadRecord(this.e, music_url, 0, false))
                else await this.e.reply(segment.record(music_url))
              } else if (haspath && this.botadapter !== 'ICQQ') {
                await this.e.reply(segment.record(music_url))
              }
              break
            }
            case 'TRSS-Yunzai': {
              switch (this.botadapter) {
                case 'QQBot':
                case 'OneBotv11':
                case 'LagrangeCore':
                case 'KOOKBot': {
                  if (haspath) {
                    await this.e.reply(segment.record(music_url))
                  }
                  break
                }
                case 'ICQQ': {
                  if (haspath) {
                    if (Config.douyin.sendHDrecord) await this.e.reply(await UploadRecord(this.e, music_url, 0, false))
                    else this.e.reply(segment.record(music_url))
                  }
                  break
                }
              }
              break
            }
            case 'Karin': {
              haspath && await this.e.reply(segment.record(music_url))
              break
            }
            default:
              break

          }
        }

        /** 视频 */
        let FPS
        const video_res = []
        let sendvideofile = true
        if (this.is_mp4) {
          const video_data = []
          const videores = []
          // 视频地址特殊判断：play_addr_h264、play_addr、
          const video = data.VideoData.aweme_detail.video
          FPS = video.bit_rate[0].FPS // FPS
          if (data.VideoData.aweme_detail.video.play_addr_h264) {
            g_video_url = await new Networks({
              url: video.play_addr_h264.url_list[2],
              headers: this.headers
            }).getLongLink()
          } else if (data.VideoData.aweme_detail.video.play_addr) {
            g_video_url = await new Networks({
              url: video.play_addr.url_list[0],
              headers: this.headers
            }).getLongLink()
          }
          const cover = video.origin_cover.url_list[0] // video cover image

          const title = data.VideoData.aweme_detail.preview_title.substring(0, 80).replace(/[\\/:\*\?"<>\|\r\n]/g, ' ') // video title
          g_title = title
          mp4size = (video.play_addr.data_size / (1024 * 1024)).toFixed(2)
          if (Config.app.usefilelimit && Number(mp4size) > Number(Config.app.filelimit)) {
            sendvideofile = false
          }
          videores.push(`标题：\n${title}`)
          videores.push(`视频帧率：${'' + FPS}\n视频大小：${mp4size}MB`)
          videores.push(
            `永久直链(302跳转)\nhttps://aweme.snssdk.com/aweme/v1/play/?video_id=${data.VideoData.aweme_detail.video.play_addr.uri}&ratio=1080p&line=0`
          )
          videores.push(`视频直链（有时效性，永久直链在下一条消息）：\n${g_video_url}`)
          videores.push(segment.image(cover))
          g_video_url = `https://aweme.snssdk.com/aweme/v1/play/?video_id=${data.VideoData.aweme_detail.video.play_addr.uri}&ratio=1080p&line=0`
          logger.info('视频地址', g_video_url)
          const dsc = this.botname === 'Miao-Yunzai' ? '视频基本信息' : null
          const res = await makeForwardMsg(this.e, videores, dsc)
          video_data.push(res)
          video_res.push(video_data)
        }

        let file = null
        if (Config.douyin.commentsimg && Config.douyin.comments) {
          const EmojiData = await new DouyinData('Emoji').GetData()
          const list = await Emoji(EmojiData)
          const commentsArray = await comments(data.CommentsData, list)
          img = await Render.render(
            'html/douyin/comment',
            {
              Type: this.is_mp4 ? '视频' : '图集',
              CommentsData: commentsArray,
              CommentLength: String(commentsArray.jsonArray?.length ? commentsArray.jsonArray.length : 0),
              VideoUrl: this.is_mp4
                ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${data.VideoData.aweme_detail.video.play_addr.uri}&ratio=1080p&line=0`
                : data.VideoData.aweme_detail.share_url,
              Title: g_title,
              VideoSize: mp4size,
              VideoFPS: FPS,
              ImageLength: imagenum,
              DestroyTime: Time(2),
              botname: this.botname
            }
          )
          file = img
          await this.e.reply(
            this.mkMsg(img, [
              {
                text: this.is_mp4 ? '视频直链' : '图集分享链接',
                link: this.is_mp4
                  ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${data.VideoData.aweme_detail.video.play_addr.uri}&ratio=1080p&line=0`
                  : data.VideoData.aweme_detail.share_url
              },
              this.is_mp4
                ? {
                  text: '背景音乐',
                  input: 'BGM' + m_id,
                  send: true
                }
                : {}
            ])
          )
        }

        const tip = ['视频正在上传']
        let res
        if (this.is_mp4) {
          res = full_data
            .concat(tip)
            .concat(Config.douyin.commentsimg ? file : null)
            .concat(video_res)
            .concat(music_res)
            .concat(author_res)
        } else {
          res = full_data
            .concat(Config.douyin.commentsimg ? file : null)
            .concat(video_res)
            .concat(image_res)
            .concat(music_res)
            .concat(author_res)
        }
        let dec
        if (this.is_mp4 !== true) {
          dec = '抖音图集作品数据'
        } else {
          dec = '抖音视频作品数据'
        }
        !sendvideofile && await this.e.reply(`设定的最大上传大小为 ${Config.app.filelimit}MB\n当前解析到的视频大小为 ${Number(mp4size)}MB\n` + '视频太大了，还是去抖音看吧~', true)
        /** 发送套娃转发消息 */
        Config.app.sendforwardmsg && await this.e.reply(await makeForwardMsg(this.e, res, dec))
        /** 发送视频 */
        sendvideofile && this.is_mp4 && await this.DownLoadVideo(g_video_url, Config.app.rmmp4 ? 'tmp_' + Date.now() : g_title)
        return true
      }

      case 'LiveImage': {
        const images = []
        const bgmurl = data.LiveImageData.aweme_details[0].music.play_url.uri
        for (const item of data.LiveImageData.aweme_details[0].images) {
          // 静态图片，clip_type为2
          if (item.clip_type === 2) {
            images.push(`动图直链:\nhttps://aweme.snssdk.com/aweme/v1/play/?video_id=${item.uri}&ratio=1080p&line=0`)
            continue
          }
          images.push(`动图直链:\nhttps://aweme.snssdk.com/aweme/v1/play/?video_id=${item.video.play_addr_h264.uri}&ratio=1080p&line=0`)
          // 动图
          const liveimg = await this.DownLoadFile(
            `https://aweme.snssdk.com/aweme/v1/play/?video_id=${item.video.play_addr_h264.uri}&ratio=1080p&line=0`,
            'Douyin_tmp_' + Date.now(),
            this.headers,
            '.mp4'
          )
          // BGM
          const liveimgbgm = await this.DownLoadFile(
            bgmurl,
            'Douyin_tmp_' + Date.now(),
            this.headers,
            '.mp3'
          )
          if (liveimg.filepath && liveimgbgm.filepath) {
            const resolvefilepath = this._path + `/resources/kkkdownload/video/Douyin_Result_${Date.now()}.mp4`
            await FFmpeg.VideoComposite(2,
              liveimg.filepath,
              liveimgbgm.filepath,
              resolvefilepath,
              /** 根据配置文件 `rmmp4` 重命名 */
              async () => {
                const filePath = this._path + `/resources/kkkdownload/video/tmp_${Date.now()}.mp4`
                fs.renameSync(
                  resolvefilepath,
                  filePath
                )
                await this.removeFile(liveimgbgm.filepath, true)
                await this.removeFile(liveimg.filepath, true)

                const stats = fs.statSync(filePath)
                const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2)
                if (fileSizeInMB > 75) {
                  if (this.botname !== 'TRSS-Yunzai') this.e.reply(`视频大小: ${fileSizeInMB}MB 正通过群文件上传中...`)
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
        }
        await this.e.reply(makeForwardMsg(this.e, images))
        return true
      }

      case 'UserVideosList': {
        const veoarray = []
        veoarray.unshift(`------------------------------ | ---------------------------- |\n`)
        veoarray.unshift(`标题                           | 分享二维码                    |\n`)
        const forwardmsg = []
        for (let i = 0; i < data.aweme_list.length; i++) {
          const title = data.aweme_list[i].desc
          const cover = data.aweme_list[i].share_url
          veoarray.push(`${title}       | ![img](${await QRCode.toDataURL(cover, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            color: { light: '#00000000' }
          })})    |\n`)
          forwardmsg.push(`作品标题: ${title}\n分享链接: ${cover}`)
        }
        const matext = markdown(veoarray.join(''))
        fs.writeFileSync(`${Version.pluginPath}/resources/html/douyin/user_worklist.html`, matext, 'utf8')
        const img = await Render.render('html/douyin/user_worklist')
        await this.e.reply(img)
        await this.e.reply(await makeForwardMsg(this.e, forwardmsg, '用户主页视频列表'))
        return true
      }
      case 'Music': {
        const sec_id = data.music_info.sec_uid
        const userdata = await new DouyinData('UserInfoData').GetData({ user_id: sec_id })
        img = await Render.render(
          'html/douyin/musicinfo',
          {
            image_url: data.music_info.cover_hd.url_list[0],
            desc: data.music_info.title,
            music_id: data.music_info.id,
            create_time: Time(0),
            user_count: this.count(data.music_info.user_count),
            avater_url: data.music_info.avatar_large.url_list[0],
            fans: userdata.user.mplatform_followers_count || userdata.user.follower_count,
            following_count: userdata.user.following_count,
            total_favorited: userdata.user.total_favorited,
            user_shortid: userdata.user.unique_id === '' ? userdata.user.short_id : userdata.user.unique_id,
            share_url: data.music_info.play_url.uri,
            username: data.music_info.original_musician_display_name || data.music_info.owner_nickname
          }
        )
        await this.e.reply(
          this.mkMsg(
            [
              img[0],
              `\n正在上传 ${data.music_info.title}\n`,
              `作曲: ${data.music_info.original_musician_display_name || data.music_info.owner_nickname}\n`,
              `music_id: ${data.music_info.id}`
            ],
            [{ text: '音乐文件', link: data.music_info.play_url.uri }]
          )
        )

        if (this.botadapter === 'ICQQ') {
          await this.e.reply(await UploadRecord(this.e, data.music_info.play_url.uri, 0, false))
        } else await this.e.reply(segment.record(data.music_info.play_url.uri))

        return true
      }
      case 'Live': {
        if (data.user.live_status === 1) {
          // 直播中
          const live_data = await getDouyinData('直播间信息数据', Config.cookies.douyin, { sec_uid: data.user.sec_uid })
          const room_data = JSON.parse(data.user.room_data)
          const img = await Render.render(
            'html/douyin/douyinlive',
            {
              image_url: [{ image_src: live_data.data.data[0].cover.url_list[0] }],
              text: live_data.data.data[0].title,
              liveinf: `${live_data.data.partition_road_map.partition.title} | 房间号: ${room_data.owner.web_rid}`,
              在线观众: this.count(live_data.data.data[0].stats.user_count_str),
              总观看次数: this.count(live_data.data.data[0].stats.total_user_str),
              username: data.user.nickname,
              avater_url: data.user.avatar_larger.url_list[0],
              fans: this.count(data.user.follower_count),
              create_time: convertTimestampToDateTime(new Date().getTime()),
              now_time: convertTimestampToDateTime(new Date().getTime()),
              share_url: 'https://live.douyin.com/' + room_data.owner.web_rid,
              dynamicTYPE: '直播间信息'
            }
          )
          await this.e.reply(img)
        } else {
          this.e.reply('当前博主未开播 ~')
        }
        return true
      }
      default:
        break
    }
  }

  async uploadRecord (music_id) {
    const data = await new DouyinData('Music').GetData({ music_id })
    const title = data.music_info.title // BGM名字
    const music_url = data.music_info.play_url.uri // BGM link
    if (this.botname === 'Miao-Yunzai' || this.botname === 'yunzai') {
      if (this.botadapter === 'ICQQ') {
        await this.e.reply(await UploadRecord(this.e, music_url, 0, false))
      } else {
        await this.e.reply(segment.record(music_url))
      }
    } else {
      switch (this.botadapter) {
        case 'QQBot':
        case 'OneBotv11':
        case 'LagrangeCore':
        case 'KOOKBot':
          await this.e.reply('正在上传: ' + '《' + title + '》\n' + music_url)
          await this.e.reply(segment.record(music_url))
          break
        case 'ICQQ':
          try {
            await this.e.reply('正在上传: ' + '《' + title + '》\n' + music_url)
            await this.e.reply(await UploadRecord(this.e, music_url, 0, false))
          } catch (error) {
            logger.error('高清语音发送失败', error)
            await this.e.reply(segment.record(music_url))
          }
          break
        default:
          break

      }
    }
  }
}

/**
 * 传递整数，返回x小时后的时间
 * @param {integer} delay
 * @returns
 */
function Time (delay) {
  const currentDate = new Date()
  currentDate.setHours(currentDate.getHours() + delay)

  const year = currentDate.getFullYear().toString()
  const month = (currentDate.getMonth() + 1).toString()
  const day = String(currentDate.getDate()).padStart(2, '0')
  const hours = String(currentDate.getHours()).padStart(2, '0')
  const minutes = String(currentDate.getMinutes()).padStart(2, '0')
  const seconds = String(currentDate.getSeconds()).padStart(2, '0')

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
}

/**
   *
   * @param {string} timestamp 时间戳
   * @returns 获取 年-月-日 时:分
   */
function convertTimestampToDateTime (timestamp) {
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}