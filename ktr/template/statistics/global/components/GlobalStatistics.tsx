import React from 'react'
import { RiTrophyFill } from 'react-icons/ri'
import { VictoryAxis, VictoryChart, VictoryLabel, VictoryLine, VictoryPie, VictoryScatter, VictoryTheme } from 'victory'

import { DefaultLayout } from '../../../components/DefaultLayout'
import type { PosterProps } from '../../../types/ctx'
import { isDark as isDarkMode } from '../../../../utils/theme'
import type { GlobalStatisticsData } from './types'

/**
 * 全局解析统计组件 Global Statistics
 */
export const GlobalStatistics: React.FC<PosterProps<GlobalStatisticsData>> = (props) => {
  const useDarkTheme = isDarkMode(props.ctx)

  const platformConfig = {
    douyin: {
      name: '抖音',
      nameEn: 'Douyin',
      logo: useDarkTheme ? '/image/douyin/dylogo-light.svg' : '/image/douyin/dylogo-dark.svg',
      color: useDarkTheme ? '#ffffff' : '#111111'
    },
    bilibili: {
      name: '哔哩哔哩',
      nameEn: 'Bilibili',
      logo: '/image/bilibili/bilibili-light.png',
      color: '#fb7299'
    },
    kuaishou: {
      name: '快手',
      nameEn: 'Kuaishou',
      logo: '/image/kuaishou/logo.png',
      color: '#ff4906'
    },
    xiaohongshu: {
      name: '小红书',
      nameEn: 'XiaoHongShu',
      logo: '/image/xiaohongshu/logo.png',
      color: '#ff2442'
    }
  }

  // 弥散光颜色配置
  const glowColors = useDarkTheme
    ? {
        primary: 'rgba(236, 72, 153, 0.4)',
        secondary: 'rgba(139, 92, 246, 0.3)',
        accent: 'rgba(59, 130, 246, 0.25)'
      }
    : {
        primary: 'rgba(244, 114, 182, 0.5)',
        secondary: 'rgba(167, 139, 250, 0.4)',
        accent: 'rgba(96, 165, 250, 0.3)'
      }

  // 计算总群组数
  const totalGroups = new Set(props.data.allStats.map((s) => s.groupId)).size

  // 计算总用户数
  const totalUsers = new Set(props.data.allStats.map((s) => s.userId)).size

  // 计算总解析次数
  const totalParses = props.data.allStats.reduce((sum, s) => sum + s.parseCount, 0)

  // 计算各平台统计
  const platformStats = {
    douyin: props.data.allStats.filter((s) => s.platform === 'douyin').reduce((sum, s) => sum + s.parseCount, 0),
    bilibili: props.data.allStats.filter((s) => s.platform === 'bilibili').reduce((sum, s) => sum + s.parseCount, 0),
    kuaishou: props.data.allStats.filter((s) => s.platform === 'kuaishou').reduce((sum, s) => sum + s.parseCount, 0),
    xiaohongshu: props.data.allStats.filter((s) => s.platform === 'xiaohongshu').reduce((sum, s) => sum + s.parseCount, 0)
  }

  // 按群组聚合数据
  const groupMap = new Map<
    string,
    {
      groupId: string
      groupName?: string
      groupAvatar?: string
      totalParses: number
      uniqueUsers: number
      platforms: {
        douyin: number
        bilibili: number
        kuaishou: number
        xiaohongshu: number
      }
    }
  >()

  for (const stat of props.data.allStats) {
    if (!groupMap.has(stat.groupId)) {
      const groupInfo = props.data.groupInfoMap[stat.groupId] || {}
      groupMap.set(stat.groupId, {
        groupId: stat.groupId,
        groupName: groupInfo.groupName,
        groupAvatar: groupInfo.groupAvatar,
        totalParses: 0,
        uniqueUsers: 0,
        platforms: {
          douyin: 0,
          bilibili: 0,
          kuaishou: 0,
          xiaohongshu: 0
        }
      })
    }

    const groupData = groupMap.get(stat.groupId)!
    groupData.totalParses += stat.parseCount
    groupData.platforms[stat.platform] += stat.parseCount
  }

  // 计算每个群组的唯一用户数
  for (const [groupId, groupData] of groupMap.entries()) {
    const uniqueUsers = new Set(props.data.allStats.filter((s) => s.groupId === groupId).map((s) => s.userId))
    groupData.uniqueUsers = uniqueUsers.size
  }

  // 转换为数组并按总解析次数排序，取前20
  const groupList = Array.from(groupMap.values())
    .sort((a, b) => b.totalParses - a.totalParses)
    .slice(0, 20)

  // 格式化大数字（只四舍不五入，整数省略小数点）
  const formatNumber = (num: number): string => {
    if (num >= 100000000) {
      // 亿级别
      const result = Math.floor(num / 10000000) / 10
      return result % 1 === 0 ? result.toFixed(0) + '亿' : result.toFixed(1) + '亿'
    } else if (num >= 10000) {
      // 万级别
      const result = Math.floor(num / 1000) / 10
      return result % 1 === 0 ? result.toFixed(0) + 'w' : result.toFixed(1) + 'w'
    } else if (num >= 1000) {
      // 千级别
      const result = Math.floor(num / 100) / 10
      return result % 1 === 0 ? result.toFixed(0) + 'k' : result.toFixed(1) + 'k'
    }
    return num.toString()
  }

  // 格式化数字为千位分隔符
  const formatWithCommas = (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  // 准备折线图数据 - 使用数字索引作为x值（不包含label避免自动显示）
  const lineChartDataWithIndex = props.data.historyData.map((item, index) => ({
    x: index,
    y: item.totalParses
  }))

  // 保存日期标签用于格式化
  const dateLabels = props.data.historyData.map((item) => item.date.substring(5))

  // 智能选择 X 轴刻度 - 确保首尾都显示
  const getXAxisTicks = () => {
    const dataLength = lineChartDataWithIndex.length
    if (dataLength <= 10) {
      // 数据点少，全部显示
      return lineChartDataWithIndex.map((_, i) => i)
    }

    // 数据点多，选择合适的间隔
    const maxTicks = 10
    const step = Math.ceil(dataLength / (maxTicks - 1))
    const ticks: number[] = []

    // 添加第一个
    ticks.push(0)

    // 添加中间的刻度
    for (let i = step; i < dataLength - 1; i += step) {
      ticks.push(i)
    }

    // 添加最后一个
    ticks.push(dataLength - 1)

    return ticks
  }

  // 格式化X轴标签
  const formatXAxis = (tick: number) => {
    return dateLabels[tick] || ''
  }

  // 计算 Y 轴的最大值（向上取整到更合理的刻度）
  const maxYValue = lineChartDataWithIndex.length > 0 ? Math.max(...lineChartDataWithIndex.map((d) => d.y)) : 10
  const yDomainMax = Math.ceil(maxYValue * 1.1) // 改为 1.1 倍，留白更少

  // 格式化 Y 轴数字
  const formatYAxis = (value: number): string => {
    if (value >= 100000000) {
      // 亿级别
      const result = Math.floor(value / 10000000) / 10
      return result % 1 === 0 ? result.toFixed(0) + '亿' : result.toFixed(1) + '亿'
    } else if (value >= 10000) {
      // 万级别
      const result = Math.floor(value / 1000) / 10
      return result % 1 === 0 ? result.toFixed(0) + 'w' : result.toFixed(1) + 'w'
    } else if (value >= 1000) {
      // 千级别
      const result = Math.floor(value / 100) / 10
      return result % 1 === 0 ? result.toFixed(0) + 'k' : result.toFixed(1) + 'k'
    }
    return value.toString()
  }

  return (
    <DefaultLayout ctx={props.ctx} className="relative overflow-hidden bg-surface">
      {/* 弥散光背景层 */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div
          className="absolute rounded-full w-450 h-500 -top-100 -left-75 blur-[180px]"
          style={{
            background: `radial-gradient(ellipse at 40% 40%, ${glowColors.primary} 0%, transparent 70%)`
          }}
        />
        <div
          className="absolute rounded-full w-350 h-400 top-150 -right-50 blur-[160px]"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, ${glowColors.secondary} 0%, transparent 70%)`
          }}
        />
        <div
          className="absolute rounded-full w-450 h-500 top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 blur-[180px]"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, ${glowColors.accent} 0%, transparent 70%)`
          }}
        />
        <div
          className="absolute rounded-full w-400 h-350 -bottom-75 left-75 blur-[180px]"
          style={{
            background: `radial-gradient(ellipse at 50% 60%, ${glowColors.primary} 0%, transparent 70%)`
          }}
        />
      </div>

      {/* 杂色纹理层 */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.08] dark:opacity-[0.12]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <filter id="pixelNoise">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues="0 1" />
              <feFuncG type="discrete" tableValues="0 1" />
              <feFuncB type="discrete" tableValues="0 1" />
            </feComponentTransfer>
          </filter>
          <rect width="100%" height="100%" filter="url(#pixelNoise)" />
        </svg>
      </div>

      {/* 背景大字装饰 */}
      <div className="absolute top-30 right-15 pointer-events-none select-none opacity-[0.03] z-0">
        <span className="text-[200px] font-black tracking-tighter leading-none block text-right text-foreground">GLOBAL</span>
      </div>

      {/* 装饰性图形 */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-12 left-12 grid grid-cols-4 gap-2 opacity-20">
          {[...Array(16)].map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-foreground" />
          ))}
        </div>
        <div className="absolute top-12 right-12 flex flex-col items-end gap-1 opacity-20">
          <div className="w-32 h-1 bg-foreground" />
          <div className="w-24 h-1 bg-foreground" />
          <div className="w-16 h-1 bg-foreground" />
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="relative z-10 p-18 flex flex-col min-h-100">
        {/* 头部区域 */}
        <div className="mb-20 border-b-4 border-border/30 pb-16">
          <div className="flex items-center gap-5 opacity-60 mb-8">
            <span className="w-4 h-4 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-3xl font-mono tracking-widest text-muted/80">GLOBAL_ANALYTICS</span>
          </div>
          <h1 className="text-[8rem] font-black leading-none tracking-tighter text-foreground/90 mb-6">全局解析统计</h1>
          <div className="text-5xl font-bold text-foreground/80">全局数据概览</div>
        </div>

        {/* 核心数据卡片 */}
        <div className="mb-40">
          <div className="flex items-center gap-8 mb-16">
            <div className="w-5 h-24 rounded-full bg-indigo-500" />
            <div className="flex flex-col">
              <h2 className="text-[5rem] font-black tracking-tight leading-none text-foreground/90">数据概览</h2>
              <span className="text-2xl font-medium tracking-[0.15em] uppercase text-muted/70 mt-2">OVERVIEW</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-16">
            {[
              { title: '服务群组', titleEn: 'GROUPS', value: totalGroups, unit: '个' },
              { title: '使用用户', titleEn: 'USERS', value: totalUsers, unit: '人' },
              { title: '总解析', titleEn: 'PARSES', value: totalParses, unit: '次' }
            ].map((card) => (
              <div
                key={card.titleEn}
                className="relative rounded-3xl bg-surface/40 backdrop-blur-md border-2 border-border/40 overflow-hidden"
              >
                <div className="p-6 border-border/40">
                  <div className="text-3xl font-black text-foreground/90">{card.title}</div>
                  <div className="text-lg font-medium tracking-widest uppercase text-muted/70 mt-1 opacity-60">{card.titleEn}</div>
                </div>
                <div className="p-10 pt-2 flex items-end justify-between">
                  <div className="text-[4.5rem] font-black leading-none text-foreground/90">{formatNumber(card.value)}</div>
                  <div className="text-3xl font-medium text-foreground/80 pb-1">{card.unit}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 折线图统计 */}
        {lineChartDataWithIndex.length > 0 && (
          <div className="mb-40">
            <div className="flex items-center gap-8 mb-16">
              <div className="w-5 h-24 rounded-full bg-blue-500" />
              <div className="flex flex-col">
                <h2 className="text-[5rem] font-black tracking-tight leading-none text-foreground/90">趋势分析</h2>
                <span className="text-2xl font-medium tracking-[0.15em] uppercase text-muted/70 mt-2">TREND ANALYSIS</span>
              </div>
            </div>

            <div className="relative p-16 rounded-3xl bg-surface/40 backdrop-blur-md border-2 border-border/40">
              <svg width="1200" height="600" viewBox="0 0 1200 600">
                <VictoryChart
                  standalone={false}
                  width={1200}
                  height={600}
                  theme={VictoryTheme.material}
                  padding={{ top: 70, bottom: 100, left: 100, right: 100 }}
                  domain={{ y: [0, yDomainMax] }}
                >
                  <VictoryAxis
                    style={{
                      axis: { stroke: useDarkTheme ? '#71717a' : '#a1a1aa', strokeWidth: 2 },
                      tickLabels: {
                        fontSize: 24,
                        fill: useDarkTheme ? '#d4d4d8' : '#52525b',
                        fontFamily: 'HarmonyOSHans-Regular',
                        angle: -45,
                        textAnchor: 'end',
                        verticalAnchor: 'middle'
                      },
                      grid: { stroke: useDarkTheme ? '#52525b' : '#d4d4d8', strokeWidth: 1 }
                    }}
                    tickValues={getXAxisTicks()}
                    tickFormat={formatXAxis}
                    label="日期"
                    axisLabelComponent={
                      <VictoryLabel
                        x={1170}
                        y={490}
                        textAnchor="end"
                        angle={0}
                        style={{
                          fontSize: 24,
                          fill: useDarkTheme ? '#a1a1aa' : '#71717a',
                          fontFamily: 'HarmonyOSHans-Regular'
                        }}
                      />
                    }
                  />
                  <VictoryAxis
                    dependentAxis
                    label="解析次数"
                    tickFormat={formatYAxis}
                    axisLabelComponent={
                      <VictoryLabel
                        x={100}
                        y={50}
                        textAnchor="middle"
                        angle={0}
                        style={{
                          fontSize: 24,
                          fill: useDarkTheme ? '#a1a1aa' : '#71717a',
                          fontFamily: 'HarmonyOSHans-Regular'
                        }}
                      />
                    }
                    style={{
                      axis: { stroke: useDarkTheme ? '#71717a' : '#a1a1aa', strokeWidth: 2 },
                      tickLabels: {
                        fontSize: 28,
                        fill: useDarkTheme ? '#d4d4d8' : '#52525b',
                        fontFamily: 'HarmonyOSHans-Regular'
                      },
                      grid: { stroke: useDarkTheme ? '#52525b' : '#d4d4d8', strokeWidth: 1 }
                    }}
                  />
                  <VictoryLine
                    data={lineChartDataWithIndex}
                    style={{
                      data: {
                        stroke: '#8b5cf6',
                        strokeWidth: 4
                      }
                    }}
                    interpolation="monotoneX"
                  />
                  {/* 添加数据点标记 */}
                  <VictoryScatter
                    data={lineChartDataWithIndex}
                    size={6}
                    style={{
                      data: {
                        fill: '#8b5cf6'
                      }
                    }}
                  />
                  {/* 显示所有数据点下方的日期标签 */}
                  <VictoryScatter
                    data={lineChartDataWithIndex}
                    size={0}
                    labels={({ datum }) => dateLabels[datum.x]}
                    labelComponent={
                      <VictoryLabel
                        style={{
                          fontSize: 10,
                          fill: useDarkTheme ? '#d4d4d8' : '#52525b',
                          fontFamily: 'HarmonyOSHans-Regular'
                        }}
                        dy={25}
                      />
                    }
                  />
                  {/* 显示所有数据点上方的数值标签 */}
                  <VictoryScatter
                    data={lineChartDataWithIndex}
                    size={0}
                    labels={({ datum }) => `${datum.y}次`}
                    labelComponent={
                      <VictoryLabel
                        style={{
                          fontSize: 10,
                          fill: useDarkTheme ? '#d4d4d8' : '#52525b',
                          fontFamily: 'HarmonyOSHans-Regular'
                        }}
                        dy={-15}
                      />
                    }
                  />
                </VictoryChart>
              </svg>
            </div>
          </div>
        )}

        {/* 平台详情 - 饼图 */}
        <div className="mb-40">
          <div className="flex items-center gap-8 mb-16">
            <div className="w-5 h-24 rounded-full bg-violet-500" />
            <div className="flex flex-col">
              <h2 className="text-[5rem] font-black tracking-tight leading-none text-foreground/90">平台详情</h2>
              <span className="text-2xl font-medium tracking-[0.15em] uppercase text-muted/70 mt-2">PLATFORMS</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-20">
            {/* 饼图 */}
            <div className="relative w-full h-200 flex items-center justify-center">
              <svg width="1200" height="1000" viewBox="0 0 1200 1000">
                <VictoryPie
                  standalone={false}
                  width={1200}
                  height={1000}
                  data={Object.entries(platformStats).map(([platform, count]) => {
                    const config = platformConfig[platform as keyof typeof platformConfig]
                    const total = Object.values(platformStats).reduce((sum, c) => sum + c, 0)
                    const percentage = total > 0 ? ((count / total) * 100).toFixed(0) : '0'
                    return {
                      x: config.name,
                      y: count,
                      label: `${config.name} ${percentage}%\n${formatNumber(count)}次`,
                      fill: config.color
                    }
                  })}
                  innerRadius={220}
                  radius={320}
                  padAngle={3}
                  colorScale={Object.keys(platformStats).map((platform) => platformConfig[platform as keyof typeof platformConfig].color)}
                  style={{
                    labels: {
                      fontSize: 40,
                      fontFamily: 'HarmonyOSHans-Regular',
                      fontWeight: 'bold',
                      fill: useDarkTheme ? '#fff' : '#000'
                    }
                  }}
                  labelRadius={400}
                />
              </svg>
            </div>

            {/* 图例 */}
            <div className="w-full grid grid-cols-2 gap-x-16 gap-y-8">
              {Object.entries(platformStats).map(([platform, count]) => {
                if (count === 0) return null
                const config = platformConfig[platform as keyof typeof platformConfig]
                const total = Object.values(platformStats).reduce((sum, c) => sum + c, 0)
                const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'

                return (
                  <div key={platform} className="flex items-center gap-8">
                    <div className="w-14 h-14 rounded-lg shrink-0" style={{ backgroundColor: config.color }} />
                    <div className="flex-1">
                      <div className="text-4xl font-bold text-foreground/90 mb-2">{config.name}</div>
                      <div className="text-2xl text-foreground/80 mb-2">{config.nameEn}</div>
                      <div className="text-3xl text-foreground/80">
                        <span className="font-black text-foreground/90">{formatWithCommas(count)}</span> 次
                        <span className="text-2xl ml-2">({percentage}%)</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 群组排行榜 */}
        <div>
          <div className="flex items-center gap-8 mb-16">
            <div className="w-5 h-24 rounded-full bg-yellow-500" />
            <div className="flex flex-col">
              <h2 className="text-[5rem] font-black tracking-tight leading-none text-foreground/90">群组排行</h2>
              <span className="text-2xl font-medium tracking-[0.15em] uppercase text-muted/70 mt-2">TOP GROUPS</span>
            </div>
          </div>

          <div className="space-y-8">
            {groupList.map((group, index) => {
              return (
                <div
                  key={group.groupId}
                  className="relative p-12 rounded-3xl bg-surface/40 backdrop-blur-md border-2 border-border/40 flex items-center gap-10"
                >
                  {/* 群组头像 */}
                  {group.groupAvatar && (
                    <img
                      src={group.groupAvatar}
                      alt={group.groupName || group.groupId}
                      className="w-28 h-28 rounded-2xl object-cover border-2 border-border/50 shrink-0"
                    />
                  )}

                  {/* 群组信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="text-4xl font-black text-foreground/90">{group.groupName || `群组 ${group.groupId}`}</div>
                      {/* 前三名奖杯图标 */}
                      {index === 0 && <RiTrophyFill size={48} className="text-yellow-400 shrink-0" />}
                      {index === 1 && <RiTrophyFill size={48} className="text-gray-400 shrink-0" />}
                      {index === 2 && <RiTrophyFill size={48} className="text-orange-400 shrink-0" />}
                    </div>
                    <div className="text-2xl text-foreground/80 mb-4">
                      {group.groupId} · {formatWithCommas(group.uniqueUsers)} 人使用
                    </div>
                    <div className="flex gap-6 flex-wrap">
                      {Object.entries(group.platforms).map(([platform, count]) => {
                        if (count === 0) return null
                        const config = platformConfig[platform as keyof typeof platformConfig]
                        return (
                          <div key={platform} className="flex items-center gap-3">
                            <img src={config.logo} alt={config.name} className="h-10 w-auto object-contain" />
                            <span className="text-3xl font-bold text-foreground/80">{formatWithCommas(count)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* 总次数 */}
                  <div className="shrink-0 text-right">
                    <div className="text-[5rem] font-black text-foreground/90 leading-none">{formatWithCommas(group.totalParses)}</div>
                    <div className="text-3xl text-foreground/80 mt-2">次</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </DefaultLayout>
  )
}

export default GlobalStatistics
