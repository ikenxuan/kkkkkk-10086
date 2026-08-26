import type { Readable } from 'node:stream'

export type MessageId = string | number
export type EmojiId = string | number
export type MessageMedia = string | Buffer | Readable
export type MessageSegment = string | MessageElement
export type MessageContent = MessageSegment | MessageSegment[]

export interface MessageElementData {
  text?: string
  data?: string | MessageElementData
  file?: MessageMedia
  url?: MessageMedia
  fid?: string
  message?: MessageContent
  [key: string]: unknown
}

export interface MessageElement {
  type?: string
  id?: MessageId
  message_id?: MessageId
  user_id?: MessageId
  qq?: MessageId | 'all'
  text?: string
  file?: MessageMedia
  url?: MessageMedia
  fid?: string
  name?: string
  width?: number | string
  height?: number | string
  data?: string | MessageElementData
  message?: MessageContent
  [key: string]: unknown
}

export interface MessageContact {
  getChatHistory?: (cursor: number, count: number) => Promise<Array<{ message?: MessageContent }>>
}

export interface BotAdapterInfo {
  id?: string
  platform?: string
  name?: string
  version?: string
  /**
   * 下面这几个键是 Karin 的 `bot.adapter` 才有的（Yunzai 的适配器实例上一个都没有）。
   * `getAdapterInfo` 优先读它们：宿主已经把结论算好了就别再自己猜。
   */
  standard?: string
  protocol?: string
  protocol_name?: string
  communication?: string
  transport?: string
  mode?: string
  type?: string
  ws?: unknown
  /**
   * 适配器实例上还挂着一堆与身份无关的东西：Satori 的 token 和两个端点、
   * OneBotv11 的 path / echo / timeout……官方 `@types/trss-yunzai` 的 `Adapter`
   * 类同样是 `[k: string]: any`。`getAdapterInfo` 本来就是拿 `asRecord` 动态扫这些键
   * （并用 SECRET_KEY / looksLikeAddress 把凭据和地址剔掉），所以这里照实开放，
   * 否则照真实形状写的 fixture 会被 TS 的多余属性检查挡下来。
   */
  [key: string]: unknown
}

/**
 * 协议端上报的版本信息。
 *
 * 键名与宿主 `bot.version` 对齐：TRSS 把 `get_version_info` 的结果 spread 进去，
 * 再补上 `id`（平台）、`name`（适配器名）和一个算 `version` 的 getter。
 * 官方 `@types/trss-yunzai` 的 `Client['version']` 索引签名是 `string | undefined`，
 * 与这里逐字段可选是同一个意思 —— 但**不从包派生**：协议端不实现 `get_version_info`
 * 时 spread 进来是空对象，包把 `id`/`name` 声明成必填，派生会让「照真实形状写 fixture」
 * 被类型挡下来。`app_name` 这几个键包里也没有（它们来自 OneBot 协议端而非宿主）。
 */
export interface BotVersionInfo {
  id?: string
  name?: string
  version?: string
  app_name?: string
  app_full_name?: string
  app_version?: string
}

export interface MessageBot {
  uin?: MessageId | MessageId[]
  self_id?: MessageId
  selfId?: MessageId
  adapter?: string | BotAdapterInfo
  apk?: { display?: string; version?: string }
  version?: BotVersionInfo
  /**
   * 适配器挂上来的 WebSocket 连接。
   *
   * TRSS-Yunzai 的每个 ws 适配器都会在 connect 时写 `Bot[self_id].ws = ws`
   * （见宿主 plugins/adapter/OneBotv11.js）。这里只用来判「通信方式」这一格，
   * 不碰它的任何方法，所以按 unknown 收，由 getAdapterInfo 自己做鸭子类型判定。
   */
  ws?: unknown
  /**
   * 协议端 SDK 实例。
   *
   * 有的适配器不把 socket 挂在 bot 上，而是留在自己封装的 SDK 里：QQBot-Plugin 用的
   * @windtrace/qq-group-bot 就是由 SessionManager 写 `sdk.ws`（lib/sessionManager.js 的
   * connect），`Bot[uin].ws` 从头到尾没被赋值过。同样只用于判「通信方式」，按 unknown 收。
   */
  sdk?: unknown
  /**
   * 连接统计。`start_time` 是连接建立时刻，**单位是秒**
   * （OneBotv11 取事件的 `data.time`，其余适配器多是 `Date.now() / 1000`）。
   * Karin 那边对应的是 `adapter.connectTime`（毫秒），宿主 Yunzai 没有那个键。
   */
  stat?: { start_time?: unknown }
  setMsgReaction?: (
    contact: unknown,
    messageId: MessageId,
    emojiId: EmojiId,
    isSet: boolean
  ) => Promise<unknown>
  sendApi?: (action: string, params: Record<string, unknown>) => Promise<unknown>
  sendUni?: (...args: unknown[]) => Promise<unknown>
}

/**
 * 命令处理函数收到的事件。
 *
 * Yunzai 只有在 `rule[].reg` 匹配过 `e.msg` 之后才会派发到对应的 `fnc`，
 * 因此在处理函数内部 `msg` 必然已经是字符串。
 */
export type CommandEvent = MessageEvent & { msg: string }

export interface MessageEvent {
  msg?: string
  message?: MessageContent
  message_id?: MessageId
  messageId?: MessageId
  message_seq?: MessageId
  reply_id?: MessageId
  source?: { seq: number; time: number }
  isGroup?: boolean
  isPrivate?: boolean
  is_private?: boolean
  group_id?: MessageId
  groupId?: MessageId
  user_id?: MessageId
  userId?: MessageId
  self_id?: MessageId
  selfId?: MessageId
  sender?: { user_id?: MessageId; userId?: MessageId }
  contact?: unknown
  group?: MessageContact
  friend?: MessageContact
  bot?: MessageBot
  getReply?: () => Promise<unknown>
  /**
   * 回复消息，签名对齐宿主 `lib/plugins/loader.js` 注入的 `e.reply`。
   *
   * 第二个参数是「是否引用回复」，宿主只对它做真假判断；`at` / `recallMsg` 属于第三个参数。
   */
  reply?: (
    message: unknown,
    quote?: boolean,
    data?: { at?: boolean, recallMsg?: number }
  ) => Promise<unknown>
  [key: string]: unknown
}
