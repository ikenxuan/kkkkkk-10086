import { createRequire } from 'node:module';
import Config from '../../../module/utils/Config.js';
import { buildUserAgentHeader } from '../../../module/platform/common/userAgent.js';
import { DEFAULT_REQUEST_TIMEOUT_MS, runWithRequestGuard } from '../../../module/utils/RequestGuard.js';
const require = createRequire(import.meta.url);
let defaultDependencies;
/** amagi 的 package exports 在 Vite 下解析失败，沿用 Base.ts 的 CommonJS 兜底 */
const getDefaultDependencies = () => {
    if (!defaultDependencies) {
        const amagi = require('@ikenxuan/amagi');
        defaultDependencies = {
            getEnglishMethodName: amagi.getEnglishMethodName,
            methodMap: amagi.BilibiliMethodToFetcher,
            fetcher: amagi.bilibiliFetcher
        };
    }
    return defaultDependencies;
};
const buildRequestConfig = () => ({
    timeout: Config.request?.timeout || 15000,
    // 只在配置的 UA 明确比 amagi 内置的更新时才覆盖；否则交回给 amagi。
    // 直接写 `'User-Agent': Config.request?.['User-Agent']` 有两个坑：这个 key 一旦存在就会
    // 覆盖 amagi 随版本更新的 UA，而 amagi 的 Sec-Ch-Ua 是从 UA 派生的，UA 落后会让整组
    // 客户端提示自相矛盾（B站 gaia 风控正看这个）；值为 undefined 时更糟，spread 之后
    // headers['User-Agent'] 是显式 undefined，axios 会发自己的 UA 或不带 UA。
    headers: {
        ...buildUserAgentHeader('bilibili')
    },
    proxy: Config.request?.proxy?.switch
        ? { host: Config.request.proxy.host, port: Number(Config.request.proxy.port), protocol: Config.request.proxy.protocol, auth: Config.request.proxy.auth }
        : false
});
const normalizeArgs = (arg1, arg2) => {
    if (typeof arg1 === 'string') {
        return {
            cookie: arg1,
            options: arg2 || {}
        };
    }
    return {
        cookie: Config.cookies.bilibili || '',
        options: arg1 || {}
    };
};
/**
 * 兼容已移除的 amagi v5 `getBilibiliData` API。
 * 插件内部保留旧调用形态，内部改为分发到 v6 fetcher 方法。
 *
 * @param method 旧版 amagi 使用的中文方法名
 * @param arg1 Cookie 或请求参数
 * @param arg2 当 arg1 为 Cookie 时的请求参数
 * @param dependencies 可注入的方法解析、映射与 fetcher，缺省使用真实 amagi
 */
export const getBilibiliData = async (method, arg1, arg2, dependencies = getDefaultDependencies()) => {
    const fetcherMethod = dependencies.getEnglishMethodName('bilibili', method) || dependencies.methodMap[method];
    const fetcher = fetcherMethod ? dependencies.fetcher[fetcherMethod] : undefined;
    if (!fetcherMethod || typeof fetcher !== 'function') {
        throw new Error(`Unsupported Bilibili API method: ${method}`);
    }
    const { cookie, options } = normalizeArgs(arg1, arg2);
    return await runWithRequestGuard(async (signal) => await fetcher(options, cookie, {
        ...buildRequestConfig(),
        signal
    }), {
        timeoutMs: Math.min(Config.request?.amagiTimeout ?? DEFAULT_REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS),
        maxRetries: Config.request?.amagiMaxRetries
    });
};
