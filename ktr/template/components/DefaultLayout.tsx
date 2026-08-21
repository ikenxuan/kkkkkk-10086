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
        //
        // 圆角外那圈是透明像素，能不能留住取决于成图编码：宿主只要看到 multiPage 为真就把编码
        // 强制改成 jpeg（renderers/puppeteer/lib/puppeteer.js:212-215），jpeg 没有 alpha，
        // 那圈会被合成成纯白（实测 rgba(255,255,255,255)）。所以本仓库不再走宿主的分片，
        // 一律单张元素截图拿 png，超高再自己用 sharp 切（src/module/utils/imageSlicer.ts）。
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
                {/*
                  viewBox 从上游的 `0 0 230 221` 收到墨迹本身的包围盒。
                  实测（浏览器 getBBox）路径墨迹是 x=28.5 y=21.4 w=178.3 h=178.3，
                  也就是四周各留了约 9.7% 的空白，上下对称、并没有偏移。
                  但框架那个 logo 是 PNG 且墨迹铺满整张图（398×398 全不透明），
                  同样给 h-18 时插件 logo 的实际图形只有它的 80.6%，看着小一圈、
                  在视觉上就读成了「偏上、没对齐」。
                  裁掉留白之后两个 logo 的墨迹等高，观感才真正齐平。
                */}
                <svg id="114514" xmlns="http://www.w3.org/2000/svg" viewBox="28.5 21.4 178.3 178.3" className="w-auto h-18">
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
                {/*
                  whitespace-nowrap + text-4xl 是本仓库相对上游的必要偏离，不是随手改的字号。
                  上游那两个名字只有 3 个和 5 个字符，照它的 text-5xl 排一行绰绰有余；
                  本仓库是 `kkkkkk-10086`（12 字）和 `TRSS-Yunzai`（11 字），在 releaseType 为
                  Stable（右边多出分隔线 + Rolldown/Vite 一整块）时整行自然宽度只剩几十 px 余量，
                  hash 多一位、通道词换一个都会把它顶过 1440，flex 于是把这两个名字压成两行。
                  锁 nowrap 是让「换行」这个失效模式不可能发生；降一档字号是把余量做够
                  （实测最坏情况余量从 48px 提到 274px）。
                */}
                <span className="text-4xl font-black whitespace-nowrap">{version.pluginName}</span>
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
                  'text-4xl font-bold tracking-wide whitespace-nowrap',
                  version.hasUpdate && 'text-success',
                  !version.hasUpdate && version.releaseType === 'Preview' && 'text-warning'
                )}
              >
                v{version.pluginVersion}
                {/*
                  本仓库相对上游 DefaultLayout 的本地增量：版本号后面接一段 git describe 风格的
                  构建标识，连起来读就是 `v2.38.2-2-g201e9da-dirty`。
                  三段都可选：压缩包安装、构建时没有 git、探测不到工作区状态时各自缺哪段就不显示。

                  跟着版本号排在同一行（而不是另起一行）：单独一行会让版本块变成三层，
                  比左右两侧高出一截、基线也对不上，看着更别扭。
                  字号压到 text-lg 并 align-baseline 贴住版本号的基线，
                  整块（含 STABLE 那行）就只有两层，和插件名、框架名齐平。
                  横向余量够：实测 Stable（右边多出分隔线 + Rolldown/Vite 一整块）最坏情况
                  自然宽 1276/1440，仍余 164px。
                */}
                {(version.commitId || version.dirty || (typeof version.commitsAhead === 'number' && version.commitsAhead > 0)) && (
                  <span className="align-baseline font-mono text-lg font-medium opacity-50">
                    {typeof version.commitsAhead === 'number' && version.commitsAhead > 0 && `-${version.commitsAhead}`}
                    {version.commitId && `-g${version.commitId}`}
                    {version.dirty && '-dirty'}
                  </span>
                )}
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
                  {/* 同上：nowrap + 降一档字号，理由见插件名那处的注释 */}
                  <span className="text-4xl font-black leading-none whitespace-nowrap opacity-90">{version.poweredBy}</span>
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
