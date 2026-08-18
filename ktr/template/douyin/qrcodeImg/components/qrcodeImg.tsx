import { Menu, ScanLine, ShieldCheck, Smartphone } from 'lucide-react'
import React from 'react'
import { RiArrowRightFill, RiTiktokFill } from 'react-icons/ri'

import { DefaultLayout } from '../../../components/DefaultLayout'
import type { PosterProps } from '../../../types/ctx'
import { generateQRCode } from '../../../../utils/QRcode'
import { isDark as isDarkMode } from '../../../../utils/theme'
import type { DouyinQrcodeImgData } from './types'

/**
 * 抖音二维码登录组件
 * @param props 组件属性
 * @returns JSX元素
 */
export const DouyinQrcodeImg: React.FC<PosterProps<DouyinQrcodeImgData>> = React.memo((props) => {
  const isDark = isDarkMode(props.ctx)
  const qrCodeImage = generateQRCode(props.data.share_url || '', isDark)

  const theme = {
    bg: isDark ? '#000000' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#000000',
    subText: isDark ? '#888888' : '#666666',
    accent: '#FF2C55',
    // 双色弥散
    gradientTL: '#fe1700', // 左上
    gradientBR: '#0fffff' // 右下
  }

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
        {/* 左上角主光辉 */}
        <div
          className="absolute top-[-40%] left-[-50%] w-400 h-600 rounded-full blur-[200px] opacity-25"
          style={{ background: theme.gradientTL }}
        />
        {/* 右下角氛围光 */}
        <div
          className="absolute top-[80%] right-[-50%] w-400 h-600 rounded-full blur-[200px] opacity-25"
          style={{ background: theme.gradientBR }}
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
            <span className="bg-linear-to-r from-foreground to-muted bg-clip-text text-transparent">扫码登录</span>
          </h1>

          {/* 操作步骤 */}
          <div className="flex items-start justify-center gap-10 opacity-90" style={{ color: theme.text }}>
            {/* Step 1 */}
            <div className="flex flex-col items-center gap-4">
              <div className="p-5 rounded-3xl bg-surface/50 backdrop-blur-md">
                <RiTiktokFill size={64} />
              </div>
              <span className="text-[28px] font-medium tracking-wide">打开抖音</span>
            </div>
            <RiArrowRightFill size={40} className="mt-8 opacity-40" />
            {/* Step 2 */}
            <div className="flex flex-col items-center gap-4">
              <div className="p-5 rounded-3xl bg-surface/50 backdrop-blur-md">
                <Menu size={64} />
              </div>
              <span className="text-[28px] font-medium tracking-wide">左上角菜单</span>
            </div>
            <RiArrowRightFill size={40} className="mt-8 opacity-40" />
            {/* Step 3 */}
            <div className="flex flex-col items-center gap-4">
              <div className="p-5 rounded-3xl bg-surface/50 backdrop-blur-md">
                <ScanLine size={64} />
              </div>
              <span className="text-[28px] font-medium tracking-wide">顶部扫一扫</span>
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
            {qrCodeImage ? (
              <img src={qrCodeImage} alt="QR Code" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-8">
                <div
                  className="w-24 h-24 border-4 border-border rounded-full animate-spin"
                  style={{ borderTopColor: theme.accent }}
                />
              </div>
            )}
          </div>

          {/* 倒计时 */}
          <div className="absolute -bottom-24 left-0 right-0 text-center">
            <p className="text-[28px] font-medium tracking-wide flex items-center justify-center gap-3" style={{ color: theme.subText }}>
              <span className="h-6 w-1.5 rounded-full bg-danger shadow-[0_0_8px_rgba(255,44,85,0.8)]"></span>
              此二维码 120 秒内有效，请及时扫码登录。
            </p>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="w-full max-w-225 grid grid-cols-2 gap-24 pt-20">
          <div className="flex flex-col items-start space-y-6 mt-1.5">
            <div className="flex items-center justify-center w-16 h-16 mb-2">
              <Smartphone size={64} style={{ color: theme.text }} strokeWidth={1} />
            </div>
            <h3 className="text-[40px] font-bold" style={{ color: theme.text }}>
              扫码登录说明
            </h3>
            <p className="text-[24px] leading-relaxed opacity-60" style={{ color: theme.text }}>
              抖音目前仅禁止相册扫码，无法通过截图在本机自助登录，请在另一台设备上展示二维码，并使用手机抖音扫码完成登录。
            </p>
          </div>

          <div className="flex flex-col items-start space-y-6">
            <div className="flex items-center justify-center w-16 h-16 mb-2">
              <ShieldCheck size={64} style={{ color: theme.text }} strokeWidth={1} />
            </div>
            <h3 className="text-[40px] font-bold" style={{ color: theme.text }}>
              安全承诺
            </h3>
            <p className="text-[24px] leading-relaxed opacity-60" style={{ color: theme.text }}>
              扫码后仅会在本地获取您的登录凭据（CK），用于视频解析等相关业务，不会上传至任何第三方，也不会用于与本工具无关的操作，请在可信环境下使用本功能。
            </p>
          </div>
        </div>
      </div>
    </DefaultLayout>
  )
})

DouyinQrcodeImg.displayName = 'DouyinQrcodeImg'

export default DouyinQrcodeImg
