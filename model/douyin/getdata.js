import networks from '../../utils/networks.js'
import * as xbogus from '../douyin/xbogus.cjs'
import { Config } from '../config.js'
import crypto from 'crypto'

export class base {
	constructor() {
		this.headers = {
			'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			Referer: 'https://www.douyin.com/',
			Cookie: Config.ck,
		}
		this.model = 'Argument'
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
		 * 6，热点词
		 * 7，直播间
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
			`https://live.douyin.com/webcast/room/web/enter/?aid=6383&app_name=douyin_web&live_id=1&device_platform=web&language=zh-CN&enter_from=page_refresh&cookie_enabled=true&screen_width=1920&screen_height=1080&browser_language=zh-CN&browser_platform=Win32&browser_name=Chrome&browser_version=121.0.0.0&web_rid=65826709928&room_id_str=7335472390367005476&enter_source=&is_need_double_stream=false&insert_task_id=&live_reason=&msToken=${await this.msToken(
				116
			)}`,
		]
		switch (data.type) {
			case 'video':
			case 'note':
				let VideoData = await this.GetVideoOrNoteData(
					{
						url: `${URL[0]}&X-Bogus=${await this.Sign(URL[0])}`,
						method: 'GET',
						headers: this.headers,
					},
					data.is_mp4
				)

				let CommentsData = Config.comments
					? await this.GlobalGetData({
							url: `${URL[1]}&X-Bogus=${await this.Sign(URL[1])}`,
							method: 'GET',
							headers: this.headers,
					  })
					: {
							code: 405,
							msg: '你没开评论解析的开关',
							data: null,
					  }
				return { VideoData, CommentsData }

			case 'CommentReplyData':
				let CommentReplyData = await this.GlobalGetData({
					url: `${URL[3]}&X-Bogus=${await this.Sign(URL[3])}`,
					headers: this.headers,
				})
				return CommentReplyData

			case 'UserInfoData':
				let UserInfoData = await this.GlobalGetData({
					url: `${URL[5]}&X-Bogus=${await this.Sign(URL[5])}`,
					headers: {
						...this.headers,
						Referer: `https://www.douyin.com/user/${data.user_id}`,
					},
				})
				return UserInfoData

			case 'Emoji':
				let EmojiData = await this.GlobalGetData({
					url: URL[2],
					headers: this.headers,
				})
				return EmojiData

			case 'UserVideosList':
				let UserVideoListData = await this.GlobalGetData({
					url: `${URL[4]}&X-Bogus=${await this.Sign(URL[4])}`,
					headers: {
						...this.headers,
						Referer: `https://www.douyin.com/user/${data.id}`,
					},
				})
				return UserVideoListData

			case 'SuggestWords':
				let SuggestWordsData = await this.GlobalGetData({
					url: `${URL[6]}&X-Bogus=${await this.Sign(URL[6])}`,
					headers: {
						...this.headers,
						Referer: `https://www.douyin.com/search/${encodeURIComponent(
							data.query
						)}?publish_time=0&sort_type=0&source=comment_named_entity_search&type=general`,
					},
				})
				return SuggestWordsData

			/** 竟然不校验_singature */
			case 'Live':
				let LiveData = await this.GlobalGetData({
					url: `${URL[7]}&X-Bogus=${await this.Sign(
						URL[7]
					)}&_signature=${await this.Sign(URL[7])}`,
					headers: {
						...this.headers,
						Referer: 'https://live.douyin.com',
					},
				})
				return LiveData

			default:
		}
	}

	async GlobalGetData(options) {
		let result = await new networks(options).getData()
		return result
	}
	/**
	 *
	 * @param {*} options opt
	 * @param {*} is_mp4 boolean
	 * @returns
	 */
	async GetVideoOrNoteData(options, is_mp4) {
		let result = await new networks(options).getData()
		if (result && String(is_mp4)) {
			result.is_mp4 = is_mp4
		}
		return result
	}

	async Sign(url) {
		return xbogus.sign(
			new URLSearchParams(new URL(url).search).toString(),
			this.headers['User-Agent']
		)
	}

	async msToken(length) {
		const characters =
			'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
		const randomBytes = crypto.randomBytes(length)
		return Array.from(
			randomBytes,
			(byte) => characters[byte % characters.length]
		).join('')
	}
}
;('https://live.douyin.com/webcast/im/fetch/?resp_content_type=protobuf&did_rule=3&device_id=&app_name=douyin_web&endpoint=live_pc&support_wrds=1&user_unique_id=7334349653670217255&identity=audience&need_persist_msg_count=15&insert_task_id=&live_reason=&room_id=7335472390367005476&version_code=180800&last_rtt=1124&live_id=1&aid=6383&fetch_rule=1&cursor=rdc-2_d-7335510430229463041_u-7335510460294234113_h-1_t-1707931676709_r-7335510692222598980&internal_ext=internal_src:dim%7Cwss_push_room_id:7335472390367005476%7Cwss_push_did:7334349653670217255%7Cfirst_req_ms:1707931617072%7Cfetch_time:1707931676709%7Cseq:33%7Cwss_info:0-1707931639956-5-0%7Cwrds_v:7335510692222470371&device_platform=web&cookie_enabled=true&screen_width=1920&screen_height=1080&browser_language=zh-CN&browser_platform=Win32&browser_name=Mozilla&browser_version=5.0%20(Windows%20NT%2010.0;%20Win64;%20x64)%20AppleWebKit/537.36%20(KHTML,%20like%20Gecko)%20Chrome/121.0.0.0%20Safari/537.36&browser_online=true&tz_name=Asia/Shanghai&msToken=LDIuXkS4b-yVCMhlznC1tn0N9LvG__FY7IvtI8_q5A5i5NlQvjfKZmL-AqtGOPjE6w9seUX_rbq9McJ78SNJ9FL67Vb-8Ww2MNwqcH0KbcJCIwidSw==&X-Bogus=DFSzswVE-WiANGGGtqESWGSX1bR4')
