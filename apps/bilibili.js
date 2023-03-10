import plugin from "../../../lib/plugins/plugin.js";
import fs from "node:fs";
import fetch from "node-fetch";
import Bilibili from "../model/bilibili.js";

let bilibiliSetFile = "./plugins/kkkkkk-10086/config/bilibili.set.yaml";
if (!fs.existsSync(bilibiliSetFile)) {
  fs.copyFileSync(
    "./plugins/kkkkkk-10086/defSet/bilibili/set.yaml",
    bilibiliSetFile
  );
}

let bilibiliPushFile = "./plugins/kkkkkk-10086/config/bilibili.push.yaml";
if (!fs.existsSync(bilibiliPushFile)) {
  fs.copyFileSync(
    "./plugins/kkkkkk-10086/defSet/bilibili/push.yaml",
    bilibiliPushFile
  );
}

export class bilibili extends plugin {
  constructor() {
    super({
      name: "B站功能",
      dsc: "b站相关指令",
      event: "message.group",
      priority: 500,
      rule: [
        {
          reg: "^#*up\\s*[0-9]*$",
          fnc: "detail",
        },
        {
          reg: "^#*(添加|订阅|新增|增加)up推送\\s*(直播\\s*|视频\\s*|图文\\s*|文章\\s*|转发\\s*|直播\\s*)*.*$",
          fnc: "addPush",
          permission: "master",
        },
        {
          reg: "^#*(删除|取消|移除|去除)up推送\\s*(直播\\s*|视频\\s*|图文\\s*|文章\\s*|转发\\s*|直播\\s*)*.*$",
          fnc: "delPush",
          permission: "master",
        },
        {
          reg: "^#*推送(up)?列表$",
          fnc: "listPush",
          permission: "master",
        },
        {
          reg: "^#*搜索up.*$",
          fnc: "searchup",
          permission: "master",
        },
        {
          reg: "^#*手动推送up$",
          fnc: "newPushTask",
          permission: "master",
        },
      ],
    });

    /** 定时任务 */
    this.task = {
      cron: !!this.bilibiliSetData?.pushStatus
        ? this.bilibiliSetData.pushTime
        : "",
      name: "检测b站推送定时任务",
      fnc: () => this.newPushTask(),
      log: !!this.bilibiliSetData?.pushTaskLog,
    };
  }

  async newPushTask() {
    let bilibili = new Bilibili(this.e);
    await bilibili.upTask();
  }

}
