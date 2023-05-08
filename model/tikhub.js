import fetch from "node-fetch"
import fs from 'fs'
import common from "../../../lib/common/common.js"
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
  async gettype(code) {
    if (code === 1) {
      await v1_dy_data()
      return true
    }
    if (code === 2) {
      await v2_dy_data()
      true
    }
  }
  /**
   * 
   * @param {*} dydata 传入视频json列表
   */
  async v1_dy_data(dydata) {
    let v1data = dydata.data
    logger.warn(this.e.group_id)
    this.e.group = Bot.pickGroup(Number(group_id))
    //logger.info(this.e.user_id)
    //logger.info(v1data)
    if (v1data.aweme_list[0].images === null) {
      let jianying = []
      if (v1data.aweme_list[0].anchor_info) {
        let extra = JSON.parse(v1data.aweme_list[0].anchor_info.extra)
        let name = extra.anchor.name //剪映模板名称
        let url = extra.anchor.url //剪映模板链接
        jianying.push(`这条视频使用剪映模板 "${name}" 制作\n模板链接：${url}`)
      }
      let replymsg = await common.makeForwardMsg(this.e.user_id, jianying, 'test')
      this.e.group.sendMsg(replymsg)
      //let video = v1data.aweme_list[0].images
    }
  }

  /**
   * 
   * @param {*} url 提取后的链接
   * @returns 
   */
  async douyin(url) {
    const api_v1 = `https://api.douyin.wtf/douyin_video_data/?douyin_video_url=${url}`
    const api_v2 = `https://api.tikhub.io/douyin/video_data/?douyin_video_url=${url}&language=zh`
    let api_v1_josn = await fetch(api_v1, {
      method: 'GET',
      headers: {
        "accept": "application/json",
        "Content-type": "application/x-www-form-urlencoded",
      }
    })
    let api_v2_json = await fetch(api_v2, {
      method: 'GET',
      headers: {
        "accept": "application/json",
        "Authorization": `Bearer ${AccountFile.access_token}`,
      }
    })
    let data_v1_json = await api_v1_josn.json()
    let data_v2_json = await api_v2_json.json()
    let result = {}
    if (data_v2_json.hasOwnProperty('detail') || data_v2_json.detail?.status === false) {
      logger.error(logger.red(`请尝试获取新的TikHub账号！因为${data_v2_json.detail.message}`) + '，可前往' + logger.blue('https://dash.tikhub.io/pricing ' + ' 购买额外请求次数或者' + logger.green('注册新账号')))
      result.data = data_v1_json
      result.status = 1
      logger.info('使用了v1的API')
    } else {
      result.data = data_v2_json
      result.status = 2
      logger.info('使用了v2的API')
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

