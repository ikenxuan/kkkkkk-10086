import { describe, expect, it, vi } from 'vitest'

globalThis.logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  mark: vi.fn()
} as unknown as typeof logger

const {
  douyinProcessVideos,
  getDouyinQualityLevel
} = await import('../../src/module/platform/douyin/videoQuality.js')

/**
 * 造一条 bit_rate 源。字段形状照抄实测样本：`definition` 埋在 `video_extra` 的 JSON 字符串里，
 * 体积在 `play_addr.data_size`（字节）。
 * @param options - 源的各字段
 * @returns bit_rate 数组项
 */
const src = (options: {
  definition?: string
  gear_name?: string
  sizeMB: number
  format?: string
  hdr?: boolean
}) => ({
  format: options.format ?? 'mp4',
  gear_name: options.gear_name ?? 'adapt_lowest_720_1',
  ...(options.hdr ? { HDR_type: '1', HDR_bit: '10' } : {}),
  video_extra: options.definition === undefined
    ? JSON.stringify({ file_id: 'x' })
    : JSON.stringify({ definition: options.definition, file_id: 'x' }),
  play_addr: { data_size: options.sizeMB * 1024 * 1024 }
})

/** 从选中结果里取出可断言的标识 */
const pickedSize = (videos: Array<{ play_addr: { data_size: number } }>): number =>
  videos[0].play_addr.data_size / (1024 * 1024)

describe('getDouyinQualityLevel', () => {
  it('主判据是 video_extra.definition', () => {
    expect(getDouyinQualityLevel(src({ definition: '4k', sizeMB: 10 }))).toBe('4k')
    expect(getDouyinQualityLevel(src({ definition: '1080p', sizeMB: 10 }))).toBe('1080p')
  })

  // 抖音把 2K 记作 1440p，配置域用 2k，两套词表只在这里翻译
  it('1440p 归到 2k', () => {
    expect(getDouyinQualityLevel(src({ definition: '1440p', sizeMB: 10 }))).toBe('2k')
  })

  it('definition 缺失时退到 gear_name', () => {
    expect(getDouyinQualityLevel(src({ gear_name: 'normal_1080_0', sizeMB: 10 }))).toBe('1080p')
  })

  /**
   * 上游 `guessLevelFromGearName` 写的是 `includes('lowest_4')`，认不出
   * `adapt_lower_4_1`（少个 st）。实测样本里这条恰好是码率最高的 4K，
   * 漏判会让最高清的源被 groupByQualityLevel 直接跳过。
   */
  it('gear_name 兜底认得 lower_4 而不只是 lowest_4', () => {
    expect(getDouyinQualityLevel(src({ gear_name: 'adapt_lower_4_1', sizeMB: 10 }))).toBe('4k')
    expect(getDouyinQualityLevel(src({ gear_name: 'adapt_lowest_4_1', sizeMB: 10 }))).toBe('4k')
    expect(getDouyinQualityLevel(src({
      gear_name: 'ame_bvc1_vip_direct_vs_r1_adapt_lower_4_1',
      sizeMB: 10
    }))).toBe('4k')
  })

  // `(?:^|_)4_` 不能把 1440 里的 4 当成最高档标记
  it('4k 的 gear 规则不误吃 1440', () => {
    expect(getDouyinQualityLevel(src({ gear_name: 'adapt_lowest_1440_1', sizeMB: 10 }))).toBe('2k')
    expect(getDouyinQualityLevel(src({ gear_name: 'adapt_lower_1440_1', sizeMB: 10 }))).toBe('2k')
  })

  it('两个判据都认不出时返回 undefined，不默认落到 540p', () => {
    expect(getDouyinQualityLevel(src({ gear_name: 'brand_new_gear', sizeMB: 10 }))).toBeUndefined()
  })
})

/**
 * 档位必须是第一排序键、体积是第二。
 *
 * 旧实现只取「不超上限的最大体积」，跨档必然选错：H.265 的高分辨率条目常比 H.264 的
 * 低分辨率条目更小。实测样本在 500MB 预算下 4K 只要 491.9MB，却被 497.6MB 的 2K 抢走。
 */
describe('douyinProcessVideos 档位优先于体积', () => {
  it('4k 比 2k 小且都在上限内时仍选 4k', () => {
    const picked = douyinProcessVideos([
      src({ definition: '1440p', sizeMB: 497.6 }),
      src({ definition: '4k', sizeMB: 491.9 })
    ], { videoQuality: 'adapt', maxAutoVideoSize: 500 })
    expect(getDouyinQualityLevel(picked[0])).toBe('4k')
    expect(pickedSize(picked)).toBeCloseTo(491.9)
  })

  it('高档超限时才降档', () => {
    const picked = douyinProcessVideos([
      src({ definition: '4k', sizeMB: 700 }),
      src({ definition: '1440p', sizeMB: 294.5 }),
      src({ definition: '1080p', sizeMB: 120 })
    ], { videoQuality: 'adapt', maxAutoVideoSize: 300 })
    expect(getDouyinQualityLevel(picked[0])).toBe('2k')
  })

  it('同档内取体积最大的那条（同分辨率下码率更高）', () => {
    const picked = douyinProcessVideos([
      src({ definition: '1080p', sizeMB: 8 }),
      src({ definition: '1080p', sizeMB: 14 }),
      src({ definition: '1080p', sizeMB: 11 })
    ], { videoQuality: 'adapt', maxAutoVideoSize: 50 })
    expect(pickedSize(picked)).toBe(14)
  })

  it('没有任何档塞得进上限时退回体积最小的', () => {
    const picked = douyinProcessVideos([
      src({ definition: '4k', sizeMB: 700 }),
      src({ definition: '1080p', sizeMB: 300 }),
      src({ definition: '540p', sizeMB: 90 })
    ], { videoQuality: 'adapt', maxAutoVideoSize: 50 })
    expect(pickedSize(picked)).toBe(90)
  })

  it('档位全认不出时也能挑出一条，不返回空', () => {
    const picked = douyinProcessVideos([
      src({ gear_name: 'brand_new_gear_a', sizeMB: 30 }),
      src({ gear_name: 'brand_new_gear_b', sizeMB: 12 })
    ], { videoQuality: 'adapt', maxAutoVideoSize: 50 })
    expect(picked).toHaveLength(1)
    expect(pickedSize(picked)).toBe(12)
  })
})

/**
 * HDR 档的体积恒为该作品的全局最大（四个真 HDR 样本 4/4），所以「取最大体积」在 HDR
 * 作品上必然选中它 —— 而 QQ 不做 tone mapping，HLG 片源偏灰发白。
 *
 * 排除它不用降档：SDR 孪生就在同一档、同分辨率、同帧率，只小 5%~10%。
 */
describe('douyinProcessVideos 排除 HDR 档', () => {
  it('HDR 是全局最大体积时也不选它，且不降档', () => {
    const picked = douyinProcessVideos([
      src({ definition: '4k', gear_name: 'pay_bvc1_hdr_r1_adapt_lowest_4_1', sizeMB: 17.8, hdr: true }),
      src({ definition: '4k', gear_name: 'adapt_lowest_4_1', sizeMB: 16.4 }),
      src({ definition: '1080p', gear_name: 'normal_1080_0', sizeMB: 6 })
    ], { videoQuality: 'adapt', maxAutoVideoSize: 50 })
    // 仍是 4k，只是换成 SDR 孪生
    expect(getDouyinQualityLevel(picked[0])).toBe('4k')
    expect(pickedSize(picked)).toBeCloseTo(16.4)
  })

  it('只靠 gear_name 的 hdr 标记也能排除（HDR_type 缺失时）', () => {
    const picked = douyinProcessVideos([
      src({ definition: '4k', gear_name: 'pay_bvc1_hdr_r1_adapt_lowest_4_1', sizeMB: 17.8 }),
      src({ definition: '4k', gear_name: 'adapt_lowest_4_1', sizeMB: 16.4 })
    ], { videoQuality: 'adapt', maxAutoVideoSize: 50 })
    expect(pickedSize(picked)).toBeCloseTo(16.4)
  })

  // 全是 HDR 时排除会挑不出源，此时必须放行
  it('全部源都是 HDR 时不排除', () => {
    const picked = douyinProcessVideos([
      src({ definition: '4k', gear_name: 'pay_bvc1_hdr_r1_adapt_lowest_4_1', sizeMB: 17.8, hdr: true })
    ], { videoQuality: 'adapt', maxAutoVideoSize: 50 })
    expect(picked).toHaveLength(1)
    expect(pickedSize(picked)).toBeCloseTo(17.8)
  })
})

describe('douyinProcessVideos 固定档位模式', () => {
  it('配了 1080p 就不拿 4k', () => {
    const picked = douyinProcessVideos([
      src({ definition: '4k', sizeMB: 40 }),
      src({ definition: '1080p', sizeMB: 12 })
    ], { videoQuality: '1080p', filelimit: 100 })
    expect(getDouyinQualityLevel(picked[0])).toBe('1080p')
  })

  it('目标档不存在时先往低档找', () => {
    const picked = douyinProcessVideos([
      src({ definition: '4k', sizeMB: 40 }),
      src({ definition: '720p', sizeMB: 8 })
    ], { videoQuality: '1080p', filelimit: 100 })
    expect(getDouyinQualityLevel(picked[0])).toBe('720p')
  })

  it('低档也没有时才往高档找', () => {
    const picked = douyinProcessVideos([
      src({ definition: '4k', sizeMB: 40 }),
      src({ definition: '1440p', sizeMB: 25 })
    ], { videoQuality: '1080p', filelimit: 100 })
    // 往上找是从目标档反向逼近，2k 比 4k 更接近 1080p
    expect(getDouyinQualityLevel(picked[0])).toBe('2k')
  })

  // 固定档位不能无视体积，否则配了 4k 就会拉 700MB 的源
  it('固定档位仍受 filelimit 约束', () => {
    const picked = douyinProcessVideos([
      src({ definition: '4k', sizeMB: 700 }),
      src({ definition: '1080p', sizeMB: 60 })
    ], { videoQuality: '4k', filelimit: 100 })
    expect(getDouyinQualityLevel(picked[0])).toBe('1080p')
  })

  it('adapt 用 maxAutoVideoSize，与 filelimit 分开', () => {
    const videos = [
      src({ definition: '4k', sizeMB: 80 }),
      src({ definition: '720p', sizeMB: 20 })
    ]
    // maxAutoVideoSize 缺省时回落到 filelimit
    expect(getDouyinQualityLevel(douyinProcessVideos(videos, {
      videoQuality: 'adapt', filelimit: 100
    })[0])).toBe('4k')
    // 给了 maxAutoVideoSize 就以它为准，即便 filelimit 更宽
    expect(getDouyinQualityLevel(douyinProcessVideos(videos, {
      videoQuality: 'adapt', maxAutoVideoSize: 50, filelimit: 100
    })[0])).toBe('720p')
  })
})

describe('douyinProcessVideos 格式过滤', () => {
  it('排除 dash（App 端流媒体专用，下载和 Web 播放都不认）', () => {
    const picked = douyinProcessVideos([
      src({ definition: '4k', sizeMB: 40, format: 'dash' }),
      src({ definition: '1080p', sizeMB: 12 })
    ], { videoQuality: 'adapt', maxAutoVideoSize: 100 })
    expect(getDouyinQualityLevel(picked[0])).toBe('1080p')
  })

  it('全是 dash 时退回第一条，不返回空', () => {
    const picked = douyinProcessVideos([
      src({ definition: '4k', sizeMB: 40, format: 'dash' })
    ], { videoQuality: 'adapt', maxAutoVideoSize: 100 })
    expect(picked).toHaveLength(1)
  })

  it('不传参数时按 adapt + 无上限处理', () => {
    const picked = douyinProcessVideos([
      src({ definition: '1080p', sizeMB: 12 }),
      src({ definition: '4k', sizeMB: 700 })
    ])
    expect(getDouyinQualityLevel(picked[0])).toBe('4k')
  })
})
