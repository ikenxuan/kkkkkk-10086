import { Chip } from '@heroui/react'
import { formatDistanceToNow, parse } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { AlertCircle, Clock, Cpu, FileText, GitBranch, Puzzle, QrCode, Terminal } from 'lucide-react'
import _ from 'lodash'
import React from 'react'
import { MdSchedule } from 'react-icons/md'

import { DefaultLayout } from '../../../components/DefaultLayout'
import type { PosterProps } from '../../../types/ctx'
import { generateQRCode } from '../../../../utils/QRcode'
import { isDark as isDarkMode } from '../../../../utils/theme'
import { getRandomErrorTitle } from './errorTitles'
import type { AdapterInfo, BusinessError, LogLevel } from './types'
import type { ApiErrorData } from './types'

/**
 * ANSI 颜色代码映射
 */
const ansiColorMap: Record<number, string> = {
  30: 'text-foreground',
  31: 'text-danger',
  32: 'text-success',
  33: 'text-warning',
  34: 'text-accent',
  35: 'text-accent',
  36: 'text-cyan-600',
  37: 'text-muted',
  90: 'text-foreground/70',
  91: 'text-danger',
  92: 'text-success',
  93: 'text-warning',
  94: 'text-accent',
  95: 'text-accent',
  96: 'text-muted',
  97: 'text-background/80'
}

const ansi256ToColor = (colorCode: number): string => {
  const standardColors = [
    '#000000',
    '#800000',
    '#008000',
    '#808000',
    '#000080',
    '#800080',
    '#008080',
    '#c0c0c0',
    '#808080',
    '#ff0000',
    '#00ff00',
    '#ffff00',
    '#0000ff',
    '#ff00ff',
    '#00ffff',
    '#ffffff'
  ]
  if (colorCode < 16) return standardColors[colorCode]
  if (colorCode < 232) {
    const index = colorCode - 16
    const r = Math.floor(index / 36),
      g = Math.floor((index % 36) / 6),
      b = index % 6
    const toHex = (v: number) => (v === 0 ? 0 : 55 + v * 40).toString(16).padStart(2, '0')
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  }
  const gray = (colorCode - 232) * 10 + 8
  const hex = gray.toString(16).padStart(2, '0')
  return `#${hex}${hex}${hex}`
}

const convertAnsiToHtml = (text: string): string => {
  // 完全避免在正则字面量中出现任何转义
  const ESC = String.fromCharCode(27)
  const ansiRegex = new RegExp(ESC + '\\[([0-9;]+)m', 'g')
  let result = '',
    lastIndex = 0
  let currentStyles: { classes: string[]; inlineColor?: string } = { classes: [] }
  let match

  const escapeHtml = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
  const formatLogContent = (content: string) =>
    escapeHtml(content).replace(
      /([\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]+)/g,
      '<span class="font-[HarmonyOSHans-Regular]">$1</span>'
    )
  const makeSpan = (content: string) => {
    const hasClass = currentStyles.classes.length > 0,
      hasInline = currentStyles.inlineColor
    if (!hasClass && !hasInline) return formatLogContent(content)
    const classAttr = hasClass ? ` class="${currentStyles.classes.join(' ')}"` : ''
    const styleAttr = hasInline ? ` style="color: ${currentStyles.inlineColor}"` : ''
    return `<span${classAttr}${styleAttr}>${formatLogContent(content)}</span>`
  }

  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) result += makeSpan(text.substring(lastIndex, match.index))
    const codes = match[1].split(';').map(Number)
    let i = 0
    while (i < codes.length) {
      const code = codes[i]
      if (code === 90 && codes[i + 1] === 2) {
        currentStyles.classes = currentStyles.classes.filter((c) => !c.startsWith('text-'))
        currentStyles.inlineColor = undefined
        currentStyles.classes.push('text-muted')
        i++
      } else if (code === 0 || code === 39 || code === 49) {
        currentStyles.classes = currentStyles.classes.filter(
          (c) => !c.startsWith('text-') && !c.startsWith('bg-') && !c.startsWith('dark:')
        )
        currentStyles.inlineColor = undefined
      } else if (code === 1) {
        if (!currentStyles.classes.includes('font-bold')) currentStyles.classes.push('font-bold')
      } else if (code === 22) {
        currentStyles.classes = currentStyles.classes.filter((c) => c !== 'font-bold')
      } else if (code === 38 && codes[i + 1] === 5) {
        const colorCode = codes[i + 2]
        if (colorCode !== undefined) {
          currentStyles.classes = currentStyles.classes.filter((c) => !c.startsWith('text-') && !c.startsWith('dark:'))
          currentStyles.inlineColor = ansi256ToColor(colorCode)
          i += 2
        }
      } else if (ansiColorMap[code]) {
        currentStyles.classes = currentStyles.classes.filter((c) => !c.startsWith('text-') && !c.startsWith('dark:'))
        currentStyles.inlineColor = undefined
        currentStyles.classes.push(ansiColorMap[code])
      }
      i++
    }
    lastIndex = ansiRegex.lastIndex
  }
  if (lastIndex < text.length) result += makeSpan(text.substring(lastIndex))
  return result
}

const getLogLevelTheme = (level: LogLevel, isDark: boolean) => {
  const themeMap: Record<
    LogLevel,
    {
      bgClass: string
      borderClass: string
      textClass: string
      iconClass: string
      levelClass: string
      dotClass: string
    }
  > = {
    TRAC: {
      bgClass: isDark ? 'bg-muted/10' : 'bg-muted/5',
      borderClass: 'border-muted/20',
      textClass: 'text-muted',
      iconClass: 'text-muted',
      levelClass: isDark ? 'text-muted/10' : 'text-muted/10',
      dotClass: 'bg-muted/40'
    },
    DEBU: {
      bgClass: isDark ? 'bg-cyan-400/10' : 'bg-cyan-500/5',
      borderClass: isDark ? 'border-cyan-400/20' : 'border-cyan-500/20',
      textClass: isDark ? 'text-cyan-400' : 'text-cyan-600',
      iconClass: isDark ? 'text-cyan-400' : 'text-cyan-600',
      levelClass: isDark ? 'text-cyan-400/10' : 'text-cyan-600/10',
      dotClass: isDark ? 'bg-cyan-400/40' : 'bg-cyan-500/40'
    },
    MARK: {
      bgClass: isDark ? 'bg-muted/10' : 'bg-muted/5',
      borderClass: 'border-muted/20',
      textClass: 'text-muted',
      iconClass: 'text-muted',
      levelClass: isDark ? 'text-muted/10' : 'text-muted/10',
      dotClass: 'bg-muted/40'
    },
    INFO: {
      bgClass: 'bg-success-soft',
      borderClass: 'border-success/25',
      textClass: 'text-success',
      iconClass: 'text-success',
      levelClass: isDark ? 'text-success/10' : 'text-success/10',
      dotClass: 'bg-success/40'
    },
    WARN: {
      bgClass: 'bg-warning-soft',
      borderClass: 'border-warning/25',
      textClass: 'text-warning',
      iconClass: 'text-warning',
      levelClass: isDark ? 'text-warning/10' : 'text-warning-soft',
      dotClass: 'bg-warning/40'
    },
    ERRO: {
      bgClass: 'bg-danger-soft',
      borderClass: 'border-danger/25',
      textClass: 'text-danger',
      iconClass: 'text-danger',
      levelClass: isDark ? 'text-danger/10' : 'text-danger/10',
      dotClass: 'bg-danger/40'
    },
    FATA: {
      bgClass: isDark ? 'bg-pink-400/10' : 'bg-pink-500/5',
      borderClass: isDark ? 'border-pink-400/25' : 'border-pink-500/25',
      textClass: isDark ? 'text-pink-400' : 'text-pink-500',
      iconClass: isDark ? 'text-pink-400' : 'text-pink-500',
      levelClass: isDark ? 'text-pink-400/10' : 'text-pink-500/10',
      dotClass: isDark ? 'bg-pink-400/40' : 'bg-pink-500/40'
    }
  }
  return themeMap[level] || themeMap['TRAC']
}

// 这张表在 src/module/utils/ErrorHandler/adapter.ts 里有一份等价副本（那边还带单元测试）。
// 两份不是疏漏：ktr/ 是独立模板树，不导入 src/，详见 adapter.ts 上方的说明。
// 改这里时必须同步改 src 那一份。
const ADAPTER_LOGO_RULES: Array<{ pattern: RegExp; path: string }> = [
  { pattern: /napcat/i, path: '/image/other/handlerError/napcat.webp' },
  { pattern: /lagrange/i, path: '/image/other/handlerError/lagrange.webp' },
  { pattern: /chronocat/i, path: '/image/other/handlerError/chronocat.svg' },
  { pattern: /llonebot|lltwo(bot)?/i, path: '/image/other/handlerError/llonebot.webp' },
  { pattern: /conwechat/i, path: '/image/other/handlerError/conwechat.webp' },
  { pattern: /go[-_ ]?cq|gocq[-_ ]?http/i, path: '/image/other/handlerError/gocq-http.webp' },
  { pattern: /milky/i, path: '/image/other/handlerError/Milky.png' },
  { pattern: /satori/i, path: '/image/other/handlerError/satori.png' },
  { pattern: /onebot|ob11/i, path: '/image/other/handlerError/onebot.png' },
  // QQBot 放在 OneBot 系之后：官方 Bot 适配器的字段里不会出现 napcat/onebot 等标识，
  // 反过来某些 OneBot 实现的 apk 信息里可能带 "QQ" 字样，让前面的规则先命中更稳。
  { pattern: /qq[-_ ]?bot/i, path: '/image/other/handlerError/QQBot.svg' }
]

const getAdapterLogoPath = (adapterInfo: AdapterInfo): string | undefined => {
  const values = Object.values(adapterInfo).filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
  return ADAPTER_LOGO_RULES.find(rule => rule.pattern.test(values.join(' ')))?.path
}

const getAdapterLogo = (adapterInfo: AdapterInfo): React.ReactNode => {
  const explicitLogo = typeof adapterInfo.logo === 'string' ? adapterInfo.logo : undefined
  const logoPath = explicitLogo || getAdapterLogoPath(adapterInfo)
  if (logoPath) return <img src={logoPath} className="h-20 w-auto object-contain" alt={adapterInfo.name} />
  return <Puzzle size={64} className="text-danger/80" />
}

const SectionTitle: React.FC<{ icon: React.ReactNode; en: string; zh: string; color: string }> = ({ icon, en, zh, color }) => (
  <div className="flex items-center gap-5 mb-6">
    {icon}
    <div className="flex flex-col leading-tight">
      <span className="text-xl font-semibold tracking-[0.2em] uppercase" style={{ color }}>
        {en}
      </span>
      <span className="text-base font-medium tracking-[0.08em] opacity-80" style={{ color }}>
        {zh}
      </span>
    </div>
  </div>
)

/**
 * 把已经格式化过的构建时间换算成「多久以前」。
 * 格式对不上就返回空串，让调用方退化成只显示绝对时间——绝不能让它在 SSR 阶段抛异常。
 */
const formatBuildTimeAgo = (buildTime?: string): string => {
  if (!buildTime) return ''
  const parsed = parse(buildTime, 'yyyy年MM月dd日 HH:mm', new Date())
  if (Number.isNaN(parsed.getTime())) return ''
  try {
    return formatDistanceToNow(parsed, { locale: zhCN })
  } catch {
    return ''
  }
}

/**
 * API错误显示组件 - 手机端 Apple 风格
 */
export const handlerError: React.FC<PosterProps<ApiErrorData>> = (props) => {
  const { data } = props
  const isDark = isDarkMode(props.ctx)
  const isBusinessError = data.type === 'business_error'
  const businessError = isBusinessError ? (data.error as BusinessError) : null
  const displayMethod = businessError?.businessName || data.method
  // 接口类错误没有 JS 调用栈，此时改用结构化诊断字段填充该区块，
  // 两者都为空时整块不渲染，避免出现空盒子。
  const stackText = String(businessError?.stack || data.error?.stack || '')
  const diagnostics = businessError?.diagnostics ?? []
  const hasFailureDetail = stackText !== '' || diagnostics.length > 0
  // name/message 以前只能靠 stack 顺带带出来（堆栈首行是 "Name: message"），可
  // render.ts:15 的 normalizeError 对 `throw '字符串'` 这类非对象抛出只给得出 message、
  // stack 为空，于是 hasFailureDetail 为 false、整块被跳过，卡片上只剩一个随机大标题和
  // 方法名——真正的错误原因一个字都没有。所以这里单独渲染，不依赖 stack 是否存在。
  const errorName = String(data.error?.name || '')
  const errorMessage = String(data.error?.message || '')
  const errorSummary = [errorName === 'Error' ? '' : errorName, errorMessage]
    .filter(Boolean)
    .join(': ')
  const buildTimeAgo = formatBuildTimeAgo(data.buildTime)

  // 631 配色 - 红/珊瑚色系
  const bgColor = isDark ? '#0f0a0a' : '#faf5f5'
  const primaryColor = isDark ? '#f87171' : '#dc2626'
  const secondaryColor = isDark ? '#fca5a5' : '#b91c1c'
  const mutedColor = isDark ? 'rgba(248,113,113,0.7)' : '#991b1b'
  const accentColor = isDark ? '#fecaca' : '#7f1d1d'

  return (
    <DefaultLayout
      ctx={props.ctx}
      className="relative overflow-hidden"
      style={{ backgroundColor: bgColor, width: '1440px' }}
    >
      {/* 弥散光背景 - 深浅模式完全适配 */}
      <div className="absolute inset-0 pointer-events-none">
        {/* 左上主光斑 */}
        <div
          className="absolute rounded-full w-300 h-350 -top-75 -left-50 blur-[120px] -rotate-15"
          style={{
            background: isDark
              ? 'radial-gradient(ellipse at 40% 40%, rgba(220,38,38,0.35) 0%, rgba(185,28,28,0.18) 50%, transparent 100%)'
              : 'radial-gradient(ellipse at 40% 40%, rgba(248,113,113,0.45) 0%, rgba(252,165,165,0.22) 50%, transparent 100%)'
          }}
        />
        {/* 右侧光斑 */}
        <div
          className="absolute rounded-full w-225 h-250 top-100 -right-25 blur-[100px] rotate-20"
          style={{
            background: isDark
              ? 'radial-gradient(ellipse at 50% 50%, rgba(127,29,29,0.3) 0%, rgba(69,10,10,0.15) 50%, transparent 100%)'
              : 'radial-gradient(ellipse at 50% 50%, rgba(254,202,202,0.4) 0%, rgba(254,226,226,0.2) 50%, transparent 100%)'
          }}
        />
        {/* 底部光斑 */}
        <div
          className="absolute rounded-full w-250 h-200 -bottom-50 left-50 blur-[140px] -rotate-10"
          style={{
            background: isDark
              ? 'radial-gradient(ellipse at 50% 60%, rgba(153,27,27,0.3) 0%, rgba(127,29,29,0.15) 50%, transparent 100%)'
              : 'radial-gradient(ellipse at 50% 60%, rgba(252,165,165,0.35) 0%, rgba(254,202,202,0.18) 50%, transparent 100%)'
          }}
        />
      </div>

      {/* 单色噪点层 - 明显颗粒感 */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: isDark ? 0.12 : 0.18 }}>
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <filter id="errorPixelNoise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" result="gray" />
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues="0 1" />
              <feFuncG type="discrete" tableValues="0 1" />
              <feFuncB type="discrete" tableValues="0 1" />
            </feComponentTransfer>
          </filter>
          <rect width="100%" height="100%" filter="url(#errorPixelNoise)" />
        </svg>
      </div>

      {/* 背景大字装饰：置于页首区域之后，避免与页脚重叠 */}
      <div className="absolute top-40 right-16 pointer-events-none select-none opacity-[0.03]">
        <span
          className="text-[180px] font-black tracking-tighter leading-none block text-right"
          style={{ color: isDark ? '#fff' : '#7f1d1d' }}
        >
          ERROR
        </span>
      </div>

      {/* 四周装饰性图形点缀。页脚在画布内且背景透明，装饰层若铺到 inset-0
          就会从页脚文字下面透出来，所以下边界留出页脚高度。 */}
      <div className="absolute inset-x-0 top-0 bottom-72 pointer-events-none overflow-hidden z-0">
        {/* 右上角：实心方块阵列 */}
        <div className="absolute top-10 right-10 grid grid-cols-2 gap-3 opacity-20">
          <div className="w-4 h-4" style={{ backgroundColor: primaryColor }} />
          <div className="w-4 h-4" style={{ backgroundColor: secondaryColor }} />
          <div className="w-4 h-4" style={{ backgroundColor: secondaryColor }} />
          <div className="w-4 h-4" style={{ backgroundColor: primaryColor }} />
        </div>

        {/* 左下角：对角线条纹 */}
        <div
          className="absolute bottom-0 left-0 w-125 h-125 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, ${primaryColor}, ${primaryColor} 4px, transparent 2px, transparent 12px)`,
            maskImage: 'linear-gradient(to top right, black, transparent 70%)',
            WebkitMaskImage: 'linear-gradient(to top right, black, transparent 70%)'
          }}
        />

        {/* 右侧：同心圆弧。只让右边缘裁切它——贴着装饰层下边界会被那条看不见的线
            横切成两截弧，像渲染坏了，所以改为垂直居中浮在内容场里。 */}
        <div className="absolute top-1/2 -translate-y-1/2 -right-40 w-150 h-150 opacity-10 pointer-events-none">
          <div className="absolute bottom-0 right-0 w-full h-full border-40 rounded-full" style={{ borderColor: primaryColor }} />
          <div
            className="absolute bottom-20 right-20 w-[calc(100%-160px)] h-[calc(100%-160px)] border-20 rounded-full"
            style={{ borderColor: secondaryColor }}
          />
          <div
            className="absolute bottom-35 right-35 w-[calc(100%-280px)] h-[calc(100%-280px)] border-10 rounded-full"
            style={{ borderColor: mutedColor }}
          />
        </div>
      </div>

      {/* 内容层：高度由信息量决定，不用 h-full + mt-auto 撑出空白带 */}
      <div className="relative z-10 flex flex-col p-20">
        {/* 顶部状态栏 */}
        <div className="flex items-center justify-between mb-14">
          {/* 优化后的左侧状态标签 */}
          <div className="flex items-center">
            {/* 左侧装饰竖条 */}
            <div
              className="h-16 w-3 mr-4 opacity-80"
              style={{
                backgroundColor: primaryColor,
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px)'
              }}
            />

            {/* 主标签容器 */}
            <div
              className="relative px-8 py-3 backdrop-blur-md"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`
              }}
            >
              {/* 四角装饰钉 */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2" style={{ borderColor: primaryColor }} />
              <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2" style={{ borderColor: primaryColor }} />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2" style={{ borderColor: primaryColor }} />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2" style={{ borderColor: primaryColor }} />

              <div className="flex items-center gap-6">
                {/* 状态指示器 */}
                <div
                  className="flex flex-col items-center justify-center border-r pr-6"
                  style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
                >
                  <div
                    className="w-4 h-4 rounded-full shadow-[0_0_15px_currentColor] animate-pulse"
                    style={{ backgroundColor: primaryColor, color: primaryColor }}
                  />
                  <span className="text-[10px] font-mono mt-2 tracking-wider opacity-50" style={{ color: mutedColor }}>
                    ERR.01
                  </span>
                </div>

                {/* 文字信息 */}
                <div className="flex flex-col">
                  <span
                    className="text-xs font-mono font-bold tracking-[0.4em] uppercase mb-1 opacity-50"
                    style={{ color: secondaryColor }}
                  >
                    System Alert
                  </span>
                  <span className="text-2xl font-black tracking-[0.25em] uppercase" style={{ color: primaryColor }}>
                    Runtime Exception
                  </span>
                </div>
              </div>
            </div>
          </div>
          {/* 优化后的时间显示模块 */}
          <div className="flex items-center gap-8 pr-12">
            {/* 装饰线条组 */}
            <div className="flex flex-col gap-1 items-end opacity-40">
              <div className="w-16 h-0.5" style={{ backgroundColor: primaryColor }} />
              <div className="w-8 h-0.5" style={{ backgroundColor: secondaryColor }} />
            </div>

            {/* 时间数字显示 */}
            <div className="text-right">
              <div className="flex items-center justify-end gap-3 mb-1">
                <span className="text-xs font-black tracking-[0.3em] uppercase opacity-60" style={{ color: mutedColor }}>
                  System Time
                </span>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: primaryColor }} />
              </div>
              <div className="font-mono text-5xl font-black tracking-widest leading-none" style={{ color: mutedColor }}>
                {new Date(data.timestamp).toLocaleTimeString('en-GB', { hour12: false })}
              </div>
            </div>

            {/* 分割线 */}
            <div className="h-12 w-0.5 opacity-20" style={{ backgroundColor: mutedColor }} />

            {/* 日期显示 */}
            <div className="text-right">
              <div className="text-xs font-black tracking-[0.3em] uppercase opacity-60 mb-1" style={{ color: mutedColor }}>
                Date
              </div>
              <div className="font-mono text-3xl font-bold tracking-[0.2em]" style={{ color: secondaryColor }}>
                {new Date(data.timestamp)
                  .toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
                  .replaceAll('/', '-')}
              </div>
            </div>
          </div>
        </div>

        {/* 主标题 */}
        <div className="mb-20">
          <h1 className="text-[120px] font-black leading-none tracking-tight mb-10" style={{ color: accentColor }}>
            {getRandomErrorTitle()}
          </h1>
          <p className="text-5xl font-semibold" style={{ color: primaryColor }}>
            {displayMethod}
          </p>
          {errorSummary && (
            <p
              className="text-4xl font-medium leading-snug mt-8 break-all"
              style={{ color: secondaryColor }}
            >
              {errorSummary}
            </p>
          )}
        </div>

        {/* 验证二维码 */}
        {data.isVerification && data.verificationUrl && (
          <div className="mb-16 p-12 rounded-[40px]" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.6)' }}>
            <div className="flex items-center gap-6 mb-10">
              <QrCode size={40} className="text-warning" />
              <span className="text-3xl font-semibold" style={{ color: accentColor }}>
                人机验证
              </span>
            </div>
            <div className="flex gap-16 items-center">
              <img src={generateQRCode(data.verificationUrl, isDark)} alt="验证二维码" className="w-64 h-64 rounded-3xl" />
              <div className="space-y-6">
                <p className="text-3xl" style={{ color: secondaryColor }}>
                  请在 120 秒内完成验证
                </p>
                <ol className="space-y-4 text-2xl" style={{ color: mutedColor }}>
                  <li>1. 使用手机扫描二维码</li>
                  <li>2. 在网页中完成人机验证</li>
                  <li>3. 将验证结果发送至此对话</li>
                </ol>
                {data.verificationUrl && (
                  <p className="text-xl break-all mt-8" style={{ color: mutedColor }}>
                    {data.verificationUrl}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 触发命令 */}
        {data.triggerCommand && (
          <div className="mb-14">
            <SectionTitle
              icon={<Terminal size={36} style={{ color: mutedColor }} />}
              en="Trigger Command"
              zh="触发命令"
              color={mutedColor}
            />
            <div className="p-10 rounded-[36px]" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)' }}>
              <pre
                className="text-3xl leading-relaxed whitespace-pre-wrap break-all font-mono"
                style={{ color: accentColor }}
                dangerouslySetInnerHTML={{ __html: convertAnsiToHtml(data.triggerCommand) }}
              />
            </div>
          </div>
        )}

        {/* 错误堆栈 / 结构化诊断 */}
        {hasFailureDetail && (
          <div className="mb-14">
            <SectionTitle
              icon={<AlertCircle size={36} style={{ color: mutedColor }} />}
              en={diagnostics.length > 0 ? 'Failure Details' : 'Stack Trace'}
              zh={diagnostics.length > 0 ? '故障详情' : '错误堆栈'}
              color={mutedColor}
            />
            <div
              className="p-10 rounded-[36px]"
              style={{
                backgroundColor: isDark ? 'rgba(220,38,38,0.1)' : 'rgba(254,202,202,0.4)',
                border: `1px solid ${isDark ? 'rgba(248,113,113,0.2)' : 'rgba(252,165,165,0.5)'}`
              }}
            >
              {/* 结构化字段用分隔线与间距分区，不再嵌套小卡片 */}
              {diagnostics.length > 0 && (
                <dl className="flex flex-col">
                  {diagnostics.map((item, index) => (
                    <div
                      key={item.label}
                      className="flex gap-8 py-5"
                      style={{
                        borderTop: index === 0
                          ? undefined
                          : `1px solid ${isDark ? 'rgba(248,113,113,0.14)' : 'rgba(220,38,38,0.1)'}`
                      }}
                    >
                      <dt className="text-2xl font-medium shrink-0 w-56" style={{ color: mutedColor }}>
                        {item.label}
                      </dt>
                      <dd
                        className="text-2xl font-mono leading-relaxed break-all min-w-0 flex-1"
                        style={{ color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(127,29,29,0.9)' }}
                      >
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {stackText && (
                <>
                  {diagnostics.length > 0 && (
                    <p
                      className="text-xl font-semibold tracking-[0.18em] uppercase mt-8 mb-4 pt-6"
                      style={{
                        color: mutedColor,
                        borderTop: `1px solid ${isDark ? 'rgba(248,113,113,0.2)' : 'rgba(220,38,38,0.14)'}`
                      }}
                    >
                      Call Stack / 调用栈
                    </p>
                  )}
                  <pre
                    className="text-2xl leading-relaxed whitespace-pre-wrap break-all font-mono"
                    style={{ color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(127,29,29,0.9)' }}
                    dangerouslySetInnerHTML={{ __html: convertAnsiToHtml(stackText) }}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* 执行日志 */}
        {data.logs && data.logs.length > 0 && (
          <div className="mb-14">
            <SectionTitle
              icon={<FileText size={36} style={{ color: mutedColor }} />}
              en="Execution Logs"
              zh="执行日志"
              color={mutedColor}
            />
            <div className="space-y-6">
              {data.logs.map((log, index) => {
                const theme = getLogLevelTheme(log.level, isDark)
                return (
                  <fieldset key={index} className={`relative rounded-3xl ${theme.bgClass} border-2 ${theme.borderClass} p-6`}>
                    {/* 时间戳：群/用户这类合成条目没有时间，此时整条 legend 不渲染，避免空胶囊 */}
                    {log.timestamp
                      ? (
                        <legend className="flex items-center gap-2 ml-4">
                          {/* 左侧圆角装饰 */}
                          <span className={`w-2 h-6 rounded-full -mr-1.5 ${theme.dotClass}`} />
                          <span className="flex items-center gap-2 px-3">
                            <Clock size={18} className={theme.iconClass} />
                            <span className={`text-xl font-mono font-medium ${theme.textClass}`}>{log.timestamp}</span>
                          </span>
                          {/* 右侧圆角装饰 */}
                          <span className={`w-2 h-6 rounded-full -ml-1.5 ${theme.dotClass}`} />
                        </legend>
                        )
                      : null}

                    {/* 日志等级 */}
                    <div className="absolute bottom-2 right-6 pointer-events-none">
                      <span className={`text-6xl font-black uppercase leading-none tracking-tight ${theme.levelClass}`}>{log.level}」</span>
                    </div>

                    {/* 日志内容 */}
                    <div
                      className="relative z-1 text-2xl font-mono whitespace-pre-wrap break-all leading-relaxed"
                      style={{ color: isDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.82)' }}
                      dangerouslySetInnerHTML={{ __html: convertAnsiToHtml(log.message) }}
                    />
                  </fieldset>
                )
              })}
            </div>
          </div>
        )}

        {/* 底部版本信息 */}
        <div className="pt-16" style={{ borderTop: `2px solid ${isDark ? 'rgba(248,113,113,0.15)' : 'rgba(252,165,165,0.3)'}` }}>
          {/* 版本信息网格 */}
          {/* 插件与框架的品牌/版本由 DefaultLayout 的页脚统一负责（ctx.version 非空时渲染），
              这里不再自绘一份，否则同一张图会出现两组 plugin/framework 品牌对。
              适配器信息是页脚没有的内容，所以保留在这里。 */}
          <div className="grid grid-cols-2 gap-10 mb-12">
            {data.adapterInfo && (
              <div
                className="col-span-2 p-8 rounded-3xl"
                style={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.52)',
                  border: `1px solid ${isDark ? 'rgba(248,113,113,0.22)' : 'rgba(220,38,38,0.14)'}`
                }}
              >
                <div className="flex items-start justify-between gap-8 mb-6">
                  <div className="flex items-center gap-6 min-w-0">
                    {getAdapterLogo(data.adapterInfo)}
                    <div className="min-w-0">
                      <p className="text-xl mb-1" style={{ color: mutedColor }}>
                        Adapter / 适配器
                      </p>
                      <div className="flex items-center gap-4 flex-wrap">
                        <p className="text-3xl font-bold truncate" style={{ color: accentColor }}>
                          {data.adapterInfo.name}
                        </p>
                        <Chip size="lg" variant="soft" color="danger" className="h-8 text-lg">
                          {data.adapterInfo.version.startsWith('v') ? data.adapterInfo.version : `v${data.adapterInfo.version}`}
                        </Chip>
                      </div>
                    </div>
                  </div>
                  <p className="text-xl font-medium mb-4" style={{ color: mutedColor }}>
                    事件信息来源
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-4 text-lg" style={{ color: secondaryColor }}>
                  <div
                    className="rounded-2xl px-4 py-3"
                    style={{ backgroundColor: isDark ? 'rgba(248,113,113,0.08)' : 'rgba(220,38,38,0.05)' }}
                  >
                    <p className="text-sm mb-1 opacity-75">Platform / 对接平台</p>
                    <p className="font-semibold break-all text-2xl">{String(data.adapterInfo.platform)}</p>
                  </div>
                  <div
                    className="rounded-2xl px-4 py-3 relative overflow-hidden"
                    style={{ backgroundColor: isDark ? 'rgba(248,113,113,0.08)' : 'rgba(220,38,38,0.05)' }}
                  >
                    <p className="text-sm mb-1 opacity-75">Standard / 协议标准</p>
                    <p className="font-semibold break-all text-2xl">{_.upperFirst(_.camelCase(String(data.adapterInfo.standard)))}</p>
                    {String(data.adapterInfo.standard).toLowerCase() === 'milky' && (
                      <div className="absolute inset-0 pointer-events-none">
                        <img
                          src="/image/other/handlerError/Milky.png"
                          alt="Milky"
                          className="absolute -right-2 -bottom-3 w-24 h-24 object-contain"
                          style={{
                            WebkitMaskImage: 'linear-gradient(to top left, transparent 0%, rgba(0,0,0,1) 60%)',
                            maskImage: 'linear-gradient(to top left, transparent 0%, rgba(0,0,0,1) 60%)',
                            opacity: 1
                          }}
                        />
                      </div>
                    )}
                    {String(data.adapterInfo.standard).toLowerCase() === 'satori' && (
                      <div className="absolute inset-0 pointer-events-none">
                        <img
                          src="/image/other/handlerError/satori.png"
                          alt="Satori"
                          className="absolute -right-2 -bottom-3 w-24 h-24 object-contain"
                          style={{
                            WebkitMaskImage: 'linear-gradient(to top left, transparent 0%, rgba(0,0,0,1) 60%)',
                            maskImage: 'linear-gradient(to top left, transparent 0%, rgba(0,0,0,1) 60%)',
                            opacity: 1
                          }}
                        />
                      </div>
                    )}
                    {String(data.adapterInfo.standard).includes('onebot') && (
                      <div className="absolute inset-0 pointer-events-none">
                        <img
                          src="/image/other/handlerError/onebot.png"
                          alt="OneBot"
                          className="absolute -right-2 -bottom-3 w-24 h-24 object-contain"
                          style={{
                            WebkitMaskImage: 'linear-gradient(to top left, transparent 0%, rgba(0,0,0,1) 60%)',
                            maskImage: 'linear-gradient(to top left, transparent 0%, rgba(0,0,0,1) 60%)',
                            opacity: 1
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div
                    className="rounded-2xl px-4 py-3"
                    style={{ backgroundColor: isDark ? 'rgba(248,113,113,0.08)' : 'rgba(220,38,38,0.05)' }}
                  >
                    <p className="text-sm mb-1 opacity-75">Protocol / 协议实现</p>
                    <p className="font-semibold break-all text-2xl">{String(data.adapterInfo.protocol)}</p>
                  </div>
                  <div
                    className="rounded-2xl px-4 py-3"
                    style={{ backgroundColor: isDark ? 'rgba(248,113,113,0.08)' : 'rgba(220,38,38,0.05)' }}
                  >
                    <p className="text-sm mb-1 opacity-75">Communication / 通信方式</p>
                    <p className="font-semibold break-all text-2xl">{String(data.adapterInfo.communication)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* 次要信息 */}
          <div className="flex items-center gap-10 text-xl mb-12" style={{ color: mutedColor }}>
            {data.buildTime && (
              <div className="flex items-center gap-3">
                <MdSchedule size={24} />
                <span>
                  Built Time: {data.buildTime}
                  {/* buildTime 是已经格式化过的字符串，这里再 parse 回去纯粹为了算"多久以前"。
                      格式一旦对不上，parse 得到 Invalid Date，formatDistanceToNow 会抛 RangeError
                      并且是在 SSR 阶段抛——整张错误卡片渲染失败，连原始错误都发不出去。
                      所以校验后再用，算不出来就只显示绝对时间。 */}
                  {buildTimeAgo ? ` 于 ${buildTimeAgo}前` : ''}
                </span>
              </div>
            )}
            {data.commitHash && (
              <div className="flex items-center gap-3">
                <GitBranch size={24} />
                <span>Commit Hash: {data.commitHash}</span>
              </div>
            )}
            {/* RemoveWatermark 开启时 Render.ts 不传 ctx.version，DefaultLayout 的页脚整块不渲染，
                插件与框架版本就彻底消失了——可这张图的用途正是拿去报 bug，版本号不能少。
                所以页脚缺席时在这里补一份纯文字版本号：只有文字没有 logo，不构成第二组品牌对，
                也顺带让 data.pluginVersion / data.frameworkVersion 这两个此前无人读取的字段真正生效。 */}
            {!props.ctx?.version && (
              <>
                {data.pluginVersion && (
                  <div className="flex items-center gap-3">
                    <Puzzle size={24} />
                    <span>Plugin: {data.pluginVersion}</span>
                  </div>
                )}
                {data.frameworkVersion && (
                  <div className="flex items-center gap-3">
                    <Cpu size={24} />
                    <span>Framework: {data.frameworkVersion}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 帮助提示 */}
          <div className="p-10 rounded-[36px]" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)' }}>
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="text-3xl font-semibold mb-2" style={{ color: accentColor }}>
                  Need Help? / 需要帮助？
                </p>
                <p className="text-2xl" style={{ color: secondaryColor }}>
                  提交问题时请附上完整报错截图、复现步骤和环境版本信息。
                </p>
              </div>
              <span
                className="text-xs font-black tracking-[0.2em] uppercase px-3 py-1 rounded-full"
                style={{
                  color: primaryColor,
                  backgroundColor: isDark ? 'rgba(248,113,113,0.12)' : 'rgba(220,38,38,0.08)'
                }}
              >
                Support
              </span>
            </div>
            <div
              className="grid grid-cols-2 gap-x-6 gap-y-6 text-2xl leading-relaxed py-6"
              style={{
                borderTop: `1px solid ${isDark ? 'rgba(248,113,113,0.2)' : 'rgba(220,38,38,0.12)'}`,
                borderBottom: `1px solid ${isDark ? 'rgba(248,113,113,0.2)' : 'rgba(220,38,38,0.12)'}`
              }}
            >
              <div>
                <p className="font-semibold mb-1" style={{ color: accentColor }}>
                  GitHub Issue
                </p>
                <p className="text-xl break-all" style={{ color: secondaryColor }}>
                  https://github.com/ikenxuan/kkkkkk-10086/issues/new/choose
                </p>
              </div>
              <div>
                <p className="font-semibold mb-1" style={{ color: accentColor }}>
                  GitHub Repository
                </p>
                <p className="text-xl break-all" style={{ color: secondaryColor }}>
                  https://github.com/ikenxuan/kkkkkk-10086
                </p>
              </div>
              <div>
                <p className="font-semibold mb-1" style={{ color: accentColor }}>
                  QQ 群
                </p>
                <p className="text-xl" style={{ color: secondaryColor }}>
                  795874649
                </p>
              </div>
              <div>
                <p className="font-semibold mb-1" style={{ color: accentColor }}>
                  附带信息
                </p>
                <p className="text-xl" style={{ color: secondaryColor }}>
                  此图片 + 触发命令 + 对应配置（自行脱敏处理）
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-6 text-xl" style={{ color: mutedColor }}>
              <span className="font-mono">Tips:</span>
              <span>信息越完整，定位越快。</span>
            </div>
          </div>
        </div>
      </div>
    </DefaultLayout>
  )
}

handlerError.displayName = 'handlerError'

export default handlerError
