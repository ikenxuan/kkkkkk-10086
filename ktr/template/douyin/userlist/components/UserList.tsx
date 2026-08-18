import { Clapperboard, Hash, Radio, UserPlus, UsersRound } from 'lucide-react'
import React from 'react'

import { DefaultLayout } from '../../../components/DefaultLayout'
import type { PosterProps } from '../../../types/ctx'
import { isDark as isDarkMode } from '../../../../utils/theme'
import { DouyinLikeIcon, DouyinRecommendIcon } from '../../components/Icons'
import type { DouyinUserListData } from './types'

const pushTypeConfig: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  post: { label: '作品更新', color: 'bg-accent/5 text-accent/80 border-accent/12', icon: Clapperboard },
  favorite: { label: '喜欢列表', color: 'bg-[#d94f50]/5 text-[#b04546] border-[#d94f50]/12', icon: DouyinLikeIcon },
  recommend: { label: '推荐列表', color: 'bg-[#c9943a]/5 text-[#a07d30] border-[#c9943a]/12', icon: DouyinRecommendIcon },
  live: { label: '直播状态', color: 'bg-[#3aa876]/5 text-[#2e8a5e] border-[#3aa876]/12', icon: Radio }
}

/**
 * 抖音用户项组件
 */
const DouyinUserItem: React.FC<DouyinUserListData['renderOpt'][number]> = (props) => {
  return (
    <li className="relative group overflow-hidden rounded-4xl bg-surface/60 border border-border/50 backdrop-blur-xl shadow-xl">
      {/* 渐进式模糊背景 - Progressive Blur Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src={props.avatar_img}
          alt=""
          className="w-full h-full object-cover opacity-20 blur-3xl scale-150 saturate-100 brightness-110"
          style={{
            maskImage: 'linear-gradient(135deg, black 0%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(135deg, black 0%, transparent 100%)'
          }}
        />
      </div>

      {/* SVG 噪点 (作为卡片内层叠加) */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.08] mix-blend-overlay">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <filter id="cardNoise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" result="gray" />
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues="0 1" />
              <feFuncG type="discrete" tableValues="0 1" />
              <feFuncB type="discrete" tableValues="0 1" />
            </feComponentTransfer>
          </filter>
          <rect width="100%" height="100%" filter="url(#cardNoise)" />
        </svg>
      </div>

      {/* 内容区域 */}
      <div className="relative z-10 p-6 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full p-1 bg-surface/20 backdrop-blur-md border border-border/30 shadow-lg shrink-0">
            <img src={props.avatar_img} alt="Avatar" className="w-full h-full rounded-full object-cover" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-3xl font-black tracking-tight text-foreground truncate drop-shadow-sm mb-1.5">{props.username}</h3>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface/50 border border-border/50 text-xs font-mono font-bold text-muted">
              <Hash size={12} className="opacity-70" />
              {props.short_id}
            </span>
          </div>

          <div
            className={`px-4 py-2 rounded-full border-2 border-background flex items-center gap-2 shadow-md shrink-0 ${
              props.switch ? 'bg-success text-white' : 'bg-danger text-danger-foreground'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${props.switch ? 'bg-white' : 'bg-border'}`} />
            <span className="text-xs font-bold uppercase tracking-wider leading-none">{props.switch ? 'ON' : 'OFF'}</span>
          </div>
        </div>

        <div className="flex gap-6">
          {/* 左侧 */}
          <div className="flex gap-2.5">
            {Object.entries(pushTypeConfig).map(([type, config]) => {
              const isActive = props.pushTypes?.includes(type)
              return (
                <div
                  key={type}
                  className={`px-2.5 py-3 rounded-xl border flex flex-col items-center gap-2.5 transition-colors duration-200 ${
                    isActive ? config.color : 'bg-surface/50 text-muted border-transparent dark:bg-surface/10'
                  }`}
                >
                  <config.icon size={20} className={isActive ? '' : 'opacity-50'} />
                  <span className="text-xs font-bold whitespace-nowrap tracking-wide" style={{ writingMode: 'vertical-rl' }}>
                    {config.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* 右侧 */}
          <div className="flex-1 flex flex-col gap-2">
            {[
              { icon: UsersRound, value: props.fans, label: '粉丝' },
              { icon: DouyinLikeIcon, value: props.total_favorited, label: '获赞' },
              { icon: UserPlus, value: props.following_count, label: '关注' }
            ].map((item, index) => {
              const StatIcon = item.icon
              return (
                <div
                  key={index}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg bg-surface-secondary/30 border border-border/30 backdrop-blur-sm"
                >
                  <StatIcon size={20} className="text-muted shrink-0" />
                  <div className="flex items-baseline gap-2 flex-1">
                    <span className="text-base font-bold font-mono text-foreground">{item.value}</span>
                    <span className="text-xs text-muted font-medium">{item.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </li>
  )
}

/**
 * 抖音用户列表组件
 */
const DouyinUserList: React.FC<PosterProps<DouyinUserListData>> = (props) => {
  const isDark = isDarkMode(props.ctx) !== false

  // 抖音配色：Danger红 (#ef4444) + 黑色 (#000000)
  const primaryColor = isDark ? '#ef4444' : '#dc2626' // Red-500/600
  const secondaryColor = isDark ? '#000000' : '#171717' // Black/Neutral-900

  return (
    <DefaultLayout
      ctx={props.ctx}
      className="relative overflow-hidden bg-background"
      style={{
        width: '1440px',
        minHeight: '600px'
      }}
    >
      {/* 1. 弥散光背景层 */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div
          className="absolute rounded-full w-350 h-350 -top-125 -left-100 blur-[150px] opacity-15 dark:opacity-10"
          style={{
            background: `radial-gradient(circle, ${primaryColor} 0%, transparent 70%)`
          }}
        />
        <div
          className="absolute rounded-full w-300 h-300 top-25 -right-100 blur-[140px] opacity-10 dark:opacity-20"
          style={{
            background: `radial-gradient(circle, ${secondaryColor} 0%, transparent 70%)`
          }}
        />
      </div>

      {/* 2. 全局噪点纹理 */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.08]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <filter id="globalNoise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" result="gray" />
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues="0 1" />
              <feFuncG type="discrete" tableValues="0 1" />
              <feFuncB type="discrete" tableValues="0 1" />
            </feComponentTransfer>
          </filter>
          <rect width="100%" height="100%" filter="url(#globalNoise)" />
        </svg>
      </div>

      {/* 3. 几何装饰 */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute left-16 top-0 bottom-0 w-px bg-linear-to-b from-transparent via-border to-transparent" />
        <div className="absolute top-0 right-0 p-16 opacity-10">
          <svg width="400" height="400" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-foreground">
            <rect x="100" y="100" width="200" height="200" stroke="currentColor" strokeWidth="1" />
            <path d="M200 0V400M0 200H400" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="200" cy="200" r="50" fill="currentColor" fillOpacity="0.1" />
          </svg>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="relative z-10 px-24 py-20 flex flex-col min-h-150">
        {/* 极简头部 */}
        <div className="flex justify-between items-end mb-16">
          <div>
            <div className="flex items-center gap-3 mb-4">
              {/* 群头像 */}
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg border border-border/30">
                <img src={props.data.groupInfo.groupAvatar} alt="Group Avatar" className="w-full h-full object-cover" />
              </div>
              <span className="font-mono text-sm font-bold tracking-widest uppercase opacity-50 text-foreground">Douyin Monitor</span>
            </div>
            <h1 className="text-7xl font-black text-foreground tracking-tighter mb-2">{props.data.groupInfo.groupName}</h1>
            <p className="font-mono text-xl opacity-40 text-foreground flex items-center gap-2">
              <span>GROUP_ID</span>
              <span className="w-12 h-px bg-current opacity-50" />
              <span>{props.data.groupInfo.groupId}</span>
            </p>
          </div>

          <div className="text-right">
            {/* 字体黑白灰渐变 */}
            <div className="text-8xl font-black text-transparent bg-clip-text bg-linear-to-b from-foreground to-muted leading-none">
              {String(props.data.renderOpt.length).padStart(2, '0')}
            </div>
            <div className="text-sm font-bold tracking-[0.3em] uppercase opacity-40 mt-2 text-foreground">Monitoring</div>
          </div>
        </div>

        {/* 用户列表网格 */}
        <ul className="grid grid-cols-2 gap-x-10 gap-y-10">
          {props.data.renderOpt.map((user, index) => (
            <DouyinUserItem key={`${user.short_id}-${index}`} {...user} />
          ))}
        </ul>
      </div>
    </DefaultLayout>
  )
}

export default DouyinUserList
