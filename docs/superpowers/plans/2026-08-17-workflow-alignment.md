# GitHub Actions Workflow Alignment Implementation Plan

> **For Codex:** Follow this plan task-by-task. Preserve unrelated staged and untracked migration work.

**Goal:** Align this repository's TypeScript build configuration plus build-preview and release workflow structure with `KaguyaJs/Yunzai-DF-Plugin`, adapted to this repository's `master` default branch, Node.js 22 requirement, pnpm 9.15.9, stricter existing type checks, and standalone plugin layout.

**Architecture:** Keep the existing cross-platform CI and issue automation. Replace the legacy single-purpose Release Please workflow with two focused delivery workflows: one continuously builds and publishes distributable files to `preview`, while the other uses Release Please v4 and publishes a release build to `release` only after a GitHub release is created. Both workflows derive the distributable file set from `package.json#files` so package metadata and branch artifacts stay synchronized.

**Tech Stack:** GitHub Actions YAML, Release Please v4, `actions/checkout`, `actions/setup-node`, `pnpm/action-setup`, `peaceiris/actions-gh-pages`, Node.js 22, pnpm 9.15.9.

---

## File Structure

- Modify: `package.json`
  - Add the canonical distributable `files` list used by both publishing workflows and run `tsc-alias` after TypeScript compilation.
- Modify: `tsconfig.json`
  - Adopt ES2024, ESNext/bundler resolution, `@/*` and `~/*` aliases, and `tsc-alias` output rewriting while retaining project-specific strictness and ambient types.
- Modify: `pnpm-lock.yaml`
  - Lock `tsc-alias` and `concurrently` for reproducible local and CI builds.
- Create: `.release-please-config.json`
  - Configure the root Node package and changelog sections for Release Please v4.
- Create: `.release-please-manifest.json`
  - Seed Release Please with the current package version.
- Create: `.github/workflows/build-push-preview.yml`
  - Build every push to `master`, package distributable files, remove development dependencies from the copied package metadata, and publish to `preview`.
- Create: `.github/workflows/release-and-push-build.yml`
  - Run Release Please on `master`; after a release is created, build and publish distributable files to `release`.
- Delete: `.github/workflows/release-please.yml`
  - Prevent the obsolete v3 Release Please workflow from running alongside the new v4 release workflow.
- Delete: `.github/workflows/issue_close.yml`
  - Replace the older stale action configuration with the reference-shaped `stale.yml`.
- Preserve: `.github/workflows/ci.yml` and the issue greeting/similarity/welcome workflows
  - They serve repository-specific checks and issue automation not covered by the reference repository.
- Create: `.github/workflows/stale.yml`
  - Provide the reference-shaped scheduled stale workflow with manual dispatch.

## Task 1: Align the TypeScript build configuration

**Files:**
- Modify: `tsconfig.json`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

1. Change the emitted language target to ES2024 and use `ESNext` modules with `Bundler` resolution.
2. Add the reference repository's `@/*` and `~/*` aliases while retaining the current strictness flags and `node`/`trss-yunzai` ambient types.
3. Add `moduleDetection: force` and the `tsc-alias.resolveFullPaths` configuration.
4. Run `tsc-alias` after normal builds and alongside watch builds; add the required development dependencies.
5. Run type checking and build tests before continuing.

## Task 2: Define the distributable contract

**Files:**
- Modify: `package.json`

1. Add a `files` array containing the runtime entry bridges, package/docs/license metadata, compiled `lib`, resources, and default configuration.
2. Ensure mutable runtime data is not shipped from the source repository; include only required static/default assets.
3. Validate JSON parsing and run `pnpm pack --dry-run` (or equivalent listing) to confirm expected files are selected.

## Task 3: Add Release Please v4 configuration

**Files:**
- Create: `.release-please-config.json`
- Create: `.release-please-manifest.json`

1. Configure the root package (`.`) as `release-type: node` with `CHANGELOG.md`.
2. Copy the reference repository's conventional-commit changelog grouping where applicable.
3. Set the manifest version to the current `package.json` version (`2.36.0`).
4. Parse both files as JSON.

## Task 4: Add preview build publishing

**Files:**
- Create: `.github/workflows/build-push-preview.yml`

1. Trigger on pushes to `master` and allow manual dispatch for recovery/testing.
2. Grant only `contents: write` and add concurrency so stale runs do not overwrite newer preview output.
3. Check out the standalone plugin repository, configure Node 22 and pnpm 9.15.9, install with the frozen lockfile, and run the full project verification.
4. Copy every `package.json#files` entry into a temporary publishing directory.
5. Remove `devDependencies` from the copied `package.json` and add `node_modules/` to the publishing branch `.gitignore`.
6. Publish the directory to the `preview` branch with the source commit message.

## Task 5: Replace the legacy release workflow

**Files:**
- Delete: `.github/workflows/release-please.yml`
- Create: `.github/workflows/release-and-push-build.yml`

1. Trigger on pushes to `master` and manual dispatch.
2. Grant Release Please the required contents, pull request, and issue permissions.
3. Run `googleapis/release-please-action@v4` with the repository config and manifest.
4. Gate checkout, setup, install, verification, packaging, and branch publishing on `release_created`.
5. Publish the distributable directory to the `release` branch.
6. Add concurrency to prevent concurrent release publication.

## Task 6: Validate and review

**Files:**
- All files above

1. Parse all workflow YAML with an available YAML parser.
2. Verify action expressions and required keys through a workflow contract script/assertion.
3. Run `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:test`, and relevant tests/build checks.
4. Inspect `git diff` only for the workflow-alignment paths and ensure no unrelated user changes were overwritten.
5. Perform a read-only defect-first review using the `review-agent` criteria; fix only confirmed defects in a subsequent implementation pass, then re-run validation.
