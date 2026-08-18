import { getStatisticsDB } from '../module/db/index.js'
import { Render } from '../module/utils/index.js'
import type { ParseStatisticsRow, StatisticsPlatform } from '../types/database.js'
import type { CommandEvent, MessageEvent } from '../types/message.js'

const PLATFORM_LABELS: Record<StatisticsPlatform, string> = {
  douyin: '抖音',
  bilibili: '哔哩哔哩',
  kuaishou: '快手',
  xiaohongshu: '小红书'
}

/** 单个平台在统计页上的一行 */
interface PlatformRow {
  platform: StatisticsPlatform
  label: string
  count: number
}

/** 各平台解析次数，键固定为四个平台 */
type PlatformStats = Record<StatisticsPlatform, number>

const toPlatformRows = (stats: PlatformStats): PlatformRow[] => {
  // Object.entries 会把键退化成 string，这里恢复其字面量类型
  return (Object.entries(PLATFORM_LABELS) as Array<[StatisticsPlatform, string]>).map(([platform, label]) => ({
    platform,
    label,
    count: stats[platform] || 0
  }))
}

const sumPlatformStats = (stats: PlatformStats): number =>
  Object.values(stats).reduce((sum, count) => sum + count, 0)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** 各宿主的 Bot 对象结构不一致，这里只声明真正调用到的方法 */
interface GroupInfoProvider {
  getGroupInfo?: (groupId: string) => Promise<unknown>
}

const getGroupName = async (e: MessageEvent, groupId: string): Promise<string> => {
  if (e.group_name) return String(e.group_name)
  try {
    const bot = e.bot as GroupInfoProvider | undefined
    const info = await bot?.getGroupInfo?.(groupId)
    if (!isRecord(info)) return ''
    return String(info.group_name || info.groupName || info.name || '')
  } catch {
    return ''
  }
}

export class kkkStatistics extends plugin {
  constructor () {
    super({
      name: 'kkk解析统计',
      event: 'message',
      priority: 2000,
      rule: [
        {
          reg: /^#?kkk解析统计$/,
          fnc: 'groupStatistics'
        },
        {
          reg: /^#?kkk全局解析统计$/,
          fnc: 'globalStatistics',
          permission: 'master'
        }
      ]
    })
  }

  async groupStatistics (e: CommandEvent): Promise<boolean> {
    const groupId = e.group_id || e.groupId
    if (!groupId) {
      await e.reply!('此命令仅支持在群聊中使用')
      return true
    }

    const statisticsDB = await requireStatisticsDB()
    const groupStats = await statisticsDB.getGroupStatistics(String(groupId))
    const groupUniqueUsers = await statisticsDB.getGroupUniqueUsers(String(groupId))
    const globalSummary = await statisticsDB.getGlobalSummary()
    const platformData = groupStats.reduce<PlatformStats>(
      (acc, stat: ParseStatisticsRow) => {
        acc[stat.platform] = (acc[stat.platform] || 0) + stat.parseCount
        return acc
      },
      { douyin: 0, bilibili: 0, kuaishou: 0, xiaohongshu: 0 }
    )
    const groupTotalParses = sumPlatformStats(platformData)
    const img = await Render('statistics/group', {
      groupId,
      groupName: await getGroupName(e, String(groupId)),
      groupTotalParses,
      groupUniqueUsers,
      platformRows: toPlatformRows(platformData),
      globalTotalGroups: globalSummary.totalGroups,
      globalTotalParses: globalSummary.totalParses
    })

    await e.reply!(img)
    return true
  }

  async globalStatistics (e: CommandEvent): Promise<boolean> {
    const statisticsDB = await requireStatisticsDB()
    const summary = await statisticsDB.getGlobalSummary()
    const history = await statisticsDB.getRecentHistory(30)
    const allStats = await statisticsDB.getAllStatistics()
    const groupMap = new Map<string, { groupId: string, total: number }>()

    for (const stat of allStats) {
      const item = groupMap.get(stat.groupId) || { groupId: stat.groupId, total: 0 }
      item.total += stat.parseCount
      groupMap.set(stat.groupId, item)
    }

    const topGroups = Array.from(groupMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)

    const img = await Render('statistics/global', {
      totalGroups: summary.totalGroups,
      totalUsers: summary.totalUsers,
      totalParses: summary.totalParses,
      platformRows: toPlatformRows(summary.platformStats),
      historyRows: history.reverse(),
      topGroups
    })

    await e.reply!(img)
    return true
  }
}

/**
 * 取统计数据库实例。
 *
 * `getStatisticsDB()` 初始化失败时返回 null，迁移前的代码会在随后的属性访问上抛
 * TypeError；这里把它换成一条能说明原因的错误，抛出时机与传播路径不变。
 */
const requireStatisticsDB = async (): Promise<NonNullable<Awaited<ReturnType<typeof getStatisticsDB>>>> => {
  const statisticsDB = await getStatisticsDB()
  if (!statisticsDB) throw new Error('解析统计数据库未初始化')
  return statisticsDB
}
