import util from 'node:util';
import { generate } from '@ikenxuan/qrcode';
import { registerErrorStrategy, renderErrorReport, sendErrorToAllMasters, sendErrorToMaster } from '../../../module/utils/ErrorHandler/index.js';
import { getBilibiliData } from './api.js';
import { getErrorMessage } from '../../../module/utils/error-message.js';
import { isRecord } from '../../../module/utils/record.js';
/** 按路径读取嵌套字段，任意一层缺失时返回 undefined */
const readPath = (value, path) => {
    let current = value;
    for (const key of path) {
        if (!isRecord(current))
            return undefined;
        current = current[key];
    }
    return current;
};
/** 读取指定路径上的非空字符串 */
const readString = (value, path) => {
    const found = readPath(value, path);
    return typeof found === 'string' && found ? found : undefined;
};
const getVoucher = (error) => {
    return readString(error, ['data', 'data', 'v_voucher']) ||
        readString(error, ['rawError', 'data', 'data', 'v_voucher']) ||
        readString(error, ['rawError', 'error', 'data', 'data', 'v_voucher']) ||
        readString(error, ['rawError', 'error', 'data', 'v_voucher']);
};
/** amagi 返回结构不固定，逐层向下取 data 作为业务数据 */
const pickPayload = (value) => {
    const nested = readPath(value, ['data', 'data']);
    if (isRecord(nested))
        return nested;
    const data = readPath(value, ['data']);
    if (isRecord(data))
        return data;
    return isRecord(value) ? value : undefined;
};
const createQrImage = (url) => {
    const base64 = generate({
        data: url,
        size: 800,
        dotsOptions: { dotType: 'rounded', color: 'rgba(0, 0, 0, 0.85)' },
        cornersSquareOptions: { cornerType: 'extra-rounded', color: 'rgba(0, 0, 0, 0.85)' },
        cornersDotOptions: { cornerType: 'dot', color: 'rgba(0, 0, 0, 0.85)' },
        backgroundOptions: { transparent: false, color: '#ffffff' }
    }, 'webp', 'base64');
    return globalThis.segment?.image ? globalThis.segment.image(`base64://${base64}`) : `base64://${base64}`;
};
/** csrf 校验失败：ck 本身已经不可用，重试验证码没有意义 */
const CSRF_FAILED_CODE = -111;
/**
 * 取出一次失败的业务错误码。
 *
 * 上游的 amagi 客户端包了一层 Proxy，`success === false` 会被抛成带 `code` 的 AmagiError，
 * 所以上游只需要在 catch 里读 `err.code`。本仓库的 `./api.js` 直接调 amagi v6 fetcher，
 * 失败结果是**原样返回**的（`runWithRequestGuard` 只管超时与重试，不看 success），
 * 于是同一个 -111 在这里既可能是返回值也可能是抛出来的对象 —— 两种形状都得认。
 *
 * 读取层级已按 amagi 源码核对：`createErrorResponse(error, message, code, data)` 把
 * B站原始业务码放在**顶层** `code`（bilibili/internal 里传的是 `rawData.code`），
 * `ErrorResult` 的类型声明也是 `BaseResponse & { success: false, error: APIErrorType }`
 * —— `BaseResponse.code` 就是这一层。`error.code` 是 APIErrorType 上的同名字段，
 * 作为第二顺位兜底；`rawError.code` 覆盖 Base.ts 那条自造错误对象的路径。
 * -111（CSRF_ERROR）在 amagi 的 bilibiliAPIErrorCode 枚举里有登记。
 */
const getFailureCode = (value) => {
    const code = readPath(value, ['code']) ??
        readPath(value, ['error', 'code']) ??
        readPath(value, ['rawError', 'code']);
    // 枚举里的码是字符串字面量（CSRF_ERROR = "-111"），而响应里的是数字，两种都归一成数字
    const numeric = typeof code === 'string' ? Number(code) : code;
    return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : undefined;
};
/**
 * 取出一次失败的可读描述。
 *
 * 与上游 `err.rawError?.errorDescription` 对齐：真正有信息量的那句话在 `error` 子对象里，
 * 顶层 `message` 往往只是「请求失败」。
 */
const getFailureDescription = (value) => {
    return readString(value, ['error', 'errorDescription']) ||
        readString(value, ['error', 'amagiMessage']) ||
        readString(value, ['rawError', 'errorDescription']) ||
        readString(value, ['rawError', 'amagiMessage']) ||
        readString(value, ['message']);
};
const parseVerifyMessage = (msg = '') => {
    const text = String(msg).trim();
    const query = text.includes('?') ? text.slice(text.indexOf('?') + 1) : text;
    const params = new URLSearchParams(query);
    return {
        validate: params.get('validate'),
        seccode: params.get('seccode')
    };
};
/**
 * 回复一次验证失败。
 *
 * 上游对 -111 有专门的提示（见 packages/core/src/platform/bilibili/riskControl.ts），
 * 本仓库原先只回一句「验证失败，请重试。」—— 而 -111 是 csrf 校验失败，
 * 意味着 ck 已经不带有效的 bili_jct，再刷多少次验证码都不会通过，
 * 用户会一直重试到放弃。这里把上游那条分支补回来，并且把接口给的描述带上，
 * 免得其余错误码也退化成一句没有信息量的「请重试」。
 */
const replyVerifyFailure = async (event, failure) => {
    if (getFailureCode(failure) === CSRF_FAILED_CODE) {
        await event?.reply?.('验证失败：当前 ck 的 csrf 校验没通过，建议用「#B站登录」重新配置 ck 以绕过风控。');
        return;
    }
    const description = getFailureDescription(failure) || getErrorMessage(failure);
    await event?.reply?.(`验证失败: ${description}`);
};
export const bilibiliRiskControlStrategy = {
    name: 'BilibiliRiskControl',
    match: ({ error, event }) => {
        return isRecord(error) && error.code === -352 && Boolean(getVoucher(error)) && Boolean(event);
    },
    async handle(ctx) {
        const { error, event, options } = ctx;
        const voucher = getVoucher(error);
        if (!voucher)
            return 'continue';
        // 跟上游一样先确认有人能看到验证码。没有 event 时下面的申请请求纯属白跑一趟，
        // 而且会替用户消耗掉一次 v_voucher（voucher 是一次性的），让他重试时更难通过。
        if (!event)
            return 'continue';
        logger.info('[BilibiliRiskControl] 检测到B站风控(-352)，开始申请验证码');
        const verification = await getBilibiliData('从_v_voucher_申请_captcha', {
            v_voucher: voucher,
            typeMode: 'strict'
        });
        const payload = pickPayload(verification);
        const geetest = isRecord(payload?.geetest) ? payload.geetest : undefined;
        const gt = typeof geetest?.gt === 'string' ? geetest.gt : undefined;
        const challenge = typeof geetest?.challenge === 'string' ? geetest.challenge : undefined;
        const token = typeof payload?.token === 'string' ? payload.token : undefined;
        if (!gt || !challenge || !token) {
            logger.error('[BilibiliRiskControl] 申请验证码失败:', util.inspect(verification, { depth: 2 }));
            return 'continue';
        }
        const verifyUrl = `https://karin-plugin-kkk-docs.vercel.app/geetest?v=3&gt=${gt}&challenge=${challenge}`;
        /**
         * 优先出错误卡片（模板里 `isVerification && verificationUrl` 那块会把二维码画进卡片），
         * 这和上游 `renderErrorImage(ctx, { isVerification: true, verificationUrl })` 是同一条路。
         * 渲染挂了才退回「文字 + 裸二维码 + 链接」——原来只有后者，观感和插件其余出图对不上，
         * 而且纯二维码不带任何上下文，用户不知道这是哪一步要他验证。
         *
         * renderErrorReport 内部渲染失败会返回 buildErrorMessage 的纯文本，那段文本讲的是
         * 「业务出错」而不是「请扫码验证」，对这个场景没有意义，所以这里自己判断并回退，
         * 不直接把它的返回值发出去。
         */
        const card = await renderErrorReport(ctx, { isVerification: true, verificationUrl: verifyUrl });
        // 渲染失败时 renderErrorReport 返回的是纯文本（buildErrorMessage），拿它当卡片发没意义
        const cardRendered = card !== null && card !== undefined && typeof card !== 'string';
        // 写成函数而不是三元里的数组字面量：createQrImage 要现算一张 800px 二维码，
        // 卡片渲出来的时候没必要白算；顺带避开 indent 与 @stylistic/indent 对
        // 「三元分支里的多行数组」缩进要求不一致、--fix 摆不平的问题。
        const buildFallbackMessage = () => [
            '检测到B站风控，请在120秒内扫码完成验证后发送验证结果链接或参数。',
            createQrImage(verifyUrl),
            verifyUrl
        ];
        const message = cardRendered ? [card, verifyUrl] : buildFallbackMessage();
        await event?.reply?.(message);
        await sendErrorToMaster(ctx, message);
        await sendErrorToAllMasters(ctx, message);
        const plugin = options?.plugin;
        if (typeof plugin?.awaitContext !== 'function') {
            await event?.reply?.('当前环境无法等待验证结果，请完成验证后重新发送命令。');
            return 'handled';
        }
        const resultCtx = await plugin.awaitContext(false, 120, '验证超时，请重新发送命令');
        const { validate, seccode } = parseVerifyMessage(readPath(resultCtx, ['msg']));
        if (!validate || !seccode) {
            await event?.reply?.('验证参数不完整，请确保包含 validate 和 seccode。');
            return 'handled';
        }
        try {
            const verifyResult = await getBilibiliData('验证验证码结果', {
                challenge,
                token,
                validate,
                seccode,
                typeMode: 'strict'
            });
            const resultPayload = pickPayload(verifyResult);
            const griskId = resultPayload?.grisk_id;
            // 只认 `success`。amagi 的 `Result<T> = SuccessResult<T> | ErrorResult` 里 `success`
            // 是 discriminant（见 @ikenxuan/amagi 的 index.d.ts：SuccessResult 为 `success: true`
            // 且 `error: never`，ErrorResult 为 `success: false` 且 `data: never`），
            // 而本仓库的 api.ts 原样返回这个信封、不解包，所以声明就是运行时真相。
            // 原来写成 `success || griskId`：失败响应的 data 是 never，正常取不到 grisk_id，
            // 但万一协议端在错误体里回了这个键，就会把一次失败的验证报成「验证成功」，
            // 用户拿着没通过的验证去重发命令，只会再撞一次风控。
            if (isRecord(verifyResult) && verifyResult.success === true) {
                logger.info(`[BilibiliRiskControl] 验证成功，grisk_id: ${String(griskId || 'unknown')}`);
                await event?.reply?.('验证成功，请重新发送命令。');
                return 'handled';
            }
            // 失败是以返回值形态到这里的（见 getFailureCode 的注释），所以走同一套失败处理。
            await replyVerifyFailure(event, verifyResult);
        }
        catch (verifyError) {
            logger.error('[BilibiliRiskControl] 验证请求失败:', verifyError);
            await replyVerifyFailure(event, verifyError);
        }
        return 'handled';
    }
};
registerErrorStrategy(bilibiliRiskControlStrategy);
