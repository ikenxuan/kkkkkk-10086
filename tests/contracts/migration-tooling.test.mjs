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

/**
 * 第三方二进制必须按路径直调，不许出现裸命令 / npx / pnpm exec。
 *
 * 宿主 Yunzai 是 pnpm workspace 根（pnpm-workspace.yaml 把 plugins 下的目录收成了
 * 成员），而 pnpm 的 publicHoistPattern 默认值就是 eslint 与 prettier 两个通配 ——
 * 已核对宿主 node_modules/.modules.yaml，生效的确实是这个默认值，而不是本插件
 * .npmrc 里声明的 sqlite3 与 express 两条。于是邻居插件 shareMusic 声明的
 * `eslint: latest` 把 10.x 提到了宿主根：
 *   插件 node_modules/eslint  -> 9.11.1（本仓锁定值）
 *   宿主根 node_modules/eslint -> 10.8.1
 *
 * 裸 `eslint` 会先找插件 node_modules/.bin，缺失时穿透到宿主根 .bin 拿到 10.x，
 * 结果是 lint 崩在谁都没碰过的文件上，且不报「版本不对」。
 *
 * 按路径直调把这条路彻底堵掉：node 对**入口路径参数**只做
 * path.resolve(cwd, arg)，不做 node_modules 向上查找（向上查找只发生在
 * require/import 的裸说明符上）。实测过：
 *   node node_modules/nosuchpkg/bin/x.js
 *   -> Cannot find module 'E:\Yunzai\plugins\kkkkkk-10086\node_modules\nosuchpkg\bin\x.js'
 *      code: MODULE_NOT_FOUND
 * 即使宿主根同时装着同名包也不会命中。所以本地缺包时是响亮失败，
 * 而不是静默拿到错版本 —— 这正是想要的行为。
 *
 * 这条断言存在的理由：上面那套推理此前只以注释形式活着，
 * 而 react-template-build.test.ts 和本文件的另两处都明写了「不锁调用拼写」。
 * 于是任何一次「顺手把脚本改简洁」都能把裸命令放回来，而 check 链照样全绿 ——
 * 直到下一台装了 hoisted eslint 10 的机器上重现那个崩溃。
 */
test('工具链脚本按路径直调本地二进制，不穿透到宿主根', () => {
  // 这些都在 node_modules/.bin 里有同名 shim，是会被宿主根截胡的那一批
  const hoistableBinaries = [
    'eslint',
    'tsc',
    'tsc-alias',
    'vitest',
    'rimraf',
    'concurrently',
    'ktr',
    'prettier'
  ]

  for (const [scriptName, rawScript] of Object.entries(packageJson.scripts ?? {})) {
    const script = String(rawScript)

    // npx 会自己去下载/解析，pnpm exec 走的是 .bin 查找链，两者都绕过路径直调
    assert.doesNotMatch(
      script,
      /\bnpx\s/,
      `${scriptName}: 不许用 npx，按 node node_modules/<pkg>/... 直调`
    )
    assert.doesNotMatch(
      script,
      /\bpnpm\s+(exec|dlx)\s/,
      `${scriptName}: 不许用 pnpm exec/dlx，它走 .bin 查找链，会被宿主根截胡`
    )

    for (const step of script.split('&&').map(part => part.trim()).filter(Boolean)) {
      // `pnpm <script>` 是脚本引用而不是二进制调用，跳过
      if (/^pnpm\s/.test(step)) continue

      const firstToken = step.split(/\s+/)[0]
      assert.ok(
        !hoistableBinaries.includes(firstToken),
        `${scriptName}: "${firstToken}" 是裸命令，本插件 node_modules/.bin 缺失时会` +
        '穿透到宿主根拿到别的版本。改成 node node_modules/<pkg>/<entry>'
      )
    }
  }

  // 正面钉住两个最要紧的：lint 和 typecheck 都在 check 链的最前面，
  // 它们一旦拿到错版本，后面所有步骤的失败都会指向错误的方向。
  assert.match(
    packageJson.scripts?.lint ?? '',
    /^node node_modules\/eslint\/bin\/eslint\.js\s/,
    'lint 必须按路径直调本地 eslint'
  )
  assert.match(
    packageJson.scripts?.fix ?? '',
    /^node node_modules\/eslint\/bin\/eslint\.js\s/,
    'fix 必须和 lint 用同一个 eslint'
  )
  assert.match(
    packageJson.scripts?.typecheck ?? '',
    /^node node_modules\/typescript\/bin\/tsc\s/,
    'typecheck 必须按路径直调本地 tsc'
  )

  // eslint 的版本必须是精确值而不是范围：这个仓库的 lint 规则集
  // （neostandard + typescript-eslint）对 eslint 大版本敏感，
  // 让 ^ 或 latest 溜进来等于把上面那套防御的意义抵消掉。
  assert.match(
    packageJson.devDependencies?.eslint ?? '',
    /^\d+\.\d+\.\d+$/,
    'eslint 必须锁精确版本，不许 ^ / ~ / latest'
  )
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
