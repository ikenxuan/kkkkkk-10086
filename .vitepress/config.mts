import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "kkkkkk-10086",
  description: "A VitePress Site",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '主页', link: '/' },
      { text: '简介', link: '/page/start/' },
      { text: '功能', link: '/page/intro/douyin/' }
    ],

    sidebar: [
      {
        text: '简介',
        items: [
          { text: '快速开始', link: '/page/start/' },
        ]
      },
      {
        text: '功能',
        items: [
          { text: '抖音相关', link: '/page/intro/douyin/' },
          { text: 'B站相关', link: '/page/intro/bilibili/' },
          { text: '动态推送', link: '/page/intro/push/' },
          { text: '其他功能', link: '/page/intro/other/' },
          { text: '常见问题', link: '/page/intro/QA/' },
        ]
      },
      {
        text: '其他',
        items: [
          { text: '鸣谢', link: '/page/other/thanks/' },
          { text: '友情链接', link: '/page/other/Friendlylink/' },
          { text: '免责声明', link: '/page/other/disclaimer/' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ikenxuan/kkkkkk-10086' }
    ]
  },
  cleanUrls: true,
  base: '/kkkkkk-10086/'
})
