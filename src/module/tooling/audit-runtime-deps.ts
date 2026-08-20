import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 校验构建产物里的运行时导入都声明在 `dependencies` 里。
 *
 * 起因：`src/module/platform/douyin/render.ts` 从 39b5980 起 `import { format,
 * fromUnixTime } from 'date-fns'`，而 date-fns 一直挂在 devDependencies 下。
 * 本地和 CI 都装全量依赖，所以 lint / typecheck / build / 全量测试全绿；
 * 但发布流水线（build-push-preview.yml、release-and-push-build.yml）在推分支前会跑
 * `pnpm pkg delete devDependencies`，用户装到的 package.json 里根本没有 date-fns，
 * 于是线上 bot 一加载就 ERR_MODULE_NOT_FOUND，push.js 和 tools.js 全部载入失败。
 *
 * 这类问题在开发机上不可能自己暴露，只能靠这道检查在发布前拦住。
 */

const repositoryRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..')
const libRoot = join(repositoryRoot, 'lib')

/**
 * Node 内置模块。带 `node:` 前缀的直接放过，这里列的是可以裸写的那批。
 * 只需覆盖本仓库真正用到的，多写无害、少写会被误报出来，不会漏放。
 */
const NODE_BUILTINS = new Set([
  'assert', 'buffer', 'child_process', 'crypto', 'events', 'fs', 'http', 'https', 'module', 'net',
  'os', 'path', 'perf_hooks', 'querystring', 'readline', 'stream', 'string_decoder', 'timers',
  'tls', 'url', 'util', 'worker_threads', 'zlib'
])

/**
 * 扫描前先剥掉注释。
 *
 * 产物里到处是 `@typedef {import('highlight.js').X}` 这类 JSDoc，standalone 包里还有
 * 第三方源码把 `const eoLocale = require('date-fns/locale/eo')` 写在示例注释里 ——
 * 后者连「前面是等号」这种表达式位置判断都骗得过，只有真正去掉注释才不会误报。
 *
 * 剥不干净的风险方向是安全的：万一某个字符串字面量里含 `/*`，会多剥掉一段代码，
 * 结果是少扫到几个导入（漏报），而不是凭空造出一个不存在的依赖（误报）。
 * `//` 只在前面不是 `:` 时才当行注释，免得把 `'https://…'` 从中间截断。
 */
const stripComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*/g, '$1')

/**
 * 真正的说明符位置。
 *
 * - 行首的 `import ... from '...'` / `import '...'`（tsc 产物与 vite 产物都是这个形状）
 * - 行首的 `export ... from '...'`
 * - 表达式位置的 `import('...')` 与 `require('...')`
 */
const SPECIFIER_PATTERNS = [
  /^\s*import\s+(?:[^'"();]*?\s+from\s+)?['"]([^'"\n]+)['"]/gm,
  /^\s*export\s+[^'"();]*?\s+from\s+['"]([^'"\n]+)['"]/gm,
  /(?:^|[=(,;]|\bawait)\s*(?:import|require)\s*\(\s*['"]([^'"\n]+)['"]\s*\)/gm
]

/** `date-fns/locale/zh-CN` -> `date-fns`；`@scope/pkg/sub` -> `@scope/pkg` */
const toPackageName = (specifier: string): string => {
  const segments = specifier.split('/')
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]!
}

const collectFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) collectFiles(full, out)
    else if (full.endsWith('.js') || full.endsWith('.mjs') || full.endsWith('.cjs')) out.push(full)
  }
  return out
}

const main = (): void => {
  if (!existsSync(libRoot)) {
    console.error(`[audit:runtime-deps] 找不到构建产物：${libRoot}，请先执行 pnpm build`)
    process.exit(1)
  }

  const packageJson = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8')) as {
    name?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const dependencies = new Set(Object.keys(packageJson.dependencies ?? {}))
  const devDependencies = new Set(Object.keys(packageJson.devDependencies ?? {}))

  /** 包名 -> 引用它的产物文件 */
  const offenders = new Map<string, Set<string>>()
  let scanned = 0

  for (const file of collectFiles(libRoot)) {
    scanned++
    const source = stripComments(readFileSync(file, 'utf8'))
    for (const pattern of SPECIFIER_PATTERNS) {
      pattern.lastIndex = 0
      let matched: RegExpExecArray | null
      while ((matched = pattern.exec(source)) !== null) {
        const specifier = matched[1]!
        if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:')) continue
        const name = toPackageName(specifier)
        if (NODE_BUILTINS.has(name) || name === packageJson.name) continue
        if (dependencies.has(name)) continue
        const relative = file.slice(repositoryRoot.length + 1).replaceAll('\\', '/')
        const bucket = offenders.get(name) ?? new Set<string>()
        bucket.add(relative)
        offenders.set(name, bucket)
      }
    }
  }

  if (offenders.size === 0) {
    console.log(`[audit:runtime-deps] ${scanned} 个产物文件，运行时导入全部声明在 dependencies 中`)
    return
  }

  console.error('[audit:runtime-deps] 以下运行时导入没有声明在 dependencies 中：')
  console.error('  发布流水线会执行 `pnpm pkg delete devDependencies`，用户装不到这些包。')
  for (const [name, files] of [...offenders].sort(([a], [b]) => a.localeCompare(b))) {
    console.error(`\n  ${name}  [${devDependencies.has(name) ? 'devDependencies' : '未声明'}]`)
    for (const file of [...files].sort()) console.error(`      ${file}`)
  }
  process.exit(1)
}

main()
