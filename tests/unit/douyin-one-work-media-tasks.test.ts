import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  burnDouyinDanmaku: vi.fn(),
  legacyBurnDanmaku: vi.fn(),
  douyinComments: vi.fn(),
  downloadFile: vi.fn(),
  downloadVideo: vi.fn(),
  getDouyinData: vi.fn(),
  processImageUrl: vi.fn(),
  render: vi.fn(),
  uploadFile: vi.fn(),
  config: {
    getConfig: vi.fn(() => ({ sendContent: ['info', 'comment', 'video'] })),
    app: {
      parseTip: false,
      removeCache: true,
      groupfilevalue: 100
    },
    cookies: { douyin: '' },
    douyin: {
      autoResolution: false,
      burnDanmaku: true,
      danmakuArea: 0.5,
      danmakuFontSize: 'medium',
      danmakuOpacity: 100,
      displayContent: ['cover'],
      douyinTip: [] as string[],
      numcomments: 1,
      sendContent: ['info', 'comment', 'video'],
      sendHDrecord: true,
      videoCodec: 'h264',
      videoInfoMode: 'text',
      verticalMode: 'off'
    },
    upload: { filelimit: 100 }
  }
}))

vi.mock('../../src/module/utils/index.js', () => {
  class Base {
    e: Record<string, unknown>
    headers: Record<string, string> = {}
    amagi = { getDouyinData: mocks.getDouyinData }

    constructor (event: Record<string, unknown>) {
      this.e = event
    }
  }

  class Networks {
    async getLongLink (): Promise<string> {
      return 'https://example.com/video.mp4'
    }
  }

  return {
    Base,
    Common: {
      count: (value: unknown) => String(value ?? 0),
      convertTimestampToDateTime: () => '2026-08-18 12:00:00',
      getVideoFileSize: vi.fn(async () => 1),
      removeFile: vi.fn(async () => undefined),
      tempDri: { images: '', video: 'tmp/' }
    },
    Config: mocks.config,
    Networks,
    Render: mocks.render,
    UploadRecord: vi.fn(),
    baseHeaders: {},
    downloadFile: mocks.downloadFile,
    downloadVideo: mocks.downloadVideo,
    processImageUrl: mocks.processImageUrl,
    uploadFile: mocks.uploadFile
  }
})

vi.mock('../../src/module/platform/douyin/danmaku.js', () => ({
  burnDouyinDanmaku: mocks.burnDouyinDanmaku
}))

vi.mock('../../src/module/platform/common/danmaku.js', () => ({
  burnDanmaku: mocks.legacyBurnDanmaku
}))

vi.mock('../../src/module/platform/common/livePhoto.js', () => ({
  buildLivePhotoMessages: vi.fn(),
  buildLivePhotoTipMessage: vi.fn()
}))

vi.mock('../../src/module/platform/douyin/index.js', () => ({
  douyinComments: mocks.douyinComments
}))

vi.mock('../../src/module/platform/douyin/workType.js', () => ({
  getDouyinWorkCoverUrl: vi.fn(() => 'https://example.com/cover.jpg'),
  isDouyinArticle: vi.fn(() => false),
  isDouyinVideo: vi.fn(() => true),
  parseJsonSafely: vi.fn(() => ({}))
}))

vi.mock('../../src/runtime/host/common.js', () => ({
  default: { makeForwardMsg: vi.fn() }
}))

vi.mock('@karinjs/md-html', () => ({
  markdown: vi.fn((value: string) => value)
}))

import { DouYin } from '../../src/module/platform/douyin/douyin.js'

const workResponse = {
  data: {
    aweme_detail: {
      author: {
        avatar_larger: { url_list: ['https://example.com/avatar.jpg'] },
        avatar_thumb: { url_list: ['https://example.com/avatar.jpg'] },
        nickname: 'tester',
        sec_uid: 'sec-1',
        short_id: 'tester'
      },
      aweme_id: 'work-1',
      create_time: 1_700_000_000,
      desc: 'video description',
      preview_title: 'video title',
      share_url: 'https://www.douyin.com/video/work-1',
      statistics: {
        collect_count: 1,
        comment_count: 2,
        digg_count: 3,
        share_count: 4
      },
      video: {
        bit_rate: [{
          FPS: 60,
          format: 'mp4',
          play_addr: {
            data_size: 1024,
            url_list: ['https://example.com/video.mp4']
          }
        }],
        cover: { url_list: ['https://example.com/cover.jpg'] },
        duration: 10_000,
        height: 1920,
        play_addr: {
          data_size: 1024,
          uri: 'video-uri',
          url_list: ['https://example.com/video.mp4']
        },
        play_addr_h264: {
          data_size: 1024,
          uri: 'video-uri',
          url_list: [
            'https://example.com/video.mp4',
            'https://example.com/video.mp4',
            'https://example.com/video.mp4'
          ]
        },
        ratio: '1080p',
        width: 1080
      }
    }
  }
}

const emojiResponse = {
  data: {
    emoji_list: [{
      display_name: '[笑哭]',
      emoji_url: { url_list: ['https://example.com/laugh.png'] }
    }]
  }
}

const danmakuList = [{
  danmaku_id: 'dm-1',
  digg_count: 8,
  offset_time: 1000,
  text: '开场[笑哭]'
}]

describe('Douyin one_work media tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('logger', {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      mark: vi.fn(),
      warn: vi.fn(),
      green: (value: unknown) => String(value),
      yellow: (value: unknown) => String(value)
    })
    vi.stubGlobal('segment', {
      image: vi.fn((url: string) => ({ type: 'image', url }))
    })

    mocks.config.getConfig.mockReturnValue({ sendContent: mocks.config.douyin.sendContent })
    mocks.config.douyin.sendContent = ['info', 'comment', 'video']
    mocks.getDouyinData.mockImplementation(async (method: string) => {
      if (method === '聚合解析') return workResponse
      if (method === '评论数据') return { data: { comments: [] } }
      if (method === '弹幕数据') return { data: { danmaku_list: danmakuList } }
      if (method === 'Emoji数据') return emojiResponse
      throw new Error(`Unexpected Douyin API method: ${method}`)
    })
    mocks.downloadFile.mockResolvedValue({ filepath: 'tmp/input.mp4' })
    mocks.downloadVideo.mockResolvedValue(undefined)
    mocks.processImageUrl.mockResolvedValue('processed-cover')
    mocks.render.mockResolvedValue('rendered-comment')
    mocks.douyinComments.mockResolvedValue({ jsonArray: [{ id: 'comment-1' }] })
    mocks.burnDouyinDanmaku.mockResolvedValue(false)
    mocks.legacyBurnDanmaku.mockResolvedValue(false)
  })

  it('shares one emoji lookup between danmaku burning and comment rendering, then falls back to the original video', async () => {
    const reply = vi.fn(async () => undefined)
    const parser = new DouYin({ reply }, { type: 'one_work', aweme_id: 'work-1', is_mp4: true }, { forceBurnDanmaku: true })

    await expect(parser.RESOURCES({ type: 'one_work', aweme_id: 'work-1', is_mp4: true })).resolves.toBe(true)

    expect(mocks.burnDouyinDanmaku).toHaveBeenCalledOnce()
    expect(mocks.legacyBurnDanmaku).not.toHaveBeenCalled()
    expect(mocks.downloadVideo).toHaveBeenCalledOnce()

    const emojiCalls = mocks.getDouyinData.mock.calls.filter(([method]) => method === 'Emoji数据')
    expect(emojiCalls).toHaveLength(1)

    const burnOptions = mocks.burnDouyinDanmaku.mock.calls[0]?.[3] as { emojiList?: unknown }
    expect(burnOptions.emojiList).toEqual([
      { name: '[笑哭]', url: 'https://example.com/laugh.png' }
    ])
    expect(mocks.douyinComments.mock.calls[0]?.[1]).toBe(burnOptions.emojiList)
  })

  it('falls back to the original video when the danmaku burner throws', async () => {
    mocks.burnDouyinDanmaku.mockRejectedValueOnce(new Error('ffmpeg failed'))
    const parser = new DouYin(
      { reply: vi.fn(async () => undefined) },
      { type: 'one_work', aweme_id: 'work-1', is_mp4: true },
      { forceBurnDanmaku: true }
    )

    await expect(parser.RESOURCES({ type: 'one_work', aweme_id: 'work-1', is_mp4: true })).resolves.toBe(true)

    expect(mocks.downloadVideo).toHaveBeenCalledOnce()
  })

  it('falls back to the original video when uploading the burned result throws', async () => {
    mocks.burnDouyinDanmaku.mockResolvedValueOnce(true)
    mocks.uploadFile.mockRejectedValueOnce(new Error('upload failed'))
    const parser = new DouYin(
      { reply: vi.fn(async () => undefined) },
      { type: 'one_work', aweme_id: 'work-1', is_mp4: true },
      { forceBurnDanmaku: true }
    )

    await expect(parser.RESOURCES({ type: 'one_work', aweme_id: 'work-1', is_mp4: true })).resolves.toBe(true)

    expect(mocks.downloadVideo).toHaveBeenCalledOnce()
  })

  it('falls back to the original video when the temporary burn download throws', async () => {
    mocks.downloadFile.mockRejectedValueOnce(new Error('temporary download failed'))
    const parser = new DouYin(
      { reply: vi.fn(async () => undefined) },
      { type: 'one_work', aweme_id: 'work-1', is_mp4: true },
      { forceBurnDanmaku: true }
    )

    await expect(parser.RESOURCES({ type: 'one_work', aweme_id: 'work-1', is_mp4: true })).resolves.toBe(true)

    expect(mocks.downloadVideo).toHaveBeenCalledOnce()
  })
})
