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

    return this.scheduler.submit(fingerprint, async () => {
      notifyReaction(reaction, 'processing')

      try {
        const result = await task()
        notifyReaction(reaction, 'succeeded')
        return result
      } catch (error) {
        notifyReaction(reaction, 'failed')
        throw error
      }
    })
  }

  getSnapshot (): ParseSchedulerSnapshot {
    return this.scheduler.getSnapshot()
  }
}
