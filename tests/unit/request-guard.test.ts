import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  RequestTimeoutError,
  runWithRequestGuard
} from '../../src/module/utils/RequestGuard.js'

const neverSettles = async (): Promise<never> => await new Promise<never>(() => {})

const networkError = (code = 'ECONNRESET'): Error & { code: string } =>
  Object.assign(new Error(`network failure: ${code}`), { code })

describe('runWithRequestGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('uses a 60-second hard timeout, aborts the task, and releases the caller', async () => {
    let taskSignal: AbortSignal | undefined
    const task = vi.fn((signal: AbortSignal) => {
      taskSignal = signal
      return neverSettles()
    })
    const request = runWithRequestGuard(task, { maxRetries: 0 })
    let settled = false
    const observedRequest = request.then(
      value => {
        settled = true
        return value
      },
      (error: unknown) => {
        settled = true
        throw error
      }
    )
    const failure = observedRequest.catch((error: unknown) => error)

    expect(DEFAULT_REQUEST_TIMEOUT_MS).toBe(60_000)
    expect(task).toHaveBeenCalledTimes(1)
    expect(taskSignal).toBeDefined()

    await vi.advanceTimersByTimeAsync(59_999)
    expect(settled).toBe(false)
    expect(taskSignal?.aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    const error = await failure

    expect(error).toBeInstanceOf(RequestTimeoutError)
    expect(error).toMatchObject({
      name: 'RequestTimeoutError',
      code: 'ERR_REQUEST_TIMEOUT',
      timeoutMs: 60_000
    })
    expect(taskSignal?.aborted).toBe(true)
    expect(taskSignal?.reason).toBe(error)
  })

  it('retries a timed-out task at most twice by default with injectable backoff and sleep', async () => {
    const signals: AbortSignal[] = []
    const task = vi.fn((signal: AbortSignal) => {
      signals.push(signal)
      return neverSettles()
    })
    const backoff = vi.fn((_retryNumber: number, _error: unknown) => 25)
    const sleep = vi.fn(async (_delayMs: number, _signal: AbortSignal) => {})
    const request = runWithRequestGuard(task, {
      timeoutMs: 10,
      backoff,
      sleep
    })
    const failure = request.catch((error: unknown) => error)

    await vi.advanceTimersByTimeAsync(10)
    expect(task).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(10)
    expect(task).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(10)

    expect(await failure).toBeInstanceOf(RequestTimeoutError)
    expect(task).toHaveBeenCalledTimes(3)
    expect(backoff).toHaveBeenCalledTimes(2)
    expect(backoff).toHaveBeenNthCalledWith(1, 1, expect.any(RequestTimeoutError))
    expect(backoff).toHaveBeenNthCalledWith(2, 2, expect.any(RequestTimeoutError))
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenNthCalledWith(1, 25, expect.any(AbortSignal))
    expect(sleep).toHaveBeenNthCalledWith(2, 25, expect.any(AbortSignal))
    expect(signals).toHaveLength(3)
    expect(signals.every(signal => signal.aborted)).toBe(true)
  })

  it('retries explicit network failures and returns a later successful result', async () => {
    const task = vi.fn<(signal: AbortSignal) => Promise<string>>()
      .mockRejectedValueOnce(networkError('ECONNRESET'))
      .mockRejectedValueOnce(networkError('ETIMEDOUT'))
      .mockResolvedValue('ok')
    const backoff = vi.fn((retryNumber: number) => retryNumber * 100)
    const sleep = vi.fn(async (_delayMs: number, _signal: AbortSignal) => {})

    await expect(runWithRequestGuard(task, { backoff, sleep })).resolves.toBe('ok')

    expect(task).toHaveBeenCalledTimes(3)
    expect(backoff).toHaveBeenCalledTimes(2)
    expect(sleep.mock.calls.map(([delayMs]) => delayMs)).toEqual([100, 200])
  })

  it('does not retry business 4xx responses even when they carry a network-like code', async () => {
    const error = Object.assign(new Error('bad request'), {
      code: 'ECONNRESET',
      response: { status: 400 }
    })
    const task = vi.fn(async (_signal: AbortSignal) => await Promise.reject(error))
    const sleep = vi.fn(async (_delayMs: number, _signal: AbortSignal) => {})

    await expect(runWithRequestGuard(task, { sleep })).rejects.toBe(error)

    expect(task).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it.each([408, 429, 500, 503])('retries transient HTTP status %i', async status => {
    const transientError = Object.assign(new Error(`HTTP ${status}`), {
      response: { status }
    })
    const task = vi.fn<(signal: AbortSignal) => Promise<string>>()
      .mockRejectedValueOnce(transientError)
      .mockResolvedValue('recovered')
    const sleep = vi.fn(async (_delayMs: number, _signal: AbortSignal) => {})

    await expect(runWithRequestGuard(task, { maxRetries: 1, sleep })).resolves.toBe('recovered')

    expect(task).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it('does not retry ordinary business errors', async () => {
    const error = new Error('invalid media payload')
    const task = vi.fn(async (_signal: AbortSignal) => await Promise.reject(error))
    const sleep = vi.fn(async (_delayMs: number, _signal: AbortSignal) => {})

    await expect(runWithRequestGuard(task, { sleep })).rejects.toBe(error)

    expect(task).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('stops immediately without invoking the task when the external signal is already aborted', async () => {
    const controller = new AbortController()
    const reason = new Error('caller already left')
    controller.abort(reason)
    const task = vi.fn(async (_signal: AbortSignal) => 'unexpected')

    await expect(runWithRequestGuard(task, { signal: controller.signal })).rejects.toBe(reason)

    expect(task).not.toHaveBeenCalled()
  })

  it('aborts an active task immediately on external cancellation and never retries it', async () => {
    const controller = new AbortController()
    const reason = new Error('caller cancelled')
    let taskSignal: AbortSignal | undefined
    const task = vi.fn((signal: AbortSignal) => {
      taskSignal = signal
      return neverSettles()
    })
    const sleep = vi.fn(async (_delayMs: number, _signal: AbortSignal) => {})
    const request = runWithRequestGuard(task, {
      signal: controller.signal,
      sleep
    })
    const failure = request.catch((error: unknown) => error)

    controller.abort(reason)

    expect(await failure).toBe(reason)
    expect(taskSignal?.aborted).toBe(true)
    expect(taskSignal?.reason).toBe(reason)
    expect(task).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('cancels an injected sleep immediately and does not start the next retry', async () => {
    const controller = new AbortController()
    const reason = new Error('cancel during backoff')
    const task = vi.fn(async (_signal: AbortSignal) => await Promise.reject(networkError()))
    let sleepSignal: AbortSignal | undefined
    let markSleepStarted: (() => void) | undefined
    const sleepStarted = new Promise<void>(resolve => {
      markSleepStarted = resolve
    })
    const sleep = vi.fn(async (_delayMs: number, signal: AbortSignal) => {
      sleepSignal = signal
      markSleepStarted?.()
      await neverSettles()
    })
    const request = runWithRequestGuard(task, {
      signal: controller.signal,
      backoff: () => 1_000,
      sleep
    })
    const failure = request.catch((error: unknown) => error)

    await sleepStarted
    controller.abort(reason)

    expect(await failure).toBe(reason)
    expect(sleepSignal?.aborted).toBe(true)
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('keeps concurrent guards isolated when one request fails', async () => {
    const firstError = new Error('first request failed')
    const firstTask = vi.fn(async (_signal: AbortSignal) => await Promise.reject(firstError))
    let secondSignal: AbortSignal | undefined
    let resolveSecond: ((value: string) => void) | undefined
    const secondTask = vi.fn((signal: AbortSignal) => {
      secondSignal = signal
      return new Promise<string>(resolve => {
        resolveSecond = resolve
      })
    })

    const first = runWithRequestGuard(firstTask)
    const firstFailure = first.catch((error: unknown) => error)
    const second = runWithRequestGuard(secondTask)

    expect(await firstFailure).toBe(firstError)
    expect(secondSignal?.aborted).toBe(false)
    expect(secondTask).toHaveBeenCalledTimes(1)

    resolveSecond?.('second request completed')
    await expect(second).resolves.toBe('second request completed')
    expect(secondSignal?.aborted).toBe(false)
  })
})
