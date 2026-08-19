import type { MessageEvent, MessageId } from '@/types/message'
import cfg from '@/runtime/host/config'
import Config from '@/module/utils/Config'
import type { ErrorHandlerContext } from './strategy.js'

const getBotId = (event?: MessageEvent): MessageId | undefined => {
  return (event?.self_id || event?.selfId || event?.bot?.uin || event?.bot?.self_id || event?.bot?.selfId) as
    | MessageId
    | undefined
}

const getMasterList = (): string[] => {
  if (Array.isArray(cfg.masterQQ)) return cfg.masterQQ.map(String).filter(Boolean)
  if (Array.isArray(cfg.master)) return cfg.master.map(String).filter(Boolean)
  return []
}

const sendPrivate = async (botId: MessageId, userId: string, message: unknown): Promise<boolean> => {
  const bot = botId ? Bot?.[botId] : undefined
  const friend = bot?.pickFriend?.(userId)
  if (!friend?.sendMsg) return false

  await friend.sendMsg(message as Parameters<typeof friend.sendMsg>[0])
  return true
}

export const sendErrorToTrigger = async (ctx: ErrorHandlerContext, message: unknown): Promise<void> => {
  if (!ctx.event || !Config.app.errorLogSendTo?.includes('trigger')) return

  try {
    await ctx.event.reply!(message)
  } catch (error: unknown) {
    logger.error(`[ErrorHandler] 发送错误消息给触发者失败: ${getErrorMessage(error)}`)
  }
}

export const sendErrorToMaster = async (ctx: ErrorHandlerContext, message: unknown): Promise<void> => {
  if (!Config.app.errorLogSendTo?.includes('master')) return

  const master = getMasterList()[0]
  const botId = getBotId(ctx.event)
  if (!master || !botId) return

  try {
    await sendPrivate(botId, master, message)
  } catch (error: unknown) {
    logger.error(`[ErrorHandler] 发送错误消息给主人失败: ${getErrorMessage(error)}`)
  }
}

export const sendErrorToAllMasters = async (ctx: ErrorHandlerContext, message: unknown): Promise<void> => {
  if (!Config.app.errorLogSendTo?.includes('allMasters')) return

  const botId = getBotId(ctx.event)
  if (!botId) return

  for (const master of new Set(getMasterList())) {
    try {
      await sendPrivate(botId, master, message)
    } catch (error: unknown) {
      logger.error(`[ErrorHandler] 发送错误消息给主人 ${master} 失败: ${getErrorMessage(error)}`)
    }
  }
}

function getErrorMessage (error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error && error.message) {
    return String(error.message)
  }
  return String(error)
}
