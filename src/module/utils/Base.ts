import { createRequire } from 'node:module'
import type { AxiosRequestConfig } from 'axios'
import type { ProxyAuth, PushlistConfig } from '@/types/config'
import type { FileInfo, FileTitle } from '@/types/platform'
import { getBilibiliData as fetchBilibiliData } from '@/module/platform/bilibili/api'
import { getDouyinData as fetchDouyinData } from '@/module/platform/douyin/api'
import { Networks, baseHeaders } from './Networks.js'
import { mergeFile } from './FFmpeg.js'
import cfg from '@/runtime/host/config'
import { Render } from './Render.js'
import Version from './Version.js'
import Config from './Config.js'
import { buildSharedUserAgentHeader } from '@/module/platform/common/userAgent'
import Common from './Common.js'
import { getAdapterInfo } from './ErrorHandler/adapter.js'
import { getActiveLogEntries } from './ErrorHandler/log-context.js'
import { buildContextLogEntries, toErrorCardPlatform } from './ErrorHandler/render.js'
import { getBuildMetadata, formatBuildTime } from '@/module/tooling/build-metadata'
import type { MessageEvent } from '@/types/message'
import fs from 'fs'

interface AmagiClient {
  [key: string]: unknown
}

interface AmagiModule {
  default: (options: unknown) => AmagiClient
  bilibiliErrorCodeMap: Record<number, unknown>
}

interface AmagiDependencies extends AmagiModule {
  getBilibiliData: typeof fetchBilibiliData
  getDouyinData: typeof fetchDouyinData
}

const require = createRequire(import.meta.url)
let defaultAmagiModule: AmagiModule | undefined

const getDefaultAmagiModule = (): AmagiModule => {
  defaultAmagiModule ||= require('@ikenxuan/amagi') as AmagiModule
  return defaultAmagiModule
}

const getAmagiDependencies = (
  overrides: Partial<AmagiDependencies>
): AmagiDependencies => {
  if (overrides.default && overrides.bilibiliErrorCodeMap) {
    return {
      default: overrides.default,
      bilibiliErrorCodeMap: overrides.bilibiliErrorCodeMap,
      getBilibiliData: overrides.getBilibiliData ?? fetchBilibiliData,
      getDouyinData: overrides.getDouyinData ?? fetchDouyinData
    }
  }
  return {
    ...getDefaultAmagiModule(),
    getBilibiliData: fetchBilibiliData,
    getDouyinData: fetchDouyinData,
    ...overrides
  }
}

/** `Base` 及其子类构造函数接受的事件对象 */
export interface BaseEvent {
  isGroup?: boolean
  group?: object
  friend?: object
  bot?: {
    online_status?: number
    adapter?: string | { name?: string }
    version?: { app_name?: string }
    config?: { markdown?: { type?: number } }
  }
  reply?: (message: unknown) => Promise<unknown>
}

interface MessageTarget {
  fs?: { upload?: (file: string) => Promise<unknown> }
  sendFile?: (file: string) => Promise<unknown>
  sendMsg?: (message: unknown) => Promise<unknown>
}

interface UploadFileOptions {
  useGroupFile?: boolean
  message_id?: string
  active?: boolean
  activeOption?: {
    uin: string
    group_id: string
  }
  forceLocal?: boolean
}

interface UploadFileDependencies {
  resolveBotAdapter: (event: BaseEvent) => string
}

interface VideoDownloadOptions {
  video_url: string
  title: FileTitle
  headers?: AxiosRequestConfig['headers']
  isLiveStream?: boolean
  liveStreamMaxSize?: number
}

interface DownloadFileOptions {
  title: string
  headers?: AxiosRequestConfig['headers']
  isLiveStream?: boolean
  liveStreamMaxSize?: number
}

interface ApiErrorRecord extends Record<string, unknown> {
  code?: number
  message?: string
  error?: unknown
  data?: unknown
}

type AmagiProxyClient = AmagiClient & {
  getBilibiliData: typeof fetchBilibiliData
  getDouyinData: typeof fetchDouyinData
}
type AmagiProperty = keyof AmagiProxyClient

const getAmagiMethod = (
  target: AmagiClient,
  property: AmagiProperty,
  getBilibiliData: typeof fetchBilibiliData,
  getDouyinData: typeof fetchDouyinData
): unknown => {
  if (property === 'getBilibiliData') return getBilibiliData
  if (property === 'getDouyinData') return getDouyinData
  return Reflect.get(target, property)
}

/**
 * 把栈帧里的绝对路径压成相对路径。
 *
 * 这张错误卡片是直接回复到群里的，绝对路径会连带把服务器的目录结构和系统用户名
 * （`C:/Users/某人/...`）一起贴出去。只保留插件目录以内的相对位置，定位能力不受影响。
 */
const scrubStackPaths = (stack: string): string => {
  const pluginPath = Version.pluginPath
  if (!pluginPath) return stack
  const yunzaiRoot = pluginPath.replace(/\/plugins\/[^/]+$/, '')
  const normalized = stack.replace(/\\/g, '/').replaceAll(pluginPath, '.')
  return yunzaiRoot && yunzaiRoot !== pluginPath
    ? normalized.replaceAll(yunzaiRoot, '<yunzai>')
    : normalized
}

/**
 * amagi 的业务错误只带结构化字段，没有 JS 调用栈。
 * 直接把 `stack` 留空会让错误卡片的堆栈区渲染成空盒子，
 * 因此在代理里现场抓取真实调用栈作为兜底。
 */
const captureLiveStack = (name: string, message: string): string => {
  const holder: { stack?: string } = {}
  Error.captureStackTrace?.(holder, captureLiveStack)
  const frames = (holder.stack ?? new Error(message).stack ?? '')
    .split('\n')
    .filter(line => /^\s+at\s/.test(line))
  if (frames.length === 0) return ''
  return scrubStackPaths([`${name}: ${message}`, ...frames].join('\n'))
}

/** 只认字符串 / 数字，其余（对象、null、undefined）一律当空 —— 别让 `[object Object]` 印到卡片上 */
const asText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''

/** 按顺序取第一个非空的文本字段 */
const pick = (...values: unknown[]): string => values.map(asText).find(Boolean) || ''

/** 把 amagi 的结构化报错字段整理成键值对，供模板独立展示 */
const collectApiDiagnostics = (
  platform: string,
  method: string,
  error: Record<string, unknown>,
  err: ApiErrorRecord
): Array<{ label: string; value: string }> => {
  return [
    { label: '平台', value: platform },
    { label: '接口', value: method },
    { label: '业务码', value: pick(err.code, error.code, error.errorCode) },
    { label: '请求类型', value: pick(error.requestType, error.request_type) },
    { label: '错误描述', value: pick(error.errorDescription, error.amagiMessage) },
    { label: '接口地址', value: pick(error.requestUrl, error.request_url) }
  ].filter(item => item.value !== '')
}

const buildApiErrorImage = async (
  platform: string,
  method: string,
  err: ApiErrorRecord,
  event?: BaseEvent
): Promise<unknown> => {
  const error = isRecord(err.error) ? err.error : isRecord(err.data) ? err.data : {}
  // 事件形状比 BaseEvent 宽；适配器与群/用户信息只做只读取值。
  const messageEvent = event as MessageEvent | undefined
  const groupId = messageEvent?.group_id || messageEvent?.groupId || 'private'
  const userId = messageEvent?.user_id || messageEvent?.userId || messageEvent?.sender?.user_id || 'unknown'

  const name = String(error.name || error.errorCode || error.code || 'APIError')
  const message = String(error.message || error.errorDescription || err?.message || 'API 请求失败')
  const buildMetadata = getBuildMetadata()

  try {
    return await Render('other/handlerError', {
      type: 'business_error',
      platform: toErrorCardPlatform(platform),
      method,
      timestamp: new Date().toISOString(),
      frameworkVersion: Version.BotVersion,
      pluginVersion: Version.version,
      triggerCommand: pick(messageEvent?.msg, error.requestUrl, error.request_url),
      error: {
        name,
        message,
        stack: String(error.stack || '') || captureLiveStack(name, message),
        businessName: method,
        diagnostics: collectApiDiagnostics(platform, method, error, err)
      },
      logs: [
        ...getActiveLogEntries().filter(entry => entry.level !== 'TRAC').reverse(),
        ...buildContextLogEntries(groupId, userId)
      ],
      buildTime: buildMetadata?.buildTime ? formatBuildTime(buildMetadata.buildTime) : undefined,
      commitHash: buildMetadata?.shortCommitHash || buildMetadata?.commitHash,
      adapterInfo: getAdapterInfo(messageEvent)
    })
  } catch (renderError: unknown) {
    // 和 ErrorHandler/render.ts 的 renderErrorReport 对齐：渲染失败必须退化成文本。
    // 定时推送这条路径上 sendMasterMessage 是唯一的投递通道，这里让异常冒出去
    // 就等于整个报错静默消失，只在宿主控制台留一行调度器日志。
    const reason = renderError instanceof Error ? renderError.message : String(renderError)
    logger.warn(`[Base] 接口错误图片渲染失败，使用文本回退: ${reason}`)
    return [
      `KKK接口调用出错: ${method}`,
      `错误: ${name}: ${message}`,
      `平台: ${platform}`,
      `群: ${groupId}`,
      `用户: ${userId}`,
      `插件: ${Version.pluginName}@${Version.version}`
    ].join('\n')
  }
}

/**
 * 统计每个平台使用最多的机器人 ID 和使用次数
 * @typedef {Object} PlatformBotStats
 * @property {string} botId 机器人 ID
 * @property {number} count 使用次数
 */

/**
 * 上传文件选项
 * @typedef {Object} uploadFileOptions
 * @property {boolean} [useGroupFile] 是否使用群文件上传
 * @property {string} [message_id] 消息ID，如果有，则将使用该消息ID制作回复元素
 * @property {boolean} [active] 是否为主动消息
 * @property {Object} [activeOption] 主动消息参数
 * @property {string} activeOption.uin 机器人账号
 * @property {string} activeOption.group_id 群号
 * @property {boolean} [forceLocal] 是否强制下载到本地后发送
 */

/**
 * 文件名选项
 * @typedef {Object} title
 * @property {string} [originTitle] 文件名：自定义
 * @property {string} [timestampTitle] 文件名：tmp + 时间戳
 */

/**
 * 下载文件选项
 * @typedef {Object} downloadFileOptions
 * @property {string} video_url 视频链接
 * @property {title} title 文件名
 * @property {string} [filetype] 下载文件类型，默认为'.mp4'
 * @property {import('axios').AxiosRequestConfig['headers']} [headers] 自定义请求头，将使用该请求头下载文件
 * @property {boolean} [isLiveStream] 是否为直播流
 * @property {number} [liveStreamMaxSize] 直播流最大下载大小(字节)
 */

/**
 * 文件信息
 * @typedef {Object} fileInfo
 * @property {string} filepath 视频文件的绝对路径
 * @property {number} totalBytes 视频文件大小
 * @property {string} [originTitle] 文件名：自定义
 * @property {string} [timestampTitle] 文件名：tmp + 时间戳
 */

/**
 * HTTP请求方法类型
 * @typedef {'GET'|'POST'|'PUT'|'DELETE'|'PATCH'|'HEAD'|'OPTIONS'} Method
 */

/**
 * 表示HTTP请求方法的请求头类型
 * @typedef {Object} MethodsHeaders
 * @remarks
 * 这是一个部分类型，将HTTP方法映射到对应的AxiosHeaders类型
 * @property {import('axios').AxiosHeaders} [get] GET方法请求头
 * @property {import('axios').AxiosHeaders} [post] POST方法请求头
 * @property {import('axios').AxiosHeaders} [put] PUT方法请求头
 * @property {import('axios').AxiosHeaders} [delete] DELETE方法请求头
 * @property {import('axios').AxiosHeaders} [patch] PATCH方法请求头
 * @property {import('axios').AxiosHeaders} [head] HEAD方法请求头
 * @property {import('axios').AxiosHeaders} [options] OPTIONS方法请求头
 * @property {import('axios').AxiosHeaders} common 通用请求头
 */

/**
 * 下载文件配置选项
 * @typedef {Object} downLoadFileOptions
 * @property {string} title 文件名
 * @property {import('axios').RawAxiosRequestHeaders & import('./index.js').MethodsHeaders | import('axios').AxiosHeaders} [headers] 用于下载文件的请求头
 * @property {boolean} [isLiveStream] 是否为直播流
 * @property {number} [liveStreamMaxSize] 直播流最大下载大小(字节)
 * @default {}
 */

export class Base {
  /** 事件对象。子类沿用旧实现在构造后重新赋值，故不可设为 readonly */
  e: BaseEvent | undefined
  headers: AxiosRequestConfig['headers']
  /**
   * amagi 客户端。
   *
   * 用 `AmagiProxyClient` 而不是 `AmagiClient`：下面的 Proxy 通过 `getAmagiMethod`
   * 真的会把 `getBilibiliData` / `getDouyinData` 这两个函数交出去，所以这里如实声明，
   * 否则两个方法在子类里都是 `unknown`、根本调用不了。
   */
  amagi: AmagiProxyClient

  constructor (e?: BaseEvent, overrides: Partial<AmagiDependencies> = {}) {
    this.e = e
    /** @type {import('axios').AxiosRequestConfig['headers']} */
    this.headers = baseHeaders
    const dependencies = getAmagiDependencies(overrides)
    const {
      default: Client,
      bilibiliErrorCodeMap,
      getBilibiliData,
      getDouyinData
    } = dependencies
    let proxy: false | {
      host: string
      port: number
      protocol: string
      auth: ProxyAuth
    } = false
    if (Config.request?.proxy?.switch) {
      proxy = {
        host: Config.request.proxy.host,
        port: parseInt(Config.request.proxy.port),
        protocol: Config.request.proxy.protocol,
        auth: Config.request.proxy.auth
      }
    }
    const client = Client({
      cookies: {
        douyin: Config.cookies.douyin,
        bilibili: Config.cookies.bilibili,
        kuaishou: Config.cookies.kuaishou,
        xiaohongshu: Config.cookies.xiaohongshu
      },
      request: {
        timeout: Config.request?.timeout || 15000,
        // 同 platform/*/api.ts：只在配置 UA 比 amagi 内置的更新时才覆盖，
        // 否则让 amagi 自己决定（它的 Sec-Ch-Ua 是从 UA 派生的，UA 落后会让指纹自相矛盾）
        // 这个 Client 是四平台共用的，走哪个平台在这里不可知，所以用四者里最高的阈值。
        headers: buildSharedUserAgentHeader(),
        proxy
      }
    })

    // 捕获实例本身：下面 `get` 用的是方法简写，其内部 `this` 是 handler 对象而非 Base 实例。
    // 只读构造参数 `e` 又会漏掉「子类构造后重新赋值 this.e」的情况（见 this.e 的注释），
    // 所以错误上报时以 self.e 为准、退回构造参数。
    const self = this

    // 使用Proxy包装amagi客户端
    this.amagi = new Proxy(client, {
      get (target, prop): unknown {
        const property = prop as AmagiProperty
        const method = getAmagiMethod(
          target,
          property,
          getBilibiliData,
          getDouyinData
        )
        if (typeof method === 'function') {
          return async (...args: unknown[]): Promise<unknown> => {
            const rawResult: unknown = await Reflect.apply(method, target, args)

            if (!rawResult) {
              logger.warn(`Amagi API调用 (${String(property)}) 返回了空值`)
              return rawResult
            }
            const result = rawResult as ApiErrorRecord

            // 渲染、路由判断、回复必须用同一个事件。以前只有 buildApiErrorImage 用了
            // self.e，判空和 reply 还读着构造参数 e，于是子类构造后重新赋值 this.e 时
            // 会出现「按新事件渲染、却按旧事件投递」——卡片内容对，但发错了地方。
            const event = self.e ?? e

            if (property === 'getDouyinData' && result.code !== 200) {
              const img = await buildApiErrorImage('douyin', String(property), result, event)
              if (Object.keys(event ?? {}).length === 0) {
                await sendMasterMessage('douyin', img)
                throw new Error(result.message)
              }
              await event?.reply?.(img)
              throw new Error(result.message)
            }

            const rawCode: unknown = result.code
            if (
              property === 'getBilibiliData' &&
              (typeof rawCode === 'number' || typeof rawCode === 'string') &&
              rawCode in bilibiliErrorCodeMap
            ) {
              const data = isRecord(result.data) ? result.data : undefined
              const nestedData = isRecord(data?.data) ? data.data : undefined
              const error = isRecord(result.error) ? result.error : undefined
              const errorData = isRecord(error?.data) ? error.data : undefined
              const errorNestedData = isRecord(errorData?.data) ? errorData.data : undefined
              const voucher = nestedData?.v_voucher || errorNestedData?.v_voucher
              if (result.code === -352 && voucher && Object.keys(event ?? {}).length !== 0) {
                const riskError = new Error(result.message || 'B站风控验证')
                Object.assign(riskError, {
                  code: result.code,
                  platform: 'bilibili',
                  data: result.data || result.error,
                  rawError: result
                })
                throw riskError
              }
              const img = await buildApiErrorImage('bilibili', String(property), result, event)
              if (Object.keys(event ?? {}).length === 0) {
                await sendMasterMessage('bilibili', img)
                throw new Error(result.message)
              }
              await event?.reply?.(img)
              throw new Error(result.message)
            }
            return result
          }
        }
        return method
      }
    }) as AmagiProxyClient
  }

  /**
   * 获取适配器名称
   * @returns {string} 返回适配器名称，如 'ICQQ', 'LagrangeCore', 'QQBot', 'OneBotv11' 等
   */
  get botadapter (): string {
    const adapter = this.e?.bot?.adapter
    const adapterName = typeof adapter === 'object' ? adapter.name : undefined
    // 定义不同机器人版本对应的适配器检查规则
    const adapters = {
      // Miao-Yunzai 版本的适配器检查规则
      'Miao-Yunzai': {
        ICQQ: () => this.e?.bot?.online_status !== 0,
        LagrangeCore: () => this.e?.bot?.adapter === 'LagrangeCore',
        QQBot: () => this.e?.bot?.adapter === 'QQBot',
        OneBotv11: () => this.e?.bot?.adapter === 'OneBotv11'
      },
      // TRSS-Yunzai 版本的适配器检查规则
      'TRSS-Yunzai': {
        ICQQ: () => adapterName === 'ICQQ',
        QQBot: () => adapterName === 'QQBot',
        OneBotv11: () => adapterName === 'OneBotv11',
        LagrangeCore: () => adapterName === 'Lagrange',
        KOOKBot: () => adapterName === 'KOOKBot'
      }
    }

    // 特殊处理 TRSS-Yunzai 的 OneBotv11 情况
    if (Version.BotName === 'TRSS-Yunzai' && adapterName === 'OneBotv11') {
      // 判断是否为 Lagrange.OneBot 版本
      return this.e?.bot?.version?.app_name === 'Lagrange.OneBot' ? 'Lagrange.OneBot' : 'OneBotv11'
    }

    // 查找匹配的适配器，优先使用对应版本的适配器检查规则，如果没有则使用 Miao-Yunzai 的规则
    const botAdapters = adapters[Version.BotName] || adapters['Miao-Yunzai']
    // 遍历适配器检查规则，返回第一个匹配的适配器名称
    for (const [adapterName, checkFn] of Object.entries(botAdapters)) {
      if (checkFn()) {
        return adapterName
      }
    }

    // 默认返回 ICQQ
    return 'ICQQ'
  }

  /**
   * 处理转发消息
   * @param {*} forwardmsg - 转发消息内容
   * @returns {*} 处理后的消息或null
   */
  resultMsg (forwardmsg: unknown): unknown {
    // Miao-Yunzai的处理
    if (Version.BotName === 'Miao-Yunzai') {
      return this.botadapter === 'OneBotv11' ? null : forwardmsg
    }

    // TRSS-Yunzai的处理
    if (Version.BotName === 'TRSS-Yunzai') {
      // 这些适配器支持转发消息
      const supportedAdapters = ['ICQQ', 'LagrangeCore', 'QQBot', 'OneBotv11']
      return supportedAdapters.includes(this.botadapter) ? forwardmsg : null
    }

    // 其他情况默认返回转发消息
    return forwardmsg
  }

  /**
   *
   * @param {unknown[]|string} msg 消息
   * @param {unknown[]} btns 按钮数组
   * @returns
   */
  mkMsg (msg: unknown[] | unknown, btns: unknown[] = []): unknown[] {
    const messages: unknown[] = Array.isArray(msg) ? msg : [msg]
    if (btns.length > 0) {
      const buttonResult = this.mkbutton(btns)
      if (buttonResult) return [...messages, buttonResult]
      return messages
    }
    return messages.flat(Infinity)
  }

  /**
   * 创建按钮
   * @param {unknown[]} btn - 按钮数组
   * @returns {Object|null} 返回按钮对象或null
   */
  // cSpell:ignore mkbutton
  mkbutton (btn: unknown[]): unknown | null {
    // Miao-Yunzai和yunzai的处理
    if (['Miao-Yunzai', 'yunzai'].includes(Version.BotName)) {
      // 只有QQBot适配器且markdown配置允许时才创建按钮
      if (this.botadapter === 'QQBot' && this.e?.bot?.config?.markdown?.type !== 0) {
        const createButton = Reflect.get(Bot ?? {}, 'Button') as unknown
        return typeof createButton === 'function' ? Reflect.apply(createButton, Bot, [btn]) : null
      }
      return null
    }

    // TRSS-Yunzai的处理
    if (Version.BotName === 'TRSS-Yunzai') {
      return segment.button(btn)
    }

    // 其他情况返回null
    return null
  }
}

/**
 * 统计推送列表中每个平台使用最多的机器人
 * @param {import('./Config.js').PushlistConfig} pushList 推送列表配置
 * @returns {{douyin: PlatformBotStats, bilibili: PlatformBotStats}} 返回每个平台使用最多的机器人统计
 */
export const statBotId = (pushList: PushlistConfig): {
  douyin: { botId: string; count: number }
  bilibili: { botId: string; count: number }
} => {
  const platformBotCount = {
    douyin: new Map<string, number>(),
    bilibili: new Map<string, number>()
  }

  // 统计抖音平台机器人使用次数
  pushList.douyin?.forEach(item => {
    item.group_id.forEach(gid => {
      const botId = gid.split(':')[1] || ''
      platformBotCount.douyin.set(botId, (platformBotCount.douyin.get(botId) ?? 0) + 1)
    })
  })

  // 统计B站平台机器人使用次数
  pushList.bilibili?.forEach(item => {
    item.group_id.forEach(gid => {
      const botId = gid.split(':')[1] || ''
      platformBotCount.bilibili.set(botId, (platformBotCount.bilibili.get(botId) ?? 0) + 1)
    })
  })

  // 获取抖音平台使用最多的机器人
  let douyinMaxCount = 0
  let douyinMostFrequentBot = ''
  platformBotCount.douyin.forEach((count, botId) => {
    if (count > douyinMaxCount) {
      douyinMaxCount = count
      douyinMostFrequentBot = botId
    }
  })

  // 获取B站平台使用最多的机器人
  let biliMaxCount = 0
  let biliMostFrequentBot = ''
  platformBotCount.bilibili.forEach((count, botId) => {
    if (count > biliMaxCount) {
      biliMaxCount = count
      biliMostFrequentBot = botId
    }
  })

  return {
    douyin: {
      botId: douyinMostFrequentBot,
      count: douyinMaxCount
    },
    bilibili: {
      botId: biliMostFrequentBot,
      count: biliMaxCount
    }
  }
}

/**
 * 发送错误消息给主人
 * @param {'douyin'|'bilibili'} platform 平台名称
 * @param {*} img 错误图片，`Render()` 返回的消息段数组（渲染失败时是 false）
 */
const sendMasterMessage = async (
  platform: 'douyin' | 'bilibili',
  img: unknown
): Promise<void> => {
  /**
   * 必须把图片段摊平进消息数组，不能整个塞进去。
   *
   * `Render()` 返回的是 `ImageMessage[]`，原来写成 `['文案', img]` 就成了
   * 「数组里套数组」，序列化出来是
   * `[{"type":"text",...},{"data":{"0":{"type":"image","file":"base64://..."}}}]` ——
   * 第二段没有 `type`、`data` 里还多一层数字键，适配器认不出这种段，
   * 于是主人只收到那行文案，图被吞掉（实测线上就是这个现象）。
   *
   * 渲染失败时 `Render()` 返回 false，此时只发文案，别把 false 当段发出去。
   */
  const segments: unknown[] = [
    '推送任务出错！请即时解决以消除警告',
    ...(Array.isArray(img) ? img : img ? [img] : [])
  ]
  if (segments.length === 1) {
    logger.warn('[Base] 推送错误卡片渲染失败，只发送文字告警')
  }

  if (Version.BotName === 'TRSS-Yunzai') {
    await Bot?.sendMasterMsg(segments as never)
    return
  }

  const botId = statBotId(Config.pushlist)
  const masterList = cfg.masterQQ || []
  const bot = Bot?.[botId[platform].botId]
  if (!bot) {
    // 原来这里静默失败：拿不到 bot 就什么都不发，也不打日志
    logger.warn(`[Base] 找不到推送机器人 ${botId[platform].botId}，${platform} 的推送错误告警未能发出`)
    return
  }
  for (const masterQQ of masterList) {
    await bot.pickFriend(masterQQ)?.sendMsg(segments as never)
  }
}

/**
 * 直接发送远端视频地址。
 * @param {*} e 消息事件
 * @param {string} videoUrl 视频直链
 * @param {uploadFileOptions} [options] 上传参数
 * @returns {Promise<boolean>}
 */
const defaultUploadFileDependencies: UploadFileDependencies = {
  resolveBotAdapter: event => new Base(event).botadapter
}

const toMessageTarget = (value: unknown): MessageTarget | undefined => isRecord(value) ? value as MessageTarget : undefined

/**
 * 判断宿主的发送返回是不是「确实发出去了」。
 *
 * 不能用 `Boolean(message_id)`：QQBot 适配器（wind-trace/Yunzai-QQBot-Plugin 的
 * index.js:807 `async sendMsg`）返回的是 `{ message_id: [], data: [], error: [] }` ——
 * message_id 是**数组**而不是标量，而且只在 `if (ret.id)` 成立时才 push，也就是说
 * 发送成功了 message_id 仍可能是空数组；真正每次成功都会追加的是 data，失败则进 error。
 *
 * 旧判据只认 string | number 标量，于是视频明明已经通过直链发出去了却被判成失败，
 * downloadVideo 接着又下载、又上传一遍，用户那边就收到了两条一样的视频。
 *
 * 现在的判据：
 * - 抛异常 -> 调用方 catch 里返回 false
 * - 标量 message_id -> 沿用旧实现的真假判断（0 / '' 这类占位值仍算没发出去）
 * - message_id / data 数组非空 -> 已发送
 * - 只有 error 而没有任何已发送记录 -> 适配器四次重试都失败了，真没发出去
 * - 返回了对象但什么都不报告 -> 当作已发送（宁可少回退一次，也不能再发一遍）
 * - 压根没有返回值（例如 e.reply 不存在，可选调用短路）-> 没发出去，与旧实现一致
 */
export const wasMessageSent = (status: unknown): boolean => {
  if (!isRecord(status)) return false

  // 标量 message_id 就是适配器给的权威答复，真假判断沿用旧实现：
  // 0 / '' 这类占位值仍然算没发出去，不能因为「有这个字段」就判成成功。
  const messageIds = status.message_id
  if (typeof messageIds === 'string' || typeof messageIds === 'number') return Boolean(messageIds)
  if (Array.isArray(messageIds) && messageIds.length > 0) return true

  const sent = status.data
  if (Array.isArray(sent) && sent.length > 0) return true

  // error 存在说明这是会汇报失败的适配器（QQBot 就是），且上面两项都空 -> 确实没发出去
  const errors = status.error
  if (Array.isArray(errors)) return false
  if (errors !== undefined && errors !== null) return false

  return true
}

/**
 * 读取宿主返回的原始 message_id，缺少返回结果时与旧实现一样抛出。
 *
 * 唯一的改动是拆数组：QQBot（wind-trace/Yunzai-QQBot-Plugin index.js:807）的 message_id
 * 是数组，旧实现直接当标量塞给 segment.reply，拼出来的引用是坏的。
 * 取到的值原样返回、不做 String() 转换——宿主自己也是原样传的
 * （lib/plugins/loader.js:465），OneBot 的 message_id 是数字。
 */
const readMessageId = (value: unknown): string => {
  const messageId = (value as { message_id: string | string[] }).message_id
  // 空数组取到的是 undefined，跟旧实现里 message_id 字段缺失时一样，仍按原样交给
  // segment.reply —— 宿主对拿不到 id 的引用段本来就是这个行为，这里不额外改动
  return (Array.isArray(messageId) ? messageId[0] : messageId) as string
}

const sendVideoUrl = async (
  e: BaseEvent,
  videoUrl: string,
  options?: UploadFileOptions
): Promise<boolean> => {
  if (!videoUrl) return false
  const isActiveMessage = options?.active && options?.activeOption
  const target = isActiveMessage && options?.activeOption?.uin
    ? Bot?.[options.activeOption.uin]?.pickGroup(options.activeOption.group_id)
    : toMessageTarget(e.isGroup ? e.group : e.friend)

  try {
    const videoMessage = segment.video(videoUrl)
    const status = isActiveMessage
      ? await target?.sendMsg?.(videoMessage || videoUrl)
      : await e.reply?.(videoMessage || videoUrl)
    return wasMessageSent(status)
  } catch (error) {
    logger.warn(`视频URL发送失败，回退本地下载上传: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

/**
 * 上传视频文件
 * @param {*} e 消息事件
 * @param {fileInfo} file 包含本地视频文件信息的对象
 * @param {string} videoUrl 视频直链，无则传空字符串
 * @param {uploadFileOptions} [options] 上传参数
 * @returns {Promise<boolean>}
 */
export const uploadFile = async (
  e: BaseEvent,
  file: FileInfo,
  videoUrl: string,
  options?: UploadFileOptions,
  dependencies: UploadFileDependencies = defaultUploadFileDependencies
): Promise<boolean> => {
  let newFileSize = file.totalBytes
  const isActiveMessage = options?.active && options?.activeOption

  // 视频压缩处理
  if (Config.upload?.compress && file.totalBytes > (Config.upload.compresstrigger || 100)) {
    const duration = await mergeFile('获取指定视频文件时长', { path: file.filepath, resultPath: '' })
    logger.warn(logger.yellow(`视频大小 (${file.totalBytes} MB) 触发压缩条件，正在压缩...`))

    // 发送压缩提示消息
    const compressMsg = `视频大小 (${file.totalBytes} MB) 触发压缩条件，正在压缩至${Config.upload.compressvalue} MB...`
    const msg1 = isActiveMessage && options?.activeOption
      ? await Bot?.[options.activeOption.uin]?.pickGroup(options.activeOption.group_id)?.sendMsg(compressMsg)
      : await e.reply!(compressMsg)

    const startTime = Date.now()
    const targetBitrate = Common.calculateBitrate(Config.upload.compresstrigger || 80, Number(duration)) * 0.75
    const compressedPath = await mergeFile('压缩视频', {
      path: file.filepath,
      targetBitrate,
      resultPath: `${Common.tempDri.video}tmp_${Date.now()}.mp4`
    })
    file.filepath = String(compressedPath)

    newFileSize = await Common.getVideoFileSize(file.filepath)
    const compressTime = ((Date.now() - startTime) / 1000).toFixed(1)

    logger.debug(`压缩完成: ${file.totalBytes.toFixed(1)}MB → ${newFileSize.toFixed(1)}MB`)

    // 发送压缩结果消息，引用的是上面那条压缩提示。
    // id 原样传给 segment.reply，不能 String() 包一层：宿主自己就是原样传的
    // （lib/plugins/loader.js:465 `segment.reply(e.message_id)`），OneBot 的 message_id
    // 是数字，包成字符串会拼出对不上的引用。
    const resultMsg = [`压缩完成: ${newFileSize.toFixed(1)}MB，耗时: ${compressTime}秒`, segment.reply(readMessageId(msg1))]
    if (isActiveMessage && options?.activeOption) {
      await Bot?.[options.activeOption.uin]?.pickGroup(options.activeOption.group_id)?.sendMsg(resultMsg)
    } else {
      await e.reply!(resultMsg)
    }
  }

  // 获取适配器信息
  const botAdapter = dependencies.resolveBotAdapter(e)

  // 特殊处理
  if (Version.BotName === 'TRSS-Yunzai' && botAdapter === 'LagrangeCore') {
    logger.warn('TRSS-Yunzai & Lagrange插件暂不支持上传视频，请使用ws链接Lagrange.Onebot')
    return false
  }

  // 确定上传方式
  const useGroupFile = Config.upload?.usegroupfile && newFileSize > (Config.upload.groupfilevalue || 100)
  if (options) options.useGroupFile = useGroupFile

  // 文件处理
  let File
  const useBase64Video = Config.upload.videoSendMode === 'base64' || Config.upload.sendbase64
  if (useBase64Video && !useGroupFile) {
    File = `base64://${fs.readFileSync(file.filepath).toString('base64')}`
    logger.mark('已开启base64转换...')
  } else {
    File = useGroupFile ? file.filepath : `file://${file.filepath}`
  }
  Common.registerVideoPreview(file.filepath, Boolean(Config.app.removeCache))

  try {
    const msgType = isActiveMessage ? '主动' : '被动'
    const uploadType = useGroupFile ? '群文件' : '消息'
    logger.mark(`${msgType}消息: ${newFileSize.toFixed(1)}MB 通过${uploadType}上传`)

    const target = isActiveMessage && options?.activeOption?.uin
      ? Bot?.[options.activeOption.uin]?.pickGroup(options.activeOption.group_id)
      : toMessageTarget(e.isGroup ? e.group : e.friend)

    if (useGroupFile) {
      if (botAdapter === 'ICQQ') {
        await target!.fs?.upload?.(File)
      } else if (['LagrangeCore', 'OneBotv11', 'Lagrange.OneBot'].includes(botAdapter)) {
        await target!.sendFile?.(File)
      } else {
        await target!.sendMsg?.(segment.file(File))
      }
      return true
    } else {
      const status = isActiveMessage
        ? await target?.sendMsg?.(segment.video(File) || videoUrl)
        : await e.reply!(segment.video(File) || videoUrl)
      return wasMessageSent(status)
    }
  } catch (error) {
    if (options && options.active === false) {
      await e.reply?.('视频文件上传失败' + JSON.stringify(error, null, 2))
    }
    logger.error('视频文件上传错误,' + String(error))
    return false
  } finally {
    Config.app.removeCache && logger.info(`文件 ${file.filepath} 将在 10 分钟后删除`) && setTimeout(() => Common.removeFile(file.filepath), 10 * 60 * 1000)
  }
}

/**
 * 下载视频并上传到群
 * @param {*} e 事件
 * @param {downloadFileOptions} downloadOpt 下载参数
 * @param {uploadFileOptions} [uploadOpt] 上传参数
 * @returns {Promise<boolean>}
 */
export const downloadVideo = async (
  e: BaseEvent,
  downloadOpt: VideoDownloadOptions,
  uploadOpt?: UploadFileOptions
): Promise<boolean> => {
  // 获取文件大小
  const fileHeaders = await new Networks({ url: downloadOpt.video_url, headers: downloadOpt.headers ?? baseHeaders }).getHeaders()
  const fileSizeContent = fileHeaders['content-range']?.match(/\/(\d+)/) ? parseInt(fileHeaders['content-range']?.match(/\/(\d+)/)[1], 10) : 0
  const fileSizeInMB = (fileSizeContent / (1024 * 1024)).toFixed(2)
  const fileSize = parseInt(parseFloat(fileSizeInMB).toFixed(2))

  if (Config.upload.usefilelimit && Config.upload.filelimit && fileSize > Config.upload.filelimit) {
    const message = `视频：「${downloadOpt.title.originTitle ?? 'Error: 文件名获取失败'}」大小 (${fileSizeInMB} MB) 超出最大限制（设定值：${Config.upload.filelimit} MB），已取消上传`
    if (uploadOpt?.active && uploadOpt?.activeOption) {
      await Bot?.[uploadOpt.activeOption.uin]?.pickGroup(uploadOpt.activeOption.group_id)?.sendMsg(message)
    } else {
      await e.reply?.(message)
    }
    return false
  }

  const botAdapter = new Base(e).botadapter
  const canSendRemoteVideo = downloadOpt.video_url && !uploadOpt?.forceLocal && !Config.upload.compress && (botAdapter === 'QQBot' || Config.upload.videoSendMode === 'url')
  if (canSendRemoteVideo && await sendVideoUrl(e, downloadOpt.video_url, uploadOpt)) {
    logger.mark(`视频大小 (${fileSizeInMB} MB) 已通过URL发送，跳过本地下载`)
    return true
  }

  // 下载文件
  let res = await downloadFile(downloadOpt.video_url, {
    title: Config.app.removeCache ? (downloadOpt.title.timestampTitle || 'temp') : processFilename(downloadOpt.title.originTitle || 'video', 50),
    headers: downloadOpt.headers || baseHeaders,
    isLiveStream: downloadOpt.isLiveStream,
    liveStreamMaxSize: downloadOpt.liveStreamMaxSize
  })

  res = { ...res, ...downloadOpt.title }
  res.totalBytes = Number((res.totalBytes / (1024 * 1024)).toFixed(2))

  // 视频大小判断
  const useGroupFile = res.totalBytes > (['LagrangeCore', 'Lagrange.OneBot', 'OneBotv11', 'OneBot11', 'ICQQ'].includes(botAdapter) ? 102 : 75)
  // 上传视频
  return await uploadFile(e, res, downloadOpt.video_url, { ...uploadOpt, useGroupFile })
}

/**
 * 异步下载文件的函数
 * @param {string} videoUrl 下载地址
 * @param {downLoadFileOptions} opt 配置选项，包括标题、请求头、直播流选项等
 * @returns {Promise<fileInfo>} 返回一个包含文件路径和总字节数的对象
 */
export const downloadFile = async (
  videoUrl: string,
  opt: DownloadFileOptions
): Promise<FileInfo> => {
  const startTime = Date.now()
  const { filepath, totalBytes } = await new Networks({
    url: videoUrl,
    headers: opt.headers ?? baseHeaders,
    filepath: Common.tempDri.video + opt.title,
    timeout: 30000
  }).downloadStream((downloadedBytes, totalBytes, isLiveStream) => {
    // 计算基础数据
    const elapsed = Math.max(0.1, (Date.now() - startTime) / 1000)
    const downloaded = Math.max(0, downloadedBytes || 0)
    const speedNum = downloaded / elapsed / 1048576
    const speed = speedNum >= 0.1 ? speedNum.toFixed(1) : speedNum.toFixed(2)
    const dlMB = (downloaded / 1048576).toFixed(1)
    const color = Version.BotName === 'TRSS-Yunzai'
      ? (c: string): ((text: string) => string) => logger.hex(c)
      : (c: string): ((text: string) => string) => (logger as unknown as { chalk?: { hex: (color: string) => (text: string) => string } }).chalk?.hex(c) ?? logger.hex(c)
    const barLen = 45
    const isValidTotal = typeof totalBytes === 'number' && !isNaN(totalBytes) && isFinite(totalBytes) && totalBytes > 1 && totalBytes !== -1

    if (!isValidTotal) {
      // 未知大小：显示脉冲式进度条
      const pulse = Math.sin(elapsed * 2) * 0.5 + 0.5
      const fillCount = Math.floor(pulse * barLen * 0.6) + Math.floor(barLen * 0.2)
      const anim = '█'.repeat(fillCount) + '░'.repeat(barLen - fillCount)
      logger.info(`⬇️  ${opt.title} [${anim}] ${color('#00BFFF')(dlMB)} MB | ${speed} MB/s 下载中...\r`)
    } else {
      // 已知大小：显示百分比进度条
      const pct = Math.min(100, Math.max(0, downloaded / totalBytes * 100))
      const fill = Math.floor(pct / 100 * barLen)
      const bar = `[${'█'.repeat(Math.max(0, fill))}${'░'.repeat(Math.max(0, barLen - fill))}]`
      const totalMB = (totalBytes / 1048576).toFixed(1)
      if (isLiveStream) {
        // 直播流：橙色进度条
        logger.info(`⬇️  ${opt.title} ${color('#FFA500')(bar)} ${color('#FFA500')(pct.toFixed(1) + '%')} ${dlMB}/${totalMB} MB | ${speed} MB/s 直播流\r`)
      } else {
        // 普通文件：红→绿渐变进度条
        const hex = `#${Math.floor(255 - 255 * pct / 100).toString(16).padStart(2, '0')}${Math.floor(255 * pct / 100).toString(16).padStart(2, '0')}00`
        // 计算剩余时间，防止速度过快/过慢导致异常
        const remainingBytes = Math.max(0, totalBytes - downloaded)
        const remain = speedNum > 0.01 && remainingBytes > 0 ? remainingBytes / (speedNum * 1048576) : 0
        const time = remain > 3600 ? `${Math.floor(remain / 3600)}h ${Math.floor((remain % 3600) / 60)}min` : remain > 60 ? `${Math.floor(remain / 60)}min ${Math.floor(remain % 60)}s` : remain > 0 ? `${Math.floor(remain)}s` : '0s'
        logger.info(`⬇️  ${opt.title} ${color(hex)(bar)} ${color(hex)(pct.toFixed(1) + '%')} ${dlMB}/${totalMB} MB | ${speed} MB/s 剩余: ${time}\r`)
      }
    }
  }, 0, {
    isLiveStream: opt.isLiveStream,
    liveStreamMaxSize: opt.liveStreamMaxSize
  })

  return { filepath, totalBytes }
}

/**
 * 处理文件名长度，保留文件扩展名
 * @param {string} filename 原始文件名
 * @param {number} [maxLength=50] 最大长度（不包括扩展名）
 * @returns {string} 处理后的文件名
 */
const processFilename = (filename: string, maxLength = 50): string => {
  const lastDotIndex = filename.lastIndexOf('.')
  const hasExtension = lastDotIndex > 0 && lastDotIndex < filename.length - 1

  if (!hasExtension) {
    return filename.substring(0, maxLength).replace(/[\\/:*?"<>|\r\n\s]/g, ' ')
  }

  const nameWithoutExt = filename.substring(0, lastDotIndex)
  const extension = filename.substring(lastDotIndex)
  const processedName = nameWithoutExt.substring(0, maxLength).replace(/[\\/:*?"<>|\r\n\s]/g, ' ')

  return processedName + '...' + extension
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
