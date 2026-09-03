import Config from '@/module/utils/Config'
import { at, isRecord } from '@/module/utils/record'
import { baseHeaders, Networks } from '@/module/utils/Network/index'

/**
 * B站直播拉流地址。
 *
 * ## 为什么这一跳要自己发请求
 *
 * amagi 6.x 没有这个能力：`BilibiliMethodRoutes` 里只有 `videoStream` 和
 * `bangumiStream`，两个都是稿件/番剧的 playurl；而 `BiliLiveRoomDetail.data`
 * 与 `BiliLiveRoomDef.data` 里一个 flv/hls/pull_url 字段都没有。
 * d.ts 全文搜 `getRoomPlayInfo` / `RoomPlayInfo` / `room_play_info` /
 * `fetch_live_playurl` / `playurl_info` 均零命中。所以只能自己打官方接口。
 *
 * ## 为什么没有重试逻辑
 *
 * `Networks.getData()` 走的 `request()` 自带 429/403/SSL 重试与 3 次上限
 * （`utils/Network/client.ts`），在外面再套一层会把退避时间乘起来。
 */

/** 直播流播放地址接口。`api.live.bilibili.com` 这一支不吃 wbi 签名，理由见 {@link fetchBilibiliLiveStream} */
const LIVE_PLAYURL_API = 'https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo'

/**
 * 画质编号 -> 中文名的兜底表。
 *
 * 正常情况下用响应自带的 `g_qn_desc`（官方会随接口演进更新），这张表只在
 * `g_qn_desc` 整个缺失时顶上，免得画质那格显示成裸数字。
 */
const QN_FALLBACK_NAMES: Record<number, string> = {
  30000: '杜比',
  20000: '4K',
  10000: '原画',
  400: '蓝光',
  250: '超清',
  150: '高清',
  80: '流畅'
}

/** {@link fetchBilibiliLiveStream} 的结果 */
export interface BilibiliLiveStreamPick {
  /** 拼好的可播地址（host + base_url + extra）；取不到时为空串 */
  url: string
  /** 选中的画质编号；取不到时为 0 */
  qn: number
  /** 画质中文名，优先用响应里的 `g_qn_desc`，查不到时回落成 `qn` 的字符串形式 */
  qualityName: string
  /** 实际命中的容器格式（`flv` / `fmp4` / `ts`），用于决定录制时的落盘后缀 */
  format: string
  /** 这次请求实际用的请求头，交给 `recordLiveStream` 原样带上（B站拉流缺 Referer 就是 403） */
  headers: Record<string, string>
}

/** {@link listBilibiliLiveStreams} 结果里的一条：一个画质 × 一个协议一条 */
export interface BilibiliLiveStreamEntry {
  /** 画质编号 */
  qn: number
  /** 画质中文名 */
  qualityName: string
  /** 协议：`flv` 直连、`hls` 切片（m3u8） */
  protocol: 'flv' | 'hls'
  /** 实际命中的容器格式（`flv` / `fmp4` / `ts`） */
  format: string
  url: string
}

/**
 * `stream[].protocol_name` -> 对外的协议名。
 *
 * 官方给的是 `http_stream` / `http_hls`，而用户要的是「FLV / M3U8」这组说法 ——
 * 后者是播放器认的词。表外的 protocol 一律不收：收了也不知道该叫它什么。
 */
const PROTOCOL_NAMES: Record<string, 'flv' | 'hls'> = {
  http_stream: 'flv',
  http_hls: 'hls'
}

/** 遍历响应时收下的一条候选：一个 protocol × format × codec 的可播地址 */
interface PlayurlCombo {
  qn: number
  protocol: 'flv' | 'hls'
  format: string
  codec: string
  url: string
}

/** 直播拉流请求头。B站的 CDN 校验 Referer，不带就是 403，Origin 一并给上更稳 */
const liveStreamHeaders = (roomId: number | string): Record<string, string> => ({
  ...(baseHeaders as Record<string, string>),
  Origin: 'https://live.bilibili.com',
  Referer: `https://live.bilibili.com/${roomId}`,
  Cookie: Config.cookies.bilibili
})

/**
 * 从一条 `url_info` 项里拼出完整地址。
 *
 * B站把地址拆成三段（`host` + `base_url` + `extra`），单独拿任何一段都不可播。
 * 三段里 `host` 和 `base_url` 缺一个就直接判失败 —— 拼出个半截 URL 交给
 * ffmpeg，报错会长得像「ffmpeg 坏了」而不是「接口变了」。
 */
const joinUrlInfo = (urlInfo: unknown, baseUrl: string): string => {
  if (!isRecord(urlInfo)) return ''
  const host = typeof urlInfo.host === 'string' ? urlInfo.host : ''
  const extra = typeof urlInfo.extra === 'string' ? urlInfo.extra : ''
  if (!host || !baseUrl) return ''
  return `${host}${baseUrl}${extra}`
}

/** 取 `g_qn_desc` 里的画质名；表缺失或没这一档时回落到本地表，再兜到数字本身 */
const readQualityName = (qnDesc: unknown, qn: number): string => {
  if (Array.isArray(qnDesc)) {
    for (const item of qnDesc) {
      if (!isRecord(item)) continue
      if (item.qn === qn && typeof item.desc === 'string' && item.desc) return item.desc
    }
  }
  return QN_FALLBACK_NAMES[qn] ?? String(qn)
}

/**
 * 拿一个可播的 B站直播流地址。
 *
 * ## 容错解析，不写裸下标链
 *
 * 官方响应的层级是
 * `data.playurl_info.playurl.stream[].format[].codec[].url_info[]`，
 * 一路点下去（`stream[0].format[0].codec[0].url_info[0].host`）在上游改结构时
 * 会炸成 `TypeError: Cannot read properties of undefined (reading '0')`，
 * 用户看到的是「解析没反应」。所以每一层都过 `isRecord` / `at`：
 * 任何一层缺失都只是让这个函数返回空 `url`，由调用点决定怎么提示。
 *
 * 这里的数组是 `Array.isArray` 收窄出来的 `unknown[]`，`noUncheckedIndexedAccess`
 * 本来就会给下标访问带上 `undefined`，所以用 `at()` 不是为了补类型漏洞
 * （那是 `record.ts` 里非空元组那条），只是为了让「数组本身可能不是数组」
 * 和「下标可能越界」共用一个收口，省掉每层各写一遍判空。
 *
 * ## wbi 签名
 *
 * 不需要。2026-08-31 用真实房间实测：不带 wbi 签名即 `code: 0`，`playurl_info` 非空。
 * Cookie 仍然带上 —— 高码率档位（原画/4K）对未登录用户会被降级，带 Cookie 才拿得到。
 *
 * @param roomId 真实房间号（长号）。短号也能调通，但官方建议用长号
 * @param qn 期望画质，默认 10000（原画）。官方会在不可用时自动降级并在响应里回报实际档位
 * @returns 选中的地址、画质与请求头；任何一层缺失都返回空 `url` 而不抛
 */
export const fetchBilibiliLiveStream = async (
  roomId: number | string,
  qn = 10000
): Promise<BilibiliLiveStreamPick> => {
  const headers = liveStreamHeaders(roomId)
  const response = await requestPlayurl(roomId, qn, headers)
  return pickFromPlayurl(response, qn, headers).pick
}

/**
 * 打一次 `getRoomPlayInfo`。
 *
 * 拆出来是给 {@link listBilibiliLiveStreams} 复用的 —— 列清单要按画质逐个问，
 * 而参数里除了 `qn` 每次都一样，抄第二份迟早和这份的 protocol/format/codec 组合走散。
 * @param roomId 房间号
 * @param qn 期望画质
 * @param headers `liveStreamHeaders` 造好的请求头
 * @returns 未解析的响应体
 */
const requestPlayurl = async (
  roomId: number | string,
  qn: number,
  headers: Record<string, string>
): Promise<unknown> => {
  const params = new URLSearchParams({
    room_id: String(roomId),
    // protocol 0=http-flv 1=http-hls，format 0=flv 1=ts 2=fmp4，codec 0=avc 1=hevc。
    // 全都多要一档：官方在某档不可用时是「不返回那一档」而不是报错，多要能提高命中率。
    protocol: '0,1',
    format: '0,1,2',
    codec: '0,1',
    qn: String(qn),
    platform: 'web',
    ptype: '8',
    dolby: '5',
    panorama: '1'
  })

  return await new Networks({
    url: `${LIVE_PLAYURL_API}?${params.toString()}`,
    headers
  }).getData<unknown>()
}

/**
 * 从一份 `getRoomPlayInfo` 响应里挑出可播地址，并把 `accept_qn` 一并带出来。
 *
 * `accept_qn` 是列清单唯一的画质来源：官方一次请求只返回**被请求那一档**的地址，
 * 想拿别的档只能按它逐个再问（见 {@link listBilibiliLiveStreams}）。
 * 顺带出来不额外花请求，所以挑选和发现放在同一次解析里。
 * @param response 未解析的响应体
 * @param requestedQn 入参画质，`current_qn` 缺失时的兜底
 * @param headers 这次请求用的请求头，原样塞进结果
 * @returns 挑选结果与该房间可用的画质列表
 */
const pickFromPlayurl = (
  response: unknown,
  requestedQn: number,
  headers: Record<string, string>
): { pick: BilibiliLiveStreamPick, acceptQn: number[], combos: PlayurlCombo[] } => {
  const empty: BilibiliLiveStreamPick = {
    url: '',
    qn: 0,
    qualityName: '',
    format: '',
    headers
  }
  const qn = requestedQn
  const acceptQn: number[] = []
  const combos: PlayurlCombo[] = []

  if (!isRecord(response)) return { pick: empty, acceptQn, combos }
  const data = isRecord(response.data) ? response.data : undefined
  const playurlInfo = isRecord(data?.playurl_info) ? data.playurl_info : undefined
  const playurl = isRecord(playurlInfo?.playurl) ? playurlInfo.playurl : undefined
  if (!playurl) return { pick: empty, acceptQn, combos }

  const qnDesc = playurl.g_qn_desc
  const streams = Array.isArray(playurl.stream) ? playurl.stream : undefined
  let pick: BilibiliLiveStreamPick | undefined

  // 逐层遍历而不是只看 [0]：某一档 codec 给了空 url_info 是常见形态，
  // 只取首项会在「第一档空、第二档可用」时误判成拿不到流。
  for (let streamIndex = 0; streamIndex < (streams?.length ?? 0); streamIndex++) {
    const stream = at(streams, streamIndex)
    if (!isRecord(stream)) continue
    const protocolName = typeof stream.protocol_name === 'string' ? stream.protocol_name : ''
    const protocol = PROTOCOL_NAMES[protocolName]
    const formats = Array.isArray(stream.format) ? stream.format : undefined

    for (let formatIndex = 0; formatIndex < (formats?.length ?? 0); formatIndex++) {
      const format = at(formats, formatIndex)
      if (!isRecord(format)) continue
      const formatName = typeof format.format_name === 'string' ? format.format_name : ''
      const codecs = Array.isArray(format.codec) ? format.codec : undefined

      for (let codecIndex = 0; codecIndex < (codecs?.length ?? 0); codecIndex++) {
        const codec = at(codecs, codecIndex)
        if (!isRecord(codec)) continue
        const codecName = typeof codec.codec_name === 'string' ? codec.codec_name : ''
        const baseUrl = typeof codec.base_url === 'string' ? codec.base_url : ''
        const urlInfos = Array.isArray(codec.url_info) ? codec.url_info : undefined

        // accept_qn 挂在每个 codec 上，各档之间实测一致；合并去重是防上游给出不一致的版本。
        // 这一步不能等挑中地址才做：第一个 codec 就命中时后面的 accept_qn 根本轮不到。
        for (const value of Array.isArray(codec.accept_qn) ? codec.accept_qn : []) {
          if (typeof value === 'number' && !acceptQn.includes(value)) acceptQn.push(value)
        }

        for (let urlIndex = 0; urlIndex < (urlInfos?.length ?? 0); urlIndex++) {
          const url = joinUrlInfo(at(urlInfos, urlIndex), baseUrl)
          if (!url) continue
          // 用响应回报的 current_qn 而不是入参 qn：官方降级后两者会不一致，
          // 显示给用户的必须是实际拿到的那一档。
          const actualQn = typeof codec.current_qn === 'number' ? codec.current_qn : qn
          // 不在这里 return：accept_qn 和 combos 都要收满整份响应才准，
          // 提前退出会让列清单在「第一个 codec 就有地址」的房间上只看到一个组合。
          pick ??= {
            url,
            qn: actualQn,
            qualityName: readQualityName(qnDesc, actualQn),
            format: formatName,
            headers
          }
          if (protocol) combos.push({ qn: actualQn, protocol, format: formatName, codec: codecName, url })
          break
        }
      }
    }
  }

  return { pick: pick ?? empty, acceptQn, combos }
}

/**
 * 单次列清单最多打几次 `getRoomPlayInfo`。
 *
 * 官方一次请求只回**被请求那一档**的地址，所以「列出所有画质」在协议上就是
 * 一档一次请求。实测 `accept_qn` 是 4~6 个值（原画/蓝光/超清/高清/流畅，杜比和 4K 偶现），
 * 这个上限只在上游把列表撑长时才生效，是防串台的护栏而不是常态裁剪。
 */
const MAX_QUALITY_REQUESTS = 6

/**
 * 列出一个直播间的拉流地址，**一个画质 × 一个协议一条**。
 *
 * ## 为什么是新函数而不是改 {@link fetchBilibiliLiveStream}
 *
 * 那个函数正被录制路径（`common/liveRecord.ts`）使用，它要的是「一条能播的」。
 * 把它的返回改成清单，等于让录制路径跟着改一遍取值 —— 两条路径一起担风险。
 * 两者共用 {@link requestPlayurl} 与 {@link pickFromPlayurl}，所以 protocol/format/codec
 * 的解析只有一份，不会分头漂移。
 *
 * ## 展开到 protocol，不展开到 codec
 *
 * 响应是 protocol × format × codec 三层。protocol 那一维要展开 —— 用户要的就是
 * 「FLV 和 M3U8 各给一份」；codec 那一维不展开：`hevc` 在不少播放器上放不了，
 * 同一档给两条地址只会让人挑错。所以每个 (画质, 协议) 取一条，优先 `avc`。
 *
 * ## 代价
 *
 * 最多 {@link MAX_QUALITY_REQUESTS} 次请求 —— 官方一次只回**被请求那一档**的画质，
 * 但那一档的 FLV 和 M3U8 在同一份响应里，所以协议维度不额外花请求。
 * 第一次拿原画顺便发现 `accept_qn`，剩下的按它逐个问。请求顺序发：
 * `Networks.getData()` 自带 429/403 重试，并发打同一个接口只会让退避互相叠加。
 * @param roomId 真实房间号（长号）
 * @returns 地址清单，按画质从高到低、同画质内 flv 在前；一条都拿不到时返回空数组
 */
export const listBilibiliLiveStreams = async (
  roomId: number | string
): Promise<BilibiliLiveStreamEntry[]> => {
  const headers = liveStreamHeaders(roomId)
  const first = pickFromPlayurl(await requestPlayurl(roomId, 10000, headers), 10000, headers)

  const entries: BilibiliLiveStreamEntry[] = []
  // key 是 `画质:协议`：同一档的 FLV 和 M3U8 是两条，而同一档同协议的 avc/hevc 只留一条
  const seen = new Set<string>()

  const collect = (combos: PlayurlCombo[], qualityName: (qn: number) => string): void => {
    // avc 排前面：同一个 (画质, 协议) 下先到先得，所以要让兼容性好的那个先到
    const ordered = [...combos].sort((a, b) => Number(b.codec === 'avc') - Number(a.codec === 'avc'))
    for (const combo of ordered) {
      const key = `${combo.qn}:${combo.protocol}`
      if (!combo.url || seen.has(key)) continue
      seen.add(key)
      entries.push({
        qn: combo.qn,
        qualityName: qualityName(combo.qn),
        protocol: combo.protocol,
        format: combo.format,
        url: combo.url
      })
    }
  }
  // 画质名只在 pick 里算过一次，这里按它回填：同一次响应里所有 combo 的 qn 都相同
  collect(first.combos, () => first.pick.qualityName || String(first.pick.qn))

  // 降序：accept_qn 的顺序是接口给的，不保证从高到低
  const rest = [...first.acceptQn]
    .sort((a, b) => b - a)
    .filter(qn => !seen.has(`${qn}:flv`) && !seen.has(`${qn}:hls`))
    .slice(0, MAX_QUALITY_REQUESTS - 1)

  for (const qn of rest) {
    // 一档失败不该拖掉整张清单：这一档没转码、或 CDN 单独拒了这一档都算常态
    try {
      const round = pickFromPlayurl(await requestPlayurl(roomId, qn, headers), qn, headers)
      collect(round.combos, () => round.pick.qualityName || String(round.pick.qn))
    } catch (error) {
      logger.debug(`[B站] 取 qn=${qn} 的拉流地址失败，跳过`, error)
    }
  }

  // 画质降序、同画质内 flv 在前。协议分组由排版层（`common/liveStreamForward.ts`）再做一次
  return entries.sort((a, b) => b.qn - a.qn || Number(a.protocol === 'hls') - Number(b.protocol === 'hls'))
}
