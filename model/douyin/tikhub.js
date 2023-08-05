import fetch from "node-fetch"
import fs from 'fs'
import fse from 'fs-extra'
import common from "../../../../lib/common/common.js"
import uploadRecord from "../uploadRecord.js"
import path from "node:path"
import { Config } from "../config.js"
const _path = process.cwd()
let globalmp4_path = { path: "" }
let mp4size = ''
let globalvideo_url
let global_title = ''


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
   * @param {*} dydata data
   * @param {*} is_mp4 true or false
   * @returns 
   */
  async gettype(dydata, is_mp4) {
    await this.v1_dy_data(dydata, is_mp4)
    if (is_mp4 === true) { //判断是否是视频
      if (mp4size >= 80) {
        //群和私聊分开
        await this.e.reply('视频过大，尝试通过文件上传', false, { recallMsg: 30 })
        await this.upload_file(globalmp4_path) //上传
        await removeFileOrFolder(globalmp4_path) //删除缓存(?)
      } else {
        //await getFileMd5(globalmp4_path)
        await this.e.reply(segment.video(globalmp4_path)) //否则直接发视频
        await removeFileOrFolder(globalmp4_path)
      }
    }
    return true

  }

  /**
   * 
   * @param {*} dydata 传入视频json
   */
  async v1_dy_data(dydata, is_mp4) {
    let v1data = dydata
    let full_data = [] //总数组
    //这里获取图集信息-------------------------------------------------------------------------------------------------------------
    let imagenum = 0
    let image_res = []
    if (is_mp4 === false) {
      let image_data = []
      let imageres = []
      let image_url = ''
      for (let i = 0; i < v1data.aweme_list[0].images.length; i++) {
        image_url = v1data.aweme_list[0].images[i].url_list[1] //图片地址
        console.log(image_url)
        let title = (v1data.aweme_list[0].preview_title).substring(0, 50)
          .replace(/[\\/:\*\?"<>\|\r\n]/g, ' ') //标题，去除特殊字符
        global_title = title
        imageres.push(segment.image(image_url)) //合并图集字符串
        imagenum++
        if (Config.rmmp4 === false) {
          mkdirs(`resources/kkkdownload/images/${global_title}`)
          //globalmp4_path = `resources/kkkdownload/images/${global_title}`
          let path = `resources/kkkdownload/images/${global_title}/${i + 1}.png`
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
    //判断小程序(先搁置，有bug还没想到怎么修)---------------------------------------------------------------------------------------------------------
    let jianying_res = []
    /*try {
      if (v1data.aweme_list[0].anchor_info) {
        let jianying_data = []
        let jianyingres = []
        let parse = v1data.aweme_list[0].anchor_info.extra
        //console.log(parse)
        parse = parse.replace(/\\/g, '')
        let str = ''
        let inString = false
        for (let i = 0; i < parse.length; i++) {
          if (parse[i] === '"' && (i === 0 || parse[i - 1] !== '\\')) inString = !inString
          if (parse[i] === '\\') continue   // 所有反斜杠替换为空
          str += parse[i]
        }
        parse = str
        let jydata = JSON.stringify(parse)
        console.log(jydata)
        if (jydata.anchor.name) { }
        let name = jydata.anchor.name
        let url = jydata.anchor.url
        let get_jy_data = (`这条视频使用剪映模板\n"${name}" 制作\n模板链接:\n${url}`)
        jianyingres.push(get_jy_data)
        let dsc = `剪映模板名称：${name}`
        let res = await common.makeForwardMsg(this.e, jianyingres, dsc)
        jianying_data.push(res)
        jianying_res.push(jianying_data)
      } else {
        jianying_res.push('未发现使用剪映模板制作')
      }
    } catch (err) { logger.error(err) }*/
    //这里获取创作者信息------------------------------------------------------------------------------------------------------------
    let author_res = []
    if (v1data.aweme_list[0].author) {
      let author_data = []
      let authorres = []
      const author = v1data.aweme_list[0].author
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
    if (v1data.aweme_list[0].music) {
      let music_data = []
      let musicres = []
      const music = v1data.aweme_list[0].music
      let music_id = music.author //BGM名字
      let music_img = music.cover_hd.url_list[0] //BGM作者头像
      let music_url = music.play_url.uri //BGM link
      if (is_mp4 === false && Config.rmmp4 === false) {
        let path = `resources/kkkdownload/images/${global_title}/BGM.mp3`
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
      if (v1data.aweme_list[0].images !== null) {
        await this.e.reply(await uploadRecord(music_url, 0, false))
      }
    }
    //这里是ocr识别信息-----------------------------------------------------------------------------------------------------------
    let ocr_res = []
    if (v1data.aweme_list[0].seo_info.ocr_content) {
      let ocr_data = []
      let ocrres = []
      let text = v1data.aweme_list[0].seo_info.ocr_content
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
    if (v1data.aweme_list[0].video.play_addr_h264 || v1data.aweme_list[0].video.play_addr.url_list[2]) {
      //console.log(JSON.stringify(v1data))
      //return
      let video_data = []
      let videores = []
      //视频地址特殊判断：play_addr_h264、play_addr、
      const video = v1data.aweme_list[0].video
      let FPS = video.bit_rate[0].FPS //FPS
      if (v1data.aweme_list[0].video.play_addr_h264) {
        globalvideo_url = video.play_addr_h264.url_list[2]
      } else if (v1data.aweme_list[0].video.play_addr) {
        globalvideo_url = video.play_addr.url_list[2]
      }
      let cover = video.origin_cover.url_list[0] //video cover image
      let title = v1data.aweme_list[0].preview_title //video title
      global_title = title
      let video_url_data = await fetch(globalvideo_url, { headers: headers })

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
      logger.info(`正在下载大小为${video_size_mb}MB的视频\n${video_url_data.LastUrl}`)
      videores.push(`标题：\n${title}`)
      videores.push(`视频帧率：${"" + FPS}\n视频大小：${video_size_mb}MB`)
      videores.push(`等不及视频上传可以先看这个，视频直链：\n${globalvideo_url}`)
      videores.push(segment.image(cover))
      let dsc = '视频基本信息'


      let res = await common.makeForwardMsg(this.e, videores, dsc)
      video_data.push(res)
      video_res.push(video_data)
    }
    const tip = []
    tip.push('视频正在上传')
    let res = full_data.concat(tip).concat(video_res).concat(image_res).concat(music_res).concat(author_res).concat(ocr_res)
    //let res = full_data.concat(image_res).concat(music_res).concat(author_res).concat(ocr_res)
    await this.e.reply(await common.makeForwardMsg(this.e, res, '抖音'))
    if (is_mp4 === true) { await DownLoadVideo(globalvideo_url, global_title) }
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
      const stats = await fs.promises.stat(path)
      if (stats.isFile()) {
        //指向文件
        await fs.promises.unlink(path)
        console.log(`文件缓存删除`)
      } else if (stats.isDirectory()) {
        //指向目录
        await fse.remove(path)
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

async function DownLoadVideo(video_url, title) {
  let response = await fetch(video_url, {
    headers: headers
  })
  //写入流
  let writer = fs.createWriteStream(`resources/kkkdownload/video/${title.substring(0, 80).replace(/[\\/:\*\?"<>\|\r\n]/g, ' ') + '.mp4'}`)
  response.body.pipe(writer)
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve)
    writer.on('error', reject)
  })
  logger.info('视频下载(写入)成功，正在上传')
  globalmp4_path = writer.path
}

const headers = {
  "Server": "CWAP-waf",
  "Content-Type": "video/mp4",
  "Origin": "https://www.douyin.com",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.43"
}

export default TikHub
