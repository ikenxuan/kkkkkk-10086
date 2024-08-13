import { resolve } from "path"
import fg from 'fast-glob'
import type { VitePWAOptions } from "vite-plugin-pwa"

const pwa: Partial<VitePWAOptions> = {
  // 根目录
  outDir: '../dist',
  registerType: "autoUpdate",
  includeManifestIcons: false,
  includeAssets: fg.sync('**/*.{png,svg,gif,ico,txt}', { cwd: resolve(__dirname, '../../public') }),
  manifest: {
    id: "/",
    name: 'kkkkkk-10086',
    short_name: 'kkkkkk-10086',
    description: '适用于 Yunzai / Karin 生态的视频解析、推送插件',
    theme_color: "#ffffff",
    icons: [
      {
        src: "/logo.png",
        sizes: "120x120",
        type: "image/png",
      },
      {
        src: "/logo.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  },
  workbox: {
    navigateFallbackDenylist: [/^\/new$/],
    globPatterns: ["**/*.{css,js,html,svg,png,ico,txt,woff2}"],
    runtimeCaching: [
      {
        urlPattern: new RegExp('^https://fonts.googleapis.com/.*', 'i'),
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts-cache",
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "gstatic-fonts-cache",
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: new RegExp('^https://fonts.gstatic.com/.*', 'i'),
        handler: "NetworkFirst",
        options: {
          cacheName: "jsdelivr-images-cache",
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 7, // <== 7 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: new RegExp('^https://cdn.jsdelivr.net/.*', 'i'),
        handler: 'CacheFirst',
        options: {
          cacheName: 'jsdelivr-cdn-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: new RegExp('^https://(((raw|user-images|camo).githubusercontent.com))/.*', 'i'),
        handler: 'CacheFirst',
        options: {
          cacheName: 'githubusercontent-images-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
  },
}
export default pwa