/**
 * 抖音评论表情的限时表情补充包。
 *
 * 评论里的 `[xxx]` 靠一张「名字 → 图片」表换成图，而 web 的 `emoji/list` 是一份旧快照：
 * 常驻表情一条不缺，缺的全是限时表情（联名/节日那种几天的窗口，过期后不再下发，
 * 但评论里永远留着）。这里从 App 的资源包通道补上：元信息走 amagi 的
 * `fetchEmojiResourceMeta`（免鉴权，所以 cookie 过期也不影响表情），下载、校验、解包、
 * 合并留在本模块。
 *
 * 两条不能改的判断：只留 `time_limited=1` 的条目（web 那份必然覆盖全部常驻表情，缺口只
 * 可能落在限时里）；索引按 `display_name` 绝不能按 `uri`（有 uri 被两个名字共用，按 uri
 * 去重会丢掉一半别名）。
 *
 * 任何一步失败都归一成「没有补充表」，不影响评论正常渲染。排查经过记在 `NOTES.md`。
 */
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { DataPath } from '../../../dir.js';
import { buildAmagiRequestConfig, douyinGuest } from '../../../module/utils/amagiClient.js';
import { isRecord } from '../../../module/utils/record.js';
const hostLogger = globalThis.logger;
const cacheFile = () => path.join(DataPath, 'douyin-emoji', 'supplement.json');
const readJson = (file) => {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    catch {
        return null;
    }
};
/**
 * 最小 ZIP 读取器：走中央目录，认 `stored`(0) 与 `deflate`(8)，返回 basename → 惰性解压函数。
 * 自己写是因为 pnpm 严格隔离下插件解析不到任何解压库（工作区里那几个都是别的包的传递依赖），
 * 而为一个补充包往 package.json 加依赖会牵动 `pnpm install`。
 */
const readZip = (buf) => {
    let eocd = -1;
    for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0)
        throw new Error('不是合法 zip：找不到 EOCD');
    const out = new Map();
    let p = buf.readUInt32LE(eocd + 16);
    for (let i = buf.readUInt16LE(eocd + 10); i > 0; i--) {
        if (buf.readUInt32LE(p) !== 0x02014b50)
            throw new Error('中央目录项签名不对');
        const method = buf.readUInt16LE(p + 10);
        const csize = buf.readUInt32LE(p + 20);
        const nlen = buf.readUInt16LE(p + 28);
        const elen = buf.readUInt16LE(p + 30);
        const clen = buf.readUInt16LE(p + 32);
        const lho = buf.readUInt32LE(p + 42);
        const name = buf.toString('utf8', p + 46, p + 46 + nlen);
        // 数据偏移必须按本地头的名字/扩展长度算，它可能与中央目录不同
        const at = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
        const raw = buf.subarray(at, at + csize);
        if (!name.endsWith('/')) {
            out.set(path.posix.basename(name), () => {
                if (method === 0)
                    return raw;
                if (method === 8)
                    return inflateRawSync(raw);
                throw new Error(`不支持的压缩方法 ${method}：${name}`);
            });
        }
        p += 46 + nlen + elen + clen;
    }
    return out;
};
/** 剥出包地址，两层 `data` 都看（不同路径的嵌套层数不一样） */
const readMeta = (response) => {
    if (!isRecord(response))
        return null;
    const data = isRecord(response.data) ? response.data : undefined;
    const nested = isRecord(data?.data) ? data.data : undefined;
    const res = (isRecord(data?.android_emoji_resource) && data.android_emoji_resource) ||
        (isRecord(nested?.android_emoji_resource) && nested.android_emoji_resource) ||
        undefined;
    if (!isRecord(res))
        return null;
    const md5 = typeof res.md5 === 'string' ? res.md5 : '';
    const url = typeof res.resource_url === 'string' ? res.resource_url : '';
    return md5 && url ? { md5, url } : null;
};
/** 元信息走 amagi 的免鉴权接口；资源包本体是普通文件下载，不经 amagi */
const requestEmojiResourceMeta = async () => {
    const call = douyinGuest('fetchEmojiResourceMeta');
    if (!call)
        throw new Error('装的 amagi 没有 fetchEmojiResourceMeta');
    return await call({}, '', buildAmagiRequestConfig());
};
/** 同步限时表情：拿 md5 → 和缓存比 → 需要才下载 → 校验 md5 → 解出限时条目写缓存 */
export const syncDouyinEmojiResource = async (requestMeta = requestEmojiResourceMeta) => {
    const file = cacheFile();
    let meta;
    try {
        meta = readMeta(await requestMeta());
    }
    catch (error) {
        hostLogger?.warn?.('[抖音表情] 资源包接口取数失败，补充表这轮跳过', error);
        return null;
    }
    if (!meta) {
        hostLogger?.warn?.('[抖音表情] 资源包接口没回 android_emoji_resource，补充表这轮跳过');
        return null;
    }
    const cached = readJson(file);
    if (cached?.md5 === meta.md5) {
        return { md5: meta.md5, count: cached.items.length, source: 'cached' };
    }
    try {
        const buf = Buffer.from(await (await fetch(meta.url, { signal: AbortSignal.timeout(60000) })).arrayBuffer());
        // md5 不对就当没拿到 —— 宁可少几个表情，也不要把坏包写进缓存
        const got = createHash('md5').update(buf).digest('hex');
        if (got !== meta.md5)
            throw new Error(`md5 不匹配（期望 ${meta.md5} 实得 ${got}）`);
        const entries = readZip(buf);
        const info = entries.get('info.json');
        if (!info)
            throw new Error('包里没有 info.json');
        const parsed = JSON.parse(info().toString('utf8'));
        const stickers = isRecord(parsed) && Array.isArray(parsed.stickers) ? parsed.stickers : [];
        const items = [];
        for (const s of stickers) {
            // 只要限时的：web 那份必然覆盖全部常驻表情，缺口只可能在限时里
            if (!isRecord(s) || s.time_limited !== 1)
                continue;
            const name = typeof s.display_name === 'string' ? s.display_name : '';
            const uri = typeof s.uri === 'string' ? s.uri : '';
            const read = uri ? entries.get(path.posix.basename(uri)) : undefined;
            if (!name || !read)
                continue;
            items.push({ name, url: `data:image/png;base64,${read().toString('base64')}` });
        }
        if (!items.length)
            throw new Error('包里没有 time_limited=1 的条目');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ md5: meta.md5, items }));
        const emitLog = hostLogger?.mark ?? hostLogger?.info;
        emitLog?.call(hostLogger, `[抖音表情] 限时表情已更新 md5=${meta.md5.slice(0, 8)} 共 ${items.length} 条`);
        return { md5: meta.md5, count: items.length, source: 'downloaded' };
    }
    catch (error) {
        hostLogger?.warn?.('[抖音表情] 资源包处理失败，补充表这轮跳过', error);
        return null;
    }
};
/**
 * 进程内只同步一次 —— md5 比对本身也要一次网络往返，解析路径上每条评论都付不值得。
 * 想强制重来的走 {@link syncDouyinEmojiResource}。
 */
let pendingSync;
export const syncDouyinEmojiResourceOnce = () => {
    pendingSync ??= syncDouyinEmojiResource().catch(() => null);
    return pendingSync;
};
/** 读缓存，产出 `known` 里没有的那批补充项 */
export const loadDouyinEmojiSupplement = (known) => (readJson(cacheFile())?.items ?? []).filter(item => !known.has(item.name));
/** 把补充项并进表情表。接口已有的一律不覆盖 —— 哪天 web 那张快照更新了，自动用官方的 */
export const mergeDouyinEmojiList = (base) => {
    const extra = loadDouyinEmojiSupplement(new Set(base.map(item => item.name)));
    if (!extra.length)
        return [...base];
    const emitLog = hostLogger?.mark ?? hostLogger?.info;
    emitLog?.call(hostLogger, `[抖音表情] 表情表 ${base.length} 条 + 限时补充 ${extra.length} 条`);
    return [...base, ...extra];
};
