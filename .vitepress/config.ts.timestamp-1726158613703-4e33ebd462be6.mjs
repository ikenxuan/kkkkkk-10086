// .vitepress/config.ts
import { defineConfig } from "file:///D:/GitHub/kkkkkk-10086-docs/node_modules/.pnpm/vitepress@1.3.4_@algolia+client-search@4.24.0_@types+node@22.5.4_axios@1.7.7_less@4.2.0_markd_djmqwyjhfqky5te22zvu4jlde4/node_modules/vitepress/dist/node/index.js";

// .vitepress/script/nav.ts
import axios from "file:///D:/GitHub/kkkkkk-10086-docs/node_modules/.pnpm/axios@1.7.7/node_modules/axios/index.js";
var file = await axios.get("https://raw.githubusercontent.com/ikenxuan/kkkkkk-10086/master/package.json");
var nav = [
  { text: "\u4E3B\u9875", link: "/" },
  { text: "\u5E38\u89C1\u95EE\u9898", link: "/docs/intro/QA" },
  {
    text: "\u{1F349}\u5927\u7EB2",
    items: [
      {
        text: "\u5FEB\u901F\u5F00\u59CB",
        items: [
          { text: "\u7B80\u4ECB", link: "/docs/start/start" },
          { text: "\u5B89\u88C5\u63D2\u4EF6", link: "/docs/start/install" },
          { text: "\u914D\u7F6E\u6587\u4EF6", link: "/docs/start/start.config" }
        ]
      },
      {
        text: "\u529F\u80FD",
        items: [
          { text: "\u4F5C\u54C1\u89E3\u6790", link: "/docs/intro/main/main" },
          { text: "\u52A8\u6001\u63A8\u9001", link: "/docs/intro/push" },
          { text: "API Server", link: "/docs/intro/apiserver" },
          { text: "\u5176\u4ED6\u529F\u80FD", link: "/docs/intro/other" }
        ]
      },
      {
        text: "\u5176\u4ED6",
        items: [
          {
            text: "\u9047\u5230\u95EE\u9898\u4E86\uFF1F",
            link: "/docs/intro/problems",
            items: [
              { text: "\u5E38\u89C1\u95EE\u9898\u89E3\u7B54", link: "/docs/intro/QA" }
            ]
          },
          { text: "\u6295\u5582", link: "/docs/other/afdian" },
          { text: "\u514D\u8D23\u58F0\u660E", link: "/docs/other/disclaimer" },
          { text: "\u7248\u672C\u5386\u53F2", link: "/docs/other/timeline" }
        ]
      }
    ]
  },
  { text: `kkkkkk-10086 v${file.data.version}`, link: `https://github.com/ikenxuan/kkkkkk-10086/releases/tag/v${file.data.version}`, noIcon: false }
];
var nav_default = nav;

// .vitepress/script/sidebar.ts
var sidebar = [
  {
    text: "\u5FEB\u901F\u5F00\u59CB",
    items: [
      { text: '<i class="fa-solid fa-play fa-beat"></i> \u7B80\u4ECB', link: "/docs/start/start" },
      { text: '<i class="fa-solid fa-download fa-fade"></i> \u5B89\u88C5\u63D2\u4EF6', link: "/docs/start/install" },
      { text: '<i class="fa-solid fa-gear fa-spin"></i> \u914D\u7F6E\u6587\u4EF6', link: "/docs/start/start.config" }
    ]
  },
  {
    text: "\u529F\u80FD",
    items: [
      {
        text: '<i class="fa-solid fa-bars fa-flip"></i> \u4F5C\u54C1\u89E3\u6790',
        link: "/docs/intro/main/main",
        items: [
          { text: '<i class="fa-brands fa-tiktok fa-fade"></i> \u6296\u97F3\u76F8\u5173', link: "/docs/intro/main/douyin" },
          { text: '<i class="fa-brands fa-bilibili fa-fade"></i> B\u7AD9\u76F8\u5173', link: "/docs/intro/main/bilibili" },
          { text: "\u5FEB\u624B\u76F8\u5173", link: "/docs/intro/main/kuaishou" }
        ]
      },
      { text: '<i class="fa-brands fa-pushed fa-fade"></i> \u52A8\u6001\u63A8\u9001', link: "/docs/intro/push" },
      { text: '<i class="fa-solid fa-server fa-fade"></i> API Server', link: "/docs/intro/apiserver" },
      { text: "\u5176\u4ED6\u529F\u80FD", link: "/docs/intro/other" }
    ]
  },
  {
    text: "\u5176\u4ED6",
    items: [
      {
        text: '<i class="fa-solid fa-question fa-fade"></i> \u9047\u5230\u95EE\u9898\u4E86\uFF1F',
        link: "/docs/intro/problems",
        items: [
          { text: '<i class="fa-solid fa-file-circle-question fa-fade"></i> \u5E38\u89C1\u95EE\u9898\u89E3\u7B54', link: "/docs/intro/QA" }
        ]
      },
      { text: '<i class="fa-solid fa-hand-holding-heart fa-fade"></i> \u6295\u5582', link: "/docs/other/afdian" },
      { text: '<i class="fa-solid fa-triangle-exclamation fa-fade"></i> \u514D\u8D23\u58F0\u660E', link: "/docs/other/disclaimer" },
      { text: '<i class="fa-solid fa-code-branch fa-fade"></i> \u7248\u672C\u5386\u53F2', link: "/docs/other/timeline" }
    ]
  }
];
var sidebar_default = sidebar;

// .vitepress/config.ts
import timeline from "file:///D:/GitHub/kkkkkk-10086-docs/node_modules/.pnpm/vitepress-markdown-timeline@1.2.1/node_modules/vitepress-markdown-timeline/dist/cjs/index.cjs.js";
import taskLists from "file:///D:/GitHub/kkkkkk-10086-docs/node_modules/.pnpm/markdown-it-task-lists@2.1.1/node_modules/markdown-it-task-lists/index.js";
import mathjax3 from "file:///D:/GitHub/kkkkkk-10086-docs/node_modules/.pnpm/markdown-it-mathjax3@4.3.2/node_modules/markdown-it-mathjax3/index.js";
import footnote_plugin from "file:///D:/GitHub/kkkkkk-10086-docs/node_modules/.pnpm/markdown-it-footnote@4.0.0/node_modules/markdown-it-footnote/index.mjs";
import { BiDirectionalLinks } from "file:///D:/GitHub/kkkkkk-10086-docs/node_modules/.pnpm/@nolebase+markdown-it-bi-directional-links@2.5.0_markdown-it@14.1.0/node_modules/@nolebase/markdown-it-bi-directional-links/dist/index.mjs";
import { InlineLinkPreviewElementTransform } from "file:///D:/GitHub/kkkkkk-10086-docs/node_modules/.pnpm/@nolebase+vitepress-plugin-inline-link-preview@2.5.0_@algolia+client-search@4.24.0_@types+nod_nfrlbn24dqrtwzqafo6jj2ezwq/node_modules/@nolebase/vitepress-plugin-inline-link-preview/dist/markdown-it/index.mjs";
import {
  GitChangelog,
  GitChangelogMarkdownSection
} from "file:///D:/GitHub/kkkkkk-10086-docs/node_modules/.pnpm/@nolebase+vitepress-plugin-git-changelog@2.5.0_@algolia+client-search@4.24.0_@types+node@22.5_fsbtvjtan7umsn56riaucq62gi/node_modules/@nolebase/vitepress-plugin-git-changelog/dist/vite/index.mjs";
import {
  PageProperties,
  PagePropertiesMarkdownSection
} from "file:///D:/GitHub/kkkkkk-10086-docs/node_modules/.pnpm/@nolebase+vitepress-plugin-page-properties@2.5.0_@algolia+client-search@4.24.0_@types+node@22_kumsryfpmk6wrkg67kgle6632m/node_modules/@nolebase/vitepress-plugin-page-properties/dist/vite/index.mjs";
import { ThumbnailHashImages } from "file:///D:/GitHub/kkkkkk-10086-docs/node_modules/.pnpm/@nolebase+vitepress-plugin-thumbnail-hash@2.5.0_@algolia+client-search@4.24.0_@types+node@22._dvai6hwiebhrmpemcvcz53cdwm/node_modules/@nolebase/vitepress-plugin-thumbnail-hash/dist/vite/index.mjs";
import { transformerTwoslash } from "file:///D:/GitHub/kkkkkk-10086-docs/node_modules/.pnpm/@shikijs+vitepress-twoslash@1.17.0_typescript@5.5.4/node_modules/@shikijs/vitepress-twoslash/dist/index.mjs";

// .vitepress/script/pwa.ts
import { resolve } from "path";
import fg from "file:///D:/GitHub/kkkkkk-10086-docs/node_modules/.pnpm/fast-glob@3.3.2/node_modules/fast-glob/out/index.js";
var __vite_injected_original_dirname = "D:\\GitHub\\kkkkkk-10086-docs\\.vitepress\\script";
var pwa = {
  // 根目录
  outDir: "../dist",
  registerType: "autoUpdate",
  includeManifestIcons: false,
  includeAssets: fg.sync("**/*.{png,svg,gif,ico,txt}", { cwd: resolve(__vite_injected_original_dirname, "../../public") }),
  manifest: {
    id: "/",
    name: "kkkkkk-10086",
    short_name: "kkkkkk-10086",
    description: "\u9002\u7528\u4E8E Yunzai / Karin \u751F\u6001\u7684\u89C6\u9891\u89E3\u6790\u3001\u63A8\u9001\u63D2\u4EF6",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/logo.png",
        sizes: "120x120",
        type: "image/png"
      },
      {
        src: "/logo.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      }
    ]
  },
  workbox: {
    navigateFallbackDenylist: [/^\/new$/],
    globPatterns: ["**/*.{css,js,html,svg,png,ico,txt,woff2}"],
    runtimeCaching: [
      {
        urlPattern: new RegExp("^https://fonts.googleapis.com/.*", "i"),
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts-cache",
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365
            // <== 365 days
          },
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "gstatic-fonts-cache",
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365
            // <== 365 days
          },
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      },
      {
        urlPattern: new RegExp("^https://fonts.gstatic.com/.*", "i"),
        handler: "NetworkFirst",
        options: {
          cacheName: "jsdelivr-images-cache",
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 7
            // <== 7 days
          },
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      },
      {
        urlPattern: new RegExp("^https://cdn.jsdelivr.net/.*", "i"),
        handler: "CacheFirst",
        options: {
          cacheName: "jsdelivr-cdn-cache",
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365
            // <== 365 days
          },
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      },
      {
        urlPattern: new RegExp("^https://(((raw|user-images|camo).githubusercontent.com))/.*", "i"),
        handler: "CacheFirst",
        options: {
          cacheName: "githubusercontent-images-cache",
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365
            // <== 365 days
          },
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      }
    ]
  }
};
var pwa_default = pwa;

// .vitepress/config.ts
import { withPwa } from "file:///D:/GitHub/kkkkkk-10086-docs/node_modules/.pnpm/@vite-pwa+vitepress@0.5.3_vite-plugin-pwa@0.20.5_vite@5.4.4_@types+node@22.5.4_less@4.2.0_sas_ao2wdv7vywlz6bueh36cjhqj6y/node_modules/@vite-pwa/vitepress/dist/index.mjs";
import { groupIconMdPlugin, groupIconVitePlugin } from "file:///D:/GitHub/kkkkkk-10086-docs/node_modules/.pnpm/vitepress-plugin-group-icons@1.1.0/node_modules/vitepress-plugin-group-icons/dist/index.mjs";
var config_default = withPwa(defineConfig({
  pwa: pwa_default,
  lang: "zh-CN",
  title: "kkkkkk-10086",
  titleTemplate: "Yunzai-Bot \u7684\u89C6\u9891\u89E3\u6790\u63D2\u4EF6",
  description: "Yunzai-Bot \u7684\u89C6\u9891\u89E3\u6790\u63D2\u4EF6",
  markdown: {
    math: true,
    // 全局代码块行号显示
    lineNumbers: true,
    image: {
      // 开启图片懒加载
      lazyLoading: true
    },
    config: (md) => {
      md.use(timeline);
      md.use(taskLists);
      md.use(mathjax3);
      md.use(footnote_plugin);
      md.use(BiDirectionalLinks());
      md.use(InlineLinkPreviewElementTransform);
      md.use(groupIconMdPlugin);
    },
    codeTransformers: [
      transformerTwoslash()
    ]
  },
  vite: {
    plugins: [
      ThumbnailHashImages(),
      GitChangelog({
        maxGitLogCount: 2e3,
        // 要获取git日志的仓库
        repoURL: () => "https://github.com/ikenxuan/kkkkkk-10086"
      }),
      GitChangelogMarkdownSection({
        exclude: (id) => id.endsWith("index.md"),
        sections: {
          // 禁用页面历史
          disableChangelog: false,
          // 禁用贡献者
          disableContributors: true
        }
      }),
      // 页面属性
      PageProperties(),
      PagePropertiesMarkdownSection({
        excludes: [
          "index.md"
        ]
      }),
      // 代码组图标
      groupIconVitePlugin()
    ],
    optimizeDeps: {
      exclude: [
        "@nolebase/vitepress-plugin-enhanced-readabilities/client"
      ]
    },
    ssr: {
      noExternal: [
        "@nolebase/*"
      ]
    }
  },
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag === "iconify-icon"
      }
    }
  },
  cleanUrls: true,
  base: "/kkkkkk-10086/",
  lastUpdated: true,
  // 站点地图
  sitemap: {
    hostname: "https://ikenxuan.github.io/kkkkkk-10086/"
  },
  head: [
    ["link", { rel: "icon", href: "/kkkkkk-10086/logo.png" }]
    //部署到vitepress仓库
  ],
  themeConfig: {
    logo: {
      src: "/logo.png"
    },
    // https://vitepress.dev/reference/default-theme-config
    // 手机端深浅模式文字修改
    darkModeSwitchLabel: "\u6DF1\u6D45\u6A21\u5F0F",
    editLink: {
      pattern: "https://github.com/ikenxuan/kkkkkk-10086/edit/docs/:path",
      text: "\u5728 GitHub \u4E0A\u7F16\u8F91\u6B64\u9875\u9762"
    },
    nav: nav_default,
    search: {
      provider: "local",
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: "\u641C\u7D22\u6587\u6863",
                buttonAriaLabel: "\u641C\u7D22\u6587\u6863"
              },
              modal: {
                noResultsText: "\u65E0\u6CD5\u627E\u5230\u76F8\u5173\u7ED3\u679C",
                resetButtonTitle: "\u6E05\u9664\u67E5\u8BE2\u6761\u4EF6",
                footer: {
                  selectText: "\u9009\u62E9",
                  navigateText: "\u5207\u6362"
                }
              }
            }
          }
        }
      }
    },
    sidebar: sidebar_default,
    socialLinks: [
      { icon: { svg: '<i class="fa-brands fa-github fa-fade fa-lg"></i>' }, link: "https://github.com/ikenxuan/kkkkkk-10086" },
      {
        icon: {
          svg: '<i class="fa-brands fa-qq fa-fade fa-lg"></i>'
        },
        link: "http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=S8y6baEcSkO6TEO5kEdfgmJhz79Oxdw5&authKey=ficWQytHGz3KIv5i0HpGbEeMBpABBXfjEMYRzo3ZwMV%2B0Y5mq8cC0Yxbczfa904H&noverify=0&group_code=795874649"
      }
    ],
    lastUpdatedText: "\u6700\u540E\u7F16\u8F91\u4E8E",
    outlineTitle: "\u672C\u9875\u5927\u7EB2",
    docFooter: {
      prev: "\u4E0A\u4E00\u9875",
      next: "\u4E0B\u4E00\u9875"
    },
    //侧边栏文字更改(移动端)
    sidebarMenuLabel: "\u76EE\u5F55",
    //返回顶部文字修改(移动端)
    returnToTopLabel: "\u8FD4\u56DE\u9876\u90E8"
  }
}));
export {
  config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLnZpdGVwcmVzcy9jb25maWcudHMiLCAiLnZpdGVwcmVzcy9zY3JpcHQvbmF2LnRzIiwgIi52aXRlcHJlc3Mvc2NyaXB0L3NpZGViYXIudHMiLCAiLnZpdGVwcmVzcy9zY3JpcHQvcHdhLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRDpcXFxcR2l0SHViXFxcXGtra2tray0xMDA4Ni1kb2NzXFxcXC52aXRlcHJlc3NcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXEdpdEh1YlxcXFxra2tra2stMTAwODYtZG9jc1xcXFwudml0ZXByZXNzXFxcXGNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovR2l0SHViL2tra2tray0xMDA4Ni1kb2NzLy52aXRlcHJlc3MvY29uZmlnLnRzXCI7aW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgVVJMIH0gZnJvbSAnbm9kZTp1cmwnXHJcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGVwcmVzcydcclxuaW1wb3J0IHsgRGVmYXVsdFRoZW1lIH0gZnJvbSAndml0ZXByZXNzL3RoZW1lJ1xyXG5pbXBvcnQgbmF2IGZyb20gJy4vc2NyaXB0L25hdidcclxuaW1wb3J0IHNpZGViYXIgZnJvbSAnLi9zY3JpcHQvc2lkZWJhcidcclxuLy8gXHU2NUY2XHU5NUY0XHU3RUJGXHJcbmltcG9ydCB0aW1lbGluZSBmcm9tICd2aXRlcHJlc3MtbWFya2Rvd24tdGltZWxpbmUnXHJcbi8vIFx1NEVGQlx1NTJBMVx1NTIxN1x1ODg2OFxyXG5pbXBvcnQgdGFza0xpc3RzIGZyb20gXCJtYXJrZG93bi1pdC10YXNrLWxpc3RzXCJcclxuLy8gbWF0aGpheDNcdTUxNkNcdTVGMEZcdTY1MkZcdTYzMDFcclxuaW1wb3J0IG1hdGhqYXgzIGZyb20gJ21hcmtkb3duLWl0LW1hdGhqYXgzJ1xyXG4vLyBcdTk4NzVcdTgxMUFcclxuaW1wb3J0IGZvb3Rub3RlX3BsdWdpbiBmcm9tICdtYXJrZG93bi1pdC1mb290bm90ZSdcclxuLy8gXHU1M0NDXHU1NDExXHU5NEZFXHU2M0E1XHJcbmltcG9ydCB7IEJpRGlyZWN0aW9uYWxMaW5rcyB9IGZyb20gJ0Bub2xlYmFzZS9tYXJrZG93bi1pdC1iaS1kaXJlY3Rpb25hbC1saW5rcydcclxuLy8gXHU4ODRDXHU1MTg1XHU5NEZFXHU2M0E1XHU5ODg0XHU4OUM4XHJcbmltcG9ydCB7IElubGluZUxpbmtQcmV2aWV3RWxlbWVudFRyYW5zZm9ybSB9IGZyb20gJ0Bub2xlYmFzZS92aXRlcHJlc3MtcGx1Z2luLWlubGluZS1saW5rLXByZXZpZXcvbWFya2Rvd24taXQnXHJcbi8vIFx1NTdGQVx1NEU4RWdpdFx1NzY4NFx1OTg3NVx1OTc2Mlx1NTM4Nlx1NTNGMlxyXG5pbXBvcnQge1xyXG4gIEdpdENoYW5nZWxvZyxcclxuICBHaXRDaGFuZ2Vsb2dNYXJrZG93blNlY3Rpb24sXHJcbn0gZnJvbSAnQG5vbGViYXNlL3ZpdGVwcmVzcy1wbHVnaW4tZ2l0LWNoYW5nZWxvZy92aXRlJ1xyXG4vLyBcdTk4NzVcdTk3NjJcdTVDNUVcdTYwMjdcclxuaW1wb3J0IHtcclxuICBQYWdlUHJvcGVydGllcyxcclxuICBQYWdlUHJvcGVydGllc01hcmtkb3duU2VjdGlvblxyXG59IGZyb20gJ0Bub2xlYmFzZS92aXRlcHJlc3MtcGx1Z2luLXBhZ2UtcHJvcGVydGllcy92aXRlJ1xyXG4vLyBcdTdGMjlcdTc1NjVcdTU2RkVcdTZBMjFcdTdDQ0FcdTU0QzhcdTVFMENcdTc1MUZcdTYyMTBcclxuaW1wb3J0IHsgVGh1bWJuYWlsSGFzaEltYWdlcyB9IGZyb20gJ0Bub2xlYmFzZS92aXRlcHJlc3MtcGx1Z2luLXRodW1ibmFpbC1oYXNoL3ZpdGUnXHJcbi8vIFx1NEVFM1x1NzgwMVx1NTc1N1x1NTE4NVx1NzY4NFx1NEVFM1x1NzgwMVx1N0M3Qlx1NTc4Qlx1NjNEMFx1NzkzQVxyXG5pbXBvcnQgeyB0cmFuc2Zvcm1lclR3b3NsYXNoIH0gZnJvbSAnQHNoaWtpanMvdml0ZXByZXNzLXR3b3NsYXNoJ1xyXG4vLyBwd2FcdTY1MkZcdTYzMDFcclxuaW1wb3J0IHB3YSBmcm9tICcuL3NjcmlwdC9wd2EnXHJcbmltcG9ydCB7IHdpdGhQd2EgfSBmcm9tIFwiQHZpdGUtcHdhL3ZpdGVwcmVzc1wiXHJcbi8vIFx1NEVFM1x1NzgwMVx1N0VDNFx1NTZGRVx1NjgwN1xyXG5pbXBvcnQgeyBncm91cEljb25NZFBsdWdpbiwgZ3JvdXBJY29uVml0ZVBsdWdpbiB9IGZyb20gJ3ZpdGVwcmVzcy1wbHVnaW4tZ3JvdXAtaWNvbnMnXHJcblxyXG5leHBvcnQgZGVmYXVsdFxyXG4gIHdpdGhQd2EoZGVmaW5lQ29uZmlnKHtcclxuICAgIHB3YSxcclxuICAgIGxhbmc6ICd6aC1DTicsXHJcbiAgICB0aXRsZTogJ2tra2tray0xMDA4NicsXHJcbiAgICB0aXRsZVRlbXBsYXRlOiAnWXVuemFpLUJvdCBcdTc2ODRcdTg5QzZcdTk4OTFcdTg5RTNcdTY3OTBcdTYzRDJcdTRFRjYnLFxyXG4gICAgZGVzY3JpcHRpb246ICdZdW56YWktQm90IFx1NzY4NFx1ODlDNlx1OTg5MVx1ODlFM1x1Njc5MFx1NjNEMlx1NEVGNicsXHJcbiAgICBtYXJrZG93bjoge1xyXG4gICAgICBtYXRoOiB0cnVlLFxyXG4gICAgICAvLyBcdTUxNjhcdTVDNDBcdTRFRTNcdTc4MDFcdTU3NTdcdTg4NENcdTUzRjdcdTY2M0VcdTc5M0FcclxuICAgICAgbGluZU51bWJlcnM6IHRydWUsXHJcbiAgICAgIGltYWdlOiB7XHJcbiAgICAgICAgLy8gXHU1RjAwXHU1NDJGXHU1NkZFXHU3MjQ3XHU2MUQyXHU1MkEwXHU4RjdEXHJcbiAgICAgICAgbGF6eUxvYWRpbmc6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICAgIGNvbmZpZzogKG1kKSA9PiB7XHJcbiAgICAgICAgLy8gXHU2NUY2XHU5NUY0XHU3RUJGXHJcbiAgICAgICAgbWQudXNlKHRpbWVsaW5lKVxyXG4gICAgICAgIC8vIFx1NEVGQlx1NTJBMVx1NTIxN1x1ODg2OFxyXG4gICAgICAgIG1kLnVzZSh0YXNrTGlzdHMpXHJcbiAgICAgICAgLy8gXHU1MTZDXHU1RjBGXHJcbiAgICAgICAgbWQudXNlKG1hdGhqYXgzKVxyXG4gICAgICAgIC8vIFx1ODExQVx1NkNFOFxyXG4gICAgICAgIG1kLnVzZShmb290bm90ZV9wbHVnaW4pXHJcbiAgICAgICAgLy8gXHU1M0NDXHU1NDExXHU5NEZFXHU2M0E1XHJcbiAgICAgICAgbWQudXNlKEJpRGlyZWN0aW9uYWxMaW5rcygpKVxyXG4gICAgICAgIC8vIFx1ODg0Q1x1NTE4NVx1OTRGRVx1NjNBNVx1OTg4NFx1ODlDOFxyXG4gICAgICAgIG1kLnVzZShJbmxpbmVMaW5rUHJldmlld0VsZW1lbnRUcmFuc2Zvcm0pXHJcbiAgICAgICAgLy8gXHU0RUUzXHU3ODAxXHU3RUM0XHU1NkZFXHU2ODA3XHJcbiAgICAgICAgbWQudXNlKGdyb3VwSWNvbk1kUGx1Z2luKVxyXG4gICAgICB9LFxyXG4gICAgICBjb2RlVHJhbnNmb3JtZXJzOiBbXHJcbiAgICAgICAgdHJhbnNmb3JtZXJUd29zbGFzaCgpXHJcbiAgICAgIF1cclxuICAgIH0sXHJcbiAgICB2aXRlOiB7XHJcbiAgICAgIHBsdWdpbnM6IFtcclxuICAgICAgICBUaHVtYm5haWxIYXNoSW1hZ2VzKCksXHJcbiAgICAgICAgR2l0Q2hhbmdlbG9nKHtcclxuICAgICAgICAgIG1heEdpdExvZ0NvdW50OiAyMDAwLFxyXG4gICAgICAgICAgLy8gXHU4OTgxXHU4M0I3XHU1M0Q2Z2l0XHU2NUU1XHU1RkQ3XHU3Njg0XHU0RUQzXHU1RTkzXHJcbiAgICAgICAgICByZXBvVVJMOiAoKSA9PiAnaHR0cHM6Ly9naXRodWIuY29tL2lrZW54dWFuL2tra2tray0xMDA4NicsXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgR2l0Q2hhbmdlbG9nTWFya2Rvd25TZWN0aW9uKHtcclxuICAgICAgICAgIGV4Y2x1ZGU6IChpZCkgPT4gaWQuZW5kc1dpdGgoJ2luZGV4Lm1kJyksXHJcbiAgICAgICAgICBzZWN0aW9uczoge1xyXG4gICAgICAgICAgICAvLyBcdTc5ODFcdTc1MjhcdTk4NzVcdTk3NjJcdTUzODZcdTUzRjJcclxuICAgICAgICAgICAgZGlzYWJsZUNoYW5nZWxvZzogZmFsc2UsXHJcbiAgICAgICAgICAgIC8vIFx1Nzk4MVx1NzUyOFx1OEQyMVx1NzMyRVx1ODAwNVxyXG4gICAgICAgICAgICBkaXNhYmxlQ29udHJpYnV0b3JzOiB0cnVlLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9KSxcclxuICAgICAgICAvLyBcdTk4NzVcdTk3NjJcdTVDNUVcdTYwMjdcclxuICAgICAgICBQYWdlUHJvcGVydGllcygpLFxyXG4gICAgICAgIFBhZ2VQcm9wZXJ0aWVzTWFya2Rvd25TZWN0aW9uKHtcclxuICAgICAgICAgIGV4Y2x1ZGVzOiBbXHJcbiAgICAgICAgICAgICdpbmRleC5tZCcsXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIC8vIFx1NEVFM1x1NzgwMVx1N0VDNFx1NTZGRVx1NjgwN1xyXG4gICAgICAgIGdyb3VwSWNvblZpdGVQbHVnaW4oKVxyXG4gICAgICBdLFxyXG4gICAgICBvcHRpbWl6ZURlcHM6IHtcclxuICAgICAgICBleGNsdWRlOiBbXHJcbiAgICAgICAgICAnQG5vbGViYXNlL3ZpdGVwcmVzcy1wbHVnaW4tZW5oYW5jZWQtcmVhZGFiaWxpdGllcy9jbGllbnQnLFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0sXHJcbiAgICAgIHNzcjoge1xyXG4gICAgICAgIG5vRXh0ZXJuYWw6IFtcclxuICAgICAgICAgICdAbm9sZWJhc2UvKicsXHJcbiAgICAgICAgXVxyXG4gICAgICB9XHJcbiAgICB9LFxyXG4gICAgdnVlOiB7XHJcbiAgICAgIHRlbXBsYXRlOiB7XHJcbiAgICAgICAgY29tcGlsZXJPcHRpb25zOiB7XHJcbiAgICAgICAgICBpc0N1c3RvbUVsZW1lbnQ6ICh0YWcpID0+IHRhZyA9PT0gJ2ljb25pZnktaWNvbidcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICAgIGNsZWFuVXJsczogdHJ1ZSxcclxuICAgIGJhc2U6ICcva2tra2trLTEwMDg2LycsXHJcbiAgICBsYXN0VXBkYXRlZDogdHJ1ZSxcclxuICAgIC8vIFx1N0FEOVx1NzBCOVx1NTczMFx1NTZGRVxyXG4gICAgc2l0ZW1hcDoge1xyXG4gICAgICBob3N0bmFtZTogJ2h0dHBzOi8vaWtlbnh1YW4uZ2l0aHViLmlvL2tra2tray0xMDA4Ni8nLFxyXG4gICAgfSxcclxuICAgIGhlYWQ6IFtcclxuICAgICAgWydsaW5rJywgeyByZWw6ICdpY29uJywgaHJlZjogJy9ra2tra2stMTAwODYvbG9nby5wbmcnIH1dLCAvL1x1OTBFOFx1N0Y3Mlx1NTIzMHZpdGVwcmVzc1x1NEVEM1x1NUU5M1xyXG4gICAgXSxcclxuICAgIHRoZW1lQ29uZmlnOiB7XHJcbiAgICAgIGxvZ286IHtcclxuICAgICAgICBzcmM6ICcvbG9nby5wbmcnLFxyXG4gICAgICB9LFxyXG4gICAgICAvLyBodHRwczovL3ZpdGVwcmVzcy5kZXYvcmVmZXJlbmNlL2RlZmF1bHQtdGhlbWUtY29uZmlnXHJcbiAgICAgIC8vIFx1NjI0Qlx1NjczQVx1N0FFRlx1NkRGMVx1NkQ0NVx1NkEyMVx1NUYwRlx1NjU4N1x1NUI1N1x1NEZFRVx1NjUzOVxyXG4gICAgICBkYXJrTW9kZVN3aXRjaExhYmVsOiAnXHU2REYxXHU2RDQ1XHU2QTIxXHU1RjBGJyxcclxuICAgICAgZWRpdExpbms6IHtcclxuICAgICAgICBwYXR0ZXJuOiAnaHR0cHM6Ly9naXRodWIuY29tL2lrZW54dWFuL2tra2tray0xMDA4Ni9lZGl0L2RvY3MvOnBhdGgnLFxyXG4gICAgICAgIHRleHQ6ICdcdTU3MjggR2l0SHViIFx1NEUwQVx1N0YxNlx1OEY5MVx1NkI2NFx1OTg3NVx1OTc2MicsXHJcbiAgICAgIH0sXHJcbiAgICAgIG5hdjogbmF2IGFzIERlZmF1bHRUaGVtZS5OYXZJdGVtW10sXHJcbiAgICAgIHNlYXJjaDoge1xyXG4gICAgICAgIHByb3ZpZGVyOiAnbG9jYWwnLFxyXG4gICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgIGxvY2FsZXM6IHtcclxuICAgICAgICAgICAgcm9vdDoge1xyXG4gICAgICAgICAgICAgIHRyYW5zbGF0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgYnV0dG9uOiB7XHJcbiAgICAgICAgICAgICAgICAgIGJ1dHRvblRleHQ6ICdcdTY0MUNcdTdEMjJcdTY1ODdcdTY4NjMnLFxyXG4gICAgICAgICAgICAgICAgICBidXR0b25BcmlhTGFiZWw6ICdcdTY0MUNcdTdEMjJcdTY1ODdcdTY4NjMnXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgbW9kYWw6IHtcclxuICAgICAgICAgICAgICAgICAgbm9SZXN1bHRzVGV4dDogJ1x1NjVFMFx1NkNENVx1NjI3RVx1NTIzMFx1NzZGOFx1NTE3M1x1N0VEM1x1Njc5QycsXHJcbiAgICAgICAgICAgICAgICAgIHJlc2V0QnV0dG9uVGl0bGU6ICdcdTZFMDVcdTk2NjRcdTY3RTVcdThCRTJcdTY3NjFcdTRFRjYnLFxyXG4gICAgICAgICAgICAgICAgICBmb290ZXI6IHtcclxuICAgICAgICAgICAgICAgICAgICBzZWxlY3RUZXh0OiAnXHU5MDA5XHU2MkU5JyxcclxuICAgICAgICAgICAgICAgICAgICBuYXZpZ2F0ZVRleHQ6ICdcdTUyMDdcdTYzNjInXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHNpZGViYXI6IHNpZGViYXIsXHJcbiAgICAgIHNvY2lhbExpbmtzOiBbXHJcbiAgICAgICAgeyBpY29uOiB7IHN2ZzogJzxpIGNsYXNzPVwiZmEtYnJhbmRzIGZhLWdpdGh1YiBmYS1mYWRlIGZhLWxnXCI+PC9pPicgfSwgbGluazogJ2h0dHBzOi8vZ2l0aHViLmNvbS9pa2VueHVhbi9ra2tra2stMTAwODYnIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgaWNvbjoge1xyXG4gICAgICAgICAgICBzdmc6ICc8aSBjbGFzcz1cImZhLWJyYW5kcyBmYS1xcSBmYS1mYWRlIGZhLWxnXCI+PC9pPicsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgbGluazogJ2h0dHA6Ly9xbS5xcS5jb20vY2dpLWJpbi9xbS9xcj9fd3Y9MTAyNyZrPVM4eTZiYUVjU2tPNlRFTzVrRWRmZ21KaHo3OU94ZHc1JmF1dGhLZXk9ZmljV1F5dEhHejNLSXY1aTBIcEdiRWVNQnBBQkJYZmpFTVlSem8zWndNViUyQjBZNW1xOGNDMFl4YmN6ZmE5MDRIJm5vdmVyaWZ5PTAmZ3JvdXBfY29kZT03OTU4NzQ2NDknLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIF0sXHJcbiAgICAgIGxhc3RVcGRhdGVkVGV4dDogJ1x1NjcwMFx1NTQwRVx1N0YxNlx1OEY5MVx1NEU4RScsXHJcbiAgICAgIG91dGxpbmVUaXRsZTogJ1x1NjcyQ1x1OTg3NVx1NTkyN1x1N0VCMicsXHJcbiAgICAgIGRvY0Zvb3Rlcjoge1xyXG4gICAgICAgIHByZXY6ICdcdTRFMEFcdTRFMDBcdTk4NzUnLFxyXG4gICAgICAgIG5leHQ6ICdcdTRFMEJcdTRFMDBcdTk4NzUnLFxyXG4gICAgICB9LFxyXG4gICAgICAvL1x1NEZBN1x1OEZCOVx1NjgwRlx1NjU4N1x1NUI1N1x1NjZGNFx1NjUzOShcdTc5RkJcdTUyQThcdTdBRUYpXHJcbiAgICAgIHNpZGViYXJNZW51TGFiZWw6ICdcdTc2RUVcdTVGNTUnLFxyXG5cclxuICAgICAgLy9cdThGRDRcdTU2REVcdTk4NzZcdTkwRThcdTY1ODdcdTVCNTdcdTRGRUVcdTY1MzkoXHU3OUZCXHU1MkE4XHU3QUVGKVxyXG4gICAgICByZXR1cm5Ub1RvcExhYmVsOiAnXHU4RkQ0XHU1NkRFXHU5ODc2XHU5MEU4JyxcclxuICAgIH0sXHJcbiAgfSkpIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxHaXRIdWJcXFxca2tra2trLTEwMDg2LWRvY3NcXFxcLnZpdGVwcmVzc1xcXFxzY3JpcHRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXEdpdEh1YlxcXFxra2tra2stMTAwODYtZG9jc1xcXFwudml0ZXByZXNzXFxcXHNjcmlwdFxcXFxuYXYudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L0dpdEh1Yi9ra2tra2stMTAwODYtZG9jcy8udml0ZXByZXNzL3NjcmlwdC9uYXYudHNcIjtpbXBvcnQgYXhpb3MgZnJvbSAnYXhpb3MnXHJcblxyXG5jb25zdCBmaWxlID0gYXdhaXQgYXhpb3MuZ2V0KCdodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vaWtlbnh1YW4va2tra2trLTEwMDg2L21hc3Rlci9wYWNrYWdlLmpzb24nKVxyXG5jb25zdCBuYXYgPSBbXHJcbiAgeyB0ZXh0OiAnXHU0RTNCXHU5ODc1JywgbGluazogJy8nIH0sXHJcbiAgeyB0ZXh0OiAnXHU1RTM4XHU4OUMxXHU5NUVFXHU5ODk4JywgbGluazogJy9kb2NzL2ludHJvL1FBJyB9LFxyXG4gIHtcclxuICAgIHRleHQ6ICdcdUQ4M0NcdURGNDlcdTU5MjdcdTdFQjInLFxyXG4gICAgaXRlbXM6IFtcclxuICAgICAge1xyXG4gICAgICAgIHRleHQ6ICdcdTVGRUJcdTkwMUZcdTVGMDBcdTU5Q0InLFxyXG4gICAgICAgIGl0ZW1zOiBbXHJcbiAgICAgICAgICB7IHRleHQ6ICdcdTdCODBcdTRFQ0InLCBsaW5rOiAnL2RvY3Mvc3RhcnQvc3RhcnQnIH0sXHJcbiAgICAgICAgICB7IHRleHQ6ICdcdTVCODlcdTg4QzVcdTYzRDJcdTRFRjYnLCBsaW5rOiAnL2RvY3Mvc3RhcnQvaW5zdGFsbCcgfSxcclxuICAgICAgICAgIHsgdGV4dDogJ1x1OTE0RFx1N0Y2RVx1NjU4N1x1NEVGNicsIGxpbms6ICcvZG9jcy9zdGFydC9zdGFydC5jb25maWcnIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgfSxcclxuICAgICAge1xyXG4gICAgICAgIHRleHQ6ICdcdTUyOUZcdTgwRkQnLFxyXG4gICAgICAgIGl0ZW1zOiBbXHJcbiAgICAgICAgICB7IHRleHQ6ICdcdTRGNUNcdTU0QzFcdTg5RTNcdTY3OTAnLCBsaW5rOiAnL2RvY3MvaW50cm8vbWFpbi9tYWluJyB9LFxyXG4gICAgICAgICAgeyB0ZXh0OiAnXHU1MkE4XHU2MDAxXHU2M0E4XHU5MDAxJywgbGluazogJy9kb2NzL2ludHJvL3B1c2gnIH0sXHJcbiAgICAgICAgICB7IHRleHQ6ICdBUEkgU2VydmVyJywgbGluazogJy9kb2NzL2ludHJvL2FwaXNlcnZlcicgfSxcclxuICAgICAgICAgIHsgdGV4dDogJ1x1NTE3Nlx1NEVENlx1NTI5Rlx1ODBGRCcsIGxpbms6ICcvZG9jcy9pbnRyby9vdGhlcicgfSxcclxuICAgICAgICBdLFxyXG4gICAgICB9LFxyXG4gICAgICB7XHJcbiAgICAgICAgdGV4dDogJ1x1NTE3Nlx1NEVENicsXHJcbiAgICAgICAgaXRlbXM6IFtcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgdGV4dDogJ1x1OTA0N1x1NTIzMFx1OTVFRVx1OTg5OFx1NEU4Nlx1RkYxRicsIGxpbms6ICcvZG9jcy9pbnRyby9wcm9ibGVtcycsIGl0ZW1zOiBbXHJcbiAgICAgICAgICAgICAgeyB0ZXh0OiAnXHU1RTM4XHU4OUMxXHU5NUVFXHU5ODk4XHU4OUUzXHU3QjU0JywgbGluazogJy9kb2NzL2ludHJvL1FBJyB9LFxyXG4gICAgICAgICAgICBdXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgeyB0ZXh0OiAnXHU2Mjk1XHU1NTgyJywgbGluazogJy9kb2NzL290aGVyL2FmZGlhbicgfSxcclxuICAgICAgICAgIHsgdGV4dDogJ1x1NTE0RFx1OEQyM1x1NThGMFx1NjYwRScsIGxpbms6ICcvZG9jcy9vdGhlci9kaXNjbGFpbWVyJyB9LFxyXG4gICAgICAgICAgeyB0ZXh0OiAnXHU3MjQ4XHU2NzJDXHU1Mzg2XHU1M0YyJywgbGluazogJy9kb2NzL290aGVyL3RpbWVsaW5lJyB9LFxyXG5cclxuICAgICAgICBdLFxyXG4gICAgICB9LFxyXG4gICAgXSxcclxuICB9LFxyXG4gIHsgdGV4dDogYGtra2tray0xMDA4NiB2JHtmaWxlLmRhdGEudmVyc2lvbn1gLCBsaW5rOiBgaHR0cHM6Ly9naXRodWIuY29tL2lrZW54dWFuL2tra2tray0xMDA4Ni9yZWxlYXNlcy90YWcvdiR7ZmlsZS5kYXRhLnZlcnNpb259YCwgbm9JY29uOiBmYWxzZSB9LFxyXG5dXHJcblxyXG5cclxuZXhwb3J0IGRlZmF1bHQgbmF2XHJcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRDpcXFxcR2l0SHViXFxcXGtra2tray0xMDA4Ni1kb2NzXFxcXC52aXRlcHJlc3NcXFxcc2NyaXB0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxHaXRIdWJcXFxca2tra2trLTEwMDg2LWRvY3NcXFxcLnZpdGVwcmVzc1xcXFxzY3JpcHRcXFxcc2lkZWJhci50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovR2l0SHViL2tra2tray0xMDA4Ni1kb2NzLy52aXRlcHJlc3Mvc2NyaXB0L3NpZGViYXIudHNcIjtjb25zdCBzaWRlYmFyID0gW1xyXG4gIHtcclxuICAgIHRleHQ6ICdcdTVGRUJcdTkwMUZcdTVGMDBcdTU5Q0InLFxyXG4gICAgaXRlbXM6IFtcclxuICAgICAgeyB0ZXh0OiAnPGkgY2xhc3M9XCJmYS1zb2xpZCBmYS1wbGF5IGZhLWJlYXRcIj48L2k+IFx1N0I4MFx1NEVDQicsIGxpbms6ICcvZG9jcy9zdGFydC9zdGFydCcgfSxcclxuICAgICAgeyB0ZXh0OiAnPGkgY2xhc3M9XCJmYS1zb2xpZCBmYS1kb3dubG9hZCBmYS1mYWRlXCI+PC9pPiBcdTVCODlcdTg4QzVcdTYzRDJcdTRFRjYnLCBsaW5rOiAnL2RvY3Mvc3RhcnQvaW5zdGFsbCcgfSxcclxuICAgICAgeyB0ZXh0OiAnPGkgY2xhc3M9XCJmYS1zb2xpZCBmYS1nZWFyIGZhLXNwaW5cIj48L2k+IFx1OTE0RFx1N0Y2RVx1NjU4N1x1NEVGNicsIGxpbms6ICcvZG9jcy9zdGFydC9zdGFydC5jb25maWcnIH0sXHJcbiAgICBdLFxyXG4gIH0sXHJcbiAge1xyXG4gICAgdGV4dDogJ1x1NTI5Rlx1ODBGRCcsXHJcbiAgICBpdGVtczogW1xyXG4gICAgICB7XHJcbiAgICAgICAgdGV4dDogJzxpIGNsYXNzPVwiZmEtc29saWQgZmEtYmFycyBmYS1mbGlwXCI+PC9pPiBcdTRGNUNcdTU0QzFcdTg5RTNcdTY3OTAnLCBsaW5rOiAnL2RvY3MvaW50cm8vbWFpbi9tYWluJywgaXRlbXM6IFtcclxuICAgICAgICAgIHsgdGV4dDogJzxpIGNsYXNzPVwiZmEtYnJhbmRzIGZhLXRpa3RvayBmYS1mYWRlXCI+PC9pPiBcdTYyOTZcdTk3RjNcdTc2RjhcdTUxNzMnLCBsaW5rOiAnL2RvY3MvaW50cm8vbWFpbi9kb3V5aW4nLCB9LFxyXG4gICAgICAgICAgeyB0ZXh0OiAnPGkgY2xhc3M9XCJmYS1icmFuZHMgZmEtYmlsaWJpbGkgZmEtZmFkZVwiPjwvaT4gQlx1N0FEOVx1NzZGOFx1NTE3MycsIGxpbms6ICcvZG9jcy9pbnRyby9tYWluL2JpbGliaWxpJyB9LFxyXG4gICAgICAgICAgeyB0ZXh0OiAnXHU1RkVCXHU2MjRCXHU3NkY4XHU1MTczJywgbGluazogJy9kb2NzL2ludHJvL21haW4va3VhaXNob3UnIH0sXHJcbiAgICAgICAgXVxyXG4gICAgICB9LFxyXG4gICAgICB7IHRleHQ6ICc8aSBjbGFzcz1cImZhLWJyYW5kcyBmYS1wdXNoZWQgZmEtZmFkZVwiPjwvaT4gXHU1MkE4XHU2MDAxXHU2M0E4XHU5MDAxJywgbGluazogJy9kb2NzL2ludHJvL3B1c2gnIH0sXHJcbiAgICAgIHsgdGV4dDogJzxpIGNsYXNzPVwiZmEtc29saWQgZmEtc2VydmVyIGZhLWZhZGVcIj48L2k+IEFQSSBTZXJ2ZXInLCBsaW5rOiAnL2RvY3MvaW50cm8vYXBpc2VydmVyJyB9LFxyXG4gICAgICB7IHRleHQ6ICdcdTUxNzZcdTRFRDZcdTUyOUZcdTgwRkQnLCBsaW5rOiAnL2RvY3MvaW50cm8vb3RoZXInIH0sXHJcbiAgICBdLFxyXG4gIH0sXHJcbiAge1xyXG4gICAgdGV4dDogJ1x1NTE3Nlx1NEVENicsXHJcbiAgICBpdGVtczogW1xyXG4gICAgICB7XHJcbiAgICAgICAgdGV4dDogJzxpIGNsYXNzPVwiZmEtc29saWQgZmEtcXVlc3Rpb24gZmEtZmFkZVwiPjwvaT4gXHU5MDQ3XHU1MjMwXHU5NUVFXHU5ODk4XHU0RTg2XHVGRjFGJywgbGluazogJy9kb2NzL2ludHJvL3Byb2JsZW1zJywgaXRlbXM6IFtcclxuICAgICAgICAgIHsgdGV4dDogJzxpIGNsYXNzPVwiZmEtc29saWQgZmEtZmlsZS1jaXJjbGUtcXVlc3Rpb24gZmEtZmFkZVwiPjwvaT4gXHU1RTM4XHU4OUMxXHU5NUVFXHU5ODk4XHU4OUUzXHU3QjU0JywgbGluazogJy9kb2NzL2ludHJvL1FBJyB9LFxyXG4gICAgICAgIF1cclxuICAgICAgfSxcclxuICAgICAgeyB0ZXh0OiAnPGkgY2xhc3M9XCJmYS1zb2xpZCBmYS1oYW5kLWhvbGRpbmctaGVhcnQgZmEtZmFkZVwiPjwvaT4gXHU2Mjk1XHU1NTgyJywgbGluazogJy9kb2NzL290aGVyL2FmZGlhbicgfSxcclxuICAgICAgeyB0ZXh0OiAnPGkgY2xhc3M9XCJmYS1zb2xpZCBmYS10cmlhbmdsZS1leGNsYW1hdGlvbiBmYS1mYWRlXCI+PC9pPiBcdTUxNERcdThEMjNcdTU4RjBcdTY2MEUnLCBsaW5rOiAnL2RvY3Mvb3RoZXIvZGlzY2xhaW1lcicgfSxcclxuICAgICAgeyB0ZXh0OiAnPGkgY2xhc3M9XCJmYS1zb2xpZCBmYS1jb2RlLWJyYW5jaCBmYS1mYWRlXCI+PC9pPiBcdTcyNDhcdTY3MkNcdTUzODZcdTUzRjInLCBsaW5rOiAnL2RvY3Mvb3RoZXIvdGltZWxpbmUnIH0sXHJcbiAgICBdLFxyXG4gIH0sXHJcbl1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IHNpZGViYXIiLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkQ6XFxcXEdpdEh1YlxcXFxra2tra2stMTAwODYtZG9jc1xcXFwudml0ZXByZXNzXFxcXHNjcmlwdFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxcR2l0SHViXFxcXGtra2tray0xMDA4Ni1kb2NzXFxcXC52aXRlcHJlc3NcXFxcc2NyaXB0XFxcXHB3YS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovR2l0SHViL2tra2tray0xMDA4Ni1kb2NzLy52aXRlcHJlc3Mvc2NyaXB0L3B3YS50c1wiO2ltcG9ydCB7IHJlc29sdmUgfSBmcm9tIFwicGF0aFwiXHJcbmltcG9ydCBmZyBmcm9tICdmYXN0LWdsb2InXHJcbmltcG9ydCB0eXBlIHsgVml0ZVBXQU9wdGlvbnMgfSBmcm9tIFwidml0ZS1wbHVnaW4tcHdhXCJcclxuXHJcbmNvbnN0IHB3YTogUGFydGlhbDxWaXRlUFdBT3B0aW9ucz4gPSB7XHJcbiAgLy8gXHU2ODM5XHU3NkVFXHU1RjU1XHJcbiAgb3V0RGlyOiAnLi4vZGlzdCcsXHJcbiAgcmVnaXN0ZXJUeXBlOiBcImF1dG9VcGRhdGVcIixcclxuICBpbmNsdWRlTWFuaWZlc3RJY29uczogZmFsc2UsXHJcbiAgaW5jbHVkZUFzc2V0czogZmcuc3luYygnKiovKi57cG5nLHN2ZyxnaWYsaWNvLHR4dH0nLCB7IGN3ZDogcmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLi9wdWJsaWMnKSB9KSxcclxuICBtYW5pZmVzdDoge1xyXG4gICAgaWQ6IFwiL1wiLFxyXG4gICAgbmFtZTogJ2tra2tray0xMDA4NicsXHJcbiAgICBzaG9ydF9uYW1lOiAna2tra2trLTEwMDg2JyxcclxuICAgIGRlc2NyaXB0aW9uOiAnXHU5MDAyXHU3NTI4XHU0RThFIFl1bnphaSAvIEthcmluIFx1NzUxRlx1NjAwMVx1NzY4NFx1ODlDNlx1OTg5MVx1ODlFM1x1Njc5MFx1MzAwMVx1NjNBOFx1OTAwMVx1NjNEMlx1NEVGNicsXHJcbiAgICB0aGVtZV9jb2xvcjogXCIjZmZmZmZmXCIsXHJcbiAgICBpY29uczogW1xyXG4gICAgICB7XHJcbiAgICAgICAgc3JjOiBcIi9sb2dvLnBuZ1wiLFxyXG4gICAgICAgIHNpemVzOiBcIjEyMHgxMjBcIixcclxuICAgICAgICB0eXBlOiBcImltYWdlL3BuZ1wiLFxyXG4gICAgICB9LFxyXG4gICAgICB7XHJcbiAgICAgICAgc3JjOiBcIi9sb2dvLnBuZ1wiLFxyXG4gICAgICAgIHNpemVzOiBcIjE5MngxOTJcIixcclxuICAgICAgICB0eXBlOiBcImltYWdlL3BuZ1wiLFxyXG4gICAgICB9LFxyXG4gICAgICB7XHJcbiAgICAgICAgc3JjOiBcIi9sb2dvLnBuZ1wiLFxyXG4gICAgICAgIHNpemVzOiBcIjUxMng1MTJcIixcclxuICAgICAgICB0eXBlOiBcImltYWdlL3BuZ1wiLFxyXG4gICAgICAgIHB1cnBvc2U6IFwiYW55XCIsXHJcbiAgICAgIH0sXHJcbiAgICBdLFxyXG4gIH0sXHJcbiAgd29ya2JveDoge1xyXG4gICAgbmF2aWdhdGVGYWxsYmFja0RlbnlsaXN0OiBbL15cXC9uZXckL10sXHJcbiAgICBnbG9iUGF0dGVybnM6IFtcIioqLyoue2NzcyxqcyxodG1sLHN2ZyxwbmcsaWNvLHR4dCx3b2ZmMn1cIl0sXHJcbiAgICBydW50aW1lQ2FjaGluZzogW1xyXG4gICAgICB7XHJcbiAgICAgICAgdXJsUGF0dGVybjogbmV3IFJlZ0V4cCgnXmh0dHBzOi8vZm9udHMuZ29vZ2xlYXBpcy5jb20vLionLCAnaScpLFxyXG4gICAgICAgIGhhbmRsZXI6IFwiQ2FjaGVGaXJzdFwiLFxyXG4gICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgIGNhY2hlTmFtZTogXCJnb29nbGUtZm9udHMtY2FjaGVcIixcclxuICAgICAgICAgIGV4cGlyYXRpb246IHtcclxuICAgICAgICAgICAgbWF4RW50cmllczogMTAsXHJcbiAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDM2NSwgLy8gPD09IDM2NSBkYXlzXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgY2FjaGVhYmxlUmVzcG9uc2U6IHtcclxuICAgICAgICAgICAgc3RhdHVzZXM6IFswLCAyMDBdLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgICB7XHJcbiAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9mb250c1xcLmdzdGF0aWNcXC5jb21cXC8uKi9pLFxyXG4gICAgICAgIGhhbmRsZXI6IFwiQ2FjaGVGaXJzdFwiLFxyXG4gICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgIGNhY2hlTmFtZTogXCJnc3RhdGljLWZvbnRzLWNhY2hlXCIsXHJcbiAgICAgICAgICBleHBpcmF0aW9uOiB7XHJcbiAgICAgICAgICAgIG1heEVudHJpZXM6IDEwLFxyXG4gICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzNjUsIC8vIDw9PSAzNjUgZGF5c1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIGNhY2hlYWJsZVJlc3BvbnNlOiB7XHJcbiAgICAgICAgICAgIHN0YXR1c2VzOiBbMCwgMjAwXSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAge1xyXG4gICAgICAgIHVybFBhdHRlcm46IG5ldyBSZWdFeHAoJ15odHRwczovL2ZvbnRzLmdzdGF0aWMuY29tLy4qJywgJ2knKSxcclxuICAgICAgICBoYW5kbGVyOiBcIk5ldHdvcmtGaXJzdFwiLFxyXG4gICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgIGNhY2hlTmFtZTogXCJqc2RlbGl2ci1pbWFnZXMtY2FjaGVcIixcclxuICAgICAgICAgIGV4cGlyYXRpb246IHtcclxuICAgICAgICAgICAgbWF4RW50cmllczogMTAsXHJcbiAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDcsIC8vIDw9PSA3IGRheXNcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZToge1xyXG4gICAgICAgICAgICBzdGF0dXNlczogWzAsIDIwMF0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIHtcclxuICAgICAgICB1cmxQYXR0ZXJuOiBuZXcgUmVnRXhwKCdeaHR0cHM6Ly9jZG4uanNkZWxpdnIubmV0Ly4qJywgJ2knKSxcclxuICAgICAgICBoYW5kbGVyOiAnQ2FjaGVGaXJzdCcsXHJcbiAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgY2FjaGVOYW1lOiAnanNkZWxpdnItY2RuLWNhY2hlJyxcclxuICAgICAgICAgIGV4cGlyYXRpb246IHtcclxuICAgICAgICAgICAgbWF4RW50cmllczogMTAsXHJcbiAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDM2NSwgLy8gPD09IDM2NSBkYXlzXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgY2FjaGVhYmxlUmVzcG9uc2U6IHtcclxuICAgICAgICAgICAgc3RhdHVzZXM6IFswLCAyMDBdLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgICB7XHJcbiAgICAgICAgdXJsUGF0dGVybjogbmV3IFJlZ0V4cCgnXmh0dHBzOi8vKCgocmF3fHVzZXItaW1hZ2VzfGNhbW8pLmdpdGh1YnVzZXJjb250ZW50LmNvbSkpLy4qJywgJ2knKSxcclxuICAgICAgICBoYW5kbGVyOiAnQ2FjaGVGaXJzdCcsXHJcbiAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgY2FjaGVOYW1lOiAnZ2l0aHVidXNlcmNvbnRlbnQtaW1hZ2VzLWNhY2hlJyxcclxuICAgICAgICAgIGV4cGlyYXRpb246IHtcclxuICAgICAgICAgICAgbWF4RW50cmllczogMTAsXHJcbiAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDM2NSwgLy8gPD09IDM2NSBkYXlzXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgY2FjaGVhYmxlUmVzcG9uc2U6IHtcclxuICAgICAgICAgICAgc3RhdHVzZXM6IFswLCAyMDBdLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgXSxcclxuICB9LFxyXG59XHJcbmV4cG9ydCBkZWZhdWx0IHB3YSJdLAogICJtYXBwaW5ncyI6ICI7QUFDQSxTQUFTLG9CQUFvQjs7O0FDRHNSLE9BQU8sV0FBVztBQUVyVSxJQUFNLE9BQU8sTUFBTSxNQUFNLElBQUksNkVBQTZFO0FBQzFHLElBQU0sTUFBTTtBQUFBLEVBQ1YsRUFBRSxNQUFNLGdCQUFNLE1BQU0sSUFBSTtBQUFBLEVBQ3hCLEVBQUUsTUFBTSw0QkFBUSxNQUFNLGlCQUFpQjtBQUFBLEVBQ3ZDO0FBQUEsSUFDRSxNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTDtBQUFBLFFBQ0UsTUFBTTtBQUFBLFFBQ04sT0FBTztBQUFBLFVBQ0wsRUFBRSxNQUFNLGdCQUFNLE1BQU0sb0JBQW9CO0FBQUEsVUFDeEMsRUFBRSxNQUFNLDRCQUFRLE1BQU0sc0JBQXNCO0FBQUEsVUFDNUMsRUFBRSxNQUFNLDRCQUFRLE1BQU0sMkJBQTJCO0FBQUEsUUFDbkQ7QUFBQSxNQUNGO0FBQUEsTUFDQTtBQUFBLFFB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
