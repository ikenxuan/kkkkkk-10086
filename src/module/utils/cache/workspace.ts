import { randomUUID } from 'node:crypto'
import { lstatSync, openSync, closeSync, readSync } from 'node:fs'
import { lstat, mkdir, mkdtemp, open, opendir, rename, rmdir, unlink, writeFile } from 'node:fs/promises'
import { hostname } from 'node:os'
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path'

export type CacheKind = 'render' | 'media' | 'debug'

export interface CachePolicy {
  orphanTtlMs: number
  legacyTtlMs: number
  mediaTtlMs: number
  debugTtlMs: number
  minAgeMs: number
  maxFiles: number
  maxBytes: number
  debugMaxFiles: number
  debugMaxBytes: number
  scanLimit: number
  deleteLimit: number
  deleteByteLimit: number
}

interface Options {
  htmlRoot: string
  mediaRoot: string
  policy?: Partial<CachePolicy>
  now?: () => number
  host?: string
  pid?: number
  isProcessAlive?: (pid: number) => boolean
  onWarning?: (code: string) => void
}

interface Lease {
  version: 1
  host: string
  pid: number
  nonce: string
}

interface Metadata extends Lease {
  kind: CacheKind
  createdAt: number
  releasedAt?: number
  expiresAt?: number
}

interface Candidate {
  path: string
  kind: CacheKind
  legacy: boolean
  tomb: boolean
  files: number
  bytes: number
  modified: number
  metadata?: Metadata
  protected: boolean
}

interface ScanStep { candidate?: Candidate }
interface DeleteStep { path: string, bytes: number, directory: boolean }
interface DeleteJob { iterator: AsyncGenerator<DeleteStep>, next?: DeleteStep }
interface SweepResult { scanned: number, deleted: number, bytes: number, failed: number, more?: boolean }
interface Totals { files: number, bytes: number }
interface InventoryTotals { general: Totals, debug: Totals }
interface LockHandle { nonce: string, dev: number, ino: number }

const HOUR = 3_600_000
const META = '.kkk-cache.json'
const LEASES = '.leases'
const CLAIM = '.gc'
const GC_PREFIX = '.kkkkkk-10086-gc-'
const MAX_JSON_BYTES = 4096
const MAX_DEPTH = 32
const MAX_INVENTORY = 2048
const emptyTotals = (): InventoryTotals => ({ general: { files: 0, bytes: 0 }, debug: { files: 0, bytes: 0 } })
const defaults: CachePolicy = {
  orphanTtlMs: 24 * HOUR,
  legacyTtlMs: 7 * 24 * HOUR,
  mediaTtlMs: 10 * 60_000,
  debugTtlMs: 24 * HOUR,
  minAgeMs: HOUR,
  maxFiles: 1000,
  maxBytes: 256 * 1024 * 1024,
  debugMaxFiles: 50,
  debugMaxBytes: 64 * 1024 * 1024,
  scanLimit: 500,
  deleteLimit: 100,
  deleteByteLimit: 64 * 1024 * 1024
}

const errorCode = (error: unknown): string | undefined =>
  error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined
const missing = (error: unknown): boolean => errorCode(error) === 'ENOENT'
const noop = async (): Promise<void> => {}
const inside = (root: string, path: string): boolean => {
  const part = relative(root, path)
  return Boolean(part) && part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part)
}
const leaseValid = (value: unknown): value is Lease => {
  if (!value || typeof value !== 'object') return false
  const lease = value as Partial<Lease>
  return lease.version === 1 && typeof lease.host === 'string' && lease.host.length > 0 && lease.host.length < 256 &&
    Number.isSafeInteger(lease.pid) && Number(lease.pid) > 0 && typeof lease.nonce === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(lease.nonce)
}
const metadataValid = (value: unknown): value is Metadata => {
  if (!leaseValid(value)) return false
  const metadata = value as Metadata
  return ['render', 'media', 'debug'].includes(metadata.kind) && Number.isFinite(metadata.createdAt) &&
    (metadata.releasedAt === undefined || Number.isFinite(metadata.releasedAt)) &&
    (metadata.expiresAt === undefined || Number.isFinite(metadata.expiresAt))
}

/** Check every existing ancestor, including configured roots; Windows junctions are links too. */
const assertSafeSync = (path: string): void => {
  const absolute = resolve(path)
  let current = parse(absolute).root
  for (const component of absolute.slice(current.length).split(sep).filter(Boolean)) {
    current = join(current, component)
    try {
      if (lstatSync(current).isSymbolicLink()) throw new Error('CACHE_LINK')
    } catch (error) {
      if (missing(error)) return
      throw error
    }
  }
}

/** Never read unbounded metadata, including when a file grows between stat and read. */
const readJson = async (path: string): Promise<unknown> => {
  assertSafeSync(path)
  const before = await lstat(path)
  if (!before.isFile() || before.size > MAX_JSON_BYTES) throw new Error('CACHE_METADATA')
  const handle = await open(path, 'r')
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > MAX_JSON_BYTES) throw new Error('CACHE_METADATA')
    const buffer = Buffer.alloc(MAX_JSON_BYTES + 1)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    if (bytesRead > MAX_JSON_BYTES) throw new Error('CACHE_METADATA')
    return JSON.parse(buffer.subarray(0, bytesRead).toString('utf8')) as unknown
  } finally {
    await handle.close()
  }
}

const readJsonSync = (path: string): unknown => {
  assertSafeSync(path)
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.size > MAX_JSON_BYTES) throw new Error('CACHE_METADATA')
  const fd = openSync(path, 'r')
  try {
    const buffer = Buffer.alloc(MAX_JSON_BYTES + 1)
    const bytes = readSync(fd, buffer, 0, buffer.length, 0)
    if (bytes > MAX_JSON_BYTES) throw new Error('CACHE_METADATA')
    return JSON.parse(buffer.subarray(0, bytes).toString('utf8')) as unknown
  } finally {
    closeSync(fd)
  }
}

export class CacheManager {
  private readonly htmlRoot: string
  private readonly mediaRoot: string
  private readonly policy: CachePolicy
  private readonly now: () => number
  private readonly host: string
  private readonly pid: number
  private readonly alive: (pid: number) => boolean
  private readonly onWarning?: (code: string) => void
  private scanner?: AsyncGenerator<ScanStep>
  private readonly inventory = new Map<string, Candidate>()
  private passTotals = emptyTotals()
  private completedTotals = emptyTotals()
  private readonly deletions = new Map<string, DeleteJob>()
  private readonly pendingReleases = new Map<string, () => Promise<void>>()
  private readonly ownedLocks = new Map<string, LockHandle>()
  private readonly pendingUnlocks = new Map<string, LockHandle>()
  private running?: Promise<SweepResult>
  private closed = false

  constructor (options: Options) {
    this.htmlRoot = resolve(options.htmlRoot)
    this.mediaRoot = resolve(options.mediaRoot)
    if (this.htmlRoot === this.mediaRoot || inside(this.htmlRoot, this.mediaRoot) || inside(this.mediaRoot, this.htmlRoot)) {
      throw new Error('CACHE_OVERLAPPING_ROOTS')
    }
    this.policy = { ...defaults }
    for (const key of Object.keys(defaults) as Array<keyof CachePolicy>) {
      const value = options.policy?.[key]
      if (value !== undefined && Number.isFinite(value) && value >= 0) this.policy[key] = key.endsWith('Ms') ? value : Math.floor(value)
    }
    this.now = options.now ?? Date.now
    this.host = options.host ?? hostname()
    this.pid = options.pid ?? process.pid
    this.alive = options.isProcessAlive ?? (pid => {
      try { process.kill(pid, 0); return true } catch (error) { return errorCode(error) !== 'ESRCH' }
    })
    this.onWarning = options.onWarning
  }

  private warn (code: string): void {
    try { this.onWarning?.(code) } catch { /* Logging must not alter cache ownership. */ }
  }

  private lease (): Lease { return { version: 1, host: this.host, pid: this.pid, nonce: randomUUID() } }

  private async putMetadata (path: string, metadata: Metadata): Promise<void> {
    assertSafeSync(path)
    const temporary = join(path, `.meta-${randomUUID()}`)
    try {
      await writeFile(temporary, JSON.stringify(metadata), { flag: 'wx', mode: 0o600 })
      assertSafeSync(join(path, META))
      await rename(temporary, join(path, META))
    } finally {
      await unlink(temporary).catch(error => { if (!missing(error)) this.warn('CACHE_METADATA_WRITE') })
    }
  }

  private async addLease (path: string): Promise<string> {
    assertSafeSync(path)
    const lease = this.lease()
    assertSafeSync(join(path, LEASES))
    const file = join(path, LEASES, `${lease.nonce}.json`)
    try {
      await writeFile(file, JSON.stringify(lease), { flag: 'wx', mode: 0o600 })
      // A reaper claims first, then rechecks leases. A consumer leases first,
      // then checks the claim. Therefore they cannot both start using/deleting.
      assertSafeSync(path)
      if (await lstat(join(path, CLAIM)).then(() => true, error => { if (missing(error)) return false; throw error })) {
        throw new Error('CACHE_CLAIMED')
      }
      return file
    } catch (error) {
      // writeFile may create a truncated record before ENOSPC/EIO. Remove only
      // this invocation's exact nonce; EEXIST belongs to a previous creator.
      if (errorCode(error) !== 'EEXIST') {
        try { assertSafeSync(file); await unlink(file) } catch (cleanupError) {
          if (!missing(cleanupError)) {
            this.deletions.set(file, { iterator: this.walkDelete(file) })
            this.warn('CACHE_LEASE_ROLLBACK')
          }
        }
      }
      throw error
    }
  }

  private releaseLease (path: string, leaseFile: string, kind: CacheKind): (retainMs?: number) => Promise<void> {
    let released = false
    let pending: Promise<void> | undefined
    const release = async (retainMs?: number): Promise<void> => {
      if (released) return
      pending ??= (async () => {
        let lock: string | undefined
        try {
          // Serialize release deadlines across managers/processes. Reading and
          // atomically replacing JSON alone can lose a concurrent longer TTL.
          for (let attempt = 0; attempt < 20; attempt++) {
            lock = await this.acquireClaim(path, '.retention')
            if (lock) break
            await new Promise(resolve => setTimeout(resolve, 5))
          }
          if (!lock) throw new Error('CACHE_RETENTION_BUSY')
          const metadata = await readJson(join(path, META))
          if (!metadataValid(metadata)) throw new Error('CACHE_METADATA')
          const ttl = retainMs !== undefined && Number.isFinite(retainMs) && retainMs >= 0
            ? retainMs
            : kind === 'media' ? this.policy.mediaTtlMs : kind === 'debug' ? this.policy.debugTtlMs : 0
          await this.putMetadata(path, { ...metadata, releasedAt: this.now(), expiresAt: Math.max(metadata.expiresAt ?? 0, this.now() + ttl) })
          assertSafeSync(leaseFile)
          await unlink(leaseFile)
          released = true
        } catch (error) {
          if (missing(error)) released = true
          else {
            this.pendingReleases.set(leaseFile, async () => { await release(retainMs) })
            this.warn('CACHE_RELEASE')
          }
        } finally {
          if (lock) {
            await this.finishUnlock(lock)
          }
          if (released) this.pendingReleases.delete(leaseFile)
          pending = undefined
        }
      })()
      await pending
    }
    return release
  }

  async createWorkspace (kind: CacheKind): Promise<{ path: string, cleanup: () => Promise<void>, release: (retainMs?: number) => Promise<void> }> {
    if (this.closed) throw new Error('CACHE_CLOSED')
    const root = kind === 'media' ? this.mediaRoot : this.htmlRoot
    assertSafeSync(root)
    await mkdir(root, { recursive: true })
    assertSafeSync(root)
    const prefix = kind === 'media' ? 'media-' : kind === 'debug' ? 'kkkkkk-10086-debug-' : 'kkkkkk-10086-ktr-'
    const path = await mkdtemp(join(root, prefix))
    const metadata: Metadata = { ...this.lease(), kind, createdAt: this.now() }
    let leaseFile: string
    try {
      await this.putMetadata(path, metadata)
      await mkdir(join(path, LEASES))
      leaseFile = await this.addLease(path)
    } catch (error) {
      // The newly allocated path has never been delivered to a consumer. It is
      // safe to roll back that exact tree without being blocked by our own
      // partial lease; keep the allocation error if rollback also fails.
      try {
        for await (const step of this.walkDelete(path)) await this.removeStep(step)
      } catch (cleanupError) {
        if (!missing(cleanupError)) {
          this.deletions.set(path, { iterator: this.walkDelete(path) })
          this.warn('CACHE_ALLOCATION_ROLLBACK')
        }
      }
      throw error
    }
    const release = this.releaseLease(path, leaseFile, kind)
    let target = path
    let cleaned = false
    let pending: Promise<void> | undefined
    const cleanup = async (): Promise<void> => {
      if (kind === 'debug') { await release(); return }
      if (cleaned) return
      pending ??= (async () => {
        try {
          // Calling cleanup means this consumer has ended, even when path
          // validation or deletion subsequently fails. Otherwise a live PID
          // would protect a failed cleanup forever after its caller returns.
          await release()
          // Validate before moving so an unsafe descendant leaves its original
          // name intact and cleanup can be retried after an obstruction is fixed.
          const validation = this.walkDelete(target)
          while (!(await validation.next()).done) { /* Validate without deleting. */ }
          if (target === path) {
            const claimed = await this.claim(target)
            if (!claimed) throw new Error('CACHE_IN_USE')
            target = claimed
          } else {
            await this.deletions.get(target)?.iterator.return(undefined)
            this.deletions.delete(target)
          }
          for await (const step of this.walkDelete(target)) await this.removeStep(step)
          cleaned = true
          this.inventory.delete(path)
        } catch (error) {
          if (missing(error)) cleaned = true
          else {
            if (target !== path) this.deletions.set(target, { iterator: this.walkDelete(target) })
            throw error
          }
        } finally { pending = undefined }
      })()
      await pending
    }
    return { path, cleanup, release }
  }

  private mediaWorkspace (filePath: string): string | undefined {
    const absolute = resolve(filePath)
    if (!inside(this.mediaRoot, absolute)) return
    const components = relative(this.mediaRoot, absolute).split(sep)
    if (components.length < 2 || !/^media-[a-zA-Z0-9-]+$/.test(components[0] ?? '')) return
    const path = join(this.mediaRoot, components[0]!)
    try {
      assertSafeSync(absolute)
      const metadata = readJsonSync(join(path, META))
      if (metadataValid(metadata) && metadata.kind === 'media') return path
    } catch { /* Unowned, linked and malformed paths never acquire cache leases. */ }
  }

  isManaged (filePath: string): boolean { return this.mediaWorkspace(filePath) !== undefined }

  async retainFile (filePath: string): Promise<() => Promise<void>> {
    const path = this.mediaWorkspace(filePath)
    if (!path) return noop
    if (this.closed) throw new Error('CACHE_CLOSED')
    const file = await this.addLease(path)
    return this.releaseLease(path, file, 'media')
  }

  private protectedLease (value: unknown): boolean {
    if (!leaseValid(value) || value.host !== this.host) return true
    try { return this.alive(value.pid) } catch { return true }
  }

  private async hasLease (path: string, result?: SweepResult): Promise<boolean> {
    const leasePath = join(path, LEASES)
    assertSafeSync(leasePath)
    let directory
    try { directory = await opendir(leasePath, { bufferSize: 1 }) } catch (error) { if (missing(error)) return false; throw error }
    let count = 0
    try {
      for await (const entry of directory) {
        // Bound adversarial lease directories too. An incomplete lease scan is
        // never permission to delete a workspace.
        if (++count > this.policy.scanLimit || (result && result.scanned >= this.policy.scanLimit)) return true
        if (result) result.scanned++
        try { if (this.protectedLease(await readJson(join(leasePath, entry.name)))) return true } catch { return true }
      }
    } catch (error) {
      if (!missing(error)) throw error
    }
    return false
  }

  private async acquireClaim (path: string, name = CLAIM): Promise<string | undefined> {
    let claim = join(path, name)
    // Recovery is itself claimed with mkdir. A second reaper observes the live
    // recovery owner, so it cannot rename a workspace another process deletes.
    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      assertSafeSync(claim)
      try {
        await mkdir(claim)
        const lease = this.lease()
        const stat = await lstat(claim)
        this.ownedLocks.set(claim, { nonce: lease.nonce, dev: stat.dev, ino: stat.ino })
        try {
          await writeFile(join(claim, 'owner.json'), JSON.stringify(lease), { flag: 'wx', mode: 0o600 })
        } catch (error) {
          await this.finishUnlock(claim)
          throw error
        }
        return claim
      } catch (error) {
        if (missing(error)) return
        if (errorCode(error) !== 'EEXIST') throw error
      }
      try {
        if (this.protectedLease(await readJson(join(claim, 'owner.json')))) return
      } catch (error) {
        if (!missing(error) || this.now() - (await lstat(claim)).mtimeMs < this.policy.orphanTtlMs) return
      }
      claim = join(claim, 'recovery')
    }
  }

  private async finishUnlock (path: string): Promise<void> {
    const handle = this.ownedLocks.get(path)
    if (!handle) return
    try {
      assertSafeSync(path)
      const stat = await lstat(path)
      if (!stat.isDirectory() || stat.dev !== handle.dev || stat.ino !== handle.ino) {
        // A replacement directory belongs to a different claim, even if its
        // process id happens to match ours. Never unlock it by PID alone.
        this.ownedLocks.delete(path)
        this.pendingUnlocks.delete(path)
        this.warn('CACHE_UNLOCK_REPLACED')
        return
      }
      try {
        const owner = await readJson(join(path, 'owner.json'))
        if (!leaseValid(owner) || owner.nonce !== handle.nonce || owner.host !== this.host || owner.pid !== this.pid) {
          this.ownedLocks.delete(path)
          this.pendingUnlocks.delete(path)
          this.warn('CACHE_UNLOCK_REPLACED')
          return
        }
        await unlink(join(path, 'owner.json'))
      } catch (error) { if (!missing(error)) throw error }
      await rmdir(path)
      this.ownedLocks.delete(path)
      this.pendingUnlocks.delete(path)
    } catch (error) {
      if (missing(error)) {
        this.ownedLocks.delete(path)
        this.pendingUnlocks.delete(path)
      } else {
        this.pendingUnlocks.set(path, handle)
        this.warn('CACHE_UNLOCK')
      }
    }
  }

  private async claimProtected (path: string): Promise<boolean> {
    let claim = join(path, CLAIM)
    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      try {
        assertSafeSync(claim)
        const stat = await lstat(claim)
        try { if (this.protectedLease(await readJson(join(claim, 'owner.json')))) return true } catch (error) {
          if (!missing(error) || this.now() - stat.mtimeMs < this.policy.orphanTtlMs) return true
        }
      } catch (error) { return !missing(error) }
      claim = join(claim, 'recovery')
    }
    return true
  }

  private async claim (path: string, candidate?: Candidate, capacity = false, result?: SweepResult): Promise<string | undefined> {
    assertSafeSync(path)
    const claim = await this.acquireClaim(path)
    if (!claim) return
    let moved = false
    try {
      if (await this.hasLease(path, result)) return
      if (candidate) {
        // A consumer may have released a newer lease since the inventory scan.
        // Re-read its retention deadline while the claim excludes new readers.
        let metadata: Metadata | undefined
        try {
          const value = await readJson(join(path, META))
          if (!metadataValid(value)) return
          metadata = value
        } catch (error) { if (!missing(error)) return }
        const current = { ...candidate, metadata }
        const oldEnough = this.now() - Math.max(candidate.modified, metadata?.releasedAt ?? 0) >= this.policy.minAgeMs
        if (!this.expired(current) && !(capacity && oldEnough)) return
      }
      assertSafeSync(path)
      const destination = join(dirname(path), `${GC_PREFIX}${randomUUID()}`)
      await rename(path, destination)
      moved = true
      this.ownedLocks.delete(claim)
      return destination
    } finally {
      if (!moved) {
        await this.finishUnlock(claim)
      }
    }
  }

  /** Streaming traversal: no readdir(), recursive rm(), or full directory arrays. */
  private async * walkDelete (path: string, depth = 0): AsyncGenerator<DeleteStep> {
    assertSafeSync(path)
    if (depth > MAX_DEPTH) throw new Error('CACHE_DEPTH')
    const stat = await lstat(path)
    if (stat.isSymbolicLink()) throw new Error('CACHE_LINK')
    if (stat.isDirectory()) {
      const directory = await opendir(path, { bufferSize: 1 })
      for await (const entry of directory) {
        // Keep restart/reaper ownership information until all payload deletes
        // succeeded; an interrupted large workspace remains recognizable.
        if (depth === 0 && (entry.name === META || entry.name === CLAIM)) continue
        yield * this.walkDelete(join(path, entry.name), depth + 1)
      }
      if (depth === 0) {
        for (const control of [META, CLAIM]) {
          try { yield * this.walkDelete(join(path, control), depth + 1) } catch (error) { if (!missing(error)) throw error }
        }
      }
      yield { path, bytes: 0, directory: true }
    } else if (stat.isFile()) yield { path, bytes: stat.size, directory: false }
    else throw new Error('CACHE_SPECIAL_FILE')
  }

  private async removeStep (step: DeleteStep): Promise<void> {
    assertSafeSync(step.path)
    if (step.directory) await rmdir(step.path)
    else await unlink(step.path)
  }

  private async * inspect (candidate: Candidate, path = candidate.path, depth = 0): AsyncGenerator<ScanStep> {
    if (depth > MAX_DEPTH) { candidate.protected = true; return }
    assertSafeSync(path)
    const directory = await opendir(path, { bufferSize: 1 })
    for await (const entry of directory) {
      yield {}
      const child = join(path, entry.name)
      const stat = await lstat(child)
      if (stat.isSymbolicLink()) { candidate.protected = true; continue }
      if (basename(path) === LEASES) {
        try { if (this.protectedLease(await readJson(child))) candidate.protected = true } catch { candidate.protected = true }
      } else if (entry.name === CLAIM) {
        if (await this.claimProtected(candidate.path)) candidate.protected = true
      } else if (entry.name === '.retention') {
        // Active release operations retain their consumer lease until the
        // deadline is committed; these small lock records are not payloads.
        continue
      } else if (entry.isDirectory()) yield * this.inspect(candidate, child, depth + 1)
      else if (entry.name !== META && !entry.name.startsWith('.meta-')) {
        if (!stat.isFile()) candidate.protected = true
        else {
          candidate.files++
          candidate.bytes += stat.size
          candidate.modified = Math.max(candidate.modified, stat.mtimeMs)
        }
      }
    }
  }

  private async * scanLegacy (root: string, depth = 0): AsyncGenerator<ScanStep> {
    if (depth > MAX_DEPTH) return
    assertSafeSync(root)
    const directory = await opendir(root, { bufferSize: 1 })
    for await (const entry of directory) {
      yield {}
      if (entry.isSymbolicLink()) continue
      const path = join(root, entry.name)
      try {
        assertSafeSync(path)
        if (entry.isDirectory()) yield * this.scanLegacy(path, depth + 1)
        else if (entry.isFile() && entry.name.endsWith('.html')) {
          const stat = await lstat(path)
          yield { candidate: { path, kind: 'render', legacy: true, tomb: false, files: 1, bytes: stat.size, modified: stat.mtimeMs, protected: false } }
        }
      } catch (error) { if (!missing(error)) this.warn('CACHE_SCAN_ENTRY') }
    }
  }

  private async * scan (): AsyncGenerator<ScanStep> {
    for (const [root, media, legacy] of [[this.htmlRoot, false, false], [this.mediaRoot, true, false], [join(this.htmlRoot, 'kkkkkk-10086'), false, true]] as const) {
      try {
        assertSafeSync(root)
        if (legacy) { yield * this.scanLegacy(root); continue }
        const directory = await opendir(root, { bufferSize: 1 })
        for await (const entry of directory) {
          yield {}
          const path = join(root, entry.name)
          if (entry.isSymbolicLink()) continue
          const tomb = entry.name.startsWith(GC_PREFIX) && /^[a-zA-Z0-9-]+$/.test(entry.name.slice(GC_PREFIX.length))
          const kind: CacheKind | undefined = media
            ? (/^media-[a-zA-Z0-9-]+$/.test(entry.name) ? 'media' : undefined)
            : /^kkkkkk-10086-debug-[a-zA-Z0-9-]+$/.test(entry.name)
              ? 'debug'
              : /^kkkkkk-10086-(?:ktr|render)-[a-zA-Z0-9-]+$/.test(entry.name) ? 'render' : undefined
          if (legacy && (!entry.isFile() || !entry.name.endsWith('.html'))) continue
          if (!legacy && (!entry.isDirectory() || (!kind && !tomb))) continue
          try {
            assertSafeSync(path)
            const stat = await lstat(path)
            const candidate: Candidate = { path, kind: kind ?? 'render', legacy, tomb, files: legacy ? 1 : 0, bytes: legacy ? stat.size : 0, modified: stat.mtimeMs, protected: false }
            if (!legacy) {
              try {
                const metadata = await readJson(join(path, META))
                if (!metadataValid(metadata) || (kind && metadata.kind !== kind)) continue
                candidate.metadata = metadata
                candidate.kind = metadata.kind
                candidate.modified = Math.max(metadata.createdAt, metadata.releasedAt ?? 0)
              } catch (error) {
                // Dedicated media-* directories can be left behind if a
                // process dies between mkdir and its first metadata write.
                // Only a missing record permits orphan collection; malformed
                // or linked metadata remains protected.
                if (!missing(error)) continue
                if (media) candidate.kind = 'media'
              }
              if (tomb) {
                if (await this.claimProtected(path)) continue
              }
              yield * this.inspect(candidate)
            }
            yield { candidate }
          } catch (error) {
            if (!missing(error)) this.warn('CACHE_SCAN_ENTRY')
          }
        }
      } catch (error) {
        if (!missing(error)) this.warn('CACHE_SCAN_ROOT')
      }
    }
  }

  private expired (candidate: Candidate): boolean {
    const now = this.now()
    if (candidate.legacy) return now - candidate.modified >= this.policy.legacyTtlMs
    const expiry = candidate.metadata?.expiresAt
    if (expiry !== undefined) return now >= expiry
    const ttl = candidate.kind === 'debug' ? this.policy.debugTtlMs : this.policy.orphanTtlMs
    return now - candidate.modified >= ttl
  }

  private async runSweep (): Promise<SweepResult> {
    const result: SweepResult = { scanned: 0, deleted: 0, bytes: 0, failed: 0 }
    if (this.closed || this.policy.scanLimit < 1 || this.policy.deleteLimit < 1) return result
    // A scope's finally releases only once. Keep failed releases in a bounded
    // per-round retry queue, otherwise a live PID would protect them forever.
    const retryLimit = Math.max(1, Math.floor(this.policy.scanLimit / 4))
    const unlocks: Array<[string, LockHandle]> = []
    for (const entry of this.pendingUnlocks) {
      unlocks.push(entry)
      if (unlocks.length >= retryLimit) break
    }
    for (const [path] of unlocks) {
      result.scanned++
      await this.finishUnlock(path)
      const remaining = this.pendingUnlocks.get(path)
      if (remaining) {
        result.failed++
        this.pendingUnlocks.delete(path)
        this.pendingUnlocks.set(path, remaining)
      }
    }
    const retries: Array<[string, () => Promise<void>]> = []
    const releaseLimit = Math.min(retryLimit, this.policy.scanLimit - result.scanned)
    if (releaseLimit > 0) {
      for (const entry of this.pendingReleases) {
        retries.push(entry)
        if (retries.length >= releaseLimit) break
      }
    }
    for (const [lease, retry] of retries) {
      result.scanned++
      try { await retry() } catch { this.warn('CACHE_RELEASE_RETRY') }
      const remaining = this.pendingReleases.get(lease)
      if (remaining) {
        result.failed++
        // Rotate failed jobs so a persistent permission error cannot starve
        // later releases when the retry queue exceeds one round's budget.
        this.pendingReleases.delete(lease)
        this.pendingReleases.set(lease, remaining)
      }
    }
    if (!this.scanner) { this.passTotals = emptyTotals(); this.scanner = this.scan() }
    // Reserve part of the scan budget for the claim's final lease recheck.
    const inventoryLimit = Math.min(this.policy.scanLimit - result.scanned, Math.max(1, Math.floor(this.policy.scanLimit / 2)))
    for (let count = 0; count < inventoryLimit; count++) {
      const step = await this.scanner.next()
      if (step.done) { this.completedTotals = this.passTotals; this.scanner = undefined; break }
      result.scanned++
      const candidate = step.value.candidate
      if (candidate) {
        const total = candidate.kind === 'debug' ? this.passTotals.debug : this.passTotals.general
        total.files += candidate.files
        total.bytes += candidate.bytes
        // Retain only a fixed window of candidates. Bucket totals preserve
        // capacity pressure across a directory containing tens of thousands of
        // workspaces; subsequent passes bring evicted candidates back around.
        if (!this.inventory.has(candidate.path) && this.inventory.size >= MAX_INVENTORY) {
          const first = this.inventory.keys().next().value as string | undefined
          if (first) this.inventory.delete(first)
        }
        this.inventory.set(candidate.path, candidate)
      }
    }
    const ordered = [...this.inventory.values()].sort((a, b) => a.modified - b.modified)
    const totals = (debug: boolean): { files: number, bytes: number } => ordered.filter(item => (item.kind === 'debug') === debug)
      .reduce((sum, item) => ({ files: sum.files + item.files, bytes: sum.bytes + item.bytes }), { files: 0, bytes: 0 })
    const merge = (partial: Totals, complete: Totals, window: Totals): Totals => ({
      files: Math.max(partial.files, complete.files, window.files), bytes: Math.max(partial.bytes, complete.bytes, window.bytes)
    })
    const general = merge(this.passTotals.general, this.completedTotals.general, totals(false))
    const debug = merge(this.passTotals.debug, this.completedTotals.debug, totals(true))
    for (const candidate of ordered) {
      if (this.deletions.size >= Math.min(this.policy.deleteLimit, MAX_INVENTORY)) break
      if (candidate.protected) continue
      const total = candidate.kind === 'debug' ? debug : general
      const maxFiles = candidate.kind === 'debug' ? this.policy.debugMaxFiles : this.policy.maxFiles
      const maxBytes = candidate.kind === 'debug' ? this.policy.debugMaxBytes : this.policy.maxBytes
      const capacity = (total.files > maxFiles || total.bytes > maxBytes) && this.now() - candidate.modified >= this.policy.minAgeMs
      if (!this.expired(candidate) && !capacity) continue
      try {
        let target: string | undefined
        if (candidate.legacy) {
          // A single known legacy HTML file has no leasing API. Rename to an
          // owned name before deleting, and never touch sibling non-HTML files.
          assertSafeSync(candidate.path)
          const stat = await lstat(candidate.path)
          const minimumAge = capacity ? this.policy.minAgeMs : this.policy.legacyTtlMs
          if (!stat.isFile() || this.now() - stat.mtimeMs < minimumAge) continue
          target = join(this.htmlRoot, `${GC_PREFIX}${randomUUID()}`)
          await mkdir(target)
          await this.putMetadata(target, { ...this.lease(), kind: 'render', createdAt: stat.mtimeMs, expiresAt: 0 })
          await this.acquireClaim(target)
          this.ownedLocks.delete(join(target, CLAIM))
          this.deletions.set(target, { iterator: this.walkDelete(target) })
          await rename(candidate.path, join(target, 'legacy.html'))
        } else target = await this.claim(candidate.path, candidate, capacity, result)
        if (!target) continue
        this.deletions.set(target, { iterator: this.walkDelete(target) })
        this.inventory.delete(candidate.path)
        total.files -= candidate.files
        total.bytes -= candidate.bytes
        const bucket = candidate.kind === 'debug' ? 'debug' : 'general'
        for (const snapshot of new Set([this.passTotals, this.completedTotals])) {
          snapshot[bucket].files = Math.max(0, snapshot[bucket].files - candidate.files)
          snapshot[bucket].bytes = Math.max(0, snapshot[bucket].bytes - candidate.bytes)
        }
      } catch (error) {
        if (missing(error)) this.inventory.delete(candidate.path)
        else { result.failed++; this.warn('CACHE_CLAIM') }
      }
    }
    let operations = 0
    for (const [path, job] of this.deletions) {
      while (operations < this.policy.deleteLimit) {
        let step: DeleteStep | undefined
        try {
          const next = job.next ? { value: job.next, done: false } : await job.iterator.next()
          if (next.done) { this.deletions.delete(path); break }
          step = next.value!
          // An oversized single file is one unlink, not an unbounded tree. Let
          // it exceed the byte budget only when this round deleted no files.
          if (result.bytes + step.bytes > this.policy.deleteByteLimit && result.deleted > 0) { job.next = step; break }
          await this.removeStep(step)
          job.next = undefined
          operations++
          if (!step.directory) { result.deleted++; result.bytes += step.bytes }
          if (result.bytes >= this.policy.deleteByteLimit) break
        } catch (error) {
          if (!missing(error)) {
            result.failed++
            this.warn('CACHE_DELETE')
            if (step) job.next = step
            else job.iterator = this.walkDelete(path)
          } else job.next = undefined
          break
        }
      }
      if (operations >= this.policy.deleteLimit || result.bytes >= this.policy.deleteByteLimit) break
    }
    result.more = this.scanner !== undefined || this.deletions.size > 0 || this.pendingReleases.size > 0 || this.pendingUnlocks.size > 0
    return result
  }

  sweep (): Promise<SweepResult> {
    this.running ??= this.runSweep().finally(() => { this.running = undefined })
    return this.running
  }

  async close (): Promise<void> {
    this.closed = true
    await this.running
    await this.scanner?.return(undefined)
    this.scanner = undefined
    for (const job of this.deletions.values()) await job.iterator.return(undefined)
    this.deletions.clear()
  }
}
