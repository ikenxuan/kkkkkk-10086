import { AsyncLocalStorage } from 'node:async_hooks';
const storage = new AsyncLocalStorage();
/**
 * 单次解析最多收集多少条媒体记录。
 *
 * 32 是给图集留的余量：一次抖音图集解析可能出几十张图，其中的实况图各自带视频。
 * 超出的部分只丢记录、不丢已收集的，也不抛错 —— 统计不该把解析弄挂。
 */
const MAX_RECORDS = 32;
/**
 * 把平台给的时长归一到毫秒。
 *
 * 单位在各平台是不一致的，这是这个功能最容易错的地方：
 * - 抖音 `video.duration` 是**毫秒**（模板 douyin/video-work 的 formatDuration 就是除 1000）
 * - B站 `data.duration` 是**秒**（fetchVideoDanmakuList 的 JSDoc 写明「单位秒」，
 *   而且它拿弹幕的秒数直接和它比大小）
 *
 * 所以调用点必须用 `fromSeconds` / `fromMilliseconds` 明确单位，别传裸数字。
 *
 * 非有限值、负值、0 一律当「没有时长」返回 undefined：0 既可能是真的没拿到
 * （`video?.duration || 0` 这种写法遍布平台代码），也可能是接口没给，
 * 记成 0 会把平均时长的分母污染掉。
 */
const normalizeDuration = (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
        return undefined;
    return Math.round(value);
};
/** 秒 -> 毫秒。B站、ffprobe 的时长走这个 */
export const fromSeconds = (seconds) => {
    const normalized = normalizeDuration(seconds);
    return normalized === undefined ? undefined : normalized * 1000;
};
/** 毫秒 -> 毫秒（只做校验）。抖音、快手的时长走这个 */
export const fromMilliseconds = (ms) => normalizeDuration(ms);
/**
 * 在一个媒体度量作用域里跑 `fn`，返回它的结果和收集到的记录。
 *
 * 不吞异常：`fn` 抛出时照原样往上抛，但已经收集到的记录仍然通过 `onSettled` 交出去 ——
 * 解析失败前已经发出去的媒体是真发出去了，不该因为后续步骤失败就不算。
 */
export const runWithMediaMetrics = async (platform, fn, onSettled) => {
    const state = {
        platform,
        records: [],
        maxRecords: MAX_RECORDS,
        dropped: 0
    };
    try {
        return await storage.run(state, fn);
    }
    finally {
        if (state.dropped > 0) {
            logger.debug(`[统计] 媒体记录超过 ${state.maxRecords} 条，丢弃了 ${state.dropped} 条`);
        }
        // 上报本身不该影响解析结果：这里的异常只记日志
        try {
            await onSettled(state.records);
        }
        catch (error) {
            logger.error('[统计] 媒体度量落库失败', error);
        }
    }
};
/**
 * 上报一条媒体记录。作用域外调用是空操作。
 *
 * 时长请用 `fromSeconds` / `fromMilliseconds` 转好再传，别传裸数字（单位见那两个函数）。
 */
export const reportMedia = (record) => {
    const state = storage.getStore();
    if (!state)
        return;
    if (state.records.length >= state.maxRecords) {
        state.dropped += 1;
        return;
    }
    state.records.push({
        kind: record.kind,
        durationMs: normalizeDuration(record.durationMs),
        bytes: normalizeDuration(record.bytes)
    });
};
/** 当前作用域的平台；作用域外返回 undefined。给需要按平台分流的上报点用 */
export const getMediaMetricsPlatform = () => storage.getStore()?.platform;
