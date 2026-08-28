import type { VideoQuality } from '@/types/config'

import { parseJsonSafely } from './workType.js'

/**
 * 抖音清晰度档位，从高到低。
 * 与 `Config.douyin.videoQuality` 的取值域一致，只是不含 `adapt`（那是模式而不是档位）。
 */
export type DouyinQualityLevel = '4k' | '2k' | '1080p' | '720p' | '540p'

/** 档位优先级，从高到低 */
const QUALITY_PRIORITY: DouyinQualityLevel[] = ['4k', '2k', '1080p', '720p', '540p']

/**
 * `video_extra.definition` → 内部档位名。
 *
 * 抖音把 2K 记作 `1440p`，而配置项 `videoQuality` 用的是 `2k`，这张表是两套词表唯一的翻译点，
 * 配置域不需要跟着上游改。
 */
const DEFINITION_TO_LEVEL: Record<string, DouyinQualityLevel> = {
  '4k': '4k',
  '2k': '2k',
  '1440p': '2k',
  '1080p': '1080p',
  '720p': '720p',
  '540p': '540p'
}

/** `bit_rate[]` 里挑源用得到的字段，只声明真正读的那几个 */
export interface DouyinBitRateItem {
  format?: string
  gear_name?: string
  /** 位深，HDR 档为 `'10'` */
  HDR_bit?: string
  HDR_type?: string
  video_extra?: string
  play_addr: {
    data_size: number
  }
}

/** 挑源参数 */
export interface DouyinVideoPickOptions {
  /** 画质偏好，`adapt` 为按体积上限自动挑最高档 */
  videoQuality?: VideoQuality
  /** `adapt` 模式的体积上限（MB） */
  maxAutoVideoSize?: number
  /** 硬体积上限（MB），固定档位模式也受它约束 */
  filelimit?: number
}

/**
 * 判定单条视频源的清晰度档位。
 *
 * `video_extra.definition` 是主判据：十一个作品 120 条 mp4 档实测 100% 有值、100% 与 ffprobe
 * 吻合。不能拿 `play_addr.width × height` 反推 —— 抖音允许非标准比例，实测见过 `1900×3378`
 * 的最高档，按像素匹配落不到任何标准档，而 `definition` 直接给 `4k`。
 * @param video - 视频源对象
 * @returns 档位名，认不出时返回 undefined
 */
export const getDouyinQualityLevel = (video: DouyinBitRateItem): DouyinQualityLevel | undefined => {
  const definition = parseJsonSafely<{ definition?: string }>(video.video_extra).definition
  const level = definition ? DEFINITION_TO_LEVEL[definition] : undefined
  return level ?? guessLevelFromGearName(video.gear_name ?? '')
}

/**
 * 从 `gear_name` 猜档位，只在 `video_extra.definition` 缺失时兜底。
 *
 * 实测中 `definition` 一次都没缺过，所以这条路没被走过 —— 但兜底存在的意义就是应对字段消失。
 * 认不出来返回 undefined 交给调用方，不默认落到 540p 污染分档。
 * @param gearName - 视频源的 gear_name
 * @returns 档位名，认不出时返回 undefined
 */
const guessLevelFromGearName = (gearName: string): DouyinQualityLevel | undefined => {
  // `_4_` 的语义是「该作品的最高档」。上游写的 `includes('lowest_4')` 会漏掉
  // `ame_bvc1_vip_direct_vs_r1_adapt_lower_4_1` —— 实测样本里它恰好是码率最高的那条 4K，
  // 漏判等于把最高清的源丢掉。`(?:^|_)4_` 不会误吃 `1440`：那两个 `4` 前面是 `1` 和 `4`。
  if (/(?:^|_)4_\d+$/.test(gearName)) return '4k'
  if (gearName.includes('1440')) return '2k'
  if (gearName.includes('1080')) return '1080p'
  if (gearName.includes('720')) return '720p'
  if (gearName.includes('540')) return '540p'
  return undefined
}

/**
 * 这条源本身是不是 HDR。
 *
 * 判据是逐条的，不是整个作品的：真 HDR 作品里 HDR 档与一条同分辨率的 SDR 档成对出现
 * （同 `quality_type`，只差 profile 和 pix_fmt），所以不能用顶层 `is_source_HDR` 排除，
 * 那会把整个作品的档位全清空。
 * @param video - 视频源对象
 * @returns 是否为 HDR 源
 */
const isHdrStream = (video: DouyinBitRateItem): boolean => {
  if (/hdr/i.test(video.gear_name ?? '')) return true
  if (video.HDR_type && video.HDR_type !== '0') return true
  return Number(video.HDR_bit) > 8
}

/**
 * 同档位内的取源顺序：体积从大到小（同分辨率下体积大 = 码率高）。
 * @param a - 视频源 A
 * @param b - 视频源 B
 * @returns 排序比较值
 */
const bySizeDesc = (a: DouyinBitRateItem, b: DouyinBitRateItem): number =>
  b.play_addr.data_size - a.play_addr.data_size

/**
 * 按档位给视频源分组，组内按体积降序
 * @param videos - 视频源数组
 * @returns 档位 → 该档位下的视频源
 */
const groupByQualityLevel = <T extends DouyinBitRateItem>(videos: T[]): Map<DouyinQualityLevel, T[]> => {
  const grouped = new Map<DouyinQualityLevel, T[]>()
  for (const video of videos) {
    const level = getDouyinQualityLevel(video)
    if (!level) {
      logger.debug(`[douyin] 认不出清晰度档位，跳过该源：gear_name=${video.gear_name}`)
      continue
    }
    const bucket = grouped.get(level)
    if (bucket) bucket.push(video)
    else grouped.set(level, [video])
  }
  grouped.forEach(bucket => bucket.sort(bySizeDesc))
  return grouped
}

/**
 * 固定档位模式下的回落顺序：先往低档找，再往高档找。
 * @param target - 目标档位
 * @returns 从目标档位开始的完整尝试顺序
 */
const buildFallbackOrder = (target: DouyinQualityLevel): DouyinQualityLevel[] => {
  const index = QUALITY_PRIORITY.indexOf(target)
  if (index < 0) return QUALITY_PRIORITY
  return [...QUALITY_PRIORITY.slice(index), ...QUALITY_PRIORITY.slice(0, index).reverse()]
}

/**
 * 从 `bit_rate` 里挑出唯一一路可下载的源。
 *
 * **档位是第一排序键、体积是第二。** 只按体积降序取「不超上限的最大那条」会跨档选错：
 * H.265 的高分辨率条目常比 H.264 的低分辨率条目更小，实测样本里 500MB 预算下 4K 只要
 * 491.9MB，却会被 497.6MB 的 2K 抢走。小红书那条路径（`xiaohongshu.ts` 的
 * `selectVideoStream`）早就是这么排的，抖音这边一直没跟上。
 *
 * HDR 档一律排除：实测四个真 HDR 作品 4/4，HDR 档的体积恒为该作品的全局最大，所以
 * 「取最大体积」在 HDR 作品上**必然**选中它，而 QQ 不做 tone mapping，HLG 片源偏灰发白。
 * 排除它不用降档 —— SDR 孪生就在同一档、同分辨率、同帧率，只小 5%~10%。
 * @param videos - `aweme_detail.video.bit_rate` 数组
 * @param options - 挑源参数
 * @returns 长度为 1 的数组，元素为选中的视频源
 */
export const douyinProcessVideos = <T extends DouyinBitRateItem>(
  videos: T[],
  options: DouyinVideoPickOptions = {}
): [T] => {
  // dash 是 App 端流媒体专用，下载和 Web 播放都只认 mp4
  const candidates = videos.filter(video => video.format !== 'dash')
  if (candidates.length === 0) {
    // 只剩 dash（或压根没给源）时没得挑，回退第一条让调用方自己判。
    // 旧实现在这里走 reduce 会抛「Reduce of empty array」，报错信息看不出是接口没给源。
    const fallback = videos[0]
    if (!fallback) throw new Error('接口没有返回任何视频源')
    return [fallback]
  }

  // 全是 HDR 时不排除，否则会挑不出源
  const sdrOnly = candidates.filter(video => !isHdrStream(video))
  const pool = sdrOnly.length > 0 ? sdrOnly : candidates
  if (sdrOnly.length !== candidates.length) {
    logger.debug(`[douyin] 排除 ${candidates.length - sdrOnly.length} 条 HDR 源，剩余 ${pool.length} 条`)
  }

  const quality = options.videoQuality || 'adapt'
  const filelimit = options.filelimit
  /*
    两个上限**同时**生效，谁更严谁说话：`filelimit` 是上传通道的硬闸门
    （`Base.ts` 里超了就 `return false` 并回「已取消上传」），`maxAutoVideoSize`
    只是画质偏好。所以不能像原来那样在 adapt 模式下用 `maxAutoVideoSize || filelimit`
    ——面板上前者能填到 9999、后者最低能填 5，一旦用户把前者调得比后者大，
    挑源会选中一条注定被上传环节拒掉的流，而同一作品里更小的档本来发得出去。
    固定档位模式只受 filelimit 约束（`maxAutoVideoSize` 按设计仅 adapt 生效）。

    0 / undefined 都表示「这一路不设限」，靠 filter 滤掉后再取 min，
    两个都没给就是 Infinity。
  */
  const limits = quality === 'adapt'
    ? [options.maxAutoVideoSize, filelimit]
    : [filelimit]
  const effective = limits.filter((value): value is number => typeof value === 'number' && value > 0)
  const sizeLimitBytes = effective.length > 0 ? Math.min(...effective) * 1024 * 1024 : Infinity

  const grouped = groupByQualityLevel(pool)
  const order = quality === 'adapt' ? QUALITY_PRIORITY : buildFallbackOrder(quality as DouyinQualityLevel)

  for (const level of order) {
    // 组内已按体积降序，第一条不超限的就是该档位里码率最高的可用源
    const picked = grouped.get(level)?.find(video => video.play_addr.data_size <= sizeLimitBytes)
    if (picked) {
      logger.debug(`[douyin] 选中 ${level}，体积 ${(picked.play_addr.data_size / (1024 * 1024)).toFixed(2)}MB`)
      return [picked]
    }
  }

  // 没有任何档塞得进上限（或所有源的档位都认不出），退回体积最小的那条，至少让它有机会发出去
  const smallest = pool.reduce((min, video) => video.play_addr.data_size < min.play_addr.data_size ? video : min)
  logger.debug(`[douyin] 无档位满足体积上限，退回最小源 ${(smallest.play_addr.data_size / (1024 * 1024)).toFixed(2)}MB`)
  return [smallest]
}
