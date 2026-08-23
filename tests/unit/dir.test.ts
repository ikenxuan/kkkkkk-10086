import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AppsPath,
  ClientPath,
  CodePath,
  DataPath,
  DefaultConfigPath,
  PluginPath,
  ResourcePath,
  UserConfigPath
} from '../../src/dir.js'

const repositoryRoot = normalize(join(dirname(fileURLToPath(import.meta.url)), '..', '..'))
const originalCwd = process.cwd()

afterEach(() => {
  process.chdir(originalCwd)
  vi.resetModules()
})

describe('plugin runtime paths', () => {
  it('resolves source paths from the repository root', () => {
    expect(normalize(CodePath)).toBe(join(repositoryRoot, 'src'))
    expect(normalize(PluginPath)).toBe(repositoryRoot)
    expect(normalize(AppsPath)).toBe(join(repositoryRoot, 'src', 'apps'))
  })

  it('keeps resources, configuration, and data outside the code directory', () => {
    expect(normalize(ResourcePath)).toBe(join(repositoryRoot, 'resources'))
    expect(normalize(DefaultConfigPath)).toBe(join(repositoryRoot, 'config', 'default_config'))
    expect(normalize(UserConfigPath)).toBe(join(repositoryRoot, 'config', 'config'))
    expect(normalize(DataPath)).toBe(join(repositoryRoot, 'data'))
    expect(dirname(normalize(DataPath))).toBe(repositoryRoot)
    expect(existsSync(ResourcePath)).toBe(true)
    expect(existsSync(DefaultConfigPath)).toBe(true)
  })

  it('uses the current working directory as the Yunzai client root', () => {
    expect(normalize(ClientPath)).toBe(normalize(process.cwd()))
  })

  it('imports host modules from the client lib directory', async () => {
    const clientRoot = await mkdtemp(join(tmpdir(), 'kkkkkk-host-'))
    const fixtureDir = join(clientRoot, 'lib', 'fixture')
    await mkdir(fixtureDir, { recursive: true })
    await writeFile(join(clientRoot, 'package.json'), '{"type":"module"}\n')
    await writeFile(join(fixtureDir, 'host.js'), "export const loadedFrom = 'client-lib'\n")

    try {
      process.chdir(clientRoot)
      vi.resetModules()
      const { importHost } = await import('../../src/runtime/host/import-host.js')
      const fixture = await importHost<{ loadedFrom: string }>('lib', 'fixture', 'host.js')

      expect(fixture.loadedFrom).toBe('client-lib')
    } finally {
      process.chdir(originalCwd)
      await rm(clientRoot, { recursive: true, force: true })
    }
  })
})
