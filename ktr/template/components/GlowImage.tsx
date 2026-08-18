import React from 'react'

/**
 * GlowImage 组件的属性
 * 用于控制根据图片自身颜色生成辉光的效果与强度。
 */
type GlowImageProps = {
  /** 图片源地址（支持本地路径或外链 URL） */
  src?: string
  /** 子元素（SVG 或其他 ReactNode），若存在则忽略 src */
  children?: React.ReactNode
  /** 图片的替代文本（无障碍与加载失败时显示） */
  alt?: string
  /** 外层容器的类名（用于布局/定位） */
  className?: string
  /** 图片元素本体的类名（用于控制宽高等样式） */
  imgClassName?: string
  /**
   * 辉光生成模式：
   * - 'blur-layer'：在图片下方叠加模糊副本形成柔和辉光（无 CORS 限制，默认）
   * - 'dominant-shadow'：提取图片主色并使用 drop-shadow 着色（更干净边缘，外链需 CORS）
   */
  mode?: 'blur-layer' | 'dominant-shadow'
  /** 模糊辉光半径（像素），仅在 'blur-layer' 模式下生效 */
  blurRadius?: number
  /** 辉光强度（0–1），控制模糊层的不透明度或阴影颜色的透明度 */
  glowStrength?: number
  /** 辉光层相对原图的缩放比例（避免边缘被裁切），仅 'blur-layer' 模式使用 */
  scale?: number
  /** 阴影半径（像素），仅在 'dominant-shadow' 模式下生效 */
  shadowRadius?: number
  /**
   * 跨域设置，用于主色采样（canvas）：
   * - 'anonymous'：匿名模式（常用）
   * - 'use-credentials'：携带凭证
   * 外链图片需目标服务器允许 CORS，否则 canvas 会被污染。
   */
  crossOrigin?: 'anonymous' | 'use-credentials'
}

export const GlowImage: React.FC<GlowImageProps> = ({
  src,
  children,
  alt,
  className,
  imgClassName,
  mode = 'blur-layer',
  blurRadius = 18,
  glowStrength = 0.6,
  scale = 1.06,
  shadowRadius = 28,
  crossOrigin
}) => {
  const [shadowColor, setShadowColor] = React.useState<string>('rgba(255,255,255,0.5)')

  React.useEffect(() => {
    if (mode !== 'dominant-shadow' || !src) return
    const img = new Image()
    if (crossOrigin) img.crossOrigin = crossOrigin
    img.src = src
    img.onload = () => {
      try {
        const size = 16
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, size, size)
        const data = ctx.getImageData(0, 0, size, size).data
        let r = 0,
          g = 0,
          b = 0,
          count = 0
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3]
          if (a < 10) continue
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          count++
        }
        if (count > 0) {
          r = Math.round(r / count)
          g = Math.round(g / count)
          b = Math.round(b / count)
          setShadowColor(`rgba(${r}, ${g}, ${b}, ${Math.min(glowStrength, 0.85)})`)
        }
      } catch {
        // ignore errors (e.g. tainted canvas), keep default color
      }
    }
  }, [mode, src, glowStrength, crossOrigin])

  if (children) {
    return (
      <div className={className} style={{ position: 'relative', display: 'inline-block' }}>
        <div
          aria-hidden="true"
          className={imgClassName}
          style={{
            position: 'absolute',
            inset: 0,
            transform: `scale(${scale})`,
            filter: `blur(${blurRadius}px) saturate(1.2)`,
            opacity: glowStrength,
            pointerEvents: 'none',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          {children}
        </div>
        <div className={imgClassName} style={{ position: 'relative' }}>
          {children}
        </div>
      </div>
    )
  }

  if (mode === 'dominant-shadow') {
    return (
      <img
        src={src}
        alt={alt}
        className={imgClassName}
        style={{
          filter: `drop-shadow(0 0 ${shadowRadius}px ${shadowColor}) drop-shadow(0 0 ${Math.round(shadowRadius * 0.6)}px ${shadowColor})`
        }}
      />
    )
  }

  return (
    <div className={className} style={{ position: 'relative', display: 'inline-block' }}>
      <img
        src={src}
        alt={alt}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${scale})`,
          filter: `blur(${blurRadius}px) saturate(1.2)`,
          opacity: glowStrength,
          pointerEvents: 'none'
        }}
      />
      <img src={src} alt={alt} className={imgClassName} />
    </div>
  )
}

/**
 * 文字发光：在文字下方叠加一层模糊副本形成辉光
 */
type GlowTextProps = {
  /** 子元素（文本或节点） */
  children: React.ReactNode
  /** 外层容器样式（尺寸、颜色等） */
  className?: string
  /** 辉光层样式（通常不需要，继承文字颜色） */
  glowClassName?: string
  /** 模糊强度，默认 12 */
  blurRadius?: number
  /** 发光不透明度，默认 0.6 */
  glowStrength?: number
  /** 辉光层缩放，默认 1.02 */
  scale?: number
}

export const GlowText: React.FC<GlowTextProps> = ({
  children,
  className,
  glowClassName,
  blurRadius = 12,
  glowStrength = 0.6,
  scale = 1.02
}) => {
  return (
    <span className={className} style={{ position: 'relative', display: 'inline-block' }}>
      <span
        aria-hidden="true"
        className={glowClassName}
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${scale})`,
          filter: `blur(${blurRadius}px) saturate(1.1)`,
          opacity: glowStrength,
          pointerEvents: 'none'
        }}
      >
        {children}
      </span>
      <span>{children}</span>
    </span>
  )
}

// 真实发光文本（多层 text-shadow 叠加，基于 `currentColor` 加色发光）
type RealGlowTextProps = {
  children: React.ReactNode
  className?: string
  /** 光晕层数（叠加圈数） */
  levels?: number
  /** 初始模糊半径（px） */
  baseBlur?: number
  /** 每层递增的模糊（px） */
  spread?: number
}

export const RealGlowText: React.FC<RealGlowTextProps> = ({ children, className, levels = 4, baseBlur = 6, spread = 6 }) => {
  return (
    <span
      className={className}
      style={{
        textShadow: Array.from({ length: levels }, (_, i) => {
          const blur = baseBlur + i * spread
          return `0 0 ${blur}px currentColor`
        }).join(', ')
      }}
    >
      {children}
    </span>
  )
}

/**
 * SVG图标发光组件的属性
 * 专门用于给SVG图标添加辉光效果
 */
type GlowIconProps = {
  /** 图标组件 */
  Icon: React.ComponentType<any>
  /** 图标的props */
  iconProps?: any
  /** 外层容器的类名 */
  className?: string
  /** 辉光颜色（CSS颜色值），默认继承图标颜色 */
  glowColor?: string
  /** 辉光强度（0-1），默认0.8 */
  glowStrength?: number
  /** 辉光半径（像素），默认12 */
  glowRadius?: number
  /** 辉光层数，默认3层 */
  glowLayers?: number
  /** 辉光扩散程度，默认4 */
  glowSpread?: number
}

export const GlowIcon: React.FC<GlowIconProps> = ({
  Icon,
  iconProps = {},
  className,
  glowColor,
  glowStrength = 0.8,
  glowRadius = 12,
  glowLayers = 3,
  glowSpread = 4
}) => {
  return (
    <div className={className} style={{ display: 'inline-block' }}>
      <Icon
        {...iconProps}
        style={{
          filter: Array.from({ length: glowLayers }, (_, i) => {
            const radius = glowRadius + i * glowSpread
            const opacity = Math.min(glowStrength * (1 - i * 0.2), 1)
            const shadowColor = glowColor ? glowColor.replace(/rgb\(([^)]+)\)/, `rgba($1, ${opacity})`) : `rgba(255, 255, 255, ${opacity})`
            return `drop-shadow(0 0 ${radius}px ${shadowColor})`
          }).join(' '),
          ...iconProps.style
        }}
      />
    </div>
  )
}

/**
 * SVG图标发光组件
 * 使用CSS filter实现更简单的辉光效果
 */
type SimpleGlowIconProps = {
  /** 图标组件 */
  Icon: React.ComponentType<any>
  /** 图标的props */
  iconProps?: any
  /** 外层容器的类名 */
  className?: string
  /** 辉光颜色，默认为当前颜色 */
  glowColor?: string
  /** 辉光强度，默认为中等 */
  glowIntensity?: 'light' | 'medium' | 'strong'
}

export const SimpleGlowIcon: React.FC<SimpleGlowIconProps> = ({ Icon, iconProps = {}, className, glowColor, glowIntensity = 'medium' }) => {
  const getGlowFilter = () => {
    const color = glowColor || 'currentColor'

    switch (glowIntensity) {
      case 'light':
        return `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 16px ${color})`
      case 'strong':
        return `drop-shadow(0 0 12px ${color}) drop-shadow(0 0 24px ${color}) drop-shadow(0 0 36px ${color})`
      default: // medium
        return `drop-shadow(0 0 10px ${color}) drop-shadow(0 0 20px ${color})`
    }
  }

  return (
    <div className={className} style={{ display: 'inline-block' }}>
      <Icon
        {...iconProps}
        style={{
          filter: getGlowFilter(),
          ...iconProps.style
        }}
      />
    </div>
  )
}

/**
 * 辉光边框容器组件的属性
 * 用于创建受辉光影响的边框效果，使边框根据内部发光元素的位置呈现渐变色彩
 */
type GlowBorderContainerProps = {
  /** 子元素内容 */
  children: React.ReactNode
  /** 外层容器的类名 */
  className?: string
  /** 辉光颜色（CSS颜色值），默认为橙色 */
  glowColor?: string
  /** 辉光强度（0-1），控制边框受光影响的程度，默认0.6 */
  glowStrength?: number
  /** 边框宽度（像素），默认1px */
  borderWidth?: number
  /** 边框圆角，默认继承容器圆角 */
  borderRadius?: string
  /** 发光元素在容器中的位置，用于计算光影响方向 */
  glowPosition?: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'left-top' | 'right-top' | 'left-bottom' | 'right-bottom'
  /** 光影响范围（0-1），控制渐变的扩散程度，默认0.3 */
  lightInfluenceRange?: number
}

export const GlowBorderContainer: React.FC<GlowBorderContainerProps> = ({
  children,
  className,
  glowColor = 'rgb(245, 158, 11)',
  glowStrength = 0.6,
  borderWidth = 1,
  borderRadius,
  glowPosition = 'left-top',
  lightInfluenceRange = 0.3
}) => {
  /**
   * 根据发光位置生成边框渐变样式
   * @param position 发光元素位置
   * @returns CSS渐变字符串
   */
  const generateBorderGradient = (position: string) => {
    // 解析辉光颜色的RGB值
    const glowRgbMatch = glowColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)

    const glowRgb = glowRgbMatch ? `${glowRgbMatch[1]}, ${glowRgbMatch[2]}, ${glowRgbMatch[3]}` : '245, 158, 11'

    // 辉光颜色渐变层
    const maxGlow = `rgba(${glowRgb}, ${glowStrength})`
    const strongGlow = `rgba(${glowRgb}, ${glowStrength * 0.7})`
    const mediumGlow = `rgba(${glowRgb}, ${glowStrength * 0.4})`
    const weakGlow = `rgba(${glowRgb}, ${glowStrength * 0.15})`

    // 光影扩散范围
    const maxInfluence = Math.round(lightInfluenceRange * 100)

    switch (position) {
      case 'left-top':
        return `
          radial-gradient(circle 220px at 5% 15%,
            ${maxGlow} 0%,
            ${strongGlow} 20%,
            ${mediumGlow} 40%,
            ${weakGlow} 65%,
            transparent ${maxInfluence}%
          )
        `
      case 'left':
        return `
          radial-gradient(circle 150px at 10% 50%,
            ${maxGlow} 0%,
            ${strongGlow} 25%,
            ${mediumGlow} 45%,
            ${weakGlow} 70%,
            transparent ${maxInfluence}%
          )
        `
      case 'right':
        return `
          radial-gradient(circle 150px at 90% 50%,
            ${maxGlow} 0%,
            ${strongGlow} 25%,
            ${mediumGlow} 45%,
            ${weakGlow} 70%,
            transparent ${maxInfluence}%
          )
        `
      case 'top':
        return `
          radial-gradient(circle 150px at 50% 10%,
            ${maxGlow} 0%,
            ${strongGlow} 25%,
            ${mediumGlow} 45%,
            ${weakGlow} 70%,
            transparent ${maxInfluence}%
          )
        `
      case 'bottom':
        return `
          radial-gradient(circle 150px at 50% 90%,
            ${maxGlow} 0%,
            ${strongGlow} 25%,
            ${mediumGlow} 45%,
            ${weakGlow} 70%,
            transparent ${maxInfluence}%
          )
        `
      case 'right-top':
        return `
          radial-gradient(circle 150px at 92% 15%,
            ${maxGlow} 0%,
            ${strongGlow} 20%,
            ${mediumGlow} 40%,
            ${weakGlow} 65%,
            transparent ${maxInfluence}%
          )
        `
      case 'left-bottom':
        return `
          radial-gradient(circle 150px at 8% 85%,
            ${maxGlow} 0%,
            ${strongGlow} 20%,
            ${mediumGlow} 40%,
            ${weakGlow} 65%,
            transparent ${maxInfluence}%
          )
        `
      case 'right-bottom':
        return `
          radial-gradient(circle 150px at 92% 85%,
            ${maxGlow} 0%,
            ${strongGlow} 20%,
            ${mediumGlow} 40%,
            ${weakGlow} 65%,
            transparent ${maxInfluence}%
          )
        `
      case 'center':
        return `
          radial-gradient(circle at center,
            ${maxGlow} 0%,
            ${strongGlow} 30%,
            ${mediumGlow} 55%,
            ${weakGlow} 80%,
            transparent ${maxInfluence}%
          )
        `
      default:
        return 'transparent'
    }
  }

  const borderGradient = generateBorderGradient(glowPosition)

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        background: borderGradient,
        padding: `${borderWidth}px`,
        borderRadius: borderRadius
      }}
    >
      <div
        style={{
          borderRadius: borderRadius ? `calc(${borderRadius} - ${borderWidth}px)` : undefined,
          overflow: 'hidden',
          background: 'var(--background)',
          width: '100%',
          height: '100%'
        }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * 智能辉光边框容器组件的属性
 * 自动检测内部发光元素位置并调整边框效果
 */
type SmartGlowBorderProps = {
  /** 子元素内容 */
  children: React.ReactNode
  /** 外层容器的类名 */
  className?: string
  /** 辉光颜色，默认自动从子元素中提取 */
  glowColor?: string
  /** 辉光强度（0-1），默认0.5 */
  glowStrength?: number
  /** 边框宽度（像素），默认1px */
  borderWidth?: number
  /** 边框圆角 */
  borderRadius?: string
  /** 发光元素在容器中的位置，用于计算光影响方向 */
  glowPosition?: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'left-top' | 'right-top' | 'left-bottom' | 'right-bottom'
  /** 光影响范围（0-1），控制渐变的扩散程度，默认0.3 */
  lightInfluenceRange?: number
  /** 是否启用动态光影效果，默认true */
  enableDynamicGlow?: boolean
}

export const SmartGlowBorder: React.FC<SmartGlowBorderProps> = ({
  children,
  className,
  glowColor,
  glowStrength = 0.5,
  borderWidth = 1,
  borderRadius = '1.5rem',
  glowPosition = 'left-top',
  lightInfluenceRange = 0.3,
  enableDynamicGlow = true
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [detectedGlowColor, setDetectedGlowColor] = React.useState<string>('rgb(245, 158, 11)')

  React.useEffect(() => {
    if (!enableDynamicGlow || glowColor) return

    // 尝试从子元素中提取辉光颜色
    const container = containerRef.current
    if (container) {
      const glowElements = container.querySelectorAll('[style*="drop-shadow"], [style*="filter"]')
      if (glowElements.length > 0) {
        // 这里可以添加更复杂的颜色提取逻辑
        // 暂时使用默认的橙色
        setDetectedGlowColor('rgb(245, 158, 11)')
      }
    }
  }, [enableDynamicGlow, glowColor, children])

  const finalGlowColor = glowColor || detectedGlowColor

  return (
    <div ref={containerRef}>
      <GlowBorderContainer
        className={className}
        glowColor={finalGlowColor}
        glowStrength={glowStrength}
        borderWidth={borderWidth}
        borderRadius={borderRadius}
        glowPosition={glowPosition}
        lightInfluenceRange={lightInfluenceRange}
      >
        {children}
      </GlowBorderContainer>
    </div>
  )
}
