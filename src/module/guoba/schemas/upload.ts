/** 「上传配置」分组：视频与图片的发送方式、上传拦截、压缩，以及下载并发与限速。 */
import { divider, group, num, option, radio, sw } from '@/module/guoba/helpers'

import type { GuobaSchema } from '@/types/guoba'

export const upload: GuobaSchema[] = [
  group('上传配置'),
  divider('上传与下载'),
  sw('upload.sendbase64', '转换 base64 发送', '适合云崽与机器人不在同一网络环境时开启'),
  radio('upload.videoSendMode', '本地视频发送方式', [
    option('文件', 'file'),
    option('Base64', 'base64'),
    option('URL', 'url')
  ], '会同步兼容 sendbase64'),
  sw('upload.usefilelimit', '使用视频上传拦截', '视频上传拦截，开启后会根据解析的视频文件大小判断是否需要上传'),
  // 默认 1536MB（1.5GB）。max 沿用原有的 114514，本来就装得下 1536，不必放宽。
  // 面板上要把「插件放行多大」和「QQ 实际收得下多大」讲清楚，不然用户填完以为就能发。
  num('upload.filelimit', '视频上传拦截阈值', 5, 114514, 'MB', '视频大于该数值则直接放弃上传，「使用视频上传拦截」开启后才会生效。默认 1536MB（1.5GB）只是插件放行的闸门：消息内嵌视频段在 ICQQ / OneBot v11 上实测约 100MB 见顶、QQBot 官方接口约 75MB，1.5GB 只有走群文件通道才可能成功，需另外打开「使用文件上传」并让「群文件上传阈值」保持 100 左右。该值同时兼作抖音码率挑选上限，调大等于抖音永远取最高码率源'),
  sw('upload.compress', '使用压缩视频', '压缩视频，开启后会将视频文件压缩后再上传，适合上传大文件'),
  num('upload.compresstrigger', '压缩视频触发阈值', 5, 114514, 'MB', '触发视频压缩的阈值，单位：MB。当文件大小超过该值时，才会压缩视频，「使用压缩视频」开启后才会生效。该值同时被当成压缩目标体积用来算目标码率，所以不要跟着「视频上传拦截阈值」一起调大——调大等于关掉压缩'),
  num('upload.compressvalue', '压缩后的视频大小', 5, 114514, 'MB', '压缩后的值，若视频文件大小大于「压缩视频触发阈值」的值，则会进行压缩至该值（±5%），「使用压缩视频」开启后才会生效。注意目前只用于提示文案，真正决定目标码率的是「压缩视频触发阈值」'),
  sw('upload.usegroupfile', '使用文件上传', '使用文件上传，开启后会将视频文件上传到群文件中，私聊也行。想发超过 100MB 的视频必须打开：消息内嵌视频段扛不住，只有群文件通道能过 GB 级文件'),
  num('upload.groupfilevalue', '群文件上传阈值', 5, 114514, 'MB', '当文件大小超过该值时将使用群文件上传，单位：MB，「使用文件上传」开启后才会生效。维持 100 左右，别跟着「视频上传拦截阈值」调大：这是「多大才改走群文件」的分流线，调大会让大文件继续走消息段并发送失败'),
  radio('upload.imageSendMode', '网络图片发送方式', [
    option('URL', 'url'),
    option('文件', 'file'),
    option('Base64', 'base64')
  ], '网络图片发送方式，可选值：url / file / base64'),
  sw('upload.downloadMultiThread', '启用多线程下载', '仅对支持 Range 的大文件生效，不支持时自动回退单线程'),
  // min/max 必须和 DownloadBudget 的 clampConcurrency 区间逐字对齐（2-16），
  // 否则面板允许填的值会被运行时静默夹掉，用户看到的和生效的不是一回事。
  num('upload.downloadConcurrency', '下载连接预算', 2, 16, '路', '同一个平台**同时**最多开几条下载连接，默认 8 路。文件级下载和多线程分片共享这一份额度，所以它是平台级的连接总上限，不是「一个文件切成几片」。按平台分桶（抖音 / B站 / 快手 / 小红书互不影响），调高会更快但更容易触发平台限流'),
  sw('upload.downloadThrottle', '下载限速', '下载限速开关，开启后会限制下载速度，避免触发服务器风控导致连接被重置'),
  num('upload.downloadMaxSpeed', '下载速度限制', 1, 1024, 'MB/s', '下载速度限制，单位：MB/s，仅在 downloadThrottle 开启后生效'),
  sw('upload.downloadAutoReduce', '断流自动降速', '断流自动降速，检测到连接被重置时自动降低下载速度'),
  num('upload.downloadMinSpeed', '最低下载速度', 1, 1024, 'MB/s', '最低下载速度，单位：MB/s，自动降速不会低于此值')
]
