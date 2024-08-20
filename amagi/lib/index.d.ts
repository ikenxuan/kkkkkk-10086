export * from "./business/index.js"
export * from "./model/index.js"
export * from "./server/index.js"
export * from "./types/index.js"
export { amagi as Amagi, amagi as default }
import { client } from "./server/index.js"
import { DouyinDataType, DouyinOptionsType, BilibiliDataType, BilibiliOptionsType } from './types/index.js'
declare const amagi: typeof client
/**
 *
 * @param type 请求数据类型
 * @param cookie 抖音用户 ck
 * @param options 请求参数，是一个对象
 * @returns 返回接口的原始数据
 */
export declare const GetDouyinData: (type: keyof typeof DouyinDataType, cookie?: string, options?: DouyinOptionsType) => Promise<any>
/**
 *
 * @param type 请求数据类型
 * @param cookie bilibili 用户 ck
 * @param options 请求参数，是一个对象
 * @returns 返回接口的原始数据
 */
export declare const GetBilibiliData: (type: keyof typeof BilibiliDataType, cookie?: string, options?: BilibiliOptionsType) => Promise<any>
