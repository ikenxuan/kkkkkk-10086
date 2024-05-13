import { common, base, Config, uploadRecord, image, networks } from '#modules'
import { iKun, Emoji, comments } from '#douyin'
import fs from 'fs'

let mp4size = '',
  img,
  m_id

export default class DouYin extends base {
  constructor(e = {}, iddata) {
    super()
    this.e = e
    this.type = iddata?.type
    this.is_mp4 = iddata?.is_mp4
  }

  async RESOURCES(data) {
    switch (this.type) {
      case 'video':
      case 'note':
        Config.douyintip ? this.e.reply('检测到抖音链接，开始解析') : null
        let g_video_url
        let g_title
        let full_data = []

        /** 评论 */
        let comments_res = []
        if (data.CommentsData !== null && data.CommentsData.comments && Config.comments) {
          let comments_data = []
          let commentsres = []
          for (let i = 0; i < data.CommentsData.comments.length; i++) {
            let text = data.CommentsData.comments[i].text
            let digg_count = data.CommentsData.comments[i].digg_count
            if (digg_count > 10000) {
              digg_count = (digg_count / 10000).toFixed(1) + 'w'
            }
            commentsres.push(`${text}\n♥${digg_count}`)
          }
          let dsc = '评论数据'
          let res = await common.makeForwardMsg(this.e, commentsres, dsc)
          comments_data.push(res)
          comments_res.push(comments_data)
        } else comments_res.push('评论数据获取失败或这条视频没有评论')

        /** 图集 */
        let imagenum = 0
        let image_res = []
        if (this.is_mp4 === false) {
          let image_data = []
          let imageres = []
          let image_url
          for (let i = 0; i < data.VideoData.aweme_detail.images.length; i++) {
            image_url = data.VideoData.aweme_detail.images[i].url_list[2] || data.VideoData.aweme_detail.images[i].url_list[1] // 图片地址
            let title = data.VideoData.aweme_detail.preview_title.substring(0, 50).replace(/[\\/:\*\?"<>\|\r\n]/g, ' ') // 标题，去除特殊字符
            g_title = title
            let imgresp
            if (this.botadapter === 'QQBot') {
              let sharp
              try {
                ;({ default: sharp } = await import('sharp'))
                imgresp = new Uint8Array(await new networks({ url: image_url, type: 'arrayBuffer' }).getData())
                imgresp = await sharp(imgresp).toFormat('jpeg').toBuffer()
              } catch {
                logger.error('依赖: sharp 未正确安装，QQBot发送图集图片可能出现异常')
              }
            }
            imageres.push(segment.image(this.botadapter === 'QQBot' ? imgresp : image_url))
            imagenum++
            if (Config.rmmp4 === false) {
              await this.mkdirs(process.cwd() + `/resources/kkkdownload/images/${g_title}`)
              let path = process.cwd() + `/resources/kkkdownload/images/${g_title}/${i + 1}.png`
              await new networks({ url: image_url, type: 'arrayBuffer' }).getData().then((data) => fs.promises.writeFile(path, Buffer.from(data)))
            }
          }
          await this.e.reply(imageres)
          let dsc = '解析完的图集图片'
          let res = await common.makeForwardMsg(this.e, imageres, dsc)
          image_data.push(res)
          image_res.push(image_data)
          !Config.sendforwardmsg && this.e.bot?.sendUni ? await this.e.reply(res) : null
        } else {
          image_res.push('图集信息解析失败')
        }

        /** 作者 */
        let author_res = []
        if (data.VideoData.aweme_detail.author) {
          let author_data = []
          let authorres = []
          const author = data.VideoData.aweme_detail.author
          let sc = this.count(author.favoriting_count) // 收藏
          let gz = this.count(author.follower_count) // 关注
          let id = author.nickname // id
          let jj = author.signature // 简介
          let age = author.user_age // 年龄
          let sczs = author.total_favorited
          authorres.push(`创作者名称：${id}`)
          authorres.push(`创作者：${id}拥有${gz}个粉丝，${sc}个收藏和${sczs}个收藏总数`)
          authorres.push(`${id}今年${age}岁，Ta的简介是：\n${jj}`)
          let dsc = '创作者信息'
          let res = await common.makeForwardMsg(this.e, authorres, dsc)
          author_data.push(res)
          author_res.push(author_data)
        }

        /** 背景音乐 */
        let music_res = []
        if (data.VideoData.aweme_detail.music) {
          let music_data = []
          let musicres = []
          const music = data.VideoData.aweme_detail.music
          m_id = music.mid
          let music_name = music.author // BGM名字
          let music_img = music.cover_hd.url_list[0] // BGM作者头像
          let music_url = music.play_url.uri // BGM link
          if (this.is_mp4 === false && Config.rmmp4 === false && music_url !== undefined) {
            try {
              let path = process.cwd() + `/resources/kkkdownload/images/${g_title}/BGM.mp3`
              await new networks({ url: music_url, type: 'arrayBuffer' }).getData().then((data) => fs.promises.writeFile(path, Buffer.from(data)))
            } catch (error) {
              console.log(error)
            }
          }
          musicres.push(`BGM名字：${music_name}`)
          musicres.push(`BGM下载直链：${music_url}`)
          musicres.push(segment.image(music_img))
          let dsc = 'BGM相关信息'
          let res = await common.makeForwardMsg(this.e, musicres, dsc)
          music_data.push(res)
          music_res.push(music_data)
          switch (this.botname) {
            case 'miao-yunzai':
              if (music_url && this.is_mp4 == false && music_url !== undefined && this.botCfg.bot.skip_login == false) {
                try {
                  await this.e.reply(await uploadRecord(this.e, music_url, 0, false))
                } catch {}
              } else if (this.botCfg.bot.skip_login && this.is_mp4 == false) {
                await this.e.reply(segment.record(music_url))
              }
              break
            case 'trss-yunzai':
              switch (this.botadapter) {
                case 'QQBot':
                case 'OneBotv11':
                case 'LagrangeCore':
                case 'KOOKBot':
                  if (music_url && this.is_mp4 == false && music_url !== undefined) {
                    await this.e.reply(segment.record(music_url))
                  }
                  break
                case 'ICQQ':
                  try {
                    music_url && this.is_mp4 == false && music_url !== undefined ? await this.e.reply(await uploadRecord(this.e, music_url, 0, false)) : null
                  } catch (error) {
                    logger.error('高清语音发送失败', error)
                    music_url && this.is_mp4 == false && music_url !== undefined ? await this.e.reply(segment.record(music_url)) : null
                  }
                  break
              }
              break
          }
          global.DOUYINMUSICDATA = music
        }

        /** 其他 */
        let ocr_res = []
        if (data.VideoData.aweme_detail.seo_info.ocr_content) {
          let ocr_data = []
          let ocrres = []
          let text = data.VideoData.aweme_detail.seo_info.ocr_content
          ocrres.push('说明：\norc可以识别视频中可能出现的文字信息')
          ocrres.push(text)
          let dsc = 'ocr视频信息识别'
          let res = await common.makeForwardMsg(this.e, ocrres, dsc)
          ocr_data.push(res)
          ocr_res.push(ocr_data)
        }

        /** 视频 */
        let FPS
        let video_res = []
        if (this.is_mp4) {
          let video_data = []
          let videores = []
          // 视频地址特殊判断：play_addr_h264、play_addr、
          const video = data.VideoData.aweme_detail.video
          FPS = video.bit_rate[0].FPS // FPS
          if (data.VideoData.aweme_detail.video.play_addr_h264) {
            g_video_url = await new networks({
              url: video.play_addr_h264.url_list[2],
              headers: this.headers,
            }).getLongLink()
          } else if (data.VideoData.aweme_detail.video.play_addr) {
            g_video_url = await new networks({
              url: video.play_addr.url_list[0],
              headers: this.headers,
            }).getLongLink()
          }
          let cover = video.origin_cover.url_list[0] // video cover image
          let title = data.VideoData.aweme_detail.preview_title.substring(0, 80).replace(/[\\/:\*\?"<>\|\r\n]/g, ' ') // video title
          g_title = title
          mp4size = (video.play_addr.data_size / (1024 * 1024)).toFixed(2)
          videores.push(`标题：\n${title}`)
          videores.push(`视频帧率：${'' + FPS}\n视频大小：${mp4size}MB`)
          videores.push(
            `永久直链(302跳转)\nhttps://aweme.snssdk.com/aweme/v1/play/?video_id=${data.VideoData.aweme_detail.video.play_addr.uri}&ratio=1080p&line=0`,
          )
          videores.push(`视频直链（有时效性，永久直链在下一条消息）：\n${g_video_url}`)
          videores.push(segment.image(cover))
          g_video_url = `https://aweme.snssdk.com/aweme/v1/play/?video_id=${data.VideoData.aweme_detail.video.play_addr.uri}&ratio=1080p&line=0`
          logger.info('视频地址', g_video_url)
          let dsc = this.botname == 'miao-yunzai' ? '视频基本信息' : null
          let res = await common.makeForwardMsg(this.e, videores, dsc)
          video_data.push(res)
          video_res.push(video_data)
        }

        let file = null
        if (Config.commentsimg && Config.comments) {
          const EmojiData = await new iKun('Emoji').GetData()
          const list = await Emoji(EmojiData)
          const commentsArray = await comments(data.CommentsData, list)
          img = await image(`douyin/comment_${Config.newui ? 'new' : 'old'}`, 'kkkkkk-10086/douyin/comments', {
            saveId: 'comment',
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
            Botadapter: this.botadapter,
          })
          file = img
          await this.e.reply(
            this.mkMsg(img, [
              {
                text: this.is_mp4 ? '视频直链' : '图集分享链接',
                link: this.is_mp4
                  ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${data.VideoData.aweme_detail.video.play_addr.uri}&ratio=1080p&line=0`
                  : data.VideoData.aweme_detail.share_url,
              },
              this.is_mp4
                ? {
                    text: '背景音乐',
                    input: 'BGM' + m_id,
                    send: true,
                  }
                : {},
            ]),
          )
        }

        const tip = ['视频正在上传']
        let res
        if (this.is_mp4) {
          res = full_data
            .concat(tip)
            .concat(Config.commentsimg ? file : null)
            .concat(video_res)
            .concat(comments_res)
            .concat(music_res)
            .concat(author_res)
            .concat(ocr_res)
        } else {
          res = full_data
            .concat(Config.commentsimg ? file : null)
            .concat(video_res)
            .concat(image_res)
            .concat(comments_res)
            .concat(music_res)
            .concat(author_res)
            .concat(ocr_res)
        }
        let dec
        if (this.is_mp4 !== true) {
          dec = '抖音图集作品数据'
        } else {
          dec = '抖音视频作品数据'
        }
        return {
          res: this.botadapter !== 'QQBot' ? res : [],
          g_video_url,
          g_title,
          dec: this.botname === 'miao-yunzai' ? dec : null,
        }

      case 'UserVideosList':
        let veoarray = []
        for (let i = 0; i < data.aweme_list.length; i++) {
          let title = data.aweme_list[i].desc
          let cover = data.aweme_list[i].share_url
          veoarray.push(`作品标题: ${title}\n${cover}`)
        }

        return {
          res: veoarray,
          dec: '抖音用户主页视频数据',
        }

      case 'Music':
        const avatat_img = data.music_info.avatar_large.url_list[0]
        const music_cover = data.music_info.cover_hd.url_list[0]
        const music_id = data.music_info.id
        const author = data.music_info.original_musician_display_name || data.music_info.owner_nickname
        const music_title = data.music_info.title
        const play_url = data.music_info.play_url.uri
        const user_count = this.count(data.music_info.user_count)
        const sec_id = data.music_info.musician_user_infos[0].sec_uid

        /** user */
        const userdata = await new iKun('UserInfoData').GetData({ user_id: sec_id })
        const fans = userdata.user.mplatform_followers_count || userdata.user.follower_count
        const following_count = userdata.user.following_count
        const total_favorited = userdata.user.total_favorited
        let user_shortid
        userdata.user.unique_id == '' ? (user_shortid = userdata.user.short_id) : (user_shortid = userdata.user.unique_id)

        img = await image('douyin/musicinfo', 'kkkkkk-10086/douyin/musicinfo', {
          saveId: 'musicinfo',
          image_url: music_cover,
          desc: music_title,
          music_id: music_id,
          create_time: Time(0),
          user_count: user_count,
          avater_url: avatat_img,
          fans: fans,
          following_count: following_count,
          total_favorited: total_favorited,
          user_shortid: user_shortid,
          share_url: play_url,
          username: author,
          Botadapter: this.botadapter,
        })

        await this.e.reply(
          this.mkMsg([img, `\n正在上传 ${music_title}\n`, `作曲: ${author}\n`, `music_id: ${music_id}`], [{ text: '音乐文件', link: play_url }]),
        )

        if (this.botadapter === 'ICQQ') {
          await this.e.reply(await uploadRecord(this.e, play_url, 0, false))
        } else await this.e.reply(segment.record(play_url))

        return false
    }
  }

  async uploadrecord(music_id) {
    const data = await new iKun('Music').GetData({ music_id: music_id })
    let title = data.music_info.title // BGM名字
    let music_url = data.music_info.play_url.uri // BGM link
    if (this.botname === 'miao-yunzai') {
      if (this.botadapter === 'ICQQ') {
        await this.e.reply(await uploadRecord(this.e, music_url, 0, false))
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
            await this.e.reply(await uploadRecord(this.e, music_url, 0, false))
          } catch (error) {
            logger.error('高清语音发送失败', error)
            await this.e.reply(segment.record(music_url))
          }
          break
      }
    }
  }
  /**
   * @param {*} file 上传图片到腾讯图床
   * @returns
   */
  async upload_image(file) {
    return (await Bot.pickFriend(Bot.uin)._preprocess(segment.image(file))).imgs[0]
  }

  /** 获取机器人上传的图片链接 */
  async getHistoryLog() {
    return (await Bot.pickGroup(Number(e.group_id)).getChatHistory(Bot.uin.seq, 1))[0].message[0].url
  }
}

/**
 * 传递整数，返回x小时后的时间
 * @param {integer} delay
 * @returns
 */
function Time(delay) {
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
