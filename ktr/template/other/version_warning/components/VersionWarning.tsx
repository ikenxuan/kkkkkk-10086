import { Chip } from '@heroui/react'
import { Puzzle } from 'lucide-react'
import React from 'react'

import { DefaultLayout } from '../../../components/DefaultLayout'
import { GlowImage } from '../../../components/GlowImage'
import type { PosterProps } from '../../../types/ctx'
import { cn } from '../../../../utils/cn'
import { isDark as isDarkMode } from '../../../../utils/theme'
import type { VersionWarningData } from './types'

export const VersionWarning: React.FC<PosterProps<VersionWarningData>> = (props) => {
  const isDark = isDarkMode(props.ctx)

  const bgColor = isDark ? '#1c1917' : '#faf5ef'
  const primaryColor = isDark ? '#fb923c' : '#c2410c'
  const secondaryColor = isDark ? '#fdba74' : '#9a3412'
  const mutedColor = isDark ? 'rgba(251,146,60,0.7)' : '#b45309'
  const accentColor = isDark ? '#fed7aa' : '#7c2d12'

  return (
    <DefaultLayout
      ctx={{ ...props.ctx, version: undefined }}
      className="relative overflow-hidden"
      style={{ backgroundColor: bgColor, height: '2450px' }}
    >
      {/* 弥散光背景 */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute rounded-full w-315 h-360 -top-67.5 -left-45 blur-[108px] -rotate-20"
          style={{
            background: isDark
              ? 'radial-gradient(ellipse at 40% 40%, rgba(194,65,12,0.4) 0%, rgba(154,52,18,0.2) 50%, transparent 100%)'
              : 'radial-gradient(ellipse at 40% 40%, rgba(234,88,12,0.5) 0%, rgba(251,146,60,0.25) 50%, transparent 100%)'
          }}
        />
        <div
          className="absolute rounded-full w-225 h-270 top-112.5 -right-22.5 blur-[90px] rotate-15"
          style={{
            background: isDark
              ? 'radial-gradient(ellipse at 50% 50%, rgba(68,44,21,0.35) 0%, rgba(41,26,13,0.18) 50%, transparent 100%)'
              : 'radial-gradient(ellipse at 50% 50%, rgba(251,191,36,0.3) 0%, rgba(245,158,11,0.15) 50%, transparent 100%)'
          }}
        />
        <div
          className="absolute rounded-full w-270 h-225 -bottom-45 left-45 blur-[126px] -rotate-10"
          style={{
            background: isDark
              ? 'radial-gradient(ellipse at 50% 60%, rgba(180,83,9,0.35) 0%, rgba(146,64,14,0.18) 50%, transparent 100%)'
              : 'radial-gradient(ellipse at 50% 60%, rgba(194,65,12,0.4) 0%, rgba(180,83,9,0.2) 50%, transparent 100%)'
          }}
        />
      </div>

      {/* 单色噪点层 */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: isDark ? 0.1 : 0.15 }}>
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <filter id="pixelNoise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" stitchTiles="stitch" result="noise" />
            {/* 噪点 */}
            <feColorMatrix type="saturate" values="0" result="gray" />
            {/* 二值化 */}
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues="0 1" />
              <feFuncG type="discrete" tableValues="0 1" />
              <feFuncB type="discrete" tableValues="0 1" />
            </feComponentTransfer>
          </filter>
          <rect width="100%" height="100%" filter="url(#pixelNoise)" />
        </svg>
      </div>

      {/* 背景大字 */}
      <div className="absolute bottom-25 right-18 pointer-events-none select-none opacity-[0.03]">
        <span
          className="text-[200px] font-black tracking-tighter leading-none block text-right"
          style={{ color: isDark ? '#fff' : '#78350f' }}
        >
          VERSION
        </span>
        <span
          className="text-[200px] font-black tracking-tighter leading-none block text-right"
          style={{ color: isDark ? '#fff' : '#78350f' }}
        >
          WARNING
        </span>
      </div>

      {/* 内容层 */}
      <div className="relative z-10 flex flex-col justify-between h-full p-18">
        {/* 顶部 */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-12">
            <p className="text-[28px] font-medium tracking-[0.3em] uppercase" style={{ color: mutedColor }}>
              kkkkkk-10086
            </p>
            <h1 className="text-[180px] font-black leading-none" style={{ color: accentColor }}>
              请升级你的
            </h1>
            <h1 className="text-[120px] font-black leading-none" style={{ color: accentColor }}>
              <span className="font-mono">Yunzai</span>
            </h1>
          </div>
          {/* 右上角装饰图形 */}
          <div className="flex flex-col items-end space-y-3 mt-4">
            <div className="flex space-x-3">
              <div className="w-8 h-8 rounded-full" style={{ backgroundColor: accentColor, opacity: 0.2 }} />
              <div className="w-8 h-8 rounded-full" style={{ backgroundColor: accentColor, opacity: 0.4 }} />
              <div className="w-8 h-8 rounded-full" style={{ backgroundColor: accentColor, opacity: 0.6 }} />
              <div className="w-8 h-8 rounded-full" style={{ backgroundColor: accentColor }} />
            </div>
            <div className="flex space-x-3">
              <div className="w-8 h-8 rounded" style={{ backgroundColor: secondaryColor, opacity: 0.15 }} />
              <div className="w-8 h-8 rounded" style={{ backgroundColor: secondaryColor, opacity: 0.3 }} />
              <div className="w-8 h-8 rounded" style={{ backgroundColor: secondaryColor, opacity: 0.5 }} />
            </div>
            <div className="flex space-x-3">
              <div className="w-8 h-8 rotate-45" style={{ backgroundColor: mutedColor, opacity: 0.1 }} />
              <div className="w-8 h-8 rotate-45" style={{ backgroundColor: mutedColor, opacity: 0.25 }} />
            </div>
          </div>
        </div>

        {/* 中间 */}
        <div className="flex-1 flex flex-col justify-center">
          {/* 版本对比卡片 */}
          <div className="rounded-7xl p-12" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)' }}>
            {/* 版本对比 */}
            <div className="flex items-stretch mb-10">
              {/* 当前版本 */}
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: primaryColor }} />
                  <span className="text-[28px] font-medium" style={{ color: mutedColor }}>
                    当前 Yunzai 环境版本
                  </span>
                </div>
                <div className="relative inline-block">
                  <span className="text-[56px] font-black font-mono leading-tight opacity-50 break-all" style={{ color: primaryColor }}>
                    v{props.data.currentVersion}
                  </span>
                  <div
                    className="absolute top-1/2 -left-2 -right-2 h-1.5 -rotate-3 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                  />
                </div>
              </div>

              {/* 分隔线 */}
              <div
                className="w-0.5 rounded-full mx-10"
                style={{ backgroundColor: isDark ? 'rgba(251,146,60,0.2)' : 'rgba(180,83,9,0.15)' }}
              />

              {/* 需要版本 */}
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: accentColor }} />
                  <span className="text-[28px] font-medium" style={{ color: mutedColor }}>
                    插件建议的环境版本
                  </span>
                  <Chip
                    className="text-xl font-bold rounded-full px-4 py-2"
                    style={{ backgroundColor: accentColor, color: bgColor }}
                    size="md"
                  >
                    推荐
                  </Chip>
                </div>
                <span className="text-[56px] font-black font-mono leading-tight break-all" style={{ color: accentColor }}>
                  v{props.data.requireVersion}
                </span>
              </div>
            </div>

            {/* 分隔线 */}
            <div
              className="h-0.5 rounded-full mb-10"
              style={{ backgroundColor: isDark ? 'rgba(251,146,60,0.2)' : 'rgba(180,83,9,0.15)' }}
            />

            {/* 更新方案 */}
            <div className="space-y-20">
              {/* 方案一：云崽管理面板 / 锅巴 */}
              <div>
                <div className="flex items-center space-x-4 mb-6">
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-xl"
                    style={{ backgroundColor: isDark ? 'rgba(251,146,60,0.15)' : 'rgba(194,65,12,0.1)' }}
                  >
                    <span className="text-[28px] font-black" style={{ color: accentColor }}>
                      1
                    </span>
                  </div>
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={mutedColor} strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 3v18M3 9h18M3 15h18" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[32px] font-bold" style={{ color: mutedColor }}>
                    云崽管理面板 / 锅巴
                  </span>
                  <Chip
                    className="text-2xl font-semibold px-5 py-3 rounded-full"
                    style={{
                      backgroundColor: isDark ? 'rgba(251,146,60,0.2)' : 'rgba(194,65,12,0.15)',
                      color: accentColor
                    }}
                    size="lg"
                  >
                    推荐
                  </Chip>
                </div>
                <div className="ml-14 space-y-4">
                  <div className="flex items-start space-x-4">
                    <div className="w-3 h-3 rounded-full mt-3 shrink-0" style={{ backgroundColor: mutedColor }} />
                    <span className="text-[28px] leading-relaxed" style={{ color: secondaryColor }}>
                      打开云崽管理面板或锅巴，查看插件与运行环境信息
                    </span>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-3 h-3 rounded-full mt-3 shrink-0" style={{ backgroundColor: mutedColor }} />
                    <span className="text-[28px] leading-relaxed" style={{ color: secondaryColor }}>
                      如面板提供更新入口，请先阅读更新日志并确认当前发行版
                    </span>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-3 h-3 rounded-full mt-3 shrink-0" style={{ backgroundColor: mutedColor }} />
                    <span className="text-[28px] leading-relaxed" style={{ color: secondaryColor }}>
                      完成更新后，按面板提示重启 <span className="font-mono font-black">Yunzai</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* 方案二：使用发行版更新命令 */}
              <div>
                <div className="flex items-center space-x-4 mb-6">
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-xl"
                    style={{ backgroundColor: isDark ? 'rgba(251,146,60,0.15)' : 'rgba(194,65,12,0.1)' }}
                  >
                    <span className="text-[28px] font-black" style={{ color: accentColor }}>
                      2
                    </span>
                  </div>
                  <Puzzle className={cn('w-10 h-auto')} style={{ color: mutedColor }} />
                  <span className="text-[32px] font-bold" style={{ color: mutedColor }}>
                    使用发行版更新命令
                  </span>
                  <Chip
                    className="text-2xl font-semibold px-5 py-3 rounded-full"
                    style={{
                      backgroundColor: isDark ? 'rgba(251,146,60,0.2)' : 'rgba(194,65,12,0.15)',
                      color: accentColor
                    }}
                    size="lg"
                  >
                    推荐
                  </Chip>
                </div>
                <div className="ml-14 space-y-4">
                  <div className="flex items-start space-x-4">
                    <div className="w-3 h-3 rounded-full mt-3 shrink-0" style={{ backgroundColor: mutedColor }} />
                    <span className="text-[28px] leading-relaxed" style={{ color: secondaryColor }}>
                      <span className="font-mono font-black">Miao-Yunzai</span> 与{' '}
                      <span className="font-mono font-black">TRSS-Yunzai</span> 的更新方式可能不同
                    </span>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-3 h-3 rounded-full mt-3 shrink-0" style={{ backgroundColor: mutedColor }} />
                    <span className="text-[28px] leading-relaxed" style={{ color: secondaryColor }}>
                      在机器人会话中使用当前发行版提供的更新命令
                    </span>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-3 h-3 rounded-full mt-3 shrink-0" style={{ backgroundColor: mutedColor }} />
                    <span className="text-[28px] leading-relaxed" style={{ color: secondaryColor }}>
                      也可通过锅巴检查并调整本插件配置
                    </span>
                  </div>
                </div>
              </div>

              {/* 方案三：按发行版文档手动更新 */}
              <div>
                <div className="flex items-center space-x-4 mb-6">
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-xl"
                    style={{ backgroundColor: isDark ? 'rgba(251,146,60,0.15)' : 'rgba(194,65,12,0.1)' }}
                  >
                    <span className="text-[28px] font-black" style={{ color: accentColor }}>
                      3
                    </span>
                  </div>
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={mutedColor} strokeWidth="2">
                    <path d="M4 17l6-6-6-6M12 19h8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[32px] font-bold" style={{ color: mutedColor }}>
                    按发行版文档手动更新
                  </span>
                </div>
                <div className="ml-14 space-y-4">
                  <p className="text-[28px]" style={{ color: secondaryColor }}>
                    进入当前 Yunzai 发行版的根目录
                  </p>
                  <div className="rounded-xl p-6" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.7)' }}>
                    <code className="text-[40px] font-mono font-bold block" style={{ color: accentColor }}>
                      请按当前发行版文档执行更新命令
                    </code>
                  </div>
                  <p className="text-[28px] opacity-80" style={{ color: secondaryColor }}>
                    不同发行版命令不同，更新完成后重启 Yunzai
                  </p>
                </div>
              </div>
            </div>

            {/* 分隔线 */}
            <div
              className="h-0.5 rounded-full my-10"
              style={{ backgroundColor: isDark ? 'rgba(251,146,60,0.2)' : 'rgba(180,83,9,0.15)' }}
            />

            {/* 重要提示 */}
            <div
              className="rounded-4xl p-6 flex items-start space-x-5"
              style={{ backgroundColor: isDark ? 'rgba(251,146,60,0.08)' : 'rgba(194,65,12,0.08)' }}
            >
              <svg className="w-10 h-10 mt-1 shrink-0" viewBox="0 0 24 24" fill={accentColor}>
                <path d="M12 2L22 20H2L12 2Z" />
                <path d="M12 9v4M12 17h.01" stroke={bgColor} strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div className="flex-1">
                <p className="text-[28px] font-semibold mb-2" style={{ color: accentColor }}>
                  版本兼容性提示
                </p>
                <p className="text-[26px] leading-relaxed" style={{ color: secondaryColor }}>
                  本插件适配 <span className="font-bold font-mono">Miao-Yunzai / TRSS-Yunzai</span> 生态；当前环境建议达到{' '}
                  <span className="font-bold font-mono" style={{ color: accentColor }}>
                    v{props.data.requireVersion}
                  </span>
                  。版本号由适配器报告，升级方式请以所用发行版文档为准
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 底部 */}
        <div className="flex justify-between items-end">
          {/* 左下角 */}
          <div className="flex flex-col space-y-3">
            <svg className="w-9 h-9 opacity-25" viewBox="0 0 24 24" fill="none" stroke={mutedColor} strokeWidth="1.5">
              <path d="M12 2L22 20H2L12 2Z" />
            </svg>
            <svg className="w-9 h-9 opacity-40" viewBox="0 0 24 24" fill="none" stroke={mutedColor} strokeWidth="1.5">
              <path d="M12 2L22 20H2L12 2Z" />
            </svg>
            <svg className="w-9 h-9 opacity-60" viewBox="0 0 24 24" fill="none" stroke={mutedColor} strokeWidth="1.5">
              <path d="M12 2L22 20H2L12 2Z" />
            </svg>
            <svg className="w-9 h-9" viewBox="0 0 24 24" fill={accentColor}>
              <path d="M12 2L22 20H2L12 2Z" />
            </svg>
          </div>

          {/* 右下角 */}
          <div className="flex items-end space-x-7">
            <div className="flex flex-col items-end justify-end h-25">
              <span className="text-[22px] font-bold tracking-widest uppercase" style={{ color: mutedColor }}>
                YUNZAI-PLUGIN
              </span>
              <span className="text-[54px] font-black leading-none" style={{ color: accentColor }}>
                kkkkkk-10086
              </span>
            </div>
            <GlowImage
              src="/image/logo.png"
              alt="kkkkkk-10086"
              imgClassName="h-22 w-auto"
              glowStrength={1}
              blurRadius={20}
            />
          </div>
        </div>
      </div>
    </DefaultLayout>
  )
}
