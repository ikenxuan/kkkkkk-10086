import type { MessageEvent } from '@/types/message'
import { EmojiReactionManager } from '@/module/utils/EmojiReaction'
import { getErrorMessage } from '@/module/utils/error-message'
import { getAdapterInfo } from './adapter.js'
import { createLogContext, parseLogsToStructured, type CapturedLogEntry } from './log-context.js'
import { renderErrorReport } from './render.js'
import { hasErrorReportTarget, sendErrorToAllMasters, sendErrorToMaster, sendErrorToTrigger } from './sender.js'
import { getStrategies, type ErrorHandlerContext, type ErrorHandlerOptions } from './strategy.js'
import { getBuildMetadata } from '@/module/tooling/build-metadata'

type NextFunction = () => unknown
type BusinessHandler<TResult> = (event: MessageEvent | undefined, next: NextFunction) => TResult | PromiseLike<TResult>

export const handleBusinessError = async (
  error: unknown,
  options: ErrorHandlerOptions,
  logs: CapturedLogEntry[] = [],
  event?: MessageEvent
): Promise<'handled' | undefined> => {
  const ctx: ErrorHandlerContext = {
    error,
    options,
    logs,
    event,
    buildMetadata: getBuildMetadata(),
    adapterInfo: getAdapterInfo(event)
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

  // 没有任何收件人时不要起 puppeteer。errorLogSendTo 默认只有 master，而按 Bot 取不到主人时
  // （比如 QQBot 没在宿主 other.yaml 的 master 里登记）这张卡片没人收得到，
  // 渲完还会被适配器走 markdown 顺手上传一次图床 —— 白烧两笔开销。
  //
  // `triggerGotCard` 只看**触发者**收到没有，不看主人：调用方拿它决定还要不要补
  // 那条 `处理失败：...` 文字。默认 errorLogSendTo 只有 master，这时候触发者
  // 什么也没收到，那条文字是他唯一的反馈，不能因为「主人收到卡片了」就把它吞掉。
  let triggerGotCard = false
  if (hasErrorReportTarget(ctx)) {
    const report = await renderErrorReport(ctx)
    const message = Array.isArray(report) ? report : [report]
    triggerGotCard = await sendErrorToTrigger(ctx, message)
    await sendErrorToMaster(ctx, message)
    await sendErrorToAllMasters(ctx, message)
  } else {
    logger.debug('[ErrorHandler] 没有可投递的收件人，跳过错误卡片渲染')
  }

  if (options.customErrorHandler) {
    await options.customErrorHandler(error, logs)
  }

  // 触发者已经看到卡片了就算处理完 —— 否则同一个错误会在同一个会话里出现两次：
  // 一张图 + 一条文字。customErrorHandler 仍然照跑，不受这个返回值影响。
  return triggerGotCard ? 'handled' : undefined
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

    const logContext = createLogContext()

    try {
      const result = await logContext.run(() => fn(event, next))
      if (emojiManager) {
        // 成功路径原来不清 processingTimer（只有 catch 里清），于是 100ms 就跑完的解析
        // 仍会在 1.5s 后补一个「处理中」，再等 replace 内部那 2s 延迟才撤掉 ——
        // 用户看到的是「已经发完了，表情又转起来」。
        if (processingTimer) clearTimeout(processingTimer)

        if (emojiManager.has('PROCESSING')) {
          // 「处理中」已经挂上去了才需要 replace：先加 SUCCESS，延迟一会儿再撤 PROCESSING
          successTimer = setTimeout(() => {
            emojiManager.replace('PROCESSING', 'SUCCESS').catch(() => {})
          }, 1500)
        } else {
          // 压根没挂过「处理中」，直接盖 SUCCESS，不用绕 replace 那套延迟
          await emojiManager.add('SUCCESS')
        }
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
      const logs = parseLogsToStructured(logContext.logs())
      const result = await handleBusinessError(error, options, logs, event)
      if (result !== 'handled') {
        await event?.reply?.(`处理失败：${getErrorMessage(error)}`)
      }
      if (options.rethrowAfterHandle) throw error
      return true
    } finally {
      logContext.destroy()
    }
  }
}
