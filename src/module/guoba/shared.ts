/**
 * 多个配置节共用的候选项列表与 schema 片段。
 *
 * 抖音和 B 站的弹幕参数、推送过滤规则是同一套；权限、发送内容、画质这些候选项也横跨
 * 好几个配置节。放进这里的判断标准只有一条：被两个以上的配置节引用。只被单个配置节
 * 用到的候选项留在它自己的文件里（例如 B 站画质）。
 */
import { num, option, radio, sw, tags } from './helpers.js'

import type { GuobaSchema } from '@/types/guoba'

/** 弹幕相关配置只有抖音和 B 站两套 */
type DanmakuPlatform = 'douyin' | 'bilibili'

export const permissionOptions = [
  option('所有人', 'all'),
  option('管理员', 'admin'),
  option('主人', 'master'),
  option('群主', 'group.owner'),
  option('群管理员', 'group.admin')
]

export const sendContentOptions = [
  option('信息图/提示', 'info'),
  option('评论图', 'comment'),
  option('视频', 'video'),
  option('图集/图片', 'image')
]

export const videoQualityOptions = [
  option('自动根据大小选择', 'adapt'),
  option('540P', '540p'),
  option('720P', '720p'),
  option('1080P', '1080p'),
  option('2K', '2k'),
  option('4K', '4k')
]

export const displayContentOptions = [
  option('封面', 'cover'),
  option('标题', 'title'),
  option('作者', 'author'),
  option('统计信息', 'stats'),
  option('简介', 'desc')
]

export const danmakuSchemas = (platform: DanmakuPlatform): GuobaSchema[] => [
  sw(`${platform}.burnDanmaku`, '烧录弹幕', '需要重新编码视频，耗时较长'),
  radio(`${platform}.danmakuArea`, '弹幕显示区域', [
    option('25%', 0.25),
    option('50%', 0.5),
    option('75%', 0.75),
    option('100%', 1)
  ], '弹幕显示区域：0.25、0.5、0.75、1'),
  radio(`${platform}.danmakuFontSize`, '弹幕字号', [
    option('小', 'small'),
    option('中', 'medium'),
    option('大', 'large')
  ], '弹幕字号：small、medium、large'),
  num(`${platform}.danmakuOpacity`, '弹幕透明度', 0, 100, '%', '弹幕透明度（0-100）'),
  radio(`${platform}.verticalMode`, '竖屏适配', [
    option('关闭', 'off'),
    option('标准', 'standard'),
    option('强制', 'force')
  ], '竖屏适配：off、standard、force'),
  radio(`${platform}.videoCodec`, '视频编码', [
    option('H.264', 'h264'),
    option('H.265', 'h265'),
    option('AV1', 'av1')
  ], '视频编码格式：h264、h265、av1')
]

export const pushFilterSchemas: GuobaSchema[] = [
  radio('filterMode', '过滤模式', [
    option('黑名单', 'blacklist'),
    option('白名单', 'whitelist')
  ], '黑名单：命中不推送；白名单：命中才推送'),
  tags('Keywords', '指定关键词', '需开启过滤模式'),
  tags('Tags', '指定标签', '需开启过滤模式')
]
