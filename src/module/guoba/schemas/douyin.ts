/**
 * 「抖音配置」分组：抖音解析参数、抖音推送参数，以及 pushlist.douyin 推送列表子表单。
 *
 * 推送列表写的是 pushlist.yaml，但它在面板上属于抖音分组，所以跟着抖音走。
 */
import { divider, group, input, num, option, radio, select, sw } from '@/module/guoba/helpers'
import { danmakuSchemas, displayContentOptions, permissionOptions, pushFilterSchemas, sendContentOptions, videoQualityOptions } from '@/module/guoba/shared'

import type { GuobaSchema } from '@/types/guoba'

const douyinPushListSchema: GuobaSchema = {
  field: 'pushlist.douyin',
  label: '抖音推送列表',
  bottomHelpMessage: '配置抖音用户新作品、直播、喜欢列表或推荐列表推送',
  component: 'GSubForm',
  componentProps: {
    multiple: true,
    schemas: [
      sw('switch', '是否启用', '是否启用该推送'),
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
      ], '推送类型，可选：post（作品）、live（直播）、favorite（喜欢列表）、recommend（推荐列表）', true),
      ...pushFilterSchemas
    ]
  }
}

export const douyin: GuobaSchema[] = [
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
  ], '抖音解析可选。已被「发送内容」取代，保留以兼容旧配置；可多选', true),
  select('douyin.sendContent', '发送内容', sendContentOptions.filter(item => item.value !== 'image'), '解析时发送的内容，可选值：info、comment、video', true),
  num('douyin.numcomments', '评论解析数量（旧版键）', 0, 9999, '条', '抖音评论数量，范围1~无限条。已被「评论解析数量」取代，保留以兼容旧配置'),
  num('douyin.numcomment', '评论解析数量', 0, 9999, '条', '抖音评论数量（新项目配置名，兼容 numcomments）'),
  num('douyin.subCommentLimit', '次级评论请求数量', 0, 100, '条', '次级评论请求数量'),
  num('douyin.subCommentDepth', '次级评论嵌套深度', 0, 10, '层', '次级评论嵌套深度'),
  sw('douyin.realCommentCount', '显示真实评论数量', '评论图是否显示真实评论数量，关闭则显示解析到的评论数量'),
  sw('douyin.commentImageCollection', '收集评论区图片', '是否收集评论区的图片'),
  sw('douyin.sendHDrecord', '图集 BGM 使用高清语音', '高清语音「ios/PC」系统均无法播放，自行衡量开关'),
  sw('douyin.autoResolution', '按画质偏好挑选视频源', '开启后按「视频画质偏好」定档、档内取体积装得下的最高码率（含 HDR 档）；关闭则直接用接口的 H.264 单档地址，实测最高只有 1080p'),
  radio('douyin.liveImageMergeMode', 'Live 图 BGM 合并模式', [
    option('连续合并', 'continuous'),
    option('独立发送', 'independent')
  ], '合辑 Live 图 BGM 合并模式，可选值：continuous、independent'),
  sw('douyin.textMode', '文本模式', '开启后直接输出文本，关闭后渲染为图片'),
  radio('douyin.videoQuality', '视频画质偏好', videoQualityOptions, '目标档装不下时先向下降档，全都装不下才退回体积最小的那条；需要「按画质偏好挑选视频源」为开'),
  num('douyin.maxAutoVideoSize', '自动画质最大视频大小', 0, 9999, 'MB', '仅画质偏好为 adapt 时生效，且与「视频上传拦截阈值」同时生效、谁更严谁说话：填得比它大不会放开体积，因为超过那个值的视频在上传环节会被直接拒掉。填 0 表示这一路不设限。固定档位时本项不生效，改由「视频上传拦截阈值」单独限体积'),
  radio('douyin.loginPerm', '扫码登录权限', permissionOptions, '谁可以触发扫码登录'),
  radio('douyin.videoInfoMode', '视频信息返回形式', [
    option('文本', 'text'),
    option('图片', 'image')
  ], '视频信息返回形式，可选值：text、image'),
  select('douyin.displayContent', '视频信息内容', displayContentOptions.filter(item => item.value !== 'desc'), '视频信息的内容，可选值：cover、title、author、stats', true),
  ...danmakuSchemas('douyin'),

  divider('抖音直播录制'),
  num('douyin.live.maxDuration', '单次录制最长时长', 1, 7200, '秒', '时间到了由 ffmpeg 自己收口，所以填多少就等多少：填 600 就是一条命令占住十分钟，期间该会话的其它解析都在排队。体积也随之成比例增长——直播流不转码，落盘大小约等于「码率 × 时长」，录完还要过「视频上传拦截阈值」那道闸，超了等于白录一场'),
  select('douyin.live.quality', '录制画质偏好', [
    option('原画 FULL_HD1', 'FULL_HD1'),
    option('高清 HD1', 'HD1'),
    option('标清 SD1', 'SD1'),
    option('流畅 SD2', 'SD2')
  ], '抖音 flv 拉流地址的档位键。只影响尝试顺序，不是硬要求：该档位没转码、或接口给了空地址时会自动往下试其它档，全都拿不到才判失败，所以选最高档不会造成「开播了却录不到」，只是可能实际拿到比选的更低的档位。HD1 属于「上游可能给、接口类型没承诺」的档，选它更容易落到兜底扫描上'),

  divider('抖音推送'),
  sw('douyin.push.switch', '抖音推送', '开启后需重启；使用「#设置抖音推送 + 抖音号」配置推送列表'),
  {
    field: 'douyin.push.cron',
    label: 'Cron 表达式',
    bottomHelpMessage: '默认每 10 分钟推送一次：*/10 * * * *',
    component: 'EasyCron',
    required: false
  },
  radio('douyin.push.permission', '设置推送权限', permissionOptions, '抖音推送添加权限'),
  sw('douyin.push.log', '定时任务日志', '打开或关闭定时任务日志'),
  sw('douyin.push.parsedynamic', '一同发送作品视频', '和推送图一同发送新作品内容'),
  radio('douyin.push.shareType', '分享二维码类型', [
    option('抖音网页', 'web'),
    option('视频下载直链', 'download')
  ], 'web为跳转到抖音网页，download为视频下载直链'),
  radio('douyin.push.pushVideoQuality', '推送视频画质偏好', videoQualityOptions, '推送路径单独的画质偏好，不受解析路径的「视频画质偏好」影响；仅「一同发送作品视频」为开时生效'),
  num('douyin.push.pushMaxAutoVideoSize', '推送视频体积上限', 0, 9999, 'MB', '仅推送画质偏好为 adapt 时生效；固定档位时改由「视频拦截阈值」限体积'),
  douyinPushListSchema
]
