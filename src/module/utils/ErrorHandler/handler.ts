import type { MessageEvent } from '../../../types/message.js'
import { EmojiReactionManager } from '../EmojiReaction.js'
import { renderErrorReport } from './render.js'
import { sendErrorToAllMasters, sendErrorToMaster, sendErrorToTrigger } from './sender.js'
import { getStrategies, type ErrorHandlerContext, type ErrorHandlerOptions } from './strategy.js'

type NextFunction = () => unknown
type BusinessHandler<TResult> = (event: MessageEvent | undefined, next: NextFunction) => TResult | PromiseLike<TResult>

export const handleBusinessError = async (
  error: unknown,
  options: ErrorHandlerOptions,
  logs: unknown[] = [],
  event?: MessageEvent
): Promise<'handled' | undefined> => {
  const ctx: ErrorHandlerContext = {
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
    } catch (strategyError: unknown) {
      logger.error(`[ErrorHandler] 策略 ${strategy.name} 执行失败: ${getErrorMessage(strategyError)}`)
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

export const wrapWithErrorHandler = <TResult>(fn: BusinessHandler<TResult>, options: ErrorHandlerOptions) => {
  return async (
    event: MessageEvent | undefined,
    next: NextFunction = () => undefined
  ): Promise<Awaited<TResult> | true> => {
    const emojiManager = options.emojiReaction !== false && event
      ? new EmojiReactionManager(event)
      : null
    let processingTimer: ReturnType<typeof setTimeout> | null = null
    let successTimer: ReturnType<typeof setTimeout> | null = null

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
      return result as Awaited<TResult>
    } catch (error: unknown) {
      if (processingTimer) clearTimeout(processingTimer)
      if (successTimer) clearTimeout(successTimer)
      if (emojiManager) {
        if (emojiManager.has('PROCESSING')) await emojiManager.remove('PROCESSING')
        await emojiManager.add('ERROR')
      }
      logger.error(`[${options.businessName}] 执行失败`, error)
      const result = await handleBusinessError(error, options, [], event)
      if (result !== 'handled') {
        await event?.reply?.(`处理失败：${getErrorMessage(error)}`)
      }
      if (options.rethrowAfterHandle) throw error
      return true
    }
  }
}

function getErrorMessage (error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error && error.message) {
    return String(error.message)
  }
  return String(error)
}
