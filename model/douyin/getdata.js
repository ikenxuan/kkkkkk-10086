import networks from "../../utils/networks.js";
import * as xbogus from "../douyin/xbogus.cjs";
import { Config } from "../config.js";
import crypto from "crypto";
// import fs from "fs";
// /** 直播间*/
// async function GetLiveroomData(options) {
//     return await network(options)
// }
//
// /** 用户主页视频*/
// async function GetUserVideos(options) {
//     return await network(options)
// }

export class base {
  constructor() {
    this.headers = {
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://www.douyin.com/",
      Cookie: Config.ck,
    };
    this.model = "Argument";
  }
}
export default class Argument extends base {
  async GetData(data) {
    /**
     * 0，视频或图集
     * 1，评论
     * 2，表情
     * 3，二级评论（默认获取3条）
     * 4，用户主页视频列表（默认获取18条）
     * 5，用户主页信息，不包含视频列表
     */
    let URL = [
      `https://www.douyin.com/aweme/v1/web/aweme/detail/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=${
        data.id
      }&pc_client_type=1&version_code=190500&version_name=19.5.0&cookie_enabled=true&screen_width=1536&screen_height=864&browser_language=zh-CN&browser_platform=Win32&browser_name=Edge&browser_version=115.0&browser_online=true&engine_name=Blink&engine_version=115.0&os_name=Windows&os_version=10&cpu_core_num=8&device_memory=&platform=PC&round_trip_time=0&webid=7221112461945194044&msToken=${await this.msToken(
        116
      )}`,
      `https://www.douyin.com/aweme/v1/web/comment/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=${
        data.id
      }&cursor=0&count=${
        Config.numcomments
      }&item_type=0&insert_ids=&whale_cut_token=&cut_version=1&rcFT=&pc_client_type=1&version_code=170400&version_name=17.4.0&cookie_enabled=true&screen_width=1552&screen_height=970&browser_language=zh-CN&browser_platform=Win32&browser_name=Chrome&browser_version=120.0.0.0&browser_online=true&engine_name=Blink&engine_version=120.0.0.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=8&platform=PC&downlink=10&effective_type=4g&msToken=${await this.msToken(
        116
      )}`,
      `https://www.douyin.com/aweme/v1/web/emoji/list`,
      `https://www.douyin.com/aweme/v1/web/comment/list/reply/?device_platform=webapp&aid=6383&channel=channel_pc_web&item_id=${
        data.id
      }&comment_id=${
        data.cid
      }&cut_version=1&cursor=0&count=3&item_type=0&pc_client_type=1&version_code=170400&version_name=17.4.0&cookie_enabled=true&screen_width=1552&screen_height=970&browser_language=zh-CN&browser_platform=Win32&browser_name=Chrome&browser_version=120.0.0.0&browser_online=true&engine_name=Blink&engine_version=120.0.0.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=8&platform=PC&downlink=10&effective_type=4g&round_trip_time=0&webid=7326516708850599434&msToken=${await this.msToken(
        116
      )}`,
      `https://www.douyin.com/aweme/v1/web/aweme/post/?device_platform=webapp&aid=6383&channel=channel_pc_web&sec_user_id=${
        data.id
      }&max_cursor=0&locate_item_id=7330189106061905204&locate_query=false&show_live_replay_strategy=1&need_time_list=1&time_list_query=0&whale_cut_token=&cut_version=1&count=18&publish_video_strategy_type=2&pc_client_type=1&version_code=170400&version_name=17.4.0&cookie_enabled=true&screen_width=1552&screen_height=970&browser_language=zh-CN&browser_platform=Win32&browser_name=Chrome&browser_version=120.0.0.0&browser_online=true&engine_name=Blink&engine_version=120.0.0.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=8&platform=PC&downlink=10&effective_type=4g&round_trip_time=50&webid=7327957959955580467&msToken=${await this.msToken(
        116
      )}`,
      `https://www.douyin.com/aweme/v1/web/user/profile/other/?device_platform=webapp&aid=6383&channel=channel_pc_web&publish_video_strategy_type=2&source=channel_pc_web&sec_user_id=${
        data.user_id
      }&personal_center_strategy=1&pc_client_type=1&version_code=170400&version_name=17.4.0&cookie_enabled=true&screen_width=1552&screen_height=970&browser_language=zh-CN&browser_platform=Win32&browser_name=Chrome&browser_version=120.0.0.0&browser_online=true&engine_name=Blink&engine_version=120.0.0.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=8&platform=PC&downlink=10&effective_type=4g&round_trip_time=0&webid=7327957959955580467&msToken=${await this.msToken(
        116
      )}`,
      `https://www.douyin.com/aweme/v1/web/api/suggest_words/?device_platform=webapp&aid=6383&channel=channel_pc_web&query=${encodeURIComponent(
        data.query
      )}&business_id=30088&from_group_id=7129543174929812767&pc_client_type=1&version_code=170400&version_name=17.4.0&cookie_enabled=true&screen_width=1552&screen_height=970&browser_language=zh-CN&browser_platform=Win32&browser_name=Chrome&browser_version=120.0.0.0&browser_online=true&engine_name=Blink&engine_version=120.0.0.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=8&platform=PC&downlink=10&effective_type=4g&round_trip_time=50&webid=7327957959955580467&msToken=${await this.msToken(
        116
      )}`,
    ];
    switch (data.type) {
      case "video":
      case "note":
        let VideoData = await this.GetVideoOrNoteData(
          {
            url: `${URL[0]}&X-Bogus=${await this.getParm(URL[0])}`,
            method: "GET",
            headers: this.headers,
          },
          data.is_mp4
        );

        let CommentsData = Config.comments
          ? await this.GlobalGetData({
              url: `${URL[1]}&X-Bogus=${await this.getParm(URL[1])}`,
              method: "GET",
              headers: this.headers,
            })
          : {
              code: 405,
              msg: "你没开评论解析的开关",
              data: null,
            };
        return { VideoData, CommentsData };

      case "CommentReplyData":
        let CommentReplyData = await this.GlobalGetData({
          url: `${URL[3]}&X-Bogus=${await this.getParm(URL[3])}`,
          method: "GET",
          headers: this.headers,
        });
        return CommentReplyData;

      case "UserInfoData":
        let UserInfoData = await this.GlobalGetData({
          url: `${URL[5]}&X-Bogus=${await this.getParm(URL[5])}`,
          method: "GET",
          headers: {
            ...this.headers,
            Referer: `https://www.douyin.com/user/${data.user_id}`,
          },
        });

        return UserInfoData;

      case "emoji":
        let EmojiData = await this.GlobalGetData({
          url: URL[2],
          headers: this.headers,
        });
        return EmojiData;

      case "UserVideosList":
        let UserVideoListData = await this.GlobalGetData({
          url: `${URL[4]}&X-Bogus=${await this.getParm(URL[4])}`,
          method: "GET",
          headers: {
            ...this.headers,
            Referer: `https://www.douyin.com/user/${data.id}`,
          },
        });
        return UserVideoListData;

      case "SuggestWords":
        let SuggestWordsData = await this.GlobalGetData({
          url: `${URL[6]}&X-Bogus=${await this.getParm(URL[6])}`,
          method: "GET",
          headers: {
            ...this.headers,
            Referer: `https://www.douyin.com/search/${encodeURIComponent(
              data.query
            )}?publish_time=0&sort_type=0&source=comment_named_entity_search&type=general`,
          },
        });
        return SuggestWordsData;

      // case 'live':
      //     //liveroom data
      //     let LiveroomData = await GetLiveroomData({
      //         url: `${url}&X-Bogus=${await this.getParm(url)}`,
      //         method: 'POST',
      //         headers: this.headers,
      //         data: { live_url: data.baseurl },
      //         type: '抖音直播间数据'
      //     })
      //     // logger.info('\nLiveRoom data', LiveroomData)
      //     return LiveroomData
      //

      default:
    }
  }

  async GlobalGetData(options) {
    let result = await new networks({
      url: options.url,
      headers: options.headers,
      type: "json",
    }).getData();
    return result;
  }
  /**
   *
   * @param {*} options opt
   * @param {*} is_mp4 boolean
   * @returns
   */
  async GetVideoOrNoteData(options, is_mp4) {
    let result = await new networks({
      url: options.url,
      headers: options.headers,
      type: "json",
    }).getData();
    if (result && String(is_mp4)) {
      result.is_mp4 = is_mp4;
    }
    return result;
  }

  async getParm(url) {
    return xbogus.sign(
      new URLSearchParams(new URL(url).search).toString(),
      this.headers["User-Agent"]
    );
  }
  async msToken(length) {
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const randomBytes = crypto.randomBytes(length);
    return Array.from(
      randomBytes,
      (byte) => characters[byte % characters.length]
    ).join("");
  }
}
