import cfg from '../../../../../lib/config/config.js'
import Config from '../Config.js'

const getBotId = (event) => event?.self_id || event?.selfId || event?.bot?.uin || event?.bot?.self_id || event?.bot?.selfId

const getMasterList = () => {
  if (Array.isArray(cfg.masterQQ)) return cfg.masterQQ.map(String).filter(Boolean)
  if (Array.isArray(cfg.master)) return cfg.master.map(String).filter(Boolean)
  return []
}

const sendPrivate = async (botId, userId, message) => {
  const bot = botId ? Bot?.[botId] : undefined
  const friend = bot?.pickFriend?.(userId)
  if (!friend?.sendMsg) return false

  await friend.sendMsg(message)
  return true
}

export const sendErrorToTrigger = async (ctx, message) => {
  if (!ctx.event || !Config.app.errorLogSendTo?.includes('trigger')) return

  try {
    await ctx.event.reply(message)
  } catch (error) {
    logger.error(`[ErrorHandler] 发送错误消息给触发者失败: ${error?.message || error}`)
  }
}

export const sendErrorToMaster = async (ctx, message) => {
  if (!Config.app.errorLogSendTo?.includes('master')) return

  const master = getMasterList()[0]
  const botId = getBotId(ctx.event)
  if (!master || !botId) return

  try {
    await sendPrivate(botId, master, message)
  } catch (error) {
    logger.error(`[ErrorHandler] 发送错误消息给主人失败: ${error?.message || error}`)
  }
}

export const sendErrorToAllMasters = async (ctx, message) => {
  if (!Config.app.errorLogSendTo?.includes('allMasters')) return

  const botId = getBotId(ctx.event)
  if (!botId) return

  for (const master of new Set(getMasterList())) {
    try {
      await sendPrivate(botId, master, message)
    } catch (error) {
      logger.error(`[ErrorHandler] 发送错误消息给主人 ${master} 失败: ${error?.message || error}`)
    }
  }
}
