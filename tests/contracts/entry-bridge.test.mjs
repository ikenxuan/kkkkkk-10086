import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('root entries are exact distribution bridges', async () => {
  assert.equal(
    await readFile(join(repositoryRoot, 'index.js'), 'utf8'),
    "export * from './lib/index.js'\n"
  )
  assert.equal(
    await readFile(join(repositoryRoot, 'guoba.support.js'), 'utf8'),
    "export * from './lib/guoba.support.js'\n"
  )
})
