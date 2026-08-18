import { BilibiliDBBase } from './bilibili.js'
import { DouyinDBBase } from './douyin.js'
import { StatisticsDBBase } from './statistics.js'

export * from './bilibili.js'
export * from './douyin.js'
export * from './statistics.js'

/**
 * 构造单例 getter：并发调用共享同一次初始化，失败后清空以允许重试
 * @param factory 初始化函数
 */
const createSingletonGetter = <T>(factory: () => Promise<T>): () => Promise<T | null> => {
  let instance: T | null = null
  let pending: Promise<T> | null = null

  return async (): Promise<T | null> => {
    if (instance) return instance
    pending ??= factory()
      .then(value => {
        instance = value
        return value
      })
      .finally(() => {
        pending = null
      })
    return await pending
  }
}

/**
 * 获取或初始化 DouyinDB 实例（单例模式）
 */
export const getDouyinDB = createSingletonGetter(async () => await new DouyinDBBase().init())

/**
 * 获取或初始化 BilibiliDB 实例（单例模式）
 */
export const getBilibiliDB = createSingletonGetter(async () => await new BilibiliDBBase().init())

/**
 * 获取或初始化 StatisticsDB 实例（单例模式）
 */
export const getStatisticsDB = createSingletonGetter(async () => await new StatisticsDBBase().init())

/**
 * 初始化所有数据库
 */
export const initAllDatabases = async (): Promise<{
  douyinDB: DouyinDBBase | null
  bilibiliDB: BilibiliDBBase | null
  statisticsDB: StatisticsDBBase | null
}> => {
  const [douyin, bilibili, statistics] = await Promise.all([
    getDouyinDB(),
    getBilibiliDB(),
    getStatisticsDB()
  ])

  return { douyinDB: douyin, bilibiliDB: bilibili, statisticsDB: statistics }
}

// 导出数据库实例（延迟初始化）
const douyinDBInstance = await getDouyinDB()
const bilibiliDBInstance = await getBilibiliDB()
const statisticsDBInstance = await getStatisticsDB()

/**
 * 清理旧的动态缓存记录
 * @param platform 指定数据库，'douyin' | 'bilibili'
 * @param days 保留最近几天的记录，默认为7天
 * @returns 删除的记录数量
 */
export const cleanOldDynamicCache = async (
  platform: 'douyin' | 'bilibili',
  days = 7
): Promise<number> => {
  if (platform === 'douyin') {
    const db = await getDouyinDB()
    if (db) return await db.cleanOldAwemeCache(days)
  } else {
    const db = await getBilibiliDB()
    if (db) return await db.cleanOldDynamicCache(days)
  }
  return 0
}

// 为了保持向后兼容性，保留原有的导出名称
export { bilibiliDBInstance as bilibiliDB, douyinDBInstance as douyinDB, statisticsDBInstance as statisticsDB }
