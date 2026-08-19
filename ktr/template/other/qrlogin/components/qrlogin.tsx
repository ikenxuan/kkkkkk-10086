import { AlertTriangle, QrCode, Smartphone } from 'lucide-react'
import React from 'react'

import { DefaultLayout } from '../../../components/DefaultLayout'
import { GlowImage } from '../../../components/GlowImage'
import type { PosterProps } from '../../../types/ctx'
import { generateQRCode } from '../../../../utils/QRcode'
import { isDark as isDarkMode } from '../../../../utils/theme'
import type { QrLoginData } from './types'

/**
 * APP 扫码登录组件
 * @param props 组件属性
 * @returns JSX元素
 */
export const QrLogin: React.FC<PosterProps<QrLoginData>> = React.memo((props) => {
  const qrValue = props.data.qr_url ?? props.data.share_url
  const qrCodeDataUrl = qrValue ? generateQRCode(qrValue, isDarkMode(props.ctx) ?? false) : ''
  const isDark = isDarkMode(props.ctx) ?? false

  // 使用蓝紫色系弥散渐变
  const bgColor = isDark ? '#0f0f1a' : '#f8f6ff'
  const secondaryColor = isDark ? '#a78bfa' : '#8b5cf6'
  const mutedColor = isDark ? 'rgba(129,140,248,0.7)' : '#7c3aed'
  const accentColor = isDark ? '#c4b5fd' : '#4f46e5'
  const warningColor = isDark ? '#f87171' : '#dc2626' // 改为红色系警告色

  return (
    <DefaultLayout
      ctx={{ ...props.ctx, version: undefined }}
      className="relative overflow-hidden"
      style={{ backgroundColor: bgColor, minHeight: '2000px' }}
    >
      {/* 弥散光背景 */}
      <div className="absolute inset-0 pointer-events-none">
        {/* 顶部光斑 */}
        <div
          className="absolute rounded-full w-200 h-150 -top-50 left-1/2 -translate-x-1/2 blur-[150px]"
          style={{
            background: isDark
              ? 'radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.5) 0%, rgba(139,92,246,0.25) 50%, transparent 100%)'
              : 'radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.35) 0%, rgba(139,92,246,0.18) 50%, transparent 100%)'
          }}
        />
        {/* 中间光斑 */}
        <div
          className="absolute rounded-full w-175 h-175 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 blur-[140px]"
          style={{
            background: isDark
              ? 'radial-gradient(ellipse at 50% 50%, rgba(167,139,250,0.4) 0%, rgba(196,181,253,0.2) 50%, transparent 100%)'
              : 'radial-gradient(ellipse at 50% 50%, rgba(167,139,250,0.3) 0%, rgba(196,181,253,0.12) 50%, transparent 100%)'
          }}
        />
        {/* 底部光斑 */}
        <div
          className="absolute rounded-full w-200 h-150 -bottom-50 left-1/2 -translate-x-1/2 blur-[150px]"
          style={{
            background: isDark
              ? 'radial-gradient(ellipse at 50% 70%, rgba(124,58,237,0.35) 0%, rgba(99,102,241,0.18) 50%, transparent 100%)'
              : 'radial-gradient(ellipse at 50% 70%, rgba(124,58,237,0.25) 0%, rgba(99,102,241,0.12) 50%, transparent 100%)'
          }}
        />
      </div>

      {/* 噪点纹理层 */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: isDark ? 0.08 : 0.1 }}>
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <filter id="qrNoise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" result="gray" />
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues="0 1" />
              <feFuncG type="discrete" tableValues="0 1" />
              <feFuncB type="discrete" tableValues="0 1" />
            </feComponentTransfer>
          </filter>
          <rect width="100%" height="100%" filter="url(#qrNoise)" />
        </svg>
      </div>

      {/* 内容层 */}
      <div className="relative z-10 flex flex-col min-h-500 pt-20 pb-20 px-32">
        {/* 顶部标题区域 */}
        <div className="flex flex-col gap-5">
          <p className="text-2xl font-medium tracking-[0.3em] uppercase" style={{ color: mutedColor }}>
            kkkkkk-10086
          </p>
          <div className="flex items-center gap-6">
            <GlowImage glowStrength={0.8} blurRadius={25}>
              <Smartphone className="w-20 h-20" style={{ color: accentColor }} />
            </GlowImage>
            <h1 className="text-[90px] font-black leading-none" style={{ color: accentColor }}>
              扫码登录
            </h1>
          </div>
          <p className="text-3xl font-medium" style={{ color: secondaryColor }}>
            使用手机 APP 扫描二维码快速连接
          </p>
        </div>

        {/* 警告提示卡片 */}
        <div className="mt-10 mb-10">
          <div
            className="relative rounded-3xl p-10 border-4"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(124,58,237,0.15) 100%)'
                : 'linear-gradient(135deg, rgba(196,181,253,0.4) 0%, rgba(167,139,250,0.3) 100%)',
              borderColor: isDark ? '#a78bfa' : '#8b5cf6',
              boxShadow: isDark
                ? '0 0 60px rgba(139,92,246,0.4), inset 0 0 40px rgba(139,92,246,0.15)'
                : '0 0 60px rgba(139,92,246,0.3), inset 0 0 40px rgba(196,181,253,0.4)'
            }}
          >
            {/* 警告图标 */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2">
              <div
                className="rounded-full p-6"
                style={{
                  background: isDark
                    ? 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)'
                    : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  boxShadow: isDark ? '0 0 40px rgba(248,113,113,0.6)' : '0 0 40px rgba(239,68,68,0.5)'
                }}
              >
                <AlertTriangle className="w-16 h-16 text-white" strokeWidth={3} />
              </div>
            </div>

            {/* 警告内容 */}
            <div className="flex flex-col gap-6 mt-8">
              <div className="text-center">
                <h3 className="text-6xl font-black tracking-wider mb-4" style={{ color: warningColor }}>
                  ⚠ 安全警告 ⚠
                </h3>
                <div className="space-y-3">
                  <p className="text-4xl font-bold" style={{ color: isDark ? '#c4b5fd' : '#7c3aed' }}>
                    请勿截图转发此二维码
                  </p>
                  <p className="text-3xl font-medium" style={{ color: isDark ? '#a78bfa' : '#8b5cf6' }}>
                    图片含敏感登录信息
                  </p>
                </div>
              </div>

              {/* 分隔线 */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: isDark ? '#8b5cf6' : '#a78bfa', opacity: 0.5 }} />
                <span className="text-3xl" style={{ color: isDark ? '#a78bfa' : '#8b5cf6' }}>
                  ◆
                </span>
                <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: isDark ? '#8b5cf6' : '#a78bfa', opacity: 0.5 }} />
              </div>

              <div className="text-center">
                <p className="text-4xl font-bold tracking-wide" style={{ color: warningColor }}>
                  泄露将导致服务器安全风险
                </p>
                <p className="text-3xl font-medium mt-3" style={{ color: isDark ? '#a78bfa' : '#8b5cf6' }}>
                  CONFIDENTIAL · 机密信息
                </p>
              </div>
            </div>

            {/* 装饰性边角 */}
            <div
              className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 rounded-tl-2xl"
              style={{ borderColor: isDark ? '#a78bfa' : '#8b5cf6' }}
            />
            <div
              className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 rounded-tr-2xl"
              style={{ borderColor: isDark ? '#a78bfa' : '#8b5cf6' }}
            />
            <div
              className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 rounded-bl-2xl"
              style={{ borderColor: isDark ? '#a78bfa' : '#8b5cf6' }}
            />
            <div
              className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 rounded-br-2xl"
              style={{ borderColor: isDark ? '#a78bfa' : '#8b5cf6' }}
            />
          </div>
        </div>

        {/* 中间二维码区域 */}
        <div className="flex-1 flex flex-col justify-center items-center py-12">
          {/* 二维码 */}
          {qrCodeDataUrl ? (
            <div className="flex justify-center items-center w-200 h-200">
              <img src={qrCodeDataUrl} alt="登录二维码" className="object-contain w-full h-full" />
            </div>
          ) : (
            <div className="flex flex-col gap-8 justify-center items-center w-200 h-200">
              <QrCode className="w-40 h-40" style={{ color: mutedColor }} />
              <span className="text-5xl font-medium" style={{ color: mutedColor }}>
                二维码生成中...
              </span>
            </div>
          )}

          {/* 扫码提示 */}
          <div className="mt-10 flex items-center gap-8">
            <div className="w-32 h-2 rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${mutedColor})` }} />
            <div className="flex items-center gap-4">
              <Smartphone className="w-12 h-12" style={{ color: mutedColor }} />
              <span className="text-5xl font-bold" style={{ color: mutedColor }}>
                打开 APP 扫一扫
              </span>
            </div>
            <div className="w-32 h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${mutedColor}, transparent)` }} />
          </div>
        </div>

        {/* 底部服务器信息 */}
        <div className="flex flex-col gap-6 mt-12">
          <div
            className="rounded-3xl p-10"
            style={{
              background: isDark ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.05)',
              border: `2px solid ${isDark ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.2)'}`
            }}
          >
            <div className="flex items-center gap-4 mb-6">
              <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke={mutedColor} strokeWidth="2">
                <rect x="2" y="2" width="20" height="8" rx="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" />
                <circle cx="6" cy="6" r="1" fill={mutedColor} />
                <circle cx="6" cy="18" r="1" fill={mutedColor} />
              </svg>
              <span className="text-4xl font-bold" style={{ color: mutedColor }}>
                服务器地址
              </span>
            </div>
            <code className="text-6xl font-mono font-bold block text-center" style={{ color: accentColor }}>
              {props.data.serverUrl}
            </code>
          </div>
        </div>

        {/* 底部装饰和 Logo */}
        <div className="flex justify-between items-end mt-32">
          {/* 左下角装饰 */}
          <div className="flex flex-col space-y-3">
            <svg className="w-12 h-12 opacity-20" viewBox="0 0 24 24" fill="none" stroke={mutedColor} strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
            <svg className="w-12 h-12 opacity-40" viewBox="0 0 24 24" fill="none" stroke={mutedColor} strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
            <svg className="w-12 h-12" viewBox="0 0 24 24" fill={accentColor}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          </div>

          {/* 右下角 Logo */}
          <div className="flex items-end gap-6">
            <div className="flex flex-col items-end justify-end">
              <span className="text-3xl font-bold tracking-widest uppercase leading-tight mb-1" style={{ color: mutedColor }}>
                YUNZAI-PLUGIN
              </span>
              <span className="text-8xl font-black leading-none" style={{ color: accentColor }}>
                kkk
              </span>
            </div>
            <GlowImage glowStrength={1} blurRadius={25}>
              <img src="/image/logo.png" alt="kkkkkk-10086" className="w-auto h-36" />
            </GlowImage>
          </div>
        </div>
      </div>
    </DefaultLayout>
  )
})

QrLogin.displayName = 'QrLogin'

export default QrLogin
