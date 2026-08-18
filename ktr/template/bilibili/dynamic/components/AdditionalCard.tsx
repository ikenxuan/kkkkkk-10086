import { Button } from '@heroui/react'
import { BarChart3, BellRing, Gamepad2, Gift } from 'lucide-react'
import React from 'react'

import { cn } from '../../../../utils/cn'
import { EnhancedImage } from '../../components/shared'
import type { BilibiliAdditionalData } from '../types'

/**
 * B站预约卡片组件
 */
export const BilibiliReserveCard: React.FC<{ reserve: NonNullable<BilibiliAdditionalData>['reserve'] }> = ({ reserve }) => {
  if (!reserve) return null

  return (
    <div className="overflow-hidden rounded-4xl bg-surface">
      <div className="flex gap-8 justify-between items-center px-10 py-10">
        <div className="flex flex-col gap-4 flex-1">
          <div className="text-5xl font-normal text-foreground select-text leading-tight">{reserve.title}</div>
          <div className="flex gap-8 items-center font-light text-4xl text-muted">
            <span className="select-text">{reserve.desc1}</span>
            <span className="select-text">{reserve.desc2}</span>
          </div>
          {reserve.desc3 && (
            <div className="flex gap-2 items-center text-4xl select-text leading-none text-[#fb7299]">
              <Gift size={40} className="shrink-0" />
              <span className="line-clamp-1">{reserve.desc3}</span>
            </div>
          )}
        </div>
        <div className="shrink-0">
          <Button
            size="lg"
            className={`font-normal scale-200 mr-15 rounded-xl ${
              reserve.buttonText === '已结束' ? 'bg-surface-secondary/70 text-muted' : 'bg-[#fb7299] text-white'
            }`}
          >
            {reserve.buttonText !== '已结束' && <BellRing size={330} />}
            {reserve.buttonText}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * B站投票卡片组件
 */
export const BilibiliVoteCard: React.FC<{ vote: NonNullable<BilibiliAdditionalData>['vote'] }> = ({ vote }) => {
  if (!vote) return null

  const isEnded = vote.status === 4

  return (
    <div className="overflow-hidden rounded-4xl bg-surface">
      <div className="flex gap-8 items-center px-10 py-8">
        <div className="shrink-0">
          <BarChart3 size={56} />
        </div>
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          <div className="text-5xl font-medium text-foreground select-text line-clamp-1">{vote.title}</div>
          <div className="text-4xl text-muted select-text">{vote.desc}</div>
        </div>
        <div className="shrink-0">
          <Button
            className={`text-5xl font-normal px-8 py-5 h-auto min-w-0 ${
              isEnded ? 'bg-surface-secondary/70 text-muted' : 'bg-[#fb7299] text-white'
            }`}
          >
            {isEnded ? '已结束' : '参与'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * B站通用卡片组件（游戏等）
 */
export const BilibiliCommonCard: React.FC<{ common: NonNullable<BilibiliAdditionalData>['common'] }> = ({ common }) => {
  if (!common) return null

  const getTagText = () => {
    if (common.sub_type === 'game') return '游戏'
    return common.desc1
  }

  return (
    <div className="flex flex-col gap-4">
      {common.head_text && (
        <div className="flex gap-2 items-center text-4xl text-muted">
          <Gamepad2 size={40} />
          <span>{common.head_text}</span>
        </div>
      )}
      <div className="overflow-hidden rounded-4xl bg-surface">
        <div className="flex gap-8 items-center pl-6 pr-12 py-6">
          <div className="shrink-0">
            <EnhancedImage src={common.cover} alt={common.title} className="w-40 h-40 rounded-2xl object-cover" />
          </div>
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            <div className="text-5xl font-medium text-foreground select-text line-clamp-1">{common.title}</div>
            <div className="flex gap-3 items-center text-4xl">
              <span className="shrink-0 px-3 py-1 rounded-md bg-[#fb7299]/10 text-[#fb7299] text-3xl">{getTagText()}</span>
              {common.sub_type === 'game' && common.desc1 && <span className="text-muted line-clamp-1 select-text">{common.desc1}</span>}
            </div>
            {common.desc2 && <div className="text-4xl text-muted line-clamp-1 select-text">{common.desc2}</div>}
          </div>
          {common.button_text && (
            <div className="shrink-0">
              <Button className="text-5xl font-normal px-8 py-5 h-auto min-w-0 bg-[#fb7299] text-white">{common.button_text}</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * B站视频跳转卡片组件（UGC）
 */
export const BilibiliUgcCard: React.FC<{ ugc: NonNullable<BilibiliAdditionalData>['ugc'] }> = ({ ugc }) => {
  if (!ugc) return null

  return (
    <div className="overflow-hidden rounded-3xl bg-surface">
      <div className="flex gap-8 items-center pr-8">
        <div className="relative shrink-0 p-5">
          <EnhancedImage src={ugc.cover} alt={ugc.title} className="h-52 w-auto rounded-4xl" />
          <div className="absolute bottom-7 right-7 px-3 py-1 rounded-lg bg-black/70 text-white text-3xl">{ugc.duration}</div>
        </div>
        <div className="flex flex-col gap-4 flex-1 min-w-0">
          <div className="text-5xl font-medium text-foreground select-text line-clamp-2 leading-normal">{ugc.title}</div>
          <div className="flex gap-8 items-center text-4xl text-muted">
            <span>{ugc.play}播放</span>
            <span>{ugc.danmaku}弹幕</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * B站相关卡片容器组件
 */
export const BilibiliAdditionalCard: React.FC<{
  additional: BilibiliAdditionalData | undefined
  gap?: boolean
  className?: string
}> = ({ additional, gap = true, className }) => {
  if (!additional) return null

  return (
    <div className={cn(gap && 'px-20 pb-20', className)}>
      {additional.type === 'ADDITIONAL_TYPE_RESERVE' && additional.reserve && <BilibiliReserveCard reserve={additional.reserve} />}
      {additional.type === 'ADDITIONAL_TYPE_VOTE' && additional.vote && <BilibiliVoteCard vote={additional.vote} />}
      {additional.type === 'ADDITIONAL_TYPE_COMMON' && additional.common && <BilibiliCommonCard common={additional.common} />}
      {additional.type === 'ADDITIONAL_TYPE_UGC' && additional.ugc && <BilibiliUgcCard ugc={additional.ugc} />}
    </div>
  )
}
