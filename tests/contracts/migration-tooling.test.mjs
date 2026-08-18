import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const packageJson = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'))

const scriptSteps = (name) => String(packageJson.scripts?.[name] || '')
  .split('&&')
  .map((step) => step.trim())
  .filter(Boolean)

test('default checks include test typechecking and the source migration baseline', () => {
  assert.equal(packageJson.scripts?.['typecheck:test'], 'tsc -p tsconfig.test.json --noEmit')
  assert.deepStrictEqual(scriptSteps('check'), [
    'pnpm lint',
    'pnpm typecheck',
    'pnpm typecheck:template',
    'pnpm typecheck:test',
    'pnpm test',
    'pnpm test:baseline',
    'pnpm build',
    'pnpm test:dist'
  ])
})

test('project verification runs standard checks without generated output enforcement', () => {
  assert.equal(packageJson.scripts?.['verify:generated'], undefined)
  assert.deepStrictEqual(scriptSteps('verify'), ['pnpm check'])
})

test('test TypeScript project covers source, tests, and Vitest configuration', () => {
  const configPath = join(repositoryRoot, 'tsconfig.test.json')
  assert.equal(existsSync(configPath), true, 'tsconfig.test.json must exist')

  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  assert.equal(config.extends, './tsconfig.json')
  assert.equal(config.compilerOptions?.rootDir, '.')
  assert.equal(config.compilerOptions?.noEmit, true)
  assert.deepStrictEqual(config.include, [
    'src/**/*.ts',
    'tests/**/*.ts',
    'vitest.config.ts'
  ])
  assert.deepStrictEqual(config.exclude, [
    'node_modules',
    'lib'
  ])
})
