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
    this.e = e;
  }
}
export class TikHub extends base {
  constructor(e) {
    super(e);
    this.model = "TikHub";
  }
  /**
   * @param {*} count 过万整除
   * @returns 
   */
  async count(count) {
    if (count > 10000) {
      return (count / 10000).toFixed(1) + "万";
    } else {
      return count.toString();
    }
  }

  /**
   * 
   * @param {*} dydata data
   * @param {*} is_mp4 true or false
   * @param {*} is_V2 true or false
   * @returns 
   */
  async gettype(dydata, is_mp4, is_V2) {
    if (is_V2 === false) {
      await this.v1_dy_data(dydata, is_mp4)
      if (is_mp4 === true) { //判断是否是视频
        if (mp4size >= 60) {
          //群和私聊分开
          await this.e.reply('视频过大，尝试通过文件上传', false, { recallMsg: 30 })
          await this.upload_file(globalmp4_path) //上传
          await this.removeFileOrFolder(globalmp4_path) //删除缓存(?)
        } else {
          //await getFileMd5(globalmp4_path)
          await this.e.reply(segment.video(globalmp4_path)) //否则直接发视频
          await this.removeFileOrFolder(globalmp4_path)
        }
      }
    } else if (is_V2 === true) {
      await this.v2_dy_data(dydata, is_mp4)
      if (is_mp4 === true) { //判断是否是视频
        if (mp4size >= 60) {
          //群和私聊分开
          await this.e.reply('视频过大，尝试通过文件上传', false, { recallMsg: 30 })
          await this.upload_file(globalmp4_path) //上传
          await this.removeFileOrFolder(globalmp4_path) //删除缓存(?)
        } else {
          await this.e.reply(segment.video(globalmp4_path)) //否则直接发视频
          await this.removeFileOrFolder(globalmp4_path)
        }
        logger.info('使用了 TikHub API 提供的解析服务')
      }
      return true
    }
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
      musicres.push(`BGM作者头像\n${music_img}`)
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
    let res = full_data.concat(video_res).concat(image_res).concat(music_res).concat(author_res).concat(ocr_res)
    //let res = full_data.concat(image_res).concat(music_res).concat(author_res).concat(ocr_res)
    await this.e.reply(await common.makeForwardMsg(this.e, res, '抖音'))
    if (is_mp4 === true) { await DownLoadVideo(globalvideo_url, global_title) }
  }

  /**
   * 
   * @param {*} dydata 传入视频json
   */
  async v2_dy_data(dydata, is_mp4) {
    this.e.gid = this.e.group_id
    let v2data = data
    // 先把评论数据抽出来------------------------------------------------------------------------------------------------------------------------------------------------------
    let pl_data = []
    if (dydata.comments && dydata.comments.comments_list) {
      let comments_list = dydata.comments.comments_list.slice(0, 15);
      let video_dz = []
      for (let i = 0; i < comments_list.length; i++) {
        let text = comments_list[i].text;
        let ip = comments_list[i].ip_label;
        let digg_count = comments_list[i].digg_count;
        if (digg_count > 10000) {
          digg_count = (digg_count / 10000).toFixed(1) + "w"
        }
        video_dz.push(`${text} \nip：${ip}            ♥${digg_count}`);
      }
      let dz_text = video_dz.join("\n\n\n")
      pl_data.push(`🔥热门评论🔥\n${dz_text}`)
    } else {
      pl_data.push("评论数据获取失败")
    }
    //提取图集数据------------------------------------------------------------------------------------------------------------------------------------------------------
    if (v2data.aweme_list[0].video.bit_rate.length === 0 || is_mp4 === false) {
      let res = []
      if (v2data.aweme_list[0].images[0].url_list[0] === undefined) {
        e.reply("请求错误，请再试一次...")
        return
      }
      //定位标题
      let bt = v2data.aweme_list[0].desc
      //作者头像
      let tx = v2data.aweme_list[0].author.avatar_thumb.url_list[0]
      //作者名称
      let name = v2data.aweme_list[0].author.nickname
      //BGM名字
      let BGMname = v2data.aweme_list[0].music.title
      //视频点赞、评论、分享、收藏
      let dz = await this.count(v2data.aweme_list[0].statistics.digg_count)
      let pl = await this.count(v2data.aweme_list[0].statistics.comment_count)
      let fx = await this.count(v2data.aweme_list[0].statistics.share_count)
      let sc = await this.count(v2data.aweme_list[0].statistics.collect_count)
      let xmltitle = (`该图集被点赞了${dz}次，拥有${pl}条评论，被分享了${fx}次`)
      //抖音号
      let dyid;
      if (v2data.aweme_list[0].author.unique_id === "") {
        if (v2data.aweme_list[0].author.short_id === "") {
          dyid = "找不到他/她的抖音ID"
        } else {
          dyid = v2data.aweme_list[0].author.short_id;
        }
      } else {
        dyid = v2data.aweme_list[0].author.unique_id;
      }
      //BGM直链
      let music = v2data.aweme_list[0].music.play_url.uri
      let cause = v2data.aweme_list[0].music.offline_desc
      let imagenum = 0 //记录图片数量
      //遍历图片数量
      let imgarr = []
      for (let i = 0; i < v2data.aweme_list.length; i++) {
        let aweme_list = v2data.aweme_list[i];
        for (let j = 0; j < aweme_list.images.length; j++) {
          //图片链接
          let image_url = aweme_list.images[j].url_list[0];
          let title = bt.substring(0, 50)
            .replace(/[\\/:\*\?"<>\|\r\n]/g, ' ') //标题，去除特殊字符
          imageres.push(segment.image(image_url)) //合并图集字符串
          if (Config.rmmp4 === false) {
            mkdirs(`resources/kkkdownload/images/${title}`)
            let path = `resources/kkkdownload/images/${title}` + `/${i + 1}.png`
            await fetch(image_url)
              .then(res => res.arrayBuffer())
              .then(data => fs.promises.writeFile(path, Buffer(data)))
          }

          imgarr.push(segment.image(image_url));
          imagenum++
          if (imagenum >= 100) { //数量达到100跳出循环
            break
          }
        }
        if (imagenum >= 100) { //数量达到100跳出循环
          break
        }
      }
      if (imagenum === 100) {
        let msg = await common.makeForwardMsg(this.e, res, xmltitle)
        await this.e.reply(msg)
      } else if (imagenum === 1) {
        let lbw = []
        let image_url = v2data.aweme_list[0].images[0].url_list[0];
        let lbwtitle = [`抖音号：${dyid}【${name}的图文作品】`, `图集标题：${bt}`]
        //let lbwbody = pl_data
        let lbwtial = (`BGM：${BGMname}\nBGM地址：${music}${cause}`)
        let pldata = []
        pldata.push(pl_data)
        let forpldata = await common.makeForwardMsg(this.e, pldata, '热门评论')
        await this.e.reply(segment.image(image_url))
        lbw.push(lbwtitle)
        lbw.push(forpldata)
        lbw.push(lbwtial)
        await this.e.reply(await common.makeForwardMsg(this.e, res, xmltitle))
      }
      else {
        //先合并转发一次评论数据
        let image_pldata = []
        image_pldata.push(pl_data)
        let image_forpldata = await common.makeForwardMsg(this.e, image_pldata, '热门评论')

        //处理字符串(如果图鸡不是100张)
        let textarr = [`抖音号：${dyid}【${name}的图文作品】`, `图集标题：${bt}`]
        //concat重新排列
        let resarr = textarr.concat(imgarr).concat(image_forpldata).concat(`BGM：${BGMname}\nBGM地址：${music}${cause}`)
        //logger.mark(resarr)
        let msg = await common.makeForwardMsg(this.e, res, xmltitle)
        await this.e.reply(msg)
      }
      if (!music) {
        await this.e.reply(`无法上传，原因：${cause}`, false)
        return
      } else {
        //发送高清语音
        console.log(`音频直链${music}${cause}`)
        await this.e.reply(await uploadRecord(music, 0, false))
      }
    }
    //获取视频数据---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
    else {
      let video_url = v2data.aweme_list[0].video.bit_rate[0].play_addr.url_list[2]
      let video_size = await fetch(video_url).then(res => res.headers.get('content-length'))
      let video_size_mb = (video_size / 1024 / 1024).toFixed(2)
      mp4size = video_size_mb
      logger.info(`正在下载大小为${video_size_mb}MB的视频\n${video_url}`)
      let qiy = {
        "Server": "CWAP-waf",
        "Content-Type": "video/mp4",
        "Origin": "https://www.douyin.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.43"
      }
      logger.info(`正在下载大小为${video_size_mb}MB的视频\n${video_url}`)
      let response = await fetch(video_url, {
        headers: qiy
      })
      let res2 = []
      let basic = "Successfully processed, please wait for video upload"
      //标题
      let bt = v2data.aweme_list[0].desc
      //抖音头像
      let tx = v2data.aweme_list[0].author.avatar_thumb.url_list[0]
      //作者名称
      let name = v2data.aweme_list[0].author.nickname
      //BGM名字
      let BGMname = v2data.aweme_list[0].music.title
      //抖音号
      //let dyid = v2data.author.unique_id
      let dyid;
      if (v2data.aweme_list[0].author.unique_id === "") {
        if (v2data.aweme_list[0].author.short_id === "") {
          dyid = "找不到他/她的抖音ID"
        } else {
          dyid = v2data.aweme_list[0].author.short_id;
        }
      } else {
        dyid = v2data.aweme_list[0].author.unique_id;
      }
      //视频点赞、评论、分享、收藏
      let dz = await this.count(v2data.aweme_list[0].statistics.digg_count)
      let pl = await this.count(v2data.aweme_list[0].statistics.comment_count)
      let fx = await this.count(v2data.aweme_list[0].statistics.share_count)
      let sc = await this.count(v2data.aweme_list[0].statistics.collect_count)
      let xmltitle = (`该被点赞了${dz}次，拥有${pl}条评论，被分享了${fx}次`)
      //BGM地址
      let music = v2data.aweme_list[0].music.play_url.uri
      let cause = v2data.aweme_list[0].music.offline_desc
      //视频封面
      //let cover = v2data.cover_data.dynamic_cover.url_list[0]
      //视频直链
      let video = v2data.aweme_list[0].video.bit_rate[0].play_addr.url_list[2]
      //处理基本信息
      res2.push(basic)
      res2.push(`抖音号：${dyid}【${name}的视频作品】`)
      res2.push(`视频标题：${bt}`)
      res2.push(`要是等不及视频上传（${video_size_mb}MB），可以先看看这个 👇${video}`)
      //处理评论数据(所有评论数据合并成一个字符串先)
      let video_pldata = []
      if (dydata.comments && dydata.comments.comments_list) {
        let comments_list = dydata.comments.comments_list.slice(0, 80);
        let video_dz = []
        for (let i = 0; i < comments_list.length; i++) {
          let text = comments_list[i].text;
          let ip = comments_list[i].ip_label;
          let digg_count = comments_list[i].digg_count;
          digg_count = this.count(digg_count)
          video_dz.push(`${text} \nip：${ip}            ♥${digg_count}`);
        }
        let dz_text = video_dz.join("\n\n\n")
        video_pldata.push(`🔥热门评论🔥\n${dz_text}`)
      } else {
        video_pldata.push("评论数据获取失败")
      }
      let video_forpldata = []
      video_forpldata.push(video_pldata)
      //合并转发
      let video_forwardmsg_pldata = await common.makeForwardMsg(this.e, pl_data, '热门评论')
      //然后再合并到res2字符串中等待再次转发(套娃)
      res2.push(video_forwardmsg_pldata)
      res2.push(`BGM：${BGMname}\nBGM地址：${music}${cause}`)
      //res2.push(`视频封面：${cover}`)
      //logger.mark(res2)
      let video_data = await this.makeForwardMsg(this.e.user_id, "抖音", xmltitle, res2)
      await this.e.reply(video_data)
      console.log("视频直链：", video)
      let writer = fs.createWriteStream(`resources/kkkdownload/video/${title.substring(0, 80).replace(/[\\/:\*\?"<>\|\r\n]/g, ' ') + '.mp4'}`);
      response.body.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      logger.info('视频下载(写入)成功，正在上传')
      globalmp4_path = writer.path;
    }


  }


  /**获取Tik Hub账号token */
  async gettoken() {
    if (!Config.account || !Config.password) {
      logger.error('未填写Tik Hub账号或密码，可在锅巴web后台填写')
      return true
    }
    let headers = {
      "accept": "application/json",
      "Content-type": "application/x-www-form-urlencoded",
    }
    let body = `grant_type=&username=${Config.username}&password=${Config.password}&scope=&client_id=&client_secret=`
    try {
      let vdata = await fetch(`https://api.tikhub.io/user/login?token_expiry_minutes=525600&keep_login=true`, {
        method: "POST",
        headers,
        body
      })
        .then(response => response.json())
        .catch(err => { throw new Error('可能是你网络原因或者对面服务器抽风了\n' + err) })
      //返回账号token
      let tokendata = await vdata
      logger.mark(tokendata)
      let accountfile = `${_path}/plugins/kkkkkk-10086/config/config.json`;
      let doc = JSON.parse(fs.readFileSync(accountfile, 'utf8'));
      // 写入
      doc.access_token = tokendata.access_token;
      fs.writeFileSync(accountfile, JSON.stringify(doc, null, 2), 'utf8')
    } catch (err) {
      logger.error
    }
    try {
      await this.getnumber()
    } catch (err) {
      logger.error(err)
    }
    return ('手动刷新token成功，该token拥有365天有效期')
  }

  /**签到获取Tik Hub账号请求次数 */
  async getnumber() {
    if (!Config.access_token) {
      return true
    }
    let headers2 = {
      "accept": "application/json",
      "Authorization": `Bearer ${Config.access_token}`,
    }

    let noteday = await fetch(`https://api.tikhub.io/promotion/daily_check_in`, {
      method: "GET",
      headers: headers2
    });
    let notedayjson = await noteday.json();
    await fetch(`https://api.tikhub.io/promotion/claim?promotion_id=1`, {
      method: "GET",
      headers: headers2
    })
    //logger.mark(notedayjson);
    if (notedayjson.status === true) {
      console.log(notedayjson.status)
      return (`刷新token成功，${notedayjson.message}`)
    } else if (notedayjson.message === '每24小时只能签到一次/You can only check in once every 24 hours') {
      console.log('账号24小时内不可多次签到\n' + notedayjson.message)
      return ('账号24小时内不可多次签到\n' + notedayjson.message)
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
    try {
      if (this.e.isGroup) {
        await this.e.group.fs.upload(file)
        await this.removeFileOrFolder(file)
      }
      else {
        if (this.e.isPrivate) {
          await this.e.friend.sendFile(file)
          await this.removeFileOrFolder(file)
        }
      }
    } catch (err) {
      await this.e.reply('视频文件上传出错：' + err)
      logger.error('视频文件上传出错：' + err)
    }

  }

  async removeFileOrFolder(path) {
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
}

/** 文件夹名字 */
function mkdirs(dirname) {
  if (fs.existsSync(dirname)) {
    return true
  } else {
    if (mkdirs(path.dirname(dirname))) {
      fs.mkdirSync(dirname)
      return true
    }
  }
}

async function DownLoadVideo(globalvideo_url, global_title) {
  let response = await fetch(globalvideo_url, {
    headers: headers
  })
  //写入流
  let writer = fs.createWriteStream(`resources/kkkdownload/video/${global_title.substring(0, 80).replace(/[\\/:\*\?"<>\|\r\n]/g, ' ') + '.mp4'}`)
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
