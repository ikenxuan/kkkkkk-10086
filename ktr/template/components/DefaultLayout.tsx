import { AlertTriangle, CheckCircle, CircleFadingArrowUp, Info, Zap } from 'lucide-react'
import React from 'react'

import type { PosterContext } from '../types/ctx'
import { cn } from '../../utils/cn'
import { isDark } from '../../utils/theme'
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
  // 明暗只用于内部装饰分支（辉光强度等）；dark 类与 data-theme 由 ktr 外壳统一写在 body 上，
  // 模板根元素不再重复施加。唯一事实来源是 ctx.theme.mode。
  const useDarkTheme = isDark(ctx)
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
        // renderScale 缩放由 ktr 外壳统一施加（#container 上的 zoom，SSR 与开发面板沙盒一致），
        // 模板根元素不要再加 zoom/transform，否则会叠加成 scale²。
        // 旧引擎 transform 顺带的层叠上下文也由外壳 #container 的 isolation: isolate 补回，
        // 模板里 -z-10 的氛围层不会逃逸到 <html> 层叠上下文被卡片背景盖住。
        width: '1440px',
        minWidth: '1440px',
        maxWidth: '1440px',
        ...style
      }}
    >
      {children}
      {version ? (
        <div className="relative z-50 pt-32 pb-20 text-foreground/80">
          {/* 版本信息：插件、框架、构建工具 */}
          <div className="flex relative justify-center items-center space-x-8">
            {/* 插件信息 */}
            <div className="flex items-end space-x-8">
              <GlowImage glowStrength={useDarkTheme ? 1 : 0} blurRadius={20}>
                <svg id="114514" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 230 221" className="w-auto h-18">
                  <path
                    id="_1"
                    d="M132.75,87.37l-53.72-53.37c-4.66-4.63-1.38-12.58,5.18-12.58h115.13c6.57,0,9.84,7.95,5.18,12.58l-53.72,53.37c-4.99,4.96-13.06,4.96-18.05,0Z"
                    fill="currentColor"
                  />
                  <path
                    id="_2"
                    d="M28.49,186.89l.03-51.42c-.02-6.57,7.92-9.87,12.56-5.23l57.02,57.02c4.64,4.64,1.34,12.41-5.23,12.39h-51.42c-7.04-.02-12.94-5.72-12.96-12.76Z"
                    fill="currentColor"
                  />
                  <path
                    d="M41.54,23.68l163.04,163.05c4.78,4.78,1.39,12.95-5.36,12.94h-47.88c-9.69,0-18.99-3.86-25.84-10.71L39.3,102.75c-6.85-6.85-10.7-16.15-10.7-25.84V29.04c0-6.76,8.16-10.14,12.94-5.36Z"
                    fill="currentColor"
                  />
                </svg>
              </GlowImage>

              <div className="flex flex-col items-start opacity-90">
                <div className="flex items-center mb-1 space-x-2 text-sm font-bold uppercase text-foreground/80">
                  <span>{version.plugin}</span>
                </div>
                <span className="text-5xl font-black">{version.pluginName}</span>
              </div>
            </div>

            <div className="flex flex-col items-start opacity-90">
              <div className="flex items-center mb-1 space-x-2 text-sm font-bold tracking-widest uppercase text-foreground/80">
                {version.hasUpdate && <CircleFadingArrowUp strokeWidth={3} className="w-4 h-4 text-success" />}
                {!version.hasUpdate && version.releaseType === 'Stable' && <CheckCircle strokeWidth={3} className="w-4 h-4" />}
                {!version.hasUpdate && version.releaseType === 'Preview' && (
                  <AlertTriangle strokeWidth={3} className="w-4 h-4 text-warning" />
                )}
                {!version.hasUpdate && version.releaseType !== 'Stable' && version.releaseType !== 'Preview' && (
                  <Info strokeWidth={3} className="w-4 h-4" />
                )}
                <span
                  className={cn(
                    version.hasUpdate && 'text-success',
                    !version.hasUpdate && version.releaseType === 'Preview' && 'text-warning'
                  )}
                >
                  {version.hasUpdate ? '有可用更新' : version.releaseType}
                </span>
              </div>
              <span
                className={cn(
                  'text-5xl font-bold tracking-wide',
                  version.hasUpdate && 'text-success',
                  !version.hasUpdate && version.releaseType === 'Preview' && 'text-warning'
                )}
              >
                v{version.pluginVersion}
              </span>
            </div>

            <div className="w-1 h-14 opacity-90 bg-foreground" />

            {/* 框架信息 */}
            <div className="flex items-end space-x-8">
              <GlowImage
                src="/image/frame-logo.png"
                alt="logo"
                imgClassName="w-auto h-18"
                glowStrength={useDarkTheme ? 1 : 0}
                blurRadius={40}
              />
              <div className="flex flex-col items-start">
                <div className="flex items-center mb-1 space-x-2 text-sm font-bold tracking-widest uppercase text-foreground/80">
                  <Zap strokeWidth={3} className="w-4 h-4 opacity-90" />
                  <span className="opacity-90">Power By</span>
                </div>
                <div className="flex items-end space-x-2">
                  <span className="text-5xl font-black leading-none opacity-90">{version.poweredBy}</span>
                  <span className="pb-1 text-2xl font-bold leading-none opacity-90">v{version.frameworkVersion}</span>
                </div>
              </div>
            </div>

            {/* 构建工具信息 */}
            {version.releaseType === 'Stable' && (
              <>
                <div className="w-1 h-14 opacity-90 bg-foreground/70" />

                <div className="flex flex-col items-start space-y-4">
                  <div className="flex items-end space-x-2">
                    <GlowImage glowStrength={useDarkTheme ? 1 : 0} blurRadius={6}>
                      <RolldownLogo className="w-auto h-4" />
                    </GlowImage>
                  </div>
                  <GlowImage glowStrength={useDarkTheme ? 1 : 0} blurRadius={12}>
                    <ViteLogo className="w-auto h-8" />
                  </GlowImage>
                </div>
              </>
            )}
          </div>

          {/* Restore ID */}
          {typeof watermarkTextBitSize === 'number' && (
            <div className="flex justify-center">
              <span className="text-xs font-mono text-foreground/30">Restore ID: {watermarkTextBitSize}</span>
            </div>
          )}
        </div>
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
