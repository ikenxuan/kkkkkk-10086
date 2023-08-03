import fetch from 'node-fetch'
import { Config } from "../config.js"

let API_V1 = 'https://api.douyin.wtf/douyin_video_data/'
const API_V2 = 'https://api.tikhub.io/douyin/video_data/'
const API_v2_Comments = 'https://api.tikhub.io/douyin/video_comments/'
const API_Login = 'https://api.tikhub.io/user/login?token_expiry_minutes=525600&keep_login=true'
const API_Daily = 'https://api.tikhub.io/promotion/daily_check_in'
const API_Extra = 'https://api.tikhub.io/promotion/claim?promotion_id=1'

async function RequestV1Data(video_id, is_mp4, is_V2) {
    if (Config.address) API_V1 = `http://${Config.address}/douyin_video_data/`
    const res = await fetch(`${API_V1}?video_id=${video_id}`)
    let data = await res.json()
    data.is_mp4 = is_mp4
    data.is_V2 = is_V2
    return data
}
async function RequestV2Data(video_id, is_mp4, is_V2) {
    const res = await fetch(`${API_V2}?video_id=${video_id}`)
    let data = await res.json()
    data.comment_res = await RequestV2CommentsData(video_id)
    data.is_mp4 = is_mp4
    data.is_V2 = is_V2
    return data
}
async function RequestV2CommentsData(video_id) {
    const res = await fetch(`${API_v2_Comments}?video_id=${video_id}&cursor=0&count=50&language=zh`)
    return await res.json()
}
async function Argument(video_id, is_mp4, is_V2) {
    if (is_V2 === true) { return await RequestV2Data(video_id, is_mp4, is_V2) }
    if (is_V2 === false) { return await RequestV1Data(video_id, is_mp4, is_V2) }
}
async function TikHubLogin() {
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
        let vdata = await fetch(API_Login, {
            method: "POST",
            headers,
            body
        })
            .then(response => response.json())
            .catch(err => { throw new Error('可能是你网络原因或者对面服务器抽风了\n' + err) })
        //返回账号token
        let tokendata = await vdata
        logger.mark(tokendata)
        let accountfile = `${process.cwd()}/plugins/kkkkkk-10086/config/config.json`
        let doc = JSON.parse(fs.readFileSync(accountfile, 'utf8'));
        // 写入
        doc.access_token = tokendata.access_token;
        fs.writeFileSync(accountfile, JSON.stringify(doc, null, 2), 'utf8')
    } catch (err) {
        logger.error
    }
    try {
        await TikHubDaily()
    } catch (err) {
        logger.error(err)
    }
    return ('手动刷新token成功，该token拥有365天有效期')

}
async function TikHubDaily() {
    if (!Config.access_token) {
      return true
    }
    let headers2 = {
      "accept": "application/json",
      "Authorization": `Bearer ${Config.access_token}`,
    }

    let noteday = await fetch(API_Daily, {
      method: "GET",
      headers: headers2
    })
    let notedayjson = await noteday.json();
    await fetch(API_Extra, {
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

export {
    RequestV1Data,
    RequestV2Data,
    RequestV2CommentsData,
    Argument,
    TikHubLogin,
    TikHubDaily
}