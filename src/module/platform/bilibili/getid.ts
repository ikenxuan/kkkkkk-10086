import { baseHeaders, Networks } from '@/module/utils/index'
import { bilibiliFetcher, buildAmagiRequestConfig } from '@/module/utils/amagiClient'
import Config from '@/module/utils/Config'

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

/**
 * getid 的可注入依赖，仅用于测试替换真实 amagi。
 *
 * `typeMode` 写成字面量而不是 string：amagi 的严格重载按 `typeMode: 'strict'` 挑返回类型，
 * 宽化成 string 会让下面那个 fetcher 调用两个重载都匹配不上。
 */
export interface BilibiliIdDependencies {
  convertAvToBv: (options: { avid: number, typeMode: 'strict' }) => Promise<ConvertAvToBvResult>
}

let defaultDependencies: BilibiliIdDependencies | undefined

const getDefaultDependencies = (): BilibiliIdDependencies => {
  defaultDependencies ??= {
    convertAvToBv: async (options) =>
      await bilibiliFetcher.convertAvToBv(options, Config.cookies.bilibili, buildAmagiRequestConfig()) as ConvertAvToBvResult
  }
  return defaultDependencies
}

/** 链接模式匹配表项：[类型名称, 匹配函数, 提取函数] */
type UrlPattern = [string, (url: string) => boolean, (url: string) => BilibiliIdData | Promise<BilibiliIdData>]

/**
 * 补全缺失的协议头。
 *
 * B站的分享文案里常见 `www.bilibili.com/video/BV1xx411c7mD` 这种裸域名形式，
 * 而 `src/apps/tools.ts` 的链接提取正则把 `https?://` 写成可选（`(?:https?:\/\/)?`），
 * 所以裸域名会原样传进来。不补协议有两个代价：
 * `getLongLink()` 的 axios 请求直接失败、白跑三次重试；接着 `new URL()` 抛
 * `Invalid URL`，被外层 catch 咽掉只留一行日志 —— 用户看到的是「B站解析没反应」。
 */
const ensureAbsoluteUrl = (link: string): string => {
  if (!link) return link
  return /^[a-z][a-z\d+.-]*:\/\//i.test(link) ? link : `https://${link.replace(/^\/+/, '')}`
}

/**
 * `new URL()` 失败时返回 undefined。
 *
 * 匹配函数里裸调 `new URL()` 的后果比丢一条链接更重：`test()` 抛异常会中断整张模式表，
 * 排在它后面的直播间等类型再也匹配不到。长链接是网络返回的、不在本函数控制内，
 * 所以这里不假设它一定合法。
 */
const parseUrlSafely = (link: string): URL | undefined => {
  try {
    return new URL(link)
  } catch {
    return undefined
  }
}

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
  const absoluteUrl = ensureAbsoluteUrl(url)
  try {
    // 获取长链接
    longLink = await new Networks({
      url: absoluteUrl,
      headers: baseHeaders
    }).getLongLink()

    // 处理获取长链接失败的情况
    if (!longLink || longLink === '') {
      logger.error('获取B站长链接失败，请稍后再试')
      return { type: 'undefined' }
    }

    // 长链接和入参一样，说明 getLongLink() 没跟出重定向，这里用 fetch 再试一次。
    // 比较对象必须是补过协议的 absoluteUrl：拿原始 url 比，裸域名输入永远不相等，
    // 这条兜底就被无声跳过，短链该跟的重定向再也跟不到
    if (longLink === absoluteUrl) {
      const response = await fetch(longLink, { redirect: 'follow' })
      if (response.url && response.url !== absoluteUrl) longLink = response.url
    }

    /** 统一的URL模式匹配表 */
    const urlPatterns: UrlPattern[] = [
      // 视频链接
      [
        'video',
        (url) => /video[/-]([A-Za-z0-9]+)\/?/.test(url) && !url.includes('video-quick'),
        async (url) => {
          const bvideoMatch = /video[/-]([A-Za-z0-9]+)\/?|bvid=([A-Za-z0-9]+)/.exec(url)
          // bvid 来自正则、分P页码来自 URL 解析。解析不出来时只丢页码、仍然返回 bvid，
          // 比整条链接解析失败强
          const pParam = parseUrlSafely(url)?.searchParams.get('p') ?? /[?&]p=(\d+)/.exec(url)?.[1]
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
          const parsedUrl = parseUrlSafely(url)
          const hostname = parsedUrl?.hostname ?? ''
          const pathname = parsedUrl?.pathname ?? ''
          return (
            /^https:\/\/(?:t|www)\.bilibili\.com\/(?:opus\/)?(\d+)/.test(url) ||
            (hostname === 't.bilibili.com' && /^\/\d+/.test(pathname)) ||
            (hostname === 'www.bilibili.com' && /^\/opus\/\d+/.test(pathname))
          )
        },
        (url) => {
          const parsedUrl = parseUrlSafely(url)
          const hostname = parsedUrl?.hostname ?? ''
          const pathname = parsedUrl?.pathname ?? ''
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
          // 协议头写成可选，跟上面那个 `includes()` 的宽松度对齐：
          // 匹配函数只要看到域名就认，提取函数却强求 `https://`，那条链接会匹配成
          // live 类型但 room_id 是 undefined —— 比不匹配更难查
          const match = /(?:https?:\/\/)?live\.bilibili\.com\/(\d+)/.exec(url)
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
