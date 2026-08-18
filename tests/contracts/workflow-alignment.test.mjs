import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { parse } from 'yaml'

const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
const readWorkflow = path => parse(readFileSync(path, 'utf8'))

const ciPath = '.github/workflows/ci.yml'
const previewPath = '.github/workflows/build-push-preview.yml'
const releasePath = '.github/workflows/release-and-push-build.yml'
const issueWorkflowPaths = [
  '.github/workflows/issue_geetings.yml',
  '.github/workflows/issue_welcome.yml',
  '.github/workflows/issue_similarity.yml'
]

const findStep = (workflow, jobName, predicate) =>
  workflow.jobs[jobName].steps.find(predicate)

test('delivery workflows follow the reference repository structure', () => {
  assert.equal(existsSync(previewPath), true)
  assert.equal(existsSync(releasePath), true)
  assert.equal(existsSync('.github/workflows/release-please.yml'), false)
  assert.equal(existsSync('.github/workflows/issue_close.yml'), false)
  assert.equal(existsSync('.github/workflows/stale.yml'), true)

  const preview = readWorkflow(previewPath)
  const release = readWorkflow(releasePath)
  const stale = readWorkflow('.github/workflows/stale.yml')

  assert.deepEqual(preview.on.push.branches, ['master'])
  assert.equal(Object.hasOwn(preview.on, 'workflow_dispatch'), true)
  assert.equal(preview.permissions.contents, 'write')
  assert.equal(
    preview.jobs['build-and-push'].steps.at(-1).with.publish_branch,
    'preview'
  )

  assert.deepEqual(release.on.push.branches, ['master'])
  assert.equal(Object.hasOwn(release.on, 'workflow_dispatch'), true)
  assert.equal(release.permissions.contents, 'write')
  assert.equal(release.permissions['pull-requests'], 'write')
  assert.equal(release.permissions.issues, 'write')
  assert.equal(
    release.jobs['release-please'].steps[0].uses,
    'googleapis/release-please-action@v4'
  )
  assert.equal(
    release.jobs['release-please'].steps.at(-1).with.publish_branch,
    'release'
  )

  assert.equal(stale.jobs.stale.steps[0].uses, 'actions/stale@v10')
  assert.equal(stale.permissions.issues, 'write')
  assert.equal(stale.permissions['pull-requests'], 'write')
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
    findStep(ci, 'check', step => step.uses === 'pnpm/action-setup@v4').with
      .version,
    '9.15.9'
  )
  assert.equal(
    findStep(ci, 'check', step => step.uses === 'actions/setup-node@v4').with[
      'node-version'
    ],
    22
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
      findStep(workflow, jobName, step => step.uses === 'pnpm/action-setup@v4').with
        .version,
      '9.15.9'
    )
    assert.equal(
      findStep(workflow, jobName, step => step.uses === 'actions/setup-node@v4')
        .with['node-version'],
      '22.12.0'
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
  const ci = readWorkflow('.github/workflows/ci.yml')

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
  assert.deepEqual(tsconfig.compilerOptions.paths, {
    '@/*': ['./src/*'],
    '~/*': ['./src/*']
  })
  assert.equal(tsconfig.compilerOptions.moduleDetection, 'force')
  assert.equal(tsconfig['tsc-alias'].resolveFullPaths, true)
  assert.match(packageJson.scripts.build, /tsc-alias/)
  assert.ok(packageJson.devDependencies['tsc-alias'])
})
