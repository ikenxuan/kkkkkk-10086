import plugin from "../../../lib/plugins/plugin.js";
import fs from "node:fs";
import fetch from "node-fetch";
import Bilibili from "../model/bilibili.js";
import puppeteer from "../../../lib/puppeteer/puppeteer.js";


export class example extends plugin {
  constructor() {
    super({
      name: "B站功能",
      dsc: "b站相关指令",
      event: "message.group",
      priority: 500,
      rule: [
        {
          reg: "^2$",
          fnc: "newPushTask",
          permission: "master",
        },
      ],
    });

    
    /** 定时任务 */
    this.task = {
      cron: !!this.pushStatus
        ? this.pushTime
        : "",
      name: "检测b站推送定时任务",
      fnc: () => this.newPushTask(),
      log: !!this.pushTaskLog,
    };
  }
  async newPushTask() {
    let bilibili = new Bilibili(this.e);
    await bilibili.upTask();
  }

  async getBilibiliUp() {
    let url = `https://api.bilibili.com/x/web-interface/search/type?keyword=原神&page=1&search_type=bili_user&order=totalrank&pagesize=5`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        authority: "api.bilibili.com",
        cookie:
          "_uuid=04A91AF9-817E-5568-C260-F738C6992B3E65500infoc; buvid3=89F4F8FC-EC89-F339-53E0-BEB8917E839A65849infoc; buvid4=2D3B9929-A59A-751A-A267-64B84561875568042-022072912-ptQYXgw9NYmp0JTqr/FVmw%3D%3D; PVID=1; CURRENT_FNVAL=4048; nostalgia_conf=-1; i-wanna-go-back=-1; b_ut=7; innersign=0; b_lsid=D95BBB69_182DE35FC2B; fingerprint=8d0ef00128271df9bb681430277b95d0; buvid_fp_plain=undefined; buvid_fp=8d0ef00128271df9bb681430277b95d0",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "sec-ch-ua":
          '"Microsoft Edge";v="105", "Not)A;Brand";v="8", "Chromium";v="105"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": 1,
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36 Edg/105.0.1343.50",
      },
      redirect: "follow",
    });
    let data = await response.json();
    console.log(JSON.stringify(data))
    //return response;
  }

  
}
