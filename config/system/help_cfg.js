export const helpCfg = {
  title: 'kkk帮助',
  subTitle: 'Yunzai-Bot & kkkkkk-10086',
  columnCount: 3,
  colWidth: 265,
  theme: 'all',
  themeExclude: ['default'],
  style: {
    fontColor: '#ceb78b',
    descColor: '#eee',
    contBgColor: 'rgba(6, 21, 31, .5)',
    contBgBlur: 3,
    headerBgColor: 'rgba(6, 21, 31, .4)',
    rowBgColor1: 'rgba(6, 21, 31, .2)',
    rowBgColor2: 'rgba(6, 21, 31, .35)',
  },
}

export const helpList = [
  {
    group: '常用功能',
    list: [
      {
        icon: 1,
        title: '抖音解析',
        desc: '解析抖音链接，返回视频，评论，以及其他数据',
      },
      {
        icon: 2,
        title: 'B站解析',
        desc: '解析b站链接，返回视频，以及其他数据',
      },
      {
        icon: 3,
        title: '#设置抖音推送+抖音号',
        desc: '订阅喜欢的抖音主包，推送最新作品',
      },
      {
        icon: 4,
        title: '#设置b站推送+UID',
        desc: '订阅喜欢的b站阿婆主，推送最新作品以及动态',
      },
      {
        icon: 41,
        title: '#kkk推送列表',
        desc: '查看当前群哪个UP被推送了',
      },
    ],
  },
  {
    group: '设置，版本相关',
    auth: 'master',
    list: [
      {
        icon: 8,
        title: '#kkk设置',
        desc: '查看kkk设置',
      },
      {
        icon: 54,
        title: '#kkk删除缓存',
        desc: '一键删除缓存视频',
      },
      {
        icon: 1,
        title: '#kkk(强制)更新',
        desc: '更新kkk',
      },
      {
        icon: 15,
        title: '#kkk版本',
        desc: '查看版本信息',
      },
      {
        icon: 12,
        title: '#kkk更新日志',
        desc: '查看更新日志',
      },
    ],
  },
]

export const isSys = true
