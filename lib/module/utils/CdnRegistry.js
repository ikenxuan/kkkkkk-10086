/**
 * CDN 地址簿：记住同一份资源的多个下载地址，并记住哪些主机刚刚拒绝过我们。
 *
 * ## 要治的病
 *
 * 各平台的播放接口都给出**多个**下载地址（B站 `base_url` + `backup_url[]`，
 * 抖音 `play_addr.url_list` 恒有 3 条），但本仓库一直只挑一条用：
 * `pickBilibiliStreamUrl` 取第一个非 PCDN 的，`pickDouyinPlayUrl` 取 `url_list[0]`。
 * 挑中的那条要是落到坏节点，表现就是整次解析失败 —— 明明手里还攥着两条没试过的地址。
 *
 * 更要紧的是 `downloadVideo` 开头那次 `getHeaders()` 探体积：403 时它重试三次然后抛，
 * 于是**连下载都没开始**就整条炸掉。用户看到的是「有时候能解析有时候不能」，
 * 实际是负载均衡把他随机分到了坏节点。
 *
 * ## 两层记忆，各有各的寿命
 *
 * 1. **候选清单**（按资源键）：TTL 5 分钟，和 `ApiCache` 的 `detail` 档一致。
 *    这不是巧合 —— 上游签名直链本来就是每 5 分钟由接口重新发一份，缓存活得比它久
 *    只会让我们把过期签名当宝贝端出去。
 * 2. **主机健康**（按 hostname）：惩罚期 10 分钟，跨资源生效。
 *    这一层才是真正能积累经验的地方：`v26-web.douyinvod.com` 拒过一次之后，
 *    下一个作品的候选排序就该把它往后放，而不是等它再拒一次。
 *
 * ## 为什么不按 URL 路径自动分组
 *
 * 试过：镜像地址之间 pathname 确实相同（B站 `/upgcxcode/...`、抖音 `/video/tos/...`），
 * 看着可以省掉调用方传键。但抖音 `url_list[2]` 是 `www.douyin.com/aweme/v1/play/` 这种
 * **所有作品共用**的包装地址，pathname 一模一样 —— 按路径分组会把 A 作品的地址
 * 发给 B 作品。所以键必须由调用方给（它们手上都有 bvid / aweme_id），
 * 给不出键的调用点就只享受主机健康那一层。
 */
import { isRecord } from './record.js';
/**
 * 候选清单的存活时间：5 分钟。
 *
 * 对齐 `ApiCache` 的 `detail` 档不是为了整齐 —— 那正是上游重新签发这批直链的周期。
 * 存得更久等于在接口本来会给出新地址的时候，坚持用旧签名。
 */
export const CDN_CANDIDATE_TTL_MS = 5 * 60 * 1000;
/**
 * 主机惩罚期：10 分钟。
 *
 * 比候选清单长，因为这一层攒的是跨作品的经验。也刻意不长到「半小时」：
 * CDN 节点的故障多是分钟级的（回源抖动、单机满载），惩罚太久等于把一个已经
 * 恢复的好节点一直摁在队尾，反而缩小了可用地址池。
 */
export const CDN_HOST_PENALTY_MS = 10 * 60 * 1000;
/** 地址簿容量。超了按最久未用淘汰，防止长期运行的实例无界增长。 */
export const CDN_REGISTRY_CAPACITY = 256;
const hosts = new Map();
const candidates = new Map();
const readHostname = (url) => {
    try {
        const parsed = new URL(url);
        // 只认 http(s)。别的协议（file:、ftp:）不该出现在下载地址里，
        // 混进来时当成不可用而不是硬塞给下载器 —— 那是本地文件读取的口子。
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
            return null;
        return parsed.hostname.toLowerCase();
    }
    catch {
        return null;
    }
};
/** 这个地址能不能拿去下载：非空、可解析、http(s)。 */
export const isDownloadableUrl = (url) => typeof url === 'string' && url.length > 0 && readHostname(url) !== null;
const trim = (map) => {
    while (map.size > CDN_REGISTRY_CAPACITY) {
        const oldest = map.keys().next();
        if (oldest.done)
            return;
        map.delete(oldest.value);
    }
};
const touch = (map, key, value) => {
    // 重新插入 = 挪到尾部，于是队首始终是最久未用的
    map.delete(key);
    map.set(key, value);
    trim(map);
};
const isPenalized = (host, now) => {
    const health = hosts.get(host);
    if (!health)
        return false;
    if (health.penalizedUntil <= now)
        return false;
    return true;
};
/**
 * 候选地址排序：没被惩罚的排前面，其余保持调用方给的相对次序。
 *
 * 用**稳定分组**而不是打分排序，是因为调用方给的顺序本身携带信息
 * （B站 `base_url` 在前、抖音签名直链在 `url_list[0]`），打分会把这份信息洗掉。
 * 这里只做一件事：把刚刚拒过我们的主机往后挪。
 *
 * 顺带去重（同一主机给了两条一样的地址没有意义）并剔掉非 http(s) 地址。
 *
 * @param urls 调用方按偏好排好的候选地址
 * @param now 判定惩罚期的时刻，测试用
 */
export const orderCdnCandidates = (urls, now = Date.now()) => {
    const seen = new Set();
    const healthy = [];
    const penalized = [];
    for (const url of urls) {
        if (!isDownloadableUrl(url) || seen.has(url))
            continue;
        seen.add(url);
        const host = readHostname(url);
        if (host !== null && isPenalized(host, now))
            penalized.push(url);
        else
            healthy.push(url);
    }
    return [...healthy, ...penalized];
};
/**
 * 记下一份资源的全部候选地址，并返回排序后的清单。
 *
 * 调用方拿返回值去下载即可 —— 记账和排序是同一次调用的两个产物，
 * 分成两步的写法必然有人只调其中一个。
 *
 * @param resource 资源键，必须能唯一标识「哪个作品的哪一路流」，例如 `bili:BV1xx:video`
 * @param urls 接口给出的候选地址，按调用方的偏好排好
 * @param now 记账时刻，测试用
 */
export const rememberCdnCandidates = (resource, urls, now = Date.now()) => {
    const ordered = orderCdnCandidates(urls, now);
    if (resource.length === 0 || ordered.length === 0)
        return ordered;
    touch(candidates, resource, { urls: [...ordered], expiresAt: now + CDN_CANDIDATE_TTL_MS });
    return ordered;
};
/**
 * 取之前记下的候选地址，顺手按当前的主机健康重排。过期或没记过返回空数组。
 *
 * @param resource 资源键
 * @param now 判定时刻，测试用
 */
export const getCdnCandidates = (resource, now = Date.now()) => {
    const entry = candidates.get(resource);
    if (!entry)
        return [];
    if (entry.expiresAt <= now) {
        candidates.delete(resource);
        return [];
    }
    touch(candidates, resource, entry);
    return orderCdnCandidates(entry.urls, now);
};
/**
 * 合并「调用方这次拿到的地址」和「地址簿里还没过期的地址」，去重后排序。
 *
 * 这次拿到的排在前面：它们的签名一定比缓存里的新。缓存里那些只是**补充**，
 * 用在接口这次少给了几条、或者调用方只拿到一条的时候。
 *
 * @param resource 资源键，空串表示这个调用点给不出键，只做排序
 * @param urls 这次从接口拿到的候选地址
 * @param now 判定时刻，测试用
 */
export const resolveCdnCandidates = (resource, urls, now = Date.now()) => {
    const fresh = orderCdnCandidates(urls, now);
    if (resource.length === 0)
        return fresh;
    const remembered = getCdnCandidates(resource, now);
    const merged = rememberCdnCandidates(resource, [...fresh, ...remembered], now);
    return merged;
};
/**
 * 报告一次下载失败，让这个主机进惩罚期。
 *
 * 404 和 403 一起罚：镜像没同步到（404）在 B站 的 `backup_url` 上是真实存在的现象，
 * 换一个镜像就有。真·资源不存在时所有候选都会 404，那时惩罚谁都无所谓 ——
 * 反正这次解析要失败，而 10 分钟后惩罚自己会过期。
 *
 * @param url 失败的下载地址
 * @param kind 失败性质
 * @param now 记账时刻，测试用
 */
export const reportCdnFailure = (url, kind, now = Date.now()) => {
    const host = readHostname(url);
    if (host === null)
        return;
    const existing = hosts.get(host);
    touch(hosts, host, {
        failures: (existing?.failures ?? 0) + 1,
        lastKind: kind,
        penalizedUntil: now + CDN_HOST_PENALTY_MS
    });
};
/**
 * 报告一次下载成功，立刻解除这个主机的惩罚。
 *
 * 立刻解除而不是「慢慢恢复」：既然刚刚真的从它这里下完了东西，
 * 那它现在是好的，没有理由继续把它摁在队尾。
 *
 * @param url 成功的下载地址
 */
export const reportCdnSuccess = (url) => {
    const host = readHostname(url);
    if (host === null)
        return;
    const existing = hosts.get(host);
    if (!existing)
        return;
    touch(hosts, host, { ...existing, penalizedUntil: 0 });
};
/** 这个地址所在的主机当前在惩罚期吗。诊断与测试用。 */
export const isCdnHostPenalized = (url, now = Date.now()) => {
    const host = readHostname(url);
    return host !== null && isPenalized(host, now);
};
/**
 * 只读快照，给 `#kkk版本` 的运行诊断卡消费。顺手清掉过期条目 ——
 * 把已经过期的候选清单算进「记着几份资源」是误导。
 *
 * @param now 判定时刻，测试用
 */
export const getCdnRegistrySnapshot = (now = Date.now()) => {
    for (const [resource, entry] of candidates) {
        if (entry.expiresAt <= now)
            candidates.delete(resource);
    }
    const penalized = [];
    for (const [host, health] of hosts) {
        if (health.penalizedUntil <= now)
            continue;
        penalized.push({
            host,
            failures: health.failures,
            lastKind: health.lastKind,
            penaltyRemainingMs: health.penalizedUntil - now
        });
    }
    return {
        resources: candidates.size,
        hosts: hosts.size,
        penalized: penalized.sort((first, second) => first.host.localeCompare(second.host))
    };
};
/** 清空地址簿。测试用。 */
export const resetCdnRegistry = () => {
    hosts.clear();
    candidates.clear();
};
/**
 * 从各种错误形状里取 HTTP 状态码。axios 风格（`error.response.status`）与裸 `status` 都认。
 *
 * @param error 捕获到的错误
 */
export const readErrorStatus = (error) => {
    if (!isRecord(error))
        return undefined;
    if (typeof error.status === 'number')
        return error.status;
    if (isRecord(error.response) && typeof error.response.status === 'number')
        return error.response.status;
    return undefined;
};
/**
 * 这次失败该不该换一个 CDN 地址重试。
 *
 * 换地址只对「这个节点有问题」有意义。判定按代价不对称来定：
 *
 * - **换**：403/401（拒绝服务）、404/410（这个节点没有这份资源）、
 *   `slow`（持续低速）、以及连不上/握手失败这类没有响应的网络错。
 * - **不换**：429（限流是按 IP 算的，换节点照样被限，而且换了等于绕过重试退避
 *   去打第二个节点，把限流搞得更严）、5xx（源站问题，所有镜像回同一个源）、
 *   本地超时/取消。
 *
 * @param error 捕获到的错误
 * @returns 该换地址时返回失败性质，不该换时返回 null
 */
export const classifyCdnFailure = (error) => {
    const status = readErrorStatus(error);
    if (status !== undefined) {
        if (status === 401 || status === 403)
            return 'blocked';
        if (status === 404 || status === 410)
            return 'missing';
        return null;
    }
    const code = isRecord(error) && typeof error.code === 'string' ? error.code : '';
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ECONNREFUSED' || code === 'EHOSTUNREACH') {
        return 'network';
    }
    return null;
};
