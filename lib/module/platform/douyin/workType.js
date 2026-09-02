import { isRecord } from '../../../module/utils/record.js';
export const parseJsonSafely = (text, fallback = {}) => {
    try {
        return JSON.parse(text || '{}');
    }
    catch {
        return fallback;
    }
};
export const isDouyinArticle = (aweme) => aweme?.aweme_type === 163 || Boolean(aweme?.article_info);
export const isDouyinVideo = (aweme) => !isDouyinArticle(aweme) && (aweme?.aweme_type === 0 ||
    aweme?.aweme_type === 55 ||
    (Boolean(aweme?.video) && !((aweme?.images?.length ?? 0) > 0)));
export const isDouyinImage = (aweme) => !isDouyinArticle(aweme) && !isDouyinVideo(aweme) && (aweme?.images?.length ?? 0) > 0;
/**
 * 抖音图床低分辨率处理模板（如 `~tplv-dy-360p.jpeg`），命中说明该封面 URL 被 CDN 降质。
 * 详情接口没有 animated_cover，取封面会落到 cover_original_scale，而它的 url_list[0]
 * 常是这类降质模板；签名绑定在路径上，改 URL 无法还原原图，只能换一个没被降质的候选。
 */
const LOW_RES_COVER_PATTERN = /~tplv-[^/?]*(?:270p|360p|480p|540p)/i;
export const getDouyinWorkCoverUrl = (aweme) => {
    if (isDouyinVideo(aweme)) {
        // 旧实现直接取第一个字段的 url_list[0]，命中 cover_original_scale 的降质模板时就把糊图当封面。
        const candidates = [
            aweme?.video?.animated_cover,
            aweme?.video?.dynamic_cover,
            aweme?.video?.cover_original_scale,
            aweme?.video?.cover,
            aweme?.video?.origin_cover
        ].flatMap(field => field?.url_list ?? []);
        return candidates.find(url => !LOW_RES_COVER_PATTERN.test(url)) ?? candidates[0] ?? '';
    }
    if (isDouyinImage(aweme)) {
        return aweme?.images?.[0]?.url_list?.[2] ||
            aweme?.images?.[0]?.url_list?.[1] ||
            aweme?.images?.[0]?.url_list?.[0] ||
            '';
    }
    if (isDouyinArticle(aweme)) {
        const feData = parseJsonSafely(aweme?.article_info?.fe_data);
        const content = parseJsonSafely(aweme?.article_info?.article_content);
        return feData?.image_list?.[0]?.url_list?.[0] ||
            feData?.image_list?.[0]?.url ||
            content?.head_poster_list?.url_list?.[0] ||
            aweme?.video?.cover?.url_list?.[0] ||
            '';
    }
    return '';
};
/**
 * 取实况图的视频地址。
 *
 * 优先 `url_list` 的签名直链，实测理由有三条（都拿真实作品量过）：
 *
 * 1. **自己拼 `aweme.snssdk.com` 会在这条路上冷握手 5.7 秒**，直链是 0.3 秒。
 *    本仓库下载带 `Connection: close`，每次都是全新握手，等于每张实况图都在 5.7 秒的
 *    窗口里赌一次不被 reset —— 线上表现就是一个五张图的作品五张全 `ECONNRESET`，
 *    全部退化成静态图。
 * 2. **`ratio=1080p` 会覆盖已选中的档位**，服务端按 ratio 重新给流，挑好的 4K 白挑。
 * 3. `snssdk` 的 302 会落到 `*.ctydoh.cn:20080` 这类随机字串域名，直链稳定落在
 *    `douyinvod.com`。
 *
 * `url_list` 恒有 3 条候选（同 `pickDouyinPlayUrl`），所以按下标往后退即可；
 * 只有旧数据或异常响应才会退到最后那步 `uri` 拼接。
 */
export const getDouyinLiveVideoUrl = (imageItem) => {
    const addrs = [imageItem?.video?.play_addr_h264, imageItem?.video?.play_addr];
    const direct = addrs.flatMap(addr => addr?.url_list ?? []).find(Boolean);
    if (direct)
        return direct;
    // 兜底：接口没给 url_list 时才自己拼，代价见上面第 1、2 条。
    const uri = addrs.find(addr => addr?.uri)?.uri;
    return uri ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${uri}&ratio=1080p&line=0` : '';
};
/**
 * 文章配图 → `douyin/article-work` 契约的 `images`。
 *
 * `fe_data.image_list` 是从 JSON 字符串里解出来的 `unknown[]`，而契约那四个 URL 字段都是必填。
 * 模板拿 `markdown_url` 当键，把正文 markdown 里的图换成 `ai_high_image_url` 这些高清版，
 * 所以缺了 `markdown_url` 的项换不了图，直接丢掉。
 */
export const normalizeArticleImages = (imageList) => {
    const pick = (record, key) => typeof record[key] === 'string' ? record[key] : '';
    return (Array.isArray(imageList) ? imageList : [])
        .filter(isRecord)
        .map(record => ({
        ai_high_image_url: pick(record, 'ai_high_image_url'),
        high_image_url: pick(record, 'high_image_url'),
        markdown_url: pick(record, 'markdown_url'),
        origin_image_url: pick(record, 'origin_image_url')
    }))
        .filter(image => image.markdown_url);
};
