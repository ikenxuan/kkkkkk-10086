import { renderRichTextToReact } from '@kkk/richtext'
import { ClockIcon } from '@phosphor-icons/react'
import React from 'react'

import { DefaultLayout } from '../../../../components/DefaultLayout'
import type { PosterProps } from '../../../../types/ctx'
import { cn } from '../../../../../utils/cn'
import { CoinIcon, ViewIcon } from '../../../components/Icons'
import { EnhancedImage } from '../../../components/shared'
import { BilibiliDynamicFooter, BilibiliDynamicStatus, BilibiliDynamicUserInfo } from '../../components/CommonComponents'
import type { BilibiliVideoDynamicData } from './types'

/**
 * B站视频内容组件
 */
const BilibiliVideoContent: React.FC<PosterProps<BilibiliVideoDynamicData>> = (props) => {
  return (
    <div className="px-16">
      <div className="px-12 py-12 rounded-8xl bg-surface-secondary">
        {/* 视频封面 */}
        {props.data.image_url && (
          <>
            <div className="items-center">
              <div className="flex overflow-hidden relative flex-col flex-1 items-center rounded-5xl shadow-large">
                <EnhancedImage src={props.data.image_url} alt="封面" className="object-contain w-full h-full rounded-3xl" />
                {/* 播放图标覆盖层 */}
                <div className="flex absolute bottom-12 right-16">
                  <img src="/image/bilibili/play.svg" alt="播放图标" className="w-40 h-40" />
                </div>
              </div>
            </div>
            <div className="h-10" />
          </>
        )}

        {/* 视频信息 */}
        <div className="flex flex-col w-full leading-relaxed">
          {/* 视频标题 */}
          <div className="relative items-center text-6xl font-bold tracking-wider wrap-break-word text-foreground leading-tight">
            {props.data.text &&
              renderRichTextToReact(props.data.text, {
                at: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                topic: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                lottery: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                webLink: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                vote: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                viewPicture: { className: 'text-[#006A9E] dark:text-[#58B0D5]' }
              })}
          </div>

          {/* 间距 */}
          <div className="h-10" />

          {/* 视频描述 */}
          <div className="text-5xl text-muted leading-normal wrap-break-word break-keep">
            {props.data.desc &&
              renderRichTextToReact(props.data.desc, {
                at: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                topic: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                lottery: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                webLink: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                vote: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                viewPicture: { className: 'text-[#006A9E] dark:text-[#58B0D5]' }
              })}
          </div>

          {/* 间距 */}
          <div className="h-20" />

          {/* 视频统计信息 */}
          <div className="flex flex-col gap-8 text-foreground/70">
            <div className="flex gap-12 items-center text-5xl font-light tracking-normal">
              <div className="flex gap-3 items-center">
                <CoinIcon size={52} />
                <span className="select-text">{props.data.coin}硬币</span>
              </div>

              <div className="flex gap-3 items-center">
                <ViewIcon size={52} variant="solid" />
                <span className="select-text">{props.data.view}播放</span>
              </div>

              <div className="flex gap-3 items-center text-5xl font-light tracking-normal">
                <ClockIcon size={52} weight="fill" />
                <span className="select-text">
                  时长({props.data.page_length}P): {props.data.duration_text}
                </span>
              </div>
            </div>
          </div>

          <div className="h-2" />
        </div>
      </div>
    </div>
  )
}

/**
 * B站视频动态共创者组件
 */
const BilibiliVideoStaff: React.FC<PosterProps<BilibiliVideoDynamicData>> = (props) => {
  // 过滤掉已显示在底部的用户，避免重复
  const otherStaff = props.data.staff?.filter((member) => member.mid !== Number(props.data.user_shortid)) || []

  // 响应式计算可显示的共创者数量
  const listRef = React.useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = React.useState(otherStaff.length)

  React.useEffect(() => {
    const calc = () => {
      const el = listRef.current
      if (!el || otherStaff.length === 0) return
      const containerWidth = el.offsetWidth

      // 每项实际宽度约168px（头像w-42），间距gap-8=32px
      const ITEM_W = 168
      const GAP = 32

      const capacity = Math.floor(containerWidth / (ITEM_W + GAP))
      const needEllipsis = otherStaff.length > capacity
      const nextVisible = needEllipsis ? Math.max(0, capacity - 1) : otherStaff.length
      setVisibleCount(nextVisible)
    }

    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [otherStaff.length])

  if (otherStaff.length === 0) return null

  return (
    <div className="flex flex-col px-20 w-full">
      <div ref={listRef} className="flex overflow-hidden gap-8 py-1 w-full">
        {otherStaff.slice(0, visibleCount).map((member) => (
          <div key={member.mid} className="flex flex-col items-center min-w-42 w-42 shrink-0">
            <div className="flex justify-center items-center bg-white rounded-full w-30 h-30">
              <EnhancedImage src={member.face} alt={member.name} className="object-cover w-28 h-28 rounded-full" isCircular />
            </div>
            <div className="overflow-hidden mt-6 w-full text-3xl font-medium leading-tight text-center truncate whitespace-nowrap select-text text-foreground">
              {member.name}
            </div>
            <div className="overflow-hidden mt-2 w-full text-3xl leading-tight text-center truncate whitespace-nowrap select-text text-muted">
              {member.title}
            </div>
          </div>
        ))}

        {otherStaff.length > visibleCount && (
          <div className="flex flex-col items-center min-w-42 w-42 shrink-0">
            <div className="flex justify-center items-center rounded-full bg-surface-secondary w-30 h-30">
              <span className="text-[42px] leading-none text-muted">···</span>
            </div>
            <div className="overflow-hidden mt-6 w-full text-3xl font-medium leading-tight text-center truncate whitespace-nowrap select-text text-foreground">
              还有{otherStaff.length - visibleCount}人
            </div>
            <div className="overflow-hidden mt-2 w-full text-3xl leading-tight text-center truncate whitespace-nowrap select-text text-muted">
              共创
            </div>
          </div>
        )}
      </div>
      <div className="h-15" />
    </div>
  )
}

/**
 * B站视频动态组件
 */
export const BilibiliVideoDynamic: React.FC<PosterProps<BilibiliVideoDynamicData>> = React.memo((props) => {
  return (
    <DefaultLayout ctx={props.ctx}>
      <div className="p-4">
        {/* 间距 */}
        <div className="h-25" />

        {/* 用户信息 */}
        <BilibiliDynamicUserInfo {...props.data} />

        {/* 间距 */}
        <div className="h-15" />

        {/* 动态正文 */}
        {props.data.dynamic_text && (
          <div className="flex flex-col px-20 w-full leading-relaxed">
            <div className="relative items-center text-5xl tracking-wider wrap-break-word text-foreground">
              <div
                className="text-[60px] tracking-[0.5px] leading-[1.6] whitespace-pre-wrap text-foreground select-text"
                style={{
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word'
                }}
              >
                {props.data.dynamic_text.nodes.length > 0 ? (
                  renderRichTextToReact(props.data.dynamic_text, {
                    at: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                    topic: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                    lottery: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                    webLink: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                    vote: { className: 'text-[#006A9E] dark:text-[#58B0D5]' },
                    viewPicture: { className: 'text-[#006A9E] dark:text-[#58B0D5]' }
                  })
                ) : (
                  <span className="text-default-foreground/50">投稿了视频</span>
                )}
              </div>
            </div>
            <div className="h-15" />
          </div>
        )}

        {/* 视频内容 */}
        <BilibiliVideoContent {...props} />

        <div className="h-15" />

        {/* 动态状态 */}
        <BilibiliDynamicStatus {...props.data} />

        {/* 间距 */}
        <div className={cn(props.data.staff && props.data.staff.length > 0 && 'h-23', !props.data.staff && 'h-40')} />

        {/* 共创者信息 */}
        <BilibiliVideoStaff {...props} />

        {/* 底部信息 */}
        <BilibiliDynamicFooter {...props.data} />
      </div>
    </DefaultLayout>
  )
})

BilibiliVideoDynamic.displayName = 'BilibiliVideoDynamic'

export default BilibiliVideoDynamic
