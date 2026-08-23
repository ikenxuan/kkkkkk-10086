import { describe, expect, it } from 'vitest'

import { buildMediaMetricsView } from '../../src/module/platform/common/mediaMetricsView.js'
import type { MediaMetricsPlatformSummary, MediaMetricsSummary } from '../../src/types/database.js'

const platform = (
  overrides: Partial<MediaMetricsPlatformSummary> = {}
): MediaMetricsPlatformSummary => ({
  mediaCount: 0,
  totalDurationMs: 0,
  durationSamples: 0,
  totalBytes: 0,
  ...overrides
})

/** 造一个 getGroupMediaSummary() 形状的汇总 */
const summary = (overrides: Partial<MediaMetricsSummary> = {}): MediaMetricsSummary => ({
  mediaCount: 0,
  videoCount: 0,
  audioCount: 0,
  totalDurationMs: 0,
  videoDurationMs: 0,
  audioDurationMs: 0,
  durationSamples: 0,
  totalBytes: 0,
  successCount: 0,
  failureCount: 0,
  platforms: {
    douyin: platform(),
    bilibili: platform(),
    kuaishou: platform(),
    xiaohongshu: platform()
  },
  ...overrides
})

describe('buildMediaMetricsView', () => {
  it('一条数据都没有时返回 undefined，让模板整块不渲染', () => {
    // 新装用户的 MediaMetrics 表是空的，全 0 的「媒体总时长 0 秒」会让人以为功能坏了
    expect(buildMediaMetricsView(summary())).toBeUndefined()
  })

  it('纯图文解析（无媒体但记了成败）仍然出块，成功率有意义', () => {
    const view = buildMediaMetricsView(summary({ successCount: 3, failureCount: 1, successRate: 0.75 }))

    expect(view).toBeDefined()
    expect(view?.mediaCount).toBe(0)
    expect(view?.successRate).toBe(0.75)
  })

  it('successCount / failureCount 不进契约，模板拿不到内部计数', () => {
    const view = buildMediaMetricsView(summary({ mediaCount: 1, successCount: 2, failureCount: 5 }))

    expect(view).not.toHaveProperty('successCount')
    expect(view).not.toHaveProperty('failureCount')
  })

  it('缺省的平均值原样保持缺省，不被补成 0', () => {
    const view = buildMediaMetricsView(summary({ mediaCount: 2, successCount: 1 }))

    expect(view?.averageDurationMs).toBeUndefined()
    expect(view?.maxDurationMs).toBeUndefined()
    expect(view?.averageProcessingMs).toBeUndefined()
  })

  it('逐字段搬运，四个平台各自独立拷贝', () => {
    const source = summary({
      mediaCount: 5,
      videoCount: 4,
      audioCount: 1,
      totalDurationMs: 90_000,
      videoDurationMs: 80_000,
      audioDurationMs: 10_000,
      durationSamples: 5,
      averageDurationMs: 18_000,
      maxDurationMs: 40_000,
      totalBytes: 2_048,
      averageProcessingMs: 1_200,
      successCount: 5,
      failureCount: 0,
      successRate: 1,
      platforms: {
        douyin: platform({ mediaCount: 4, totalDurationMs: 80_000, durationSamples: 4, averageDurationMs: 20_000, maxDurationMs: 40_000, totalBytes: 2_048 }),
        bilibili: platform({ mediaCount: 1, totalDurationMs: 10_000, durationSamples: 1, averageDurationMs: 10_000, maxDurationMs: 10_000 }),
        kuaishou: platform(),
        xiaohongshu: platform()
      }
    })

    const view = buildMediaMetricsView(source)

    expect(view).toEqual({
      mediaCount: 5,
      videoCount: 4,
      audioCount: 1,
      totalDurationMs: 90_000,
      videoDurationMs: 80_000,
      audioDurationMs: 10_000,
      durationSamples: 5,
      averageDurationMs: 18_000,
      maxDurationMs: 40_000,
      totalBytes: 2_048,
      averageProcessingMs: 1_200,
      successRate: 1,
      platforms: source.platforms
    })
    // 拷贝而不是引用：模板侧改了自己那份不会回写到数据库聚合结果上
    expect(view?.platforms.douyin).not.toBe(source.platforms.douyin)
  })
})
