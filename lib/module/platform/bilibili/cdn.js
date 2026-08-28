/**
 * B站 CDN 地址改写：在接口给的地址之外**造**出可用地址。
 *
 * ## 和 CdnRegistry 的分工
 *
 * `module/utils/CdnRegistry.ts` 只会在接口给出的地址里重新排序 —— 接口一条能用的都没给时
 * 它无能为力。而 B站 恰好有这种情况：请求「看起来没有身份」时 `base_url` 和整个
 * `backup_url[]` 会**全部**指向 PCDN（`*.mcdn.bilivideo.cn` / `*.szbdyd.com`），
 * 这类域名把节点 IP 编进了主机名，只在国内走运营商 DNS 才解析得出来，
 * 挂代理或境外机器上一律 `getaddrinfo ENOENT`。
 *
 * 这个模块补的就是那一步：把主机名换成公网可达的 upos 镜像，于是**手上一条都不能用的时候
 * 仍然造得出能用的地址**。
 *
 * ## 为什么换主机名不会让签名失效
 *
 * B站 的鉴权参数（`upsig` / `uparams` / `deadline` …）是 upos 边缘节点按**路径**校验的，
 * 与主机名无关。所以 `https://A/upgcxcode/...?upsig=x` 换成 `https://B/upgcxcode/...?upsig=x`
 * 照样过 —— 前提是 B 也是 upos 体系里的镜像。云崽本体的 rconsole 插件用的就是这招
 * （`utils/bilibili.js` 的 `replaceP2PUrl`），线上跑了很久，这里沿用它验证过的映射关系。
 *
 * 反过来说，**只能换到 upos 镜像**。往任意主机上套是没有意义的：那台机器根本不认这套签名。
 */
/** upos 镜像主机名模板。`{}` 处填运营商代号。 */
const UPOS_TEMPLATE = 'upos-sz-mirror{}.bilivideo.com';
const upos = (code) => UPOS_TEMPLATE.replace('{}', code);
/**
 * 可用的 upos 镜像，按「一般情况下的可用性」排序。
 *
 * 顺序只是**没有测速数据时**的默认偏好。开了测速（`Config.upload.cdnLatencyProbe`）之后
 * 由实测延迟决定用哪个，这个顺序就只作为并列时的 tie-break。
 *
 * 名字沿用 B站 自己的运营商代号：`cos`=腾讯云、`bd`=百度云、`hw`=华为云、
 * `ali`=阿里云、`akam`=Akamai（海外）、`08c`=网宿。带 `o1` 后缀的是同一家的另一组机房，
 * rconsole 的 `replaceP2PUrl` 专挑这一组，因为它们对 PCDN 回源最稳。
 */
export const BILIBILI_UPOS_MIRRORS = Object.freeze([
    upos('coso1'),
    upos('cos'),
    upos('alio1'),
    upos('hwo1'),
    upos('bd'),
    upos('hw'),
    upos('aliov'),
    upos('08c')
]);
/** PCDN 主机名：把节点 IP 编进域名，只在国内运营商 DNS 下解析得出来。 */
const PCDN_HOST = /(^|\.)(mcdn\.bilivideo\.cn|szbdyd\.com)$/i;
/** 已经是 upos 镜像的主机名。 */
const UPOS_HOST = /^upos-[a-z]{2}-(mirror|estgoss)/i;
/**
 * 运营商直连节点，形如 `cn-jsnt-ct-01-07.bilivideo.com`。
 *
 * 这类节点公网可达（和 PCDN 不同），但常常是被限速的那一批 —— 用户日志里
 * 0.1 MB/s 的那次就落在这上面。所以不当成坏地址剔掉，只在排序上让它靠后。
 */
const PROVINCIAL_HOST = /^cn(-[a-z]+){2}(-\d{2}){2}\.bilivideo\.com$/i;
/** 这个地址是 PCDN 吗。 */
export const isBilibiliPcdnUrl = (url) => {
    try {
        return PCDN_HOST.test(new URL(url).hostname);
    }
    catch {
        return false;
    }
};
/** 这个地址是省级直连节点吗（公网可达但容易被限速）。 */
export const isBilibiliProvincialUrl = (url) => {
    try {
        return PROVINCIAL_HOST.test(new URL(url).hostname);
    }
    catch {
        return false;
    }
};
/**
 * 把地址的主机名换成指定的 upos 镜像，路径与查询串（也就是整套签名）原样保留。
 *
 * 端口一并清掉：PCDN 地址常带着 `:4483` 之类的非标端口，换主机后那个端口没有意义。
 *
 * @param url 原地址
 * @param mirror 目标 upos 主机名
 * @returns 改写后的地址；原地址解析不了时返回 null
 */
export const rewriteToUposMirror = (url, mirror) => {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
            return null;
        parsed.protocol = 'https:';
        parsed.hostname = mirror;
        parsed.port = '';
        return parsed.toString();
    }
    catch {
        return null;
    }
};
/**
 * `*.szbdyd.com` 这类 PCDN 地址自带的逃生口。
 *
 * 它的查询串里有个 `xy_usource` 参数，值就是真正的上游主机名 —— B站 自己留的回源信息。
 * 拿它换掉主机名比套一个我们猜的镜像更准：那是 B站 认定的这条地址的源站。
 *
 * @param url 原地址
 * @returns 改写后的地址；没有这个参数或解析失败时返回 null
 */
export const rewriteToUpstreamSource = (url) => {
    try {
        const parsed = new URL(url);
        const source = parsed.searchParams.get('xy_usource');
        if (!source)
            return null;
        // 参数值必须像个主机名。这是外部数据，直接往 hostname 上塞会把畸形值带进请求。
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(source))
            return null;
        parsed.protocol = 'https:';
        parsed.hostname = source;
        parsed.port = '';
        return parsed.toString();
    }
    catch {
        return null;
    }
};
/**
 * 把接口给的地址列表扩成完整的候选清单。
 *
 * 四个来源，按可信度排：
 *
 * 1. **接口原样给的公网地址**（upos 镜像、akamai 这些）—— B站 自己选的，最可信。
 * 2. **省级直连节点** —— 公网可达但容易被限速，放在公网镜像后面。
 * 3. **改写出来的地址** —— PCDN 地址的 `xy_usource` 逃生口优先，其次是套 upos 镜像。
 * 4. **PCDN 原地址** —— 垫在最后。
 *
 * 第 4 类留着而不是剔掉，是因为「解析不出来」只是**本机**的情况：跑在国内运营商网络上时
 * PCDN 恰恰是最快的一条（B站 把地址指过去就是为了这个）。而排在最后意味着只有前面每一条
 * 都失败了才会碰它 —— DNS 失败是即时的，代价约等于零，换来的是「本机能解析」那批部署
 * 不会白丢掉最优路径。
 *
 * @param urls 接口给的地址（`base_url` 加 `backup_url[]`）
 * @param mirrors 可用的镜像列表，默认 {@link BILIBILI_UPOS_MIRRORS}；
 *   传入按实测延迟排好的列表就能让改写地址也跟着测速结果走
 * @param mirrorLimit 最多套几个镜像。默认 2 —— 每个镜像都是一次潜在的重试，
 *   全套上去会把重试预算耗在猜地址上
 */
export const expandBilibiliCdnCandidates = (urls, mirrors = BILIBILI_UPOS_MIRRORS, mirrorLimit = 2) => {
    const usable = [];
    const provincial = [];
    const rewritten = [];
    const pcdn = [];
    for (const url of urls) {
        if (typeof url !== 'string' || url.length === 0)
            continue;
        if (isBilibiliPcdnUrl(url)) {
            pcdn.push(url);
            continue;
        }
        if (isBilibiliProvincialUrl(url))
            provincial.push(url);
        else
            usable.push(url);
    }
    // PCDN 地址逐个找逃生口：先看它自带的 xy_usource，再套镜像
    for (const url of pcdn) {
        const upstream = rewriteToUpstreamSource(url);
        if (upstream !== null)
            rewritten.push(upstream);
    }
    // 套镜像只需要一条源地址：所有 PCDN 地址的路径都指向同一份文件，
    // 每条都套一遍只会产出一堆主机名相同、路径也相同的重复地址。
    const seed = pcdn[0] ?? provincial[0];
    if (seed !== undefined) {
        for (const mirror of mirrors.slice(0, Math.max(0, mirrorLimit))) {
            const candidate = rewriteToUposMirror(seed, mirror);
            if (candidate !== null)
                rewritten.push(candidate);
        }
    }
    const ordered = [...usable, ...provincial, ...rewritten, ...pcdn];
    // 去重，保持首次出现的次序
    const seen = new Set();
    return ordered.filter(url => {
        const host = (() => {
            try {
                return new URL(url).host + new URL(url).pathname;
            }
            catch {
                return url;
            }
        })();
        if (seen.has(host))
            return false;
        seen.add(host);
        return true;
    });
};
/**
 * 已经是 upos 镜像的地址不必改写。判定用在「要不要为这条地址造备胎」上。
 */
export const isUposMirrorUrl = (url) => {
    try {
        return UPOS_HOST.test(new URL(url).hostname);
    }
    catch {
        return false;
    }
};
