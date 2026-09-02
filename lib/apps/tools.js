import { KuaiShou, GetKuaishouID, KuaishouData } from '../module/platform/kuaishou/index.js';
import { Bilibili, getBilibiliID } from '../module/platform/bilibili/index.js';
import { DouYin, getDouyinID } from '../module/platform/douyin/index.js';
import { Xiaohongshu, getXiaohongshuID } from '../module/platform/xiaohongshu/index.js';
import { Config, Common, UploadRecord, wrapWithErrorHandler, downloadVideo, baseHeaders } from '../module/utils/index.js';
import { getStatisticsDB, PRIVATE_GROUP_ID } from '../module/db/index.js';
import { buildAmagiRequestConfig, douyinFetcher } from '../module/utils/amagiClient.js';
import { EmojiReactionManager } from '../module/utils/EmojiReaction.js';
import { createParseFingerprint, ParseCoordinator, setActiveParseCoordinator } from '../module/utils/ParseCoordinator.js';
import { createEmojiParseReactionPort } from '../module/utils/ParseReactionAdapter.js';
import { runWithMediaMetrics } from '../module/utils/media-metrics.js';
import { XIAOHONGSHU_LINK_PATTERN } from '../module/platform/xiaohongshu/link.js';
import { recordLiveRoom } from '../module/platform/common/liveRecord.js';
import { isRecord } from '../module/utils/record.js';
import { getConfigValue, isDefaultTool, isVideoToolEnabled } from '../module/utils/app-config.js';
const bilibiliSelections = new Map();
const douyinSelections = new Map();
const configuredParseConcurrency = Number(Config.app.parseConcurrency);
const parseCoordinator = new ParseCoordinator({
    concurrency: Number.isSafeInteger(configuredParseConcurrency) && configuredParseConcurrency > 0
        ? configuredParseConcurrency
        : 2
});
// 登记给诊断卡用。协调器实例的所有权在这里（并发数要读配置），而 runtime-report
// 在 utils 层、引不到 apps，所以由这边主动登记一次。
setActiveParseCoordinator(parseCoordinator);
const PLATFORM_CONFIG = [
    {
        reg: /.*((www|v|jx|jingxuan|m|live)\.(douyin|iesdouyin)\.com|douyin\.com\/(video|note)|webcast\.amemv\.com).*/i,
        handler: 'douyin',
        enabled: getConfigValue(Config.douyin?.switch, Config.douyin?.douyintool)
    },
    {
        reg: /(bilibili.com|b23.tv|t.bilibili.com|bili2233.cn|^BV[1-9a-zA-Z]{10}$|^av\d+$)/i,
        handler: 'bilibili',
        enabled: getConfigValue(Config.bilibili?.switch, Config.bilibili?.bilibilitool)
    },
    {
        reg: /^((.*)快手(.*)快手(.*)|(.*)v\.kuaishou(.*)|(.*)kuaishou\.com\/f\/[a-zA-Z0-9]+.*)$/,
        handler: 'kuaishou',
        enabled: getConfigValue(Config.kuaishou?.switch, Config.kuaishou?.kuaishoutool)
    },
    {
        reg: XIAOHONGSHU_LINK_PATTERN,
        handler: 'xiaohongshu',
        enabled: Config.xiaohongshu?.switch
    }
];
/**
 * @returns {Array} 返回启用的平台规则数组
 */
const generateRules = () => {
    if (!isVideoToolEnabled(Config.app))
        return [];
    return PLATFORM_CONFIG
        .filter(config => config.enabled)
        .map(({ reg, handler }) => ({ reg, fnc: handler }));
};
const findPlatformConfig = (msg) => PLATFORM_CONFIG.find(config => config.enabled && config.reg.test(msg));
const getEventUserId = (e) => String(e.user_id || e.sender?.user_id || 'unknown');
/** 事件所在群的群号；私聊没有群号，退回统一的私聊占位值 */
const getEventGroupId = (e) => String(e.group_id || e.groupId || PRIVATE_GROUP_ID);
const getSelectionKey = (e) => `${getEventGroupId(e)}:${getEventUserId(e)}`;
const trimUrlPunctuation = (value) => value.replace(/[\])}>,，。！？、]+$/u, '');
/**
 * 消息正文里的第一条 http(s) 链接，末尾标点已剥掉。
 *
 * `replaceAll('\\', '')`：部分客户端把分享链接里的字符转义后上报，不剥掉的话
 * 域名判定和 `new URL()` 都会认错。剥末尾标点是因为「（链接）」「链接。」这种写法
 * 会把标点粘进 URL 里。
 *
 * 抽出来给 getParseTarget 和 recordLive 共用：两边原来各写一遍同一个正则，
 * 而它们必须对同一条消息抽出同一条 URL —— 一边多剥一个字符，录制的指纹就和
 * 解析的指纹按不同的字符串算，去重口径当场分叉。
 */
const extractFirstUrl = (message) => {
    const matched = message.replaceAll('\\', '').trim().match(/https?:\/\/[^\s"'<>]+/i)?.[0];
    return matched ? trimUrlPunctuation(matched) : '';
};
const getParseTarget = (platform, message) => {
    const normalizedMessage = message.replaceAll('\\', '').trim();
    const value = extractFirstUrl(message);
    if (value) {
        try {
            const url = new URL(value);
            if (url.protocol === 'http:' || url.protocol === 'https:')
                return { type: 'url', value };
        }
        catch {
            // Fall through to a stable work/message identifier.
        }
    }
    if (platform === 'bilibili') {
        const workId = normalizedMessage.match(/\b(?:BV[1-9a-zA-Z]{10}|av\d+)\b/i)?.[0];
        if (workId)
            return { type: 'work-id', value: workId };
    }
    return { type: 'work-id', value: normalizedMessage };
};
/**
 * 指纹的作用域：有群号就按群共享（同群里的重复链接互相去重），
 * 私聊没有群号，退回按用户各自一份。
 *
 * 单独抽出来是为了让「从消息文本推目标」和「显式给目标」两条构造路径共用同一份
 * 作用域口径——抄第二份的话两边迟早漂移，届时同一个请求在两条路径上会算出不同指纹。
 */
const getParseScope = (e) => {
    const groupId = e.group_id;
    const hasGroup = groupId !== undefined && groupId !== null && String(groupId).trim() !== '';
    return hasGroup
        ? { type: 'group', id: String(groupId) }
        : { type: 'private', id: getEventUserId(e) };
};
/**
 * 显式目标的指纹构造。调用方已经握着真实的作品标识（选集入口就是这种情况）时用它，
 * 不要再走 getParseTarget 从消息文本反推。
 */
const createParseIdentity = (platform, e, target) => ({
    platform,
    target,
    scope: getParseScope(e)
});
/** 从消息文本推目标的指纹构造，供「用户直接发链接」的主入口使用。 */
const createMessageParseIdentity = (platform, e) => createParseIdentity(platform, e, getParseTarget(platform, e.msg || ''));
/**
 * 参与 B站选集去重的作品定位字段，取自 getBilibiliID 的解析结果
 * （见 module/platform/bilibili/getid.ts 的 BilibiliIdData）：
 * 番剧走 `realid`（ss/ep 号）+ `type`，普通视频走 `bvid`/`p`，
 * 活动页走 `id`，动态走 `dynamic_id`，直播走 `room_id`。
 */
const BILIBILI_WORK_ID_FIELDS = ['realid', 'bvid', 'id', 'dynamic_id', 'room_id', 'p'];
/**
 * B站选集的作品标识。
 *
 * 只拿集号当目标是不够的：不同番剧的第 1 集会算出同一个指纹，于是同群两个人分别在
 * 不同番剧里回「第1集」时会被错误地去重成一个任务，其中一个拿到另一个的结果。
 * 这里把上一次解析出的作品定位字段一起编进目标，集号只作为最后一段。
 */
const createBilibiliEpisodeTarget = (stored, episode) => ({
    type: 'work-id',
    value: [
        stored.type,
        ...BILIBILI_WORK_ID_FIELDS.map(field => {
            const value = stored[field];
            return value === undefined || value === null ? '' : String(value);
        }),
        episode
    ].join('|')
});
const isDouyinSelectionResult = (value) => {
    if (!isRecord(value) || value.type !== 'douyin_user_selection' || typeof value.timeoutSeconds !== 'number')
        return false;
    return Array.isArray(value.videos) && value.videos.every(video => isRecord(video) && typeof video.aweme_id === 'string');
};
const isDouyinMusicData = (value) => {
    if (!isRecord(value) || !isRecord(value.data) || !isRecord(value.data.music_info))
        return false;
    const music = value.data.music_info;
    return typeof music.title === 'string' && isRecord(music.play_url) && typeof music.play_url.uri === 'string';
};
const recordParseStatistics = async (e, platform) => {
    // 私聊记录照常写库：总解析次数、平台分布、用户数算它是有意义的，
    // 只有「按群聚合」的读取端要把 PRIVATE_GROUP_ID 排除掉（见 apps/statistics.ts）。
    // 这里原来把 getEventGroupId / getEventUserId 的表达式各抄了一遍，
    // 改成直接复用，免得占位值在两处漂移。
    const groupId = getEventGroupId(e);
    const userId = getEventUserId(e);
    try {
        const statisticsDB = await getStatisticsDB();
        await statisticsDB?.recordParse(groupId, userId, platform);
    }
    catch (error) {
        logger.error('[统计] 记录解析统计失败', error);
    }
};
/**
 * 把一次解析收集到的媒体度量写库。
 *
 * 和 recordParseStatistics 分开两个函数、各自 try/catch：解析次数是老口径，
 * 媒体度量是新加的，后者写库失败不该让前者也丢。群号口径两边一致（私聊照常写，
 * 按群聚合的读取端自己排除 PRIVATE_GROUP_ID）。
 */
const recordMediaMetrics = async (e, platform, records, outcome, processingMs) => {
    try {
        const statisticsDB = await getStatisticsDB();
        await statisticsDB?.recordMediaMetrics(getEventGroupId(e), platform, records, outcome, processingMs);
    }
    catch (error) {
        logger.error('[统计] 记录媒体度量失败', error);
    }
};
export class kkkTools extends plugin {
    constructor() {
        super({
            name: 'kkkkkk-10086-视频功能',
            dsc: '视频',
            event: 'message',
            priority: isDefaultTool(Config.app) ? -Infinity : Config.app.priority,
            rule: [
                // 必须排在 `generateRules()` **前面**。宿主是按 `i.plugin.rule` 的数组顺序
                // 逐条试的（lib/plugins/loader.js:283），本 app 在「默认解析」开启时是
                // -Infinity，没有任何数值优先级能救 —— 放到后面的话，`#kkk录直播 <直播间链接>`
                // 会先被上面那条平台链接规则吃掉，用户拿到的是一张普通直播卡片而不是录像。
                //
                // `^` 和 `(?![一-龥])` 两个锚都是必需的：没有 `^` 时正文里带这几个字的
                // 任何消息（含别的插件的命令）都会被这条截走，没有那个否定断言时
                // `#kkk录直播列表` 这种更长的中文命令会被当成本命令 —— 同一形状的 bug
                // 在下面 `prefix` 那条上已经真实发生过一次。
                { reg: /^#?kkk录直播(?![一-龥])/, fnc: 'recordLive' },
                ...generateRules(),
                ...(isVideoToolEnabled(Config.app) ? [{ reg: /^(\[图片\])?$/, fnc: 'imageQrCode' }] : []),
                { reg: /^#?\d{1,2}$/, fnc: 'selectDouyinWork' },
                // 关键字后面不能紧跟汉字：这条规则没有结尾锚点，原来 `^#?kkk解析` 会把
                // `#kkk解析统计` 一起吃掉，而本 app 优先级 500 比 statistics 的 2000 靠前，
                // 且下面的 prefix() 无论有没有匹配到平台都返回 true，
                // 于是 `#kkk解析统计` 被静默截走、统计卡片从来没出过。
                { reg: /^#?(解析|kkk解析|弹幕解析)(?![一-龥])/, fnc: 'prefix' },
                // 必须有 `^`：本 app 在「默认解析」开启时是 -Infinity，比任何插件都先派发，
                // 而 uploadRecord 不像 imageQrCode / selectDouyinWork 那样不认就 `return false`
                // 交还派发权——它直接去请求音乐数据并回「获取音乐数据失败」。没有锚点时
                // 任何一条正文里带 `BGM123` 的消息（含别的插件的命令）都会被截走并收到这句报错。
                { reg: /^#?BGM(\d+)/, fnc: 'uploadRecord' },
                { reg: /^#?第(\d{1,3})集$/, fnc: 'next' } // 选集功能规则
            ]
        });
    }
    /**
     * 统一处理不同平台的链接解析
     * @param {any} e 事件对象
     * @returns {Promise<boolean>} 处理结果
     */
    async prefix(e) {
        const originalMsg = e.msg || '';
        e.msg = await Common.getReplyMessage(e);
        if (/^#?弹幕解析/.test(originalMsg)) {
            e.msg = `#弹幕解析 ${e.msg}`;
        }
        if (/https:\/\/aweme\.snssdk\.com\/aweme\/v1\/play/i.test(e.msg)) {
            const videoId = e.msg.match(/video_id=([^&\s]+)/)?.[1] || Date.now().toString();
            return await this.runCoordinatedParse(e, 'douyin', '抖音直链解析', async (event) => {
                await downloadVideo(event, {
                    video_url: event.msg,
                    title: {
                        timestampTitle: `tmp_${Date.now()}.mp4`,
                        originTitle: `抖音视频_${videoId}.mp4`
                    },
                    headers: {
                        ...baseHeaders,
                        Referer: 'https://www.douyin.com'
                    }
                });
                await recordParseStatistics(event, 'douyin');
                return true;
            });
        }
        // dispatchPlatform 返回 false 就是「没认出可解析的链接」。这里原来无条件 return true，
        // 于是 QQBot 上引用解析失效了很久，表现成「机器人没反应」而不是报错。
        if (!await this.dispatchPlatform(e)) {
            await e.reply?.('没找到可解析的链接，请引用一条含链接的消息后再发送「#解析」');
        }
        return true;
    }
    /**
     * 处理直接发送的平台二维码图片
     * @param {any} e 事件对象
     * @returns {Promise<boolean>}
     */
    async imageQrCode(e) {
        const msg = await Common.getReplyMessage(e);
        if (!msg || msg === e.msg)
            return false;
        e.msg = msg;
        return await this.dispatchPlatform(e);
    }
    /**
     * 根据消息内容分发到对应平台处理器
     * @param {any} e 事件对象
     * @returns {Promise<boolean>}
     */
    async dispatchPlatform(e) {
        const config = findPlatformConfig(e.msg);
        if (!config)
            return false;
        await this[config.handler](e);
        return true;
    }
    /**
     * 让一次解析进入并发队列、按指纹去重，并驱动表情回应状态。
     *
     * @param target 可选的显式指纹目标。缺省时从 `e.msg` 反推（用户直接发链接的主入口
     *   就是这样）；二级入口（选集）收到的消息是「1」「第3集」这种序号，反推只能拿到
     *   垃圾值且不同作品会互相撞车，必须自己把真实作品标识传进来。
     *   这里只收目标、不收整个 identity：平台和作用域仍由本方法统一推导，
     *   免得调用点传进来的平台和 businessName 走的平台对不上。
     */
    async runCoordinatedParse(e, platform, businessName, fn, target) {
        const pluginContext = this;
        const handler = wrapWithErrorHandler(() => fn.call(this, e), {
            businessName,
            platform,
            plugin: pluginContext,
            emojiReaction: false,
            rethrowAfterHandle: true
        });
        const reaction = createEmojiParseReactionPort(new EmojiReactionManager(e));
        // 指纹构造要在进队列**之前**单独兜住，不能让它掉进下面那个 catch。
        // 下面的 catch 是给「已经过 wrapWithErrorHandler 弹过错误卡」的业务异常准备的，
        // 吞掉它是对的；但指纹构造抛的 TypeError 谁都没处理过 —— e.msg 为空时
        // getParseTarget 会返回 { type: 'work-id', value: '' }，normalizeTarget 的非空
        // 校验就抛在这里。混在一起的后果是解析静默跳过、连一行日志都没有。
        let identity;
        try {
            identity = target === undefined
                ? createMessageParseIdentity(platform, e)
                : createParseIdentity(platform, e, target);
            // 提前算一次把校验前移。submit() 内部还会再算一次，但它是纯字符串拼接，
            // 比让异常穿到 catch 里被当成业务失败便宜得多。
            createParseFingerprint(identity);
        }
        catch (error) {
            // 返回 true 保持原有的派发语义（声称已处理、不再往后传），只是不再静默：
            // 走到这里说明输入本身不该触发解析，日志是唯一的排查线索。
            logger.error(`[${platform}] ${businessName}的解析指纹构造失败，已跳过本次解析`, error);
            return true;
        }
        try {
            const result = await parseCoordinator.submit(identity, 
            // 媒体度量的作用域包在协调器**里面**、而不是外面：submit 会对重复请求去重，
            // 只有胜出的那个任务真的跑 handler。开在外面的话，被去重掉的请求也会开一个
            // 空作用域、并在结束时写一条全 0 的耗时记录，把成功率和平均耗时都掺水。
            async () => {
                const startedAt = Date.now();
                // 成败要在这里自己记：handler 配了 rethrowAfterHandle，失败时异常穿过
                // runWithMediaMetrics 一路抛到下面那个 catch，onSettled 里看不到成败。
                let outcome = 'failure';
                return await runWithMediaMetrics(platform, async () => {
                    const value = await handler(e);
                    outcome = 'success';
                    return value;
                }, records => recordMediaMetrics(e, platform, records, outcome, Date.now() - startedAt));
            }, reaction);
            return result === undefined ? true : result;
        }
        catch {
            // 只吞业务异常：handler 配的是 rethrowAfterHandle，走到这里的异常
            // 已经过统一错误处理、错误卡也弹过了，再抛一遍只会在派发层重复一次。
            // 指纹构造那类「没人处理过」的异常在上面单独兜住，不会落到这里。
            return true;
        }
    }
    /**
     * @param {any} e 事件对象
     * @returns {Promise<boolean>} 处理结果
     */
    async douyin(e) {
        return await this.runCoordinatedParse(e, 'douyin', '抖音视频解析', this._douyin);
    }
    async _douyin(e) {
        const forceBurnDanmaku = /^#?弹幕解析/.test(e.msg);
        // 这条必须和上面 PLATFORM_CONFIG 里的抖音网关正则认同一批域名，否则链接能触发规则、
        // 却在这里抽不出 URL，`urlMatch` 为 null 直接 `return true` —— 表现成「发了链接机器人不吭声」。
        // `live.douyin.com`（直播间长链）和 `webcast.amemv.com`（App 分享的直播间 reflow 链接）
        // 原来都漏在外面，前者过了网关后无声失败，后者连网关都进不来。
        const urlMatch = e.msg.match(/https?:\/\/(?:(?:www|v|jx|m|jingxuan|live)\.)?(?:douyin\.com|iesdouyin\.com|webcast\.amemv\.com)\/[^\s]+/g);
        if (urlMatch && urlMatch[0]) {
            const iddata = await getDouyinID(urlMatch[0]);
            const result = await new DouYin(e, iddata, { forceBurnDanmaku }).RESOURCES(iddata);
            if (isDouyinSelectionResult(result)) {
                const key = getSelectionKey(e);
                const selection = {
                    videos: result.videos,
                    expiresAt: Date.now() + result.timeoutSeconds * 1000
                };
                douyinSelections.set(key, selection);
                setTimeout(() => {
                    if (douyinSelections.get(key) === selection)
                        douyinSelections.delete(key);
                }, result.timeoutSeconds * 1000);
            }
            await recordParseStatistics(e, 'douyin');
        }
        return true;
    }
    async selectDouyinWork(e) {
        const key = getSelectionKey(e);
        const selection = douyinSelections.get(key);
        if (!selection)
            return false;
        if (Date.now() > selection.expiresAt) {
            douyinSelections.delete(key);
            await e.reply('抖音主页作品选择已超时，请重新发送主页链接');
            return true;
        }
        const index = Number((e.msg || '').replace(/^#/, ''));
        const target = selection.videos[index - 1];
        if (!target) {
            await e.reply(`请输入 1~${selection.videos.length} 之间的序号`);
            return true;
        }
        douyinSelections.delete(key);
        const iddata = {
            type: 'one_work',
            aweme_id: target.aweme_id
        };
        // 走协调器而不是裸 runWithErrorHandler：这个入口以前不进并发队列（一次完整解析
        // 会插到 parseConcurrency 的限流外面），也没有表情回应。
        // 至于「连点两次」，上面那句 douyinSelections.delete 已经让第二次点击拿不到选集，
        // 所以去重在这里主要防的是同群多人并发选到同一个作品。
        // 指纹目标必须显式给：用户发的是「1」「2」这种序号，从 e.msg 反推会拿到垃圾值，
        // 而且不同用户选的不同作品会算出相同指纹、被错误地去重成同一个任务。
        await this.runCoordinatedParse(e, 'douyin', '抖音主页作品选择解析', async (event) => {
            await new DouYin(event, iddata, {}).RESOURCES(iddata);
            await recordParseStatistics(event, 'douyin');
            return true;
        }, { type: 'work-id', value: target.aweme_id });
        return true;
    }
    /**
     * @param {any} e 事件对象
     * @returns {Promise<boolean>} 处理结果
     */
    async bilibili(e) {
        return await this.runCoordinatedParse(e, 'bilibili', 'B站视频解析', this._bilibili);
    }
    async _bilibili(e) {
        const forceBurnDanmaku = /^#?弹幕解析/.test(e.msg);
        const firstMessage = Array.isArray(e.message) ? e.message[0] : e.message;
        const messageFallback = typeof firstMessage === 'string'
            ? firstMessage
            : typeof firstMessage?.data === 'string' ? firstMessage.data : '';
        let url = (e.msg || messageFallback).replaceAll('\\', '').trim();
        if (url.includes('b23.tv')) {
            url = url.match(/(http:|https:)\/\/b23.tv\/[-A-Za-z\d._?%&+=/#]*/)?.[0] || url;
        }
        else if (/bilibili\.com|bili2233\.cn/.test(url)) {
            // `live.` 必须在这一列里：外层条件是宽松的 `/bilibili\.com/`，直播间链接进得来，
            // 但这条只认 www / m / bili2233，于是 `live.bilibili.com/26139686` 匹配不到、
            // `?.[0]` 落到 `|| url` 保留整条消息文本 —— 后面 getBilibiliID 拿着带前后文的字符串
            // 去请求长链接，直播间解析就断在这里。
            url = url.match(/(?:https?:\/\/)?(?:www\.bilibili\.com|m\.bilibili\.com|live\.bilibili\.com|bili2233\.cn)\/[-A-Za-z\d._?%&+=/#]*/)?.[0] || url;
        }
        else if (/^BV[1-9a-zA-Z]{10}$/i.test(url) || /^av\d+$/i.test(url)) {
            url = `https://www.bilibili.com/video/${url}`;
        }
        if (!url) {
            logger.warn(`未能在消息中找到有效的B站分享链接、BV号或av号: ${url}`);
            return true;
        }
        const iddata = await getBilibiliID(url);
        await new Bilibili(e, iddata, { forceBurnDanmaku }).RESOURCES(iddata);
        await recordParseStatistics(e, 'bilibili');
        // 保存本次解析出的完整 ID 数据，供同一群聊中的同一用户继续选集。
        const key = getSelectionKey(e);
        bilibiliSelections.set(key, iddata);
        setTimeout(() => {
            if (bilibiliSelections.get(key) === iddata)
                bilibiliSelections.delete(key);
        }, 60000);
        return true;
    }
    /**
     * @param {any} e 事件对象
     * @returns {Promise<boolean>} 处理结果
     */
    async kuaishou(e) {
        return await this.runCoordinatedParse(e, 'kuaishou', '快手视频解析', this._kuaishou);
    }
    async _kuaishou(e) {
        const url = e.msg.replaceAll('\\', '').match(/(https:\/\/v\.kuaishou\.com\/\w+|https:\/\/www\.kuaishou\.com\/f\/[a-zA-Z0-9]+)/)?.[0];
        if (!url)
            return true;
        const Iddata = await GetKuaishouID(url);
        if (!Iddata)
            return true;
        const WorkData = await new KuaishouData(Iddata.type).GetData({ photoId: Iddata.photoId || Iddata.id });
        // GetData 的公共签名保守返回 unknown，Action 内部本就按可选字段读取该响应。
        await new KuaiShou(e, Iddata).Action(WorkData);
        await recordParseStatistics(e, 'kuaishou');
        return true;
    }
    /**
     * @param {any} e 事件对象
     * @returns {Promise<boolean>} 处理结果
     */
    async xiaohongshu(e) {
        return await this.runCoordinatedParse(e, 'xiaohongshu', '小红书笔记解析', this._xiaohongshu);
    }
    async _xiaohongshu(e) {
        const url = e.msg.replaceAll('\\', '').match(/https?:\/\/[^\s"'<>]+/i)?.[0];
        if (!url) {
            logger.warn(`未能在消息中找到有效的小红书链接: ${e.msg}`);
            return true;
        }
        const iddata = await getXiaohongshuID(url);
        await new Xiaohongshu(e, iddata).XiaohongshuHandler(iddata);
        await recordParseStatistics(e, 'xiaohongshu');
        return true;
    }
    /**
     * 处理BGM音频上传功能
     * @param {any} e 事件对象
     * @returns {Promise<boolean>} 处理结果
     */
    async uploadRecord(e) {
        try {
            const musicId = e.msg.match(/BGM(\d+)/)?.[1];
            if (!musicId) {
                await e.reply('未找到有效的音乐ID');
                return false;
            }
            const data = await douyinFetcher.fetchMusicInfo({
                music_id: musicId,
                typeMode: 'strict'
            }, Config.cookies.douyin, buildAmagiRequestConfig());
            if (!isDouyinMusicData(data)) {
                await e.reply('获取音乐数据失败，可能是音乐ID错误或网络问题');
                return false;
            }
            const { title, play_url } = data.data.music_info;
            const music_url = play_url.uri;
            const musicInfo = `《${title}》\n${music_url}`;
            await e.reply(`正在上传: ${musicInfo}`);
            // UploadRecord 对 bot 的要求比通用消息事件更窄，运行时仍是同一个宿主事件对象。
            const uploadEvent = e;
            await e.reply(await UploadRecord(uploadEvent, music_url, 0, !Config.douyin.sendHDrecord));
            return true;
        }
        catch (error) {
            logger.error('上传音乐记录时发生错误:', error);
            await e.reply('处理音乐时发生错误，请稍后重试');
            return false;
        }
    }
    /**
     * 处理B站番剧选集功能
     * @param {any} e 事件对象
     * @returns {Promise<boolean>} 处理结果
     */
    async next(e) {
        const stored = bilibiliSelections.get(getSelectionKey(e));
        const episode = e.msg.match(/第(\d+)集/)?.[1];
        if (!stored || !episode)
            return true;
        const iddata = { ...stored, Episode: episode };
        // 这个入口曾经裸调 RESOURCES：RESOURCES 改成向上抛之后异常会直接漏进 Yunzai 的
        // 插件派发层——既拿不到错误卡片，也绕过了本插件的日志上下文采集。后来补了
        // runWithErrorHandler 兜住异常，但仍然不进并发队列、不去重、没有表情回应，
        // 同一集连点两次会真的跑两遍完整解析。现在和主入口一样走 runCoordinatedParse。
        //
        // 指纹目标必须显式给：用户发的是「第3集」，从 e.msg 反推只能拿到集号，
        // 不同番剧的同一集号会撞成同一个任务，其中一个会拿到另一个的结果。
        return await this.runCoordinatedParse(e, 'bilibili', 'B站番剧选集解析', async (event) => {
            await new Bilibili(event, iddata).RESOURCES(iddata);
            return true;
        }, createBilibiliEpisodeTarget(stored, episode));
    }
    /**
     * 录一段直播并上传。
     *
     * 平台判定必须在进协调器**之前**做完：`runCoordinatedParse` 的平台参数会进指纹、
     * 进媒体度量、进错误卡片，猜错等于把 B站 的失败记到抖音账上。
     *
     * 判定复用 `findPlatformConfig` —— 和平台链接规则同一批正则、同一个开关，
     * 所以「链接不是这两家的」和「这个平台的解析被关掉了」在这里是同一个结论：不录。
     * 另写一份域名判据的话，能触发本规则却在这里判不出平台的链接就会静默失败。
     */
    async recordLive(e) {
        const url = extractFirstUrl(e.msg || '');
        if (!url) {
            await e.reply('要在 #kkk录直播 后面带上抖音或B站的直播间链接');
            return true;
        }
        const handler = findPlatformConfig(url)?.handler;
        if (handler !== 'douyin' && handler !== 'bilibili') {
            await e.reply('只能录抖音和B站的直播间，且对应平台的解析开关要开着');
            return true;
        }
        const platform = handler;
        // 指纹目标必须显式给：默认那条会从 e.msg 里抽出这条 URL，于是「录直播」和
        // 「普通解析同一个直播间」算出完全一样的指纹 —— 后发的那个被去重掉、直接拿走
        // 前一个的结果，用户发了录制命令却收到一张直播卡片。
        return await this.runCoordinatedParse(e, platform, platform === 'douyin' ? '抖音直播录制' : 'B站直播录制', async (event) => {
            // 录制成败不能当派发返回值：这里已经回过话了，而返回 false 在宿主那边是
            // 「本插件不认这条消息、继续往后派」（`imageQrCode` 的 return false 就是
            // 这个语义），于是同一条命令还会被后面的插件再答一次。
            await recordLiveRoom(event, platform, url);
            return true;
        }, { type: 'work-id', value: `live-record|${platform}|${url}` });
    }
}
