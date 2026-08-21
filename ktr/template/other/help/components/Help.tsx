import React from 'react'

import { DefaultLayout } from '../../../components/DefaultLayout'
import { resolveIcon } from '../../../components/iconRegistry'
import type { PosterProps } from '../../../types/ctx'
import { isDark as isDarkMode } from '../../../../utils/theme'
import type { MenuGroup, MenuItem } from './types'
import type { HelpData } from './types'

/**
 * 获取图标组件，兜底为默认图标
 * @param icon - 图标：可以是字符串或带颜色的对象
 * @returns React 图标组件类型
 */
const getIconForItem = (icon?: MenuItem['icon']): React.ComponentType<any> => {
  if (!icon) return resolveIcon('ph:question-fill')
  const name = typeof icon === 'string' ? icon : icon.name
  return resolveIcon(name)
}

/**
 * 菜单项组件
 * 展示单个功能的图标、标题和描述
 */
const MenuItemComponent: React.FC<{
  /** 菜单项数据 */
  item: MenuItem
  /** 主题色 */
  themeColor: string
}> = ({ item, themeColor }) => {
  const IconComponent = getIconForItem(item.icon)
  const iconColor = typeof item.icon === 'object' && item.icon?.color ? item.icon.color : themeColor

  return (
    <div className="flex flex-row gap-8 py-2 relative">
      <div className="pt-2 shrink-0 relative">
        <IconComponent className="w-16 h-16 relative z-10 text-foreground" style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="mb-3 text-4xl font-black leading-tight tracking-wide text-foreground">{item.title}</h3>
        <p className="text-2xl font-medium leading-relaxed whitespace-pre-line text-muted">{item.description}</p>
      </div>
    </div>
  )
}

/**
 * 菜单分组组件
 */
const MenuGroupComponent: React.FC<{
  /** 分组数据 */
  group: MenuGroup
  /** 主题色 */
  themeColor: string
}> = ({ group, themeColor }) => {
  return (
    <div className="relative py-8">
      {/* 分组标题 */}
      <div className="flex items-center gap-6 mb-16">
        <div className="w-3 h-16 rounded-full" style={{ backgroundColor: themeColor }} />
        <h2 className="m-0 text-[4rem] font-black tracking-tight uppercase leading-none text-foreground">{group.title}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-24 gap-y-16">
        {group.items.map((item, idx) => (
          <MenuItemComponent key={idx} item={item} themeColor={themeColor} />
        ))}
      </div>

      {group.subGroups?.map((sub, i) => (
        <div key={i} className="mt-20 relative">
          <h3 className="m-0 mb-10 text-3xl font-bold tracking-wide uppercase opacity-60 flex items-center gap-4 text-foreground">
            <div className="w-2 h-2 rounded-full bg-current" />
            {sub.title}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-24 gap-y-16">
            {sub.items.map((item, idx) => (
              <MenuItemComponent key={idx} item={item} themeColor={themeColor} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * 帮助页面组件
 */
export const Help: React.FC<PosterProps<HelpData>> = React.memo((props) => {
  const title = props.data?.title || 'KKK PLUGIN'
  const menuData = props.data?.menu || []
  const isDark = isDarkMode(props.ctx)

  // 弥散光颜色配置
  const glowColors = isDark
    ? {
        primary: 'rgba(59, 130, 246, 0.4)', // Blue
        secondary: 'rgba(139, 92, 246, 0.3)', // Violet
        accent: 'rgba(6, 182, 212, 0.25)' // Cyan
      }
    : {
        primary: 'rgba(56, 189, 248, 0.5)', // Sky
        secondary: 'rgba(167, 139, 250, 0.4)', // Violet
        accent: 'rgba(45, 212, 191, 0.3)' // Teal
      }

  // 内容主题色轮换
  const contentColors = isDark
    ? ['#60a5fa', '#a78bfa', '#2dd4bf'] // Blue-400, Violet-400, Teal-400
    : ['#2563eb', '#7c3aed', '#0d9488'] // Blue-600, Violet-600, Teal-600

  return (
    <DefaultLayout ctx={props.ctx}>
      {/* 1. 弥散光背景层 */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div
          className="absolute rounded-full w-315 h-360 -top-67.5 -left-45 blur-[128px] -rotate-20"
          style={{
            background: `radial-gradient(ellipse at 40% 40%, ${glowColors.primary} 0%, transparent 70%)`
          }}
        />
        <div
          className="absolute rounded-full w-225 h-270 top-112.5 -right-22.5 blur-[108px] rotate-15"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, ${glowColors.secondary} 0%, transparent 70%)`
          }}
        />
        <div
          className="absolute rounded-full w-270 h-225 -bottom-45 left-45 blur-[128px] -rotate-10"
          style={{
            background: `radial-gradient(ellipse at 50% 60%, ${glowColors.accent} 0%, transparent 70%)`
          }}
        />
      </div>

      {/* 2. 杂色纹理层 */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.08] dark:opacity-[0.12]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <filter id="pixelNoise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" result="gray" />
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues="0 1" />
              <feFuncG type="discrete" tableValues="0 1" />
              <feFuncB type="discrete" tableValues="0 1" />
            </feComponentTransfer>
          </filter>
          <rect width="100%" height="100%" filter="url(#pixelNoise)" />
        </svg>
      </div>

      {/* 3. 背景大字装饰 */}
      <div className="absolute top-30 right-15 pointer-events-none select-none opacity-[0.03] z-0">
        <span
          className="text-[200px] font-black tracking-tighter leading-none block text-right text-foreground"
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed'
          }}
        >
          GUIDE
        </span>
      </div>

      {/* 4. 四周装饰性图形点缀 */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* 左上角：矩阵点阵 */}
        <div className="absolute top-12 left-12 grid grid-cols-4 gap-2 opacity-20">
          {[...Array(16)].map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-foreground" />
          ))}
        </div>

        {/* 右上角 */}
        <div className="absolute top-12 right-12 flex flex-col items-end gap-1 opacity-20">
          <div className="w-32 h-1 bg-foreground" />
          <div className="w-24 h-1 bg-foreground" />
          <div className="w-16 h-1 bg-foreground" />
          <div className="text-xs font-mono mt-1 text-foreground">SYS.32.91</div>
        </div>

        {/* 左侧边缘 */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 w-8 h-64 flex flex-col justify-between opacity-10">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="w-full bg-foreground"
              style={{ height: Math.random() > 0.5 ? '4px' : '2px', width: Math.random() * 100 + '%' }}
            />
          ))}
        </div>

        {/* 右侧边缘 */}
        <div className="absolute top-1/3 right-0 w-0 h-0 border-t-20 border-t-transparent border-r-30 border-r-foreground border-b-20 border-b-transparent opacity-10" />

        {/* 底部装饰 */}
        <div className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none">
          {/* 左下角装饰条纹 */}
          <div
            className="absolute bottom-0 left-0 w-130 h-100 opacity-[0.04]"
            style={{
              background: `repeating-linear-gradient(45deg, ${isDark ? '#fff' : '#000'}, ${isDark ? '#fff' : '#000'} 5px, transparent 2px, transparent 10px)`
            }}
          />
          {/* 右下角大圆环 */}
          <div className="absolute -bottom-120 -right-90 w-300 h-300 rounded-full border-200 border-foreground opacity-[0.04]" />
        </div>
      </div>

      {/* 5. 主要内容区域 */}
      <div className="relative z-10 p-18 flex flex-col min-h-100">
        {/* 头部区域 */}
        <div className="flex justify-between items-end mb-24 border-b-4 border-foreground/10 pb-8">
          <div className="flex flex-col gap-2">
            {/*
              pl-8 是为了避开左上角那组装饰点阵：点阵在 top-12 left-12（x 48..96），
              而内容区 p-18 让这一行从 x=72 起，实测 x 方向重叠 24px、y 方向重叠 20px。
              往右挪 32px 之后这一行从 x=104 开始，和点阵右边缘留 8px 空隙。
              只挪这一行，下面的 COMMANDS 仍然对齐内容区左边界。
            */}
            <div className="flex items-center gap-3 pl-8 opacity-60">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm font-mono tracking-widest text-muted">SYSTEM_READY</span>
            </div>
            <h1 className="text-[5rem] font-black leading-none tracking-tighter text-foreground">COMMANDS</h1>
          </div>

          <div className="text-right pb-2 opacity-80">
            <div className="text-xs font-bold tracking-[0.2em] uppercase text-muted mb-1">CURRENT MODULE</div>
            <div className="text-2xl font-bold text-foreground">{title}</div>
          </div>
        </div>

        {/* 菜单列表区域 */}
        <div className="space-y-28 flex-1 pb-48">
          {menuData.map((group, index) => {
            // 轮换颜色
            const themeColor = contentColors[index % contentColors.length]

            return <MenuGroupComponent key={index} group={group} themeColor={themeColor} />
          })}
        </div>
      </div>
    </DefaultLayout>
  )
})

Help.displayName = 'Help'

export default Help
