import React from 'react'

import type { PosterContext } from '../types/ctx'

/**
 * 氛围背景的封面色贡献调节参数。
 * 封面色最终可见度 ≈ AMBIENT_COVER_OPACITY × (1 − 压色罩对应位置不透明度)。
 */
/** 模糊封面层不透明度 (0~1)：封面色强度总闸，越大整体越浓 */
export const AMBIENT_COVER_OPACITY = 0.7
/** 主题色压色罩不透明度 (0~1)：edge 为顶/底两端，middle 为中间带；调小 middle 封面色更透 */
export const AMBIENT_OVERLAY_OPACITY = { edge: 0.9, middle: 0.2 }

/** 用 color-mix 生成三段压色渐变（0% / 50% / 100% 停靠点对应 edge / middle / edge） */
const overlayGradient = (color: string, edge: number, middle: number) =>
  `linear-gradient(to bottom, ` +
  `color-mix(in oklab, ${color} ${edge * 100}%, transparent), ` +
  `color-mix(in oklab, ${color} ${middle * 100}%, transparent), ` +
  `color-mix(in oklab, ${color} ${edge * 100}%, transparent))`

/**
 * 氛围背景基础层：高斯模糊封面 + 主题色压色罩。
 * 压色罩浅色用主题背景色、深色用纯黑（两个层按 dark 变体显隐），
 * 各模板在此之上再叠加自己的杂色纹理层。
 */
export const AmbientCover: React.FC<{ src: string; ctx?: PosterContext }> = React.memo(({ src, ctx }) => {
  const coverOpacity = ctx?.ambientCover?.coverOpacity ?? AMBIENT_COVER_OPACITY
  const edge = ctx?.ambientCover?.overlayEdgeOpacity ?? AMBIENT_OVERLAY_OPACITY.edge
  const middle = ctx?.ambientCover?.overlayMiddleOpacity ?? AMBIENT_OVERLAY_OPACITY.middle

  return (
    <>
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full scale-150 object-cover blur-[120px] saturate-[1.8]"
        style={{ opacity: coverOpacity }}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
      />
      <div className="absolute inset-0 dark:hidden" style={{ background: overlayGradient('var(--background)', edge, middle) }} />
      <div className="absolute inset-0 hidden dark:block" style={{ background: overlayGradient('#000', edge, middle) }} />
    </>
  )
})

AmbientCover.displayName = 'AmbientCover'
