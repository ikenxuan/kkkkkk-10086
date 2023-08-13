import { request } from '../../utils/request.js'
import common from '../../../../lib/common/common.js'

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
    }
    return result
}

async function GetCommentsData(options) {
    return await request(options)
}

async function GetLiveroomData(options) {
    return await request(options)
}

/**
 * Get work and comment data
 * @param {*} video_id aweme_id
 * @param {*} is_mp4 boolean
 * @returns 
 */
async function Argument(video_id, is_mp4) {
    let VideoData = await GetVideoOrNoteData({
        url: '/dy/getVideoDetail',
        method: 'GET',
        params: { aweme_id: video_id }
    }, is_mp4)
    await common.sleep(1500)
    let CommentsData = await GetCommentsData({
        url: '/dy/getVideoComments',
        method: 'GET',
        params: {
            aweme_id: video_id,
            count: 50,
            cursor: 0
        }
    })
    const DATA = {
        VideoData,
        CommentsData
    }
    console.log('Argument', DATA)
    return DATA
}

export {
    Argument,
    GetVideoOrNoteData,
    GetCommentsData,
    GetLiveroomData,
}