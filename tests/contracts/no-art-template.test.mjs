import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const packageJson = JSON.parse(read('package.json'))

const sourceFiles = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const target = path.join(directory, entry.name)
  if (entry.isDirectory()) return sourceFiles(target)
  return /\.(?:ts|tsx)$/.test(entry.name) ? [target] : []
})

test('the plugin does not install art-template as a rendering dependency', () => {
  assert.equal(packageJson.dependencies?.['art-template'], undefined)
  assert.equal(packageJson.devDependencies?.['art-template'], undefined)
  assert.doesNotMatch(read('pnpm-lock.yaml'), /^\s+art-template:/m)
  assert.doesNotMatch(read('pnpm-lock.yaml'), /^\s+art-template@/m)
})

test('image rendering has no legacy HTML fallback or bridge template', () => {
  const renderSource = read('src/module/utils/Render.ts')
  assert.doesNotMatch(renderSource, /回退旧模板|defaultLayout|_layout_path|ssrHtml/)
  assert.doesNotMatch(renderSource, /resources[\\/]template/)
  assert.doesNotMatch(read('src/module/server/index.ts'), /resources[\\/]template[\\/]videoView/)
  assert.doesNotMatch(read('src/apps/admin.ts'), /Render\(['"]admin\/index/)
  assert.match(read('src/apps/admin.ts'), /锅巴/)
  assert.equal(fs.existsSync(path.join(root, 'resources', 'react-template', 'bridge.html')), false)
  assert.equal(fs.existsSync(path.join(root, 'resources', 'template')), false)
})

test('the React renderer owns the static HTML handoff to Yunzai Puppeteer', () => {
  const renderSource = read('src/module/utils/Render.ts')
  const registrySource = read('src/module/utils/react-template/registry.ts')
  const hostSource = read('src/runtime/host/puppeteer.ts')

  // standalone 运行时自己 SSR、自己把文档写进一次性目录，交回来的是路径 + cleanup，
  // 不再是 HTML 字符串。Render 只负责截图和善后。
  assert.match(renderSource, /renderReactTemplate/)
  assert.match(renderSource, /rendered\.htmlPath/)
  // 少了这个 finally，每次截图失败都会在 temp/html 下留一个孤儿目录。
  assert.match(renderSource, /finally\s*\{\s*await rendered\.cleanup\(\)/)

  assert.match(registrySource, /createTemplateRenderer/)
  assert.match(registrySource, /'lib', 'react-template', 'index\.mjs'/)
  assert.match(hostSource, /screenshotFile/)

  // art-template 的规避方式已经从「转义内容里的 {{」换成「在 dealTpl 层直接拦下
  // KKK 自己的文档、返回原路径」，让 Yunzai 的模板编译一步都不执行——
  // 这比转义更彻底，也是 escapeTemplateDelimiters/withStaticHtmlFile 被删掉的原因。
  assert.match(hostSource, /dealTpl/)
  assert.match(hostSource, /STATIC_HTML_FILE_KEY/)
  assert.equal(fs.existsSync(path.join(root, 'src/module/utils/react-template/static.ts')), false)
  assert.equal(fs.existsSync(path.join(root, 'src/module/utils/react-template/html.ts')), false)
})

test('every literal Render call resolves to a React route', () => {
  const routeSource = read('src/module/utils/react-template/routes.ts')
  const registered = new Set([...routeSource.matchAll(/^\s*'([^']+)'/gm)].map(match => match[1]))
  const used = sourceFiles(path.join(root, 'src')).flatMap(file => {
    const source = fs.readFileSync(file, 'utf8')
    return [...source.matchAll(/\bRender\(\s*['"]([^'"]+)['"]/g)].map(match => match[1])
  })
  const missing = [...new Set(used)].filter(route => !registered.has(route))
  assert.deepEqual(missing, [])
})
