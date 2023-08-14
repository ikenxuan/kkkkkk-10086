import fetch from "node-fetch"
import fs from 'fs'
import common from "../../../../lib/common/common.js"
import uploadRecord from "../uploadRecord.js"
import path from "node:path"
import { Config } from "../config.js"
import { emojiMap } from '../../utils/DYemoji.js'
const _path = process.cwd()
let mp4size = ''


export class base {
  constructor(e = {}) {
    this.e = e
  }
}
export class TikHub extends base {
  constructor(e) {
    super(e)
    this.model = "TikHub"
  }
  /**
   * @param {*} count 过万整除
   * @returns 
   */
  async count(count) {
    if (count > 10000) {
      return (count / 10000).toFixed(1) + "万"
    } else {
      return count.toString()
    }
  }

  /**
   * 
   * @param {*} is_mp4 boolean
   * @param {*} video_url work url
   * @param {*} title work title
   * @returns 
   */
  async gettype(is_mp4, video_url, title) {
    let path = `${_path}/${await DownLoadVideo(video_url, title)}`
    if (is_mp4 === true) {
      if (mp4size >= 80) {
        //群和私聊分开
        await this.e.reply('视频过大，尝试通过文件上传，请稍后移步群文件查看', false, { recallMsg: 30 })
        await this.upload_file(path) //上传
        await removeFileOrFolder(path) //删除缓存(?)
      } else {
        await this.e.reply(segment.video(path))
        await removeFileOrFolder(path)
      }
    }
  }

  /**
   * 
   * @param {*} Data video or note data
   * @param {*} CommentData commments data
   * @param {*} is_mp4 boolean
   * @returns 
   */
  async v1_dy_data(Data, CommentData, is_mp4) {
    let v1data = Data
    let g_video_url = ""
    let g_title
    let full_data = [] //总数组
    //comments
    let comments_res = []
    if (CommentData.data !== null && Config.comments === true) {
      let comments_data = []
      let commentsres = []
      for (let i = 0; i < CommentData.comments.length; i++) {
        let text = CommentData.comments[i].text

        for (let emoji in emojiMap) {
          const regex = new RegExp('\\[' + emoji + '\\]', 'g')
          if (text.includes(emoji)) {
            text = text.replace(regex, emojiMap[emoji]);
          }
        }

        let digg_count = CommentData.comments[i].digg_count
        if (digg_count > 10000) {
          digg_count = (digg_count / 10000).toFixed(1) + "w"
        }
        console.log(`${text}\n`)
        commentsres.push(`${text}\n♥${digg_count}`)
      }
      let dsc = '评论数据'
      let res = await common.makeForwardMsg(this.e, commentsres, dsc)
      comments_data.push(res)
      comments_res.push(comments_data)
    } else if (CommentData.data === null) { comments_res.push('评论数据获取失败') }
    //这里获取图集信息-------------------------------------------------------------------------------------------------------------
    let imagenum = 0
    let image_res = []
    if (is_mp4 === false) {
      let image_data = []
      let imageres = []
      let image_url
      for (let i = 0; i < v1data.aweme_detail.images.length; i++) {
        image_url = v1data.aweme_detail.images[i].url_list[1] //图片地址
        let title = (v1data.aweme_detail.preview_title).substring(0, 50)
          .replace(/[\\/:\*\?"<>\|\r\n]/g, ' ') //标题，去除特殊字符
        g_title = title
        imageres.push(segment.image(image_url)) //合并图集字符串
        imagenum++
        if (Config.rmmp4 === false) {
          await mkdirs(process.cwd() + `resources/kkkdownload/images/${g_title}`)
          let path = process.cwd() + `resources/kkkdownload/images/${g_title}/${i + 1}.png`
          await fetch(image_url)
            .then(res => res.arrayBuffer())
            .then(data => fs.promises.writeFile(path, Buffer.from(data)))
        }
      }
      if (imagenum === 1) {
        await this.e.reply(segment.image(image_url))
      }

      let dsc = '解析完的图集图片'
      let res = await common.makeForwardMsg(this.e, imageres, dsc)
      image_data.push(res)
      image_res.push(image_data)
    }

    //这里获取创作者信息------------------------------------------------------------------------------------------------------------
    let author_res = []
    if (v1data.aweme_detail.author) {
      let author_data = []
      let authorres = []
      const author = v1data.aweme_detail.author
      let sc = await this.count(author.favoriting_count) //收藏
      let gz = await this.count(author.follower_count) //关注
      let id = author.nickname //id
      let jj = author.signature //简介
      let age = author.user_age //年龄
      let sczs = author.total_favorited
      authorres.push(`创作者名称：${id}`)
      authorres.push(`创作者：${id}拥有${gz}个粉丝，${sc}个收藏和${sczs}个收藏总数`)
      authorres.push(`${id}今年${age}岁，Ta的简介是：\n${jj}`)
      let dsc = '创作者信息'
      let res = await common.makeForwardMsg(this.e, authorres, dsc)
      author_data.push(res)
      author_res.push(author_data)
    }
    //这里获取BGM信息------------------------------------------------------------------------------------------------------------
    let music_res = []
    if (v1data.aweme_detail.music) {
      let music_data = []
      let musicres = []
      const music = v1data.aweme_detail.music
      let music_id = music.author //BGM名字
      let music_img = music.cover_hd.url_list[0] //BGM作者头像
      let music_url = music.play_url.uri //BGM link
      if (is_mp4 === false && Config.rmmp4 === false && music_url !== undefined) {
        let path = process.cwd() + `resources/kkkdownload/images/${g_title}/BGM.mp3`
        await fetch(music_url)
          .then(bgmfile => bgmfile.arrayBuffer())
          .then(downloadbgm => fs.promises.writeFile(path, Buffer.from(downloadbgm)))
      }
      musicres.push(`BGM名字：${music_id}`)
      musicres.push(`BGM下载直链：${music_url}`)
      musicres.push(segment.image(music_img))
      let dsc = 'BGM相关信息'
      let res = await common.makeForwardMsg(this.e, musicres, dsc)
      music_data.push(res)
      music_res.push(music_data)
      if (music_url && is_mp4 === false && music_url !== undefined) {
        await this.e.reply(await uploadRecord(music_url, 0, false))
      }
    }
    //return
    //这里是ocr识别信息-----------------------------------------------------------------------------------------------------------
    let ocr_res = []
    if (v1data.aweme_detail.seo_info.ocr_content) {
      let ocr_data = []
      let ocrres = []
      let text = v1data.aweme_detail.seo_info.ocr_content
      ocrres.push('说明：\norc可以识别视频中可能出现的文字信息')
      ocrres.push(text)
      let dsc = 'ocr视频信息识别'
      let res = await common.makeForwardMsg(this.e, ocrres, dsc)
      ocr_data.push(res)
      ocr_res.push(ocr_data)
    } else {
      ocr_res.push('视频或图集中未发现可供ocr识别的文字信息')
    }
    //这里是获取视频信息------------------------------------------------------------------------------------------------------------
    let video_res = []
    if (is_mp4 === true) {
      //console.log(JSON.stringify(v1data))
      //return
      let video_data = []
      let videores = []
      //视频地址特殊判断：play_addr_h264、play_addr、
      const video = v1data.aweme_detail.video
      let FPS = video.bit_rate[0].FPS //FPS
      if (v1data.aweme_detail.video.play_addr_h264) {
        g_video_url = video.play_addr_h264.url_list[2]
      } else if (v1data.aweme_detail.video.play_addr) {
        g_video_url = video.play_addr.url_list[2]
      }
      let cover = video.origin_cover.url_list[0] //video cover image
      let title = v1data.aweme_detail.preview_title.substring(0, 80).replace(/[\\/:\*\?"<>\|\r\n]/g, ' ') //video title
      g_title = title
      let video_url_data = await fetch(g_video_url, { headers: headers })

        .then(res => {
          if (!res.ok) {
            throw new Error('访问视频链接被拒绝，无法处理请求！')
          }
          let content_lenght = res.headers.get('content-length')
          let LastUrl = res.url
          return {
            LastUrl,
            content_lenght,
          }
        })
      let video_size_mb = (video_url_data.content_lenght / 1024 / 1024).toFixed(2)
      mp4size = video_size_mb
      //logger.info(`正在下载大小为${video_size_mb}MB的视频\n${video_url_data.LastUrl}`)
      videores.push(`标题：\n${title}`)
      videores.push(`视频帧率：${"" + FPS}\n视频大小：${video_size_mb}MB`)
      videores.push(`等不及视频上传可以先看这个，视频直链：\n${g_video_url}`)
      videores.push(segment.image(cover))
      let dsc = '视频基本信息'
      let res = await common.makeForwardMsg(this.e, videores, dsc)
      video_data.push(res)
      video_res.push(video_data)
    }
    const tip = ['视频正在上传']
    let res
    if (is_mp4 === true) { res = full_data.concat(tip).concat(video_res).concat(comments_res).concat(image_res).concat(music_res).concat(author_res).concat(ocr_res) }
    else { res = full_data.concat(video_res).concat(image_res).concat(comments_res).concat(music_res).concat(author_res).concat(ocr_res) }
    return {
      res,
      g_video_url,
      g_title
    }
  }

  /**
   * @param {*} file 上传图片到腾讯图床
   * @returns 
   */
  async upload_image(file) {
    return (await Bot.pickFriend(Bot.uin)._preprocess(segment.image(file))).imgs[0];
  }

  /** 获取机器人上传的图片链接 */
  async getHistoryLog() {
    return ((await Bot.pickGroup(Number(e.group_id)).getChatHistory(Bot.uin.seq, 1))[0].message[0].url)
  }

  /** 要上传的视频文件，私聊需要加好友 */
  async upload_file(file) {
    if (this.e.isGroup) {
      await this.e.group.fs.upload(file)
      await removeFileOrFolder(file)
    }
    else if (this.e.isPrivate) {
      await this.e.friend.sendFile(file)
      await removeFileOrFolder(file)
    }
  }
}

async function removeFileOrFolder(path) {
  if (Config.rmmp4 === true || Config.rmmp4 === undefined) {
    try {
      const stats = await new Promise((resolve, reject) => {
        fs.stat(path, (err, stats) => {
          if (err) reject(err)
          resolve(stats);
        })
      })
      if (stats.isFile()) {
        //指向文件
        fs.unlink(path)
        console.log(`文件缓存删除`)
      }
    } catch (err) {
      console.error('无法删除缓存文件\n', err)
    }
  }
}

/** 文件夹名字 */
async function mkdirs(dirname) {
  if (fs.existsSync(dirname)) {
    return true
  } else {
    if (mkdirs(path.dirname(dirname))) {
      fs.mkdirSync(dirname)
      return true
    }
  }
}

/**
 * 
 * @param {*} video_url 
 * @param {*} title 
 */
async function DownLoadVideo(video_url, title) {
  let response = await fetch(video_url, {
    headers: headers
  })
  //写入流
  let writer = fs.createWriteStream(`resources/kkkdownload/video/${title + '.mp4'}`)
  response.body.pipe(writer)
  return new Promise((resolve) => {
    writer.on('finish', () => {
      console.log(writer.path)
      resolve(writer.path)
    })
  })
}

const headers = {
  "Server": "CWAP-waf",
  "Content-Type": "video/mp4",
  "Origin": "https://www.douyin.com",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.43"
}

export default TikHub
