import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from '@karinjs/template-react'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  dir: {
    template: 'ktr/template',
    assets: 'resources',
    copyAssets: false
  },
  /**
   * host 钉成 IPv4 回环，不用 ktr 的默认 `'localhost'`。
   *
   * `localhost` 在 Node 18+ 会优先解析成 IPv6 的 `::1`，dev server 于是只监听
   * `[::1]:5180`（`Get-NetTCPConnection -LocalPort 5180` 只有 `::1` 一条）。
   * 本机的 IPv6 回环连不通 —— 自建一个 `[::1]` 服务器连自己都是 `EACCES`，
   * 而同样的探针换 `127.0.0.1` 正常 —— 面板就表现成「起来了但打不开」。
   * 显式写 IPv4 后浏览器和 curl 都能连上；要暴露给局域网再改 `'0.0.0.0'`。
   */
  dev: {
    host: '127.0.0.1'
  },
  standalone: {
    outDir: 'lib/react-template',
    target: 'node22',
    format: 'esm',
    minify: false,
    sourcemap: false,
    assets: 'copy',
    external: [],
    singleChunk: true
  },
  vite: {
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: [
        {
          find: '@kkk/richtext',
          replacement: resolve(root, 'ktr/richtext/index.ts')
        }
      ]
    }
  }
})
