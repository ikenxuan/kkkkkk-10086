import { beforeEach, describe, expect, it, vi } from 'vitest'

const getLongLink = vi.hoisted(() => vi.fn())
const getBilibiliData = vi.hoisted(() => vi.fn())

vi.mock('../../src/module/utils/index.js', () => ({
  baseHeaders: {},
  Networks: class {
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
  loggerInfo.mockClear()
  loggerWarn.mockClear()
  loggerError.mockClear()
  fetchSpy.mockReset()
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
