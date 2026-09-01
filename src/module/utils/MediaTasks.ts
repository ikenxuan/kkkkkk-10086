import { DEFAULT_REQUEST_TIMEOUT_MS, runWithRequestGuard } from './RequestGuard.js'

/**
 * 解析一个作品时可以各自独立跑的分支。
 *
 * 每条都是「自己取数、自己渲染、自己发送」，彼此不等：谁先好谁先发，
 * 一条失败也不影响其它几条（见下面 allSettled + 逐任务 onTaskFailure）。
 *
 * `image` 和 `video` 并列而不是合并成一个「正文媒体」：小红书图文笔记走的是
 * 图片循环，里面还包着实况图生成和它自己那批临时文件的清理，跟视频下载既不同数据源
 * 也不同清理责任；共用一个名字会让 onTaskFailure 的日志分不清是哪种失败。
 *
 * 这个 union 故意保持封闭：`onTaskFailure` 的分支和日志文案靠它做类型约束，
 * 换成开放的 string 键，任务名拼错就不再报错了。
 */
export type MediaTaskName = 'poster' | 'video' | 'image' | 'comment'

type MediaTask = () => Promise<void>

export interface MediaTaskFailure {
  task: MediaTaskName
  error: unknown
}

export interface MediaTaskResult {
  succeeded: MediaTaskName[]
  failures: MediaTaskFailure[]
}

/**
 * 一条支线的预算下限，等于 `runWithRequestGuard` 不传 `timeoutMs` 时的默认值。
 *
 * 下面那些「放宽」的计算一律 clamp 到它以上：放宽只准变松，不准因为算出个小数字
 * 而把某条支线卡得比今天更紧。
 */
export const MIN_MEDIA_TASK_TIMEOUT_MS = DEFAULT_REQUEST_TIMEOUT_MS

/**
 * 重支线的预算上限，也是视频下载支线直接采用的值。
 *
 * 为什么需要一个远大于 60s 的值：视频字节流那条路上本仓给 axios 的是 `timeout: 0`
 * （`Network/download-pipeline.ts`），也就是**下载本身没有壁钟上限**，只有 socket 级的兜底。
 * 而 `Config.upload.filelimit` 默认 1536(MB) 才是「允许多大」的闸门，60s 根本装不下
 * 一条正常体积的短视频在慢线路上的下载 + 上传。
 *
 * 为什么是 10 分钟而不是更大：这个上限的职责是拦「socket 还活着但一个字节都不再来」
 * 那种卡死 —— 正是 `timeout: 0` 完全拦不住的情形。快手、小红书都是短视频平台，
 * 几十 MB 量级的作品在 10 分钟里绰绰有余；真的跑到 10 分钟还没完，那更可能是卡死
 * 而不是慢，此时释放这条支线比继续挂着更有价值（另外几条支线早就发完了）。
 */
export const MAX_MEDIA_TASK_TIMEOUT_MS = 600_000

/**
 * 视频下载支线的预算。理由见 {@link MAX_MEDIA_TASK_TIMEOUT_MS}。
 *
 * 只给「本仓自己下载并发送整条视频」的支线用（快手 video、小红书 video）。
 * **不要**顺手加到 douyin / bilibili 的调用点上：那两家的视频支线现在正靠
 * 60s 默认值兜底拦卡死的上传，放宽等于把那道保护拆了。
 */
export const VIDEO_DOWNLOAD_TIMEOUT_MS = MAX_MEDIA_TASK_TIMEOUT_MS

/**
 * 每张图分摊到的预算，用来按图数算整批实况图的上限。
 *
 * 30s 这个数来自 `platform/common/livePhoto.ts` —— 那里每个素材下载的
 * `timeout: 30000` 就是这条支线里**单个原子等待的最大值**。之所以按「每张一份 30s」
 * 而不是「每张 30s 再乘个安全系数」：
 * - 下载是宽度 = `Config.upload.downloadConcurrency`（默认 8）的滑动窗口并发，
 *   摊到每张图约 30/8 ≈ 4s；
 * - ffmpeg 严格串行消费，但一张实况图的视频只有 1-3 秒，转码远快于下载。
 * 于是每张图约 26s 的余量全留给串行的 ffmpeg，够它在慢机器上从容跑完。
 */
const LIVE_PHOTO_BUDGET_PER_IMAGE_MS = 30_000

/**
 * 整批实况图支线的预算：`每张 30s × 图数`，clamp 到 [60s, 10min]。
 *
 * 为什么不是一个固定的魔数：固定 10 分钟对一张图的笔记是个形同虚设的守卫，
 * 对三十张的又可能刚好不够；这条支线的工作量就是线性于图数的。
 *
 * 边界：0 / 1 / 2 张都落到下限 60s（和今天的行为一致，不因为图少而收紧）；
 * 20 张以上落到上限 10min。非有限值、负数按 0 算 —— 拿不到图数时给下限，
 * 不该让一个脏数字把守卫变没。
 */
export const livePhotoBatchTimeoutMs = (imageCount: number): number => {
  const count = Number.isFinite(imageCount) && imageCount > 0 ? Math.trunc(imageCount) : 0
  return Math.min(
    MAX_MEDIA_TASK_TIMEOUT_MS,
    Math.max(MIN_MEDIA_TASK_TIMEOUT_MS, count * LIVE_PHOTO_BUDGET_PER_IMAGE_MS)
  )
}

export interface MediaTaskOptions {
  /**
   * 不传就是不传：`runWithRequestGuard` 会退到 `DEFAULT_REQUEST_TIMEOUT_MS`（60s）。
   * douyin / bilibili 两个调用点都不传，靠的就是这个默认行为。
   */
  timeoutMs?: number
  /**
   * 按支线单独覆盖 `timeoutMs`，给「工作量本身就远超 60s」的重支线用
   * （整批实况图生成、视频下载）。
   *
   * 只有在这里列出来的支线走覆盖值，其余支线照 `timeoutMs`；两者都没有时
   * 才落到 guard 的默认值。所以给某条支线放宽不会顺带放宽它的邻居 ——
   * 「评论卡还是 60s，视频下载放到 10 分钟」这种混搭是这个字段存在的理由。
   */
  taskTimeoutMs?: Partial<Record<MediaTaskName, number>>
  onTaskFailure?: (failure: MediaTaskFailure) => void
}

/**
 * 一条支线最终用哪个超时值。`undefined` 表示「不覆盖」，由 `runWithRequestGuard`
 * 落到 `DEFAULT_REQUEST_TIMEOUT_MS`。
 *
 * 单独导出是为了让「douyin/bilibili 这种不传任何超时的调用点仍然拿默认值」
 * 能被直接钉住，而不是只能靠假定时器去侧面观察。
 */
export const resolveMediaTaskTimeoutMs = (
  task: MediaTaskName,
  options: MediaTaskOptions = {}
): number | undefined => options.taskTimeoutMs?.[task] ?? options.timeoutMs

export interface MediaTasks {
  poster?: MediaTask
  video?: MediaTask
  image?: MediaTask
  comment?: MediaTask
}

export const runMediaTasks = async (
  tasks: MediaTasks,
  options: MediaTaskOptions = {}
): Promise<MediaTaskResult> => {
  /*
    收集顺序 = 失败上报（`failures` / `succeeded`）里的顺序，所以按「读者从上往下
    看一次解析的产物」排：先信息卡，再正文媒体（视频、图片各一条），最后评论卡。

    `image` 插在 `video` 之后、`comment` 之前，而不是追加到末尾：两条正文媒体分支
    挨在一起才好读，而且这样 poster/video/comment 三者的相对顺序跟加 `image` 之前
    完全一致 —— 已有的调用点和用例读的就是那个顺序。
  */
  const entries: Array<[MediaTaskName, MediaTask]> = []
  if (tasks.poster) entries.push(['poster', tasks.poster])
  if (tasks.video) entries.push(['video', tasks.video])
  if (tasks.image) entries.push(['image', tasks.image])
  if (tasks.comment) entries.push(['comment', tasks.comment])

  const settled = await Promise.allSettled(
    entries.map(([name, task]) => runWithRequestGuard(
      () => Promise.resolve().then(task),
      { timeoutMs: resolveMediaTaskTimeoutMs(name, options), maxRetries: 0 }
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
