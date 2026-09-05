import fs from 'node:fs';
import { join } from 'node:path';
import { buildAmagiRequestConfig, douyinFetcher, isSmsCodeVerifyWay } from '../../../module/utils/amagiClient.js';
import { getErrorMessage } from '../../../module/utils/error-message.js';
import { isRecord } from '../../../module/utils/record.js';
import { readImageBytes } from '../../../module/utils/imagePayload.js';
import { resolveTriggerAvatarUrl } from '../../../module/utils/avatar.js';
import { Common, Config, Render } from '../../../module/utils/index.js';
/**
 * 下面五个阈值原样取自上游 3cf285ae（`platform/douyin/login.ts`），逐条的来历：
 *
 * - {@link SCAN_TIMEOUT}：上游按「消息可撤回窗口」定的 2 分钟。
 * - {@link CONFIRM_TIMEOUT}、{@link CODE_INPUT_TIMEOUT}、{@link CODE_MAX_ATTEMPTS}：
 *   上游没写理由，这里也不替它编一个，只记下取值与出处。
 * - {@link REQUIRED_COOKIES}：上游列的六个键，缺任何一个都只是告警而非失败 ——
 *   抖音并非每次登录都下发全部六个。
 */
/** 等待用户扫码的时限上限，与消息可撤回窗口（2 分钟）对齐；二维码本身更早失效时以它为准 */
const SCAN_TIMEOUT = 120_000;
/** 扫码后等待手机确认或完成二次验证的时限 */
const CONFIRM_TIMEOUT = 180_000;
/** 等待用户回填短信验证码的时限（秒） */
const CODE_INPUT_TIMEOUT = 90;
/** 短信验证码允许的重试次数 */
const CODE_MAX_ATTEMPTS = 3;
/** 6 位数字验证码 */
const CODE_PATTERN = /^\d{6}$/;
/** 登录凭证里需要确认下发的关键 cookie */
const REQUIRED_COOKIES = ['sessionid', 'sessionid_ss', 'sid_guard', 'uid_tt', 'uid_tt_ss', 'ttwid'];
/**
 * 跑一步 passport 调用，把失败折成一句给用户看的话。
 *
 * 四个方法都挂在 `douyinFetcher` 上、因而过了 `wrapAmagiClient`：业务失败是**抛出来**的
 * `AmagiError`，不是上游那种带 `success` 的返回值。而登录的每一步失败要给出各自的提示，
 * 全交给最外层 catch 会塌成同一句「登录过程出错」，所以逐步接住。
 * @param label 出现在提示里的步骤名
 * @param call 实际调用
 */
const step = async (label, call) => {
    try {
        return { ok: true, value: await call() };
    }
    catch (error) {
        logger.error(`[抖音登录] ${label}失败`, error);
        return { ok: false, message: `${label}失败：${getErrorMessage(error)}` };
    }
};
const getMessageId = (msg) => {
    if (!isRecord(msg))
        return undefined;
    return msg.message_id || msg.messageId;
};
/**
 * 登录过程中发出的消息，全部登记在这里，结束时统一撤回，避免二维码留在群里
 * @param e 消息事件
 */
const createMessageTracker = (e) => {
    const messageIds = [];
    return {
        /**
         * 发送并登记一条消息
         * @param message 消息内容
         */
        async send(message) {
            const sent = await e.reply(message, true);
            const id = getMessageId(sent);
            if (id)
                messageIds.push(id);
            return sent;
        },
        /** 撤回目前登记的全部消息 */
        async recallAll() {
            const pending = messageIds.splice(0, messageIds.length);
            await Promise.all(pending.map(async (id) => {
                try {
                    await e.bot?.recallMsg?.(e, id);
                }
                catch (error) {
                    logger.debug(`[抖音登录] 撤回消息失败: ${getErrorMessage(error)}`);
                }
            }));
        }
    };
};
/**
 * 处理账号二次验证：发短信验证码 → 等用户回填 → 提交
 * @param session 登录会话，验证过程中会刷新其中的 cookie
 * @param verify 轮询下发的验证上下文
 * @param tracker 消息登记器
 * @param waitForCode 取验证码的交互回调
 * @returns 验证是否通过
 */
const handleSecondVerify = async (session, verify, tracker, waitForCode) => {
    // 先确认有人能把验证码递回来。没有交互上下文时发出去的短信没人消费，
    // 白扣一次账号的发码额度。
    if (typeof waitForCode !== 'function') {
        await tracker.send('此次登录需要短信二次验证，但当前运行环境没有验证码输入上下文。请改用「#设置抖音ck」手动保存 ck。');
        return false;
    }
    if (!verify.encryptUid) {
        await tracker.send('账号触发了二次验证，但服务端未下发验证上下文，请稍后重试');
        return false;
    }
    // 服务端给的验证方式因账号而异：普通账号是 mobile_sms_verify，
    // 被判定需要辅助验证的账号是 assist_mobile_sms_verify，两者都是下行短信收码
    const smsWay = verify.verifyWays.find(way => isSmsCodeVerifyWay(way.verifyWay));
    if (verify.verifyWays.length > 0 && !smsWay) {
        const ways = verify.verifyWays.map(way => way.verifyWay).join('、');
        logger.warn(`[抖音登录] 服务端给出的验证方式均不支持: ${ways}`);
        await tracker.send(`账号触发了二次验证，但当前仅支持短信验证码，服务端给出的方式为：${ways}`);
        return false;
    }
    const sent = await step('短信验证码发送', async () => await douyinFetcher.sendPassportVerifyCode({ verify, verify_way: smsWay?.verifyWay, typeMode: 'strict' }, session.cookie, buildAmagiRequestConfig()));
    if (!sent.ok) {
        await tracker.send(sent.message);
        return false;
    }
    const sendResult = sent.value.data;
    session.cookie = sendResult.cookie;
    if (!sendResult.ok) {
        await tracker.send(`短信验证码发送失败：${sendResult.message}`);
        return false;
    }
    const bizTraceId = sendResult.biz_trace_id;
    const verifyWay = sendResult.verify_way;
    logger.mark(`[抖音登录] 二次验证方式: ${verifyWay}`);
    const target = sendResult.mobile || smsWay?.mobile || '扫码设备绑定的手机号';
    let prompt = `此次登录需要二次验证\n6 位数验证码已发送至 ${target}\n请在 ${CODE_INPUT_TIMEOUT} 秒内直接回复该验证码`;
    for (let attempt = 1; attempt <= CODE_MAX_ATTEMPTS; attempt++) {
        const code = (await waitForCode(prompt, CODE_INPUT_TIMEOUT)).trim();
        // 宿主的 awaitContext 超时时自己会先回一句，这里只补「流程到此为止」
        if (!code) {
            await tracker.send('等待验证码超时，登录已取消');
            return false;
        }
        if (!CODE_PATTERN.test(code)) {
            if (attempt === CODE_MAX_ATTEMPTS) {
                await tracker.send('输入格式不正确，登录已取消');
                return false;
            }
            prompt = `请只发送 6 位数字验证码（剩余 ${CODE_MAX_ATTEMPTS - attempt} 次机会）`;
            continue;
        }
        const checked = await step('验证', async () => await douyinFetcher.validatePassportVerifyCode({ verify, code, biz_trace_id: bizTraceId, verify_way: verifyWay, typeMode: 'strict' }, session.cookie, buildAmagiRequestConfig()));
        if (!checked.ok) {
            await tracker.send(checked.message);
            return false;
        }
        const checkResult = checked.value.data;
        session.cookie = checkResult.cookie;
        if (checkResult.ok) {
            logger.mark('[抖音登录] 二次验证通过');
            await tracker.send('验证通过，正在完成登录…');
            return true;
        }
        if (!checkResult.wrongCode || attempt === CODE_MAX_ATTEMPTS) {
            await tracker.send(`验证失败：${checkResult.message}`);
            return false;
        }
        prompt = `验证码错误，请重新发送（剩余 ${CODE_MAX_ATTEMPTS - attempt} 次机会）`;
    }
    return false;
};
/**
 * 保存登录凭证
 * @param cookie 完整登录 cookie
 */
const persistCookie = (cookie) => {
    const present = new Set(cookie.split(';').map(pair => pair.split('=')[0]?.trim() ?? ''));
    const missing = REQUIRED_COOKIES.filter(name => !present.has(name));
    if (missing.length > 0) {
        logger.warn(`[抖音登录] 以下 cookie 未在本次登录中下发：${missing.join(', ')}`);
    }
    Config.modify('cookies', 'douyin', cookie);
    logger.mark('[抖音登录] 登录凭证已保存至 cookies.yaml');
};
/**
 * 抖音扫码登录
 *
 * 协议层在 `@ikenxuan/amagi` 的 passport 接口里，这里只负责与用户的交互和状态流转，
 * 全程不启动浏览器。
 * @param e 消息事件
 * @param options 登录选项
 */
export const dylogin = async (e, options = {}) => {
    const tracker = createMessageTracker(e);
    try {
        await tracker.send('免责声明:\n您将通过扫码完成获取抖音网页端的用户登录凭证（ck），该ck将用于请求抖音 WEB API 接口。\n本BOT不会上传任何有关你的信息到第三方，所配置的 ck 只会用于请求官方 API 接口。\n我方仅提供视频解析及相关抖音内容服务，若您的账号封禁、被盗等处罚与我方无关。\n害怕风险请勿扫码 ~');
        const qrcode = await step('获取二维码', async () => await douyinFetcher.requestPassportQrcode({ typeMode: 'strict' }, undefined, buildAmagiRequestConfig()));
        if (!qrcode.ok) {
            await tracker.recallAll();
            await e.reply(qrcode.message, true);
            return true;
        }
        const qrcodeData = qrcode.value.data;
        const session = { cookie: qrcodeData.cookie, token: qrcodeData.token };
        // expire_time 是绝对 Unix 秒，剩余时长直接用 expires_in
        const validFor = qrcodeData.expires_in;
        logger.mark(`[抖音登录] 二维码已获取，有效期 ${validFor} 秒`);
        const rendered = await Render('douyin/qrcodeImg', {
            share_url: qrcodeData.content,
            avatarUrl: resolveTriggerAvatarUrl(e)
        });
        const qrcodeImage = rendered ? rendered[0] : undefined;
        if (!qrcodeImage)
            throw new Error('生成二维码图片失败');
        // 顺手落一份到 temp：图被适配器吞掉或被撤回后，这是唯一还能拿到二维码的地方
        const qrcodeBytes = readImageBytes(qrcodeImage);
        if (qrcodeBytes) {
            await Common.mkdir(Common.tempDri.default);
            fs.writeFileSync(join(Common.tempDri.default, 'DouyinLoginQrcode.png'), new Uint8Array(qrcodeBytes));
        }
        await tracker.send(rendered);
        // 二维码实际只有约 60 秒有效期，等到 2 分钟才提示超时会让用户白等
        let deadline = Date.now() + (validFor > 0 ? Math.min(validFor * 1000, SCAN_TIMEOUT) : SCAN_TIMEOUT);
        let scanned = false;
        while (Date.now() < deadline) {
            const polled = await step('轮询二维码状态', async () => await douyinFetcher.checkPassportQrcode({ token: session.token, typeMode: 'strict' }, session.cookie, buildAmagiRequestConfig()));
            if (!polled.ok) {
                await tracker.recallAll();
                await e.reply(polled.message, true);
                return true;
            }
            const result = polled.value.data;
            session.cookie = result.cookie;
            switch (result.status) {
                case 'new':
                    break;
                case 'scanned':
                    if (!scanned) {
                        scanned = true;
                        deadline = Date.now() + CONFIRM_TIMEOUT;
                        await tracker.recallAll();
                        await tracker.send('二维码已扫码，请在手机上授权以登录');
                    }
                    break;
                case 'verify': {
                    const passed = await handleSecondVerify(session, result.verify, tracker, options.waitForCode);
                    if (!passed) {
                        await tracker.recallAll();
                        return true;
                    }
                    deadline = Date.now() + CONFIRM_TIMEOUT;
                    break;
                }
                case 'confirmed':
                    if (!result.logged_in) {
                        await tracker.recallAll();
                        await e.reply('已确认登录，但服务端未下发登录凭证，请稍后重试', true);
                        return true;
                    }
                    persistCookie(result.cookie);
                    await tracker.recallAll();
                    await e.reply('登录成功！用户登录凭证已保存至cookies.yaml', true);
                    return true;
                case 'expired':
                    await tracker.recallAll();
                    await e.reply('二维码已失效，请重新发起登录', true);
                    return true;
                case 'busy':
                    // 服务端限频，parser 已经把间隔翻倍，这里只记录不打扰用户
                    logger.debug(`[抖音登录] 轮询被限频，${result.interval} ms 后重试: ${result.message}`);
                    break;
                case 'risk':
                    logger.warn(`[抖音登录] 命中风控: ${result.message}`);
                    await tracker.recallAll();
                    await e.reply(`登录请求被抖音风控拦截：${result.message}\n请稍后再试`, true);
                    return true;
                case 'unknown':
                    logger.warn(`[抖音登录] 未知的轮询状态: ${result.message}`);
                    break;
            }
            await Common.sleep(result.interval);
        }
        await tracker.recallAll();
        await e.reply(scanned ? '等待手机确认超时，登录已取消' : '登录超时！二维码已失效！', true);
    }
    catch (error) {
        logger.error('[抖音登录] 登录流程出错', error);
        await tracker.recallAll();
        await e.reply('登录过程出错，请查看控制台日志', true);
    }
    return true;
};
