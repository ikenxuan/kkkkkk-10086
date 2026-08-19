import type { EmojiId, MessageEvent, MessageId } from '@/types/message'
import Config from './Config.js'

const PLATFORM_EMOJI_IDS = {
  qq: { EYES: 128064, PROCESSING: 366, SUCCESS: 389, ERROR: 379 },
  discord: { EYES: '👀', PROCESSING: '⏳', SUCCESS: '✅', ERROR: '❌' },
  other: { EYES: 128064, PROCESSING: 366, SUCCESS: 389, ERROR: 379 }
} as const

type EmojiType = keyof typeof PLATFORM_EMOJI_IDS.qq
const EMOJI_TYPES: EmojiType[] = ['EYES', 'PROCESSING', 'SUCCESS', 'ERROR']

const getMessageId = (event?: MessageEvent): MessageId | undefined => {
  const message = event?.message
  const nestedId = !Array.isArray(message) && typeof message === 'object' && message !== null
    ? message.id ?? message.message_id
    : undefined
  return event?.message_id ?? event?.messageId ?? nestedId
}

const getMessageSequence = (event?: MessageEvent): MessageId | undefined =>
  event?.message_seq ?? getMessageId(event)

const getGroupId = (event?: MessageEvent): MessageId | undefined =>
  event?.group_id ?? event?.groupId

const getContact = (event?: MessageEvent): unknown => event?.contact || event?.group || event?.friend

const hasId = (value: MessageId | undefined): value is MessageId =>
  value !== undefined && value !== ''

const toInteger = (value: MessageId | undefined): number | undefined => {
  if (!hasId(value)) return undefined
  const result = Number(value)
  return Number.isSafeInteger(result) && result >= 0 ? result : undefined
}

const normalizeLabels = (values: unknown[]): string[] => values
  .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
  .map(value => String(value).trim().toLowerCase())
  .filter(Boolean)

const getAdapterLabels = (event: MessageEvent): string[] => {
  const adapter = event.bot?.adapter
  const eventLabels = [event.adapter_id, event.adapter_name]
  if (typeof adapter === 'string') {
    return normalizeLabels([adapter, ...eventLabels, event.bot?.version?.app_name])
  }
  return normalizeLabels([
    ...eventLabels,
    adapter?.id,
    adapter?.platform,
    adapter?.name,
    adapter?.version,
    // Yunzai exposes the concrete protocol implementation here on some adapters.
    event.bot?.version?.app_name
  ])
}

const getImplementationLabels = (event: MessageEvent): string[] => {
  const apk = event.bot?.apk
  const version = event.bot?.version
  return [
    ...getAdapterLabels(event),
    ...normalizeLabels([
      apk?.display,
      apk?.version,
      version?.id,
      version?.name,
      version?.version,
      version?.app_name,
      version?.app_full_name,
      version?.app_version
    ])
  ]
}

const labelsInclude = (labels: string[], value: string): boolean =>
  labels.some(label => label.includes(value))

const isMilkyAdapter = (event: MessageEvent): boolean =>
  labelsInclude(getImplementationLabels(event), 'milky')

const isOneBotAdapter = (event: MessageEvent): boolean => getImplementationLabels(event).some(label =>
  label === 'qq' ||
  label.includes('onebot') ||
  label.includes('napcat') ||
  label.includes('lagrange') ||
  label.includes('luma') ||
  label.includes('llonebot')
)

const getPlatform = (event?: MessageEvent): string => {
  const adapter = event?.bot?.adapter
  if (typeof adapter === 'string') return adapter
  return adapter?.platform || adapter?.name || event?.bot?.version?.app_name || 'other'
}

interface RawReactionRequest {
  action: string
  params: Record<string, unknown>
}

const buildRawReactionRequest = (
  event: MessageEvent,
  emojiId: EmojiId,
  isSet: boolean
): RawReactionRequest | undefined => {
  const messageId = getMessageId(event)
  if (!hasId(messageId)) return undefined

  if (isMilkyAdapter(event)) {
    const groupId = toInteger(getGroupId(event))
    const messageSequence = toInteger(getMessageSequence(event))
    if (groupId === undefined || messageSequence === undefined) return undefined
    return {
      action: 'send_group_message_reaction',
      params: {
        group_id: groupId,
        message_seq: messageSequence,
        reaction: String(emojiId),
        reaction_type: 'face',
        is_add: isSet
      }
    }
  }

  if (!isOneBotAdapter(event)) return undefined
  const labels = getImplementationLabels(event)

  if (labelsInclude(labels, 'lagrange')) {
    const groupId = toInteger(getGroupId(event))
    if (groupId === undefined) return undefined
    return {
      action: 'set_group_reaction',
      params: {
        group_id: groupId,
        message_id: messageId,
        code: String(emojiId),
        is_add: isSet
      }
    }
  }

  if (labelsInclude(labels, 'luma')) {
    const groupId = toInteger(getGroupId(event))
    if (groupId === undefined) return undefined
    return {
      action: 'set_group_reaction',
      params: {
        group_id: groupId,
        message_id: messageId,
        code: String(emojiId),
        is_set: isSet
      }
    }
  }

  if (labelsInclude(labels, 'napcat') || labelsInclude(labels, 'llonebot')) {
    return {
      action: 'set_msg_emoji_like',
      params: { message_id: messageId, emoji_id: emojiId, set: isSet }
    }
  }

  return undefined
}

const isSuccessfulApiResponse = (response: unknown): boolean => {
  if (response === false) return false
  if (typeof response !== 'object' || response === null) return true

  const result = response as Record<string, unknown>
  if (result.success === false || result.ok === false) return false

  const status = typeof result.status === 'string' ? result.status.toLowerCase() : undefined
  if (status === 'failed' || status === 'failure' || status === 'error') return false

  if (result.retcode !== undefined) {
    const retcode = Number(result.retcode)
    if (Number.isFinite(retcode) && retcode !== 0 && retcode !== 1) return false
  }
  return true
}

export const getEmojiId = (event: MessageEvent | undefined, type: EmojiType): EmojiId => {
  const platform = getPlatform(event).toLowerCase()
  const group = platform.includes('discord')
    ? PLATFORM_EMOJI_IDS.discord
    : platform.includes('qq') || platform.includes('onebot') || platform.includes('lagrange') || platform.includes('napcat')
      ? PLATFORM_EMOJI_IDS.qq
      : PLATFORM_EMOJI_IDS.other
  return group[type] ?? PLATFORM_EMOJI_IDS.other[type]
}

const isUnsupportedReactionError = (error: unknown): boolean => {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message)
        : ''
  return /unsupported|not\s+supported|not\s+implemented|unimplemented|不支持|未实现/i.test(message)
}

const setByRawApi = async (event: MessageEvent, emojiId: EmojiId, isSet: boolean): Promise<boolean> => {
  const bot = event.bot
  if (typeof bot?.sendApi !== 'function') return false
  const request = buildRawReactionRequest(event, emojiId, isSet)
  if (!request) return false
  const response = await bot.sendApi(request.action, request.params)
  return isSuccessfulApiResponse(response)
}

const setByBotMethod = async (event: MessageEvent, emojiId: EmojiId, isSet: boolean): Promise<boolean> => {
  const bot = event.bot
  const messageId = getMessageId(event)
  const contact = getContact(event)

  if (typeof bot?.setMsgReaction === 'function' && contact && hasId(messageId)) {
    try {
      const response = await bot.setMsgReaction(contact, messageId, emojiId, isSet)
      return isSuccessfulApiResponse(response)
    } catch (error: unknown) {
      if (!isUnsupportedReactionError(error)) return false
    }
  }
  return setByRawApi(event, emojiId, isSet)
}

export const setEmojiReaction = async (
  event: MessageEvent | undefined,
  emojiId: EmojiId,
  isSet = true
): Promise<boolean> => {
  if (!Config.app.EmojiReply) return false
  if (!event || event.isPrivate || event.is_private || !hasId(getMessageId(event))) return false
  try {
    return await setByBotMethod(event, emojiId, isSet)
  } catch (error: unknown) {
    logger.debug(`[EmojiReaction] 设置表情回应失败（已忽略）: ${getErrorMessage(error)}`)
    return false
  }
}

export class EmojiReactionManager {
  readonly event: MessageEvent
  readonly emojiIds = new Set<EmojiId>()

  constructor (event: MessageEvent) {
    this.event = event
  }

  getPlatformEmojiId (type: EmojiType): EmojiId {
    return getEmojiId(this.event, type)
  }

  normalizeEmojiId (emojiId: EmojiId | EmojiType): EmojiId {
    return typeof emojiId === 'string' && isEmojiType(emojiId)
      ? this.getPlatformEmojiId(emojiId)
      : emojiId
  }

  async add (emojiId: EmojiId | EmojiType): Promise<boolean> {
    const actualEmojiId = this.normalizeEmojiId(emojiId)
    const success = await setEmojiReaction(this.event, actualEmojiId, true)
    if (success) this.emojiIds.add(actualEmojiId)
    return success
  }

  async remove (emojiId: EmojiId | EmojiType): Promise<boolean> {
    const actualEmojiId = this.normalizeEmojiId(emojiId)
    const success = await setEmojiReaction(this.event, actualEmojiId, false)
    if (success) this.emojiIds.delete(actualEmojiId)
    return success
  }

  async replace (
    oldEmojiId: EmojiId | EmojiType,
    newEmojiId: EmojiId | EmojiType,
    delayMs = 2000
  ): Promise<boolean> {
    const addSuccess = await this.add(newEmojiId)
    await new Promise(resolve => setTimeout(resolve, delayMs))
    await this.remove(oldEmojiId)
    return addSuccess
  }

  async clearAll (): Promise<number> {
    let count = 0
    for (const emojiId of this.emojiIds) {
      if (await setEmojiReaction(this.event, emojiId, false)) count++
    }
    this.emojiIds.clear()
    return count
  }

  has (emojiId: EmojiId | EmojiType): boolean {
    return this.emojiIds.has(this.normalizeEmojiId(emojiId))
  }

  count (): number {
    return this.emojiIds.size
  }
}

function isEmojiType (value: string): value is EmojiType {
  return EMOJI_TYPES.includes(value as EmojiType)
}

function getErrorMessage (error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
