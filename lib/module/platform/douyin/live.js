import { Common } from '../../../module/utils/index.js';
/**
 * flv 档位的偏好顺序。
 *
 * 只列 amagi `PurpleFlvPullurl`（d.ts:19434，即本仓 `stream_url` 真实走的那个类型）
 * 声明了的三个键。`HD1` **故意不在这里** —— 它只出现在 `FluffyFlvPullurl`
 * （d.ts:20045，那是 `similar_rooms` 里的房间用的），本仓这条路径上它属于
 * 「上游可能给、类型没承诺」的档位，交给下面的兜底扫描去捡。
 */
const DOUYIN_FLV_QUALITY_PRIORITY = ['FULL_HD1', 'SD1', 'SD2'];
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
export const pickDouyinLiveStream = (liveItem, preferredQuality) => {
    const streamUrl = liveItem?.stream_url;
    const flv = streamUrl?.flv_pull_url;
    const empty = { url: '', quality: '', qualityName: '' };
    if (!flv || typeof flv !== 'object')
        return empty;
    const usable = (key) => {
        const value = flv[key];
        return typeof value === 'string' && value.trim() !== '' ? value : '';
    };
    // 配置的档位排在内置优先级表前面。去重是必须的：用户填 `FULL_HD1`（内置表里本来就有）
    // 时若不去重，下面的「兜底扫描跳过优先级表里的键」判据就要多考虑一次重复项。
    const preferred = String(preferredQuality ?? '').trim();
    const priority = preferred
        ? [preferred, ...DOUYIN_FLV_QUALITY_PRIORITY.filter(key => key !== preferred)]
        : [...DOUYIN_FLV_QUALITY_PRIORITY];
    // 先按优先级挑；`FULL_HD1` 给了空串就继续往下试，而不是认它选中
    let chosen = '';
    let quality = '';
    for (const key of priority) {
        const url = usable(key);
        if (url) {
            chosen = url;
            quality = key;
            break;
        }
    }
    // 兜底：优先级表外的档位（没被配置指定的 HD1，以及上游将来新增的任何档位）
    // 按响应自身的键序取第一个可用的。跳过 `priority` 而不是跳过
    // `DOUYIN_FLV_QUALITY_PRIORITY`：配置值已经在上面试过了，再扫一遍纯属重复。
    if (!chosen) {
        for (const key of Object.keys(flv)) {
            if (priority.includes(key))
                continue;
            const url = usable(key);
            if (url) {
                chosen = url;
                quality = key;
                break;
            }
        }
    }
    if (!chosen)
        return empty;
    return {
        url: chosen,
        quality,
        qualityName: streamUrl?.resolution_name?.[quality] || quality
    };
};
/**
 * 抖音的 `*_str` 字段本身就是展示文本（"5.3万"、"1234"）。
 * 三个调用点原来一律 `Common.count(Number(v))`：带单位时 `Number('5.3万')` 得到 NaN，
 * 再走 Common.count 里的 `count?.toString()`，卡片上直接印出字面量 'NaN'。
 * 所以纯数字串才交给 Common.count 做万位换算，带单位的原样透传。
 */
const displayCount = (value) => {
    if (typeof value === 'number')
        return Common.count(value);
    const text = String(value ?? '').trim();
    if (!text)
        return Common.count(undefined);
    return /^\d+$/.test(text) ? Common.count(Number(text)) : text;
};
/** 头像：`url_list` 是直链，只有 `uri` 时才拼 CDN 前缀 */
const liveAvatarUrl = (anchor) => {
    const avatar = anchor?.avatar_larger;
    if (avatar?.url_list?.[0])
        return avatar.url_list[0];
    return avatar?.uri ? `https://p3-pc.douyinpic.com/aweme/1080x1080/${avatar.uri}` : '';
};
/** 分辨率：`stream_url.extra` 给的是真实宽高，画质名（原画/高清）只作兜底 */
const liveResolution = (liveItem) => {
    const { height, width } = liveItem?.stream_url?.extra ?? {};
    if (width && height)
        return `${width}x${height}`;
    const quality = liveItem?.stream_url?.default_resolution;
    return (quality && liveItem?.stream_url?.resolution_name?.[quality]) || '';
};
/**
 * 抖音用户对象上没有 `city`，只有 `ip_location`（形如「IP属地：广东」）。
 * 模板那格是 MapPin 图标 + 纯文本，所以剥掉前缀只留地名；
 * 取不到就留空串，模板 `{data.city && …}` 会把整格跳过。
 */
const liveAnchorCity = (anchor) => (anchor?.ip_location ?? '').replace(/^IP属地[:：]\s*/, '').trim();
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
export const buildDouyinLivePayload = (options) => {
    const { anchor, dynamicTYPE, liveItem, partitionTitle, webRid } = options;
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
    };
};
