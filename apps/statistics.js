import { getStatisticsDB } from '../module/db/index.js'
import { Render } from '../module/utils/index.js'

const PLATFORM_LABELS = {
  douyin: '抖音',
  bilibili: '哔哩哔哩',
  kuaishou: '快手',
  xiaohongshu: '小红书'
}

const toPlatformRows = (stats) => Object.entries(PLATFORM_LABELS).map(([platform, label]) => ({
  platform,
  label,
  count: stats[platform] || 0
}))

const sumPlatformStats = (stats) => Object.values(stats).reduce((sum, count) => sum + count, 0)

const getGroupName = async (e, groupId) => {
  if (e.group_name) return e.group_name
  try {
    const info = await e.bot?.getGroupInfo?.(groupId)
    return info?.group_name || info?.groupName || info?.name || ''
  } catch {
    return ''
  }
}

export class kkkStatistics extends plugin {
  constructor() {
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

  async groupStatistics(e) {
    const groupId = e.group_id || e.groupId
    if (!groupId) {
      await e.reply('此命令仅支持在群聊中使用')
      return true
    }

    const statisticsDB = await getStatisticsDB()
    const groupStats = await statisticsDB.getGroupStatistics(String(groupId))
    const groupUniqueUsers = await statisticsDB.getGroupUniqueUsers(String(groupId))
    const globalSummary = await statisticsDB.getGlobalSummary()
    const platformData = groupStats.reduce(
      (acc, stat) => {
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

    await e.reply(img)
    return true
  }

  async globalStatistics(e) {
    const statisticsDB = await getStatisticsDB()
    const summary = await statisticsDB.getGlobalSummary()
    const history = await statisticsDB.getRecentHistory(30)
    const allStats = await statisticsDB.getAllStatistics()
    const groupMap = new Map()

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

    await e.reply(img)
    return true
  }
}
