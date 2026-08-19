import { baseHeaders, Networks } from '@/module/utils/index'
import { getBilibiliData } from './api.js'

/** B站数据类型 */
export type BilibiliDataType =
  | 'one_video'
  | 'nock_video'
  | 'video_playurl'
  | 'work_comments'
  | 'bangumi_video_info'
  | 'bangumi_video_playurl'
  | 'user_dynamic'
  | 'dynamic_info'
  | 'dynamic_card'
  | 'user_profile'
  | 'live_room_detail'
  | 'liveroom_def'
  | 'emoji_list'
  | 'new_login_qrcode'
  | 'check_qrcode'
  | 'login_basic_info'
  | 'undefined'

/** B站链接解析结果 */
export interface BilibiliIdData {
  type: BilibiliDataType
  /** 集数（可选） */
  Episode?: string
  bvid?: string
  /** 分P页码 */
  p?: number
  /** 活动页视频的 bvid */
  id?: string
  /** realid 是否为 epid */
  isEpid?: boolean
  realid?: string
  dynamic_id?: string
  room_id?: string
}

/** av 号转 BV 号的返回结构，仅声明本文件读取的字段 */
interface ConvertAvToBvResult {
  data: {
    data: {
      bvid: string
    }
  }
}

/** getid 的可注入依赖，仅用于测试替换真实 amagi */
export interface BilibiliIdDependencies {
  convertAvToBv: (options: { avid: number, typeMode: string }) => Promise<ConvertAvToBvResult>
}

let defaultDependencies: BilibiliIdDependencies | undefined

/** 默认通过统一 B站 API wrapper 执行，使请求获得超时、中止与网络重试保护 */
const getDefaultDependencies = (): BilibiliIdDependencies => {
  defaultDependencies ??= {
    convertAvToBv: async (options) => await getBilibiliData('AV转BV', options) as ConvertAvToBvResult
  }
  return defaultDependencies
}

/** 链接模式匹配表项：[类型名称, 匹配函数, 提取函数] */
type UrlPattern = [string, (url: string) => boolean, (url: string) => BilibiliIdData | Promise<BilibiliIdData>]

/**
 * 解析B站分享链接，返回作品ID对象
 * @param url 分享链接
 * @param log 是否记录日志
 * @param dependencies 可注入的 av 号转换实现，缺省使用统一 B站 API wrapper
 */
export const getBilibiliID = async (
  url: string,
  log = true,
  dependencies: BilibiliIdDependencies = getDefaultDependencies()
): Promise<BilibiliIdData> => {
  let result: BilibiliIdData = { type: 'undefined' }
  let longLink = ''
  try {
    // 获取长链接
    longLink = await new Networks({
      url,
      headers: baseHeaders
    }).getLongLink()

    // 处理获取长链接失败的情况
    if (!longLink || longLink === '') {
      logger.error('获取B站长链接失败，请稍后再试')
      return { type: 'undefined' }
    }

    if (longLink === url) {
      const response = await fetch(longLink, { redirect: 'follow' })
      if (response.url && response.url !== url) longLink = response.url
    }

    /** 统一的URL模式匹配表 */
    const urlPatterns: UrlPattern[] = [
      // 视频链接
      [
        'video',
        (url) => /video[/-]([A-Za-z0-9]+)\/?/.test(url) && !url.includes('video-quick'),
        async (url) => {
          const bvideoMatch = /video[/-]([A-Za-z0-9]+)\/?|bvid=([A-Za-z0-9]+)/.exec(url)
          const pParam = new URL(url).searchParams.get('p')
          const pValue = pParam ? parseInt(pParam, 10) : undefined
          let bvid = bvideoMatch ? bvideoMatch[1] || bvideoMatch[2] : undefined
          if (bvid && bvid.toLowerCase().startsWith('av')) {
            const avid = parseInt(bvid.replace(/^av/i, ''))
            const convertResult = await dependencies.convertAvToBv({ avid, typeMode: 'strict' })
            bvid = convertResult.data.data.bvid
          }
          return {
            type: 'one_video',
            bvid,
            ...(pValue !== undefined && { p: pValue })
          }
        }
      ],
      // 活动视频链接
      [
        'festival',
        (url) => /festival\/([A-Za-z0-9]+)/.test(url),
        (url) => {
          const festivalMatch = /festival\/([A-Za-z0-9]+)\?bvid=([A-Za-z0-9]+)/.exec(url)
          return {
            type: 'one_video',
            id: festivalMatch ? festivalMatch[2] : undefined
          }
        }
      ],
      // 番剧链接
      [
        'bangumi',
        (url) => /\/bangumi\/play\/(\w+)/.test(url) || /play\/(\S+?)\??/.test(url),
        (url) => {
          const isBangumiPlayFormat = /\/bangumi\/play\/(\w+)/.test(url)
          let id = ''
          let realid = ''
          let isEpid = false

          const playMatch = /(?:\/bangumi)?\/play\/(\w+)/.exec(url)
          id = playMatch?.[1] ?? ''

          if (id) {
            if (id.startsWith('ss')) {
              realid = isBangumiPlayFormat ? id : 'season_id'
            } else if (id.startsWith('ep')) {
              realid = isBangumiPlayFormat ? id : 'ep_id'
              isEpid = true
            }
          }

          return {
            type: 'bangumi_video_info',
            isEpid,
            realid
          }
        }
      ],
      // 动态链接
      [
        'dynamic',
        (url) => {
          const parsedUrl = new URL(url)
          const { hostname, pathname } = parsedUrl
          return (
            /^https:\/\/(?:t|www)\.bilibili\.com\/(?:opus\/)?(\d+)/.test(url) ||
            (hostname === 't.bilibili.com' && /^\/\d+/.test(pathname)) ||
            (hostname === 'www.bilibili.com' && /^\/opus\/\d+/.test(pathname))
          )
        },
        (url) => {
          const parsedUrl = new URL(url)
          const { hostname, pathname } = parsedUrl
          // 统一使用单个正则表达式匹配
          const match = /^https:\/\/(?:t|www)\.bilibili\.com\/(?:opus\/)?(\d+)/.exec(url) ||
            (hostname === 't.bilibili.com' && pathname.match(/^\/(\d+)/)) ||
            (hostname === 'www.bilibili.com' && pathname.match(/^\/opus\/(\d+)/))

          return {
            type: 'dynamic_info',
            dynamic_id: match ? match?.[1] : undefined
          }
        }
      ],
      // 直播间链接
      [
        'live',
        (url) => url.includes('live.bilibili.com'),
        (url) => {
          const match = /https?:\/\/live\.bilibili\.com\/(\d+)/.exec(url)
          return {
            type: 'live_room_detail',
            room_id: match ? match[1] : undefined
          }
        }
      ]
    ]

    // 统一的链接处理逻辑
    for (const [name, test, extract] of urlPatterns) {
      if (test(longLink)) {
        const extractResult = extract(longLink)
        result = extractResult instanceof Promise ? await extractResult : extractResult
        if (log) logger.info(`[B站链接] 类型: ${name}`, result)
        break
      }
    }
  } catch (error) {
    logger.error('[B站链接] 解析失败:', error)
  }
  // 处理未匹配到任何模式的情况
  if (result.type === 'undefined' && log) {
    logger.warn('[B站链接] 无法识别的链接:', longLink)
  }
  return result
}
