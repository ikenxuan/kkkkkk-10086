import cfg from '../../../runtime/host/config.js';
import Config from '../../../module/utils/Config.js';
import { getErrorMessage } from '../../../module/utils/error-message.js';
const getBotId = (event) => {
    return (event?.self_id || event?.bot?.uin || event?.bot?.self_id);
};
/**
 * 主人列表必须按 Bot 取，不能用全局那份扁平表。
 *
 * TRSS 的 `cfg.master` 是 `{ "botUin": ["masterId"] }`，而 `cfg.masterQQ` 不带 Bot 归属。
 * 原来先读 masterQQ，就会把 ICQQ 的 QQ 号配到 QQBot 的 self_id 上 —— QQBot 的 user_id
 * 是 openid，于是 `POST /v2/users/<QQ号>/messages` 返回 11255「请求的资源不存在(用户/群已注销)」。
 * 而在那之前错误卡片已经渲染好、并被适配器走 markdown 上传到图床了，
 * 等于每次报错白烧一次 puppeteer 渲染加一次图床上传，最后消息还是发不出去。
 *
 * 规则：`cfg.master` 有内容时以它为准，当前 Bot 没登记主人就不发私聊
 * （与 Base.ts 在 TRSS 上委托 `Bot.sendMasterMsg` 的行为一致，那边本来就只认这张表）；
 * 只填了 masterQQ 的宿主（Miao-Yunzai）行为不变。
 *
 * @param botId 目标 Bot 的账号；取不到时退回不带归属的旧行为
 */
const getMasterList = (botId) => {
    const master = cfg.master;
    if (master && !Array.isArray(master) && Object.keys(master).length > 0) {
        const scoped = master[String(botId)];
        return Array.isArray(scoped) ? scoped.map(String).filter(Boolean) : [];
    }
    // 判「非空」而不是「是数组」：空数组也是数组，写成 isArray 会让第一条抢先返回 []，
    // 把后面的兜底全挡住（新增用例 master 真是数组时也能用 正是踩在这上面）。
    if (Array.isArray(cfg.masterQQ) && cfg.masterQQ.length > 0) {
        return cfg.masterQQ.map(String).filter(Boolean);
    }
    if (Array.isArray(master) && master.length > 0) {
        return master.map(String).filter(Boolean);
    }
    return [];
};
const sendPrivate = async (botId, userId, message) => {
    const bot = botId ? Bot?.[botId] : undefined;
    const friend = bot?.pickFriend?.(userId);
    if (!friend?.sendMsg)
        return false;
    await friend.sendMsg(message);
    return true;
};
/**
 * 这次错误有没有人收得到卡片。
 *
 * 三个 sendErrorToXxx 各自的前置条件之或。用来在 handler 里决定要不要起 puppeteer ——
 * 没人收的时候那张图纯属白烧：渲染要几秒，而且适配器还会顺手把它上传一次图床。
 *
 * @param ctx 错误上下文
 * @returns 至少有一个投递目标可用时为 true
 */
export const hasErrorReportTarget = (ctx) => {
    const sendTo = Config.app.errorLogSendTo;
    if (!sendTo?.length)
        return false;
    if (sendTo.includes('trigger') && ctx.event?.reply)
        return true;
    const botId = getBotId(ctx.event);
    if (!botId)
        return false;
    const masters = getMasterList(botId);
    if (masters.length === 0)
        return false;
    return sendTo.includes('master') || sendTo.includes('allMasters');
};
/**
 * 把错误卡片发给触发者。
 *
 * 返回「触发者到底收到没有」：调用方要靠它决定还要不要补那条 `处理失败：...` 纯文字。
 * 原来这里是 void，于是卡片已经发到触发者眼前了，调用方还是照发一遍文字，
 * 同一个错误在同一个会话里出现两次。
 */
export const sendErrorToTrigger = async (ctx, message) => {
    if (!ctx.event || !Config.app.errorLogSendTo?.includes('trigger'))
        return false;
    try {
        await ctx.event.reply(message);
        return true;
    }
    catch (error) {
        logger.error(`[ErrorHandler] 发送错误消息给触发者失败: ${getErrorMessage(error)}`);
        return false;
    }
};
export const sendErrorToMaster = async (ctx, message) => {
    if (!Config.app.errorLogSendTo?.includes('master'))
        return false;
    const botId = getBotId(ctx.event);
    const master = getMasterList(botId)[0];
    if (!master || !botId)
        return false;
    try {
        return await sendPrivate(botId, master, message);
    }
    catch (error) {
        logger.error(`[ErrorHandler] 发送错误消息给主人失败: ${getErrorMessage(error)}`);
        return false;
    }
};
export const sendErrorToAllMasters = async (ctx, message) => {
    if (!Config.app.errorLogSendTo?.includes('allMasters'))
        return false;
    const botId = getBotId(ctx.event);
    if (!botId)
        return false;
    let delivered = false;
    for (const master of new Set(getMasterList(botId))) {
        try {
            if (await sendPrivate(botId, master, message))
                delivered = true;
        }
        catch (error) {
            logger.error(`[ErrorHandler] 发送错误消息给主人 ${master} 失败: ${getErrorMessage(error)}`);
        }
    }
    return delivered;
};
