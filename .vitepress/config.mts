import { defineConfig } from 'vitepress'
import timeline from 'vitepress-markdown-timeline'
import taskLists from "markdown-it-task-lists"
import mathjax3 from 'markdown-it-mathjax3'
import footnote_plugin from 'markdown-it-footnote'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: 'zh-CN',
  title: 'kkkkkk-10086',
  titleTemplate: 'Yunzai-Bot 的视频解析插件',
  description: 'Yunzai-Bot 的视频解析插件',
  markdown: {
    // 行号显示
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
    },
  },
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => customElements.includes(tag),
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
    nav: [
      { text: '主页', link: '/' },
      { text: '常见问题', link: '/docs/intro/QA' },
      {
        text: '🍉大纲',
        items: [
          {
            text: '快速开始',
            items: [
              { text: '简介', link: '/docs/start/start' },
              { text: '安装插件', link: '/docs/start/install' },
              { text: '配置文件', link: '/docs/start/start.config' },
            ],
          },
          {
            text: '功能',
            items: [
              { text: '抖音相关', link: '/docs/intro/douyin' },
              { text: 'B站相关', link: '/docs/intro/bilibili' },
              { text: '快手相关', link: '/docs/intro/kuaishou' },
              { text: '动态推送', link: '/docs/intro/push' },
              { text: '其他功能', link: '/docs/intro/other' },
            ],
          },
          {
            text: '其他',
            items: [
              { text: '常见问题', link: '/docs/intro/QA' },
              { text: '投喂', link: '/docs/other/afdian' },
              { text: '免责声明', link: '/docs/other/disclaimer' },
              { text: '版本历史', link: '/docs/other/timeline' },

            ],
          },
        ],
      },
    ],
    search: {
      provider: 'local',
    },
    sidebar: [
      {
        text: '快速开始',
        items: [
          { text: '简介', link: '/docs/start/start' },
          { text: '安装插件', link: '/docs/start/install' },
          { text: '配置文件', link: '/docs/start/start.config' },
        ],
      },
      {
        text: '功能',
        items: [
          { text: '抖音相关', link: '/docs/intro/douyin' },
          { text: 'B站相关', link: '/docs/intro/bilibili' },
          { text: '快手相关', link: '/docs/intro/kuaishou' },
          { text: '动态推送', link: '/docs/intro/push' },
          { text: '其他功能', link: '/docs/intro/other' },
        ],
      },
      {
        text: '其他',
        items: [
          { text: '常见问题', link: '/docs/intro/QA' },
          { text: '投喂', link: '/docs/other/afdian' },
          { text: '免责声明', link: '/docs/other/disclaimer' },
          { text: '版本历史', link: '/docs/other/timeline' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/ikenxuan/kkkkkk-10086' },
      {
        icon: {
          svg: '<svg t="1718335878865" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1729" width="200" height="200"><path d="M512 1024C229.248 1024 0 794.752 0 512S229.248 0 512 0s512 229.248 512 512-229.248 512-512 512z m259.168-568.896h-290.752a25.28 25.28 0 0 0-25.28 25.28l-0.032 63.232c0 13.952 11.296 25.28 25.28 25.28h177.024a25.28 25.28 0 0 1 25.28 25.28v12.64a75.84 75.84 0 0 1-75.84 75.84h-240.224a25.28 25.28 0 0 1-25.28-25.28v-240.192a75.84 75.84 0 0 1 75.84-75.84h353.92a25.28 25.28 0 0 0 25.28-25.28l0.064-63.2a25.312 25.312 0 0 0-25.28-25.312H417.184a189.632 189.632 0 0 0-189.632 189.6v353.952c0 13.952 11.328 25.28 25.28 25.28h372.928a170.656 170.656 0 0 0 170.656-170.656v-145.376a25.28 25.28 0 0 0-25.28-25.28z" p-id="1730"></path></svg>',
        },
        link: 'https://gitee.com/ikenxuan/kkkkkk-10086',
      },
      {
        icon: {
          svg: '<svg t="1718379780608" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="14609" width="200" height="200"><path d="M512.26 0h-0.51C229.12 0 0 229.12 0 511.74v0.51C0 794.88 229.12 1024 511.74 1024h0.51C794.88 1024 1024 794.88 1024 512.26v-0.51C1024 229.12 794.88 0 512.26 0zM794.7 731.23c-15.53 1.88-60.45-70.31-60.45-70.31 0 41.81-21.74 96.36-68.81 135.71 17.61 5.39 39.18 13.65 53.08 23.75 12.46 9.11 10.89 18.4 8.64 22.15-9.83 16.45-169.13 10.51-215.11 5.39-46.01 5.12-205.28 11.06-215.15-5.36-2.25-3.75-3.82-13.08 8.64-22.19 13.89-10.1 35.46-18.36 53.04-23.72-47.07-39.39-68.81-93.93-68.81-135.71 0 0-44.92 72.16-60.45 70.31-7.24-0.85-16.76-39.53 12.59-132.95 7.02-21.69 14.71-43.16 23.04-64.38l31.06-76.66c-0.04-0.89-0.41-15.97-0.41-23.79 0-131.07 62.57-262.83 216.41-262.83S728.42 302.39 728.42 433.5c0 7.78-0.41 22.87-0.41 23.76l31.06 76.66c8.35 21.21 16.03 42.68 23.04 64.38h-0.03c29.35 93.44 19.86 132.08 12.62 132.93z" p-id="14610"></path></svg>',
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
})

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