import { renderRichTextToReact } from '@kkk/richtext'
import { PlayIcon } from '@phosphor-icons/react'
import { Calendar, Heart, MapPin, MessageCircle, Share2, Star } from 'lucide-react'
import React from 'react'

import { isDark } from '../../../../utils/theme'
import { AmbientCover } from '../../../components/AmbientCover'
import { DefaultLayout } from '../../../components/DefaultLayout'
import { QRCodeWithAvatar } from '../../../components/QRCodeWithAvatar'
import type { PosterProps } from '../../../types/ctx'
import type { XiaohongshuNoteInfoData } from './types'

const XHS_RED = '#FF2442'
const xiaohongshuNoteMentionClassName = 'text-[#13386c] dark:text-[#c7daef]'

const formatNumber = (num: string | number): string => {
  if (typeof num === 'string' && !/^\d+$/.test(num.trim())) return num || '0'
  const value = typeof num === 'string' ? Number.parseInt(num, 10) : num
  if (!Number.isFinite(value)) return String(num) || '0'
  return value >= 10000 ? `${(value / 10000).toFixed(1)}万` : value.toLocaleString()
}

const formatDateTime = (value: number | string): string => {
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return value
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return String(value || '未知时间')
  const date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp)
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ]
  return `${parts.join('-')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const NoteDiffuseBackground: React.FC<PosterProps<XiaohongshuNoteInfoData>> = ({ data, ctx }) => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
    <AmbientCover src={data.image_url} ctx={ctx} />
    <div className="absolute inset-0 opacity-[0.4] mix-blend-overlay dark:mix-blend-soft-light">
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="xhsNoteNoise">
            <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues="0 1" />
              <feFuncG type="discrete" tableValues="0 1" />
              <feFuncB type="discrete" tableValues="0 1" />
              <feFuncA type="linear" slope="2.5" intercept="-0.6" />
            </feComponentTransfer>
          </filter>
          <mask id="xhsNoteNoiseMask">
            <linearGradient id="xhsNoteNoiseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.85" />
              <stop offset="25%" stopColor="white" stopOpacity="0.4" />
              <stop offset="50%" stopColor="white" stopOpacity="0.08" />
              <stop offset="75%" stopColor="white" stopOpacity="0.4" />
              <stop offset="100%" stopColor="white" stopOpacity="0.85" />
            </linearGradient>
            <rect width="100%" height="100%" fill="url(#xhsNoteNoiseGradient)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" filter="url(#xhsNoteNoise)" mask="url(#xhsNoteNoiseMask)" fill="white" />
      </svg>
    </div>
  </div>
)

const NoteSystemLabel: React.FC<PosterProps<XiaohongshuNoteInfoData>> = ({ data }) => (
  <div className="flex items-center justify-between gap-8">
    <div className="flex items-center gap-4">
      <span className="h-8 w-2 rounded-full" style={{ backgroundColor: XHS_RED }} />
      <span className="text-[26px] font-bold uppercase text-foreground/60">Xiaohongshu Note</span>
    </div>
    <span className="max-w-180 truncate font-mono text-[26px] text-foreground/40 select-text">ID: {data.note_id}</span>
  </div>
)

const NoteCover: React.FC<PosterProps<XiaohongshuNoteInfoData>> = ({ data }) => {
  const images = data.image_list?.length ? data.image_list : [data.image_url]
  const previewImages = data.is_video ? [] : images.slice(1, 4).filter(Boolean)
  const remainingPreviewCount = Math.max(images.length - previewImages.length - 1, 0)

  return (
    <section className="relative mt-12 overflow-hidden rounded-[3rem] shadow-2xl">
      <img
        src={data.image_url}
        alt={data.title || '小红书笔记封面'}
        className="block h-auto w-full object-cover"
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
      />
      {data.is_video && (
        <PlayIcon size={104} weight="fill" aria-label="视频笔记" className="absolute right-10 bottom-10 text-white/55 drop-shadow-2xl" />
      )}
      {previewImages.length > 0 && (
        <div className="absolute right-10 bottom-10 flex items-center -space-x-5 drop-shadow-2xl">
          {previewImages.map((url, index) => (
            <img
              key={`${url}-${index}`}
              src={url}
              alt="图集预览"
              className="h-28 w-28 rounded-3xl object-cover ring-2 ring-white/25"
              style={{ transform: `rotate(${(index - 1) * 8}deg)` }}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
          ))}
          {remainingPreviewCount > 0 && (
            <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-black/50 px-5 text-[32px] font-black text-white ring-2 ring-white/25 backdrop-blur-xs">
              +{remainingPreviewCount}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

const NoteAuthorRow: React.FC<PosterProps<XiaohongshuNoteInfoData>> = ({ data }) => (
  <section className="mt-14 flex items-center gap-6">
    <img
      src={data.author.avatar}
      alt={data.author.nickname}
      className="h-28 w-28 shrink-0 rounded-full border-4 object-cover shadow-xl"
      style={{ borderColor: `${XHS_RED}33` }}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
    />
    <div className="min-w-0">
      <div className="max-w-200 truncate text-[52px] font-black leading-tight text-foreground select-text">{data.author.nickname}</div>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[30px] text-muted">
        <span className="inline-flex items-center gap-2">
          <Calendar size={28} />
          <span className="select-text">{formatDateTime(data.time)}</span>
        </span>
        {data.ip_location && (
          <span className="inline-flex items-center gap-2">
            <MapPin size={28} />
            <span className="select-text">{data.ip_location}</span>
          </span>
        )}
      </div>
    </div>
  </section>
)

const NoteContent: React.FC<PosterProps<XiaohongshuNoteInfoData>> = ({ data }) => (
  <section className="mt-10">
    {data.title && (
      <h1
        className="text-[68px] font-black leading-[1.2] text-foreground select-text"
        style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
      >
        {data.title}
      </h1>
    )}
    <div
      className="mt-8 whitespace-pre-wrap text-[42px] font-medium leading-[1.55] text-foreground/80 select-text"
      style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
    >
      {renderRichTextToReact(data.desc, { mention: { className: xiaohongshuNoteMentionClassName } })}
    </div>
  </section>
)

const NoteStatsRow: React.FC<PosterProps<XiaohongshuNoteInfoData>> = ({ data }) => {
  const stats = [
    { icon: Heart, value: data.statistics.liked_count, label: '点赞', accent: true },
    { icon: MessageCircle, value: data.statistics.comment_count, label: '评论', accent: false },
    { icon: Star, value: data.statistics.collected_count, label: '收藏', accent: false },
    { icon: Share2, value: data.statistics.share_count, label: '分享', accent: false }
  ]

  return (
    <section className="mt-14 flex flex-wrap items-end gap-x-20 gap-y-8">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div key={stat.label} className="min-w-40">
            <div className="flex items-center gap-3 text-[28px] font-semibold text-muted">
              <Icon
                size={36}
                strokeWidth={2.2}
                style={stat.accent ? { color: XHS_RED, fill: XHS_RED } : undefined}
                className={stat.accent ? undefined : 'text-foreground/70'}
              />
              <span>{stat.label}</span>
            </div>
            <div className="mt-3 text-[64px] font-black leading-none text-foreground tabular-nums select-text">
              {formatNumber(stat.value)}
            </div>
          </div>
        )
      })}
    </section>
  )
}

const NoteFooter: React.FC<PosterProps<XiaohongshuNoteInfoData>> = ({ data, ctx }) => (
  <footer className="mt-16">
    <div className="flex items-center justify-between gap-16">
      <img src="/image/xiaohongshu/logo.png" alt="小红书" className="h-16 w-auto shrink-0 object-contain opacity-90" />
      {data.share_url && (
        <div className="flex items-center gap-8">
          <div className="text-right">
            <div className="text-[32px] font-black text-foreground">扫码查看原笔记</div>
            <div className="mt-2 text-[26px] text-muted">长按识别二维码</div>
          </div>
          <div className="shrink-0 drop-shadow-2xl">
            <QRCodeWithAvatar value={data.share_url} useDarkTheme={isDark(ctx)} alt="笔记二维码" className="h-60 w-60" />
          </div>
        </div>
      )}
    </div>
  </footer>
)

export const XiaohongshuNoteInfo: React.FC<PosterProps<XiaohongshuNoteInfoData>> = React.memo((props) => (
  <DefaultLayout {...props} className="relative overflow-hidden">
    <NoteDiffuseBackground {...props} />
    <section className="relative z-10 px-20 pt-16">
      <NoteSystemLabel {...props} />
      <NoteCover {...props} />
      <NoteAuthorRow {...props} />
      <NoteContent {...props} />
      <NoteStatsRow {...props} />
      <NoteFooter {...props} />
    </section>
  </DefaultLayout>
))

XiaohongshuNoteInfo.displayName = 'XiaohongshuNoteInfo'

export default XiaohongshuNoteInfo
