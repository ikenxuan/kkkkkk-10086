import { isRecord } from '../../../module/utils/record.js';
/**
 * 和 `douyin.ts` 里 `narrowApiResponse` 同一句报错。
 *
 * 没把那个泛型工具搬出来公用：它在 douyin.ts 里有 9 处调用，搬走只是把 import 换个方向，
 * 而这里真正需要的只有「不是对象就按接口异常抛」这一句。报错文案保持一致，
 * 因为用户看到的是同一类失败。
 */
const narrowResponse = (value, label) => {
    if (!isRecord(value))
        throw new Error(`${label}返回格式异常`);
    return value;
};
/**
 * 直播间信息数据的两种嵌套形态（`data.data` 与 `data`）在这里统一收口，
 * 让读房间列表和读主播 sec_uid 走同一份判据，不会一边跟着改、另一边漏掉。
 */
const getLiveRoot = (response) => {
    const responseData = response.data;
    return isRecord(responseData.data) ? responseData.data : responseData;
};
/**
 * 直播间响应里的主播 sec_uid。
 *
 * `live.douyin.com/{web_rid}` 直链只能提取出 web_rid，而卡片要的昵称、粉丝、签名、
 * 作品数这些主播字段只有「用户主页数据」才给。web/enter 的响应里带 `user.sec_uid`，
 * 正好当从「房间号」跳到「主播」的那一跳，省掉一次搜索反查。
 */
export const getLiveAnchorSecUid = (response) => {
    const user = getLiveRoot(response).user;
    return isRecord(user) && typeof user.sec_uid === 'string' ? user.sec_uid : '';
};
export const getLivePayload = (response) => {
    const payload = getLiveRoot(response);
    const items = Array.isArray(payload.data)
        ? payload.data.filter((item) => isRecord(item))
        : [];
    const partition = isRecord(payload.partition_road_map)
        ? payload.partition_road_map
        : {};
    return { items, partition };
};
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
export const resolveDouyinLiveRoom = async (id, fetchDouyin) => {
    let secUid = id.sec_uid ?? '';
    let webRid = id.room_id ?? '';
    if (!secUid) {
        if (!webRid)
            throw new Error('直播间链接缺少 sec_uid 与房间号，无法解析');
        // 只有 web_rid 时先探一次直播间：`web/enter` 认 web_rid，
        // 响应里的 user.sec_uid 就是反查主播主页所需的钥匙。
        const roomProbe = narrowResponse(await fetchDouyin('fetchLiveRoomInfo', {
            room_id: webRid,
            web_rid: webRid,
            typeMode: 'strict'
        }), '直播间信息数据');
        secUid = getLiveAnchorSecUid(roomProbe);
        if (!secUid)
            throw new Error('直播间信息数据未返回主播信息，可能已关播或抖音 Cookie 失效');
    }
    const userInfo = narrowResponse(await fetchDouyin('fetchUserProfile', {
        sec_uid: secUid,
        typeMode: 'strict'
    }), '用户主页数据');
    const anchor = userInfo.data.user;
    if (anchor.live_status !== 1)
        return { living: false, anchor };
    const roomData = narrowResponse(JSON.parse(anchor.room_data || '{}'), '直播间房间数据');
    webRid = roomData.owner?.web_rid || webRid;
    const liveData = narrowResponse(await fetchDouyin('fetchLiveRoomInfo', {
        room_id: anchor.room_id_str || webRid,
        web_rid: webRid,
        typeMode: 'strict'
    }), '直播间信息数据');
    const { items, partition } = getLivePayload(liveData);
    const liveItem = items[0];
    if (!liveItem)
        throw new Error('直播间信息数据返回格式异常');
    return {
        living: true,
        anchor,
        liveItem,
        partitionTitle: partition.partition?.title || '',
        webRid: webRid || liveItem.owner?.web_rid || ''
    };
};
