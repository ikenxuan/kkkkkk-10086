import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitepress'
import { DefaultTheme } from 'vitepress/theme'
import nav from './script/nav'
import sidebar from './script/sidebar'
// 时间线
import timeline from 'vitepress-markdown-timeline'
// 任务列表
import taskLists from "markdown-it-task-lists"
// mathjax3公式支持
import mathjax3 from 'markdown-it-mathjax3'
// 页脚
import footnote_plugin from 'markdown-it-footnote'
// 双向链接
import { BiDirectionalLinks } from '@nolebase/markdown-it-bi-directional-links'
// 行内链接预览
import { InlineLinkPreviewElementTransform } from '@nolebase/vitepress-plugin-inline-link-preview/markdown-it'
// 基于git的页面历史
import {
  GitChangelog,
  GitChangelogMarkdownSection,
} from '@nolebase/vitepress-plugin-git-changelog/vite'
// 页面属性
import {
  PageProperties,
  PagePropertiesMarkdownSection
} from '@nolebase/vitepress-plugin-page-properties/vite'
// 缩略图模糊哈希生成
import { ThumbnailHashImages } from '@nolebase/vitepress-plugin-thumbnail-hash/vite'
// 代码块内的代码类型提示
import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
// pwa支持
import pwa from './script/pwa'
import { withPwa } from "@vite-pwa/vitepress"


export default
  withPwa(defineConfig({
    pwa,
    lang: 'zh-CN',
    title: 'kkkkkk-10086',
    titleTemplate: 'Yunzai-Bot 的视频解析插件',
    description: 'Yunzai-Bot 的视频解析插件',
    markdown: {
      math: true,
      // 全局代码块行号显示
      lineNumbers: true,
      image: {
        // 开启图片懒加载
        lazyLoading: true,
      },
      config: (md) => {
        // 时间线
        md.use(timeline)
        // 任务列表
        md.use(taskLists)
        // 公式
        md.use(mathjax3)
        // 脚注
        md.use(footnote_plugin)
        // 双向链接
        md.use(BiDirectionalLinks())
        // 行内链接预览
        md.use(InlineLinkPreviewElementTransform)
      },
      codeTransformers: [
        transformerTwoslash()
      ]
    },
    vite: {
      plugins: [
        ThumbnailHashImages(),
        GitChangelog({
          maxGitLogCount: 2000,
          // 要获取git日志的仓库
          repoURL: () => 'https://github.com/ikenxuan/kkkkkk-10086',
        }),
        GitChangelogMarkdownSection({
          exclude: (id) => id.endsWith('index.md'),
          sections: {
            // 禁用页面历史
            disableChangelog: false,
            // 禁用贡献者
            disableContributors: true,
          },
        }),
        // 页面属性
        PageProperties(),
        PagePropertiesMarkdownSection({
          excludes: [
            'index.md',
          ],
        }),
      ],
      optimizeDeps: {
        exclude: [
          '@nolebase/vitepress-plugin-enhanced-readabilities/client',
        ],
      },
      ssr: {
        noExternal: [
          '@nolebase/*',
        ],
      },
      resolve: { alias: [{ find: /^.*\/VPFooter\.vue$/, replacement: '@theojs/lumen/Footer' }] },
      define: { FooterData: JSON.stringify(require('./data/fooertData.ts').Footer_Data) }
    },
    vue: {
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'iconify-icon'
        },
      },
    },
    cleanUrls: true,
    base: '/kkkkkk-10086/',
    lastUpdated: true,
    // 站点地图
    sitemap: {
      hostname: 'https://ikenxuan.github.io/kkkkkk-10086/',
    },
    head: [
      ['link', { rel: 'icon', href: '/kkkkkk-10086/logo.png' }], //部署到vitepress仓库
    ],
    themeConfig: {
      logo: {
        src: '/logo.png',
      },
      // https://vitepress.dev/reference/default-theme-config
      // 手机端深浅模式文字修改
      darkModeSwitchLabel: '深浅模式',
      editLink: {
        pattern: 'https://github.com/ikenxuan/kkkkkk-10086/edit/docs/:path',
        text: '在 GitHub 上编辑此页面',
      },
      nav: nav as DefaultTheme.NavItem[],
      search: {
        provider: 'local',
        options: {
          locales: {
            root: {
              translations: {
                button: {
                  buttonText: '搜索文档',
                  buttonAriaLabel: '搜索文档'
                },
                modal: {
                  noResultsText: '无法找到相关结果',
                  resetButtonTitle: '清除查询条件',
                  footer: {
                    selectText: '选择',
                    navigateText: '切换'
                  }
                }
              }
            }
          }
        }
      },
      sidebar: sidebar,
      socialLinks: [
        { icon: { svg: '<i class="fa-brands fa-github fa-fade fa-lg"></i>' }, link: 'https://github.com/ikenxuan/kkkkkk-10086' },
        {
          icon: {
            svg: '<i class="fa-brands fa-qq fa-fade fa-lg"></i>',
          },
          link: 'http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=S8y6baEcSkO6TEO5kEdfgmJhz79Oxdw5&authKey=ficWQytHGz3KIv5i0HpGbEeMBpABBXfjEMYRzo3ZwMV%2B0Y5mq8cC0Yxbczfa904H&noverify=0&group_code=795874649',
        },
      ],
      lastUpdatedText: '最后编辑于',
      outlineTitle: '本页大纲',
      footer: {
        message: "Released under the <a href='https://github.com/ikenxuan/kkkkkk-10086/blob/master/LICENSE'>GPL-3.0 License</a>",
        copyright: "Copyright © 2023-2024 <a href='https://github.com/ikenxuan'>ikenxuan</a>",
      },
      docFooter: {
        prev: '上一页',
        next: '下一页',
      },
      //侧边栏文字更改(移动端)
      sidebarMenuLabel: '目录',

      //返回顶部文字修改(移动端)
      returnToTopLabel: '返回顶部',
    },
  }))


const customElements = [
  'mjx-container',
  'mjx-assistive-mml',
  'math',
  'maction',
  'maligngroup',
  'malignmark',
  'menclose',
  'merror',
  'mfenced',
  'mfrac',
  'mi',
  'mlongdiv',
  'mmultiscripts',
  'mn',
  'mo',
  'mover',
  'mpadded',
  'mphantom',
  'mroot',
  'mrow',
  'ms',
  'mscarries',
  'mscarry',
  'mscarries',
  'msgroup',
  'mstack',
  'mlongdiv',
  'msline',
  'mstack',
  'mspace',
  'msqrt',
  'msrow',
  'mstack',
  'mstack',
  'mstyle',
  'msub',
  'msup',
  'msubsup',
  'mtable',
  'mtd',
  'mtext',
  'mtr',
  'munder',
  'munderover',
  'semantics',
  'math',
  'mi',
  'mn',
  'mo',
  'ms',
  'mspace',
  'mtext',
  'menclose',
  'merror',
  'mfenced',
  'mfrac',
  'mpadded',
  'mphantom',
  'mroot',
  'mrow',
  'msqrt',
  'mstyle',
  'mmultiscripts',
  'mover',
  'mprescripts',
  'msub',
  'msubsup',
  'msup',
  'munder',
  'munderover',
  'none',
  'maligngroup',
  'malignmark',
  'mtable',
  'mtd',
  'mtr',
  'mlongdiv',
  'mscarries',
  'mscarry',
  'msgroup',
  'msline',
  'msrow',
  'mstack',
  'maction',
  'semantics',
  'annotation',
  'annotation-xml',
]