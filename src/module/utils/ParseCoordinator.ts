import { withDownloadBucket } from './DownloadBudget.js'
import {
  ParseScheduler,
  type ParseSchedulerSnapshot,
  type ParseTask
} from './ParseScheduler.js'

export type ParseScopeType = 'group' | 'private'

export interface ParseScope {
  type: ParseScopeType
  id: string | number
}

export type ParseTarget =
  | {
    type: 'url'
    value: string
  }
  | {
    type: 'work-id'
    value: string
  }

export interface ParseJobIdentity {
  platform: string
  target: ParseTarget
  scope: ParseScope
}

export type ParseReactionState = 'processing' | 'succeeded' | 'failed'

export interface ParseReactionPort {
  setState: (state: ParseReactionState) => void | PromiseLike<void>
}

export interface ParseCoordinatorOptions {
  concurrency?: number
}

const FINGERPRINT_VERSION = 'parse:v1:'

const requiredText = (value: string | number, label: string): string => {
  const normalized = String(value).trim()
  if (normalized.length === 0) {
    throw new TypeError(`${label} must not be empty`)
  }
  return normalized
}

const normalizePlatform = (platform: string): string => (
  requiredText(platform, 'platform').toLowerCase()
)

const normalizeUrl = (value: string): string => {
  const source = requiredText(value, 'target URL')
  let url: URL

  try {
    url = new URL(source)
  } catch {
    throw new TypeError('target URL must be an absolute HTTP or HTTPS URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TypeError('target URL must use HTTP or HTTPS')
  }

  url.hash = ''
  url.searchParams.sort()
  return url.href
}

const normalizeTarget = (target: ParseTarget): readonly [ParseTarget['type'], string] => {
  if (target.type === 'url') {
    return [target.type, normalizeUrl(target.value)]
  }

  if (target.type === 'work-id') {
    return [target.type, requiredText(target.value, 'work ID')]
  }

  throw new TypeError('target type must be url or work-id')
}

const normalizeScope = (scope: ParseScope): readonly [ParseScopeType, string] => {
  if (scope.type !== 'group' && scope.type !== 'private') {
    throw new TypeError('scope type must be group or private')
  }

  return [scope.type, requiredText(scope.id, 'scope ID')]
}

export const createParseFingerprint = (identity: ParseJobIdentity): string => {
  const normalized = [
    normalizePlatform(identity.platform),
    ...normalizeTarget(identity.target),
    ...normalizeScope(identity.scope)
  ]

  return `${FINGERPRINT_VERSION}${JSON.stringify(normalized)}`
}

const ignoreReactionFailure = (): void => {}

const notifyReaction = (
  port: ParseReactionPort | undefined,
  state: ParseReactionState
): void => {
  if (port === undefined) return

  try {
    Promise.resolve(port.setState(state)).catch(ignoreReactionFailure)
  } catch {
    // Reactions are status hints; the in-memory scheduler remains authoritative.
  }
}

export class ParseCoordinator {
  private readonly scheduler: ParseScheduler

  constructor (options: ParseCoordinatorOptions = {}) {
    this.scheduler = new ParseScheduler({ concurrency: options.concurrency })
  }

  submit<T> (
    identity: ParseJobIdentity,
    task: ParseTask<T>,
    reaction?: ParseReactionPort
  ): Promise<T> {
    const fingerprint = createParseFingerprint(identity)

    // 下载连接预算的桶标签就在这里落地：identity.platform 是全仓库唯一一处
    // 「一次解析属于哪个平台」的权威来源，而 withDownloadBucket 用 AsyncLocalStorage
    // 把它铺到整条调用链上 —— downloadFile / downloadVideo / processImageUrl /
    // buildLivePhotoMessages 这些深层 helper 因此不用改签名就能记入正确的桶。
    //
    // 套在 scheduler.submit 的任务闭包**里面**而不是外面：run() 必须在任务真的开始
    // 执行时进入，这样任务内部创建的所有异步资源才继承得到上下文。套在外面的话，
    // 排队期间上下文早就退出了，被调度器延后启动的任务会落到 default 桶。
    return this.scheduler.submit(fingerprint, async () => await withDownloadBucket(identity.platform, async () => {
      notifyReaction(reaction, 'processing')

      try {
        const result = await task()
        notifyReaction(reaction, 'succeeded')
        return result
      } catch (error) {
        notifyReaction(reaction, 'failed')
        throw error
      }
    }))
  }

  getSnapshot (): ParseSchedulerSnapshot {
    return this.scheduler.getSnapshot()
  }
}

/**
 * 当前在用的那个协调器。
 *
 * 诊断卡要读解析队列的实时数字，但协调器实例是 `apps/tools.ts` 的模块级 const，
 * 而 `runtime-report.ts` 不能反过来引 apps 层（apps 引 utils，反向引会成环，
 * 且 tools.ts 一加载就会注册命令、读一遍配置）。所以由 tools.ts 主动登记，
 * 报告侧只读这个引用 —— 和 ApiCache / DownloadBudget 那两套「模块级单例导出只读快照」
 * 是同一个形状，只是实例的所有权在 apps 层，多一次登记动作。
 */
let activeCoordinator: ParseCoordinator | undefined

/** 登记当前协调器，供诊断卡读取队列快照 */
export const setActiveParseCoordinator = (coordinator: ParseCoordinator | undefined): void => {
  activeCoordinator = coordinator
}

/**
 * 解析队列的只读快照。
 *
 * 返回 undefined 表示还没有协调器登记（比如只加载了 utils 层的单元测试环境），
 * 诊断卡据此写「未初始化」而不是画一排 0 —— 后者会被读成「队列是空的」。
 */
export const getParseCoordinatorSnapshot = (): ParseSchedulerSnapshot | undefined =>
  activeCoordinator?.getSnapshot()
