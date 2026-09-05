export type { VideoQuality } from './platform.js'
import type { VideoQuality } from './platform.js'

export type ConfigSource = 'config' | 'default_config'

export type BilibiliDynamicType =
  | 'DYNAMIC_TYPE_AV'
  | 'DYNAMIC_TYPE_DRAW'
  | 'DYNAMIC_TYPE_ARTICLE'

export interface AmbientCoverConfig {
  coverOpacity?: number
  overlayEdgeOpacity?: number
  overlayMiddleOpacity?: number
}
/**
 * 四个平台的 Cookie。
 *
 * 全部是 `string`（可能为空串）而不是 `string | null`：yaml 里留空会解析成 null、
 * 锅巴或手改 yaml 还能塞进数字（`xiaohongshu: 114514` 就是个 number），
 * 而下游 amagi 对 cookie 只有两种处理——`cookie === ''` 判未登录、`cookie?.trim()` 拼请求头，
 * 两者都只认字符串。所以归一化在 `Config.cookies` getter 里一次做完，
 * 「没配置」在插件内部只有空串这一种表示。
 */
export interface CookiesConfig {
  bilibili: string
  douyin: string
  kuaishou: string
  xiaohongshu: string
}

export interface AppConfig {
  videotool?: boolean
  videoTool?: boolean
  defaulttool?: boolean
  removeCache?: boolean
  priority?: number
  sendforwardmsg?: boolean
  Theme?: number
  ambientCover?: AmbientCoverConfig
  renderScale?: number
  APIServer?: boolean
  APIServerPort?: number
  APIServerMount?: boolean
  RenderWaitTime?: number
  EmojiReply?: boolean
  parseTip?: boolean
  parseConcurrency?: number
  fakeForward?: boolean
  errorLogSendTo?: string[]
  multiPageRender?: boolean
  multiPageHeight?: number
  livePhotoSystem?: 'google' | 'xiaomi' | 'oppo' | 'huawei_honor'
  livePhotoMode?: 'video_and_livephoto' | 'video_only' | 'livephoto_only'
  imageSendMode?: 'url' | 'file' | 'base64'
}

export interface DouyinPushConfig {
  switch?: boolean
  permission?: string
  cron?: string
  parsedynamic?: boolean
  log?: boolean
  shareType?: 'web' | 'download'
  pushVideoQuality?: VideoQuality
  pushMaxAutoVideoSize?: number
}

export type DanmakuFontSize = 'small' | 'medium' | 'large'
export type VerticalMode = 'off' | 'standard' | 'force'
export type VideoCodec = 'h264' | 'h265' | 'av1'

/**
 * 抖音直播录制配置。
 *
 * `quality` 是 flv 拉流地址的档位键，不是本仓自己定义的枚举 —— 抖音随时可能新增档位，
 * 收成联合类型会让「上游给了新档、用户想用」变成改代码才能解决的事。
 * 填了不存在或没转码的档位不会失败，`pickDouyinLiveStream` 会自动往下试其它档。
 */
export interface DouyinLiveConfig {
  /** 单次录制的最长时长，秒。透传给 `recordLiveStream` 时换算成毫秒 */
  maxDuration?: number
  /** 录制画质偏好，flv 档位键（`FULL_HD1` / `HD1` / `SD1` / `SD2` …），只影响尝试顺序 */
  quality?: string
}

/**
 * B站直播录制配置。
 *
 * `qn` 用的是**直播**的画质编号表（10000 = 原画），和 `videoQuality` 那套稿件编号
 * 不是同一张表，也不接受稿件那边的 `0`（自动按体积挑）—— 录制前既拿不到时长
 * 也拿不到体积，没有可比的东西。
 */
export interface BilibiliLiveConfig {
  /** 单次录制的最长时长，秒。透传给 `recordLiveStream` 时换算成毫秒 */
  maxDuration?: number
  /** 录制画质编号，直播档位表（30000 杜比 / 20000 4K / 10000 原画 / 400 蓝光 …） */
  qn?: number
}

/**
 * B站 CDN 选择策略。
 *
 * - `auto`：只在接口把地址指到 PCDN 时才改写成公网镜像站（默认）
 * - `origin`：完全信接口给的地址，一个字都不改
 * - `mirror`：一律改写到公网镜像站
 *
 * 判定与改写规则见 `platform/bilibili/cdn.ts`。
 */
export type BilibiliCdnMode = 'auto' | 'origin' | 'mirror'

export interface DouyinConfig {
  douyintool?: boolean
  switch?: boolean
  douyinTip?: Array<'提示信息' | '评论图' | '视频' | '背景音乐' | '图集'>
  sendContent?: Array<'info' | 'comment' | 'video'>
  numcomments?: number
  numcomment?: number
  subCommentLimit?: number
  subCommentDepth?: number
  commentImageCollection?: boolean
  liveImageMergeMode?: 'continuous' | 'independent'
  textMode?: boolean
  realCommentCount?: boolean
  sendHDrecord?: boolean
  autoResolution?: boolean
  videoQuality?: VideoQuality
  maxAutoVideoSize?: number
  loginPerm?: string
  videoInfoMode?: 'text' | 'image'
  displayContent?: Array<'cover' | 'title' | 'author' | 'stats'>
  burnDanmaku?: boolean
  danmakuArea?: number
  danmakuFontSize?: DanmakuFontSize
  danmakuOpacity?: number
  verticalMode?: VerticalMode
  videoCodec?: VideoCodec
  /** 直播录制参数，见 {@link DouyinLiveConfig} */
  live?: DouyinLiveConfig
  push?: DouyinPushConfig
}

export interface BilibiliPushConfig {
  switch?: boolean
  permission?: string
  cron?: string
  parsedynamic?: boolean
  parseDynamicTypes?: BilibiliDynamicType[]
  log?: boolean
  pushVideoQuality?: number
  pushMaxAutoVideoSize?: number
}

export interface BilibiliConfig {
  bilibilitool?: boolean
  switch?: boolean
  bilibiliTip?: Array<'提示信息' | '简介' | '评论图' | '视频' | '动态'>
  sendContent?: Array<'info' | 'comment' | 'video'>
  bilibilinumcomments?: number
  numcomment?: number
  realCommentCount?: boolean
  commentImageCollection?: boolean
  videopriority?: boolean
  videoQuality?: number
  maxAutoVideoSize?: number
  loginPerm?: string
  imageLayout?: 'vertical' | 'waterfall' | 'grid' | 'auto'
  videoInfoMode?: 'text' | 'image'
  displayContent?: string[]
  showDanmakuInVideoInfo?: boolean
  burnDanmaku?: boolean
  danmakuArea?: number
  danmakuFontSize?: DanmakuFontSize
  danmakuOpacity?: number
  verticalMode?: VerticalMode
  videoCodec?: VideoCodec
  /**
   * CDN 选择策略。默认 `auto`。
   *
   * - `auto`：只在接口把地址指到 PCDN 时改写成公网镜像站
   * - `origin`：完全用接口给的地址
   * - `mirror`：一律改写到公网镜像站
   *
   * 改写规则与理由见 `platform/bilibili/cdn.ts`。
   */
  bilibiliCdnMode?: BilibiliCdnMode
  /**
   * 下载前实测候选地址的速度，挑快的用。默认关。
   *
   * 测的是首字节延迟加一小段真实传输 —— 被限速的节点握手很快，只有拉数据才分得出来。
   * 见 `module/utils/Network/CdnProbe.ts`。
   */
  bilibiliCdnProbe?: boolean
  /** 直播录制参数，见 {@link BilibiliLiveConfig} */
  live?: BilibiliLiveConfig
  push?: BilibiliPushConfig
}

export interface DouyinPushItem {
  switch?: boolean
  sec_uid?: string
  short_id?: string
  group_id: string[]
  remark?: string
  pushTypes?: Array<'post' | 'favorite' | 'recommend' | 'live'>
  filterMode?: 'blacklist' | 'whitelist'
  Keywords?: string[]
  Tags?: string[]
}

export interface BilibiliPushItem {
  switch: boolean
  host_mid: number
  group_id: string[]
  remark?: string
  pushTypes?: Array<'video' | 'draw' | 'word' | 'live' | 'forward' | 'article'>
  filterMode?: 'blacklist' | 'whitelist'
  Keywords?: string[]
  Tags?: string[]
}

export interface PushlistConfig {
  douyin?: DouyinPushItem[] | null
  bilibili?: BilibiliPushItem[] | null
}

export interface KuaishouConfig {
  kuaishoutool?: boolean
  switch?: boolean
  comment?: boolean
  kuaishoutip?: boolean
  kuaishounumcomments?: number
  numcomment?: number
}

export interface XiaohongshuConfig {
  switch?: boolean
  sendContent?: Array<'info' | 'image' | 'video' | 'comment'>
  numcomment?: number
  videoQuality?: VideoQuality
  maxAutoVideoSize?: number
}

export interface ProxyAuth {
  username: string
  password: string
}

export interface ProxyConfig {
  switch: boolean
  host: string
  port: string
  protocol: string
  auth: ProxyAuth
}

export interface RequestConfig {
  timeout: number
  'User-Agent': string
  proxy: ProxyConfig
}

export interface AmagiConfig {
  timeout?: number
  'User-Agent'?: string
  proxy?: ProxyConfig
  cookies: CookiesConfig
  APIServer?: boolean
  APIServerMount?: boolean
  APIServerPort?: number
}

export interface UploadConfig {
  sendbase64?: boolean
  videoSendMode?: 'file' | 'base64' | 'url'
  usefilelimit?: boolean
  filelimit?: number
  compress?: boolean
  compresstrigger?: number
  compressvalue?: number
  usegroupfile?: boolean
  groupfilevalue?: number
  imageSendMode?: 'url' | 'file' | 'base64'
  downloadMultiThread?: boolean
  /**
   * 下载连接预算：同一个平台同时最多开几条下载连接，2-16，默认 8。
   *
   * 不是「单文件分片数」——文件级下载和多线程分片共享同一份额度，见
   * `module/utils/Network/DownloadBudget.ts`。运行时一律经 `clampConcurrency()` 收敛，
   * 所以这里读到的原始值可能超出区间。
   */
  downloadConcurrency?: number
  downloadThrottle?: boolean
  downloadMaxSpeed?: number
  downloadAutoReduce?: boolean
  downloadMinSpeed?: number
  /**
   * 持续低速时自动换地址重下。默认开。
   *
   * 治的是 B站 那种「连接活着但被掐在 0.1MB/s」的限速：现有的断流看守判的是
   * 完全没有数据，低速时它永远不会响。见 `module/utils/Network/DownloadWatchdog.ts`。
   */
  downloadSlowRestart?: boolean
  /**
   * 低速判定的地板速，单位 KB/s，默认 256。
   *
   * 填 0 等于关掉判定（与 `downloadSlowRestart: false` 等效）。
   */
  downloadSlowFloor?: number
  /**
   * 低速要持续多少秒才动手，默认 20。
   *
   * 不做成即判即断：一次采样撞上对端的短暂停顿就重启，是把抖动当故障。
   */
  downloadSlowSustain?: number
  /**
   * 外部下载器：`auto` / `off` / `curl` / `wget`。默认 `off`。
   *
   * `auto` 表示按可用性自动挑（优先 curl，因为只有它有 `--speed-limit`），
   * 但只用在**大文件**上 —— 判定与理由见 `module/utils/Network/ExternalDownloader.ts`。
   */
  downloadExternalTool?: 'off' | 'auto' | 'curl' | 'wget'
  /** 外部下载器的体积门槛，单位 MB，默认 64。小于它的文件仍走内置下载。 */
  downloadExternalMinSize?: number
}

export interface PluginConfigMap {
  app: AppConfig
  bilibili: BilibiliConfig
  cookies: CookiesConfig
  douyin: DouyinConfig
  kuaishou: KuaishouConfig
  pushlist: PushlistConfig
  request: RequestConfig
  upload: UploadConfig
  xiaohongshu: XiaohongshuConfig
}

export type ConfigName = keyof PluginConfigMap
