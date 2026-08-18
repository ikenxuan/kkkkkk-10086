import { renderRichTextToReact } from '@kkk/richtext'
import React from 'react'

import { DefaultLayout } from '../../../../components/DefaultLayout'
import type { PosterProps } from '../../../../types/ctx'
import { EnhancedImage } from '../../../components/shared'
import { BilibiliAdditionalCard } from '../../components/AdditionalCard'
import { BilibiliDynamicFooter, BilibiliDynamicStatus, BilibiliDynamicUserInfo } from '../../components/CommonComponents'
import type { BilibiliDynamicContentProps } from '../../types'
import type { BilibiliDynamicData } from './types'

/**
 * B站动态内容组件
 */
const BilibiliDynamicContent: React.FC<BilibiliDynamicContentProps> = (props) => {
  // 根据配置决定布局方式
  const getLayoutType = () => {
    if (!props.image_url || props.image_url.length === 0) return 'auto'

    switch (props.imageLayout) {
      case 'vertical':
        return 'vertical'
      case 'waterfall':
        return 'waterfall'
      case 'grid':
        return 'grid'
      case 'auto':
      default:
        // 自动布局逻辑
        if (props.image_url.length <= 4) return 'vertical'
        if (props.image_url.length >= 9) return 'grid'
        return 'waterfall'
    }
  }

  const layoutType = getLayoutType()

  return (
    <>
      {/* 文本内容 */}
      <div className="flex flex-col px-20 w-full leading-relaxed">
        {/* 标题 */}
        {props.title && (
          <div className="mb-8">
            <h2 className="text-[72px] font-bold leading-[1.4] text-foreground select-text">{props.title}</h2>
          </div>
        )}

        <div className="relative items-center text-6xl tracking-wider wrap-break-word text-foreground">
          <div
            className="tracking-[0.5px] leading-[1.6] whitespace-pre-wrap text-foreground select-text"
            style={{
              wordBreak: 'break-word',
              overflowWrap: 'break-word'
            }}
          >
            {props.text &&
              renderRichTextToReact(props.text, {
                at: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                topic: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                lottery: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                webLink: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                vote: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                viewPicture: { className: 'text-[#006A9E] dark:text-[#58B0D5]' }
              })}
          </div>
        </div>
        <div className="h-15" />
      </div>

      {/* 图片内容 */}
      {props.image_url && Array.isArray(props.image_url) && props.image_url.length > 0 && (
        <div className="px-20">
          {/* 九宫格布局 */}
          {layoutType === 'grid' && (
            <div className="grid grid-cols-3 gap-3 w-full">
              {props.image_url.slice(0, 9).map((img, index) => {
                const total = Math.min(props.image_url?.length || 0, 9)
                const cols = 3
                const row = Math.floor(index / cols)
                const col = index % cols
                const lastRow = Math.floor((total - 1) / cols)
                const firstRowLastCol = Math.min(cols, total) - 1
                const lastRowLastCol = (total - 1) % cols

                const cornerClasses = [
                  'overflow-hidden',
                  'aspect-square',
                  'shadow-medium',
                  'rounded-2xl',
                  row === 0 && col === 0 ? 'rounded-tl-4xl' : '',
                  row === 0 && col === firstRowLastCol ? 'rounded-tr-4xl' : '',
                  row === lastRow && col === 0 ? 'rounded-bl-4xl' : '',
                  row === lastRow && col === lastRowLastCol ? 'rounded-br-4xl' : ''
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <div key={index} className={cornerClasses}>
                    <EnhancedImage src={img.image_src} alt={`图片${index + 1}`} className="object-cover w-full h-full" />
                  </div>
                )
              })}
            </div>
          )}

          {/* 瀑布流布局 */}
          {layoutType === 'waterfall' && (
            <div className="flex gap-4 w-full">
              {/* 左列 */}
              <div className="flex flex-col flex-1 gap-4">
                {props.image_url
                  .filter((_, index) => index % 2 === 0)
                  .map((img, arrayIndex) => {
                    const originalIndex = arrayIndex * 2
                    return (
                      <div key={originalIndex} className="overflow-hidden rounded-3xl shadow-medium">
                        <EnhancedImage src={img.image_src} alt={`图片${originalIndex + 1}`} className="object-cover w-full h-auto" />
                      </div>
                    )
                  })}
              </div>
              {/* 右列 */}
              <div className="flex flex-col flex-1 gap-4">
                {props.image_url
                  .filter((_, index) => index % 2 === 1)
                  .map((img, arrayIndex) => {
                    const originalIndex = arrayIndex * 2 + 1
                    return (
                      <div key={originalIndex} className="overflow-hidden rounded-3xl shadow-medium">
                        <EnhancedImage src={img.image_src} alt={`图片${originalIndex + 1}`} className="object-cover w-full h-auto" />
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* 垂直布局（逐张上下排列） */}
          {layoutType === 'vertical' &&
            props.image_url.map((img, index) => (
              <React.Fragment key={index}>
                <div className="flex items-center">
                  <div className="flex overflow-hidden flex-col flex-1 items-center rounded-4xl shadow-large">
                    <EnhancedImage src={img.image_src} alt="封面" className="object-contain w-full h-full rounded-5xl" />
                  </div>
                </div>
                <div className="h-10" />
              </React.Fragment>
            ))}

          {/* 底部间距 */}
          {(layoutType === 'waterfall' || layoutType === 'grid') && <div className="h-18" />}
        </div>
      )}

      {/* 相关卡片 - 放在图片底部 */}
      {props.additional && <BilibiliAdditionalCard additional={props.additional} />}
    </>
  )
}

/**
 * B站动态组件
 */
export const BilibiliDrawDynamic: React.FC<PosterProps<BilibiliDynamicData>> = React.memo((props) => {
  return (
    <DefaultLayout ctx={props.ctx}>
      <div className="p-4">
        {/* 间距 */}
        <div className="h-25" />

        {/* 用户信息 */}
        <BilibiliDynamicUserInfo {...props.data} />

        {/* 间距 */}
        <div className="h-15" />

        {/* 动态内容 */}
        <BilibiliDynamicContent
          title={props.data.title}
          text={props.data.text}
          image_url={props.data.image_url}
          imageLayout={props.data.imageLayout}
          additional={props.data.additional}
        />

        {/* 动态状态 */}
        <BilibiliDynamicStatus {...props.data} />

        {/* 间距 */}
        <div className="h-40" />

        {/* 底部信息 */}
        <BilibiliDynamicFooter {...props.data} />
      </div>
    </DefaultLayout>
  )
})

BilibiliDrawDynamic.displayName = 'BilibiliDrawDynamic'

export default BilibiliDrawDynamic
