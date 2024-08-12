const nav = [
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
          { text: 'API Server', link: '/docs/intro/apiserver' },
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
]


export default nav
