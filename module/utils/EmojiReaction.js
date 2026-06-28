import Config from './Config.js'

const PLATFORM_EMOJI_IDS = {
  qq: {
    EYES: 128064,
    PROCESSING: 366,
    SUCCESS: 389,
    ERROR: 379
  },
  discord: {
    EYES: '👀',
    PROCESSING: '⏳',
    SUCCESS: '✅',
    ERROR: '❌'
  },
  other: {
    EYES: 128064,
    PROCESSING: 366,
    SUCCESS: 389,
    ERROR: 379
  }
}

const EMOJI_TYPES = ['EYES', 'PROCESSING', 'SUCCESS', 'ERROR']

const getMessageId = (event) => event?.message_id || event?.messageId || event?.message?.id

const getContact = (event) => event?.contact || event?.group || event?.friend

const getPlatform = (event) => {
  const adapter = event?.bot?.adapter
  return adapter?.platform || adapter?.name || adapter || 'other'
}

export const getEmojiId = (event, type) => {
  const platform = String(getPlatform(event)).toLowerCase()
  const group = platform.includes('discord')
    ? PLATFORM_EMOJI_IDS.discord
    : platform.includes('qq') || platform.includes('onebot') || platform.includes('lagrange') || platform.includes('napcat')
      ? PLATFORM_EMOJI_IDS.qq
      : PLATFORM_EMOJI_IDS.other
  return group[type] ?? PLATFORM_EMOJI_IDS.other[type]
}

const setByBotMethod = async (event, emojiId, isSet) => {
  const bot = event?.bot
  const messageId = getMessageId(event)
  const contact = getContact(event)

  if (typeof bot?.setMsgReaction === 'function' && contact && messageId) {
    await bot.setMsgReaction(contact, messageId, emojiId, isSet)
    return true
  }

  if (typeof bot?.sendApi === 'function' && messageId) {
    await bot.sendApi('set_msg_emoji_like', {
      message_id: messageId,
      emoji_id: emojiId,
      set: isSet
    })
    return true
  }

  return false
}

export const setEmojiReaction = async (event, emojiId, isSet = true) => {
  if (!Config.app.EmojiReply) return false
  if (!event || event.isPrivate || event.is_private || !getMessageId(event)) return false

  try {
    return await setByBotMethod(event, emojiId, isSet)
  } catch (error) {
    logger.debug(`[EmojiReaction] 设置表情回应失败（已忽略）: ${error?.message || error}`)
    return false
  }
}

export class EmojiReactionManager {
  constructor (event) {
    this.event = event
    this.emojiIds = new Set()
  }

  getPlatformEmojiId (type) {
    return getEmojiId(this.event, type)
  }

  normalizeEmojiId (emojiId) {
    return typeof emojiId === 'string' && EMOJI_TYPES.includes(emojiId)
      ? this.getPlatformEmojiId(emojiId)
      : emojiId
  }

  async add (emojiId) {
    const actualEmojiId = this.normalizeEmojiId(emojiId)
    const success = await setEmojiReaction(this.event, actualEmojiId, true)
    if (success) this.emojiIds.add(actualEmojiId)
    return success
  }

  async remove (emojiId) {
    const actualEmojiId = this.normalizeEmojiId(emojiId)
    const success = await setEmojiReaction(this.event, actualEmojiId, false)
    if (success) this.emojiIds.delete(actualEmojiId)
    return success
  }

  async replace (oldEmojiId, newEmojiId, delayMs = 2000) {
    const addSuccess = await this.add(newEmojiId)
    await new Promise(resolve => setTimeout(resolve, delayMs))
    await this.remove(oldEmojiId)
    return addSuccess
  }

  async clearAll () {
    let count = 0
    for (const emojiId of this.emojiIds) {
      if (await setEmojiReaction(this.event, emojiId, false)) count++
    }
    this.emojiIds.clear()
    return count
  }

  has (emojiId) {
    return this.emojiIds.has(this.normalizeEmojiId(emojiId))
  }

  count () {
    return this.emojiIds.size
  }
}
