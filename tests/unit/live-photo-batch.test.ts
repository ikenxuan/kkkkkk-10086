import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

/** 最小可解析 JPEG：SOI + SOF0(height=64, width=96) + EOI */
const jpegFixture = Buffer.from([
  0xff, 0xd8,
  0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x40, 0x00, 0x60,
  0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  0xff, 0xd9
])
const mp4Fixture = Buffer.from('fake-mp4-bytes-for-live-photo', 'utf8')

const workspace = mkdtempSync(join(tmpdir(), 'kkkkkk-livephoto-batch-'))

const configMock = vi.hoisted(() => ({
  app: {} as Record<string, unknown>,
  upload: {} as Record<string, unknown>,
  cookies: {} as Record<string, unknown>
}))

/** 下载桩的可编程钩子。测试用它控制单张图的完成时机和失败。 */
const downloads = vi.hoisted(() => ({
  /** 每次 downloadStream 的 url，按调用顺序 */
  started: [] as string[],
  /** 命中的 url 直接抛错 */
  fail: new Set<string>(),
  /** 返回前先 await 这个钩子，用来编排完成顺序或把下载卡住 */
  before: null as null | ((url: string) => Promise<void> | void)
}))

/** ffmpeg 桩的记录：调用顺序、收到的 BGM 上下文、并发峰值 */
const loop = vi.hoisted(() => ({
  inputs: [] as string[],
  contexts: [] as unknown[],
  concurrent: 0,
  maxConcurrent: 0,
  /** 是否让每次调用都产出一个新的 context（模拟 continuous 模式的链） */
  chainContext: false
}))

vi.mock('../../src/module/utils/Networks.js', () => ({
  baseHeaders: {},
  Networks: class {
    private readonly filepath: string
    private readonly url: string

    constructor (options: { url: string, filepath: string }) {
      this.url = options.url
      this.filepath = options.filepath
    }

    async downloadStream (): Promise<{ filepath: string, totalBytes: number }> {
      downloads.started.push(this.url)
      if (downloads.before) await downloads.before(this.url)
      if (downloads.fail.has(this.url)) throw new Error(`下载失败: ${this.url}`)
      const payload = this.url.includes('/live-') ? mp4Fixture : jpegFixture
      mkdirSync(dirname(this.filepath), { recursive: true })
      writeFileSync(this.filepath, payload)
      return { filepath: this.filepath, totalBytes: payload.length }
    }
  }
}))

vi.mock('../../src/module/utils/Common.js', () => ({
  default: {
    mkdir: async (directory: string) => {
      mkdirSync(directory, { recursive: true })
      return true
    },
    tempDri: {
      images: join(workspace, 'images'),
      video: join(workspace, 'video')
    }
  }
}))

vi.mock('../../src/module/utils/Config.js', () => ({ default: configMock }))
vi.mock('../../src/module/utils/Render.js', () => ({ Render: vi.fn() }))

vi.mock('../../src/module/utils/FFmpeg.js', () => ({
  ffmpeg: vi.fn(),
  loopVideoWithTransition: async (options: { inputPath: string, context?: unknown }) => {
    loop.inputs.push(options.inputPath)
    loop.contexts.push(options.context)
    loop.concurrent += 1
    loop.maxConcurrent = Math.max(loop.maxConcurrent, loop.concurrent)
    // 让出一个 tick：并发跑的话这里就会互相重叠，maxConcurrent 会大于 1
    await new Promise(resolve => setTimeout(resolve, 0))
    loop.concurrent -= 1
    const index = loop.contexts.length
    return {
      success: true,
      context: loop.chainContext
        ? { bgmPath: 'bgm.mp3', bgmDuration: 30, usedDuration: index }
        : undefined
    }
  }
}))

globalThis.logger = {
  warn: vi.fn(),
  debug: vi.fn(),
  mark: vi.fn(),
  error: vi.fn(),
  info: vi.fn()
} as unknown as typeof logger

globalThis.segment = {
  image: (file: string) => ({ type: 'image', file }),
  video: (file: string) => ({ type: 'video', file })
} as unknown as typeof segment

const { buildLivePhotoMessagesBatch } = await import('../../src/module/platform/common/livePhoto.js')

interface StubMessage {
  type: string
  file: string
}

const staticUrl = (index: number): string => `https://example.com/static-${index}.jpg`
const liveVideoUrl = (index: number): string => `https://example.com/live-${index}.mp4`

const liveItems = (count: number): Array<{ staticUrl: string, liveVideoUrl: string }> => (
  Array.from({ length: count }, (_, index) => ({
    staticUrl: staticUrl(index),
    liveVideoUrl: liveVideoUrl(index)
  }))
)

/** 从 url 里取回图片序号，用来编排「后面的图先下完」 */
const indexOfUrl = (url: string): number => Number(url.match(/-(\d+)\./)?.[1] ?? 0)

/**
 * 从 ffmpeg 输入路径里取回图片序号。
 * 临时文件名是 `<platform>_live_src_<时间戳>_<随机>_<序号>.mp4`，序号在末尾。
 */
const indexOfSourcePath = (filepath: string): number => Number(filepath.match(/_(\d+)\.mp4$/)?.[1] ?? Number.NaN)

/** 实况图产物的文件名以 `_<序号>.jpg` 结尾，用它验证消息真的属于第几张图 */
const imageIndexOf = (messages: unknown[]): number | undefined => {
  const image = (messages as StubMessage[]).find(message => message.type === 'image')
  return image === undefined ? Number.NaN : Number(image.file.match(/_(\d+)\.jpg$/)?.[1])
}

const settle = async (ms = 5): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, ms))
}

beforeEach(() => {
  configMock.app = { livePhotoMode: 'video_and_livephoto', livePhotoSystem: 'google' }
  configMock.upload = {}
  configMock.cookies = {}
  downloads.started = []
  downloads.fail = new Set()
  downloads.before = null
  loop.inputs = []
  loop.contexts = []
  loop.concurrent = 0
  loop.maxConcurrent = 0
  loop.chainContext = false
})

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('buildLivePhotoMessagesBatch 输出顺序', () => {
  it('下载完成顺序完全倒过来时，输出顺序依然等于输入顺序', async () => {
    const count = 5
    // 序号越大下载越快：完成顺序是 4,3,2,1,0，和输入顺序完全相反
    downloads.before = async (url: string) => {
      await settle((count - indexOfUrl(url)) * 8)
    }

    const batch = await buildLivePhotoMessagesBatch(liveItems(count), {
      platform: 'test',
      windowSize: count
    })

    expect(batch.results).toHaveLength(count)
    // 逐位对齐：第 i 个结果里的实况图必须是第 i 张图的产物
    expect(batch.results.map(result => imageIndexOf(result.messages))).toEqual([0, 1, 2, 3, 4])
    // ffmpeg 也必须按序消费，否则 continuous 模式的 BGM 链就断了
    expect(loop.inputs.map(indexOfSourcePath)).toEqual([0, 1, 2, 3, 4])
  })

  it('空条目（非实况图）占位不影响对齐', async () => {
    const batch = await buildLivePhotoMessagesBatch([
      {},
      { staticUrl: staticUrl(1), liveVideoUrl: liveVideoUrl(1) },
      {},
      { staticUrl: staticUrl(3), liveVideoUrl: liveVideoUrl(3) }
    ], { platform: 'test', windowSize: 4 })

    expect(batch.results.map(result => result.messages.length > 0)).toEqual([false, true, false, true])
    expect(imageIndexOf(batch.results[1]?.messages ?? [])).toBe(1)
    expect(imageIndexOf(batch.results[3]?.messages ?? [])).toBe(3)
    // 空条目一次网络请求都不该发
    expect(downloads.started.map(indexOfUrl).sort()).toEqual([1, 1, 3, 3])
  })

  it('ffmpeg 严格串行，不并发重叠', async () => {
    await buildLivePhotoMessagesBatch(liveItems(4), { platform: 'test', windowSize: 4 })
    expect(loop.maxConcurrent).toBe(1)
  })
})

describe('buildLivePhotoMessagesBatch 滑动窗口', () => {
  it('同时未消费的下载数不超过窗口，消费一张才补一张', async () => {
    const release = new Map<string, () => void>()
    downloads.before = async (url: string) => {
      await new Promise<void>(resolve => {
        release.set(url, resolve)
      })
    }

    const pending = buildLivePhotoMessagesBatch(liveItems(10), { platform: 'test', windowSize: 3 })
    await settle()

    // 窗口 3：只有前 3 张的下载被发起（每张 2 个文件 = 6 次请求）
    expect(new Set(downloads.started.map(indexOfUrl))).toEqual(new Set([0, 1, 2]))
    expect(downloads.started).toHaveLength(6)

    // 放掉第 0 张 => 它被消费，窗口空出一格，第 3 张才准进来
    release.get(staticUrl(0))?.()
    release.get(liveVideoUrl(0))?.()
    await settle()
    expect(new Set(downloads.started.map(indexOfUrl))).toEqual(new Set([0, 1, 2, 3]))

    // 收尾：把剩下的全放掉，避免悬挂的 promise
    for (let round = 0; round < 12; round += 1) {
      for (const resolve of release.values()) resolve()
      await settle()
    }
    await pending
  })

  it('磁盘峰值恒定：未消费的图片数被窗口限住，不随图集变大而增长', async () => {
    const count = 9
    const windowSize = 2
    const peaks: number[] = []
    downloads.before = () => {
      // 已开始下载的图片数 - 已经交给 ffmpeg 的图片数
      peaks.push(new Set(downloads.started.map(indexOfUrl)).size - loop.inputs.length)
    }

    await buildLivePhotoMessagesBatch(liveItems(count), { platform: 'test', windowSize })

    // 窗口里 windowSize 张 + 正在被 ffmpeg 消费的那 1 张 = 恒定上限，
    // 和图集大小无关（9 张图峰值仍是 3，而不是 9）
    expect(Math.max(...peaks)).toBeLessThanOrEqual(windowSize + 1)
    expect(Math.max(...peaks)).toBeLessThan(count)
  })

  it('不传 windowSize 时用下载额度当窗口，整批照样跑完', async () => {
    const batch = await buildLivePhotoMessagesBatch(liveItems(3), { platform: 'test' })
    expect(batch.results.map(result => imageIndexOf(result.messages))).toEqual([0, 1, 2])
  })
})

describe('buildLivePhotoMessagesBatch 单张失败', () => {
  it('单张失败只回退那一张，其余不受影响，且已落盘的那一半也进 tempFiles', async () => {
    downloads.fail = new Set([liveVideoUrl(1)])

    const batch = await buildLivePhotoMessagesBatch(liveItems(4), {
      platform: 'test',
      windowSize: 4
    })

    // 失败的那张返回空 messages —— 调用方据此回退成普通图片
    expect(batch.results[1]?.messages).toEqual([])
    expect(batch.results[1]?.generatedLivePhoto).toBe(false)
    // 其余三张照常出实况图，位置不错
    expect(batch.results.map(result => imageIndexOf(result.messages))).toEqual([0, Number.NaN, 2, 3])
    expect(batch.generatedLivePhoto).toBe(true)

    const paths = batch.tempFiles.map(file => file.filepath)
    // 视频下载失败，但静态图已经落盘了，必须被收进 tempFiles，否则临时文件泄漏
    expect(paths.some(filepath => /test_static_.*_1\.jpg$/.test(filepath))).toBe(true)
    // 成功的三张各 4 个文件（静态图 + 源视频 + 循环视频 + 实况图），失败的那张 1 个
    expect(paths).toHaveLength(13)
    // 同一个文件不能被收两次，否则调用方会删两遍
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('每一张都失败时整批返回空 messages，但 tempFiles 仍然收齐', async () => {
    downloads.fail = new Set([0, 1, 2].map(liveVideoUrl))

    const batch = await buildLivePhotoMessagesBatch(liveItems(3), {
      platform: 'test',
      windowSize: 3
    })

    expect(batch.results.every(result => result.messages.length === 0)).toBe(true)
    expect(batch.generatedLivePhoto).toBe(false)
    expect(batch.tempFiles).toHaveLength(3)
  })
})

describe('buildLivePhotoMessagesBatch 连续 BGM 模式', () => {
  it('context 按序串成一条链，即使下载完成顺序是乱的', async () => {
    loop.chainContext = true
    const count = 3
    downloads.before = async (url: string) => {
      await settle((count - indexOfUrl(url)) * 8)
    }

    const batch = await buildLivePhotoMessagesBatch(liveItems(count), {
      platform: 'test',
      mergeMode: 'continuous',
      windowSize: count
    })

    // 第 N 张收到的必须是第 N-1 张吐出来的 context，一环不缺
    expect(loop.contexts).toEqual([
      undefined,
      { bgmPath: 'bgm.mp3', bgmDuration: 30, usedDuration: 1 },
      { bgmPath: 'bgm.mp3', bgmDuration: 30, usedDuration: 2 }
    ])
    expect(batch.context).toEqual({ bgmPath: 'bgm.mp3', bgmDuration: 30, usedDuration: 3 })
  })

  it('中间一张失败时链不中断，跳过失败的那张继续往下串', async () => {
    loop.chainContext = true
    downloads.fail = new Set([liveVideoUrl(1)])

    await buildLivePhotoMessagesBatch(liveItems(3), {
      platform: 'test',
      mergeMode: 'continuous',
      windowSize: 3
    })

    // 只有第 0 和第 2 张进了 ffmpeg，第 2 张拿到的是第 0 张吐出来的 context
    expect(loop.inputs.map(indexOfSourcePath)).toEqual([0, 2])
    expect(loop.contexts).toEqual([
      undefined,
      { bgmPath: 'bgm.mp3', bgmDuration: 30, usedDuration: 1 }
    ])
  })
})
