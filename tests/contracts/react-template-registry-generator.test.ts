import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..', '..')
const registryCli = resolve(root, 'scripts', 'generate-template-registry.mjs')
const temporaryRoots: string[] = []

const writeTemplateEntry = (temporaryRoot: string, route: string): void => {
  const entry = join(temporaryRoot, 'ktr', 'template', ...route.split('/'), 'index.tsx')
  mkdirSync(dirname(entry), { recursive: true })
  writeFileSync(entry, 'export default {}\n', 'utf8')
}

afterEach(() => {
  for (const temporaryRoot of temporaryRoots.splice(0)) {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
})

describe('React template registry generator', () => {
  it('excludes component and underscore-prefixed directories from public routes', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'kkk-template-registry-'))
    temporaryRoots.push(temporaryRoot)

    writeTemplateEntry(temporaryRoot, 'section/card')
    writeTemplateEntry(temporaryRoot, 'section/card/components/internal')
    writeTemplateEntry(temporaryRoot, '_shared/internal')

    execFileSync(process.execPath, [
      '--experimental-strip-types',
      registryCli,
      '--root',
      temporaryRoot
    ], { cwd: root, stdio: 'pipe' })

    const registry = readFileSync(join(temporaryRoot, '.generated', 'template-registry.ts'), 'utf8')
    expect(registry).toContain('"section/card"')
    expect(registry).not.toContain('section/card/components/internal')
    expect(registry).not.toContain('_shared/internal')
  })
})
