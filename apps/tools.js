import plugin from '../../../lib/plugins/plugin.js'
import common from '../../../lib/common/common.js'
import TikHub from '../model/douyin/tikhub.js'
import { Config } from '../model/config.js'
import { Argument } from '../model/douyin/getdata.js'
import { judgment } from '../model/douyin/judgment.js'
import fetch from 'node-fetch'
import fs from "fs/promises"
const _path = process.cwd()

export class example extends plugin {
  constructor() {
    const rule = Config.videotool ? [
      { reg: '^((.*)复制打开抖音(.*)|(.*)v.douyin.com(.*)|(.*)(douyin.com/video)(.*))$', fnc: 'douy' },
      { reg: '^((.*)tiktok.com(.*))$', fnc: 'Tiktok' },
      { reg: '^((.*)快手(.*)快手(.*)|(.*)v.kuaishou(.*))$', fnc: 'kuaiscz' }
    ] : [];
    super({
      name: 'kkkkkk-10086-视频功能',
      dsc: '视频',
      event: 'message',
      priority: 200,
      rule: rule
    })
  }
  //抖音----------------------------------------------------------------------------------
  async douy(e) {
    let tikhub = new TikHub(this.e)

    let regexp = /((http|https):\/\/([\w\-]+\.)+[\w\-]+(\/[\w\u4e00-\u9fa5\-\.\/?\@\%\!\&=\+\~\:\#\;\,]*)?)/ig;
    let URL = e.toString().match(regexp)
    let response = await fetch(URL, Config.options)
    let iddata = await judgment(response)

    let data = await Argument(iddata.video_id, iddata.is_mp4)
    let res = await tikhub.v1_dy_data(data.VideoData.data, data.CommentsData.data, data.VideoData.is_mp4)

    await e.reply(await common.makeForwardMsg(e, res.res, '抖音'))
    await tikhub.gettype(iddata.is_mp4, res.g_video_url, res.g_title)
  }
  
  //tiktok------------------------------------------------------------------------------------------
  async Tiktok(e) {
    //JS 正则匹配 URL
    let mr = e.msg.replace("Tiktok", "").trim()
    let nrymsg = await fetch(`https://api.douyin.wtf/api?url=${mr}`, {
      method: "GET"
    })
    let data = await nrymsg.json()
    let qiy = {
      "Server": "CWAP-waf",
      "Content-Type": "video/mp4",
    }

    let mp4 = await fetch(`${data.video_data.nwm_video_url_HQ}`, { method: "get", headers: qiy })
    e.reply([`发现Tik Tok分享...\n正在读取 URL...`])
    let lopp = await mp4.buffer();
    let path = `${_path}/plugins/example/Tiktok.mp4`
    await fs.writeFile(path, lopp, "binary", function (err) {
      if (!err) {
        // 下载视频成功
        e.reply([segment.video(path)]);
        console.log("视频下载成功");
      }
      return true
    })
  }


  //--------快手-------------------------------------------------------------------------------------------------
  async kuaiscz(e) {

    //JS 正则匹配 URL
    let regexp = /((http|https):\/\/([\w\-]+\.)+[\w\-]+(\/[\w\u4e00-\u9fa5\-\.\/?\@\%\!\&=\+\~\:\#\;\,]*)?)/ig;
    let mr = e.toString().match(regexp);
    let msg = await fetch(`${mr}`, {
      method: "get",
    });

    let url = await msg.url;
    // console.log(url)
    //获取跳转url

    let fid = ""
    url.replace(/fid=(.*)&cc/g, function (a1) {
      fid = a1.replace('fid=', '').replace('&cc', '')
      return ""
    })
    // console.log(fid)
    //视频id

    let shareToken = ""
    url.replace(/shareToken=(.*)&shareResourceType/g, function (a1) {
      shareToken = a1.replace('shareToken=', '').replace('&shareResourceType', '')
      return ""
    })
    // console.log(shareToken)

    let shareObjectId = ""
    url.replace(/shareObjectId=(.*)&shareUrlOpened/g, function (a1) {
      shareObjectId = a1.replace('shareObjectId=', '').replace('&shareUrlOpened', '')
      return ""
    })

    let shareId = ""
    url.replace(/shareId=(.*)&shareToken/g, function (a1) {
      shareId = a1.replace('shareId=', '').replace('&shareToken', '')
      return ""
    })


    let photoId = ""
    url.replace(/photoId=(.*)&shareId/g, function (a1) {
      photoId = a1.replace('photoId=', '').replace('&shareId', '')
      return ""
    })


    let mouy = {
      "operationName": "visionVideoDetail",
      "variables": {
        "photoId": `${photoId}`,
        "page": "detail"
      },
      "query": "query visionVideoDetail($photoId: String, $type: String, $page: String, $webPageArea: String) {\n  visionVideoDetail(photoId: $photoId, type: $type, page: $page, webPageArea: $webPageArea) {\n    status\n    type\n    author {\n      id\n      name\n      following\n      headerUrl\n      __typename\n    }\n    photo {\n      id\n      duration\n      caption\n      likeCount\n      realLikeCount\n      coverUrl\n      photoUrl\n      liked\n      timestamp\n      expTag\n      llsid\n      viewCount\n      videoRatio\n      stereoType\n      musicBlocked\n      manifest {\n        mediaType\n        businessType\n        version\n        adaptationSet {\n          id\n          duration\n          representation {\n            id\n            defaultSelect\n            backupUrl\n            codecs\n            url\n            height\n            width\n            avgBitrate\n            maxBitrate\n            m3u8Slice\n            qualityType\n            qualityLabel\n            frameRate\n            featureP2sp\n            hidden\n            disableAdaptive\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      manifestH265\n      photoH265Url\n      coronaCropManifest\n      coronaCropManifestH265\n      croppedPhotoH265Url\n      croppedPhotoUrl\n      videoResource\n      __typename\n    }\n    tags {\n      type\n      name\n      __typename\n    }\n    commentLimit {\n      canAddComment\n      __typename\n    }\n    llsid\n    danmakuSwitch\n    __typename\n  }\n}\n"
    }
    // console.log(mouy)

    let monr = JSON.stringify(mouy).trim()
    // console.log(monr)
    //合成请求

    let headers = {
      "Host": "www.kuaishou.com",
      "Connection": "keep-alive",
      "Content-Length": "1665",
      "accept": "*/*",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36",
      "content-type": "application/json",
      "Origin": "https://www.kuaishou.com",
      "X-Requested-With": "mixiaba.com.Browser",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
      "Referer": "https://www.kuaishou.com/short-video/3xpuqz8q3iuf6y4?userId=3xxkinh99kp5sy6",
      "Accept-Encoding": "gzip, deflate",
      "Accept-Language": "zh-CN,zh;q=0.9,te-CN;q=0.8,te;q=0.7,ug-CN;q=0.6,ug;q=0.5,en-US;q=0.4,en;q=0.3",
      "Cookie": "did=web_6658c6827a7d4b888304ec450b7ec1ca; didv=1667743407000; Hm_lvt_86a27b7db2c5c0ae37fee4a8a35033ee=1667743490; Hm_lpvt_86a27b7db2c5c0ae37fee4a8a35033ee=1667743490; kpf=PC_WEB; kpn=KUAISHOU_VISION; clientid=3; userId=2825489699; kuaishou.server.web_st=ChZrdWFpc2hvdS5zZXJ2ZXIud2ViLnN0EqABs0fkXqv43kjQMJk_TsNsEfo-FDVSR0D3CsV30AbBcXLUNWQw4I0n3K9wupx2pnDPLgXP7wVfFKrHljrUV_YWGz0JXJr97e1OsRUHVG0yoQoBcTHNSiRRMk9i8rAt2A6VS2vfA-Q4pHhMkdKtcuxG4wHmjAIiC7P7BDw4V9Wlzb9VJOaijgJqC1mmVZ1njaBv6rHR73HJMiDAEufnIwWAwhoSsguEA2pmac6i3oLJsA9rNwKEIiAH4WfZ82GKoxWnDNBJuFsqpehjIiSR_2IcP-BA9JyR3ygFMAE; kuaishou.server.web_ph=2779c2a8f91c9b71cd53694771d45961cc25"
    }


    //请求头
    let response = await fetch(`https://www.kuaishou.com/graphql`, {
      method: "POST",
      headers,
      body: `${monr}`
    });
    // console.log(response)


    let dat = await response.json();
    //console.log(dat.data)

    let res = []
    if (dat.data.visionVideoDetail.status == 1) {
      let first = ("Successfully processed, please wait for video upload")
      let zuoz = dat.data.visionVideoDetail.author.name
      //作者名称
      let shipmx = dat.data.visionVideoDetail.photo.caption
      //视频标题
      let xhx = dat.data.visionVideoDetail.photo.likeCount
      //视频❤️
      let zugz = dat.data.visionVideoDetail.photo.duration
      zugz = count(zugz)
      //视频评论量
      let zusoc = dat.data.visionVideoDetail.photo.realLikeCount
      //此视频收藏人数
      let zusbfl = dat.data.visionVideoDetail.photo.viewCount
      //此视频播放量
      let ship = dat.data.visionVideoDetail.photo.coverUrl
      //视频封面
      let shipdz = dat.data.visionVideoDetail.photo.photoUrl
      //视频地址
      let xmltitle = (`该视频在快手被播放超过了${zusbfl}次\n被双击了${xhx}次，共有${zugz}条评论`)

      /*
      let shipys=data.photo.soundTrack.audioUrls[0].url
      //视频原声
      let miuily=data.photo.soundTrack.name
      //视频来源
      */
      //处理消息
      res.push(first)
      res.push(`作者：${zuoz} 的快手视频作品`)
      res.push(`视频标题：${shipmx}`)
      res.push(`要是等不及视频上传，可以先看看这个 👇${shipdz}`)
      res.push(["视频封面：", segment.image(ship)])
      let video_data = await common.makeForwardMsg(e, "快手", res, xmltitle)
      await this.e.reply(video_data)
      /*e.reply([segment.image(`${ship}`), `视频作者：${zuoz}\n作品描述：${shipmx}\n\n视频双击：${xhx}\n视频评论：${zugz}\n视频收藏：${zusoc}\n此视频播放量：${zusbfl}\n\n正在转化视频～请等待......`
      ]);*/

      let qiy = {
        "Server": "CWAP-waf",
        "Content-Type": "video/mp4",
      }


      let mp4 = await fetch(`${shipdz}`, { method: "get", headers: qiy });

      let lopp = await mp4.buffer();
      let path = `${_path}/plugins/example/快手.mp4`;
      await fs.writeFile(path, lopp, "binary", function (err) {
        console.log(err || "下载视频成功");
        if (!err) {
          e.reply([segment.video(path)]);
        }
      });
    } else {
      e.reply([`获取失败了！可能不是视频！`])
    }
    return true
  }
}