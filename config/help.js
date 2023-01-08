//如需自定义清凉图帮助，请将改文件复制一份，粘贴到上一个目录（即此插件config文件夹内），并将粘贴过去的文件重命名为help.js，编辑完后重启云崽即可生效
export const helpCfg = {
  title: 'kkkkkk帮助',
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
    }

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