/**
 * 按平台分桶的全局下载连接预算。
 *
 * 这里管的是「同一个平台同时开着几条下载连接」，而不是「一个文件切成几片」。
 * 文件级下载和分片级下载**共享同一个桶的额度**，因为限流是按 IP + 平台触发的：
 * 两级各管一层的话实际并发是乘积（解析并发 2 × 文件并发 N × 分片 4），
 * 一个 30 图的实况图集瞬间能开出几十条连接，平台直接把 IP 限掉。
 *
 * 桶的单位是「解析上下文的平台」，不是 hostname。抖音光硬编码的就有 www.douyin.com /
 * aweme.snssdk.com / p3-pc.douyinpic.com / p3.douyinpic.com / live.douyin.com 五个域名，
 * 而真正下大文件的 CDN 域名（douyinvod.com 那一类）是接口响应里动态返回的、没法预先列举。
 * 按 eTLD+1 自动分桶会把抖音拆成四个桶，等于把上限悄悄放宽四倍。
 *
 * 桶标签怎么传：`withDownloadBucket()` 用 AsyncLocalStorage 把标签套在整段调用链上，
 * 于是 `downloadFile` / `downloadVideo` / `processImageUrl` / `buildLivePhotoMessages`
 * 这些深层 helper 不用改签名就能继承。解析路径由 ParseCoordinator 统一套上（那里有
 * platform），主动推送不走解析协调器，由各平台 push 的 `action()` 自己套。
 * 两条路都漏掉时不抛错，落到 `default` 兜底桶并记一条 debug，方便日后发现漏套的路径。
 */
import { AsyncLocalStorage } from 'node:async_hooks'

import Config from '@/module/utils/Config'

/**
 * 额度下限。低于 2 时一个图集会退化成纯串行下载，多线程分片也失去意义。
 */
export const MIN_DOWNLOAD_CONCURRENCY = 2

/**
 * 额度上限。语义从「单文件分片数」改成「按平台的连接总数」之后，8 已经贴着默认值，
 * 上限跟着抬到 16：宽带用户想把一个图集压满时有余量，同时仍然远离平台的限流线。
 */
export const MAX_DOWNLOAD_CONCURRENCY = 16

/**
 * 默认额度。旧默认值 4 是「单文件分片数」，换成平台连接总数后 4 反而比原来更紧
 * （原来一个文件就能开 4 条），所以抬到 8。
 */
export const DEFAULT_DOWNLOAD_CONCURRENCY = 8

/** 拿不到平台上下文时的兜底桶名。 */
export const DEFAULT_DOWNLOAD_BUCKET = 'default'

/**
 * 把配置值收敛成合法额度。非数字、NaN、Infinity 一律回落默认值。
 */
export const clampConcurrency = (value: unknown): number => {
  const parsed = Math.trunc(Number(value))
  return Number.isFinite(parsed)
    ? Math.min(MAX_DOWNLOAD_CONCURRENCY, Math.max(MIN_DOWNLOAD_CONCURRENCY, parsed))
    : DEFAULT_DOWNLOAD_CONCURRENCY
}

/** 单个桶的占用快照。 */
export interface DownloadBucketSnapshot {
  /** 桶名，即解析上下文的平台 */
  bucket: string
  /** 该桶的额度上限 */
  limit: number
  /** 当前占用的额度数 */
  running: number
  /** 正在排队等额度的数量 */
  queued: number
}

/** 整个下载预算的只读快照，给运行诊断卡消费。 */
export interface DownloadBudgetSnapshot {
  /** 所有桶共用的额度上限 */
  limit: number
  /** 已经出现过的桶，按桶名排序 */
  buckets: readonly DownloadBucketSnapshot[]
}

/** 一格已经拿到手的额度。`release()` 幂等。 */
export interface DownloadSlot {
  bucket: string
  release: () => void
}

export interface DownloadSlotOptions {
  /**
   * 显式指定桶名，覆盖 AsyncLocalStorage 里的上下文。
   * 给拿不到上下文、又不方便套 `withDownloadBucket` 的调用点用。
   */
  bucket?: string
}

interface DownloadBucketContext {
  bucket: string
}

class DownloadBucketState {
  running = 0
  readonly waiters: Array<() => void> = []
}

const storage = new AsyncLocalStorage<DownloadBucketContext>()
const buckets = new Map<string, DownloadBucketState>()

let limitResolver: (() => number) | undefined

const normalizeBucket = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : undefined
}

/**
 * 当前生效的额度上限。每次取额度都重新读，所以锅巴改完配置立刻生效，
 * 不需要重启或重建桶。
 */
export const getDownloadBudgetLimit = (): number => {
  if (limitResolver !== undefined) return limitResolver()
  return clampConcurrency(Config.upload?.downloadConcurrency)
}

/**
 * 把一段调用链标记成属于某个平台的下载桶。链内所有下载（含 await、setTimeout、
 * 流回调之后创建的异步资源）都会继承这个标签。
 */
export const withDownloadBucket = async <T>(
  bucket: string,
  fn: () => T | PromiseLike<T>
): Promise<T> => {
  const normalized = normalizeBucket(bucket) ?? DEFAULT_DOWNLOAD_BUCKET
  return await storage.run({ bucket: normalized }, async () => await fn())
}

/** 当前调用链所属的桶，没有上下文时返回 undefined。 */
export const getCurrentDownloadBucket = (): string | undefined => storage.getStore()?.bucket

const resolveBucketName = (explicit?: string): string => {
  const normalized = normalizeBucket(explicit)
  if (normalized !== undefined) return normalized
  const inherited = storage.getStore()?.bucket
  if (inherited !== undefined) return inherited
  // 不抛错：漏套上下文只该让限流变保守，不该把一次解析炸掉。
  // 记一条 debug 是为了日后能查出还有哪条路径没套。
  logger.debug?.('[下载预算] 当前调用链没有平台上下文，本次下载记入 default 桶')
  return DEFAULT_DOWNLOAD_BUCKET
}

const getBucketState = (bucket: string): DownloadBucketState => {
  const existing = buckets.get(bucket)
  if (existing !== undefined) return existing
  const created = new DownloadBucketState()
  buckets.set(bucket, created)
  return created
}

const drain = (state: DownloadBucketState): void => {
  const limit = getDownloadBudgetLimit()
  while (state.running < limit) {
    const waiter = state.waiters.shift()
    if (waiter === undefined) return
    // 额度在这里就记上，而不是等 waiter 的 Promise 真的恢复执行：
    // 否则同一个 release 会把整队人一起放进来。
    state.running += 1
    waiter()
  }
}

const createSlot = (bucket: string, state: DownloadBucketState): DownloadSlot => {
  let released = false
  return {
    bucket,
    release: (): void => {
      if (released) return
      released = true
      state.running -= 1
      drain(state)
    }
  }
}

/**
 * 取一格额度，没有额度时排队等。
 */
export const acquireDownloadSlot = async (options: DownloadSlotOptions = {}): Promise<DownloadSlot> => {
  const bucket = resolveBucketName(options.bucket)
  const state = getBucketState(bucket)
  if (state.running < getDownloadBudgetLimit()) {
    state.running += 1
    return createSlot(bucket, state)
  }
  await new Promise<void>(resolve => {
    state.waiters.push(resolve)
  })
  return createSlot(bucket, state)
}

/**
 * 尽量多取几格额度，取不到就少取甚至一格都不取 —— 不排队、不报错。
 *
 * 分片下载专用：文件级已经占着一格额度了，分片再排队等就会互相等死
 * （桶里每个文件都在等自己的分片额度，而额度全被这些文件本身占着）。
 * 拿不到就退化成单线程，这是正确的降级，不是错误。
 */
export const tryAcquireDownloadSlots = (
  count: number,
  options: DownloadSlotOptions = {}
): DownloadSlot[] => {
  const wanted = Math.max(0, Math.trunc(Number(count)) || 0)
  if (wanted === 0) return []
  const bucket = resolveBucketName(options.bucket)
  const state = getBucketState(bucket)
  const limit = getDownloadBudgetLimit()
  const slots: DownloadSlot[] = []
  while (slots.length < wanted && state.running < limit) {
    state.running += 1
    slots.push(createSlot(bucket, state))
  }
  return slots
}

/** 在一格额度内跑一段下载，结束后一定归还。 */
export const runWithDownloadSlot = async <T>(
  fn: () => T | PromiseLike<T>,
  options: DownloadSlotOptions = {}
): Promise<T> => {
  const slot = await acquireDownloadSlot(options)
  try {
    return await fn()
  } finally {
    slot.release()
  }
}

/**
 * 只读快照。形状对齐 `ParseScheduler.getSnapshot()`：诊断卡拿到的是当下的数字，
 * 不持有任何可以反过来影响队列的句柄。
 */
export const getDownloadBudgetSnapshot = (): DownloadBudgetSnapshot => {
  const limit = getDownloadBudgetLimit()
  return {
    limit,
    buckets: [...buckets.entries()]
      .map(([bucket, state]) => ({
        bucket,
        limit,
        running: state.running,
        queued: state.waiters.length
      }))
      .sort((first, second) => first.bucket.localeCompare(second.bucket))
  }
}

/**
 * 覆盖额度来源。测试用来摆脱 Config 单例（读 Config 会触发一次落盘初始化），
 * 传 undefined 恢复成读配置。
 */
export const setDownloadBudgetLimitResolver = (resolver: (() => number) | undefined): void => {
  limitResolver = resolver
}

/**
 * 清空所有桶并恢复默认额度来源。只在桶已经空闲时调用 —— 还有人在排队时清空
 * 会让那些等待者永远拿不到 resolve。
 */
export const resetDownloadBudget = (): void => {
  buckets.clear()
  limitResolver = undefined
}
