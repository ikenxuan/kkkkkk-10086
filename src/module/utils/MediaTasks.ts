import { runWithRequestGuard } from './RequestGuard.js'

/**
 * 解析一个作品时可以各自独立跑的分支。
 *
 * 三条都是「自己取数、自己渲染、自己发送」，彼此不等：谁先好谁先发，
 * 一条失败也不影响另外两条（见下面 allSettled + 逐任务 onTaskFailure）。
 */
export type MediaTaskName = 'poster' | 'video' | 'comment'

type MediaTask = () => Promise<void>

export interface MediaTaskFailure {
  task: MediaTaskName
  error: unknown
}

export interface MediaTaskResult {
  succeeded: MediaTaskName[]
  failures: MediaTaskFailure[]
}

export interface MediaTaskOptions {
  /** Hard deadline for each independently running media branch. */
  timeoutMs?: number
  onTaskFailure?: (failure: MediaTaskFailure) => void
}

export interface MediaTasks {
  poster?: MediaTask
  video?: MediaTask
  comment?: MediaTask
}

export const runMediaTasks = async (
  tasks: MediaTasks,
  options: MediaTaskOptions = {}
): Promise<MediaTaskResult> => {
  const entries: Array<[MediaTaskName, MediaTask]> = []
  if (tasks.poster) entries.push(['poster', tasks.poster])
  if (tasks.video) entries.push(['video', tasks.video])
  if (tasks.comment) entries.push(['comment', tasks.comment])

  const settled = await Promise.allSettled(
    entries.map(([, task]) => runWithRequestGuard(
      () => Promise.resolve().then(task),
      { timeoutMs: options.timeoutMs, maxRetries: 0 }
    ))
  )
  const result: MediaTaskResult = {
    succeeded: [],
    failures: []
  }

  settled.forEach((taskResult, index) => {
    const entry = entries[index]
    if (!entry) throw new Error('Media task result has no matching task')
    const task = entry[0]
    if (taskResult.status === 'fulfilled') {
      result.succeeded.push(task)
      return
    }

    const failure = { task, error: taskResult.reason }
    result.failures.push(failure)
    options.onTaskFailure?.(failure)
  })

  if (entries.length > 0 && result.failures.length === entries.length) {
    throw new AggregateError(
      result.failures.map(failure => failure.error),
      'All enabled media tasks failed'
    )
  }

  return result
}
