import { isRecord } from '@/module/utils/record'
import type { DouyinLiveItem, DouyinRoomData } from './live.js'
import type { DouyinUser, LivePartition, LiveResponse, UserInfoResponse } from './types.js'

/**
 * 「拿到一个可用的直播间」这一跳的取数口子。
 *
 * 抽成参数而不是在本文件里 import `./api.js`：解析卡片走的是 `Base` 里那个包了 amagi 的
 * Proxy（它顺带把接口报错渲染成错误卡片），录制走的是 `platform/douyin/api.ts` 的独立
 * wrapper。两条路都需要下面那套「先把手上没有的号补齐、再拉直播间」的时序，但客户端
 * 不能互换 —— 让解析改用 wrapper 等于接口出错时不再出卡片。
 * 所以时序留在这里只写一份，客户端由调用方给。
 */
export type DouyinLiveApiFetcher = (
  method: '直播间信息数据' | '用户主页数据',
  options: Record<string, unknown>
) => Promise<unknown>

/**
 * 和 `douyin.ts` 里 `narrowApiResponse` 同一句报错。
 *
 * 没把那个泛型工具搬出来公用：它在 douyin.ts 里有 12 处调用，搬走只是把 import 换个方向，
 * 而这里真正需要的只有「不是对象就按接口异常抛」这一句。报错文案保持一致，
 * 因为用户看到的是同一类失败。
 */
const narrowResponse = <T extends object>(value: unknown, label: string): T => {
  if (!isRecord(value)) throw new Error(`${label}返回格式异常`)
  return value as T
}

/**
 * 直播间信息数据的两种嵌套形态（`data.data` 与 `data`）在这里统一收口，
 * 让读房间列表和读主播 sec_uid 走同一份判据，不会一边跟着改、另一边漏掉。
 */
const getLiveRoot = (response: LiveResponse): Record<string, unknown> => {
  const responseData = response.data
  return isRecord(responseData.data) ? responseData.data : responseData
}

/**
 * 直播间响应里的主播 sec_uid。
 *
 * `live.douyin.com/{web_rid}` 直链只能提取出 web_rid，而卡片要的昵称、粉丝、签名、
 * 作品数这些主播字段只有「用户主页数据」才给。web/enter 的响应里带 `user.sec_uid`，
 * 正好当从「房间号」跳到「主播」的那一跳，省掉一次搜索反查。
 */
export const getLiveAnchorSecUid = (response: LiveResponse): string => {
  const user = getLiveRoot(response).user
  return isRecord(user) && typeof user.sec_uid === 'string' ? user.sec_uid : ''
}

export const getLivePayload = (response: LiveResponse): { items: DouyinLiveItem[], partition: LivePartition } => {
  const payload = getLiveRoot(response)
  const items = Array.isArray(payload.data)
    ? payload.data.filter((item): item is DouyinLiveItem => isRecord(item))
    : []
  const partition = isRecord(payload.partition_road_map)
    ? payload.partition_road_map as LivePartition
    : {}
  return { items, partition }
}

/**
 * {@link resolveDouyinLiveRoom} 的结果。
 *
 * 写成可辨识联合而不是「全字段可选 + living 布尔」：调用方拿到 `living: true` 之后
 * 就该无条件相信 `liveItem` 在，不用再补一次判空 —— 而房间项缺失这件事在下面是**抛**
 * 而不是返回，两处判据合成一处。
 */
export type DouyinLiveRoom =
  | { living: false, anchor: DouyinUser }
  | {
    living: true
    anchor: DouyinUser
    liveItem: DouyinLiveItem
    partitionTitle: string
    webRid: string
  }

/**
 * 从「一条直播间链接解析出来的定位字段」走到「可用的直播间数据」。
 *
 * 两条入口给的定位字段不一样：webcast 分享链接只有 sec_uid，`live.douyin.com` 直链
 * 只有 web_rid。所以先把手上有的那个补成另一个，再走同一套「主页数据 + 直播间信息数据」。
 *
 * 注意 `直播间信息数据` 的 room_id 是**内部房间号**（用户主页的 `room_id_str`），
 * 跟 URL 里的 web_rid 不是一个号；amagi 的 zod 校验要求两者都是非空 string，
 * 少传一个会直接抛 `invalid_type` —— 曾经这里只传 sec_uid，两条分支都是死路。
 *
 * @param id 链接解析出来的定位字段，两个都可能缺（但不能同时缺）
 * @param fetchDouyin 取数客户端，见 {@link DouyinLiveApiFetcher}
 * @returns 主播在播时带上房间项与分区，未开播时只带主播（调用方要用昵称提示）
 */
export const resolveDouyinLiveRoom = async (
  id: { sec_uid?: string, room_id?: string },
  fetchDouyin: DouyinLiveApiFetcher
): Promise<DouyinLiveRoom> => {
  let secUid = id.sec_uid ?? ''
  let webRid = id.room_id ?? ''

  if (!secUid) {
    if (!webRid) throw new Error('直播间链接缺少 sec_uid 与房间号，无法解析')
    // 只有 web_rid 时先探一次直播间：`web/enter` 认 web_rid，
    // 响应里的 user.sec_uid 就是反查主播主页所需的钥匙。
    const roomProbe = narrowResponse<LiveResponse>(await fetchDouyin('直播间信息数据', {
      room_id: webRid,
      web_rid: webRid,
      typeMode: 'strict'
    }), '直播间信息数据')
    secUid = getLiveAnchorSecUid(roomProbe)
    if (!secUid) throw new Error('直播间信息数据未返回主播信息，可能已关播或抖音 Cookie 失效')
  }

  const userInfo = narrowResponse<UserInfoResponse>(await fetchDouyin('用户主页数据', {
    sec_uid: secUid,
    typeMode: 'strict'
  }), '用户主页数据')
  const anchor = userInfo.data.user
  if (anchor.live_status !== 1) return { living: false, anchor }

  const roomData = narrowResponse<DouyinRoomData>(JSON.parse(anchor.room_data || '{}'), '直播间房间数据')
  webRid = roomData.owner?.web_rid || webRid
  const liveData = narrowResponse<LiveResponse>(await fetchDouyin('直播间信息数据', {
    room_id: anchor.room_id_str || webRid,
    web_rid: webRid,
    typeMode: 'strict'
  }), '直播间信息数据')

  const { items, partition } = getLivePayload(liveData)
  const liveItem = items[0]
  if (!liveItem) throw new Error('直播间信息数据返回格式异常')

  return {
    living: true,
    anchor,
    liveItem,
    partitionTitle: partition.partition?.title || '',
    webRid: webRid || liveItem.owner?.web_rid || ''
  }
}
