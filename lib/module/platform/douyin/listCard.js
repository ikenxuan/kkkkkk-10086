import { Common } from '../../../module/utils/index.js';
/** 抖音号：优先 unique_id，退回 short_id */
const listCardDouyinId = (user) => user?.unique_id || user?.short_id || '无法获取';
/**
 * 头像：`url_list` 是直链，只有 `uri` 时才拼 CDN 前缀。
 * 与 `live.ts` 的 `liveAvatarUrl` 同源——上游一律 `cdnAvatar(uri)`，
 * 但作品作者对象上常常只有 `avatar_thumb.url_list`，拿 uri 拼会得到空路径。
 */
const listCardAvatar = (user) => {
    for (const avatar of [user?.avatar_larger, user?.avatar_thumb]) {
        if (avatar?.url_list?.[0])
            return avatar.url_list[0];
        if (avatar?.uri)
            return `https://p3-pc.douyinpic.com/aweme/1080x1080/${avatar.uri}`;
    }
    return '';
};
/** 两张卡片共用的作品区字段 */
const buildListCardWorkFields = (options) => {
    const { author, coverUrl, createTime, desc, shareUrl, statistics } = options;
    return {
        image_url: coverUrl,
        // 与通用推送卡一致：空描述给个占位，别在卡片上留一片空白
        desc: desc || '该作品没有描述',
        dianzan: Common.count(statistics?.digg_count),
        pinglun: Common.count(statistics?.comment_count),
        shouchang: Common.count(statistics?.collect_count),
        share: Common.count(statistics?.share_count),
        tuijian: Common.count(statistics?.recommend_count),
        create_time: createTime,
        author_username: author?.nickname ?? '',
        author_avatar: listCardAvatar(author),
        author_douyin_id: listCardDouyinId(author),
        share_url: shareUrl
    };
};
/** 组装 `douyin/favorite-list` 契约要的数据 */
export const buildDouyinFavoritePayload = (options) => {
    const { liker, remark, ...work } = options;
    return {
        ...buildListCardWorkFields(work),
        liker_username: remark || liker?.nickname || '',
        liker_avatar: listCardAvatar(liker),
        liker_douyin_id: listCardDouyinId(liker)
    };
};
/** 组装 `douyin/recommend-list` 契约要的数据 */
export const buildDouyinRecommendPayload = (options) => {
    const { recommender, remark, ...work } = options;
    return {
        ...buildListCardWorkFields(work),
        recommender_username: remark || recommender?.nickname || '',
        recommender_avatar: listCardAvatar(recommender),
        recommender_douyin_id: listCardDouyinId(recommender)
    };
};
