import axios from 'axios'

/**
 * @param options.url 接口地址 
 * @param options.method 请求方法
 * @param options.headers 请求头
 * @param options.data 请求体
 * @param options.params query参数
 * @param options.type 数据类型
 * @returns 
 */
export async function network(options) {
    try {
        const response = await axios({
            url: options.url,
            method: options.method,
            headers: options.headers,
            data: options.data,
            params: options.params,
            timeout: 10000,
            type: options.type
        })
        return response.data
    } catch (error) {
        console.log(`获取${options.type}时，出现了以下错误：\n`, {
            code: error.code,
            message: error.message || 'Timeout',
            data: null
        })
        return {
            code: error.code,
            message: error.message || 'Timeout',
            data: null
        }
    }
}