import axios from 'axios'

/**
 * @param options.url 接口地址 
 * @param options.method 请求方法
 * @param options.headers 请求头
 * @param options.data 请求体
 * @param options.params query参数
 * @returns 
 */
export async function request(options) {
    try {
        const response = await axios({
            url: options.url,
            method: options.method,
            headers: options.headers,
            data: options.data,
            params: options.params,
            timeout: 5000,
        })
        return response.data
    } catch (error) {
        if (error.response.data) {
            return error.response.data
        } else {
            return {
                code: error.code,
                message: error.message || 'Timeout',
                data: null
            }
        }
    }
}