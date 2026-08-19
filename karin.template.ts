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
