import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  runWithRequestGuard
} from './RequestGuard.js'

export type ParseSchedulerState =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'deduplicated'

export interface ParseSchedulerSnapshot {
  concurrency: number
  running: number
  queued: number
  pending: number
  runningFingerprints: readonly string[]
  queuedFingerprints: readonly string[]
}

interface ParseSchedulerStateEventBase {
  fingerprint: string
  snapshot: ParseSchedulerSnapshot
}

export type ParseSchedulerStateEvent =
  | ParseSchedulerStateEventBase & {
    state: 'queued' | 'running' | 'deduplicated'
  }
  | ParseSchedulerStateEventBase & {
    state: 'succeeded'
    result: unknown
  }
  | ParseSchedulerStateEventBase & {
    state: 'failed'
    error: unknown
  }

export interface ParseSchedulerOptions {
  concurrency?: number
  /** Hard deadline for each running parse task. */
  timeoutMs?: number
  onState?: (event: ParseSchedulerStateEvent) => void
}

/**
 * 一次解析。收到的 `signal` 就是外层守卫的取消信号：超时或调用方取消时它会 abort。
 *
 * 为什么参数是可选着用的：TypeScript 里零参函数可以赋值给收参数的函数类型，
 * 所以现有那一批 `() => ...` 调用点（`apps/tools.ts` 的各平台分派）一个都不用改。
 * 这是**放宽**契约，不是收紧。
 *
 * 管道目前只铺到这里：signal 从 `runWithRequestGuard` 一路传到任务闭包，
 * 但各平台解析内部还没有人真的去 `signal.aborted` / 把它交给 axios ——
 * 那是独立的一步。在那之前超时仍然只是让外层 Promise reject，
 * 真实的取消要等消费方接上才生效。
 */
export type ParseTask<T> = (signal: AbortSignal) => T | PromiseLike<T>

type PendingState = 'queued' | 'running'

interface PendingTask {
  fingerprint: string
  task: ParseTask<unknown>
  promise: Promise<unknown>
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
  state: PendingState
}

type StateEventPayload =
  | {
    fingerprint: string
    state: 'queued' | 'running' | 'deduplicated'
  }
  | {
    fingerprint: string
    state: 'succeeded'
    result: unknown
  }
  | {
    fingerprint: string
    state: 'failed'
    error: unknown
  }

const DEFAULT_CONCURRENCY = 2

export class ParseScheduler {
  private readonly concurrency: number
  private readonly timeoutMs: number
  private readonly onState?: ParseSchedulerOptions['onState']
  private readonly queue: PendingTask[] = []
  private readonly pending = new Map<string, PendingTask>()
  private readonly runningFingerprints = new Set<string>()
  private running = 0

  constructor (options: ParseSchedulerOptions = {}) {
    const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new RangeError('concurrency must be a positive integer')
    }
    const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new RangeError('timeoutMs must be a finite number greater than zero')
    }

    this.concurrency = concurrency
    this.timeoutMs = timeoutMs
    this.onState = options.onState
  }

  submit<T> (fingerprint: string, task: ParseTask<T>): Promise<T> {
    const duplicate = this.pending.get(fingerprint)
    if (duplicate !== undefined) {
      this.emit({ fingerprint, state: 'deduplicated' })
      return duplicate.promise as Promise<T>
    }

    let resolveTask!: (value: unknown) => void
    let rejectTask!: (reason?: unknown) => void
    const promise = new Promise<unknown>((resolve, reject) => {
      resolveTask = resolve
      rejectTask = reject
    })
    const pendingTask: PendingTask = {
      fingerprint,
      task,
      promise,
      resolve: resolveTask,
      reject: rejectTask,
      state: 'queued'
    }

    this.pending.set(fingerprint, pendingTask)
    this.queue.push(pendingTask)
    this.emit({ fingerprint, state: 'queued' })
    this.drain()

    return promise as Promise<T>
  }

  getSnapshot (): ParseSchedulerSnapshot {
    return {
      concurrency: this.concurrency,
      running: this.running,
      queued: this.queue.length,
      pending: this.pending.size,
      runningFingerprints: [...this.runningFingerprints],
      queuedFingerprints: this.queue.map(task => task.fingerprint)
    }
  }

  private drain (): void {
    while (this.running < this.concurrency) {
      const task = this.queue.shift()
      if (task === undefined) return
      this.start(task)
    }
  }

  private start (task: PendingTask): void {
    task.state = 'running'
    this.running += 1
    this.runningFingerprints.add(task.fingerprint)
    this.emit({ fingerprint: task.fingerprint, state: 'running' })

    Promise.resolve()
      .then(() => runWithRequestGuard(
        signal => task.task(signal),
        { timeoutMs: this.timeoutMs, maxRetries: 0 }
      ))
      .then(
        result => this.succeed(task, result),
        error => this.fail(task, error)
      )
  }

  private succeed (task: PendingTask, result: unknown): void {
    this.release(task)
    this.emit({
      fingerprint: task.fingerprint,
      state: 'succeeded',
      result
    })
    task.resolve(result)
    this.drain()
  }

  private fail (task: PendingTask, error: unknown): void {
    this.release(task)
    this.emit({
      fingerprint: task.fingerprint,
      state: 'failed',
      error
    })
    task.reject(error)
    this.drain()
  }

  private release (task: PendingTask): void {
    this.running -= 1
    this.runningFingerprints.delete(task.fingerprint)
    if (this.pending.get(task.fingerprint) === task) {
      this.pending.delete(task.fingerprint)
    }
  }

  private emit (payload: StateEventPayload): void {
    if (this.onState === undefined) return

    try {
      this.onState({
        ...payload,
        snapshot: this.getSnapshot()
      } as ParseSchedulerStateEvent)
    } catch {
      // 诊断回调不能影响解析队列本身。
    }
  }
}
