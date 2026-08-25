/**
 * `#kkk版本` 的运行环境快照采集。
 *
 * 本文件照搬上游 `karin-plugin-kkk` 的 `packages/core/src/module/utils/runtime-report.ts`，
 * 因为 `ktr/template/other/runtime` 的数据契约与上游一致。
 *
 * 与上游的差异（都是基础设施替换，数据形状一律照搬）：
 * - `node-karin` 的 `isDocker` / `logs()` / `Message` 本仓库没有，分别用
 *   `detectContainer()` / `sliceChangelog()` / `MessageEvent` 顶上
 * - `Root.*` -> `Version.*`
 * - `formatBytes` 上游在 `./Network/helpers`，本仓库没有，就近实现
 * - `event.bot.adapter` 的字段抹平交给 `getAdapterInfo()`（错误卡片那套表）
 * - `releaseType` 上游用「版本号是不是 x.y.z」判断，本仓库改用
 *   `getReleaseChannel()` 按 git 分支判断：release-please 配的是 `prerelease: false`，
 *   永远产不出带 `-` 的版本号，上游那个正则恒为 Stable。本仓库的契约也因此把
 *   `releaseType` 扩到了三档（多一个 `Dev`）
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getBuildMetadata, formatBuildTime } from '../../module/tooling/build-metadata.js';
import { getReleaseChannel } from '../../module/tooling/release-channel.js';
import Config from './Config.js';
import { getAdapterInfo } from './ErrorHandler/adapter.js';
import Version from './Version.js';
/**
 * 把秒数排成适合诊断海报展示的紧凑时长。
 * @param seconds 原始秒数
 * @returns 形如 `2天 6小时 18分钟`
 */
const formatDuration = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0)
        return '未知';
    const totalMinutes = Math.floor(seconds / 60);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0)
        return `${days}天 ${hours}小时 ${minutes}分钟`;
    if (hours > 0)
        return `${hours}小时 ${minutes}分钟`;
    if (minutes > 0)
        return `${minutes}分钟`;
    return `${Math.floor(seconds)}秒`;
};
/**
 * 字节数排成人类可读文本。上游从 `./Network/helpers` 引，本仓库没有那个模块。
 * @param bytes 字节数
 */
const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes < 0)
        return '未知';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
};
/**
 * 是不是跑在容器里。上游用 node-karin 导出的 `isDocker`，本仓库自己探。
 *
 * 两个信号都查：`/.dockerenv` 是 Docker 自己放的，但 podman / containerd
 * 不一定放，所以再看 cgroup 里有没有容器运行时的痕迹。探测失败一律当不是容器
 * ——这个字段只用于展示，猜错方向也不影响功能。
 */
const detectContainer = () => {
    try {
        if (fs.existsSync('/.dockerenv'))
            return true;
        return /docker|containerd|kubepods|podman|lxc/i.test(fs.readFileSync('/proc/self/cgroup', 'utf8'));
    }
    catch {
        return false;
    }
};
/**
 * 从随包发布的 CHANGELOG.md 里截出最近若干个版本段。
 *
 * 上游用的是 node-karin 的 `logs()`，本仓库没有，这里按 `# 版本号` 这级标题切段。
 * 切不出来（标题格式不符）就整篇返回，好过给模板一个空串。
 *
 * @param content CHANGELOG.md 全文
 * @param length 要保留的版本段数量
 */
const VERSION_HEADING = /^##\s+\[?v?\d+\.\d+\.\d+/;
const sliceChangelog = (content, length) => {
    const lines = content.split(/\r?\n/);
    // 本仓库的 CHANGELOG 是 release-please 的标准格式：首行是 `# Changelog`，
    // 每个版本是 `## [2.36.0](compare 链接) - 标题` 这种二级标题，再往下的 `###`
    // 才是「✨ 新功能」这类分类小标题。所以版本切点只认 `##` + 版本号（方括号可选）。
    // 之前按 `# 版本号` 匹配，本仓库一个都命中不到，starts 为空直接整篇返回，
    // `#kkk更新日志` 会把 60 KB 全量日志塞给模板。
    const starts = lines.reduce((acc, line, index) => {
        if (VERSION_HEADING.test(line))
            acc.push(index);
        return acc;
    }, []);
    if (starts.length === 0)
        return content;
    const end = starts[length];
    const first = starts[0] ?? 0;
    return (end === undefined ? lines.slice(first) : lines.slice(first, end)).join('\n').trim();
};
/**
 * 从随包发布的 CHANGELOG 中提取指定数量的本地版本记录。
 * 读取失败时返回空字符串，让调用方决定降级展示或抛错。
 *
 * @param length 需要提取的版本数量
 */
export const getLocalChangelog = (length) => {
    try {
        const changelogPath = path.join(Version.pluginPath, 'CHANGELOG.md');
        return sliceChangelog(fs.readFileSync(changelogPath, 'utf8'), length);
    }
    catch {
        return '';
    }
};
/**
 * 适配器连上多久了。
 *
 * 导出是为了单测：这个函数里有个「秒 / 毫秒纪元」的单位判定，是最容易悄悄烂掉的那类逻辑，
 * 而它此前一个用例都没有 —— 正因如此，读一个宿主里根本不存在的字段这件事一直没人发现。
 */
export const getConnectedFor = (event) => {
    const adapter = event.bot?.adapter;
    const adapterRecord = typeof adapter === 'object' && adapter !== null
        ? adapter
        : {};
    const stat = typeof event.bot?.stat === 'object' && event.bot.stat !== null
        ? event.bot.stat
        : {};
    // `adapter.connectTime` 是 Karin 侧的字段；宿主 TRSS-Yunzai 里**根本不存在**这个键
    // （全量搜 plugins/adapter 和 lib 只有 Satori 的 reconnectTimer，无关），
    // 所以这一格在 Yunzai 上恒为「未知」。Yunzai 的连接时刻在 `bot.stat.start_time`：
    // OneBotv11 用事件的 `data.time`，ComWeChat / GSUIDCore / Milky / OPQBot 用
    // `Date.now() / 1000` —— 七个适配器里六个有，单位都是**秒**。
    const stamp = [stat.start_time, adapterRecord.connectTime]
        .map(Number)
        .find(value => Number.isFinite(value) && value > 0);
    if (stamp === undefined)
        return '未知';
    // 单位归一：秒级纪元约 1.7e9，毫秒级约 1.7e12。1e11 这条线把两者分得干干净净
    // （对毫秒时间戳而言它对应 1973 年，对秒时间戳而言对应公元 5138 年）。
    // 不归一就会把秒当毫秒算，得出「一万多天」这种离谱时长。
    const startedAtMs = stamp < 1e11 ? stamp * 1000 : stamp;
    return formatDuration(Math.max(0, (Date.now() - startedAtMs) / 1000));
};
/** 插件 package.json 里声明的运行要求，读失败不影响出图 */
const readEngines = () => {
    try {
        const raw = JSON.parse(fs.readFileSync(path.join(Version.pluginPath, 'package.json'), 'utf8'));
        if (typeof raw !== 'object' || raw === null)
            return {};
        const pkg = raw;
        // 本仓库跑在 Yunzai 上，宿主要求写在 engines.yunzai；karin 那两个键留着是为了
        // 与上游的字段来源对齐，真装到 Karin 上时照样能读出来
        return { node: pkg.engines?.node, karin: pkg.engines?.yunzai ?? pkg.karin?.engines ?? pkg.engines?.karin };
    }
    catch {
        return {};
    }
};
/**
 * 采集 `#kkk版本` 使用的安全运行环境快照。
 *
 * 不采集账号、主机名、用户目录、网络地址、环境变量内容、启动参数或适配器鉴权信息，
 * 保证该命令在群聊中触发时不会把机器身份和凭据写进图片。
 *
 * 这里刻意不写返回类型标注：让 TS 推出字面量形状，
 * `Render('other/runtime', …)` 调用点就会拿契约来校验它。
 *
 * @param event 当前消息事件
 */
export const collectRuntimeReport = (event) => {
    const engines = readEngines();
    const adapterInfo = getAdapterInfo(event);
    const cpus = os.cpus();
    const memory = process.memoryUsage();
    const totalMemory = os.totalmem();
    const usedMemory = Math.max(0, totalMemory - os.freemem());
    const buildMetadata = getBuildMetadata();
    const currentChangelog = getLocalChangelog(1);
    const rawScale = Number(Config.app.renderScale) / 100;
    const renderScale = Number.isFinite(rawScale) ? Math.min(2, Math.max(0.5, rawScale)) : 1;
    const buildState = !buildMetadata
        ? 'unavailable'
        : buildMetadata.version === Version.version ? 'matched' : 'mismatched';
    return {
        snapshotAt: new Intl.DateTimeFormat('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).format(new Date()),
        identity: {
            pluginName: Version.pluginName,
            pluginVersion: Version.version,
            // 上游这格是 Karin 版本，本仓库跑在 Yunzai 上，填宿主名 + 版本
            karinVersion: `${Version.BotName} ${Version.BotVersion}`,
            releaseType: getReleaseChannel(),
            requiredNodeVersion: engines.node ?? '未声明',
            requiredKarinVersion: engines.karin ?? '未声明'
        },
        build: {
            state: buildState,
            version: buildMetadata?.version,
            buildTime: buildMetadata?.buildTime ? formatBuildTime(buildMetadata.buildTime) : undefined,
            shortCommitHash: buildMetadata?.shortCommitHash
        },
        runtime: {
            nodeVersion: process.version,
            nodeEnv: process.env.NODE_ENV ?? '未设置',
            os: `${os.type()} ${os.release()}`,
            platform: os.platform(),
            arch: os.arch(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '未知',
            container: detectContainer(),
            systemUptime: formatDuration(os.uptime()),
            processUptime: formatDuration(process.uptime())
        },
        adapter: {
            // getAdapterInfo 在事件里完全没有 bot / 适配器线索时返回 undefined
            name: adapterInfo?.name || '未知',
            version: adapterInfo?.version || '未知',
            platform: String(adapterInfo?.platform || '未知'),
            protocol: String(adapterInfo?.protocol || '未知'),
            standard: String(adapterInfo?.standard || '未知'),
            communication: String(adapterInfo?.communication || '未知'),
            connectedFor: getConnectedFor(event)
        },
        renderer: {
            scale: `${renderScale.toFixed(2)}x`,
            timeout: `${Config.app.RenderWaitTime ?? 0}秒`,
            multiPage: Config.app.multiPageRender === true && adapterInfo?.protocol !== 'qqbot'
        },
        resources: {
            cpuModel: cpus[0]?.model?.trim() || '未知处理器',
            cpuCores: cpus.length,
            totalMemory: formatBytes(totalMemory),
            usedMemory: formatBytes(usedMemory),
            memoryUsagePercent: totalMemory > 0 ? `${((usedMemory / totalMemory) * 100).toFixed(1)}%` : '未知',
            processRss: formatBytes(memory.rss),
            heapUsed: formatBytes(memory.heapUsed)
        },
        releaseNotes: {
            markdown: currentChangelog,
            available: currentChangelog.length > 0
        }
    };
};
