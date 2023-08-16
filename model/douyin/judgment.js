import fetch from 'node-fetch'

/**
 * return aweme_id
 * @param {*} response 响应数据
 * @returns 
 */
export async function judgment(url) {
    let response = await fetch(url, options)
    let longLink = response.url
    if (longLink.includes('webcast.amemv.com')) {
        return {
            type: 'live',
            baseurl: url
        }
    } else {
        const matchVideo = longLink.match(/video\/(\d+)/)
        const matchNote = longLink.match(/note\/(\d+)/)
        const matchUser = longLink.match(/user\/(\S+?)\?/)
        let id
        if (matchVideo) {
            id = matchVideo[1]
            return {
                type: 'video',
                id,
                is_mp4: true
            }
        } else if (matchNote) {
            id = matchNote[1]
            return {
                type: 'note',
                id,
                is_mp4: false
            }
        } else if (matchUser) {
            id = matchUser[1]
            return {
                type: 'uservideos',
                id,
            }
        }

    }
}


const options = {
    "method": "POST",
    "Accept": "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
    "Content-Length": "2723",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": "Windows",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "headers": {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.4209.0 Safari/537.36"
    },
    "X-Secsdk-Csrf-Token": "000100000001b08a10025237b760401317f3b80208d155801b641f496bbb9be24aecf151089c177b934f66506e3c"
}