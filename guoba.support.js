import Config from './module/utils/Config.js'

const option = (label, value = label) => ({ label, value })

const group = label => ({ label, component: 'SOFT_GROUP_BEGIN' })

const divider = label => ({
  component: 'Divider',
  label,
  componentProps: {
    orientation: 'left',
    plain: true
  }
})

const input = (field, label, bottomHelpMessage = '', component = 'Input') => ({
  field,
  label,
  bottomHelpMessage,
  component,
  required: false
})

const password = (field, label, bottomHelpMessage) => ({
  ...input(field, label, bottomHelpMessage, 'InputPassword'),
  componentProps: {
    placeholder: '建议配置'
  }
})

const sw = (field, label, bottomHelpMessage = '') => ({
  field,
  label,
  bottomHelpMessage,
  component: 'Switch',
  required: false
})

const num = (field, label, min = 0, max = 9999, addonAfter = '', bottomHelpMessage = '') => ({
  field,
  label,
  bottomHelpMessage,
  component: 'InputNumber',
  required: false,
  componentProps: {
    min,
    max,
    addonAfter
  }
})

const radio = (field, label, options, bottomHelpMessage = '') => ({
  field,
  label,
  bottomHelpMessage,
  component: 'RadioGroup',
  required: false,
  componentProps: { options }
})

const select = (field, label, options, bottomHelpMessage = '', multiple = false) => ({
  field,
  label,
  bottomHelpMessage,
  component: 'Select',
  required: false,
  componentProps: {
    options,
    ...(multiple ? { mode: 'multiple', allowCreate: false } : {})
  }
})

const tags = (field, label, bottomHelpMessage = '') => ({
  field,
  label,
  bottomHelpMessage,
  component: 'GTags',
  required: false,
  componentProps: {
    allowCreate: true,
    allowAdd: true,
    allowDel: true
  }
})

const permissionOptions = [
  option('所有人', 'all'),
  option('管理员', 'admin'),
  option('主人', 'master'),
  option('群主', 'group.owner'),
  option('群管理员', 'group.admin')
]

const sendContentOptions = [
  option('信息图/提示', 'info'),
  option('评论图', 'comment'),
  option('视频', 'video'),
  option('图集/图片', 'image')
]

const bilibiliQualityOptions = [
  option('自动根据大小选择', 0),
  option('240P 极速', 6),
  option('360P 流畅', 16),
  option('480P 清晰', 32),
  option('720P 高清', 64),
  option('720P60 高帧率', 74),
  option('1080P 高清', 80),
  option('1080P+ 高码率', 112),
  option('1080P60 高帧率', 116),
  option('4K 超清', 120),
  option('8K 超高清', 127)
]

const videoQualityOptions = [
  option('自动根据大小选择', 'adapt'),
  option('540P', '540p'),
  option('720P', '720p'),
  option('1080P', '1080p'),
  option('2K', '2k'),
  option('4K', '4k')
]

const displayContentOptions = [
  option('封面', 'cover'),
  option('标题', 'title'),
  option('作者', 'author'),
  option('统计信息', 'stats'),
  option('简介', 'desc')
]

const danmakuSchemas = platform => [
  sw(`${platform}.burnDanmaku`, '烧录弹幕', '需要重新编码视频，耗时较长'),
  radio(`${platform}.danmakuArea`, '弹幕显示区域', [
    option('25%', 0.25),
    option('50%', 0.5),
    option('75%', 0.75),
    option('100%', 1)
  ]),
  radio(`${platform}.danmakuFontSize`, '弹幕字号', [
    option('小', 'small'),
    option('中', 'medium'),
    option('大', 'large')
  ]),
  num(`${platform}.danmakuOpacity`, '弹幕透明度', 0, 100, '%'),
  radio(`${platform}.verticalMode`, '竖屏适配', [
    option('关闭', 'off'),
    option('标准', 'standard'),
    option('强制', 'force')
  ]),
  radio(`${platform}.videoCodec`, '视频编码', [
    option('H.264', 'h264'),
    option('H.265', 'h265'),
    option('AV1', 'av1')
  ])
]

const pushFilterSchemas = [
  radio('filterMode', '过滤模式', [
    option('黑名单', 'blacklist'),
    option('白名单', 'whitelist')
  ], '黑名单：命中不推送；白名单：命中才推送'),
  tags('Keywords', '指定关键词', '需开启过滤模式'),
  tags('Tags', '指定标签', '需开启过滤模式')
]

const douyinPushListSchema = {
  field: 'pushlist.douyin',
  label: '抖音推送列表',
  bottomHelpMessage: '配置抖音用户新作品、直播、喜欢列表或推荐列表推送',
  component: 'GSubForm',
  componentProps: {
    multiple: true,
    schemas: [
      sw('switch', '是否启用'),
      input('sec_uid', '用户 sec_uid', '可不填，推送过程中会自动补齐'),
      input('short_id', '抖音号', 'sec_uid 和抖音号二选一'),
      {
        field: 'group_id',
        label: '推送群和推送账号',
        bottomHelpMessage: '格式：群号:机器人账号，例如 123456789:987654321',
        component: 'GTags',
        required: true,
        componentProps: {
          allowAdd: true,
          allowDel: true
        }
      },
      input('remark', '备注', '可不填，推送过程中会自动获取'),
      select('pushTypes', '推送类型', [
        option('作品', 'post'),
        option('直播', 'live'),
        option('喜欢列表', 'favorite'),
        option('推荐列表', 'recommend')
      ], '', true),
      ...pushFilterSchemas
    ]
  }
}

const bilibiliPushListSchema = {
  field: 'pushlist.bilibili',
  label: 'B站推送列表',
  bottomHelpMessage: '配置 B 站 UP 主新动态推送',
  component: 'GSubForm',
  componentProps: {
    multiple: true,
    schemas: [
      sw('switch', '是否启用'),
      num('host_mid', '用户 UID', 1, 999999999999, ''),
      {
        field: 'group_id',
        label: '推送群和推送账号',
        bottomHelpMessage: '格式：群号:机器人账号，例如 123456789:987654321',
        component: 'GTags',
        required: true,
        componentProps: {
          allowAdd: true,
          allowDel: true
        }
      },
      input('remark', '备注', '可不填，推送过程中会自动获取'),
      select('pushTypes', '推送类型', [
        option('视频', 'video'),
        option('图文', 'draw'),
        option('纯文', 'word'),
        option('直播', 'live'),
        option('转发', 'forward'),
        option('专栏', 'article')
      ], '', true),
      ...pushFilterSchemas
    ]
  }
}

const schemas = [
  group('基础配置'),
  divider('Cookie 配置'),
  password('cookies.douyin', '抖音 Cookie', '登录 https://www.douyin.com/ 获取请求头中的 Cookie，或使用 #kkk设置抖音ck 查看教程'),
  password('cookies.bilibili', 'B站 Cookie', '不设置时视频画质通常受限，登录 https://www.bilibili.com/ 获取请求头中的 Cookie'),
  password('cookies.kuaishou', '快手 Cookie', '登录 https://www.kuaishou.com/new-reco 获取请求头中的 Cookie'),
  password('cookies.xiaohongshu', '小红书 Cookie', '登录 https://www.xiaohongshu.com/ 获取请求头中的 Cookie'),

  divider('全局开关'),
  sw('app.videotool', '总开关', '视频解析工具总开关，修改后重启生效'),
  sw('app.videoTool', '总开关（新版键）', '兼容 Karin 新配置名，建议与总开关保持一致'),
  sw('app.defaulttool', '默认解析', '识别最高优先级，修改后重启生效'),
  num('app.priority', '解析优先级', 0, 114514, '', '默认解析关闭后生效，修改后重启生效'),
  sw('app.parseTip', '解析提示', '发送“检测到链接，开始解析”提示'),
  sw('app.EmojiReply', '表情回应', '适配器或平台不支持时可关闭'),
  sw('app.removeCache', '删除视频缓存', '自动删除下载到本地的视频缓存'),
  sw('app.sendforwardmsg', '发送合并转发消息'),
  sw('app.fakeForward', '伪造合并转发消息', '开启后使用触发者身份展示转发'),
  select('app.errorLogSendTo', '错误日志接收者', [
    option('主人', 'master'),
    option('全部主人', 'allMasters'),
    option('触发者', 'trigger')
  ], '', true),

  divider('渲染与媒体'),
  radio('app.Theme', '主题配置', [
    option('根据时间自动切换', 0),
    option('浅色', 1),
    option('深色', 2)
  ]),
  num('app.renderScale', '渲染精度', 50, 200, '%'),
  sw('app.RemoveWatermark', '移除底部版本信息'),
  num('app.RenderWaitTime', '渲染等待时间', 0, 300, '秒', '传递 0 可禁用等待'),
  sw('app.multiPageRender', '分页渲染', '将模板渲染成多页图片以降低渲染器压力'),
  num('app.multiPageHeight', '分页高度', 1000, 50000, 'px'),
  radio('app.livePhotoSystem', 'Live Photo 兼容系统', [
    option('Google', 'google'),
    option('Xiaomi', 'xiaomi'),
    option('OPPO', 'oppo'),
    option('Huawei / Honor', 'huawei_honor')
  ]),
  radio('app.livePhotoMode', 'Live Photo 发送方式', [
    option('视频 + Live Photo', 'video_and_livephoto'),
    option('仅视频', 'video_only'),
    option('仅 Live Photo', 'livephoto_only')
  ]),

  divider('API 服务（非配置面板）'),
  sw('app.APIServer', 'API 服务开关', '仅放出解析 API 与视频预览，不再提供 Web 配置面板'),
  num('app.APIServerPort', 'API 服务端口', 1, 65535),
  sw('app.APIServerMount', '挂载到框架 HTTP 服务', 'Yunzai 版当前保留配置，独立 API 服务仍使用端口启动'),

  group('抖音配置'),
  divider('抖音解析'),
  sw('douyin.douyintool', '抖音解析开关（旧版键）', '受总开关影响'),
  sw('douyin.switch', '抖音解析开关', '受总开关影响'),
  select('douyin.douyinTip', '抖音解析选项（旧版键）', [
    option('提示信息'),
    option('背景音乐'),
    option('评论图'),
    option('视频'),
    option('图集')
  ], '', true),
  select('douyin.sendContent', '发送内容', sendContentOptions.filter(item => item.value !== 'image'), '', true),
  num('douyin.numcomments', '评论解析数量（旧版键）', 0, 9999, '条'),
  num('douyin.numcomment', '评论解析数量', 0, 9999, '条'),
  num('douyin.subCommentLimit', '次级评论请求数量', 0, 100, '条'),
  num('douyin.subCommentDepth', '次级评论嵌套深度', 0, 10, '层'),
  sw('douyin.realCommentCount', '显示真实评论数量'),
  sw('douyin.commentImageCollection', '收集评论区图片'),
  sw('douyin.sendHDrecord', '图集 BGM 使用高清语音'),
  sw('douyin.autoResolution', '自动解析分辨率'),
  radio('douyin.liveImageMergeMode', 'Live 图 BGM 合并模式', [
    option('连续合并', 'continuous'),
    option('独立发送', 'independent')
  ]),
  sw('douyin.textMode', '文本模式', '开启后直接输出文本，关闭后渲染为图片'),
  radio('douyin.videoQuality', '视频画质偏好', videoQualityOptions),
  num('douyin.maxAutoVideoSize', '自动画质最大视频大小', 0, 9999, 'MB'),
  radio('douyin.loginPerm', '扫码登录权限', permissionOptions),
  radio('douyin.videoInfoMode', '视频信息返回形式', [
    option('文本', 'text'),
    option('图片', 'image')
  ]),
  select('douyin.displayContent', '视频信息内容', displayContentOptions.filter(item => item.value !== 'desc'), '', true),
  ...danmakuSchemas('douyin'),

  divider('抖音推送'),
  sw('douyin.push.switch', '抖音推送', '开启后需重启'),
  {
    field: 'douyin.push.cron',
    label: 'Cron 表达式',
    bottomHelpMessage: '默认每 10 分钟推送一次：*/10 * * * *',
    component: 'EasyCron',
    required: false
  },
  radio('douyin.push.permission', '设置推送权限', permissionOptions),
  sw('douyin.push.log', '定时任务日志'),
  sw('douyin.push.parsedynamic', '一同发送作品视频', '和推送图一同发送新作品内容'),
  radio('douyin.push.shareType', '分享二维码类型', [
    option('抖音网页', 'web'),
    option('视频下载直链', 'download')
  ]),
  radio('douyin.push.pushVideoQuality', '推送视频画质偏好', videoQualityOptions),
  num('douyin.push.pushMaxAutoVideoSize', '推送视频体积上限', 0, 9999, 'MB'),
  douyinPushListSchema,

  group('哔哩哔哩'),
  divider('B站解析'),
  sw('bilibili.bilibilitool', 'B站解析开关（旧版键）', '受总开关影响'),
  sw('bilibili.switch', 'B站解析开关', '受总开关影响'),
  select('bilibili.bilibiliTip', 'B站解析选项（旧版键）', [
    option('提示信息'),
    option('简介'),
    option('评论图'),
    option('视频'),
    option('动态')
  ], '', true),
  select('bilibili.sendContent', '发送内容', sendContentOptions.filter(item => item.value !== 'image'), '', true),
  select('bilibili.displayContent', '简介显示内容', displayContentOptions, '', true),
  sw('bilibili.videopriority', '优先保内容', '开启后优先保证上传成功，可能降低分辨率'),
  radio('bilibili.videoQuality', '视频画质偏好', bilibiliQualityOptions),
  num('bilibili.maxAutoVideoSize', '自动画质最大视频大小', 0, 9999, 'MB'),
  num('bilibili.bilibilinumcomments', '评论解析数量（旧版键）', 0, 9999, '条'),
  num('bilibili.numcomment', '评论解析数量', 0, 9999, '条'),
  sw('bilibili.realCommentCount', '显示真实评论数量'),
  sw('bilibili.commentImageCollection', '收集评论区图片'),
  radio('bilibili.loginPerm', '扫码登录权限', permissionOptions),
  radio('bilibili.imageLayout', '图文动态布局', [
    option('自动', 'auto'),
    option('纵向', 'vertical'),
    option('瀑布流', 'waterfall'),
    option('网格', 'grid')
  ]),
  radio('bilibili.videoInfoMode', '视频信息返回形式', [
    option('文本', 'text'),
    option('图片', 'image')
  ]),
  sw('bilibili.showDanmakuInVideoInfo', '视频信息展示高频弹幕'),
  ...danmakuSchemas('bilibili'),

  divider('B站推送'),
  sw('bilibili.push.switch', 'B站推送', '开启后需重启'),
  {
    field: 'bilibili.push.cron',
    label: 'Cron 表达式',
    bottomHelpMessage: '默认每 10 分钟推送一次：*/10 * * * *',
    component: 'EasyCron',
    required: false
  },
  radio('bilibili.push.permission', '设置推送权限', permissionOptions),
  sw('bilibili.push.log', '定时任务日志'),
  sw('bilibili.push.parsedynamic', '是否解析动态', '最新动态可能是视频，可选是否与推送图片一同发送'),
  radio('bilibili.push.pushVideoQuality', '推送视频画质偏好', bilibiliQualityOptions),
  num('bilibili.push.pushMaxAutoVideoSize', '推送视频体积上限', 0, 9999, 'MB'),
  bilibiliPushListSchema,

  group('快手配置'),
  divider('快手解析'),
  sw('kuaishou.kuaishoutool', '快手解析开关（旧版键）', '受总开关影响'),
  sw('kuaishou.switch', '快手解析开关', '受总开关影响'),
  sw('kuaishou.comment', '快手评论解析'),
  sw('kuaishou.kuaishoutip', '快手解析提示'),
  num('kuaishou.kuaishounumcomments', '快手评论数量（旧版键）', 0, 30, '条'),
  num('kuaishou.numcomment', '快手评论数量', 0, 30, '条'),

  group('小红书配置'),
  divider('小红书解析'),
  sw('xiaohongshu.switch', '小红书解析开关', '受总开关影响'),
  select('xiaohongshu.sendContent', '发送内容', sendContentOptions, '', true),
  num('xiaohongshu.numcomment', '评论解析数量', 0, 9999, '条'),
  radio('xiaohongshu.videoQuality', '视频画质偏好', videoQualityOptions),
  num('xiaohongshu.maxAutoVideoSize', '自动画质最大视频大小', 0, 9999, 'MB'),

  group('上传配置'),
  divider('上传与下载'),
  sw('upload.sendbase64', '转换 base64 发送', '适合云崽与机器人不在同一网络环境时开启'),
  radio('upload.videoSendMode', '本地视频发送方式', [
    option('文件', 'file'),
    option('Base64', 'base64'),
    option('URL', 'url')
  ], '会同步兼容 sendbase64'),
  sw('upload.usefilelimit', '使用视频上传拦截'),
  num('upload.filelimit', '视频上传拦截阈值', 5, 114514, 'MB'),
  sw('upload.compress', '使用压缩视频'),
  num('upload.compresstrigger', '压缩视频触发阈值', 5, 114514, 'MB'),
  num('upload.compressvalue', '压缩后的视频大小', 5, 114514, 'MB'),
  sw('upload.usegroupfile', '使用文件上传'),
  num('upload.groupfilevalue', '群文件上传阈值', 5, 114514, 'MB'),
  radio('upload.imageSendMode', '网络图片发送方式', [
    option('URL', 'url'),
    option('文件', 'file'),
    option('Base64', 'base64')
  ]),
  sw('upload.downloadThrottle', '下载限速'),
  num('upload.downloadMaxSpeed', '下载速度限制', 1, 1024, 'MB/s'),
  sw('upload.downloadAutoReduce', '断流自动降速'),
  num('upload.downloadMinSpeed', '最低下载速度', 1, 1024, 'MB/s'),

  group('请求配置'),
  divider('请求配置'),
  num('request.timeout', '请求超时时间', 5000, 9999999, 'ms'),
  input('request.User-Agent', '请求 User-Agent', '专门用于核心库 amagi 请求的 User-Agent'),
  divider('代理配置'),
  sw('request.proxy.switch', '使用代理'),
  input('request.proxy.host', '代理主机'),
  num('request.proxy.port', '代理端口', 0, 65535),
  radio('request.proxy.protocol', '代理协议', [
    option('HTTP', 'http'),
    option('HTTPS', 'https')
  ]),
  input('request.proxy.auth.username', '代理用户名'),
  input('request.proxy.auth.password', '代理密码', '', 'InputPassword')
]

export function supportGuoba() {
  return {
    pluginInfo: {
      name: 'kkkkkk-10086',
      title: 'kkkkkk-10086',
      author: '@ikenxuan',
      authorLink: 'https://gitee.com/ikenxuan',
      link: 'https://gitee.com/ikenxuan/kkkkkk-10086',
      isV3: true,
      isV2: false,
      description: '视频解析与推送配置已迁移到锅巴面板',
      icon: 'svg-spinners:blocks-shuffle-3',
      iconColor: '#00c3ff'
    },
    configInfo: {
      schemas,
      getConfigData() {
        return {
          cookies: Config.cookies,
          app: Config.app,
          douyin: Config.douyin,
          bilibili: Config.bilibili,
          pushlist: Config.pushlist,
          kuaishou: Config.kuaishou,
          xiaohongshu: Config.xiaohongshu,
          upload: Config.upload,
          request: Config.request
        }
      },
      async setConfigData(data, { Result }) {
        try {
          const touched = new Set()

          for (const [key, value] of Object.entries(data || {})) {
            if (!key) continue

            if (!key.includes('.') && value && typeof value === 'object' && !Array.isArray(value)) {
              Config.ModifyPro(key, value)
              touched.add(key)
              continue
            }

            const [filename, ...parts] = key.split('.')
            if (!filename || parts.length === 0) continue
            Config.modify(filename, parts.join('.'), value)
            touched.add(filename)
          }

          if (touched.has('pushlist')) await Config.syncConfigToDatabase()
          return Result.ok({}, '保存成功')
        } catch (error) {
          logger.error('设置配置数据失败:', error)
          return Result.error('保存失败', error)
        }
      }
    }
  }
}
