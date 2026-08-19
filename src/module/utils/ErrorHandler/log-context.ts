import { AsyncLocalStorage } from 'node:async_hooks'
import { format } from 'node:util'

export type CapturedLogLevel = 'TRAC' | 'DEBU' | 'MARK' | 'INFO' | 'ERRO' | 'WARN' | 'FATA'

export interface CapturedLogEntry {
  timestamp: string
  level: CapturedLogLevel
  message: string
  raw: string
}

interface LogContextState {
  active: boolean
  entries: CapturedLogEntry[]
  maxEntries: number
  maxBytes: number
  bytes: number
  /** 因预算不足被淘汰的条数，快照时据此补一条说明 */
  dropped: number
}

interface HostLogger {
  [key: string]: unknown
}

interface ContextLogger {
  run<T>(fn: () => T | PromiseLike<T>): T | PromiseLike<T>
  logs(): CapturedLogEntry[]
  destroy(): void
}

const storage = new AsyncLocalStorage<LogContextState>()
const hookedLoggers = new WeakSet<object>()
const hookMarker = Symbol.for('kkkkkk-10086.log-context-hook')
const loggerMethods: Array<{ name: string; level: CapturedLogLevel }> = [
  { name: 'trace', level: 'TRAC' },
  { name: 'debug', level: 'DEBU' },
  { name: 'mark', level: 'MARK' },
  { name: 'info', level: 'INFO' },
  { name: 'warn', level: 'WARN' },
  { name: 'error', level: 'ERRO' },
  { name: 'fatal', level: 'FATA' }
]

const getHostLogger = (): HostLogger | undefined => {
  const globalWithLogger = globalThis as typeof globalThis & { logger?: HostLogger }
  return globalWithLogger.logger
}

const formatTimestamp = (date = new Date()): string => {
  const pad = (value: number, width = 2): string => String(value).padStart(width, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}

const formatArguments = (args: unknown[]): string => {
  try {
    return format(...args)
  } catch {
    return args.map(value => {
      try {
        return String(value)
      } catch {
        return '[Unprintable value]'
      }
    }).join(' ')
  }
}

/**
 * 单条日志的字节上限。
 *
 * 环形淘汰是「丢最旧的」，所以一条超大日志（`logger.error(整个响应体)` 之类）会把
 * 其他全部挤出去。先把单条截断，保证预算里始终能装下多条。
 * 8KB 足够放完整的调用栈。
 */
const MAX_ENTRY_BYTES = 8 * 1024

const truncateMessage = (text: string): string => {
  const buffer = Buffer.from(text, 'utf8')
  if (buffer.byteLength <= MAX_ENTRY_BYTES) return text
  // 按字节裁剪；末尾若切断了多字节字符，toString 会替换成 U+FFFD，无副作用。
  const kept = buffer.subarray(0, MAX_ENTRY_BYTES).toString('utf8')
  return `${kept}……（已截断 ${buffer.byteLength - MAX_ENTRY_BYTES} 字节）`
}

const appendLog = (level: CapturedLogLevel, args: unknown[]): void => {
  const context = storage.getStore()
  if (!context?.active) return

  try {
    const message = truncateMessage(formatArguments(args))
    const raw = `[${formatTimestamp()}][${level}] ${message}`
    context.entries.push({ timestamp: raw.slice(1, 13), level, message, raw })
    context.bytes += Buffer.byteLength(raw, 'utf8')

    // 环形淘汰：预算用满时丢最旧的，而不是丢最新的。
    // 旧实现是到量就 return，于是下载进度条这类每 200ms 刷一次的高频日志会先把
    // 200 条 / 64KB 预算吃光，真正的失败日志一条都进不来——错误卡片的日志区
    // 全是进度条，而离故障最近的那几行恰好是最该保留的。
    // 单条超预算时留它自己（length > 1 的条件），有一条总比一条都没有好。
    while (
      context.entries.length > context.maxEntries ||
      (context.bytes > context.maxBytes && context.entries.length > 1)
    ) {
      const dropped = context.entries.shift()
      if (!dropped) break
      context.bytes -= Buffer.byteLength(dropped.raw, 'utf8')
      context.dropped += 1
    }
  } catch {
    // Logging capture must never replace or mask the business error.
  }
}

/**
 * 取快照。有条目被淘汰过就在最前面补一条说明。
 *
 * 不补的话日志区看起来是完整的，排查的人不会知道前面还有东西被丢掉了。
 * 消费方（`Base.ts` / `render.ts`）都会 `reverse()` 成「新的在上」，
 * 这条代表最旧内容的说明因此会落到末尾，位置正确。
 */
const snapshot = (state: LogContextState): CapturedLogEntry[] => {
  const entries = state.entries.slice()
  if (state.dropped > 0) {
    const message = `……更早的 ${state.dropped} 条日志超出采集预算已丢弃`
    entries.unshift({ timestamp: '', level: 'WARN', message, raw: message })
  }
  return entries
}

const installHostLoggerHook = (): void => {
  const hostLogger = getHostLogger()
  if (!hostLogger || hookedLoggers.has(hostLogger)) return

  for (const { name, level } of loggerMethods) {
    const original = hostLogger[name]
    if (typeof original !== 'function') continue
    if ((original as { [hookMarker]?: boolean })[hookMarker]) continue

    const wrapped = function (this: unknown, ...args: unknown[]): unknown {
      let result: unknown
      try {
        result = Reflect.apply(original as (...values: unknown[]) => unknown, this, args)
      } finally {
        appendLog(level, args)
      }
      return result
    }
    Object.defineProperty(wrapped, hookMarker, { value: true })

    try {
      hostLogger[name] = wrapped
    } catch {
      // Some host versions expose a non-writable logger method.
    }
  }

  hookedLoggers.add(hostLogger)
}

export const createLogContext = (options: { maxEntries?: number; maxBytes?: number } = {}): ContextLogger => {
  installHostLoggerHook()
  const state: LogContextState = {
    active: true,
    entries: [],
    maxEntries: Math.max(1, options.maxEntries ?? 200),
    maxBytes: Math.max(1024, options.maxBytes ?? 64 * 1024),
    bytes: 0,
    dropped: 0
  }

  return {
    run: <T>(fn: () => T | PromiseLike<T>): T | PromiseLike<T> => storage.run(state, fn),
    logs: (): CapturedLogEntry[] => snapshot(state),
    destroy: (): void => {
      state.active = false
    }
  }
}

/**
 * Read the log entries captured by the innermost enclosing {@link createLogContext}.
 *
 * `wrapWithErrorHandler` only reads its own context inside `catch`, so error paths
 * that render a report *without* rethrowing (such as the amagi proxy in `Base.ts`)
 * had no way to reach the ambient capture and shipped an empty log section.
 * Returns an empty array when called outside an active context.
 */
export const getActiveLogEntries = (): CapturedLogEntry[] => {
  const context = storage.getStore()
  if (!context?.active) return []
  return snapshot(context)
}

export const parseLogsToStructured = (logs: Array<CapturedLogEntry | string>): CapturedLogEntry[] => {
  const logRegex = /^\[(\d{2}:\d{2}:\d{2}\.\d{3})\]\[([A-Z]{4})\]\s([\s\S]*)$/
  return logs.map(log => {
    if (typeof log !== 'string') return log
    const match = log.match(logRegex)
    if (!match) {
      return { timestamp: '', level: 'INFO' as const, message: log, raw: log }
    }
    return {
      timestamp: match[1] ?? '',
      level: match[2] as CapturedLogLevel,
      message: match[3] ?? '',
      raw: log
    }
  }).filter(log => log.level !== 'TRAC')
}
