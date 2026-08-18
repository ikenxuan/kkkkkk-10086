import { defineConfig } from 'vitest/config'

export default defineConfig({
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
