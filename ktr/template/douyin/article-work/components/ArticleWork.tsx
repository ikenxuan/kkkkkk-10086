import { UserPlusIcon, UsersThreeIcon } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { BookOpenText, Clock3, Hash } from 'lucide-react'
import React from 'react'
import ReactMarkdown from 'react-markdown'

import { DefaultLayout } from '../../../components/DefaultLayout'
import { QRCodeWithAvatar } from '../../../components/QRCodeWithAvatar'
import type { PosterProps } from '../../../types/ctx'
import { isDark as isDarkMode } from '../../../../utils/theme'
import { DouyinCommentIcon, DouyinFavoriteIcon, DouyinLikeIcon, DouyinShareIcon } from '../../components/Icons'
import type { DouyinArticleWorkData } from './types'

const getTitleClassName = (titleLength: number): string => {
  if (titleLength > 96) return 'text-[42px] leading-[1.34]'
  if (titleLength > 72) return 'text-[48px] leading-[1.3]'
  if (titleLength > 48) return 'text-[54px] leading-[1.26]'
  return 'text-[62px] leading-[1.18]'
}

const getArticleImageUrl = (image?: DouyinArticleWorkData['images'][number]): string | undefined =>
  image?.ai_high_image_url || image?.high_image_url || image?.origin_image_url || image?.markdown_url

const preprocessMarkdown = (markdown: string): string =>
  markdown.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+width=\d+)?(?:\s+height=\d+)?\)/g, '![$1]($2)')

const DouyinDiffuseBackground: React.FC<PosterProps<DouyinArticleWorkData>> = ({ data }) => {
  const coverUrl = getArticleImageUrl(data.images[0])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
      {coverUrl && (
        <img
          src={coverUrl}
          alt=""
          className="absolute inset-0 h-full w-full scale-150 object-cover opacity-50 blur-[120px] saturate-[1.8]"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-b from-background/70 via-background/50 to-background/70" />

      <div className="absolute inset-0 opacity-[0.35] mix-blend-overlay dark:mix-blend-soft-light">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="douyinArticleWorkNoise">
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
            <mask id="douyinArticleWorkNoiseMask">
              <linearGradient id="douyinArticleWorkNoiseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="white" stopOpacity="1" />
                <stop offset="15%" stopColor="white" stopOpacity="0.6" />
                <stop offset="50%" stopColor="white" stopOpacity="0.15" />
                <stop offset="85%" stopColor="white" stopOpacity="0.6" />
                <stop offset="100%" stopColor="white" stopOpacity="1" />
              </linearGradient>
              <rect width="100%" height="100%" fill="url(#douyinArticleWorkNoiseGradient)" />
            </mask>
          </defs>
          <rect width="100%" height="100%" filter="url(#douyinArticleWorkNoise)" mask="url(#douyinArticleWorkNoiseMask)" fill="white" />
        </svg>
      </div>
    </div>
  )
}

const DouyinPosterHeader: React.FC<PosterProps<DouyinArticleWorkData>> = ({ data, ctx }) => {
  const { avater_url, username, create_time, read_time } = data
  const useDarkTheme = isDarkMode(ctx)

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
              <span className="select-text">{create_time}</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <BookOpenText size={30} />
              <span className="select-text">阅读 {read_time} 分钟</span>
            </span>
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

const DouyinArticleTitle: React.FC<PosterProps<DouyinArticleWorkData>> = ({ data }) => (
  <section className="mt-13">
    <h1
      className={`${getTitleClassName(data.title.length)} font-bold text-foreground select-text`}
      style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
    >
      {data.title}
    </h1>
  </section>
)

const DouyinArticleContent: React.FC<PosterProps<DouyinArticleWorkData>> = ({ data }) => {
  const imageMap = new Map<string, string>()
  data.images.forEach((image) => {
    const highQualityUrl = getArticleImageUrl(image)
    if (highQualityUrl) imageMap.set(image.markdown_url, highQualityUrl)
  })

  return (
    <section className="mt-12 select-text">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h2 className="mt-14 text-[56px] font-black leading-tight text-foreground">{children}</h2>,
          h2: ({ children }) => <h2 className="mt-12 text-[50px] font-black leading-tight text-foreground">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-10 text-[44px] font-black leading-snug text-foreground">{children}</h3>,
          h4: ({ children }) => <h4 className="mt-9 text-[40px] font-bold leading-snug text-foreground">{children}</h4>,
          p: ({ children }) => <p className="mb-7 text-[42px] font-medium leading-[1.62] text-foreground/90">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-8 list-inside list-disc text-[42px] font-medium leading-[1.6] text-foreground/90">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-8 list-inside list-decimal text-[42px] font-medium leading-[1.6] text-foreground/90">{children}</ol>
          ),
          li: ({ children }) => <li className="mb-3">{children}</li>,
          strong: ({ children }) => <strong className="font-black text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic text-foreground/80">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="my-10 pl-7 text-[40px] font-medium leading-[1.62] text-muted">{children}</blockquote>
          ),
          code: ({ children }) => <code className="font-mono text-[34px] text-foreground/80">{children}</code>,
          img: ({ src, alt }) => {
            const imageUrl = src ? imageMap.get(src) || src : ''
            if (!imageUrl) return null

            return (
              <figure className="relative -mx-20 my-12 overflow-visible">
                <div
                  className="absolute -inset-x-16 -inset-y-20 z-0 overflow-hidden"
                  style={{
                    maskImage: 'linear-gradient(to bottom, transparent 0%, black 28%, black 72%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 28%, black 72%, transparent 100%)'
                  }}
                >
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-full w-full scale-[1.08] object-cover opacity-62 blur-[46px] saturate-[1.15]"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                  />
                </div>
                <img
                  src={imageUrl}
                  alt={alt || '文章图片'}
                  className="relative z-10 block h-auto w-full drop-shadow-2xl"
                  style={{
                    maskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)'
                  }}
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
                {alt && alt !== '图片描述' && (
                  <figcaption className="relative z-10 mt-5 px-20 text-[30px] font-medium text-muted">{alt}</figcaption>
                )}
              </figure>
            )
          }
        }}
      >
        {preprocessMarkdown(data.markdown)}
      </ReactMarkdown>
    </section>
  )
}

const DouyinSignalLine: React.FC<PosterProps<DouyinArticleWorkData>> = ({ data }) => {
  const { dianzan, pinglun, shouchang, share } = data
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
      <div className="mt-8 text-[29px] leading-[1.45] text-muted">
        <span className="select-text">图片生成于: {renderTime}</span>
      </div>
    </section>
  )
}

const DouyinPosterFooter: React.FC<PosterProps<DouyinArticleWorkData>> = ({ data, ctx }) => {
  const { avater_url, username, 抖音号, 获赞, 关注, 粉丝, share_url } = data
  const useDarkTheme = isDarkMode(ctx)
  const stats = [
    { icon: DouyinLikeIcon, iconSize: 26, label: '获赞', value: 获赞 },
    { icon: UserPlusIcon, iconSize: 32, label: '关注', value: 关注 },
    { icon: UsersThreeIcon, iconSize: 32, label: '粉丝', value: 粉丝 }
  ]

  return (
    <footer className="mt-16 flex items-start justify-between gap-16">
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

export const DouyinArticleWork: React.FC<PosterProps<DouyinArticleWorkData>> = React.memo((props) => (
  <DefaultLayout ctx={props.ctx} className="relative overflow-hidden">
    <DouyinDiffuseBackground {...props} />

    <section className="relative z-10 px-20 pt-18">
      <DouyinPosterHeader {...props} />
      <DouyinArticleTitle {...props} />
      <DouyinArticleContent {...props} />
      <DouyinSignalLine {...props} />
      <DouyinPosterFooter {...props} />
    </section>
  </DefaultLayout>
))

DouyinArticleWork.displayName = 'DouyinArticleWork'

export default DouyinArticleWork
