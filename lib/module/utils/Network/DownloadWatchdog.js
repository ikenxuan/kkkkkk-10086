/**
 * 低速看守：盯住「一直在动、但慢得没有意义」的下载。
 *
 * ## 为什么现有的看守拦不住
 *
 * `Networks.attemptDownloadStream` 里那个 `stuckCheckInterval` 判的是
 * `Date.now() - lastChunkTime > 30000` —— **完全断流**才算异常。而 B站 限速时
 * 数据是一直在来的（用户日志里稳定 0.1 MB/s，32MB 要下 5 分半），`lastChunkTime`
 * 每秒都在刷新，所以那个看守永远不会响。两个看守盯的是两件事，都要留着：
 * 断流是「连接死了」，低速是「连接活着但被掐着脖子」。
 *
 * ## 判定要满足三个条件才动手
 *
 * 重启一次下载的代价是把已经建立的连接和（跨主机时）已下载的字节都扔掉，所以
 * 宁可晚判、不可误判：
 *
 * 1. **过了宽限期**：TLS 握手 + TTFB + TCP 慢启动本来就慢，头几秒的速率没有意义。
 * 2. **持续低于地板速**：按滑动累计判，而不是单次采样。一次采样撞上对端的一个
 *    停顿就重启，是把抖动当故障。
 * 3. **剩下的量还值得重启**：快下完时重启纯亏 —— 见 {@link MIN_REMAINING_BYTES}。
 *
 * ## 自己开采样定时器，不蹭进度回调
 *
 * 进度回调是**由字节到达驱动**的（`transform` 里攒够 2 秒才回调一次），拿它当采样源
 * 会在最需要判定的场景下失灵：速率越低，回调越稀，判定越迟。所以看守只接受
 * 「当前累计字节数」这一个输入，由调用方用独立的 `setInterval` 喂进来。
 */
/** 采样间隔：2 秒。和进度回调的节流窗口同宽，日志上看到的那一行和判定用的是同一个尺度。 */
export const SAMPLE_INTERVAL_MS = 2000;
/**
 * 宽限期：8 秒。
 *
 * 覆盖冷握手最坏的情况 —— `platform/douyin/workType.ts` 记过自己拼
 * `aweme.snssdk.com` 时冷握手要 5.7 秒。把宽限期设在它之上，才不会把「还在握手」
 * 当成「被限速」。
 */
export const DEFAULT_GRACE_MS = 8000;
/**
 * 持续低速多久才判定：20 秒。
 *
 * 取够长的窗口是为了排除对端的短暂停顿；但也不能长到失去意义 ——
 * 20 秒在 0.1 MB/s 下只下了 2MB，此时重启还来得及。
 */
export const DEFAULT_SUSTAIN_MS = 20000;
/**
 * 剩这么点就不重启了：2 MB。
 *
 * 就算真被限在 0.1 MB/s，2MB 也只剩 20 秒；而重启要重新握手、并且跨主机时还要
 * 丢掉已下的字节。收尾阶段判定「慢」在算术上成立，动手却一定是亏的。
 */
export const MIN_REMAINING_BYTES = 2 * 1024 * 1024;
export const DEFAULT_SLOW_FLOOR_BYTES = 256 * 1024;
const NOT_TRIGGERED = (bytesPerSecond, slowForMs) => ({
    triggered: false,
    bytesPerSecond,
    slowForMs
});
/**
 * 判定只**报告**，不做任何副作用：中断连接、记账、重试都由调用方决定。
 * 这样它才能在单测里被逐个采样地驱动，而不需要真开一条 HTTP 连接。
 *
 * @param options 地板速与各个窗口
 */
export const createSlowSpeedGuard = (options) => {
    const floor = Math.max(0, Number(options.floorBytesPerSecond) || 0);
    const graceMs = options.graceMs ?? DEFAULT_GRACE_MS;
    const sustainMs = options.sustainMs ?? DEFAULT_SUSTAIN_MS;
    const minRemainingBytes = options.minRemainingBytes ?? MIN_REMAINING_BYTES;
    let startedAt = -1;
    let lastAt = -1;
    let lastBytes = 0;
    let slowForMs = 0;
    /** 判定过一次就闭嘴，等 reset()。否则同一次低速会在每个采样点重复触发。 */
    let latched = false;
    return {
        reset: (now) => {
            startedAt = now;
            lastAt = now;
            lastBytes = 0;
            slowForMs = 0;
            latched = false;
        },
        sample: ({ downloadedBytes, totalBytes, now }) => {
            // 地板速为 0 表示关掉看守
            if (floor <= 0 || latched)
                return NOT_TRIGGERED(0, slowForMs);
            if (startedAt < 0) {
                startedAt = now;
                lastAt = now;
                lastBytes = downloadedBytes;
                return NOT_TRIGGERED(0, 0);
            }
            const elapsed = now - lastAt;
            // 时间没走（同一毫秒内两次采样，或者时钟被回拨）时不产出速率：
            // 拿 0 当间隔算速率会得到 Infinity 或 NaN，两者都会让判定失去意义。
            if (elapsed <= 0)
                return NOT_TRIGGERED(0, slowForMs);
            const delta = Math.max(0, downloadedBytes - lastBytes);
            const bytesPerSecond = delta / (elapsed / 1000);
            lastAt = now;
            lastBytes = downloadedBytes;
            // 宽限期内只更新基线，不累计
            if (now - startedAt < graceMs)
                return NOT_TRIGGERED(bytesPerSecond, 0);
            if (bytesPerSecond >= floor) {
                slowForMs = 0;
                return NOT_TRIGGERED(bytesPerSecond, 0);
            }
            slowForMs += elapsed;
            if (slowForMs < sustainMs)
                return NOT_TRIGGERED(bytesPerSecond, slowForMs);
            // 收尾豁免：总量未知时（totalBytes <= 0）不豁免，因为算不出剩多少
            const remaining = totalBytes > 0 ? totalBytes - downloadedBytes : Number.POSITIVE_INFINITY;
            if (remaining < minRemainingBytes)
                return NOT_TRIGGERED(bytesPerSecond, slowForMs);
            latched = true;
            return { triggered: true, bytesPerSecond, slowForMs };
        }
    };
};
/** 低速中断专用的错误码。让上层能把「我们自己掐掉的」和别的取消区分开。 */
export const SLOW_DOWNLOAD_ABORT_CODE = 'KKK_DOWNLOAD_TOO_SLOW';
export const isSlowDownloadAbort = (error) => typeof error === 'object' && error !== null &&
    (Reflect.get(error, 'code') === SLOW_DOWNLOAD_ABORT_CODE ||
        Reflect.get(error, 'kkkSlowAbort') === true);
/**
 * 标记打在两个地方（`code` 和 `kkkSlowAbort`）是有意的：`AbortController.abort()`
 * 之后 axios 会把自己的 `ERR_CANCELED` 盖在 `code` 上，`kkkSlowAbort` 这个自有字段
 * 才是能穿过 `toAxiosError()` 的那一份。
 *
 * @param bytesPerSecond 判定时观测到的速率
 * @param floorBytesPerSecond 当时的地板速
 */
export const createSlowDownloadError = (bytesPerSecond, floorBytesPerSecond) => {
    const toKb = (value) => `${(value / 1024).toFixed(0)}KB/s`;
    return Object.assign(new Error(`下载速度持续低于下限（${toKb(bytesPerSecond)} < ${toKb(floorBytesPerSecond)}）`), { code: SLOW_DOWNLOAD_ABORT_CODE, kkkSlowAbort: true });
};
