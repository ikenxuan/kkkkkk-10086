import fetch from "node-fetch"
import fs from 'fs'
import common from "../../../lib/common/common.js"
import uploadRecord from "./uploadRecord.js"
const _path = process.cwd()
const accountfile = `${_path}/plugins/kkkkkk-10086/config/config.json`
const file = fs.readFileSync(accountfile, 'utf-8')
const AccountFile = JSON.parse(file)
const username = AccountFile.account //账号
const password = AccountFile.password //密码

export class base {
  constructor(e = {}) {
    this.e = e;
    this.userId = e?.user_id;
  }
}

export default class TikHub extends base {
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
   * @param {*} dydata 传入视频json
   */
  async v1_dy_data(dydata) {
    this.e.gid = this.e.group_id
    let v1data = dydata.data
    let full_data = [] //总数组
    //这里获取图集信息-------------------------------------------------------------------------------------------------------------
    let image_res = []
    if (v1data.aweme_list[0].img_bitrate !== null) {
      let image_data = []
      let imageres = []
      for (let i = 0; i < v1data.aweme_list[0].img_bitrate[1].images.length; i++) {
        let image_url = v1data.aweme_list[0].img_bitrate[1].images[i].url_list[2] //图片地址
        imageres.push(segment.image(image_url))
      }
      let dsc = '解析完的图集图片'
      let res = await common.makeForwardMsg(this.e, imageres, dsc)
      image_data.push(res)
      image_res.push(image_data)
    } else {
      image_res.push('此作品不是图集噢~')
    }
    //这里判断是否使用剪映模板制作---------------------------------------------------------------------------------------------------------
    let jianying_res = []
    if (v1data.aweme_list[0].anchor_info) {
      let jianying_data = []
      let jianyingres = []
      let parse = v1data.aweme_list[0].anchor_info.extra;
      parse = parse.replace(/\\/g, '');
      let jydata = JSON.parse(parse);
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
      musicres.push(`BGM名字：${music_id}`)
      musicres.push(`BGM下载直链：${music_url}`)
      musicres.push(`BGM作者头像\n${music_img}`)
      let dsc = 'BGM相关信息'
      let res = await common.makeForwardMsg(this.e, musicres, dsc)
      music_data.push(res)
      music_res.push(music_data)
      if (v1data.aweme_list[0].img_bitrate !== null) {
        this.e.reply(await uploadRecord(music_url, 0, false))
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
    if (v1data.aweme_list[0].video.play_addr_h264) {
      let video_data = []
      let videores = []
      const video = v1data.aweme_list[0].video
      let FPS = video.bit_rate[0].FPS //FPS
      let video_url = video.play_addr_h264.url_list[2] //video link
      let cover = video.origin_cover.url_list[0] //video cover image
      let title = v1data.aweme_list[0].preview_title //video title
      videores.push(`标题：\n${title}`)
      videores.push(`视频帧率：${"" + FPS}`)
      videores.push(`等不及视频上传可以先看这个，视频直链：\n${video_url}`)
      videores.push(segment.image(cover))
      let dsc = '视频基本信息'
      let res = await common.makeForwardMsg(this.e, videores, dsc)
      video_data.push(res)
      video_res.push(video_data)
      let qiy = {
        "Server": "CWAP-waf",
        "Content-Type": "video/mp4",
      }
      let mp4 = await fetch(`${video.play_addr_h264.url_list[2]}`, { method: "GET", headers: qiy });
      let a = await mp4.buffer();
      let path = `${_path}/plugins/example/douyin.mp4`;
      fs.writeFile(path, a, "binary", function (err) {
        if (!err) {
          //this.e.sendMsg(segment.video(path))
          console.log("视频下载成功");
        }
        return false
      })
    }
    let res = full_data.concat(video_res).concat(image_res).concat(music_res).concat(author_res).concat(jianying_res).concat(ocr_res)
    this.e.reply(await common.makeForwardMsg(this.e, res, '抖音'))
  }


  /**
   * 
   * @param {*} code douyin()添加的唯一状态码，判断用v1还是v2接口
   * @param {*} is_mp4 douyin()添加的唯一状态码，判断是视频还是图集
   * @param {*} dydata 视频json
   * @returns 
   */
  async gettype(code, is_mp4, dydata) {
    if (code === 1) {
      await this.v1_dy_data(dydata)
      if(is_mp4 === true) {
        this.e.reply(segment.video(`${_path}/plugins/example/douyin.mp4`));
        logger.info('使用了 douyin.wtf API ，无法提供' + logger.yellow('评论') + '与' + logger.yellow('小红书') + '解析')
      }  
      return true
    }
    if (code === 2) {
      await v2_dy_data() //还没写
      true
    }
  }

  /**
   * 
   * @param {*} url 提取后的链接
   * @returns 
   */                 //默认 https://api.douyin.wtf/douyin_video_data/?douyin_video_url=
  async douyin(url) { //有部署本地的可将v1换成 http://127.0.0.1:8000/douyin_video_data/?douyin_video_url=
    const api_v1 = `https://api.douyin.wtf/douyin_video_data/?douyin_video_url=${url}`
    const api_v2 = `https://api.tikhub.io/douyin/video_data/?douyin_video_url=${url}&language=zh`
    //这里的逻辑是：
    //1. 先正常请求v2接口1次
    //2. 如果此次v2接口返回的json说明 状态异常 或者因为网络原因 请求失败
    //3. 就请求v1，30s内无限请求v1，确保有数据返回，否则再打印日志
    let result = { status: 0 };
    try {
      let api_v2_json = await fetch(api_v2, {
        method: 'GET',
        headers: {
          "accept": "application/json",
          "Authorization": `Bearer ${AccountFile.access_token}`,
        }
      })
      let data_v2_json = await api_v2_json.json()
      if (data_v2_json.detail.status === false) {
        logger.warn(`使用 TikHub API 时${data_v2_json.detail.message}，可前往 https://dash.tikhub.io/pricing 购买额外请求次数或者注册新的TikHbu账号（理论上可以一直白嫖）`)
        throw new Error('TikHub API 请求成功但返回错误，将使用 douyin.wtf API 再次请求')
      }
      result.data = data_v2_json;
      result.status = 2;
      return result;
    } catch (err) {
      logger.error(`TikHub API 请求失败\n${err}`);
      logger.info(`开始请求备用接口：${api_v1}`)
      try {
        let api_v1_josn = await fetch(api_v1, {
          method: 'GET',
          headers: {
            "accept": "application/json",
            "Content-type": "application/x-www-form-urlencoded",
          }
        })
        let data_v1_json = await api_v1_josn.json()
        result.data = data_v1_json;
        if (data_v1_json.aweme_list[0].images === null) {
          result.is_mp4 = true
        }
        result.status = 1;
      } catch (err) {
        console.log(`使用v1的接口时${err}`)
        let startTime = Date.now();
        do {
          try {
            let api_v1_josn = await fetch(api_v1, {
              method: 'GET',
              headers: {
                "accept": "application/json",
                "Content-type": "application/x-www-form-urlencoded",
              }
            })
            let data_v1_json = await api_v1_josn.json()
            result.data = data_v1_json;
            if (data_v1_json.aweme_list[0].images === null) {
              result.is_mp4 = true
            }
            result.status = 1;
          } catch (err) {
            if (Date.now() - startTime > 30000) {
              console.log('30秒内 douyin.wtf API 连续请求失败');
              break;
            }
          }
        } while (true);
      }
    }
    return result
  }



  async gettoken() {
    let headers = {
      "accept": "application/json",
      "Content-type": "application/x-www-form-urlencoded",
    }
    let body = `grant_type=&username=${username}&password=${password}&scope=&client_id=&client_secret=`
    let vdata = await fetch(`https://api.tikhub.io/user/login?token_expiry_minutes=525600&keep_login=true`, {
      method: "POST",
      headers,
      body
    })
    //返回账号token
    let tokendata = await vdata.json();
    //logger.mark(tokendata)
    let accountfile = `${_path}/plugins/kkkkkk-10086/config/config.json`;
    let doc = JSON.parse(fs.readFileSync(accountfile, 'utf8'));
    // 将获取到的 access_token 写入 doc 对象，并写回到文件中
    doc.access_token = tokendata.access_token;
    fs.writeFileSync(accountfile, JSON.stringify(doc, null, 2), 'utf8')
    await getnumber()
    return ('刷新token成功，该token拥有365天有效期')
  }
  async getnumber() {
    let access_token = AccountFile.access_token;
    let headers2 = {
      "accept": "application/json",
      "Authorization": `Bearer ${access_token}`,
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
  * 
  * @param {*} qq icqq信息
  * @param {*} firsttitle 解析平台：？？？
  * @param {*} title xml标题
  * @param {*} msg 发送的内容
  * @returns 
  */
  async makeForwardMsg(qq, firsttitle, title, msg = []) {
    let nickname = Bot.nickname
    if (this.e.isGroup) {
      let info = await Bot.getGroupMemberInfo(this.e.group_id, qq)
      nickname = info.card ?? info.nickname
    }
    let userInfo = {
      user_id: this.e.user_id,
      nickname: this.e.sender.card || this.e.user_id,
    }

    let forwardMsg = []
    msg.forEach(v => {
      forwardMsg.push({
        ...userInfo,
        message: v
      })
    })

    /** 制作转发内容 */
    if (this.e.isGroup) {
      forwardMsg = await this.e.group.makeForwardMsg(forwardMsg)
    } else {
      forwardMsg = await this.e.friend.makeForwardMsg(forwardMsg)
    }

    /** 处理描述 */
    forwardMsg.data = forwardMsg.data
      .replace(/\n/g, '')
      .replace(/<?xml version="1.0" encoding="utf-8"?>/g, '___')
      .replace(/___+/, `<?xml version='1.0' encoding='UTF-8' standalone="yes"?>`)
      .replace(/<title color="#000000" size="34">转发的聊天记录<\/title>/g, '___')
      .replace(/___+/, `<title color="#000000" size="34">解析平台：${firsttitle}<\/title>`)
      .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
      .replace(/___+/, `<title color="#777777" size="26">${title}</title>`)
      .replace(/<summary color="#808080" size="26">/g, '___')
      .replace(/___+/, `<summary color="#808080">`)
      .replace(/<source name="聊天记录">/g, '___')
      .replace(/___+/, `<source name="解析平台：${firsttitle}">`)

    return forwardMsg
  }

}

