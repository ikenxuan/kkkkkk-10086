import { renderRichTextToReact } from '@kkk/richtext'
import { differenceInSeconds, format, formatDistanceToNow, fromUnixTime } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import React, { type ReactNode, useEffect, useState } from 'react'

import { DefaultLayout } from '../../../components/DefaultLayout'
import type { PosterProps } from '../../../types/ctx'
import { cn } from '../../../../utils/cn'
import { generateQRCode } from '../../../../utils/QRcode'
import { isDark as isDarkMode } from '../../../../utils/theme'
import { ThumbUpIcon } from '../../components/Icons'
import type { FansDetail, QRCodeSectionProps } from '../../components/types'
import type { BilibiliCommentData } from './types'

const bilibiliMentionClassName = 'text-[#006A9E] dark:text-[#58B0D5]'

/**
 * 将 B 站 32 位 ARGB 整数转为 rgba 字符串
 */
const intToRgba = (color: number): string => {
  const a = ((color >>> 24) & 0xff) / 255
  const r = (color >>> 16) & 0xff
  const g = (color >>> 8) & 0xff
  const b = color & 0xff
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/**
 * 粉丝勋章组件
 */
const FansMedal: React.FC<{ detail: FansDetail }> = ({ detail }) => {
  const bgStart = intToRgba(detail.medal_color)
  const bgEnd = intToRgba(detail.medal_color_end)
  const borderColor = intToRgba(detail.medal_color_border)
  const nameColor = intToRgba(detail.medal_color_name)
  const levelColor = intToRgba(detail.medal_color_level)

  return (
    <div
      className={cn('inline-flex items-center shrink-0', 'h-14 rounded-full border')}
      style={{
        borderColor,
        backgroundImage: `linear-gradient(90deg, ${bgStart}, ${bgEnd})`
      }}
    >
      {detail.first_icon && (
        <img src={detail.first_icon} alt="" className="shrink-0 -ml-3 w-20" referrerPolicy="no-referrer" crossOrigin="anonymous" />
      )}
      <div className={cn('flex items-center', detail.first_icon ? 'pr-4' : 'px-4')}>
        <span className="font-medium whitespace-nowrap text-3xl" style={{ color: nameColor }}>
          {detail.medal_name}
        </span>
        <span className="whitespace-nowrap ml-2 mb-1 text-4xl font-[fansmedal-num]" style={{ color: levelColor }}>
          {detail.level}
        </span>
      </div>
    </div>
  )
}

/**
 * 置顶标签组件
 */
const TopBadge: React.FC = () => {
  return (
    <span
      className={cn(
        'inline-flex justify-center items-center',
        'px-4 py-2 mr-4 mb-1 rounded-xl',
        'text-[45px] font-light leading-none',
        'align-baseline',
        'bg-[#ffedf5] text-[#ff799e]',
        'dark:bg-[#321b26] dark:text-[#cb5775]'
      )}
    >
      置顶
    </span>
  )
}

/**
 * 带有加载状态的图片组件
 * @param props 图片组件属性
 * @returns JSX元素
 */
interface ImageWithSkeletonProps {
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
}

const ImageWithSkeleton: React.FC<ImageWithSkeletonProps> = ({ src, alt, className = '', placeholder }) => {
  const [hasError, setHasError] = useState(false)

  /**
   * 处理图片加载失败
   */
  const handleError = () => {
    setHasError(true)
  }

  // 重置状态当src改变时
  useEffect(() => {
    setHasError(false)
  }, [src])

  if (hasError) {
    return (
      <div className={`flex justify-center items-center text-sm select-text ${className} bg-surface-secondary text-muted`}>
        {placeholder || '图片加载失败'}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`select-text ${className}`}
      onError={handleError}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
    />
  )
}

const renderBilibiliCommentRichText = (content: BilibiliCommentData['CommentsData'][number]['message']): ReactNode => {
  return renderRichTextToReact(content, {
    mention: { className: bilibiliMentionClassName }
  })
}

const formatBilibiliCommentTime = (timestamp: number): string => {
  if (!timestamp) {
    return ''
  }

  const commentDate = fromUnixTime(timestamp)
  const diffSeconds = differenceInSeconds(new Date(), commentDate)

  if (diffSeconds < 30) {
    return '刚刚'
  }

  if (diffSeconds < 7776000) {
    return formatDistanceToNow(commentDate, {
      locale: zhCN,
      addSuffix: true
    })
  }

  return format(commentDate, 'yyyy-MM-dd')
}

const formatBilibiliLikeCount = (count: number): string => {
  if (count > 10000) {
    return `${(count / 10000).toFixed(1)}w`
  }

  return String(count)
}

const renderBilibiliUserName = (uname: string, unameColor: string | null | undefined, vipstatus?: number) => {
  return (
    <span
      className="inline-block leading-[1.2] font-medium whitespace-nowrap"
      style={{
        color: unameColor ?? '#888',
        fontWeight: vipstatus === 1 ? 500 : undefined
      }}
    >
      {uname}
    </span>
  )
}

const BilibiliLogo: React.FC = () => {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return <div className="flex items-center h-full text-6xl font-bold text-foreground/70">哔哩哔哩</div>
  }

  return (
    <img
      src="/image/bilibili/bilibili.png"
      alt="B站Logo"
      className="object-contain h-full w-auto max-w-112.5"
      onError={() => setHasError(true)}
    />
  )
}

/**
 * 二维码组件
 * @param props 组件属性
 * @returns JSX元素
 */
const QRCodeSection: React.FC<QRCodeSectionProps> = ({ share_url, useDarkTheme }) => {
  return (
    <div className="flex flex-col items-center">
      <div className="flex justify-center items-center w-100 h-100 p-4">
        <img src={generateQRCode(share_url, useDarkTheme)} alt="二维码" className="object-contain w-full h-full rounded-lg" />
      </div>
    </div>
  )
}

/**
 * 视频信息头部组件
 * @param props 组件属性
 * @returns JSX元素
 */
const VideoInfoHeader: React.FC<Omit<BilibiliCommentData, 'CommentsData'> & Pick<QRCodeSectionProps, 'useDarkTheme'>> = (props) => {
  return (
    <div className="max-w-350 mx-auto px-10 py-8">
      <div className="flex gap-16 justify-between items-start">
        {/* 左侧信息区域 */}
        <div className="flex flex-col flex-1">
          {/* Logo 和分辨率区域 */}
          <div className="mb-12">
            {/* Logo */}
            <div className="h-45 flex items-center">
              <BilibiliLogo />
              {/* 分辨率信息 - 仅视频类型显示 */}
              {props.Type === '视频' && props.Resolution && (
                <div className="flex flex-col gap-2 px-8 py-4 ml-12 rounded-3xl bg-surface/50 w-fit">
                  <span className="text-[42px] text-muted">分辨率（px）</span>
                  <span className="text-[48px] font-medium text-foreground/70">{props.Resolution}</span>
                </div>
              )}
            </div>
          </div>

          {/* 信息列表 */}
          <div className="grid grid-cols-2 gap-y-6 gap-x-16 pl-2">
            <div className="flex items-center tracking-[6px] text-[45px] text-muted select-text whitespace-nowrap">
              <span className="shrink-0 mr-4 text-muted">类型</span>
              <span className="font-medium text-foreground/70">{props.Type}</span>
            </div>
            <div className="flex items-center tracking-[6px] text-[45px] text-muted select-text whitespace-nowrap">
              <span className="shrink-0 mr-4 text-muted">评论</span>
              <span className="font-medium text-foreground/70">{props.CommentLength}条</span>
            </div>
            {props.Type === '视频' ? (
              <>
                <div className="flex items-center tracking-[6px] text-[45px] text-muted select-text whitespace-nowrap">
                  <span className="shrink-0 mr-4 text-muted">大小</span>
                  <span className="font-medium text-foreground/70">{props.VideoSize}</span>
                </div>
                <div className="flex items-center tracking-[6px] text-[45px] text-muted select-text whitespace-nowrap">
                  <span className="shrink-0 mr-4 text-muted">画质</span>
                  <span className="font-medium text-foreground/70">{props.Clarity}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center tracking-[6px] text-[45px] text-muted select-text whitespace-nowrap">
                  <span className="shrink-0 mr-4 text-muted">图片</span>
                  <span className="font-medium text-foreground/70">{props.ImageLength}张</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 右侧二维码区域 */}
        <div className="shrink-0">
          <QRCodeSection share_url={props.share_url} useDarkTheme={props.useDarkTheme} />
        </div>
      </div>
    </div>
  )
}

/**
 * 评论项组件
 * @param props 组件属性
 * @returns JSX元素
 */
const CommentItemComponent: React.FC<BilibiliCommentData['CommentsData'][number] & { isLast?: boolean }> = ({
  isLast = false,
  ...props
}) => {
  return (
    <div className={cn('flex relative px-10 py-10 max-w-full', { 'pb-0': isLast })}>
      {/* 用户头像区域 */}
      <div className="relative mr-[33.75px] shrink-0 w-50 h-50 flex items-center justify-center">
        {/* 主头像 */}
        <ImageWithSkeleton
          src={props.avatar || 'AVATAR_PLACEHOLDER'}
          alt="用户头像"
          className="rounded-full w-35 h-35 shadow-large"
          placeholder="头像"
          isCircular
        />

        {/* 头像框 */}
        {props.frame && (
          <ImageWithSkeleton src={props.frame} alt="头像框" className="absolute inset-0 transform scale-120" placeholder="头像框" />
        )}

        {/* 大会员标识 */}
        {props.vipstatus === 1 && (
          <div className="flex absolute right-4 bottom-6 z-20 justify-center items-center rounded-full w-15 h-15 bg-surface">
            <img src="/image/bilibili/res-local1.png" alt="大会员" className="w-12 h-12" />
          </div>
        )}
      </div>

      {/* 评论内容区域 */}
      <div className="flex-1 min-w-0">
        {/* 用户信息 */}
        <div className="flex items-start gap-2.5 mb-3.75 text-[50px] relative">
          {/* 用户名区域  */}
          <div className="shrink-0 flex items-center gap-6 leading-[1.2] text-foreground/80 font-bold select-text">
            {renderBilibiliUserName(props.uname, props.unameColor, props.vipstatus)}

            {/* 等级图标 */}
            {props.level !== undefined && props.level >= 0 && props.level <= 7 && (
              <img
                src={`/image/bilibili/level/lv${props.level}.svg`}
                alt={`等级${props.level}`}
                className="inline-block shrink-0 w-24 h-24 align-middle"
              />
            )}
            {/* UP主标签 */}
            {props.isUP && <img src="/image/bilibili/up_pb.svg" alt="UP主标签" className="inline-block shrink-0 align-middle w-23 h-23" />}
            {/* 粉丝勋章 */}
            {props.fansDetail && <FansMedal detail={props.fansDetail} />}
          </div>

          {/* 粉丝卡片 - 绝对定位在右侧，不会被挤出 */}
          {props.fanCard && props.fanCard.image && (
            <div className="absolute -top-10 right-0 h-45 z-10 pointer-events-none">
              <div className="inline-block relative h-full">
                <img
                  src={props.fanCard.image}
                  alt="粉丝卡片"
                  className="block object-contain w-auto h-full"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
                <div className="absolute bottom-15 right-8 w-[14%] h-full flex flex-col items-start justify-end leading-10 font-[bilifont]">
                  <span
                    className="text-4xl font-bold whitespace-nowrap"
                    style={{
                      backgroundImage: props.fanCard.gradientStyle,
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text'
                    }}
                  >
                    {props.fanCard.numPrefix}
                  </span>
                  <span
                    className="text-4xl font-bold whitespace-nowrap font-bilifont"
                    style={{
                      backgroundImage: props.fanCard.gradientStyle,
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text'
                    }}
                  >
                    {props.fanCard.numDesc}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 作者标签 */}
          {props.label_type === 1 && (
            <div className="inline-block px-5 py-0.5 rounded-[10px] text-[45px] bg-danger text-danger-foreground shrink-0 self-center select-text">
              作者
            </div>
          )}

          {/* 状态标签 */}
          {props.status_label && (
            <div className="inline-block px-5 py-0.5 rounded-[10px] text-[45px] bg-surface-secondary text-foreground/70 shrink-0 self-center select-text">
              {props.status_label}
            </div>
          )}
        </div>

        {/* 评论文本 */}
        <div className="items-center whitespace-pre-wrap text-6xl tracking-[0.5px] leading-[1.6] text-foreground">
          {props.isTop && <TopBadge />}
          {renderBilibiliCommentRichText(props.message)}
        </div>

        {/* 评论图片 */}
        {props.pictures && props.pictures.length > 0 && (
          <div className="flex gap-5 my-5 w-[95%]">
            {props.pictures.length === 1 ? (
              // 只有一张图片时，完整显示
              <div className="overflow-hidden rounded-[25px] shadow-large w-full">
                <ImageWithSkeleton
                  src={props.pictures[0]}
                  alt="评论图片"
                  className="rounded-[25px] object-contain w-full h-full"
                  placeholder="评论图片"
                />
              </div>
            ) : (
              // 多张图片时，显示两张正方形缩略图
              props.pictures.slice(0, 2).map((picUrl, idx) => (
                <div key={idx} className="relative overflow-hidden rounded-[25px] shadow-large flex-1 aspect-square">
                  <ImageWithSkeleton
                    src={picUrl}
                    alt={`评论图片${idx + 1}`}
                    className="rounded-[25px] object-cover w-full h-full"
                    placeholder="评论图片"
                  />
                  {/* 如果是第二张图且总数超过2张，显示+x标志 */}
                  {idx === 1 && props.pictures.length > 2 && (
                    <div className="absolute bottom-3 right-3">
                      {/* 悬浮按钮背景 */}
                      <div className="flex items-center justify-center bg-black px-4 py-3 rounded-2xl opacity-80 backdrop-blur-sm">
                        {/* +x 文字 */}
                        <span className="text-white text-4xl font-bold leading-none">+ {props.pictures.length - 2}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* 点赞区域 */}
        <div className="flex items-center justify-between mt-[37.5px] whitespace-nowrap text-muted">
          <div className="flex flex-1 items-center">
            <div className="text-[45px] tracking-[2px] select-text">
              {formatBilibiliCommentTime(props.ctime)} · {props.location}
              {props.replylength > 0 ? (
                <span className="text-muted tracking-[3px] ml-4">{props.replylength}回复</span>
              ) : (
                <span className="ml-4 text-foreground/70">回复</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-18.75 ml-auto">
            <div className="flex items-center gap-3.75">
              <ThumbUpIcon variant="line" className="w-15 h-15 text-muted" />
              <span className="text-[45px] text-muted select-text">{formatBilibiliLikeCount(props.like)}</span>
            </div>
          </div>
        </div>

        {/* 二级评论 */}
        {props.replies && props.replies.length > 0 && (
          <div className="mt-10">
            {props.replies.map((subReply, index) => (
              <div key={index}>
                <div className="flex items-start space-x-4">
                  {/* 二级评论头像区域 */}
                  <div className="relative mr-[33.75px] shrink-0 w-40 h-40 flex items-center justify-center">
                    <ImageWithSkeleton
                      src={subReply.avatar || 'AVATAR_PLACEHOLDER'}
                      alt="用户头像"
                      className="rounded-full w-30 h-30 shadow-large"
                      placeholder="头像"
                      isCircular
                    />
                    {subReply.frame && (
                      <ImageWithSkeleton
                        src={subReply.frame}
                        alt="头像框"
                        className="absolute inset-0 transform scale-90"
                        placeholder="头像框"
                      />
                    )}

                    {/* 大会员标识 */}
                    {subReply.vipstatus === 1 && (
                      <div className="flex absolute right-4 bottom-5 z-20 justify-center items-center w-12 h-12 rounded-full bg-surface">
                        <img src="/image/bilibili/res-local1.png" alt="大会员" className="w-9 h-9" />
                      </div>
                    )}
                  </div>

                  {/* 二级评论内容 */}
                  <div className="flex-1">
                    {/* 用户信息 */}
                    <div className="flex items-start gap-2.5 mb-3.75 text-[50px] relative overflow-visible">
                      <div className="shrink-0 flex items-center gap-6 leading-[1.2] text-foreground/80 font-bold select-text">
                        {renderBilibiliUserName(subReply.uname, subReply.unameColor, subReply.vipstatus)}
                        {subReply.level !== undefined && subReply.level >= 0 && subReply.level <= 7 && (
                          <img
                            src={`/image/bilibili/level/lv${subReply.level}.svg`}
                            alt={`等级${subReply.level}`}
                            className="inline-block shrink-0 w-24 h-24 align-middle"
                          />
                        )}
                        {subReply.isUP && (
                          <img src="/image/bilibili/up_pb.svg" alt="UP主标签" className="inline-block shrink-0 align-middle w-23 h-23" />
                        )}
                        {/* 粉丝勋章 */}
                        {subReply.fansDetail && <FansMedal detail={subReply.fansDetail} />}
                      </div>

                      {/* 二级评论粉丝卡片 */}
                      {subReply.fanCard && subReply.fanCard.image && (
                        <div className="absolute -top-10 right-0 h-45 z-10 pointer-events-none">
                          <div className="inline-block relative h-full">
                            <img
                              src={subReply.fanCard.image}
                              alt="粉丝卡片"
                              className="block object-contain w-auto h-full"
                              referrerPolicy="no-referrer"
                              crossOrigin="anonymous"
                            />
                            <div className="absolute bottom-15 right-8 w-[14%] h-full flex flex-col items-start justify-end leading-10 font-[bilifont]">
                              <span
                                className="text-4xl font-bold whitespace-nowrap"
                                style={{
                                  backgroundImage: subReply.fanCard.gradientStyle,
                                  WebkitTextFillColor: 'transparent',
                                  backgroundClip: 'text',
                                  WebkitBackgroundClip: 'text'
                                }}
                              >
                                {subReply.fanCard.numPrefix}
                              </span>
                              <span
                                className="text-4xl font-bold whitespace-nowrap"
                                style={{
                                  backgroundImage: subReply.fanCard.gradientStyle,
                                  WebkitTextFillColor: 'transparent',
                                  backgroundClip: 'text',
                                  WebkitBackgroundClip: 'text'
                                }}
                              >
                                {subReply.fanCard.numDesc}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 评论文本 */}
                    <div
                      className="text-[60px] tracking-[0.5px] leading-[1.6] text-foreground mb-5 select-text whitespace-pre-wrap"
                      style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                    >
                      {renderBilibiliCommentRichText(subReply.message)}
                    </div>

                    {/* 二级评论图片 */}
                    {subReply.pictures && subReply.pictures.length > 0 && (
                      <div className="flex gap-5 my-5 w-[95%]">
                        {subReply.pictures.length === 1 ? (
                          // 只有一张图片时，完整显示
                          <div className="overflow-hidden rounded-[25px] shadow-large w-full">
                            <ImageWithSkeleton
                              src={subReply.pictures[0]}
                              alt="评论图片"
                              className="rounded-[25px] object-contain w-full h-full"
                              placeholder="评论图片"
                            />
                          </div>
                        ) : (
                          // 多张图片时，显示两张正方形缩略图
                          subReply.pictures.slice(0, 2).map((picUrl, idx) => (
                            <div key={idx} className="relative overflow-hidden rounded-[25px] shadow-large flex-1 aspect-square">
                              <ImageWithSkeleton
                                src={picUrl}
                                alt={`评论图片${idx + 1}`}
                                className="rounded-[25px] object-cover w-full h-full"
                                placeholder="评论图片"
                              />
                              {/* 如果是第二张图且总数超过2张，显示+x标志 */}
                              {idx === 1 && subReply.pictures.length > 2 && (
                                <div className="absolute bottom-10 right-10">
                                  {/* 悬浮按钮背景 */}
                                  <div
                                    className="flex items-center justify-center px-8 py-6 rounded-[18px] shadow-xl"
                                    style={{
                                      backgroundColor: 'rgba(0, 0, 0, 0.7)'
                                    }}
                                  >
                                    {/* +x 文字 */}
                                    <span className="text-white text-[60px] font-bold leading-none">+{subReply.pictures.length - 2}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* 二级评论底部信息 */}
                    <div className="flex items-center justify-between mt-[37.5px] whitespace-nowrap text-muted">
                      <div className="flex flex-1 items-center">
                        <div className="text-[45px] tracking-[2px] select-text">
                          {formatBilibiliCommentTime(subReply.ctime)} · {subReply.location}
                        </div>
                      </div>

                      <div className="flex items-center gap-18.75 ml-auto">
                        <div className="flex items-center gap-3.75">
                          <ThumbUpIcon variant="line" className="w-15 h-15 text-muted" />
                          <span className="text-[45px] text-muted select-text">{formatBilibiliLikeCount(subReply.like)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export const BilibiliComment: React.FC<PosterProps<BilibiliCommentData>> = React.memo((props) => {
  return (
    <DefaultLayout ctx={props.ctx}>
      <div className="p-5">
        <div className="h-20"></div>
        {/* 视频信息头部 */}
        <VideoInfoHeader {...props.data} useDarkTheme={isDarkMode(props.ctx)} />

        {/* 评论列表 */}
        <div className="overflow-hidden mt-8">
          {props.data.CommentsData.length > 0 ? (
            props.data.CommentsData.map((comment, index) => (
              <CommentItemComponent key={index} isLast={index === props.data.CommentsData.length - 1} {...comment} />
            ))
          ) : (
            <div className="flex justify-center items-center py-20 text-muted">
              <div className="text-center">
                <p className="text-xl">暂无评论数据</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DefaultLayout>
  )
})

export default BilibiliComment
