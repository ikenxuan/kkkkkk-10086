import { builtinModules } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        find: /^@karinjs\/template-react$/,
        replacement: resolve(root, 'src/template-sdk/index.ts')
      },
      {
        find: '@kkk/richtext',
        replacement: resolve(root, 'ktr/richtext/index.ts')
      }
    ]
  },
  ssr: {
    // Bundle every poster-only dependency. Ordinary Yunzai installations only
    // need React itself plus this prebuilt registry.
    noExternal: true,
    external: ['react', 'react-dom', 'react-dom/server']
  },
  build: {
    target: 'node22',
    outDir: 'lib',
    emptyOutDir: false,
    minify: false,
    ssr: resolve(root, '.generated/template-registry.ts'),
    rollupOptions: {
      external: [
        ...builtinModules,
        ...builtinModules.map(module => `node:${module}`),
        'react',
        'react-dom',
        'react-dom/server'
      ],
      output: {
        format: 'es',
        entryFileNames: 'template-registry.js',
        chunkFileNames: 'template-chunks/[name]-[hash].js',
        assetFileNames: 'template-assets/[name]-[hash][extname]'
      }
    }
  }
})
