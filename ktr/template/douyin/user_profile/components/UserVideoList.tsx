import React from 'react'
import { AiFillPushpin, AiOutlineVideoCamera } from 'react-icons/ai'
import { BiImage } from 'react-icons/bi'
import { FaMusic, FaTiktok, FaUserGroup } from 'react-icons/fa6'
import { MdLightbulbOutline, MdLocationOn } from 'react-icons/md'
import { RiUserFollowLine, RiVerifiedBadgeFill } from 'react-icons/ri'

import { DefaultLayout } from '../../../components/DefaultLayout'
import type { PosterProps } from '../../../types/ctx'
import { DouyinCommentIcon, DouyinFavoriteIcon, DouyinLikeIcon, DouyinShareIcon } from '../../components/Icons'
import { formatDouyinPublishTime } from '../../video-work/components/publish-time'
import type { DouyinUserVideoListData } from './types'

/**
 * 格式化数字显示 (使用中文单位：万、亿)
 */
const formatCount = (count: number): string => {
  if (count >= 100000000) return (count / 100000000).toFixed(1) + '亿'
  if (count >= 10000) return (count / 10000).toFixed(1) + '万'
  return count.toString()
}

/**
 * 格式化视频时长显示 (如: 6:20)
 * @param milliseconds 毫秒数
 */
const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * 单个视频卡片组件
 */
const VideoCard: React.FC<{ video: DouyinUserVideoListData['videos'][number] }> = ({ video }) => {
  const titleRef = React.useRef<HTMLHeadingElement>(null)

  return (
    <div className="bg-surface rounded-3xl overflow-hidden flex flex-col h-full">
      {/* 视频封面 - 固定 3:4 比例 */}
      <div className="relative bg-foreground overflow-hidden" style={{ aspectRatio: '3 / 4' }}>
        <img src={video.cover} alt={video.title} className="w-full h-full object-cover" />

        {/* 左上角索引标签 */}
        {video.index && (
          <div className="absolute top-4 left-4 px-6 py-4 rounded-2xl text-4xl font-bold bg-black/40 text-white backdrop-blur-md shadow-lg border border-white/10 z-10">
            {video.index}
          </div>
        )}

        {/* 视频/图集标签 */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <div className="px-6 py-4 rounded-2xl text-4xl bg-surface/80 text-foreground backdrop-blur-xs shadow-lg flex items-center gap-2">
            {video.is_video ? <AiOutlineVideoCamera size={34} /> : <BiImage size={34} />}
            <span>{video.is_video ? '视频' : '图集'}</span>
          </div>
          {video.is_top && (
            <div className="px-6 py-4 rounded-2xl text-4xl bg-warning text-warning-foreground backdrop-blur-xs shadow-lg flex items-center gap-2">
              <AiFillPushpin size={34} />
              <span>置顶</span>
            </div>
          )}
        </div>

        {/* 时长标签（仅视频显示） */}
        {video.is_video && (
          <div className="absolute bottom-4 right-4 px-8 py-3 rounded-2xl text-4xl bg-surface/80 text-foreground backdrop-blur-xs shadow-lg">
            {formatDuration(video.duration)}
          </div>
        )}

        {/* 背景音乐图标 */}
        {video.music && (
          <div className="absolute bottom-4 left-4 flex items-center gap-2 px-6 py-3 rounded-2xl text-xl bg-surface/80 text-foreground backdrop-blur-xs shadow-lg">
            <FaMusic size={34} />
            <span className="max-w-80 truncate">{video.music.title}</span>
          </div>
        )}
      </div>

      {/* 视频信息 */}
      <div className="p-4 px-8 pb-8 flex flex-col flex-1">
        {/* 标题 */}
        <h3 ref={titleRef} className="text-4xl font-semibold text-foreground line-clamp-2 my-2">
          {video.title || '无标题'}
        </h3>

        {/* 发布时间 */}
        <p className="text-3xl text-foreground/70 mb-8">
          {formatDouyinPublishTime(video.create_time)}
        </p>

        {/* 统计数据 */}
        <div className="mt-auto">
          <div className="grid grid-cols-2 gap-3 text-3xl">
            <div className="flex items-center gap-2 text-foreground/70">
              <DouyinLikeIcon size={34} />
              <span>{formatCount(video.statistics.like_count)}</span>
            </div>
            <div className="flex items-center gap-2 text-foreground/70">
              <DouyinCommentIcon size={34} />
              <span>{formatCount(video.statistics.comment_count)}</span>
            </div>
            <div className="flex items-center gap-2 text-foreground/70">
              <DouyinFavoriteIcon size={34} />
              <span>{formatCount(video.statistics.collect_count)}</span>
            </div>
            <div className="flex items-center gap-2 text-foreground/70">
              <DouyinShareIcon size={34} />
              <span>{formatCount(video.statistics.share_count)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 抖音用户视频列表页面组件
 */
export const DouyinUserVideoList: React.FC<PosterProps<DouyinUserVideoListData>> = (prpos) => {
  return (
    <DefaultLayout ctx={prpos.ctx}>
      {/* 头部背景图片 - 占满宽度 */}
      {prpos.data.user.head_image && (
        <div className="relative w-full overflow-hidden">
          <img src={prpos.data.user.head_image} alt="头部背景" className="w-full h-auto object-cover" />
          {/* 渐变遮罩 - 从图片渐变到 bg-surface */}
          <div className="absolute inset-0 bg-linear-to-b from-transparent via-surface/40 to-surface" />
        </div>
      )}

      <div className="flex justify-center">
        <div className="px-20">
          {/* 用户信息头部 */}
          <div
            className={`bg-surface/60 backdrop-blur-xl mb-30 rounded-4xl p-10 relative ${prpos.data.user.head_image ? '-mt-170' : 'mt-35'}`}
          >
            {/* 上部分：头像、名称、抖音号、IP、用户统计 */}
            <div className="flex items-start gap-8 pb-8 border-b border-border mb-8">
              {/* 用户头像 */}
              <img src={prpos.data.user.avatar} alt={prpos.data.user.nickname} className="w-45 h-auto rounded-2xl object-cover shrink-0" />
              {/* 用户信息 */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <h1 className="text-6xl font-bold text-foreground">{prpos.data.user.nickname}</h1>
                  {prpos.data.user.verified && <RiVerifiedBadgeFill size={40} className="text-accent" />}
                </div>

                {/* 抖音号和 IP 属地 */}
                <div className="flex gap-6 mb-6 text-2xl text-muted">
                  <span className="flex items-center gap-2">
                    <FaTiktok size={24} /> 抖音号：{prpos.data.user.short_id}
                  </span>
                  {prpos.data.user.ip_location && (
                    <span className="flex items-center gap-1">
                      <MdLocationOn size={28} /> {prpos.data.user.ip_location}
                    </span>
                  )}
                </div>

                {/* 用户统计 */}
                <div className="flex gap-8 text-3xl">
                  <div className="flex items-center gap-2">
                    <RiUserFollowLine size={28} className="text-muted" />
                    <span className="text-muted">关注</span>
                    <span className="font-medium text-4xl text-foreground"> {formatCount(prpos.data.user.following_count)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaUserGroup size={28} className="text-muted" />
                    <span className="text-muted">粉丝</span>
                    <span className="font-medium text-4xl text-foreground"> {formatCount(prpos.data.user.follower_count)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DouyinLikeIcon size={28} />
                    <span className="text-muted">获赞</span>
                    <span className="font-medium text-4xl  text-foreground"> {formatCount(prpos.data.user.total_favorited)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 下部分：用户签名 */}
            <p className="text-3xl text-foreground/80 line-clamp-3">{prpos.data.user.signature || '这个用户很懒，还没有签名'}</p>
          </div>

          {/* 提示信息卡片 */}
          {prpos.data.timeoutSeconds && (
            <div className="bg-surface/60 backdrop-blur-xl mb-8 rounded-4xl p-6 border border-border/50 shadow-sm flex justify-center items-center">
              <p className="text-3xl text-foreground/80 font-medium flex items-center gap-3">
                <MdLightbulbOutline size={40} className="text-warning" />
                <span>
                  请在 {prpos.data.timeoutSeconds} 秒内发送 <span className="text-accent font-bold">1~{prpos.data.videos.length}</span>{' '}
                  之间的数字解析对应作品。例如发送“1”解析第一个作品
                </span>
              </p>
            </div>
          )}

          {/* 视频网格 */}
          {prpos.data.videos.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-6 mb-8">
                {prpos.data.videos.map((video) => (
                  <VideoCard key={video.aweme_id} video={video} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <p className="text-[32px] text-muted">暂无视频内容</p>
            </div>
          )}
        </div>
      </div>
    </DefaultLayout>
  )
}
