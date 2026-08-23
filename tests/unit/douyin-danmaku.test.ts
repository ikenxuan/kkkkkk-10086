import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'

const screenshotMock = vi.hoisted(() => vi.fn())
const screenshotFileMock = vi.hoisted(() => vi.fn())

vi.mock('../../src/runtime/host/puppeteer.js', () => ({
  default: {
    screenshot: screenshotMock,
    screenshots: vi.fn(),
    screenshotFile: screenshotFileMock,
    screenshotsFile: vi.fn()
  }
}))

// burnDouyinDanmaku 的失败分支现在会记日志再降级，所以这个文件也得和其余 26 个用例文件
// 一样先把全局 logger 补上，否则 catch 块自己抛 ReferenceError，把「退回无弹幕原视频」
// 的优雅降级变成硬失败。
globalThis.logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  mark: vi.fn(),
  blue: (value: string) => value,
  green: (value: string) => value,
  magenta: (value: string) => value,
  cyan: (value: string) => value,
  yellow: (value: string) => value,
  red: (value: string) => value
} as unknown as typeof logger

import {
  buildDouyinFfmpegPlan,
  burnDouyinDanmaku,
  fetchDouyinEmojiList,
  formatLikeCount,
  generateDouyinASS,
  selectLikedDanmaku,
  splitDanmakuSegments,
  type DanmakuOverlay,
  type DouyinCommandOptions,
  type DouyinDanmakuElem,
  type DouyinEmojiInfo,
  type DouyinStripRenderRequest
} from '../../src/module/platform/douyin/danmaku.js'

const temporaryDirectories: string[] = []

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'kkkkkk-douyin-danmaku-'))
  temporaryDirectories.push(directory)
  return directory
}

const createPng = (width: number, height: number): Buffer => {
  const png = Buffer.alloc(24)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png)
  png.writeUInt32BE(width, 16)
  png.writeUInt32BE(height, 20)
  return png
}

const makeDanmaku = (
  danmakuId: string,
  diggCount?: number,
  text = danmakuId,
  offsetTime = 0
): DouyinDanmakuElem => ({
  danmaku_id: danmakuId,
  offset_time: offsetTime,
  text,
  ...(diggCount === undefined ? {} : { digg_count: diggCount })
})

const emojiList: DouyinEmojiInfo[] = [
  { name: '[抱抱你]', url: 'https://emoji.example/hug-long.png' },
  { name: '[笑哭]', url: 'https://emoji.example/laugh.png' },
  { name: '[抱抱]', url: 'https://emoji.example/hug.png' }
]

afterEach(async () => {
  screenshotMock.mockReset()
  screenshotFileMock.mockReset()
  vi.restoreAllMocks()
  await Promise.all(temporaryDirectories.splice(0).map(async directory => {
    await rm(directory, { recursive: true, force: true })
  }))
})

describe('formatLikeCount', () => {
  it.each([
    [0, '0'],
    [14, '14'],
    [9999, '9999']
  ])('keeps a sub-threshold like count %d as %s', (count, expected) => {
    expect(formatLikeCount(count)).toBe(expected)
  })

  it.each([
    [10000, '1.0w'],
    [24800, '2.4w'],
    [24999, '2.4w'],
    [1001900, '100.1w']
  ])('truncates the ten-thousand unit for %d instead of rounding it up', (count, expected) => {
    expect(formatLikeCount(count)).toBe(expected)
  })
})

describe('splitDanmakuSegments', () => {
  it('preserves the order of mixed text and emoji placeholders', () => {
    expect(splitDanmakuSegments('开场[抱抱你]中间[笑哭]结尾', emojiList)).toEqual([
      { type: 'text', content: '开场' },
      { type: 'emoji', name: '[抱抱你]', url: 'https://emoji.example/hug-long.png' },
      { type: 'text', content: '中间' },
      { type: 'emoji', name: '[笑哭]', url: 'https://emoji.example/laugh.png' },
      { type: 'text', content: '结尾' }
    ])
  })

  it('prefers a longer placeholder even when emoji definitions are unsorted', () => {
    const shortPrefix = { name: '[抱抱', url: 'https://emoji.example/hug-prefix.png' }
    expect(splitDanmakuSegments('[抱抱你]', [shortPrefix, emojiList[0]])).toEqual([
      { type: 'emoji', name: '[抱抱你]', url: 'https://emoji.example/hug-long.png' }
    ])
  })

  it('does not emit empty text segments around adjacent emoji placeholders', () => {
    expect(splitDanmakuSegments('[笑哭][抱抱]未收录[未知]', emojiList)).toEqual([
      { type: 'emoji', name: '[笑哭]', url: 'https://emoji.example/laugh.png' },
      { type: 'emoji', name: '[抱抱]', url: 'https://emoji.example/hug.png' },
      { type: 'text', content: '未收录[未知]' }
    ])
  })

  it('falls back to one plain-text segment when no emoji definitions are available', () => {
    expect(splitDanmakuSegments('文字[笑哭]', [])).toEqual([
      { type: 'text', content: '文字[笑哭]' }
    ])
  })
})

describe('selectLikedDanmaku', () => {
  it('returns an empty selection when no danmaku has a positive like count', () => {
    const selection = selectLikedDanmaku([
      makeDanmaku('missing'),
      makeDanmaku('zero', 0),
      makeDanmaku('negative', -1)
    ])

    expect(selection).toEqual({
      ids: new Set(),
      candidateCount: 0,
      target: 5
    })
  })

  it('selects every positive candidate when the candidate count is within the target', () => {
    const selection = selectLikedDanmaku([
      makeDanmaku('first', 1),
      makeDanmaku('ignored', 0),
      makeDanmaku('second', 8)
    ])

    expect(selection).toEqual({
      ids: new Set(['first', 'second']),
      candidateCount: 2,
      target: 5
    })
  })

  it('scales the target with total volume, selects the most-liked entries, and keeps input order intact', () => {
    const danmaku = Array.from({ length: 100 }, (_, index) => makeDanmaku(`dm-${index}`, index + 1))
    const originalOrder = danmaku.map(item => item.danmaku_id)

    const selection = selectLikedDanmaku(danmaku)

    expect(selection.target).toBe(15)
    expect(selection.candidateCount).toBe(100)
    expect(selection.ids).toEqual(new Set(Array.from({ length: 15 }, (_, index) => `dm-${index + 85}`)))
    expect(danmaku.map(item => item.danmaku_id)).toEqual(originalOrder)
  })

  it('keeps all candidates tied at the target cutoff', () => {
    const selection = selectLikedDanmaku([
      makeDanmaku('nine', 9),
      makeDanmaku('eight', 8),
      makeDanmaku('seven', 7),
      makeDanmaku('six', 6),
      makeDanmaku('five-a', 5),
      makeDanmaku('five-b', 5),
      makeDanmaku('zero-a', 0),
      makeDanmaku('zero-b', 0),
      makeDanmaku('zero-c', 0)
    ])

    expect(selection.target).toBe(5)
    expect(selection.candidateCount).toBe(6)
    expect(selection.ids).toEqual(new Set(['nine', 'eight', 'seven', 'six', 'five-a', 'five-b']))
  })
})

describe('fetchDouyinEmojiList', () => {
  it('normalizes the upstream response, filters invalid rows, and sorts longer names first', async () => {
    const result = await fetchDouyinEmojiList(async () => ({
      data: {
        emoji_list: [
          { display_name: '[抱抱]', emoji_url: { url_list: ['https://emoji.example/hug.png'] } },
          { display_name: '', emoji_url: { url_list: ['https://emoji.example/invalid.png'] } },
          { display_name: '[抱抱你]', emoji_url: { url_list: ['https://emoji.example/hug-long.png'] } },
          { display_name: '[无图]', emoji_url: { url_list: [] } }
        ]
      }
    }))

    expect(result).toEqual([
      { name: '[抱抱你]', url: 'https://emoji.example/hug-long.png' },
      { name: '[抱抱]', url: 'https://emoji.example/hug.png' }
    ])
  })

  it('returns an empty list when no integration fetcher exists or the injected request fails', async () => {
    expect(await fetchDouyinEmojiList()).toEqual([])
    expect(await fetchDouyinEmojiList(async () => {
      throw new Error('offline')
    })).toEqual([])
  })
})

describe('generateDouyinASS', () => {
  it('routes the default strip renderer through the static-file Puppeteer API', async () => {
    const tempDir = await createTemporaryDirectory()
    screenshotFileMock.mockResolvedValue(createPng(64, 20))

    const result = await generateDouyinASS([
      makeDanmaku('default-renderer', 0, '默认[笑哭]')
    ], 1080, 1920, {
      tempDir,
      emojiList
    })

    expect(screenshotMock).not.toHaveBeenCalled()
    expect(screenshotFileMock).toHaveBeenCalledWith(
      'kkkkkk-10086/douyin/danmaku-strip',
      expect.stringMatching(/douyin_danmaku_.*\.html$/),
      expect.objectContaining({
        saveId: expect.stringMatching(/^douyin_danmaku_.*$/),
        imgType: 'png',
        omitBackground: true,
        pageGotoParams: { waitUntil: 'networkidle0', timeout: 15000 }
      })
    )
    expect(screenshotFileMock.mock.calls[0]?.[2]).not.toHaveProperty('tplFile')
    expect(result.overlays).toHaveLength(1)
  })

  it('renders emoji strips, reads PNG dimensions, and reuses one render for identical content', async () => {
    const tempDir = await createTemporaryDirectory()
    const renderStrip = vi.fn(async (_request: DouyinStripRenderRequest) => createPng(321, 45))

    const result = await generateDouyinASS([
      makeDanmaku('emoji-1', 0, '相同[笑哭]', 0),
      makeDanmaku('emoji-2', 0, '相同[笑哭]', 2000)
    ], 1080, 1920, {
      tempDir,
      emojiFetcher: async () => emojiList,
      renderStrip
    })

    expect(renderStrip).toHaveBeenCalledTimes(1)
    expect(renderStrip.mock.calls[0]?.[0]).toMatchObject({
      text: '相同[笑哭]',
      likeLabel: null
    })
    expect(renderStrip.mock.calls[0]?.[0].html).toContain('https://emoji.example/laugh.png')
    expect(result.overlays).toHaveLength(2)
    expect(result.overlays[0]).toMatchObject({ width: 321, height: 45, moveW: 321 })
    expect(result.overlays[1]?.pngPath).toBe(result.overlays[0]?.pngPath)
    expect(result.stats).toMatchObject({ likedOverlays: 0, emojiOverlays: 2 })
  })

  it('normalizes Buffer, plain base64, and Yunzai image segment render results', async () => {
    const png = createPng(19, 7)
    const base64 = png.toString('base64')
    const renderResults: unknown[] = [
      png,
      base64,
      { type: 'image', data: `base64://${base64}` },
      [{ type: 'image', data: base64 }]
    ]

    for (const [index, renderResult] of renderResults.entries()) {
      const tempDir = await createTemporaryDirectory()
      const result = await generateDouyinASS([
        makeDanmaku(`emoji-${index}`, 0, '[笑哭]')
      ], 1080, 1920, {
        tempDir,
        emojiFetcher: async () => emojiList,
        renderStrip: async () => renderResult
      })

      expect(result.overlays[0]).toMatchObject({ width: 19, height: 7 })
    }
  })

  it('falls back to a plain ASS dialogue when strip rendering fails', async () => {
    const tempDir = await createTemporaryDirectory()
    const result = await generateDouyinASS([
      makeDanmaku('fallback', 0, '文字[笑哭]')
    ], 1080, 1920, {
      tempDir,
      emojiFetcher: async () => emojiList,
      renderStrip: async () => {
        throw new Error('renderer unavailable')
      }
    })

    expect(result.overlays).toEqual([])
    expect(result.ass).toContain('文字[笑哭]')
    expect(result.stats.emojiOverlays).toBe(0)
  })

  it('reuses an explicit emoji list across calls without invoking either fetcher alias', async () => {
    const tempDir = await createTemporaryDirectory()
    const sharedEmojiList = Object.freeze([
      Object.freeze({ name: '[共享]', url: 'https://emoji.example/shared.png' })
    ]) satisfies readonly DouyinEmojiInfo[]
    const emojiFetcher = vi.fn(async () => emojiList)
    const fetchEmoji = vi.fn(async () => emojiList)
    const requests: DouyinStripRenderRequest[] = []

    for (const danmakuId of ['shared-first', 'shared-second']) {
      await generateDouyinASS([
        makeDanmaku(danmakuId, 0, '复用[共享]')
      ], 1080, 1920, {
        tempDir,
        emojiList: sharedEmojiList,
        emojiFetcher,
        fetchEmoji,
        renderStrip: async request => {
          requests.push(request)
          return createPng(120, 24)
        }
      })
    }

    expect(emojiFetcher).not.toHaveBeenCalled()
    expect(fetchEmoji).not.toHaveBeenCalled()
    expect(requests).toHaveLength(2)
    expect(requests.every(request => request.segments.some(segment =>
      segment.type === 'emoji' && segment.url === sharedEmojiList[0].url
    ))).toBe(true)
    expect(sharedEmojiList).toEqual([
      { name: '[共享]', url: 'https://emoji.example/shared.png' }
    ])
  })

  it('arbitrates liked danmaku first and includes its formatted like badge in the strip HTML', async () => {
    const tempDir = await createTemporaryDirectory()
    const requests: DouyinStripRenderRequest[] = []

    const result = await generateDouyinASS([
      makeDanmaku('normal', 0, '普通[笑哭]'),
      makeDanmaku('liked', 24800, '高赞')
    ], 500, 100, {
      danmakuArea: 0.05,
      tempDir,
      emojiFetcher: async () => emojiList,
      renderStrip: async request => {
        requests.push(request)
        return createPng(120, 16)
      }
    })

    const likedRequest = requests.find(request => request.likeLabel !== null)
    expect(likedRequest).toMatchObject({ text: '高赞', likeLabel: '2.4w' })
    expect(likedRequest?.html).toContain('like-badge')
    expect(likedRequest?.html).toContain('2.4w')
    expect(result.overlays).toHaveLength(1)
    expect(result.stats).toMatchObject({
      likedOverlays: 1,
      emojiOverlays: 0,
      likedCandidates: 1,
      likedTarget: 5
    })
  })
})

describe('buildDouyinFfmpegPlan', () => {
  const baseDirectory = resolve('media files')
  const baseInput = {
    videoPath: join(baseDirectory, 'source.mp4'),
    outputPath: join(baseDirectory, 'output.mp4'),
    assPath: join(baseDirectory, 'source_danmaku.ass'),
    filterScriptPath: join(baseDirectory, 'douyin-filter.txt'),
    width: 1080,
    height: 1920,
    scrollTime: 8,
    encoder: 'libx264'
  } as const

  it('uses relative paths from the output directory for an ordinary subtitles filter', () => {
    const plan = buildDouyinFfmpegPlan({ ...baseInput, overlays: [] })

    expect(plan.cwd).toBe(dirname(baseInput.outputPath))
    expect(plan.command).toContain('-vf')
    expect(plan.command).toContain("subtitles='source_danmaku.ass'")
    expect(plan.command).not.toContain('-filter_complex')
    expect(plan.command).toContain('"source.mp4"')
    expect(plan.command).toContain('"output.mp4"')
    expect(plan.command).not.toContain(baseDirectory)
    expect(plan.tempFiles).toEqual([])
  })

  it('deduplicates PNG inputs and moves the timed graph into a temporary filter script', () => {
    const overlay: DanmakuOverlay = {
      pngPath: join(baseDirectory, 'strip.png'),
      startTime: 1000,
      endTime: 9000,
      y: 12,
      moveW: 200,
      width: 200,
      height: 32
    }
    const plan = buildDouyinFfmpegPlan({
      ...baseInput,
      overlays: [overlay, { ...overlay, startTime: 2000, endTime: 10000 }]
    })

    expect(plan.command).toContain('-filter_complex_script "douyin-filter.txt"')
    expect(plan.command).not.toContain('-filter_complex "')
    expect(plan.command.match(/strip\.png/g)).toHaveLength(1)
    expect(plan.filterComplex).toContain("overlay=x='1080-(t-1.000)*160.000'")
    expect(plan.filterComplex).toContain("enable='between(t,1.000,9.000)'")
    expect(plan.filterScriptPath).toBe(baseInput.filterScriptPath)
    expect(plan.tempFiles).toEqual([baseInput.filterScriptPath])
  })

  it('keeps a large overlay graph out of the Windows command line', () => {
    const overlays: DanmakuOverlay[] = Array.from({ length: 400 }, (_, index) => ({
      pngPath: join(baseDirectory, `strip-${index % 4}.png`),
      startTime: index * 100,
      endTime: index * 100 + 8000,
      y: index % 20,
      moveW: 200,
      width: 200,
      height: 32
    }))

    const plan = buildDouyinFfmpegPlan({ ...baseInput, overlays })

    expect(plan.filterComplex?.length).toBeGreaterThan(30_000)
    expect(plan.command.length).toBeLessThan(2_000)
    expect(plan.command).not.toContain('between(t')
    expect(plan.overlayInputCount).toBe(4)
  })
})

describe('burnDouyinDanmaku', () => {
  it('uses injected ffprobe/ffmpeg runners and returns false instead of blocking the original video on failure', async () => {
    const tempDir = await createTemporaryDirectory()
    const videoPath = join(tempDir, 'source video.mp4')
    const outputPath = join(tempDir, 'output video.mp4')
    await writeFile(videoPath, Buffer.from('video-stub'))

    const ffprobeRunner = vi.fn(async () => {
      throw new Error('probe unavailable')
    })
    const ffmpegRunner = vi.fn(async (_command: string) => {
      throw new Error('encode failed')
    })

    await expect(burnDouyinDanmaku(videoPath, [
      makeDanmaku('plain', 0, '纯文字弹幕')
    ], outputPath, {
      tempDir,
      emojiFetcher: async () => [],
      ffprobeRunner,
      ffmpegRunner
    })).resolves.toBe(false)

    expect(ffprobeRunner).toHaveBeenCalledTimes(1)
    expect(ffmpegRunner).toHaveBeenCalledTimes(1)
    expect(ffmpegRunner.mock.calls[0]?.[0]).toContain('subtitles=')
  })

  it('writes and cleans a filter script while reusing explicit emoji data and one PNG input', async () => {
    const tempDir = await createTemporaryDirectory()
    const videoPath = join(tempDir, 'source video.mp4')
    const outputPath = join(tempDir, 'output video.mp4')
    await writeFile(videoPath, Buffer.from('video-stub'))

    const sharedEmojiList = Object.freeze([
      Object.freeze({ name: '[共享]', url: 'https://emoji.example/shared.png' })
    ]) satisfies readonly DouyinEmojiInfo[]
    const emojiFetcher = vi.fn(async () => emojiList)
    const renderStrip = vi.fn(async () => createPng(200, 32))
    let ffmpegCommand = ''
    let filterScriptPath = ''
    let filterScript = ''

    const ffprobeRunner = vi.fn(async (command: string, options?: DouyinCommandOptions) => {
      expect(command).toContain('"source video.mp4"')
      expect(command).not.toContain(tempDir)
      expect(options).toEqual({ cwd: tempDir, timeout: 10_000 })
      return { status: true, stdout: '1080x1920' }
    })
    const ffmpegRunner = vi.fn(async (command: string, options?: DouyinCommandOptions) => {
      ffmpegCommand = command
      expect(options).toEqual({ cwd: tempDir, timeout: 0 })
      const scriptArgument = command.match(/-filter_complex_script "([^"]+)"/)?.[1]
      expect(scriptArgument).toBeTruthy()
      filterScriptPath = resolve(options?.cwd ?? '', scriptArgument ?? '')
      filterScript = await readFile(filterScriptPath, 'utf8')
      return { status: true }
    })

    await expect(burnDouyinDanmaku(videoPath, [
      makeDanmaku('shared-first', 0, '复用[共享]', 0),
      makeDanmaku('shared-second', 0, '复用[共享]', 9000)
    ], outputPath, {
      tempDir,
      emojiList: sharedEmojiList,
      emojiFetcher,
      renderStrip,
      ffprobeRunner,
      ffmpegRunner
    })).resolves.toBe(true)

    expect(emojiFetcher).not.toHaveBeenCalled()
    expect(renderStrip).toHaveBeenCalledTimes(1)
    expect(ffmpegCommand).toContain('-filter_complex_script')
    expect(ffmpegCommand).not.toContain('-filter_complex "')
    expect(ffmpegCommand).not.toContain(tempDir)
    expect(ffmpegCommand.match(/-i "[^"]+\.png"/g)).toHaveLength(1)
    expect(filterScript).toContain('split=2')
    expect(filterScript).toContain("overlay=x='")
    expect(filterScriptPath).not.toBe('')
    await expect(access(filterScriptPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
