import common from '../../../../lib/common/common.js'
import { network } from '../../utils/network.js'
import { Config } from '../config.js'

let base_url = 'http://vproctol.zeed.ink/api/v1'
let default_headers = {
    'Authorization': `Bearer ${Config.token}`,
    'Accept': 'text/html,application/json,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
}

/**
 * 
 * @param {*} options opt
 * @param {*} is_mp4 boolean
 * @returns 
 */
async function GetVideoOrNoteData(options, is_mp4) {
    let result = await network(options)
    if (result.code === 200 || is_mp4) {
        result.is_mp4 = is_mp4
    } else result.is_mp4 = is_mp4
    return result
}

/** 评论*/
async function GetCommentsData(options) {
    if (options.params.count > 100) {
        options.params.count = 100
    }
    return await network(options)
}

/** 直播间*/
async function GetLiveroomData(options) {
    return await network(options)
}

/** 用户主页视频*/
async function GetUserVideos(options) {
    return await network(options)
}

export async function Argument(data) {

    switch (data.type) {

        case 'video':
        case 'note':
            //work data
            let VideoData = await GetVideoOrNoteData({
                url: `${base_url}/dy/getVideoDetail`,
                method: 'GET',
                headers: default_headers,
                params: { aweme_id: data.id },
                type: '图集或视频作品数据'
            }, data.is_mp4)
            if (Config.comments === true) {
                await common.sleep(5000)
            }

            //comments data
            let CommentsData = Config.comments ? await GetCommentsData({
                url: `${base_url}/dy/getVideoComments`,
                method: 'GET',
                headers: default_headers,
                params: {
                    aweme_id: data.id,
                    count: Config.numcomments,
                    cursor: 0
                },
                timeout: 15000,
                type: '作品评论数据'
            }) : {
                code: 405,
                msg: 'user configured to close',
                data: null
            }
            logger.info('\ndata', { VideoData, CommentsData })
            return { VideoData, CommentsData }

        case 'live':
            //liveroom data
            let LiveroomData = await GetLiveroomData({
                url: `${base_url}/dy/fetchLiveRoomInfo`,
                method: 'POST',
                headers: default_headers,
                data: { live_url: data.baseurl },
                type: '抖音直播间数据'
            })
            logger.info('\nLiveRoom data', LiveroomData)
            return LiveroomData

        case 'uservideoslist':
            //uservideoslist data
            let UserVideos = await GetUserVideos({
                url: `${base_url}/dy/getUserVideos`,
                method: 'GET',
                headers: default_headers,
                params: {
                    sec_uid: data.id,
                    count: 15,
                    max_cursor: 0
                },
                type: '用户主页视频数据'
            })
            logger.info('\nUser_Videos_List Data', UserVideos)
            return UserVideos

        default:
    }

}