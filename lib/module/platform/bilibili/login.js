import { Common, Config, Render } from '../../../module/utils/index.js';
import { getBilibiliData } from './api.js';
import * as QRCode from 'qrcode';
import fs from 'node:fs';
import { isRecord } from '../../../module/utils/record.js';
/**
 * 按路径读取 amagi 响应里的字段。
 *
 * `getBilibiliData` 的返回值是 `unknown`，而旧实现直接写 `resp.data.data.url` 连续取值，
 * 中间层缺失时会抛 TypeError。这里保持「取不到就抛」：申请二维码阶段没有 try/catch，
 * 异常继续向调用方冒泡；轮询阶段的异常仍被循环内的 catch 接住并提示重试。
 */
const readPath = (value, path) => {
    let current = value;
    for (const key of path) {
        if (!isRecord(current)) {
            throw new TypeError(`B站登录接口返回结构异常：读取 ${path.join('.')} 失败`);
        }
        current = current[key];
    }
    return current;
};
/** 读取指定路径上的字符串，类型不符时按结构异常抛出 */
const readString = (value, path) => {
    const found = readPath(value, path);
    if (typeof found !== 'string') {
        throw new TypeError(`B站登录接口返回结构异常：${path.join('.')} 不是字符串`);
    }
    return found;
};
/**
 * 取回复消息的 id。
 *
 * 只读 `message_id`：douyin/login.ts 还会回退到 `messageId`，但本文件的旧实现没有，
 * 迁移阶段不改变可撤回消息的范围。
 */
const getMessageId = (msg) => {
    return isRecord(msg) ? msg.message_id : undefined;
};
/**
 * 处理哔哩哔哩登录流程
 * @param e 消息对象
 */
export const bilibiliLogin = async (e) => {
    /** 申请二维码 */
    const qrcodeurl = await getBilibiliData('申请二维码', { typeMode: 'strict' }); // 获取二维码URL
    const shareUrl = readString(qrcodeurl, ['data', 'data', 'url']);
    const qrimg = await QRCode.toDataURL(shareUrl); // 将二维码URL转换为base64图片
    const base64Data = qrimg ? qrimg.replace(/^data:image\/\w+;base64,/, '') : ''; // 提取base64数据
    const buffer = Buffer.from(base64Data, 'base64'); // 将base64数据转换为Buffer
    fs.writeFileSync(`${Common.tempDri.default}BilibiliLoginQrcode.png`, new Uint8Array(buffer)); // 将二维码图片保存到临时目录
    const qrcode_key = readString(qrcodeurl, ['data', 'data', 'qrcode_key']); // 获取二维码的key
    const messageIds = []; // 存储消息ID的数组
    // 发送免责声明和二维码
    const disclaimerMsg = await e.reply('免责声明:\n您将通过扫码完成获取哔哩哔哩网页端的用户登录凭证（ck），该ck将用于请求哔哩哔哩WEB API接口。\n本BOT不会上传任何有关你的信息到第三方，所配置的 ck 只会用于请求官方 API 接口。\n我方仅提供视频解析及相关哔哩哔哩内容服务,若您的账号封禁、被盗等处罚与我方无关。\n害怕风险请勿扫码 ~'); // 发送免责声明
    const qrcodeMsg = await e.reply(await Render('bilibili/qrcodeImg', { share_url: shareUrl }), true);
    const qrcodeMsgId = getMessageId(qrcodeMsg);
    messageIds.push(getMessageId(disclaimerMsg), qrcodeMsgId); // 将消息ID存入数组
    /**
     * 批量撤回消息
     */
    const recallMessages = async () => {
        await Promise.all(messageIds.filter(id => id).map(async (id) => {
            try {
                await e.bot?.recallMsg?.(e, id);
            }
            catch { }
        }));
    };
    /**
     * 处理登录成功
     * @param responseData 登录响应数据
     */
    const handleLoginSuccess = async (responseData) => {
        // readPath 只校验中间层是不是对象，末端取不到就是 undefined。旧实现把这个 undefined
        // 原样交给 Config.modify，yaml 落成 `bilibili: null`，然后照样回「凭证已保存」——
        // 用户以为登录好了，解析时却报「请配置CooKie后重试」。这里改成写之前先确认拿到了东西。
        const setCookie = readPath(responseData, ['data', 'data', 'headers', 'set-cookie']);
        const cookie = (Array.isArray(setCookie)
            ? setCookie.filter(item => typeof item === 'string').join('; ')
            : typeof setCookie === 'string' ? setCookie : '').trim();
        if (!cookie) {
            // 不打印 responseData：这个响应里正常情况下就带着 cookie，
            // 打进日志等于把凭证写进磁盘。只报「哪个路径没取到」足够定位。
            logger.error('[B站登录] 扫码已确认，但 data.data.headers.set-cookie 没取到内容，cookies.yaml 未改动');
            await e.reply('扫码已确认，但没能从响应里取到登录凭证，cookies.yaml 未改动。请重试，或用「#设置B站ck」手动填入。', true);
            await recallMessages();
            return;
        }
        Config.modify('cookies', 'bilibili', cookie);
        await e.reply('登录成功！用户登录凭证已保存至cookies.yaml', true);
        await recallMessages();
    };
    /**
     * 处理二维码已扫描但未确认
     */
    const handleQrScanned = async () => {
        const scannedMsg = await e.reply('二维码已扫码，未确认', true);
        messageIds.push(getMessageId(scannedMsg));
        // 撤回原二维码消息
        try {
            if (qrcodeMsgId) {
                await e.bot?.recallMsg?.(e, qrcodeMsgId);
            }
        }
        catch { }
        // 从消息ID列表中移除已撤回的消息
        const index = messageIds.indexOf(qrcodeMsgId);
        if (index > -1) {
            messageIds.splice(index, 1);
        }
    };
    /**
     * 处理二维码失效
     */
    const handleQrExpired = async () => {
        await e.reply('二维码已失效', true);
        await recallMessages();
    };
    /** 轮询二维码状态 */
    let hasScanned = false;
    while (true) {
        try {
            const qrcodeStatusData = await getBilibiliData('二维码状态', { qrcode_key, typeMode: 'strict' });
            const rawStatusCode = readPath(qrcodeStatusData, ['data', 'data', 'data', 'code']);
            // 旧实现用 switch 严格比较数字，非数字一律落到 default（继续轮询），这里保持一致
            const statusCode = typeof rawStatusCode === 'number' ? rawStatusCode : undefined;
            switch (statusCode) {
                case 0: // 登录成功
                    await handleLoginSuccess(qrcodeStatusData);
                    return;
                case 86038: // 二维码失效
                    await handleQrExpired();
                    return;
                case 86090: // 二维码已扫描，未确认
                    if (!hasScanned) {
                        await handleQrScanned();
                        hasScanned = true;
                    }
                    break;
                case 86101: // 未扫描
                default:
                    // 继续轮询
                    break;
            }
            await Common.sleep(3000);
        }
        catch (error) {
            console.error('轮询二维码状态时发生错误:', error);
            await e.reply('登录过程中发生错误，请重试', true);
            await recallMessages();
            return;
        }
    }
};
