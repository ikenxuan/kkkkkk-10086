import { Common } from '@/module/utils/index'

/**
 * 直播间信息数据里的房间项，字段名与 amagi 的 `Datum` / `Room` 对齐。
 * 三个调用点（douyin.ts、push.ts、pushPreview.ts）原来各自抄了一份四字段的窄接口，
 * 把 `like_count`、`has_commerce_goods`、`stream_url` 这些卡片要用的字段全漏在了外面。
 */
export interface DouyinLiveItem {
  cover?: { url_list?: string[] }
  has_commerce_goods?: boolean
  id_str?: string
  like_count?: number
  owner?: { web_rid?: string }
  room_view_stats?: { display_value?: number | string }
  stats?: {
    like_count?: number
    total_user_str?: number | string
    user_count_str?: number | string
  }
  stream_url?: {
    default_resolution?: string
    extra?: { height?: number, width?: number }
    /**
     * 档位名 -> flv 拉流地址。
     *
     * 这里**不**直接 import amagi 的 `DatumStreamurl`：那个类型把 `resolution_name`
     * 挂在 `AdditionalStreamurl` 上而不是 `DatumStreamurl` 上（d.ts:19673 vs 19401），
     * 换过去会让下面 `liveResolution()` 的画质名兜底分支变成读一个「类型上不存在」的字段，
     * 等于悄悄改掉那条兜底的含义。所以这里是纯加字段。
     */
    flv_pull_url?: Record<string, string>
    /** 单条 hls 地址，与 `hls_pull_url_map` 是同一份流的两种给法 */
    hls_pull_url?: string
    /** 档位名 -> hls 拉流地址，键集合与 `flv_pull_url` 对齐 */
    hls_pull_url_map?: Record<string, string>
    /** SDK 拉流描述，本仓暂不解析，声明出来是为了不再被窄接口丢掉 */
    live_core_sdk_data?: Record<string, unknown>
    resolution_name?: Record<string, string>
  }
  title?: string
  user_count_str?: number | string
}

/**
 * flv 档位的偏好顺序。
 *
 * 只列 amagi `PurpleFlvPullurl`（d.ts:19434，即本仓 `stream_url` 真实走的那个类型）
 * 声明了的三个键。`HD1` **故意不在这里** —— 它只出现在 `FluffyFlvPullurl`
 * （d.ts:20045，那是 `similar_rooms` 里的房间用的），本仓这条路径上它属于
 * 「上游可能给、类型没承诺」的档位，交给下面的兜底扫描去捡。
 */
const DOUYIN_FLV_QUALITY_PRIORITY = ['FULL_HD1', 'SD1', 'SD2'] as const

/** {@link pickDouyinLiveStream} 的结果：地址 + 它对应的档位，供调用点显示给用户 */
export interface DouyinLiveStreamPick {
  /** 选中的 flv 拉流地址；一个可用档位都没有时为空串 */
  url: string
  /** 选中的档位键（如 `FULL_HD1`）；没选中时为空串 */
  quality: string
  /** 档位的中文名（取自 `resolution_name`），查不到时回落成档位键本身 */
  qualityName: string
}

/**
 * 从直播间信息里挑一个可播的 flv 地址。
 *
 * `douyin.ts` 那边**已经**在调「直播间信息数据」，流地址本来就在同一份响应里，
 * 所以这个函数不发任何新请求，只做挑选。
 *
 * ## 为什么档位判定必须靠运行时判空
 *
 * `PurpleFlvPullurl` 和 `FluffyFlvPullurl` 都带 `[property: string]: any`，
 * 于是写 `.HD1`、`.FOO_BAR` 都不会报编译错，只会静默拿到 `any` ——
 * 类型检查在这件事上完全帮不上忙。而抖音的实际响应里，某个档位「存在但是空串」
 * 是常态（未开播、或该档位没转码）。所以判据是「非空字符串」，
 * 不是「键在不在」，也不是指望 TS 拦住不存在的档位。
 *
 * ## 为什么配置的档位只是「插到队首」而不是「只认它」
 *
 * `preferredQuality` 来自 `douyin.live.quality`，用户填的是一个**期望**值。
 * 抖音那边某个档位没转码是常态（见上面那段），所以「只认配置值」意味着
 * 用户填了 `FULL_HD1` 而主播只推了 `SD1` 时我们判「录不到」——
 * 而那条流其实是可播的。因此配置值只改变尝试顺序，不改变「有可播的就录」这条底线。
 *
 * @param liveItem 直播间信息里的房间项，允许整个不存在
 * @param preferredQuality 期望的档位键，插到内置优先级表的最前面；空串/未给时按内置顺序
 * @returns 选中的地址与档位；没有任何可用地址时三个字段都是空串
 */
export const pickDouyinLiveStream = (
  liveItem: DouyinLiveItem | undefined,
  preferredQuality?: string
): DouyinLiveStreamPick => {
  const streamUrl = liveItem?.stream_url
  const flv = streamUrl?.flv_pull_url
  const empty: DouyinLiveStreamPick = { url: '', quality: '', qualityName: '' }
  if (!flv || typeof flv !== 'object') return empty

  const usable = (key: string): string => {
    const value = (flv as Record<string, unknown>)[key]
    return typeof value === 'string' && value.trim() !== '' ? value : ''
  }

  // 配置的档位排在内置优先级表前面。去重是必须的：用户填 `FULL_HD1`（内置表里本来就有）
  // 时若不去重，下面的「兜底扫描跳过优先级表里的键」判据就要多考虑一次重复项。
  const preferred = String(preferredQuality ?? '').trim()
  const priority = preferred
    ? [preferred, ...DOUYIN_FLV_QUALITY_PRIORITY.filter(key => key !== preferred)]
    : [...DOUYIN_FLV_QUALITY_PRIORITY]

  // 先按优先级挑；`FULL_HD1` 给了空串就继续往下试，而不是认它选中
  let chosen = ''
  let quality = ''
  for (const key of priority) {
    const url = usable(key)
    if (url) {
      chosen = url
      quality = key
      break
    }
  }

  // 兜底：优先级表外的档位（没被配置指定的 HD1，以及上游将来新增的任何档位）
  // 按响应自身的键序取第一个可用的。跳过 `priority` 而不是跳过
  // `DOUYIN_FLV_QUALITY_PRIORITY`：配置值已经在上面试过了，再扫一遍纯属重复。
  if (!chosen) {
    for (const key of Object.keys(flv)) {
      if (priority.includes(key)) continue
      const url = usable(key)
      if (url) {
        chosen = url
        quality = key
        break
      }
    }
  }

  if (!chosen) return empty
  return {
    url: chosen,
    quality,
    qualityName: streamUrl?.resolution_name?.[quality] || quality
  }
}

/** 一条可以贴给用户的拉流地址 */
export interface DouyinLiveStreamEntry {
  /** 档位键，如 `FULL_HD1` */
  quality: string
  /** 档位中文名，`resolution_name` 查不到时回落成档位键本身 */
  qualityName: string
  /** 协议：`flv` 是直连、`hls` 是切片 */
  protocol: 'flv' | 'hls'
  url: string
}

/**
 * 把直播间的所有拉流地址列出来，一个档位 × 一个协议一条。
 *
 * 与 {@link pickDouyinLiveStream} 的分工：那个函数是给录制用的，只要一条能播的；
 * 这个是给用户看的，要的是全集。所以它**不**读 `Config.douyin.live.quality` ——
 * 列清单没有「偏好」这回事。
 *
 * 档位来源是 `flv_pull_url` 与 `hls_pull_url_map` 的键的并集，取所有非空值：
 * 写死内置优先级表那三个键会让上游新开的档在清单里消失，而清单的意义正是「全都给你」。
 *
 * **顺序照接口给的键序，不按内置优先级表重排。** 实测响应的键序是
 * `FULL_HD1, SD2, SD1`（蓝光、标清、高清），而优先级表会把它拧成蓝光、高清、标清 ——
 * 版式要求跟接口一致，所以这里不插手。协议分组由排版层再做一次。
 *
 * `hls_pull_url` 那个单条字段故意不收：它和 `hls_pull_url_map` 是同一份流的两种给法，
 * 收进来就是同一条地址在清单里出现两次。
 * @param liveItem 直播间信息里的房间项，允许整个不存在
 * @returns 地址清单，档位按接口键序、同档位内 flv 在前；一条都没有时返回空数组
 */
export const listDouyinLiveStreams = (liveItem: DouyinLiveItem | undefined): DouyinLiveStreamEntry[] => {
  const streamUrl = liveItem?.stream_url
  const flv = isStringMap(streamUrl?.flv_pull_url) ? streamUrl.flv_pull_url : {}
  const hls = isStringMap(streamUrl?.hls_pull_url_map) ? streamUrl.hls_pull_url_map : {}

  // flv 的键序优先：两张表的键集合实测一致，flv 那份才是主表
  const ordered = [...new Set<string>([...Object.keys(flv), ...Object.keys(hls)])]

  const entries: DouyinLiveStreamEntry[] = []
  for (const quality of ordered) {
    const qualityName = streamUrl?.resolution_name?.[quality] || quality
    // flv 排在 hls 前面：同一档下 flv 是直连、延迟更低，hls 是给播放器兼容性兜底的
    for (const [protocol, source] of [['flv', flv], ['hls', hls]] as const) {
      const url = usableUrl(source[quality])
      if (url) entries.push({ quality, qualityName, protocol, url })
    }
  }
  return entries
}

/** 档位表可能整个缺失、也可能不是对象（两个 flv 类型都带 `[property: string]: any`） */
const isStringMap = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' && value !== null

/** 「存在但是空串」是抖音的常态，判据只能是非空字符串 */
const usableUrl = (value: unknown): string =>
  typeof value === 'string' && value.trim() !== '' ? value : ''

/** 用户主页数据里 `room_data` 反序列化后的形状 */
export interface DouyinRoomData {
  owner?: { web_rid?: string }
}

/** 直播卡片正文与页脚用到的主播字段 */
export interface DouyinLiveAnchor {
  avatar_larger?: { uri?: string, url_list?: string[] }
  aweme_count?: number
  follower_count?: number
  following_count?: number
  ip_location?: string
  mplatform_followers_count?: number
  nickname?: string
  signature?: string
  total_favorited?: number
}

/**
 * 抖音的 `*_str` 字段本身就是展示文本（"5.3万"、"1234"）。
 * 三个调用点原来一律 `Common.count(Number(v))`：带单位时 `Number('5.3万')` 得到 NaN，
 * 再走 Common.count 里的 `count?.toString()`，卡片上直接印出字面量 'NaN'。
 * 所以纯数字串才交给 Common.count 做万位换算，带单位的原样透传。
 */
const displayCount = (value: number | string | null | undefined): string => {
  if (typeof value === 'number') return Common.count(value)
  const text = String(value ?? '').trim()
  if (!text) return Common.count(undefined)
  return /^\d+$/.test(text) ? Common.count(Number(text)) : text
}

/** 头像：`url_list` 是直链，只有 `uri` 时才拼 CDN 前缀 */
const liveAvatarUrl = (anchor: DouyinLiveAnchor | undefined): string => {
  const avatar = anchor?.avatar_larger
  if (avatar?.url_list?.[0]) return avatar.url_list[0]
  return avatar?.uri ? `https://p3-pc.douyinpic.com/aweme/1080x1080/${avatar.uri}` : ''
}

/** 分辨率：`stream_url.extra` 给的是真实宽高，画质名（原画/高清）只作兜底 */
const liveResolution = (liveItem: DouyinLiveItem | undefined): string => {
  const { height, width } = liveItem?.stream_url?.extra ?? {}
  if (width && height) return `${width}x${height}`
  const quality = liveItem?.stream_url?.default_resolution
  return (quality && liveItem?.stream_url?.resolution_name?.[quality]) || ''
}

/**
 * 抖音用户对象上没有 `city`，只有 `ip_location`（形如「IP属地：广东」）。
 * 模板那格是 MapPin 图标 + 纯文本，所以剥掉前缀只留地名；
 * 取不到就留空串，模板 `{data.city && …}` 会把整格跳过。
 */
const liveAnchorCity = (anchor: DouyinLiveAnchor | undefined): string =>
  (anchor?.ip_location ?? '').replace(/^IP属地[:：]\s*/, '').trim()

/**
 * 组装 `douyin/live` 契约要的完整数据。
 *
 * 这里刻意不写返回类型标注：让 TS 推出字面量形状，三个 `Render('douyin/live', …)`
 * 调用点就都会拿契约来校验它，漏字段、类型不对当场报错。
 *
 * 之前三个调用点传的是 art-template 时代的老形状 —— `image_url` 是
 * `[{ image_src }]` 数组（模板要的是直接进 `<img src>` 的字符串，传数组等于
 * `src="[object Object]"`，封面必然裂图），外带 `liveinf`/`在线观众`/`总观看次数`/
 * `create_time`/`now_time` 五个契约里根本没有的字段，同时漏掉 13 个必填字段：
 * 分区、房间号、点赞、分辨率、签名、城市、作品数、关注、获赞、带货标记等等
 * 在卡片上全是 undefined。
 */
export const buildDouyinLivePayload = (options: {
  anchor: DouyinLiveAnchor | undefined
  dynamicTYPE: string
  liveItem: DouyinLiveItem | undefined
  partitionTitle: string
  webRid: string
}) => {
  const { anchor, dynamicTYPE, liveItem, partitionTitle, webRid } = options
  return {
    image_url: liveItem?.cover?.url_list?.[0] ?? '',
    text: liveItem?.title ?? '',
    partition_title: partitionTitle || liveItem?.title || '未知分区',
    room_id: webRid,
    total_viewers: displayCount(liveItem?.stats?.total_user_str),
    online_viewers: displayCount(liveItem?.room_view_stats?.display_value),
    avater_url: liveAvatarUrl(anchor),
    username: anchor?.nickname ?? '',
    fans: displayCount(anchor?.mplatform_followers_count || anchor?.follower_count),
    dynamicTYPE,
    share_url: webRid ? `https://live.douyin.com/${webRid}` : '',
    like_count: displayCount(liveItem?.like_count ?? liveItem?.stats?.like_count),
    user_count_str: displayCount(liveItem?.stats?.user_count_str ?? liveItem?.user_count_str),
    resolution: liveResolution(liveItem),
    signature: anchor?.signature ?? '',
    city: liveAnchorCity(anchor),
    aweme_count: displayCount(anchor?.aweme_count),
    following_count: displayCount(anchor?.following_count),
    total_favorited: displayCount(anchor?.total_favorited),
    has_commerce_goods: liveItem?.has_commerce_goods === true
  }
}

/**
 * 拼 App 分享出来的那种 webcast 直播间链接。
 *
 * 为什么不用卡片上那条 `live.douyin.com/<web_rid>`：那条在部分客户端里点开会先跳网页版
 * 再要求登录，而 webcast reflow 这条是 App 分享按钮给的形态，抖音自己的深链会认它。
 * 顺带这条链也在本仓 `getid.ts` 的 `live_webcast` 判据里（`webcast.amemv.com` +
 * `sec_user_id=`），所以用户把它转回来还能被自己解析，不会变成一条死链。
 *
 * **不带 `did` / `iid` / `with_sec_did`**：那三个是设备标识，App 分享链里有、服务端也不要求。
 * 硬编一个假的device id 反而是给风控多送一个矛盾信号（B站 -352 就是这么来的）。
 * @param roomId 内部房间号（`anchor.room_id_str` 或 `liveItem.id_str`），不是 URL 里的 web_rid
 * @param secUid 主播 sec_uid
 * @returns 完整链接；两个入参缺任意一个时返回空串，交给调用方回落到 web_rid 那条
 */
export const buildDouyinReflowUrl = (roomId: string, secUid: string): string => {
  if (!roomId || !secUid) return ''
  const params = new URLSearchParams({ sec_user_id: secUid })
  return `https://webcast.amemv.com/douyin/webcast/reflow/${roomId}?${params.toString()}`
}

/**
 * 组装转发第一条节点要的房间信息。
 *
 * 刻意不标注返回类型，也刻意不 import `common/liveStreamForward` 的 `LiveRoomHeadline`：
 * 那个模块静态依赖 `runtime/host/common`（import 期就 `importHost`），引进来会把宿主依赖
 * 拉进每一个 import 本文件的地方 —— `liveRecord.ts` 和几个只 mock 了 `utils/index`
 * 的测试都在那条链上。结构兼容就够，类型对齐由调用点的赋值检查兜。
 * @param options 主播、房间项与两个号
 * @returns 房间信息；取不到的字段是空串，由排版层决定整行不渲染
 */
export const buildDouyinLiveHeadline = (options: {
  anchor: DouyinLiveAnchor | undefined
  liveItem: DouyinLiveItem | undefined
  webRid: string
  roomId: string
  secUid: string
}) => {
  const { anchor, liveItem, webRid, roomId, secUid } = options
  const reflow = buildDouyinReflowUrl(roomId, secUid)
  return {
    // 封面优先、头像兜底：这条节点的图是给人认「这是哪个直播间」的，封面比头像信息量大
    imageUrl: liveItem?.cover?.url_list?.[0] || liveAvatarUrl(anchor),
    title: liveItem?.title ?? '',
    author: anchor?.nickname ?? '',
    // 在看人数用 room_view_stats，跟卡片上的 online_viewers 同源，两处不该各取一个字段
    online: onlineViewers(liveItem),
    shareUrl: reflow || (webRid ? `https://live.douyin.com/${webRid}` : '')
  }
}

/**
 * 在线人数的展示文本。
 *
 * 抖音这个字段可能已经是带单位的展示串（`5.3万`），也可能是纯数字，
 * 所以先过 {@link displayCount} 再补「正在观看」——直接拼 `${value}人正在观看`
 * 会在带单位时印出「5.3万人正在观看」之外的畸形组合。
 * @param liveItem 房间项
 * @returns 形如 `340人正在观看`；取不到时空串
 */
const onlineViewers = (liveItem: DouyinLiveItem | undefined): string => {
  const raw = liveItem?.room_view_stats?.display_value ?? liveItem?.stats?.user_count_str
  if (raw === undefined || raw === null || String(raw).trim() === '') return ''
  return `${displayCount(raw)}人正在观看`
}
