import { Render } from '../../../module/utils/Render.js';
import Version from '../../../module/utils/Version.js';
import { formatBuildTime } from '../../../module/tooling/build-metadata.js';
export const normalizeError = (error) => ({
    name: getErrorProperty(error, 'name') || 'Error',
    message: getErrorProperty(error, 'message') || stringifyUnknown(error),
    stack: getErrorProperty(error, 'stack') || ''
});
/**
 * 平台名收窄成错误卡片契约认的那几个。
 *
 * 我们的 `Platform` 多一个 `xiaohongshu`，而契约那份 `ApiErrorData['platform']` 只有
 * douyin / bilibili / kuaishou / system / unknown —— 已核对上游同名文件，上游本来就没加，
 * 而 ktr/ 是上游镜像目录，不在这边改。
 *
 * 模板压根没渲染这个字段（只渲染 `adapterInfo.platform`），落到 'unknown' 不影响出图。
 * 刻意不写返回类型标注：契约类型在 ktr/ 里，src/ 这个 program 的 rootDir 是 ./src，
 * 引进来就是 TS6059，手抄一份联合类型早晚漂移，交给 TS 从 case 分支推断。
 * 等上游补上这个成员，这个函数直接删掉即可。
 */
export const toErrorCardPlatform = (platform) => {
    switch (platform) {
        case 'douyin':
        case 'bilibili':
        case 'kuaishou':
        case 'system':
            return platform;
        default:
            return 'unknown';
    }
};
/** 空值和空串都算「这个场景没有这个字段」，统一收敛成 undefined，好让下游只判一种「没有」 */
const presentOrUndefined = (value) => value === null || value === '' ? undefined : value;
/**
 * 会话群号，私聊场景返回 undefined。
 *
 * 为什么判定放这一层而不是模板里：「什么算私聊」是宿主事件形状的知识（哪个字段、几种拼写），
 * 属于数据层；模板只该看「这条信息在不在」。旧实现用 `|| 'private'` 兜底，
 * 把「这里没有群」写成了一个看起来像群号的占位串，私聊出的图上就是「群: private」，
 * 读起来像解析出错，反而盖住了真正要看的错误。
 *
 * `isPrivate` 是宿主 loader 注入的布尔，`is_private` 是 OneBot 原始字段，两种拼写都认；
 * 都没有时退回「有没有 group_id」—— 主动推送连事件对象都没有，同样落到 undefined。
 *
 * 只读 snake_case：camelCase 的 `groupId` 全宿主（lib/、7 个适配器、其余协议插件）
 * 无一处产生，`@kaguyajs/trss-yunzai-types` 也只声明 snake_case，那层兼容是防御一个
 * 不存在的形状，删掉。
 */
const resolveGroupId = (event) => {
    if (event?.isPrivate === true || event?.is_private === true)
        return undefined;
    return presentOrUndefined(event?.group_id);
};
/**
 * 触发者用户号，主动推送场景返回 undefined。
 *
 * 定时推送由 cron 触发，`push.ts` 的 createPushTask 是 `handler(undefined)` —— 压根没有事件对象，
 * 也就不存在「触发用户」这回事。旧实现 `|| 'unknown'` 让卡片多出一行「用户: unknown」，
 * 看着像取用户失败，其实是这个场景本就没有用户。
 * （`testPush.ts` 走的是 `handler(e)`，那是主人手敲命令触发的，有真实触发者，这行照常渲染。）
 */
const resolveUserId = (event) => {
    return presentOrUndefined(event?.user_id ?? event?.sender?.user_id);
};
/**
 * 群 / 用户这类合成条目不是真日志行，没有发生时刻，所以时间戳给空串。
 *
 * 契约里 `LogEntry.timestamp` 是必填 string，而模板那边是 `log.timestamp ? <legend> : null`，
 * 空串走的正是「不渲染时间胶囊」这条分支 —— 和现在线上的表现一模一样，
 * 只是把「字段缺失」换成了「字段为空」，契约就能过。
 *
 * 两行各自按「拿到 id 了才生成」处理，于是「隐藏某一行」不需要模板配合：模板本来就是
 * `data.logs.map`，条目不在数组里那一行就不存在。契约那边 `logs` 已经是可选数组，
 * 少一条不用改 ApiErrorData。
 *
 * 刻意不写返回类型标注：`LogEntry` 是 ktr/ 里的模板契约，src/ 这个 program 的 rootDir 是
 * ./src，引进来就是 TS6059（同 toErrorCardPlatform）。交给 TS 推断，`Render()` 调用点
 * 照样能拿契约校验这个数组。
 */
export const buildContextLogEntries = (groupId, userId) => {
    return [
        groupId === undefined ? null : { timestamp: '', level: 'INFO', message: `群: ${groupId}`, raw: `群: ${groupId}` },
        userId === undefined ? null : { timestamp: '', level: 'INFO', message: `用户: ${userId}`, raw: `用户: ${userId}` }
    ].filter((entry) => entry !== null);
};
/**
 * 从事件对象直接算出该渲染哪几行上下文。
 *
 * 错误卡片有两个调用点（本文件的 renderErrorReport，和 `Base.ts` 的 buildApiErrorImage），
 * 场景判定必须是同一套，否则同一张模板在两条路径上会给出不一样的行。把「解析事件 + 生成条目」
 * 收成一个入口，调用点就不用各自复制一遍 group_id/isPrivate 的取值规则。
 */
export const buildEventContextLogEntries = (event) => buildContextLogEntries(resolveGroupId(event), resolveUserId(event));
export const buildErrorMessage = (ctx) => {
    const error = normalizeError(ctx.error);
    const groupId = resolveGroupId(ctx.event);
    const userId = resolveUserId(ctx.event);
    return [
        `KKK业务执行出错: ${ctx.options.businessName}`,
        `错误: ${error.name}: ${error.message}`,
        // 文本回退跟卡片共用同一套场景判定：渲染挂了的时候这条是唯一的信息载体，
        // 不该比卡片多出「群: private」这种占位行。空串会被下面的 filter(Boolean) 丢掉。
        groupId === undefined ? '' : `群: ${groupId}`,
        userId === undefined ? '' : `用户: ${userId}`,
        `插件: ${Version.pluginName}@${Version.version}`,
        error.stack ? `堆栈:\n${error.stack.split('\n').slice(0, 8).join('\n')}` : ''
    ].filter(Boolean).join('\n');
};
export const renderErrorReport = async (ctx, extras = {}) => {
    const error = normalizeError(ctx.error);
    try {
        return await Render('other/handlerError', {
            ...extras,
            type: 'business_error',
            platform: toErrorCardPlatform(ctx.options.platform),
            method: ctx.options.businessName,
            timestamp: new Date().toISOString(),
            triggerCommand: ctx.event?.msg || '',
            frameworkVersion: Version.BotVersion,
            pluginVersion: Version.version,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
                businessName: ctx.options.businessName
            },
            logs: [
                ...ctx.logs.slice().reverse(),
                ...buildEventContextLogEntries(ctx.event)
            ],
            buildTime: ctx.buildMetadata?.buildTime ? formatBuildTime(ctx.buildMetadata.buildTime) : undefined,
            commitHash: ctx.buildMetadata?.shortCommitHash || ctx.buildMetadata?.commitHash,
            adapterInfo: ctx.adapterInfo
        });
    }
    catch (renderError) {
        logger.warn(`[ErrorHandler] 错误图片渲染失败，使用文本回退: ${normalizeError(renderError).message}`);
        return buildErrorMessage(ctx);
    }
};
function getErrorProperty(error, property) {
    if (typeof error !== 'object' || error === null)
        return '';
    try {
        const value = Reflect.get(error, property);
        return value ? stringifyUnknown(value) : '';
    }
    catch {
        return '';
    }
}
function stringifyUnknown(value) {
    try {
        return String(value);
    }
    catch {
        return Object.prototype.toString.call(value);
    }
}
