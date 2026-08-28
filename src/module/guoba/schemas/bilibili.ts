/**
 * 「哔哩哔哩」分组：B 站解析参数、B 站推送参数，以及 pushlist.bilibili 推送列表子表单。
 *
 * B 站画质和动态类型这两组候选项只有本文件用到，就近放在这里而不是 shared.ts。
 */
import { divider, group, input, num, option, radio, select, sw } from '@/module/guoba/helpers'
import { danmakuSchemas, displayContentOptions, permissionOptions, pushFilterSchemas, sendContentOptions } from '@/module/guoba/shared'

import type { GuobaSchema } from '@/types/guoba'

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

const bilibiliDynamicTypeOptions = [
  option('视频动态', 'DYNAMIC_TYPE_AV'),
  option('图文动态', 'DYNAMIC_TYPE_DRAW'),
  option('文章动态', 'DYNAMIC_TYPE_ARTICLE')
]

const bilibiliPushListSchema: GuobaSchema = {
  field: 'pushlist.bilibili',
  label: 'B站推送列表',
  bottomHelpMessage: '配置 B 站 UP 主新动态推送',
  component: 'GSubForm',
  componentProps: {
    multiple: true,
    schemas: [
      sw('switch', '是否启用', '是否启用该推送'),
      num('host_mid', '用户 UID', 1, Number.MAX_SAFE_INTEGER, '', '比如原神的：\n401742377'),
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
      ], '推送类型，可选：video、draw、word、live、forward、article', true),
      ...pushFilterSchemas
    ]
  }
}

export const bilibili: GuobaSchema[] = [
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
  ], 'B站解析可选列表。已被「发送内容」取代，保留以兼容旧配置；可多选', true),
  select('bilibili.sendContent', '发送内容', sendContentOptions.filter(item => item.value !== 'image'), '解析时发送的内容，可选值：info、comment、video', true),
  select('bilibili.displayContent', '简介显示内容', displayContentOptions, '视频解析时简介显示的内容，可选值：cover(封面)、title(标题)、author(作者)、stats(视频统计信息)、desc(简介)，数组为空则不显示任何内容', true),
  sw('bilibili.videopriority', '优先保内容', '开启后优先保证上传成功，可能降低分辨率'),
  radio('bilibili.videoQuality', '视频画质偏好', bilibiliQualityOptions, 'B站视频画质偏好设置'),
  num('bilibili.maxAutoVideoSize', '自动画质最大视频大小', 0, 9999, 'MB', '自动画质模式下可接受的最大视频大小（单位：MB），仅在 videoQuality 为 0 时生效'),
  num('bilibili.bilibilinumcomments', '评论解析数量（旧版键）', 0, 9999, '条', 'B站评论数量，设置接口返回的评论数量，范围1~无限条。已被「评论解析数量」取代，保留以兼容旧配置'),
  num('bilibili.numcomment', '评论解析数量', 0, 9999, '条', 'B站评论数量（新项目配置名，兼容 bilibilinumcomments）'),
  sw('bilibili.realCommentCount', '显示真实评论数量', '评论图是否显示真实评论数量，关闭则显示解析到的评论数量'),
  sw('bilibili.commentImageCollection', '收集评论区图片', '是否收集评论区的图片'),
  radio('bilibili.loginPerm', '扫码登录权限', permissionOptions, '谁可以触发扫码登录'),
  radio('bilibili.imageLayout', '图文动态布局', [
    option('自动', 'auto'),
    option('纵向', 'vertical'),
    option('瀑布流', 'waterfall'),
    option('网格', 'grid')
  ], '解析图文动态时，遇到多张图片时的页面布局方式：vertical、waterfall、grid、auto'),
  radio('bilibili.videoInfoMode', '视频信息返回形式', [
    option('文本', 'text'),
    option('图片', 'image')
  ], '视频信息返回形式：text、image'),
  sw('bilibili.showDanmakuInVideoInfo', '视频信息展示高频弹幕', '视频信息图片是否展示高频弹幕'),
  radio('bilibili.bilibiliCdnMode', 'CDN 地址处理方式', [
    option('自动', 'auto'),
    option('只用接口原地址', 'origin'),
    option('强制改写到镜像站', 'mirror')
  ], '决定要不要把播放地址的主机名改写到公网 upos 镜像站。改写只换主机名，路径与鉴权参数原样保留（B站 的签名按路径签发，跨镜像站通用）。auto：接口给的地址优先，只在它指向 PCDN（mcdn.bilivideo.cn / szbdyd.com）时才补上改写地址当备用；origin：一个字都不改；mirror：一律先试镜像站，接口原地址退居备用。挂代理或在境外机器上跑的话 PCDN 域名解析不出来（getaddrinfo ENOTFOUND），选 mirror；本来就国内直连、PCDN 反而更快的环境选 origin'),
  sw('bilibili.bilibiliCdnProbe', 'CDN 测速自动选路', '下载前实测各候选地址再挑快的那个。测的是「首字节 + 一小段实际传输」而不是 ping：被限速的节点握手往往很快，只有真拉一段数据才分得出 0.1MB/s 和 10MB/s。每个地址最多 5 秒、只下 64KB，多个地址并发测，所以总耗时约等于最慢那个；结果按主机名缓存 10 分钟，同一批下载里只有第一个付这份开销，音频流一般直接命中缓存。默认关：多数环境里接口给的第一个地址就是好的，开了等于给每个新主机的首次下载加最多 5 秒'),
  ...danmakuSchemas('bilibili'),

  divider('B站推送'),
  sw('bilibili.push.switch', 'B站推送', '开启后需重启；使用「#设置B站推送 + 用户UID」配置推送列表'),
  {
    field: 'bilibili.push.cron',
    label: 'Cron 表达式',
    bottomHelpMessage: '默认每 10 分钟推送一次：*/10 * * * *',
    component: 'EasyCron',
    required: false
  },
  radio('bilibili.push.permission', '设置推送权限', permissionOptions, 'B站推送添加权限'),
  sw('bilibili.push.log', '定时任务日志', '打开或关闭定时任务日志'),
  sw('bilibili.push.parsedynamic', '是否解析动态', '最新动态可能是视频，可选是否与推送图片一同发送'),
  select('bilibili.push.parseDynamicTypes', '推送解析动态类型', bilibiliDynamicTypeOptions, '开启推送解析后选择需要解析的动态类型', true),
  radio('bilibili.push.pushVideoQuality', '推送视频画质偏好', bilibiliQualityOptions, '推送视频画质偏好设置'),
  num('bilibili.push.pushMaxAutoVideoSize', '推送视频体积上限', 0, 9999, 'MB', '推送时遇到视频动态时解析的视频体积上限，仅在「pushVideoQuality」为 0 且「parsedynamic」为 true 时生效'),
  bilibiliPushListSchema
]
