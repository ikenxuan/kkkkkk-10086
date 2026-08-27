import { beforeEach, describe, expect, it, vi } from 'vitest'

const shouldFilterMock = vi.hoisted(() => vi.fn())

vi.mock('../../src/module/utils/index.js', () => ({
  Base: class {
    e: unknown
    headers: Record<string, string> = {}
  },
  baseHeaders: {},
  Networks: class {},
  Render: vi.fn(),
  Config: { cookies: {}, douyin: {}, pushlist: {}, app: {}, upload: {} },
  Common: { tempDri: { images: '', video: '' } },
  downloadFile: vi.fn(),
  downloadVideo: vi.fn(),
  Version: { BotName: 'TRSS-Yunzai', version: 'test', pluginName: 'kkkkkk-10086' },
  processImageUrl: vi.fn()
}))

vi.mock('../../src/module/db/index.js', () => ({
  cleanOldDynamicCache: vi.fn(),
  douyinDB: { shouldFilter: shouldFilterMock }
}))

vi.mock('../../src/module/platform/douyin/index.js', () => ({
  getDouyinID: vi.fn(),
  douyinProcessVideos: vi.fn()
}))

vi.mock('../../src/module/platform/common/livePhoto.js', () => ({
  buildLivePhotoMessages: vi.fn(),
  // 批量入口的默认返回：results 为空 => 每张图都走普通图片回退分支。
  buildLivePhotoMessagesBatch: vi.fn(async () => ({ results: [], tempFiles: [], generatedLivePhoto: false })),
  buildLivePhotoTipMessage: vi.fn()
}))

vi.mock('../../src/runtime/host/common.js', () => ({
  default: { makeForwardMsg: vi.fn() }
}))

globalThis.logger = {
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  mark: vi.fn()
} as unknown as typeof logger

const {
  normalizePushTypes,
  getDouyinMusicUrl,
  getDouyinLiveVideoUrl,
  skipDynamic
} = await import('../../src/module/platform/douyin/push.js')

beforeEach(() => {
  shouldFilterMock.mockReset()
  shouldFilterMock.mockResolvedValue(false)
})

describe('normalizePushTypes', () => {
  const cases = [
    { name: 'an undefined list', input: undefined, expected: ['post', 'live'] },
    { name: 'an empty list', input: [], expected: ['post', 'live'] },
    { name: 'a non-array value', input: 'post', expected: ['post', 'live'] },
    { name: 'a list of only invalid types', input: ['unknown', 'bogus'], expected: ['post', 'live'] },
    { name: 'a valid list', input: ['favorite', 'recommend'], expected: ['favorite', 'recommend'] },
    { name: 'duplicated entries', input: ['post', 'post', 'live'], expected: ['post', 'live'] },
    { name: 'a mix of valid and invalid types', input: ['post', 'nope', 'recommend'], expected: ['post', 'recommend'] }
  ]

  for (const { name, input, expected } of cases) {
    it(`normalizes ${name}`, () => {
      expect(normalizePushTypes(input as never)).toEqual(expected)
    })
  }

  it('returns a fresh array so callers cannot mutate the defaults', () => {
    const first = normalizePushTypes(undefined as never)
    first.push('favorite' as never)

    expect(normalizePushTypes(undefined as never)).toEqual(['post', 'live'])
  })
})

describe('getDouyinMusicUrl', () => {
  it('prefers the direct play url', () => {
    expect(getDouyinMusicUrl({ play_url: { uri: 'https://example.com/song.mp3' } })).toBe('https://example.com/song.mp3')
  })

  it('falls back to the original song url inside extra', () => {
    expect(getDouyinMusicUrl({
      extra: JSON.stringify({ original_song_url: 'https://example.com/original.mp3' })
    })).toBe('https://example.com/original.mp3')
  })

  it('returns an empty string for malformed extra json', () => {
    expect(getDouyinMusicUrl({ extra: '{not json' })).toBe('')
  })

  it('returns an empty string when there is no music', () => {
    expect(getDouyinMusicUrl(undefined)).toBe('')
    expect(getDouyinMusicUrl({})).toBe('')
  })
})

describe('getDouyinLiveVideoUrl', () => {
  it('prefers the h264 play address', () => {
    expect(getDouyinLiveVideoUrl({
      video: { play_addr_h264: { uri: 'h264-uri' }, play_addr: { uri: 'plain-uri' } }
    })).toBe('https://aweme.snssdk.com/aweme/v1/play/?video_id=h264-uri&ratio=1080p&line=0')
  })

  it('falls back to the plain play address', () => {
    expect(getDouyinLiveVideoUrl({ video: { play_addr: { uri: 'plain-uri' } } }))
      .toBe('https://aweme.snssdk.com/aweme/v1/play/?video_id=plain-uri&ratio=1080p&line=0')
  })

  it('returns an empty string when no play address exists', () => {
    expect(getDouyinLiveVideoUrl(undefined)).toBe('')
    expect(getDouyinLiveVideoUrl({ video: {} })).toBe('')
  })
})

describe('skipDynamic', () => {
  it('never skips a live status item', async () => {
    expect(await skipDynamic({
      Detail_Data: { liveStatus: { liveStatus: 'open', isChanged: true, isliving: true } }
    } as never)).toBe(false)
    expect(shouldFilterMock).not.toHaveBeenCalled()
  })

  it('forwards the extracted hashtags to the database filter', async () => {
    const pushItem = {
      Detail_Data: {
        share_url: 'https://www.douyin.com/video/1',
        text_extra: [
          { hashtag_name: '标签一' },
          { hashtag_name: '' },
          { other: 'no hashtag' },
          { hashtag_name: '标签二' }
        ]
      }
    }

    expect(await skipDynamic(pushItem as never)).toBe(false)
    expect(shouldFilterMock).toHaveBeenCalledWith(pushItem, ['标签一', '标签二'])
  })

  it('passes an empty tag list when the work has no text_extra', async () => {
    await skipDynamic({ Detail_Data: { share_url: 'https://www.douyin.com/video/2' } } as never)

    expect(shouldFilterMock).toHaveBeenCalledWith(expect.anything(), [])
  })

  it('returns the database verdict', async () => {
    shouldFilterMock.mockResolvedValue(true)

    expect(await skipDynamic({ Detail_Data: { share_url: 'https://www.douyin.com/video/3' } } as never)).toBe(true)
  })
})
