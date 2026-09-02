/**
 * CDN 测速：下载前先探一遍候选节点，按实测结果决定用哪个。
 *
 * ## 为什么要主动测，而不是等失败
 *
 * `CdnRegistry` 是**被动**的：它记住哪个主机拒绝过我们，下次把它排后面。代价是
 * 每条坏地址都要靠一次真实失败换来经验，而一次失败在用户那边就是一次「解析失败」。
 *
 * （`utils/bilibili.js` 里的 `fastCdnPatterns` / `slowCdnPatterns`），根本不测。
 * 那张名单在作者的网络上是对的 —— 但「哪个 CDN 快」取决于**用户自己的**出口线路：
 * 电信用户的最快节点在联通用户那里可能是最慢的，挂了代理的机器上更是完全另一套排序。
 * 写死等于把作者的网络环境当成所有人的。
 *
 * 所以这里实测。判定的是**用户这台机器到这些节点**的真实表现，名单再也不需要维护。
 *
 * ## 一次探测同时拿两个信号
 *
 * 探测请求带 `Range: bytes=0-N`，于是一次往返就能读出：
 *
 * - **首字节时间（TTFB）**：DNS 解析、建连、TLS 握手、以及节点自己的响应速度。
 *   PCDN 域名解析不出来、节点 403/404、主机不可达，全都在这一步暴露 —— 这正是
 *   「随机撞到坏 CDN」那个问题的**提前**发现。
 * - **样本吞吐**：读完这 N 字节花了多久。限速是吞吐问题不是延迟问题
 *   （被限在 0.1 MB/s 的节点握手可能很快），所以光测延迟抓不到用户遇到的那个毛病。
 *
 * 排序以吞吐为主、TTFB 为辅：吞吐才是决定 32MB 要下多久的量。
 *
 * ## 成本与缓存
 *
 * 每个节点花掉一次往返加 `sampleBytes` 字节（默认 64KB）。结果按**主机名**缓存 ——
 * 「我到这台机器有多快」是主机与本机线路的性质，跟下的是哪个视频无关，所以下一个
 * 作品能直接复用。TTL 取 10 分钟：够长到一次会话里只测一遍，够短到线路变化能被跟上。
 */
import axios from 'axios';
/** 探测样本大小：64KB。够算出有意义的吞吐，又不至于让测速本身变成一笔流量开销。 */
export const DEFAULT_SAMPLE_BYTES = 64 * 1024;
/** 单个节点的探测超时：5 秒。超过这个数的节点，就算最后能下完也不值得优先用。 */
export const DEFAULT_PROBE_TIMEOUT_MS = 5000;
/** 探测结果的缓存时长：10 分钟。 */
export const PROBE_TTL_MS = 10 * 60 * 1000;
/** 缓存容量上限，防止长期运行的实例无界增长。 */
const PROBE_CAPACITY = 128;
const cache = new Map();
const readHost = (url) => {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
            return null;
        return parsed.hostname.toLowerCase();
    }
    catch {
        return null;
    }
};
const remember = (host, result, now) => {
    cache.delete(host);
    cache.set(host, { result, expiresAt: now + PROBE_TTL_MS });
    while (cache.size > PROBE_CAPACITY) {
        const oldest = cache.keys().next();
        if (oldest.done)
            break;
        cache.delete(oldest.value);
    }
};
const recall = (host, now) => {
    const entry = cache.get(host);
    if (!entry)
        return undefined;
    if (entry.expiresAt <= now) {
        cache.delete(host);
        return undefined;
    }
    return entry.result;
};
/**
 * 探一个地址。永不抛错 —— 探测失败本身就是一条有用的结论，不该打断调用方。
 *
 * @param url 要探测的地址
 * @param options 请求头、代理与各个上限
 */
export const probeCdnUrl = async (url, options = {}) => {
    const host = readHost(url) ?? '';
    const sampleBytes = options.sampleBytes ?? DEFAULT_SAMPLE_BYTES;
    const timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            signal: controller.signal,
            timeout: 0,
            maxRedirects: 5,
            decompress: false,
            proxy: options.proxy,
            // 只要头部就能算 TTFB，但要算吞吐必须真读几个字节，所以用 Range 限量取。
            // 不用 HEAD：upos 节点对 HEAD 的支持不一致，而且 HEAD 没有响应体，测不出吞吐。
            headers: { ...options.headers, Range: `bytes=0-${Math.max(0, sampleBytes - 1)}` },
            validateStatus: () => true
        });
        const ttfbMs = Date.now() - startedAt;
        const status = response.status;
        // 4xx/5xx 直接判失败：这条地址现在就是不能用，读不读它的响应体都一样。
        if (status >= 400) {
            response.data.destroy?.();
            return { url, host, ok: false, ttfbMs, bytesPerSecond: 0, status, error: `HTTP ${status}` };
        }
        let received = 0;
        await new Promise((resolve, reject) => {
            response.data.on('data', (chunk) => {
                received += chunk.length;
                if (received >= sampleBytes) {
                    response.data.destroy?.();
                    resolve();
                }
            });
            response.data.on('end', () => resolve());
            response.data.on('close', () => resolve());
            response.data.on('error', reject);
        });
        const totalMs = Math.max(1, Date.now() - startedAt);
        // 吞吐只按「读body的那段时间」算，把握手时间摘出去：握手是一次性成本，
        // 而我们要预测的是接下来几十兆的持续速率。
        const bodyMs = Math.max(1, totalMs - ttfbMs);
        return {
            url,
            host,
            ok: received > 0,
            ttfbMs,
            bytesPerSecond: received > 0 ? received / (bodyMs / 1000) : 0,
            status
        };
    }
    catch (error) {
        const code = typeof error === 'object' && error !== null ? Reflect.get(error, 'code') : undefined;
        return {
            url,
            host,
            ok: false,
            ttfbMs: Date.now() - startedAt,
            bytesPerSecond: 0,
            error: typeof code === 'string' ? code : String(error)
        };
    }
    finally {
        clearTimeout(timer);
    }
};
/**
 * 成功的一律排在失败的前面；成功者之间比吞吐（高的在前），吞吐打平（差在 5% 以内，
 * 属于测量噪声）时比 TTFB。失败者之间比 TTFB —— 快速失败的（比如立刻 403）
 * 比慢慢超时的更不值得再试，所以慢的反而排前面。
 */
const compareProbes = (a, b) => {
    if (a.ok !== b.ok)
        return a.ok ? -1 : 1;
    if (!a.ok)
        return b.ttfbMs - a.ttfbMs;
    const faster = Math.max(a.bytesPerSecond, b.bytesPerSecond);
    const gap = Math.abs(a.bytesPerSecond - b.bytesPerSecond);
    if (faster > 0 && gap / faster > 0.05)
        return b.bytesPerSecond - a.bytesPerSecond;
    return a.ttfbMs - b.ttfbMs;
};
/**
 * 并发探测：串行探 4 个节点在最坏情况下要 4 倍超时，那点排序收益抵不上让用户多等。
 *
 * 只探前 `limit` 个，剩下的原样接在后面 —— 它们本来就是备胎的备胎，
 * 为它们测速是把用户的等待花在几乎用不到的排名上。
 *
 * 全部探测都失败时返回**原始顺序**而不是探测排序：那种情况通常是本机网络断了或者
 * 代理挂了，不是这些节点各有优劣，此时按「谁失败得更慢」排序是在噪声上做决策。
 *
 * @param urls 候选地址，按调用方的偏好排好
 * @param options 请求头、代理与上限
 */
export const probeAndOrderCdnUrls = async (urls, options = {}) => {
    const limit = options.limit ?? 4;
    const now = options.now ?? Date.now();
    const head = urls.slice(0, Math.max(0, limit));
    const tail = urls.slice(Math.max(0, limit));
    if (head.length <= 1)
        return [...urls];
    const results = await Promise.all(head.map(async (url) => {
        const host = readHost(url);
        if (host === null)
            return { url, host: '', ok: false, ttfbMs: 0, bytesPerSecond: 0, error: 'bad url' };
        const cached = recall(host, now);
        if (cached)
            return { ...cached, url };
        const result = await probeCdnUrl(url, options);
        remember(host, result, now);
        return result;
    }));
    if (!results.some(result => result.ok)) {
        logger.debug('[CDN测速] 所有候选节点都探测失败，保持原有顺序');
        return [...urls];
    }
    const ordered = [...results].sort(compareProbes);
    const best = ordered[0];
    if (best?.ok) {
        const speed = `${(best.bytesPerSecond / 1024).toFixed(0)}KB/s`;
        logger.debug(`[CDN测速] ${results.length} 个节点，选中 ${best.host}（${speed}, TTFB ${best.ttfbMs}ms）`);
    }
    return [...ordered.map(result => result.url), ...tail];
};
/**
 * 当前的测速缓存快照。顺手清掉过期条目。
 *
 * @param now 判定时刻，测试用
 */
export const getCdnProbeSnapshot = (now = Date.now()) => {
    const entries = [];
    for (const [host, cached] of cache) {
        if (cached.expiresAt <= now) {
            cache.delete(host);
            continue;
        }
        entries.push({
            host,
            ok: cached.result.ok,
            kbPerSecond: Math.round(cached.result.bytesPerSecond / 1024),
            ttfbMs: cached.result.ttfbMs
        });
    }
    return {
        hosts: cache.size,
        entries: entries.sort((first, second) => second.kbPerSecond - first.kbPerSecond)
    };
};
/** 清空测速缓存。测试用。 */
export const resetCdnProbe = () => {
    cache.clear();
};
