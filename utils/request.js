import axios from 'axios'
import { Config } from '../model/config.js'

let base_url = 'http://vproctol.zeed.ink/api/v1'

let default_headers = {
    'Authorization': `Bearer ${Config.token}`,
    'Accept': 'text/html,application/json,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
}

/**
 * @param options.url 接口地址 
 * @param options.method 请求方法
 * @param options.data 请求体
 * @param options.params query参数
 * @returns 
 */
export async function request(options) {
    const response = await axios({
        url: `${base_url}${options.url}`,
        method: options.method,
        headers: default_headers,
        data: options.data,
        params: options.params
    })
    return response.data
}