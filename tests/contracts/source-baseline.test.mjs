/**
 * 源码层面的冻结测试：只管「文件名 → 导出类名」的映射和默认配置清单。
 *
 * app 的语义契约（event / priority / rule 的 reg·fnc·permission / task）由
 * `tests/contracts/apps.test.ts` 在运行时逐字段断言——那里能看到
 * `...generateRules()` 展开和 `super()` 之后的 `this.task` 赋值，
 * 比在这里做静态分析严格得多，所以本文件不再重复解析源码 AST。
 */
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const appsPath = join(repositoryRoot, 'src', 'apps')
const legacyAppsPath = join(repositoryRoot, 'apps')
const baselinePath = join(repositoryRoot, 'tests', 'fixtures', 'baseline', 'apps.json')
const defaultConfigPath = join(repositoryRoot, 'config', 'default_config')
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))

const expectedConfigFiles = [
  'app.yaml',
  'bilibili.yaml',
  'cookies.yaml',
  'douyin.yaml',
  'kuaishou.yaml',
  'pushlist.yaml',
  'request.yaml',
  'upload.yaml',
  'xiaohongshu.yaml'
]

test('apps source matches the frozen filename and export baseline', () => {
  assert.strictEqual(existsSync(legacyAppsPath), false, 'root apps/ must be absent after the src move')

  const entries = readdirSync(appsPath, { withFileTypes: true }).filter((entry) => entry.isFile())

  const leftoverJs = entries.map((entry) => entry.name).filter((name) => name.endsWith('.js')).sort()
  assert.deepStrictEqual(leftoverJs, [], 'every app must be TypeScript after the migration')

  const actualAppFiles = entries
    .map((entry) => entry.name)
    .filter((name) => name.endsWith('.ts'))
    .sort()
  const expectedAppFiles = Object.keys(baseline).map((name) => `${name}.ts`).sort()

  // Yunzai 以文件名注册 app，改名等于改注册名
  assert.deepStrictEqual(actualAppFiles, expectedAppFiles)

  for (const [appName, className] of Object.entries(baseline)) {
    const source = readFileSync(join(appsPath, `${appName}.ts`), 'utf8')
    assert.match(
      source,
      new RegExp(`export class ${className} extends plugin\\b`),
      `${appName}.ts must export class ${className} extending plugin`
    )
  }
})

test('default config contains exactly the frozen YAML baseline', () => {
  const actualConfigFiles = readdirSync(defaultConfigPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'))
    .map((entry) => entry.name)
    .sort()

  assert.deepStrictEqual(actualConfigFiles, [...expectedConfigFiles].sort())
})
