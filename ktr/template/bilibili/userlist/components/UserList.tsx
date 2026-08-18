import { FileText, Hash, Heart, Image as LucideImage, Radio, Share2, UserPlus, UsersRound, Video } from 'lucide-react'
import React from 'react'

import { DefaultLayout } from '../../../components/DefaultLayout'
import type { PosterProps } from '../../../types/ctx'
import { isDark as isDarkMode } from '../../../../utils/theme'
import { EnhancedImage } from '../../components/shared'
import type { BilibiliUserListData } from './types'

type BilibiliPushType = NonNullable<BilibiliUserListData['renderOpt'][number]['pushTypes']>[number]

const pushTypeConfig: Record<BilibiliPushType, { label: string; color: string; icon: React.ComponentType<any> }> = {
  video: { label: '投稿视频', color: 'bg-accent/6 text-accent/80 border-accent-soft', icon: Video },
  draw: { label: '图文动态', color: 'bg-[#23ade5]/5 text-[#1a8fb8] border-[#23ade5]/12', icon: LucideImage },
  word: { label: '纯文动态', color: 'bg-warning/5 text-warning/80 border-warning/12', icon: FileText },
  live: { label: '直播动态', color: 'bg-success/5 text-success/80 border-success/12', icon: Radio },
  forward: { label: '转发动态', color: 'bg-[#f97316]/5 text-[#cc6b1f] border-[#f97316]/12', icon: Share2 },
  article: { label: '投稿专栏', color: 'bg-[#7c3aed]/5 text-[#6b4fa8] border-[#7c3aed]/12', icon: FileText }
}

/**
 * B站用户项组件 - 工业风卡片设计 (V5: 语义化主题色重构)
 */
const BilibiliUserItem: React.FC<BilibiliUserListData['renderOpt'][number]> = (props) => {
  const activePushTypes = new Set<BilibiliPushType>(props.pushTypes ?? (Object.keys(pushTypeConfig) as BilibiliPushType[]))

  return (
    <li className="relative group overflow-hidden rounded-4xl bg-surface/60 border border-border/50 backdrop-blur-xl shadow-xl">
      {/* 渐进式模糊背景 - Progressive Blur Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <EnhancedImage
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
      <div className="relative z-10 p-5 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {/* 左侧：头像与状态 */}
          <div className="relative shrink-0">
            {/* 头像容器 - 纯净玻璃态 */}
            <div className="w-20 h-20 rounded-full p-1 bg-surface/20 backdrop-blur-md border border-border/30 shadow-lg">
              <EnhancedImage src={props.avatar_img} alt="Avatar" className="w-full h-full rounded-full object-cover" />
            </div>

            {/* 状态徽章 - 扁平化/微立体 */}
            <div
              className={`absolute -bottom-1 -right-1 px-2.5 py-1 rounded-full border-2 border-background flex items-center gap-1.5 shadow-md ${
                props.switch ? 'bg-success text-white' : 'bg-danger text-danger-foreground'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${props.switch ? 'bg-white' : 'bg-border'}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider leading-none">{props.switch ? 'ON' : 'OFF'}</span>
            </div>
          </div>

          {/* 右侧：信息主体 */}
          <div className="flex-1 min-w-0">
            {/* 名字 */}
            <div>
              <h3 className="text-[1.75rem] font-black tracking-tight text-foreground truncate drop-shadow-sm leading-none">
                {props.username}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-md bg-surface border border-border text-xs font-mono font-bold text-muted flex items-center gap-1">
                  <Hash size={12} className="opacity-70" />
                  {props.host_mid}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)] gap-3 items-stretch min-h-39">
          <div className="grid grid-cols-3 gap-2 auto-rows-fr h-full">
            {(Object.entries(pushTypeConfig) as [BilibiliPushType, (typeof pushTypeConfig)[BilibiliPushType]][]).map(([type, config]) => {
              const isActive = activePushTypes.has(type)

              return (
                <div
                  key={type}
                  className={`h-full min-h-18.5 px-2.5 py-2.5 rounded-xl border backdrop-blur-sm flex flex-col justify-between transition-colors duration-200 ${
                    isActive ? config.color : 'bg-surface/45 text-muted border-border/15'
                  }`}
                >
                  <config.icon size={18} className={isActive ? '' : 'opacity-40'} />
                  <span className="text-[13px] font-bold tracking-wide leading-tight">{config.label}</span>
                </div>
              )
            })}
          </div>

          <div className="grid grid-rows-3 gap-2 h-full">
            {[
              { icon: UsersRound, value: props.fans, label: '粉丝' },
              { icon: Heart, value: props.total_favorited, label: '获赞' },
              { icon: UserPlus, value: props.following_count, label: '关注' }
            ].map((item, index) => {
              const StatIcon = item.icon
              return (
                <div
                  key={index}
                  className="h-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-surface-secondary/35 border border-border/35 backdrop-blur-sm"
                >
                  <StatIcon size={18} className="text-muted shrink-0" />
                  <div className="flex items-baseline gap-2 flex-1 min-w-0">
                    <span className="text-[15px] font-bold font-mono text-foreground truncate">{item.value}</span>
                    <span className="text-xs text-muted font-medium shrink-0">{item.label}</span>
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
 * B站用户列表组件
 */
const BilibiliUserList: React.FC<PosterProps<BilibiliUserListData>> = (props) => {
  const isDark = isDarkMode(props.ctx) !== false

  // 极简配色：主色(B站蓝) + 邻色(浅蓝/紫)
  const primaryColor = isDark ? '#23ade5' : '#00a1d6'
  const secondaryColor = isDark ? '#4f46e5' : '#60a5fa' // Indigo/Blue

  return (
    <DefaultLayout
      ctx={props.ctx}
      className="relative overflow-hidden bg-background"
      style={{
        width: '1440px',
        minHeight: '600px'
      }}
    >
      {/* 1. 弥散光背景层 - 极简单色系 */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div
          className="absolute rounded-full w-350 h-350 -top-125 -left-100 blur-[150px] opacity-20 dark:opacity-10"
          style={{
            background: `radial-gradient(circle, ${primaryColor} 0%, transparent 70%)`
          }}
        />
        <div
          className="absolute rounded-full w-300 h-300 top-25 -right-100 blur-[140px] opacity-15 dark:opacity-10"
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
            <circle cx="200" cy="200" r="199.5" stroke="currentColor" />
            <circle cx="200" cy="200" r="149.5" stroke="currentColor" strokeDasharray="10 10" />
            <circle cx="200" cy="200" r="99.5" stroke="currentColor" />
            <path d="M200 0V400M0 200H400" stroke="currentColor" strokeWidth="0.5" />
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
                <EnhancedImage src={props.data.groupInfo.groupAvatar} alt="Group Avatar" className="w-full h-full object-cover" />
              </div>
              <span className="font-mono text-sm font-bold tracking-widest uppercase opacity-50 text-foreground">Subscriber List</span>
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
            <div className="text-sm font-bold tracking-[0.3em] uppercase opacity-40 mt-2 text-foreground">Total Users</div>
          </div>
        </div>

        {/* 用户列表网格 - 调整为两列大卡片 */}
        <ul className="grid grid-cols-2 gap-x-10 gap-y-10">
          {props.data.renderOpt.map((user, index) => (
            <BilibiliUserItem key={`${user.host_mid}-${index}`} {...user} />
          ))}
        </ul>
      </div>
    </DefaultLayout>
  )
}

export default BilibiliUserList
