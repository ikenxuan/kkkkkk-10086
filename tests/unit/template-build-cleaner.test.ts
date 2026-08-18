import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  cleanTemplateBuild,
  resolveTemplateBuildTargets
} from '../../src/module/tooling/react-template/build-cleaner.js'

const temporaryRoots: string[] = []

const createTemporaryRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'kkkkkk-build-cleaner-'))
  temporaryRoots.push(root)
  return root
}

const writeFixture = (root: string, path: string, content = 'fixture'): string => {
  const absolute = resolve(root, path)
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, content, 'utf8')
  return absolute
}

const linkDirectory = (target: string, path: string): void => {
  symlinkSync(target, path, process.platform === 'win32' ? 'junction' : 'dir')
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('template build cleaner module', () => {
  it('rejects an empty root before resolving it to the current directory', () => {
    expect(() => cleanTemplateBuild('')).toThrow('模板构建清理根目录不能为空')
    expect(() => cleanTemplateBuild('   ')).toThrow('模板构建清理根目录不能为空')
  })

  it('resolves only template-owned targets below an absolute repository root', () => {
    const root = createTemporaryRoot()

    const targets = resolveTemplateBuildTargets(join(root, '.'))

    expect(targets).toEqual([
      resolve(root, 'lib/template-registry.js'),
      resolve(root, 'lib/template-registry.js.map'),
      resolve(root, 'lib/template-style.css'),
      resolve(root, 'lib/template-style.css.map'),
      resolve(root, 'lib/template-chunks'),
      resolve(root, 'lib/template-assets')
    ])
    for (const target of targets) {
      const relativeTarget = relative(root, target)
      expect(relativeTarget).not.toBe('')
      expect(relativeTarget).not.toBe('lib')
      expect(relativeTarget).not.toBe('..')
      expect(relativeTarget.startsWith(`..${sep}`)).toBe(false)
      expect(isAbsolute(relativeTarget)).toBe(false)
    }
  })

  it('refuses to delete through a linked lib ancestor', () => {
    const root = createTemporaryRoot()
    const external = createTemporaryRoot()
    const sentinel = writeFixture(external, 'template-assets/sentinel.txt', 'keep')
    const linkedLib = join(root, 'lib')
    linkDirectory(external, linkedLib)

    try {
      expect(() => cleanTemplateBuild(root)).toThrow('符号链接或 Junction')
      expect(readFileSync(sentinel, 'utf8')).toBe('keep')
    } finally {
      unlinkSync(linkedLib)
    }
  })

  it('removes stale template outputs while preserving unrelated lib and generated files', () => {
    const root = createTemporaryRoot()
    const staleFiles = [
      'lib/template-registry.js',
      'lib/template-registry.js.map',
      'lib/template-style.css',
      'lib/template-style.css.map',
      'lib/template-chunks/old-hash.js',
      'lib/template-assets/old-hash.woff2'
    ]
    for (const file of staleFiles) writeFixture(root, file, 'stale')
    const unrelatedLib = writeFixture(root, 'lib/module/keep.js', 'keep')
    const generatedRegistry = writeFixture(root, '.generated/template-registry.ts', 'generated')

    const first = cleanTemplateBuild(root)
    const second = cleanTemplateBuild(root)

    expect(first.root).toBe(resolve(root))
    expect(first.targets).toEqual(second.targets)
    for (const file of staleFiles) expect(existsSync(resolve(root, file))).toBe(false)
    expect(readFileSync(unrelatedLib, 'utf8')).toBe('keep')
    expect(readFileSync(generatedRegistry, 'utf8')).toBe('generated')
    expect(existsSync(resolve(root, 'lib'))).toBe(true)
  })
})
