import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  // vite 不读取 tsconfig 的 "paths"，而 src/ 内部已全面改用 "@/" 别名导入，
  // 所以必须在这里显式声明，否则测试加载任何 src 模块都会 ERR_MODULE_NOT_FOUND。
  // 用正则而非字符串前缀，避免和 @karinjs/*、@ikenxuan/* 等作用域包名冲突。
  resolve: {
    alias: [
      // 和 tsconfig.json 保持一致：src 侧的 @kkk/richtext 解析到 react-free 核心。
      // 必须排在 @/ 之前，否则 @kkk/... 不会被前者匹配但顺序仍以显式为准。
      { find: '@kkk/richtext', replacement: `${srcDir}/module/utils/richtext/index.ts` },
      { find: /^@\/(.*)$/, replacement: `${srcDir}/$1` }
    ]
  },
  test: {
    // 默认 5s 对 tests/integration/ 那批太紧，会随机翻车。
    //
    // 那四个文件全都做真实 IO（better-sqlite3 落盘、临时目录、起 HTTP server），
    // 本地实测 config-files 405ms / push-db 1.39s / statistics-db 1.60s /
    // server 3.76s；而 Windows CI runner 上同样的 statistics-db 整跑 28.5s、
    // 单条最高 4680ms —— 离 5s 上限只剩 320ms。第一次翻的是 push-db 的
    // 「removes only cache rows older than the retention window」（run #1，
    // 只有 windows-latest 挂，ubuntu 同一条过），它一条测试里有 6 次串行
    // SQLite 往返。
    //
    // 这不是代码慢，是 Windows runner 的文件 IO 慢，没法在被测代码里优化掉，
    // 所以正确的轴是放宽超时而不是改测试。
    //
    // 为什么放在全局而不是只给 integration：vitest 没有按 glob 设超时的简单写法，
    // 用 projects 拆要把 resolve.alias 复制一份、还改了报告形状；而逐文件写
    // vi.setConfig 的话，将来新增第五个集成测试文件会静默拿回 5s。
    // 代价是单元测试里真卡住的用例要 30s 才报错而不是 5s —— 整套本来就跑
    // 30s+，这个代价可以接受，且卡住是罕见情形。
    testTimeout: 30_000,
    // 钩子同样放宽：beforeAll/beforeEach 里建库建临时目录会撞同一面墙，
    // 而它的默认值只有 10s。
    hookTimeout: 30_000,
    exclude: [
      '**/node_modules/**',
      '**/lib/**',
      // 由 `pnpm test:dist` 通过 node --test 运行，不进入 vitest
      'tests/contracts/**/*.test.mjs',
      // 忽略 Claude Code 子代理留下的 git worktree，避免重复收集同名测试
      '.claude/**'
    ]
  }
})
