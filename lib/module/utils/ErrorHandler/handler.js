import { EmojiReactionManager } from '../../../module/utils/EmojiReaction.js';
import { getAdapterInfo } from './adapter.js';
import { createLogContext, parseLogsToStructured } from './log-context.js';
import { renderErrorReport } from './render.js';
import { hasErrorReportTarget, sendErrorToAllMasters, sendErrorToMaster, sendErrorToTrigger } from './sender.js';
import { getStrategies } from './strategy.js';
import { getBuildMetadata } from '../../../module/tooling/build-metadata.js';
export const handleBusinessError = async (error, options, logs = [], event) => {
    const ctx = {
        error,
        options,
        logs,
        event,
        buildMetadata: getBuildMetadata(),
        adapterInfo: getAdapterInfo(event)
    };
    for (const strategy of getStrategies()) {
        try {
            if (!strategy.match(ctx))
                continue;
            const result = await strategy.handle(ctx);
            if (result === 'handled')
                return 'handled';
        }
        catch (strategyError) {
            logger.error(`[ErrorHandler] 策略 ${strategy.name} 执行失败: ${getErrorMessage(strategyError)}`);
        }
    }
    // 没有任何收件人时不要起 puppeteer。errorLogSendTo 默认只有 master，而按 Bot 取不到主人时
    // （比如 QQBot 没在宿主 other.yaml 的 master 里登记）这张卡片没人收得到，
    // 渲完还会被适配器走 markdown 顺手上传一次图床 —— 白烧两笔开销。
    if (hasErrorReportTarget(ctx)) {
        const report = await renderErrorReport(ctx);
        const message = Array.isArray(report) ? report : [report];
        await sendErrorToTrigger(ctx, message);
        await sendErrorToMaster(ctx, message);
        await sendErrorToAllMasters(ctx, message);
    }
    else {
        logger.debug('[ErrorHandler] 没有可投递的收件人，跳过错误卡片渲染');
    }
    if (options.customErrorHandler) {
        await options.customErrorHandler(error, logs);
    }
    return undefined;
};
export const wrapWithErrorHandler = (fn, options) => {
    return async (event, next = () => undefined) => {
        const emojiManager = options.emojiReaction !== false && event
            ? new EmojiReactionManager(event)
            : null;
        let processingTimer = null;
        let successTimer = null;
        if (emojiManager) {
            await emojiManager.add('EYES');
            processingTimer = setTimeout(() => {
                emojiManager.add('PROCESSING').catch(() => { });
            }, 1500);
        }
        const logContext = createLogContext();
        try {
            const result = await logContext.run(() => fn(event, next));
            if (emojiManager) {
                successTimer = setTimeout(() => {
                    emojiManager.replace('PROCESSING', 'SUCCESS').catch(() => { });
                }, 1500);
            }
            return result;
        }
        catch (error) {
            if (processingTimer)
                clearTimeout(processingTimer);
            if (successTimer)
                clearTimeout(successTimer);
            if (emojiManager) {
                if (emojiManager.has('PROCESSING'))
                    await emojiManager.remove('PROCESSING');
                await emojiManager.add('ERROR');
            }
            logger.error(`[${options.businessName}] 执行失败`, error);
            const logs = parseLogsToStructured(logContext.logs());
            const result = await handleBusinessError(error, options, logs, event);
            if (result !== 'handled') {
                await event?.reply?.(`处理失败：${getErrorMessage(error)}`);
            }
            if (options.rethrowAfterHandle)
                throw error;
            return true;
        }
        finally {
            logContext.destroy();
        }
    };
};
function getErrorMessage(error) {
    if (typeof error === 'object' && error !== null && 'message' in error && error.message) {
        return String(error.message);
    }
    return String(error);
}
