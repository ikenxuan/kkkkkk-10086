import { existsSync, readFileSync } from 'node:fs'

import globalsPackage from 'globals'
import neostandard from 'neostandard'

const ignores = [
  'lib/**',
  'node_modules/**',
  'data/**',
  'config/config/**',
  // ktr/ 是上游 karin-plugin-kkk 的模板树镜像，必须与上游保持逐字节可比：
  // 排查问题时靠 `diff` 直接和上游同名文件对，能一眼看出哪几行是本仓库的适配
  // （例如 ktr/richtext/react/index.tsx 与上游只差一行 import 路径）。
  // 这里不是漏配：`pnpm lint` 的路径参数本来也没带 ktr，写进来是为了把「不 lint」
  // 变成明确决定。真跑一次会报 4411 条，其中 4336 条是 jsx-quotes / indent /
  // space-before-function-paren 这类纯风格问题，`--fix` 一下就等于把整个镜像
  // 改写成本仓库的风格，此后每次同步上游都是巨型冲突。
  // 模板树的类型安全由 typecheck:template / typecheck:render 两条 tsc 程序保证。
  'ktr/**'
]

const globals = {
  ...globalsPackage.node,
  Bot: 'readonly',
  redis: 'readonly',
  plugin: 'readonly',
  segment: 'readonly',
  logger: 'readonly'
}

const standardConfig = neostandard({ ts: true, globals, ignores })
const legacyRuleEntries = standardConfig.filter(config =>
  Object.keys(config.rules ?? {}).length > 0 &&
  !config.files?.some(pattern => pattern.includes('.ts')) &&
  !config.ignores?.some(pattern => pattern.includes('*.js'))
)
const legacyPlugins = Object.assign(
  {},
  ...legacyRuleEntries.map(config => config.plugins ?? {})
)
const legacyRules = Object.fromEntries(
  legacyRuleEntries
    .flatMap(config => Object.entries(config.rules ?? {}))
    .map(([name, setting]) => {
      const severity = Array.isArray(setting) ? setting[0] : setting
      if (severity === 0 || severity === 'off') return [name, 'off']
      return [name, ['warn', ...(Array.isArray(setting) ? setting.slice(1) : [])]]
    })
)

const ALIAS_MESSAGE = '不要使用跳出当前目录的相对导入（"./../x.js" 这种等价写法也算）。请使用以 src/ 为根的 "@/" 别名，例如 "@/module/utils/index"，不带扩展名。'

const EXTENSION_MESSAGE = '相对导入必须带扩展名，同目录写成 "./x.js"。tsconfig 的 moduleResolution: "Bundler" 会放过 "./x"，但编译产物是直接交给 node ESM 跑的，缺扩展名就是运行时 ERR_MODULE_NOT_FOUND——lint 和 tsc 都拦不住，只会在用户机器上炸。'

const DYNAMIC_IMPORT_MESSAGE = '动态 import() 不要写相对路径，一律用 "@/" 别名（不带扩展名）。tsc-alias 会把动态导入里的别名连相对路径带扩展名一起补好。'

const STRIP_TYPES_MESSAGE = '该文件由 `node --experimental-strip-types` 运行，无法解析 tsconfig "paths"。请使用带 ".ts" 扩展名的显式相对导入。'

/**
 * 这些文件由 `node --experimental-strip-types` 直接执行（见 package.json 的
 * template:build / template:sync / template:check / clean:template）。
 * Node 不解析 tsconfig 的 "paths"，所以它们必须保留带 ".ts" 扩展名的显式相对导入。
 *
 * 名单里既有脚本入口，也有它们导入的模块——被 strip-types 入口拖进来的文件同样跑在
 * 没有 "paths" 的 node 里，所以传染整条导入链。
 */
const STRIP_TYPES_ENTRYPOINTS = [
  'src/module/tooling/audit-runtime-deps.ts',
  'src/module/tooling/template-build.ts',
  'src/module/tooling/react-template/registry-cli.ts',
  'src/module/tooling/react-template/build-cleaner-cli.ts',
  'src/module/tooling/react-template/cli-options.ts',
  'src/module/tooling/react-template/build-cleaner.ts',
  'src/module/tooling/react-template/registry-generator.ts',
  'src/module/tooling/react-template/path-safety.ts'
]

/**
 * 校验上面那份手工名单没有和现实脱节，脱节就让 lint 直接崩。
 *
 * flat config 对「匹配不到任何文件的 files/ignores」一声不吭，所以名单漂移是静默失效，
 * 而且朝危险方向失效：新增的 strip-types 脚本落在名单外，就会被下面的别名规则要求改成
 * "@/"，改完 lint 过、tsc 过，运行时 ERR_MODULE_NOT_FOUND。
 *
 * 两道检查：
 * 1. 名单里的文件都还在（改名/删除会被抓到）；
 * 2. package.json 里每个 `--experimental-strip-types` 脚本的入口都在名单里
 *    （以脚本为唯一事实来源，新增入口漏登记会被抓到）。
 *
 * 检查不到的部分：入口 *传递导入* 的模块仍然靠手工维护，脚本里读不出来。
 */
const assertStripTypesListIsCurrent = entrypoints => {
  const missing = entrypoints.filter(file => !existsSync(new URL(file, import.meta.url)))
  if (missing.length > 0) {
    throw new Error(
      'eslint.config.js: STRIP_TYPES_ENTRYPOINTS 里的文件不存在（改名或删除了？）：\n  ' +
      missing.join('\n  ')
    )
  }

  const scripts = JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf8')).scripts ?? {}
  const declared = new Set(entrypoints)
  const unlisted = Object.entries(scripts)
    .filter(([, command]) => command.includes('--experimental-strip-types'))
    .flatMap(([name, command]) => (command.match(/[\w./-]+\.ts\b/g) ?? []).map(file => `${name} -> ${file}`))
    .filter(entry => !declared.has(entry.split(' -> ')[1]))

  if (unlisted.length > 0) {
    throw new Error(
      'eslint.config.js: 这些脚本用 --experimental-strip-types 直接跑 .ts，但入口没登记进 STRIP_TYPES_ENTRYPOINTS。\n' +
      '别名规则会误伤它们（lint 过、tsc 过，运行时 ERR_MODULE_NOT_FOUND）：\n  ' +
      unlisted.join('\n  ')
    )
  }
}

assertStripTypesListIsCurrent(STRIP_TYPES_ENTRYPOINTS)

export default [
  ...neostandard({ ts: true, globals, ignores }),
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    rules: {
      camelcase: 'off',
      eqeqeq: 'off',
      'prefer-const': 'off',
      'comma-dangle': ['warn', 'never'],
      'arrow-body-style': 'off',
      indent: ['warn', 2, { SwitchCase: 1 }],
      'space-before-function-paren': 'warn',
      semi: ['warn', 'never'],
      'no-trailing-spaces': 'warn',
      'object-curly-spacing': ['warn', 'always']
    }
  },
  {
    files: [
      'tests/**/*.{js,mjs,cjs}',
      '*.{js,mjs,cjs}'
    ],
    plugins: legacyPlugins,
    rules: legacyRules
  },
  {
    // 强制 src/ 内部用 "@/" 别名而不是 "../" 相对导入。
    // 必须是 'error'：`pnpm lint` 是裸 eslint，遇到 warning 仍然退出 0，起不到门禁作用。
    // 注意：若以后引入 eslint-plugin-import-x / perfectionist 或打开 n/no-missing-import，
    // 需要额外给它们配置能解析 "@/" 的 resolver（eslint-import-resolver-typescript）。
    files: ['src/**/*.{ts,tsx}'],
    ignores: STRIP_TYPES_ENTRYPOINTS,
    rules: {
      // 用 regex 而不是 group。group 走的是 gitignore 风格的字面量匹配，'../*' / '../**'
      // 只认「以 ../ 开头」的字符串，于是 './../x.js'、'..'、'../' 全都从旁边溜过去——
      // 而 './../x.js' 归一化之后和 '../x.js' 完全等价，是一条能正常工作的绕过写法。
      'no-restricted-imports': ['error', {
        patterns: [
          { regex: '(^|/)\\.\\.(/|$)', message: ALIAS_MESSAGE },
          { regex: '^\\.(?!.*\\.(js|mjs|cjs|json)$)', message: EXTENSION_MESSAGE }
        ]
      }],
      // no-restricted-imports 的 visitor 只有 Import/ExportNamed/ExportAllDeclaration，
      // 不访问 ImportExpression，动态 import() 得单独拦。
      // esquery 的属性正则里塞不进裸 '/'：它会先把 / 还原成真正的斜杠，把正则字面量
      // 提前截断（实测报 "Unterminated group"）。绕法是写成 \x2f——源码里没有真正的
      // 斜杠字符，逃过分词，new RegExp 又会把它解回 '/'（见下面 strip-types 那条）。
      // 这里仍然选择「禁掉一切相对动态导入」而不是只拦含 .. 段的：一律走 "@/"，
      // tsc-alias 会把动态导入里的别名连相对路径带扩展名一起补好
      // （已在 lib/module/platform/douyin/danmaku.js 里核对过）。
      // 点号写成 [.] 是为了绕开 esquery 对反斜杠转义的处理。
      'no-restricted-syntax': ['error', {
        selector: 'ImportExpression > Literal[value=/^[.]/]',
        message: DYNAMIC_IMPORT_MESSAGE
      }]
    }
  },
  {
    files: STRIP_TYPES_ENTRYPOINTS,
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@/**', '~/**'], message: STRIP_TYPES_MESSAGE },
          // 上面那条只禁掉别名，并不保证换回来的相对导入带对扩展名。
          // './x' 和 './x.js' 在 moduleResolution: "Bundler" 下都能过 tsc（后者甚至会
          // 解析到磁盘上的 x.ts），但 node 直接跑这些文件时两种都是 ERR_MODULE_NOT_FOUND。
          // 所以把提示里承诺的 ".ts" 真正管起来，别让消息描述一条并不存在的规则。
          { regex: '^\\.(?!.*\\.m?tsx?$)', message: STRIP_TYPES_MESSAGE }
        ]
      }],
      // 上面那条 no-restricted-imports 不访问 ImportExpression，所以动态 import('@/x')
      // 会从两条规则之间穿过去：主区块的 no-restricted-syntax 被 files/ignores 排除在
      // 这些文件之外，这里又没有同名规则接手（flat config 是整条替换而不是合并）。
      // 结果就是这份名单存在的意义所在的那个故障——lint 过、tsc 过、node 跑时
      // ERR_MODULE_NOT_FOUND——在动态导入这条路径上完全没人看着。
      // \x2f 是「以 @/ 开头」的唯一写法：裸 '/' 会截断 esquery 的正则字面量，
      // 而只匹配 '^@' 会把 @ikenxuan/amagi 这类正常 scoped 包一起误伤。
      'no-restricted-syntax': ['error', {
        selector: 'ImportExpression > Literal[value=/^@\\x2f/]',
        message: STRIP_TYPES_MESSAGE
      }]
    }
  }
]
