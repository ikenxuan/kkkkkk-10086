import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createTemplateRegistrySource } from '../../src/module/tooling/react-template/registry-generator.js'

interface PackageJson {
  files?: string[]
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const root = resolve(import.meta.dirname, '..', '..')
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as PackageJson
const karinTemplateConfig = readFileSync(resolve(root, 'karin.template.ts'), 'utf8')
const templateBuildSource = readFileSync(
  resolve(root, 'src', 'module', 'tooling', 'template-build.ts'),
  'utf8'
)
const defaultLayoutSource = readFileSync(resolve(root, 'ktr', 'template', 'components', 'DefaultLayout.tsx'), 'utf8')

const isIgnoredByGit = (path: string): boolean => spawnSync(
  'git',
  ['check-ignore', '--no-index', '--quiet', path],
  { cwd: root }
).status === 0

// scripts 里的可执行文件一律按路径直调（node node_modules/<包>/...），不写裸命令。
// 原因：宿主 Yunzai 是 pnpm workspace 根，本插件的 node_modules/.bin 一旦缺失，
// 裸命令就会向上穿透到宿主根 .bin，拿到被 public-hoist 提升上去的另一个版本
// （eslint 就这样从 9.11.1 变成 10.8.1，然后崩在 scopeManager.addGlobals）。
// 所以下面断言「哪一步在做什么」，不断言字面拼写。
const stepsOf = (script: string): string[] => script
  .split('&&')
  .map((step) => step.trim())
  .filter(Boolean)
const isRimrafLib = (step: string): boolean => /\brimraf\b/.test(step) && /(^|[/\s])lib(\s|$)/.test(step)

describe('React template distribution contract', () => {
  it('ignores root-level generated build directories but tracks the test tree', () => {
    expect(isIgnoredByGit('lib/__gitignore_contract__.js')).toBe(true)
    expect(isIgnoredByGit('.generated/__gitignore_contract__.ts')).toBe(true)
    expect(isIgnoredByGit('.ktr/standalone-entry.ts')).toBe(true)

    // tests/ 已经不再被忽略：`/tests/` 从 .gitignore 移除后，这 101 个测试文件进了
    // 仓库，CI 检出后 `pnpm test` / `pnpm test:dist` 才真的有东西可跑。在那之前
    // CI 的 test 步骤是空转，本地测试烂掉没有任何信号（standalone 迁移烂了 11 处
    // 断言、这一轮又烂了 4 个契约测试，两次都是手动跑才发现的）。
    expect(isIgnoredByGit('tests/contracts/__gitignore_contract__.test.ts')).toBe(false)
    // 单数的 test/ 仍然忽略：那是 2025-09 留下的旧草稿目录，自带 node_modules。
    expect(isIgnoredByGit('test/__gitignore_contract__.js')).toBe(true)

    expect(isIgnoredByGit('src/lib/__gitignore_contract__.ts')).toBe(false)
    expect(isIgnoredByGit('src/.generated/__gitignore_contract__.ts')).toBe(false)
    expect(isIgnoredByGit('src/.ktr/__gitignore_contract__.ts')).toBe(false)
  })

  it('has deterministic sync, typecheck and production build commands', () => {
    expect(packageJson.scripts?.['template:sync']).toBeTruthy()
    expect(packageJson.scripts?.['typecheck:template']).toBeTruthy()
    expect(packageJson.scripts?.build).toContain('build:template')

    // 模板构建早已从「两份 Vite 配置」换成 ktr standalone，这两个文件必须不存在，
    // 否则说明有人把旧管线又拖回来了。
    expect(existsSync(resolve(root, 'vite.template.config.ts'))).toBe(false)
    expect(existsSync(resolve(root, 'vite.template-style.config.ts'))).toBe(false)
    expect(packageJson.scripts?.['build:template'] ?? '').not.toContain('vite.template')
  })

  it('drives the standalone template build through the tsconfig-shimming wrapper', () => {
    expect(packageJson.scripts?.['build:template']).toBe('pnpm template:build')
    expect(packageJson.scripts?.['template:build']).toContain('src/module/tooling/template-build.ts')

    // 真正的构建器是 ktr。包一层脚本只为在构建期间临时摘掉两个只描述 src/ 产出边界的
    // 选项——ktr 会用根 tsconfig 去类型检查它自己生成的入口文件，带着 rootDir 会失败。
    //
    // 只断言「跑的是 ktr 的 bin 入口 + build 子命令」，不锁调用拼写：这里曾经是
    // `pnpm exec ktr build`，但 pnpm exec 依赖 node_modules/.bin/ 的 shim，shim 一缺
    // 就会穿透到宿主 Yunzai 根 .bin（那里没有 ktr）导致整步失败，所以改成了直调入口文件。
    expect(templateBuildSource).toMatch(/@karinjs\/template-react\/bin\/ktr\.mjs/)
    expect(templateBuildSource).toMatch(/\[ktrBin, 'build'\]|ktr build/)
    expect(templateBuildSource).toContain('delete compilerOptions.rootDir')
    expect(templateBuildSource).toContain('delete compilerOptions.noUncheckedIndexedAccess')
    // ktr 那遍类型检查也吃根 tsconfig 的 paths，而根 tsconfig 平时把 @kkk/richtext 指向
    // src 侧的 react-free 核心（rootDir 限制所致）。模板树要的是 barrel 补上的
    // renderRichTextToReact，所以这段窗口里必须重指向 ktr/richtext/index.ts；
    // karin.template.ts 的 vite alias 只管打包解析，管不到这遍类型检查。
    expect(templateBuildSource).toContain("'@kkk/richtext': ['./ktr/richtext/index.ts']")
    // 必须放在 finally 里还原，否则一次构建失败就把 tsconfig.json 永久改脏。
    expect(templateBuildSource).toMatch(/finally\s*\{\s*writeFileSync\(tsconfigPath, original/)
  })

  it('declares a Yunzai-loadable single-chunk standalone output', () => {
    expect(karinTemplateConfig).toContain("outDir: 'lib/react-template'")
    expect(karinTemplateConfig).toContain("format: 'esm'")
    expect(karinTemplateConfig).toContain("target: 'node22'")
    // registry.ts 通过 import() 直接加载 lib/react-template/index.mjs 这一个文件。
    // singleChunk 一旦变 false 就会产出分片目录，那条 import 会立刻找不到依赖。
    expect(karinTemplateConfig).toContain('singleChunk: true')
    expect(karinTemplateConfig).not.toContain('manualChunks')
    expect(karinTemplateConfig).toContain('sourcemap: false')
  })

  it('restores and watches all template artifacts in build:watch', () => {
    const buildWatch = packageJson.scripts?.['build:watch'] ?? ''
    const steps = stepsOf(buildWatch)

    expect(steps.findIndex(isRimrafLib)).toBe(0)
    expect(steps.indexOf('pnpm build:template')).toBeGreaterThan(steps.findIndex(isRimrafLib))
    expect(steps.indexOf('pnpm build:template'))
      .toBeLessThan(steps.findIndex((step) => step.includes('concurrently')))
    expect(buildWatch).not.toContain('vite build --watch')
  })

  it('cleans stale template-owned outputs without touching unrelated lib output', () => {
    const cleanerCli = resolve(root, 'src', 'module', 'tooling', 'react-template', 'build-cleaner-cli.ts')
    expect(existsSync(cleanerCli)).toBe(true)
    expect(packageJson.scripts?.['clean:template']).toContain('build-cleaner-cli.ts')

    // 完整 build 由开头的 rimraf lib 负责清场，所以 build:template 不再自己调
    // clean:template；后者留给「只重建模板」和从旧 checkout 升级的场景。
    expect(isRimrafLib(stepsOf(packageJson.scripts?.build ?? '')[0] ?? '')).toBe(true)

    const temporaryRoot = mkdtempSync(join(tmpdir(), 'kkkkkk-template-clean-'))
    const staleFiles = [
      // 当前产物
      'lib/react-template/index.mjs',
      'lib/react-template/index.d.mts',
      // 分片产物时代的遗留物
      'lib/template-registry.js',
      'lib/template-registry.js.map',
      'lib/template-style.css',
      'lib/template-style.css.map',
      'lib/template-chunks/old-hash.js',
      'lib/template-assets/old-hash.woff2'
    ]
    const unrelatedFile = resolve(temporaryRoot, 'lib/module/keep.js')

    try {
      for (const file of staleFiles) {
        const absolute = resolve(temporaryRoot, file)
        mkdirSync(dirname(absolute), { recursive: true })
        writeFileSync(absolute, 'stale')
      }
      mkdirSync(dirname(unrelatedFile), { recursive: true })
      writeFileSync(unrelatedFile, 'keep')

      execFileSync(process.execPath, [
        '--experimental-strip-types',
        cleanerCli,
        '--root',
        temporaryRoot
      ])

      for (const file of staleFiles) expect(existsSync(resolve(temporaryRoot, file))).toBe(false)
      expect(readFileSync(unrelatedFile, 'utf8')).toBe('keep')
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true })
    }
  })

  it('keeps framework scale and stacking-context ownership in the SSR wrapper', () => {
    expect(defaultLayoutSource).not.toContain('zoom: scale')
    expect(defaultLayoutSource).not.toContain("isolation: 'isolate'")
    expect(defaultLayoutSource).not.toContain('const { scale = 1')
  })

  it('scans every ktr source directory that writes class names, not just ktr/template', () => {
    /*
      Tailwind v4 的 `@source` 相对 CSS 文件自身解析，而 style.css 在 ktr/template/，
      所以只写一条模板目录的 glob 时，ktr/utils、ktr/richtext 这些**兄弟目录**压根不被
      扫描 —— 里面的类名对 Tailwind 不存在，任意值就不生成规则。

      症状是「偶尔生效」，所以极难发现：只要 ktr/template 下**碰巧**有别的模板用了同一个
      值，规则就已经生成了，兄弟目录白蹭一个。只有那个值在整个 ktr/template 里没人用过，
      才会静默失效 —— 类名照样出现在 HTML 上，但没有规则，字号回落到继承值。
      实测过的两处：ktr/utils 的 `text-[3rem]` 渲染成 16px（期望 48px）、
      ktr/richtext 的 `text-[58px]` 和 `leading-[1.8]` 同样无规则。

      因此断言「哪些目录被扫」而不是断言那几行 glob 的字面拼写：新增一个会写 className
      的 ktr 子目录、却忘了补 @source 时，这条就红。
    */
    const styleSheet = readFileSync(resolve(root, 'ktr', 'template', 'style.css'), 'utf8')
    const sourceGlobs = [...styleSheet.matchAll(/@source\s+'([^']+)'/g)].map((match) => match[1])
    expect(sourceGlobs.length).toBeGreaterThan(0)

    // @source 是相对 ktr/template/ 解析的，换算成 ktr/ 下的目录名
    const scanned = new Set(sourceGlobs.map((glob) => {
      const normalized = glob.replace(/^\.\//, '')
      return normalized.startsWith('../') ? normalized.slice(3).split('/')[0] : 'template'
    }))

    /*
      判定「这个目录贡献了类名」不能只看 `className=`：类名也可以是被**返回**的字符串，
      由别处拼到 className 上。`ktr/utils/media-format.ts` 的 valueSizeClass 就是这样
      —— 它是本条契约要防的那个真实 bug 的现场，却一个 `className=` 都没有。
      只按属性名判定的话，这条断言对 ktr/utils **恒真**（集合里压根没有它），
      测试绿着而 bug 照旧。所以同时认「任意值类名字面量」（`text-[3rem]` 这种
      带方括号的形态，也正是缺了规则就静默失效的那一类）。
    */
    const writesClassNames = (source: string): boolean =>
      /\bclassName\s*=|\bclass\s*=/.test(source) ||
      /['"`][^'"`]*[a-z]-\[[^\]]+\]/.test(source)

    const ktrRoot = resolve(root, 'ktr')
    const hasClassNames = readdirSync(ktrRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => {
        const files = execFileSync(
          'git',
          ['ls-files', `ktr/${entry.name}`],
          { cwd: root, encoding: 'utf8' }
        ).split('\n').filter((file) => /\.(?:tsx?|jsx?)$/.test(file))
        // ktr/font 全是 css，没有类名，不需要被扫
        return files.some((file) => writesClassNames(readFileSync(resolve(root, file), 'utf8')))
      })
      .map((entry) => entry.name)

    expect(hasClassNames).toContain('template')
    for (const directory of hasClassNames) {
      expect(scanned).toContain(directory)
    }
  })

  it('keeps CSS and Tailwind out of the SSR registry entry', () => {
    const registrySource = createTemplateRegistrySource([{
      route: 'section/card',
      file: resolve(root, 'ktr', 'template', 'section', 'card', 'index.tsx')
    }], resolve(root, '.generated'))

    expect(registrySource).not.toContain('style.css')
    expect(registrySource).not.toContain('tailwind')
    // ktr 自己注册 Tailwind 与样式入口；在 karin.template.ts 里再注册一遍会重复处理。
    expect(karinTemplateConfig).not.toContain('@tailwindcss/vite')
    expect(karinTemplateConfig).not.toContain('tailwindcss()')
  })

  it('declares only framework-neutral React rendering dependencies', () => {
    expect(packageJson.dependencies?.react).toBeTruthy()
    expect(packageJson.dependencies?.['react-dom']).toBeTruthy()
    expect(packageJson.dependencies?.['node-karin']).toBeUndefined()
    expect(packageJson.dependencies?.vite).toBeUndefined()
    expect(packageJson.dependencies?.tailwindcss).toBeUndefined()
    expect(packageJson.devDependencies?.vite).toBeTruthy()
    expect(packageJson.devDependencies?.tailwindcss).toBeTruthy()
    expect(packageJson.devDependencies?.['@karinjs/template-react']).toBeTruthy()
  })

  it('ships all runtime inputs without requiring TSX compilation after install', () => {
    expect(packageJson.files).toEqual(expect.arrayContaining([
      'lib',
      'resources',
      'THIRD_PARTY_NOTICES.md'
    ]))
    expect(existsSync(resolve(root, 'karin.template.ts'))).toBe(true)
    expect(existsSync(resolve(root, 'tsconfig.template.json'))).toBe(true)
    expect(existsSync(resolve(root, 'src', 'module', 'tooling', 'react-template', 'registry-cli.ts'))).toBe(true)
    expect(existsSync(resolve(root, 'ktr', 'template', 'other', 'help', 'index.tsx'))).toBe(true)
  })
})
