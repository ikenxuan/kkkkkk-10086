import React from 'react'
import { RiPieChart2Fill, RiTrophyFill } from 'react-icons/ri'
import { VictoryPie } from 'victory'

import { DefaultLayout } from '../../../components/DefaultLayout'
import type { PosterProps } from '../../../types/ctx'
import { isDark as isDarkMode } from '../../../../utils/theme'
import { MediaMetricsSection } from '../../components/MediaMetricsSection'
import type { GroupStatisticsData } from './types'

/**
 * 群组解析统计组件 Group Statistics
 */
export const GroupStatistics: React.FC<PosterProps<GroupStatisticsData>> = (props) => {
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

  // 计算最大值和总数
  const maxCount = Math.max(...Object.values(props.data.platformData))
  const totalCount = Object.values(props.data.platformData).reduce((a, b) => a + b, 0)

  // 准备饼图数据
  const pieChartData = Object.entries(props.data.platformData)
    .filter(([_, count]) => count > 0)
    .map(([platform, count]) => ({
      x: platformConfig[platform as keyof typeof platformConfig].name,
      y: count,
      label: `${platformConfig[platform as keyof typeof platformConfig].name} ${((count / totalCount) * 100).toFixed(0)}%`,
      fill: platformConfig[platform as keyof typeof platformConfig].color
    }))

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
          className="absolute rounded-full w-400 h-350 -bottom-75 left-75 blur-[180px]"
          style={{
            background: `radial-gradient(ellipse at 50% 60%, ${glowColors.accent} 0%, transparent 70%)`
          }}
        />
        <div
          className="absolute rounded-full w-400 h-350 top-450 right-75 blur-[180px]"
          style={{
            background: `radial-gradient(ellipse at 50% 60%, ${glowColors.secondary} 0%, transparent 70%)`
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
        <span className="text-[200px] font-black tracking-tighter leading-none block text-right text-foreground">STATS</span>
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
        <div className="mb-20 border-b-4 border-border/30 pb-10">
          {/*
            本地改动（上游没有）：pl-16 是为了避开左上角那组装饰点阵。
            点阵在 top-12 left-12（x 48..96、y 48..96），而内容区 p-18 让这一行从 x=72 起，
            不挪的话那个 w-4 的脉冲圆点落在 x 72..88——整个嵌在点阵里
            （实测 x 方向重叠 16px、y 方向重叠 14px，GROUP_ANALYTICS 也只离点阵右缘 12px）。
            先前是 pl-8（32px），圆点推到 x=104，重叠是没了，但点阵右缘到圆点左缘只剩 8px——
            这里的圆点比 Help.tsx 的 w-2 大一倍，8px 间隙下它整个贴在点阵边上，还是挤。
            改成 pl-16（64px）：圆点左缘 x=136，间隙 40px，GROUP_ANALYTICS 左缘 x=172。
            再往右就过了：80px 时这一行会脱开下面的大标题，左边空出一条明显的白带。
            pl 加在整行 flex 容器上，所以圆点和后面的英文标签是一起右移的。
            只挪这一行：下面的大标题仍然对齐内容区左边界（x=72），不受影响。
            other/help、statistics/global 两张卡片是同样的问题、同样用 pl 修的，
            三处的 pl 值要保持一致（都是 pl-16），改一处记得同步另两处。
            同步上游时请保留——上游这行没有 pl，抹掉会让点阵重新压住圆点。
          */}
          <div className="flex items-center gap-5 pl-16 opacity-60 mb-8">
            <span className="w-4 h-4 rounded-full bg-pink-500 animate-pulse" />
            <span className="text-3xl font-mono tracking-widest text-muted/80">GROUP_ANALYTICS</span>
          </div>
          <div className="flex items-center gap-8 mb-6">
            {props.data.groupAvatar && (
              <img src={props.data.groupAvatar} alt="群头像" className="w-32 h-32 rounded-2xl object-cover border-4 border-border/50" />
            )}
            <div className="flex-1">
              <h1 className="text-[8rem] font-black leading-none tracking-tighter text-foreground/90">解析统计</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-5xl font-bold text-foreground/70">
            <span>
              {props.data.groupName}({props.data.groupId})
            </span>
            {props.data.groupMemberCount && <span>({props.data.groupMemberCount})</span>}
          </div>
        </div>

        {/* 核心数据卡片 */}
        <div className="mb-40">
          <div className="flex items-center gap-8 mb-16">
            <div className="w-5 h-24 rounded-full bg-pink-500" />
            <div className="flex flex-col">
              <h2 className="text-[5rem] font-black tracking-tight leading-none text-foreground/90">数据概览</h2>
              <span className="text-2xl font-medium tracking-[0.15em] uppercase text-muted/70 mt-2">OVERVIEW</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-16">
            <div className="relative p-16 rounded-3xl bg-surface/40 backdrop-blur-md border-2 border-border/40">
              <div className="text-4xl font-black text-foreground/90 mb-3">本群解析</div>
              <div className="text-xl font-medium tracking-widest uppercase text-muted/70 mb-8 opacity-60">GROUP TOTAL</div>
              {/*
                `whitespace-nowrap shrink-0` 是折行保险，跟 MediaMetricsSection 一致。
                这两张卡目前不会溢出（`grid-cols-2` 卡宽 584、可用 456px，六位数
                345px + 单字单位 36px 还余 63px），但结构与那边一模一样：单位是
                flex item、默认 min-width:auto，挤到就会折行。哪天这排改成三列、
                或者次数到七位（约 447px）就会复现，加两个类先把机制堵掉。
                这里不做按字符数降字号 —— 宽卡还用不上。
              */}
              <div className="flex items-baseline gap-3">
                <div className="text-[7rem] font-black leading-none text-foreground/90">{props.data.groupTotalParses}</div>
                <div className="text-4xl font-medium text-foreground/80 pb-2 whitespace-nowrap shrink-0">次</div>
              </div>
            </div>

            <div className="relative p-16 rounded-3xl bg-surface/40 backdrop-blur-md border-2 border-border/40">
              <div className="text-4xl font-black text-foreground/90 mb-3">使用用户</div>
              <div className="text-xl font-medium tracking-widest uppercase text-muted/70 mb-8 opacity-60">UNIQUE USERS</div>
              {/* 折行保险同上 */}
              <div className="flex items-baseline gap-3">
                <div className="text-[7rem] font-black leading-none text-foreground/90">{props.data.groupUniqueUsers}</div>
                <div className="text-4xl font-medium text-foreground/80 pb-2 whitespace-nowrap shrink-0">人</div>
              </div>
            </div>
          </div>
        </div>

        {/* 饼图统计 */}
        {totalCount > 0 && (
          <div className="mb-40">
            <div className="flex items-center gap-8 mb-16">
              <div className="w-5 h-24 rounded-full bg-blue-500" />
              <div className="flex flex-col">
                <h2 className="text-[5rem] font-black tracking-tight leading-none text-foreground/90">平台分布</h2>
                <span className="text-2xl font-medium tracking-[0.15em] uppercase text-muted/70 mt-2">DISTRIBUTION</span>
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
                    data={pieChartData}
                    innerRadius={220}
                    radius={320}
                    padAngle={3}
                    colorScale={pieChartData.map((d) => d.fill)}
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
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <RiPieChart2Fill size={320} className="opacity-10" />
                </div>
              </div>

              {/* 图例 */}
              <div className="w-full grid grid-cols-2 gap-x-16 gap-y-8">
                {Object.entries(props.data.platformData).map(([platform, count]) => {
                  if (count === 0) return null
                  const config = platformConfig[platform as keyof typeof platformConfig]
                  const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0

                  return (
                    <div key={platform} className="flex items-center gap-8">
                      <div className="w-14 h-14 rounded-lg shrink-0" style={{ backgroundColor: config.color }} />
                      <div className="flex-1">
                        <div className="text-4xl font-bold text-foreground/90 mb-2">{config.name}</div>
                        <div className="text-2xl text-foreground/80 mb-2">{config.nameEn}</div>
                        <div className="text-3xl text-foreground/80">
                          <span className="font-black text-foreground/90">{count}</span> 次
                          <span className="text-2xl ml-2">({percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* 柱状图统计 */}
        <div className="mb-40">
          <div className="flex items-center gap-8 mb-16">
            <div className="w-5 h-24 rounded-full bg-violet-500" />
            <div className="flex flex-col">
              <h2 className="text-[5rem] font-black tracking-tight leading-none text-foreground/90">平台详情</h2>
              <span className="text-2xl font-medium tracking-[0.15em] uppercase text-muted/70 mt-2">PLATFORMS</span>
            </div>
          </div>

          <div className="space-y-18">
            {Object.entries(props.data.platformData).map(([platform, count]) => {
              const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0
              const config = platformConfig[platform as keyof typeof platformConfig]

              return (
                <div key={platform} className="relative">
                  <div className="flex items-center gap-8 mb-6">
                    <img src={config.logo} alt={config.name} className="h-24 w-auto object-contain" />
                    <div className="flex-1">
                      <div className="text-4xl font-bold text-foreground mb-2">{config.name}</div>
                      <div className="text-2xl text-foreground/70">{config.nameEn}</div>
                    </div>
                    <div className="text-[5rem] font-black text-foreground">{count}</div>
                  </div>
                  <div className="relative h-18 bg-surface-secondary rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: config.color
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/*
          媒体统计区块（本地新增，上游没有；同步上游时请保留，连带 types.ts 的
          mediaMetrics 字段和 statistics/components/MediaMetricsSection.tsx 一起。
          那个组件 global 那张卡也在用，删之前先看两处调用点）。

          放在「平台详情」之后、「用户排行」之前：上半张卡讲「解析了多少次」，
          这一块讲「解析出去的东西有多少」，两者都是平台维度的；用户维度的排行接在后面。
          色条取 emerald-500，接在本卡 pink/blue/violet 之后、yellow（用户排行）之前。

          守卫在这里而不在组件内部：字段可选，不传就整块不渲染，
          老调用点（以及 MediaMetrics 表还没攒到数据的新装用户）都照常出图。
        */}
        {props.data.mediaMetrics && (
          <MediaMetricsSection metrics={props.data.mediaMetrics} platformConfig={platformConfig} />
        )}

        {/*
          用户排行区块（本地新增，上游 karin-plugin-kkk 的这张卡没有；同步上游时请保留）。

          排版照抄同仓 statistics/global 的「群组排行」：同一套区块头
          （w-5 h-24 的色条 + text-[5rem] 标题 + uppercase 副标题）、同一套行容器
          （p-12 rounded-3xl bg-surface/40 backdrop-blur-md border-2）、前三名同一套
          RiTrophyFill 配色（金/银/铜），右侧同样是 text-[5rem] 的总次数 + 「次」。
          色条取 yellow-500 也跟那张卡的排行一致，接在本卡 pink/blue/violet 之后。

          守卫写成 `?.length ? ... : null`：整个 userRanking 是可选字段，
          不传、传空数组都在这里整块跳过，不会走到下面的 .map。
          数字不做 w/亿 缩写 —— 本卡其余数字（本群解析、平台详情）都是原样输出，
          global 那张卡才有 formatWithCommas，这里跟着本卡保持一致。
        */}
        {props.data.userRanking?.length ? (
          <div className="mb-40">
            <div className="flex items-center gap-8 mb-16">
              <div className="w-5 h-24 rounded-full bg-yellow-500" />
              <div className="flex flex-col">
                <h2 className="text-[5rem] font-black tracking-tight leading-none text-foreground/90">用户排行</h2>
                <span className="text-2xl font-medium tracking-[0.15em] uppercase text-muted/70 mt-2">TOP USERS</span>
              </div>
            </div>

            <div className="space-y-8">
              {props.data.userRanking.map((user, index) => (
                <div
                  key={user.userId}
                  className="relative p-12 rounded-3xl bg-surface/40 backdrop-blur-md border-2 border-border/40 flex items-center gap-10"
                >
                  {/* 头像：非 QQ 群（QQBot 频道等）拿不到，缺省时这格整个不渲染 */}
                  {user.avatar && (
                    <img
                      src={user.avatar}
                      alt={user.nickname}
                      className="w-28 h-28 rounded-2xl object-cover border-2 border-border/50 shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-4 mb-3">
                      {/*
                        昵称这格原来是 `truncate`（overflow:hidden + white-space:nowrap +
                        text-overflow:ellipsis），它就是「名字被从中间切掉」的来源。
                        `text-overflow: ellipsis` 的省略号只在「元素自己溢出自己的盒子」时才画得出来，
                        而这格的盒子宽度是外层 `flex-1 min-w-0` 被 flex 压出来的分数值；
                        再叠上截图时的亚像素取整，Chrome 会判成「刚好装得下」而不画省略号，
                        绘制却仍停在那条分数边界上 —— 于是最后一个字符只画了一半，连省略号都没有。
                        handlerError 那张卡的适配器名是同一个毛病，那边也是换成 break-all 解决的。

                        换 `break-all`（word-break: break-all）而不是别的写法：
                        - 换行最坏只是把一个字符挪到下一行，画不出半个字形；只有裁切会。
                        - 它会真正压低 min-content 宽度，所以这个 flex item 能缩到一个字符宽，
                          不会反过来把行顶爆。`break-words`（overflow-wrap: break-word）做不到这点 ——
                          Chrome 算 min-content 时当它不存在，一长串没有空格的名字照样溢出。
                        - 断点按字形簇走，中英混排、emoji（含 ZWJ 序列）都不会被劈成两半。
                        不用担心竖直方向：这一行是 p-12 的 items-center flex 行、卡片高度由内容撑，
                        名字长到换行只是这行变高，没有固定高度会把行盒挤掉一截。
                      */}
                      <div className="text-4xl font-black text-foreground/90 break-all">{user.nickname}</div>
                      {/* 前三名奖杯，配色与 global 群组排行一致 */}
                      {index === 0 && <RiTrophyFill size={48} className="text-yellow-400 shrink-0" />}
                      {index === 1 && <RiTrophyFill size={48} className="text-gray-400 shrink-0" />}
                      {index === 2 && <RiTrophyFill size={48} className="text-orange-400 shrink-0" />}
                    </div>
                    {/*
                      QQBot 的 userId 是几十位 openid、中间没有空格可断，放任它排一行会顶出容器 ——
                      但这该用换行解决，不该用裁。原来的 `truncate` 和上面昵称那格是同一个毛病：
                      省略号画不出来，末尾字符被切掉一半。`break-all` 让长串就地折行，
                      「不顶出容器」照样成立，而且 ID 是完整的 —— 这一行本来就是给人核对身份用的，
                      裁掉尾巴等于这格白显示。
                    */}
                    <div className="text-2xl text-foreground/80 mb-4 break-all">{user.userId}</div>
                    {user.platforms && (
                      <div className="flex gap-6 flex-wrap">
                        {Object.entries(user.platforms).map(([platform, count]) => {
                          if (count === 0) return null
                          const config = platformConfig[platform as keyof typeof platformConfig]
                          return (
                            <div key={platform} className="flex items-center gap-3">
                              <img src={config.logo} alt={config.name} className="h-10 w-auto object-contain" />
                              <span className="text-3xl font-bold text-foreground/80">{count}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-[5rem] font-black text-foreground/90 leading-none">{user.totalParses}</div>
                    <div className="text-3xl text-foreground/80 mt-2">次</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* 底部信息 */}
        <div className="mt-auto pt-20 border-t-2 border-border">
          <div className="text-center">
            <div className="text-3xl font-mono tracking-widest text-muted mb-4">TOTAL SERVICE</div>
            <div className="text-4xl font-medium text-foreground/70">
              累计服务 <span className="font-black text-foreground">{props.data.globalTotalGroups}</span> 个群组 · 解析{' '}
              <span className="font-black text-foreground">{props.data.globalTotalParses}</span> 次
            </div>
          </div>
        </div>
      </div>
    </DefaultLayout>
  )
}

export default GroupStatistics
