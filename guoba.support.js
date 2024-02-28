import { Config } from './model/config.js'
// 支持锅巴
export function supportGuoba() {
  return {
    // 插件信息，将会显示在前端页面
    // 如果你的插件没有在插件库里，那么需要填上补充信息
    // 如果存在的话，那么填不填就无所谓了，填了就以你的信息为准
    pluginInfo: {
      name: 'kkkkkk-10086',
      title: 'kkkkkk-10086',
      author: '@ikenxuan',
      authorLink: 'https://gitee.com/ikenxuan',
      link: 'https://gitee.com/ikenxuan/kkkkkk-10086',
      isV3: true,
      isV2: false,
      description: '提供了视频解析功能',
      // 显示图标，此为个性化配置
      // 图标可在 https://icon-sets.iconify.design 这里进行搜索
      icon: 'svg-spinners:blocks-shuffle-3',
      // 图标颜色，例：#FF0000 或 rgb(255, 0, 0)
      iconColor: '#00c3ff',
    },
    // 配置项信息
    configInfo: {
      // 配置项 schemas
      schemas: [
        {
          field: 'ck',
          label: '抖音ck',
          bottomHelpMessage: '登录https://www.douyin.com/获取请求头中的Cookie或使用 [#kkk设置抖音ck] 查看教程',
          component: 'InputPassword',
          required: true,
          componentProps: {
            placeholder: '很重要！不设置将无法使用本插件',
          },
        },
        {
          field: 'videotool',
          label: '视频解析',
          bottomHelpMessage: '视频解析工具总开关，修改后重启生效',
          component: 'Switch',
          required: false,
        },
        {
          field: 'defaulttool',
          label: '默认解析',
          bottomHelpMessage: '识别最高优先级，修改后重启生效',
          component: 'Switch',
          required: false,
        },
        {
          field: 'comments',
          label: '抖音评论解析',
          bottomHelpMessage: '可以解析评论，修改后重启生效',
          component: 'Switch',
          required: false,
        },
        {
          field: 'commentsimg',
          label: '发送评论图片',
          bottomHelpMessage: '将获取到的评论数据渲染成图片发送，评论内容中的每一个艾特和每一个热点词都会增加一次请求',
          component: 'Switch',
          required: false,
        },
        {
          field: 'numcomments',
          label: '评论解析数量',
          bottomHelpMessage: '可选值1-50，默认为20，过高可能导致渲染图片过大上传失败',
          component: 'InputNumber',
          required: true,
          componentProps: {
            placeholder: '请输入需要解析的评论数量，如20',
            addonAfter: '条',
          },
        },
        {
          field: 'newui',
          label: '评论图片UI版本',
          bottomHelpMessage: '第一版使用小图可容纳更多条评论，优化版使用大图适用于看评论区图片（代价是图片体积会非常大）',
          component: 'Select',
          componentProps: {
            options: [
              { label: '第一版', value: false },
              { label: '优化版', value: true },
            ],
            placeholder: '请选择体力模板类型',
          },
          required: false,
        },
        {
          field: 'rmmp4',
          label: '删除视频缓存',
          bottomHelpMessage: '可以偷偷看群友解析的视频都是什么玩意()；保存目录/resources/kkkdownload',
          component: 'Switch',
          required: false,
        },
        {
          field: 'douyinpush',
          label: '抖音推送',
          bottomHelpMessage: '开启后需使用[#设置抖音推送+抖音号]设置推送列表',
          component: 'Switch',
          required: false,
        },
        {
          field: 'douyinpushlist',
          label: '推送列表',
          bottomHelpMessage: '用于推送抖音用户新作品功能，配置后即可推送',
          component: 'GSubForm',
          componentProps: {
            multiple: true,
            schemas: [
              {
                field: 'sec_uid',
                label: '用户uid，注意不是抖音号，此uid需要访问网页版个人主页，地址栏user/后面的便是uid',
                component: 'Input',
                required: false,
              },
              {
                field: 'group_id',
                label: '设置推送的群',
                bottomHelpMessage: '请选择',
                component: 'GSelectGroup',
              },
            ],
          },
        },
      ],
      // 获取配置数据方法（用于前端填充显示数据）
      getConfigData() {
        return Config
      },
      // 设置配置的方法（前端点确定后调用的方法）
      async setConfigData(data, { Result }) {
        for (let [keyPath, value] of Object.entries(data)) {
          if (Config[keyPath] != value) {
            Config[keyPath] = value
          }
        }
        return Result.ok({}, '保存成功~')
      },
    },
  }
}
