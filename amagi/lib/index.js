export * from "./business/index.js"
export * from "./model/index.js"
export * from "./server/index.js"
export * from "./types/index.js"
export { amagi as Amagi, amagi as default }
import { DouyinResult, BilibiliResult } from './business/index.js'
import { client } from "./server/index.js"
const amagi = client
/**
 *
 * @param type 请求数据类型
 * @param cookie 抖音用户 ck
 * @param options 请求参数，是一个对象
 * @returns 返回接口的原始数据
 */
export const GetDouyinData = async (type, cookie = '', options = {}) => {
  const data = await DouyinResult({ type, cookie }, options)
  return data.data
}
/**
 *
 * @param type 请求数据类型
 * @param cookie bilibili 用户 ck
 * @param options 请求参数，是一个对象
 * @returns 返回接口的原始数据
 */
export const GetBilibiliData = async (type, cookie = '', options = {}) => {
  const data = await BilibiliResult({ type, cookie }, options)
  return data.data
}
