import React, { useState } from 'react'

import { cn } from '../../../utils/cn'
import type { DecorationCardData, UsernameMetadata } from '../dynamic/types'

/**
 * 用户名渲染组件
 * 根据 VIP 状态和颜色信息渲染用户名
 */
export const UsernameDisplay: React.FC<{
  metadata: UsernameMetadata
  className?: string
  style?: React.CSSProperties
}> = ({ metadata, className, style }) => {
  const vipColor = metadata.vipStatus === 1 ? (metadata.nicknameColor ?? '#FB7299') : null

  return (
    <span
      className={cn(!vipColor && 'text-foreground', 'font-bold', className)}
      style={{ ...style, ...(vipColor ? { color: vipColor } : {}) }}
    >
      {metadata.name}
    </span>
  )
}

/**
 * 处理评论文本中的图片防盗链问题
 * @param htmlContent HTML内容
 * @returns 处理后的HTML内容
 */
export const processCommentHTML = (htmlContent: string): string => {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return ''
  }

  let processed = htmlContent

  // 使用正则表达式匹配所有img标签并添加防盗链属性
  processed = processed.replace(/<img([^>]*?)>/gi, '<img$1 referrerpolicy="no-referrer" crossorigin="anonymous">')

  // 替换不可见的分隔符字符 ¨ (U+00A8) 为更明显的点 • (U+2022)
  // ·  •  ●  -
  processed = processed.replace(/¨/g, '•')

  return processed
}

/**
 * 评论文本组件属性接口
 */
interface CommentTextProps {
  /** HTML内容 */
  content: string
  /** CSS类名 */
  className?: string
  /** 内联样式 */
  style?: React.CSSProperties
}

/**
 * 评论文本组件
 * @param props 组件属性
 * @returns JSX元素
 */
export const CommentText: React.FC<CommentTextProps> = ({ content, className, style }) => {
  const processedContent = processCommentHTML(content)

  return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: processedContent }} />
}

/**
 * 增强型图片组件属性接口
 */
interface EnhancedImageProps {
  /** 图片源地址 */
  src: string
  /** 替代文本 */
  alt: string
  /** CSS类名 */
  className?: string
  /** 占位符文本 */
  placeholder?: string
  /** 是否为圆形 */
  isCircular?: boolean
  /** 内联样式 */
  style?: React.CSSProperties
}

/**
 * 增强型图片组件
 * 主要功能:
 * 1. 图片加载失败时显示占位符
 * 2. 支持圆形和方形两种样式
 * 3. 自动处理防盗链(添加referrerPolicy和crossOrigin属性)
 */
export const EnhancedImage: React.FC<EnhancedImageProps> = ({ src, alt, className = '', placeholder, isCircular = false }) => {
  const [hasError, setHasError] = useState(false)

  /**
   * 处理图片加载失败
   */
  const handleError = () => {
    setHasError(true)
  }

  if (!src || hasError) {
    return (
      <div className={`${className} ${isCircular ? 'rounded-full' : 'rounded-md'} bg-surface-secondary flex items-center justify-center`}>
        <span className="text-sm text-muted">{placeholder || alt}</span>
      </div>
    )
  }

  return <img src={src} alt={alt} className={className} onError={handleError} referrerPolicy="no-referrer" crossOrigin="anonymous" />
}

/**
 * 代理图片 URL，绕过 B 站防盗链
 */
const proxyImageUrl = (url: string): string => {
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`
}

/**
 * 装饰卡片组件
 * 接收 JSON 数据并用 React 元素渲染
 */
export const DecorationCard: React.FC<{ data: DecorationCardData | undefined }> = ({ data }) => {
  if (!data) return null

  const gradientStyle =
    data.colors.length > 0 ? `linear-gradient(135deg, ${data.colors.join(', ')} 0%, ${data.colors.join(', ')} 100%)` : undefined

  return (
    <div
      className="flex items-center justify-end font-[bilifont]"
      style={{
        width: '500px',
        height: '150px',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'contain',
        backgroundImage: `url('${proxyImageUrl(data.card_url)}')`
      }}
    >
      {gradientStyle && data.text && (
        <span
          className="mr-40 text-3xl"
          style={{
            color: 'transparent',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            backgroundImage: gradientStyle
          }}
        >
          {data.text}
        </span>
      )}
    </div>
  )
}
