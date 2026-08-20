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
    resolution_name?: Record<string, string>
  }
  title?: string
  user_count_str?: number | string
}

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
