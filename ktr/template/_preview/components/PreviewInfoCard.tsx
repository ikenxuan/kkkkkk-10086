import React from 'react'

import type { PreviewState } from '../types'
import { buildStatus } from '../utils/status'

type PreviewInfoCardProps = {
  state: PreviewState
}

export const PreviewInfoCard: React.FC<PreviewInfoCardProps> = ({ state }) => {
  const status = buildStatus(state)

  return (
    <div
      className="relative z-10 mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      style={{ mixBlendMode: 'difference', color: '#ffffff' }}
    >
      <div>
        <div className="text-xs uppercase tracking-[0.2em]">删除倒计时</div>
        <div className="mt-2 text-5xl font-semibold" id="preview-countdown">
          {status.countdownText}
        </div>
      </div>
      <a
        className="inline-flex h-10 items-center justify-center rounded-full border border-white/50 px-4 text-sm font-medium text-white backdrop-blur"
        href={state.videoUrl}
        download
      >
        下载视频
      </a>
    </div>
  )
}
