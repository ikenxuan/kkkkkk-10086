import { beforeEach, describe, expect, it, vi } from 'vitest'

const getLongLink = vi.hoisted(() => vi.fn())

vi.mock('../../src/module/utils/index.js', () => ({
  baseHeaders: {},
  Networks: class {
    getLongLink = getLongLink
  }
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

const { getDouyinID } = await import('../../src/module/platform/douyin/getid.js')

const fetchSpy = vi.spyOn(globalThis, 'fetch')

beforeEach(() => {
  getLongLink.mockReset()
  loggerInfo.mockClear()
  loggerWarn.mockClear()
  loggerError.mockClear()
  fetchSpy.mockReset()
})

describe('getDouyinID link patterns', () => {
  const cases = [
    {
      name: 'a webcast live room share link',
      longLink: 'https://webcast.amemv.com/webcast/reflow/123?sec_user_id=MS4wLjABAAAA&other=1',
      expected: { type: 'live_room_detail', sec_uid: 'MS4wLjABAAAA' }
    },
    {
      name: 'a direct live room link',
      longLink: 'https://live.douyin.com/987654321',
      expected: { type: 'live_room_detail', room_id: '987654321' }
    },
    {
      name: 'a video work link',
      longLink: 'https://www.douyin.com/video/7412345678901234567',
      expected: { type: 'one_work', aweme_id: '7412345678901234567' }
    },
    {
      name: 'a note work link',
      longLink: 'https://www.douyin.com/note/7412345678901234568',
      expected: { type: 'one_work', aweme_id: '7412345678901234568' }
    },
    {
      name: 'a slides work link',
      longLink: 'https://www.douyin.com/slides/7412345678901234569',
      expected: { type: 'one_work', aweme_id: '7412345678901234569', is_mp4: false }
    },
    {
      name: 'a modal id link',
      longLink: 'https://www.douyin.com/discover?modal_id=7412345678901234570',
      expected: { type: 'one_work', aweme_id: '7412345678901234570', is_mp4: true }
    },
    {
      name: 'a user profile link',
      longLink: 'https://www.douyin.com/user/MS4wLjABAAAAuser-id_1',
      expected: { type: 'user_dynamic', sec_uid: 'MS4wLjABAAAAuser-id_1' }
    },
    {
      name: 'a share user profile link',
      longLink: 'https://www.iesdouyin.com/share/user/MS4wLjABAAAAshared',
      expected: { type: 'user_dynamic', sec_uid: 'MS4wLjABAAAAshared' }
    },
    {
      name: 'a music work link',
      longLink: 'https://www.douyin.com/music/7412345678901234571',
      expected: { type: 'music_work', music_id: '7412345678901234571' }
    }
  ]

  for (const { name, longLink, expected } of cases) {
    it(`recognises ${name}`, async () => {
      getLongLink.mockResolvedValue(longLink)

      expect(await getDouyinID('https://v.douyin.com/share')).toEqual(expected)
      expect(loggerWarn).not.toHaveBeenCalled()
    })
  }

  it('matches the video pattern before the modal pattern', async () => {
    getLongLink.mockResolvedValue('https://www.douyin.com/video/111?modal_id=222')

    expect(await getDouyinID('https://v.douyin.com/share')).toEqual({
      type: 'one_work',
      aweme_id: '111'
    })
  })
})

describe('getDouyinID failure handling', () => {
  it('reports an empty long link without warning about the pattern', async () => {
    getLongLink.mockResolvedValue('')

    expect(await getDouyinID('https://v.douyin.com/share')).toEqual({ type: 'undefined' })
    expect(loggerError).toHaveBeenCalledWith('获取抖音长链接失败，请稍后再试')
    expect(loggerWarn).not.toHaveBeenCalled()
  })

  it('warns when the resolved link matches no known pattern', async () => {
    getLongLink.mockResolvedValue('https://www.douyin.com/unknown/path')

    expect(await getDouyinID('https://v.douyin.com/share')).toEqual({ type: 'undefined' })
    expect(loggerWarn).toHaveBeenCalledWith('[抖音链接] 无法识别的链接: https://www.douyin.com/unknown/path')
  })

  it('follows a redirect when the long link equals the input url', async () => {
    const url = 'https://www.douyin.com/redirect-me'
    getLongLink.mockResolvedValue(url)
    fetchSpy.mockResolvedValue({ url: 'https://www.douyin.com/video/7000000000000000001' } as Response)

    expect(await getDouyinID(url)).toEqual({
      type: 'one_work',
      aweme_id: '7000000000000000001'
    })
    expect(fetchSpy).toHaveBeenCalledWith(url, { redirect: 'follow' })
  })

  it('returns the undefined type when resolving throws', async () => {
    getLongLink.mockRejectedValue(new Error('network down'))

    expect(await getDouyinID('https://v.douyin.com/share')).toEqual({ type: 'undefined' })
    expect(loggerError).toHaveBeenCalledTimes(1)
  })

  it('stays silent when logging is disabled', async () => {
    getLongLink.mockResolvedValue('https://www.douyin.com/video/7000000000000000002')

    await getDouyinID('https://v.douyin.com/share', false)

    expect(loggerInfo).not.toHaveBeenCalled()
  })
})
