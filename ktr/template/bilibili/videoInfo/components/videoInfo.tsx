import { renderRichTextToReact } from '@kkk/richtext'
import { format, fromUnixTime } from 'date-fns'
import { Calendar } from 'lucide-react'
import React from 'react'

import { DefaultLayout } from '../../../components/DefaultLayout'
import { AmbientCover } from '../../../components/AmbientCover'
import { GlowText } from '../../../components/GlowImage'
import type { PosterProps } from '../../../types/ctx'
import { isDark as isDarkMode } from '../../../../utils/theme'
import { CoinIcon, CommentIcon, PlayIcon, ShareIcon, StarIcon, ThumbUpIcon } from '../../components/Icons'
import { EnhancedImage } from '../../components/shared'
import type { BilibiliHotDanmaku } from '../../components/types'
import type { BilibiliVideoInfoData } from './types'

const formatNumber = (num: number): string => {
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`
  return num.toLocaleString()
}

const coverMaskStyle: React.CSSProperties = {
  maskImage: 'linear-gradient(to bottom, black 20%, transparent 100%)',
  WebkitMaskImage: 'linear-gradient(to bottom, black 20%, transparent 100%)'
}

/**
 * 全局氛围背景层：模糊封面 + 渐变遮罩 + 高对比杂色纹理
 */
const AmbientBackground: React.FC<{ pic: string; ctx: PosterProps<BilibiliVideoInfoData>['ctx'] }> = React.memo(({ pic, ctx }) => (
  <div className="absolute inset-0 overflow-hidden -z-10">
    <AmbientCover src={pic} ctx={ctx} />

    {/* 高对比杂色纹理层 */}
    <div className="absolute inset-0 pointer-events-none opacity-[0.45] mix-blend-overlay dark:mix-blend-soft-light">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="biliNoise">
            <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues="0 1" />
              <feFuncG type="discrete" tableValues="0 1" />
              <feFuncB type="discrete" tableValues="0 1" />
            </feComponentTransfer>
            <feComponentTransfer>
              <feFuncA type="linear" slope="2.5" intercept="-0.6" />
            </feComponentTransfer>
          </filter>
          <mask id="noiseMask">
            <linearGradient id="noiseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.85" />
              <stop offset="25%" stopColor="white" stopOpacity="0.4" />
              <stop offset="50%" stopColor="white" stopOpacity="0.08" />
              <stop offset="75%" stopColor="white" stopOpacity="0.4" />
              <stop offset="100%" stopColor="white" stopOpacity="0.85" />
            </linearGradient>
            <rect width="100%" height="100%" fill="url(#noiseGradient)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" filter="url(#biliNoise)" mask="url(#noiseMask)" fill="white" />
      </svg>
    </div>
  </div>
))

AmbientBackground.displayName = 'AmbientBackground'

const MAX_DANMAKU_ROWS = 4

/**
 * 封面弹幕层：模拟视频平台截图中的滚动弹幕轨道，行数由 MAX_DANMAKU_ROWS 控制。
 */
const DanmakuOverlay: React.FC<{ items: BilibiliHotDanmaku[] }> = React.memo(({ items }) => {
  if (!items.length) return null

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 overflow-hidden px-16"
      style={{
        height: `calc(${MAX_DANMAKU_ROWS} * 20rem)`,
        maskImage: 'linear-gradient(to right, transparent 0, black 3rem, black calc(100% - 10rem), transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 3rem, black calc(100% - 10rem), transparent 100%)'
      }}
    >
      {/* <div className="absolute inset-x-0 -top-10 bottom-0 bg-linear-to-b from-black/60 via-black/12 to-transparent" /> */}
      <div className="relative pt-8 overflow-visible whitespace-normal text-[0] leading-16">
        {items.map((item, index) => (
          <span
            key={`${item.content}-${index}`}
            className="mr-20 inline-block shrink-0 whitespace-nowrap align-top text-4xl font-black leading-16 text-white"
            style={{
              marginLeft: index === 0 ? undefined : `${((index * 5 + item.content.length * 3) % 5) * 2}rem`,
              opacity: Math.max(0.2, 1 - index * 0.025),
              textShadow: '0 3px 8px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.95)',
              WebkitTextStroke: '1px rgba(0,0,0,0.58)'
            }}
          >
            {item.content}
          </span>
        ))}
      </div>
    </div>
  )
})

DanmakuOverlay.displayName = 'DanmakuOverlay'

export const BilibiliVideoInfo: React.FC<PosterProps<BilibiliVideoInfoData>> = React.memo((props) => {
  return (
    <DefaultLayout ctx={props.ctx} className="relative overflow-hidden">
      {/* 全局氛围层 */}
      <AmbientBackground pic={props.data.pic} ctx={props.ctx} />

      <div className="relative z-10">
        {/* 封面：全宽，底部极轻微溶解，不接文字 */}
        <div className="relative overflow-hidden" style={coverMaskStyle}>
          <EnhancedImage src={props.data.pic} alt={props.data.title} className="object-cover w-full" placeholder="视频封面" />
          {props.data.hotDanmaku && <DanmakuOverlay items={props.data.hotDanmaku} />}
        </div>

        {/* 内容区：压在封面溶解区域之上 */}
        <div className="flex flex-col gap-10 px-16 pt-20">
          {/* 标题区 */}
          <div className="flex flex-col gap-5">
            <h1 className="text-[80px] font-black leading-tight text-foreground tracking-tight">{props.data.title}</h1>
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-6 text-3xl text-foreground/30">
                {/* 时间 */}
                <div className="flex items-center gap-2">
                  <Calendar size={32} className="text-foreground/20" />
                  <span>{format(fromUnixTime(props.data.ctime), 'yyyy-MM-dd HH:mm')}</span>
                </div>
                {/* 播放 */}
                <span className="flex items-center gap-1.5">
                  <PlayIcon size={28} className="text-foreground/20" />
                  {formatNumber(props.data.stat.view)}
                </span>
                {/* 评论 */}
                <span className="flex items-center gap-1.5">
                  <CommentIcon variant="line" size={28} className="text-foreground/20" />
                  {formatNumber(props.data.stat.reply)}
                </span>
              </div>
              {/* BV号 */}
              <span className="font-mono text-3xl text-foreground/30">稿件BV号：{props.data.bvid}</span>
            </div>
          </div>

          {/* 视频简介 */}
          {props.data.desc && (
            <div className="text-5xl leading-relaxed text-foreground/75 pb-10">
              {renderRichTextToReact(props.data.desc, {
                at: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                topic: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                lottery: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                webLink: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                vote: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                viewPicture: { className: 'text-[#006A9E] dark:text-[#58B0D5]' }
              })}
            </div>
          )}

          {/* 互动数据：点赞 / 投币 / 收藏 / 分享 */}
          <div className="flex justify-around items-center">
            <div className="flex items-center gap-5 text-5xl">
              <ThumbUpIcon size={90} className="text-foreground/30" />
              <span className="tabular-nums text-foreground">{formatNumber(props.data.stat.like)}</span>
            </div>
            <div className="flex items-center gap-5 text-5xl">
              <CoinIcon size={90} className="text-foreground/30" />
              <span className="tabular-nums text-foreground">{formatNumber(props.data.stat.coin)}</span>
            </div>
            <div className="flex items-center gap-5 text-5xl">
              <StarIcon size={90} className="text-foreground/30" />
              <span className="tabular-nums text-foreground">{formatNumber(props.data.stat.favorite)}</span>
            </div>
            <div className="flex items-center gap-5 text-5xl">
              <ShareIcon size={90} className="text-foreground/30" />
              <span className="tabular-nums text-foreground">{formatNumber(props.data.stat.share)}</span>
            </div>
          </div>

          <div />

          {/* UP主信息：头像左，文字右，利用 flex 自然撑开宽度 */}
          <div className="flex gap-10 items-center ml-6">
            <div className="relative shrink-0 w-56 h-56 flex items-center justify-center">
              <EnhancedImage
                src={props.data.owner.face}
                alt={props.data.owner.name}
                className="object-cover w-44 h-44 rounded-full"
                placeholder={props.data.owner.name.charAt(0)}
                isCircular
              />
              {props.data.owner.frame && <EnhancedImage src={props.data.owner.frame} alt="头像框" className="absolute inset-0 scale-138" />}
            </div>
            <div className="flex flex-col gap-8 min-w-0 flex-1">
              <GlowText glowStrength={isDarkMode(props.ctx) ? 1 : 0}>
                <p
                  className="text-7xl font-bold truncate"
                  style={props.data.owner.usernameMeta?.nicknameColor ? { color: props.data.owner.usernameMeta.nicknameColor } : undefined}
                >
                  {props.data.owner.usernameMeta?.name ?? props.data.owner.name}
                </p>
              </GlowText>
              <p className="text-5xl text-scrollbar">UID: {props.data.owner.mid}</p>
            </div>
          </div>
        </div>
      </div>
    </DefaultLayout>
  )
})

BilibiliVideoInfo.displayName = 'BilibiliVideoInfo'

export default BilibiliVideoInfo
