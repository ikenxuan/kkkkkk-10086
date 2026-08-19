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
}

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
