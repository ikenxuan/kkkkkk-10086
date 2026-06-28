import { getStrategies } from './strategy.js'
import { renderErrorReport } from './render.js'
import { sendErrorToAllMasters, sendErrorToMaster, sendErrorToTrigger } from './sender.js'
import { EmojiReactionManager } from '../EmojiReaction.js'

export const handleBusinessError = async (error, options, logs = [], event) => {
  const ctx = {
    error,
    options,
    logs,
    event
  }

  for (const strategy of getStrategies()) {
    try {
      if (!strategy.match(ctx)) continue
      const result = await strategy.handle(ctx)
      if (result === 'handled') return 'handled'
    } catch (strategyError) {
      logger.error(`[ErrorHandler] 策略 ${strategy.name} 执行失败: ${strategyError?.message || strategyError}`)
    }
  }

  const report = await renderErrorReport(ctx)
  const message = Array.isArray(report) ? report : [report]
  await sendErrorToTrigger(ctx, message)
  await sendErrorToMaster(ctx, message)
  await sendErrorToAllMasters(ctx, message)

  if (options.customErrorHandler) {
    await options.customErrorHandler(error, logs)
  }

  return undefined
}

export const wrapWithErrorHandler = (fn, options) => {
  return async (event, next = () => undefined) => {
    const emojiManager = event ? new EmojiReactionManager(event) : null
    let processingTimer = null
    let successTimer = null

    if (emojiManager) {
      await emojiManager.add('EYES')
      processingTimer = setTimeout(() => {
        emojiManager.add('PROCESSING').catch(() => {})
      }, 1500)
    }

    try {
      const result = await fn(event, next)
      if (emojiManager) {
        successTimer = setTimeout(() => {
          emojiManager.replace('PROCESSING', 'SUCCESS').catch(() => {})
        }, 1500)
      }
      return result
    } catch (error) {
      if (processingTimer) clearTimeout(processingTimer)
      if (successTimer) clearTimeout(successTimer)
      if (emojiManager) {
        if (emojiManager.has('PROCESSING')) await emojiManager.remove('PROCESSING')
        await emojiManager.add('ERROR')
      }
      logger.error(`[${options.businessName}] 执行失败`, error)
      const result = await handleBusinessError(error, options, [], event)
      if (result === 'handled') return true
      await event?.reply?.(`处理失败：${error?.message || error}`)
      return true
    }
  }
}
