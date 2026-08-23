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

test('default checks run the committed test tree', () => {
  // tsc 按路径直调，不走裸命令：宿主 Yunzai 是 pnpm workspace 根，本插件的
  // node_modules/.bin 一旦缺失，裸命令会穿透到宿主根 .bin 拿到别的版本。
  // 这里只断言「查的是 tsconfig.test.json 且 --noEmit」，不锁 tsc 的调用拼写。
  assert.match(packageJson.scripts?.['typecheck:test'] ?? '', /\btsc\b/)
  assert.match(packageJson.scripts?.['typecheck:test'] ?? '', /-p tsconfig\.test\.json --noEmit$/)
  assert.equal(packageJson.scripts?.['test:baseline'], undefined)
  // test:dist 单独存在的理由：vitest.config.ts 把 tests/contracts/**/*.test.mjs
  // 排除给 node --test，没有这个脚本，整批 .mjs 契约测试（含本文件）没有任何
  // 东西会运行——standalone 迁移那次就是这样让四个测试文件悄悄烂掉的。
  assert.equal(packageJson.scripts?.['test:dist'], 'node --test tests/contracts/*.test.mjs')
  // test 不带 --passWithNoTests：tests/ 已经进仓库，「一个测试都没找到」
  // 不再是 CI 的正常状态，而是解析或 glob 出了问题，必须让它红。
  assert.doesNotMatch(packageJson.scripts?.test ?? '', /--passWithNoTests/)
  // 这份清单是冻结基线，作用是让 check 链的增删必须显式改测试、不能悄悄漂移。
  // 改这里之前先确认新步骤真该进默认校验：CI 只跑 pnpm check，进了就是每次 PR 都跑。
  // test 和 test:dist 必须排在 build 之后：react-template-dist.test.mjs 断言的是
  // lib/react-template/ 里的产物，build 之前那些文件还不存在。
  assert.deepStrictEqual(scriptSteps('check'), [
    'pnpm lint',
    'pnpm typecheck',
    'pnpm typecheck:template',
    'pnpm typecheck:render',
    'pnpm typecheck:test',
    'pnpm build',
    'pnpm audit:runtime-deps',
    'pnpm test',
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
