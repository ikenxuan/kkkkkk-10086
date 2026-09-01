/**
 * `utils` 目录的类型声明。
 *
 * 从 `Base.ts` 搬过来的接口与别名，形状保持原样，只是集中到一处，
 * 让实现文件专注运行时逻辑，类型可以被别的模块直接引用而不必 import 整个 `Base`。
 */

import type { BilibiliFetcher, DouyinFetcher } from '@ikenxuan/amagi'
import type { FileTitle } from '@/types/platform'
import type { AxiosRequestConfig } from 'axios'

export interface AmagiClient {
  [key: string]: unknown
}

export interface AmagiModule {
  default: (options: unknown) => AmagiClient
  bilibiliErrorCodeMap: Record<number, unknown>
}

export interface AmagiDependencies extends AmagiModule {
  bilibiliFetcher: BilibiliFetcher
  douyinFetcher: DouyinFetcher
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

export interface MessageTarget {
  fs?: { upload?: (file: string) => Promise<unknown> }
  sendFile?: (file: string) => Promise<unknown>
  sendMsg?: (message: unknown) => Promise<unknown>
}

export interface UploadFileOptions {
  useGroupFile?: boolean
  message_id?: string
  active?: boolean
  activeOption?: {
    uin: string
    group_id: string
  }
  forceLocal?: boolean
}

export interface UploadFileDependencies {
  resolveBotAdapter: (event: BaseEvent) => string
}

export interface VideoDownloadOptions {
  video_url: string
  title: FileTitle
  headers?: AxiosRequestConfig['headers']
  isLiveStream?: boolean
  liveStreamMaxSize?: number
  /**
   * 直播流的时长上限（毫秒）。给 0 或不给都按默认值处理，见 `normalizeDownloadOptions`。
   *
   * 和 `liveStreamMaxSize` 是两条独立的闸：体积那条数字节，这条数时间，谁先到谁收口。
   * 需要两条都在是因为直播的码率不定 —— 只限体积的话低码率流会拖很久，
   * 只限时长的话高码率流会落一个超大的文件。
   */
  liveStreamMaxDurationMs?: number
  /**
   * 同一份资源的其它可用地址（镜像 / 备用 CDN），不含 `video_url` 也没关系 ——
   * 下载层会把 `video_url` 排在最前再合并这批。
   */
  candidates?: readonly string[]
  /** 资源键，例如 `bili:BV1xx:video`。给了才会跨次数记住这批地址，见 `utils/Network/CdnRegistry.ts` */
  resource?: string
  /** 下载前实测候选地址速度，按结果重排。由平台层按自己的开关决定，见 `utils/Network/CdnProbe.ts` */
  probeCdn?: boolean
}

export interface DownloadFileOptions {
  title: string
  headers?: AxiosRequestConfig['headers']
  isLiveStream?: boolean
  liveStreamMaxSize?: number
  /** 直播流时长上限（毫秒），见 {@link VideoDownloadOptions.liveStreamMaxDurationMs} */
  liveStreamMaxDurationMs?: number
  /** 备用地址，见 {@link VideoDownloadOptions.candidates} */
  candidates?: readonly string[]
  /** 资源键，见 {@link VideoDownloadOptions.resource} */
  resource?: string
  /** 测速开关，见 {@link VideoDownloadOptions.probeCdn} */
  probeCdn?: boolean
}

export interface ApiErrorRecord extends Record<string, unknown> {
  code?: number
  message?: string
  error?: unknown
  data?: unknown
}

/**
 * `Base` 暴露的 amagi 客户端。
 *
 * 两个平台的 fetcher 是**包过错误卡片的**那一层（见 `Base.ts` 的 Proxy），其余属性
 * 原样透传给 amagi Client。只有这两个平台在这里出现，因为只有它们的失败要出卡片
 * —— 快手/小红书的调用点直接 import `utils/amagiClient` 的裸 fetcher。
 */
export type AmagiProxyClient = AmagiClient & {
  bilibili: BilibiliFetcher
  douyin: DouyinFetcher
}
