import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    outDir: 'lib',
    emptyOutDir: false,
    cssCodeSplit: true,
    minify: false,
    assetsInlineLimit: 10 * 1024 * 1024,
    rollupOptions: {
      input: resolve(root, 'ktr/template/style.css'),
      output: {
        assetFileNames: asset => asset.name?.endsWith('.css')
          ? 'template-style.css'
          : 'template-assets/[name]-[hash][extname]'
      }
    }
  }
})
