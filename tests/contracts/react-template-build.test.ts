import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createTemplateRegistrySource } from '../../src/module/tooling/react-template/registry-generator.js'

interface PackageJson {
  files?: string[]
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const root = resolve(import.meta.dirname, '..', '..')
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as PackageJson
const registryBuildConfig = readFileSync(resolve(root, 'vite.template.config.ts'), 'utf8')
const defaultLayoutSource = readFileSync(resolve(root, 'ktr', 'template', 'components', 'DefaultLayout.tsx'), 'utf8')

const readOptionalFile = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : ''

const isIgnoredByGit = (path: string): boolean => spawnSync(
  'git',
  ['check-ignore', '--no-index', '--quiet', path],
  { cwd: root }
).status === 0

describe('React template distribution contract', () => {
  it('ignores only root-level generated build directories and keeps tests trackable', () => {
    expect(isIgnoredByGit('lib/__gitignore_contract__.js')).toBe(true)
    expect(isIgnoredByGit('.generated/__gitignore_contract__.ts')).toBe(true)
    expect(isIgnoredByGit('.ktr/standalone-entry.ts')).toBe(true)

    expect(isIgnoredByGit('tests/contracts/__gitignore_contract__.test.ts')).toBe(false)
    expect(isIgnoredByGit('src/lib/__gitignore_contract__.ts')).toBe(false)
    expect(isIgnoredByGit('src/.generated/__gitignore_contract__.ts')).toBe(false)
    expect(isIgnoredByGit('src/.ktr/__gitignore_contract__.ts')).toBe(false)
  })

  it('has deterministic sync, typecheck and production build commands', () => {
    expect(packageJson.scripts?.['template:sync']).toBeTruthy()
    expect(packageJson.scripts?.['typecheck:template']).toBeTruthy()
    expect(packageJson.scripts?.['build:template']).toMatch(
      /vite\.template\.config\.ts.*vite\.template-style\.config\.ts/
    )
    expect(packageJson.scripts?.build).toContain('build:template')
  })

  it('restores and watches all template artifacts in build:watch', () => {
    const buildWatch = packageJson.scripts?.['build:watch'] ?? ''

    expect(buildWatch.indexOf('pnpm build:template')).toBeGreaterThan(buildWatch.indexOf('rimraf lib'))
    expect(buildWatch.indexOf('pnpm build:template')).toBeLessThan(buildWatch.indexOf('concurrently'))
    expect(buildWatch).toMatch(/vite build --watch --config vite\.template\.config\.ts/)
    expect(buildWatch).toMatch(/vite build --watch --config vite\.template-style\.config\.ts/)
  })

  it('cleans stale template-owned outputs before every standalone template build', () => {
    const cleanScript = resolve(root, 'scripts', 'clean-template-build.mjs')
    expect(existsSync(cleanScript)).toBe(true)

    const buildTemplate = packageJson.scripts?.['build:template'] ?? ''
    expect(packageJson.scripts?.['clean:template']).toContain('clean-template-build.mjs')
    expect(buildTemplate.indexOf('pnpm clean:template')).toBe(0)

    const temporaryRoot = mkdtempSync(join(tmpdir(), 'kkkkkk-template-clean-'))
    const staleFiles = [
      'lib/template-registry.js',
      'lib/template-registry.js.map',
      'lib/template-style.css',
      'lib/template-style.css.map',
      'lib/template-chunks/old-hash.js',
      'lib/template-assets/old-hash.woff2'
    ]
    const unrelatedFile = resolve(temporaryRoot, 'lib/module/keep.js')

    try {
      for (const file of staleFiles) {
        const absolute = resolve(temporaryRoot, file)
        mkdirSync(dirname(absolute), { recursive: true })
        writeFileSync(absolute, 'stale')
      }
      mkdirSync(dirname(unrelatedFile), { recursive: true })
      writeFileSync(unrelatedFile, 'keep')

      execFileSync(process.execPath, [
        '--experimental-strip-types',
        cleanScript,
        '--root',
        temporaryRoot
      ])

      for (const file of staleFiles) expect(existsSync(resolve(temporaryRoot, file))).toBe(false)
      expect(readFileSync(unrelatedFile, 'utf8')).toBe('keep')
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true })
    }
  })

  it('keeps framework scale and stacking-context ownership in the SSR wrapper', () => {
    expect(defaultLayoutSource).not.toContain('zoom: scale')
    expect(defaultLayoutSource).not.toContain("isolation: 'isolate'")
    expect(defaultLayoutSource).not.toContain('const { scale = 1')
  })

  it('keeps CSS and Tailwind out of the SSR registry entry', () => {
    const registrySource = createTemplateRegistrySource([{
      route: 'section/card',
      file: resolve(root, 'ktr', 'template', 'section', 'card', 'index.tsx')
    }], resolve(root, '.generated'))

    expect(registrySource).not.toContain('style.css')
    expect(registrySource).not.toContain('tailwind')
    expect(registryBuildConfig).not.toContain('@tailwindcss/vite')
    expect(registryBuildConfig).not.toContain('tailwindcss()')
  })

  it('builds the poster stylesheet through a dedicated Vite config', () => {
    const styleConfigPath = resolve(root, 'vite.template-style.config.ts')
    const styleBuildConfig = readOptionalFile(styleConfigPath)

    expect(existsSync(styleConfigPath)).toBe(true)
    expect(styleBuildConfig).toContain('@tailwindcss/vite')
    expect(styleBuildConfig).toContain('ktr/template/style.css')
    expect(styleBuildConfig).toContain('template-style.css')
    expect(styleBuildConfig).toContain('emptyOutDir: false')
  })

  it('declares only framework-neutral React rendering dependencies', () => {
    expect(packageJson.dependencies?.react).toBeTruthy()
    expect(packageJson.dependencies?.['react-dom']).toBeTruthy()
    expect(packageJson.dependencies?.['node-karin']).toBeUndefined()
    expect(packageJson.dependencies?.vite).toBeUndefined()
    expect(packageJson.dependencies?.tailwindcss).toBeUndefined()
    expect(packageJson.devDependencies?.vite).toBeTruthy()
    expect(packageJson.devDependencies?.tailwindcss).toBeTruthy()
  })

  it('ships all runtime inputs without requiring TSX compilation after install', () => {
    expect(packageJson.files).toEqual(expect.arrayContaining([
      'lib',
      'resources',
      'THIRD_PARTY_NOTICES.md'
    ]))
    expect(existsSync(resolve(root, 'vite.template.config.ts'))).toBe(true)
    expect(existsSync(resolve(root, 'vite.template-style.config.ts'))).toBe(true)
    expect(existsSync(resolve(root, 'tsconfig.template.json'))).toBe(true)
    expect(existsSync(resolve(root, 'scripts', 'generate-template-registry.mjs'))).toBe(true)
    expect(existsSync(resolve(root, 'ktr', 'template', 'other', 'help', 'index.tsx'))).toBe(true)
  })
})
