import { AlertTriangle, CheckCircle, CircleFadingArrowUp, Info, Zap } from 'lucide-react'
import React from 'react'

import type { PosterContext } from '../types/ctx'
import { cn } from '../../utils/cn'
import { isDark as isDarkMode } from '../../utils/theme'
import { GlowImage } from './GlowImage'
import { RolldownLogo } from './RolldownLogo'
import { ViteLogo } from './ViteLogo'

/**
 * 默认布局组件属性接口
 */
interface DefaultLayoutProps {
  /** 子组件 */
  children: React.ReactNode
  /** ktr 注入的运行时上下文（scale/theme + kkk 扩展字段） */
  ctx: PosterContext
  /** 额外的CSS类名 */
  className?: string
  /** 自定义样式 */
  style?: React.CSSProperties
}

/**
 * 默认布局组件
 * @param props 组件属性
 * @returns JSX元素
 */
export const DefaultLayout: React.FC<DefaultLayoutProps> = ({ children, ctx, className = '', style = {} }) => {
  const dark = isDarkMode(ctx)
  const { version, watermarkTextBitSize } = ctx

  return (
    <div
      className={cn(
        // 圆角与裁剪从旧引擎外壳（#container 规则）迁移到模板根元素：观感不变，单个模板可用 className 覆盖。
        // relative 同样从旧引擎外壳（transform 语义）迁来：根元素是绝对定位包含块，
        // 模板里 inset-0 的氛围层锚定在卡片矩形上并被圆角裁剪，而不是锚到视口逃逸出去。
        'relative w-360 shrink-0 overflow-hidden rounded-[5rem] bg-background bg-clip-padding text-foreground font-[HarmonyOSHans-Regular]',
        className
      )}
      style={{
        // 固定设计宽度属于模板视觉布局；缩放和截图边界由 SSR 外壳的 #container 统一负责。
        width: '1440px',
        minWidth: '1440px',
        maxWidth: '1440px',
        ...style
      }}
    >
      {children}
      {version ? (
        <footer className="relative z-50 px-20 pt-24 pb-16 text-foreground/80">
          <div className="border-t border-foreground/10 pt-10">
            <div className="flex flex-wrap items-center justify-between gap-x-16 gap-y-10">
              {/* 插件品牌与版本 */}
              <div className="flex min-w-0 flex-1 items-center gap-6">
                <GlowImage
                  src="/image/logo.png"
                  alt="kkkkkk-10086"
                  imgClassName="h-16 w-16 object-contain"
                  glowStrength={dark ? 1 : 0}
                  blurRadius={20}
                />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold uppercase tracking-wide text-foreground/55">
                    <span className="truncate">{version.plugin}</span>
                    <span className="h-1 w-1 rounded-full bg-foreground/25" aria-hidden="true" />
                    <span
                      className={cn(
                        'inline-flex items-center gap-2',
                        version.hasUpdate && 'text-success',
                        !version.hasUpdate && version.releaseType === 'Preview' && 'text-warning'
                      )}
                    >
                      {version.hasUpdate && <CircleFadingArrowUp strokeWidth={3} className="h-4 w-4" />}
                      {!version.hasUpdate && version.releaseType === 'Stable' && <CheckCircle strokeWidth={3} className="h-4 w-4" />}
                      {!version.hasUpdate && version.releaseType === 'Preview' && <AlertTriangle strokeWidth={3} className="h-4 w-4" />}
                      {!version.hasUpdate && version.releaseType !== 'Stable' && version.releaseType !== 'Preview' && (
                        <Info strokeWidth={3} className="h-4 w-4" />
                      )}
                      <span>{version.hasUpdate ? '有可用更新' : version.releaseType}</span>
                    </span>
                  </div>
                  <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="max-w-full truncate text-[42px] font-black leading-none">{version.pluginName}</span>
                    <span
                      className={cn(
                        'shrink-0 text-[24px] font-bold leading-none tabular-nums',
                        version.hasUpdate && 'text-success',
                        !version.hasUpdate && version.releaseType === 'Preview' && 'text-warning'
                      )}
                    >
                      v{version.pluginVersion}
                    </span>
                  </div>
                </div>
              </div>

              <div className="hidden h-16 w-px shrink-0 bg-foreground/15 xl:block" aria-hidden="true" />

              {/* 云崽框架品牌 */}
              <div className="flex min-w-0 flex-1 items-center justify-start gap-6 xl:justify-end">
                <GlowImage
                  src="/image/frame-logo.png"
                  alt={version.poweredBy || 'Yunzai'}
                  imgClassName="h-20 w-20 object-contain"
                  glowStrength={dark ? 1 : 0}
                  blurRadius={28}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-foreground/55">
                    <Zap strokeWidth={3} className="h-4 w-4 opacity-90" />
                    <span>Power By</span>
                  </div>
                  <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="max-w-full truncate text-[42px] font-black leading-none opacity-90">{version.poweredBy}</span>
                    <span className="shrink-0 text-[22px] font-bold leading-none opacity-70">v{version.frameworkVersion}</span>
                  </div>
                </div>
              </div>
            </div>

            {(version.releaseType === 'Stable' || typeof watermarkTextBitSize === 'number') && (
              <div className="mt-9 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-foreground/10 pt-5">
                {typeof watermarkTextBitSize === 'number' ? (
                  <span className="font-mono text-xs text-foreground/30">Restore ID: {watermarkTextBitSize}</span>
                ) : (
                  <span aria-hidden="true" />
                )}

                {version.releaseType === 'Stable' && (
                  <div className="flex items-center gap-5 opacity-65">
                    <GlowImage glowStrength={dark ? 1 : 0} blurRadius={6}>
                      <RolldownLogo className="h-4 w-auto" />
                    </GlowImage>
                    <GlowImage glowStrength={dark ? 1 : 0} blurRadius={12}>
                      <ViteLogo className="h-7 w-auto" />
                    </GlowImage>
                  </div>
                )}
              </div>
            )}
          </div>
        </footer>
      ) : (
        <div className="flex items-center justify-center h-24">
          {typeof watermarkTextBitSize === 'number' && (
            <span className="text-xs font-mono text-foreground/30">Restore ID: {watermarkTextBitSize}</span>
          )}
        </div>
      )}
    </div>
  )
}
