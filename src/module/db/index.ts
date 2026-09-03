import { BilibiliDBBase } from './bilibili.js'
import { DouyinDBBase } from './douyin.js'
import { LivePreviewDBBase } from './livePreview.js'
import { StatisticsDBBase } from './statistics.js'

export * from './bilibili.js'
export * from './douyin.js'
export * from './livePreview.js'
export * from './statistics.js'
export * from './retention.js'

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

export const getDouyinDB = createSingletonGetter(async () => await new DouyinDBBase().init())

export const getBilibiliDB = createSingletonGetter(async () => await new BilibiliDBBase().init())

export const getStatisticsDB = createSingletonGetter(async () => await new StatisticsDBBase().init())

export const getLivePreviewDB = createSingletonGetter(async () => await new LivePreviewDBBase().init())

export const initAllDatabases = async (): Promise<{
  douyinDB: DouyinDBBase | null
  bilibiliDB: BilibiliDBBase | null
  statisticsDB: StatisticsDBBase | null
  livePreviewDB: LivePreviewDBBase | null
}> => {
  const [douyin, bilibili, statistics, livePreview] = await Promise.all([
    getDouyinDB(),
    getBilibiliDB(),
    getStatisticsDB(),
    getLivePreviewDB()
  ])

  return {
    douyinDB: douyin,
    bilibiliDB: bilibili,
    statisticsDB: statistics,
    livePreviewDB: livePreview
  }
}

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
