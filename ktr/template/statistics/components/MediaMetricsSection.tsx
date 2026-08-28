/** statistics 板块共享组件（statistics/group 与 statistics/global 共用）。 */

import React from 'react'

import { formatBytes, formatDuration, formatDurationClock, formatPercent, valueSizeClass } from '../../../utils/media-format'
import type { MediaMetricsPlatform, MediaMetricsPlatformView, MediaMetricsView } from '../../types/media-metrics'

/**
 * 调用方 platformConfig 里本组件真正读到的成员。
 *
 * 只声明 logo / name / color 三个：两张统计卡的 platformConfig 还带着 nameEn，
 * 结构化子类型让它们照常传得进来，而这里不去依赖用不到的字段。
 */
export interface MediaMetricsPlatformDisplay {
  name: string
  logo: string
  color: string
}

/**
 * 媒体统计区块（本地新增，上游 karin-plugin-kkk 没有；同步上游时请连带两张卡
 * types.ts 的 mediaMetrics 字段一起保留）。
 *
 * 放在 `statistics/components/` 而不是某一张卡的 components 里：两张卡的排版
 * 完全一样，各写一遍必然漂移。板块级共享目录的先例是 `douyin/components/`
 * （Icons.tsx / types.ts 被 douyin 下 7 个模板共用）。
 *
 * platformConfig 由调用方传进来，保证平台配色 / logo 和同一张卡上面的
 * 「平台详情」「平台分布」完全一致，不各配一套。
 *
 * 每一项指标都自带守卫：拿不到时长的平台（快手、小红书当前的解析路径上
 * 就没有时长字段）只贡献条数，此时时长卡整块不出现，而不是显示「0 秒」——
 * 「没采到数据」和「平均 0 秒」在卡片上必须能区分。
 */
export const MediaMetricsSection: React.FC<{
  metrics: MediaMetricsView
  platformConfig: Record<MediaMetricsPlatform, MediaMetricsPlatformDisplay>
}> = ({ metrics, platformConfig }) => {
  /**
   * 大号卡片按「有数据」筛，最少 1 个最多 3 个。
   *
   * 列数走内联 style 而不是 `grid-cols-${n}`：Tailwind 是扫源码文本生成类名的，
   * 模板字符串拼出来的类名它看不见，运行时就是个没有样式的空类。
   */
  const cards: Array<{ title: string, titleEn: string, value: string, unit: string }> = []
  if (metrics.durationSamples > 0) {
    const total = formatDuration(metrics.totalDurationMs)
    cards.push({ title: '媒体总时长', titleEn: 'TOTAL DURATION', value: total.value, unit: total.unit })
  }
  if (metrics.averageDurationMs !== undefined) {
    const avg = formatDuration(metrics.averageDurationMs)
    cards.push({ title: '平均时长', titleEn: 'AVERAGE', value: avg.value, unit: avg.unit })
  }
  if (metrics.totalBytes > 0) {
    const bytes = formatBytes(metrics.totalBytes)
    cards.push({ title: '累计体积', titleEn: 'TOTAL SIZE', value: bytes.value, unit: bytes.unit })
  }
  // 时长和体积一个都没采到（只有条数）时，别让这一排空着
  const countIsCard = cards.length === 0
  if (countIsCard) {
    cards.push({ title: '媒体条数', titleEn: 'MEDIA COUNT', value: String(metrics.mediaCount), unit: '条' })
  }

  /** 次要指标做成一排小药丸，同样各自带守卫 */
  const pills: Array<{ label: string, value: string }> = []
  if (!countIsCard && metrics.mediaCount > 0) pills.push({ label: '媒体', value: `${metrics.mediaCount} 条` })
  if (metrics.videoCount > 0) pills.push({ label: '视频', value: `${metrics.videoCount} 条` })
  if (metrics.audioCount > 0) pills.push({ label: '音频', value: `${metrics.audioCount} 条` })
  // 单条时长用时钟读最直观（跟播放器一致），总时长才用「小时/分」
  if (metrics.maxDurationMs !== undefined) {
    pills.push({ label: '最长', value: formatDurationClock(metrics.maxDurationMs) })
  }
  if (metrics.averageProcessingMs !== undefined) {
    const processing = formatDuration(metrics.averageProcessingMs)
    pills.push({ label: '平均耗时', value: `${processing.value}${processing.unit}` })
  }
  if (metrics.successRate !== undefined) {
    pills.push({ label: '成功率', value: formatPercent(metrics.successRate) })
  }

  /**
   * 平台时长排行。
   *
   * 一条时长都没采到的平台整行跳过、全都没采到时整块跳过：那种情况下每条都是 0，
   * 四根等长的空条只会让人以为「所有平台的视频都是 0 秒」。
   */
  const platformRows = (Object.entries(metrics.platforms) as Array<[MediaMetricsPlatform, MediaMetricsPlatformView]>)
    .filter(([, stat]) => stat.durationSamples > 0)
    .sort((a, b) => b[1].totalDurationMs - a[1].totalDurationMs)
  const maxPlatformDuration = Math.max(...platformRows.map(([, stat]) => stat.totalDurationMs), 0)

  return (
    <div className="mb-40">
      <div className="flex items-center gap-8 mb-16">
        <div className="w-5 h-24 rounded-full bg-emerald-500" />
        <div className="flex flex-col">
          <h2 className="text-[5rem] font-black tracking-tight leading-none text-foreground/90">媒体统计</h2>
          <span className="text-2xl font-medium tracking-[0.15em] uppercase text-muted/70 mt-2">MEDIA</span>
        </div>
      </div>

      <div
        className="grid gap-16 mb-12"
        style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }}
      >
        {cards.map((card) => (
          <div key={card.titleEn} className="relative p-16 rounded-3xl bg-surface/40 backdrop-blur-md border-2 border-border/40">
            <div className="text-4xl font-black text-foreground/90 mb-3">{card.title}</div>
            <div className="text-xl font-medium tracking-widest uppercase text-muted/70 mb-8 opacity-60">{card.titleEn}</div>
            {/*
              字号按数值字符数降级（`valueSizeClass`，依据见那个函数的注释）：
              卡内可用宽只有 261.3px，写死 7rem 时 4 字起就会溢出、被根节点的
              overflow-hidden 从字形中间切断 —— `347.7 MB` 实测溢出 86.4px。

              单位那两个类是另一条失效路径的保险，别删：它是 flex item，默认
              `min-width:auto` 且 CJK 允许字间断行，空间一紧就在 小/时 之间折成
              两行（实测高度从 48 变 88）。宁可整体溢出——那看得出是 bug——
              也不要静默折行，后者看起来像「设计如此」。
            */}
            <div className="flex items-baseline gap-3">
              <div className={`${valueSizeClass(card.value)} font-black leading-none text-foreground/90`}>{card.value}</div>
              <div className="text-4xl font-medium text-foreground/80 pb-2 whitespace-nowrap shrink-0">{card.unit}</div>
            </div>
          </div>
        ))}
      </div>

      {pills.length > 0 && (
        <div className="flex flex-wrap gap-8 mb-12">
          {pills.map((pill) => (
            <div
              key={pill.label}
              className="flex items-baseline gap-4 px-10 py-6 rounded-2xl bg-surface/30 border-2 border-border/30"
            >
              <span className="text-2xl font-medium tracking-wider text-muted/80">{pill.label}</span>
              <span className="text-4xl font-black text-foreground/90">{pill.value}</span>
            </div>
          ))}
        </div>
      )}

      {platformRows.length > 0 && (
        <div className="space-y-10">
          {platformRows.map(([platform, stat]) => {
            const config = platformConfig[platform]
            const total = formatDuration(stat.totalDurationMs)
            const percentage = maxPlatformDuration > 0 ? (stat.totalDurationMs / maxPlatformDuration) * 100 : 0

            return (
              <div key={platform} className="relative">
                <div className="flex items-center gap-8 mb-4">
                  <img src={config.logo} alt={config.name} className="h-16 w-auto object-contain" />
                  <div className="flex-1">
                    <div className="text-3xl font-bold text-foreground">{config.name}</div>
                    <div className="text-2xl text-foreground/70">
                      {stat.mediaCount} 条
                      {stat.averageDurationMs !== undefined && (() => {
                        const avg = formatDuration(stat.averageDurationMs)
                        return ` · 均 ${avg.value}${avg.unit}`
                      })()}
                    </div>
                  </div>
                  {/*
                    同上的折行保险。这一行左边是 `flex-1` 的平台名，会先让出空间，
                    所以数值这块现在不挤（实测 146.7px）；但单位一旦被挤就同样会在
                    小/时 之间折行，加 shrink-0 让它整块保住宽度。
                  */}
                  <div className="flex items-baseline gap-2 shrink-0">
                    <div className="text-[3.5rem] font-black text-foreground leading-none">{total.value}</div>
                    <div className="text-3xl font-medium text-foreground/80 whitespace-nowrap">{total.unit}</div>
                  </div>
                </div>
                <div className="relative h-12 bg-surface-secondary rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${percentage}%`, backgroundColor: config.color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
