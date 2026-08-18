import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import test from 'node:test'

const importBuilt = async path => await import(`${pathToFileURL(path).href}?dist-test=${Date.now()}`)

test('built React template registry renders a bounded standalone HTML document', async () => {
  assert.equal(existsSync('lib/template-registry.js'), true)
  assert.equal(existsSync('lib/template-style.css'), true)
  assert.equal(existsSync('resources/react-template/bridge.html'), true)

  const builtRegistry = await importBuilt('lib/template-registry.js')
  assert.equal(Object.keys(builtRegistry.templates).length, 35)
  assert.ok(builtRegistry.templates['other/help'])

  const runtime = await importBuilt('lib/module/utils/react-template/registry.js')
  const result = await runtime.renderReactTemplate(
    'other/help',
    { title: 'DIST_CONTRACT', list: [], menu: [] },
    { scale: 1, theme: { mode: 'light' } }
  )

  assert.equal(result.route, 'other/help')
  assert.match(result.html, /^<!doctype html>/i)
  assert.match(result.html, /DIST_CONTRACT/)
  assert.ok(Buffer.byteLength(result.html) < 2 * 1024 * 1024)
  const fileFontUrls = result.html.match(/file:\/\/\/[^)'"\s]*template-assets[^)'"\s]*\.woff2/gi) ?? []
  assert.equal(new Set(fileFontUrls).size, 17)
  assert.doesNotMatch(result.html, /url\(\s*['"]?\/template-assets\//i)
})
