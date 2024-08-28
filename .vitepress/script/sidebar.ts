const sidebar = [
  {
    text: '快速开始',
    items: [
      { text: '<i class="fa-solid fa-play fa-beat"></i> 简介', link: '/docs/start/start' },
      { text: '<i class="fa-solid fa-download fa-fade"></i> 安装插件', link: '/docs/start/install' },
      { text: '<i class="fa-solid fa-gear fa-spin"></i> 配置文件', link: '/docs/start/start.config' },
    ],
  },
  {
    text: '功能',
    items: [
      {
        text: '<i class="fa-solid fa-bars fa-flip"></i> 作品解析', link: '/docs/intro/main/main', items: [
          { text: '<i class="fa-brands fa-tiktok fa-fade"></i> 抖音相关', link: '/docs/intro/main/douyin', },
          { text: '<i class="fa-brands fa-bilibili fa-fade"></i> B站相关', link: '/docs/intro/main/bilibili' },
          { text: '快手相关', link: '/docs/intro/main/kuaishou' },
        ]
      },
      { text: '<i class="fa-brands fa-pushed fa-fade"></i> 动态推送', link: '/docs/intro/push' },
      { text: '<i class="fa-solid fa-server fa-fade"></i> API Server', link: '/docs/intro/apiserver' },
      { text: '其他功能', link: '/docs/intro/other' },
    ],
  },
  {
    text: '其他',
    items: [
      {
        text: '<i class="fa-solid fa-question fa-fade"></i> 遇到问题了？', link: '/docs/intro/problems', items: [
          { text: '<i class="fa-solid fa-file-circle-question fa-fade"></i> 常见问题解答', link: '/docs/intro/QA' },
        ]
      },
      { text: '<i class="fa-solid fa-hand-holding-heart fa-fade"></i> 投喂', link: '/docs/other/afdian' },
      { text: '<i class="fa-solid fa-triangle-exclamation fa-fade"></i> 免责声明', link: '/docs/other/disclaimer' },
      { text: '<i class="fa-solid fa-code-branch fa-fade"></i> 版本历史', link: '/docs/other/timeline' },
    ],
  },
]

export default sidebar