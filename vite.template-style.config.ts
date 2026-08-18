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
