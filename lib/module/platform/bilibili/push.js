import { Base, baseHeaders, Common, Config, downloadFile, mergeFile, Render, uploadFile, Version, processImageUrl } from '../../../module/utils/index.js';
import { createRequire } from 'node:module';
import { bilibiliProcessVideos, cover, generateDecorationCard, getBilibiliDash, getBilibiliPayload, getvideosize, replacetext } from './bilibili.js';
import { buildBilibiliLiveSessionId, parseBilibiliLiveStartedAt } from './live-status.js';
import { buildBilibiliArticleRichText, buildBilibiliRichTextForwardNodes, getUsernameMetadata } from './dynamicText.js';
import { createBilibiliRichTextForwardMessage } from './richtext-message.js';
import { getBilibiliData } from './api.js';
import { buildLivePhotoMessages as buildCommonLivePhotoMessages, buildLivePhotoTipMessage } from '../../../module/platform/common/livePhoto.js';
import { bilibiliDB, cleanOldDynamicCache } from '../../../module/db/index.js';
import common from '../../../runtime/host/common.js';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const fallbackAmagiRuntime = {
    DynamicType: {
        AV: 'DYNAMIC_TYPE_AV',
        DRAW: 'DYNAMIC_TYPE_DRAW',
        WORD: 'DYNAMIC_TYPE_WORD',
        LIVE_RCMD: 'DYNAMIC_TYPE_LIVE_RCMD',
        FORWARD: 'DYNAMIC_TYPE_FORWARD',
        ARTICLE: 'DYNAMIC_TYPE_ARTICLE'
    },
    MajorType: {
        DRAW: 'MAJOR_TYPE_DRAW',
        OPUS: 'MAJOR_TYPE_OPUS',
        LIVE_RCMD: 'MAJOR_TYPE_LIVE_RCMD'
    }
};
const loadAmagiRuntime = () => {
    try {
        return require('@ikenxuan/amagi');
    }
    catch {
        return fallbackAmagiRuntime;
    }
};
const { DynamicType, MajorType } = loadAmagiRuntime();
const asAmagiResponse = (value) => value;
/** 将直播状态接口适配为现有动态推送链路使用的直播推荐项。 */
const createLiveDynamicItem = (sessionId, liveStartedAt, liveInfo, liveStatus) => {
    const content = JSON.stringify({
        live_play_info: {
            area_name: liveInfo.area_name || '',
            cover: liveInfo.user_cover || liveStatus.cover || '',
            online: liveInfo.online || 0,
            room_id: liveInfo.room_id,
            title: liveInfo.title || liveStatus.title || '',
            watched_show: {
                text_large: liveInfo.watched_show?.text_large || `${liveInfo.online || 0}人观看`
            }
        }
    });
    return {
        id_str: sessionId,
        type: DynamicType.LIVE_RCMD,
        modules: {
            module_author: {
                face: '',
                mid: 0,
                name: '',
                pendant: { image: '' },
                pub_ts: Math.floor(Date.parse(liveStartedAt) / 1000)
            },
            module_dynamic: {
                major: {
                    type: MajorType.LIVE_RCMD,
                    live_rcmd: { content }
                },
                topic: null
            },
            module_stat: {
                comment: { count: 0 },
                forward: { count: 0 },
                like: { count: 0 }
            }
        },
        orig: undefined
    };
};
/**
 * @typedef {import('@ikenxuan/amagi').BiliUserDynamic} BiliUserDynamic
 * @typedef {import('@ikenxuan/amagi').BiliUserProfile} BiliUserProfile
 */
/**
 * 下载文件选项
 * @typedef {import('../../utils/Base.js').downloadFileOptions} downloadFileOptions
 */
/**
 * 定义推送列表项的接口
 * @typedef {import('../../utils/Config.js').bilibiliPushItem} bilibiliPushItem
 */
/** 已支持推送的动态类型 */
export { DynamicType };
/**
 * 每个推送项的类型定义
 * @typedef {Object} BilibiliPushItem
 * @property {string} remark - 该UP主的昵称
 * @property {number} host_mid - UP主UID
 * @property {number} create_time - 动态发布时间
 * @property {Array<{groupId: string, botId: string}>} targets - 要推送到的群组和机器人ID
 * @property {BiliUserDynamic['data']['items'][number]} Dynamic_Data - 动态详情信息
 * @property {string} avatar_img - UP主头像url
 * @property {DynamicType} dynamic_type - 动态类型
 */
/**
 * Bilibili基础请求头配置
 * @type {downloadFileOptions['headers']}
 */
const bilibiliBaseHeaders = {
    ...baseHeaders,
    Referer: 'https://api.bilibili.com/',
    Cookie: Config.cookies.bilibili
};
const DEFAULT_BILIBILI_PUSH_TYPES = ['video', 'draw', 'word', 'live', 'forward', 'article'];
const BILIBILI_PUSH_TYPE_LABELS = {
    video: '视频',
    draw: '图文',
    word: '纯文',
    live: '直播',
    forward: '转发',
    article: '专栏'
};
const getBilibiliPushTypeLabel = (type) => {
    switch (type) {
        case 'video': return BILIBILI_PUSH_TYPE_LABELS.video;
        case 'draw': return BILIBILI_PUSH_TYPE_LABELS.draw;
        case 'word': return BILIBILI_PUSH_TYPE_LABELS.word;
        case 'live': return BILIBILI_PUSH_TYPE_LABELS.live;
        case 'forward': return BILIBILI_PUSH_TYPE_LABELS.forward;
        case 'article': return BILIBILI_PUSH_TYPE_LABELS.article;
    }
};
const BILIBILI_PUSH_TYPE_TO_DYNAMIC_TYPE = {
    video: DynamicType.AV,
    draw: DynamicType.DRAW,
    word: DynamicType.WORD,
    live: DynamicType.LIVE_RCMD,
    forward: DynamicType.FORWARD,
    article: DynamicType.ARTICLE
};
const isBilibiliPushType = (value) => (typeof value === 'string' && DEFAULT_BILIBILI_PUSH_TYPES.includes(value));
export const normalizeBilibiliPushTypes = (pushTypes) => {
    if (!Array.isArray(pushTypes) || pushTypes.length === 0)
        return [...DEFAULT_BILIBILI_PUSH_TYPES];
    const result = [];
    for (const type of pushTypes) {
        if (isBilibiliPushType(type) && !result.includes(type))
            result.push(type);
    }
    return result.length > 0 ? result : [...DEFAULT_BILIBILI_PUSH_TYPES];
};
export class Bilibilipush extends Base {
    force = false;
    /**
     * 构造函数
     * @param {*} [e] - 事件对象，定时任务触发时没有事件
     * @param {boolean} [force=false] - 是否强制推送
     */
    constructor(e, force = false) {
        super(e);
        if (this.botadapter === 'QQBot') {
            e?.reply?.('不支持QQBot，请使用其他适配器');
            return;
        }
        this.force = force;
    }
    /**
     * 执行主要的操作流程
     */
    async action() {
        try {
            await this.syncConfigToDatabase();
            this.ensureConfigFields(Config.pushlist.bilibili || []);
            // 清理旧的动态缓存记录
            const deletedCount = await cleanOldDynamicCache('bilibili', 1);
            if (deletedCount > 0) {
                logger.info(`已清理 ${deletedCount} 条过期的B站动态缓存记录`);
            }
            const data = await this.getDynamicList(Config.pushlist.bilibili || []);
            const pushdata = await this.excludeAlreadyPushed(data.willbepushlist);
            if (Object.keys(pushdata).length === 0)
                return true;
            if (this.force) {
                return await this.forcepush(pushdata);
            }
            else {
                return await this.getdata(pushdata);
            }
        }
        catch (error) {
            logger.error(error);
        }
    }
    /**
     * 同步配置文件中的订阅信息到数据库
     */
    async syncConfigToDatabase() {
        // 如果配置文件中没有B站推送列表，直接返回
        if (!Config.pushlist.bilibili || Config.pushlist.bilibili.length === 0) {
            return;
        }
        await bilibiliDB?.syncConfigSubscriptions(Config.pushlist.bilibili);
    }
    /**
     * 补全新版 B站推送字段，保持旧配置可直接运行。
     * @param {bilibiliPushItem[]} pushList 推送配置列表
     */
    ensureConfigFields(pushList) {
        if (!pushList.length)
            return;
        let hasChanges = false;
        for (const item of pushList) {
            const pushTypes = normalizeBilibiliPushTypes(item.pushTypes);
            if (!Array.isArray(item.pushTypes) || item.pushTypes.join(',') !== pushTypes.join(',')) {
                item.pushTypes = pushTypes;
                hasChanges = true;
            }
            if (item.switch === undefined) {
                item.switch = true;
                hasChanges = true;
            }
        }
        if (hasChanges)
            Config.modify('pushlist', 'bilibili', pushList);
    }
    /**
     * @typedef {Record<string, BilibiliPushItem>} WillBePushList
     */
    /**
     * 异步获取数据并根据动态类型处理和发送动态信息。
     * @param {WillBePushList} data - 包含动态相关信息的对象
     * @returns {Promise<boolean>} - 返回处理结果，成功返回true，失败返回false
     */
    async getdata(data) {
        try {
            for (const dynamicId in data) {
                const dynamicItem = data[dynamicId];
                if (!dynamicItem)
                    continue;
                logger.mark(`
        ${logger.blue('开始处理并渲染B站动态图片')}
        ${logger.cyan('UP')}: ${logger.green(dynamicItem.remark)}
        ${logger.cyan('动态id')}：${logger.yellow(dynamicId)}
        ${logger.cyan('访问地址')}：${logger.green('https://t.bilibili.com/' + dynamicId)}`);
                let skip = await skipDynamic(dynamicItem);
                let send_video = true;
                /** @type {import ('@kaguyajs/trss-yunzai-types').icqq.segment[]} */
                let img = [];
                let dycrad;
                let articleForwardPayload = null;
                if (!skip) {
                    const userINFO = asAmagiResponse(await this.amagi.getBilibiliData('用户主页数据', { host_mid: dynamicItem.host_mid, typeMode: 'strict' }));
                    const emojiResponse = asAmagiResponse(await this.amagi.getBilibiliData('Emoji数据'));
                    const emojiDATA = extractEmojisData(emojiResponse?.data?.data?.packages || []);
                    switch (dynamicItem.dynamic_type) {
                        /** 处理图文动态 */
                        case DynamicType.DRAW: {
                            if (dynamicItem.Dynamic_Data.modules.module_dynamic?.topic !== null && dynamicItem.Dynamic_Data.modules.module_dynamic && dynamicItem.Dynamic_Data.modules.module_dynamic.topic !== null) {
                                const name = dynamicItem.Dynamic_Data.modules.module_dynamic.topic?.name;
                                dynamicItem.Dynamic_Data.modules.module_dynamic.major?.opus?.summary?.rich_text_nodes?.unshift({
                                    orig_text: name,
                                    text: name,
                                    type: 'topic',
                                    rid: dynamicItem.Dynamic_Data.modules.module_dynamic.topic?.id?.toString() || ''
                                });
                                if (dynamicItem.Dynamic_Data.modules.module_dynamic.major?.opus?.summary) {
                                    dynamicItem.Dynamic_Data.modules.module_dynamic.major.opus.summary.text = `${name}\n\n` + (dynamicItem.Dynamic_Data.modules.module_dynamic.major?.opus?.summary?.text || '');
                                }
                            }
                            img = await Render('bilibili/dynamic/DYNAMIC_TYPE_DRAW', {
                                image_url: cover(dynamicItem.Dynamic_Data.modules.module_dynamic.major?.opus?.pics ||
                                    dynamicItem.Dynamic_Data.modules.module_dynamic.major?.draw?.items || []),
                                text: replacetext(br(dynamicItem.Dynamic_Data.modules.module_dynamic.major?.opus?.summary?.text || ''), dynamicItem.Dynamic_Data.modules.module_dynamic.major?.opus?.summary?.rich_text_nodes || []),
                                dianzan: Common.count(dynamicItem.Dynamic_Data.modules.module_stat.like.count),
                                pinglun: Common.count(dynamicItem.Dynamic_Data.modules.module_stat.comment.count),
                                share: Common.count(dynamicItem.Dynamic_Data.modules.module_stat.forward.count),
                                create_time: Common.convertTimestampToDateTime(dynamicItem.Dynamic_Data.modules.module_author.pub_ts),
                                avatar_url: dynamicItem.Dynamic_Data.modules.module_author.face,
                                frame: dynamicItem.Dynamic_Data.modules.module_author.pendant.image,
                                share_url: 'https://t.bilibili.com/' + dynamicItem.Dynamic_Data.id_str,
                                username: checkvip(userINFO?.data?.data?.card),
                                fans: Common.count(userINFO?.data?.data?.follower),
                                user_shortid: dynamicItem.host_mid,
                                total_favorited: Common.count(userINFO?.data?.data?.like_num),
                                following_count: Common.count(userINFO?.data?.data?.card?.attention),
                                decoration_card: generateDecorationCard(dynamicItem.Dynamic_Data.modules.module_author?.decoration_card),
                                render_time: Common.getCurrentTime(),
                                dynamicTYPE: '图文动态推送'
                            });
                            break;
                        }
                        /** 处理纯文动态 */
                        case DynamicType.WORD: {
                            let text = replacetext(dynamicItem.Dynamic_Data.modules.module_dynamic.desc?.text || '', dynamicItem.Dynamic_Data.modules.module_dynamic.desc?.rich_text_nodes || []);
                            for (const item of emojiDATA || []) {
                                if (text.includes(item.text)) {
                                    if (text.includes('[') && text.includes(']')) {
                                        text = text.replace(/\[[^\]]*\]/g, `<img src="${item.url}"/>`).replace(/\\/g, '');
                                    }
                                    text += '&#160';
                                }
                            }
                            img = await Render('bilibili/dynamic/DYNAMIC_TYPE_WORD', {
                                text: br(text),
                                dianzan: Common.count(dynamicItem.Dynamic_Data.modules.module_stat.like.count),
                                pinglun: Common.count(dynamicItem.Dynamic_Data.modules.module_stat.comment.count),
                                share: Common.count(dynamicItem.Dynamic_Data.modules.module_stat.forward.count),
                                create_time: Common.convertTimestampToDateTime(dynamicItem.Dynamic_Data.modules.module_author.pub_ts),
                                avatar_url: dynamicItem.Dynamic_Data.modules.module_author.face,
                                frame: dynamicItem.Dynamic_Data.modules.module_author.pendant.image,
                                share_url: 'https://t.bilibili.com/' + dynamicItem.Dynamic_Data.id_str,
                                username: checkvip(userINFO.data.data.card || userINFO.data.data.card),
                                fans: Common.count(userINFO.data.data.follower),
                                user_shortid: dynamicItem.host_mid,
                                total_favorited: Common.count(userINFO.data.data.like_num),
                                following_count: Common.count(userINFO.data.data.card.attention),
                                dynamicTYPE: '纯文动态推送'
                            });
                            break;
                        }
                        /** 处理视频动态 */
                        case DynamicType.AV: {
                            if (dynamicItem.Dynamic_Data.modules.module_dynamic.major?.type === 'MAJOR_TYPE_ARCHIVE') {
                                const bvid = dynamicItem.Dynamic_Data?.modules.module_dynamic.major?.archive?.bvid || '';
                                const INFODATA = asAmagiResponse(await getBilibiliData('单个视频作品数据', '', { bvid, typeMode: 'strict' }));
                                dycrad = INFODATA.data.data;
                                if (INFODATA.data.data.redirect_url) {
                                    send_video = false;
                                    logger.debug(`UP主：${INFODATA.data.data.owner.name} 的该动态类型为${logger.yellow('番剧或影视')}，默认跳过不下载，直达：${logger.green(INFODATA.data.data.redirect_url)}`);
                                }
                                else {
                                    // const noCkData = await getBilibiliData('单个视频下载信息数据', '', { avid: Number(aid), cid: INFODATA.data.data.cid, typeMode: 'strict' })
                                }
                                img = await Render('bilibili/dynamic/DYNAMIC_TYPE_AV', {
                                    image_url: [{ image_src: INFODATA.data.data.pic }],
                                    text: br(INFODATA.data.data.title),
                                    desc: br(dycrad.desc),
                                    dianzan: Common.count(INFODATA.data.data.stat.like),
                                    pinglun: Common.count(INFODATA.data.data.stat.reply),
                                    share: Common.count(INFODATA.data.data.stat.share),
                                    view: Common.count(dycrad.stat.view),
                                    coin: Common.count(dycrad.stat.coin),
                                    duration_text: dynamicItem.Dynamic_Data.modules.module_dynamic.major?.archive?.duration_text || '0:00',
                                    create_time: Common.convertTimestampToDateTime(INFODATA.data.data.ctime),
                                    avatar_url: INFODATA.data.data.owner.face,
                                    frame: dynamicItem.Dynamic_Data.modules.module_author.pendant.image,
                                    share_url: 'https://www.bilibili.com/video/' + bvid,
                                    username: checkvip(userINFO.data.data.card),
                                    fans: Common.count(userINFO.data.data.follower),
                                    user_shortid: dynamicItem.host_mid,
                                    total_favorited: Common.count(userINFO.data.data.like_num),
                                    following_count: Common.count(userINFO.data.data.card.attention),
                                    dynamicTYPE: '视频动态推送'
                                });
                            }
                            break;
                        }
                        /** 处理直播动态 */
                        case DynamicType.LIVE_RCMD: {
                            const liveContent = dynamicItem.Dynamic_Data.modules.module_dynamic.major?.live_rcmd?.content;
                            if (!liveContent) {
                                skip = true;
                                break;
                            }
                            const liveCard = JSON.parse(liveContent);
                            img = await Render('bilibili/dynamic/DYNAMIC_TYPE_LIVE_RCMD', {
                                image_url: [{ image_src: liveCard.live_play_info.cover }],
                                text: br(liveCard.live_play_info.title),
                                liveinf: br(`${liveCard.live_play_info.area_name} | 房间号: ${liveCard.live_play_info.room_id}`),
                                username: checkvip(userINFO.data.data.card),
                                avatar_url: userINFO.data.data.card.face,
                                frame: dynamicItem.Dynamic_Data.modules.module_author.pendant.image,
                                fans: Common.count(userINFO.data.data.follower),
                                create_time: Common.convertTimestampToDateTime(dynamicItem.Dynamic_Data.modules.module_author.pub_ts),
                                now_time: Common.getCurrentTime(),
                                share_url: 'https://live.bilibili.com/' + liveCard.live_play_info.room_id,
                                dynamicTYPE: '直播动态推送'
                            });
                            break;
                        }
                        /** 处理转发动态 */
                        case DynamicType.FORWARD: {
                            const text = replacetext(br(dynamicItem.Dynamic_Data.modules.module_dynamic.desc?.text || ''), dynamicItem.Dynamic_Data.modules.module_dynamic.desc?.rich_text_nodes || []);
                            const originalMajor = dynamicItem.Dynamic_Data.orig.modules.module_dynamic.major;
                            let param = {};
                            switch (dynamicItem.Dynamic_Data.orig.type) {
                                case DynamicType.AV: {
                                    param = {
                                        username: checkvip(dynamicItem.Dynamic_Data.orig.modules.module_author),
                                        pub_action: dynamicItem.Dynamic_Data.orig.modules.module_author.pub_action,
                                        avatar_url: dynamicItem.Dynamic_Data.orig.modules.module_author.face,
                                        duration_text: originalMajor?.archive?.duration_text,
                                        title: originalMajor?.archive?.title,
                                        danmaku: originalMajor?.archive?.stat?.danmaku,
                                        play: originalMajor?.archive?.stat?.play,
                                        cover: originalMajor?.archive?.cover,
                                        create_time: Common.convertTimestampToDateTime(dynamicItem.Dynamic_Data.orig.modules.module_author.pub_ts),
                                        decoration_card: generateDecorationCard(dynamicItem.Dynamic_Data.orig.modules.module_author.decoration_card),
                                        frame: dynamicItem.Dynamic_Data.orig.modules.module_author.pendant.image
                                    };
                                    break;
                                }
                                case DynamicType.DRAW: {
                                    const summary = originalMajor?.opus?.summary;
                                    param = {
                                        username: checkvip(dynamicItem.Dynamic_Data.orig.modules.module_author),
                                        create_time: Common.convertTimestampToDateTime(dynamicItem.Dynamic_Data.orig.modules.module_author.pub_ts),
                                        avatar_url: dynamicItem.Dynamic_Data.orig.modules.module_author.face,
                                        text: replacetext(br(summary?.text || ''), summary?.rich_text_nodes || []),
                                        image_url: cover(originalMajor?.opus?.pics || originalMajor?.draw?.items || []),
                                        decoration_card: generateDecorationCard(dynamicItem.Dynamic_Data.orig.modules.module_author.decoration_card),
                                        frame: dynamicItem.Dynamic_Data.orig.modules.module_author.pendant.image
                                    };
                                    break;
                                }
                                case DynamicType.WORD: {
                                    const summary = originalMajor?.opus?.summary;
                                    param = {
                                        username: checkvip(dynamicItem.Dynamic_Data.orig.modules.module_author),
                                        create_time: Common.convertTimestampToDateTime(dynamicItem.Dynamic_Data.orig.modules.module_author.pub_ts),
                                        avatar_url: dynamicItem.Dynamic_Data.orig.modules.module_author.face,
                                        text: replacetext(br(summary?.text || ''), summary?.rich_text_nodes || []),
                                        decoration_card: generateDecorationCard(dynamicItem.Dynamic_Data.orig.modules.module_author.decoration_card),
                                        frame: dynamicItem.Dynamic_Data.orig.modules.module_author.pendant.image
                                    };
                                    break;
                                }
                                case DynamicType.LIVE_RCMD: {
                                    const liveContent = originalMajor?.live_rcmd?.content;
                                    if (!liveContent) {
                                        logger.warn(`UP主：${dynamicItem.remark}的转发直播动态缺少直播卡片数据`);
                                        break;
                                    }
                                    const liveData = JSON.parse(liveContent);
                                    param = {
                                        username: checkvip(dynamicItem.Dynamic_Data.orig.modules.module_author),
                                        create_time: Common.convertTimestampToDateTime(dynamicItem.Dynamic_Data.orig.modules.module_author.pub_ts),
                                        avatar_url: dynamicItem.Dynamic_Data.orig.modules.module_author.face,
                                        decoration_card: generateDecorationCard(dynamicItem.Dynamic_Data.orig.modules.module_author.decoration_card),
                                        frame: dynamicItem.Dynamic_Data.orig.modules.module_author.pendant.image,
                                        cover: liveData.live_play_info.cover,
                                        text_large: liveData.live_play_info.watched_show.text_large,
                                        area_name: liveData.live_play_info.area_name,
                                        title: liveData.live_play_info.title,
                                        online: liveData.live_play_info.online
                                    };
                                    break;
                                }
                                case DynamicType.FORWARD:
                                default: {
                                    logger.warn(`UP主：${dynamicItem.remark}的${logger.green('转发动态')}转发的原动态类型为「${logger.yellow(dynamicItem.Dynamic_Data.orig.type)}」暂未支持解析`);
                                    break;
                                }
                            }
                            img = await Render('bilibili/dynamic/DYNAMIC_TYPE_FORWARD', {
                                text,
                                dianzan: Common.count(dynamicItem.Dynamic_Data.modules.module_stat.like.count),
                                pinglun: Common.count(dynamicItem.Dynamic_Data.modules.module_stat.comment.count),
                                share: Common.count(dynamicItem.Dynamic_Data.modules.module_stat.forward.count),
                                create_time: dynamicItem.Dynamic_Data.modules.module_author.pub_time,
                                avatar_url: dynamicItem.Dynamic_Data.modules.module_author.face,
                                frame: dynamicItem.Dynamic_Data.modules.module_author.pendant.image,
                                share_url: 'https://t.bilibili.com/' + dynamicItem.Dynamic_Data.id_str,
                                username: checkvip(userINFO.data.data.card),
                                fans: Common.count(userINFO.data.data.follower),
                                user_shortid: dynamicItem.Dynamic_Data.modules.module_author.mid,
                                total_favorited: Common.count(userINFO.data.data.like_num),
                                following_count: Common.count(userINFO.data.data.card.attention),
                                dynamicTYPE: '转发动态推送',
                                decoration_card: generateDecorationCard(dynamicItem.Dynamic_Data.modules.module_author.decorate),
                                render_time: Common.getCurrentTime(),
                                original_content: { [dynamicItem.Dynamic_Data.orig.type]: param }
                            });
                            break;
                        }
                        case DynamicType.ARTICLE: {
                            const articleIdValue = dynamicItem.Dynamic_Data.basic?.rid_str ||
                                dynamicItem.Dynamic_Data.basic?.rid?.toString?.() ||
                                dynamicItem.Dynamic_Data.modules?.module_dynamic?.major?.article?.id?.toString?.();
                            const articleId = articleIdValue ? String(articleIdValue) : '';
                            if (!articleId) {
                                skip = true;
                                logger.warn(`UP主：${dynamicItem.remark} 的专栏动态缺少专栏 ID，跳过推送`);
                                break;
                            }
                            const [articleInfoBaseRaw, articleInfoRaw] = await Promise.all([
                                this.amagi.getBilibiliData('专栏文章基本信息', { id: articleId, typeMode: 'strict' }),
                                this.amagi.getBilibiliData('专栏正文内容', { id: articleId, typeMode: 'strict' })
                            ]);
                            const articleInfoBase = asAmagiResponse(articleInfoBaseRaw);
                            const articleInfo = asAmagiResponse(articleInfoRaw);
                            const articleData = articleInfoBase.data.data;
                            const articleContent = articleInfo.data.data;
                            const title = articleData.title || dynamicItem.Dynamic_Data.modules.module_dynamic?.major?.article?.title || 'B站专栏';
                            const summary = articleData.summary || '';
                            const shareUrl = articleContent.dyn_id_str
                                ? `https://www.bilibili.com/opus/${articleContent.dyn_id_str}`
                                : `https://www.bilibili.com/read/cv${articleContent.id || articleId}`;
                            const body = buildBilibiliArticleRichText(articleContent.opus, articleContent.content, Common.useDarkTheme());
                            const forwardNodes = await buildBilibiliRichTextForwardNodes(body, {
                                title,
                                summary,
                                shareUrl,
                                imageResolver: (url, index) => processImageUrl(url, `${title}图片`, index, {
                                    Referer: 'https://www.bilibili.com/',
                                    Cookie: Config.cookies.bilibili || ''
                                })
                            });
                            articleForwardPayload = { body, forwardNodes, title, summary, shareUrl };
                            const stats = articleData.stats || {};
                            const categories = Array.isArray(articleData.categories)
                                ? articleData.categories.map(item => typeof item === 'string' ? item : item.name).filter(Boolean)
                                : [];
                            img = await Render('bilibili/dynamic/DYNAMIC_TYPE_ARTICLE', {
                                usernameMeta: getUsernameMetadata(userINFO.data.data.card),
                                avatar_url: userINFO.data.data.card.face,
                                frame: dynamicItem.Dynamic_Data.modules.module_author.pendant.image,
                                create_time: dynamicItem.Dynamic_Data.modules.module_author.pub_time ||
                                    Common.convertTimestampToDateTime(dynamicItem.Dynamic_Data.modules.module_author.pub_ts),
                                title,
                                summary,
                                banner_url: articleData.banner_url || articleData.image_urls?.[0] || '',
                                categories,
                                words: articleData.words || 0,
                                body,
                                stats: {
                                    view: stats.view ?? 0,
                                    like: stats.like ?? 0,
                                    favorite: stats.favorite ?? 0,
                                    reply: stats.reply ?? 0,
                                    share: stats.dynamic ?? stats.share ?? 0,
                                    dynamic: stats.dynamic ?? 0,
                                    coin: stats.coin ?? 0
                                },
                                render_time: Common.getCurrentTime(),
                                share_url: shareUrl,
                                dynamicTYPE: '专栏动态推送',
                                user_shortid: userINFO.data.data.card.mid,
                                total_favorited: Common.count(userINFO.data.data.like_num),
                                following_count: Common.count(userINFO.data.data.card.attention),
                                fans: Common.count(userINFO.data.data.follower)
                            });
                            break;
                        }
                        /** 未处理的动态类型 */
                        default: {
                            skip = true;
                            logger.warn(`UP主：${dynamicItem.remark}「${dynamicItem.dynamic_type}」动态类型的暂未支持推送\n动态地址：${'https://t.bilibili.com/' + dynamicItem.Dynamic_Data.id_str}`);
                            break;
                        }
                    }
                }
                // 遍历 targets 数组，并发送消息
                for (const target of dynamicItem.targets) {
                    try {
                        let status;
                        if (!skip) {
                            const { groupId, botId } = target;
                            const group = Bot?.[botId]?.pickGroup(groupId);
                            // 发送消息,如果bot不存在或群组不存在,则默认message_id为1,防止bot上线发一堆消息
                            if (group) {
                                if (dynamicItem.dynamic_type === DynamicType.ARTICLE && articleForwardPayload) {
                                    const forwardMessage = await createBilibiliRichTextForwardMessage(articleForwardPayload.forwardNodes, {
                                        segmentFactory: {
                                            text: value => segment.text?.(value) ?? value,
                                            image: url => segment.image(url)
                                        },
                                        makeForwardMsg: async (messages, title) => {
                                            if (Version.BotName === 'Miao-Yunzai') {
                                                return await Bot.makeForwardMsg(messages.map(message => ({
                                                    user_id: 2854196310,
                                                    message
                                                })));
                                            }
                                            return await common.makeForwardMsg(Bot?.[botId], messages, title);
                                        },
                                        title: '专栏内容'
                                    });
                                    if (forwardMessage)
                                        await group.sendMsg(forwardMessage);
                                }
                                status = img ? await group.sendMsg(img) : { message_id: '1' };
                            }
                            else {
                                logger.warn(`bot${botId}不存在或群${groupId}不存在`);
                                status = { message_id: '1' };
                            }
                            if (Config.bilibili?.push?.parsedynamic) {
                                switch (dynamicItem.dynamic_type) {
                                    case 'DYNAMIC_TYPE_AV': {
                                        if (send_video) {
                                            if (!dycrad)
                                                break;
                                            let videoSize = '';
                                            const playUrlData = await this.amagi.getBilibiliData('单个视频下载信息数据', {
                                                avid: dycrad.aid,
                                                cid: dycrad.cid,
                                                typeMode: 'strict'
                                            });
                                            const playUrlPayload = getBilibiliPayload(playUrlData);
                                            const playUrlDash = getBilibiliDash(playUrlData);
                                            /** 提取出视频流信息对象，并排除清晰度重复的视频流 */
                                            const simplify = (playUrlDash.video || []).filter((/** @type {{id: number}} */ item, /** @type {number} */ index, /** @type {{id: number}[]} */ self) => {
                                                return self.findIndex((/** @type {{id: number}} */ t) => {
                                                    return t.id === item.id;
                                                }) === index;
                                            });
                                            /** 替换原始的视频信息对象 */
                                            playUrlDash.video = simplify;
                                            const correctList = await bilibiliProcessVideos({
                                                accept_description: playUrlPayload.accept_description ?? [],
                                                bvid: dycrad.bvid,
                                                qn: Config.bilibili.push.pushVideoQuality,
                                                maxAutoVideoSize: Config.bilibili.push.pushMaxAutoVideoSize
                                            }, simplify, playUrlDash.audio?.[0]?.base_url || '');
                                            playUrlDash.video = correctList.videoList;
                                            playUrlPayload.accept_description = correctList.accept_description;
                                            /** 获取第一个视频流的大小 */
                                            videoSize = await getvideosize(correctList.videoList?.[0]?.base_url || '', playUrlDash.audio?.[0]?.base_url || '', dycrad.bvid || '');
                                            if ((Config.upload.usefilelimit && Number(videoSize) > Number(Config.upload.filelimit)) && !Config.upload.compress) {
                                                Bot?.[botId]?.pickGroup(groupId) && await Bot?.[botId]?.pickGroup(groupId)?.sendMsg([
                                                    `设定的最大上传大小为 ${Config.upload.filelimit}MB\n当前解析到的视频大小为 ${Number(videoSize)}MB\n视频太大了，还是去B站看吧~`,
                                                    segment.reply(status && typeof status === 'object' && 'message_id' in status
                                                        ? String(status.message_id)
                                                        : '1')
                                                ]);
                                                break;
                                            }
                                            logger.mark(`当前处于自动推送状态，解析到的视频大小为 ${logger.yellow(Number(videoSize))} MB`);
                                            const infoData = asAmagiResponse(await this.amagi.getBilibiliData('单个视频作品数据', { bvid: dycrad.bvid, typeMode: 'strict' }));
                                            const mp4File = await downloadFile(playUrlDash.video?.[0]?.base_url || '', {
                                                title: `Bil_V_${infoData.data.data.bvid}.mp4`,
                                                headers: bilibiliBaseHeaders
                                            });
                                            const mp3File = await downloadFile(playUrlDash.audio?.[0]?.base_url || '', {
                                                title: `Bil_A_${infoData.data.data.bvid}.mp3`,
                                                headers: bilibiliBaseHeaders
                                            });
                                            if (mp4File.filepath && mp3File.filepath) {
                                                await mergeFile('二合一（视频 + 音频）', {
                                                    path: mp4File.filepath,
                                                    path2: mp3File.filepath,
                                                    resultPath: Common.tempDri.video + `Bil_Result_${infoData.data.data.bvid}.mp4`,
                                                    callback: async (/** @type {boolean} */ success, /** @type {string} */ resultPath) => {
                                                        if (success) {
                                                            const filePath = Common.tempDri.video + `tmp_${Date.now()}.mp4`;
                                                            fs.renameSync(resultPath, filePath);
                                                            logger.mark(`视频文件重命名完成: ${resultPath.split('/').pop()} -> ${filePath.split('/').pop()}`);
                                                            logger.mark('正在尝试删除缓存文件');
                                                            await Common.removeFile(mp4File.filepath, true);
                                                            await Common.removeFile(mp3File.filepath, true);
                                                            const stats = fs.statSync(filePath);
                                                            const fileSizeInMB = Number((stats.size / (1024 * 1024)).toFixed(2));
                                                            if (fileSizeInMB > (Config.upload?.groupfilevalue || 100)) {
                                                                // 使用文件上传
                                                                return await uploadFile(this.e ?? {}, { filepath: filePath, totalBytes: fileSizeInMB, originTitle: `${infoData.data.data.desc.substring(0, 50).replace(/[\\/:\\*\\?"<>\\|\r\n\s]/g, ' ')}` }, '', { useGroupFile: true, active: true, activeOption: { group_id: groupId, uin: botId } });
                                                            }
                                                            else {
                                                                /** 因为本地合成，没有视频直链 */
                                                                return await uploadFile(this.e ?? {}, { filepath: filePath, totalBytes: fileSizeInMB }, '', { active: true, activeOption: { group_id: groupId, uin: botId } });
                                                            }
                                                        }
                                                        else {
                                                            await Common.removeFile(mp4File.filepath, true);
                                                            await Common.removeFile(mp3File.filepath, true);
                                                            return true;
                                                        }
                                                    }
                                                });
                                            }
                                        }
                                        break;
                                    }
                                    case 'DYNAMIC_TYPE_DRAW': {
                                        /** @type {import ('@kaguyajs/trss-yunzai-types').icqq.segment[]} */
                                        const imgArray = [];
                                        const tempFiles = [];
                                        let hasGeneratedLivePhoto = false;
                                        const images = (dynamicItem.Dynamic_Data.modules.module_dynamic?.major &&
                                            dynamicItem.Dynamic_Data.modules.module_dynamic?.major?.draw?.items) || dynamicItem.Dynamic_Data.modules.module_dynamic?.major?.opus?.pics || [];
                                        try {
                                            for (const [imageIndex, img2] of images.entries()) {
                                                const imageSrc = img2.src ?? img2.url;
                                                if (!imageSrc)
                                                    continue;
                                                if (img2.live_url) {
                                                    const livePhoto = await buildCommonLivePhotoMessages({
                                                        platform: 'bilibili',
                                                        staticUrl: imageSrc,
                                                        liveVideoUrl: img2.live_url,
                                                        index: imageIndex,
                                                        headers: {
                                                            ...bilibiliBaseHeaders,
                                                            Referer: 'https://www.bilibili.com/'
                                                        }
                                                    });
                                                    tempFiles.push(...livePhoto.tempFiles);
                                                    hasGeneratedLivePhoto = hasGeneratedLivePhoto || livePhoto.generatedLivePhoto;
                                                    if (livePhoto.messages.length > 0) {
                                                        imgArray.push(...livePhoto.messages);
                                                        continue;
                                                    }
                                                }
                                                const imageUrl = await processImageUrl(imageSrc, dynamicItem.remark || 'B站动态图片', imageIndex, bilibiliBaseHeaders);
                                                imgArray.push(segment.image(imageUrl));
                                            }
                                            if (hasGeneratedLivePhoto)
                                                imgArray.push(await buildLivePhotoTipMessage());
                                        }
                                        finally {
                                            for (const item of tempFiles) {
                                                if (item?.filepath)
                                                    await Common.removeFile(item.filepath, true);
                                            }
                                        }
                                        if (!imgArray.length)
                                            return false;
                                        const forwardMsg = Version.BotName === 'Miao-Yunzai'
                                            ? Bot?.makeForwardMsg(imgArray.map(img => ({
                                                user_id: 2854196310,
                                                message: img
                                            })))
                                            : common?.makeForwardMsg(Bot?.[botId], imgArray, '动态图片');
                                        // 如果bot不存在或群组不存在,则默认message_id为1,防止bot上线发一堆消息
                                        if (Bot?.[botId]?.pickGroup(groupId) && forwardMsg) {
                                            await Bot[botId].pickGroup(groupId).sendMsg(forwardMsg);
                                        }
                                        else {
                                            logger.warn(`bot${botId}不存在或群${groupId}不存在`);
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    catch (e) {
                        logger.error(e);
                    }
                    finally {
                        // 无论推送是否成功，都添加动态缓存以防止重复推送
                        // 这确保即使在消息发送失败或跳过的情况下，也不会在下次运行时重复推送相同的动态
                        await bilibiliDB?.addDynamicCache(dynamicId, dynamicItem.host_mid, target.groupId, dynamicItem.dynamic_type);
                    }
                }
            }
        }
        catch (e) {
            logger.error('推送动态列表失败', e);
            return false;
        }
        return true;
    }
    /**
     * 根据配置文件获取UP当天的动态列表。
     * @param {bilibiliPushItem[]} userList - 用户列表
     * @returns {Promise<{willbepushlist: WillBePushList}>}
     */
    async getDirectLivePushItems(userList) {
        const handledUids = new Set();
        const willBePushList = {};
        const liveSubscriptions = userList.filter(item => (item.switch !== false && normalizeBilibiliPushTypes(item.pushTypes).includes('live')));
        for (const item of liveSubscriptions) {
            let liveStatus;
            try {
                const response = asAmagiResponse(await this.amagi.getBilibiliData('用户直播状态', {
                    host_mid: item.host_mid,
                    typeMode: 'strict'
                }));
                liveStatus = response.data.data;
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                logger.warn(`[Bilibili 推送] UP主 ${item.remark || item.host_mid}（${item.host_mid}）直播状态直查失败，本轮回退到直播动态检测：${message}`);
                continue;
            }
            if (liveStatus.roomStatus !== 1 || liveStatus.liveStatus !== 1 || liveStatus.roomid <= 0) {
                handledUids.add(item.host_mid);
                continue;
            }
            try {
                const response = asAmagiResponse(await this.amagi.getBilibiliData('直播间信息', {
                    room_id: String(liveStatus.roomid),
                    typeMode: 'strict'
                }));
                const liveInfo = response.data.data;
                /** 两个直播接口状态不一致时，以直播间详情为准。 */
                if (liveInfo.live_status !== 1) {
                    handledUids.add(item.host_mid);
                    continue;
                }
                const sessionId = buildBilibiliLiveSessionId(item.host_mid, liveInfo.room_id, liveInfo.live_time);
                const liveStartedAt = parseBilibiliLiveStartedAt(liveInfo.live_time);
                if (!sessionId || !liveStartedAt) {
                    throw new Error(`直播间 ${liveInfo.room_id} 未返回可用于场次去重的开播时间`);
                }
                const dynamic = createLiveDynamicItem(sessionId, liveStartedAt, liveInfo, liveStatus);
                willBePushList[sessionId] = {
                    remark: item.remark || String(item.host_mid),
                    host_mid: item.host_mid,
                    create_time: dynamic.modules.module_author.pub_ts,
                    targets: item.group_id.map(groupWithBot => {
                        const [groupId, botId] = groupWithBot.split(':');
                        return { groupId: groupId || '', botId: botId || '' };
                    }),
                    Dynamic_Data: dynamic,
                    avatar_img: '',
                    dynamic_type: DynamicType.LIVE_RCMD
                };
                handledUids.add(item.host_mid);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                logger.warn(`[Bilibili 推送] UP主 ${item.remark || item.host_mid}（${item.host_mid}）直播场次信息不完整，本轮回退到直播动态检测：${message}`);
            }
        }
        return { handledUids, willBePushList };
    }
    /** 为动态列表降级路径生成与直播状态直查一致的场次缓存键。 */
    async resolveLiveDynamicCacheId(dynamic, hostMid) {
        try {
            const content = dynamic.modules.module_dynamic.major?.live_rcmd?.content;
            if (!content)
                return dynamic.id_str;
            const liveData = JSON.parse(content);
            const roomId = Number(liveData.live_play_info.room_id);
            if (!Number.isFinite(roomId) || roomId <= 0)
                return dynamic.id_str;
            const response = asAmagiResponse(await this.amagi.getBilibiliData('直播间信息', {
                room_id: String(roomId),
                typeMode: 'strict'
            }));
            const liveInfo = response.data.data;
            return buildBilibiliLiveSessionId(hostMid, liveInfo.room_id, liveInfo.live_time) || dynamic.id_str;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn(`[Bilibili 推送] 直播动态 ${dynamic.id_str} 无法解析统一场次键，将使用动态ID去重：${message}`);
            return dynamic.id_str;
        }
    }
    async getDynamicList(userList) {
        const directLiveItems = await this.getDirectLivePushItems(userList);
        /** @type {WillBePushList} */
        const willbepushlist = { ...directLiveItems.willBePushList };
        try {
            /** 过滤掉不启用的订阅项 */
            const filteredUserList = userList.filter(item => item.switch !== false);
            for (const item of filteredUserList) {
                const pushTypes = normalizeBilibiliPushTypes(item.pushTypes);
                const allowedDynamicTypes = new Set(pushTypes.map(type => BILIBILI_PUSH_TYPE_TO_DYNAMIC_TYPE[type]));
                if (directLiveItems.handledUids.has(item.host_mid)) {
                    allowedDynamicTypes.delete(DynamicType.LIVE_RCMD);
                }
                if (allowedDynamicTypes.size === 0)
                    continue;
                logger.debug(`[Bilibili 推送] 开始获取UP: ${item.remark}（${item.host_mid}） 的动态列表，推送类型：${pushTypes.join(', ')}`);
                const dynamic_list = asAmagiResponse(await this.amagi.getBilibiliData('用户主页动态列表数据', { host_mid: item.host_mid, typeMode: 'strict' }));
                if (dynamic_list.data.data.items.length > 0) {
                    // 遍历接口返回的视频列表
                    for (const dynamic of dynamic_list.data.data.items) {
                        const now = Date.now();
                        // 获取动态发布时间戳(毫秒)
                        const createTime = dynamic.modules.module_author.pub_ts * 1000;
                        const timeDifference = (now - createTime);
                        const is_top = dynamic.modules.module_tag?.text === '置顶'; // 是否为置顶
                        let shouldPush = false; // 是否列入推送数组
                        const timeDiffSeconds = Math.round(timeDifference / 1000);
                        const timeDiffHours = Math.round((timeDifference / 1000 / 60 / 60) * 100) / 100; // 保留2位小数
                        // 条件判断，以下任何一项成立都将进行推送：如果是置顶且发布时间在一天内 || 如果是置顶作品且有新的群组且发布时间在一天内 || 如果有新的群组且发布时间在一天内
                        logger.debug(`
              前期获取该动态基本信息：
              UP主：${dynamic.modules.module_author.name}
              动态ID：${dynamic.id_str}
              发布时间：${Common.convertTimestampToDateTime(createTime / 1000)}
              发布时间戳（ms）：${createTime}
              当前时间戳（ms）：${now}
              时间差（ms）：${timeDifference} ms (${timeDiffSeconds}s) (${timeDiffHours}h)
              是否置顶：${is_top}
              是否在一天内：${timeDifference < 86400000 ? logger.green('true') : logger.red('false')}
              `);
                        if ((is_top && timeDifference < 86400000) || (timeDifference < 86400000)) {
                            shouldPush = true;
                            logger.debug(logger.green(`根据以上判断，shoulPush 为 true，将对该动态纳入当天推送列表：https://t.bilibili.com/${dynamic.id_str}\n`));
                        }
                        else {
                            logger.debug(logger.yellow(`根据以上判断，shoulPush 为 false，跳过该动态：https://t.bilibili.com/${dynamic.id_str}\n`));
                        }
                        // 如果 shouldPush 为 true，或该作品距现在的时间差小于一天，则将该动态添加到 willbepushlist 中
                        if (timeDifference < 86400000 || shouldPush) {
                            if (!allowedDynamicTypes.has(dynamic.type)) {
                                logger.debug(`UP主 ${item.remark || item.host_mid} 的动态 ${dynamic.id_str} 类型为「${dynamic.type}」，不在推送类型配置中，跳过`);
                                continue;
                            }
                            // 将群组ID和机器人ID分离
                            const targets = item.group_id.map(groupWithBot => {
                                const [groupId, botId] = groupWithBot.split(':');
                                return { groupId: groupId || '', botId: botId || '' };
                            });
                            const pushId = dynamic.type === DynamicType.LIVE_RCMD
                                ? await this.resolveLiveDynamicCacheId(dynamic, item.host_mid)
                                : dynamic.id_str;
                            // 确保 willbepushlist[pushId] 是一个对象
                            if (!willbepushlist[pushId]) {
                                willbepushlist[pushId] = {
                                    remark: item?.remark || dynamic.modules.module_author.name,
                                    host_mid: item.host_mid,
                                    create_time: dynamic.modules.module_author.pub_ts,
                                    targets,
                                    Dynamic_Data: dynamic, // 存储 dynamic 对象
                                    avatar_img: dynamic.modules.module_author.face,
                                    dynamic_type: dynamic.type
                                };
                            }
                        }
                    }
                }
                else {
                    logger.error(`「${item.remark}」的动态列表数量为零！`);
                }
            }
        }
        catch (error) {
            logger.error(error);
        }
        return { willbepushlist };
    }
    /**
     * 排除已推送过的群组并返回更新后的推送列表
     * @param {WillBePushList} willBePushList - 将要推送的列表
     * @returns {Promise<WillBePushList>} 更新后的推送列表
     */
    async excludeAlreadyPushed(willBePushList) {
        // 遍历推送列表中的作品ID
        for (const dynamicId in willBePushList) {
            const pushItem = willBePushList[dynamicId];
            if (!pushItem)
                continue;
            const newTargets = [];
            // 遍历作品对应的目标群组
            for (const target of pushItem.targets) {
                // 检查该动态是否已经推送给该群组
                const isPushed = await bilibiliDB?.isDynamicPushed(dynamicId, pushItem.host_mid, target.groupId);
                // 如果未被推送过，则保留此目标
                if (!isPushed) {
                    newTargets.push(target);
                }
            }
            // 更新作品的目标数组
            if (newTargets.length > 0) {
                pushItem.targets = newTargets;
            }
            else {
                // 如果没有剩余目标，移除该作品
                delete willBePushList[dynamicId];
            }
        }
        return willBePushList;
    }
    /**
     * 设置或更新特定 host_mid 的群组信息。
     * @param {BiliUserProfile} data - 包含 card 对象
     * @returns {Promise<void>}
     */
    async setting(data) {
        const event = this.e;
        if (!event)
            return;
        const host_mid = Number(data.data.card.mid);
        const config = Config.pushlist; // 读取配置文件
        const groupId = String(event.group_id ?? '');
        const botId = String(event.self_id ?? '');
        // 初始化或确保 bilibilipushlist 数组存在
        config.bilibili = config.bilibili || [];
        // 检查是否存在相同的 host_mid
        const existingItem = config.bilibili.find((item) => item.host_mid === host_mid);
        // 检查该群组是否已订阅该UP主
        const isSubscribed = await bilibiliDB?.isSubscribed(host_mid, groupId);
        if (existingItem) {
            // 使用 findIndex 替代循环，提高查找效率
            const groupIndex = existingItem.group_id.findIndex(item => {
                const existingGroupId = item?.split(':')[0] || '';
                return existingGroupId === String(groupId);
            });
            if (groupIndex >= 0) {
                // 删除订阅
                existingItem.group_id.splice(groupIndex, 1);
                // 顺序执行数据库操作和消息发送
                if (isSubscribed) {
                    await bilibiliDB?.unsubscribeBilibiliUser(groupId, host_mid);
                }
                await event.reply?.(`群：${event.group_name ?? ''}(${groupId})\n删除成功！${data.data.card.name}\nUID：${host_mid}`);
                // 如果删除后 group_id 数组为空，则删除整个属性
                if (existingItem.group_id.length === 0) {
                    const index = config.bilibili.indexOf(existingItem);
                    config.bilibili.splice(index, 1);
                }
            }
            else {
                // 顺序执行数据库操作和消息发送
                await bilibiliDB?.subscribeBilibiliUser(groupId, botId, host_mid, data.data.card.name);
                await event.reply?.(`群：${event.group_name ?? ''}(${groupId})\n添加成功！${data.data.card.name}\nUID：${host_mid}`);
                // 检查推送状态
                if (Config.bilibili?.push?.switch === false) {
                    await event.reply?.('请发送「#kkk设置B站推送开启」以进行推送');
                }
                existingItem.group_id.push(`${groupId}:${botId}`);
                existingItem.pushTypes = normalizeBilibiliPushTypes(existingItem.pushTypes);
            }
        }
        else {
            // 顺序执行数据库操作和消息发送
            await bilibiliDB?.subscribeBilibiliUser(groupId, botId, host_mid, data.data.card.name);
            await event.reply?.(`群：${event.group_name ?? ''}(${groupId})\n添加成功！${data.data.card.name}\nUID：${host_mid}`);
            // 检查推送状态
            if (Config.bilibili?.push?.switch === false) {
                await event.reply?.('请发送「#kkk设置B站推送开启」以进行推送');
            }
            // 不存在相同的 host_mid，新增一个配置项
            config.bilibili.push({
                switch: true,
                host_mid,
                group_id: [`${groupId}:${botId}`],
                remark: data.data.card.name,
                pushTypes: [...DEFAULT_BILIBILI_PUSH_TYPES]
            });
        }
        // 顺序执行配置保存和渲染操作
        if (config.bilibili) {
            Config.modify('pushlist', 'bilibili', config.bilibili);
        }
        await this.renderPushList();
    }
    /**
     * 检查并更新配置文件中指定用户的备注信息。
     * 该函数会遍历配置文件中的用户列表，对于没有备注或备注为空的用户，会从外部数据源获取其备注信息，并更新到配置文件中。
     */
    async checkremark() {
        // 读取配置文件内容
        /** @type {import('../../utils/Config.js').PushlistConfig} */
        const config = Config.pushlist;
        const abclist = [];
        if (!Config.pushlist.bilibili || Config.pushlist.bilibili.length === 0)
            return true;
        // 遍历配置文件中的用户列表，收集需要更新备注信息的用户
        for (const i of Config.pushlist.bilibili) {
            const remark = i.remark;
            const group_id = i.group_id;
            const host_mid = i.host_mid;
            if (remark === undefined || remark === '') {
                abclist.push({ host_mid, group_id });
            }
        }
        // 如果有需要更新备注的用户，则逐个获取备注信息并更新到配置文件中
        if (abclist.length > 0) {
            for (const i of abclist) {
                // 从外部数据源获取用户备注信息
                const resp = asAmagiResponse(await this.amagi.getBilibiliData('用户主页数据', { host_mid: i.host_mid, typeMode: 'strict' }));
                const remark = resp.data.data.card.name;
                // 在配置文件中找到对应的用户，并更新其备注信息
                const matchingItemIndex = config.bilibili?.findIndex(item => item.host_mid === i.host_mid) || 0;
                if (matchingItemIndex !== -1 && config.bilibili && config.bilibili[matchingItemIndex]) {
                    config.bilibili[matchingItemIndex].remark = remark;
                }
            }
            // 将更新后的配置文件内容写回文件
            if (config.bilibili) {
                Config.modify('pushlist', 'bilibili', config.bilibili);
            }
        }
        return true;
    }
    /**
     * 强制推送
     * @param {WillBePushList} data - 处理完成的推送列表
     */
    async forcepush(data) {
        const event = this.e;
        if (!event)
            return;
        const currentGroupId = String(event.group_id || event.groupId || '');
        const currentBotId = String(event.self_id || event.selfId || '');
        // 如果不是全部强制推送，需要过滤数据
        if (!(event.msg ?? '').includes('全部')) {
            // 获取当前群组订阅的所有UP主
            const subscriptions = await bilibiliDB?.getGroupSubscriptions(currentGroupId);
            const subscribedUids = subscriptions?.map(sub => sub.host_mid) || [];
            /** 创建一个新的推送列表，只包含当前群组订阅的UP主的动态 */
            const filteredData = {};
            for (const dynamicId in data) {
                const item = data[dynamicId];
                // 检查该动态的UP主是否被当前群组订阅
                if (item && subscribedUids.includes(item.host_mid)) {
                    // 复制该动态到过滤后的列表，并将目标设置为当前群组
                    filteredData[dynamicId] = {
                        ...item,
                        targets: [{
                                groupId: currentGroupId,
                                botId: currentBotId
                            }]
                    };
                }
            }
            // 使用过滤后的数据进行推送
            await this.getdata(filteredData);
        }
        else {
            // 全部强制推送，保持原有逻辑
            await this.getdata(data);
        }
    }
    /** 渲染推送列表图片 */
    async renderPushList() {
        const event = this.e;
        if (!event)
            return;
        await this.syncConfigToDatabase();
        // 获取当前群组的所有订阅
        const subscriptions = await bilibiliDB?.getGroupSubscriptions(String(event.group_id ?? ''));
        if (!subscriptions || subscriptions.length === 0) {
            await event.reply?.(`当前群：${event.group_name ?? ''}(${event.group_id ?? ''})\n没有设置任何B站UP推送！\n可使用「#设置B站推送 + UP主UID」进行设置`);
            return;
        }
        /** 用户的今日动态列表 */
        const renderOpt = [];
        // 获取所有订阅UP主的信息
        for (const subscription of subscriptions) {
            const host_mid = subscription.host_mid;
            const userInfo = asAmagiResponse(await this.amagi.getBilibiliData('用户主页数据', { host_mid, typeMode: 'strict' }));
            const configItem = Config.pushlist.bilibili?.find(item => item.host_mid === host_mid);
            renderOpt.push({
                avatar_img: userInfo.data.data.card.face,
                username: userInfo.data.data.card.name,
                host_mid: userInfo.data.data.card.mid,
                fans: Common.count(userInfo.data.data.follower),
                total_favorited: Common.count(userInfo.data.data.like_num),
                following_count: Common.count(userInfo.data.data.card.attention),
                pushTypes: normalizeBilibiliPushTypes(configItem?.pushTypes).map(type => getBilibiliPushTypeLabel(type)).join(' / ')
            });
        }
        const img = await Render('bilibili/userlist', { renderOpt });
        await event.reply?.(img);
    }
}
/**
 * 将换行符替换为HTML的<br>标签。
 * @param {string} data - 需要进行换行符替换的字符串
 * @returns {string} 替换后的字符串，其中的换行符\n被<br>替换
 */
function br(data) {
    // 使用正则表达式将所有换行符替换为<br>
    return (data = data.replace(/\n/g, '<br>'));
}
/**
 * 检查成员是否为VIP，并根据VIP状态改变其显示颜色。
 * @param {BiliUserProfile['data']['card'] | BiliUserDynamic['data']['items'][number]['orig']['modules']['module_author']} member - 成员对象，需要包含vip属性，该属性应包含vipStatus和nickname_color（可选）
 * @returns {string} 返回成员名称的HTML标签字符串，VIP成员将显示为特定颜色，非VIP成员显示为默认颜色
 */
function checkvip(member) {
    // 根据VIP状态选择不同的颜色显示成员名称
    if (!member)
        return '';
    return member?.vip?.status === 1
        ? `<span style="color: ${member.vip.nickname_color || '#FB7299'}; font-weight: 700;">${member.name}</span>`
        : `<span style="color: ${Common.useDarkTheme() ? '#EDEDED' : '#606060'}">${member.name}</span>`;
}
/**
 * 处理并提取表情数据，返回一个包含表情名称和URL的对象数组。
 * @param {unknown[]} data - 表情数据的数组，每个元素包含一个表情包的信息
 * @returns {Array<{text: string, url: string}>} 返回一个对象数组，每个对象包含text(表情名称)和url(表情图片地址)属性
 */
export const extractEmojisData = (data) => {
    if (!Array.isArray(data))
        return [];
    const emojis = [];
    for (const paragraph of data) {
        if (typeof paragraph !== 'object' || paragraph === null || !('emote' in paragraph) || !Array.isArray(paragraph.emote))
            continue;
        for (const emoji of paragraph.emote) {
            if (typeof emoji !== 'object' || emoji === null || !('text' in emoji) || !('url' in emoji))
                continue;
            if (emoji.text && emoji.url)
                emojis.push({ text: String(emoji.text), url: String(emoji.url) });
        }
    }
    return emojis;
};
/**
 * 判断标题是否有屏蔽词或屏蔽标签
 * @param {BilibiliPushItem} PushItem - 推送项
 * @returns {Promise<boolean>} 是否应该跳过推送
 */
export const skipDynamic = async (PushItem) => {
    const tags = [];
    // 提取标签
    const moduleDynamic = PushItem.Dynamic_Data.modules?.module_dynamic;
    if (moduleDynamic?.desc?.rich_text_nodes) {
        for (const node of moduleDynamic.desc.rich_text_nodes) {
            if (node.type === 'topic') {
                if (node.orig_text) {
                    tags.push(node.orig_text);
                }
            }
        }
    }
    // 检查转发的原动态标签
    const originalMajor = PushItem.Dynamic_Data.orig?.modules?.module_dynamic?.major;
    if (PushItem.Dynamic_Data.type === DynamicType.FORWARD && originalMajor) {
        const majorType = 'type' in originalMajor ? originalMajor.type : undefined;
        if (majorType === MajorType.DRAW ||
            majorType === MajorType.OPUS ||
            majorType === MajorType.LIVE_RCMD) {
            for (const node of originalMajor.opus?.summary?.rich_text_nodes ?? []) {
                if (node.type === 'topic' && node.orig_text) {
                    tags.push(node.orig_text);
                }
            }
        }
    }
    logger.debug(`检查动态是否需要过滤：https://t.bilibili.com/${PushItem.Dynamic_Data.id_str}`);
    const shouldFilter = await bilibiliDB?.shouldFilter(PushItem, tags);
    return Boolean(shouldFilter);
};
