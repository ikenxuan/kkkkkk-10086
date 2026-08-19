import { KuaiShou, GetKuaishouID, KuaishouData } from '../module/platform/kuaishou/index.js'
import { Bilibili, getBilibiliID } from '../module/platform/bilibili/index.js'
import { DouYin, getDouyinID } from '../module/platform/douyin/index.js'
import { Xiaohongshu, getXiaohongshuID } from '../module/platform/xiaohongshu/index.js'
import { Config, Common, UploadRecord, wrapWithErrorHandler, downloadVideo, baseHeaders } from '../module/utils/index.js'
import { getStatisticsDB } from '../module/db/index.js'
import { getDouyinData } from '../module/platform/douyin/api.js'
import type { BilibiliIdData } from '../module/platform/bilibili/getid.js'
import type { ErrorHandlerPlugin } from '../module/utils/ErrorHandler/strategy.js'
import { EmojiReactionManager } from '../module/utils/EmojiReaction.js'
import {
  ParseCoordinator,
  type ParseJobIdentity,
  type ParseTarget
} from '../module/utils/ParseCoordinator.js'
import { createEmojiParseReactionPort } from '../module/utils/ParseReactionAdapter.js'
import { XIAOHONGSHU_LINK_PATTERN } from '../module/platform/xiaohongshu/link.js'
import type { CommandEvent, MessageEvent } from '../types/message.js'
import type { Platform } from '../types/platform.js'

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

const PLATFORM_CONFIG: PlatformConfig[] = [
  {
    reg: /.*((www|v|jx|jingxuan|m)\.(douyin|iesdouyin)\.com|douyin\.com\/(video|note)).*/i,
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
  String(e.user_id || e.userId || e.sender?.user_id || e.sender?.userId || 'unknown')
const getEventGroupId = (e: MessageEvent): string => String(e.group_id || e.groupId || 'private')
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

const createMessageParseIdentity = (platform: Platform, e: MessageEvent): ParseJobIdentity => {
  const groupId = e.group_id ?? e.groupId
  const hasGroup = groupId !== undefined && groupId !== null && String(groupId).trim() !== ''

  return {
    platform,
    target: getParseTarget(platform, e.msg || ''),
    scope: hasGroup
      ? { type: 'group', id: String(groupId) }
      : { type: 'private', id: getEventUserId(e) }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

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
  const groupId = String(e.group_id || e.groupId || 'private')
  const userId = String(e.user_id || e.userId || e.sender?.user_id || e.sender?.userId || 'unknown')
  try {
    const statisticsDB = await getStatisticsDB()
    await statisticsDB?.recordParse(groupId, userId, platform)
  } catch (error) {
    logger.error('[统计] 记录解析统计失败', error)
  }
}

export class kkkTools extends plugin {
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
        { reg: /^#?(解析|kkk解析|弹幕解析)/, fnc: 'prefix' }, // 解析功能规则
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

  async runWithErrorHandler (e: CommandEvent, businessName: string, fn: ToolsHandler): Promise<boolean> {
    // 包装器回传的就是当前命令事件；闭包引用可保留 `msg: string` 的收窄结果。
    // ErrorHandler 只读取插件的 awaitContext；保留旧实现传入当前 app 实例的行为。
    const pluginContext = this as unknown as ErrorHandlerPlugin
    const handler = wrapWithErrorHandler(() => fn.call(this, e), { businessName, plugin: pluginContext })
    // 旧 JS 在业务函数返回 undefined 时也会原样返回；这里只收窄声明，不改变运行值。
    return await handler(e) as boolean
  }

  async runCoordinatedParse (
    e: CommandEvent,
    platform: Platform,
    businessName: string,
    fn: ToolsHandler
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

    try {
      const result = await parseCoordinator.submit(
        createMessageParseIdentity(platform, e),
        () => handler(e),
        reaction
      )
      return result === undefined ? true : result as boolean
    } catch {
      // The winning task already passed through the unified error handler.
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
    const urlMatch = e.msg.match(/https?:\/\/(?:www\.|v\.|jx\.|m\.|jingxuan\.)?(douyin\.com|iesdouyin\.com)\/[^\s]+/g)
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
    await this.runWithErrorHandler(e, '抖音主页作品选择解析', async event => {
      await new DouYin(event, iddata, {}).RESOURCES(iddata)
      await recordParseStatistics(event, 'douyin')
    })
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
      url = url.match(/(?:https?:\/\/)?(?:www\.bilibili\.com|m\.bilibili\.com|bili2233\.cn)\/[-A-Za-z\d._?%&+=/#]*/)?.[0] || url
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
    await new Bilibili(e, iddata).RESOURCES(iddata)
    return true
  }
}
