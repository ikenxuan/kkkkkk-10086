import { Base, baseHeaders, Networks, Render, Config, Common, downloadFile, downloadVideo, Version, processImageUrl } from '../../../module/utils/index.js';
import { cleanOldDynamicCache, douyinDB } from '../../../module/db/index.js';
import { getDouyinID, douyinProcessVideos, pickDouyinPlayUrl } from './index.js';
import { buildAmagiRequestConfig, douyinFetcher } from '../../../module/utils/amagiClient.js';
import { buildLivePhotoMessagesBatch, buildLivePhotoTipMessage } from '../../../module/platform/common/livePhoto.js';
import { withDownloadBucket } from '../../../module/utils/Network/DownloadBudget.js';
import { buildPushListGroupInfo, matchesGroup } from '../../../module/platform/common/pushList.js';
import { buildDouyinFavoritePayload, buildDouyinRecommendPayload } from './listCard.js';
import { buildDouyinLivePayload } from './live.js';
import { getDouyinLiveVideoUrl, getDouyinWorkCoverUrl, isDouyinArticle, isDouyinImage, isDouyinVideo } from './workType.js';
import common from '../../../runtime/host/common.js';
import { getErrorMessage } from '../../../module/utils/error-message.js';
import { at, isRecord } from '../../../module/utils/record.js';
/**
 * @typedef {import('@ikenxuan/amagi').ApiResponse} ApiResponse
 * @typedef {import('@ikenxuan/amagi').DySearchInfo} DySearchInfo
 * @typedef {import('@ikenxuan/amagi').DyUserInfo} DyUserInfo
 * @typedef {import('@ikenxuan/amagi').DyUserLiveVideos} DyUserLiveVideos
 */
/**
 * 下载文件选项
 * @typedef {import('../../utils/Base.js').downloadFileOptions} downloadFileOptions
 */
/**
 * 定义推送列表项的接口
 * @typedef {import('../../utils/Config.js').douyinPushItem} douyinPushItem
 */
/**
 * 抖音基础请求头配置
 * @type {downloadFileOptions['headers']}
 */
const douyinBaseHeaders = {
    ...baseHeaders,
    Referer: 'https://www.douyin.com',
    Cookie: Config.cookies.douyin
};
const DEFAULT_DOUYIN_PUSH_TYPES = ['post', 'live'];
const DOUYIN_PUSH_TYPE_LABELS = {
    post: '作品列表',
    favorite: '喜欢列表',
    recommend: '推荐列表',
    live: '直播'
};
/** 逐个字面量比较，等价于旧实现的 VALID_DOUYIN_PUSH_TYPES.includes() */
const isDouyinPushType = (value) => value === 'post' || value === 'favorite' || value === 'recommend' || value === 'live';
/**
 * 非数组、空数组、以及全部非法的情况都回退到默认值；返回的始终是新数组，
 * 调用方改动结果不会污染默认值。
 */
export const normalizePushTypes = (pushTypes) => {
    if (!Array.isArray(pushTypes) || pushTypes.length === 0)
        return [...DEFAULT_DOUYIN_PUSH_TYPES];
    const result = [];
    for (const type of pushTypes) {
        if (isDouyinPushType(type) && !result.includes(type))
            result.push(type);
    }
    return result.length > 0 ? result : [...DEFAULT_DOUYIN_PUSH_TYPES];
};
/** 取背景音乐播放地址，优先直链，其次 extra 里的原曲地址 */
export const getDouyinMusicUrl = (music) => {
    if (!music)
        return '';
    if (music.play_url?.uri)
        return music.play_url.uri;
    try {
        const extra = JSON.parse(music.extra || '{}');
        const originalSongUrl = isRecord(extra) ? extra.original_song_url : undefined;
        return typeof originalSongUrl === 'string' ? originalSongUrl : '';
    }
    catch {
        return '';
    }
};
/**
 * 取 Live 图的视频地址。
 *
 * 实现在 `workType.ts`，这里只做 re-export 保持既有导入路径 ——
 * 之前这里和 `douyin.ts` 各有一份自己拼 snssdk 地址的副本，两份都会踩同样的坑。
 */
export { getDouyinLiveVideoUrl };
export class DouYinpush extends Base {
    /** 是否强制推送（忽略已推送记录） */
    force = false;
    /**
     * @param e 事件对象，定时任务触发时没有事件
     * @param force 是否强制推送
     */
    constructor(e, force = false) {
        super(e);
        // 这里原来直接拦掉 QQBot：`if (this.botadapter === 'QQBot') { reply('不支持QQBot'); return }`。
        // QQBot 开启全量消息后主动推送不再受限，所以这道拦截去掉。
        //
        // 顺带说明原来那段还有个坑：它是在构造函数里 `return`，对象照样被造出来，
        // 只是漏掉了 `this.force = force` —— 调用方拿到的是一个「看着正常但 force 恒为 false」
        // 的实例，然后继续往下跑。
        this.force = force;
    }
    /**
     * 整段包在 `withDownloadBucket()` 里，是因为主动推送**不走** `runCoordinatedParse`，
     * 于是 ParseCoordinator 铺的下载桶上下文在这条路上是空的 —— 不套的话这一轮推送里
     * 所有下载都会落到 default 兜底桶，和别的平台抢同一份额度。
     */
    async action() {
        return await withDownloadBucket('douyin', async () => {
            try {
                await this.syncConfigToDatabase();
                const deletedCount = await cleanOldDynamicCache('douyin', 1);
                if (deletedCount > 0) {
                    logger.info(`已清理 ${deletedCount} 条过期的抖音作品缓存记录`);
                }
                await this.ensureConfigFields(Config.pushlist.douyin || []);
                if (await this.checkremark())
                    return true;
                const data = await this.getDynamicList(Config.pushlist.douyin || []);
                if (Object.keys(data).length === 0)
                    return true;
                if (this.force)
                    return await this.forcepush(data);
                else
                    return await this.getdata(data);
            }
            catch (error) {
                logger.error(error);
            }
        });
    }
    async syncConfigToDatabase() {
        if (!Config.pushlist.douyin || Config.pushlist.douyin.length === 0) {
            return;
        }
        await douyinDB?.syncConfigSubscriptions(Config.pushlist.douyin);
    }
    /**
     * 补全新版推送字段，保持旧配置可直接运行。
     *
     * 分两段：先把要联网的搜索做完，再一次性同步落盘。之前是边 await 边原地改
     * `Config.pushlist.douyin`（那时候拿到的就是缓存原件），最后整份数组覆盖写 ——
     * 这个方法每个推送周期都跑，中间任意一次超时都会留下「内存改了、磁盘没改」的状态。
     *
     * @param {douyinPushItem[]} pushList 推送配置列表，只用来决定要查哪些短号
     */
    async ensureConfigFields(pushList) {
        if (!pushList.length)
            return;
        // 联网阶段：老配置只有抖音号没有 sec_uid，得走搜索接口换。
        // 结果先攒在 map 里，落盘那一步才能保持同步、中间没有 await 的余地。
        const resolved = new Map();
        for (const item of pushList) {
            if (item.sec_uid || !item.short_id)
                continue;
            try {
                const searchResult = await this.amagi.douyin.searchContent({
                    query: item.short_id,
                    type: 'user',
                    typeMode: 'strict'
                }, Config.cookies.douyin, buildAmagiRequestConfig());
                const users = this.getSearchUsers(searchResult);
                const matchedUser = users.find(userItem => {
                    const user = userItem.user_info || userItem;
                    return [user.unique_id, user.short_id].filter(Boolean).includes(item.short_id);
                }) || users[0];
                const user = matchedUser?.user_info || matchedUser;
                if (user?.sec_uid) {
                    resolved.set(item.short_id, { sec_uid: user.sec_uid, nickname: user.nickname });
                    logger.info(`已为 ${item.remark || item.short_id} 补全 sec_uid: ${user.sec_uid}`);
                }
            }
            catch (error) {
                logger.warn(`自动补全 ${item.short_id} 的 sec_uid 失败: ${error}`);
            }
        }
        Config.update('pushlist', 'douyin', (current) => {
            const list = Array.isArray(current) ? current : [];
            let hasChanges = false;
            for (const item of list) {
                if (!item.sec_uid && item.short_id) {
                    const found = resolved.get(item.short_id);
                    if (found) {
                        item.sec_uid = found.sec_uid;
                        item.remark ||= found.nickname;
                        hasChanges = true;
                    }
                }
                const pushTypes = normalizePushTypes(item.pushTypes);
                if (!Array.isArray(item.pushTypes) || item.pushTypes.join(',') !== pushTypes.join(',')) {
                    item.pushTypes = pushTypes;
                    hasChanges = true;
                }
                if (item.switch === undefined) {
                    item.switch = true;
                    hasChanges = true;
                }
            }
            // 没改动就不写：这个方法每轮推送都跑，无条件写会白白触发
            // 文件监听 → 缓存失效 → 下次读重新解析，还会反复重排 yaml
            return hasChanges ? list : undefined;
        });
    }
    /**
     * 兼容不同版本 amagi 的搜索结果结构。
     * @param {DouyinSearchResponse} searchResult 搜索结果
     * @returns {DouyinSearchUser[]}
     */
    getSearchUsers(searchResult) {
        if (!Array.isArray(searchResult.data) && Array.isArray(searchResult.data?.user_list))
            return searchResult.data.user_list;
        const userCard = Array.isArray(searchResult?.data)
            ? searchResult.data.find(item => item.card_unique_name === 'user')
            : null;
        return userCard?.user_list || [];
    }
    /**
     * @param {WillBePushList} data - 待推送的抖音动态数据列表
     * @returns {Promise<boolean>} - 返回处理结果，成功返回true
     */
    async getdata(data) {
        try {
            if (Object.keys(data).length === 0)
                return true;
            for (const awemeId in data) {
                const pushItem = data[awemeId];
                if (!pushItem)
                    continue;
                const pushType = pushItem.pushType || (pushItem.living ? 'live' : 'post');
                const actualAwemeId = awemeId.replace(/^(post|favorite|recommend|live)_/, '');
                logger.mark(`
        ${logger.blue('开始处理并渲染抖音动态图片')}
        ${logger.blue('博主')}: ${logger.green(pushItem.remark)}${' '}
        ${logger.blue('推送类型')}: ${logger.magenta(DOUYIN_PUSH_TYPE_LABELS[pushType] || pushType)}
        ${logger.cyan('作品id')}：${logger.yellow(actualAwemeId)}
        ${logger.cyan('访问地址')}：${logger.green(pushType === 'live' ? 'https://live.douyin.com/' + (pushItem.Detail_Data?.room_data?.owner?.web_rid || '') : 'https://www.douyin.com/video/' + actualAwemeId)}`);
                const Detail_Data = pushItem.Detail_Data;
                const skip = await skipDynamic(pushItem);
                let img = false;
                let iddata = { is_mp4: true, type: 'one_work' };
                if (!skip) {
                    iddata = await getDouyinID(Detail_Data?.share_url || 'https://live.douyin.com/' + Detail_Data?.room_data?.owner?.web_rid, false);
                }
                const workData = Detail_Data;
                const workDetail = workData;
                const isArticle = isDouyinArticle(workDetail);
                const isVideo = isDouyinVideo(workDetail);
                const isImage = isDouyinImage(workDetail);
                if (!pushItem.living && iddata.type === 'one_work')
                    iddata.is_mp4 = isVideo;
                if (!skip) {
                    if (pushItem.living && 'room_data' in pushItem.Detail_Data && Detail_Data.live_data) {
                        const liveResponse = Detail_Data.live_data.data;
                        const livePayload = liveResponse?.data;
                        const liveItem = Array.isArray(livePayload) ? livePayload[0] : livePayload?.data?.[0];
                        const partitionTitle = liveResponse?.partition_road_map?.partition?.title ||
                            (!Array.isArray(livePayload) ? livePayload?.partition_road_map?.partition?.title : undefined);
                        const profile = Detail_Data.user_info.data.user;
                        img = await Render('douyin/live', buildDouyinLivePayload({
                            anchor: profile,
                            dynamicTYPE: '直播动态推送',
                            liveItem,
                            partitionTitle: partitionTitle || '',
                            webRid: Detail_Data.room_data?.owner?.web_rid || liveItem?.owner?.web_rid || ''
                        }));
                    }
                    else {
                        const realUrl = Config.douyin?.push?.shareType === 'web' && await new Networks({
                            url: workData.share_url,
                            headers: {
                                ...douyinBaseHeaders,
                                Referer: 'https://www.douyin.com',
                                Cookie: ''
                            }
                        }).getLocation();
                        const shareUrl = Config.douyin?.push?.shareType === 'web'
                            // getLocation() 拿不到跳转地址时返回 false，而契约里 share_url 必填 string、
                            // 模板又直接把它塞进二维码 `value={props.share_url}`，所以得退回作品页地址
                            ? realUrl || workData.share_url
                            : workData.video.play_addr.uri
                                ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${workData.video.play_addr.uri}&ratio=1080p&line=0`
                                : workData.share_url;
                        // 喜欢/推荐列表有专用卡片：通用卡只有一个作者区，装不下
                        // 「甲喜欢了乙的作品」里的甲。source_user_info 就是甲（订阅者）。
                        if (pushType === 'favorite' || pushType === 'recommend') {
                            const listCardWork = {
                                author: workData.author,
                                coverUrl: getDouyinWorkCoverUrl(workDetail),
                                createTime: Common.convertTimestampToDateTime(pushItem.create_time / 1000),
                                desc: workData.desc,
                                remark: pushItem.remark,
                                shareUrl,
                                statistics: workData.statistics
                            };
                            const subscriber = Detail_Data.source_user_info?.data?.user;
                            img = pushType === 'favorite'
                                ? await Render('douyin/favorite-list', buildDouyinFavoritePayload({ ...listCardWork, liker: subscriber }))
                                : await Render('douyin/recommend-list', buildDouyinRecommendPayload({ ...listCardWork, recommender: subscriber }));
                        }
                        else {
                            img = await Render('douyin/dynamic', {
                                image_url: getDouyinWorkCoverUrl(workDetail),
                                desc: this.desc(workData, workData.desc),
                                dianzan: Common.count(workData.statistics.digg_count),
                                pinglun: Common.count(workData.statistics.comment_count),
                                share: Common.count(workData.statistics.share_count),
                                shouchang: Common.count(workData.statistics.collect_count),
                                create_time: Common.convertTimestampToDateTime(pushItem.create_time / 1000),
                                avater_url: 'https://p3-pc.douyinpic.com/aweme/1080x1080/' + (workData.user_info.data.user.avatar_larger.uri || ''),
                                share_url: shareUrl,
                                username: workData.author.nickname,
                                // unique_id 和 short_id 都是可选字段，契约必填 string；
                                // 原来 unique_id 为 undefined（不是 ''）时直接把 undefined 传给模板
                                抖音号: (workData.user_info.data.user.unique_id || workData.user_info.data.user.short_id) || '无法获取',
                                粉丝: Common.count(workData.user_info.data.user.follower_count),
                                获赞: Common.count(workData.user_info.data.user.total_favorited),
                                关注: Common.count(workData.user_info.data.user.following_count),
                                dynamicTYPE: `抖音${DOUYIN_PUSH_TYPE_LABELS[pushType] || '作品'}推送`
                            });
                        }
                    }
                }
                // Render 返回 false 表示本次渲染失败，保留未推送状态供下次重试。
                if (!skip && img === false)
                    continue;
                for (const target of pushItem.targets) {
                    // 这条卡片是否已经「不必再重发」：被过滤跳过、发送成功、或 bot/群不存在的兜底。
                    // 二次解析（视频/图集）失败不改变它 —— 卡片已经出去了，重发只会让群里看到两遍。
                    let cardDelivered = skip;
                    try {
                        const { groupId, botId } = target;
                        if (!skip) {
                            // 发送消息,如果bot不存在或群组不存在,则默认message_id为1,防止bot上线发一堆消息
                            const status = Bot?.[botId]?.pickGroup(groupId)
                                ? await Bot[botId].pickGroup(groupId).sendMsg(img)
                                : (logger.warn(`bot${botId}不存在或群${groupId}不存在`), { message_id: '1' });
                            const messageId = isRecord(status) ? status.message_id : undefined;
                            cardDelivered = Boolean(messageId);
                            if (pushItem.living && 'room_data' in pushItem.Detail_Data && messageId) {
                                await douyinDB?.updateLiveStatus(pushItem.sec_uid, true);
                            }
                            if (Config.douyin?.push?.parsedynamic && messageId) {
                                if (isVideo) {
                                    try {
                                        /**
                                         * 视频下载地址：直接用 `url_list` 的签名直链，不再 `getLongLink()` 跟随跳转。
                                         *
                                         * 解析路径（`pickDouyinPlayUrl`）早就改成这样了，推送路径漏了。跟随跳转有两个代价：
                                         * 一是 302 会落到 cjjd14.com 这类 CDN，返回非 MP4 字节，下下来放不出来；
                                         * 二是 `getLongLink()` 用的是完整 GET，为了拿最终 URL 把整条视频缓冲了一遍。
                                         */
                                        let downloadUrl = '';
                                        if (Config.douyin.autoResolution) {
                                            // 读 .length 不是守卫：bit_rate 缺失时这行日志自己就抛，
                                            // 而且抛在下面把它交给 douyinProcessVideos 之前。
                                            const bitRates = workData.video.bit_rate ?? [];
                                            logger.debug(`开始排除不符合条件的视频分辨率；\n
                      共拥有${logger.yellow(bitRates.length)}个视频源\n
                      视频ID：${logger.green(workData.aweme_id)}\n
                      分享链接：${logger.green(workData.share_url)}
                      `);
                                            const videoObj = douyinProcessVideos(bitRates, {
                                                videoQuality: Config.douyin.push?.pushVideoQuality,
                                                maxAutoVideoSize: Config.douyin.push?.pushMaxAutoVideoSize,
                                                filelimit: Config.upload.filelimit || 100
                                            });
                                            downloadUrl = pickDouyinPlayUrl(videoObj?.[0]?.play_addr);
                                        }
                                        else {
                                            downloadUrl = pickDouyinPlayUrl(at(workData.video.bit_rate)?.play_addr) ||
                                                pickDouyinPlayUrl(workData.video.play_addr_h264);
                                        }
                                        if (!downloadUrl)
                                            throw new Error('取不到可用的视频下载地址');
                                        await downloadVideo(this.e, {
                                            video_url: downloadUrl,
                                            title: { timestampTitle: `tmp_${Date.now()}.mp4`, originTitle: `${workData.desc}.mp4` },
                                            headers: {
                                                ...douyinBaseHeaders,
                                                Referer: downloadUrl,
                                                Cookie: ''
                                            }
                                        }, { active: true, activeOption: { uin: botId, group_id: groupId } });
                                    }
                                    catch (error) {
                                        logger.error(error);
                                    }
                                }
                                else if (isImage && iddata.type === 'one_work') {
                                    const imageres = [];
                                    const temp = [];
                                    let hasGeneratedLivePhoto = false;
                                    const mergeMode = Config.douyin.liveImageMergeMode || 'independent';
                                    const musicUrl = getDouyinMusicUrl(workData.music);
                                    const liveimgbgm = musicUrl
                                        ? await downloadFile(musicUrl, {
                                            title: `Douyin_tmp_A_${Date.now()}.mp3`,
                                            headers: douyinBaseHeaders
                                        })
                                        : null;
                                    if (liveimgbgm?.filepath)
                                        temp.push(liveimgbgm);
                                    try {
                                        const pushImages = workData.images || [];
                                        const livePhotoItems = pushImages.map(item => {
                                            if ((item.clip_type ?? 2) === 2)
                                                return {};
                                            return {
                                                staticUrl: item.url_list?.[0] || item.url_list?.[2] || item.url_list?.[1],
                                                liveVideoUrl: getDouyinLiveVideoUrl(item),
                                                loopCount: item.clip_type === 4 ? 1 : 3
                                            };
                                        });
                                        const livePhotoBatch = await buildLivePhotoMessagesBatch(livePhotoItems, {
                                            platform: 'douyin',
                                            headers: douyinBaseHeaders,
                                            bgmPath: liveimgbgm?.filepath,
                                            mergeMode
                                        });
                                        temp.push(...livePhotoBatch.tempFiles);
                                        hasGeneratedLivePhoto = livePhotoBatch.generatedLivePhoto;
                                        for (const [imageIndex, item] of pushImages.entries()) {
                                            const livePhoto = livePhotoBatch.results[imageIndex];
                                            if (livePhoto !== undefined && livePhoto.messages.length > 0) {
                                                imageres.push(...livePhoto.messages);
                                                continue;
                                            }
                                            const imageUrl = item.url_list?.[2] || item.url_list?.[1] || item.url_list?.[0];
                                            const processedImageUrl = await processImageUrl(imageUrl, workData.desc || '抖音作品图片', imageIndex, douyinBaseHeaders);
                                            imageres.push(segment.image(processedImageUrl));
                                        }
                                        if (hasGeneratedLivePhoto)
                                            imageres.push(await buildLivePhotoTipMessage());
                                        // 一张都没解析出来时只放弃这次二次解析。
                                        // 原来这里是 `return false`：直接从 getdata 返回，把同一轮里后面所有
                                        // 博主的作品一起丢掉（它们没写缓存，线上表现是「这一轮只推了前几条」），
                                        // 而当前这条的动态卡片其实已经发出去了。
                                        if (imageres.length) {
                                            const forwardMsg = Version.BotName === 'Miao-Yunzai'
                                                ? Bot?.makeForwardMsg(imageres.map(img => ({
                                                    user_id: 2854196310,
                                                    message: img
                                                })))
                                                : common?.makeForwardMsg(Bot?.[botId], imageres, '作品图片');
                                            if (Bot?.[botId]?.pickGroup(groupId) && forwardMsg) {
                                                await Bot[botId].pickGroup(groupId).sendMsg(forwardMsg);
                                            }
                                            else {
                                                logger.warn(`bot${botId}不存在或群${groupId}不存在`);
                                            }
                                        }
                                        else {
                                            logger.warn(`[抖音推送] 作品 ${workData.aweme_id || actualAwemeId} 没有可发送的图集内容，跳过二次解析`);
                                        }
                                    }
                                    finally {
                                        for (const item of temp)
                                            await Common.removeFile(item.filepath, true);
                                    }
                                }
                                else if (isArticle) {
                                    logger.debug(`[抖音推送] 文章作品 ${workData.aweme_id || actualAwemeId} 已发送动态卡片，跳过二次媒体解析`);
                                }
                            }
                        }
                    }
                    catch (error) {
                        logger.error(error);
                    }
                    finally {
                        // 只有确实送达（或被过滤跳过）才写已推标记。
                        // 原来这里是无条件写的，理由是「防止 bot 上线发一堆消息」—— 但那个场景已经由
                        // 上面 bot/群不存在时的 message_id: '1' 兜底覆盖了。发送本身抛错（风控、网络抖动、
                        // 图片上传失败）时无条件写缓存，等于把这条作品永久吞掉，群里永远收不到。
                        // 直播不写作品缓存，它的去重走 updateLiveStatus。
                        if (!pushItem.living && cardDelivered) {
                            await douyinDB?.addAwemeCache(actualAwemeId, pushItem.sec_uid, target.groupId, pushType);
                        }
                    }
                }
            }
        }
        catch (e) {
            logger.error('获取抖音动态列表失败', e);
            return false;
        }
        return true;
    }
    /**
     * @param {douyinPushItem[]} userList - 抖音推送项列表
     * @returns {Promise<WillBePushList>} 将要推送的列表
     */
    async getDynamicList(userList) {
        const willbepushlist = {};
        try {
            const filteredUserList = userList.filter(item => item.switch !== false);
            for (const item of filteredUserList) {
                try {
                    const sec_uid = item.sec_uid;
                    if (!sec_uid) {
                        logger.warn(`用户 ${item.remark || item.short_id || '未知'} 缺少 sec_uid，跳过抖音推送`);
                        continue;
                    }
                    const pushTypes = normalizePushTypes(item.pushTypes);
                    logger.debug(`开始获取用户：${item.remark}（${sec_uid}）的抖音内容，推送类型：${pushTypes.join(', ')}`);
                    // 下面这个接口调用挂掉时，错误卡片是从 amagi 的 Proxy 里出的，那里够不到 item。
                    // 先把订阅的 `群号:机器人账号` 记到实例上，卡片才能显示目标群号和推送用的适配器。
                    this.pushContext = { groupWithBot: item.group_id };
                    const userinfo = await this.amagi.douyin.fetchUserProfile({ sec_uid, typeMode: 'strict' }, Config.cookies.douyin, buildAmagiRequestConfig());
                    const targets = item.group_id.map(groupWithBot => {
                        const [groupId = '', botId = ''] = groupWithBot.split(':');
                        return { groupId, botId };
                    }).filter(target => target.groupId && target.botId);
                    if (targets.length === 0)
                        continue;
                    // 账号注销后主页接口照样有响应，但作品/直播列表恒空，再往下走等于每轮推送都白打一遍
                    // 接口、白吃一次风控额度。上游在这里就 continue，本仓库原来没拦。
                    if (userinfo.data.user.special_state_info?.special_state === 1 && userinfo.data.user.user_deleted === true) {
                        logger.warn(`${item.remark}（${sec_uid}）${userinfo.data.user.special_state_info.title || '账号已注销'}，跳过推送`);
                        continue;
                    }
                    for (const pushType of pushTypes) {
                        if (pushType === 'live') {
                            const liveItem = await this.buildLivePushItem(sec_uid, userinfo, item, targets);
                            if (liveItem)
                                willbepushlist[`live_${sec_uid}`] = liveItem;
                            continue;
                        }
                        const contentList = await this.fetchContentList(pushType, sec_uid, item);
                        // 冷启动判定必须在遍历作品之前一次性快照。
                        // hasHistory 查的是 AwemeCaches，而 getValidTargets 给「新订阅群跳过的旧作品」
                        // 写的已读标记也落在同一张表里：边遍历边现查的话，第 2 条作品写完标记后，
                        // 第 3 条起 hasHistory 就变成 true，整个新订阅的历史作品会被当成老订阅全量推一遍。
                        const historySnapshot = pushType === 'post'
                            ? undefined
                            : await this.snapshotPushHistory(sec_uid, targets, pushType);
                        for (const [index, aweme] of contentList.entries()) {
                            logger.debug(`开始处理${DOUYIN_PUSH_TYPE_LABELS[pushType]}作品：${aweme.aweme_id}`);
                            const validTargets = await this.getValidTargets(aweme, sec_uid, targets, pushType, index, historySnapshot);
                            if (validTargets.length === 0)
                                continue;
                            const authorUserinfo = pushType === 'post' ? userinfo : await this.getAuthorUserInfo(aweme, userinfo);
                            willbepushlist[`${pushType}_${aweme.aweme_id}`] = {
                                remark: item?.remark || aweme.author?.nickname || sec_uid,
                                sec_uid,
                                create_time: aweme.create_time * 1000,
                                targets: validTargets,
                                pushType,
                                Detail_Data: {
                                    ...aweme,
                                    user_info: authorUserinfo,
                                    source_user_info: userinfo
                                },
                                avatar_img: 'https://p3-pc.douyinpic.com/aweme/1080x1080/' + (authorUserinfo.data.user.avatar_larger?.uri || ''),
                                living: false
                            };
                        }
                    }
                }
                catch (error) {
                    // 单个博主失败不再中断整轮推送，理由同 bilibili/push.ts 里那处：
                    // Base.ts 的 amagi 代理在接口返回非零 code 时会 throw，try 原来在循环外面，
                    // 第一个接口失败的博主就会把 for 整个终止，后面所有订阅当轮都不推。
                    logger.warn(`[抖音推送] 用户 ${item.remark || item.short_id || item.sec_uid || '未知'}本轮跳过：${getErrorMessage(error)}`);
                    continue;
                }
                finally {
                    // 必须清掉：这个循环里有多个 continue，留着的话下一个订阅（乃至这一轮之后
                    // 任何走同一实例的接口调用）出错时，卡片会挂上上一个订阅的群号。
                    this.pushContext = undefined;
                }
            }
        }
        catch (error) {
            logger.error('获取抖音用户主页作品列表失败:', error);
        }
        return willbepushlist;
    }
    /**
     * @param {'post'|'favorite'|'recommend'|'live'} pushType 推送类型
     * @param {string} sec_uid 用户sec_uid
     * @param {douyinPushItem} item 推送配置
     * @returns {Promise<DouyinAweme[]>}
     */
    async fetchContentList(pushType, sec_uid, item) {
        // 三个方法的 options 类型同为 DouyinUserListOptions，只有返回类型不同，
        // 所以下标访问拿到的联合签名能被合成、直接可调用。
        const method = pushType === 'post'
            ? 'fetchUserVideoList'
            : pushType === 'favorite'
                ? 'fetchUserFavoriteList'
                : 'fetchUserRecommendList';
        const result = await this.amagi.douyin[method]({
            sec_uid,
            number: 15,
            typeMode: 'strict'
        }, Config.cookies.douyin, buildAmagiRequestConfig());
        const awemeList = result?.data?.aweme_list || [];
        if (awemeList.length === 0 && pushType !== 'post') {
            logger.warn(`${item.remark || item.short_id || sec_uid} 的${DOUYIN_PUSH_TYPE_LABELS[pushType]}为空，可能未公开`);
        }
        return awemeList;
    }
    /**
     * 在遍历作品列表之前，快照每个目标群的「是否老订阅」。
     *
     * 必须一次性取完：{@link getValidTargets} 会给新订阅群跳过的旧作品写已读标记，
     * 而 `hasHistory` 读的是同一张 AwemeCaches 表，边遍历边查会被自己刚写的标记污染。
     *
     * @param sec_uid 用户sec_uid
     * @param targets 推送目标
     * @param pushType 推送类型
     * @returns groupId → 是否已有推送历史
     */
    async snapshotPushHistory(sec_uid, targets, pushType) {
        const snapshot = new Map();
        for (const target of targets) {
            snapshot.set(target.groupId, Boolean(await douyinDB?.hasHistory(sec_uid, target.groupId, pushType)));
        }
        return snapshot;
    }
    /**
     * @param {DouyinAweme} aweme 作品数据
     * @param {string} sec_uid 用户sec_uid
     * @param {Array<{groupId: string, botId: string}>} targets 推送目标
     * @param {'post'|'favorite'|'recommend'|'live'} pushType 推送类型
     * @param {number} index 列表序号
     * @param {Map<string, boolean>} [historySnapshot] 遍历列表前取好的订阅历史快照
     * @returns {Promise<Array<{groupId: string, botId: string}>>}
     */
    async getValidTargets(aweme, sec_uid, targets, pushType, index, historySnapshot) {
        const validTargets = [];
        const now = Date.now();
        const createTime = Number(aweme.create_time || 0) * 1000;
        const timeDifference = now - createTime;
        const isTop = aweme.is_top === 1;
        if (pushType === 'post') {
            const inOneDay = timeDifference < 86400000;
            logger.debug(`
        前期获取该作品基本信息：
        推送类型：${DOUYIN_PUSH_TYPE_LABELS[pushType]}
        作者：${aweme.author?.nickname || '未知'}
        作品ID：${aweme.aweme_id}
        发布时间：${Common.convertTimestampToDateTime(aweme.create_time)}
        是否置顶：${isTop}
        是否在一天内：${inOneDay ? logger.green('true') : logger.red('false')}
        `);
            if (!inOneDay)
                return validTargets;
        }
        for (const target of targets) {
            const isPushed = await douyinDB?.isAwemePushed(aweme.aweme_id, sec_uid, target.groupId, pushType);
            if (isPushed)
                continue;
            if (pushType === 'post' || this.force) {
                validTargets.push(target);
                continue;
            }
            // 冷启动判定读快照而不是现查：hasHistory 与 addAwemeCache 共用 AwemeCaches，
            // 现查会把本轮刚写下的「跳过旧作品」标记误当成历史记录。
            // 没传快照时（单测直调等）才退回现查，行为与加快照前一致。
            const hasHistory = historySnapshot?.has(target.groupId)
                ? historySnapshot.get(target.groupId)
                : await douyinDB?.hasHistory(sec_uid, target.groupId, pushType);
            if (hasHistory || index === 0) {
                validTargets.push(target);
            }
            else {
                await douyinDB?.addAwemeCache(aweme.aweme_id, sec_uid, target.groupId, pushType);
                logger.debug(`新订阅群组 ${target.groupId} 跳过旧${DOUYIN_PUSH_TYPE_LABELS[pushType]}作品 ${aweme.aweme_id} 并标记为已读`);
            }
        }
        return validTargets;
    }
    /**
     * 获取作品作者主页数据。失败时回退订阅者主页数据，保证渲染不中断。
     * @param {DouyinAweme} aweme 作品数据
     * @param {ApiResponse<DyUserInfo>} fallbackUserInfo 回退用户数据
     * @returns {Promise<ApiResponse<DyUserInfo>>}
     */
    async getAuthorUserInfo(aweme, fallbackUserInfo) {
        try {
            const authorSecUid = aweme.author?.sec_uid;
            if (!authorSecUid)
                return fallbackUserInfo;
            return await this.amagi.douyin.fetchUserProfile({ sec_uid: authorSecUid, typeMode: 'strict' }, Config.cookies.douyin, buildAmagiRequestConfig());
        }
        catch (error) {
            logger.warn(`获取作品作者用户信息失败: ${error}`);
            return fallbackUserInfo;
        }
    }
    /**
     * @param {string} sec_uid 用户sec_uid
     * @param {ApiResponse<DyUserInfo>} userinfo 用户主页数据
     * @param {douyinPushItem} item 推送配置
     * @param {Array<{groupId: string, botId: string}>} targets 推送目标
     * @returns {Promise<DouyinPushItem|null>}
     */
    async buildLivePushItem(sec_uid, userinfo, item, targets) {
        const liveStatus = await douyinDB?.getLiveStatus(sec_uid);
        if (userinfo.data.user.live_status === 1) {
            if (!userinfo.data.user.room_data) {
                logger.warn(`用户 ${item.remark || sec_uid} 正在直播，但未获取到直播间信息`);
                return null;
            }
            const roomData = JSON.parse(userinfo.data.user.room_data);
            const liveInfo = await douyinFetcher.fetchLiveRoomInfo({
                room_id: userinfo.data.user.room_id_str || '',
                web_rid: roomData.owner?.web_rid || '',
                typeMode: 'strict'
            }, Config.cookies.douyin, buildAmagiRequestConfig());
            if (!liveStatus?.living) {
                return {
                    remark: item.remark || sec_uid,
                    sec_uid,
                    create_time: Date.now(),
                    targets,
                    pushType: 'live',
                    Detail_Data: {
                        user_info: userinfo,
                        room_data: roomData,
                        live_data: liveInfo,
                        liveStatus: {
                            liveStatus: 'open',
                            isChanged: true,
                            isliving: true
                        }
                    },
                    avatar_img: 'https://p3-pc.douyinpic.com/aweme/1080x1080/' + (userinfo.data.user.avatar_larger.uri || ''),
                    living: true
                };
            }
        }
        else if (liveStatus?.living) {
            await douyinDB?.updateLiveStatus(sec_uid, false);
            logger.info(`用户 ${item.remark || sec_uid} 已关播，更新直播状态`);
        }
        return null;
    }
    /**
     * @param {string} aweme_id - 作品ID
     * @param {string} sec_uid - 用户sec_uid
     * @param {string[]} groupIds - 群组ID列表
     * @param {'post'|'favorite'|'recommend'|'live'} [pushType='post'] - 推送类型
     * @returns {Promise<boolean>} 是否已经推送过
     */
    async checkIfAlreadyPushed(aweme_id, sec_uid, groupIds, pushType = 'post') {
        for (const groupId of groupIds) {
            const isPushed = await douyinDB?.isAwemePushed(aweme_id, sec_uid, groupId, pushType);
            if (!isPushed) {
                return false;
            }
        }
        return true;
    }
    /**
     * @param {DySearchInfo} data 抖音的搜索结果数据。需要接口返回的原始数据
     * @returns {Promise<void>}
     */
    async setting(data) {
        const event = this.e;
        const groupId = String(event.group_id);
        const botId = String(event.self_id);
        const userCard = Array.isArray(data.data)
            ? data.data.find(item => item.card_unique_name === 'user')
            : undefined;
        if (!userCard) {
            throw new Error('未找到用户信息');
        }
        const sec_uid = userCard.user_list?.[0]?.user_info?.sec_uid;
        if (!sec_uid) {
            throw new Error('无法获取用户sec_uid');
        }
        const UserInfoData = await this.amagi.douyin.fetchUserProfile({ sec_uid, typeMode: 'strict' }, Config.cookies.douyin, buildAmagiRequestConfig());
        const isSubscribed = await douyinDB?.isSubscribed(sec_uid, groupId);
        if (!UserInfoData?.data?.user) {
            throw new Error('获取用户信息失败');
        }
        const user_shortid = UserInfoData.data.user.unique_id || UserInfoData.data.user.short_id;
        if (!user_shortid) {
            throw new Error('无法获取用户抖音号');
        }
        // 这条命令是开关式的：群里已经订阅了就取消，没订阅就添加。判断用快照就够 ——
        // 真正落盘时会拿磁盘上的最新值重新定位一次，所以快照过期不影响写入的正确性。
        const snapshotItem = (Config.pushlist.douyin ?? []).find(item => item.sec_uid === sec_uid);
        const isRemove = Boolean(snapshotItem?.group_id.some(entry => matchesGroup(entry, groupId)));
        if (isRemove) {
            if (isSubscribed) {
                await douyinDB?.unsubscribeDouyinUser(groupId, sec_uid);
            }
            await event.reply(`群：${event.group_name}(${groupId})\n删除成功！${UserInfoData.data.user.nickname}\n抖音号：${user_shortid}`);
        }
        else {
            if (!isSubscribed) {
                await douyinDB?.subscribeDouyinUser(groupId, botId, sec_uid, user_shortid, UserInfoData.data.user.nickname);
            }
            await event.reply(`群：${event.group_name}(${groupId})\n添加成功！${UserInfoData.data.user.nickname}\n抖音号：${user_shortid}`);
            if (Config.douyin.push && Config.douyin.push.switch === false) {
                await event.reply('请发送「#kkk设置抖音推送开启」以进行推送');
            }
        }
        // 落盘：从磁盘上的最新值重新定位条目，改动写成幂等的（有则删 / 无则加）。
        // 这样即使这期间别的群也在订阅同一个博主，两边的改动都能留下来 —— 换成整份数组
        // 覆盖写就会用一份过期快照把对方抹掉。
        Config.update('pushlist', 'douyin', (current) => {
            const list = Array.isArray(current) ? current : [];
            const index = list.findIndex(item => item.sec_uid === sec_uid);
            const item = index >= 0 ? list[index] : undefined;
            if (isRemove) {
                // 条目已经不在了：别处已经删过，直接认账
                if (!item)
                    return list;
                const groupIndex = item.group_id.findIndex(entry => matchesGroup(entry, groupId));
                if (groupIndex >= 0)
                    item.group_id.splice(groupIndex, 1);
                if (item.group_id.length === 0)
                    list.splice(index, 1);
                return list;
            }
            if (item) {
                if (!item.group_id.some(entry => matchesGroup(entry, groupId))) {
                    item.group_id.push(`${groupId}:${botId}`);
                }
                item.pushTypes = normalizePushTypes(item.pushTypes);
                return list;
            }
            list.push({
                switch: true,
                sec_uid,
                group_id: [`${groupId}:${botId}`],
                remark: UserInfoData.data.user.nickname,
                short_id: user_shortid,
                pushTypes: [...DEFAULT_DOUYIN_PUSH_TYPES]
            });
            return list;
        });
        await this.renderPushList();
    }
    async renderPushList() {
        const event = this.e;
        await this.syncConfigToDatabase();
        const groupId = String(event.group_id);
        const subscriptions = await douyinDB?.getGroupSubscriptions(groupId);
        if (!subscriptions || subscriptions.length === 0) {
            await event.reply(`当前群：${event.group_name}(${groupId})\n没有设置任何抖音博主推送！\n可使用「#设置抖音推送 + 抖音号」进行设置`);
            return;
        }
        const renderOpt = [];
        for (const subscription of subscriptions) {
            const sec_uid = subscription.sec_uid;
            const userInfo = await this.amagi.douyin.fetchUserProfile({ sec_uid, typeMode: 'strict' }, Config.cookies.douyin, buildAmagiRequestConfig());
            const configItem = Config.pushlist.douyin?.find(item => item.sec_uid === sec_uid);
            renderOpt.push({
                avatar_img: userInfo.data.user.avatar_larger.url_list?.[0] || '',
                username: userInfo.data.user.nickname,
                // unique_id 和 short_id 都是可选字段，契约必填 string
                short_id: (userInfo.data.user.unique_id || userInfo.data.user.short_id) || '无法获取',
                fans: Common.count(userInfo.data.user.follower_count),
                total_favorited: Common.count(userInfo.data.user.total_favorited),
                following_count: Common.count(userInfo.data.user.following_count),
                // 原来漏了这个字段，卡片右上角那颗 ON/OFF 灯永远是 OFF
                switch: configItem?.switch !== false,
                // 契约要的是原始类型键数组：模板里是 `props.pushTypes?.includes('post')` 这样按
                // pushTypeConfig 的键匹配。原来传的是 '作品列表 / 直播' 这种拼好的中文串，
                // includes 永远匹配不上，四个推送类型的图标全是灰的
                pushTypes: normalizePushTypes(configItem?.pushTypes)
            });
        }
        const img = await Render('douyin/userlist', {
            groupInfo: buildPushListGroupInfo(event),
            renderOpt
        });
        await event.reply(img);
    }
    /**
     * @param {WillBePushList} data 处理完成的推送列表
     */
    async forcepush(data) {
        const event = this.e;
        const currentGroupId = String(event.group_id || '');
        const currentBotId = String(event.self_id || '');
        if (!event.msg?.includes('全部')) {
            const subscriptions = await douyinDB?.getGroupSubscriptions(currentGroupId);
            const subscribedUids = subscriptions?.map(sub => sub.sec_uid) || [];
            const filteredData = {};
            for (const awemeId in data) {
                const pushItem = data[awemeId];
                if (pushItem && subscribedUids.includes(pushItem.sec_uid)) {
                    filteredData[awemeId] = {
                        ...pushItem,
                        targets: [{
                                groupId: currentGroupId,
                                botId: currentBotId
                            }]
                    };
                }
            }
            await this.getdata(filteredData);
        }
        else {
            await this.getdata(data);
        }
    }
    async checkremark() {
        const pushList = Config.pushlist.douyin;
        if (!pushList || pushList.length === 0)
            return true;
        // 先收集缺备注的用户，取备注要走网络，不能在落盘的改动函数里做。
        // 没有 sec_uid 的条目查不了，跳过 —— 那种旧配置由 ensureConfigFields 负责补全
        const pending = pushList
            .filter(item => !item.remark)
            .map(item => item.sec_uid)
            .filter((sec_uid) => Boolean(sec_uid));
        if (pending.length === 0)
            return false;
        const remarks = new Map();
        for (const sec_uid of pending) {
            const userinfo = await this.amagi.douyin.fetchUserProfile({ sec_uid, typeMode: 'strict' }, Config.cookies.douyin, buildAmagiRequestConfig());
            const remark = userinfo.data.user.nickname;
            if (remark)
                remarks.set(sec_uid, remark);
        }
        if (remarks.size === 0)
            return false;
        // 只补备注这一个字段，其余按磁盘上的现状原样留下。原来是整份数组覆盖写，
        // 期间有人订阅 / 退订就会被这份快照抹掉。
        Config.update('pushlist', 'douyin', (current) => {
            if (!Array.isArray(current))
                return undefined;
            let changed = false;
            for (const item of current) {
                const remark = item.sec_uid ? remarks.get(item.sec_uid) : undefined;
                if (remark && !item.remark) {
                    item.remark = remark;
                    changed = true;
                }
            }
            return changed ? current : undefined;
        });
        return false;
    }
    /**
     * @param {DouyinDetailData} Detail_Data - 作品详细数据
     * @param {string} desc - 作品描述文本
     * @returns {string} 处理后的描述文本
     */
    desc(_Detail_Data, desc) {
        if (desc === '') {
            return '该作品没有描述';
        }
        return desc;
    }
}
/**
 * 判断标题是否有屏蔽词或屏蔽标签
 * @param PushItem 推送项
 * @returns 是否应该跳过推送
 */
export const skipDynamic = async (PushItem) => {
    if ('liveStatus' in PushItem.Detail_Data) {
        return false;
    }
    const tags = [];
    if (PushItem.Detail_Data.text_extra) {
        for (const item of PushItem.Detail_Data.text_extra) {
            if (item.hashtag_name) {
                tags.push(item.hashtag_name);
            }
        }
    }
    logger.debug(`检查作品是否需要过滤：${PushItem.Detail_Data.share_url}`);
    // 数据库未就绪时旧实现返回 undefined 并断言成 boolean，调用方只判真假，这里补 false 与之等价
    const shouldFilter = await douyinDB?.shouldFilter(PushItem, tags);
    return shouldFilter ?? false;
};
