import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { compareAppFilenames, loadAppsFrom } from '../../src/module/loader/index.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function copyFixtureDirectory (): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'kkkkkk-loader-'))
  temporaryDirectories.push(directory)
  await mkdir(join(directory, 'nested'))
  await writeFile(join(directory, 'nested', 'ignored.js'), 'export class Ignored {}\n')
  await writeFile(join(directory, 'ignored.txt'), 'not an app\n')
  for (const file of ['valid.js', 'second.js', 'mixed.js', 'invalid.js', 'duplicate.js', 'default.js', 'empty.js', 'throws.js']) {
    const source = await readFile(join(process.cwd(), 'tests', 'fixtures', 'apps', file))
    await writeFile(join(directory, file), source)
  }
  return directory
}

describe('application loader', () => {
  it('sorts files, keys valid apps by basename, and keeps duplicate class names distinct', async () => {
    const appsDir = await copyFixtureDirectory()

    const result = await loadAppsFrom(appsDir)

    expect(result.loadedFiles).toEqual(['second.js', 'valid.js'])
    expect(Object.keys(result.apps)).toEqual(['second', 'valid'])
    expect(result.apps.second?.name).toBe('FixturePlugin')
    expect(result.apps.valid?.name).toBe('FixturePlugin')
    expect(result.apps.second).not.toBe(result.apps.valid)
    expect(result.failedFiles.map(({ file }) => file)).toEqual([
      'default.js',
      'duplicate.js',
      'empty.js',
      'invalid.js',
      'mixed.js',
      'throws.js'
    ])
  })

  it('isolates an invalid module without rejecting the whole load', async () => {
    const appsDir = await copyFixtureDirectory()

    const result = await loadAppsFrom(appsDir)
    const failure = result.failedFiles.find(({ file }) => file === 'invalid.js')

    expect(failure).toBeDefined()
    expect(failure?.error).toBeInstanceOf(Error)
    expect(result.apps).not.toHaveProperty('invalid')
  })

  it('registers __proto__.js as an own app key', async () => {
    const appsDir = await mkdtemp(join(tmpdir(), 'kkkkkk-loader-'))
    temporaryDirectories.push(appsDir)
    await writeFile(join(appsDir, '__proto__.js'), 'export class ProtoPlugin {}\n')

    const result = await loadAppsFrom(appsDir)

    expect(result.loadedFiles).toEqual(['__proto__.js'])
    expect(result.failedFiles).toEqual([])
    expect(Object.getPrototypeOf(result.apps)).toBe(Object.prototype)
    expect(Object.hasOwn(result.apps, '__proto__')).toBe(true)
    expect(Object.getOwnPropertyDescriptor(result.apps, '__proto__')?.value.name).toBe('ProtoPlugin')
  })

  it('uses code-point order when locale collation treats filenames as equal', async () => {
    const appsDir = await mkdtemp(join(tmpdir(), 'kkkkkk-loader-'))
    temporaryDirectories.push(appsDir)
    const composed = 'é.js'
    const decomposed = 'é.js'
    expect(composed.localeCompare(decomposed, 'en')).toBe(0)
    expect(compareAppFilenames(composed, decomposed)).toBeGreaterThan(0)
    expect(compareAppFilenames(decomposed, composed)).toBeLessThan(0)
    await writeFile(join(appsDir, composed), 'export class ComposedPlugin {}\n')
    await writeFile(join(appsDir, decomposed), 'export class DecomposedPlugin {}\n')

    const result = await loadAppsFrom(appsDir)

    expect(result.loadedFiles).toEqual([decomposed, composed])
    expect(result.failedFiles).toEqual([])
  })
})
