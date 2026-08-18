import { extractRichTextPlainText, renderRichTextToReact } from '@kkk/richtext'
import { Clock, Radio, UsersRound } from 'lucide-react'
import React from 'react'
// import { cn } from '../../../../../utils/cn'
import { isDark as isDarkMode } from '../../../../../utils/theme'
import { AmbientCover } from '../../../../components/AmbientCover'
import { DefaultLayout } from '../../../../components/DefaultLayout'
import { QRCodeWithAvatar } from '../../../../components/QRCodeWithAvatar'
import type { PosterProps } from '../../../../types/ctx'
import { EnhancedImage, UsernameDisplay } from '../../../components/shared'
import type { BilibiliLiveDynamicData } from './types'

/** B站品牌粉，直播状态徽章 / 脉冲灯 / 均衡器强调条统一使用，与封面取色无关。 */
const LIVE_PINK = '#FB7299'

/** 压在封面上的白色文字统一使用重投影，保证在任意封面亮度下可读（与弹幕层同策略）。 */
const onCoverTextShadow: React.CSSProperties = {
  textShadow: '0 4px 14px rgba(0,0,0,0.78), 0 0 4px rgba(0,0,0,0.9)'
}

/**
 * 封面底部溶解遮罩：多段停靠点模拟 smoothstep，
 * 让封面下缘无明显线性拐点地融入下方的氛围背景层。
 */
const coverMaskStyle: React.CSSProperties = {
  maskImage:
    'linear-gradient(to bottom, black 52%, rgba(0,0,0,0.9) 60%, rgba(0,0,0,0.68) 70%, rgba(0,0,0,0.35) 82%, rgba(0,0,0,0.1) 93%, transparent 100%)',
  WebkitMaskImage:
    'linear-gradient(to bottom, black 52%, rgba(0,0,0,0.9) 60%, rgba(0,0,0,0.68) 70%, rgba(0,0,0,0.35) 82%, rgba(0,0,0,0.1) 93%, transparent 100%)'
}

/**
 * 全局氛围背景层：模糊封面 + 渐变遮罩 + 高对比杂色纹理。
 * 背景色完全取自封面图本身，不再依赖后端取色。
 */
const LiveAmbientBackground: React.FC<{
  cover: string
  ctx: PosterProps<BilibiliLiveDynamicData>['ctx']
}> = React.memo(({ cover, ctx }) => (
  <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none">
    {/* 模糊封面背景 */}
    <AmbientCover src={cover} ctx={ctx} />
    {/* 渐变遮罩，压住文字区对比 */}

    {/* 高对比杂色纹理层 */}
    <div className="absolute inset-0 opacity-[0.45] mix-blend-overlay dark:mix-blend-soft-light">
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="liveRcmdNoise">
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
          <mask id="liveRcmdNoiseMask">
            <linearGradient id="liveRcmdNoiseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.85" />
              <stop offset="25%" stopColor="white" stopOpacity="0.4" />
              <stop offset="50%" stopColor="white" stopOpacity="0.08" />
              <stop offset="75%" stopColor="white" stopOpacity="0.4" />
              <stop offset="100%" stopColor="white" stopOpacity="0.85" />
            </linearGradient>
            <rect width="100%" height="100%" fill="url(#liveRcmdNoiseGradient)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" filter="url(#liveRcmdNoise)" mask="url(#liveRcmdNoiseMask)" fill="white" />
      </svg>
    </div>
  </div>
))

LiveAmbientBackground.displayName = 'LiveAmbientBackground'

/** 直播音频均衡器装饰条：直播模板的专属信号装饰。 */
const LiveEqualizer: React.FC = React.memo(() => (
  <div className="flex items-end gap-2.5 pb-4">
    {[46, 88, 62, 98, 52].map((height, index) => (
      <span
        key={index}
        className="w-2.5 rounded-full"
        style={{
          height: `${height}px`,
          backgroundColor: index === 3 ? LIVE_PINK : 'rgba(255,255,255,0.88)',
          boxShadow: '0 3px 12px rgba(0,0,0,0.55)'
        }}
      />
    ))}
  </div>
))

LiveEqualizer.displayName = 'LiveEqualizer'

const stripHtmlTags = (content: string): string => {
  return content.replace(/<[^>]+>/g, '').trim()
}

const getSingleLineFontSize = (content: string, base: number, min: number): number => {
  const length = stripHtmlTags(content).length
  if (length <= 4) return base
  if (length <= 8) return base - 4
  if (length <= 12) return base - 10
  if (length <= 18) return base - 16
  return min
}

export const BilibiliLiveDynamic: React.FC<PosterProps<BilibiliLiveDynamicData>> = React.memo((props) => {
  const { data, ctx } = props
  const isDark = isDarkMode(ctx) === true

  // 面板允许数据文件缺字段，关键引用全部兜底，避免白屏
  const usernameMeta = data.usernameMeta ?? { name: '', vipStatus: 0, nicknameColor: null }
  const liveinf = data.liveinf ?? ''
  const fans = data.fans ?? ''
  const liveTitleLength = data.text ? extractRichTextPlainText(data.text).length : 0

  const logo = isDark ? '/image/bilibili/bilibili-light.png' : '/image/bilibili/bilibili.png'
  const streamerName = usernameMeta.name
  const streamerFontSize = getSingleLineFontSize(streamerName, 68, 42)
  const liveInfoFontSize = getSingleLineFontSize(liveinf, 36, 26)
  const followerFontSize = getSingleLineFontSize(`${fans} 粉丝`, 30, 24)
  const liveTitleFontSize = liveTitleLength <= 16 ? 74 : liveTitleLength <= 28 ? 66 : liveTitleLength <= 44 ? 58 : 52

  return (
    <DefaultLayout ctx={props.ctx} className="relative overflow-hidden">
      {/* 全局氛围层：模糊封面 + 高对比杂色 */}
      {data.image_url && <LiveAmbientBackground cover={data.image_url} ctx={props.ctx} />}

      <div className="relative z-10 flex flex-col">
        {/* 封面：占满模板全宽，底部溶解进氛围层 */}
        {data.image_url && (
          <section className="relative">
            <div className="overflow-hidden" style={coverMaskStyle}>
              <EnhancedImage src={data.image_url} alt="直播封面" className="block h-auto w-full object-cover" />
            </div>

            {/* 底部直播状态：压在封面溶解区上，靠重投影保持可读 */}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-10 px-16 pb-4" style={onCoverTextShadow}>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-3 text-[20px] font-black tracking-[0.26em] uppercase text-white/85">
                  <span className="h-3 w-3 animate-pulse rounded-full" style={{ backgroundColor: LIVE_PINK }} />
                  <span>Now Live</span>
                </div>
                <div className="mt-2 flex items-end gap-7">
                  <span className="text-[92px] leading-none font-black tracking-[-0.03em] whitespace-nowrap text-white select-text">
                    正在开播
                  </span>
                  <LiveEqualizer />
                </div>
                <div className="mt-5 inline-flex max-w-full items-center gap-3 font-bold text-white/92">
                  <Radio size={26} className="shrink-0" />
                  <span className="min-w-0 select-text" style={{ fontSize: `${liveInfoFontSize}px` }}>
                    {liveinf}
                  </span>
                </div>
              </div>
              <div className="shrink-0 pb-2 text-right font-mono text-white/85">
                <div className="inline-flex items-center gap-3 text-[26px] font-bold whitespace-nowrap select-text">
                  <Clock size={24} />
                  <span>{data.create_time}</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 内容区：压在氛围层之上 */}
        <section className="relative flex flex-col px-16 pt-14">
          {/* 背景气氛字 */}
          <div className="pointer-events-none absolute top-24 right-0 z-0 opacity-[0.05] select-none">
            <div className="text-[190px] leading-[0.88] font-black tracking-tighter text-foreground">ON</div>
            <div className="text-[190px] leading-[0.88] font-black tracking-tighter text-foreground">AIR</div>
          </div>

          {/* 直播标题：主视觉文本 */}
          <h1
            className="relative z-10 leading-[1.18] font-black tracking-[-0.02em] whitespace-pre-wrap text-foreground select-text"
            style={{ fontSize: `${liveTitleFontSize}px`, wordBreak: 'break-word', overflowWrap: 'break-word' }}
          >
            {data.text &&
              renderRichTextToReact(data.text, {
                at: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                topic: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                lottery: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                webLink: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                vote: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                viewPicture: { className: 'text-[#006A9E] dark:text-[#58B0D5]' }
              })}
          </h1>

          {/* 主播身份行 */}
          <div className="relative z-10 mt-14 flex items-center justify-between gap-10">
            <div className="flex min-w-0 items-center gap-7">
              <div className="relative shrink-0">
                <EnhancedImage src={data.avatar_url} alt="头像" className="h-36 w-36 rounded-full object-cover" isCircular />
                {data.frame && <EnhancedImage src={data.frame} alt="头像框" className="absolute inset-0 scale-160" />}
              </div>
              <div className="min-w-0">
                <div className="text-[20px] font-black tracking-[0.28em] uppercase text-muted">Live Streamer</div>
                <div
                  className="mt-3 truncate leading-none font-black tracking-[-0.03em] text-foreground select-text"
                  style={{ fontSize: `${streamerFontSize}px` }}
                >
                  <UsernameDisplay metadata={usernameMeta} />
                </div>
                <div className="mt-4 inline-flex items-center gap-3 font-bold text-foreground/70">
                  <UsersRound size={26} />
                  <span className="select-text" style={{ fontSize: `${followerFontSize}px` }}>
                    {fans} 粉丝
                  </span>
                </div>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-[20px] font-black tracking-[0.26em] uppercase text-muted">Signal Time</div>
              <div className="mt-3 font-mono text-[30px] font-bold text-foreground/75 select-text">{data.now_time}</div>
            </div>
          </div>

          {/* 底部：品牌 + 行动区 */}
          <footer className="relative z-10 mt-16 flex items-end justify-between gap-14 pb-16">
            <div className="min-w-0">
              <img src={logo} alt="哔哩哔哩" className={`h-auto ${isDark ? 'w-72' : 'w-108'}`} />
              <div className="mt-5 text-[26px] font-bold text-muted select-text">你感兴趣的直播都在哔哩哔哩</div>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[22px] font-semibold text-foreground/50">
                <span className="select-text">{data.dynamicTYPE}</span>
                <span className="opacity-40">/</span>
                <span className="font-mono select-text">{data.now_time}</span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-[20px] font-black tracking-[0.24em] uppercase text-muted">Scan To Watch</div>
              <div className="mt-2 text-[40px] leading-none font-black tracking-[-0.02em] text-foreground select-text">扫码进入直播间</div>
              <div className="mt-6 flex justify-end">
                {data.share_url ? (
                  <QRCodeWithAvatar
                    value={data.share_url}
                    avatarUrl={data.avatar_url}
                    useDarkTheme={isDark}
                    alt="二维码"
                    className="h-72 w-72 object-contain drop-shadow-[0_20px_38px_rgba(0,0,0,0.18)]"
                  />
                ) : (
                  <div className="flex h-72 w-72 items-center justify-center">
                    <span className="text-[28px] text-muted">二维码</span>
                  </div>
                )}
              </div>
            </div>
          </footer>
        </section>
      </div>
    </DefaultLayout>
  )
})

BilibiliLiveDynamic.displayName = 'BilibiliLiveDynamic'

export default BilibiliLiveDynamic
