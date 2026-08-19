import type { MessageEvent } from '@/types/message'
import type { Platform } from '@/types/platform'
import type { ErrorAdapterInfo } from './adapter.js'
import type { CapturedLogEntry } from './log-context.js'
import type { BuildMetadata } from '@/module/tooling/build-metadata'

export interface ErrorHandlerPlugin {
  awaitContext?: (...args: unknown[]) => unknown
}

export interface ErrorHandlerOptions {
  businessName: string
  platform?: Platform
  plugin?: ErrorHandlerPlugin
  customErrorHandler?: (error: unknown, logs: CapturedLogEntry[]) => unknown
  emojiReaction?: boolean
  rethrowAfterHandle?: boolean
  [key: string]: unknown
}

export interface ErrorHandlerContext {
  error: unknown
  options: ErrorHandlerOptions
  logs: CapturedLogEntry[]
  event?: MessageEvent
  buildMetadata?: BuildMetadata | null
  adapterInfo?: ErrorAdapterInfo
}

export type ErrorStrategyResult = 'handled' | 'continue' | undefined

export interface ErrorStrategy {
  name: string
  match: (ctx: ErrorHandlerContext) => boolean
  handle: (ctx: ErrorHandlerContext) => ErrorStrategyResult | PromiseLike<ErrorStrategyResult>
}

const strategies: ErrorStrategy[] = []

export const registerErrorStrategy = (strategy: ErrorStrategy): void => {
  if (!strategy?.name || typeof strategy.match !== 'function' || typeof strategy.handle !== 'function') {
    throw new TypeError('错误处理策略必须包含 name、match 和 handle')
  }

  const index = strategies.findIndex(item => item.name === strategy.name)
  if (index >= 0) strategies.splice(index, 1, strategy)
  else strategies.push(strategy)
}

export const getStrategies = (): ErrorStrategy[] => [...strategies]
