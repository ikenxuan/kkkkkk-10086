import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'

const originalCwd = process.cwd()

afterEach(() => {
  process.chdir(originalCwd)
  vi.resetModules()
})

describe('Version package metadata path', () => {
  it('reads BotVersion from the host package when plugin package has another version', async () => {
    const hostRoot = await mkdtemp(join(tmpdir(), 'kkkkkk-version-host-'))
    await writeFile(join(hostRoot, 'package.json'), '{"name":"host","version":"0.0.1"}\n')

    try {
      process.chdir(hostRoot)
      const { default: Version } = await import('../../src/module/utils/Version.js')

      expect(Version.BotVersion).toBe('0.0.1')
      expect(Version.version).toBe('2.36.0')
    } finally {
      process.chdir(originalCwd)
      await rm(hostRoot, { recursive: true, force: true })
    }
  })
})
