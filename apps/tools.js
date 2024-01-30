import plugin from "../../../lib/plugins/plugin.js";
import common from "../../../lib/common/common.js";
import TikHub from "../model/douyin/tikhub.js";
import { Config } from "../model/config.js";
import Argument from "../model/douyin/getdata.js";
import { judgment } from "../model/douyin/judgment.js";
import fetch from "node-fetch";
import fs from "fs/promises";
import cfg from "../../../lib/config/config.js";
const _path = process.cwd();

let getPriority = 800;
if (Config.defaulttool) {
  getPriority = -114514;
}

export class example extends plugin {
  constructor() {
    const rule = Config.videotool
      ? [
          {
            reg: "^((.*)复制打开抖音(.*)|(.*)(v|jx).douyin.com(.*)|(.*)(douyin.com/(video|note))(.*))$",
            fnc: "douy",
          },
          { reg: "^((.*)tiktok.com(.*))$", fnc: "Tiktok" },
        ]
      : [];
    super({
      name: "kkkkkk-10086-视频功能",
      dsc: "视频",
      event: "message",
      priority: getPriority,
      rule: rule,
    });
  }
  //抖音----------------------------------------------------------------------------------
  async douy(e) {
    if (Config.ck === "") {
      e.reply("抖音未设置ck，无法解析", true);
      console.log("使用 [#kkk设置抖音ck] 以设置抖音ck");
      return true;
    }

    //正则匹配url
    const regexp =
      /((http|https):\/\/([\w\-]+\.)+[\w\-]+(\/[\w\u4e00-\u9fa5\-\.\/?\@\%\!\&=\+\~\:\#\;\,]*)?)/gi;
    const url = e.toString().match(regexp);

    //获取数据
    const iddata = await judgment(url);
    const data = await new Argument().GetData(iddata);

    //解析返回数据
    const res = await new TikHub(e).GetData(iddata.type, data);
    if (cfg.bot.skip_login) return true;
    await e.reply(await common.makeForwardMsg(e, res.res, res.dec));
    if (iddata.is_mp4) {
      await new TikHub(e).downloadvideofile(res.g_video_url, res.g_title);
    }
  }

  //B站
  async bilibili(e) {
    const regexp =
      /((http|https):\/\/([\w\-]+\.)+[\w\-]+(\/[\w\u4e00-\u9fa5\-\.\/?\@\%\!\&=\+\~\:\#\;\,]*)?)/gi;
    const url = e.toString().match(regexp);
    console.log(url[0]);
  }

  //tiktok------------------------------------------------------------------------------------------
  async Tiktok(e) {
    //JS 正则匹配 URL
    let mr = e.msg.replace("Tiktok", "").trim();
    let nrymsg = await fetch(`https://api.douyin.wtf/api?url=${mr}`, {
      method: "GET",
    });
    let data = await nrymsg.json();
    let qiy = {
      Server: "CWAP-waf",
      "Content-Type": "video/mp4",
    };

    let mp4 = await fetch(`${data.video_data.nwm_video_url_HQ}`, {
      method: "get",
      headers: qiy,
    });
    e.reply([`发现Tik Tok分享...\n正在读取 URL...`]);
    let lopp = await mp4.buffer();
    let path = `${_path}/plugins/example/Tiktok.mp4`;
    await fs.writeFile(path, lopp, "binary", function (err) {
      if (!err) {
        // 下载视频成功
        e.reply([segment.video(path)]);
        console.log("视频下载成功");
      }
      return true;
    });
  }
}
