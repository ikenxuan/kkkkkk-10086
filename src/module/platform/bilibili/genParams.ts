import { createRequire } from 'node:module'
import { getBilibiliData } from './api.js'
import Config from '@/module/utils/Config'

/** 「登录基本信息」响应，仅声明本文件读取的字段 */
interface BilibiliLoginInfo {
  data: {
    data: {
      vipStatus?: number
    }
  }
}

interface AmagiWbiSignModule {
  wbi_sign: (apiURL: string, cookie: string) => Promise<string>
}

const require = createRequire(import.meta.url)
let wbiSign: AmagiWbiSignModule['wbi_sign'] | undefined

/** amagi 的 package exports 在 Vite 下解析失败，沿用 Base.ts 的 CommonJS 兜底 */
const getWbiSign = (): AmagiWbiSignModule['wbi_sign'] => {
  wbiSign ??= (require('@ikenxuan/amagi') as AmagiWbiSignModule).wbi_sign
  return wbiSign
}

/** 判断是否为普通对象 */
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 从「登录基本信息」响应中读取 vipStatus，读取不到时返回 undefined */
const readVipStatus = (value: unknown): number | undefined => {
  if (!isRecord(value)) return undefined
  const data = isRecord(value.data) ? value.data : undefined
  const inner = isRecord(data?.data) ? data.data : undefined
  return typeof inner?.vipStatus === 'number' ? inner.vipStatus : undefined
}

/**
 * 计算请求参数
 * @param apiURL 请求地址
 */
export async function genParams (apiURL: string): Promise<string> {
  if (Config.cookies.bilibili === '' || Config.cookies.bilibili === null) return '&platform=html5'
  /** 保留原有的直接取值方式：响应结构异常时同样抛出错误交给调用方 */
  const loginInfo = await getBilibiliData('登录基本信息', Config.cookies.bilibili) as BilibiliLoginInfo
  const genSign = await getWbiSign()(apiURL, Config.cookies.bilibili || '')

  const qn = [6, 16, 32, 64, 74, 80, 112, 116, 120, 125, 126, 127]
  let isvip
  loginInfo.data.data.vipStatus === 1 ? (isvip = true) : (isvip = false)
  if (isvip) {
    return `&fnval=16&fourk=1&${genSign}`
  } else return `&qn=${qn[3]}&fnval=16`
}

/** Cookie 检查结果 */
export interface BilibiliCkStatus {
  /** 登录状态，'!isLogin' 表示未登录，'isLogin' 表示已登录 */
  Status: '!isLogin' | 'isLogin'
  /** VIP 状态，true 表示是大会员 */
  isVIP: boolean
}

/**
 * 检查B站Cookie的有效性和VIP状态
 *
 * 此函数通过调用B站API来验证Cookie的有效性，并检查用户的VIP状态。
 * 如果Cookie未配置或无效，将返回未登录状态。
 *
 * @example
 * // 检查Cookie状态
 * const result = await checkCk();
 * console.log(result); // { Status: 'isLogin', isVIP: true }
 *
 * @returns 返回包含登录状态和VIP状态的对象
 *
 * @throws 当API调用失败时可能抛出错误
 *
 * @see {@link getBilibiliData} 使用的API调用函数
 * @see {@link Config.cookies} 使用的Cookie配置
 *
 */
export async function checkCk (): Promise<BilibiliCkStatus> {
  // 如果Cookie为空或未配置，直接返回未登录状态
  if (Config.cookies.bilibili === '' || Config.cookies.bilibili === null) {
    return { Status: '!isLogin', isVIP: false }
  }

  // 获取用户登录信息
  const loginInfo = await getBilibiliData('登录基本信息', Config.cookies.bilibili || '')

  // 判断VIP状态：vipStatus为1表示是VIP用户
  const isVIP = readVipStatus(loginInfo) === 1

  // 返回登录状态和VIP状态
  // 注意：无论是否是VIP，只要Cookie有效就返回已登录状态
  return {
    Status: 'isLogin',
    isVIP
  }
}
