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
  RemoveWatermark?: boolean
  RenderWaitTime?: number
  EmojiReply?: boolean
  parseTip?: boolean
  parseConcurrency?: number
  cacheEnabled?: boolean
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
  amagiTimeout?: number
  amagiMaxRetries?: number
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
   * `module/utils/DownloadBudget.ts`。运行时一律经 `clampConcurrency()` 收敛，
   * 所以这里读到的原始值可能超出区间。
   */
  downloadConcurrency?: number
  downloadThrottle?: boolean
  downloadMaxSpeed?: number
  downloadAutoReduce?: boolean
  downloadMinSpeed?: number
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
