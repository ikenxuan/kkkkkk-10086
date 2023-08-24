import common from '../../../../lib/common/common.js'
import { request } from '../../utils/request.js'
import { Config } from '../config.js'

/**
 * 
 * @param {*} options opt
 * @param {*} is_mp4 boolean
 * @returns 
 */
async function GetVideoOrNoteData(options, is_mp4) {
    let result = await request(options)
    if (result.code === 200 || is_mp4) {
        result.is_mp4 = is_mp4
    } else result.is_mp4 = is_mp4
    return result
}

/** 评论*/
async function GetCommentsData(options) {
    if(options.params.count > 100) {
        options.params.count = 100
    }
    return await request(options)
}

/** 直播间*/
async function GetLiveroomData(options) {
    return await request(options)
}

/** 用户主页视频*/
async function GetUserVideos(options) {
    return await request(options)
}

async function Argument(data) {

    switch (data.type) {

        case 'video':
        case 'note':
            //work data
            let VideoData = await GetVideoOrNoteData({
                url: '/dy/getVideoDetail',
                method: 'GET',
                params: { aweme_id: data.id }
            }, data.is_mp4)
            if (Config.comments === true) {
                await common.sleep(5000)
            }

            //comments data
            let CommentsData = Config.comments ? await GetCommentsData({
                url: '/dy/getVideoComments',
                method: 'GET',
                params: {
                    aweme_id: data.id,
                    count: Config.numcomments,
                    cursor: 0
                },
                timeout: 15000
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
                url: '/dy/fetchLiveRoomInfo',
                method: 'POST',
                data: { live_url: data.baseurl }
            })
            logger.info('\nLiveRoom data', LiveroomData)
            return LiveroomData

        case 'uservideoslist':
            //uservideoslist data
            let UserVideos = await GetUserVideos({
                url: '/dy/getUserVideos',
                method: 'GET',
                params: {
                    sec_uid: data.id,
                    count: 15,
                    max_cursor: 0
                }
            })
            logger.info('\nUser_Videos_List Data', UserVideos)
            return UserVideos

        default:
    }

}

export { Argument }  