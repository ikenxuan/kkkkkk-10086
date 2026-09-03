import common from '@/runtime/host/common'

import type { BaseEvent } from '@/module/utils/types'

/**
 * 转发第一条节点上的房间信息。
 *
 * 空串统一表示「取不到」，对应那一行整行不渲染 —— 印一个 `标题：undefined` 比不印更难看。
 */
export interface LiveRoomHeadline {
  /** 封面优先，没有封面时用主播头像；两个都没有就不放图 */
  imageUrl: string
  title: string
  author: string
  /** 已格式化好的在线人数文本，如 `340人正在观看` */
  online: string
  /** 在线地址，抖音用 webcast reflow 链、B站用直播间链 */
  shareUrl: string
}

/**
 * 一条要贴给用户的直播拉流地址。
 *
 * 抖音那边的 `DouyinLiveStreamEntry`（`douyin/live.ts`）结构上兼容这个形状，
 * 但两边不共用一个类型：抖音的 `protocol` 是 `'flv' | 'hls'` 的字面量联合，
 * B站那条只按画质 `qn` 列一维、协议由取数层自己定，收窄成同一个联合会逼着
 * 其中一边说谎。这里只声明「排版要读的那几个字段」。
 */
export interface LiveStreamEntry {
  /** 档位标识，只用来排序，不进展示 */
  quality: string | number
  /** 档位中文名，进节点标题（蓝光 / 高清 / 标清 …） */
  qualityName: string
  /** 协议/容器，形如 `flv`、`hls`、`fmp4` */
  protocol: string
  url: string
}

/**
 * 协议标签：给人看的写法，不是接口里的键名。
 *
 * `hls` 要显示成 `M3U8` —— 用户复制这条地址是去丢给播放器的，播放器认的是 m3u8
 * 这个说法；表里没有的（B站的 `ts` / `fmp4`）直接大写，比硬塞一个猜的名字诚实。
 */
const PROTOCOL_LABELS: Record<string, string> = {
  flv: 'FLV',
  hls: 'M3U8'
}

/** 协议在转发里的先后：FLV 全列完再列 M3U8。表外的排最后 */
const PROTOCOL_ORDER = ['flv', 'hls']

/** 节点行首的图标，按协议分。表外的没有图标，不硬编一个 */
const PROTOCOL_ICONS: Record<string, string> = {
  flv: '🎥',
  hls: '📡'
}

/**
 * 把拉流地址清单做成一条合并转发。
 *
 * ## 版式
 *
 * 第一条节点是房间信息（图 + 标题 + 作者 + 在线人数 + 在线地址），之后**一条节点一个地址**。
 *
 * 一条节点一个地址不是随手定的：一个直播间展开 FLV + M3U8 就是六到八条带签名参数的长链，
 * 全塞进一条消息在手机上是一坨没法读的字符；散成节点，用户能单独长按复制想要的那一档。
 *
 * 协议是第一排序键、画质是第二：同一个协议的几档挨在一起，用户挑完协议只用在相邻几行里
 * 比画质。反过来按画质分组会让 FLV 和 M3U8 交替出现，复制时要跳着找。
 *
 * ## 为什么不判适配器
 *
 * `common.makeForwardMsg` 在 TRSS-Yunzai 上恒可用：`lib/common/common.js` 优先走
 * `e.group/friend.makeForwardMsg`，兜底走 `lib/bot.js` 的 `Bot.makeForwardMsg`，
 * 而后者只是 `return { type: 'node', data: msg }` —— 不抛，也不会返回空。
 * 所以不支持合并转发的适配器（QQBot / KOOKBot）最坏是渲染形态难看，
 * 不会翻成错误卡片。为它们写一条降级分支等于凭空多一份要维护的行为。
 * @param e 触发这次解析的事件
 * @param headline 第一条节点的房间信息
 * @param entries 地址清单
 * @param title 转发描述
 * @returns 可以直接交给 `e.reply` 的转发消息；清单为空时返回 undefined，调用点跳过发送
 */
export const buildLiveStreamForward = async (
  e: BaseEvent,
  headline: LiveRoomHeadline,
  entries: LiveStreamEntry[],
  title: string
): Promise<unknown | undefined> => {
  if (entries.length === 0) return undefined

  const nodes: unknown[] = [buildHeadlineNode(headline)]
  for (const entry of sortByProtocol(entries)) {
    const icon = PROTOCOL_ICONS[entry.protocol.toLowerCase()] ?? ''
    const label = PROTOCOL_LABELS[entry.protocol.toLowerCase()] ?? entry.protocol.toUpperCase()
    nodes.push(`${icon}${label}_${entry.qualityName}：${entry.url}`)
  }

  return await common.makeForwardMsg(e, nodes, title)
}

/**
 * 拼第一条节点。
 *
 * 图片和文字放同一条节点的一个数组里 —— 拆成两条会让「图」和「它的说明」在转发列表里
 * 分成两行，点进去才对得上。
 * @param headline 房间信息
 * @returns 一条节点的内容
 */
const buildHeadlineNode = (headline: LiveRoomHeadline): unknown => {
  const lines = [
    headline.title && `📺标题：${headline.title}`,
    headline.author && `🎤作者：${headline.author}`,
    headline.online && `🏄‍♂️在线人数：${headline.online}`,
    headline.shareUrl && `🔗在线地址：${headline.shareUrl}`,
    // 下面那些是带签名参数的短时效直链，而这条消息会一直留在群里。
    // 不说一句的话，用户过几分钟点开只看到 403，分不清是地址过期还是插件坏了。
    '⏳拉流地址带签名、几分钟后失效，失效了重新解析一次这个直播间'
  ].filter(Boolean)

  return headline.imageUrl
    ? [segment.image(headline.imageUrl), lines.join('\n')]
    : lines.join('\n')
}

/**
 * 协议优先、原顺序其次。
 *
 * 用 `PROTOCOL_ORDER` 的下标排，表外的协议给一个比表长的名次统一排到最后 ——
 * 用 `indexOf` 的 -1 会把它们排到最前面，那是最容易写错的一处。
 * 同协议内不再排序：入参已经是按画质从高到低给的（见 `listDouyinLiveStreams`）。
 * @param entries 地址清单
 * @returns 排好序的新数组
 */
const sortByProtocol = <T extends LiveStreamEntry>(entries: T[]): T[] => {
  const rank = (protocol: string): number => {
    const index = PROTOCOL_ORDER.indexOf(protocol.toLowerCase())
    return index === -1 ? PROTOCOL_ORDER.length : index
  }
  // 稳定排序：Array.prototype.sort 在 V8 上对同名次的元素保序，所以同协议内保持入参顺序
  return [...entries].sort((a, b) => rank(a.protocol) - rank(b.protocol))
}
