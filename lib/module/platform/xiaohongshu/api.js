import { createRequire } from 'node:module';
import Config from '../../../module/utils/Config.js';
import { buildUserAgentHeader } from '../../../module/platform/common/userAgent.js';
import { SOFT_ERROR_CODES, softFetch } from '../../../module/platform/common/softError.js';
import { withApiCache } from '../../../module/utils/ApiCache.js';
import { DEFAULT_REQUEST_TIMEOUT_MS, runWithRequestGuard } from '../../../module/utils/RequestGuard.js';
const require = createRequire(import.meta.url);
let defaultDependencies;
/** amagi 的 package exports 在 Vite 下解析失败，沿用现有平台 wrapper 的 CommonJS 兜底 */
const getDefaultDependencies = () => {
    if (!defaultDependencies) {
        const amagi = require('@ikenxuan/amagi');
        defaultDependencies = {
            methodMap: amagi.XiaohongshuMethodToFetcher,
            fetcher: amagi.xiaohongshuFetcher
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
        ...buildUserAgentHeader('xiaohongshu')
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
        cookie: Config.cookies.xiaohongshu || '',
        options: arg1 || {}
    };
};
/**
 * 兼容旧版中文方法名并统一通过 RequestGuard 调用 amagi v6 原始 fetcher。
 * 每次尝试都获得独立 AbortSignal，单次硬超时最多一分钟，网络错误按配置重试。
 */
export const getXiaohongshuData = async (method, arg1, arg2, dependencies = getDefaultDependencies()) => {
    const fetcherMethod = dependencies.methodMap[method];
    const fetcher = fetcherMethod ? dependencies.fetcher[fetcherMethod] : undefined;
    if (!fetcherMethod || typeof fetcher !== 'function') {
        throw new Error(`Unsupported Xiaohongshu API method: ${method}`);
    }
    const { cookie, options } = normalizeArgs(arg1, arg2);
    // 缓存在最外层：命中直接返回，不进 softFetch / RequestGuard。白名单外的方法、
    // 关掉 cacheEnabled、参数序列化不了这三种情况下 withApiCache 就是一层透传。
    return await withApiCache({ platform: 'xiaohongshu', method, cookie, options }, async () => await softFetch(async () => await runWithRequestGuard(async (signal) => await fetcher(options, cookie, {
        ...buildRequestConfig(),
        signal
    }), {
        timeoutMs: Math.min(Config.request?.amagiTimeout ?? DEFAULT_REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS),
        maxRetries: Config.request?.amagiMaxRetries
    }), SOFT_ERROR_CODES.xiaohongshu));
};
