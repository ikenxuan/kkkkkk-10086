import { describe, expect, it, vi } from 'vitest'

globalThis.logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  mark: vi.fn()
} as unknown as typeof logger

const {
  buildDouyinPlayUrl,
  buildDouyinResolutionInfo,
  douyinProcessVideos,
  formatDouyinQualityLabel,
  getDouyinQualityLevel,
  isDouyinHdrStream
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

  /**
   * 抖音会给出整个作品只有 480p 的情况（实测样本「到洪崖洞了」两条流的 `definition` 全是
   * `480p`）。表里漏掉 480p 会让这类作品一条档位都分不出来，`douyinProcessVideos` 直接掉进
   * 「取体积最小那条」的兜底分支。
   */
  it('definition 认得 480p', () => {
    expect(getDouyinQualityLevel(src({ definition: '480p', sizeMB: 10 }))).toBe('480p')
  })

  it('definition 缺失时 gear_name 兜底也认得 480', () => {
    expect(getDouyinQualityLevel(src({ gear_name: 'normal_480_0', sizeMB: 10 }))).toBe('480p')
    expect(getDouyinQualityLevel(src({
      gear_name: 'comet_bvc1_r3_adapt_lowest_480_1',
      sizeMB: 10
    }))).toBe('480p')
  })

  it('两个判据都认不出时返回 undefined，不默认落到 540p', () => {
    expect(getDouyinQualityLevel(src({ gear_name: 'brand_new_gear', sizeMB: 10 }))).toBeUndefined()
  })
})

/**
 * 实测样本「到洪崖洞了」（awemeId 7624472535736359141，作者「比巴波卜」）的完整两条
 * `bit_rate`，字段值照抄取数结果，没有简化：两条都是 480p、都不是 HDR、体积只差 14%。
 *
 * 这个作品是 480p 漏映射的实证：两条流的档位都认不出来时 `groupByQualityLevel` 会把它们
 * 全跳过，选源循环一条都命中不了，最后由兜底分支按**最小体积**选中 1.88MB 那条 —— 而同一
 * 作品里 2.16MB 那条分辨率、帧率完全相同，只是码率更高。每次解析都发更差的那条。
 */
const SAMPLE_L_STREAMS = [
  {
    gear_name: 'normal_480_0',
    format: 'mp4',
    HDR_type: '',
    HDR_bit: '',
    video_extra: '{"format":"mp4","definition":"480p","quality":"normal","file_id":"003011ca5de345eba69ec5ea5b8fb072"}',
    play_addr: { data_size: 2263837, width: 480, height: 852 }
  },
  {
    gear_name: 'comet_bvc1_r3_adapt_lowest_480_1',
    format: 'mp4',
    HDR_type: '',
    HDR_bit: '',
    video_extra: '{"format":"mp4","definition":"480p","quality":"adapt_lowest","file_id":"d72b1a94988d4e04aaf14c5ef4f1fcc5"}',
    play_addr: { data_size: 1971279, width: 480, height: 852 }
  }
]

describe('douyinProcessVideos 纯 480p 作品（实测样本「到洪崖洞了」）', () => {
  it('两条流都认成 480p，而不是认不出档位', () => {
    expect(SAMPLE_L_STREAMS.map(getDouyinQualityLevel)).toEqual(['480p', '480p'])
  })

  // 默认配置就是 videoQuality: 4k，目标档不存在时靠 buildFallbackOrder 一路降到 480p
  it('默认 4k 偏好下降档取到 480p 里码率最高的 2.16MB，而不是兜底的 1.88MB', () => {
    const picked = douyinProcessVideos(SAMPLE_L_STREAMS, { videoQuality: '4k', filelimit: 1536 })
    expect(picked[0].play_addr.data_size).toBe(2263837)
    expect(picked[0].gear_name).toBe('normal_480_0')
  })

  it('adapt 模式下同样取 2.16MB 那条', () => {
    const picked = douyinProcessVideos(SAMPLE_L_STREAMS, {
      videoQuality: 'adapt', maxAutoVideoSize: 50, filelimit: 1536
    })
    expect(picked[0].play_addr.data_size).toBe(2263837)
  })

  // 用户配 540p 时，480p 在优先级序里紧邻其下，回落一步就命中
  it('配 540p 时回落到 480p，仍取码率最高的那条', () => {
    const picked = douyinProcessVideos(SAMPLE_L_STREAMS, { videoQuality: '540p', filelimit: 1536 })
    expect(picked[0].play_addr.data_size).toBe(2263837)
  })

  // 体积上限压到两条流之下时才该走兜底，这时选最小的 1.88MB 是对的
  it('上限卡在两条流之下时才退回最小的 1.88MB', () => {
    const picked = douyinProcessVideos(SAMPLE_L_STREAMS, { videoQuality: '4k', filelimit: 1 })
    expect(picked[0].play_addr.data_size).toBe(1971279)
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

  it('adapt 下两个上限同时生效，取更严的那个', () => {
    const videos = [
      src({ definition: '4k', sizeMB: 80 }),
      src({ definition: '720p', sizeMB: 20 })
    ]
    // maxAutoVideoSize 缺省时回落到 filelimit
    expect(getDouyinQualityLevel(douyinProcessVideos(videos, {
      videoQuality: 'adapt', filelimit: 100
    })[0])).toBe('4k')
    // maxAutoVideoSize 更严时以它为准
    expect(getDouyinQualityLevel(douyinProcessVideos(videos, {
      videoQuality: 'adapt', maxAutoVideoSize: 50, filelimit: 100
    })[0])).toBe('720p')
  })

  /*
    面板上 maxAutoVideoSize 能填到 9999、filelimit 最低能填 5，所以「偏好比硬闸门宽」
    是用户随手就能配出来的。原实现在 adapt 模式下写 `maxAutoVideoSize || filelimit`，
    这种配置会挑中一条注定被 Base.ts 拒掉（「已取消上传」）的流。
  */
  it('adapt 下 maxAutoVideoSize 比 filelimit 宽时，仍不越过 filelimit', () => {
    const picked = douyinProcessVideos([
      src({ definition: '4k', sizeMB: 80 }),
      src({ definition: '720p', sizeMB: 20 })
    ], { videoQuality: 'adapt', maxAutoVideoSize: 500, filelimit: 50 })
    expect(getDouyinQualityLevel(picked[0])).toBe('720p')
  })

  it('adapt 下 maxAutoVideoSize 为 0 表示不设限，仍受 filelimit 约束', () => {
    const picked = douyinProcessVideos([
      src({ definition: '4k', sizeMB: 80 }),
      src({ definition: '720p', sizeMB: 20 })
    ], { videoQuality: 'adapt', maxAutoVideoSize: 0, filelimit: 50 })
    expect(getDouyinQualityLevel(picked[0])).toBe('720p')
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

/**
 * 造一条带地址的源，用来验证兜底地址的拼法。
 * @param playAddr - 覆盖 play_addr 上的字段
 * @returns bit_rate 数组项
 */
const withAddr = (playAddr: {
  uri?: string
  url_list?: string[]
  width?: number
  height?: number
}) => ({
  ...src({ definition: '1080p', sizeMB: 10 }),
  play_addr: { data_size: 10 * 1024 * 1024, ...playAddr }
})

describe('buildDouyinPlayUrl', () => {
  /*
    上游 417ad3c 拼的是 `?video_id=${uri}&&file_id=${fileId}`，两个 `&` 会在 query 里
    夹出一个空参数。这里改用 URLSearchParams，所以分隔符只可能是单个 `&`。
  */
  it('分隔符是单个 &，不复现上游的 && 拼串', () => {
    const url = buildDouyinPlayUrl({
      uri: 'v0300fg10000abcdef',
      url_list: ['https://www.douyin.com/aweme/v1/play/?video_id=v1&file_id=FID123']
    })
    expect(url).not.toContain('&&')
    expect(url).toBe('https://aweme.snssdk.com/aweme/v1/play/?video_id=v0300fg10000abcdef&file_id=FID123')
    // 空 key 会让 URLSearchParams 解出一条 ['', ''] 的条目
    expect([...new URL(url).searchParams.keys()]).toEqual(['video_id', 'file_id'])
  })

  it('拿不到 file_id 时只带 video_id', () => {
    expect(buildDouyinPlayUrl({ uri: 'v1', url_list: ['https://www.douyin.com/play?foo=bar'] }))
      .toBe('https://aweme.snssdk.com/aweme/v1/play/?video_id=v1')
  })

  // 接口偶尔给相对路径或空串，`new URL` 会抛。兜底源少个参数还能用，不该让整条解析挂掉
  it('url_list 里有非法 URL 时不抛，跳过继续找', () => {
    expect(buildDouyinPlayUrl({
      uri: 'v1',
      url_list: ['', 'not a url', 'https://www.douyin.com/play?file_id=FID9']
    })).toBe('https://aweme.snssdk.com/aweme/v1/play/?video_id=v1&file_id=FID9')
  })

  // 上游写死 `url_list[2]`，实测 url_list 长度在 2~3 之间浮动，只有两条时会漏掉
  it('不写死下标 2，逐条找带 file_id 的那条', () => {
    expect(buildDouyinPlayUrl({
      uri: 'v1',
      url_list: ['https://a.example/x.mp4', 'https://www.douyin.com/play?file_id=FID2']
    })).toContain('file_id=FID2')
  })

  it('uri 缺失时返回空串，交给调用方判断要不要放进候选', () => {
    expect(buildDouyinPlayUrl({ url_list: ['https://www.douyin.com/play?file_id=FID1'] })).toBe('')
    expect(buildDouyinPlayUrl(undefined)).toBe('')
  })

  it('uri 里的特殊字符交给 URLSearchParams 转义', () => {
    expect(buildDouyinPlayUrl({ uri: 'a b&c=d' }))
      .toBe('https://aweme.snssdk.com/aweme/v1/play/?video_id=a+b%26c%3Dd')
  })
})

/*
  候选清单的顺序就是尝试顺序（`orderCdnCandidates` 只把近期失败过的主机往后挪，
  刻意保留调用方给的相对次序）。签名直链必须在前、snssdk 兜底必须垫最后：
  那个域名要先过一次抖音侧负载均衡再 302，实测冷握手比直链多约 5.7 秒。
  这里把 douyin.ts 里那段拼法照搬过来，锁住顺序不被人「优化」回去。
*/
describe('下载候选清单的排序', () => {
  /**
   * 复刻 `douyin.ts` 里组候选清单的那一行。
   * @param playAddr - 选中那一路的 play_addr
   * @returns 候选地址清单，顺序即优先级
   */
  const buildCandidates = (playAddr: { uri?: string, url_list?: string[] }): string[] => [
    ...(playAddr.url_list ?? []).filter(Boolean),
    buildDouyinPlayUrl(playAddr)
  ].filter(Boolean)

  it('拼出来的 snssdk 地址排在最后，不顶掉 url_list[0]', () => {
    const candidates = buildCandidates({
      uri: 'v1',
      url_list: [
        'https://v3-web.douyinvod.com/signed-a.mp4',
        'https://v26-web.douyinvod.com/signed-b.mp4',
        'https://www.douyin.com/aweme/v1/play/?video_id=v1&file_id=FID1'
      ]
    })
    // 第一条仍是签名直链
    expect(candidates[0]).toBe('https://v3-web.douyinvod.com/signed-a.mp4')
    // 最后一条才是兜底
    expect(candidates.at(-1)).toBe('https://aweme.snssdk.com/aweme/v1/play/?video_id=v1&file_id=FID1')
    // 整个清单里 snssdk 只出现在末尾这一处
    expect(candidates.filter(url => url.includes('aweme.snssdk.com'))).toHaveLength(1)
    expect(candidates.findIndex(url => url.includes('aweme.snssdk.com'))).toBe(candidates.length - 1)
  })

  it('url_list 为空时兜底地址才成为唯一候选', () => {
    expect(buildCandidates({ uri: 'v1' })).toEqual([
      'https://aweme.snssdk.com/aweme/v1/play/?video_id=v1'
    ])
  })

  it('uri 也缺失时清单为空，不会塞进一条空串地址', () => {
    expect(buildCandidates({ url_list: [] })).toEqual([])
  })
})

describe('formatDouyinQualityLabel', () => {
  it('六个档位都有词条，480p 不印空标签', () => {
    expect(formatDouyinQualityLabel(src({ definition: '4k', sizeMB: 10 }))).toBe('超清4K')
    expect(formatDouyinQualityLabel(src({ definition: '1440p', sizeMB: 10 }))).toBe('超清2K')
    expect(formatDouyinQualityLabel(src({ definition: '1080p', sizeMB: 10 }))).toBe('高清1080P')
    expect(formatDouyinQualityLabel(src({ definition: '720p', sizeMB: 10 }))).toBe('高清720P')
    expect(formatDouyinQualityLabel(src({ definition: '540p', sizeMB: 10 }))).toBe('标清540P')
    expect(formatDouyinQualityLabel(src({ definition: '480p', sizeMB: 10 }))).toBe('标清480P')
  })

  it('档位认不出或没传源时返回空串', () => {
    expect(formatDouyinQualityLabel(src({ gear_name: 'unknown_gear', sizeMB: 10 }))).toBe('')
    expect(formatDouyinQualityLabel(undefined)).toBe('')
  })

  // 卡片写的清晰度必须来自选中那一路，否则会出现「卡片写 4K、实际下载 720p」
  it('标签跟着选档结果走，不是接口给的第一条', () => {
    const picked = douyinProcessVideos([
      src({ definition: '4k', sizeMB: 80 }),
      src({ definition: '720p', sizeMB: 20 })
    ], { videoQuality: 'adapt', filelimit: 50 })
    expect(formatDouyinQualityLabel(picked[0])).toBe('高清720P')
  })
})

describe('buildDouyinResolutionInfo', () => {
  it('宽高俱全时给出三个字段', () => {
    expect(buildDouyinResolutionInfo(withAddr({ width: 1080, height: 1920 })))
      .toEqual({ width: 1080, height: 1920, name: '高清1080P' })
  })

  // 模板那句 `{width} × {height} px` 没有守卫，缺一半会印成「1080 × undefined px」
  it('宽高缺任意一边就整块不渲染', () => {
    expect(buildDouyinResolutionInfo(withAddr({ width: 1080 }))).toBeUndefined()
    expect(buildDouyinResolutionInfo(withAddr({ height: 1920 }))).toBeUndefined()
    expect(buildDouyinResolutionInfo(undefined)).toBeUndefined()
  })

  // 第一行是档位名、第二行才是像素，只留像素会顶一行空标签在上面
  it('档位认不出时也整块不渲染', () => {
    expect(buildDouyinResolutionInfo({
      ...src({ gear_name: 'unknown_gear', sizeMB: 10 }),
      play_addr: { data_size: 10, width: 1080, height: 1920 }
    })).toBeUndefined()
  })
})

describe('isDouyinHdrStream', () => {
  it('gear_name / HDR_type / HDR_bit 三条判据各自成立', () => {
    expect(isDouyinHdrStream(src({ gear_name: 'adapt_hdr_1080_1', sizeMB: 10 }))).toBe(true)
    expect(isDouyinHdrStream({ ...src({ definition: '1080p', sizeMB: 10 }), HDR_type: '1' })).toBe(true)
    expect(isDouyinHdrStream({ ...src({ definition: '1080p', sizeMB: 10 }), HDR_bit: '10' })).toBe(true)
  })

  it('SDR 源不误判', () => {
    expect(isDouyinHdrStream(src({ definition: '1080p', sizeMB: 10 }))).toBe(false)
    expect(isDouyinHdrStream({ ...src({ definition: '1080p', sizeMB: 10 }), HDR_type: '0', HDR_bit: '8' })).toBe(false)
  })

  /*
    卡片和选源必须共用这个判据。HDR 档会被 douyinProcessVideos 排掉，所以选中的源
    通常是 SDR；只有「整个作品全是 HDR」那条放行分支才会选中 HDR 源，那时卡片要标出来。
  */
  it('选中的源与卡片的 HDR 标记一致', () => {
    const mixed = douyinProcessVideos([
      src({ definition: '1080p', sizeMB: 40, hdr: true }),
      src({ definition: '1080p', sizeMB: 36 })
    ], { videoQuality: 'adapt' })
    expect(isDouyinHdrStream(mixed[0])).toBe(false)

    const allHdr = douyinProcessVideos([
      src({ definition: '1080p', sizeMB: 40, hdr: true })
    ], { videoQuality: 'adapt' })
    expect(isDouyinHdrStream(allHdr[0])).toBe(true)
  })
})
