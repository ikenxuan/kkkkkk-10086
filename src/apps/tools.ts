import { KuaiShou, GetKuaishouID, KuaishouData } from '@/module/platform/kuaishou/index'
import { Bilibili, getBilibiliID } from '@/module/platform/bilibili/index'
import { DouYin, getDouyinID } from '@/module/platform/douyin/index'
import { Xiaohongshu, getXiaohongshuID } from '@/module/platform/xiaohongshu/index'
import { Config, Common, UploadRecord, wrapWithErrorHandler, downloadVideo, baseHeaders } from '@/module/utils/index'
import { getStatisticsDB, PRIVATE_GROUP_ID } from '@/module/db/index'
import { getDouyinData } from '@/module/platform/douyin/api'
import type { BilibiliIdData } from '@/module/platform/bilibili/getid'
import type { ErrorHandlerPlugin } from '@/module/utils/ErrorHandler/strategy'
import { EmojiReactionManager } from '@/module/utils/EmojiReaction'
import {
  createParseFingerprint,
  ParseCoordinator,
  setActiveParseCoordinator,
  type ParseJobIdentity,
  type ParseScope,
  type ParseTarget
} from '@/module/utils/ParseCoordinator'
import { createEmojiParseReactionPort } from '@/module/utils/ParseReactionAdapter'
import { runWithMediaMetrics, type MediaRecord } from '@/module/utils/media-metrics'
import { XIAOHONGSHU_LINK_PATTERN } from '@/module/platform/xiaohongshu/link'
import type { CommandEvent, MessageEvent } from '@/types/message'
import type { Platform } from '@/types/platform'
import { isRecord } from '@/module/utils/record'

interface PlatformConfig {
  reg: RegExp
  handler: 'douyin' | 'bilibili' | 'kuaishou' | 'xiaohongshu'
  enabled: boolean | undefined
}

interface DouyinSelectionVideo {
  aweme_id: string
}

interface DouyinSelection {
  videos: DouyinSelectionVideo[]
  expiresAt: number
}

interface DouyinSelectionResult {
  type: 'douyin_user_selection'
  timeoutSeconds: number
  videos: DouyinSelectionVideo[]
}

interface DouyinMusicData {
  data: {
    music_info: {
      title: string
      play_url: { uri: string }
    }
  }
}

type ToolsHandler = (event: CommandEvent) => Promise<boolean | void>

const bilibiliSelections = new Map<string, BilibiliIdData>()
const douyinSelections = new Map<string, DouyinSelection>()

const getConfigValue = <T>(value: T | undefined, fallback: T | undefined): T | undefined => value ?? fallback
const isVideoToolEnabled = () => getConfigValue(Config.app?.videoTool, Config.app?.videotool) !== false
const isDefaultTool = () => getConfigValue(Config.app?.defaulttool, Config.app?.videoTool) !== false

const configuredParseConcurrency = Number(Config.app.parseConcurrency)
const parseCoordinator = new ParseCoordinator({
  concurrency: Number.isSafeInteger(configuredParseConcurrency) && configuredParseConcurrency > 0
    ? configuredParseConcurrency
    : 2
})

// 登记给诊断卡用。协调器实例的所有权在这里（并发数要读配置），而 runtime-report
// 在 utils 层、引不到 apps，所以由这边主动登记一次。
setActiveParseCoordinator(parseCoordinator)

const PLATFORM_CONFIG: PlatformConfig[] = [
  {
    reg: /.*((www|v|jx|jingxuan|m|live)\.(douyin|iesdouyin)\.com|douyin\.com\/(video|note)|webcast\.amemv\.com).*/i,
    handler: 'douyin',
    enabled: getConfigValue(Config.douyin?.switch, Config.douyin?.douyintool)
  },
  {
    reg: /(bilibili.com|b23.tv|t.bilibili.com|bili2233.cn|^BV[1-9a-zA-Z]{10}$|^av\d+$)/i,
    handler: 'bilibili',
    enabled: getConfigValue(Config.bilibili?.switch, Config.bilibili?.bilibilitool)
  },
  {
    reg: /^((.*)快手(.*)快手(.*)|(.*)v\.kuaishou(.*)|(.*)kuaishou\.com\/f\/[a-zA-Z0-9]+.*)$/,
    handler: 'kuaishou',
    enabled: getConfigValue(Config.kuaishou?.switch, Config.kuaishou?.kuaishoutool)
  },
  {
    reg: XIAOHONGSHU_LINK_PATTERN,
    handler: 'xiaohongshu',
    enabled: Config.xiaohongshu?.switch
  }
]

/**
 * 动态生成插件规则
 * @returns {Array} 返回启用的平台规则数组
 */
const generateRules = (): Array<{ reg: RegExp, fnc: PlatformConfig['handler'] }> => {
  if (!isVideoToolEnabled()) return []
  return PLATFORM_CONFIG
    .filter(config => config.enabled)
    .map(({ reg, handler }) => ({ reg, fnc: handler }))
}

const findPlatformConfig = (msg: string): PlatformConfig | undefined =>
  PLATFORM_CONFIG.find(config => config.enabled && config.reg.test(msg))
const getEventUserId = (e: MessageEvent): string =>
  String(e.user_id || e.sender?.user_id || 'unknown')
/** 事件所在群的群号；私聊没有群号，退回统一的私聊占位值 */
const getEventGroupId = (e: MessageEvent): string => String(e.group_id || e.groupId || PRIVATE_GROUP_ID)
const getSelectionKey = (e: MessageEvent): string => `${getEventGroupId(e)}:${getEventUserId(e)}`

const trimUrlPunctuation = (value: string): string => value.replace(/[\])}>,，。！？、]+$/u, '')

const getParseTarget = (platform: Platform, message: string): ParseTarget => {
  const normalizedMessage = message.replaceAll('\\', '').trim()
  const matchedUrl = normalizedMessage.match(/https?:\/\/[^\s"'<>]+/i)?.[0]
  if (matchedUrl) {
    const value = trimUrlPunctuation(matchedUrl)
    try {
      const url = new URL(value)
      if (url.protocol === 'http:' || url.protocol === 'https:') return { type: 'url', value }
    } catch {
      // Fall through to a stable work/message identifier.
    }
  }

  if (platform === 'bilibili') {
    const workId = normalizedMessage.match(/\b(?:BV[1-9a-zA-Z]{10}|av\d+)\b/i)?.[0]
    if (workId) return { type: 'work-id', value: workId }
  }

  return { type: 'work-id', value: normalizedMessage }
}

/**
 * 指纹的作用域：有群号就按群共享（同群里的重复链接互相去重），
 * 私聊没有群号，退回按用户各自一份。
 *
 * 单独抽出来是为了让「从消息文本推目标」和「显式给目标」两条构造路径共用同一份
 * 作用域口径——抄第二份的话两边迟早漂移，届时同一个请求在两条路径上会算出不同指纹。
 */
const getParseScope = (e: MessageEvent): ParseScope => {
  const groupId = e.group_id
  const hasGroup = groupId !== undefined && groupId !== null && String(groupId).trim() !== ''

  return hasGroup
    ? { type: 'group', id: String(groupId) }
    : { type: 'private', id: getEventUserId(e) }
}

/**
 * 显式目标的指纹构造。调用方已经握着真实的作品标识（选集入口就是这种情况）时用它，
 * 不要再走 getParseTarget 从消息文本反推。
 */
const createParseIdentity = (
  platform: Platform,
  e: MessageEvent,
  target: ParseTarget
): ParseJobIdentity => ({
  platform,
  target,
  scope: getParseScope(e)
})

/** 从消息文本推目标的指纹构造，供「用户直接发链接」的主入口使用。 */
const createMessageParseIdentity = (platform: Platform, e: MessageEvent): ParseJobIdentity =>
  createParseIdentity(platform, e, getParseTarget(platform, e.msg || ''))

/**
 * 参与 B站选集去重的作品定位字段，取自 getBilibiliID 的解析结果
 * （见 module/platform/bilibili/getid.ts 的 BilibiliIdData）：
 * 番剧走 `realid`（ss/ep 号）+ `type`，普通视频走 `bvid`/`p`，
 * 活动页走 `id`，动态走 `dynamic_id`，直播走 `room_id`。
 */
const BILIBILI_WORK_ID_FIELDS = ['realid', 'bvid', 'id', 'dynamic_id', 'room_id', 'p'] as const

/**
 * B站选集的作品标识。
 *
 * 只拿集号当目标是不够的：不同番剧的第 1 集会算出同一个指纹，于是同群两个人分别在
 * 不同番剧里回「第1集」时会被错误地去重成一个任务，其中一个拿到另一个的结果。
 * 这里把上一次解析出的作品定位字段一起编进目标，集号只作为最后一段。
 */
const createBilibiliEpisodeTarget = (stored: BilibiliIdData, episode: string): ParseTarget => ({
  type: 'work-id',
  value: [
    stored.type,
    ...BILIBILI_WORK_ID_FIELDS.map(field => {
      const value = stored[field]
      return value === undefined || value === null ? '' : String(value)
    }),
    episode
  ].join('|')
})

const isDouyinSelectionResult = (value: unknown): value is DouyinSelectionResult => {
  if (!isRecord(value) || value.type !== 'douyin_user_selection' || typeof value.timeoutSeconds !== 'number') return false
  return Array.isArray(value.videos) && value.videos.every(video => isRecord(video) && typeof video.aweme_id === 'string')
}

const isDouyinMusicData = (value: unknown): value is DouyinMusicData => {
  if (!isRecord(value) || !isRecord(value.data) || !isRecord(value.data.music_info)) return false
  const music = value.data.music_info
  return typeof music.title === 'string' && isRecord(music.play_url) && typeof music.play_url.uri === 'string'
}

const recordParseStatistics = async (e: MessageEvent, platform: Platform): Promise<void> => {
  // 私聊记录照常写库：总解析次数、平台分布、用户数算它是有意义的，
  // 只有「按群聚合」的读取端要把 PRIVATE_GROUP_ID 排除掉（见 apps/statistics.ts）。
  // 这里原来把 getEventGroupId / getEventUserId 的表达式各抄了一遍，
  // 改成直接复用，免得占位值在两处漂移。
  const groupId = getEventGroupId(e)
  const userId = getEventUserId(e)
  try {
    const statisticsDB = await getStatisticsDB()
    await statisticsDB?.recordParse(groupId, userId, platform)
  } catch (error) {
    logger.error('[统计] 记录解析统计失败', error)
  }
}

/**
 * 把一次解析收集到的媒体度量写库。
 *
 * 和 recordParseStatistics 分开两个函数、各自 try/catch：解析次数是老口径，
 * 媒体度量是新加的，后者写库失败不该让前者也丢。群号口径两边一致（私聊照常写，
 * 按群聚合的读取端自己排除 PRIVATE_GROUP_ID）。
 */
const recordMediaMetrics = async (
  e: MessageEvent,
  platform: Platform,
  records: readonly MediaRecord[],
  outcome: 'success' | 'failure',
  processingMs: number
): Promise<void> => {
  try {
    const statisticsDB = await getStatisticsDB()
    await statisticsDB?.recordMediaMetrics(getEventGroupId(e), platform, records, outcome, processingMs)
  } catch (error) {
    logger.error('[统计] 记录媒体度量失败', error)
  }
}

export class kkkTools extends plugin<'message'> {
  constructor () {
    super({
      name: 'kkkkkk-10086-视频功能',
      dsc: '视频',
      event: 'message',
      priority: isDefaultTool() ? -Infinity : Config.app.priority,
      rule: [
        ...generateRules(), // 动态生成的平台规则
        ...(isVideoToolEnabled() ? [{ reg: /^(\[图片\])?$/, fnc: 'imageQrCode' }] : []),
        { reg: /^#?\d{1,2}$/, fnc: 'selectDouyinWork' },
        // 关键字后面不能紧跟汉字：这条规则没有结尾锚点，原来 `^#?kkk解析` 会把
        // `#kkk解析统计` 一起吃掉，而本 app 优先级 500 比 statistics 的 2000 靠前，
        // 且下面的 prefix() 无论有没有匹配到平台都返回 true，
        // 于是 `#kkk解析统计` 被静默截走、统计卡片从来没出过。
        { reg: /^#?(解析|kkk解析|弹幕解析)(?![一-龥])/, fnc: 'prefix' }, // 解析功能规则
        { reg: /#?BGM(\d+)/, fnc: 'uploadRecord' }, // BGM上传功能规则
        { reg: /^#?第(\d{1,3})集$/, fnc: 'next' } // 选集功能规则
      ]
    })
  }

  /**
   * 统一处理不同平台的链接解析
   * @param {any} e 事件对象
   * @returns {Promise<boolean>} 处理结果
   */
  async prefix (e: CommandEvent): Promise<boolean> {
    const originalMsg = e.msg || ''
    e.msg = await Common.getReplyMessage(e)

    if (/^#?弹幕解析/.test(originalMsg)) {
      e.msg = `#弹幕解析 ${e.msg}`
    }

    if (/https:\/\/aweme\.snssdk\.com\/aweme\/v1\/play/i.test(e.msg)) {
      const videoId = e.msg.match(/video_id=([^&\s]+)/)?.[1] || Date.now().toString()
      return await this.runCoordinatedParse(
        e,
        'douyin',
        '抖音直链解析',
        async event => {
          await downloadVideo(event, {
            video_url: event.msg,
            title: {
              timestampTitle: `tmp_${Date.now()}.mp4`,
              originTitle: `抖音视频_${videoId}.mp4`
            },
            headers: {
              ...baseHeaders,
              Referer: 'https://www.douyin.com'
            }
          })
          await recordParseStatistics(event, 'douyin')
          return true
        }
      )
    }

    // 查找匹配的平台并直接调用处理函数
    await this.dispatchPlatform(e)
    return true
  }

  /**
   * 处理直接发送的平台二维码图片
   * @param {any} e 事件对象
   * @returns {Promise<boolean>}
   */
  async imageQrCode (e: CommandEvent): Promise<boolean> {
    const msg = await Common.getReplyMessage(e)
    if (!msg || msg === e.msg) return false
    e.msg = msg
    return await this.dispatchPlatform(e)
  }

  /**
   * 根据消息内容分发到对应平台处理器
   * @param {any} e 事件对象
   * @returns {Promise<boolean>}
   */
  async dispatchPlatform (e: CommandEvent): Promise<boolean> {
    const config = findPlatformConfig(e.msg)
    if (!config) return false
    await this[config.handler](e)
    return true
  }

  /**
   * 让一次解析进入并发队列、按指纹去重，并驱动表情回应状态。
   *
   * @param target 可选的显式指纹目标。缺省时从 `e.msg` 反推（用户直接发链接的主入口
   *   就是这样）；二级入口（选集）收到的消息是「1」「第3集」这种序号，反推只能拿到
   *   垃圾值且不同作品会互相撞车，必须自己把真实作品标识传进来。
   *   这里只收目标、不收整个 identity：平台和作用域仍由本方法统一推导，
   *   免得调用点传进来的平台和 businessName 走的平台对不上。
   */
  async runCoordinatedParse (
    e: CommandEvent,
    platform: Platform,
    businessName: string,
    fn: ToolsHandler,
    target?: ParseTarget
  ): Promise<boolean> {
    const pluginContext = this as unknown as ErrorHandlerPlugin
    const handler = wrapWithErrorHandler(() => fn.call(this, e), {
      businessName,
      platform,
      plugin: pluginContext,
      emojiReaction: false,
      rethrowAfterHandle: true
    })
    const reaction = createEmojiParseReactionPort(new EmojiReactionManager(e))

    // 指纹构造要在进队列**之前**单独兜住，不能让它掉进下面那个 catch。
    // 下面的 catch 是给「已经过 wrapWithErrorHandler 弹过错误卡」的业务异常准备的，
    // 吞掉它是对的；但指纹构造抛的 TypeError 谁都没处理过 —— e.msg 为空时
    // getParseTarget 会返回 { type: 'work-id', value: '' }，normalizeTarget 的非空
    // 校验就抛在这里。混在一起的后果是解析静默跳过、连一行日志都没有。
    let identity: ParseJobIdentity
    try {
      identity = target === undefined
        ? createMessageParseIdentity(platform, e)
        : createParseIdentity(platform, e, target)
      // 提前算一次把校验前移。submit() 内部还会再算一次，但它是纯字符串拼接，
      // 比让异常穿到 catch 里被当成业务失败便宜得多。
      createParseFingerprint(identity)
    } catch (error) {
      // 返回 true 保持原有的派发语义（声称已处理、不再往后传），只是不再静默：
      // 走到这里说明输入本身不该触发解析，日志是唯一的排查线索。
      logger.error(`[${platform}] ${businessName}的解析指纹构造失败，已跳过本次解析`, error)
      return true
    }

    try {
      const result = await parseCoordinator.submit(
        identity,
        // 媒体度量的作用域包在协调器**里面**、而不是外面：submit 会对重复请求去重，
        // 只有胜出的那个任务真的跑 handler。开在外面的话，被去重掉的请求也会开一个
        // 空作用域、并在结束时写一条全 0 的耗时记录，把成功率和平均耗时都掺水。
        async () => {
          const startedAt = Date.now()
          // 成败要在这里自己记：handler 配了 rethrowAfterHandle，失败时异常穿过
          // runWithMediaMetrics 一路抛到下面那个 catch，onSettled 里看不到成败。
          let outcome: 'success' | 'failure' = 'failure'
          return await runWithMediaMetrics(
            platform,
            async () => {
              const value = await handler(e)
              outcome = 'success'
              return value
            },
            records => recordMediaMetrics(e, platform, records, outcome, Date.now() - startedAt)
          )
        },
        reaction
      )
      return result === undefined ? true : result as boolean
    } catch {
      // 只吞业务异常：handler 配的是 rethrowAfterHandle，走到这里的异常
      // 已经过统一错误处理、错误卡也弹过了，再抛一遍只会在派发层重复一次。
      // 指纹构造那类「没人处理过」的异常在上面单独兜住，不会落到这里。
      return true
    }
  }

  /**
   * 处理抖音链接解析
   * @param {any} e 事件对象
   * @returns {Promise<boolean>} 处理结果
   */
  async douyin (e: CommandEvent): Promise<boolean> {
    return await this.runCoordinatedParse(e, 'douyin', '抖音视频解析', this._douyin)
  }

  async _douyin (e: CommandEvent): Promise<boolean> {
    const forceBurnDanmaku = /^#?弹幕解析/.test(e.msg)
    // 这条必须和上面 PLATFORM_CONFIG 里的抖音网关正则认同一批域名，否则链接能触发规则、
    // 却在这里抽不出 URL，`urlMatch` 为 null 直接 `return true` —— 表现成「发了链接机器人不吭声」。
    // `live.douyin.com`（直播间长链）和 `webcast.amemv.com`（App 分享的直播间 reflow 链接）
    // 原来都漏在外面，前者过了网关后无声失败，后者连网关都进不来。
    const urlMatch = e.msg.match(/https?:\/\/(?:(?:www|v|jx|m|jingxuan|live)\.)?(?:douyin\.com|iesdouyin\.com|webcast\.amemv\.com)\/[^\s]+/g)
    if (urlMatch && urlMatch[0]) {
      const iddata = await getDouyinID(urlMatch[0])
      const result = await new DouYin(e, iddata, { forceBurnDanmaku }).RESOURCES(iddata)
      if (isDouyinSelectionResult(result)) {
        const key = getSelectionKey(e)
        const selection = {
          videos: result.videos,
          expiresAt: Date.now() + result.timeoutSeconds * 1000
        }
        douyinSelections.set(key, selection)
        setTimeout(() => {
          if (douyinSelections.get(key) === selection) douyinSelections.delete(key)
        }, result.timeoutSeconds * 1000)
      }
      await recordParseStatistics(e, 'douyin')
    }
    return true
  }

  async selectDouyinWork (e: CommandEvent): Promise<boolean> {
    const key = getSelectionKey(e)
    const selection = douyinSelections.get(key)
    if (!selection) return false
    if (Date.now() > selection.expiresAt) {
      douyinSelections.delete(key)
      await e.reply!('抖音主页作品选择已超时，请重新发送主页链接')
      return true
    }

    const index = Number((e.msg || '').replace(/^#/, ''))
    const target = selection.videos[index - 1]
    if (!target) {
      await e.reply!(`请输入 1~${selection.videos.length} 之间的序号`)
      return true
    }

    douyinSelections.delete(key)
    const iddata = {
      type: 'one_work',
      aweme_id: target.aweme_id
    }
    // 走协调器而不是裸 runWithErrorHandler：这个入口以前不进并发队列（一次完整解析
    // 会插到 parseConcurrency 的限流外面），也没有表情回应。
    // 至于「连点两次」，上面那句 douyinSelections.delete 已经让第二次点击拿不到选集，
    // 所以去重在这里主要防的是同群多人并发选到同一个作品。
    // 指纹目标必须显式给：用户发的是「1」「2」这种序号，从 e.msg 反推会拿到垃圾值，
    // 而且不同用户选的不同作品会算出相同指纹、被错误地去重成同一个任务。
    await this.runCoordinatedParse(
      e,
      'douyin',
      '抖音主页作品选择解析',
      async event => {
        await new DouYin(event, iddata, {}).RESOURCES(iddata)
        await recordParseStatistics(event, 'douyin')
        return true
      },
      { type: 'work-id', value: target.aweme_id }
    )
    return true
  }

  /**
   * 处理B站链接解析
   * @param {any} e 事件对象
   * @returns {Promise<boolean>} 处理结果
   */
  async bilibili (e: CommandEvent): Promise<boolean> {
    return await this.runCoordinatedParse(e, 'bilibili', 'B站视频解析', this._bilibili)
  }

  async _bilibili (e: CommandEvent): Promise<boolean> {
    const forceBurnDanmaku = /^#?弹幕解析/.test(e.msg)
    const firstMessage = Array.isArray(e.message) ? e.message[0] : e.message
    const messageFallback = typeof firstMessage === 'string'
      ? firstMessage
      : typeof firstMessage?.data === 'string' ? firstMessage.data : ''
    let url = (e.msg || messageFallback).replaceAll('\\', '').trim()

    // 处理不同类型的B站链接
    if (url.includes('b23.tv')) {
      url = url.match(/(http:|https:)\/\/b23.tv\/[-A-Za-z\d._?%&+=/#]*/)?.[0] || url
    } else if (/bilibili\.com|bili2233\.cn/.test(url)) {
      // `live.` 必须在这一列里：外层条件是宽松的 `/bilibili\.com/`，直播间链接进得来，
      // 但这条只认 www / m / bili2233，于是 `live.bilibili.com/26139686` 匹配不到、
      // `?.[0]` 落到 `|| url` 保留整条消息文本 —— 后面 getBilibiliID 拿着带前后文的字符串
      // 去请求长链接，直播间解析就断在这里。
      url = url.match(/(?:https?:\/\/)?(?:www\.bilibili\.com|m\.bilibili\.com|live\.bilibili\.com|bili2233\.cn)\/[-A-Za-z\d._?%&+=/#]*/)?.[0] || url
    } else if (/^BV[1-9a-zA-Z]{10}$/i.test(url) || /^av\d+$/i.test(url)) {
      url = `https://www.bilibili.com/video/${url}`
    }

    if (!url) {
      logger.warn(`未能在消息中找到有效的B站分享链接、BV号或av号: ${url}`)
      return true
    }

    const iddata = await getBilibiliID(url)
    await new Bilibili(e, iddata, { forceBurnDanmaku }).RESOURCES(iddata)
    await recordParseStatistics(e, 'bilibili')

    // 保存本次解析出的完整 ID 数据，供同一群聊中的同一用户继续选集。
    const key = getSelectionKey(e)
    bilibiliSelections.set(key, iddata)
    setTimeout(() => {
      if (bilibiliSelections.get(key) === iddata) bilibiliSelections.delete(key)
    }, 60000)
    return true
  }

  /**
   * 处理快手链接解析
   * @param {any} e 事件对象
   * @returns {Promise<boolean>} 处理结果
   */
  async kuaishou (e: CommandEvent): Promise<boolean> {
    return await this.runCoordinatedParse(e, 'kuaishou', '快手视频解析', this._kuaishou)
  }

  async _kuaishou (e: CommandEvent): Promise<boolean> {
    const url = e.msg.replaceAll('\\', '').match(/(https:\/\/v\.kuaishou\.com\/\w+|https:\/\/www\.kuaishou\.com\/f\/[a-zA-Z0-9]+)/)?.[0]
    if (!url) return true
    const Iddata = await GetKuaishouID(url)
    if (!Iddata) return true
    const WorkData = await new KuaishouData(Iddata.type).GetData({ photoId: Iddata.photoId || Iddata.id })
    // GetData 的公共签名保守返回 unknown，Action 内部本就按可选字段读取该响应。
    await new KuaiShou(e, Iddata).Action(WorkData as Parameters<InstanceType<typeof KuaiShou>['Action']>[0])
    await recordParseStatistics(e, 'kuaishou')
    return true
  }

  /**
   * 处理小红书链接解析
   * @param {any} e 事件对象
   * @returns {Promise<boolean>} 处理结果
   */
  async xiaohongshu (e: CommandEvent): Promise<boolean> {
    return await this.runCoordinatedParse(e, 'xiaohongshu', '小红书笔记解析', this._xiaohongshu)
  }

  async _xiaohongshu (e: CommandEvent): Promise<boolean> {
    const url = e.msg.replaceAll('\\', '').match(/https?:\/\/[^\s"'<>]+/i)?.[0]
    if (!url) {
      logger.warn(`未能在消息中找到有效的小红书链接: ${e.msg}`)
      return true
    }

    const iddata = await getXiaohongshuID(url)
    await new Xiaohongshu(e, iddata).XiaohongshuHandler(iddata)
    await recordParseStatistics(e, 'xiaohongshu')
    return true
  }

  /**
   * 处理BGM音频上传功能
   * @param {any} e 事件对象
   * @returns {Promise<boolean>} 处理结果
   */
  async uploadRecord (e: CommandEvent): Promise<boolean> {
    try {
      // 获取音乐ID并验证
      const musicIdMatch = e.msg.match(/BGM(\d+)/)
      if (!musicIdMatch) {
        await e.reply!('未找到有效的音乐ID')
        return false
      }

      // 获取音乐数据
      const data = await getDouyinData('音乐数据', Config.cookies.douyin ?? '', {
        music_id: musicIdMatch[1],
        typeMode: 'strict'
      })

      // 验证音乐数据
      if (!isDouyinMusicData(data)) {
        await e.reply!('获取音乐数据失败，可能是音乐ID错误或网络问题')
        return false
      }

      // 提取音乐信息
      const { title, play_url } = data.data.music_info
      const music_url = play_url.uri
      const musicInfo = `《${title}》\n${music_url}`

      await e.reply!(`正在上传: ${musicInfo}`)
      // UploadRecord 对 bot 的要求比通用消息事件更窄，运行时仍是同一个宿主事件对象。
      const uploadEvent = e as Parameters<typeof UploadRecord>[0]
      await e.reply!(await UploadRecord(uploadEvent, music_url, 0, !Config.douyin.sendHDrecord))
      return true
    } catch (error) {
      logger.error('上传音乐记录时发生错误:', error)
      await e.reply!('处理音乐时发生错误，请稍后重试')
      return false
    }
  }

  /**
   * 处理B站番剧选集功能
   * @param {any} e 事件对象
   * @returns {Promise<boolean>} 处理结果
   */
  async next (e: CommandEvent): Promise<boolean> {
    const stored = bilibiliSelections.get(getSelectionKey(e))
    const episode = e.msg.match(/第(\d+)集/)?.[1]
    if (!stored || !episode) return true

    const iddata: BilibiliIdData = { ...stored, Episode: episode }
    // 这个入口曾经裸调 RESOURCES：RESOURCES 改成向上抛之后异常会直接漏进 Yunzai 的
    // 插件派发层——既拿不到错误卡片，也绕过了本插件的日志上下文采集。后来补了
    // runWithErrorHandler 兜住异常，但仍然不进并发队列、不去重、没有表情回应，
    // 同一集连点两次会真的跑两遍完整解析。现在和主入口一样走 runCoordinatedParse。
    //
    // 指纹目标必须显式给：用户发的是「第3集」，从 e.msg 反推只能拿到集号，
    // 不同番剧的同一集号会撞成同一个任务，其中一个会拿到另一个的结果。
    return await this.runCoordinatedParse(
      e,
      'bilibili',
      'B站番剧选集解析',
      async event => {
        await new Bilibili(event, iddata).RESOURCES(iddata)
        return true
      },
      createBilibiliEpisodeTarget(stored, episode)
    )
  }
}
