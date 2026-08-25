import type { BotAdapterInfo, MessageEvent } from '@/types/message'

export interface ErrorAdapterInfo {
  name: string
  version: string
  protocol: string
  platform: string
  standard: string
  communication: string
  [key: string]: unknown
}

type AdapterRecord = Record<string, unknown>

// 这张表在 ktr/template/other/handlerError/components/handlerError.tsx 里有一份等价副本。
// 两份不是疏漏：ktr/ 是独立的 SSR/浏览器侧模板树，只从 ktr/utils/ 取共享代码，不导入 src/
// （模板构建没有配 "@/" 别名，也不该把 node 侧运行时代码拖进 vite bundle）。
// 改这里时必须同步改模板那一份，否则错误卡片上的适配器图标会和 src 侧判定结果不一致。
const ADAPTER_LOGO_RULES: Array<{ pattern: RegExp; path: string }> = [
  { pattern: /napcat/i, path: '/image/other/handlerError/napcat.webp' },
  { pattern: /lagrange/i, path: '/image/other/handlerError/lagrange.webp' },
  { pattern: /chronocat/i, path: '/image/other/handlerError/chronocat.svg' },
  { pattern: /llonebot|lltwo(bot)?/i, path: '/image/other/handlerError/llonebot.webp' },
  // 资源名沿用 Karin 的 conwechat 拼写，但宿主适配器自称 ComWeChat（plugins/adapter/ComWeChat.js
  // 里 name = "ComWeChat"），只写 conwechat 的话这条规则在 Yunzai 上一次都命中不到。
  { pattern: /co[mn]wechat/i, path: '/image/other/handlerError/conwechat.webp' },
  { pattern: /go[-_ ]?cq|gocq[-_ ]?http/i, path: '/image/other/handlerError/gocq-http.webp' },
  { pattern: /milky/i, path: '/image/other/handlerError/Milky.png' },
  { pattern: /satori/i, path: '/image/other/handlerError/satori.png' },
  { pattern: /onebot|ob11/i, path: '/image/other/handlerError/onebot.png' },
  // QQBot 放在 OneBot 系之后：官方 Bot 适配器的字段里不会出现 napcat/onebot 等标识，
  // 反过来某些 OneBot 实现的 apk 信息里可能带 "QQ" 字样，让前面的规则先命中更稳。
  { pattern: /qq[-_ ]?bot/i, path: '/image/other/handlerError/QQBot.svg' }
]

const asRecord = (value: unknown): AdapterRecord =>
  typeof value === 'object' && value !== null ? value as AdapterRecord : {}

/**
 * 协议实现（协议端）标识。
 *
 * Karin 的 `bot.adapter` 自带 `protocol`，值就是 `napcat` 这种实现名；Yunzai 的适配器对象里
 * 根本没有这个概念 —— `plugins/adapter/OneBotv11.js` 只写了 `id = "QQ"`、`name = "OneBotv11"`，
 * 前者是平台、后者是协议标准，两个都不是「谁在实现这个协议」。协议端的真名只出现在
 * `get_version_info` 的 `app_name` 里（LLOneBot / NapCat.Onebot / Lagrange.OneBot …），
 * 所以 Yunzai 侧只能按标识串反查。
 *
 * 取值全小写，与 Karin 的 protocol 枚举同一套词（`conwechat`、`gocq-http` 的拼写也照 Karin，
 * 跟 resources/image/other/handlerError 下的资源名对得上），这样同一张卡片在两个宿主上读起来一致。
 *
 * 顺序敏感：
 * - 具体实现全部排在通用 `onebot11` 之前，否则 LLOneBot、NapCat 会被认成通用 OneBot11
 * - `opqbot` 排在 `qqbot` 之前：OPQBot 的字段里同时有 "QQ" 和 "OPQBot"
 * - `qqbot` 排在 OneBot 系之后，理由同 ADAPTER_LOGO_RULES
 */
const PROTOCOL_RULES: Array<{ pattern: RegExp; protocol: string }> = [
  { pattern: /napcat/i, protocol: 'napcat' },
  { pattern: /lagrange/i, protocol: 'lagrange' },
  { pattern: /chronocat/i, protocol: 'chronocat' },
  { pattern: /llonebot|lltwo(bot)?/i, protocol: 'llonebot' },
  { pattern: /shamrock/i, protocol: 'shamrock' },
  { pattern: /go[-_ ]?cq|gocq[-_ ]?http/i, protocol: 'gocq-http' },
  { pattern: /co[mn]wechat/i, protocol: 'conwechat' },
  { pattern: /opq/i, protocol: 'opqbot' },
  { pattern: /gsuid/i, protocol: 'gsuidcore' },
  { pattern: /milky/i, protocol: 'milky' },
  { pattern: /satori/i, protocol: 'satori' },
  { pattern: /stdin|标准输入/i, protocol: 'stdin' },
  { pattern: /onebot|ob11/i, protocol: 'onebot11' },
  { pattern: /qq[-_ ]?bot/i, protocol: 'qqbot' }
]

const asText = (value: unknown): string => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''

const firstText = (...values: unknown[]): string => values.map(asText).find(Boolean) || ''

/**
 * 不能进标识串的适配器字段。
 *
 * `getLabels` 靠 `Object.values(adapter)` 做通用识别 —— 宿主各异，写死键名会漏。
 * 代价是适配器实例上的凭据也会被一起扫进去：Satori 的适配器实例上就挂着
 * `token`（`cfg.satori.token`）和 `httpEndpoint` / `wsEndpoint`
 * （见宿主 plugins/adapter/Satori.js 的 load），而 labels 会随
 * `adapterInfo` 进错误卡片的渲染数据。错误卡片是直接回复到群里的，
 * 所以这里按键名和值形态把凭据与内网地址挡在外面。
 */
const SECRET_KEY = /token|secret|password|passwd|auth|cookie|credential|sign|salt|key$|^key/i
const looksLikeAddress = (value: string): boolean => /^(wss?|https?):\/\//i.test(value)

/** 适配器/协议端上报里能用于识别的标识串，已剔除凭据与地址 */
const getLabels = (event: MessageEvent): string[] => {
  const adapter = event.bot?.adapter
  const adapterRecord = asRecord(adapter)
  const botVersion = asRecord(event.bot?.version)
  const apk = asRecord(event.bot?.apk)

  const safeValues = (record: AdapterRecord): unknown[] =>
    Object.entries(record)
      .filter(([key]) => !SECRET_KEY.test(key))
      .map(([, value]) => value)

  return [
    typeof adapter === 'string' ? adapter : '',
    event.adapter_id,
    event.adapter_name,
    ...safeValues(adapterRecord),
    ...safeValues(botVersion),
    ...safeValues(apk)
  ].map(asText).filter(Boolean).filter(label => !looksLikeAddress(label))
}

/**
 * 版本号。挡掉两种「取到了但没意义」的值：
 *
 * - `undefined vundefined`：宿主 plugins/adapter/OneBotv11.js 的 `bot.version` 上有个
 *   **无条件定义**的 `get version()`，返回 `app_full_name || \`${app_name} v${app_version}\``。
 *   协议端不实现 `get_version_info`（或回了非 0 retcode）时 spread 进来的是空对象，
 *   这个 getter 就求值成字面量 `"undefined vundefined"` —— 它是 truthy，
 *   于是候选链在这里停住，永远走不到 `unknown`，卡片上印出 `vundefined vundefined`。
 * - `Lagrange.Milky v3.0.1` 这种「名字 + 版本」复合串：宿主 Milky.js 的 syncImplInfo
 *   就是这么拼的。名字那格已经单独有了，这里只要版本号；顺带绕开 `adapter.version`
 *   ——那是 Milky 适配器自己写死的 `1.0.0`，不是协议端的版本。
 */
const asVersionText = (value: unknown): string => {
  const text = asText(value)
  if (!text || /undefined|\bNaN\b/i.test(text)) return ''
  if (/^v?\d/.test(text)) return text
  // 复合串里抽版本号；抽不出来就整串留着，好过报 unknown
  return /v?(\d+(?:\.\d+)+\S*)\s*$/.exec(text)?.[1] || text
}

const firstVersion = (...values: unknown[]): string => values.map(asVersionText).find(Boolean) || ''

/**
 * 协议标准。取值同样对齐 Karin 的枚举（`onebot11` / `onebot12` / `satori` / `milky` / `qqbot`）：
 * 模板那格是 `_.upperFirst(_.camelCase(standard))` 出字，`onebot11` 会渲染成 `Onebot11`，
 * 跟上游卡片一字不差；而且模板的 OneBot 角标判定写的是 `standard.includes('onebot')`
 * ——大小写敏感，之前返回的 `OneBot` 永远命中不到，角标在 Yunzai 上从来没出现过。
 */
const getStandard = (labels: string[], explicit: unknown): string => {
  const value = firstText(explicit)
  if (value) return value
  const joined = labels.join(' ').toLowerCase()
  if (joined.includes('milky')) return 'milky'
  if (joined.includes('satori') || joined.includes('chronocat')) return 'satori'
  // ComWeChat 实现的是 OneBot 12：宿主适配器调的是 ob12 的 `get_version`，不是 ob11 的
  // `get_version_info`（见 plugins/adapter/ComWeChat.js）。这条必须排在通用 onebot 之前。
  if (joined.includes('onebot12') || /co[mn]wechat/.test(joined)) return 'onebot12'
  if (
    joined.includes('onebot') ||
    joined.includes('napcat') ||
    joined.includes('lagrange') ||
    joined.includes('llonebot') ||
    joined.includes('shamrock') ||
    joined.includes('gocq') ||
    joined.includes('go-cq')
  ) return 'onebot11'
  // QQBot 走官方 Bot 开放平台接口，不属于上面任何一种社区协议标准。
  // 判定放在 OneBot 之后：'qqbot' 不含 'onebot'，但 OneBot 实现的 apk 信息里可能带 QQ 字样。
  if (joined.includes('qqbot')) return 'qqbot'
  return 'unknown'
}

/**
 * 这个值像不像一个 WebSocket 实例：`ws` 包的实例同时有数字 `readyState` 和 `send()`，
 * 普通配置对象不会两者都有。
 */
const isWebSocketLike = (value: AdapterRecord): boolean =>
  typeof value.readyState === 'number' && typeof value.send === 'function'

/**
 * 通信方式。
 *
 * Karin 的 `bot.adapter` 自带 `communication`（上游卡片上那个 `webSocketServer` 就是它），
 * Yunzai 的适配器对象里没有这个字段，所以只探适配器上的几个键必然一个都探不到
 * ——这一格在 Yunzai 上永远是 unknown。
 *
 * Yunzai 侧改成认 socket 实例：TRSS-Yunzai 自己起 `WebSocketServer`（lib/bot.js），
 * 协议端反连进来，连接对象挂在 `bot.ws`（plugins/adapter/OneBotv11.js 的 connect）；
 * Milky / Satori 这类反过来是 `new WebSocket(url)` 主动外连，socket 挂在 bot 或适配器身上。
 * `ws` 包只在客户端实例上写 `url`（lib/websocket.js 的 initAsClient），服务端 accept 出来的
 * 连接没有这个属性，正好用来分方向。
 */
const getCommunication = (event: MessageEvent, adapterRecord: AdapterRecord): string => {
  const explicit = firstText(adapterRecord.communication, adapterRecord.transport, adapterRecord.mode)
  if (explicit) return explicit

  const socket = [asRecord(event.bot?.ws), asRecord(adapterRecord.ws)].find(isWebSocketLike)
  if (socket) return asText(socket.url) ? 'webSocketClient' : 'webSocketServer'

  return firstText(adapterRecord.type) || 'unknown'
}

/**
 * 把各宿主/各协议端暴露的适配器字段抹平成一套。判定优先级刻意分了两层：
 * 适配器对象自带的字段优先（Karin 那边这几格本来就是现成的），Yunzai 侧再从协议端上报里反查。
 *
 * - `name`：协议端真名（`bot.version.app_name`）优先于宿主适配器名。Yunzai 上
 *   `adapter.name` 恒为 `OneBotv11` 这种协议标准名，拿它当适配器名的话，接 LLOneBot、
 *   接 NapCat、接 Lagrange 全都显示成一个词，卡片对排障就没有价值了；Karin 上没有这一层，
 *   会自然落到 `adapter.name`（那边它已经是 `NapCat.Onebot`）。
 * - `protocol`：只认真正的实现标识，认不出就 unknown。之前拿 `adapter.id` 兜底，
 *   而 Yunzai 的 `adapter.id` 是平台（`"QQ"`），于是「协议实现」那格显示的是平台名。
 * - `platform`：不再拿 `app_name` 兜底 —— `LLOneBot` 是协议端不是平台。
 */
export const getAdapterInfo = (event?: MessageEvent): ErrorAdapterInfo | undefined => {
  if (!event?.bot && !event?.adapter_name && !event?.adapter_id) return undefined

  const adapter = event.bot?.adapter
  const adapterRecord = asRecord(adapter)
  const botVersion = asRecord(event.bot?.version)
  const apk = asRecord(event.bot?.apk)
  const labels = getLabels(event)

  const name = firstText(
    botVersion.app_name,
    adapterRecord.name,
    event.adapter_name,
    typeof adapter === 'string' ? adapter : '',
    adapterRecord.id,
    adapterRecord.platform,
    event.adapter_id,
    apk.display,
    botVersion.app_full_name,
    botVersion.name,
    'unknown'
  )
  const version = firstVersion(
    // 协议端上报的版本优先于适配器自称的版本：Milky 适配器实例上的 `version` 是写死的
    // `1.0.0`（宿主 Milky.js），真实现版本在 syncImplInfo 写进来的 `bot.version.version` 里
    botVersion.app_version,
    apk.version,
    botVersion.version,
    adapterRecord.version,
    botVersion.id,
    'unknown'
  )
  const platform = firstText(
    adapterRecord.platform,
    event.adapter_id,
    adapterRecord.id,
    typeof adapter === 'string' ? adapter : '',
    'unknown'
  )
  const protocol = firstText(
    adapterRecord.protocol,
    adapterRecord.protocol_name,
    PROTOCOL_RULES.find(rule => rule.pattern.test(labels.join(' ')))?.protocol,
    'unknown'
  )

  return {
    name,
    version,
    protocol,
    platform,
    standard: getStandard(labels, adapterRecord.standard),
    communication: getCommunication(event, adapterRecord),
    labels
  }
}

/**
 * Resolve the handlerError asset by matching every normalized adapter field.
 */
export const getAdapterLogoPath = (adapterInfo: Pick<ErrorAdapterInfo, 'name' | 'version'> & Partial<ErrorAdapterInfo>): string | undefined => {
  const values = Object.values(adapterInfo).map(asText).filter(Boolean).join(' ')
  return ADAPTER_LOGO_RULES.find(rule => rule.pattern.test(values))?.path
}

export type { BotAdapterInfo }
