import reactIcon from '@thesvg/icons/react'
import sqliteIcon from '@thesvg/icons/sqlite'
import tailwindCssIcon from '@thesvg/icons/tailwind-css'
import tsdownIcon from '@thesvg/icons/tsdown'
import typescriptIcon from '@thesvg/icons/typescript'
import viteIcon from '@thesvg/icons/vite'
import webAssemblyIcon from '@thesvg/icons/webassembly'
import { CornerDownLeft } from 'lucide-react'
import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'

import { DefaultLayout } from '../../../components/DefaultLayout'
import { GlowImage } from '../../../components/GlowImage'
import type { PosterProps } from '../../../types/ctx'
import { generateQRCode } from '../../../../utils/QRcode'
import { isDark as isDarkMode } from '../../../../utils/theme'
import type { ChangelogData } from './types'

const InlineCalloutCode: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className }) => (
  <span
    className={`inline-flex items-center rounded-[0.55em] px-[0.48em] py-[0.18em] font-semibold ${className ?? ''}`.trim()}
    style={{
      background: 'color-mix(in oklab, #d4af37 14%, transparent)',
      color: '#d4af37'
    }}
  >
    {children}
  </span>
)

const toSvgDataUri = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

const techStackItems = [
  { label: 'TypeScript', iconSrc: toSvgDataUri(typescriptIcon.svg) },
  { label: 'SQLite', iconSrc: toSvgDataUri(sqliteIcon.svg) },
  { label: 'React', iconSrc: toSvgDataUri(reactIcon.svg) },
  { label: 'Tailwind CSS', iconSrc: toSvgDataUri(tailwindCssIcon.svg) },
  { label: 'WebAssembly', iconSrc: toSvgDataUri(webAssemblyIcon.svg) },
  { label: 'Vite', iconSrc: toSvgDataUri(viteIcon.svg) },
  { label: 'tsdown', iconSrc: toSvgDataUri(tsdownIcon.svg) }
] as const

/**
 * 更新日志组件
 * @param props 组件属性
 * @returns JSX元素
 */
export const Changelog: React.FC<PosterProps<ChangelogData>> = React.memo((props) => {
  const isDark = isDarkMode(props.ctx) ?? false
  const isUpdateTip = props.data.Tip === true
  const share_url = (props as any).data?.share_url || ''

  const backgroundColors = isDark
    ? {
        base: '#0a0a0a',
        primary: 'rgba(212, 175, 55, 0.28)',
        secondary: 'rgba(184, 134, 11, 0.24)',
        accent: 'rgba(205, 133, 63, 0.20)',
        wash: 'rgba(10, 10, 10, 0.85)',
        tint: 'rgba(212, 175, 55, 0.12)',
        noiseOpacity: 0.2,
        noiseBlend: 'screen' as const,
        inlineCodeBg: 'rgba(255, 215, 0, 0.10)',
        inlineCodeText: '#f0c040'
      }
    : {
        base: '#faf8f3',
        primary: 'rgba(212, 175, 55, 0.20)',
        secondary: 'rgba(184, 134, 11, 0.16)',
        accent: 'rgba(205, 133, 63, 0.14)',
        wash: 'rgba(250, 248, 243, 0.65)',
        tint: 'rgba(212, 175, 55, 0.07)',
        noiseOpacity: 0.12,
        noiseBlend: 'multiply' as const,
        inlineCodeBg: 'rgba(184, 134, 11, 0.12)',
        inlineCodeText: '#8b6914'
      }

  return (
    <DefaultLayout
      ctx={props.ctx}
      className="relative overflow-hidden"
      style={{
        backgroundColor: backgroundColors.base
      }}
    >
      <div className="absolute inset-0 pointer-events-none z-0">
        <div
          className="absolute -top-48 -left-20 w-7xl h-280 rounded-full blur-[120px]"
          style={{
            background: `radial-gradient(ellipse at 35% 40%, ${backgroundColors.primary} 0%, transparent 72%)`
          }}
        />
        <div
          className="absolute top-42 right-[-7%] w-[30%] h-[24%] rounded-full blur-[132px] rotate-12"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, ${backgroundColors.secondary} 0%, transparent 72%)`
          }}
        />
        <div
          className="absolute -bottom-36 left-30 w-280 h-220 rounded-full blur-[128px] -rotate-6"
          style={{
            background: `radial-gradient(ellipse at 55% 55%, ${backgroundColors.accent} 0%, transparent 72%)`
          }}
        />
        <div
          className="absolute left-[10%] w-[34%] h-[30%] blur-[138px]"
          style={{
            top: '33%',
            background: `radial-gradient(ellipse at 42% 50%, ${backgroundColors.tint} 0%, transparent 76%)`
          }}
        />
        <div
          className="absolute left-[32%] bottom-[-14%] w-[44%] h-[28%] blur-[342px]"
          style={{
            background: `radial-gradient(ellipse at 50% 48%, ${backgroundColors.secondary} 0%, transparent 77%)`
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${backgroundColors.wash} 0%, transparent 28%, transparent 72%, ${backgroundColors.wash} 100%)`
          }}
        />
      </div>

      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          opacity: backgroundColors.noiseOpacity,
          mixBlendMode: backgroundColors.noiseBlend
        }}
      >
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <filter id="changelogNoise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.88" numOctaves="2" stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" result="gray" />
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues="0 0 1 1" />
              <feFuncG type="discrete" tableValues="0 0 1 1" />
              <feFuncB type="discrete" tableValues="0 0 1 1" />
              <feFuncA type="table" tableValues="0 0.25 0.9 1" />
            </feComponentTransfer>
          </filter>
          <rect width="100%" height="100%" filter="url(#changelogNoise)" />
        </svg>
      </div>

      <div className="relative px-16 pt-5 pb-0 w-full max-w-none prose prose-lg prose-invert from-surface to-surface">
        {isUpdateTip ? (
          <>
            {/* <div className="inline-block relative mt-20">
              <div className="absolute inset-0 bg-black rounded-2xl opacity-50 blur-xl translate-y-6 -z-10"></div>

              <img className="block relative rounded-2xl" src="/image/other/changelog/banner.webp" alt="横幅" />

              <div className='flex absolute inset-0 flex-col justify-center items-center left-50 bottom-50'>
                <span className='text-9xl font-bold text-white opacity-10'>
                  v{props.data.remoteVersion}
                </span>
              </div>
            </div> */}

            {/* 更新提示 */}
            <div className="pt-32">
              <div className="text-5xl leading-relaxed text-center mb-8 opacity-50 text-foreground/70">以下任意方式均可更新</div>

              <div className="mb-10 px-8 py-5 rounded-2xl border border-border/70 bg-surface/50 text-foreground/80 text-[2.2em] flex items-center justify-center gap-6">
                <span>当前版本: v{props.data.localVersion}</span>
                <span>→</span>
                <span>最新版本: v{props.data.remoteVersion}</span>
                <span>，共落后 {props.data.lagVersionCount ?? 0} 个版本</span>
              </div>

              <div className="flex flex-col gap-6 text-[2.8em] leading-relaxed text-foreground/80">
                <div className="flex items-center gap-5">
                  <span className="text-muted text-[1.2em]">•</span>
                  <span>引用回复</span>
                  <span className="inline-block text-[1.15em] font-bold text-foreground">更新</span>
                  <span>立刻开始</span>
                </div>

                <div className="flex items-center gap-5">
                  <span className="text-muted text-[1.2em]">•</span>
                  <span>进入</span>
                  <InlineCalloutCode className="text-[0.9em] font-mono">锅巴</InlineCalloutCode>
                  <span>→</span>
                  <InlineCalloutCode className="text-[0.9em]">插件管理</InlineCalloutCode>
                  <span>→</span>
                  <InlineCalloutCode className="text-[0.9em]">已安装</InlineCalloutCode>
                  <span>→</span>
                  <span>一览更新</span>
                </div>

                <div className="flex items-center gap-5">
                  <span className="text-muted text-[1.2em]">•</span>
                  <span>插件目录运行</span>
                  <InlineCalloutCode className="text-[0.85em] whitespace-nowrap font-mono">
                    git pull
                  </InlineCalloutCode>
                </div>
              </div>
            </div>
          </>
        ) : null}
        <div className="changelog-content px-6">
          <ReactMarkdown
            rehypePlugins={[rehypeHighlight]}
            components={{
              h1: ({ children, ...props }) => (
                <h1 className="text-[5.28em] font-semibold mb-8 pb-2 border-b-2 border-muted text-foreground" {...props}>
                  {children}
                </h1>
              ),
              h2: ({ children, ...props }) => (
                <div className="relative mt-25 mb-5">
                  <h2 className="ml-5 relative z-10 text-[5.28em] text-foreground font-light" {...props}>
                    {children}
                  </h2>
                  <div className="w-full border-b border-muted" />
                </div>
              ),
              h3: ({ children, ...props }) => (
                <h3 className="flex items-baseline gap-3 text-[3.2em] font-light mb-2 text-foreground" {...props}>
                  {children}
                  <CornerDownLeft className="w-[1em] h-[1em] text-foreground/10" />
                </h3>
              ),
              h4: ({ children, ...props }) => (
                <h4 className="text-[2.64em] font-semibold mb-5 text-foreground" {...props}>
                  {children}
                </h4>
              ),
              h5: ({ children, ...props }) => (
                <h5 className="text-[2.38em] font-semibold mb-5 text-foreground" {...props}>
                  {children}
                </h5>
              ),
              h6: ({ children, ...props }) => (
                <h6 className="text-[2.11em] font-semibold mb-4 text-foreground/70" {...props}>
                  {children}
                </h6>
              ),
              p: ({ children, ...props }) => (
                <p className="text-[2.64em] leading-[1.75] mb-[2.64em] text-foreground" {...props}>
                  {children}
                </p>
              ),
              ul: ({ children, ...props }) => (
                <ul className="pl-[5em] mb-[4em] list-disc text-foreground" {...props}>
                  {children}
                </ul>
              ),
              ol: ({ children, ...props }) => (
                <ol className="pl-[3.6em] mb-[1.8em] list-decimal text-foreground" {...props}>
                  {children}
                </ol>
              ),
              li: ({ children, ...props }) => (
                <li className="text-[2.6em] leading-[1.6] text-foreground font-black" {...props}>
                  {children}
                </li>
              ),
              blockquote: ({ children, ...props }) => (
                <blockquote className="border-l-4 border-muted pl-[1.8em] py-[0.9em] mb-[1.8em] text-foreground/80 bg-surface" {...props}>
                  {children}
                </blockquote>
              ),
              code: ({ children }) => (
                <code
                  className="inline align-text-bottom leading-inherit text-[0.8em] whitespace-normal break-all box-decoration-slice rounded-[0.5em] px-[0.38em] py-[0.14em] font-semibold"
                  style={{
                    backgroundColor: backgroundColors.inlineCodeBg,
                    color: backgroundColors.inlineCodeText
                  }}
                >
                  {children}
                </code>
              ),
              pre: ({ children, ...props }) => (
                <pre className="p-[1.8em] mb-[1.8em] bg-surface-secondary rounded overflow-x-auto font-mono" {...props}>
                  {children}
                </pre>
              ),
              a: ({ children, href, ...props }) => {
                const isVersionLink = href?.includes('/compare/')
                return (
                  <a
                    className={`inline-flex gap-3 items-baseline cursor-pointer font-medium hover:underline ${isVersionLink ? 'text-foreground' : 'text-foreground/50'}`}
                    onClick={(e) => e.preventDefault()}
                    {...props}
                  >
                    <span>{children}</span>
                  </a>
                )
              },
              img: ({ ...props }) => <img className="max-w-full h-auto rounded" {...props} />,
              table: ({ children, ...props }) => (
                <table className="w-full border-collapse mb-[1.8em] text-foreground" {...props}>
                  {children}
                </table>
              ),
              th: ({ children, ...props }) => (
                <th className="px-5 py-3 font-semibold text-left border text-foreground bg-surface-secondary border-muted" {...props}>
                  {children}
                </th>
              ),
              td: ({ children, ...props }) => (
                <td className="px-5 py-3 border text-foreground border-muted" {...props}>
                  {children}
                </td>
              )
            }}
          >
            {props.data?.markdown ?? ''}
          </ReactMarkdown>
        </div>

        {share_url && (
          <>
            {isUpdateTip ? (
              <div className="py-10">
                <div className="relative flex flex-col gap-8 overflow-hidden border-y border-muted/70 py-10">
                  <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-foreground/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-foreground/20 to-transparent" />

                  <div className="relative flex items-stretch gap-12">
                    <div className="relative w-[36%] shrink-0">
                      <div className="inline-flex items-center gap-4 rounded-full border border-border/60 bg-surface/40 px-5 py-2 text-[1.75em] font-semibold text-foreground/60">
                        <span className="h-3 w-3 rounded-full bg-foreground/50" />
                        <span>DIFF SCAN</span>
                      </div>

                      <div className="mt-4 w-100 rounded-3xl p-1">
                        <img src={generateQRCode(share_url, isDark)} alt="二维码" className="w-full h-full rounded-2xl object-contain" />
                      </div>
                    </div>

                    <div className="relative flex-1 py-2">
                      <div className="flex items-end justify-between gap-8">
                        <div>
                          <div className="text-[1.65em] font-semibold tracking-[0.22em] text-foreground/45">PROJECT STACK</div>
                          <div className="mt-2 text-[3.3em] font-black leading-none text-foreground/85">技术栈</div>
                        </div>
                        <div className="h-16 w-px bg-border/80" />
                      </div>

                      <div className="mt-8 grid grid-cols-4 gap-4">
                        {techStackItems.map(({ iconSrc, label }) => (
                          <div
                            key={label}
                            className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-surface/45 px-4 py-5 backdrop-blur-xs"
                          >
                            <GlowImage glowStrength={isDark ? 1 : 0} blurRadius={20}>
                              <img aria-hidden src={iconSrc} alt="" draggable={false} className="h-16 w-16 object-contain drop-shadow-lg" />
                            </GlowImage>
                            <span className="text-center text-[1.35em] font-bold leading-tight text-foreground/75">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="text-4xl leading-relaxed text-foreground/60">
                    <span>扫码查看实际运行代码从</span>
                    <span className="font-bold text-foreground/80"> v{props.data.localVersion}</span>
                    <span> 到 </span>
                    <span className="font-bold text-foreground/80"> v{props.data.remoteVersion}</span>
                    <span> 的差异</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-12 py-8">
                <div className="w-120 h-auto">
                  <img src={generateQRCode(share_url, isDark)} alt="二维码" className="w-full h-full object-contain" />
                </div>
                <div className="text-4xl text-foreground/60">
                  <span>扫码查看实际运行代码从</span>
                  <span className="font-bold text-foreground/80"> v{props.data.localVersion}</span>
                  <span> 到 </span>
                  <span className="font-bold text-foreground/80"> v{props.data.remoteVersion}</span>
                  <span> 的差异</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* 底部信息 */}
        {isUpdateTip && props.data.buildTime && (
          <div className="flex gap-8 justify-center text-foreground/60">
            <div className="text-4xl">
              更新频道:
              <span className="font-bold text-foreground/80"> 正式版</span>
            </div>
            <div className="text-4xl">
              编译于:
              <span className="font-bold text-foreground/80"> {props.data.buildTime}</span>
            </div>
          </div>
        )}
      </div>
    </DefaultLayout>
  )
})

Changelog.displayName = 'Changelog'

export default Changelog
