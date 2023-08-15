/**
 * return aweme_id
 * @param {*} response 响应数据
 * @returns 
 */
export async function judgment(response) {
    let longLink = response.url
    const matchVideo = longLink.match(/video\/(\d+)/)
    const matchNote = longLink.match(/note\/(\d+)/)
    let video_id
    if (matchVideo) {
        video_id = matchVideo[1]
        return { video_id, is_mp4: true }
    } else if (matchNote) {
        video_id = matchNote[1]
        return { video_id, is_mp4: false }
    }
}
