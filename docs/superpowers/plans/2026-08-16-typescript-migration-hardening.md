# TypeScript Migration Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining TypeScript migration verification gaps without changing plugin runtime behavior.

**Architecture:** Keep `src/**/*.ts` as the source of truth and `lib/**/*.js` as committed build output. Add a separate TypeScript project for tests/config, contract-test the migration scripts, and make the default verification chain check source baselines plus generated-output drift.

**Tech Stack:** TypeScript 5.9, Node.js 22 ESM, Vitest 3, pnpm 9, GitHub Actions.

## Global Constraints

- Preserve the production entry chain `index.js -> lib/index.js`.
- Do not hand-edit generated files under `lib/`; regenerate them with `pnpm build`.
- Preserve all existing application names and runtime exports.
- Follow test-driven development: each behavior change must first have a failing test.
- Do not overwrite unrelated migration work already present in the working tree.

---

### Task 1: Contract the migration verification chain

**Files:**
- Create: `tests/contracts/migration-tooling.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `package.json` scripts.
- Produces: a default `check` chain containing `typecheck:test` and `test:baseline`, plus a `verify:generated` command.

- [x] **Step 1: Write the failing contract test**

Assert that `package.json` exposes `typecheck:test` and `verify:generated`, that `check` runs `typecheck:test` and `test:baseline`, and that `verify` runs the generated-output check.

- [x] **Step 2: Run the contract test and verify it fails**

Run: `node --test tests/contracts/migration-tooling.test.mjs`

Expected: FAIL because the new scripts and check-chain entries do not yet exist.

- [x] **Step 3: Add the minimal package scripts**

Add:

```json
"typecheck:test": "tsc -p tsconfig.test.json --noEmit",
"verify:generated": "node scripts/check-generated.mjs"
```

Extend `check` with `typecheck:test` and `test:baseline`, and extend `verify` with `verify:generated`.

- [x] **Step 4: Re-run the contract test**

Run: `node --test tests/contracts/migration-tooling.test.mjs`

Expected: PASS.

---

### Task 2: Type-check tests and Vitest configuration

**Files:**
- Create: `tsconfig.test.json`
- Test: `tests/contracts/migration-tooling.test.mjs`

**Interfaces:**
- Consumes: strict compiler options from `tsconfig.json`.
- Produces: `pnpm typecheck:test`, covering `src/**/*.ts`, `tests/**/*.ts`, and `vitest.config.ts` without emitting files.

- [x] **Step 1: Extend the failing contract test**

Assert that `tsconfig.test.json` extends `./tsconfig.json`, sets `rootDir` to `.`, enables `noEmit`, includes source/tests/Vitest config, and excludes `lib` and `node_modules`.

- [x] **Step 2: Run the contract test and verify it fails**

Run: `node --test tests/contracts/migration-tooling.test.mjs`

Expected: FAIL because `tsconfig.test.json` does not exist.

- [x] **Step 3: Add the minimal test TypeScript project**

Create `tsconfig.test.json` with the exact include/exclude boundaries described above.

- [x] **Step 4: Run type checking**

Run: `pnpm typecheck:test`

Expected: PASS; if existing test typing defects are exposed, fix only those defects without weakening strictness.

---

### Task 3: Detect generated-output drift including untracked files

**Files:**
- Create: `scripts/check-generated.mjs`
- Create: `tests/unit/check-generated.test.ts`

**Interfaces:**
- Produces: `findGeneratedDrift(repositoryRoot?: string): string[]` and a CLI that exits non-zero when tracked `lib` files differ from the index or untracked `lib` files exist.

- [x] **Step 1: Write failing unit tests**

Use temporary Git repositories to verify:

```text
clean generated output -> []
modified tracked lib file -> drift entry
new untracked lib file -> drift entry
staged generated file -> not treated as working-tree drift
```

- [x] **Step 2: Run the unit test and verify it fails**

Run: `pnpm vitest run tests/unit/check-generated.test.ts`

Expected: FAIL because `scripts/check-generated.mjs` does not exist.

- [x] **Step 3: Implement the minimal Node ESM checker**

Use `git diff --name-only -- lib` for tracked working-tree changes and `git ls-files --others --exclude-standard -- lib` for untracked generated files. Export the function and implement the CLI exit behavior.

- [x] **Step 4: Re-run unit and contract tests**

Run:

```bash
pnpm vitest run tests/unit/check-generated.test.ts
node --test tests/contracts/migration-tooling.test.mjs
```

Expected: PASS.

---

### Task 4: Full migration verification

**Files:**
- Modify generated output only through: `pnpm build`

**Interfaces:**
- Consumes: all scripts and configs added above.
- Produces: a green migration verification chain.

- [x] **Step 1: Run focused checks**

```bash
pnpm typecheck
pnpm typecheck:test
pnpm test:baseline
pnpm test
```

- [x] **Step 2: Build distribution output**

Run: `pnpm build`

- [x] **Step 3: Validate generated output and lint**

```bash
pnpm lint
pnpm verify:generated
```

- [x] **Step 4: Run the complete chain**

Run: `pnpm check`

Expected: PASS with no TypeScript, test, build, or lint failures.
