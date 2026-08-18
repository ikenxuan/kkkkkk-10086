import { renderRichTextToReact } from '@kkk/richtext'
import { Clock } from 'lucide-react'
import React from 'react'

import { DefaultLayout } from '../../../../components/DefaultLayout'
import type { PosterProps } from '../../../../types/ctx'
import { DecorationCard, EnhancedImage, UsernameDisplay } from '../../../components/shared'
import { BilibiliAdditionalCard } from '../../components/AdditionalCard'
import { BilibiliDynamicFooter, BilibiliDynamicStatus, BilibiliDynamicUserInfo } from '../../components/CommonComponents'
import type { DecorationCardData, OriginalContentAV, OriginalContentDraw, OriginalContentLiveRcmd, OriginalContentWord } from '../../types'
import type { BilibiliForwardDynamicData } from './types'

/**
 * 原始内容用户信息组件
 */
const OriginalUserInfo: React.FC<{
  avatar_url: string
  frame?: string
  usernameMeta: { name: string; vipStatus: number; nicknameColor: string | null }
  create_time: string
  decoration_card?: DecorationCardData
}> = (props) => {
  return (
    <div className="flex justify-between items-center pl-8 pr-0">
      <div className="flex gap-10 items-center min-w-0">
        <div className="relative shrink-0">
          <EnhancedImage src={props.avatar_url} alt="转发用户头像" className="rounded-full shadow-medium w-30 h-30" />
          {props.frame && <EnhancedImage src={props.frame} alt="转发用户头像框" className="absolute inset-0 transform scale-180" />}
        </div>
        <div className="flex flex-col gap-4 text-7xl">
          <div className="text-5xl font-normal select-text text-foreground">
            <UsernameDisplay metadata={props.usernameMeta} />
          </div>
          <div className="flex gap-2 items-center text-4xl font-normal whitespace-nowrap text-muted">
            <Clock size={32} />
            {props.create_time}
          </div>
        </div>
      </div>
      {props.decoration_card && (
        <div className="shrink-0">
          <DecorationCard data={props.decoration_card} />
        </div>
      )}
    </div>
  )
}

/**
 * AV类型原始内容组件
 */
const OriginalAVContent: React.FC<{ content: OriginalContentAV }> = ({ content }) => {
  return (
    <div className="px-12 py-8 mt-4 w-full rounded-8xl bg-surface-secondary">
      <div className="h-10" />

      <OriginalUserInfo
        avatar_url={content.avatar_url}
        frame={content.frame}
        usernameMeta={content.usernameMeta}
        create_time={content.create_time}
        decoration_card={content.decoration_card}
      />

      <div className="h-15" />

      <div className="relative items-center text-5xl tracking-wider wrap-break-word text-muted leading-relaxed">
        {content.text.nodes.length > 0 &&
          renderRichTextToReact(content.text, {
            at: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            topic: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            lottery: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            webLink: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            vote: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            viewPicture: { className: 'text-[#006A9E] dark:text-[#58B0D5]' }
          })}
      </div>

      {content.text.nodes.length > 0 && <div className="h-5" />}

      <div className="flex overflow-hidden relative flex-col items-center w-full rounded-5xl aspect-video">
        <EnhancedImage src={content.cover} alt="视频封面" className="w-full h-full" />
        <div className="absolute right-0 bottom-0 left-0 h-1/2 bg-linear-to-t to-transparent pointer-events-none from-black/75" />
        <div className="absolute right-5 left-12 bottom-14 z-10 text-4xl font-light text-white select-text">
          <span className="px-4 py-2 mr-3 text-4xl text-white rounded-2xl bg-black/50">{content.duration_text}</span>
          {content.play}观看 {content.danmaku}弹幕
        </div>
      </div>

      <div className="h-10" />

      <div className="pl-2 text-6xl font-bold select-text leading-20 text-foreground">
        {content.title &&
          renderRichTextToReact(content.title, {
            at: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            topic: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            lottery: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            webLink: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            vote: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            viewPicture: { className: 'text-[#006A9E] dark:text-[#58B0D5]' }
          })}
      </div>

      <div className="h-4" />
    </div>
  )
}

/**
 * DRAW类型原始内容组件
 */
const OriginalDrawContent: React.FC<{ content: OriginalContentDraw }> = ({ content }) => {
  return (
    <div className="px-12 py-12 mt-4 w-full rounded-8xl bg-surface-secondary">
      <OriginalUserInfo
        avatar_url={content.avatar_url}
        frame={content.frame}
        usernameMeta={content.usernameMeta}
        create_time={content.create_time}
        decoration_card={content.decoration_card}
      />

      <div className="h-15" />

      <div className="text-5xl leading-relaxed text-foreground wrap-break-word">
        {content.title && (
          <span className="text-6xl font-bold">
            {content.title}
            <br />
            <br />
          </span>
        )}
        {content.text &&
          renderRichTextToReact(content.text, {
            at: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            topic: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            lottery: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            webLink: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            vote: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            viewPicture: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            iconScale: 0.8
          })}
      </div>

      {content.image_url && content.image_url.length === 1 ? (
        <div className="flex justify-center py-11 pb-0">
          <div className="flex overflow-hidden flex-col items-center w-full rounded-4xl shadow-large">
            <EnhancedImage src={content.image_url[0].image_src} alt="图片" className="object-cover w-full h-full rounded-6" />
          </div>
        </div>
      ) : (
        <div className={`grid gap-3 ${content.image_url?.length === 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {content.image_url?.map((img, index) => {
            const total = content.image_url?.length || 0
            const cols = total === 4 ? 2 : 3
            const row = Math.floor(index / cols)
            const col = index % cols
            const lastRow = Math.floor((total - 1) / cols)
            const firstRowLastCol = Math.min(cols, total) - 1
            const lastRowLastCol = (total - 1) % cols

            const cornerClasses = [
              'overflow-hidden',
              'relative',
              'shadow-medium',
              'aspect-square',
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
                <EnhancedImage src={img.image_src} alt={`图片${index + 1}`} className="object-cover  w-full h-full" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * WORD类型原始内容组件
 */
const OriginalWordContent: React.FC<{ content: OriginalContentWord }> = ({ content }) => {
  return (
    <div className="px-12 py-8 mt-4 w-full rounded-8xl bg-surface-secondary">
      <OriginalUserInfo
        avatar_url={content.avatar_url}
        frame={content.frame}
        usernameMeta={content.usernameMeta}
        create_time={content.create_time}
        decoration_card={content.decoration_card}
      />

      <div className="py-4">
        <div className="text-5xl leading-relaxed text-foreground wrap-break-word">
          {content.text &&
            renderRichTextToReact(content.text, {
              at: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
              topic: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
              lottery: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
              webLink: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
              vote: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
              viewPicture: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
              iconScale: 0.8
            })}
        </div>
      </div>
      <BilibiliAdditionalCard additional={content.additional} gap={false} className="pb-4" />
    </div>
  )
}

/**
 * LIVE_RCMD类型原始内容组件
 */
const OriginalLiveRcmdContent: React.FC<{ content: OriginalContentLiveRcmd }> = ({ content }) => {
  return (
    <div className="px-12 py-8 mt-4 w-full rounded-8xl bg-surface-secondary">
      <OriginalUserInfo
        avatar_url={content.avatar_url}
        frame={content.frame}
        usernameMeta={content.usernameMeta}
        create_time={content.create_time}
        decoration_card={content.decoration_card}
      />

      <div className="flex flex-col items-center py-11">
        <div className="flex overflow-hidden relative flex-col items-center w-full rounded-10 aspect-video shadow-large">
          <EnhancedImage src={content.cover} alt="直播封面" className="object-cover absolute w-full h-full rounded-3xl" />
          <div className="absolute right-0 bottom-0 left-0 h-1/2 bg-linear-to-t to-transparent pointer-events-none from-black/75 rounded-3xl" />
          <div className="absolute right-5 bottom-8 left-12 z-10 text-4xl font-light text-white select-text">
            <span className="px-4 py-2 mr-3 text-3xl text-white bg-black/50 rounded-3xl">{content.area_name}</span>
            {content.text_large}、在线: {content.online}
          </div>
        </div>
      </div>

      <div className="pl-8 text-6xl font-bold select-text text-foreground mb-8">
        {content.title &&
          renderRichTextToReact(content.title, {
            at: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            topic: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            lottery: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            webLink: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            vote: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
            viewPicture: { className: 'text-[#006A9E] dark:text-[#58B0D5]' }
          })}
      </div>
    </div>
  )
}

/**
 * B站转发动态内容组件
 */
const BilibiliForwardContent: React.FC<BilibiliForwardDynamicData> = (props) => {
  return (
    <>
      {/* 转发文本内容 */}
      <div className="flex flex-col px-20 w-full">
        <div className="relative items-center text-6xl tracking-wider wrap-break-word text-foreground leading-relaxed">
          {props.text &&
            renderRichTextToReact(props.text, {
              at: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
              topic: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
              lottery: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
              webLink: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
              vote: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
              viewPicture: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
              iconScale: 0.8
            })}
        </div>
        {props.imgList && props.imgList.length === 0 && <div className="h-15" />}
      </div>

      {props.imgList && props.imgList.length > 0 && (
        <div className="flex flex-col items-center px-20 w-full">
          {props.imgList.map((img, idx) => (
            <React.Fragment key={`${img}-${idx}`}>
              <div className="flex overflow-hidden relative flex-col items-center rounded-3xl shadow-large">
                <EnhancedImage src={img} alt={`图片${idx + 1}`} className="object-contain w-full h-full rounded-3xl" />
              </div>
              <div className="h-10" />
            </React.Fragment>
          ))}
        </div>
      )}

      {/* 原始内容 */}
      <div className="flex px-20">
        {props.original_content.DYNAMIC_TYPE_AV && <OriginalAVContent content={props.original_content.DYNAMIC_TYPE_AV} />}
        {props.original_content.DYNAMIC_TYPE_DRAW && <OriginalDrawContent content={props.original_content.DYNAMIC_TYPE_DRAW} />}
        {props.original_content.DYNAMIC_TYPE_WORD && <OriginalWordContent content={props.original_content.DYNAMIC_TYPE_WORD} />}
        {props.original_content.DYNAMIC_TYPE_LIVE_RCMD && (
          <OriginalLiveRcmdContent content={props.original_content.DYNAMIC_TYPE_LIVE_RCMD} />
        )}
      </div>
    </>
  )
}

/**
 * B站转发动态组件
 */
export const BilibiliForwardDynamic: React.FC<PosterProps<BilibiliForwardDynamicData>> = React.memo((props) => {
  return (
    <DefaultLayout ctx={props.ctx}>
      <div className="p-4">
        {/* 间距 */}
        <div className="h-25" />

        {/* 用户信息 */}
        <BilibiliDynamicUserInfo {...props.data} />

        {/* 间距 */}
        <div className="h-15" />

        {/* 转发动态内容 */}
        <BilibiliForwardContent {...props.data} />

        {/* 间距 */}
        <div className="h-25" />

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

BilibiliForwardDynamic.displayName = 'BilibiliForwardDynamic'

export default BilibiliForwardDynamic
