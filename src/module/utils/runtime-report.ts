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
 * - 「并发与缓存」那一段是本仓库**独有**的（上游没有接口缓存和下载额度这两套设施），
 *   数据从 `ApiCache` / `DownloadBudget` 的只读快照来，本文件只做展示格式化
 * - `releaseType` 上游用「版本号是不是 x.y.z」判断，本仓库改用
 *   `getReleaseChannel()` 按 git 分支判断：release-please 配的是 `prerelease: false`，
 *   永远产不出带 `-` 的版本号，上游那个正则恒为 Stable。本仓库的契约也因此把
 *   `releaseType` 扩到了三档（多一个 `Dev`）
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { getBuildMetadata, formatBuildTime } from '@/module/tooling/build-metadata'
import { getReleaseChannel } from '@/module/tooling/release-channel'
import type { MessageEvent } from '@/types/message'

import { getApiCacheSnapshot, type ApiCacheTier } from './ApiCache.js'
import { getCdnProbeSnapshot } from './Network/CdnProbe.js'
import { type CdnFailureKind, getCdnRegistrySnapshot } from './Network/CdnRegistry.js'
import Config from './Config.js'
import { getDownloadBudgetSnapshot } from './Network/DownloadBudget.js'
import { getParseCoordinatorSnapshot } from './ParseCoordinator.js'
import { getAdapterInfo } from './ErrorHandler/adapter.js'
import Version from './Version.js'

/**
 * 把秒数排成适合诊断海报展示的紧凑时长。
 * @param seconds 原始秒数
 * @returns 形如 `2天 6小时 18分钟`
 */
const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '未知'

  const totalMinutes = Math.floor(seconds / 60)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}天 ${hours}小时 ${minutes}分钟`
  if (hours > 0) return `${hours}小时 ${minutes}分钟`
  if (minutes > 0) return `${minutes}分钟`
  return `${Math.floor(seconds)}秒`
}

/**
 * 字节数排成人类可读文本。上游从 `./Network/helpers` 引，本仓库没有那个模块。
 * @param bytes 字节数
 */
const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return '未知'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`
}

/**
 * 是不是跑在容器里。上游用 node-karin 导出的 `isDocker`，本仓库自己探。
 *
 * 两个信号都查：`/.dockerenv` 是 Docker 自己放的，但 podman / containerd
 * 不一定放，所以再看 cgroup 里有没有容器运行时的痕迹。探测失败一律当不是容器
 * ——这个字段只用于展示，猜错方向也不影响功能。
 */
const detectContainer = (): boolean => {
  try {
    if (fs.existsSync('/.dockerenv')) return true
    return /docker|containerd|kubepods|podman|lxc/i.test(fs.readFileSync('/proc/self/cgroup', 'utf8'))
  } catch {
    return false
  }
}

/**
 * 从随包发布的 CHANGELOG.md 里截出最近若干个版本段。
 *
 * 上游用的是 node-karin 的 `logs()`，本仓库没有，这里按 `# 版本号` 这级标题切段。
 * 切不出来（标题格式不符）就整篇返回，好过给模板一个空串。
 *
 * @param content CHANGELOG.md 全文
 * @param length 要保留的版本段数量
 */
const VERSION_HEADING = /^##\s+\[?v?\d+\.\d+\.\d+/

const sliceChangelog = (content: string, length: number): string => {
  const lines = content.split(/\r?\n/)
  // 本仓库的 CHANGELOG 是 release-please 的标准格式：首行是 `# Changelog`，
  // 每个版本是 `## [2.36.0](compare 链接) - 标题` 这种二级标题，再往下的 `###`
  // 才是「✨ 新功能」这类分类小标题。所以版本切点只认 `##` + 版本号（方括号可选）。
  // 之前按 `# 版本号` 匹配，本仓库一个都命中不到，starts 为空直接整篇返回，
  // `#kkk更新日志` 会把 60 KB 全量日志塞给模板。
  const starts = lines.reduce<number[]>((acc, line, index) => {
    if (VERSION_HEADING.test(line)) acc.push(index)
    return acc
  }, [])
  if (starts.length === 0) return content
  const end = starts[length]
  const first = starts[0] ?? 0
  return (end === undefined ? lines.slice(first) : lines.slice(first, end)).join('\n').trim()
}

/**
 * 从随包发布的 CHANGELOG 中提取指定数量的本地版本记录。
 * 读取失败时返回空字符串，让调用方决定降级展示或抛错。
 *
 * @param length 需要提取的版本数量
 */
export const getLocalChangelog = (length: number): string => {
  try {
    const changelogPath = path.join(Version.pluginPath, 'CHANGELOG.md')
    return sliceChangelog(fs.readFileSync(changelogPath, 'utf8'), length)
  } catch {
    return ''
  }
}

/**
 * 适配器连上多久了。
 *
 * 导出是为了单测：这个函数里有个「秒 / 毫秒纪元」的单位判定，是最容易悄悄烂掉的那类逻辑，
 * 而它此前一个用例都没有 —— 正因如此，读一个宿主里根本不存在的字段这件事一直没人发现。
 */
export const getConnectedFor = (event: MessageEvent): string => {
  const adapter = event.bot?.adapter
  const adapterRecord = typeof adapter === 'object' && adapter !== null
    ? adapter as Record<string, unknown>
    : {}
  const stat = typeof event.bot?.stat === 'object' && event.bot.stat !== null
    ? event.bot.stat as Record<string, unknown>
    : {}

  // `adapter.connectTime` 是 Karin 侧的字段；宿主 TRSS-Yunzai 里**根本不存在**这个键
  // （全量搜 plugins/adapter 和 lib 只有 Satori 的 reconnectTimer，无关），
  // 所以这一格在 Yunzai 上恒为「未知」。Yunzai 的连接时刻在 `bot.stat.start_time`：
  // OneBotv11 用事件的 `data.time`，ComWeChat / GSUIDCore / Milky / OPQBot 用
  // `Date.now() / 1000` —— 七个适配器里六个有，单位都是**秒**。
  const stamp = [stat.start_time, adapterRecord.connectTime]
    .map(Number)
    .find(value => Number.isFinite(value) && value > 0)
  if (stamp === undefined) return '未知'

  // 单位归一：秒级纪元约 1.7e9，毫秒级约 1.7e12。1e11 这条线把两者分得干干净净
  // （对毫秒时间戳而言它对应 1973 年，对秒时间戳而言对应公元 5138 年）。
  // 不归一就会把秒当毫秒算，得出「一万多天」这种离谱时长。
  const startedAtMs = stamp < 1e11 ? stamp * 1000 : stamp
  return formatDuration(Math.max(0, (Date.now() - startedAtMs) / 1000))
}

/**
 * 下载桶名到卡上中文措辞的映射。
 *
 * 桶名就是解析上下文里的平台标识（`DownloadBudget` 的 `withDownloadBucket`），
 * 是英文的；诊断卡是给用户看的，不该出现 `xiaohongshu` 这种字段名。
 * 认不出的桶名**原样显示** —— 以后多一个平台时卡上会出现英文桶名，比消失好。
 */
const DOWNLOAD_BUCKET_LABELS: Readonly<Record<string, string>> = {
  bilibili: '哔哩哔哩',
  douyin: '抖音',
  kuaishou: '快手',
  xiaohongshu: '小红书',
  default: '默认'
}

/** 缓存 TTL 档位到卡上中文措辞的映射 */
const API_CACHE_TIER_LABELS: Readonly<Record<ApiCacheTier, string>> = {
  static: '准静态接口',
  detail: '作品详情'
}

/**
 * CDN 失败性质到卡上中文措辞的映射。
 *
 * 四种性质在 `CdnRegistry` 里对惩罚的处理完全一样，区分开只为了让这张卡说得清
 * 「这个节点是怎么坏的」—— 「被限速」和「403 拒绝」的排查方向完全不同。
 */
const CDN_FAILURE_LABELS: Readonly<Record<CdnFailureKind, string>> = {
  blocked: '拒绝服务',
  missing: '资源缺失',
  slow: '持续低速',
  network: '连接失败'
}

/**
 * 惩罚剩余时长排成紧凑文本。
 *
 * 单独一个函数而不是复用上面的 `formatDuration`：那个的最小粒度是「秒」且不足
 * 一分钟时印整秒，而惩罚期是分钟量级、看的人关心的是「还要避开多久」，
 * 印成 `4.2分钟` 比 `252秒` 好读。
 *
 * @param ms 剩余毫秒数
 */
const formatPenaltyRemaining = (ms: number): string => {
  if (!Number.isFinite(ms) || ms <= 0) return '即将解除'
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}秒`
  return `${(ms / 60_000).toFixed(1)}分钟`
}

/**
 * 实测速度排成人类可读文本。
 *
 * 入参单位是 KB/s（`getCdnProbeSnapshot` 已经在那边除过 1024 并取整），
 * 所以这里只在超过 1024KB/s 时再进一档，不要再拿 `formatBytes` 从字节数算一遍。
 *
 * @param kbPerSecond 实测速度，KB/s
 */
const formatProbeSpeed = (kbPerSecond: number): string => {
  if (!Number.isFinite(kbPerSecond) || kbPerSecond <= 0) return '不可用'
  if (kbPerSecond < 1024) return `${kbPerSecond}KB/s`
  return `${(kbPerSecond / 1024).toFixed(1)}MB/s`
}

/**
 * 比率排成百分数文本。
 *
 * 夹到 0~1 再乘 100：这个字符串会被模板**直接当 CSS `width` 用**（和内存占用那根条同一套做法），
 * 越界值会画出一条溢出容器的进度条。
 *
 * @param ratio 0~1 的比率
 */
const formatPercent = (ratio: number): string => {
  const safe = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0
  return `${(safe * 100).toFixed(1)}%`
}

/** 插件 package.json 里声明的运行要求，读失败不影响出图 */
const readEngines = (): { node?: string, karin?: string } => {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(path.join(Version.pluginPath, 'package.json'), 'utf8'))
    if (typeof raw !== 'object' || raw === null) return {}
    const pkg = raw as { engines?: Record<string, string>, karin?: { engines?: string } }
    // 本仓库跑在 Yunzai 上，宿主要求写在 engines.yunzai；karin 那两个键留着是为了
    // 与上游的字段来源对齐，真装到 Karin 上时照样能读出来
    return { node: pkg.engines?.node, karin: pkg.engines?.yunzai ?? pkg.karin?.engines ?? pkg.engines?.karin }
  } catch {
    return {}
  }
}

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
export const collectRuntimeReport = (event: MessageEvent) => {
  const engines = readEngines()
  const adapterInfo = getAdapterInfo(event)
  const cpus = os.cpus()
  const memory = process.memoryUsage()
  const totalMemory = os.totalmem()
  const usedMemory = Math.max(0, totalMemory - os.freemem())
  const buildMetadata = getBuildMetadata()
  const cacheSnapshot = getApiCacheSnapshot()
  const downloadSnapshot = getDownloadBudgetSnapshot()
  const parseSnapshot = getParseCoordinatorSnapshot()
  const cdnSnapshot = getCdnRegistrySnapshot()
  const probeSnapshot = getCdnProbeSnapshot()
  const cacheLookups = cacheSnapshot.hits + cacheSnapshot.coalesced + cacheSnapshot.misses
  const currentChangelog = getLocalChangelog(1)
  const rawScale = Number(Config.app.renderScale) / 100
  const renderScale = Number.isFinite(rawScale) ? Math.min(2, Math.max(0.5, rawScale)) : 1
  const buildState = !buildMetadata
    ? 'unavailable' as const
    : buildMetadata.version === Version.version ? 'matched' as const : 'mismatched' as const

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
    concurrency: {
      cache: {
        enabled: cacheSnapshot.enabled,
        // withApiCache 目前**没有生产调用点**（见 ApiCache.ts 头部），也没人注册过
        // enabled 解析器，所以 enabled 恒为 true 而各项计数恒为 0、sampled 恒为 false。
        // 这个标记让模板显示「尚未产生请求」，而不是印一个 0/0 算出来的 0.0% 命中率。
        sampled: cacheLookups > 0,
        hitRate: formatPercent(cacheSnapshot.hitRate),
        hits: cacheSnapshot.hits,
        coalesced: cacheSnapshot.coalesced,
        misses: cacheSnapshot.misses,
        entries: cacheSnapshot.entries,
        capacity: cacheSnapshot.capacity,
        negativeEntries: cacheSnapshot.negativeEntries,
        inflight: cacheSnapshot.inflight,
        tiers: cacheSnapshot.tiers.map(tier => {
          const lookups = tier.hits + tier.coalesced + tier.misses
          return {
            label: API_CACHE_TIER_LABELS[tier.tier],
            hitRate: formatPercent(lookups === 0 ? 0 : (tier.hits + tier.coalesced) / lookups),
            detail: `命中 ${tier.hits} · 合并 ${tier.coalesced} · 未命中 ${tier.misses} · 缓存 ${tier.entries} 条`
          }
        })
      },
      download: {
        limit: downloadSnapshot.limit,
        // 桶是懒创建的：一次下载都没跑过时这里是空数组，模板要能画出「暂无下载任务」
        buckets: downloadSnapshot.buckets.map(bucket => ({
          label: DOWNLOAD_BUCKET_LABELS[bucket.bucket] ?? bucket.bucket,
          running: bucket.running,
          queued: bucket.queued
        }))
      },
      /*
        CDN 地址簿与测速缓存。这一格是「为什么这次下载特别慢」的排障入口：
        被限速或返回 403 的节点会进惩罚期，画出来才看得见换过几次地址、现在避着谁。

        只往外给主机名，完整地址一律不给：路径里带着鉴权签名，任何人拿到就能盗链，
        而这张卡在群里也会被画出来。两个快照的 `host` 字段本来就只有主机名，
        所以这里不需要额外裁剪，但新增字段时要守住这条线。
      */
      cdn: {
        resources: cdnSnapshot.resources,
        hosts: cdnSnapshot.hosts,
        probedHosts: probeSnapshot.hosts,
        // 快照那边已经按主机名排过序，这里不再动次序
        penalized: cdnSnapshot.penalized.map(entry => ({
          host: entry.host,
          failures: entry.failures,
          // lastKind 只在「记着这个主机但还没失败过」时为 null，而这个列表只收
          // 惩罚期内的主机（必然失败过至少一次），所以那个分支实际到不了；
          // 仍然给兜底，免得以后快照口径变了在卡上印出 undefined
          reason: entry.lastKind === null ? '未知' : CDN_FAILURE_LABELS[entry.lastKind],
          remaining: formatPenaltyRemaining(entry.penaltyRemainingMs)
        })),
        // 快照那边已经按实测速度从快到慢排过
        probes: probeSnapshot.entries.map(entry => ({
          host: entry.host,
          speed: formatProbeSpeed(entry.kbPerSecond),
          // 测不通时不印那个毫秒数。`ttfbMs` 在失败分支里是「失败前耗时」而不是首字节
          // 时间（见 CdnProbe 的 `ok: false` 两处返回），照 TTFB 印出来会误导两次：
          // 地址畸形那条是 0，印成 `0ms` 会被读成「快得测不出来」；而超时那条是整个
          // 超时窗口，印出来又像是真握上了手。也不能一律写「超时」—— 403 同样是
          // `ok: false`，它的耗时是真的。所以这里什么都不声称。
          ttfb: entry.ok ? `${entry.ttfbMs}ms` : '—',
          ok: entry.ok
        }))
      },
      // 刻意只给计数，不给 runningFingerprints / queuedFingerprints：指纹是
      // 平台 + 作品链接 + 群号拼出来的，而这张卡的前提是「群里触发也不会把
      // 机器身份和用户数据画进图里」。谁在解析什么不属于运行环境诊断。
      parse: {
        // 协调器实例归 apps/tools.ts 所有，没加载时读不到（诊断卡据此写「未初始化」，
        // 而不是画一排 0 —— 那会被读成「队列是空的」）
        available: parseSnapshot !== undefined,
        concurrency: parseSnapshot?.concurrency ?? 0,
        running: parseSnapshot?.running ?? 0,
        queued: parseSnapshot?.queued ?? 0,
        // pending = 排队 + 在跑，也是去重的判据（同一指纹再来会挂到已有的那个上）。
        // 单独给出来是因为 pending > running + queued 说不通，一眼能看出数字出错
        pending: parseSnapshot?.pending ?? 0
      }
    },
    releaseNotes: {
      markdown: currentChangelog,
      available: currentChangelog.length > 0
    }
  }
}
