import { SiApple, SiHonor, SiHuawei, SiOneplus, SiOppo, SiSamsung, SiVivo, SiXiaomi } from '@icons-pack/react-simple-icons'
import { ArrowDownToLine, Check, HelpCircle, Info, X } from 'lucide-react'
import React from 'react'

import { DefaultLayout } from '../../../components/DefaultLayout'
import { GlowImage } from '../../../components/GlowImage'
import type { PosterProps } from '../../../types/ctx'
import { isDark as isDarkMode } from '../../../../utils/theme'
import type { LivePhotoTipData } from './types'

/**
 * Google Photos 彩色官方 Logo
 */
const GooglePhotosIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <path d="M4,16a6,6,0,0,1,12,0Z" fill="#ffba00" />
    <path d="M22,10a6,6,0,0,1-6,6V4a6,6,0,0,1,6,6" fill="#ea4435" />
    <path d="M28,16a6,6,0,0,1-12,0Z" fill="#0066da" />
    <path d="M10,22a6,6,0,0,1,6-6V28a6,6,0,0,1-6-6" fill="#00ac47" />
  </svg>
)

type BrandStatus = 'verified' | 'untested' | 'unsupported'

interface BrandItem {
  icon: React.ReactNode
  color: string
  status: BrandStatus
}

const statusConfig: Record<BrandStatus, { icon: React.ComponentType<any>; color: string; label: string }> = {
  verified: { icon: Check, color: '#22c55e', label: '实测可用' },
  untested: { icon: HelpCircle, color: '#f59e0b', label: '理论支持' },
  unsupported: { icon: X, color: '#ef4444', label: '不支持' }
}

function BrandCard({ brand, isDark }: { brand: BrandItem; isDark: boolean }) {
  const StatusIcon = statusConfig[brand.status].icon
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative flex items-center justify-center w-75 h-75 rounded-3xl"
        style={{
          background: isDark
            ? 'radial-gradient(circle, ' + brand.color + '12 0%, transparent 70%)'
            : 'radial-gradient(circle, ' + brand.color + '08 0%, transparent 70%)'
        }}
      >
        {brand.icon}
        <div
          className="absolute top-4 right-4 flex items-center gap-1.5 px-5 py-2.5 rounded-full"
          style={{ backgroundColor: statusConfig[brand.status].color + '20' }}
        >
          <StatusIcon className="w-5 h-auto" style={{ color: statusConfig[brand.status].color }} />
          <span className="text-lg font-bold" style={{ color: statusConfig[brand.status].color }}>
            {statusConfig[brand.status].label}
          </span>
        </div>
      </div>
    </div>
  )
}

function UnsupportedBrandCard({ brand, isDark }: { brand: BrandItem; isDark: boolean }) {
  const StatusIcon = statusConfig[brand.status].icon
  return (
    <div className="flex flex-col items-center gap-2 opacity-50">
      <div
        className="relative flex items-center justify-center w-40 h-40 rounded-2xl"
        style={{
          background: isDark
            ? 'radial-gradient(circle, ' + brand.color + '08 0%, transparent 70%)'
            : 'radial-gradient(circle, ' + brand.color + '05 0%, transparent 70%)'
        }}
      >
        {brand.icon}
      </div>
      <div className="flex items-center gap-1">
        <StatusIcon className="w-5 h-auto" style={{ color: statusConfig[brand.status].color }} />
        <span className="text-md font-bold" style={{ color: statusConfig[brand.status].color }}>
          {statusConfig[brand.status].label}
        </span>
      </div>
    </div>
  )
}

/**
 * 实况图提示组件 - 正方形，Vercel 黑白风格
 */
export const LivePhotoTip: React.FC<PosterProps<LivePhotoTipData>> = React.memo((props) => {
  const isDark = isDarkMode(props.ctx) ?? false

  // Vercel 黑白风格
  const bgColor = isDark ? '#000000' : '#ffffff'
  const primaryColor = isDark ? '#ffffff' : '#000000'
  const secondaryColor = isDark ? '#888888' : '#666666'
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'
  const accentColor = isDark ? '#ffffff' : '#000000'

  const glow1 = 'radial-gradient(ellipse at 30% 40%, ' + (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') + ' 0%, transparent 70%)'
  const glow2 =
    'radial-gradient(ellipse at 70% 60%, ' + (isDark ? 'rgba(128,128,128,0.1)' : 'rgba(128,128,128,0.08)') + ' 0%, transparent 70%)'

  const noiseOpacity = isDark ? 0.04 : 0.06

  const appleColor = isDark ? '#ffffff' : '#000000'

  const supportedBrands: BrandItem[] = [
    { icon: <GooglePhotosIcon className="w-36 h-auto" />, color: '#4285F4', status: 'verified' },
    { icon: <SiXiaomi className="w-28 h-auto" style={{ color: '#FF6900' }} />, color: '#FF6900', status: 'verified' },
    { icon: <SiSamsung className="w-68 h-auto" style={{ color: '#1428A0' }} />, color: '#1428A0', status: 'verified' },
    { icon: <SiOppo className="w-58 h-auto" />, color: '#009B77', status: 'verified' },
    { icon: <SiOneplus className="w-26 h-auto" style={{ color: '#F50514' }} />, color: '#F50514', status: 'verified' },
    { icon: <SiHuawei className="w-32 h-auto" style={{ color: '#CF0A2C' }} />, color: '#CF0A2C', status: 'untested' },
    { icon: <SiHonor className="w-58 h-auto" style={{ color: '#00BFFF' }} />, color: '#00BFFF', status: 'untested' }
  ]

  const unsupportedBrands: BrandItem[] = [
    {
      icon: <SiApple className="w-20 h-auto" style={{ color: appleColor }} />,
      color: appleColor,
      status: 'unsupported'
    },
    { icon: <SiVivo className="w-24 h-auto" style={{ color: '#415FFF' }} />, color: '#415FFF', status: 'unsupported' }
  ]

  return (
    <DefaultLayout
      ctx={{ ...props.ctx, version: undefined }}
      className="relative overflow-hidden"
      style={{ backgroundColor: bgColor, minHeight: '1440px' }}
    >
      {/* 弥散光 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute rounded-full w-150 h-125 top-[20%] left-[10%] blur-[150px]" style={{ background: glow1 }} />
        <div className="absolute rounded-full w-125 h-112.5 bottom-[15%] right-[10%] blur-[130px]" style={{ background: glow2 }} />
      </div>

      {/* 噪点 */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: noiseOpacity }}>
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <filter id="tipNoise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" result="gray" />
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues="0 1" />
              <feFuncG type="discrete" tableValues="0 1" />
              <feFuncB type="discrete" tableValues="0 1" />
            </feComponentTransfer>
          </filter>
          <rect width="100%" height="100%" filter="url(#tipNoise)" />
        </svg>
      </div>

      {/* 装饰 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-20 grid grid-cols-5 gap-2 opacity-30">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
          ))}
        </div>
        <div className="absolute top-20 right-20 flex flex-col items-end gap-2 opacity-30">
          <div className="h-0.75 rounded-full w-20" style={{ backgroundColor: secondaryColor }} />
          <div className="h-0.75 rounded-full w-12" style={{ backgroundColor: secondaryColor }} />
          <div className="h-0.75 rounded-full w-6" style={{ backgroundColor: secondaryColor }} />
        </div>
        <div className="absolute bottom-40 left-10 flex gap-2 opacity-30">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
        </div>
        <div className="absolute bottom-10 right-10 opacity-30">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke={primaryColor} strokeWidth="2" />
            <circle cx="50" cy="50" r="28" fill="none" stroke={secondaryColor} strokeWidth="2" />
          </svg>
        </div>
      </div>

      {/* 内容层 - 正方形 */}
      <div className="relative z-10 flex flex-col min-h-360 px-16 py-16">
        {/* 顶部标签 */}
        {/* <div className='flex items-center gap-3 mb-10'>
          <div className='w-2.5 h-2.5 rounded-full' style={{ backgroundColor: primaryColor }} />
          <span className='text-xl font-bold tracking-[0.2em] uppercase' style={{ color: mutedColor }}>
            kkkkkk-10086 · 实况照片
          </span>
        </div> */}
        <div className="h-20"></div>

        {/* 核心提示 */}
        <div className="flex items-center gap-5 mb-16">
          <div
            className="rounded-full p-5 shrink-0"
            style={{
              background: 'radial-gradient(circle, ' + (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') + ' 0%, transparent 70%)'
            }}
          >
            <ArrowDownToLine className="w-30 h-auto" style={{ color: primaryColor }} />
          </div>
          <div>
            <h1 className="text-4xl font-bold leading-tight" style={{ color: accentColor }}>
              保存原图
            </h1>
            <p className="text-5xl mt-1" style={{ color: mutedColor }}>
              点击「查看原图」后保存到相册即可识别为实况照片
            </p>
          </div>
        </div>

        {/* 品牌 Logo 矩阵 */}
        <div className="flex-1 flex flex-col justify-center items-center gap-6">
          {/* 主体区域：支持 + 理论支持 */}
          <div className="flex flex-col gap-6">
            <div className="flex justify-center gap-6">
              {supportedBrands.slice(0, 4).map((brand, idx) => (
                <BrandCard key={idx} brand={brand} isDark={isDark} />
              ))}
            </div>
            <div className="flex justify-center gap-6">
              {supportedBrands.slice(4).map((brand, idx) => (
                <BrandCard key={idx} brand={brand} isDark={isDark} />
              ))}
            </div>
          </div>

          {/* 分隔线 */}
          <div className="w-200 h-px" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }} />

          {/* 下方区域：不支持（显著缩小 + 弱化） */}
          <div className="flex justify-center gap-8">
            {unsupportedBrands.map((brand, idx) => (
              <UnsupportedBrandCard key={idx} brand={brand} isDark={isDark} />
            ))}
          </div>
        </div>

        {/* 兼容说明 */}
        <div
          className="flex items-start gap-4 mt-12 px-8 py-5 rounded-2xl"
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}
        >
          <Info className="w-6 h-6 shrink-0 mt-0.5" style={{ color: primaryColor }} />
          <p className="text-xl leading-relaxed" style={{ color: mutedColor }}>
            所有支持 Google Motion Photo 标准的相册 App 均可识别实况照片
          </p>
        </div>

        {/* 底部：kkk 品牌标识 + Logo */}
        <div className="flex justify-end items-end mt-auto pt-12">
          <div className="flex items-end gap-6">
            <div className="flex flex-col items-end">
              <span className="text-xl font-bold tracking-[0.15em] uppercase" style={{ color: mutedColor }}>
                YUNZAI-PLUGIN
              </span>
              <span className="text-5xl font-black" style={{ color: accentColor }}>
                kkk
              </span>
            </div>
            <GlowImage glowStrength={1} blurRadius={25}>
              <img src="/image/logo.png" alt="kkkkkk-10086" className="w-auto h-20" />
            </GlowImage>
          </div>
        </div>
      </div>
    </DefaultLayout>
  )
})

LivePhotoTip.displayName = 'LivePhotoTip'

export default LivePhotoTip
