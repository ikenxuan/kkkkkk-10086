import { SiBilibili } from '@icons-pack/react-simple-icons'
import { AlertTriangle, ScanLine, User } from 'lucide-react'
import React from 'react'
import { RiArrowRightFill } from 'react-icons/ri'

import { DefaultLayout } from '../../../components/DefaultLayout'
import type { PosterProps } from '../../../types/ctx'
import { generateQRCode } from '../../../../utils/QRcode'
import { isDark as isDarkMode } from '../../../../utils/theme'
import type { BilibiliQrcodeImgData } from './types'

/**
 * B站二维码登录组件
 * @param props 组件属性
 * @returns JSX元素
 */
export const BilibiliQrcodeImg: React.FC<PosterProps<BilibiliQrcodeImgData>> = React.memo((props) => {
  const isDark = isDarkMode(props.ctx)
  const qrCodeDataUrl = generateQRCode(props.data.share_url, isDark)

  const theme = {
    bg: isDark ? '#000000' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#000000',
    subText: isDark ? '#888888' : '#666666',
    accent: '#FF6699', // B站粉
    // 双色弥散
    gradientTL: '#FF6699', // 左上 B站粉
    gradientBR: '#00AEEC' // 右下 B站蓝
  }

  const disclaimer = [
    '您将通过扫码完成获取哔哩哔哩网页端的用户登录凭证（ck），该ck将用于请求哔哩哔哩WEB API接口。',
    '本BOT不会上传任何有关你的信息到第三方，所配置的 ck 只会用于请求官方 API 接口。',
    '我方仅提供视频解析及相关哔哩哔哩内容服务,若您的账号封禁、被盗等处罚与我方无关。',
    '害怕风险请勿扫码 ~'
  ]

  return (
    <DefaultLayout
      ctx={props.ctx}
      className="relative overflow-hidden font-sans"
      style={{
        background: theme.bg,
        color: theme.text
      }}
    >
      {/* 1. 弥散模糊效果 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* 右上角主光辉 */}
        <div
          className="absolute top-[-40%] right-[-50%] w-400 h-600 rounded-full blur-[200px] opacity-25"
          style={{ background: theme.gradientBR }}
        />
        {/* 左下角氛围光 */}
        <div
          className="absolute bottom-[-40%] left-[-50%] w-400 h-600 rounded-full blur-[200px] opacity-25"
          style={{ background: theme.gradientTL }}
        />
      </div>

      {/* 2. 单色噪点层 */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: isDark ? 0.16 : 0.2 }}>
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <filter id="pixelNoise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" result="gray" />
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues="0 1" />
              <feFuncG type="discrete" tableValues="0 1" />
              <feFuncB type="discrete" tableValues="0 1" />
            </feComponentTransfer>
          </filter>
          <rect width="100%" height="100%" filter="url(#pixelNoise)" />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center h-full py-40 px-24 space-y-32">
        {/* 标题区 */}
        <div className="text-center space-y-12">
          {/* Title */}
          <h1 className="text-8xl font-bold tracking-tight">
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(to right, ${theme.text}, ${theme.subText})`
              }}
            >
              B站扫码登录
            </span>
          </h1>

          {/* 操作步骤 */}
          <div className="flex items-start justify-center gap-10 opacity-90" style={{ color: theme.text }}>
            {/* Step 1 */}
            <div className="flex flex-col items-center gap-4">
              <div className="p-5 rounded-3xl bg-surface/50 backdrop-blur-md">
                <SiBilibili size={64} />
              </div>
              <span className="text-[28px] font-medium tracking-wide">打开哔哩哔哩</span>
            </div>
            <RiArrowRightFill size={40} className="mt-8 opacity-40" />
            {/* Step 2 */}
            <div className="flex flex-col items-center gap-4">
              <div className="p-5 rounded-3xl bg-surface/50 backdrop-blur-md">
                <User size={64} />
              </div>
              <span className="text-[28px] font-medium tracking-wide">点击我的</span>
            </div>
            <RiArrowRightFill size={40} className="mt-8 opacity-40" />
            {/* Step 3 */}
            <div className="flex flex-col items-center gap-4">
              <div className="p-5 rounded-3xl bg-surface/50 backdrop-blur-md">
                <ScanLine size={64} />
              </div>
              <span className="text-[28px] font-medium tracking-wide">右上角扫一扫</span>
            </div>
          </div>
        </div>

        {/* 二维码 */}
        <div className="relative group">
          <div
            className="relative p-4"
            style={{
              width: '800px',
              height: '800px'
            }}
          >
            {qrCodeDataUrl ? (
              <img src={qrCodeDataUrl} alt="QR Code" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-8">
                <div className="w-24 h-24 border-4 border-border rounded-full animate-spin" style={{ borderTopColor: theme.accent }} />
                <span className="text-3xl text-muted">未提供二维码图片</span>
              </div>
            )}
          </div>

          {/* 倒计时 */}
          <div className="absolute -bottom-24 left-0 right-0 text-center">
            <p className="text-[28px] font-medium tracking-wide flex items-center justify-center gap-3" style={{ color: theme.subText }}>
              <span
                className="h-6 w-1.5 rounded-full shadow-[0_0_8px_rgba(255,102,153,0.8)]"
                style={{ backgroundColor: theme.accent }}
              ></span>
              此二维码 120 秒内有效，请及时扫码登录。
            </p>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="w-full max-w-4xl pt-20">
          <div className="flex flex-col items-center space-y-6 text-center">
            <div className="flex items-center justify-center w-16 h-16 mb-2">
              <AlertTriangle size={64} style={{ color: theme.text }} strokeWidth={1.5} />
            </div>
            <h3 className="text-[40px] font-bold" style={{ color: theme.text }}>
              免责声明
            </h3>
            <div className="text-[24px] leading-relaxed opacity-60 space-y-2 max-w-3xl" style={{ color: theme.text }}>
              {disclaimer.map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DefaultLayout>
  )
})

BilibiliQrcodeImg.displayName = 'BilibiliQrcodeImg'

export default BilibiliQrcodeImg
