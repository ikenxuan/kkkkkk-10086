import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PluginPath = fileURLToPath(new URL('../../../', import.meta.url))
const tsconfigPath = join(PluginPath, 'tsconfig.json')

/**
 * ktr standalone typechecks its generated entry with the root tsconfig.
 * Keep the application tsconfig strict while removing options that describe
 * only the src/ emit boundary during that short-lived template build.
 *
 * `@kkk/richtext` 也必须在这段窗口里重指向 ktr 的 barrel：根 tsconfig 平时指向
 * `src/module/utils/richtext`（react-free 核心），因为 rootDir 是 ./src，从 src/ 引用
 * ktr/ 下的 .ts 会 TS6059。但 ktr 的模板树需要 barrel 额外补上的 React 渲染器
 * （renderRichTextToReact），而这一步刚好把 rootDir 删掉了，指向 ktr/ 不再受限。
 * karin.template.ts 里的 vite alias 只负责打包解析，管不到 ktr 自己这遍类型检查。
 */
const buildTemplates = (): void => {
  const original = readFileSync(tsconfigPath, 'utf8')
  const config = JSON.parse(original) as {
    compilerOptions?: Record<string, unknown>
  }
  const compilerOptions = config.compilerOptions ?? {}
  delete compilerOptions.rootDir
  delete compilerOptions.noUncheckedIndexedAccess
  compilerOptions.paths = {
    ...(compilerOptions.paths as Record<string, string[]> | undefined),
    '@kkk/richtext': ['./ktr/richtext/index.ts']
  }
  config.compilerOptions = compilerOptions

  writeFileSync(tsconfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  try {
    execSync('pnpm exec ktr build', {
      cwd: PluginPath,
      stdio: 'inherit'
    })
  } finally {
    writeFileSync(tsconfigPath, original, 'utf8')
  }
}

buildTemplates()
