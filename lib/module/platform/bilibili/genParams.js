import { createRequire } from 'node:module';
import { bilibiliFetcher, buildAmagiRequestConfig } from '../../../module/utils/amagiClient.js';
import Config from '../../../module/utils/Config.js';
import { isRecord } from '../../../module/utils/record.js';
const require = createRequire(import.meta.url);
let wbiSign;
/** amagi 的 package exports 在 Vite 下解析失败，沿用 Base.ts 的 CommonJS 兜底 */
const getWbiSign = () => {
    wbiSign ??= require('@ikenxuan/amagi').wbi_sign;
    return wbiSign;
};
const readVipStatus = (value) => {
    if (!isRecord(value))
        return undefined;
    const data = isRecord(value.data) ? value.data : undefined;
    const inner = isRecord(data?.data) ? data.data : undefined;
    return typeof inner?.vipStatus === 'number' ? inner.vipStatus : undefined;
};
/**
 * @param apiURL 请求地址
 */
export async function genParams(apiURL) {
    // 「没配置」只有空串这一种表示，归一化在 Config.cookies getter 里做（见那边的注释）
    if (Config.cookies.bilibili === '')
        return '&platform=html5';
    /** 保留原有的直接取值方式：响应结构异常时同样抛出错误交给调用方 */
    const loginInfo = await bilibiliFetcher.fetchLoginStatus({}, Config.cookies.bilibili, buildAmagiRequestConfig());
    const genSign = await getWbiSign()(apiURL, Config.cookies.bilibili);
    const qn = [6, 16, 32, 64, 74, 80, 112, 116, 120, 125, 126, 127];
    let isvip;
    loginInfo.data.data.vipStatus === 1 ? (isvip = true) : (isvip = false);
    if (isvip) {
        return `&fnval=16&fourk=1&${genSign}`;
    }
    else
        return `&qn=${qn[3]}&fnval=16`;
}
/**
 * 检查B站Cookie的有效性和VIP状态
 *
 * @returns 返回包含登录状态和VIP状态的对象
 *
 * @throws 当API调用失败时可能抛出错误
 *
 */
export async function checkCk() {
    // （「没配置」只有空串这一种表示，归一化在 Config.cookies getter 里做）
    if (Config.cookies.bilibili === '') {
        return { Status: '!isLogin', isVIP: false };
    }
    const loginInfo = await bilibiliFetcher.fetchLoginStatus({}, Config.cookies.bilibili, buildAmagiRequestConfig());
    // 判断VIP状态：vipStatus为1表示是VIP用户
    const isVIP = readVipStatus(loginInfo) === 1;
    // 注意：无论是否是VIP，只要Cookie有效就返回已登录状态
    return {
        Status: 'isLogin',
        isVIP
    };
}
