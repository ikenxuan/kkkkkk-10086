export const helpCfg = {
  title: 'kkkkkk 帮助',
  subTitle: 'Yunzai-Bot & kkkkkk-10086',
  columnCount: 0,
  colWidth: 265,
  theme: 'all',
  themeExclude: ['default'],
}
export const helpList = [{
  group: "触发类指令",
  list: [
    {
      icon:88,
      title: "#大图 #转大图 #json/JSON",
      desc: "发送携带的图片卡片信息"
    },
    {
      icon: 14,
      title: '#体力',
      desc: '大图卡片体力（需要开启）'
    },
    {
      icon: 23,
      title: '<鸡音|丁真|鸡汤|耀阳|神鹰>盒',
      desc: '名人名言。例：鸡音盒'
    },
    {
      icon: 34,
      title: '获取ck',
      desc: '通过app获取米游社cookie'
    },
    {
      icon: 34,
      title: '开奖',
      desc: '不知道怎么形容'
    },
    {
      icon: 34,
      title: '订阅仓库、(开启|关闭)仓库推送、查看仓库列表',
      desc: '不知道怎么形容'
    },
    {
      icon: 37,
      title: '头像框@群友/<qq号>',
      desc: '给当前指定qq的头像随机添加头像框'
    },

  ]
}, {
  group: '管理类命令',
  auth: 'master',
  list: [
    {
    icon: 14,
    title: '#开启/关闭体力大图',
    desc: '体力形式：默认/卡片'
    },
    {
    icon: 48,
    title: '#开启/关闭转大图',
    desc: '配置是否开启转大图'
    },
  ]
}
]