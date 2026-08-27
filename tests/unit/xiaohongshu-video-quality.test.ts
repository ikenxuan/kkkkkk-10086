import { beforeEach, describe, expect, it, vi } from 'vitest'

const configMock = vi.hoisted(() => ({
  cookies: { xiaohongshu: 'xhs-cookie' },
  xiaohongshu: {} as Record<string, unknown>
}))

vi.mock('../../src/module/utils/Config.js', () => ({ default: configMock }))
vi.mock('../../src/module/utils/Networks.js', () => ({ baseHeaders: {} }))
vi.mock('../../src/module/utils/Render.js', () => ({ Render: vi.fn() }))
vi.mock('../../src/module/utils/Common.js', () => ({ default: { removeFile: vi.fn() } }))
vi.mock('../../src/module/utils/ImageHelper.js', () => ({ processImageUrl: vi.fn() }))
vi.mock('../../src/runtime/host/common.js', () => ({ default: { makeForwardMsg: vi.fn() } }))
vi.mock('../../src/module/platform/xiaohongshu/livePhoto.js', () => ({
  buildLivePhotoMessages: vi.fn(),
  // 批量入口的默认返回：results 为空 => 每张图都走普通图片回退分支。
  buildLivePhotoMessagesBatch: vi.fn(async () => ({ results: [], tempFiles: [], generatedLivePhoto: false })),
  buildLivePhotoTipMessage: vi.fn(),
  pickXiaohongshuImageUrl: vi.fn()
}))
vi.mock('../../src/module/utils/Base.js', () => ({
  Base: class {},
  downloadVideo: vi.fn()
}))
vi.mock('../../src/module/platform/xiaohongshu/api.js', () => ({
  getXiaohongshuData: vi.fn()
}))

const { selectVideoStream } = await import('../../src/module/platform/xiaohongshu/xiaohongshu.js')

/** 造一条流：分辨率决定画质档，size 决定同档内的取舍 */
const stream = (width: number, height: number, sizeMB: number, tag: string) => ({
  master_url: `https://example.com/${tag}.mp4`,
  width,
  height,
  size: sizeMB * 1024 * 1024
})

const s4k = (sizeMB: number, tag = '4k') => stream(3840, 2160, sizeMB, tag)
const s1080p = (sizeMB: number, tag = '1080p') => stream(1920, 1080, sizeMB, tag)
const s720p = (sizeMB: number, tag = '720p') => stream(1280, 720, sizeMB, tag)

beforeEach(() => {
  configMock.xiaohongshu = {}
})

/**
 * adapt 的语义是「体积上限内挑最好的画质」，所以画质档必须是第一排序键。
 *
 * 旧实现把所有流按体积降序排一遍、取第一个不超限的，等于只按体积挑 ——
 * 跨编码时高清档反而更小（4k h265 常比 1080p h264 小），于是明明 4k 塞得进上限
 * 却被 1080p 抢走。这组用例钉的就是「高清档能塞进上限时不许退到低清档」。
 */
describe('selectVideoStream adapt 模式按画质档优先', () => {
  beforeEach(() => {
    configMock.xiaohongshu = { videoQuality: 'adapt', maxAutoVideoSize: 50 }
  })

  it('4k 比 1080p 小且都在上限内时仍选 4k', () => {
    const picked = selectVideoStream({ h265: [s4k(40)], h264: [s1080p(45)] })

    expect(picked?.master_url).toBe('https://example.com/4k.mp4')
  })

  it('最高档超限时降到下一个塞得进上限的档', () => {
    // 4k 60MB 超过 50MB 上限，应该退到 1080p 而不是硬发 4k
    const picked = selectVideoStream({ h265: [s4k(60)], h264: [s1080p(45)] })

    expect(picked?.master_url).toBe('https://example.com/1080p.mp4')
  })

  it('同一画质档内取体积最大的那条', () => {
    // 同档内体积大通常码率更高，更清晰
    const picked = selectVideoStream({
      h265: [s1080p(20, '1080p-small'), s1080p(45, '1080p-big')]
    })

    expect(picked?.master_url).toBe('https://example.com/1080p-big.mp4')
  })

  it('同一画质档内跳过超限的那条', () => {
    const picked = selectVideoStream({
      h265: [s1080p(80, '1080p-over'), s1080p(30, '1080p-fits')]
    })

    expect(picked?.master_url).toBe('https://example.com/1080p-fits.mp4')
  })

  it('所有档都超限时退回体积最小的，而不是返回空', () => {
    const picked = selectVideoStream({ h265: [s4k(300)], h264: [s1080p(120, '1080p-min')] })

    expect(picked?.master_url).toBe('https://example.com/1080p-min.mp4')
  })
})

describe('selectVideoStream 固定画质模式不受影响', () => {
  it('命中目标画质时取该档体积最大的', () => {
    configMock.xiaohongshu = { videoQuality: '1080p' }
    const picked = selectVideoStream({
      h265: [s4k(200), s1080p(30, '1080p-small'), s1080p(60, '1080p-big')]
    })

    expect(picked?.master_url).toBe('https://example.com/1080p-big.mp4')
  })

  it('目标画质缺失时先降级再升级', () => {
    // 目标 1080p 不存在：先往下找 720p，不该直接跳到 4k
    configMock.xiaohongshu = { videoQuality: '1080p' }
    const picked = selectVideoStream({ h265: [s4k(200), s720p(20)] })

    expect(picked?.master_url).toBe('https://example.com/720p.mp4')
  })

  it('只有更高画质时才升级', () => {
    configMock.xiaohongshu = { videoQuality: '1080p' }
    const picked = selectVideoStream({ h265: [s4k(200)] })

    expect(picked?.master_url).toBe('https://example.com/4k.mp4')
  })

  it('没有任何流时返回 null', () => {
    configMock.xiaohongshu = { videoQuality: '1080p' }

    expect(selectVideoStream({})).toBeNull()
    expect(selectVideoStream(undefined)).toBeNull()
  })
})
