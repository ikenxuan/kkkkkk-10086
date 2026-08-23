import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '..', '..')
const importBuilt = async relative => await import(pathToFileURL(path.join(root, relative)).href)

test('the standalone bundle ships the two artifacts the runtime and typechecker load', () => {
  // registry.ts 用 import() 直接加载这一个文件；index.d.mts 是 tsc 唯一能看到的类型面。
  assert.equal(existsSync(path.join(root, 'lib/react-template/index.mjs')), true)
  assert.equal(existsSync(path.join(root, 'lib/react-template/index.d.mts')), true)

  // 分片管线时代的产物必须一个都不剩：留着的话 clean:template 会被误认为已经生效，
  // 而 registry.ts 的那条 import 早就不看它们了。
  for (const stale of [
    'lib/template-registry.js',
    'lib/template-style.css',
    'lib/template-chunks',
    'lib/template-assets',
    'resources/react-template/bridge.html'
  ]) {
    assert.equal(existsSync(path.join(root, stale)), false, `${stale} 应当已被 standalone 迁移删除`)
  }
})

test('the bundle exposes createTemplateRenderer as its only required entry point', async () => {
  const standalone = await importBuilt('lib/react-template/index.mjs')
  // registry.ts 在这个导出缺失时会抛一条自己的错误信息，单独断言是为了让构建配置
  // （karin.template.ts 的 singleChunk / format）出问题时失败信息指向真正的原因。
  assert.equal(typeof standalone.createTemplateRenderer, 'function')
})

test('the built renderer writes one self-contained document into a disposable directory', async () => {
  const runtime = await importBuilt('lib/module/utils/react-template/registry.js')
  const rendered = await runtime.renderReactTemplate(
    'other/help',
    { title: 'DIST_CONTRACT', list: [], menu: [] },
    { scale: 1, theme: { mode: 'light' } }
  )

  try {
    // 返回的是路径 + cleanup，不是 HTML 字符串。回到字符串形态就意味着有人重新把文档
    // 交给 Yunzai 的 dealTpl 去编译，art-template 会再次咬到模板里的 {{。
    assert.deepEqual(Object.keys(rendered).sort(), ['cleanup', 'htmlPath', 'route'])
    assert.equal(rendered.route, 'other/help')
    assert.equal(typeof rendered.cleanup, 'function')

    const outputDir = path.dirname(rendered.htmlPath)
    // 产物落在 cwd 下的 temp/html（已在 .gitignore 里），而不是仓库里任意位置。
    assert.equal(
      path.resolve(outputDir, '..'),
      path.join(process.cwd(), 'temp', 'html'),
      '渲染目录必须落在 temp/html 下，否则每次渲染都会往仓库里撒目录'
    )
    assert.match(path.basename(outputDir), /^kkkkkk-10086-ktr-/)

    // 这条断言是下面所有「必须内联」断言的依据：目录里除了 HTML 什么都没有，
    // 所以任何相对路径或 file:// 引用在 Puppeteer 里都是 404。
    assert.deepEqual(readdirSync(outputDir), [path.basename(rendered.htmlPath)])

    const html = readFileSync(rendered.htmlPath, 'utf8')
    assert.match(html, /^<!doctype html>/i)
    assert.match(html, /DIST_CONTRACT/)

    // 双向边界：上界拦文档膨胀，下界证明 CSS 与字体真的被内联了——
    // 只有几 KB 说明产出的是一个引用全断的空壳。
    const bytes = Buffer.byteLength(html)
    assert.ok(bytes > 100 * 1024, `文档只有 ${bytes} 字节，样式与字体没有被内联进来`)
    assert.ok(bytes < 2 * 1024 * 1024, `文档膨胀到 ${bytes} 字节`)

    assert.match(html, /@font-face/)
    assert.match(html, /data:font\/woff2/)
    assert.equal(html.match(/file:\/\//gi), null, '不能出现 file:// 引用')
    assert.doesNotMatch(html, /\/template-assets\//i)
    assert.equal(
      html.match(/(?:src|href)="(?!data:|https?:|#)[^"]*"/gi),
      null,
      '不能出现相对路径资源引用：一次性目录里只有这一个 HTML 文件'
    )

    // 静态 SSR 文档，没有脚本。有脚本就意味着截图可能抓到 hydration 之前的那一帧，
    // 而 screenshotFile 不会等 JS 跑完。
    assert.equal(html.match(/<script/gi), null)

    await rendered.cleanup()
    assert.equal(existsSync(outputDir), false, 'cleanup 必须删掉整个一次性目录')
    // 幂等：Render.ts 的 finally 和错误分支都可能调到它。
    await rendered.cleanup()
  } finally {
    await rendered.cleanup()
  }
})
