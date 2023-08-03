import fetch from 'node-fetch'
import { Config } from "../config.js"

let API_V1 = 'https://api.douyin.wtf/douyin_video_data/'
let API_V2 = 'https://api.tikhub.io/douyin/video_data/'
let API_v2_Comments = 'https://api.tikhub.io/douyin/video_comments/'

async function RequestV1Data(video_id, is_mp4, is_V2) {
    if (Config.address) API_V1 = `http://${Config.address}/douyin_video_data/`
    const res = await fetch(`${API_V1}?video_id=${video_id}`)
    let data = await res.json()
    data.is_mp4 = is_mp4
    data.is_V2 = is_V2
    return data
}
async function RequestV2Data(video_id, is_mp4, is_V2) {
    const res = await fetch(`${API_V2}?video_id=${video_id}`)
    let data = await res.json()
    data.comment_res = await RequestV2CommentsData(video_id)
    data.is_mp4 = is_mp4
    data.is_V2 = is_V2
    return data
}
async function RequestV2CommentsData(video_id) {
    const res = await fetch(`${API_v2_Comments}?video_id=${video_id}&cursor=0&count=50&language=zh`)
    return await res.json()
}
async function Argument(video_id, is_mp4, is_V2) {
    if (is_V2 === true) { return await RequestV2Data(video_id, is_mp4, is_V2) }
    if (is_V2 === false) { return await RequestV1Data(video_id, is_mp4, is_V2) }
}

export {
    RequestV1Data,
    RequestV2Data,
    RequestV2CommentsData,
    Argument
}