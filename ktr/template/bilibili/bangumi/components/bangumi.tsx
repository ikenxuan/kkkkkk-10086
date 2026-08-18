import { Chip } from '@heroui/react'
import { Calendar, Clock, Crown, Hash, Play, Share2, Shield, Star, Users } from 'lucide-react'
import React from 'react'

import { DefaultLayout } from '../../../components/DefaultLayout'
import type { PosterProps } from '../../../types/ctx'
import { cn } from '../../../../utils/cn'
import { EnhancedImage } from '../../components/shared'
import type { BangumiBilibiliHeaderProps } from '../../components/types'
import type { BangumiBilibiliData } from './types'

/**
 * 格式化数字显示
 * @param num 要格式化的数字
 * @returns 格式化后的字符串
 */
const formatNumber = (num: number): string => {
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(1)}亿`
  }
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`
  }
  return num.toString()
}

/**
 * 格式化日期部分
 * @param timestamp 时间戳
 * @returns 包含月份和日期的对象
 */
const formatDateParts = (timestamp: number): { month: string; day: string } => {
  const date = new Date(timestamp * 1000)
  const month = date.toLocaleDateString('zh-CN', { month: 'short' })
  const day = date.getDate().toString().padStart(2, '0')
  return { month, day }
}

/**
 * 格式化完整日期时间
 * @param timestamp 时间戳
 * @returns 格式化的日期时间字符串
 */
const formatDateTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * B站番剧头部组件
 * @param props 头部组件属性
 */
const BangumiBilibiliHeader: React.FC<BangumiBilibiliHeaderProps> = (props) => {
  // 处理演员数据
  const actorList = props.actors ? props.actors.split(/[,，、\s]+/).filter((actor) => actor.trim()) : []

  return (
    <div className="overflow-hidden relative rounded-6xl">
      <div className="flex relative z-10 gap-25 p-25">
        <div className="flex flex-col shrink-0 gap-20">
          {/* 封面 */}
          <div className="overflow-hidden rounded-4xl w-120 h-160">
            <EnhancedImage src={props.mainCover} alt={props.title} className="object-cover w-full h-full select-text" />
          </div>
          {/* UP主信息 */}
          {props.upInfo && (
            <div className="flex gap-12 items-center mt-15">
              <div className="relative">
                <EnhancedImage
                  className="w-28 h-28 rounded-full select-text"
                  src={`https://images.weserv.nl/?url=${encodeURIComponent(props.upInfo.avatar)}`}
                  alt={props.upInfo.uname}
                />
                {props.upInfo.avatar_subscript_url && (
                  <EnhancedImage
                    className="absolute -right-1 -bottom-1 w-8 h-8 select-text"
                    src={props.upInfo.avatar_subscript_url}
                    alt="头像角标"
                  />
                )}
                {/* 挂件 */}
                {props.upInfo.pendant?.image && (
                  <EnhancedImage
                    className="absolute inset-0 w-full h-full transform select-text scale-160"
                    src={props.upInfo.pendant.image}
                    alt={props.upInfo.pendant.name || '挂件'}
                  />
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex gap-3 items-center">
                  <div
                    className="text-4xl font-medium select-text"
                    style={{
                      color: props.upInfo.vip_status === 1 ? props.upInfo.nickname_color || '#FB7299' : '#EDEDED'
                    }}
                  >
                    {props.upInfo.uname}
                  </div>

                  {props.upInfo.verify_type > 0 && (
                    <div className="flex items-center">
                      {props.upInfo.verify_type === 1 ? (
                        <Shield width={20} className="text-warning" />
                      ) : (
                        <Crown width={20} className="text-accent" />
                      )}
                    </div>
                  )}

                  {props.upInfo.vip_status === 1 && props.upInfo.vip_label?.text && (
                    <Chip
                      size="sm"
                      className="px-2 py-1 text-xs select-text"
                      style={{
                        backgroundColor: props.upInfo.vip_label.bg_color || '#FB7299',
                        color: props.upInfo.vip_label.text_color || '#FFFFFF',
                        borderColor: props.upInfo.vip_label.border_color || 'transparent'
                      }}
                    >
                      {props.upInfo.vip_label.text}
                    </Chip>
                  )}
                </div>

                {/* 粉丝数和关注状态 */}
                <div className="flex gap-6 items-center text-3xl select-text text-foreground">
                  <Users size={30} />
                  <span>{formatNumber(props.upInfo.follower)}粉丝</span>

                  {/* 关注状态 */}
                  {props.upInfo.is_follow === 1 && (
                    <Chip size="sm" color="accent" variant="soft" className="text-xs select-text">
                      已关注
                    </Chip>
                  )}
                </div>

                <div className="flex gap-2 items-center text-2xl select-text text-foreground/70">
                  <Hash size={20} />
                  <span>UID: {props.upInfo.mid}</span>
                </div>
              </div>
            </div>
          )}
          {/** TIP */}
          <div className="flex text-3xl select-text text-foreground">
            <span>提示：请在120秒内发送</span>
            <span className="inline-flex items-center rounded-xl bg-danger/12 px-4 py-1.5 text-[0.95em] font-semibold text-danger">
              第 ？ 集
            </span>
            <span>选择集数</span>
          </div>
        </div>

        <div className="flex flex-col flex-1 justify-between text-foreground">
          <div>
            <div className="mb-8 text-8xl font-bold leading-tight select-text">{props.title}</div>
            {props.subtitle && <div className="mb-12 text-4xl select-text text-foreground">{props.subtitle}</div>}

            {/* 风格标签 */}
            {props.styles && props.styles.length > 0 && (
              <div className="flex flex-wrap gap-8 mb-12">
                {props.styles.map((style, index) => (
                  <Chip
                    key={index}
                    size="lg"
                    className="w-32 h-12 rounded-xl bg-surface-secondary px-4 py-2 text-3xl text-foreground backdrop-blur-sm select-text"
                  >
                    {style}
                  </Chip>
                ))}
              </div>
            )}

            {/* CV信息 */}
            {actorList.length > 0 && (
              <div className="mb-12">
                <div className="flex gap-6 items-center mb-6 text-3xl select-text text-foreground">
                  <Users size={30} />
                  <span>声优阵容</span>
                </div>
                <div className="flex flex-wrap gap-8">
                  {actorList.slice(0, 6).map((actor, index) => (
                    <div key={index} className="text-3xl select-text text-foreground">
                      {actor}
                    </div>
                  ))}
                  {actorList.length > 6 && <div className="text-3xl select-text text-foreground">等{actorList.length}人</div>}
                </div>
              </div>
            )}

            {/* 评价信息 */}
            {props.evaluate && (
              <div className="mb-12">
                <div className="flex gap-6 items-center mb-6 text-3xl select-text text-foreground">
                  <Star size={30} />
                  <span>评价</span>
                </div>
                <div className="text-3xl leading-relaxed select-text text-foreground">{props.evaluate}</div>
              </div>
            )}
          </div>

          {/* 统计信息 */}
          <div className="grid grid-cols-4 gap-16">
            <div className="items-center min-w-0">
              <div className="flex items-baseline">
                <span className="text-4xl font-bold select-text text-foreground">{formatNumber(props.stat.views).slice(0, -1)}</span>
                <span className="text-xl font-bold select-text text-foreground">{formatNumber(props.stat.views).slice(-1)}</span>
              </div>
              <span className="text-2xl whitespace-nowrap select-text">播放</span>
            </div>

            <div className="items-center min-w-0">
              <div className="flex items-baseline">
                <span className="text-4xl font-bold select-text text-foreground">{formatNumber(props.stat.favorites).slice(0, -1)}</span>
                <span className="text-xl font-bold select-text text-foreground">{formatNumber(props.stat.favorites).slice(-1)}</span>
              </div>
              <span className="text-2xl whitespace-nowrap select-text">收藏</span>
            </div>

            <div className="items-center min-w-0">
              <div className="flex items-baseline">
                <span className="text-4xl font-bold select-text text-foreground">{formatNumber(props.stat.danmakus).slice(0, -1)}</span>
                <span className="text-xl font-bold select-text text-foreground">{formatNumber(props.stat.danmakus).slice(-1)}</span>
              </div>
              <span className="text-2xl whitespace-nowrap select-text">弹幕</span>
            </div>

            <div className="items-center min-w-0">
              <div className="flex items-baseline">
                <span className="text-4xl font-bold select-text text-foreground">{formatNumber(props.stat.coins).slice(0, -1)}</span>
                <span className="text-xl font-bold select-text text-foreground">{formatNumber(props.stat.coins).slice(-1)}</span>
              </div>
              <span className="text-2xl whitespace-nowrap select-text">投币</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * B站番剧剧集列表组件
 * @param props 剧集列表组件属性
 */
const BangumiBilibiliEpisodes: React.FC<BangumiBilibiliData> = (props) => {
  // 按发布时间倒序排序
  const sortedEpisodes = [...props.Episodes].sort((a, b) => b.pub_time - a.pub_time)

  // 按日期分组剧集
  const groupedEpisodes = sortedEpisodes.reduce(
    (groups, episode) => {
      const date = new Date(episode.pub_time * 1000)
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(episode)
      return groups
    },
    {} as Record<string, typeof sortedEpisodes>
  )

  const dateKeys = Object.keys(groupedEpisodes).sort((a, b) => b.localeCompare(a))

  const flattenedEpisodes: Array<{
    episode: (typeof sortedEpisodes)[0]
    isFirstOfDate: boolean
    isLastOfDate: boolean
    isLastOfAll: boolean
    dateKey: string
    episodesInSameDate: number
  }> = []

  dateKeys.forEach((dateIndex) => {
    const episodesInDate = groupedEpisodes[dateIndex]
    episodesInDate.forEach((episode, episodeIndex) => {
      flattenedEpisodes.push({
        episode,
        isFirstOfDate: episodeIndex === 0,
        isLastOfDate: episodeIndex === episodesInDate.length - 1,
        isLastOfAll: false,
        dateKey: dateIndex,
        episodesInSameDate: episodesInDate.length
      })
    })
  })

  if (flattenedEpisodes.length > 0) {
    flattenedEpisodes[flattenedEpisodes.length - 1].isLastOfAll = true
  }

  return (
    <div className="px-10">
      {/* 剧集标题 */}
      <div className="flex gap-8 items-center mb-20 text-5xl font-bold select-text text-foreground">
        <Play size={46} />
        <span>剧集列表</span>
        <Chip size="lg" color="danger" variant="soft" className="h-18 px-4 py-2 text-4xl select-text">
          共{sortedEpisodes.length}集
        </Chip>
      </div>

      {/* 时间线剧集列表 */}
      <div>
        {flattenedEpisodes.map((item) => {
          const { episode, isFirstOfDate, isLastOfAll, episodesInSameDate, isLastOfDate } = item
          const { month, day } = formatDateParts(episode.pub_time)
          const episodeNumber = sortedEpisodes.findIndex((e) => e.bvid === episode.bvid)
          const actualEpisodeNumber = sortedEpisodes.length - episodeNumber

          return (
            <div key={episode.bvid} className="flex gap-15">
              <div className="flex flex-col shrink-0 items-center w-20">
                {isFirstOfDate ? (
                  // 日期节点
                  <>
                    <div className="text-4xl select-text text-foreground">{month}</div>
                    <div className="flex justify-center items-center text-7xl font-bold select-text text-foreground">{day}</div>
                    {!isLastOfAll && <div className={cn('mt-8 w-1 bg-divider', episodesInSameDate > 1 ? 'h-110' : 'h-95')} />}
                  </>
                ) : (
                  // 普通节点
                  <>
                    <div className="w-1 h-10 bg-divider" />
                    <div className="my-2 w-4 h-4 rounded-full bg-divider" />
                    {(!isLastOfAll || episodesInSameDate > 1) && <div className={cn('w-1 bg-divider', isLastOfDate ? 'h-110' : 'h-130')} />}
                  </>
                )}
              </div>

              {/* 剧集内容 */}
              <div className={cn('flex-1 min-w-0', !isLastOfAll && isLastOfDate && 'mb-20')}>
                {/* UP主信息和第x集 */}
                <div className="flex justify-between items-center mb-10">
                  {/* UP主信息 */}
                  <div className="flex shrink-0 gap-8 items-center">
                    <div className="relative">
                      <EnhancedImage
                        className="w-32 h-32 rounded-full select-text"
                        src={`https://images.weserv.nl/?url=${encodeURIComponent(props.UPInfo ? props.UPInfo.avatar : props.mainCover)}`}
                        alt={''}
                      />
                    </div>
                    <div className="flex flex-col gap-6">
                      <div className="text-4xl font-bold select-text text-foreground/80">
                        {props.UPInfo ? props.UPInfo.uname : props.Title}
                      </div>
                      <div className="flex gap-4 items-center text-3xl select-text text-foreground/70">
                        <Calendar size={30} />
                        <span>发布了内容</span>
                      </div>
                    </div>
                  </div>

                  {/* 第x集标题 */}
                  <div className="shrink-0 pr-20">
                    <div className="text-5xl font-semibold select-text text-foreground/70">第{actualEpisodeNumber}集</div>
                  </div>
                </div>
                {/* 剧集卡片 */}
                <div className="overflow-hidden shadow-large bg-surface rounded-4xl">
                  <div className="flex gap-12 p-12">
                    {/* 剧集封面 */}
                    <div className="relative shrink-0">
                      <div className="overflow-hidden relative h-64 rounded-3xl w-md">
                        <EnhancedImage
                          src={episode.cover}
                          alt={`第${actualEpisodeNumber}集 ${episode.long_title}`}
                          className="object-cover w-full h-full select-text"
                        />
                        {episode.badge && (
                          <Chip
                            size="lg"
                            className="absolute top-6 right-8 rounded-2xl py-1 text-lg font-medium select-text scale-150"
                            style={{
                              backgroundColor: episode.badge_info?.bg_color || '#FB7299',
                              color: '#FFFFFF'
                            }}
                          >
                            {episode.badge_info?.text || episode.badge}
                          </Chip>
                        )}
                      </div>
                    </div>

                    {/* 剧集信息 */}
                    <div className="flex flex-col flex-1 justify-center h-64">
                      <div className="mb-8 text-5xl font-semibold select-text text-foreground line-clamp-2">{episode.long_title}</div>

                      <div className="space-y-4 text-4xl">
                        <div className="flex gap-6 items-center select-text text-foreground/70">
                          <Hash size={36} />
                          <span className="truncate">{episode.bvid}</span>
                        </div>

                        <div className="flex gap-6 items-center select-text text-foreground/70">
                          <Clock size={36} />
                          <span className="whitespace-nowrap">{formatDateTime(episode.pub_time)}</span>
                        </div>

                        <div className="flex gap-6 items-center select-text text-foreground/70">
                          <Share2 size={36} />
                          <span className="truncate">{episode.link}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const BangumiBilibili: React.FC<PosterProps<BangumiBilibiliData>> = React.memo((props) => {
  return (
    <DefaultLayout ctx={props.ctx}>
      <div className="p-4">
        {/* 头部区域 */}
        <BangumiBilibiliHeader
          title={props.data.Title}
          mainCover={props.data.mainCover}
          evaluate={props.data.Evaluate}
          actors={props.data.Actors}
          styles={props.data.Styles}
          subtitle={props.data.subtitle}
          upInfo={props.data.UPInfo}
          stat={props.data.Stat}
          copyright={props.data.Copyright}
          seasonID={props.data.seasonID}
        />

        {/* 剧集列表区域 */}
        <BangumiBilibiliEpisodes {...props.data} />
      </div>
    </DefaultLayout>
  )
})

BangumiBilibili.displayName = 'BangumiBilibili'

export default BangumiBilibili
