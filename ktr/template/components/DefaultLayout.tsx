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
  const { version, alphaOutput, watermarkTextBitSize } = ctx

  return (
    <>
      {/*
        只有成图真能留住 alpha 时才把外壳的兜底底色去掉（见 style.css 里 #container 那条）。
        圆角外那圈透明像素靠它才透得出来；否则外壳的不透明底会把圆角填成四个色块。
        写成模板内联 style 而不是改 style.css：那条兜底规则对 jpeg 路径仍然必要，
        这里只在确定用不上时局部撤掉。
      */}
      {alphaOutput && <style>{'#container{background-color:transparent !important}'}</style>}
      <div
      className={cn(
        /*
         * 卡片是直角的，不带 rounded-[5rem]：宿主 TRSS-Yunzai 截的是 #container
         * （renderers/puppeteer/lib/puppeteer.js:199），并且在 multiPage 为真时把编码强制改成 jpeg
         * （同文件 212-215 行，我们传的 imgType: 'png' 直接被覆盖）。jpeg 没有 alpha，圆角外那圈
         * 透明像素会被合成成纯白 —— 也就是用户看到的成图四角白色三角。
         *
         * 补一层同色不透明底能把白色去掉，但四角仍然是三角形：氛围辉光层被 overflow-hidden + 圆角
         * 裁在圆弧内，角上只剩纯底色，跟紧邻的卡片内部对不上。所以在这个宿主上圆角根本渲染不出来，
         * 只会渲染成四个色块。直角之后角上就是卡片内部本身（辉光照常铺过去），完全没有分界。
         * 参考 gscore-adapter 的做法：不依赖透明度，整幅图都是不透明的，直接交给 jpeg。
         *
         * overflow-hidden 与 relative 仍从旧引擎外壳（#container 规则 / transform 语义）迁来：
         * 根元素是绝对定位包含块，模板里 inset-0 的氛围层锚定在卡片矩形上并被裁剪，而不是锚到视口逃逸出去。
         */
        'relative w-360 shrink-0 overflow-hidden bg-background bg-clip-padding text-foreground font-[HarmonyOSHans-Regular]',
        // 圆角只在 alpha 能留住时才上，理由见下面那段注释和 ctx.alphaOutput 的说明
        alphaOutput && 'rounded-[5rem]',
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
                {/*
                  本仓库相对上游 DefaultLayout 的本地增量：版本号后面补上 git describe 风格的
                  构建标识，形如 v2.36.0-2-gf5f8315-dirty。
                  `g` 前缀沿用 git describe 的写法，表示后面那串是 commit 而不是版本号的一部分。
                  三段都可选：压缩包安装、构建时没有 git、探测不到工作区状态时各自缺哪段就不显示，
                  最少也能退化成干净的 v2.36.0。
                */}
                {typeof version.commitsAhead === 'number' && version.commitsAhead > 0 && (
                  <span className="font-mono text-4xl opacity-70">-{version.commitsAhead}</span>
                )}
                {version.commitId && (
                  <span className="font-mono text-4xl opacity-70">-g{version.commitId}</span>
                )}
                {version.dirty && <span className="font-mono text-4xl opacity-70">-dirty</span>}
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
    </>
  )
}
