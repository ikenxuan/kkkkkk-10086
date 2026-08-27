import { beforeEach, describe, expect, it, vi } from 'vitest'

const getLongLink = vi.hoisted(() => vi.fn())
const getBilibiliData = vi.hoisted(() => vi.fn())
/** 记录 Networks 实际收到的 url，用来断言协议补全发生在发请求之前 */
const networksUrls = vi.hoisted(() => [] as string[])

vi.mock('../../src/module/utils/index.js', () => ({
  baseHeaders: {},
  Networks: class {
    constructor (options: { url: string }) {
      networksUrls.push(options.url)
    }

    getLongLink = getLongLink
  }
}))

vi.mock('../../src/module/platform/bilibili/api.js', () => ({
  getBilibiliData
}))

const loggerInfo = vi.fn()
const loggerWarn = vi.fn()
const loggerError = vi.fn()

globalThis.logger = {
  info: loggerInfo,
  warn: loggerWarn,
  error: loggerError,
  debug: vi.fn()
} as unknown as typeof logger

const { getBilibiliID } = await import('../../src/module/platform/bilibili/getid.js')

const convertAvToBv = vi.fn()
/** 注入替代真实 amagi 的 av -> BV 转换 */
const dependencies = { convertAvToBv }

const fetchSpy = vi.spyOn(globalThis, 'fetch')

beforeEach(() => {
  getLongLink.mockReset()
  networksUrls.length = 0
  loggerInfo.mockClear()
  loggerWarn.mockClear()
  loggerError.mockClear()
  // mockReset() 在 vitest 4 会把 spy 恢复成真实实现，所以必须紧接着装一个默认返回，
  // 否则命中 `longLink === absoluteUrl` 分支的用例会真的去请求 bilibili.com。
  // `url: ''` 等价于「没发现更终点的地址」，longLink 保持不变。
  fetchSpy.mockReset()
  fetchSpy.mockResolvedValue({ url: '' } as Response)
  convertAvToBv.mockReset()
  getBilibiliData.mockReset()
})

describe('getBilibiliID link patterns', () => {
  const cases = [
    {
      name: 'a BV video link',
      longLink: 'https://www.bilibili.com/video/BV1xx411c7mD',
      expected: { type: 'one_video', bvid: 'BV1xx411c7mD' }
    },
    {
      name: 'a BV video link with a page number',
      longLink: 'https://www.bilibili.com/video/BV1xx411c7mD?p=3',
      expected: { type: 'one_video', bvid: 'BV1xx411c7mD', p: 3 }
    },
    {
      name: 'a mobile BV video link',
      longLink: 'https://m.bilibili.com/video/BV1GJ411x7h7',
      expected: { type: 'one_video', bvid: 'BV1GJ411x7h7' }
    },
    {
      name: 'a festival activity link',
      longLink: 'https://www.bilibili.com/festival/2021bnj?bvid=BV1b5411h7ug',
      expected: { type: 'one_video', id: 'BV1b5411h7ug' }
    },
    {
      name: 'a bangumi season link',
      longLink: 'https://www.bilibili.com/bangumi/play/ss12345',
      expected: { type: 'bangumi_video_info', isEpid: false, realid: 'ss12345' }
    },
    {
      name: 'a bangumi episode link',
      longLink: 'https://www.bilibili.com/bangumi/play/ep654321',
      expected: { type: 'bangumi_video_info', isEpid: true, realid: 'ep654321' }
    },
    {
      name: 'a bare play season link as a placeholder id',
      longLink: 'https://www.bilibili.com/play/ss12345',
      expected: { type: 'bangumi_video_info', isEpid: false, realid: 'season_id' }
    },
    {
      name: 'a bare play episode link as a placeholder id',
      longLink: 'https://www.bilibili.com/play/ep654321',
      expected: { type: 'bangumi_video_info', isEpid: true, realid: 'ep_id' }
    },
    {
      name: 'a dynamic link',
      longLink: 'https://t.bilibili.com/857012345678901234',
      expected: { type: 'dynamic_info', dynamic_id: '857012345678901234' }
    },
    {
      name: 'an opus dynamic link',
      longLink: 'https://www.bilibili.com/opus/912345678901234567',
      expected: { type: 'dynamic_info', dynamic_id: '912345678901234567' }
    },
    {
      name: 'a live room link',
      longLink: 'https://live.bilibili.com/22625027',
      expected: { type: 'live_room_detail', room_id: '22625027' }
    }
  ]

  for (const { name, longLink, expected } of cases) {
    it(`recognises ${name}`, async () => {
      getLongLink.mockResolvedValue(longLink)

      expect(await getBilibiliID('https://b23.tv/share', true, dependencies)).toEqual(expected)
      expect(loggerWarn).not.toHaveBeenCalled()
    })
  }

  it('never treats a video-quick link as a video', async () => {
    getLongLink.mockResolvedValue('https://www.bilibili.com/video-quick/abcdef')

    expect(await getBilibiliID('https://b23.tv/share', true, dependencies)).toEqual({ type: 'undefined' })
  })
})

describe('getBilibiliID av conversion', () => {
  it('routes the default av conversion through the guarded Bilibili API wrapper', async () => {
    getLongLink.mockResolvedValue('https://www.bilibili.com/video/av170001')
    getBilibiliData.mockResolvedValue({ data: { data: { bvid: 'BV17x411w7KC' } } })

    const result = await getBilibiliID('https://b23.tv/share')

    expect(getBilibiliData).toHaveBeenCalledWith('AV转BV', { avid: 170001, typeMode: 'strict' })
    expect(result).toEqual({ type: 'one_video', bvid: 'BV17x411w7KC' })
  })

  it('converts an av number to a BV id', async () => {
    getLongLink.mockResolvedValue('https://www.bilibili.com/video/av170001')
    convertAvToBv.mockResolvedValue({ data: { data: { bvid: 'BV17x411w7KC' } } })

    expect(await getBilibiliID('https://b23.tv/share', true, dependencies)).toEqual({
      type: 'one_video',
      bvid: 'BV17x411w7KC'
    })
    expect(convertAvToBv).toHaveBeenCalledWith({ avid: 170001, typeMode: 'strict' })
  })

  it('converts an uppercase AV number as well', async () => {
    getLongLink.mockResolvedValue('https://www.bilibili.com/video/AV170001?p=2')
    convertAvToBv.mockResolvedValue({ data: { data: { bvid: 'BV17x411w7KC' } } })

    expect(await getBilibiliID('https://b23.tv/share', true, dependencies)).toEqual({
      type: 'one_video',
      bvid: 'BV17x411w7KC',
      p: 2
    })
    expect(convertAvToBv).toHaveBeenCalledWith({ avid: 170001, typeMode: 'strict' })
  })

  it('reports the undefined type when the conversion fails', async () => {
    getLongLink.mockResolvedValue('https://www.bilibili.com/video/av170001')
    convertAvToBv.mockRejectedValue(new Error('amagi down'))

    expect(await getBilibiliID('https://b23.tv/share', true, dependencies)).toEqual({ type: 'undefined' })
    expect(loggerError).toHaveBeenCalled()
  })
})

describe('getBilibiliID failure handling', () => {
  it('reports an empty long link without warning about the pattern', async () => {
    getLongLink.mockResolvedValue('')

    expect(await getBilibiliID('https://b23.tv/share', true, dependencies)).toEqual({ type: 'undefined' })
    expect(loggerError).toHaveBeenCalledWith('获取B站长链接失败，请稍后再试')
    expect(loggerWarn).not.toHaveBeenCalled()
  })

  it('warns when the resolved link matches no known pattern', async () => {
    getLongLink.mockResolvedValue('https://www.bilibili.com/unknown/path')

    expect(await getBilibiliID('https://b23.tv/share', true, dependencies)).toEqual({ type: 'undefined' })
    expect(loggerWarn).toHaveBeenCalledWith('[B站链接] 无法识别的链接:', 'https://www.bilibili.com/unknown/path')
  })

  it('follows a redirect when the long link equals the input url', async () => {
    const url = 'https://b23.tv/redirect-me'
    getLongLink.mockResolvedValue(url)
    fetchSpy.mockResolvedValue({ url: 'https://www.bilibili.com/video/BV1redirect' } as Response)

    expect(await getBilibiliID(url, true, dependencies)).toEqual({
      type: 'one_video',
      bvid: 'BV1redirect'
    })
    expect(fetchSpy).toHaveBeenCalledWith(url, { redirect: 'follow' })
  })

  it('returns the undefined type when resolving throws', async () => {
    getLongLink.mockRejectedValue(new Error('network down'))

    expect(await getBilibiliID('https://b23.tv/share', true, dependencies)).toEqual({ type: 'undefined' })
    expect(loggerError).toHaveBeenCalledTimes(1)
  })

  it('returns the undefined type for a value that is not a url', async () => {
    getLongLink.mockResolvedValue('definitely not a url')

    expect(await getBilibiliID('https://b23.tv/share', true, dependencies)).toEqual({ type: 'undefined' })
  })

  it('stays silent when logging is disabled', async () => {
    getLongLink.mockResolvedValue('https://www.bilibili.com/video/BV1silent')

    await getBilibiliID('https://b23.tv/share', false, dependencies)

    expect(loggerInfo).not.toHaveBeenCalled()
    expect(loggerWarn).not.toHaveBeenCalled()
  })
})

describe('getBilibiliID scheme-less links', () => {
  // `src/apps/tools.ts` 的提取正则把 `https?://` 写成可选，所以裸域名会原样传进来。
  // 补协议必须发生在发请求之前，否则 axios 白跑三次重试、`new URL()` 再抛 Invalid URL。
  const bareCases = [
    ['www.bilibili.com/video/BV1xx411c7mD', 'https://www.bilibili.com/video/BV1xx411c7mD'],
    ['m.bilibili.com/video/BV1GJ411x7h7', 'https://m.bilibili.com/video/BV1GJ411x7h7'],
    ['bili2233.cn/abc123', 'https://bili2233.cn/abc123'],
    ['t.bilibili.com/857012345678901234', 'https://t.bilibili.com/857012345678901234']
  ]

  for (const [bare, absolute] of bareCases) {
    it(`prefixes https:// before requesting ${bare}`, async () => {
      getLongLink.mockResolvedValue(absolute)

      await getBilibiliID(bare as string, true, dependencies)

      expect(networksUrls).toEqual([absolute])
    })
  }

  it('keeps an existing scheme untouched, http included', async () => {
    getLongLink.mockResolvedValue('http://www.bilibili.com/video/BV1xx411c7mD')

    await getBilibiliID('http://www.bilibili.com/video/BV1xx411c7mD', true, dependencies)

    expect(networksUrls).toEqual(['http://www.bilibili.com/video/BV1xx411c7mD'])
  })

  it('resolves a scheme-less video link to its bvid', async () => {
    getLongLink.mockResolvedValue('https://www.bilibili.com/video/BV1xx411c7mD')

    expect(await getBilibiliID('www.bilibili.com/video/BV1xx411c7mD', true, dependencies)).toEqual({
      type: 'one_video',
      bvid: 'BV1xx411c7mD'
    })
    expect(loggerWarn).not.toHaveBeenCalled()
  })

  it('resolves a scheme-less dynamic link, which needs hostname parsing', async () => {
    getLongLink.mockResolvedValue('https://t.bilibili.com/857012345678901234')

    expect(await getBilibiliID('t.bilibili.com/857012345678901234', true, dependencies)).toEqual({
      type: 'dynamic_info',
      dynamic_id: '857012345678901234'
    })
  })

  it('still runs the redirect fallback for a bare input, comparing against the normalized url', async () => {
    // getLongLink 回显了传进去的地址，等于「没跟到重定向」，此时才 fetch 一次兜底。
    // 拿原始裸域名去比，这个条件对裸输入永远不成立 —— 兜底会被静默跳过。
    getLongLink.mockResolvedValue('https://www.bilibili.com/video/BV1xx411c7mD')
    fetchSpy.mockResolvedValue({ url: 'https://www.bilibili.com/video/BV1redirected' } as Response)

    expect(await getBilibiliID('www.bilibili.com/video/BV1xx411c7mD', true, dependencies)).toEqual({
      type: 'one_video',
      bvid: 'BV1redirected'
    })
    expect(fetchSpy).toHaveBeenCalledWith('https://www.bilibili.com/video/BV1xx411c7mD', { redirect: 'follow' })
  })

  it('strips leading slashes from a protocol-relative link', async () => {
    getLongLink.mockResolvedValue('https://www.bilibili.com/video/BV1xx411c7mD')

    await getBilibiliID('//www.bilibili.com/video/BV1xx411c7mD', true, dependencies)

    expect(networksUrls).toEqual(['https://www.bilibili.com/video/BV1xx411c7mD'])
  })

  it('passes an empty input through without inventing a host', async () => {
    getLongLink.mockResolvedValue('')

    expect(await getBilibiliID('', true, dependencies)).toEqual({ type: 'undefined' })
    expect(networksUrls).toEqual([''])
  })
})

describe('getBilibiliID malformed long links', () => {
  // 长链接是网络返回的，不在本模块控制内。匹配函数里裸调 `new URL()` 时，
  // test() 抛异常会中断整张模式表，把排在后面的类型一起废掉。
  it('still recognises a live room after a malformed link would have thrown', async () => {
    getLongLink.mockResolvedValue('live.bilibili.com/22625027')

    expect(await getBilibiliID('live.bilibili.com/22625027', true, dependencies)).toEqual({
      type: 'live_room_detail',
      room_id: '22625027'
    })
  })

  it('falls back to a regex for the page number when the url will not parse', async () => {
    // getLongLink 直接回一条解析不了的地址：仍然要拿到 bvid 和分P，不能整条丢掉
    getLongLink.mockResolvedValue('https://bilibili.com:port/video/BV1xx411c7mD?p=4')

    expect(await getBilibiliID('https://b23.tv/share', true, dependencies)).toEqual({
      type: 'one_video',
      bvid: 'BV1xx411c7mD',
      p: 4
    })
  })

  it('reports the undefined type instead of throwing on a malformed dynamic link', async () => {
    getLongLink.mockResolvedValue('https://bilibili.com:port/opus/912345678901234567')

    expect(await getBilibiliID('https://b23.tv/share', true, dependencies)).toEqual({ type: 'undefined' })
    expect(loggerError).not.toHaveBeenCalled()
  })
})
