/**
 * 进程内的接口响应缓存。
 *
 * `withApiCache` 当前**没有生产调用点**：已经从 amagi 取数路径上摘掉，
 * 只剩 `tests/unit/api-cache.test.ts` 在驱动它。
 *
 * ## 为什么必须有 in-flight 合并
 *
 * `ParseCoordinator` 的去重指纹**包含 scope（群号）**，所以两个群同时发同一条链接
 * 得到两个不同指纹、不去重、两个解析任务真并发。这时纯 TTL 缓存救不了：两个任务
 * 几乎同时到达，双双 miss，双双打接口。合并同键的并发请求才是多群场景真正省下的那部分。
 *
 * ## 为什么键里必须有 Cookie 指纹
 *
 * 同一个 work-id 在登录态/未登录态下接口返回的内容不一样（清晰度档位、能不能拉评论、
 * 是不是被限流）。用户在锅巴里换了 Cookie 之后如果旧缓存还命中，表现就是
 * 「换了 Cookie 也没用」—— 一个查不出来的假象。指纹进键之后换 ck 天然让旧条目失联。
 * 写进键的是**短哈希**而不是 Cookie 原文：键会进日志、进诊断快照，原文一旦进去就是泄凭据。
 */
import { createHash } from 'node:crypto'

import { isRecord } from './record.js'

/** 参与缓存的平台。刻意不 import `platform/common/userAgent` 的 `AmagiPlatform`：utils 不反向依赖 platform。 */
export type ApiCachePlatform = 'douyin' | 'bilibili' | 'kuaishou' | 'xiaohongshu'

/**
 * TTL 档位。
 *
 * - `static` 准静态：表情清单、id 换算这类跟具体作品和账号都无关的数据
 * - `detail` 作品详情：按 id 定死的作品正文/元数据，5 分钟内只有计数会动
 */
export type ApiCacheTier = 'static' | 'detail'

/** 条目上限。防内存无界增长，超了按最久未用淘汰。 */
export const API_CACHE_CAPACITY = 128

/**
 * 各档位的 TTL。
 *
 * 刻意写死在代码里、不暴露成锅巴旋钮：这两个值的合理区间是由**接口语义**定的
 * （表情清单按月变、作品正文发布后不再改），不是由用户口味定的。放出去只会让人调出
 * 「一天前的评论数」或者「每次都 miss」这两种没人想要的形态，而问题会表现成插件的 bug。
 */
export const API_CACHE_TTL_MS: Readonly<Record<ApiCacheTier, number>> = {
  static: 24 * 60 * 60 * 1000,
  detail: 5 * 60 * 1000
}

/**
 * 失败缓存（negative caching）的 TTL：45 秒。
 *
 * 比成功档位短两个数量级。要治的是「被风控时用户反复发同一条链接、反复打接口、把风控
 * 搞得更严」；同时风控解除后最多 45 秒就自愈，不会让用户觉得插件坏了。
 */
export const API_CACHE_NEGATIVE_TTL_MS = 45 * 1000

/**
 * 缓存策略表 —— **白名单**，只有列在这里的方法才缓存，没列的一律直连。
 *
 * 用白名单而不是黑名单，是为了让「amagi 以后加了新方法」的默认行为是**安全的**
 * （不缓存），而不是被误缓存。也刻意不做「方法名里有没有『表情』两个字」这种模糊匹配：
 * 猜错的代价是功能坏掉，而模糊匹配一定会在某个新方法上猜错。
 *
 * 键是 wrapper 收到的**原始方法名**（旧版 amagi 的中文名，抖音那条路还允许英文 fetcher 名）。
 *
 * ---
 *
 * ## 刻意**不**进白名单的接口，以及原因
 *
 * 这份清单和白名单一样重要 —— 它们不是「还没来得及加」，是加了会坏：
 *
 * - **`单个视频下载信息数据`（B站 playurl）**：返回的是**带时效签名的直链**，还会随登录态
 *   给不同清晰度档位。缓存它等于过一会儿发一条已经过期的下载地址出去。
 * - **`直播间信息` / `直播间初始化信息` / `用户直播状态`（B站）、`直播间信息数据`（抖音）**：
 *   直播态本身就是要即时的，缓存会直接延迟开播推送。
 * - **抖音 `用户主页数据`**：这个接口在抖音这边**兼任直播态载体**（`push.ts` 拿它的
 *   `live_status` / `room_data` 判断有没有开播，见 `buildLivePushItem`），所以和上一条同理。
 *   注意 B站 的同名方法只返回 `card`（昵称/头像/粉丝数）、不含直播态，因此**是**白名单成员 ——
 *   同名不同命，这也正是策略表按「平台 + 方法名」而不是只按方法名配的原因。
 * - **`用户主页视频列表数据` / `用户主页动态列表数据` / `fetchUserFavoriteList` /
 *   `fetchUserRecommendList`**：推送轮询存在的意义就是发现新内容，缓存等于延迟推送。
 * - **`搜索数据`**：只在添加订阅时一次性调用，没有重复调用可省。
 * - **登录态相关的一切**：见 {@link NEVER_CACHE_METHODS}。
 */
export const API_CACHE_POLICY: Readonly<Record<ApiCachePlatform, Readonly<Record<string, ApiCacheTier>>>> = {
  douyin: {
    /** 平台级表情清单，与作品、账号都无关，按月变化 */
    Emoji数据: 'static',
    /** 作品正文与媒体地址按 aweme_id 定死，5 分钟内只有播放/点赞计数会动 */
    聚合解析: 'detail',
    /** 评论首页在 5 分钟窗口内几乎不变；多群发同一条链接时这是第二大的重复开销 */
    评论数据: 'detail',
    /** 同上，子评论（展开某条评论的回复） */
    指定评论回复数据: 'detail',
    /** BGM 元数据按 music id 定死 */
    音乐数据: 'detail',
    /** 弹幕按 aweme_id 取，5 分钟的增量对烧制出来的画面没有可见影响 */
    弹幕数据: 'detail'
  },
  bilibili: {
    /** 表情包 packages，平台级清单 */
    Emoji数据: 'static',
    /**
     * av↔bv 是一个**固定双射**（算法换算，不随时间变），所以给最长档。
     * 这条也是白名单里唯一一个和账号、内容都无关的纯换算。
     */
    AV转BV: 'static',
    /** 稿件元数据按 bvid 定死 */
    单个视频作品数据: 'detail',
    /** 见抖音 `评论数据` */
    评论数据: 'detail',
    /** 动态正文发布后不再修改 */
    动态详情数据: 'detail',
    /** 番剧元数据按 ep_id / season_id 定 */
    番剧基本信息数据: 'detail',
    /** 专栏元数据按 cvid 定 */
    专栏文章基本信息: 'detail',
    /** 专栏正文按 cvid 定，发布后基本不改 */
    专栏正文内容: 'detail',
    /**
     * 只返回 `card`（昵称/头像/粉丝数），**不含**直播态 —— 与抖音同名方法的关键区别。
     * 动态推送一轮里同一个 UP 会被重复取好几次（每条动态一次），这里省得最多。
     */
    用户主页数据: 'detail'
  },
  kuaishou: {
    /** 平台级表情清单，原来每次解析都重拉一遍 */
    Emoji数据: 'static',
    /** 作品元数据按 photoId 定死 */
    单个视频作品数据: 'detail',
    /** 见抖音 `评论数据` */
    评论数据: 'detail'
  },
  xiaohongshu: {
    /**
     * 原来**每次解析都重新拉一次**（`xiaohongshu.ts` 的 `Action`）。
     * 这是全仓最典型的「准静态数据按作品详情的频率在拉」，也是这套缓存最直接的收益点。
     */
    表情列表: 'static',
    /** 笔记正文与图集按 note id 定死 */
    单个笔记数据: 'detail',
    /** 见抖音 `评论数据`；小红书评论是分页的，游标在 options 里、会进键，所以分页互不串味 */
    评论数据: 'detail'
  }
}

/**
 * **绝对不能缓存**的方法名。
 *
 * 这份清单在运行时**不参与判定** —— 判定的唯一依据是 {@link API_CACHE_POLICY} 这张白名单，
 * 没列进白名单就不缓存，所以这里是零。之所以还要把它写出来并导出：
 *
 * 1. 它记录了「为什么这几个特别危险」，下一个人想往白名单里加时能看见；
 * 2. `tests/unit/api-cache.test.ts` 断言它和白名单的**交集为空**。
 *
 * 刻意**不**做成运行时兜底（「在白名单里也强行不缓存」）：那样一来，误把
 * `二维码状态` 加进白名单的人会得到一份「测试全绿、行为也正确」的假安全，
 * 而下一次有人删掉兜底时才炸。让白名单成为唯一真相，误加就当场被测试打回。
 *
 * ---
 *
 * 为什么这几个是最危险的：它们都是**有状态轮询**或**一次性凭据**。
 *
 * - `申请二维码` / `二维码状态`（`platform/bilibili/login.ts`）：`二维码状态` 是
 *   `while (true)` + `sleep(3000)` 的轮询，靠返回码从 86101（未扫码）走到 86090（已扫待确认）
 *   再到 0（成功、随响应带回 set-cookie）。缓存住第一次的 86101 就是**扫码登录永远停在
 *   「等待扫码」**，而且用户看不出原因。
 * - `登录基本信息`（`platform/bilibili/genParams.ts`）：登录态与大会员判定，几乎每次
 *   下载/解析都调，正是那种「看着像热点、其实是凭据校验」的接口。缓存它会让刚设好 ck 的
 *   用户继续被当成未登录。
 * - `从_v_voucher_申请_captcha` / `验证验证码结果`（`platform/bilibili/riskControl.ts`）：
 *   `v_voucher` 是**一次性**的，缓存 = 拿旧凭据反复换验证码，整条风控恢复链路直接失效。
 *
 * 抖音的扫码登录（`platform/douyin/login.ts`）走 puppeteer 抓页面、**完全不经过**
 * amagi 取数，所以这里没有抖音条目；快手和小红书没有登录链路（ck 手工设置）。
 */
export const NEVER_CACHE_METHODS: Readonly<Record<ApiCachePlatform, readonly string[]>> = {
  douyin: [],
  bilibili: ['申请二维码', '二维码状态', '登录基本信息', '从_v_voucher_申请_captcha', '验证验证码结果'],
  kuaishou: [],
  xiaohongshu: []
}

/**
 * 值得做失败缓存的平台业务码。
 *
 * 判定标准沿用 `platform/common/softError.ts` 定下的那条：**只收能确证的码**。
 * 猜错的代价这边比软错误那边小（最多 45 秒），但方向一样 —— 宁可漏放行。
 *
 * ## 为什么只有 B站 有码
 *
 * 和 `SOFT_ERROR_CODES` 是同一个原因：amagi 6.5.0 只在 B站 这条路径上把平台业务码
 * 透传到 `Result.code`，抖音/快手/小红书的失败 `Result.code` 恒为 500。500 是
 * 「这次请求失败了」、不带业务语义，把它当风控缓存等于把这三个平台的**所有**失败
 * （含网络抖动）都缓存 45 秒，正好是失败缓存最该避免的事。
 *
 * 这三个平台的失败缓存因此只靠 HTTP 4xx 那条通路（见 {@link classifyFailure}），
 * 那条不依赖 amagi 的码透传。
 *
 * ## 刻意**不**收 `-352`（风控校验失败）
 *
 * 本仓库对 -352 有一条**交互式恢复链路**：`platform/bilibili/riskControl.ts` 会申请
 * 极验验证码、等用户过验证，然后回一句「验证成功，请重新发送命令。」——
 * 用户接着做的事就是**在几秒内重发同一条链接**。要是 -352 被缓存 45 秒，这次重发会
 * 命中缓存里的旧 -352，于是拿着已经消耗掉的 `v_voucher` 再走一遍验证码流程，
 * 用户永远过不去。恰好是失败缓存最容易踩坏功能的形态，所以单独排除。
 */
const RISK_CONTROL_CODES: Readonly<Record<ApiCachePlatform, readonly number[]>> = {
  /**
   * - `-412` 请求被拦截、`-509` / `-799` 请求过于频繁：纯限流/反爬，**没有**交互式恢复动作，
   *   用户唯一能做的就是等 —— 正是失败缓存该拦下来的那种反复重试。
   * - `-101` 账号未登录：Cookie 指纹在键里，用户换了 ck 会换键，所以缓存它不会造成
   *   「设好 ck 还是说没登录」。
   */
  bilibili: [-412, -509, -799, -101],
  douyin: [],
  kuaishou: [],
  xiaohongshu: []
}

/** 缓存条目里存的那一次结果。失败缓存复用同一个形状。 */
type CacheOutcome =
  | { kind: 'value', value: unknown }
  | { kind: 'error', error: unknown }

interface CacheEntry {
  tier: ApiCacheTier
  /** 绝对到期时刻（`Date.now()` 纪元） */
  expiresAt: number
  /** 是不是失败缓存。只用于诊断快照，判定逻辑不看它 */
  negative: boolean
  outcome: CacheOutcome
}

/** 一次取数请求的缓存身份 */
export interface ApiCacheRequest {
  platform: ApiCachePlatform
  /** wrapper 收到的原始方法名 */
  method: string
  /** 实际发出去的 Cookie，只用于算指纹，不会原样进键 */
  cookie: string
  options: Record<string, unknown>
}

export interface ApiCacheTierStats {
  tier: ApiCacheTier
  hits: number
  /** 并发合并到别人的 in-flight 请求上 */
  coalesced: number
  /** 真的打了接口 */
  misses: number
  entries: number
}

/** 给运行诊断卡消费的只读快照 */
export interface ApiCacheSnapshot {
  enabled: boolean
  capacity: number
  entries: number
  hits: number
  coalesced: number
  misses: number
  /**
   * 省下的接口调用占比，`(hits + coalesced) / (hits + coalesced + misses)`。
   *
   * 合并算进分子：一次被合并的请求**确实**没有打接口，和命中缓存是同一种收益。
   * 没有任何一次查询时为 0。
   */
  hitRate: number
  /** 当前持有的失败缓存条目数。风控期间会明显抬头，是个有用的诊断信号 */
  negativeEntries: number
  /** 当前正在飞的请求数（同键只算一个） */
  inflight: number
  tiers: readonly ApiCacheTierStats[]
}

const TIERS: readonly ApiCacheTier[] = ['static', 'detail']

/** Map 保持插入顺序，读命中时 delete + set 把条目挪到尾部，队首就是最久未用的。 */
const entries = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<unknown>>()

const counters: Record<ApiCacheTier, { hits: number, coalesced: number, misses: number }> = {
  static: { hits: 0, coalesced: 0, misses: 0 },
  detail: { hits: 0, coalesced: 0, misses: 0 }
}

let enabledResolver: (() => boolean) | undefined

/** 覆盖开关来源。传 undefined 恢复默认（开）。 */
export const setApiCacheEnabledResolver = (resolver: (() => boolean) | undefined): void => {
  enabledResolver = resolver
}

/** 缓存总开关。没有配置项，默认开。 */
export const isApiCacheEnabled = (): boolean => {
  if (enabledResolver) return enabledResolver()
  return true
}

/**
 * Cookie 的短哈希。
 *
 * sha256 取十六进制前 12 位。选 12 位是因为这个值会进日志和诊断快照：够长到不会在
 * 一个用户手上的几份 ck 之间撞（48 bit），又短到看一眼就知道「这不是凭据」。
 * 空 ck 直接给 `anon`，让「未登录」这件事在键里是**可读**的，排查时不用去比对哈希。
 *
 * @param cookie 原始 Cookie 串
 */
export const fingerprintCookie = (cookie: string): string => {
  const trimmed = cookie.trim()
  if (trimmed.length === 0) return 'anon'
  return createHash('sha256').update(trimmed).digest('hex').slice(0, 12)
}

/**
 * 把请求参数排成稳定字符串：对象键递归排序，`undefined` 丢掉。
 *
 * 不用 `JSON.stringify` 直接来，是因为它按**插入顺序**输出键 —— 同一份参数在两个调用点
 * 以不同顺序构造出来就会得到两个键、两次 miss，而这种差异在代码里完全看不出来。
 *
 * 遇到环、BigInt、函数这类 `JSON.stringify` 处理不了的输入时返回 undefined，
 * 由调用方降级成直连。缓存不了不是错误，硬编个键才是。
 *
 * @param value 请求参数
 */
const stableStringify = (value: unknown): string | undefined => {
  const seen = new WeakSet<object>()

  const walk = (input: unknown): unknown => {
    if (input === null) return null
    if (typeof input === 'bigint' || typeof input === 'function' || typeof input === 'symbol') {
      throw new TypeError('unserializable cache key component')
    }
    if (typeof input !== 'object') return input

    const object = input as object
    if (seen.has(object)) throw new TypeError('circular cache key component')
    seen.add(object)

    if (Array.isArray(input)) {
      const list = input.map(item => walk(item))
      seen.delete(object)
      return list
    }

    const record = input as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(record).sort()) {
      const item = record[key]
      if (item === undefined) continue
      sorted[key] = walk(item)
    }

    seen.delete(object)
    return sorted
  }

  try {
    return JSON.stringify(walk(value))
  } catch {
    return undefined
  }
}

/** 查这个平台 + 方法名该用哪个 TTL 档；不在白名单里返回 undefined（直连）。 */
export const resolveApiCacheTier = (
  platform: ApiCachePlatform,
  method: string
): ApiCacheTier | undefined => API_CACHE_POLICY[platform][method]

/**
 * 缓存键：`平台 方法名 Cookie指纹 归一化参数`。
 *
 * 用 ` ` 当分隔符而不是 `:` 或 `|`：方法名和参数里都可能出现常见标点，
 * 而 NUL 不可能出现在方法名或 JSON 文本里，所以拼出来的键不会歧义
 * （`a\0b` 和 `a` + `\0b` 分不开这类问题）。
 *
 * 参数序列化失败时返回 undefined，表示「这次没法缓存」。
 *
 * @param request 取数请求的缓存身份
 */
export const buildApiCacheKey = (request: ApiCacheRequest): string | undefined => {
  const options = stableStringify(request.options)
  if (options === undefined) return undefined
  return [request.platform, request.method, fingerprintCookie(request.cookie), options].join(' ')
}

/** 读一个还没过期的条目，并把它挪到 LRU 尾部。过期的顺手删掉。 */
const readEntry = (key: string, now: number): CacheEntry | undefined => {
  const entry = entries.get(key)
  if (!entry) return undefined
  if (entry.expiresAt <= now) {
    entries.delete(key)
    return undefined
  }
  entries.delete(key)
  entries.set(key, entry)
  return entry
}

/**
 * 写入条目，必要时腾位。
 *
 * 腾位分两步：先清一遍已过期的（过期条目占着容量却没有价值），还是满就淘汰队首
 * （最久未用）。把过期清理挂在「满了」这个时刻而不是每次写入都全表扫，是为了让
 * 常态写入保持 O(1)。
 */
const writeEntry = (key: string, entry: CacheEntry, now: number): void => {
  entries.delete(key)

  if (entries.size >= API_CACHE_CAPACITY) {
    for (const [existingKey, existing] of entries) {
      if (existing.expiresAt <= now) entries.delete(existingKey)
    }
  }
  while (entries.size >= API_CACHE_CAPACITY) {
    const oldest = entries.keys().next()
    if (oldest.done) break
    entries.delete(oldest.value)
  }

  entries.set(key, entry)
}

const readFailureCode = (value: unknown): number | undefined => {
  if (!isRecord(value)) return undefined
  const nested = isRecord(value.error) ? value.error.code : undefined
  const raw = isRecord(value.rawError) ? value.rawError.code : undefined
  const code = value.code ?? nested ?? raw
  const numeric = typeof code === 'string' ? Number(code) : code
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return undefined
  return numeric
}

/** 从错误对象上取 HTTP 状态码（axios 风格与裸 status 都认）。 */
const readHttpStatus = (value: unknown): number | undefined => {
  if (!isRecord(value)) return undefined
  if (typeof value.status === 'number') return value.status
  if (isRecord(value.response) && typeof value.response.status === 'number') return value.response.status
  return undefined
}

/**
 * 一次失败该不该做失败缓存。
 *
 * ## 分类规则
 *
 * **缓存 45 秒（服务端明确拒绝了这次请求，重试只会更糟）**
 * - HTTP 429：限流/风控，`RequestGuard` 已经把该重试的次数重试完了还是 429
 * - HTTP 4xx（**除 408**）：401/403/404 这类，参数或凭据不对，立刻重试必然还是同样结果
 * - {@link RISK_CONTROL_CODES} 里的平台业务码
 *
 * **一律不缓存（暂时故障，缓存它只会延长故障感知）**
 * - HTTP 408 请求超时、HTTP 5xx：服务端侧的暂时问题
 * - `RequestTimeoutError` / `AbortError`：本地超时与取消
 * - `ECONNRESET` / `ENOTFOUND` 之类的网络错：连都没连上
 * - **认不出来的失败**：包括 amagi 那个恒为 500 的通用失败码。看不懂就不缓存 ——
 *   缓存一个自己没看懂的失败，等于赌它是稳定的业务答案，赌错就是把一次网络抖动
 *   变成 45 秒的「功能坏了」。
 *
 * @param platform 平台，决定用哪份业务码表
 * @param failure 失败的返回值或抛出的错误
 * @returns 该缓存时返回 true
 */
const classifyFailure = (platform: ApiCachePlatform, failure: unknown): boolean => {
  const status = readHttpStatus(failure)
  if (status !== undefined) {
    if (status === 408) return false
    if (status >= 400 && status < 500) return true
    return false
  }

  const code = readFailureCode(failure)
  if (code !== undefined && RISK_CONTROL_CODES[platform].includes(code)) return true

  return false
}

/**
 * 一次**成功返回**的值该按哪种 TTL 存，或者压根不存。
 *
 * 三种情况：
 *
 * 1. **软失败**（`softFetch` 归一出的 `{ success: false, soft: true }`，例如 B站 12061
 *    「UP 主已关闭评论区」）→ 按**成功档位**存。
 *
 *    理由：它不是故障，是接口稳定正确的业务答案。`platform/common/softError.ts` 已经
 *    为「这是业务拒绝而不是传输失败」背过书（白名单只收确证的码），所以这里不是在猜。
 *    而且短 TTL 的自愈论点在这里不成立 —— 没有东西需要自愈：UP 主要是重开了评论区，
 *    晚 5 分钟才看到毫无影响。反过来按 45 秒存才有实际损失：评论图静默缺失时用户最爱
 *    重发链接，而那恰好是缓存本该省下的那部分请求。
 *
 * 2. **硬失败返回值**（`{ success: false }` 但不带 `soft`）→ 交给 {@link classifyFailure}，
 *    确证的风控/4xx 存 45 秒，其余不存。这是本仓库失败缓存的**主要通路**：amagi 表达
 *    业务拒绝的方式主要是**返回**失败 `Result`，不是抛异常。
 *
 * 3. 其余（真成功）→ 按档位存。
 */
const classifyResolved = (
  platform: ApiCachePlatform,
  tier: ApiCacheTier,
  value: unknown
): { ttlMs: number, negative: boolean } | undefined => {
  if (isRecord(value) && value.success === false) {
    if (value.soft === true) return { ttlMs: API_CACHE_TTL_MS[tier], negative: false }
    if (classifyFailure(platform, value)) return { ttlMs: API_CACHE_NEGATIVE_TTL_MS, negative: true }
    return undefined
  }
  return { ttlMs: API_CACHE_TTL_MS[tier], negative: false }
}

const replay = <T> (outcome: CacheOutcome): T => {
  if (outcome.kind === 'error') throw outcome.error
  return outcome.value as T
}

/**
 * 缓存包装。命中直接返回，miss 才跑 `fetchValue`。
 *
 * 三条降级到直连的路（都不计入命中率，避免污染统计）：方法不在白名单、总开关关闭、
 * 请求参数序列化不了。
 *
 * ## in-flight 合并的实现要点
 *
 * - 从查缓存到 `inflight.set` 之间**一个 await 都没有**，所以并发的第二个调用者不可能
 *   插在中间看到空的 in-flight 表。这是整条合并逻辑成立的前提，改动这段时别引入 await。
 * - 写缓存发生在共享 promise 的**内部**，所以 N 个等待者只写一次；而且写在
 *   `inflight.delete` 之前，紧跟着到达的第四个调用者拿到的是缓存命中，不是一次新的 miss。
 * - `inflight` 只在 in-flight 期间持有键，`finally` 里必须删 —— 留着已经 settle 的 promise
 *   就等于一份没有 TTL 的影子缓存。
 * - 共享 promise 被拒绝时所有等待者一起拒绝。这是对的：它们各自去打接口也会失败，
 *   而且失败原因一致。因为发起者始终 `await` 着它，promise 上永远有 handler，
 *   不会有 unhandledRejection。
 *
 * @param request 取数请求的缓存身份
 * @param fetchValue 真的打接口的 thunk，通常是 `() => softFetch(...)`
 */
export const withApiCache = async <T> (
  request: ApiCacheRequest,
  fetchValue: () => Promise<T>
): Promise<T> => {
  const tier = resolveApiCacheTier(request.platform, request.method)
  if (tier === undefined) return await fetchValue()
  if (!isApiCacheEnabled()) return await fetchValue()

  const key = buildApiCacheKey(request)
  if (key === undefined) return await fetchValue()

  const cached = readEntry(key, Date.now())
  if (cached) {
    counters[cached.tier].hits++
    return replay<T>(cached.outcome)
  }

  const pending = inflight.get(key)
  if (pending) {
    counters[tier].coalesced++
    return await (pending as Promise<T>)
  }

  counters[tier].misses++
  const shared = (async () => {
    try {
      const value = await fetchValue()
      const plan = classifyResolved(request.platform, tier, value)
      if (plan) {
        const now = Date.now()
        writeEntry(key, { tier, expiresAt: now + plan.ttlMs, negative: plan.negative, outcome: { kind: 'value', value } }, now)
      }
      return value
    } catch (error: unknown) {
      if (classifyFailure(request.platform, error)) {
        const now = Date.now()
        writeEntry(
          key,
          { tier, expiresAt: now + API_CACHE_NEGATIVE_TTL_MS, negative: true, outcome: { kind: 'error', error } },
          now
        )
      }
      throw error
    }
  })()

  inflight.set(key, shared)
  try {
    return await shared
  } finally {
    inflight.delete(key)
  }
}

/**
 * 只读快照，给 `#kkk版本` 的运行诊断卡消费。
 *
 * 顺带把已过期的条目清掉：诊断卡上报「缓存里有多少条」时，把过期条目算进去是误导 ——
 * 它们既不会被命中也不占实际价值。
 */
export const getApiCacheSnapshot = (): ApiCacheSnapshot => {
  const now = Date.now()
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(key)
  }

  const perTier = TIERS.map((tier): ApiCacheTierStats => ({
    tier,
    hits: counters[tier].hits,
    coalesced: counters[tier].coalesced,
    misses: counters[tier].misses,
    entries: [...entries.values()].filter(entry => entry.tier === tier).length
  }))

  const hits = perTier.reduce((sum, stats) => sum + stats.hits, 0)
  const coalesced = perTier.reduce((sum, stats) => sum + stats.coalesced, 0)
  const misses = perTier.reduce((sum, stats) => sum + stats.misses, 0)
  const lookups = hits + coalesced + misses

  return {
    enabled: isApiCacheEnabled(),
    capacity: API_CACHE_CAPACITY,
    entries: entries.size,
    hits,
    coalesced,
    misses,
    hitRate: lookups === 0 ? 0 : (hits + coalesced) / lookups,
    negativeEntries: [...entries.values()].filter(entry => entry.negative).length,
    inflight: inflight.size,
    tiers: perTier
  }
}

/**
 * 清空条目与计数，并恢复默认开关来源。测试用。
 *
 * 刻意**不**清 `inflight`：还在飞的请求已经有等待者了，把它们从表里抹掉只会让
 * 之后到达的同键请求再打一次接口，而不会让任何人得到更早的结果。
 */
export const resetApiCache = (): void => {
  entries.clear()
  for (const tier of TIERS) {
    counters[tier].hits = 0
    counters[tier].coalesced = 0
    counters[tier].misses = 0
  }
  enabledResolver = undefined
}
