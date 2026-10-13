import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const source = fileURLToPath(new URL('../../src/runtime/host/puppeteer.ts', import.meta.url))

async function verifyRendererCompatibility () {
  const assert = (await import('node:assert/strict')).default
  const fs = await import('node:fs')
  const path = await import('node:path')
  const vm = await import('node:vm')
  const { stripTypeScriptTypes } = await import('node:module')
  const code = stripTypeScriptTypes(fs.readFileSync(process.argv[1], 'utf8'))
  const makeRenderer = () => ({
    calls: 0,
    dealTpl (name, data) {
      this.calls++
      return `ordinary:${name}:${data.value}`
    }
  })
  const direct = makeRenderer()
  const first = makeRenderer()
  const second = makeRenderer()
  for (const host of [direct, { renderers: new Map([['first', first], ['second', second], ['unsupported', {}]]) }]) {
    const context = vm.createContext({ process })
    const module = new vm.SourceTextModule(code, { context })
    await module.link(async specifier => {
      const values = specifier === 'node:path'
        ? { isAbsolute: path.isAbsolute, relative: path.relative, sep: path.sep }
        : specifier.endsWith('import-host.js')
          ? { importHost: async () => ({ default: host }) }
          : { convertScreenshotToPng: async value => value, ensureImageSegment: value => value, withPngScreenshot: value => value }
      return new vm.SyntheticModule(Object.keys(values), function () {
        for (const [key, value] of Object.entries(values)) this.setExport(key, value)
      }, { context })
    })
    await module.evaluate()
    for (const renderer of host.renderers?.values() ?? [host]) {
      if (typeof renderer.dealTpl !== 'function') continue
      const html = path.join(process.cwd(), 'temp', 'html', 'standalone.html')
      assert.equal(renderer.dealTpl('static', { __kkkStaticHtmlFile: html }), './temp/html/standalone.html')
      assert.equal(renderer.calls, 0, 'standalone HTML must bypass template preprocessing')
      assert.equal(renderer.dealTpl('ordinary', { value: 42 }), 'ordinary:ordinary:42')
      assert.equal(renderer.calls, 1, 'ordinary templates must retain their original receiver')
      assert.equal(renderer.dealTpl('static', { __kkkStaticHtmlFile: path.resolve(process.cwd(), '..', 'outside.html') }), false)
      assert.equal(renderer.dealTpl('static', { __kkkStaticHtmlFile: process.cwd() }), false)
    }
  }
}

test('standalone HTML bypass works with direct renderers and renderer dispatchers', () => {
  const result = spawnSync(process.execPath, [
    '--experimental-vm-modules', '--input-type=module', '-e',
    `await (${verifyRendererCompatibility.toString()})()`, source
  ], { encoding: 'utf8', timeout: 30_000 })
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout)
})
