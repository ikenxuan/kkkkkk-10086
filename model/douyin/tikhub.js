import { common, base, iKun, Config, uploadRecord, image } from '../common.js'
import fs from 'fs'
import { comments } from './comments.js'
import { Emoji } from './emoji.js'

let mp4size = ''

export default class TikHub extends base {
  /** 原始数据 */
  async GetData(type, data) {
    if (type === 'video' || type === 'note') {
      return await this.v1_dy_data(data.VideoData, data.CommentsData, data.VideoData.is_mp4)
    }

    if (type === 'Live') {
      return await this.dy_live_data(data)
    }

    if (type === 'UserVideosList') {
      return await this.dy_uservideoslist_data(data)
    }
  }

  /**
   * @param {*} Data video or note data
   * @param {*} CommentData commments data
   * @param {*} is_mp4 boolean
   * @returns
   */
  async v1_dy_data(Data, CommentData, is_mp4) {
    Config.douyintip ? this.e.reply('检测到抖音链接，开始解析') : null
    let g_video_url
    let g_title
    let full_data = []

    /** 评论 */
    let comments_res = []
    if (CommentData !== null && CommentData.comments && Config.comments) {
      let comments_data = []
      let commentsres = []
      for (let i = 0; i < CommentData.comments.length; i++) {
        let text = CommentData.comments[i].text
        let digg_count = CommentData.comments[i].digg_count
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
    if (is_mp4 === false) {
      let image_data = []
      let imageres = []
      let image_url
      for (let i = 0; i < Data.aweme_detail.images.length; i++) {
        image_url = Data.aweme_detail.images[i].url_list[3] || Data.aweme_detail.images[i].url_list[1] // 图片地址
        let title = Data.aweme_detail.preview_title.substring(0, 50).replace(/[\\/:\*\?"<>\|\r\n]/g, ' ') // 标题，去除特殊字符
        g_title = title
        imageres.push(segment.image(image_url)) // 合并图集字符串
        imagenum++
        if (Config.rmmp4 === false) {
          await this.mkdirs(process.cwd() + `/resources/kkkdownload/images/${g_title}`)
          let path = process.cwd() + `/resources/kkkdownload/images/${g_title}/${i + 1}.png`
          await new this.networks({ url: image_url, type: 'arrayBuffer' }).getData().then((data) => fs.promises.writeFile(path, Buffer.from(data)))
        }
      }
      if (this.botadapter === 'QQBot') {
        await this.e.reply(imageres)
      }
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
    if (Data.aweme_detail.author) {
      let author_data = []
      let authorres = []
      const author = Data.aweme_detail.author
      let sc = await this.count(author.favoriting_count) // 收藏
      let gz = await this.count(author.follower_count) // 关注
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
    if (Data.aweme_detail.music) {
      let music_data = []
      let musicres = []
      const music = Data.aweme_detail.music
      let music_id = music.author // BGM名字
      let music_img = music.cover_hd.url_list[0] // BGM作者头像
      let music_url = music.play_url.uri // BGM link
      if (is_mp4 === false && Config.rmmp4 === false && music_url !== undefined) {
        try {
          let path = process.cwd() + `/resources/kkkdownload/images/${g_title}/BGM.mp3`
          await new this.networks({ url: music_url, type: 'arrayBuffer' }).getData().then((data) => fs.promises.writeFile(path, Buffer.from(data)))
        } catch (error) {
          console.log(error)
        }
      }
      musicres.push(`BGM名字：${music_id}`)
      musicres.push(`BGM下载直链：${music_url}`)
      musicres.push(segment.image(music_img))
      let dsc = 'BGM相关信息'
      let res = await common.makeForwardMsg(this.e, musicres, dsc)
      music_data.push(res)
      music_res.push(music_data)
      switch (this.botCfg.package.name) {
        case 'miao-yunzai':
          if (music_url && is_mp4 == false && music_url !== undefined && this.botCfg.bot.skip_login == false) {
            try {
              await this.e.reply(await uploadRecord(music_url, 0, false))
            } catch {}
          } else if (this.botCfg.bot.skip_login && is_mp4 == false) {
            await this.e.reply(segment.record(music_url))
          }
          break
        case 'trss-yunzai':
          if (music_url && is_mp4 == false && music_url !== undefined) {
            await this.e.reply(segment.record(music_url))
          }
          break
      }
    }

    /** 其他 */
    let ocr_res = []
    if (Data.aweme_detail.seo_info.ocr_content) {
      let ocr_data = []
      let ocrres = []
      let text = Data.aweme_detail.seo_info.ocr_content
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
    if (is_mp4) {
      let video_data = []
      let videores = []
      // 视频地址特殊判断：play_addr_h264、play_addr、
      const video = Data.aweme_detail.video
      FPS = video.bit_rate[0].FPS // FPS
      if (Data.aweme_detail.video.play_addr_h264) {
        g_video_url = await new this.networks({
          url: video.play_addr_h264.url_list[2],
          headers: this.headers,
        }).getLongLink()
      } else if (Data.aweme_detail.video.play_addr) {
        g_video_url = await new this.networks({
          url: video.play_addr.url_list[0],
          headers: this.headers,
        }).getLongLink()
      }
      let cover = video.origin_cover.url_list[0] // video cover image
      let title = Data.aweme_detail.preview_title.substring(0, 80).replace(/[\\/:\*\?"<>\|\r\n]/g, ' ') // video title
      g_title = title
      mp4size = (video.play_addr.data_size / (1024 * 1024)).toFixed(2)
      videores.push(`标题：\n${title}`)
      videores.push(`视频帧率：${'' + FPS}\n视频大小：${mp4size}MB`)
      videores.push(`永久直链(302跳转)\nhttps://aweme.snssdk.com/aweme/v1/play/?video_id=${Data.aweme_detail.video.play_addr.uri}&ratio=1080p&line=0`)
      videores.push(`视频直链（有时效性，永久直链在下一条消息）：\n${g_video_url}`)
      videores.push(segment.image(cover))
      g_video_url = `https://aweme.snssdk.com/aweme/v1/play/?video_id=${Data.aweme_detail.video.play_addr.uri}&ratio=1080p&line=0`
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
      const commentsArray = await comments(CommentData, list)
      let { img } = await image(this.e, `comment_${Config.newui ? 'new' : 'old'}`, 'kkkkkk-10086', {
        saveId: 'comment',
        Type: is_mp4 ? '视频' : '图集',
        CommentsData: commentsArray,
        CommentLength: String(commentsArray.jsonArray?.length ? commentsArray.jsonArray.length : 0),
        VideoUrl: is_mp4
          ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${Data.aweme_detail.video.play_addr.uri}&ratio=1080p&line=0`
          : Data.aweme_detail.share_url,
        Title: g_title,
        VideoSize: mp4size,
        VideoFPS: FPS,
        ImageLength: imagenum,
        DestroyTime: await destroyTime(),
      })
      file = img
      this.e.reply(
        this.mkMsg(img, [
          {
            text: is_mp4 ? '视频直链' : '图集分享链接',
            link: is_mp4
              ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${Data.aweme_detail.video.play_addr.uri}&ratio=1080p&line=0`
              : Data.aweme_detail.share_url,
          },
        ]),
      )
    }

    const tip = ['视频正在上传']
    let res
    if (is_mp4) {
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
    if (is_mp4 !== true) {
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
  }

  async dy_live_data(livedata) {
    let res = []

    const title = livedata.data.data[0].title // 标题

    // status
    const user_count = livedata.data.data[0].stats.total_user_str // 总观看人数
    const user_count_str = livedata.data.data[0].stats.user_count_str // 目前在线人数
    const nickname = livedata.data.data[0].owner.nickname // 作者名字

    const flv = livedata.data.data[0].stream_url.flv_pull_url.FULL_HD1 // flv文件
    const m3u8 = livedata.data.data[0].stream_url.hls_pull_url_map.FULL_HD1 // m3u8文件
    const qrcode_url = livedata.data.qrcode_url // 分享二维码

    res.push('标题:\n' + title)
    res.push('总观看人数:\n' + user_count)
    res.push('目前在线人数:\n' + user_count_str)
    res.push('作者名字:\n' + nickname)
    res.push('分享二维码:\n' + segment.image(qrcode_url))
    res.push('flv文件:\n' + flv)
    res.push('m3u8文件:\n' + m3u8)
    res.push('正在开发中 咕咕咕~~~')

    return {
      res,
      dec: '直播间分享',
    }
  }

  async dy_uservideoslist_data(uservideoslist_data) {
    let video_res = []

    let res
    for (let i = 0; i < uservideoslist_data.aweme_list.length; i++) {
      let title = uservideoslist_data.aweme_list[i].desc
      let cover = uservideoslist_data.aweme_list[i].share_url
      video_res.push(`作品标题: ${title}\n${cover}`)
    }

    res = video_res
    return {
      res,
      dec: '抖音用户主页视频数据',
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

/** 销毁时间 = 现在时间 + 3小时 */
async function destroyTime() {
  const currentDate = new Date()
  currentDate.setHours(currentDate.getHours() + 2)

  const year = currentDate.getFullYear().toString()
  const month = (currentDate.getMonth() + 1).toString()
  const day = String(currentDate.getDate()).padStart(2, '0')
  const hours = String(currentDate.getHours()).padStart(2, '0')
  const minutes = String(currentDate.getMinutes()).padStart(2, '0')
  const seconds = String(currentDate.getSeconds()).padStart(2, '0')

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
}
