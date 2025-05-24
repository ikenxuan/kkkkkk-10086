import { Config } from './module/utils/index.js'
// 支持锅巴
export function supportGuoba () {
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
      iconColor: '#00c3ff'
    },
    // 配置项信息
    configInfo: {
      // 配置项 schemas
      schemas: [
        {
          label: '基础配置',
          component: 'SOFT_GROUP_BEGIN',
        },
        {
          component: 'Divider',
          label: 'Cookie 配置',
          helpMessage: '建议配置 Cookie',
          componentProps: {
            orientation: 'left',
            plain: true
          }
        },
        {
          field: 'cookies.douyin',
          label: '抖音ck',
          helpMessage: '必填项',
          bottomHelpMessage: '登录https://www.douyin.com/获取请求头中的Cookie或使用 [#kkk设置抖音ck] 查看教程',
          component: 'InputPassword',
          required: false,
          componentProps: {
            placeholder: '很重要！不设置将无法使用抖音解析'
          }
        },
        {
          field: 'cookies.bilibili',
          label: 'B站ck',
          helpMessage: '不设置 `ck` 画质为 `360p`，设置后最高可解析 `4K HDR` 需要视频支持与 `大会员`',
          bottomHelpMessage: '登录https://www.bilibili.com/获取请求头中的Cookie填入',
          component: 'InputPassword',
          required: false,
          componentProps: {
            placeholder: '建议设置'
          }
        },
        {
          field: 'cookies.kuaishou',
          label: '快手ck',
          bottomHelpMessage: '登录https://www.kuaishou.com/new-reco获取请求头中的Cookie',
          component: 'InputPassword',
          required: false,
          componentProps: {
            placeholder: '建议设置，默认用的游客ck，可能随时失效'
          }
        },
        {
          component: 'Divider',
          label: '全局配置，修改后没效果就重启',
          componentProps: {
            orientation: 'left',
            plain: true
          }
        },
        {
          field: 'app.videotool',
          label: '总开关',
          bottomHelpMessage: '视频解析工具总开关，修改后重启生效，关闭后可使用 kkk/kkk解析/解析 + 视频分享链接代替',
          component: 'Switch',
          required: false
        },
        {
          field: 'app.defaulttool',
          label: '默认解析',
          bottomHelpMessage: '识别最高优先级，修改后重启生效',
          component: 'Switch',
          required: false
        },
        {
          field: 'app.priority',
          label: '解析优先级',
          bottomHelpMessage: '自定义优先级，「默认解析」关闭后才会生效。修改后重启生效',
          component: 'InputNumber',
          required: false,
          componentProps: {
            placeholder: '范围：0 ~ 114514',
            min: 0,
            max: 114514,
            addonAfter: '单位'
          }
        },
        {
          field: 'app.usefilelimit',
          label: '使用视频文件上传限制',
          bottomHelpMessage: '开启后会根据解析的视频文件大小判断是否需要上传（B站番剧无影响）',
          component: 'Switch',
          required: false
        },
        {
          field: 'app.filelimit',
          label: '视频文件大小限制',
          bottomHelpMessage: '解析的视频文件大于该数值则不会上传 单位: MB（B站番剧无影响）',
          component: 'InputNumber',
          required: false,
          componentProps: {
            placeholder: '范围：5 ~ 114514',
            min: 5,
            max: 114514,
            addonAfter: 'MB'
          }
        },
        {
          component: 'Divider',
          label: '其他配置',
          componentProps: {
            orientation: 'left',
            plain: true
          }
        },
        {
          field: 'app.rmmp4',
          label: '删除视频缓存',
          helpMessage: '意义不明，但对作者有用',
          bottomHelpMessage: '自动删除下载到本地的视频缓存。保存目录/resources/kkkdownload，若要关闭请随时留意硬盘容量',
          component: 'Switch',
          required: false
        },
        {
          field: 'app.Theme',
          label: '是否使用深色主题',
          helpMessage: '意义不明，但对作者有用',
          bottomHelpMessage: '评论图、推送图是否使用深色主题 0为根据时间自动切换 1为浅色 2为深色',
          component: 'Switch',
          required: false
        },
        {
          field: 'app.renderScale',
          label: '渲染精度',
          bottomHelpMessage: '可选值50~200，建议100。设置高精度会提高图片的精细度，但因图片较大可能会影响渲染与发送速度',
          component: 'InputNumber',
          componentProps: {
            placeholder: '范围：50 ~ 200',
            min: 50,
            max: 200,
            addonAfter: '单位'
          }
        },
        {
          component: 'Divider',
          label: 'API配置',
          componentProps: {
            orientation: 'left',
            plain: true
          }
        },
        {
          field: 'app.APIServer',
          label: 'API服务开关',
          bottomHelpMessage: '将所有api接口放出，作为一个本地的视频解析API服务，默认端口4567',
          component: 'Switch',
          required: false
        },
        {
          field: 'app.APIServerPort',
          label: 'API服务端口',
          component: 'InputNumber',
          required: false
        },
        {
          field: 'app.APIServerLog',
          label: 'API服务日志',
          bottomHelpMessage: '打开或关闭运行日志',
          component: 'Switch',
          required: false
        },
        {
          label: '抖音配置',
          component: 'SOFT_GROUP_BEGIN',
        },
        {
          component: 'Divider',
          label: '抖音视频解析配置',
          componentProps: {
            orientation: 'left',
            plain: true
          }
        },
        {
          field: 'douyin.douyintool',
          label: '抖音解析开关',
          bottomHelpMessage: '单独开关，受「总开关」影响',
          component: 'Switch',
          required: false
        },
        {
          field: 'douyin.douyintip',
          label: '抖音解析提示',
          bottomHelpMessage: '发送提示信息：“检测到抖音链接，开始解析”',
          component: 'Switch',
          required: false
        },
        {
          field: 'douyin.commentsimg',
          label: '评论图',
          bottomHelpMessage: '发送抖音作品评论图',
          component: 'Switch',
          required: false
        },
        {
          field: 'douyin.numcomments',
          label: '评论解析数量',
          helpMessage: '必填项',
          bottomHelpMessage: '请在此输入数字',
          component: 'InputNumber',
          required: true,
          componentProps: {
            placeholder: '范围：0 ~ 无限',
            min: 0,
            max: 9999,
            addonAfter: '条'
          }
        },
        {
          field: 'douyin.douyinpush',
          label: '抖音推送',
          bottomHelpMessage: '开启后需使用[#设置抖音推送+抖音号]',
          component: 'Switch',
          required: false
        },
        {
          field: 'pushlist.douyin',
          label: '推送列表',
          bottomHelpMessage: '用于推送抖音用户新作品功能，配置后即可推送',
          component: 'GSubForm',
          componentProps: {
            multiple: true,
            schemas: [
              {
                component: 'Divider',
                label: '用户uid  和 抖音号 二选一填上即可，推送过程中会自动获取并写入齐。',
                componentProps: {
                  orientation: 'left',
                  plain: true
                }
              },
              {
                field: 'sec_uid',
                label: '用户uid',
                helpMessage: '如原神的：\nMS4wLjABAAAAw6_Jq4rDqlUKujFUvw0mjwTE8Y4uYuqJoKIQWO43oBYTd5_FlhU3qZ-PbOS7MP35',
                component: 'Input',
                componentProps: {
                  placeholder: '此uid需要访问抖音网页版个人主页，地址栏user/后面的便是uid'
                },
                required: false
              },
              {
                field: 'short_id',
                label: '抖音号',
                helpMessage: '如原神的：\nyuanshen_mihoyo',
                component: 'Input',
                componentProps: {
                  placeholder: '抖音号在博主的个人主页可以找到'
                },
                required: false
              },
              {
                field: 'group_id',
                helpMessage: '可多选',
                label: '推送群和推送账号',
                bottomHelpMessage: '以冒号作分割，前为群号，后为机器人账号。例如：123456789:987654321',
                componentProps: {
                  allowAdd: true,
                  allowDel: true
                },
                component: 'GTags',
                required: true
              },
              {
                field: 'remark',
                label: '备注',
                bottomHelpMessage: '可不填，推送过程中会自动获取并写入',
                component: 'Input',
                required: false
              }
            ]
          }
        },
        {
          field: 'douyin.douyinpushcron',
          label: 'Cron表达式',
          helpMessage: '修改后重启生效',
          bottomHelpMessage: '定时任务推送时间，如果想改成5分钟一次用后面的表达式 */5 * * * *',
          component: "EasyCron",
          required: false,
          componentProps: {
            placeholder: '已内置默认每10分钟推送一次 */10 * * * *'
          }
        },
        {
          field: 'douyin.douyinpushGroup',
          label: '设置推送权限',
          component: 'RadioGroup',
          bottomHelpMessage: '抖音推送添加权限',
          componentProps: {
            options: [
              { label: '所有群员都可以添加', value: 'all' },
              { label: '群主和管理员才能添加', value: 'owner' },
              { label: '只有主人才能添加', value: 'master' }
            ]
          }
        },
        {
          field: 'douyin.douyinpushlog',
          label: '定时任务日志',
          helpMessage: '抖音推送日志，修改后重启生效',
          bottomHelpMessage: '打开或关闭定时任务日志',
          component: 'Switch',
          required: false
        },
        {
          field: 'douyin.sendHDrecord',
          label: 'BGM使用高清语音',
          bottomHelpMessage: '高清语音「ios/PC」系统均无法播放，自行衡量开关',
          component: 'Switch',
          required: false
        },
        {
          field: 'douyin.senddynamicwork',
          label: '一同发送作品视频',
          bottomHelpMessage: '和推送图一同将新作品内容发送出去（图集暂未支持）',
          component: 'Switch',
          required: false
        },
        {
          label: '哔哩哔哩',
          component: 'SOFT_GROUP_BEGIN',
        },
        {
          component: 'Divider',
          label: '哔哩哔哩视频解析配置',
          componentProps: {
            orientation: 'left',
            plain: true
          }
        },
        {
          field: 'bilibili.bilibilitool',
          label: 'B站解析开关',
          bottomHelpMessage: '单独开关，受「总开关」影响',
          component: 'Switch',
          required: false
        },
        {
          field: 'bilibili.bilibilitip',
          label: 'B站解析提示',
          bottomHelpMessage: '发送提示信息：“检测到B站链接，开始解析”',
          component: 'Switch',
          required: false
        },
        {
          field: 'bilibili.bilibilicommentsimg',
          label: '评论图',
          bottomHelpMessage: '发送哔哩哔哩作品评论图',
          component: 'Switch',
          required: false
        },
        {
          field: 'bilibili.bilibilinumcomments',
          label: '评论解析数量',
          helpMessage: '必填项',
          bottomHelpMessage: '请在此输入数字',
          component: 'InputNumber',
          required: true,
          componentProps: {
            placeholder: '范围：0 ~ 无限',
            min: 0,
            max: 9999,
            addonAfter: '条'
          }
        },
        {
          field: 'bilibili.bilibilipush',
          label: '哔哩哔哩推送',
          bottomHelpMessage: '开启后需使用[#设置B站推送+用户UID]',
          component: 'Switch',
          required: false
        },
        {
          field: 'pushlist.bilibili',
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
                required: true
              },
              {
                field: 'group_id',
                helpMessage: '可多选',
                label: '推送群和推送账号',
                bottomHelpMessage: '以冒号作分割，前为群号，后为机器人账号。例如：123456789:987654321',
                componentProps: {
                  allowAdd: true,
                  allowDel: true
                },
                component: 'GTags',
                required: true
              },
              {
                field: 'remark',
                label: '备注',
                bottomHelpMessage: '可不填，推送过程中会自动获取并写入',
                component: 'Input',
                required: false
              }
            ]
          }
        },
        {
          field: 'bilibili.bilibilipushcron',
          label: 'Cron表达式',
          helpMessage: '修改后重启生效',
          bottomHelpMessage: '定时任务推送时间，如果想改成5分钟一次用后面的表达式 */5 * * * *',
          component: "EasyCron",
          required: false,
          componentProps: {
            placeholder: '已内置默认每10分钟推送一次 */10 * * * *'
          }
        },
        {
          field: 'bilibili.bilibilipushGroup',
          label: '设置推送权限',
          component: 'RadioGroup',
          bottomHelpMessage: 'B站推送添加权限',
          componentProps: {
            options: [
              { label: '所有群员都可以添加', value: 'all' },
              { label: '群主和管理员才能添加', value: 'owner' },
              { label: '只有主人才能添加', value: 'master' }
            ]
          }
        },
        {
          field: 'bilibili.bilibilipushlog',
          label: '定时任务日志',
          helpMessage: '抖音推送日志，修改后重启生效',
          bottomHelpMessage: '打开或关闭定时任务日志',
          component: 'Switch',
          required: false
        },
        {
          field: 'bilibili.senddynamicvideo',
          label: '发送动态的视频',
          helpMessage: '该UP的最新动态可能是视频，可选是否与推送图片一同发送',
          component: 'Switch',
          required: false
        },
        {
          field: 'bilibili.videopriority',
          label: '内容优先',
          helpMessage: '解析视频是否优先保内容，打开为优先保证上传将使用最低分辨率，关闭为优先保清晰度将使用最高分辨率',
          component: 'Switch',
          required: false
        },
        {
          label: '快手配置',
          component: 'SOFT_GROUP_BEGIN',
        },
        {
          component: 'Divider',
          label: '快手配置',
          componentProps: {
            orientation: 'left',
            plain: true
          }
        },
        {
          field: 'kuaishou.kuaishoutool',
          label: '快手解析',
          helpMessage: '快手解析开关，单独开关，受「总开关」影响',
          component: 'Switch',
          required: false
        },
        {
          field: 'kuaishou.kuaishoutip',
          label: '快手解析提示',
          helpMessage: '快手解析提示，发送提示信息：“检测到快手链接，开始解析”',
          component: 'Switch',
          required: false
        },
        {
          field: 'kuaishou.kuaishounumcomments',
          label: '快手评论数量',
          helpMessage: '必填项',
          bottomHelpMessage: '请在此输入数字',
          component: 'InputNumber',
          required: true,
          componentProps: {
            placeholder: '范围：0 ~ 30',
            min: 0,
            max: 30,
            addonAfter: '条'
          }
        }
      ],
      // 获取配置数据方法（用于前端填充显示数据）
      getConfigData () {
        return {
          cookies: Config.cookies,
          app: Config.app,
          douyin: Config.douyin,
          bilibili: Config.bilibili,
          pushlist: Config.pushlist,
          kuaishou: Config.kuaishou
        }
      },

      // 设置配置的方法（前端点确定后调用的方法）
      async setConfigData (data, { Result }) {
        for (const key in data) Config.modify(...key.split('.'), data[key])
        return Result.ok({}, '保存成功辣ε(*´･ω･)з')
      }
    }
  }
}
