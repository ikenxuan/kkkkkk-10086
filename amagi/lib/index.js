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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsY0FBYyxnQkFBZ0IsQ0FBQTtBQUM5QixjQUFjLGFBQWEsQ0FBQTtBQUMzQixjQUFjLGNBQWMsQ0FBQTtBQUM1QixjQUFjLGFBQWEsQ0FBQTtBQUMzQixPQUFPLEVBQUUsS0FBSyxJQUFJLEtBQUssRUFBRSxLQUFLLElBQUksT0FBTyxFQUFFLENBQUE7QUFDM0MsT0FBTyxFQUFFLFlBQVksRUFBRSxjQUFjLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQTtBQUM3RCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sY0FBYyxDQUFBO0FBR3JDLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQTtBQUVwQjs7Ozs7O0dBTUc7QUFDSCxNQUFNLENBQUMsTUFBTSxhQUFhLEdBQUcsS0FBSyxFQUFFLElBQWlDLEVBQUUsU0FBUyxFQUFZLEVBQUUsVUFBVSxFQUF1QixFQUFnQixFQUFFO0lBQy9JLE1BQU0sSUFBSSxHQUFHLE1BQU0sWUFBWSxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFBO0lBQzFELE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQTtBQUNsQixDQUFDLENBQUE7QUFFRDs7Ozs7O0dBTUc7QUFDSCxNQUFNLENBQUMsTUFBTSxlQUFlLEdBQUcsS0FBSyxFQUFFLElBQW1DLEVBQUUsU0FBUyxFQUFZLEVBQUUsVUFBVSxFQUF5QixFQUFnQixFQUFFO0lBQ3JKLE1BQU0sSUFBSSxHQUFHLE1BQU0sY0FBYyxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFBO0lBQzVELE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQTtBQUNsQixDQUFDLENBQUEifQ==