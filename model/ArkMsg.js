import { core } from "oicq"

async function Sign(json, client_info = null) {
	return new Promise((resolve, reject) => {
		let result = { code: -1 };
		let json_data = null;
		try {
			json_data = JSON.parse(json);
		} catch (err) { }

		if (!json_data) {
			result.code = -1;
			result.msg = '签名失败，不是有效的json！';
			resolve(result);
			return;
		}
		delete json_data['extra'];

		if (!client_info || !client_info.miniapp_appid) {
			client_info = {
				appid: 100951776,
				appname: 'tv.danmaku.bili',
				appsign: '7194d531cbe7960a22007b9f6bdaa38b',
				miniapp_appid: 1109937557
			};
		}
		let recv_uin = Bot.uin;
		let send_type = 0;
		let recv_guild_id = 0;
		let style = 10;

		let send_time = new Date().getTime();
		let msg_seq = parseInt(`${send_time}${random(100, 999)}`);

		result.msg_seq = msg_seq;

		let body = {
			1: client_info.appid,
			2: 1,
			3: style,
			5: {
				1: 1,
				2: "0.0.0",
				3: client_info.appname,
				4: client_info.appsign,
			},
			7: {
				15: msg_seq
			},
			10: send_type,
			11: recv_uin,
			18: {
				1: client_info.miniapp_appid,
				2: {
					14: 'pages',
				},
				3: 'url',
				4: 'text',
				5: 'text',
				6: 'text',
				10: JSON.stringify(json_data),
			},
			19: recv_guild_id
		};

		let json_handle = function (e) {
			if (Bot.uin == e.user_id && e?.message[0]?.type == 'json') {
				let json_str = e.message[0].data;
				let json = null;
				let extra = null;
				try {
					json = JSON.parse(json_str);
					extra = typeof (json.extra) == 'object' ? json.extra : JSON.parse(json.extra);
				} catch (err) { }

				if (extra && extra.msg_seq == msg_seq) {
					//Bot.off('message.private', json_handle);
					clearTimeout(timer);
					clearTimeout(timer1);
					delete json['extra'];
					result.code = 1;
					result.msg = '签名成功！';
					result.data = json;
					resolve(result);
					return true;
				}
			}
			return false;
		}

		let get_json = async function () {
			let time = 0;
			for (let i = 0; i < 10; i++) {
				let ChatHistory = await Bot.pickFriend(Bot.uin).getChatHistory(time, 20);
				time = ChatHistory[0]?.time;
				ChatHistory.reverse();
				for (let msg of ChatHistory) {
					if (json_handle(msg)) {
						return true;
					}
				}
				if (parseInt(('' + send_time).substring(0, 10)) - time > 3) break;
			}
			return false;
		}

		let timer = setTimeout(async function () {
			if (await get_json()) return;
			//Bot.off('message.private', json_handle);
			result.code = -1;
			result.msg = '签名失败，请稍后再试！';
			resolve(result);
		}, 3000);

		let num = 0;
		let timer1_fun = async function () {
			if (num == 0) {
				try {
					let data = await result.result;
					data = core.pb.decode(data);
					if (data[3] != 0) {
						//Bot.off('message.private', json_handle);
						result.code = -1;
						result.msg = '签名失败，请稍后再试！';
						clearTimeout(timer);
						resolve(result);
						return true;
					}
				} catch (err) { }
			}
			if (await get_json()) return;
			if (num > 6) return;
			num++;
			timer1 = setTimeout(timer1_fun, 100);
		};
		let timer1 = setTimeout(timer1_fun, 100);

		//Bot.on('message.private', json_handle);
		result.result = Bot.sendOidb("OidbSvc.0xb77_9", core.pb.encode(body));
	});
}

/**
 * 作者喊这个叫"互联分享"
 * @param {string} json 要发送的json信息
 * @param {*} e 携带上的相关信息, 如isGroup
 * @param {*} to_uin 
 * @param {*} client_info 
 * @param {*} get_message 
 * @returns -1: 不是有效json
 */
async function Share(json, e, to_uin = null, client_info = null, get_message = false) {
	let result = { code: -1 };
	let json_data = null;
	try {
		json_data = JSON.parse(json);
	} catch (err) { }

	if (!json_data) {
		result.code = -1;
		result.msg = '分享失败，不是有效的json！';
		return result;
	}
	// 这里删去json参数中携带的extra字段, 因为要重新生成
	delete json_data['extra'];


	// 来源ID, 如果是群就是群号, 如果是频道就是频道号, 如果是私聊就是对方的QQ号
	let recv_uin = 0;
	let send_type = 0;
	let recv_guild_id = 0;

	if (e.isGroup && to_uin == null) {//群聊
		recv_uin = e.group.gid;
		send_type = 1;
	} else if (e.guild_id) {//频道
		recv_uin = Number(e.channel_id);
		recv_guild_id = BigInt(e.guild_id);
		send_type = 3;
	} else if (to_uin == null) {//私聊
		recv_uin = e.friend.uid;
		send_type = 0;
	} else {//指定号码私聊
		recv_uin = to_uin;
		send_type = 0;
	}

	if (!client_info || !client_info.miniapp_appid) {
		client_info = {
			appid: 100951776,
			appname: 'tv.danmaku.bili',
			appsign: '7194d531cbe7960a22007b9f6bdaa38b',
			miniapp_appid: 1109937557
		};
	}

	let style = 10;

	let send_time = new Date().getTime();
	let msg_seq = parseInt(`${send_time}${random(100, 999)}`);

	result.msg_seq = msg_seq;

	let body = {
		1: client_info.appid,
		2: 1,
		3: style,
		5: {
			1: 1,
			2: "0.0.0",
			3: client_info.appname,
			4: client_info.appsign,
		},
		7: {
			15: msg_seq
		},
		10: send_type,
		11: recv_uin,
		18: {
			1: client_info.miniapp_appid,
			2: {
				14: 'pages',
			},
			3: 'url',
			4: 'text',
			5: 'text',
			6: 'text',
			10: JSON.stringify(json_data),
		},
		19: recv_guild_id
	};


	/**
	 * 这里的OidbSvc.0xb77_9是发送卡片的核心要点
	 * 详见: https://github.com/mamoe/mirai/issues/682
	 */
	let payload = await Bot.sendOidb("OidbSvc.0xb77_9", core.pb.encode(body));
	result.data = core.pb.decode(payload);
	if (result.data[3] == 0) {
		if (get_message && send_type != 3) {
			result.message = new Promise((resolve, reject) => {
				let result = { code: -1 };
				let json_handle = function (e) {
					if (Bot.uin == e.user_id && e?.message[0]?.type == 'json') {
						let json_str = e.message[0].data;
						let json = null;
						let extra = null;
						try {
							json = JSON.parse(json_str);
							extra = typeof (json.extra) == 'object' ? json.extra : JSON.parse(json.extra);
						} catch (err) { }

						if (extra && extra.msg_seq == msg_seq) {
							clearTimeout(timer);
							delete json['extra'];
							result.code = 1;
							result.msg = '获取成功！';
							result.data = json;
							result.message_id = e.message_id;
							resolve(result);
							return true;
						}
					}
					return false;
				}
				let get_message = async function (status = false) {
					let seq = 0;
					for (let i = 0; i < 10; i++) {
						let ChatHistory = send_type == 1 ? await Bot.pickGroup(recv_uin).getChatHistory(seq, 20) : await Bot.pickFriend(recv_uin).getChatHistory(seq, 20);
						let time = ChatHistory[0]?.time;
						if (send_type == 1) {
							seq = ChatHistory[0]?.seq;
						} else {
							seq = ChatHistory[0]?.time;
						}
						ChatHistory.reverse();
						for (let msg of ChatHistory) {
							if (json_handle(msg)) {
								return;
							}
						}
						if (parseInt(('' + send_time).substring(0, 10)) - time > 3) break;
					}
					if (!status) {
						timer = setTimeout(function () {
							get_message(true);
						}, 1000);
					} else {
						resolve(result);
					}
				};
				let timer = setTimeout(get_message, 1000);

			});
		}
		result.msg = '分享成功！';
		result.code = 1;
	} else {
		result.msg = result[3];
	}
	return result;
}

export default {
	Sign,
	Share
}
//ark打包方法来源于小飞
/**
 * 获取[min,max)范围内的随机数(内部方法)
 * @param {*} min 随机数最小值
 * @param {*} max 随机数最大值
 * @returns 
 */
function random(min, max) {
	const range = max - min;
	const random = Math.random();
	const result = min + Math.round(random * range);
	return result;
}