import { createRequire } from 'node:module';
import Config from '../../../module/utils/Config.js';
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
    headers: {
        'User-Agent': Config.request?.['User-Agent']
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
    return await runWithRequestGuard(async (signal) => await fetcher(options, cookie, {
        ...buildRequestConfig(),
        signal
    }), {
        timeoutMs: Math.min(Config.request?.amagiTimeout ?? DEFAULT_REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS),
        maxRetries: Config.request?.amagiMaxRetries
    });
};
