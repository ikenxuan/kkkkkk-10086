import React from 'react'

import type { PreviewState } from '../types'
import { PreviewInfoCard } from './PreviewInfoCard'
import { PreviewVideoCard } from './PreviewVideoCard'

type PreviewLayoutProps = {
  state: PreviewState
}

export const PreviewLayout: React.FC<PreviewLayoutProps> = ({ state }) => {
  return (
    <div className="relative min-h-screen bg-(--preview-bg) text-(--preview-fg)">
      <div className="absolute inset-0 overflow-hidden">
        <video
          className="h-full w-full object-cover blur-3xl scale-110 saturate-150 contrast-125"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          src={state.videoUrl}
        />
        <div className="absolute inset-0 pointer-events-none opacity-[0.35] mix-blend-overlay dark:mix-blend-soft-light">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="previewNoise">
                <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="3" stitchTiles="stitch" />
                <feColorMatrix type="saturate" values="0" />
                <feComponentTransfer>
                  <feFuncR type="discrete" tableValues="0 1" />
                  <feFuncG type="discrete" tableValues="0 1" />
                  <feFuncB type="discrete" tableValues="0 1" />
                </feComponentTransfer>
                <feComponentTransfer>
                  <feFuncA type="linear" slope="2" intercept="-0.5" />
                </feComponentTransfer>
              </filter>
              <mask id="previewNoiseMask">
                <linearGradient id="previewNoiseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="1" />
                  <stop offset="15%" stopColor="white" stopOpacity="0.6" />
                  <stop offset="50%" stopColor="white" stopOpacity="0.15" />
                  <stop offset="85%" stopColor="white" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="white" stopOpacity="1" />
                </linearGradient>
                <rect width="100%" height="100%" fill="url(#previewNoiseGradient)" />
              </mask>
            </defs>
            <rect width="100%" height="100%" filter="url(#previewNoise)" mask="url(#previewNoiseMask)" fill="white" />
          </svg>
        </div>
        <div className="absolute inset-0 bg-black/35" />
      </div>
      <div className="relative z-10 w-full px-4 py-16 sm:px-6">
        <div className="flex flex-col gap-2" style={{ mixBlendMode: 'difference', color: '#ffffff' }}>
          <h1 className="text-2xl font-semibold">临时预览</h1>
          <p className="text-sm">查看视频内容与删除时间</p>
        </div>
        <PreviewVideoCard videoUrl={state.videoUrl} />
        <PreviewInfoCard state={state} />
      </div>
    </div>
  )
}
