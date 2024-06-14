import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: 'zh-CN',
  title: "kkkkkk-10086",
  description: 'Yunzai-Bot 的视频解析插件',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    editLink: {
      pattern: 'https://github.com/ikenxuan/kkkkkk-10086/edit/docs/:path',
      text: '在 GitHub 上编辑此页面'
    },
    nav: [
      { text: '主页', link: '/' },
      { text: '快速开始', link: '/page/start' },
      { text: '功能', link: '/page/intro/douyin' }
    ],
    search: {
      provider: 'local'
    },
    sidebar: [
      {
        text: '快速开始',
        items: [
          { text: '简介', link: '/page/start' },
          { text: '安装插件', link: '/page/install' },
          { text: '配置文件', link: '/page/start.config' },
        ]
      },
      {
        text: '功能',
        items: [
          { text: '抖音相关', link: '/page/intro/douyin' },
          { text: 'B站相关', link: '/page/intro/bilibili' },
          { text: '动态推送', link: '/page/intro/push' },
          { text: '其他功能', link: '/page/intro/other' },
          { text: '常见问题', link: '/page/intro/QA' },
        ]
      },
      {
        text: '其他',
        items: [
          { text: '友情链接', link: '/page/other/Friendlylink' },
          { text: '免责声明', link: '/page/other/disclaimer' },
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/ikenxuan/kkkkkk-10086' },
      {
        icon: {
          svg: '<svg t="1718335878865" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1729" width="200" height="200"><path d="M512 1024C229.248 1024 0 794.752 0 512S229.248 0 512 0s512 229.248 512 512-229.248 512-512 512z m259.168-568.896h-290.752a25.28 25.28 0 0 0-25.28 25.28l-0.032 63.232c0 13.952 11.296 25.28 25.28 25.28h177.024a25.28 25.28 0 0 1 25.28 25.28v12.64a75.84 75.84 0 0 1-75.84 75.84h-240.224a25.28 25.28 0 0 1-25.28-25.28v-240.192a75.84 75.84 0 0 1 75.84-75.84h353.92a25.28 25.28 0 0 0 25.28-25.28l0.064-63.2a25.312 25.312 0 0 0-25.28-25.312H417.184a189.632 189.632 0 0 0-189.632 189.6v353.952c0 13.952 11.328 25.28 25.28 25.28h372.928a170.656 170.656 0 0 0 170.656-170.656v-145.376a25.28 25.28 0 0 0-25.28-25.28z" p-id="1730"></path></svg>',
        },
        link: 'https://gitee.com/ikenxuan/kkkkkk-10086',
      }
    ],
    lastUpdatedText: "最后更新",
    outlineTitle: "本页目录",
    footer: {
      message: "Released under the MIT License",
      copyright: "Copyright © 2023-2024 ikenxuan",
    },
    docFooter: {
      prev: '上一页',
      next: '下一页'
    }
  },
  cleanUrls: true,
  base: '/kkkkkk-10086/',
  lastUpdated: true,
})
