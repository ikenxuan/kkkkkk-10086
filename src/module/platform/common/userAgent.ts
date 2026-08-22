import Config from '@/module/utils/Config'

/**
 * amagi 各平台内置 UA 的 Chrome 主版本号。
 *
 * amagi 是**按平台分别维护** UA 的，而且刻意不同（6.5.0 的 dist/default/index.mjs）：
 * `getDouyinDefaultConfig` 125、`getBilibiliDefaultConfig` 142、
 * `getKuaishouDefaultConfig` 130、`getXiaohongshuDefaultConfig` 141。
 *
 * **故意写成常量而不是去解析 node_modules**：amagi 的 dist 是打包产物，靠正则从里面捞 UA
 * 属于依赖内部实现，它换个写法我们就静默失效。写死的代价是 amagi 升级后这里可能偏保守
 * （该覆盖时没覆盖），而偏保守的结果只是「用 amagi 自己的 UA」—— 那本来就是安全的那一侧。
 */
const AMAGI_BUILTIN_CHROME_MAJOR = {
  douyin: 125,
  bilibili: 142,
  kuaishou: 130,
  xiaohongshu: 141
} as const

/** 有独立 amagi 默认配置的平台 */
export type AmagiPlatform = keyof typeof AMAGI_BUILTIN_CHROME_MAJOR

/**
 * 从 UA 里读 Chrome 主版本号。
 * @param userAgent 完整 UA 字符串
 * @returns 主版本号；不是 Chrome 系 UA 时返回 null
 */
const readChromeMajor = (userAgent: string): number | null => {
  const matched = /Chrome\/(\d+)/.exec(userAgent)
  if (!matched?.[1]) return null
  const major = Number.parseInt(matched[1], 10)
  return Number.isFinite(major) ? major : null
}

/**
 * 交给 amagi 的 per-request User-Agent。
 *
 * 为什么需要这个函数，而不是直接写 `'User-Agent': Config.request?.['User-Agent']`：
 *
 * amagi 在 `get<平台>DefaultConfig` 里是这么组装请求头的（6.5.0 的
 * dist/default/index.mjs:2161 起，四个平台同一形状）：
 *
 *     let finalUserAgent = requestConfig?.headers?.['User-Agent'] ?? '<平台内置 UA>'
 *     ...
 *     'Sec-Ch-Ua': generateSecChUa(finalUserAgent)
 *     ...
 *     headers: { ...defHeaders, ...requestConfig?.headers ?? {} }
 *
 * 两个后果：
 *
 * 1. `Sec-Ch-Ua` / `Sec-Ch-Ua-Platform` 这组客户端提示是**从 UA 派生**的。UA 一旦落后，
 *    整组指纹会自相矛盾地指向同一个过时版本 —— 而真实浏览器的 UA 和 Sec-Ch-Ua 永远同步。
 * 2. 最后那次 spread 让我们传的 key 覆盖掉 amagi 自己的值。所以只要这个 key 存在，
 *    amagi 随版本更新的 UA 就永远用不上；传 `undefined` 更糟，`??` 只挡 null/undefined，
 *    但 spread 之后 `headers['User-Agent']` 会变成显式的 undefined，axios 于是发出
 *    自己的 `axios/<版本>` 或干脆不带 UA。
 *
 * 而 `config/config/request.yaml` 在首次安装时被写死，之后升级插件不会覆盖它 ——
 * 实测有用户的机器上锁着 Chrome/125（那正是本仓库 2024 年发过的 default 值，
 * 说明用户从未自定义过），而 default_config 早已是 Chrome/140。
 * B站的 gaia 风控（-352）正是看这类指纹矛盾。
 *
 * 所以策略是：**只有配置值明确比该平台 amagi 内置的更新，才拿它覆盖；否则让 amagi 自己决定。**
 * amagi 每次发版都会跟进真实浏览器版本，把决定权交回给它比我们手工维护 UA 更可靠。
 *
 * @param platform 目标平台。阈值按平台取 —— 早先这里用单一常量 125（douyin 的值），
 *   于是 B站（内置 142）在用户配置为 125 时判断 `125 < 125` 为假、照样覆盖，
 *   等于这个模块想防的事在 B站 上又发生了一遍。
 * @returns 要合并进 amagi 请求头的对象；不该覆盖时返回空对象（注意不能返回
 *   `{ 'User-Agent': undefined }`，那仍然会参与 spread 并把 amagi 的值打掉）
 */
export const buildUserAgentHeader = (platform: AmagiPlatform): Record<string, string> => {
  const configured = Config.request?.['User-Agent']
  if (typeof configured !== 'string' || configured.trim() === '') return {}

  const configuredMajor = readChromeMajor(configured)
  // 认不出版本号的一律尊重用户设置：可能是刻意配的移动端 / 自定义 UA
  if (configuredMajor === null) return { 'User-Agent': configured }

  // 比该平台 amagi 内置的旧就不要覆盖 —— 让 amagi 用它自己那套（UA 与 Sec-Ch-Ua 是配对的）
  if (configuredMajor < AMAGI_BUILTIN_CHROME_MAJOR[platform]) return {}

  return { 'User-Agent': configured }
}

/**
 * 四平台共用一个 amagi 客户端时的 UA 决策（见 Base.ts 里那个 `Client({...})`）。
 *
 * 那个实例把四个平台的 cookie 一起传进去，一次请求走哪个平台在这里是不知道的，
 * 所以取四者里最高的阈值：**只有比所有平台内置 UA 都新，才敢覆盖**。
 * 偏保守的一侧同样是「让 amagi 自己决定」。
 *
 * @returns 要合并进 amagi 请求头的对象；不该覆盖时返回空对象
 */
export const buildSharedUserAgentHeader = (): Record<string, string> => {
  const newest = Object.keys(AMAGI_BUILTIN_CHROME_MAJOR).reduce<AmagiPlatform>(
    (max, key) => (
      AMAGI_BUILTIN_CHROME_MAJOR[key as AmagiPlatform] > AMAGI_BUILTIN_CHROME_MAJOR[max]
        ? key as AmagiPlatform
        : max
    ),
    'douyin'
  )
  return buildUserAgentHeader(newest)
}
