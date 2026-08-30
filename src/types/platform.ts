import type { UploadConfig } from './config.js'

export type Platform = 'douyin' | 'bilibili' | 'kuaishou' | 'xiaohongshu'

export type VideoQuality = '540p' | '720p' | '1080p' | '2k' | '4k' | 'adapt'

export interface FileTitle {
  originTitle?: string
  timestampTitle?: string
}

export interface FileInfo extends FileTitle {
  filepath: string
  totalBytes: number
}

export interface DownloadOptions extends CdnFallbackOptions {
  isLiveStream?: boolean
  liveStreamMaxSize?: number
  /**
   * 直播流的时长上限，毫秒。
   *
   * 和 `liveStreamMaxSize` 是两把独立的闸，谁先到谁收口：体积那把管「别把盘写满」，
   * 这把管「别一直占着下载槽」。码率未知的直播流上只靠体积推不出时长，
   * 反过来也一样，所以两个都得有默认值。
   */
  liveStreamMaxDurationMs?: number
  currentSpeed?: number
  /**
   * 这次下载已经试过、且被判定为「这个节点有问题」的地址。内部字段，由重试逻辑自己追加。
   *
   * 记**地址清单**而不是「第几个」：每次重试都会按最新的主机健康重排候选顺序
   * （刚失败的主机会被挪到队尾），下标在重排之后指向的已经是另一条地址了。
   *
   * 也刻意不让 `retryCount` 兼任这件事：只有节点级失败才该换地址
   * （见 `classifyCdnFailure`），断流、超时那些换了反而丢掉断点续传的进度。
   */
  triedUrls?: readonly string[]
  /**
   * 上一次尝试实际用的地址。内部字段，由重试逻辑自己填。
   *
   * 只用来判断「这次换没换地址」：换了就不能拿上一个地址下到的部分数据续传。
   * 不能用 `triedUrls` 的最后一项代替 —— 那里只记**失败到需要换地址**的地址，
   * 断流重试并不会往里加，可是断流重试之后地址也可能因为主机健康重排而变了。
   */
  lastUrl?: string
}

export interface NormalizedThrottleOptions {
  enabled: boolean
  currentSpeed: number
  minSpeed: number
  autoReduce: boolean
}

/** 低速看守的归一化参数。`floorBytesPerSecond` 为 0 表示关掉。 */
export interface NormalizedSlowGuardOptions {
  enabled: boolean
  floorBytesPerSecond: number
  sustainMs: number
}

export interface NormalizedDownloadOptions {
  isLiveStream: boolean
  liveStreamMaxSize: number
  /** 直播流时长上限，毫秒。归一化后一定有值，见 {@link DownloadOptions.liveStreamMaxDurationMs} */
  liveStreamMaxDurationMs: number
  multiThread: boolean
  concurrency: number
  throttle: NormalizedThrottleOptions
  slowGuard: NormalizedSlowGuardOptions
}

/**
 * 一次下载的备用地址信息。
 *
 * `candidates` 是接口给出的**全部**镜像地址（含主地址），`resource` 是资源键，
 * 用来在 `CdnRegistry` 里跨次数记住这批地址与主机健康。两个都可选：
 * 给不出键的调用点仍然享受「换一个候选重试」，只是不进地址簿。
 */
export interface CdnFallbackOptions {
  candidates?: readonly string[]
  resource?: string
  /**
   * 下载前实测各候选地址的速度，按结果重排。
   *
   * 由调用方（平台层）按自己的配置开关决定，不在下载层直接读配置：下载层是平台无关的，
   * 而「要不要为测速多等几秒」这件事各平台的答案不同（B站 的 PCDN 值得测，
   * 抖音的签名直链基本都能用）。
   */
  probeCdn?: boolean
}

export interface VideoDownloadOptions extends CdnFallbackOptions {
  video_url: string
  title: string
  filetype?: string
  headers?: Record<string, string>
  isLiveStream?: boolean
  liveStreamMaxSize?: number
  /** 直播流时长上限（毫秒），见 {@link DownloadOptions.liveStreamMaxDurationMs} */
  liveStreamMaxDurationMs?: number
}

export type DownloadUploadConfig = Pick<
  UploadConfig,
  | 'downloadMultiThread'
  | 'downloadConcurrency'
  | 'downloadThrottle'
  | 'downloadMaxSpeed'
  | 'downloadMinSpeed'
  | 'downloadAutoReduce'
  | 'downloadSlowRestart'
  | 'downloadSlowFloor'
  | 'downloadSlowSustain'
  | 'downloadExternalTool'
  | 'downloadExternalMinSize'
>
