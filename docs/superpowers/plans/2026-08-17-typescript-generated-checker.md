# TypeScript Generated Output Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the root `scripts/check-generated.mjs` implementation with a typed source file under `src/`, remove the root `scripts/` directory, and preserve generated-output drift verification.

**Architecture:** The checker implementation will live at `src/scripts/check-generated.ts` and remain a small ESM module exporting `findGeneratedDrift(repositoryRoot?: string): string[]`. TypeScript compilation will emit `lib/scripts/check-generated.js`; package verification will execute that generated entry, while Vitest imports the TypeScript source through the repository's NodeNext/Vite resolution conventions.

**Tech Stack:** TypeScript 5.9, Node.js ESM, Vitest, pnpm, Git CLI.

## Global Constraints

- Keep Node.js compatibility at `>=22.12.0`.
- Do not add a runtime or development dependency.
- Preserve the existing behavior: report modified tracked files and untracked files under `lib/`, but do not report staged generated files.
- Delete the root `scripts/` directory after migration.
- Keep `pnpm verify:generated`, `pnpm verify`, TypeScript checks, and generated distribution output functional.

---

### Task 1: Define the TypeScript checker contract

**Files:**
- Modify: `tests/unit/check-generated.test.ts`
- Create: `src/scripts/check-generated.ts`
- Delete: `scripts/check-generated.mjs`

**Interfaces:**
- Produces: `findGeneratedDrift(repositoryRoot?: string): string[]`
- Produces: a directly executable ESM module that sets a failing exit code when drift exists.

- [ ] **Step 1: Write the failing test**

Update the unit test to import `../../src/scripts/check-generated.js` and require the TypeScript source path. Preserve behavioral checks using temporary real Git repositories.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm vitest run tests/unit/check-generated.test.ts`
Expected: FAIL because `src/scripts/check-generated.ts` does not exist.

- [ ] **Step 3: Write the minimal TypeScript implementation**

Create `src/scripts/check-generated.ts` with typed `runGit` and exported `findGeneratedDrift`, preserving direct-execution behavior. Delete `scripts/check-generated.mjs` after the new implementation exists.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm vitest run tests/unit/check-generated.test.ts`
Expected: PASS.

### Task 2: Route verification through generated TypeScript output

**Files:**
- Modify: `package.json`
- Modify: generated `lib/scripts/check-generated.js`
- Test: `tests/contracts/*.test.mjs`

**Interfaces:**
- Consumes: compiled `lib/scripts/check-generated.js`
- Produces: `verify:generated` package command.

- [ ] **Step 1: Update the package command**

Change `verify:generated` to execute `node lib/scripts/check-generated.js`.

- [ ] **Step 2: Build the TypeScript project**

Run: `pnpm build`
Expected: `lib/scripts/check-generated.js` is emitted and the old root `scripts/` directory remains absent.

- [ ] **Step 3: Run focused and contract verification**

Run: `pnpm typecheck && pnpm typecheck:test && pnpm test && pnpm test:baseline && pnpm test:dist && pnpm verify:generated`
Expected: all commands PASS.

- [ ] **Step 4: Check generated output and repository state**

Run: `git diff --check` and inspect `git status --short`.
Expected: no whitespace errors; expected source, test, package, generated-file, deletion, and plan changes only.
