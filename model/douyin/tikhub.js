import fetch from 'node-fetch'
import fs from 'fs'
import common from '../../../../lib/common/common.js'
import uploadRecord from '../uploadRecord.js'
import path from 'path'
import { Config } from '../config.js'
import cfg from '../../../../lib/config/config.js'
import { emojiMap } from './DYemoji.js'
import { comments } from './comments.js'
import image from '../../utils/image.js'
import Argument from './getdata.js'
import { Emoji } from './DYemoji2.js'
// import sizeOf from 'image-size'

const _path = process.cwd()
let mp4size = ''

export class base {
	constructor(e = {}) {
		this.e = e
	}
}
export default class TikHub extends base {
	constructor(e) {
		super(e)
		this.model = 'TikHub'
	}

	/** 原始数据 */
	async GetData(type, data) {
		if (type === 'video' || type === 'note') {
			return await this.v1_dy_data(
				data.VideoData,
				data.CommentsData,
				data.VideoData.is_mp4
			)
		}

		if (type === 'Live') {
			return await this.dy_live_data(data)
		}

		if (type === 'UserVideosList') {
			return await this.dy_uservideoslist_data(data)
		}
	}

	/**
	 * @param {*} Data video or note data
	 * @param {*} CommentData commments data
	 * @param {*} is_mp4 boolean
	 * @returns
	 */
	async v1_dy_data(Data, CommentData, is_mp4, url) {
		let g_video_url
		let g_title
		let full_data = []

		/** 评论 */
		let comments_res = []
		if (CommentData !== null && CommentData.comments && Config.comments) {
			let comments_data = []
			let commentsres = []
			for (let i = 0; i < CommentData.comments.length; i++) {
				let text = CommentData.comments[i].text

				for (let emoji in emojiMap) {
					const regex = new RegExp('\\[' + emoji + '\\]', 'g')
					if (text.includes(emoji)) {
						text = text.replace(regex, emojiMap[emoji])
					}
				}

				let digg_count = CommentData.comments[i].digg_count
				if (digg_count > 10000) {
					digg_count = (digg_count / 10000).toFixed(1) + 'w'
				}
				commentsres.push(`${text}\n♥${digg_count}`)
			}
			let dsc = '评论数据'
			let res = await common.makeForwardMsg(this.e, commentsres, dsc)
			comments_data.push(res)
			comments_res.push(comments_data)
		} else comments_res.push('评论数据获取失败或这条视频没有评论')

		/** 图集 */
		let imagenum = 0
		let image_res = []
		if (is_mp4 === false) {
			let image_data = []
			let imageres = []
			let image_url
			for (let i = 0; i < Data.aweme_detail.images.length; i++) {
				image_url = Data.aweme_detail.images[i].url_list[1] // 图片地址
				let title = Data.aweme_detail.preview_title
					.substring(0, 50)
					.replace(/[\\/:\*\?"<>\|\r\n]/g, ' ') // 标题，去除特殊字符
				g_title = title
				imageres.push(segment.image(image_url)) // 合并图集字符串
				imagenum++
				if (Config.rmmp4 === false) {
					await mkdirs(
						process.cwd() + `/resources/kkkdownload/images/${g_title}`
					)
					let path =
						process.cwd() +
						`/resources/kkkdownload/images/${g_title}/${i + 1}.png`
					await fetch(image_url)
						.then((res) => res.arrayBuffer())
						.then((data) => fs.promises.writeFile(path, Buffer.from(data)))
				}
				// const getImageDimensions = async (imageUrl) => {
				// 	try {
				// 		const response = await fetch(imageUrl)
				// 		const buffer = await response.buffer()
				// 		const dimensions = sizeOf(buffer)
				// 		return {
				// 			width: dimensions.width,
				// 			height: dimensions.height,
				// 			url: imageUrl,
				// 		}
				// 	} catch (error) {
				// 		throw error
				// 	}
				// }

				// const newimg = await getImageDimensions(image_url)
				if (cfg.bot.skip_login) {
					this.e.reply(segment.image(image_url))
				}
			}
			if (imagenum === 1) {
				await this.e.reply(segment.image(image_url))
			}

			let dsc = '解析完的图集图片'
			let res = await common.makeForwardMsg(this.e, imageres, dsc)
			image_data.push(res)
			image_res.push(image_data)
		} else {
			image_res.push('图集信息解析失败')
		}

		/** 作者 */
		let author_res = []
		if (Data.aweme_detail.author) {
			let author_data = []
			let authorres = []
			const author = Data.aweme_detail.author
			let sc = await count(author.favoriting_count) // 收藏
			let gz = await count(author.follower_count) // 关注
			let id = author.nickname // id
			let jj = author.signature // 简介
			let age = author.user_age // 年龄
			let sczs = author.total_favorited
			authorres.push(`创作者名称：${id}`)
			authorres.push(
				`创作者：${id}拥有${gz}个粉丝，${sc}个收藏和${sczs}个收藏总数`
			)
			authorres.push(`${id}今年${age}岁，Ta的简介是：\n${jj}`)
			let dsc = '创作者信息'
			let res = await common.makeForwardMsg(this.e, authorres, dsc)
			author_data.push(res)
			author_res.push(author_data)
		}

		/** 背景音乐 */
		let music_res = []
		if (Data.aweme_detail.music) {
			let music_data = []
			let musicres = []
			const music = Data.aweme_detail.music
			let music_id = music.author // BGM名字
			let music_img = music.cover_hd.url_list[0] // BGM作者头像
			let music_url = music.play_url.uri // BGM link
			if (
				is_mp4 === false &&
				Config.rmmp4 === false &&
				music_url !== undefined
			) {
				try {
					let path =
						process.cwd() + `resources/kkkdownload/images/${g_title}/BGM.mp3`
					await fetch(music_url)
						.then((bgmfile) => bgmfile.arrayBuffer())
						.then((downloadbgm) =>
							fs.promises.writeFile(path, Buffer.from(downloadbgm))
						)
				} catch (error) {
					console.log(error)
				}
			}
			musicres.push(`BGM名字：${music_id}`)
			musicres.push(`BGM下载直链：${music_url}`)
			musicres.push(segment.image(music_img))
			let dsc = 'BGM相关信息'
			let res = await common.makeForwardMsg(this.e, musicres, dsc)
			music_data.push(res)
			music_res.push(music_data)
			if (
				music_url &&
				is_mp4 === false &&
				music_url !== undefined &&
				this.e.adapter === undefined
			) {
				await this.e.reply(await uploadRecord(music_url, 0, false))
			}
		}

		/** 其他 */
		let ocr_res = []
		if (Data.aweme_detail.seo_info.ocr_content) {
			let ocr_data = []
			let ocrres = []
			let text = Data.aweme_detail.seo_info.ocr_content
			ocrres.push('说明：\norc可以识别视频中可能出现的文字信息')
			ocrres.push(text)
			let dsc = 'ocr视频信息识别'
			let res = await common.makeForwardMsg(this.e, ocrres, dsc)
			ocr_data.push(res)
			ocr_res.push(ocr_data)
		}

		/** 视频 */
		let video_res = []
		if (is_mp4) {
			let video_data = []
			let videores = []
			// 视频地址特殊判断：play_addr_h264、play_addr、
			const video = Data.aweme_detail.video
			let FPS = video.bit_rate[0].FPS // FPS
			if (Data.aweme_detail.video.play_addr_h264) {
				g_video_url = video.play_addr_h264.url_list[2]
				logger.info('视频地址', g_video_url)
			} else if (Data.aweme_detail.video.play_addr) {
				g_video_url = video.play_addr.url_list[2]
				logger.info('视频地址', g_video_url)
			}
			let cover = video.origin_cover.url_list[0] // video cover image
			let title = Data.aweme_detail.preview_title
				.substring(0, 80)
				.replace(/[\\/:\*\?"<>\|\r\n]/g, ' ') // video title
			g_title = title
			mp4size = (video.play_addr.data_size / (1024 * 1024)).toFixed(2)
			videores.push(`标题：\n${title}`)
			videores.push(`视频帧率：${'' + FPS}\n视频大小：${mp4size}MB`)
			videores.push(`等不及视频上传可以先看这个，视频直链：\n${g_video_url}`)
			videores.push(segment.image(cover))
			let dsc = '视频基本信息'
			let res = await common.makeForwardMsg(this.e, videores, dsc)
			video_data.push(res)
			video_res.push(video_data)
		}
		const EmojiData = await new Argument().GetData({ type: 'Emoji' })
		const list = await Emoji(EmojiData)

		const commentsArray = await comments(CommentData, list)
		let { img } = await image(this.e, 'comment', 'comment', {
			saveId: 'comment',
			CommentsData: commentsArray,
			Commentlength: String(commentsArray.jsonArray.length),
			VideoUrl: g_video_url ? g_video_url : Data.aweme_detail.share_url,
			Title: g_title,
		})
		await this.e.reply(img)
		const tip = ['视频正在上传']
		let res
		if (is_mp4) {
			res = full_data
				.concat(tip)
				.concat(img)
				.concat(video_res)
				.concat(comments_res)
				.concat(music_res)
				.concat(author_res)
				.concat(ocr_res)
		} else {
			res = full_data
				.concat(img)
				.concat(video_res)
				.concat(image_res)
				.concat(comments_res)
				.concat(music_res)
				.concat(author_res)
				.concat(ocr_res)
		}

		let dec
		if (is_mp4 !== true) {
			dec = '抖音图集作品数据'
		} else {
			dec = '抖音视频作品数据'
		}
		return {
			res: !cfg.bot.skip_login ? res : [],
			g_video_url,
			g_title,
			dec,
		}
	}

	async dy_live_data(livedata) {
		const data = livedata.data.data.room
		let full_data = []
		let res
		let res1 = []
		let res2 = []
		let res3 = []

		let picture_quality_text = [] // 可选画质

		const title = data.title // 标题
		const user_count = data.user_count // 观看人数
		const create_time = (data.finish_time - data.create_time) / 60 // 开播时间
		let is_sandbox = data.is_sandbox
		if (is_sandbox === false) {
			is_sandbox = '不是'
		} else if (is_sandbox === true) {
			is_sandbox = '是'
		} // 是否沙盒
		let with_linkmic = data.with_linkmic
		if (with_linkmic === false || with_linkmic === undefined) {
			with_linkmic = '不是'
		} else {
			with_linkmic = '是'
		} // 语音直播间？
		const cover = data.cover.url_list[0] // 直播间封面
		const share_url = data.share_url // 直播间分享链接
		for (
			let i = 0;
			i < data.stream_url.live_core_sdk_data.pull_data.options.qualities.length;
			i++
		) {
			let picture_quality =
				data.stream_url.live_core_sdk_data.pull_data.options.qualities[i].name // 可选画质
			picture_quality_text.push(picture_quality)
		}
		const total_user = data.stats.total_user // 粉丝团总数
		const follow_count = data.stats.follow_count // 关注数
		const total_user_str = data.stats.total_user_str // 总浏览人数
		const nickname = data.owner.nickname // 直播间账号名字
		let gender = data.owner.gender
		if (gender === 1) {
			gender = '男'
		} else if (gender === 2) {
			gender = '女'
		} // 性别
		const signature = data.owner.signature // 主页介绍
		const avatar_image = data.owner.avatar_large.url_list[0] // 头像
		const city = data.owner.city // 城市
		const badge_image = data.owner.badge_image_list[0].url_list[0] // 荣誉等级图片
		const alternative = data.owner.badge_image_list[0].content.alternative_text // 荣誉等级
		const following_count_str = data.owner.follow_info.following_count_str // 直播间关注数
		const follower_count = data.owner.follow_info.follower_count_str // 粉丝数量
		const video_feed_tag = data.video_feed_tag // 直播状态
		const display_short = data.room_view_stats.display_short // 本场直播观看总人数

		const dec = nickname + '的直播间' + video_feed_tag + '！'
		res1.push(`标题：\n${title}`)
		res1.push(`目前已开播: ${create_time}分钟`)
		res1.push(`总观看人数: ${display_short}\n当前直播间人数: ${user_count}`)
		res1.push(`总浏览人数: \n${total_user_str}`)
		res1.push(segment.image(cover))

		res2.push(`主页介绍: ${signature}`)
		res2.push(`账号粉丝数量: ${follower_count}`)
		res2.push(`粉丝团总数: ${total_user}`)
		res2.push(`直播间关注数: ${following_count_str}`)
		res2.push(alternative)
		res2.push(segment.image(badge_image))

		res3.push(`此直播间${is_sandbox}沙盒直播间`)
		res3.push(`${with_linkmic}语音直播间`)
		res3.push(`直播间分享链接: \n${share_url}`)
		res3.push(`直播间可选画质: \n${picture_quality_text}`)

		let res2_data = await common.makeForwardMsg(
			this.e,
			res2,
			`${nickname}的直播间`
		)
		let res3_data = await common.makeForwardMsg(this.e, res3, '其他')
		res = full_data.concat(res1).concat(res2_data).concat(res3_data)
		return {
			res,
			dec,
		}
	}

	async dy_uservideoslist_data(uservideoslist_data) {
		let video_res = []

		let res
		for (let i = 0; i < uservideoslist_data.aweme_list.length; i++) {
			let title = uservideoslist_data.aweme_list[i].desc
			let cover = uservideoslist_data.aweme_list[i].share_url
			video_res.push(`作品标题: ${title}\n${cover}`)
		}

		res = video_res
		return {
			res,
			dec: '抖音用户主页视频数据',
		}
	}

	/**
	 * @param {*} file 上传图片到腾讯图床
	 * @returns
	 */
	async upload_image(file) {
		return (await Bot.pickFriend(Bot.uin)._preprocess(segment.image(file)))
			.imgs[0]
	}

	/** 获取机器人上传的图片链接 */
	async getHistoryLog() {
		return (
			await Bot.pickGroup(Number(e.group_id)).getChatHistory(Bot.uin.seq, 1)
		)[0].message[0].url
	}

	/**
	 * @param {*} video_url work url
	 * @param {*} title work title
	 * @returns
	 */
	async downloadvideofile(video_url, title) {
		let path = await DownLoadVideo(video_url, title)
		if (cfg.bot.skip_login) {
			await this.e.reply(segment.video((Bot.videoToUrl = video_url)))
			await removeFileOrFolder(path)
		} else if (mp4size >= 80) {
			// 群和私聊分开
			await this.e.reply(
				'视频过大，尝试通过文件上传，请稍后移步群文件查看',
				false,
				{ recallMsg: 30 }
			)
			await this.upload_file(path)
			await removeFileOrFolder(path)
		} else {
			await this.e.reply(segment.video(path))
			await removeFileOrFolder(path)
		}
	}

	/** 要上传的视频文件，私聊需要加好友 */
	async upload_file(file) {
		if (this.e.isGroup) {
			await this.e.group.fs.upload(file)
			await removeFileOrFolder(file)
		} else if (this.e.isPrivate) {
			await this.e.friend.sendFile(file)
			await removeFileOrFolder(file)
		}
	}
}

async function removeFileOrFolder(path) {
	if (Config.rmmp4 === true || Config.rmmp4 === undefined) {
		const stats = await new Promise((resolve, reject) => {
			fs.stat(path, (err, stats) => {
				if (err) reject(err)
				resolve(stats)
			})
		})
		if (stats.isFile()) {
			// 指向文件
			fs.unlink(path, (err) => {
				if (err) {
					console.error('删除缓存文件失败', err)
				} else {
					console.log('缓存文件删除成功')
				}
			})
		}
	}
}

/**
 * @param {*} count 过万整除
 * @returns
 */
async function count(count) {
	if (count > 10000) {
		return (count / 10000).toFixed(1) + '万'
	} else {
		return count.toString()
	}
}

/** 文件夹名字 */
async function mkdirs(dirname) {
	if (fs.existsSync(dirname)) {
		return true
	} else {
		if (mkdirs(path.dirname(dirname))) {
			fs.mkdirSync(dirname)
			return true
		}
	}
}

/**
 *
 * @param {*} video_url
 * @param {*} title
 */
async function DownLoadVideo(video_url, title) {
	let response = await fetch(video_url, {
		headers: headers,
	})
	// 写入流
	let writer = fs.createWriteStream(
		`${_path}/resources/kkkdownload/video/${title}.mp4`
	)
	response.body.pipe(writer)
	return new Promise((resolve) => {
		writer.on('finish', () => {
			resolve(writer.path)
		})
	})
}

const headers = {
	Server: 'CWAP-waf',
	'Content-Type': 'video/mp4',
	Referer: 'https:// www.douyin.com',
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
	Cookie: Config.ck,
}
