import { CheckCircle2, TriangleAlert } from 'lucide-react'
import React from 'react'
import ReactMarkdown from 'react-markdown'

import { DefaultLayout } from '../../../components/DefaultLayout'
import type { PosterProps } from '../../../types/ctx'
import { isDark as isDarkMode } from '../../../../utils/theme'
import type { RuntimeReportData } from './types'

/**
 * `#kkk版本` 运行环境诊断海报。
 *
 * 面向手机端看图场景：整幅统一底色 + 多色弥散光 + 高对比离散噪点层，内容单列纵向排布、
 * 不使用卡片容器，靠大留白与字号层级分区，超大实心版本号作为第一视觉中心。
 * 深色主题为紫罗兰 → 品红 → 琥珀橙弥散；浅色主题为 #271151 / #9754c7 / #deacf5 同色系紫，避免多色对撞。
 */
export const RuntimeReport: React.FC<PosterProps<RuntimeReportData>> = React.memo((props) => {
  const { data } = props
  const isDark = isDarkMode(props.ctx)
  const releaseLabel =
    data.identity.releaseType.toLowerCase() === 'stable'
      ? '正式版'
      : data.identity.releaseType.toLowerCase() === 'preview'
        ? '预览版'
        : data.identity.releaseType
  const buildStatus =
    data.build.state === 'matched'
      ? { label: '构建信息一致', icon: <CheckCircle2 className="h-8 w-8" />, color: '#22c55e' }
      : data.build.state === 'mismatched'
        ? { label: '构建信息不一致', icon: <TriangleAlert className="h-8 w-8" />, color: '#f59e0b' }
        : { label: '未找到构建信息', icon: <TriangleAlert className="h-8 w-8" />, color: '#94a3b8' }

  const palette = isDark
    ? {
        background: '#0d0a1c',
        glowPrimary: 'rgba(139, 92, 246, 0.34)',
        glowSecondary: 'rgba(217, 70, 239, 0.22)',
        glowWarm: 'rgba(251, 146, 60, 0.20)',
        versionGlow: 'radial-gradient(ellipse at center, rgba(167, 139, 250, 0.30) 0%, rgba(240, 171, 252, 0.15) 50%, transparent 75%)',
        versionInk: '#f6f3ff',
        versionAccent: '#fdba74',
        accentText: '#c4b5fd',
        pillBg: 'rgba(139, 92, 246, 0.12)',
        pillBorder: 'rgba(196, 181, 253, 0.35)',
        pillText: '#c4b5fd',
        statusDot: 'linear-gradient(112deg, #c4b5fd 0%, #f0abfc 48%, #fdba74 100%)',
        dotGlow: '0 0 28px rgba(192, 132, 252, 0.85)',
        barAccent: 'linear-gradient(112deg, #c4b5fd 0%, #f0abfc 48%, #fdba74 100%)',
        meterGradient: 'linear-gradient(112deg, #c4b5fd 0%, #f0abfc 48%, #fdba74 100%)',
        bgWord: '#ede9fe',
        noteHeading: '#f5f3ff',
        noteBody: 'rgba(240, 237, 255, 0.72)',
        noteStrong: '#ffffff',
        noteCodeBg: 'rgba(139, 92, 246, 0.16)',
        noteCodeText: '#c4b5fd',
        noteLink: '#c4b5fd',
        noteBulletClass: 'before:bg-violet-400/70',
        warnText: '#fbbf24',
        noiseOpacity: 0.16
      }
    : {
        background: '#f7f1fe',
        glowPrimary: 'rgba(151, 84, 199, 0.30)',
        glowSecondary: 'rgba(222, 172, 245, 0.55)',
        glowWarm: 'rgba(250, 211, 22, 0.38)',
        versionGlow: 'radial-gradient(ellipse at center, rgba(222, 172, 245, 0.50) 0%, rgba(250, 211, 22, 0.16) 55%, transparent 78%)',
        versionInk: '#271151',
        versionAccent: '#9754c7',
        accentText: '#9754c7',
        pillBg: 'rgba(151, 84, 199, 0.10)',
        pillBorder: 'rgba(151, 84, 199, 0.30)',
        pillText: '#7a3db0',
        statusDot: '#9754c7',
        dotGlow: '0 0 26px rgba(151, 84, 199, 0.55)',
        barAccent: 'linear-gradient(90deg, #271151 0%, #9754c7 100%)',
        meterGradient: 'linear-gradient(90deg, #271151 0%, #9754c7 100%)',
        bgWord: '#271151',
        noteHeading: '#271151',
        noteBody: 'rgba(39, 17, 81, 0.70)',
        noteStrong: '#271151',
        noteCodeBg: 'rgba(151, 84, 199, 0.10)',
        noteCodeText: '#7a3db0',
        noteLink: '#7a3db0',
        noteBulletClass: 'before:bg-[#9754c7]/70',
        warnText: '#8a5a06',
        noiseOpacity: 0.12
      }

  return (
    <DefaultLayout ctx={props.ctx} className="relative min-h-455 overflow-hidden" style={{ backgroundColor: palette.background }}>
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute -left-130 -top-120 h-337.5 w-375 rounded-full blur-[230px]"
          style={{ background: `radial-gradient(ellipse at center, ${palette.glowPrimary} 0%, transparent 70%)` }}
        />
        <div
          className="absolute -right-130 top-[32%] h-312.5 w-300 rounded-full blur-[240px]"
          style={{ background: `radial-gradient(ellipse at center, ${palette.glowSecondary} 0%, transparent 72%)` }}
        />
        <div
          className="absolute -bottom-120 -left-80 h-287.5 w-337.5 rounded-full blur-[260px]"
          style={{ background: `radial-gradient(ellipse at center, ${palette.glowWarm} 0%, transparent 72%)` }}
        />
        <div
          className="absolute -bottom-90 -right-105 h-225 w-250 rounded-full blur-[240px]"
          style={{ background: `radial-gradient(ellipse at center, ${palette.glowPrimary} 0%, transparent 72%)` }}
        />
        <div
          className="absolute left-115 top-200 select-none text-[400px] -rotate-90 font-black leading-none tracking-[-0.06em] opacity-[0.03]"
          style={{ color: palette.bgWord }}
        >
          RUNTIME
        </div>
      </div>

      {/* 高对比离散噪点层（与 Help 模板同源：feComponentTransfer 离散化为纯黑白颗粒） */}
      <div className="pointer-events-none absolute inset-0 z-0" style={{ opacity: palette.noiseOpacity }}>
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <filter id="runtimeReportNoise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" result="gray" />
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues="0 1" />
              <feFuncG type="discrete" tableValues="0 1" />
              <feFuncB type="discrete" tableValues="0 1" />
            </feComponentTransfer>
          </filter>
          <rect width="100%" height="100%" filter="url(#runtimeReportNoise)" />
        </svg>
      </div>

      <main className="relative z-10 px-22 pb-16 pt-20">
        <header className="relative">
          <div className="flex items-center justify-between gap-12">
            <div className="flex items-center gap-4">
              <span className="h-3.5 w-3.5 rounded-full" style={{ background: palette.statusDot, boxShadow: palette.dotGlow }} />
              <span className="text-[24px] font-bold tracking-[0.28em] text-foreground/44">运行诊断 · RUNTIME REPORT</span>
            </div>
            <span
              className="whitespace-nowrap rounded-full border px-6 py-2 text-[22px] font-black tracking-[0.14em]"
              style={{ borderColor: palette.pillBorder, background: palette.pillBg, color: palette.pillText }}
            >
              {releaseLabel}
            </span>
          </div>

          <div className="mt-19">
            <h1 className="whitespace-nowrap text-[136px] font-black leading-none tracking-[-0.05em] text-foreground">运行环境</h1>
            <p className="mt-8 whitespace-nowrap text-[32px] font-semibold text-foreground/48">插件、框架与本地宿主的精简诊断快照</p>
          </div>

          <div className="relative mt-23">
            <div
              className="pointer-events-none absolute -left-16 -top-24 h-105 w-205 rounded-full blur-[150px]"
              style={{ background: palette.versionGlow }}
            />
            <div className="relative text-[24px] font-bold tracking-[0.2em] text-foreground/36">插件版本</div>
            <div className="relative mt-5 whitespace-nowrap font-mono text-[200px] font-black leading-none tracking-[-0.08em]">
              <span className="mr-4 text-[64px]" style={{ color: palette.versionAccent }}>
                v
              </span>
              <span style={{ color: palette.versionInk }}>{data.identity.pluginVersion}</span>
            </div>
            <div className="relative mt-8 flex items-center gap-4">
              <span className="whitespace-nowrap font-mono text-[26px] font-bold text-foreground/46">{data.identity.pluginName}</span>
              <span
                className="flex items-center gap-3 whitespace-nowrap rounded-full border px-5 py-1.5 text-[24px] font-bold"
                style={{ color: buildStatus.color, borderColor: `${buildStatus.color}55`, background: `${buildStatus.color}14` }}
              >
                {buildStatus.icon}
                {buildStatus.label}
              </span>
            </div>
            <div className="relative mt-11 whitespace-nowrap font-mono text-[22px] font-semibold text-foreground/28">
              构建 {data.build.shortCommitHash ?? '未知'} · {data.build.buildTime ?? '时间未知'}
            </div>
          </div>
        </header>

        <section className="relative mt-30">
          <div className="relative flex items-center gap-5">
            <span className="h-3 w-3 rounded-full" style={{ background: palette.statusDot }} />
            <span className="text-[24px] font-black tracking-[0.28em]" style={{ color: palette.accentText }}>
              环境摘要
            </span>
            <span className="ml-2 h-2 w-22 rounded-full" style={{ background: palette.barAccent }} />
          </div>

          <div className="relative mt-16 grid grid-cols-2 gap-x-18 gap-y-16">
            <div>
              <div className="text-[22px] font-bold tracking-[0.18em] text-foreground/36">操作系统</div>
              <div className="mt-3 truncate whitespace-nowrap text-[48px] font-black tracking-[-0.02em] text-foreground">
                {data.runtime.os}
              </div>
              <div className="mt-4 whitespace-nowrap font-mono text-[26px] font-bold text-foreground/42">
                {data.runtime.platform} · {data.runtime.arch}
              </div>
            </div>

            <div>
              <div className="text-[22px] font-bold tracking-[0.18em] text-foreground/36">当前适配器</div>
              <div className="mt-3 truncate whitespace-nowrap text-[48px] font-black tracking-[-0.02em] text-foreground">
                {data.adapter.name}
              </div>
              <div className="mt-4 whitespace-nowrap font-mono text-[27px] font-black" style={{ color: palette.accentText }}>
                v{data.adapter.version}
              </div>
            </div>

            <div>
              <div className="text-[22px] font-bold tracking-[0.18em] text-foreground/36">Yunzai 版本</div>
              <div className="mt-3 whitespace-nowrap font-mono text-[48px] font-black leading-none tracking-[-0.02em] text-foreground">
                v{data.identity.karinVersion}
              </div>
            </div>

            <div>
              <div className="text-[22px] font-bold tracking-[0.18em] text-foreground/36">Node.js 版本</div>
              <div
                className="mt-3 whitespace-nowrap font-mono text-[48px] font-black leading-none tracking-[-0.02em]"
                style={{ color: palette.accentText }}
              >
                {data.runtime.nodeVersion}
              </div>
            </div>

            <div>
              <div className="text-[22px] font-bold tracking-[0.18em] text-foreground/36">内存占用</div>
              <div className="mt-3 flex items-end gap-5">
                <span className="whitespace-nowrap font-mono text-[72px] font-black leading-none tracking-[-0.04em] text-foreground">
                  {data.resources.memoryUsagePercent}
                </span>
                <span className="whitespace-nowrap pb-2 font-mono text-[24px] font-bold text-foreground/40">
                  {data.resources.usedMemory} / {data.resources.totalMemory}
                </span>
              </div>
              <div className="mt-5 h-3 w-full max-w-105 overflow-hidden rounded-full bg-foreground/8">
                <div
                  className="h-full rounded-full"
                  style={{ width: data.resources.memoryUsagePercent, background: palette.meterGradient }}
                />
              </div>
            </div>

            <div>
              <div className="text-[22px] font-bold tracking-[0.18em] text-foreground/36">处理器</div>
              <div className="mt-3 line-clamp-2 wrap-break-word text-[32px] font-black leading-[1.4] text-foreground/78">
                {data.resources.cpuModel}
              </div>
              <div className="mt-4 whitespace-nowrap font-mono text-[24px] font-bold text-foreground/40">
                {data.resources.cpuCores} 核心
              </div>
            </div>
          </div>
        </section>

        <section className="relative mt-32.5">
          <div className="relative flex items-center gap-5">
            <span className="h-3 w-3 rounded-full" style={{ background: palette.statusDot }} />
            <span className="text-[24px] font-black tracking-[0.28em]" style={{ color: palette.accentText }}>
              仅展示当前版本
            </span>
            <span className="ml-2 h-2 w-22 rounded-full" style={{ background: palette.barAccent }} />
          </div>
          <h2 className="mt-7 text-[76px] font-black leading-none" style={{ color: palette.noteStrong }}>
            本版变更
          </h2>

          {data.releaseNotes.available ? (
            <div className="runtime-release-notes relative mt-15">
              <ReactMarkdown
                components={{
                  h2: ({ children }) => (
                    <h2 className="mb-11 whitespace-nowrap text-[48px] font-black leading-tight" style={{ color: palette.noteStrong }}>
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3
                      className="mb-5 mt-10 flex items-center gap-5 whitespace-nowrap text-[36px] font-black leading-tight"
                      style={{ color: palette.noteHeading }}
                    >
                      <span className="h-2.5 w-12 shrink-0 rounded-full" style={{ background: palette.barAccent }} />
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-6 text-[32px] leading-[1.7]" style={{ color: palette.noteBody }}>
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => <ul className="mb-8 space-y-5 pl-10">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-8 list-decimal space-y-5 pl-12">{children}</ol>,
                  li: ({ children }) => (
                    <li
                      className={`relative wrap-break-word text-[32px] font-semibold leading-[1.65] before:absolute before:-left-8 before:top-[0.74em] before:h-2.5 before:w-2.5 before:rounded-full ${palette.noteBulletClass}`}
                      style={{ color: palette.noteBody }}
                    >
                      {children}
                    </li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-black" style={{ color: palette.noteStrong }}>
                      {children}
                    </strong>
                  ),
                  code: ({ children }) => (
                    <code
                      className="break-all rounded-lg px-3 py-1 font-mono text-[0.88em] font-bold"
                      style={{ background: palette.noteCodeBg, color: palette.noteCodeText }}
                    >
                      {children}
                    </code>
                  ),
                  a: ({ children }) => (
                    <span className="font-bold" style={{ color: palette.noteLink }}>
                      {children}
                    </span>
                  )
                }}
              >
                {data.releaseNotes.markdown}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="relative mt-15 flex items-start gap-6" style={{ color: palette.warnText }}>
              <TriangleAlert className="mt-1 h-11 w-11 shrink-0" />
              <div>
                <div className="text-[34px] font-black">当前构建没有可用的变更日志</div>
                <div className="mt-3 text-[27px] font-semibold leading-[1.55] opacity-70">环境摘要仍可正常用于问题定位。</div>
              </div>
            </div>
          )}
        </section>

        <footer className="mt-20 flex items-end justify-between gap-12 whitespace-nowrap text-[22px] font-semibold text-foreground/32">
          <span>仅包含经过脱敏的本地运行信息</span>
          <span className="font-mono">{data.snapshotAt}</span>
        </footer>
      </main>
    </DefaultLayout>
  )
})

RuntimeReport.displayName = 'RuntimeReport'

export default RuntimeReport
