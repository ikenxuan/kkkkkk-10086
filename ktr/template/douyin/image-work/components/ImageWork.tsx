import { extractRichTextPlainText, renderRichTextToReact, type RichTextRenderOptions } from '@kkk/richtext'
import { ImageIcon, MapPinIcon, MusicNoteIcon, UserPlusIcon, UsersIcon, UsersThreeIcon, VideoCameraIcon } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { Clock3, Hash } from 'lucide-react'
import React from 'react'

import { DefaultLayout } from '../../../components/DefaultLayout'
import { AmbientCover } from '../../../components/AmbientCover'
import { GlowImage } from '../../../components/GlowImage'
import { QRCodeWithAvatar } from '../../../components/QRCodeWithAvatar'
import type { PosterProps } from '../../../types/ctx'
import { isDark as isDarkMode } from '../../../../utils/theme'
import { cn } from '../../../../utils/cn'
import { DouyinCommentIcon, DouyinFavoriteIcon, DouyinLikeIcon, DouyinShareIcon } from '../../components/Icons'
import { formatDouyinPublishTime } from '../../video-work/components/publish-time'
import type { DouyinImageMediaType, DouyinImageWorkData } from './types'

const LivePhotoIcon: React.FC<{ size?: number; className?: string; weight?: 'fill' }> = ({ size = 28, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="50" cy="50" r="37" stroke="currentColor" strokeWidth="6" strokeDasharray="2 9" strokeLinecap="round" />
    <circle cx="50" cy="50" r="25" stroke="currentColor" strokeWidth="6" />
    <circle cx="50" cy="50" r="10" fill="currentColor" />
  </svg>
)

const imageMediaTypeMeta = {
  static: { label: '图片', icon: ImageIcon },
  live: { label: '实况', icon: LivePhotoIcon },
  clip: { label: '短片', icon: VideoCameraIcon }
} satisfies Record<
  DouyinImageMediaType,
  {
    label: string
    icon: React.FC<{ size?: number; className?: string; weight?: 'fill' }>
  }
>

const getTitleClassName = (titleLength: number): string => {
  if (titleLength > 96) return 'text-[42px] leading-[1.34]'
  if (titleLength > 72) return 'text-[48px] leading-[1.3]'
  if (titleLength > 48) return 'text-[54px] leading-[1.26]'
  return 'text-[62px] leading-[1.18]'
}

/**
 * 多段透明度停靠点用于模拟 smoothstep，让封面从环境柔光进入清晰主体时没有明显的线性渐变拐点。
 */
const ambientCoverMask =
  'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.08) 6%, rgba(0,0,0,0.32) 16%, rgba(0,0,0,0.68) 28%, black 42%, black 58%, rgba(0,0,0,0.68) 72%, rgba(0,0,0,0.32) 84%, rgba(0,0,0,0.08) 94%, transparent 100%)'

const foregroundCoverMask =
  'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.1) 4%, rgba(0,0,0,0.35) 10%, rgba(0,0,0,0.68) 17%, rgba(0,0,0,0.9) 23%, black 30%, black 70%, rgba(0,0,0,0.9) 77%, rgba(0,0,0,0.68) 83%, rgba(0,0,0,0.35) 90%, rgba(0,0,0,0.1) 96%, transparent 100%)'

const getCoverUrl = (data: DouyinImageWorkData): string | undefined => data.image_list.images[0]?.url

const DouyinDiffuseBackground: React.FC<PosterProps<DouyinImageWorkData>> = ({ data, ctx }) => {
  const coverUrl = getCoverUrl(data)

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
      {coverUrl && <AmbientCover src={coverUrl} ctx={ctx} />}

      <div className="absolute inset-0 opacity-[0.35] mix-blend-overlay dark:mix-blend-soft-light">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="douyinImageWorkNoise">
              <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" result="gray" />
              <feComponentTransfer>
                <feFuncR type="discrete" tableValues="0 1" />
                <feFuncG type="discrete" tableValues="0 1" />
                <feFuncB type="discrete" tableValues="0 1" />
              </feComponentTransfer>
              <feComponentTransfer>
                <feFuncA type="linear" slope="2" intercept="-0.5" />
              </feComponentTransfer>
            </filter>
          </defs>
          <rect width="100%" height="100%" filter="url(#douyinImageWorkNoise)" mask="url(#douyinImageWorkNoiseMask)" fill="white" />
        </svg>
      </div>
    </div>
  )
}

const DouyinPosterHeader: React.FC<PosterProps<DouyinImageWorkData>> = ({ data, ctx }) => {
  const { avater_url, username, create_time, ip_location } = data
  const useDarkTheme = isDarkMode(ctx)
  const publishTime = formatDouyinPublishTime(create_time)

  return (
    <header className="flex items-start justify-between gap-14">
      <div className="flex min-w-0 items-center gap-6">
        <img
          src={avater_url}
          alt="头像"
          className="h-24 w-24 shrink-0 rounded-full object-cover shadow-2xl"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
        />
        <div className="min-w-0">
          <div className="max-w-165 truncate text-[44px] font-black leading-tight text-foreground select-text">{username}</div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[30px] text-muted">
            <span className="inline-flex items-center gap-2">
              <Clock3 size={28} />
              <span className="select-text">{publishTime}</span>
            </span>
            {ip_location && (
              <span className="inline-flex items-center gap-2">
                <MapPinIcon size={30} weight="fill" />
                <span className="select-text">{ip_location}</span>
              </span>
            )}
          </div>
        </div>
      </div>
      <img
        src={useDarkTheme ? '/image/douyin/dylogo-light.svg' : '/image/douyin/dylogo-dark.svg'}
        alt="抖音"
        className="mt-2 h-17 w-auto shrink-0 object-contain opacity-90"
      />
    </header>
  )
}

const DouyinPosterTitle: React.FC<PosterProps<DouyinImageWorkData>> = ({ data }) => {
  const { title, desc } = data
  const hasTitle = Boolean(title?.nodes.length)
  const hasDesc = Boolean(desc?.nodes.length)
  const titleLength = title ? extractRichTextPlainText(title).length : 0
  const titleClassName = getTitleClassName(titleLength)
  const richTextOptions: RichTextRenderOptions = {
    hashtag: {
      className: cn('text-inherit opacity-60', !hasTitle && 'text-6xl')
    },
    mention: {
      className: 'text-inherit'
    }
  }

  if (!hasTitle && !hasDesc) {
    return <h1 className="mt-14 text-[68px] font-black leading-[1.16] text-foreground select-text">抖音图文作品</h1>
  }

  return (
    <section className="mt-13">
      {hasTitle && title && (
        <h1
          className={`${titleClassName} font-bold text-foreground select-text`}
          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
        >
          {renderRichTextToReact(title, richTextOptions)}
        </h1>
      )}
      {hasDesc && (
        <div
          className={cn('mt-7 whitespace-pre-wrap select-text', !hasTitle ? 'text-6xl font-bold' : 'text-5xl font-medium', 'leading-tight')}
          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
        >
          {renderRichTextToReact(desc, richTextOptions)}
        </div>
      )}
    </section>
  )
}

const DouyinImageCover: React.FC<PosterProps<DouyinImageWorkData>> = ({ data }) => {
  const { image_list, music } = data
  const cover = image_list.images[0]
  if (!cover?.url) return null

  const totalCount = image_list.total_count || image_list.images.length
  const mediaType = cover.media_type ?? 'static'
  const mediaMeta = imageMediaTypeMeta[mediaType]
  const MediaIcon = mediaMeta.icon
  const previewImages = image_list.images.slice(1, 4).filter((image) => image.url)
  const remainingPreviewCount = Math.max(totalCount - previewImages.length - 1, 0)

  return (
    <section className="relative -mx-20 mt-12 overflow-visible">
      <div
        className="absolute -inset-x-20 -inset-y-32 z-0 overflow-hidden"
        style={{
          maskImage: ambientCoverMask,
          WebkitMaskImage: ambientCoverMask
        }}
      >
        <img
          src={cover.url}
          alt=""
          className="h-full w-full scale-[1.16] object-cover opacity-48 blur-[72px] saturate-[1.2]"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
        />
      </div>

      <img
        src={cover.url}
        alt="图文封面"
        className="relative z-10 block h-auto w-full drop-shadow-xl"
        style={{
          maskImage: foregroundCoverMask,
          WebkitMaskImage: foregroundCoverMask
        }}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
      />

      <div className="absolute left-24 top-12 z-30 flex items-center gap-4 text-foreground/85">
        <MediaIcon size={72} weight="fill" />
        <span className="text-[34px] font-black select-text">{mediaMeta.label}</span>
      </div>

      {previewImages.length > 0 && (
        <div className="absolute right-24 top-8 z-30 flex items-center -space-x-5 drop-shadow-2xl">
          {previewImages.map((image, index) => (
            <img
              key={`${image.url}-${index}`}
              src={image.url}
              alt="图文预览"
              className="h-28 w-28 rounded-3xl object-cover ring-2 ring-white/25"
              style={{ transform: `rotate(${(index - 1) * 8}deg)` }}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
          ))}
          {remainingPreviewCount > 0 && (
            <div className="flex h-28 w-28 items-center justify-center rounded-3xl backdrop-blur-xs bg-black/50 px-5 text-[32px] font-black text-white ring-2 ring-white/25">
              +{remainingPreviewCount}
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-12 right-24 z-30 flex items-center gap-5 text-foreground/85">
        <span className="text-[34px] font-black tabular-nums">共 {totalCount} 张</span>
      </div>

      {music && (
        <div className="absolute bottom-12 left-24 z-30 flex max-w-212.5 items-center gap-5 text-foreground/85">
          {music.cover ? (
            <div className="relative h-20 w-20 shrink-0">
              <GlowImage glowStrength={1} blurRadius={20}>
                <img
                  src={music.cover}
                  alt="BGM封面"
                  className="relative z-10 h-full w-full rounded-2xl object-cover"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
              </GlowImage>
            </div>
          ) : (
            <MusicNoteIcon size={44} weight="fill" className="shrink-0" />
          )}
          <div className="min-w-0">
            <div className="truncate text-[36px] font-black leading-tight select-text">{music.title}</div>
            <div className="truncate text-[27px] font-semibold text-foreground/60 select-text">{music.author}</div>
          </div>
        </div>
      )}
    </section>
  )
}

const DouyinSignalLine: React.FC<PosterProps<DouyinImageWorkData>> = ({ data }) => {
  const { dianzan, pinglun, shouchang, share, suggest_word } = data
  const renderTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss')
  const stats = [
    { icon: DouyinLikeIcon, value: dianzan, label: '点赞' },
    { icon: DouyinCommentIcon, value: pinglun, label: '评论' },
    { icon: DouyinFavoriteIcon, value: shouchang, label: '收藏' },
    { icon: DouyinShareIcon, value: share, label: '分享' }
  ]

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end gap-x-16 gap-y-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="min-w-37.5">
              <div className="flex items-center gap-3 text-[28px] font-semibold text-muted">
                <Icon size={36} weight="fill" className="text-foreground/80" />
                <span>{stat.label}</span>
              </div>
              <div className="mt-2 text-[64px] font-black leading-none text-foreground tabular-nums select-text">{stat.value}</div>
            </div>
          )
        })}
      </div>
      <div className="mt-8 flex min-w-0 flex-col gap-3 text-[29px] leading-[1.45] text-muted">
        {suggest_word && (
          <div className="min-w-0 truncate select-text">
            <span>{suggest_word.hint_text}</span>
            <span className="ml-2 font-black text-foreground">{suggest_word.word}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className="select-text">图片生成于: {renderTime}</span>
        </div>
      </div>
    </section>
  )
}

const DouyinCoCreatorList: React.FC<PosterProps<DouyinImageWorkData> & { coCreatorCount: number }> = ({ data, coCreatorCount }) => {
  const allCreators = data.cooperation_info?.co_creators ?? []
  const creators = allCreators.filter((creator) => creator.nickname !== data.username)
  if (creators.length === 0) return null

  const visibleCreators = creators.slice(0, 8)
  const hasSubscriberInList = allCreators.some((creator) => creator.nickname === data.username)
  const remainingCount = Math.max(coCreatorCount - visibleCreators.length - (hasSubscriberInList ? 1 : 0), 0)

  return (
    <section className="mt-16">
      <div className="flex items-center gap-3 text-[34px] font-black text-foreground">
        <UsersIcon size={42} weight="fill" className="text-foreground/80" />
        <span>共 {coCreatorCount} 人共创</span>
      </div>
      <div className="mt-6 flex min-w-0 flex-wrap items-center gap-x-10 gap-y-6 overflow-hidden">
        {visibleCreators.map((creator, index) => (
          <div key={`${creator.nickname || 'creator'}-${index}`} className="flex min-w-0 max-w-77.5 items-center gap-4">
            <img
              src={creator.avatar_url || data.avater_url}
              alt="共创者头像"
              className="h-18 w-18 shrink-0 rounded-full object-cover shadow-xl"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
            <div className="min-w-0">
              <div className="truncate text-[28px] font-black leading-tight text-foreground select-text">
                {creator.nickname || '未提供'}
              </div>
              <div className="mt-1 truncate text-[23px] font-semibold text-muted select-text">{creator.role_title || '共创者'}</div>
            </div>
          </div>
        ))}
        {remainingCount > 0 && <div className="text-[32px] font-black text-muted">剩余 {remainingCount} 个...</div>}
      </div>
    </section>
  )
}

const DouyinPosterFooter: React.FC<PosterProps<DouyinImageWorkData>> = ({ data, ctx }) => {
  const { avater_url, username, 抖音号, 获赞, 关注, 粉丝, share_url } = data
  const useDarkTheme = isDarkMode(ctx)
  const stats = [
    { icon: DouyinLikeIcon, iconSize: 26, label: '获赞', value: 获赞 },
    { icon: UserPlusIcon, iconSize: 32, label: '关注', value: 关注 },
    { icon: UsersThreeIcon, iconSize: 32, label: '粉丝', value: 粉丝 }
  ]

  return (
    <footer className="mt-10 flex items-start justify-between gap-16">
      <div className="min-w-0 flex-1 pt-10">
        <div className="flex items-center gap-6">
          <img
            src={avater_url}
            alt="头像"
            className="h-24 w-24 shrink-0 rounded-full object-cover shadow-xl"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
          />
          <div className="min-w-0">
            <div className="max-w-162.5 truncate text-[48px] font-black leading-tight text-foreground select-text">{username}</div>
            <div className="mt-3 flex items-center gap-2 text-[30px] text-muted">
              <Hash size={28} />
              <span className="truncate select-text">抖音号: {抖音号}</span>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-x-14 gap-y-6">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="min-w-37.5">
                <div className="flex items-center gap-3 text-[25px] font-semibold text-muted">
                  <Icon size={stat.iconSize} weight="fill" className="text-foreground/80" />
                  <span>{stat.label}</span>
                </div>
                <div className="mt-2 text-[32px] font-black leading-none text-foreground select-text">{stat.value}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="shrink-0 text-center">
        <div className="drop-shadow-2xl">
          <QRCodeWithAvatar value={share_url} avatarUrl={avater_url} useDarkTheme={useDarkTheme} alt="二维码" className="h-75 w-75" />
        </div>
        <div className="mt-2 text-[28px] font-black text-foreground/80">扫码查看作品详情</div>
      </div>
    </footer>
  )
}

export const DouyinImageWork: React.FC<PosterProps<DouyinImageWorkData>> = React.memo((props) => {
  const coCreatorCount = props.data.cooperation_info?.co_creator_nums ?? props.data.cooperation_info?.co_creators?.length ?? undefined
  const hasCoCreators = !!coCreatorCount && coCreatorCount > 0

  return (
    <DefaultLayout ctx={props.ctx} className="relative overflow-hidden">
      <DouyinDiffuseBackground {...props} />

      <section className="relative z-10 px-20 pt-18">
        <DouyinPosterHeader {...props} />
        <DouyinPosterTitle {...props} />
        <DouyinImageCover {...props} />
        <DouyinSignalLine {...props} />
        {hasCoCreators && <DouyinCoCreatorList {...props} coCreatorCount={coCreatorCount} />}
        <DouyinPosterFooter {...props} />
      </section>
    </DefaultLayout>
  )
})

DouyinImageWork.displayName = 'DouyinImageWork'

export default DouyinImageWork
