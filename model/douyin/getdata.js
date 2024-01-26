import networks from "../../utils/networks.js";
import * as xbogus from "../douyin/xbogus.cjs";
import { Config } from "../config.js";
// import fs from 'fs'
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
      accept: "application/json, text/plain, */*",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      Referer: "https://www.douyin.com/",
      Cookie: Config.ck,
    };
    this.model = "Argument";
  }
}
export default class Argument extends base {
  async GetData(data) {
    /**
     * 0，视频图集
     * 1，评论
     * 2，表情
     * 3，二级评论，默认获取3条
     * 4，用户主页介绍（不包含视频列表）
     */
    let URL = [
      `https://www.douyin.com/aweme/v1/web/aweme/detail/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=${data.id}&pc_client_type=1&version_code=190500&version_name=19.5.0&cookie_enabled=true&screen_width=1536&screen_height=864&browser_language=zh-CN&browser_platform=Win32&browser_name=Edge&browser_version=115.0&browser_online=true&engine_name=Blink&engine_version=115.0&os_name=Windows&os_version=10&cpu_core_num=8&device_memory=&platform=PC&round_trip_time=0&webid=7221112461945194044&msToken=3ai6kSEr0OLFsxD5cGDIt5X3Mtzo25eOBe3Nr--qEWSx_CupXmkvEmrirBcvJVtxbPLi1xcRpVbLZ6XchZo6c4HWUF5VRNy4FD7N2HGP-jv3cJc_wwIJ`,
      `https://www.douyin.com/aweme/v1/web/comment/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=${data.id}&cursor=0&count=${Config.numcomments}&item_type=0&insert_ids=&whale_cut_token=&cut_version=1&rcFT=&pc_client_type=1&version_code=170400&version_name=17.4.0&cookie_enabled=true&screen_width=1552&screen_height=970&browser_language=zh-CN&browser_platform=Win32&browser_name=Chrome&browser_version=120.0.0.0&browser_online=true&engine_name=Blink&engine_version=120.0.0.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=8&platform=PC&downlink=10&effective_type=4g&msToken=klyaJtQzQQYea408xRpvKudSMlZWwpFm61sq76XnfxDSEv9nM-AngQdYMbGIrvW22Pf2yRD2amA7doVM2PbiLtoBvSkQO_ATiKbSNB6fSNCqQynoCg==`,
      `https://www.douyin.com/aweme/v1/web/emoji/list`,
      `https://www.douyin.com/aweme/v1/web/comment/list/reply/?device_platform=webapp&aid=6383&channel=channel_pc_web&item_id=${data.id}&comment_id=${data.cid}&cut_version=1&cursor=0&count=3&item_type=0&pc_client_type=1&version_code=170400&version_name=17.4.0&cookie_enabled=true&screen_width=1552&screen_height=970&browser_language=zh-CN&browser_platform=Win32&browser_name=Chrome&browser_version=120.0.0.0&browser_online=true&engine_name=Blink&engine_version=120.0.0.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=8&platform=PC&downlink=10&effective_type=4g&round_trip_time=0&webid=7326516708850599434&msToken=eKvNP4SCY5qlw2p3I2dQLgIrSZNWaYS_lO_pcTrTAEzcWJR65pcNz4RUdO9hiC4dI9WF4kj-Lok9IPpkk_7rWWonsoTV4hHK9vxKTgj5lt1ZsYIVY9g=`,
      `https://www.douyin.com/aweme/v1/web/mix/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&sec_user_id=MS4wLjABAAAA1eSLmxvDF_AqaVU2siQKc3FWG6wit_wWzAwD1MYGd3cHdQBQzy1ewq5JJTp3qD7X&req_from=channel_pc_web&cursor=0&count=6&pc_client_type=1&version_code=170400&version_name=17.4.0&cookie_enabled=true&screen_width=1552&screen_height=970&browser_language=zh-CN&browser_platform=Win32&browser_name=Chrome&browser_version=120.0.0.0&browser_online=true&engine_name=Blink&engine_version=120.0.0.0&os_name=Windows&os_version=10&cpu_core_num=16&device_memory=8&platform=PC&downlink=10&effective_type=4g&round_trip_time=50&webid=7327957959955580467&msToken=heHLGHscrVcFqHEM3rYCikJ0ZP8wJBHfNjVY1C39BZEwtU5g4DUpxVKGFnk_Di8CfvaNiJW38jlxphgRVbSWrKAg4a5D01eOjsfMnec5lJ33ZQr6OTA=`,
    ];
    switch (data.type) {
      case "video":
      case "note":
        //work data
        let VideoData = await this.GetVideoOrNoteData(
          {
            url: `${URL[0]}&X-Bogus=${this.getParm(URL[0])}`,
            method: "GET",
            headers: this.headers,
          },
          data.is_mp4
        );

        //comments data
        let CommentsData = Config.comments
          ? await this.GetCommentsData({
              url: `${URL[1]}&X-Bogus=${this.getParm(URL[1])}`,
              method: "GET",
              headers: this.headers,
            })
          : {
              code: 405,
              msg: "user configured to close",
              data: null,
            };
        return { VideoData, CommentsData };

      case "CommentReplyData":
        let CommentReplyData = await this.GetCommentReplyData({
          url: `${URL[3]}&X-Bogus=${this.getParm(URL[3])}`,
          method: "GET",
          headers: this.headers,
        });
        return CommentReplyData;

      case "UserInfoData":
        let UserInfoData = await this.GetUserInfoData({
          url: `${URL[4]}&X-Bogus=${this.getParm(URL[4])}`,
          method: "GET",
          headers: {
            ...this.headers,
            Referer: `https://www.douyin.com/user/${data.user_id}`,
          },
        });

        return UserInfoData;

      case "emoji":
        let EmojiData = await this.GetEmojiData({
          url: URL[2],
          headers: this.headers,
        });
        return EmojiData;

      // case 'live':
      //     //liveroom data
      //     let LiveroomData = await GetLiveroomData({
      //         url: `${url}&X-Bogus=${this.getParm(url)}`,
      //         method: 'POST',
      //         headers: this.headers,
      //         data: { live_url: data.baseurl },
      //         type: '抖音直播间数据'
      //     })
      //     // logger.info('\nLiveRoom data', LiveroomData)
      //     return LiveroomData
      //
      // case 'uservideoslist':
      //     //uservideoslist data
      //     let UserVideos = await GetUserVideos({
      //         url: `${url}&X-Bogus=${this.getParm(url)}`,
      //         method: 'GET',
      //         headers: this.headers,
      //         params: {
      //             sec_uid: data.id,
      //             count: 15,
      //             max_cursor: 0
      //         },
      //         type: '用户主页视频数据'
      //     })
      //     // logger.info('\nUser_Videos_List Data', UserVideos)
      //     return UserVideos

      default:
    }
  }

  async GetUserInfoData(options) {
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

  /** 评论*/
  async GetCommentsData(options) {
    let result = await new networks({
      url: options.url,
      headers: options.headers,
      type: "json",
    }).getData();
    return result;
  }

  /** GetCommentReplyData */
  async GetCommentReplyData(options) {
    let result = await new networks({
      url: options.url,
      headers: options.headers,
      type: "json",
    }).getData();
    return result;
  }

  /** Douyin Emoji */
  async GetEmojiData(options) {
    let result = await new networks({
      url: options.url,
      headers: options.headers,
      type: "json",
    }).getData();
    return result;
  }
  getParm(url) {
    // https://gitee.com/kyrzy0416/rconsole-plugin
    return xbogus.sign(
      new URLSearchParams(new URL(url).search).toString(),
      this.headers["User-Agent"]
    );
  }
}
