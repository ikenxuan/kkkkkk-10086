import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'

const originalCwd = process.cwd()

afterEach(() => {
  process.chdir(originalCwd)
  vi.resetModules()
})

/** 插件自己 package.json 里的版本，避免把版本号写死在断言里 */
const pluginVersion = (): string =>
  JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version

describe('Version package metadata path', () => {
  it('reads BotVersion from the host package when plugin package has another version', async () => {
    const hostRoot = await mkdtemp(join(tmpdir(), 'kkkkkk-version-host-'))
    await writeFile(join(hostRoot, 'package.json'), '{"name":"host","version":"0.0.1"}\n')

    try {
      process.chdir(hostRoot)
      const { default: Version } = await import('../../src/module/utils/Version.js')

      expect(Version.BotVersion).toBe('0.0.1')
      // 不写死版本号：这条用例要证明的是「BotVersion 取宿主的、version 取插件自己的」
      // 两个来源不同，而不是某个具体版本。写死会让每次 release-please 撞版本号都挂一次。
      expect(Version.version).toBe(pluginVersion())
    } finally {
      process.chdir(originalCwd)
      await rm(hostRoot, { recursive: true, force: true })
    }
  })
})
