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
export const getDouyinWorkCoverUrl = (aweme) => {
    if (isDouyinVideo(aweme)) {
        return aweme?.video?.animated_cover?.url_list?.[0] ||
            aweme?.video?.dynamic_cover?.url_list?.[0] ||
            aweme?.video?.cover_original_scale?.url_list?.[0] ||
            aweme?.video?.cover?.url_list?.[0] ||
            aweme?.video?.origin_cover?.url_list?.[0] ||
            '';
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
