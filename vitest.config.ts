import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  // vite 不读取 tsconfig 的 "paths"，而 src/ 内部已全面改用 "@/" 别名导入，
  // 所以必须在这里显式声明，否则测试加载任何 src 模块都会 ERR_MODULE_NOT_FOUND。
  // 用正则而非字符串前缀，避免和 @karinjs/*、@ikenxuan/*、@kkk/richtext 等作用域包名冲突。
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: `${srcDir}/$1` }
    ]
  },
  test: {
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
