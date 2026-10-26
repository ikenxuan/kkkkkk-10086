import { readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { access, mkdir, mkdtemp, readdir, rm, symlink, unlink, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CacheManager } from '../../src/module/utils/cache/workspace.js'
import type { CachePolicy } from '../../src/module/utils/cache/workspace.js'

const failures = vi.hoisted(() => ({ unlinkName: '', metadataWrite: false, unlockKind: '', leaseWrite: false }))
vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  return { ...actual, writeFile: async (...args: Parameters<typeof actual.writeFile>): Promise<void> => {
    if (failures.leaseWrite && String(args[0]).replaceAll('\\', '/').includes('/.leases/')) {
      failures.leaseWrite = false
      await actual.writeFile(args[0], '{', args[2])
      throw Object.assign(new Error('lease allocation failed'), { code: 'ENOSPC' })
    }
    await actual.writeFile(...args)
  }, rename: async (...paths: Parameters<typeof actual.rename>): Promise<void> => {
    if (failures.metadataWrite && String(paths[1]).endsWith('.kkk-cache.json')) {
      failures.metadataWrite = false
      throw Object.assign(new Error('transient metadata failure'), { code: 'EACCES' })
    }
    await actual.rename(...paths)
  }, unlink: async (path: Parameters<typeof actual.unlink>[0]): Promise<void> => {
    if (failures.unlinkName && String(path).endsWith(failures.unlinkName) &&
      (!failures.unlockKind || String(path).replaceAll('\\', '/').includes(`/${failures.unlockKind}/`))) {
      failures.unlinkName = ''
      throw Object.assign(new Error('transient permission failure'), { code: 'EACCES' })
    }
    await actual.unlink(path)
  } }
})

let root: string
let time: number
const managers: CacheManager[] = []
const exists = async (path: string): Promise<boolean> => access(path).then(() => true, () => false)
const hour = 3_600_000

const manager = (policy: Partial<CachePolicy> = {}, identity: { host?: string, pid?: number } = {}): CacheManager => {
  const instance = new CacheManager({
    htmlRoot: join(root, 'temp', 'html'),
    mediaRoot: join(root, 'temp', 'kkkkkk-10086', '.cache'),
    now: () => time,
    host: 'test-host',
    pid: 100,
    isProcessAlive: pid => pid === 100 || pid === 200,
    policy,
    ...identity
  })
  managers.push(instance)
  return instance
}

const rounds = async (instance: CacheManager, count = 12): Promise<void> => {
  for (let i = 0; i < count; i++) await instance.sweep()
}

beforeEach(async () => {
  failures.unlinkName = ''
  failures.metadataWrite = false
  failures.unlockKind = ''
  failures.leaseWrite = false
  root = await mkdtemp(join(tmpdir(), 'kkk-cache-test-'))
  time = Date.now()
})

afterEach(async () => {
  await Promise.all(managers.splice(0).map(instance => instance.close()))
  await rm(root, { recursive: true, force: true })
})

describe('cache workspaces', () => {
  it('isolates simultaneous renders and waits for concurrent cleanup calls', async () => {
    const instance = manager()
    const [first, second] = await Promise.all([instance.createWorkspace('render'), instance.createWorkspace('render')])
    await writeFile(join(first.path, 'one.html'), 'one')
    await writeFile(join(second.path, 'two.html'), 'two')
    expect(first.path).not.toBe(second.path)
    await Promise.all([first.cleanup(), first.cleanup()])
    expect(await exists(first.path)).toBe(false)
    expect(await exists(second.path)).toBe(true)
    await second.cleanup()
  })

  it('retains media until the last HTTP reader releases and then renews its TTL', async () => {
    const instance = manager({ mediaTtlMs: 100 })
    const workspace = await instance.createWorkspace('media')
    const file = join(workspace.path, 'preview.mp4')
    await writeFile(file, 'video')
    const releaseReader = await instance.retainFile(file)
    await workspace.release()
    time += hour
    await rounds(instance)
    expect(await exists(file)).toBe(true)
    await releaseReader()
    time += 99
    await rounds(instance)
    expect(await exists(file)).toBe(true)
    time += 2
    await rounds(instance)
    expect(await exists(file)).toBe(false)
  })

  it.each([{ host: 'test-host', pid: 200 }, { host: 'other-host', pid: 300 }])(
    'protects active disk leases from $host/$pid', async identity => {
      const producer = manager({}, identity)
      const workspace = await producer.createWorkspace('render')
      await writeFile(join(workspace.path, 'page.html'), 'active')
      time += 72 * hour
      await rounds(manager())
      expect(await exists(workspace.path)).toBe(true)
    }
  )

  it('collects dead process orphans only after their retention window', async () => {
    const producer = manager({}, { pid: 300 })
    const workspace = await producer.createWorkspace('render')
    await writeFile(join(workspace.path, 'page.html'), 'orphan')
    const reaper = manager()
    time += 23 * hour
    await rounds(reaper)
    expect(await exists(workspace.path)).toBe(true)
    time += 2 * hour
    await rounds(reaper)
    expect(await exists(workspace.path)).toBe(false)
  })

  it('recognizes owned media across manager restarts and rejects paths outside workspaces', async () => {
    const instance = manager()
    const own = await instance.createWorkspace('media')
    const other = await manager().createWorkspace('media')
    expect(instance.isManaged(join(own.path, 'x.mp4'))).toBe(true)
    expect(instance.isManaged(join(other.path, 'x.mp4'))).toBe(true)
    expect(instance.isManaged(join(own.path, '..', '..', 'outside.mp4'))).toBe(false)
    expect(instance.isManaged(`${own.path}-suffix/file.mp4`)).toBe(false)
    await (await instance.retainFile(join(other.path, 'missing.mp4')))()
    await mkdir(join(own.path, '.gc'))
    await writeFile(join(own.path, 'x.mp4'), 'x')
    await expect(instance.retainFile(join(own.path, 'x.mp4'))).rejects.toThrow()
  })

  it('refuses linked roots and leaves linked descendants and their targets intact', async () => {
    const external = join(root, 'external')
    await mkdir(external)
    await writeFile(join(external, 'keep'), 'keep')
    const linkedRoot = join(root, 'linked')
    await symlink(external, linkedRoot, 'junction')
    const instance = new CacheManager({ htmlRoot: linkedRoot, mediaRoot: join(root, 'media') })
    managers.push(instance)
    await expect(instance.createWorkspace('render')).rejects.toThrow()
    const safe = manager()
    const workspace = await safe.createWorkspace('render')
    await symlink(external, join(workspace.path, 'link'), 'junction')
    await expect(workspace.cleanup()).rejects.toThrow()
    expect(await exists(join(external, 'keep'))).toBe(true)
    // A failed cleanup must remain retryable after the obstruction is removed.
    await unlink(join(workspace.path, 'link'))
    await workspace.cleanup()
    expect(await exists(workspace.path)).toBe(false)
  })

  it('cleans only old legacy HTML and known old render directories', async () => {
    const legacy = join(root, 'temp', 'html', 'kkkkkk-10086')
    const oldRender = join(dirname(legacy), 'kkkkkk-10086-render-abcdef')
    await mkdir(legacy, { recursive: true })
    await mkdir(oldRender)
    for (const file of [join(legacy, 'old.html'), join(legacy, 'keep.txt'), join(oldRender, 'index.html')]) {
      await writeFile(file, 'legacy')
      await utimes(file, new Date(time - 8 * 24 * hour), new Date(time - 8 * 24 * hour))
    }
    await utimes(oldRender, new Date(time - 8 * 24 * hour), new Date(time - 8 * 24 * hour))
    await rounds(manager())
    expect(await exists(join(legacy, 'old.html'))).toBe(false)
    expect(await exists(join(legacy, 'keep.txt'))).toBe(true)
    expect(await exists(oldRender)).toBe(false)
  })

  it('makes progress across sweeps without exceeding scan or delete budgets', async () => {
    const instance = manager({ scanLimit: 4, deleteLimit: 2, deleteByteLimit: 1024, mediaTtlMs: 1 })
    const workspace = await instance.createWorkspace('media')
    await mkdir(join(workspace.path, 'nested'))
    for (let i = 0; i < 9; i++) await writeFile(join(workspace.path, 'nested', `${i}`), 'x'.repeat(600))
    await workspace.release()
    time += 100
    for (let i = 0; i < 60; i++) {
      const stats = await instance.sweep()
      expect(stats.scanned).toBeLessThanOrEqual(4)
      expect(stats.deleted).toBeLessThanOrEqual(2)
      expect(stats.bytes).toBeLessThanOrEqual(1024)
    }
    expect(await exists(workspace.path)).toBe(false)
    expect((await readdir(dirname(workspace.path))).filter(name => name.startsWith('media-'))).toEqual([])
  })

  it('evicts released old media over capacity without evicting a live workspace', async () => {
    const instance = manager({ maxFiles: 1, maxBytes: 100, mediaTtlMs: 100 * hour, minAgeMs: hour })
    const first = await instance.createWorkspace('media')
    await writeFile(join(first.path, 'a'), '1111')
    await first.release()
    time += 2 * hour
    const active = await instance.createWorkspace('media')
    await writeFile(join(active.path, 'b'), '2222')
    await rounds(instance)
    expect(await exists(first.path)).toBe(false)
    expect(await exists(join(active.path, 'b'))).toBe(true)
  })

  it('eventually collects a flat workspace larger than the scan budget', async () => {
    const instance = manager({ scanLimit: 4, deleteLimit: 3, mediaTtlMs: 1 })
    const workspace = await instance.createWorkspace('media')
    for (let i = 0; i < 20; i++) await writeFile(join(workspace.path, `file-${i}`), 'payload')
    await workspace.release()
    time += 100
    await rounds(instance, 150)
    expect(await exists(workspace.path)).toBe(false)
  })

  it('retains debug captures after cleanup and expires them after their TTL', async () => {
    const instance = manager({ debugTtlMs: 100 })
    const workspace = await instance.createWorkspace('debug')
    await writeFile(join(workspace.path, 'page.html'), 'debug')
    await workspace.cleanup()
    expect(await exists(workspace.path)).toBe(true)
    time += 101
    await rounds(instance)
    expect(await exists(workspace.path)).toBe(false)
  })

  it.each(['dead', 'missing'])('recovers an abandoned .gc claim with %s owner', async owner => {
    const instance = manager({ mediaTtlMs: 1 })
    const workspace = await instance.createWorkspace('media')
    await writeFile(join(workspace.path, 'file'), 'orphan')
    await workspace.release()
    await mkdir(join(workspace.path, '.gc'))
    if (owner === 'dead') await writeFile(join(workspace.path, '.gc', 'owner.json'), JSON.stringify({ version: 1, host: 'test-host', pid: 300, nonce: 'dead-owner-123' }))
    time += 25 * hour
    await rounds(instance)
    expect(await exists(workspace.path)).toBe(false)
  })

  it('collects nested legacy HTML without deleting neighboring files', async () => {
    const directory = join(root, 'temp', 'html', 'kkkkkk-10086', 'react', 'other', 'help')
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'old.html'), 'legacy')
    await writeFile(join(directory, 'keep.json'), 'private')
    await utimes(join(directory, 'old.html'), new Date(time - 8 * 24 * hour), new Date(time - 8 * 24 * hour))
    await rounds(manager())
    expect(await exists(join(directory, 'old.html'))).toBe(false)
    expect(await exists(join(directory, 'keep.json'))).toBe(true)
  })

  it('retries a failed unlink in a claimed workspace on the next sweep', async () => {
    const instance = manager({ mediaTtlMs: 1 })
    const workspace = await instance.createWorkspace('media')
    await writeFile(join(workspace.path, 'retry.payload'), 'retry')
    await workspace.release()
    time += 100
    failures.unlinkName = 'retry.payload'
    expect((await instance.sweep()).failed).toBe(1)
    const tomb = (await readdir(dirname(workspace.path))).find(name => name.startsWith('.kkkkkk-10086-gc-'))!
    expect(await exists(join(dirname(workspace.path), tomb, 'retry.payload'))).toBe(true)
    await rounds(instance)
    expect(await exists(join(dirname(workspace.path), tomb))).toBe(false)
  })

  it('rechecks a renewed deadline after the inventory snapshot', async () => {
    const producer = manager({ mediaTtlMs: 1 })
    const workspace = await producer.createWorkspace('media')
    await writeFile(join(workspace.path, 'file'), 'preview')
    await workspace.release()
    time += 100
    let renew = true
    const reaper = new CacheManager({
      htmlRoot: join(root, 'temp', 'html'), mediaRoot: dirname(workspace.path),
      host: 'test-host', pid: 100, isProcessAlive: () => false,
      now: () => {
        if (renew) {
          renew = false
          const path = join(workspace.path, '.kkk-cache.json')
          const metadata = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
          writeFileSync(path, JSON.stringify({ ...metadata, releasedAt: time, expiresAt: time + hour }))
        }
        return time
      }
    })
    managers.push(reaper)
    await reaper.sweep()
    expect(await exists(join(workspace.path, 'file'))).toBe(true)
  })

  it('conservatively skips malformed and oversized lease records', async () => {
    const instance = manager({ mediaTtlMs: 1 })
    for (const value of ['{}', 'x'.repeat(5000)]) {
      const workspace = await instance.createWorkspace('media')
      await writeFile(join(workspace.path, 'file'), 'unknown owner')
      await workspace.release()
      await writeFile(join(workspace.path, '.leases', 'unknown.json'), value)
      time += 25 * hour
      await rounds(instance)
      expect(await exists(join(workspace.path, 'file'))).toBe(true)
    }
  })

  it('allows only one oversized file unlink per round so large videos can expire', async () => {
    const instance = manager({ mediaTtlMs: 1, deleteByteLimit: 100 })
    const workspace = await instance.createWorkspace('media')
    await writeFile(join(workspace.path, 'video'), 'x'.repeat(2000))
    await workspace.release()
    time += 100
    for (let i = 0; i < 20; i++) {
      const result = await instance.sweep()
      if (result.bytes > 100) expect(result.deleted).toBe(1)
    }
    expect(await exists(workspace.path)).toBe(false)
  })

  it('hands failed immediate cleanup to the sweeper without another caller cleanup', async () => {
    const instance = manager()
    const workspace = await instance.createWorkspace('render')
    await writeFile(join(workspace.path, 'retry.payload'), 'retry')
    failures.unlinkName = 'retry.payload'
    await expect(workspace.cleanup()).rejects.toThrow('transient')
    const tomb = (await readdir(dirname(workspace.path))).find(name => name.startsWith('.kkkkkk-10086-gc-'))!
    const tombPath = join(dirname(workspace.path), tomb)
    expect(await exists(join(tombPath, '.kkk-cache.json'))).toBe(true)
    expect(await exists(join(tombPath, '.gc', 'owner.json'))).toBe(true)
    await rounds(instance)
    expect(await exists(tombPath)).toBe(false)
  })

  it('recovers a partially deleted media tomb after its reaper process dies', async () => {
    const producer = manager({ mediaTtlMs: 1 })
    const workspace = await producer.createWorkspace('media')
    await writeFile(join(workspace.path, 'first.payload'), 'first')
    await writeFile(join(workspace.path, 'retry.payload'), 'second')
    await workspace.release()
    time += 100
    failures.unlinkName = 'retry.payload'
    await producer.sweep()
    const tomb = (await readdir(dirname(workspace.path))).find(name => name.startsWith('.kkkkkk-10086-gc-'))!
    const tombPath = join(dirname(workspace.path), tomb)
    expect(await exists(join(tombPath, '.kkk-cache.json'))).toBe(true)
    await producer.close()
    time += 25 * hour
    const reaper = new CacheManager({
      htmlRoot: join(root, 'temp', 'html'), mediaRoot: dirname(workspace.path),
      now: () => time, host: 'test-host', pid: 400, isProcessAlive: () => false
    })
    managers.push(reaper)
    await rounds(reaper)
    expect(await exists(tombPath)).toBe(false)
    expect((await readdir(dirname(workspace.path))).filter(name => name.startsWith('.kkkkkk-10086-gc-'))).toEqual([])
  })

  it('preserves the longer retention deadline when consumers release concurrently', async () => {
    const instance = manager({ mediaTtlMs: 1 })
    const workspace = await instance.createWorkspace('media')
    const file = join(workspace.path, 'preview.mp4')
    await writeFile(file, 'preview')
    const releaseReader = await instance.retainFile(file)
    await Promise.all([workspace.release(100_000), releaseReader()])
    time += 100
    await rounds(instance)
    expect(await exists(file)).toBe(true)
  })

  it('coordinates two reapers without touching an unrelated workspace', async () => {
    const producer = manager({ mediaTtlMs: 1 })
    const workspace = await producer.createWorkspace('media')
    await writeFile(join(workspace.path, 'old'), 'old')
    await workspace.release()
    const active = await producer.createWorkspace('media')
    await writeFile(join(active.path, 'live'), 'live')
    time += 100
    const first = manager()
    const second = manager()
    for (let i = 0; i < 12; i++) await Promise.all([first.sweep(), second.sweep()])
    expect(await exists(workspace.path)).toBe(false)
    expect(await exists(join(active.path, 'live'))).toBe(true)
  })

  it('reports pending incremental work and clears the flag after completing a pass', async () => {
    const instance = manager({ scanLimit: 2 })
    const workspace = await instance.createWorkspace('render')
    await writeFile(join(workspace.path, 'active'), 'active')
    expect((await instance.sweep()).more).toBe(true)
    let completed = false
    for (let i = 0; i < 30; i++) {
      const result = await instance.sweep()
      expect(result.scanned).toBeLessThanOrEqual(2)
      if (!result.more) { completed = true; break }
    }
    expect(completed).toBe(true)
    expect(await exists(join(workspace.path, 'active'))).toBe(true)
  })

  it.each(['metadata', 'unlink'])('retries a failed %s release in sweep without another caller release', async failure => {
    const instance = manager({ mediaTtlMs: 1 })
    const workspace = await instance.createWorkspace('media')
    await writeFile(join(workspace.path, 'file'), 'pending release')
    const leaseName = (await readdir(join(workspace.path, '.leases')))[0]!
    if (failure === 'metadata') failures.metadataWrite = true
    else failures.unlinkName = leaseName
    await expect(workspace.release()).resolves.toBeUndefined()
    expect(await exists(join(workspace.path, '.leases', leaseName))).toBe(true)
    await instance.sweep()
    expect(await exists(join(workspace.path, '.leases', leaseName))).toBe(false)
    time += 2
    await rounds(instance)
    expect(await exists(workspace.path)).toBe(false)
  })

  it('reports a repeated release failure for scheduler backoff and retries it later', async () => {
    const instance = manager({ mediaTtlMs: 1, scanLimit: 2 })
    const workspace = await instance.createWorkspace('media')
    const leaseName = (await readdir(join(workspace.path, '.leases')))[0]!
    failures.unlinkName = leaseName
    await workspace.release()
    failures.unlinkName = leaseName
    const failed = await instance.sweep()
    expect(failed.failed).toBe(1)
    expect(failed.more).toBe(true)
    expect(failed.scanned).toBeLessThanOrEqual(2)
    await instance.sweep()
    expect(await exists(join(workspace.path, '.leases', leaseName))).toBe(false)
    time += 2
    await rounds(instance, 40)
    expect(await exists(workspace.path)).toBe(false)
  })

  it('evicts old legacy HTML over capacity before its normal TTL', async () => {
    const directory = join(root, 'temp', 'html', 'kkkkkk-10086')
    await mkdir(directory, { recursive: true })
    for (const name of ['one.html', 'two.html']) {
      await writeFile(join(directory, name), 'legacy')
      await utimes(join(directory, name), new Date(time - 2 * hour), new Date(time - 2 * hour))
    }
    await rounds(manager({ maxFiles: 1 }))
    expect((await readdir(directory)).filter(name => name.endsWith('.html'))).toHaveLength(1)
  })

  it('rechecks the legacy file age before a capacity eviction', async () => {
    const directory = join(root, 'temp', 'html', 'kkkkkk-10086')
    const file = join(directory, 'refreshed.html')
    await mkdir(directory, { recursive: true })
    await writeFile(file, 'recent use')
    await utimes(file, new Date(time - 2 * hour), new Date(time - 2 * hour))
    let refreshed = false
    const reaper = new CacheManager({
      htmlRoot: dirname(directory), mediaRoot: join(root, 'media'), policy: { maxFiles: 0 },
      now: () => {
        if (!refreshed) { refreshed = true; utimesSync(file, new Date(time), new Date(time)) }
        return time
      }
    })
    managers.push(reaper)
    await rounds(reaper)
    expect(await exists(file)).toBe(true)
  })

  it('retries its finished retention unlock before later readers release', async () => {
    const instance = manager({ mediaTtlMs: 1 })
    const workspace = await instance.createWorkspace('media')
    const file = join(workspace.path, 'preview')
    await writeFile(file, 'preview')
    failures.unlinkName = 'owner.json'
    failures.unlockKind = '.retention'
    await workspace.release()
    expect(await exists(join(workspace.path, '.retention'))).toBe(true)
    await instance.sweep()
    expect(await exists(join(workspace.path, '.retention'))).toBe(false)
    const releaseReader = await instance.retainFile(file)
    await releaseReader()
    time += 2
    await rounds(instance)
    expect(await exists(workspace.path)).toBe(false)
  })

  it('retries a cancelled gc claim unlock so later readers are not rejected forever', async () => {
    const instance = manager({ mediaTtlMs: 1 })
    const workspace = await instance.createWorkspace('media')
    const file = join(workspace.path, 'preview')
    await writeFile(file, 'preview')
    const releaseReader = await instance.retainFile(file)
    failures.unlinkName = 'owner.json'
    failures.unlockKind = '.gc'
    await expect(workspace.cleanup()).rejects.toThrow('CACHE_IN_USE')
    expect(await exists(join(workspace.path, '.gc'))).toBe(true)
    await instance.sweep()
    expect(await exists(join(workspace.path, '.gc'))).toBe(false)
    const releaseSecond = await instance.retainFile(file)
    await Promise.all([releaseReader(), releaseSecond()])
    time += 2
    await rounds(instance)
    expect(await exists(workspace.path)).toBe(false)
  })

  it('does not unlock a replacement claim merely because its PID matches', async () => {
    const instance = manager()
    const workspace = await instance.createWorkspace('media')
    failures.unlinkName = 'owner.json'
    failures.unlockKind = '.retention'
    await workspace.release()
    const ownerPath = join(workspace.path, '.retention', 'owner.json')
    const replacement = { version: 1, host: 'test-host', pid: 100, nonce: 'replacement-lock-123' }
    await writeFile(ownerPath, JSON.stringify(replacement))
    await instance.sweep()
    expect(JSON.parse(readFileSync(ownerPath, 'utf8'))).toEqual(replacement)
  })

  it('releases the completed consumer even when cleanup prevalidation is obstructed', async () => {
    const instance = manager()
    const workspace = await instance.createWorkspace('render')
    const external = join(root, 'external')
    await mkdir(external)
    await writeFile(join(external, 'keep'), 'keep')
    const obstruction = join(workspace.path, 'link')
    await symlink(external, obstruction, 'junction')
    await expect(workspace.cleanup()).rejects.toThrow('CACHE_LINK')
    await rounds(instance)
    expect(await exists(workspace.path)).toBe(true)
    expect(await exists(join(external, 'keep'))).toBe(true)
    await unlink(obstruction)
    await rounds(instance)
    expect(await exists(workspace.path)).toBe(false)
    expect(await exists(join(external, 'keep'))).toBe(true)
  })

  it('collects a media creation interrupted before metadata was written after the orphan TTL', async () => {
    const orphan = join(root, 'temp', 'kkkkkk-10086', '.cache', 'media-abandoned')
    await mkdir(orphan, { recursive: true })
    await writeFile(join(orphan, 'partial'), 'interrupted output')
    const instance = manager()
    time += 23 * hour
    await rounds(instance)
    expect(await exists(orphan)).toBe(true)
    time += 2 * hour
    await rounds(instance)
    expect(await exists(orphan)).toBe(false)
  })

  it.each(['metadata', 'lease'])('rolls back a failed %s allocation and preserves the original error', async failure => {
    const instance = manager()
    if (failure === 'metadata') failures.metadataWrite = true
    else failures.leaseWrite = true
    await expect(instance.createWorkspace('media')).rejects.toThrow(failure === 'metadata' ? 'transient metadata failure' : 'lease allocation failed')
    expect(await readdir(join(root, 'temp', 'kkkkkk-10086', '.cache'))).toEqual([])
  })

  it('retries removal of a partially written reader lease without protecting it forever', async () => {
    const instance = manager({ mediaTtlMs: 1 })
    const workspace = await instance.createWorkspace('media')
    const file = join(workspace.path, 'preview')
    await writeFile(file, 'preview')
    failures.leaseWrite = true
    failures.unlinkName = '.json'
    await expect(instance.retainFile(file)).rejects.toThrow('lease allocation failed')
    await workspace.release()
    time += 2
    await rounds(instance)
    expect(await exists(workspace.path)).toBe(false)
  })
})
