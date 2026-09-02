import Config from '../../../module/utils/Config.js';
import { at, isRecord } from '../../../module/utils/record.js';
import { baseHeaders, Networks } from '../../../module/utils/Network/index.js';
/**
 * B站直播拉流地址。
 *
 * ## 为什么这一跳要自己发请求
 *
 * amagi 6.x 没有这个能力：`BilibiliMethodRoutes` 里只有 `videoStream` 和
 * `bangumiStream`，两个都是稿件/番剧的 playurl；而 `BiliLiveRoomDetail.data`
 * 与 `BiliLiveRoomDef.data` 里一个 flv/hls/pull_url 字段都没有。
 * d.ts 全文搜 `getRoomPlayInfo` / `RoomPlayInfo` / `room_play_info` /
 * `fetch_live_playurl` / `playurl_info` 均零命中。所以只能自己打官方接口。
 *
 * ## 为什么没有重试逻辑
 *
 * `Networks.getData()` 走的 `request()` 自带 429/403/SSL 重试与 3 次上限
 * （`utils/Network/client.ts`），在外面再套一层会把退避时间乘起来。
 */
/** 直播流播放地址接口。`api.live.bilibili.com` 这一支不吃 wbi 签名，理由见 {@link fetchBilibiliLiveStream} */
const LIVE_PLAYURL_API = 'https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo';
/**
 * 画质编号 -> 中文名的兜底表。
 *
 * 正常情况下用响应自带的 `g_qn_desc`（官方会随接口演进更新），这张表只在
 * `g_qn_desc` 整个缺失时顶上，免得画质那格显示成裸数字。
 */
const QN_FALLBACK_NAMES = {
    30000: '杜比',
    20000: '4K',
    10000: '原画',
    400: '蓝光',
    250: '超清',
    150: '高清',
    80: '流畅'
};
/** 直播拉流请求头。B站的 CDN 校验 Referer，不带就是 403，Origin 一并给上更稳 */
const liveStreamHeaders = (roomId) => ({
    ...baseHeaders,
    Origin: 'https://live.bilibili.com',
    Referer: `https://live.bilibili.com/${roomId}`,
    Cookie: Config.cookies.bilibili
});
/**
 * 从一条 `url_info` 项里拼出完整地址。
 *
 * B站把地址拆成三段（`host` + `base_url` + `extra`），单独拿任何一段都不可播。
 * 三段里 `host` 和 `base_url` 缺一个就直接判失败 —— 拼出个半截 URL 交给
 * ffmpeg，报错会长得像「ffmpeg 坏了」而不是「接口变了」。
 */
const joinUrlInfo = (urlInfo, baseUrl) => {
    if (!isRecord(urlInfo))
        return '';
    const host = typeof urlInfo.host === 'string' ? urlInfo.host : '';
    const extra = typeof urlInfo.extra === 'string' ? urlInfo.extra : '';
    if (!host || !baseUrl)
        return '';
    return `${host}${baseUrl}${extra}`;
};
/** 取 `g_qn_desc` 里的画质名；表缺失或没这一档时回落到本地表，再兜到数字本身 */
const readQualityName = (qnDesc, qn) => {
    if (Array.isArray(qnDesc)) {
        for (const item of qnDesc) {
            if (!isRecord(item))
                continue;
            if (item.qn === qn && typeof item.desc === 'string' && item.desc)
                return item.desc;
        }
    }
    return QN_FALLBACK_NAMES[qn] ?? String(qn);
};
/**
 * 拿一个可播的 B站直播流地址。
 *
 * ## 容错解析，不写裸下标链
 *
 * 官方响应的层级是
 * `data.playurl_info.playurl.stream[].format[].codec[].url_info[]`，
 * 一路点下去（`stream[0].format[0].codec[0].url_info[0].host`）在上游改结构时
 * 会炸成 `TypeError: Cannot read properties of undefined (reading '0')`，
 * 用户看到的是「解析没反应」。所以每一层都过 `isRecord` / `at`：
 * 任何一层缺失都只是让这个函数返回空 `url`，由调用点决定怎么提示。
 *
 * 这里的数组是 `Array.isArray` 收窄出来的 `unknown[]`，`noUncheckedIndexedAccess`
 * 本来就会给下标访问带上 `undefined`，所以用 `at()` 不是为了补类型漏洞
 * （那是 `record.ts` 里非空元组那条），只是为了让「数组本身可能不是数组」
 * 和「下标可能越界」共用一个收口，省掉每层各写一遍判空。
 *
 * ## wbi 签名
 *
 * 不需要。2026-08-31 用真实房间实测：不带 wbi 签名即 `code: 0`，`playurl_info` 非空。
 * Cookie 仍然带上 —— 高码率档位（原画/4K）对未登录用户会被降级，带 Cookie 才拿得到。
 *
 * @param roomId 真实房间号（长号）。短号也能调通，但官方建议用长号
 * @param qn 期望画质，默认 10000（原画）。官方会在不可用时自动降级并在响应里回报实际档位
 * @returns 选中的地址、画质与请求头；任何一层缺失都返回空 `url` 而不抛
 */
export const fetchBilibiliLiveStream = async (roomId, qn = 10000) => {
    const headers = liveStreamHeaders(roomId);
    const params = new URLSearchParams({
        room_id: String(roomId),
        // protocol 0=http-flv 1=http-hls，format 0=flv 1=ts 2=fmp4，codec 0=avc 1=hevc。
        // 全都多要一档：官方在某档不可用时是「不返回那一档」而不是报错，多要能提高命中率。
        protocol: '0,1',
        format: '0,1,2',
        codec: '0,1',
        qn: String(qn),
        platform: 'web',
        ptype: '8',
        dolby: '5',
        panorama: '1'
    });
    const response = await new Networks({
        url: `${LIVE_PLAYURL_API}?${params.toString()}`,
        headers
    }).getData();
    const empty = {
        url: '',
        qn: 0,
        qualityName: '',
        format: '',
        headers
    };
    if (!isRecord(response))
        return empty;
    const data = isRecord(response.data) ? response.data : undefined;
    const playurlInfo = isRecord(data?.playurl_info) ? data.playurl_info : undefined;
    const playurl = isRecord(playurlInfo?.playurl) ? playurlInfo.playurl : undefined;
    if (!playurl)
        return empty;
    const qnDesc = playurl.g_qn_desc;
    const streams = Array.isArray(playurl.stream) ? playurl.stream : undefined;
    // 逐层遍历而不是只看 [0]：某一档 codec 给了空 url_info 是常见形态，
    // 只取首项会在「第一档空、第二档可用」时误判成拿不到流。
    for (let streamIndex = 0; streamIndex < (streams?.length ?? 0); streamIndex++) {
        const stream = at(streams, streamIndex);
        if (!isRecord(stream))
            continue;
        const formats = Array.isArray(stream.format) ? stream.format : undefined;
        for (let formatIndex = 0; formatIndex < (formats?.length ?? 0); formatIndex++) {
            const format = at(formats, formatIndex);
            if (!isRecord(format))
                continue;
            const formatName = typeof format.format_name === 'string' ? format.format_name : '';
            const codecs = Array.isArray(format.codec) ? format.codec : undefined;
            for (let codecIndex = 0; codecIndex < (codecs?.length ?? 0); codecIndex++) {
                const codec = at(codecs, codecIndex);
                if (!isRecord(codec))
                    continue;
                const baseUrl = typeof codec.base_url === 'string' ? codec.base_url : '';
                const urlInfos = Array.isArray(codec.url_info) ? codec.url_info : undefined;
                for (let urlIndex = 0; urlIndex < (urlInfos?.length ?? 0); urlIndex++) {
                    const url = joinUrlInfo(at(urlInfos, urlIndex), baseUrl);
                    if (!url)
                        continue;
                    // 用响应回报的 current_qn 而不是入参 qn：官方降级后两者会不一致，
                    // 显示给用户的必须是实际拿到的那一档。
                    const actualQn = typeof codec.current_qn === 'number' ? codec.current_qn : qn;
                    return {
                        url,
                        qn: actualQn,
                        qualityName: readQualityName(qnDesc, actualQn),
                        format: formatName,
                        headers
                    };
                }
            }
        }
    }
    return empty;
};
