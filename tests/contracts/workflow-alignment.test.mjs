import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { parse } from 'yaml'

// tsconfig 是 JSONC：tsc 允许注释，JSON.parse 不允许。这里剥掉整行 `//` 注释再解析
// （本仓库的 tsconfig 只用这一种注释形式，不做块注释/行尾注释处理，避免误伤字符串里的 `//`）。
const readJson = path => JSON.parse(
  readFileSync(path, 'utf8')
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n')
)
const readWorkflow = path => parse(readFileSync(path, 'utf8'))

// 文件名是 check.yml 而不是 ci.yml：GitHub 的 workflow 实体按**路径**存，
// 侧边栏显示的名字只在该路径首次登记时读一次 `name:`。ci.yml 那条实体的名字
// 停在移植时的 'CI'，928a825 把 `name:` 改成中文后再没被重读过（同一现象也
// 落在 release-and-push-build.yml 上，它的实体名还是旧的「发布并推送发布分支」）。
// 换路径等于让 GitHub 建一个新实体、重读一次 name。
const ciPath = '.github/workflows/check.yml'
const previewPath = '.github/workflows/build-push-preview.yml'
const releasePath = '.github/workflows/release-and-push-build.yml'
const issueWorkflowPaths = [
  '.github/workflows/issue_geetings.yml',
  '.github/workflows/issue_welcome.yml',
  '.github/workflows/issue_similarity.yml'
]

const findStep = (workflow, jobName, predicate) =>
  workflow.jobs[jobName].steps.find(predicate)

test('dev publishes preview builds and owns the v4 release-please line', () => {
  assert.equal(existsSync(previewPath), true)
  assert.equal(existsSync(releasePath), true)
  assert.equal(existsSync(ciPath), true)
  // 旧路径不许回来。GitHub 按路径存 workflow 实体，ci.yml 那条实体的名字停在
  // 移植时的 'CI'，改回旧文件名等于把侧边栏那个错标签一起带回来。
  assert.equal(existsSync('.github/workflows/ci.yml'), false)
  // release-please.yml (v3, release-type: node) still lives on origin/master and is intentionally
  // NOT carried onto dev — dev's release line is release-and-push-build.yml (v4, manifest-driven).
  // Verify with: git ls-tree -r --name-only origin/master -- .github/workflows/
  assert.equal(existsSync('.github/workflows/release-please.yml'), false)
  assert.equal(existsSync('.github/workflows/issue_close.yml'), false)
  assert.equal(existsSync('.github/workflows/stale.yml'), true)

  const preview = readWorkflow(previewPath)
  const release = readWorkflow(releasePath)
  const stale = readWorkflow('.github/workflows/stale.yml')

  assert.deepEqual(preview.on.push.branches, ['dev'])
  assert.equal(Object.hasOwn(preview.on, 'workflow_dispatch'), true)
  assert.equal(preview.permissions.contents, 'write')
  assert.equal(
    preview.jobs['build-and-push'].steps.at(-1).with.publish_branch,
    'preview'
  )

  // A workflow only ever runs from a branch that contains it, and this file exists on dev only.
  // Listening on master here meant the push trigger could never fire at all.
  assert.deepEqual(release.on.push.branches, ['dev'])
  assert.equal(Object.hasOwn(release.on, 'workflow_dispatch'), true)
  assert.equal(release.permissions.contents, 'write')
  assert.equal(release.permissions['pull-requests'], 'write')
  assert.equal(release.permissions.issues, 'write')
  // The two dev guards. workflow_dispatch defaults to the repo default branch (master) in the
  // Actions UI, so without the job-level `if` one manual run would open a v4 manifest release PR
  // against master, colliding with master's own v3 release-please.yml. `target-branch` is pinned
  // rather than derived from github.ref_name for the same reason.
  assert.equal(release.jobs['release-please'].if, "github.ref_name == 'dev'")
  assert.equal(
    release.jobs['release-please'].steps[0].with['target-branch'],
    'dev'
  )
  assert.equal(
    release.jobs['release-please'].steps[0].uses,
    'googleapis/release-please-action@v4'
  )
  // 构建产物推到 master：远端只有 dev / docs / master / preview 四条线，没有 release 分支
  // （核对方式：`git ls-remote --heads origin`）。dev 走 preview，master 是稳定线。
  assert.equal(
    release.jobs['release-please'].steps.at(-1).with.publish_branch,
    'master'
  )

  assert.equal(stale.jobs.stale.steps[0].uses, 'actions/stale@v10')
  assert.equal(stale.permissions.issues, 'write')
  assert.equal(stale.permissions['pull-requests'], 'write')
})

test('master 的产物提交信息自带上下文，不是 dev 那条 squash 信息', () => {
  const release = readWorkflow(releasePath)
  const message = release.jobs['release-please'].steps.at(-1).with.full_commit_message

  // 这一步只在 release_created 时执行，那一刻 dev 的 head 必然是 release-please
  // 的「chore(dev): release X.Y.Z (#N)」。直接搬它等于让 master 上每条产物提交都
  // 只写「版本号 PR 被合并了」—— 而 master 上除了产物什么都没有，提交信息是唯一线索。
  assert.doesNotMatch(
    message,
    /github\.event\.head_commit\.message/,
    'master 的产物提交信息不能直接搬 dev 的 head_commit.message'
  )

  // tag / 版本 / 源提交三者都得在：翻 master 历史时要能一眼对上是哪个 tag、
  // 由哪个 dev 提交构建出来的。
  assert.match(message, /steps\.release\.outputs\.tag_name/)
  assert.match(message, /steps\.release\.outputs\.version/)
  assert.match(message, /github\.sha/)

  // 不许把 changelog 正文塞进提交信息：那是由提交信息/PR 标题拼出来的自由文本，
  // 几十行且内容不可控，而它已经随产物里的 CHANGELOG.md 和 Release 页发出去了。
  assert.doesNotMatch(
    message,
    /steps\.release\.outputs\.body/,
    '不要把 changelog 正文塞进提交信息'
  )

  // preview 那条是每个 dev 提交推一次，head_commit.message 本身就是有意义的
  // （`refactor(utils): ...`），所以它继续用那个值是对的 —— 两条线的取值不该被
  // 顺手统一掉。
  const preview = readWorkflow(previewPath)
  assert.match(
    preview.jobs['build-and-push'].steps.at(-1).with.full_commit_message,
    /github\.event\.head_commit\.message/,
    'preview 是逐提交推送，应当保留源提交信息'
  )
})

test('published artifacts are stamped with the branch they ship to, not the branch they build from', () => {
  const buildMetadataSource = readFileSync('src/module/tooling/build-metadata.ts', 'utf8')
  // 压缩包安装（没有 .git）判断发布通道的唯一依据就是这份烘进产物的元数据。
  assert.match(buildMetadataSource, /KKK_PUBLISH_BRANCH/)
  // 必须排在 GITHUB_REF_NAME 之前，否则在 CI 里永远轮不到它生效。
  assert.ok(
    buildMetadataSource.indexOf('KKK_PUBLISH_BRANCH') < buildMetadataSource.indexOf('GITHUB_REF_NAME'),
    'KKK_PUBLISH_BRANCH 必须比 GITHUB_REF_NAME 优先'
  )

  for (const [path, jobName] of [[previewPath, 'build-and-push'], [releasePath, 'release-please']]) {
    const workflow = readWorkflow(path)
    const job = workflow.jobs[jobName]
    const publishBranch = job.steps.at(-1).with.publish_branch
    const buildStep = findStep(workflow, jobName, step => (step.run ?? '').includes('pnpm verify'))

    assert.ok(buildStep, `${path}: 找不到执行 pnpm verify 的构建步骤`)
    // 两个发布工作流都在 dev 上构建，却把产物推到别的分支。烘进去的分支必须是
    // 「推到哪」而不是 GITHUB_REF_NAME 的「从哪构建」——否则 master 上的产物
    // 自称 dev，稳定版用户的错误卡片上通道全是 Dev。
    assert.equal(
      buildStep.env?.KKK_PUBLISH_BRANCH,
      publishBranch,
      `${path}: 构建步骤烘进去的分支必须等于 publish_branch（${publishBranch}）`
    )
  }
})

test('build workflow command layers stay aligned with local validation', () => {
  const ci = readWorkflow(ciPath)
  const preview = readWorkflow(previewPath)
  const release = readWorkflow(releasePath)

  assert.deepEqual(ci.jobs.check.strategy.matrix.os, [
    'ubuntu-latest',
    'windows-latest'
  ])
  assert.equal(
    findStep(ci, 'check', step => step.uses === 'pnpm/action-setup@v6').with
      .version,
    '9.15.9'
  )
  assert.equal(
    findStep(ci, 'check', step => step.uses === 'actions/setup-node@v7').with[
      'node-version'
    ],
    24
  )
  assert.equal(
    findStep(ci, 'check', step => step.run?.startsWith('pnpm install')).run,
    'pnpm install --frozen-lockfile'
  )
  assert.equal(findStep(ci, 'check', step => step.run === 'pnpm check').run, 'pnpm check')

  for (const [workflow, jobName] of [
    [preview, 'build-and-push'],
    [release, 'release-please']
  ]) {
    assert.equal(
      findStep(workflow, jobName, step => step.uses === 'pnpm/action-setup@v6').with
        .version,
      '9.15.9'
    )
    assert.equal(
      findStep(workflow, jobName, step => step.uses === 'actions/setup-node@v7')
        .with['node-version'],
      24
    )
    assert.equal(
      findStep(workflow, jobName, step => step.run?.startsWith('pnpm install')).run,
      'pnpm install --frozen-lockfile'
    )
    assert.equal(
      findStep(workflow, jobName, step => step.run === 'pnpm verify').run,
      'pnpm verify'
    )
  }
})

test('issue automation workflows request the minimum write permission', () => {
  for (const path of issueWorkflowPaths) {
    const workflow = readWorkflow(path)
    assert.deepEqual(workflow.permissions, { issues: 'write' }, path)
  }
})

test('development branch does not enforce generated lib drift', () => {
  const packageJson = readJson('package.json')
  const ci = readWorkflow(ciPath)

  assert.equal(existsSync('src/scripts/check-generated.ts'), false)
  assert.equal(existsSync('lib/scripts/check-generated.js'), false)
  assert.equal(Object.hasOwn(packageJson.scripts, 'verify:generated'), false)
  assert.equal(packageJson.scripts.verify, 'pnpm check')
  assert.equal(
    ci.jobs.check.steps.some(step => step.name === 'Check generated lib for drift'),
    false
  )
})

test('release configuration and package file contract are present', () => {
  const packageJson = readJson('package.json')
  const releaseConfig = readJson('.release-please-config.json')
  const releaseManifest = readJson('.release-please-manifest.json')
  const tsconfig = readJson('tsconfig.json')

  assert.deepEqual(packageJson.files, [
    'index.js',
    'guoba.support.js',
    'package.json',
    'README.md',
    'CHANGELOG.md',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'lib',
    'resources',
    'config/default_config'
  ])
  assert.equal(releaseConfig.packages['.']['release-type'], 'node')
  assert.equal(releaseManifest['.'], packageJson.version)

  assert.equal(tsconfig.compilerOptions.target, 'ES2024')
  assert.equal(tsconfig.compilerOptions.module, 'ESNext')
  assert.equal(tsconfig.compilerOptions.moduleResolution, 'Bundler')
  // '~/*' 曾经和 '@/*' 指向同一个目录，src/ 里一处都没用过，已删除；
  // 保留一个别名根，外加富文本入口。
  // 注意 '@kkk/richtext' 在 src 侧只能指向 rootDir(./src) 内部的 react-free 核心：
  // 从 src/ import ktr/ 下的 .ts 会 TS6059（emit 落到 outDir 之外）。上游用 pnpm
  // workspace 包绕开这个限制，本仓库是宿主 Yunzai 工作区里的单包插件，不能自己再开
  // workspace root，所以改成同一个说明符按 tsconfig 分别解析，见下一个断言。
  assert.deepEqual(tsconfig.compilerOptions.paths, {
    '@/*': ['./src/*'],
    '@kkk/richtext': ['./src/module/utils/richtext/index.ts']
  })
  assert.equal(tsconfig.compilerOptions.moduleDetection, 'force')
  assert.equal(tsconfig['tsc-alias'].resolveFullPaths, true)
  assert.match(packageJson.scripts.build, /tsc-alias/)
  assert.ok(packageJson.devDependencies['tsc-alias'])

  // vitest.config.ts 明确把 tests/contracts/**/*.test.mjs 排除掉交给 node --test，
  // 所以没有这个脚本的话，包括本文件在内的整批契约测试没有任何东西会运行。
  // 它现在是 `check` 的最后一步（tests/ 已经进仓库），排在 build 之后：
  // react-template-dist.test.mjs 断言的是 lib/ 里的产物。
  assert.equal(packageJson.scripts['test:dist'], 'node --test tests/contracts/*.test.mjs')
})

test('@kkk/richtext resolves to the react-free core on the src side and to the ktr barrel on the template side', () => {
  // 上游把 richtext 做成 pnpm workspace 包 @kkk/richtext，core 和模板都 import 同一个说明符。
  // 本仓库不能开自己的 workspace root（宿主 Yunzai 工作区里的单包插件，bare `pnpm install`
  // 会动到正在运行的 bot 的 node_modules），于是改成：核心留在 rootDir(./src) 内，同一个
  // 说明符按 tsconfig / bundler 分别解析。两边的 import 写法因此和上游完全一致。
  const corePath = './src/module/utils/richtext/index.ts'
  const barrelPath = './ktr/richtext/index.ts'

  // 编译期：src 侧（会 emit，受 rootDir 约束）指核心，模板侧指 barrel。
  assert.equal(readJson('tsconfig.json').compilerOptions.paths['@kkk/richtext'][0], corePath)
  assert.equal(readJson('tsconfig.template.json').compilerOptions.paths['@kkk/richtext'][0], barrelPath)
  // tsconfig.test.json 只 include src/ 和 tests/，必须和 vitest 的运行期解析一致，
  // 否则测试里 import React 渲染器会「类型通过、运行期报错」。
  assert.equal(readJson('tsconfig.test.json').compilerOptions.paths['@kkk/richtext'][0], corePath)

  // 运行期：vitest 解析到核心，ktr 的 vite 构建解析到 barrel。
  assert.match(
    readFileSync('vitest.config.ts', 'utf8'),
    /find:\s*'@kkk\/richtext',\s*replacement:\s*`\$\{srcDir\}\/module\/utils\/richtext\/index\.ts`/
  )
  assert.match(
    readFileSync('karin.template.ts', 'utf8'),
    /find:\s*'@kkk\/richtext',\s*replacement:\s*resolve\(root,\s*'ktr\/richtext\/index\.ts'\)/
  )

  // barrel 必须真的建立在核心之上，否则两条解析路径会各自漂移出两套类型。
  assert.match(
    readFileSync('ktr/richtext/index.ts', 'utf8'),
    /export \* from '\.\.\/\.\.\/src\/module\/utils\/richtext'/
  )
  // ktr/richtext/react 只允许留 React 渲染器；types/parse 已经搬到 src 侧。
  assert.equal(existsSync('src/module/utils/richtext/types.ts'), true)
  assert.equal(existsSync('src/module/utils/richtext/parse/index.ts'), true)
  assert.equal(existsSync('ktr/richtext/types.ts'), false)
  assert.equal(existsSync('ktr/richtext/parse/index.ts'), false)
})

test('tsconfig.json stays comment-free because the template build JSON.parses it', () => {
  // src/module/tooling/template-build.ts 会 JSON.parse tsconfig.json、删掉 rootDir 再写回，
  // 用的是原生 JSON.parse，不吃 JSONC。往 tsconfig.json 里加 // 注释会直接把
  // `pnpm template:build`（以及 build / check）打挂，所以这里守住。
  const source = readFileSync('tsconfig.json', 'utf8')
  assert.doesNotThrow(() => JSON.parse(source), 'tsconfig.json 必须是严格 JSON（不能有注释）')
  assert.match(
    readFileSync('src/module/tooling/template-build.ts', 'utf8'),
    /JSON\.parse\(original\)/
  )
})
