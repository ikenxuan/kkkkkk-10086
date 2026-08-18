import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import template from 'art-template'

import {
  renderTemplateDocument,
  resolveTemplateAsset
} from '../../src/module/utils/react-template/html.js'

const temporaryDirectories: string[] = []

const makeTemporaryDirectory = (name: string): string => {
  const directory = mkdtempSync(join(tmpdir(), name))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('React template HTML generation', () => {
  it('uses React escaping instead of interpolating untrusted data into HTML', async () => {
    const assetsDir = makeTemporaryDirectory('kkkkkk-react-html-')
    const payload = '</script><script>globalThis.pwned=true</script><img src=x onerror=alert(1)>'
    const Component = ({ data }: { data: { value: string } }) =>
      createElement('article', { 'data-value': data.value }, data.value)

    const result = await renderTemplateDocument({
      route: 'other/help',
      component: Component,
      data: { value: payload },
      context: { scale: 1 },
      css: '#container { display: inline-block; }',
      assetsDir
    })

    const html = result.html
    expect(html).not.toContain(payload)
    expect(html).not.toContain('<script>globalThis.pwned=true</script>')
    expect(html).toContain('&lt;/script&gt;&lt;script&gt;globalThis.pwned=true&lt;/script&gt;')
    expect(html.match(/<!doctype html>/gi)).toHaveLength(1)
    expect(html.match(/<html\b/gi)).toHaveLength(1)
    expect(html.match(/id="container"/g)).toHaveLength(1)
    expect(html).toContain('<style>#container { display: inline-block; }</style>')
  })

  it('waits for React 19 async server components before returning HTML', async () => {
    const assetsDir = makeTemporaryDirectory('kkkkkk-react-async-')
    const Component = async ({ data }: { data: { value: string } }) => {
      await Promise.resolve()
      return createElement('span', null, `async:${data.value}`)
    }

    const result = await renderTemplateDocument({
      route: 'other/qrlogin',
      component: Component,
      data: { value: 'ready' },
      context: { scale: 1 },
      css: '',
      assetsDir
    })

    expect(result.html).toContain('<span>async:ready</span>')
  })

  it('writes the dark theme contract onto the document body', async () => {
    const assetsDir = makeTemporaryDirectory('kkkkkk-react-theme-')
    const Component = () => createElement('span', null, 'dark')

    const result = await renderTemplateDocument({
      route: 'other/help',
      component: Component,
      data: {},
      context: { scale: 1, theme: { mode: 'dark' } },
      css: '',
      assetsDir
    })

    expect(result.html).toContain('<body class="dark" data-theme="dark"')
    expect(result.html).toContain('background:transparent')
  })

  it('applies a valid render scale once at the framework container', async () => {
    const assetsDir = makeTemporaryDirectory('kkkkkk-react-scale-')
    const result = await renderTemplateDocument({
      route: 'other/help',
      component: () => createElement('span', null, 'scaled'),
      data: {},
      context: { scale: 2 },
      css: '',
      assetsDir
    })

    expect(result.html).toContain('#container{position:relative;flex-shrink:0;isolation:isolate;zoom:2}')
  })

  it.each([Number.NaN, 0, -1, Number.POSITIVE_INFINITY])(
    'falls back to unscaled rendering for an invalid scale (%s)',
    async (scale) => {
      const assetsDir = makeTemporaryDirectory('kkkkkk-react-invalid-scale-')
      const result = await renderTemplateDocument({
        route: 'other/help',
        component: () => createElement('span', null, 'unscaled'),
        data: {},
        context: { scale },
        css: '',
        assetsDir
      })

      expect(result.html).toContain('#container{position:relative;flex-shrink:0;isolation:isolate}')
      expect(result.html).not.toContain('zoom:')
    }
  )

  it('resolves only files contained by the configured assets directory', () => {
    const assetsDir = makeTemporaryDirectory('kkkkkk-react-assets-')
    const imagePath = join(assetsDir, 'image', 'logo.svg')
    const imageDirectory = join(assetsDir, 'image')
    // The resolver contract is independent from the payload format.
    writeFileSync(join(assetsDir, 'outside.txt'), 'outside')

    expect(resolveTemplateAsset('/image/logo.svg', assetsDir)).toBe(imagePath)
    expect(resolveTemplateAsset('image/logo.svg', assetsDir)).toBe(imagePath)
    expect(resolveTemplateAsset('../outside.txt', imageDirectory)).toBeUndefined()
    expect(resolveTemplateAsset('https://example.com/logo.svg', assetsDir)).toBeUndefined()
    expect(resolveTemplateAsset('data:image/png;base64,AA==', assetsDir)).toBeUndefined()
  })

  it('resolves compiled CSS assets from a root separate from template markup assets', async () => {
    const assetsDir = makeTemporaryDirectory('kkkkkk-react-markup-assets-')
    const cssAssetsDir = makeTemporaryDirectory('kkkkkk-react-css-assets-')
    const fontDirectory = join(cssAssetsDir, 'template-assets')
    mkdirSync(fontDirectory, { recursive: true })
    writeFileSync(join(fontDirectory, 'poster.woff2'), Buffer.from('font-data'))

    const result = await renderTemplateDocument({
      route: 'other/help',
      component: () => createElement('span', null, 'font'),
      data: {},
      context: { scale: 1 },
      css: '@font-face{src:url("/template-assets/poster.woff2") format("woff2")}',
      assetsDir,
      cssAssetsDir
    })

    expect(result.html).toContain('url("data:font/woff2;base64,Zm9udC1kYXRh")')
    expect(result.html).not.toContain('/template-assets/poster.woff2')
  })

  it('keeps assets larger than the default inline limit as file URLs', async () => {
    const assetsDir = makeTemporaryDirectory('kkkkkk-react-large-assets-')
    const fontDirectory = join(assetsDir, 'template-assets')
    const fontPath = join(fontDirectory, 'large.woff2')
    mkdirSync(fontDirectory, { recursive: true })
    writeFileSync(fontPath, Buffer.alloc(4097, 1))

    const result = await renderTemplateDocument({
      route: 'other/help',
      component: () => createElement('span', null, 'large-font'),
      data: {},
      context: { scale: 1 },
      css: '@font-face{src:url("/template-assets/large.woff2")}',
      assetsDir
    })

    expect(result.html).toContain(`url("${pathToFileURL(fontPath).href}")`)
    expect(result.html).not.toContain('data:font/woff2;base64,')
  })

  it('reuses rewritten CSS assets for identical render inputs', async () => {
    const assetsDir = makeTemporaryDirectory('kkkkkk-react-cached-assets-')
    const fontDirectory = join(assetsDir, 'template-assets')
    const fontPath = join(fontDirectory, 'cached.woff2')
    const css = '@font-face{src:url("/template-assets/cached.woff2")}'
    mkdirSync(fontDirectory, { recursive: true })
    writeFileSync(fontPath, Buffer.from('cached-font'))

    const render = async () => await renderTemplateDocument({
      route: 'other/help',
      component: () => createElement('span', null, 'cached-font'),
      data: {},
      context: { scale: 1 },
      css,
      assetsDir
    })

    const first = await render()
    unlinkSync(fontPath)
    const second = await render()

    expect(first.html).toContain('data:font/woff2;base64,Y2FjaGVkLWZvbnQ=')
    expect(second.html).toBe(first.html)
  })

  it('inserts SSR HTML through the Yunzai raw bridge without recursively parsing braces', () => {
    const bridge = readFileSync(resolve('resources/react-template/bridge.html'), 'utf8')
    const ssrHtml = '<!doctype html><html><body><div id="container">{{ user.name }} {{if dangerous}}</div></body></html>'

    const rendered = template.compile(bridge)({ ssrHtml })

    expect(rendered.trim()).toBe(ssrHtml)
  })
})
