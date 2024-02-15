import networks from '../../utils/networks.js'
/**
 * return aweme_id
 * @param {*} response 响应数据
 * @returns
 */
export async function GetID(url) {
	let longLink = await new networks({ url: url }).getLongLink()
	let result
	if (longLink.includes('webcast.amemv.com')) {
		result = {
			type: 'Live',
			baseurl: url,
		}
		console.log('暂未支持解析')
		return {}
	} else {
		const matchVideo = longLink.match(/video\/(\d+)/)
		const matchNote = longLink.match(/note\/(\d+)/)
		const matchUser = longLink.match(/user\/(\S+?)\?/)
		let id
		if (matchVideo) {
			id = matchVideo[1]
			result = {
				type: 'video',
				id,
				is_mp4: true,
			}
		} else if (matchNote) {
			id = matchNote[1]
			result = {
				type: 'note',
				id,
				is_mp4: false,
			}
		} else if (matchUser) {
			id = matchUser[1]
			result = {
				type: 'UserVideosList',
				id,
			}
		}
	}
	console.log(result)
	return result
}
