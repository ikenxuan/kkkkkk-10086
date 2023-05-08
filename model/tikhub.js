import fetch from "node-fetch"
import fs from 'fs'
const _path = process.cwd()
const accountfile = `${_path}/plugins/kkkkkk-10086/config/config.json`
const file = fs.readFileSync(accountfile, 'utf-8')
const AccountFile = JSON.parse(file)
const username = AccountFile.account //账号
const password = AccountFile.password //密码

/**
 * 
 * @param {*} url 提取后的链接
 * @returns 
 */
async function douyin(url) {
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
  } else {
    result.data = data_v2_json
    result.status = 2
  }
  return result
}
async function get_dy_data (dydata) {
  let data_v1_json = dydata.data
  let message = data_v1_json.message
  return message
}
async function gettoken() {
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
async function getnumber() {
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
export default {
  douyin,
  getnumber,
  gettoken,
  get_dy_data,
}

