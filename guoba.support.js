import { Config } from '#modules'
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
          component: 'Divider',
          label: 'Cookie 配置',
          helpMessage: '建议配置 Cookie',
          componentProps: {
            orientation: 'left',
            plain: true,
          },
        },
        {
          field: 'ck',
          label: '抖音ck',
          helpMessage: '必填项',
          bottomHelpMessage: '登录https://www.douyin.com/获取请求头中的Cookie或使用 [#kkk设置抖音ck] 查看教程',
          component: 'InputPassword',
          required: false,
          componentProps: {
            placeholder: '很重要！不设置将无法使用抖音解析',
          },
        },
        {
          field: 'bilibilick',
          label: 'B站ck',
          helpMessage: '不设置 `ck` 画质为 `360p`，设置后最高可解析 `4K HDR` 需要视频支持与 `大会员`',
          bottomHelpMessage: '登录https://www.bilibili.com/获取请求头中的Cookie填入',
          component: 'InputPassword',
          required: false,
          componentProps: {
            placeholder: '建议设置',
          },
        },
        {
          component: 'Divider',
          label: '全局配置，修改后没效果就重启',
          componentProps: {
            orientation: 'left',
            plain: true,
          },
        },
        {
          field: 'videotool',
          label: '总开关',
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
          field: 'priority',
          label: '解析优先级',
          bottomHelpMessage: '自定义优先级，「默认解析」关闭后才会生效。修改后重启生效',
          component: 'InputNumber',
          required: false,
          componentProps: {
            placeholder: '范围：0 ~ 114514',
            min: 0,
            max: 114514,
            addonAfter: '单位',
          },
        },
        {
          field: 'usefilelimit',
          label: '使用视频文件上传限制',
          bottomHelpMessage: '开启后会根据解析的视频文件大小判断是否需要上传（B站番剧无影响）',
          component: 'Switch',
          required: false,
        },
        {
          field: 'filelimit',
          label: '视频文件大小限制',
          bottomHelpMessage: '解析的视频文件大于该数值则不会上传 单位: MB（B站番剧无影响）',
          component: 'InputNumber',
          required: false,
          componentProps: {
            placeholder: '范围：5 ~ 114514',
            min: 5,
            max: 114514,
            addonAfter: 'MB',
          },
        },
        /** 抖音视频解析配置 */
        {
          component: 'Divider',
          label: '抖音视频解析配置',
          componentProps: {
            orientation: 'left',
            plain: true,
          },
        },
        {
          field: 'douyintool',
          label: '抖音解析开关',
          bottomHelpMessage: '单独开关，受「总开关」影响',
          component: 'Switch',
          required: false,
        },
        {
          field: 'douyintip',
          label: '抖音解析提示',
          bottomHelpMessage: '发送提示信息：“检测到抖音链接，开始解析”',
          component: 'Switch',
          required: false,
        },
        {
          field: 'commentsimg',
          label: '评论图',
          bottomHelpMessage: '发送抖音作品评论图',
          component: 'Switch',
          required: false,
        },
        {
          field: 'numcomments',
          label: '评论解析数量',
          helpMessage: '必填项',
          bottomHelpMessage: '请在此输入数字',
          component: 'InputNumber',
          required: true,
          componentProps: {
            placeholder: '范围：0 ~ 50',
            min: 0,
            max: 50,
            addonAfter: '条',
          },
        },
        {
          field: 'douyinpush',
          label: '抖音推送',
          bottomHelpMessage: '开启后需使用[#设置抖音推送+抖音号]',
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
                label: '用户uid',
                helpMessage: '如原神的：\nMS4wLjABAAAAw6_Jq4rDqlUKujFUvw0mjwTE8Y4uYuqJoKIQWO43oBYTd5_FlhU3qZ-PbOS7MP35',
                bottomHelpMessage: '此uid需要访问抖音网页版个人主页，地址栏user/后面的便是uid',
                component: 'Input',
                componentProps: {
                  placeholder: '注意！不是抖音号',
                },
                required: true,
              },
              {
                field: 'group_id',
                helpMessage: '可多选',
                label: '推送群',
                componentProps: {
                  placeholder: '点击选择要推送的群',
                },
                component: 'GSelectGroup',
                required: true,
              },
              {
                field: 'remark',
                label: '备注',
                helpMessage: '可不填，推送过程中会自动获取并写入',
                bottomHelpMessage: '给这个推送id添加备注',
                component: 'Input',
                componentProps: {
                  placeholder: '请在此填写备注',
                },
                required: false,
              },
            ],
          },
        },
        {
          field: 'douyinpushcron',
          label: 'Cron表达式',
          helpMessage: '修改后重启生效',
          bottomHelpMessage: '定时任务推送时间，如果想改成5分钟一次用后面的表达式 */5 * * * *',
          component: 'Input',
          required: false,
          componentProps: {
            placeholder: '已内置默认每10分钟推送一次 */10 * * * *',
          },
        },
        {
          field: 'douyinpushGroup',
          label: '设置推送权限',
          component: 'RadioGroup',
          bottomHelpMessage: '抖音推送添加权限',
          componentProps: {
            options: [
              { label: '所有群员都可以添加', value: 'all' },
              { label: '群主和管理员才能添加', value: 'owner' },
              { label: '只有主人才能添加', value: 'master' },
            ],
          },
        },
        {
          field: 'douyinpushlog',
          label: '定时任务日志',
          helpMessage: '抖音推送日志，修改后重启生效',
          bottomHelpMessage: '打开或关闭定时任务日志',
          component: 'Switch',
          required: false,
        },
        {
          field: 'sendHDrecord',
          label: 'BGM使用高清语音',
          bottomHelpMessage: '高清语音「ios/PC」系统均无法播放，自行衡量开关',
          component: 'Switch',
          required: false,
        },
        {
          component: 'Divider',
          label: '哔哩哔哩视频解析配置',
          componentProps: {
            orientation: 'left',
            plain: true,
          },
        },
        {
          field: 'bilibilitool',
          label: 'B站解析开关',
          bottomHelpMessage: '单独开关，受「总开关」影响',
          component: 'Switch',
          required: false,
        },
        {
          field: 'bilibilitip',
          label: 'B站解析提示',
          bottomHelpMessage: '发送提示信息：“检测到B站链接，开始解析”',
          component: 'Switch',
          required: false,
        },
        {
          field: 'bilibilicommentsimg',
          label: '评论图',
          bottomHelpMessage: '发送哔哩哔哩作品评论图',
          component: 'Switch',
          required: false,
        },
        {
          field: 'bilibilinumcomments',
          label: '评论解析数量',
          helpMessage: '必填项',
          bottomHelpMessage: '请在此输入数字',
          component: 'InputNumber',
          required: true,
          componentProps: {
            placeholder: '范围：0 ~ 20',
            min: 0,
            max: 20,
            addonAfter: '条',
          },
        },
        {
          field: 'bilibilipush',
          label: '哔哩哔哩推送',
          bottomHelpMessage: '开启后需使用[#设置B站推送+用户UID]',
          component: 'Switch',
          required: false,
        },
        {
          field: 'bilibilipushlist',
          label: '推送列表',
          bottomHelpMessage: '用于推送B站UP新作品功能，配置后即可推送',
          component: 'GSubForm',
          componentProps: {
            multiple: true,
            schemas: [
              {
                field: 'host_mid',
                label: '用户UID',
                bottomHelpMessage: '比如如原神的：\n401742377',
                component: 'Input',
                required: true,
              },
              {
                field: 'group_id',
                helpMessage: '可多选',
                label: '推送群',
                componentProps: {
                  placeholder: '点击选择要推送的群',
                },
                component: 'GSelectGroup',
                required: true,
              },
              {
                field: 'remark',
                label: '备注',
                helpMessage: '可不填，推送过程中会自动获取并写入',
                bottomHelpMessage: '给这个推送id添加备注',
                component: 'Input',
                componentProps: {
                  placeholder: '请在此填写备注',
                },
                required: false,
              },
            ],
          },
        },
        {
          field: 'bilibilipushcron',
          label: 'Cron表达式',
          helpMessage: '修改后重启生效',
          bottomHelpMessage: '定时任务推送时间，如果想改成5分钟一次用后面的表达式 */5 * * * *',
          component: 'Input',
          required: false,
          componentProps: {
            placeholder: '已内置默认每10分钟推送一次 */10 * * * *',
          },
        },
        {
          field: 'bilibilipushGroup',
          label: '设置推送权限',
          component: 'RadioGroup',
          bottomHelpMessage: '抖音推送添加权限',
          componentProps: {
            options: [
              { label: '所有群员都可以添加', value: 'all' },
              { label: '群主和管理员才能添加', value: 'owner' },
              { label: '只有主人才能添加', value: 'master' },
            ],
          },
        },
        {
          field: 'bilibilipushlog',
          label: '定时任务日志',
          helpMessage: '抖音推送日志，修改后重启生效',
          bottomHelpMessage: '打开或关闭定时任务日志',
          component: 'Switch',
          required: false,
        },
        {
          component: 'Divider',
          label: '其他配置',
          componentProps: {
            orientation: 'left',
            plain: true,
          },
        },
        {
          field: 'rmmp4',
          label: '删除视频缓存',
          helpMessage: '意义不明，但对作者有用',
          bottomHelpMessage: '自动删除下载到本地的视频缓存。保存目录/resources/kkkdownload，若要关闭请随时留意硬盘容量',
          component: 'Switch',
          required: false,
        },
        {
          field: 'renderScale',
          label: '渲染精度',
          bottomHelpMessage: '可选值50~200，建议100。设置高精度会提高图片的精细度，但因图片较大可能会影响渲染与发送速度',
          component: 'InputNumber',
          componentProps: {
            placeholder: '范围：50 ~ 200',
            min: 50,
            max: 200,
            addonAfter: '单位',
          },
        },
      ],
      // 获取配置数据方法（用于前端填充显示数据）
      getConfigData() {
        return Config.ALLcfg
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
