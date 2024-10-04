import { DouyinResult, BilibiliResult } from '../business/index.js'
/**
 * 获取抖音数据
 * @param type 请求数据类型
 * @param cookie 抖音用户 ck
 * @param options 请求参数，是一个对象
 * @returns 返回接口的原始数据
 */
export const getDouyinData = async (type, cookie, options) => {
  const data = await DouyinResult({ type, cookie }, options)
  return data.data
}
/**
 * 获取B站数据
 * @param type 请求数据类型
 * @param cookie bilibili 用户 ck
 * @param options 请求参数，是一个对象
 * @returns 返回接口的原始数据
 */
export const getBilibiliData = async (type, cookie, options) => {
  const data = await BilibiliResult({ type, cookie }, options)
  return data.data
}
/**
 * 已废弃，请直接使用 getDouyinData 方法
 * @deprecated
 */
export const GetDouyinData = getDouyinData
/**
 * 已废弃，请直接使用 getBilibiliData 方法
 * @deprecated
 */
export const GetBilibiliData = getBilibiliData
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRGF0YUZldGNoZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL21vZGVsL0RhdGFGZXRjaGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUUsWUFBWSxFQUFFLGNBQWMsRUFBRSxNQUFNLGdCQUFnQixDQUFBO0FBRzdEOzs7Ozs7R0FNRztBQUNILE1BQU0sQ0FBQyxNQUFNLGFBQWEsR0FBRyxLQUFLLEVBQ2hDLElBQU8sRUFDUCxNQUFlLEVBQ2YsT0FBaUMsRUFDbkIsRUFBRTtJQUNoQixNQUFNLElBQUksR0FBRyxNQUFNLFlBQVksQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQTtJQUMxRCxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUE7QUFDbEIsQ0FBQyxDQUFBO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsTUFBTSxDQUFDLE1BQU0sZUFBZSxHQUFHLEtBQUssRUFDbEMsSUFBTyxFQUNQLE1BQWUsRUFDZixPQUFtQyxFQUNyQixFQUFFO0lBQ2hCLE1BQU0sSUFBSSxHQUFHLE1BQU0sY0FBYyxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFBO0lBQzVELE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQTtBQUNsQixDQUFDLENBQUE7QUFHRDs7O0dBR0c7QUFDSCxNQUFNLENBQUMsTUFBTSxhQUFhLEdBQUcsYUFBYSxDQUFBO0FBQzFDOzs7R0FHRztBQUNILE1BQU0sQ0FBQyxNQUFNLGVBQWUsR0FBRyxlQUFlLENBQUEifQ==