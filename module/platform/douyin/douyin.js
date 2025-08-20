import { Base, Config, UploadRecord, Networks, Render, mergeFile, Version, Common } from '../../utils/index.js'
import common from '../../../../../lib/common/common.js'
import { getDouyinData } from '@ikenxuan/amagi'
import { markdown } from '@karinjs/md-html'
import { douyinComments } from './index.js'
import { join } from 'node:path'
import QRCode from 'qrcode'
import fs from 'fs'

let mp4size = ''
let img

export default class DouYin extends Base {
  constructor (e = {}, iddata) {
    super()
    this.e = e
    this.type = iddata?.type
    this.is_mp4 = iddata?.is_mp4
    this.is_slides = false
  }

  async RESOURCES (data) {
    (Config.douyin.douyinTip).includes('提示信息') && this.e.reply('检测到抖音链接，开始解析')
    switch (this.type) {
      case 'one_work': {
        const VideoData = await getDouyinData('聚合解析', Config.cookies.douyin, {
          aweme_id: data.aweme_id,
          typeMode: 'strict'
        })
        const CommentsData = await getDouyinData('评论数据', Config.cookies.douyin, {
          aweme_id: data.aweme_id,
          number: Config.douyin.numcomments,
          typeMode: 'strict'
        })
        this.is_slides = VideoData.data.aweme_detail.is_slides === true
        let g_video_url = ''
        let g_title

        /** 图集 */
        let imagenum = 0
        const image_res = []
        if (this.is_mp4 === false && (Config.douyin.douyinTip).includes('图集')) {
          switch (true) {
            // 图集
            case this.is_slides === false && VideoData.data.aweme_detail.images !== null: {
              const image_data = []
              const imageres = []
              let image_url = ''
              for (let i = 0; i < VideoData.data.aweme_detail.images.length; i++) {
                image_url = VideoData.data.aweme_detail.images[i].url_list[2] || VideoData.data.aweme_detail.images[i].url_list[1] // 图片地址

                const title = VideoData.data.aweme_detail.preview_title.substring(0, 50).replace(/[\\/:*?"<>|\r\n]/g, ' ') // 标题，去除特殊字符
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
                if (Config.app.rmmp4 === false) {
                  mkdirSync(`${Common.tempDri.images}${g_title}`)
                  const path = `${Common.tempDri.images}${g_title}/${i + 1}.png`
                  await new Networks({ url: image_url, type: 'arrayBuffer' }).getData().then((data) => fs.promises.writeFile(path, Buffer.from(data)))
                }
              }
              const res = common.makeForwardMsg(this.e, imageres, '解析完的图集图片')
              image_data.push(res)
              image_res.push(image_data)
              if (imageres.length === 1) {
                await this.e.reply(segment.image(image_url))
              } else {
                await this.e.reply(res)
              }
              break
            }
            // 合辑
            case VideoData.data.aweme_detail.is_slides === true && VideoData.data.aweme_detail.images !== null: {
              const images = []
              const temp = []
              /** BGM */
              const liveimgbgm = await this.DownLoadFile(
                VideoData.data.aweme_detail.music.play_url.uri,
                `Douyin_tmp_A_${Date.now()}`,
                this.headers,
                '.mp3'
              )
              temp.push(liveimgbgm)
              for (const item of VideoData.data.aweme_detail.images) {
                imagenum++
                // 静态图片，clip_type为2
                if (item.clip_type === 2) {
                  images.push(segment.image((item.url_list[0])))
                  continue
                }
                /** 动图 */
                const liveimg = await this.DownLoadFile(
                  `https://aweme.snssdk.com/aweme/v1/play/?video_id=${item.video.play_addr_h264.uri}&ratio=1080p&line=0`,
                  `Douyin_tmp_V_${Date.now()}`,
                  this.headers,
                  '.mp4'
                )

                if (liveimg.filepath) {
                  const resolvefilepath = Common.tempDri.video + `Douyin_Result_${Date.now()}.mp4`
                  await mergeFile('视频*3 + 音频', {
                    path: liveimg.filepath,
                    path2: liveimgbgm.filepath,
                    resultPath: resolvefilepath,
                    callback: async (success, resultPath) => {
                      if (success) {
                        const filePath = Common.tempDri.video + `tmp_${Date.now()}.mp4`
                        fs.renameSync(resultPath, filePath)
                        await Common.removeFile(liveimg.filepath, true)
                        temp.push({ filepath: filePath, totalBytes: 0 })
                        images.push(segment.video(filePath))
                        return true
                      } else {
                        await Common.removeFile(liveimg.filepath, true)
                        return true
                      }
                    }
                  })
                }
              }
              const Element = common.makeForwardMsg(this.e, images, '合辑内容')
              try {
                await this.e.reply(Element)
              } catch (error) {
                logger.error(error)
              } finally {
                for (const item of temp) {
                  await Common.removeFile(item.filepath, true)
                }
              }
              break
            }
          }
        }

        /** 背景音乐 */
        if (VideoData.data.aweme_detail.music && (Config.douyin.douyinTip).includes('背景音乐')) {
          const music = VideoData.data.aweme_detail.music
          const music_url = music.play_url.uri // BGM link
          if (this.is_mp4 === false && Config.app.rmmp4 === false && music_url !== undefined) {
            try {
              const path = Common.tempDri.images + `${g_title}/BGM.mp3`
              await new Networks({ url: music_url, type: 'arrayBuffer' }).getData().then((data) => fs.promises.writeFile(path, Buffer.from(data)))
            } catch (error) {
              logger.error(error)
            }
          }
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
            default:
              break
          }
        }

        /** 视频 */
        let FPS
        const video_res = []
        const sendvideofile = true
        if (this.is_mp4 && (Config.douyin.douyinTip).includes('视频')) {
          const video_data = []
          const videores = []
          // 视频地址特殊判断：play_addr_h264、play_addr、
          const video = VideoData.data.aweme_detail.video
          FPS = video.bit_rate[0].FPS // FPS
          if (Config.douyin.autoResolution) {
            logger.debug(`开始排除不符合条件的视频分辨率；\n
              共拥有${logger.yellow(video.bit_rate.length)}个视频源\n
              视频ID：${logger.green(VideoData.data.aweme_detail.aweme_id)}\n
              分享链接：${logger.green(VideoData.data.aweme_detail.share_url)}
              `)
            video.bit_rate = douyinProcessVideos(video.bit_rate, Config.app.filelimit)
            g_video_url = await new Networks({
              url: video.bit_rate[0].play_addr.url_list[2],
              headers: this.headers,
              Referer: video.bit_rate[0].play_addr.url_list[0]
            }).getLongLink()
          } else {
            g_video_url = await new Networks({
              url: video.play_addr_h264.url_list[2] ?? video.play_addr_h264.url_list[2],
              headers: this.headers,
              Referer: video.play_addr_h264.url_list[0] ?? video.play_addr_h264.url_list[0],
            }).getLongLink()
          }
          const cover = video.origin_cover.url_list[0] // video cover image

          const title = VideoData.data.aweme_detail.preview_title.substring(0, 80).replace(/[\\/:\*\?"<>\|\r\n]/g, ' ') // video title
          g_title = title
          mp4size = (video.bit_rate[0].play_addr.data_size / (1024 * 1024)).toFixed(2)
          videores.push(`标题：\n${title}`)
          videores.push(`视频帧率：${'' + FPS}\n视频大小：${mp4size}MB`)
          videores.push(
            `永久直链(302跳转)\nhttps://aweme.snssdk.com/aweme/v1/play/?video_id=${VideoData.data.aweme_detail.video.play_addr.uri}&ratio=1080p&line=0`
          )
          videores.push(`视频直链（有时效性，永久直链在下一条消息）：\n${g_video_url}`)
          videores.push(segment.image(cover))
          logger.info('视频地址', `https://aweme.snssdk.com/aweme/v1/play/?video_id=${VideoData.data.aweme_detail.video.play_addr.uri}&ratio=1080p&line=0`)
          const res = common.makeForwardMsg(this.e, videores, '视频基本信息')
          video_data.push(res)
          video_res.push(video_data)
        }

        if ((Config.douyin.douyinTip).includes('评论图')) {
          const EmojiData = await etDouyinData('Emoji数据', { typeMode: 'strict' })
          const list = Emoji(EmojiData.data)
          const commentsArray = await douyinComments(CommentsData, list)
          if (!commentsArray.jsonArray.length) {
            await this.e.reply('这个作品没有评论 ~')
          } else {
            const img = await Render.render('douyin/comment',
              {
                Type: this.is_mp4 ? '视频' : this.is_slides ? '合辑' : '图集',
                CommentsData: commentsArray,
                CommentLength: String(commentsArray.jsonArray?.length ?? 0),
                share_url: this.is_mp4
                  ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${VideoData.data.aweme_detail.video.play_addr.uri}&ratio=1080p&line=0`
                  : VideoData.data.aweme_detail.share_url,
                Title: g_title,
                VideoSize: mp4size,
                VideoFPS: FPS,
                ImageLength: imagenum
              }
            )
            await this.e.reply(img)
          }
        }
        /** 发送视频 */
        sendvideofile && this.is_mp4 && await this.DownLoadVideo(g_video_url, `tmp_${Date.now()}`)
        return true
      }

      case 'user_dynamic': {
        const UserVideoListData = await getDouyinData('用户主页视频列表数据', Config.cookies.douyin, {
          sec_uid: data.sec_uid,
          typeMode: 'strict'
        })

        const veoarray = []
        veoarray.unshift('------------------------------ | ---------------------------- |\n')
        veoarray.unshift('标题                           | 分享二维码                    |\n')
        const forwardmsg = []
        for (const i of UserVideoListData.aweme_list) {
          const title = i.desc
          const cover = i.share_url
          veoarray.push(`${title}       | ![img](${await QRCode.toDataURL(cover, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            color: {
              light: '#ffffff00',
              dark: Common.useDarkTheme() ? '#FFFFFF' : '#000000'
            }
          })})    |\n`)
          forwardmsg.push(`作品标题: ${title}\n分享链接: ${cover}`)
        }
        const matext = markdown(veoarray.join(''), {})
        const htmlpath = join(Version.pluginPath, 'template', 'douyin', 'html', 'user_worklist.html')
        fs.writeFileSync(htmlpath, matext, 'utf8')
        const img = await Render.render('douyin/user_worklist')
        await this.e.reply(segment.image(img))
        const Element2 = await common.makeForwardMsg(this.e, forwardmsg, '用户主页视频列表')
        await this.e.reply(Element2)
        return true
      }
      case 'music_work': {
        const MusicData = await getDouyinData('音乐数据', Config.cookies.douyin, {
          music_id: data.music_id,
          typeMode: 'strict'
        })
        const sec_uid = MusicData.data.music_info.sec_uid
        const UserData = await getDouyinData('用户主页数据', Config.cookies.douyin, { sec_uid, typeMode: 'strict' })
        // if (userdata.status_code === 2) {
        //   const new_userdata = await getDouyinData('搜索数据', Config.cookies.douyin, { query: data.music_info.author })
        //   if (new_userdata.data[0].type === 4 && new_userdata.data[0].card_unique_name === 'user') {
        //     userdata = { user: new_userdata.data[0].user_list[0].user_info }
        //   }
        //   const search_data = new_userdata
        // }
        if (!MusicData.data.music_info.play_url) {
          await this.e.reply('解析错误！该音乐抖音未提供下载链接，无法下载', { reply: true })
          return true
        }
        img = await Render.render('douyin/musicinfo',
          {
            image_url: MusicData.data.music_info.cover_hd.url_list[0],
            desc: MusicData.data.music_info.title,
            music_id: MusicData.data.music_info.id,
            create_time: Time(0),
            user_count: Common.count(MusicData.music_info.user_count),
            avater_url: MusicData.data.music_info.avatar_large?.url_list[0] || UserData.data.user.avatar_larger.url_list[0],
            fans: UserData.data.user.mplatform_followers_count || UserData.user.follower_count,
            following_count: UserData.data.user.following_count,
            total_favorited: UserData.data.user.total_favorited,
            user_shortid: UserData.data.user.unique_id === '' ? UserData.user.short_id : UserData.user.unique_id,
            share_url: MusicData.data.music_info.play_url.uri,
            username: MusicData.data.music_info?.original_musician_display_name || MusicData.data.music_info.owner_nickname === '' ? MusicData.data.music_info.author : MusicData.data.music_info.owner_nickname
          }
        )
        await this.e.reply(
          this.mkMsg(
            [
              ...img,
              `\n正在上传 ${MusicData.data.music_info.title}\n`,
              `作曲: ${MusicData.data.music_info.original_musician_display_name || MusicData.data.music_info.owner_nickname === '' ? MusicData.data.music_info.author : MusicData.data.music_info.owner_nickname}\n`,
              `music_id: ${MusicData.data.music_info.id}`
            ],
            [{ text: '音乐文件', link: MusicData.data.music_info.play_url.uri }]
          )
        )
        if (this.botadapter === 'ICQQ') {
          await this.e.reply(await UploadRecord(this.e, MusicData.data.music_info.play_url.uri, 0, false))
        } else await this.e.reply(segment.record(MusicData.data.music_info.play_url.uri))
        return true
      }
      case 'live_room_detail': {
        const UserInfoData = await getDouyinData('用户主页数据', Config.cookies.douyin, {
          sec_uid: data.sec_uid,
          typeMode: 'strict'
        })
        if (UserInfoData.data.user.live_status === 1) {
          // 直播中
          const live_data = await getDouyinData('直播间信息数据', Config.cookies.douyin, { sec_uid: UserInfoData.data.user.sec_uid, typeMode: 'strict' })
          const room_data = JSON.parse(UserInfoData.data.user.room_data)
          const img = await Render.render('douyin/live',
            {
              image_url: [{ image_src: live_data.data.data[0].cover?.url_list[0] }],
              text: live_data.data.data[0].title,
              liveinf: `${live_data.data.partition_road_map.partition.title} | 房间号: ${room_data.owner.web_rid}`,
              在线观众: Common.count(Number(live_data.data.data[0].room_view_stats?.display_value)),
              总观看次数: Common.count(Number(live_data.data.data[0].stats?.total_user_str)),
              username: UserInfoData.data.user.nickname,
              avater_url: UserInfoData.data.user.avatar_larger.url_list[0],
              fans: Common.count(UserInfoData.data.user.follower_count),
              create_time: Common.convertTimestampToDateTime(new Date().getTime()),
              now_time: Common.convertTimestampToDateTime(new Date().getTime()),
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

}

/**
 * 处理抖音视频数据，根据大小限制筛选合适的视频
 * @param {dyVideo[]} videos - 视频数组
 * @param {number} filelimit - 文件大小限制(MB)
 * @returns {dyVideo[]} 处理后的视频数组，只包含一个最合适的视频
 */
export const douyinProcessVideos = (videos, filelimit) => {
  const sizeLimitBytes = filelimit * 1024 * 1024 // 将 MB 转换为字节
  logger.debug(videos)
  // 过滤掉 format 为 'dash' 的视频，并且过滤出小于等于大小限制的视频
  const validVideos = videos.filter(video => video.format !== 'dash' && video.play_addr.data_size <= sizeLimitBytes)

  if (validVideos.length > 0) {
    // 如果有符合条件的视频，找到 data_size 最大的视频
    return [validVideos.reduce((maxVideo, currentVideo) => {
      return currentVideo.play_addr.data_size > maxVideo.play_addr.data_size ? currentVideo : maxVideo
    })]
  } else {
    // 如果没有符合条件的视频，返回 data_size 最小的那个视频（排除 'dash' 格式）
    const allValidVideos = videos.filter(video => video.format !== 'dash')
    return [allValidVideos.reduce((minVideo, currentVideo) => {
      return currentVideo.play_addr.data_size < minVideo.play_addr.data_size ? currentVideo : minVideo
    })]
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
 * 处理抖音表情数据
 * @param {Object} data 表情数据对象
 * @param {Array} data.emoji_list 表情列表
 * @param {string} data.emoji_list[].display_name 表情显示名称
 * @param {Object} data.emoji_list[].emoji_url 表情URL对象
 * @param {Array} data.emoji_list[].emoji_url.url_list 表情URL列表
 * @returns {Array<{name: string, url: string}>} 处理后的表情数组,包含name和url属性
 */
function Emoji (data) {
  const ListArray = []

  for (const i of data.emoji_list) {
    const display_name = i.display_name
    const url = i.emoji_url.url_list[0]

    const Objject = {
      name: display_name,
      url
    }
    ListArray.push(Objject)
  }
  return ListArray
}
