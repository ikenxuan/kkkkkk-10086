import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { CacheManager } from '../../src/module/utils/cache/workspace.js'

it('protects a real other process and recovers its abandoned workspace after exit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kkkkkk-process-lease-'))
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    windowsHide: true, stdio: 'ignore'
  })
  await once(child, 'spawn')
  let now = Date.now()
  const roots = { htmlRoot: join(root, 'html'), mediaRoot: join(root, 'media'), now: () => now }
  const producer = new CacheManager({ ...roots, pid: child.pid!, policy: { orphanTtlMs: 1 } })
  const reaper = new CacheManager({ ...roots, policy: { orphanTtlMs: 1 } })
  try {
    const workspace = await producer.createWorkspace('media')
    const file = join(workspace.path, 'shared.mp4')
    await writeFile(file, 'synthetic media')
    now += 1000
    for (let i = 0; i < 3; i++) await reaper.sweep()
    await expect(access(file)).resolves.toBeUndefined()
    const exited = once(child, 'exit')
    child.kill()
    await exited
    for (let i = 0; i < 6; i++) await reaper.sweep()
    await expect(access(file)).rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill()
      await exited
    }
    await Promise.all([producer.close(), reaper.close()])
    await rm(root, { recursive: true, force: true })
  }
})
