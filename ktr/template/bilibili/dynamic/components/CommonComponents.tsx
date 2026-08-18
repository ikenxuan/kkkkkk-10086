import { ClockIcon, UsersIcon } from '@phosphor-icons/react'
import { Link } from 'lucide-react'
import React from 'react'

import { QRCodeWithAvatar } from '../../../components/QRCodeWithAvatar'
import { CommentIcon, ShareIcon, ThumbUpIcon, ViewIcon } from '../../components/Icons'
import { DecorationCard, EnhancedImage, UsernameDisplay } from '../../components/shared'
import type { BilibiliDynamicBaseData, BilibiliDynamicFooterProps } from '../types'

/**
 * B站动态用户信息组件
 */
export const BilibiliDynamicUserInfo: React.FC<BilibiliDynamicBaseData> = (props) => {
  return (
    <div className="flex gap-10 items-center justify-between px-0 pb-0 pl-24 pr-10">
      <div className="flex gap-10 items-center">
        <div className="relative">
          <EnhancedImage src={props.avatar_url} alt="头像" className="w-32 h-32 rounded-full shadow-medium" isCircular />
          {props.frame && <EnhancedImage src={props.frame} alt="头像框" className="absolute inset-0 transform scale-180" />}
        </div>
        <div className="flex flex-col gap-8 text-7xl">
          <div className="text-6xl font-bold select-text text-foreground">
            <UsernameDisplay metadata={props.usernameMeta} />
          </div>
          <div className="flex gap-2 items-center text-4xl font-normal whitespace-nowrap text-muted">
            <ClockIcon size={40} weight="fill" />
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
 * B站动态状态组件
 */
export const BilibiliDynamicStatus: React.FC<BilibiliDynamicBaseData> = (props) => {
  return (
    <div className="flex flex-col gap-10 px-18 w-full leading-relaxed">
      <div className="flex gap-6 items-center text-5xl font-light tracking-normal select-text text-foreground/70">
        <div className="flex gap-2 items-center">
          <ThumbUpIcon size={50} className="mt-2" />
          {props.dianzan}点赞
        </div>
        <span>·</span>
        <div className="flex gap-2 items-center">
          <CommentIcon size={48} />
          {props.pinglun}评论
        </div>
        <span>·</span>
        <div className="flex gap-2 items-center">
          <ShareIcon size={48} />
          {props.share}分享
        </div>
      </div>
      <div className="flex gap-2 items-center text-5xl font-light tracking-normal select-text text-foreground/70">
        <ClockIcon size={52} weight="fill" />
        图片生成于: {props.render_time}
      </div>
      <div className="flex gap-2 items-center text-5xl font-light tracking-normal select-text text-[#006A9E] dark:text-[#58B0D5]">
        <Link size={46} />
        <span>https://t.bilibili.com/{props.dynamic_id}</span>
      </div>
    </div>
  )
}

/**
 * B站动态底部信息组件
 */
export const BilibiliDynamicFooter: React.FC<BilibiliDynamicFooterProps> = (props) => {
  return (
    <div className="flex justify-between items-start px-20 pb-20">
      {/* 左侧：用户信息 */}
      <div className="flex flex-col gap-12">
        {/* 头像和用户名/UID */}
        <div className="flex gap-12 items-start">
          {/* 头像 */}
          <div className="relative shrink-0">
            <EnhancedImage src={props.avatar_url} alt="头像" className="rounded-full shadow-medium w-35 h-auto" isCircular />
            {props.frame && <EnhancedImage src={props.frame} alt="头像框" className="absolute inset-0 transform scale-180" />}
          </div>

          {/* 用户名和UID - 纵向排列 */}
          <div className="flex flex-col gap-5">
            <div className="text-7xl font-bold select-text">
              <UsernameDisplay metadata={props.usernameMeta} />
            </div>
            <div className="flex gap-2 items-center text-4xl text-muted">
              <span className="text-muted select-text">UID: {props.user_shortid}</span>
            </div>
          </div>
        </div>

        {/* 用户统计信息 */}
        <div className="text-3xl flex gap-6 items-center text-foreground/70">
          <div className="flex flex-col gap-1 items-start px-6 py-3 rounded-2xl bg-surface">
            <div className="flex gap-1 items-center">
              <ThumbUpIcon size={36} />
              <span className="text-muted">获赞</span>
            </div>
            <div className="w-full h-px bg-border" />
            <span className="select-text font-medium text-4xl">{props.total_favorited}</span>
          </div>
          <div className="flex flex-col gap-1 items-start px-6 py-3 rounded-2xl bg-surface">
            <div className="flex gap-1 items-center">
              <ViewIcon size={36} />
              <span className="text-muted">关注</span>
            </div>
            <div className="w-full h-px bg-border" />
            <span className="select-text font-medium text-4xl">{props.following_count}</span>
          </div>
          <div className="flex flex-col gap-1 items-start px-6 py-3 rounded-2xl bg-surface">
            <div className="flex gap-1 items-center">
              <UsersIcon size={36} weight="fill" />
              <span className="text-muted">粉丝</span>
            </div>
            <div className="w-full h-px bg-border" />
            <span className="select-text font-medium text-4xl">{props.fans}</span>
          </div>
        </div>
      </div>

      {/* 右侧：二维码 */}
      <div className="flex flex-col items-center gap-4">
        <QRCodeWithAvatar
          value={props.share_url}
          avatarUrl={props.avatar_url}
          useDarkTheme={props.useDarkTheme}
          alt="二维码"
          className="h-auto w-75 rounded-2xl"
        />
      </div>
    </div>
  )
}
