import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { syncTemplateRegistry } from '../../src/module/tooling/react-template/registry-generator.js'

interface PackageJson {
  scripts?: Record<string, string>
  devDependencies?: Record<string, string>
}

const repositoryRoot = resolve(import.meta.dirname, '..', '..')
const registryCli = join(repositoryRoot, 'scripts', 'generate-template-registry.mjs')
const cleanerCli = join(repositoryRoot, 'scripts', 'clean-template-build.mjs')
const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, 'package.json'), 'utf8')
) as PackageJson
const temporaryRoots: string[] = []

const createTemporaryRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'kkkkkk-template-cli-'))
  temporaryRoots.push(root)
  return root
}

const writeTemplateEntry = (root: string, route: string): void => {
  const entry = join(root, 'ktr', 'template', ...route.split('/'), 'index.tsx')
  mkdirSync(dirname(entry), { recursive: true })
  writeFileSync(entry, 'export default {}\n', 'utf8')
}

const runCli = (script: string, args: string[] = []) => spawnSync(
  process.execPath,
  ['--experimental-strip-types', script, ...args],
  { cwd: repositoryRoot, encoding: 'utf8' }
)

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('template tooling CLI contract', () => {
  it('runs every TypeScript-backed template tool through Node 22 type stripping', () => {
    expect(packageJson.scripts?.['template:sync']).toBe(
      'node --experimental-strip-types scripts/generate-template-registry.mjs'
    )
    expect(packageJson.scripts?.['template:check']).toBe(
      'node --experimental-strip-types scripts/generate-template-registry.mjs --check'
    )
    expect(packageJson.scripts?.['clean:template']).toBe(
      'node --experimental-strip-types scripts/clean-template-build.mjs'
    )
    expect(packageJson.scripts?.lint).toContain('scripts')
    expect(packageJson.scripts?.fix).toContain('scripts')
  })

  it('declares the Yunzai raw bridge compiler used by isolated tests', () => {
    expect(packageJson.devDependencies?.['art-template']).toBe('4.13.2')
  })

  it('checks the explicitly selected root and reports its generated file', () => {
    const root = createTemporaryRoot()
    writeTemplateEntry(root, 'section/card')
    const synced = syncTemplateRegistry(root)

    const current = runCli(registryCli, ['--check', '--root', root])

    expect(current.status).toBe(0)
    expect(current.stdout).toContain(synced.outputFile)

    writeFileSync(synced.outputFile, 'stale\n', 'utf8')
    const stale = runCli(registryCli, ['--check', '--root', root])

    expect(stale.status).toBe(1)
    expect(stale.stderr).toContain(synced.outputFile)
    expect(readFileSync(synced.outputFile, 'utf8')).toBe('stale\n')
  })

  it('rejects a missing root argument instead of silently using the repository', () => {
    const registry = runCli(registryCli, ['--check', '--root'])
    const cleaner = runCli(cleanerCli, ['--root'])

    expect(registry.status).not.toBe(0)
    expect(registry.stderr).toContain('--root 需要一个目录参数')
    expect(cleaner.status).not.toBe(0)
    expect(cleaner.stderr).toContain('--root 需要一个目录参数')
  })

  it('rejects option tokens as root values, unknown options, and duplicate roots', () => {
    const root = createTemporaryRoot()
    writeTemplateEntry(root, 'section/card')

    const optionAsValue = runCli(registryCli, ['--root', '--check'])
    const unknown = runCli(cleanerCli, ['--root', root, '--unknown'])
    const duplicate = runCli(registryCli, ['--root', root, '--root', root])

    expect(optionAsValue.status).not.toBe(0)
    expect(optionAsValue.stderr).toContain('--root 需要一个目录参数')
    expect(unknown.status).not.toBe(0)
    expect(unknown.stderr).toContain('未知参数：--unknown')
    expect(duplicate.status).not.toBe(0)
    expect(duplicate.stderr).toContain('--root 不能重复')
  })
})
