import type { Platform } from '@/types/platform'
import type { MessageEvent } from '@/types/message'
import type { BuildMetadata } from '@/module/tooling/build-metadata'

export interface ErrorAdapterInfo {
  name: string
  version: string
  protocol: string
  platform: string
  standard: string
  communication: string
  [key: string]: unknown
}

export type CapturedLogLevel = 'TRAC' | 'DEBU' | 'MARK' | 'INFO' | 'ERRO' | 'WARN' | 'FATA'

export interface CapturedLogEntry {
  timestamp: string
  level: CapturedLogLevel
  message: string
  raw: string
}

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
