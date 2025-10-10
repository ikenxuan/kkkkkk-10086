import Config from './module/utils/Config.js'

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
          component: 'Divider',
          label: '其他配置',
          componentProps: {
            orientation: 'left',
            plain: true
          }
        },
        {
          field: 'app.removeCache',
          label: '删除视频缓存',
          helpMessage: '意义不明，但对作者有用',
          bottomHelpMessage: '自动删除下载到本地的视频缓存。保存目录云崽下的temp/kkkkkk-10086/kkkdownload，若要关闭请随时留意硬盘容量',
          component: 'Switch',
          required: false
        },
        {
          field: 'app.sendforwardmsg',
          label: '发送合并转发消息',
          helpMessage: '意义不明，但对作者有用',
          bottomHelpMessage: '发送合并转发消息，可能多用于抖音解析',
          component: 'Switch',
          required: false
        },
        {
          field: 'app.Theme',
          label: '主题配置',
          helpMessage: '意义不明，但对作者有用',
          bottomHelpMessage: '评论图、推送图主题配置',
          component: 'Select',
          componentProps: {
            options: [
              { label: '根据时间自动切换', value: 0 },
              { label: '浅色', value: 1 },
              { label: '深色', value: 2 }
            ],
          },
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
          field: 'douyin.douyinTip',
          label: '抖音解析选项',
          helpMessage: '必填项',
          bottomHelpMessage: '必填项，选择要解析的内容',
          component: 'Select',
          required: true,
          componentProps: {
            mode: 'multiple',
            allowCreate: false,
            options: [
              { label: '提示信息', value: '提示信息' },
              { label: '背景音乐', value: '背景音乐' },
              { label: '评论图', value: '评论图' },
              { label: '视频', value: '视频' },
              { label: '图集', value: '图集' }
            ]
          }
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
          field: 'douyin.realCommentCount',
          label: '显示真实评论数量',
          bottomHelpMessage: '评论图是否显示真实评论数量，关闭则显示解析到的评论数量',
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
          field: 'douyin.autoResolution',
          label: '自动解析分辨率',
          bottomHelpMessage: '根据「视频拦截阈值」自动选择合适的分辨率，关闭后默认选择最大分辨率进行下载',
          component: 'Switch',
          required: false
        },
        {
          component: 'Divider',
          label: '抖音视频推送配置',
          componentProps: {
            orientation: 'left',
            plain: true
          }
        },
        {
          field: 'douyin.push.switch',
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
                field: 'switch',
                label: '是否启用',
                bottomHelpMessage: '是否启用该推送',
                component: 'Switch',
                required: false
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
              },
              {
                field: 'filterMode',
                label: '过滤模式',
                bottomHelpMessage: '黑名单：命中不推送；白名单：命中才推送',
                component: 'RadioGroup',
                componentProps: {
                  options: [
                    { label: '黑名单', value: 'blacklist' },
                    { label: '白名单', value: 'whitelist' }
                  ]
                }
              },
              {
                field: 'Keywords',
                label: '指定关键词',
                bottomHelpMessage: '需开启「过滤模式」，黑名单：命中不推送；白名单：命中才推送',
                component: 'GTags',
                componentProps: {
                  placeholder: '请输入关键词: 如：广告',
                  allowCreate: true,
                  allowAdd: true,
                  allowDel: true
                }
              },
              {
                field: 'Tags',
                label: '指定标签',
                bottomHelpMessage: '需开启「过滤模式」，黑名单：命中不推送；白名单：命中才推送',
                component: 'GTags',
                componentProps: {
                  placeholder: '请输入标签: 如：互动抽奖',
                  allowCreate: true,
                  allowAdd: true,
                  allowDel: true
                }
              }
            ]
          }
        },
        {
          field: 'douyin.push.cron',
          label: 'Cron表达式',
          helpMessage: '修改后重启生效',
          bottomHelpMessage: '定时任务推送时间，如果想改成5分钟一次用后面的表达式 */5 * * * *',
          component: 'EasyCron',
          required: false,
          componentProps: {
            placeholder: '已内置默认每10分钟推送一次 */10 * * * *'
          }
        },
        {
          field: 'douyin.push.permission',
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
          field: 'douyin.push.log',
          label: '定时任务日志',
          helpMessage: '抖音推送日志，修改后重启生效',
          bottomHelpMessage: '打开或关闭定时任务日志',
          component: 'Switch',
          required: false
        },
        {
          field: 'douyin.push.parsedynamic',
          label: '一同发送作品视频',
          bottomHelpMessage: '和推送图一同将新作品内容发送出去（图集暂未支持）',
          component: 'Switch',
          required: false
        },
        {
          field: 'douyin.push.shareType',
          label: '分享链接二维码的类型',
          bottomHelpMessage: 'web为跳转到抖音网页，download为视频下载直链',
          component: 'RadioGroup',
          required: false,
          componentProps: {
            options: [
              { label: '跳转到抖音网页', value: 'web' },
              { label: '视频下载直链', value: 'download' }
            ]
          }
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
          field: 'bilibili.bilibiliTip',
          label: 'B站解析选项',
          helpMessage: '必填项',
          bottomHelpMessage: '必填项，选择要解析的内容',
          component: 'Select',
          required: true,
          componentProps: {
            mode: 'multiple',
            allowCreate: false,
            options: [
              { label: '提示信息', value: '提示信息' },
              { label: '简介', value: '简介' },
              { label: '评论图', value: '评论图' },
              { label: '视频', value: '视频' },
              { label: '动态', value: '动态' },
            ]
          }
        },
        {
          field: 'bilibili.displayContent',
          label: 'B站简介显示选项',
          component: 'Select',
          componentProps: {
            mode: 'multiple',
            allowCreate: false,
            options: [
              { label: '封面', value: 'cover' },
              { label: '标题', value: 'title' },
              { label: '作者', value: 'author' },
              { label: '视频统计信息', value: 'stats' },
              { label: '简介', value: 'desc' }
            ]
          }
        },
        {
          field: 'bilibili.videopriority',
          label: '优先保内容',
          bottomHelpMessage: '解析视频是否优先保内容，true为优先保证上传将使用最低分辨率，false则使用自定义画质偏好',
          component: 'Switch',
          required: false
        },
        {
          field: 'bilibili.videoQuality',
          label: 'B站视频画质偏好设置',
          bottomHelpMessage: 'B站视频画质偏好设置',
          component: 'RadioGroup',
          componentProps: {
            options: [
              { label: '自动根据大小选择', value: 0 },
              { label: '240P 极速 (仅MP4格式支持)', value: 6 },
              { label: '360P 流畅', value: 16 },
              { label: '480P 清晰', value: 32 },
              { label: '720P 高清 (WEB默认值)', value: 64 },
              { label: '720P60 高帧率 (需登录)', value: 74 },
              { label: '1080P 高清 (TV/APP默认值，需登录)', value: 80 },
              { label: '1080P+ 高码率 (需大会员)', value: 112 },
              { label: '1080P60 高帧率 (需大会员)', value: 116 },
              { label: '4K 超清 (需大会员且支持4K)', value: 120 },
              { label: '8K 超高清 (需大会员且支持8K)', value: 127 }
            ]
          }
        },
        {
          field: 'bilibili.maxAutoVideoSize',
          label: '自动画质最大视频大小',
          helpMessage: '必填项',
          bottomHelpMessage: '请在此输入数字',
          component: 'InputNumber',
          required: true,
          componentProps: {
            placeholder: '范围：0 ~ 无限',
            min: 0,
            max: 9999,
            addonAfter: 'MB'
          }
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
          field: 'bilibili.realCommentCount',
          label: '显示真实评论数量',
          bottomHelpMessage: '评论图是否显示真实评论数量，关闭则显示解析到的评论数量',
          component: 'Switch',
          required: false
        },
        {
          component: 'Divider',
          label: '哔哩哔哩视频推送配置',
          componentProps: {
            orientation: 'left',
            plain: true
          }
        },
        {
          field: 'bilibili.push.switch',
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
                field: 'switch',
                label: '是否启用',
                bottomHelpMessage: '是否启用该推送',
                component: 'Switch',
                required: false
              },
              {
                field: 'host_mid',
                label: '用户UID',
                bottomHelpMessage: '比如如原神的：\n401742377',
                component: 'InputNumber',
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
              },
              {
                field: 'filterMode',
                label: '过滤模式',
                bottomHelpMessage: '黑名单：命中不推送；白名单：命中才推送',
                component: 'RadioGroup',
                componentProps: {
                  options: [
                    { label: '黑名单', value: 'blacklist' },
                    { label: '白名单', value: 'whitelist' }
                  ]
                }
              },
              {
                field: 'Keywords',
                label: '指定关键词',
                bottomHelpMessage: '需开启「过滤模式」，黑名单：命中不推送；白名单：命中才推送',
                component: 'GTags',
                componentProps: {
                  placeholder: '请输入关键词: 如：广告',
                  allowCreate: true,
                  allowAdd: true,
                  allowDel: true
                }
              },
              {
                field: 'Tags',
                label: '指定标签',
                bottomHelpMessage: '需开启「过滤模式」，黑名单：命中不推送；白名单：命中才推送',
                component: 'GTags',
                componentProps: {
                  placeholder: '请输入标签: 如：互动抽奖',
                  allowCreate: true,
                  allowAdd: true,
                  allowDel: true
                }
              }
            ]
          }
        },
        {
          field: 'bilibili.push.cron',
          label: 'Cron表达式',
          helpMessage: '修改后重启生效',
          bottomHelpMessage: '定时任务推送时间，如果想改成5分钟一次用后面的表达式 */5 * * * *',
          component: 'EasyCron',
          required: false,
          componentProps: {
            placeholder: '已内置默认每10分钟推送一次 */10 * * * *'
          }
        },
        {
          field: 'bilibili.push.permission',
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
          field: 'bilibili.push.log',
          label: '定时任务日志',
          helpMessage: 'B站推送日志，修改后重启生效',
          bottomHelpMessage: '打开或关闭定时任务日志',
          component: 'Switch',
          required: false
        },
        {
          field: 'bilibili.push.parsedynamic',
          label: '是否解析动态',
          helpMessage: '该UP的最新动态可能是视频，可选是否与推送图片一同发送',
          component: 'Switch',
          required: false
        },
        {
          field: 'bilibili.push.pushVideoQuality',
          label: '推送视频画质偏好设置',
          bottomHelpMessage: '推送视频画质偏好设置',
          component: 'RadioGroup',
          componentProps: {
            options: [
              { label: '自动根据大小选择', value: 0 },
              { label: '240P 极速 (仅MP4格式支持)', value: 6 },
              { label: '360P 流畅', value: 16 },
              { label: '480P 清晰', value: 32 },
              { label: '720P 高清 (WEB默认值)', value: 64 },
              { label: '720P60 高帧率 (需登录)', value: 74 },
              { label: '1080P 高清 (TV/APP默认值，需登录)', value: 80 },
              { label: '1080P+ 高码率 (需大会员)', value: 112 },
              { label: '1080P60 高帧率 (需大会员)', value: 116 },
              { label: '4K 超清 (需大会员且支持4K)', value: 120 },
              { label: '8K 超高清 (需大会员且支持8K)', value: 127 }
            ]
          }
        },
        {
          field: 'bilibili.push.pushMaxAutoVideoSize',
          label: '推送视频自动最大画质',
          helpMessage: '必填项',
          bottomHelpMessage: '请在此输入数字',
          component: 'InputNumber',
          required: true,
          componentProps: {
            placeholder: '范围：0 ~ 无限',
            min: 0,
            max: 9999,
            addonAfter: 'MB'
          }
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
        },
        {
          label: '上传配置',
          component: 'SOFT_GROUP_BEGIN',
        },
        {
          component: 'Divider',
          label: '上传配置',
          componentProps: {
            orientation: 'left',
            plain: true
          }
        },
        {
          field: 'upload.sendbase64',
          label: '转换base64发送',
          bottomHelpMessage: '开启后会发送视频经本插件转换为base64格式后再发送',
          component: 'Switch',
          required: false
        },
        {
          field: 'upload.usefilelimit',
          label: '使用视频上传拦截',
          bottomHelpMessage: '视频上传拦截，开启后会根据解析的视频文件大小判断是否需要上传',
          component: 'Switch',
          required: false
        },
        {
          field: 'upload.filelimit',
          label: '视频上传拦截阈值',
          bottomHelpMessage: '视频拦截阈值（填数字），视频文件大于该数值则不会上传 单位: MB，「使用视频上传拦截」开启后才会生效',
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
          field: 'upload.compress',
          label: '使用压缩视频',
          bottomHelpMessage: '压缩视频，开启后会将视频文件压缩后再上传，适合上传大文件',
          component: 'Switch',
          required: false
        },
        {
          field: 'upload.compresstrigger',
          label: '压缩视频触发阈值',
          bottomHelpMessage: '触发视频压缩的阈值，单位：MB。当文件大小超过该值时，才会压缩视频，「使用压缩视频」开启后才会生效',
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
          field: 'upload.compressvalue',
          label: '压缩后的视频大小',
          bottomHelpMessage: '压缩后的值，若视频文件大小大于「压缩视频触发阈值」的值，则会进行压缩至该值（±5%），「使用压缩视频」开启后才会生效',
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
          field: 'upload.usegroupfile',
          label: '使用文件上传',
          bottomHelpMessage: '使用文件上传，开启后会将视频文件上传到群文件中，私聊也行',
          component: 'Switch',
          required: false
        },
        {
          field: 'upload.groupfilevalue',
          label: '群文件上传阈值',
          bottomHelpMessage: '当文件大小超过该值时将使用群文件上传，单位：MB，「使用文件上传」开启后才会生效',
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
          label: '请求配置',
          component: 'SOFT_GROUP_BEGIN',
        },
        {
          component: 'Divider',
          label: '请求配置',
          componentProps: {
            orientation: 'left',
            plain: true
          }
        },
        {
          field: 'request.timeout',
          label: '请求超时时间',
          bottomHelpMessage: '请求超时时间，单位：毫秒',
          component: 'InputNumber',
          required: false,
          componentProps: {
            placeholder: '范围：5000 ~ 9999999',
            min: 5000,
            max: 9999999,
            addonAfter: 'ms'
          }
        },
        {
          field: 'request.User-Agent',
          label: '请求User-Agent',
          bottomHelpMessage: '专门用于核心库amagi请求的User-Agent(Networks模块不使用该User-Agent)',
          component: 'Input',
          required: false,
          componentProps: {
            placeholder: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
          }
        },
        {
          component: 'Divider',
          label: '代理配置',
          componentProps: {
            orientation: 'left',
            plain: true
          }
        },
        {
          field: 'request.proxy.switch',
          label: '使用代理',
          bottomHelpMessage: '使用代理，开启后会使用代理服务器进行请求',
          component: 'Switch',
          required: false
        },
        {
          field: 'request.proxy.host',
          label: '代理主机',
          bottomHelpMessage: '代理服务器主机地址',
          component: 'Input',
          required: false,
          componentProps: {
            placeholder: '代理主机地址：127.0.0.1'
          }
        },
        {
          field: 'request.proxy.port',
          label: '代理端口',
          bottomHelpMessage: '代理服务器端口',
          component: 'InputNumber',
          required: false
        },
        {
          field: 'request.proxy.protocol',
          label: '代理协议',
          bottomHelpMessage: '代理服务器协议类型(http/https)',
          required: false,
          component: 'RadioGroup',
          componentProps: {
            options: [
              { label: 'http', value: 'http' },
              { label: 'https', value: 'https' }
            ]
          }
        },
        {
          field: 'request.proxy.auth.username',
          label: '代理服务器用户名',
          bottomHelpMessage: '没有用户名可以为空',
          required: false,
          component: 'Input',
          componentProps: {
            placeholder: '代理服务器用户名'
          }
        },
        {
          field: 'request.proxy.auth.password',
          label: '代理服务器密码',
          bottomHelpMessage: '没有密码可以为空',
          required: false,
          component: 'InputPassword',
          componentProps: {
            placeholder: '代理服务器密码'
          }
        }
      ],
      // 获取配置数据方法（用于前端填充显示数据）
      getConfigData() {
        return {
          cookies: Config.cookies,
          app: Config.app,
          douyin: Config.douyin,
          bilibili: Config.bilibili,
          pushlist: Config.pushlist,
          kuaishou: Config.kuaishou,
          upload: Config.upload,
          request: Config.request
        }
      },

      /**
       * 保存配置数据方法（用于前端提交保存）
       * @param {*} data 
       * @param {*} param1 
       * @returns 
       */
      async setConfigData(data, { Result }) {
        try {
          for (const key in data) {
            const parts = key.split('.')

            // 统一处理所有配置键，不管嵌套层级
            if (parts.length >= 1) {
              const filename = parts[0]
              if (filename) {
                if (parts.length > 1) {
                  // 有嵌套键的情况
                  const nestedKey = parts.slice(1).join('.')
                  Config.modify(filename, nestedKey, data[key])
                } else {
                  // 没有嵌套键的情况，默认处理
                  Config.modify(...key.split('.'), data[key])
                }
              }
            }
          }
          return Result.ok({}, '保存成功辣(๑•̀ㅂ•́)و✧')
        } catch (error) {
          logger.error('设置配置数据失败:', error)
          return Result.error('保存失败辣(╥ω╥)', error)
        }
      }
    }
  }
}
