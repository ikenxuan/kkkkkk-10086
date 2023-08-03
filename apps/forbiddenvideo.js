import plugin from '../../../lib/plugins/plugin.js'
import common from '../../../lib/common/common.js'
import TikHub from '../model/douyin/tikhub.js'
import { Config } from '../model/config.js'
import { Argument, TikHubLogin, TikHubDaily } from '../model/douyin/request.js'
import fetch from 'node-fetch'
import fs from "fs"
const _path = process.cwd()

export class example extends plugin {
  constructor() {
    const rule = Config.videotool ? [
      { reg: '^((.*)复制打开抖音(.*)|(.*)v.douyin.com(.*)|(.*)(douyin.com/video)(.*))$', fnc: 'douy' },
      { reg: '^((.*)tiktok.com(.*))$', fnc: 'Tiktok' },
      { reg: '^((.*)快手(.*)快手(.*)|(.*)v.kuaishou(.*))$', fnc: 'kuaiscz' },
      { reg: '^#获取token$', fnc: 'gettoken' },
      { reg: '^#tikhub签到$', fnc: 'getnumber', log: false }
    ] : [];
    super({
      name: 'kkkkkk-10086-视频功能',
      dsc: '视频',
      /* oicq文档：https://oicqjs.github.io/oicq/#events */
      event: 'message',
      priority: 200,
      rule: rule
    })
  }
  //抖音----------------------------------------------------------------------------------
  async douy(e) {
    let tikhub = new TikHub(this.e)

    let regexp = /((http|https):\/\/([\w\-]+\.)+[\w\-]+(\/[\w\u4e00-\u9fa5\-\.\/?\@\%\!\&=\+\~\:\#\;\,]*)?)/ig;
    let URL = e.toString().match(regexp);
    const options = {
      followRedirects: true,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.4209.0 Safari/537.36'
      }
    }
    let response = await fetch(URL, options)
    let longLink = response.url
    const matchVideo = longLink.match(/video\/(\d+)/)
    const matchNote = longLink.match(/note\/(\d+)/)
    let video_id
    let data
    let is_mp4
    let is_V2 = false
    if ((!Config.access_token || Config.access_token === '') && Config.account && Config.password) is_V2 = true

    if (matchVideo) {
      video_id = matchVideo[1]
      is_mp4 = true
      data = await Argument(video_id, is_mp4, is_V2)
      await tikhub.gettype(data, data.is_mp4, data.is_V2)
      return
    } else if (matchNote) {
      video_id = matchNote[1]
      is_mp4 = false
      data = await Argument(video_id, is_mp4, is_V2)
      await tikhub.gettype(data, data.is_mp4, data.is_V2)
      return
    }
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
    fs.writeFile(path, lopp, "binary", function (err) {
      if (!err) {
        // 下载视频成功
        e.reply([segment.video(path)]);
        console.log("视频下载成功");
      }
      return true
    })
  }

  async xhs(e) {
    let regexp = /((http|https):\/\/([\w\-]+\.)+[\w\-]+(\/[\w\u4e00-\u9fa5\-\.\/?\@\%\!\&=\+\~\:\#\;\,]*)?)/ig;
    let URL = e.toString().match(regexp);
    const options = {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.4209.0 Safari/537.36',
        'Referer': 'https://www.xiaohongshu.com/',
        'Cookie': 'your-cookie-string-here'
      }
    };
    //重新请求获取笔记长链接
    let response = await fetch(URL, options);
    let longLink = response.url;
    //通过正则表达式匹配笔记id，并提取出来
    let regExp2 = /^https:\/\/www.xiaohongshu.com\/explore\/([a-zA-Z0-9]+)\?/;
    let matchResult = longLink.match(regExp2);
    let note_id = matchResult && matchResult[1];
    console.log(`笔记id：${note_id}`);
    //请求接口获取数据
    let token = AccountFile.access_token
    let headers = {
      "accept": "application/json",
      "Authorization": `Bearer ${token}`,
    }
    let xhs_fetch = await fetch(`https://api.tikhub.io/xhs/get_note_data/?note_id=${note_id}`, {
      method: "GET",
      headers: headers
    })
    let xhs_comments_fetch = await fetch(`https://api.tikhub.io/xhs/get_note_comments/?note_id=${note_id}`, {
      method: "GET",
      headers: headers
    })
    let xhs_note_json = await xhs_fetch.json();
    if (xhs_note_json.hasOwnProperty('detail') || xhs_note_json.detail?.status === false) {
      logger.error(logger.red(`请尝试获取新的TikHub账号！因为${xhs_note_json.detail.message}`) + '，可前往' + logger.blue('https://dash.tikhub.io/pricing ' + ' 购买额外请求次数或者' + logger.green('注册新账号')));
      return true;
    } else {
      logger.info('TikHub API' + logger.green('请求成功') + '，正在获取笔记：' + logger.yellow(longLink) + '的数据')
    }
    let xhs_comments_json = await xhs_comments_fetch.json(); //这里是评论数据，待开工
    //------------------------------------------------------------------------------------------------------------------------------------------------------
    //这里是通用的先处理，避免代码重复
    let dz = count(xhs_note_json.data.interact_info.liked_count) //点赞
    let sc = count(xhs_note_json.data.interact_info.collected_count) //收藏
    let pl = count(xhs_note_json.data.interact_info.comment_count) //评论
    let interact_info = (`这篇笔记有${dz}个赞，${sc}个收藏和${pl}条评论`) //xml卡片的标题
    let xhs_title = xhs_note_json.data.title //笔记标题
    let main_body = xhs_note_json.data.desc //正文
    //处理笔记tags
    let tagList = xhs_note_json.data.tag_list || [];
    let tags = tagList
      .filter((tag) => tag?.name) //过滤掉没有 name 属性的元素
      .map((tag) => `#${tag.name}`) //将 name 映射到标签数组中
      .join('\n'); //使用换行符连接标签字符串
    //-------------------------------------------------------------------------------------------------------------------------------------------------------
    if (xhs_note_json.data.type === 'normal') { //这里判断类型，normal是笔记，video是视频
      //处理笔记部分
      let xhs_data = [] //总字符串

      xhs_data.push(`笔记标题：\n\t\n${xhs_title}`)
      xhs_data.push(`笔记正文内容：\n\t\n${main_body}`)
      // 遍历每个图片对象
      let imageres = [] //这里是图片数组
      for (let i = 0; i < xhs_note_json.data.image_list.length; i++) {
        let image_url = xhs_note_json.data.image_list[i].url;
        imageres.push(segment.image(image_url))
      }
      let image_data = await common.makeForwardMsg(e, imageres, '笔记图片') //先合并一次图片到xml卡片
      xhs_data.push(image_data)
      xhs_data.push(`笔记标签如下：\n\t\n${tags}`);
      logger.info(xhs_data);
      await e.reply(this.makeForwardMsg(e.user_id, '小红书', interact_info, xhs_data)) //制作xml卡片并转发
    } else {
      //否则直接定义为视频
      let xhs_data = [] //总字符串
      let cover = xhs_note_json.data.image_list[0].url //封面
      xhs_data.push(`视频标签如下：\n\t\n${tags}`);
      xhs_data.push(`视频标题：${xhs_title}`)
      xhs_data.push(segment.image(cover))
      logger.info(xhs_data);
      await e.reply(this.makeForwardMsg(e.user_id, '小红书', interact_info, xhs_data)) //制作xml卡片并转发

      //下载视频到本地上传
      let mp4 = await fetch(`${xhs_note_json.data.video.media.stream.h264[0].master_url}`, {
        method: "get",
        headers: options
      });
      let a = await mp4.buffer();
      let path = `${_path}/plugins/example/xiaohongshu.mp4`;
      fs.writeFile(path, a, "binary", function (err) {
        if (!err) {
          e.reply([segment.video(path)]);
          console.log("视频下载成功");
        }
        return false
      })
    }
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
      let video_data = await this.makeForwardMsg(e.user_id, "快手", xmltitle, res)
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
      fs.writeFile(path, lopp, "binary", function (err) {
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
  async gettoken(e) {
    if (e.master) {
      return true
    }
    let message = await TikHubLogin()
    e.reply(message)
  }
  async getnumber(e) {
    if (e.master) {
      return true
    }
    let message = await TikHubDaily()
    e.reply(message)
  }


}