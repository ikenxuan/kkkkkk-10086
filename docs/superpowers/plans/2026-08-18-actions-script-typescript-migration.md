# Actions and Script TypeScript Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `scripts/**` 的模板注册表生成与构建清理业务完整迁入 `src/module/**` 的 TypeScript 模块，同时保留跨 Windows/Ubuntu 的薄 CLI，并在不覆盖当前工作树 `lib/**` 的前提下验证 GitHub Actions 的本地可运行部分。

**Architecture:** 新建 `src/module/tooling/react-template/` 构建期工具域，分别承载确定性的注册表规划/同步与严格限定范围的模板产物清理；现有 `.mjs` 只负责参数、日志和进程退出码。Node 22.12.0 通过 `--experimental-strip-types` 直接加载 TS 源码，避免先构建 `lib` 的循环依赖，也不新增 `tsx` 依赖。

**Tech Stack:** TypeScript 5.9、Node.js `>=22.12.0` 原生 type stripping、Vitest 3、Node test runner、pnpm 9.15.9、GitHub Actions YAML。

## Global Constraints

- 严格执行 RED → GREEN → REFACTOR；任何生产实现前必须先看到对应测试按预期失败。
- 代码导航只使用 jCodeMunch-MCP；编辑前读取目标文件，编辑后注册或重建索引。
- 不运行会删除或覆盖当前工作树 `lib/**` 的 `pnpm build`、`pnpm check`、`pnpm verify`。
- 完整 Actions 命令链只能在包含当前工作树快照的临时副本运行；当前工作树中的 `lib/**` 必须保持原样。
- 不执行 `git reset`、`git checkout`、`git clean`，不暂存、不提交、不还原用户已有改动。
- 不新增 `tsx`；CLI 必须兼容 workflow 固定的 Node `22.12.0` 以及 Windows、Ubuntu。
- TS 工具模块不得使用 Node type stripping 不支持的 `enum`、`namespace`、参数属性、decorator、路径别名或 `.tsx`。
- 不把 `template:check` 擅自加入 `check`/`verify`；保持现有 workflow 与 package script 的调用层级。
- 清理器只能删除六个模板自有输出，不得删除整个 `lib`、`.generated` 或 `lib/module/**`。
- 注册表生成结果必须与迁移前字节一致：英文排序、过滤隐藏/私有/`components`、POSIX 路由、固定注释和结尾换行均保持不变。

---

## File Structure

- Create `src/module/tooling/react-template/registry-generator.ts`: 注册表路由发现、源码规划、同步与检查 API；不读取 argv、不打印日志、不设置退出码。
- Create `src/module/tooling/react-template/build-cleaner.ts`: 六项模板输出的安全解析与幂等清理 API；不打印日志、不修改进程状态。
- Modify `scripts/generate-template-registry.mjs`: 仅解析 `--check`/`--root`、调用 TS API、输出结果和设置退出码。
- Modify `scripts/clean-template-build.mjs`: 仅解析 `--root`、调用 TS API并输出结果。
- Modify `package.json`: 三个模板工具入口统一使用 `node --experimental-strip-types`；其余调用顺序保持不变。
- Create `tests/unit/template-registry-generator.test.ts`: 注册表纯逻辑和 I/O 行为测试。
- Create `tests/unit/template-build-cleaner.test.ts`: 路径边界、固定目标与幂等清理测试。
- Modify `tests/contracts/react-template-registry-generator.test.ts`: 通过真实 CLI 的 `--root` 验证过滤、同步和 check 退出语义。
- Modify `tests/contracts/react-template-build.test.ts`: 从读取旧脚本实现改为验证 TS 模块/真实 CLI 行为。
- Create `tests/contracts/template-tooling-cli.test.ts`: package script、薄入口和 Node 22 原生 TS runner 契约。
- Modify `tests/contracts/workflow-alignment.test.mjs`: 补充构建类 workflow 对 Node/pnpm/入口及 Issue workflow 最小权限的静态契约；不声称本地可验证第三方 Action。
- Optionally modify `.github/workflows/issue_geetings.yml`, `.github/workflows/issue_welcome.yml`, `.github/workflows/issue_similarity.yml` only if RED contract confirms缺少 `issues: write`；不改第三方 Action 的功能参数。
- Create `docs/actions-local-validation.md`: 记录当前环境的可执行矩阵、无副作用命令、临时副本完整命令和 `act`/Docker/GitHub token 的边界。

---

### Task 1: Registry Generator TypeScript Module

**Files:**
- Create: `tests/unit/template-registry-generator.test.ts`
- Create: `src/module/tooling/react-template/registry-generator.ts`

**Interfaces:**
- Consumes: 仓库根目录或模板根目录字符串，Node `fs`/`path` 内置模块。
- Produces:
  - `interface TemplateRegistryEntry { file: string; route: string }`
  - `interface TemplateRegistryPlan { root: string; templateRoot: string; generatedRoot: string; outputFile: string; entries: readonly TemplateRegistryEntry[]; source: string }`
  - `interface TemplateRegistryCheckResult { status: 'current' | 'stale'; outputFile: string; entryCount: number }`
  - `interface TemplateRegistrySyncResult { outputFile: string; entryCount: number }`
  - `discoverTemplateRegistryEntries(templateRoot: string): TemplateRegistryEntry[]`
  - `createTemplateRegistrySource(entries: readonly TemplateRegistryEntry[], generatedRoot: string): string`
  - `createTemplateRegistryPlan(root: string): TemplateRegistryPlan`
  - `checkTemplateRegistry(root: string): TemplateRegistryCheckResult`
  - `syncTemplateRegistry(root: string): TemplateRegistrySyncResult`

- [ ] **Step 1: Write failing pure-logic tests**

Create tests that import the not-yet-existing module and assert:

```ts
const entries = [
  { route: 'z/card', file: 'C:\\repo\\ktr\\template\\z\\card\\index.tsx' },
  { route: 'a/card', file: 'C:\\repo\\ktr\\template\\a\\card\\index.tsx' }
]
const source = createTemplateRegistrySource(entries, 'C:\\repo\\.generated')
expect(source.indexOf('"a/card"')).toBeLessThan(source.indexOf('"z/card"'))
expect(source).toContain('../ktr/template/a/card/index.tsx')
expect(source.endsWith('\n')).toBe(true)
expect(entries.map(entry => entry.route)).toEqual(['z/card', 'a/card'])
```

Also assert empty entries throw `No React template entries found` and generated source contains neither CSS nor Tailwind imports.

- [ ] **Step 2: Verify RED**

Run:

```powershell
pnpm exec vitest run tests/unit/template-registry-generator.test.ts
```

Expected: FAIL because `src/module/tooling/react-template/registry-generator.ts` cannot be resolved.

- [ ] **Step 3: Implement the minimal pure functions**

Implement stable non-mutating English sorting, POSIX path conversion and byte-stable source generation. Keep all process globals out of the module.

- [ ] **Step 4: Verify pure-logic GREEN**

Run the same targeted Vitest command. Expected: PASS.

- [ ] **Step 5: Add failing filesystem behavior tests**

Use a temporary root containing:

```text
ktr/template/section/card/index.tsx
ktr/template/section/card/components/internal/index.tsx
ktr/template/_private/index.tsx
ktr/template/.hidden/index.tsx
ktr/template/ignored/not-index.tsx
```

Assert only `section/card` is discovered; `syncTemplateRegistry()` creates `.generated/template-registry.ts`; a second sync is byte-identical; `checkTemplateRegistry()` reports `current`, then reports `stale` after modifying the file and never rewrites it.

- [ ] **Step 6: Verify filesystem RED**

Run the targeted test. Expected: FAIL because the planning/sync/check functions are absent or incomplete.

- [ ] **Step 7: Implement minimal filesystem boundary**

Use sorted `readdirSync(..., { withFileTypes: true })`, `mkdirSync`, `readFileSync`, `writeFileSync` and `existsSync`. Normalize `root` with `resolve()` and keep `checkTemplateRegistry()` side-effect free.

- [ ] **Step 8: Verify registry GREEN**

Run the targeted test and expect all registry unit tests to PASS.

---

### Task 2: Template Build Cleaner TypeScript Module

**Files:**
- Create: `tests/unit/template-build-cleaner.test.ts`
- Create: `src/module/tooling/react-template/build-cleaner.ts`

**Interfaces:**
- Consumes: repository root string.
- Produces:
  - `TEMPLATE_BUILD_OUTPUTS` exactly containing the six existing relative outputs.
  - `interface CleanTemplateBuildResult { root: string; targets: readonly string[] }`
  - `resolveTemplateBuildTargets(root: string): string[]`
  - `cleanTemplateBuild(root: string): CleanTemplateBuildResult`

- [ ] **Step 1: Write failing safety tests**

Assert the output list is exactly:

```ts
[
  'lib/template-registry.js',
  'lib/template-registry.js.map',
  'lib/template-style.css',
  'lib/template-style.css.map',
  'lib/template-chunks',
  'lib/template-assets'
]
```

Assert all resolved targets remain under the normalized root, and no target equals the root or `<root>/lib`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
pnpm exec vitest run tests/unit/template-build-cleaner.test.ts
```

Expected: FAIL because the TS cleaner module does not exist.

- [ ] **Step 3: Implement target resolution and containment checks**

Resolve every fixed relative output from an absolute root and reject empty root, root equality, `lib` equality, `..` escape and different-volume escape using `relative()` plus `isAbsolute()`.

- [ ] **Step 4: Verify path GREEN**

Run the targeted cleaner test. Expected: fixed-list and containment assertions PASS.

- [ ] **Step 5: Add failing deletion behavior tests**

Create all six stale outputs plus `lib/module/keep.js` and `.generated/template-registry.ts`. Assert `cleanTemplateBuild()` removes only the six outputs, preserves both unrelated files and can run twice.

- [ ] **Step 6: Verify deletion RED**

Run the targeted cleaner test. Expected: FAIL because actual cleanup is not implemented.

- [ ] **Step 7: Implement minimal idempotent cleanup**

Call `rmSync(target, { recursive: true, force: true })` only for prevalidated targets and return normalized root plus target list.

- [ ] **Step 8: Verify cleaner GREEN**

Run the targeted cleaner test. Expected: PASS.

---

### Task 3: Thin Cross-Platform CLI Entrypoints

**Files:**
- Create: `tests/contracts/template-tooling-cli.test.ts`
- Modify: `scripts/generate-template-registry.mjs`
- Modify: `scripts/clean-template-build.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1 and Task 2 named exports through explicit `.ts` import paths.
- Produces:
  - Registry CLI flags: `--check`, `--root <directory>`.
  - Cleaner CLI flag: `--root <directory>`.
  - Package scripts using `node --experimental-strip-types`.

- [ ] **Step 1: Write failing CLI/package contracts**

Assert package scripts equal:

```json
{
  "template:sync": "node --experimental-strip-types scripts/generate-template-registry.mjs",
  "template:check": "node --experimental-strip-types scripts/generate-template-registry.mjs --check",
  "clean:template": "node --experimental-strip-types scripts/clean-template-build.mjs"
}
```

Assert both wrappers import their TS module and no longer contain `readdirSync`, `rmSync`, `ownedOutputs`, source assembly or recursive walking. Spawn the real registry CLI with `--root <temp>` in sync/check/stale modes and the real cleaner CLI twice.

- [ ] **Step 2: Verify RED**

Run:

```powershell
pnpm exec vitest run tests/contracts/template-tooling-cli.test.ts
```

Expected: FAIL because package scripts and wrappers still execute MJS business logic and registry CLI lacks `--root`.

- [ ] **Step 3: Replace the registry script with a thin adapter**

Parse flags without business rules, derive the default root from the script location, call `checkTemplateRegistry()` or `syncTemplateRegistry()`, print one status line, and set `process.exitCode = 1` only for stale check results.

- [ ] **Step 4: Replace the cleaner script with a thin adapter**

Parse `--root`, derive default root, call `cleanTemplateBuild()` and print one status line. A missing `--root` value must throw and produce a non-zero process result.

- [ ] **Step 5: Update package scripts**

Add `--experimental-strip-types` to only the three TS-loading template tool commands. Do not reorder `check` or change `verify`.

- [ ] **Step 6: Verify CLI GREEN**

Run the targeted contract test. Expected: PASS on Windows Node 22.18.0 and compatible with workflow Node 22.12.0 syntax.

---

### Task 4: Update Existing Template Contracts

**Files:**
- Modify: `tests/contracts/react-template-registry-generator.test.ts`
- Modify: `tests/contracts/react-template-build.test.ts`

**Interfaces:**
- Consumes: real repository wrappers and Task 1/2 TS APIs.
- Produces: behavior-focused regression coverage without copying implementation files into temporary roots.

- [ ] **Step 1: Write the new contract expectations before adapting implementation assumptions**

Change the registry contract to invoke the real wrapper with `--root`; cover hidden/private/components filtering, non-index ignores, missing/changed check failures and no check-mode writes. Change the build contract to inspect generated source through `createTemplateRegistrySource()` and cleanup through the real cleaner CLI.

- [ ] **Step 2: Verify contract RED**

Run:

```powershell
pnpm exec vitest run tests/contracts/react-template-registry-generator.test.ts tests/contracts/react-template-build.test.ts
```

Expected: FAIL until Task 3 exposes the new root-aware thin CLI and Task 1/2 APIs.

- [ ] **Step 3: Make only compatibility adjustments needed by the contracts**

Preserve old output text where externally asserted, but do not move business rules back into wrappers.

- [ ] **Step 4: Verify contract GREEN**

Run the same command. Expected: PASS.

---

### Task 5: GitHub Actions Static Contract and Least-Privilege Repair

**Files:**
- Modify: `tests/contracts/workflow-alignment.test.mjs`
- Modify if required by RED: `.github/workflows/issue_geetings.yml`
- Modify if required by RED: `.github/workflows/issue_welcome.yml`
- Modify if required by RED: `.github/workflows/issue_similarity.yml`

**Interfaces:**
- Consumes: seven workflow YAML files and package script names.
- Produces: static guarantees for runners, Node/pnpm versions, package entrypoints and Issue write permissions.

- [ ] **Step 1: Add failing workflow assertions**

Assert:

- CI matrix remains `ubuntu-latest` + `windows-latest`, installs pnpm `9.15.9`, Node `22`, and runs `pnpm check`.
- Preview/release use Node `22.12.0`, frozen installs and `pnpm verify`.
- Issue greeting/welcome/similarity workflows explicitly declare `permissions.issues: write` because they comment/react.
- No workflow directly calls removed business implementation details under `scripts/**`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --test tests/contracts/workflow-alignment.test.mjs
```

Expected: permission assertions fail for the Issue workflows while existing delivery assertions remain green.

- [ ] **Step 3: Add least-privilege workflow permissions**

Add only:

```yaml
permissions:
  issues: write
```

to Issue workflows that create comments or reactions. Preserve triggers, messages and Action inputs.

- [ ] **Step 4: Verify workflow contract GREEN**

Run the Node contract test. Expected: PASS.

---

### Task 6: Local Actions Runbook and Non-Destructive Validation

**Files:**
- Create: `docs/actions-local-validation.md`

**Interfaces:**
- Consumes: audited workflows and environment facts (`act` missing, Docker missing, Node 22.18.0, pnpm 9.15.9).
- Produces: reproducible local validation matrix and exact safe commands.

- [ ] **Step 1: Document the validation boundary**

Record that `uses:` steps, GitHub events, release-please, branch publishing, tokens and Ubuntu runner semantics cannot be fully reproduced locally without Docker/`act` and a disposable GitHub repository. State that `act` also does not faithfully emulate `windows-latest`.

- [ ] **Step 2: Document safe current-worktree commands**

Include:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm template:check
pnpm exec tsc -p tsconfig.template.json --noEmit
pnpm typecheck:test
pnpm test
pnpm test:baseline
node --test tests/contracts/workflow-alignment.test.mjs
```

Explicitly warn that `pnpm build/check/verify` must not run in the current worktree because `build` begins with `rimraf lib`.

- [ ] **Step 3: Document temporary-copy full command validation**

Describe copying the current working state to a verified directory under `$env:TEMP`, excluding `.git` and `node_modules`, running frozen install and `pnpm check` there, then deleting only that verified temp directory. State that this validates command-level Windows behavior, not GitHub-hosted Action behavior.

- [ ] **Step 4: Execute safe command-level checks**

Run the safe commands in the current tree. Run `pnpm check` only in a temporary copy after verifying its absolute path is under `$env:TEMP`.

- [ ] **Step 5: Report the local Actions verdict**

Classify each workflow as `command-level verified`, `static-only`, or `requires GitHub runner/test repository`; do not label any `uses:` workflow as fully locally verified.

---

### Task 7: Regression, Packaging, and Index Refresh

**Files:**
- Verify all files above; do not touch `lib/**` in the original workspace.

**Interfaces:**
- Consumes: completed migration and tests.
- Produces: final evidence with no generated-output damage.

- [ ] **Step 1: Run targeted suites**

```powershell
pnpm exec vitest run tests/unit/template-registry-generator.test.ts tests/unit/template-build-cleaner.test.ts tests/contracts/template-tooling-cli.test.ts tests/contracts/react-template-registry-generator.test.ts tests/contracts/react-template-build.test.ts
node --test tests/contracts/workflow-alignment.test.mjs tests/contracts/migration-tooling.test.mjs
```

Expected: all PASS.

- [ ] **Step 2: Run safe full source checks**

```powershell
pnpm lint
pnpm typecheck
pnpm typecheck:test
pnpm typecheck:template
pnpm template:check
pnpm test
pnpm test:baseline
```

Expected: all PASS without changing original `lib/**`.

- [ ] **Step 3: Validate frozen install and full Action command chain in a temp copy**

Run `pnpm install --frozen-lockfile` and `pnpm check` in the verified temporary copy. Expected: PASS; any failure must be reported with the exact workflow-equivalent command.

- [ ] **Step 4: Verify repository hygiene**

Run `git diff --check` and compare original workspace `lib/**` status before/after. Expected: no new whitespace errors and no new original `lib/**` changes caused by this task.

- [ ] **Step 5: Refresh jCodeMunch index**

Register all edited paths in one batch or re-index the folder, then verify new TS symbols are discoverable.

- [ ] **Step 6: Final report**

Report migrated APIs, test counts, Actions local matrix, `act`/Docker limitation, all changed absolute paths and any remaining GitHub-only validation.

---

## Self-Review

- **Spec coverage:** 两个 `scripts/**` 业务实现均有 TS 模块、薄 CLI、RED/GREEN 测试；Actions 同时覆盖本机命令层、静态契约与 GitHub-only 边界；原工作树 `lib/**` 保护贯穿所有任务。
- **Placeholder scan:** 计划不含 TBD/TODO/“类似前文”等占位步骤；每个测试、接口、命令和预期结果均已明确。
- **Type consistency:** `TemplateRegistryEntry/Plan/CheckResult/SyncResult`、`CleanTemplateBuildResult` 与各任务使用的函数名一致；CLI 只消费这些命名导出。
- **Scope discipline:** 不引入 `tsx`、不重排 `check`、不把 `template:check` 加入 CI、不重构 build watcher、不尝试用生产 token 本地发布。
