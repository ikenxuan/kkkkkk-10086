import { DouyinDataOptionsMap, BilibiliDataOptionsMap, XiaohongshuDataOptionsMap } from '../types/index.js'
/**
 * 获取抖音数据
 * @param type 请求数据类型
 * @param cookie 抖音用户 ck
 * @param options 请求参数，是一个对象
 * @returns 返回接口的原始数据
 */
export declare const getDouyinData: <T extends keyof DouyinDataOptionsMap>(type: T, cookie?: string, options?: DouyinDataOptionsMap[T]) => Promise<any>
/**
 * 获取B站数据
 * @param type 请求数据类型
 * @param cookie bilibili 用户 ck
 * @param options 请求参数，是一个对象
 * @returns 返回接口的原始数据
 */
export declare const getBilibiliData: <T extends keyof BilibiliDataOptionsMap>(type: T, cookie?: string, options?: BilibiliDataOptionsMap[T]) => Promise<any>
/**
 * 获取小红书数据
 * @param type 请求数据类型
 * @param cookie 小红书用户 ck
 * @param options 请求参数，是一个对象
 * @returns 返回接口的原始数据
 */
export declare const getXiaohongshuData: <T extends keyof XiaohongshuDataOptionsMap>(type: T, cookie: string | undefined, options: XiaohongshuDataOptionsMap[T]) => Promise<any>
/**
 * 已废弃，请直接使用 getDouyinData 方法
 * @deprecated
 */
export declare const GetDouyinData: <T extends keyof DouyinDataOptionsMap>(type: T, cookie?: string, options?: DouyinDataOptionsMap[T]) => Promise<any>
/**
 * 已废弃，请直接使用 getBilibiliData 方法
 * @deprecated
 */
export declare const GetBilibiliData: <T extends keyof BilibiliDataOptionsMap>(type: T, cookie?: string, options?: BilibiliDataOptionsMap[T]) => Promise<any>
/**
 * 已废弃，请直接使用 getXiaohongshuData 方法
 * @deprecated
 */
export declare const GetXiaohongshuData: <T extends keyof XiaohongshuDataOptionsMap>(type: T, cookie: string | undefined, options: XiaohongshuDataOptionsMap[T]) => Promise<any>
