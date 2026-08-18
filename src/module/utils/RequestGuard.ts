/** A guarded request is allowed one initial attempt and this many retries by default. */
export const DEFAULT_REQUEST_MAX_RETRIES = 2

/** Every individual attempt is forcefully released after one minute by default. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000

const DEFAULT_BACKOFF_BASE_MS = 250
const DEFAULT_BACKOFF_MAX_MS = 5_000

const RETRYABLE_NETWORK_CODES = new Set([
  'EAI_AGAIN',
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTDOWN',
  'EHOSTUNREACH',
  'ENETDOWN',
  'ENETRESET',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'ESOCKETTIMEDOUT',
  'ETIMEDOUT',
  'ERR_NETWORK',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_CONNECT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET'
])

export type GuardedRequestTask<T> = (signal: AbortSignal) => T | PromiseLike<T>

/** `retryNumber` is one-based: the first retry receives `1`. */
export type RequestBackoff = (retryNumber: number, error: unknown) => number

/**
 * An injectable sleep function. Implementations should observe `signal`; the guard
 * also races the sleep against cancellation so a non-cooperative implementation
 * cannot hold the caller open.
 */
export type RequestSleep = (delayMs: number, signal: AbortSignal) => void | PromiseLike<void>

export interface RequestGuardOptions {
  /** Hard timeout for each attempt, in milliseconds. */
  timeoutMs?: number
  /** Number of retries after the initial attempt. */
  maxRetries?: number
  /** Optional caller-owned cancellation signal. */
  signal?: AbortSignal
  /** Computes the delay before a retry. */
  backoff?: RequestBackoff
  /** Performs the delay, primarily injectable for tests and schedulers. */
  sleep?: RequestSleep
}

/** A stable, identifiable error emitted when one guarded attempt exceeds its deadline. */
export class RequestTimeoutError extends Error {
  readonly code = 'ERR_REQUEST_TIMEOUT'
  readonly timeoutMs: number

  constructor (timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`)
    this.name = 'RequestTimeoutError'
    this.timeoutMs = timeoutMs
  }
}

/**
 * Returns true only for failures that clearly represent a transport/network timeout.
 * In particular, an HTTP 4xx response always wins over a network-like error code so
 * malformed/auth/business requests cannot be amplified by retries.
 */
export const isRetryableRequestError = (error: unknown): boolean => {
  if (error instanceof RequestTimeoutError) return true

  const status = getHttpStatus(error)
  if (status === 408 || status === 429 || (status !== undefined && status >= 500 && status < 600)) return true
  if (status !== undefined && status >= 400 && status < 500) return false

  if (!isRecord(error)) return false

  const code = typeof error.code === 'string' ? error.code.toUpperCase() : ''
  if (RETRYABLE_NETWORK_CODES.has(code)) return true

  const name = typeof error.name === 'string' ? error.name : ''
  if (name === 'TimeoutError' || name === 'NetworkError') return true

  const cause = error.cause
  return cause !== undefined && cause !== error && isRetryableRequestError(cause)
}

/**
 * Runs an abort-aware request task with a per-attempt hard deadline and conservative
 * retry policy. All controller/timer state is local to this invocation, so one failed
 * guard cannot cancel or otherwise interfere with a parallel guard.
 */
export async function runWithRequestGuard<T> (
  task: GuardedRequestTask<T>,
  options: RequestGuardOptions = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  const maxRetries = options.maxRetries ?? DEFAULT_REQUEST_MAX_RETRIES
  validateOptions(timeoutMs, maxRetries)

  const backoff = options.backoff ?? defaultBackoff
  const sleep = options.sleep ?? defaultSleep
  throwIfExternallyAborted(options.signal)

  for (let attempt = 0; ; attempt++) {
    try {
      return await runAttempt(task, timeoutMs, options.signal)
    } catch (error: unknown) {
      // The caller's cancellation always has priority over timeout/network errors.
      throwIfExternallyAborted(options.signal)

      if (attempt >= maxRetries || !isRetryableRequestError(error)) throw error

      const retryNumber = attempt + 1
      const delayMs = backoff(retryNumber, error)
      if (!Number.isFinite(delayMs) || delayMs < 0) {
        throw new RangeError('RequestGuard backoff must return a finite, non-negative delay')
      }
      await sleepWithCancellation(delayMs, sleep, options.signal)
    }
  }
}

const runAttempt = async <T> (
  task: GuardedRequestTask<T>,
  timeoutMs: number,
  externalSignal: AbortSignal | undefined
): Promise<T> => {
  throwIfExternallyAborted(externalSignal)

  const controller = new AbortController()
  let terminalCause: 'timeout' | 'external' | undefined
  let timeoutError: RequestTimeoutError | undefined
  let externalReason: unknown
  let removeExternalListener = (): void => {}

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (terminalCause !== undefined) return
      terminalCause = 'timeout'
      timeoutError = new RequestTimeoutError(timeoutMs)
      controller.abort(timeoutError)
      reject(timeoutError)
    }, timeoutMs)

    removeExternalListener = (): void => {
      clearTimeout(timeoutId)
    }
  })

  let externalAbortPromise: Promise<never> | undefined
  if (externalSignal) {
    externalAbortPromise = new Promise<never>((_resolve, reject) => {
      const onAbort = (): void => {
        if (terminalCause !== undefined) return
        terminalCause = 'external'
        externalReason = getAbortReason(externalSignal)
        controller.abort(externalReason)
        reject(externalReason)
      }

      const clearTimeoutOnly = removeExternalListener
      removeExternalListener = (): void => {
        clearTimeoutOnly()
        externalSignal.removeEventListener('abort', onAbort)
      }

      if (externalSignal.aborted) onAbort()
      else externalSignal.addEventListener('abort', onAbort, { once: true })
    })
  }

  let taskPromise: Promise<T>
  try {
    taskPromise = Promise.resolve(task(controller.signal))
  } catch (error: unknown) {
    taskPromise = Promise.reject(error)
  }

  const normalizedTaskPromise = taskPromise.catch((error: unknown) => {
    if (terminalCause === 'timeout') throw timeoutError
    if (terminalCause === 'external') throw externalReason
    throw error
  })

  try {
    return await Promise.race([
      normalizedTaskPromise,
      timeoutPromise,
      ...(externalAbortPromise ? [externalAbortPromise] : [])
    ])
  } finally {
    removeExternalListener()
  }
}

const sleepWithCancellation = async (
  delayMs: number,
  sleep: RequestSleep,
  externalSignal: AbortSignal | undefined
): Promise<void> => {
  throwIfExternallyAborted(externalSignal)

  const controller = new AbortController()
  let externallyAborted = false
  let externalReason: unknown
  let removeExternalListener = (): void => {}
  let externalAbortPromise: Promise<never> | undefined

  if (externalSignal) {
    externalAbortPromise = new Promise<never>((_resolve, reject) => {
      const onAbort = (): void => {
        if (externallyAborted) return
        externallyAborted = true
        externalReason = getAbortReason(externalSignal)
        controller.abort(externalReason)
        reject(externalReason)
      }

      removeExternalListener = (): void => {
        externalSignal.removeEventListener('abort', onAbort)
      }

      if (externalSignal.aborted) onAbort()
      else externalSignal.addEventListener('abort', onAbort, { once: true })
    })
  }

  let sleepPromise: Promise<void>
  try {
    sleepPromise = Promise.resolve(sleep(delayMs, controller.signal))
  } catch (error: unknown) {
    sleepPromise = Promise.reject(error)
  }

  const normalizedSleepPromise = sleepPromise.catch((error: unknown) => {
    if (externallyAborted) throw externalReason
    throw error
  })

  try {
    await Promise.race([
      normalizedSleepPromise,
      ...(externalAbortPromise ? [externalAbortPromise] : [])
    ])
  } finally {
    removeExternalListener()
  }
}

const defaultBackoff: RequestBackoff = (retryNumber) =>
  Math.min(DEFAULT_BACKOFF_MAX_MS, DEFAULT_BACKOFF_BASE_MS * 2 ** (retryNumber - 1))

const defaultSleep: RequestSleep = async (delayMs, signal) => {
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(getAbortReason(signal))
      return
    }

    const onAbort = (): void => {
      clearTimeout(timeoutId)
      reject(getAbortReason(signal))
    }
    const timeoutId = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, delayMs)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

const validateOptions = (timeoutMs: number, maxRetries: number): void => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('RequestGuard timeoutMs must be a finite number greater than zero')
  }
  if (!Number.isSafeInteger(maxRetries) || maxRetries < 0) {
    throw new RangeError('RequestGuard maxRetries must be a non-negative safe integer')
  }
}

const throwIfExternallyAborted = (signal: AbortSignal | undefined): void => {
  if (signal?.aborted) throw getAbortReason(signal)
}

const getAbortReason = (signal: AbortSignal): unknown => {
  if (signal.reason !== undefined) return signal.reason
  const error = new Error('The operation was aborted')
  error.name = 'AbortError'
  return error
}

const getHttpStatus = (error: unknown): number | undefined => {
  if (!isRecord(error)) return undefined
  if (typeof error.status === 'number') return error.status
  if (isRecord(error.response) && typeof error.response.status === 'number') {
    return error.response.status
  }
  return undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
