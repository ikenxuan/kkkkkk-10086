import fetch from 'node-fetch'
import { Config } from "../config.js"

let API_V1 = 'https://api.douyin.wtf/douyin_video_data/'

async function RequestV1Data(video_id, is_mp4) {
    if (Config.address) API_V1 = `http://${Config.address}/douyin_video_data/`
    const res = await fetch(`${API_V1}?video_id=${video_id}`)
    let data = await res.json()
    data.is_mp4 = is_mp4
    return data
}
async function Argument(video_id, is_mp4) {
    return await RequestV1Data(video_id, is_mp4)
}

export {
    RequestV1Data,
    Argument
}