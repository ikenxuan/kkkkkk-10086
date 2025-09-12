import { BilibiliDBBase } from './bilibili.js'
import { DouyinDBBase } from './douyin.js'

export * from './bilibili.js'
export * from './douyin.js'

/** 抖音数据库实例 */
/** @type {DouyinDBBase | null} */
let douyinDB = null
let douyinInitializing = false

/** 哔哩哔哩数据库实例 */
/** @type {BilibiliDBBase | null} */
let bilibiliDB = null
let bilibiliInitializing = false

/**
 * 获取或初始化 DouyinDB 实例（单例模式）
 * @returns {Promise<DouyinDBBase | null>} DouyinDB实例
 */
export const getDouyinDB = async () => {
  if (douyinDB) {
    return douyinDB
  }

  if (douyinInitializing) {
    await new Promise(resolve => setTimeout(resolve, 100))
    console.assert(douyinDB !== undefined && douyinDB !== null, "douyinDB is null or undefined")
    return douyinDB
  }

  douyinInitializing = true
  try {
    douyinDB = await new DouyinDBBase().init()
    return douyinDB
  } finally {
    douyinInitializing = false
  }
}

/**
 * 获取或初始化 BilibiliDB 实例（单例模式）
 * @returns {Promise<BilibiliDBBase | null>} BilibiliDB实例
 */
export const getBilibiliDB = async () => {
  if (bilibiliDB) {
    return bilibiliDB
  }

  if (bilibiliInitializing) {
    await new Promise(resolve => setTimeout(resolve, 100))
    console.assert(bilibiliDB !== undefined && bilibiliDB !== null, "bilibiliDB is null or undefined")
    return bilibiliDB
  }

  bilibiliInitializing = true
  try {
    bilibiliDB = await new BilibiliDBBase().init()
    return bilibiliDB
  } finally {
    bilibiliInitializing = false
  }
}

/**
 * 初始化所有数据库
 * @returns {Promise<{douyinDB: DouyinDBBase | null, bilibiliDB: BilibiliDBBase | null}>} 初始化后的数据库实例
 */
export const initAllDatabases = async () => {
  const [douyin, bilibili] = await Promise.all([
    getDouyinDB(),
    getBilibiliDB()
  ])

  return { douyinDB: douyin, bilibiliDB: bilibili }
}

// 导出数据库实例（延迟初始化）
export const douyinDBInstance = await getDouyinDB()
export const bilibiliDBInstance = await getBilibiliDB()

// 为了保持向后兼容性，保留原有的导出名称
export { bilibiliDBInstance as bilibiliDB, douyinDBInstance as douyinDB }

/**
 * 清理旧的动态缓存记录
 * @param {'douyin' | 'bilibili'} platform 指定数据库
 * @param {number} days 保留最近几天的记录，默认为7天
 * @returns {Promise<number>} 删除的记录数量
 */
export const cleanOldDynamicCache = async (platform, days = 7) => {
  if (platform === 'douyin') {
    const db = await getDouyinDB()
    if (db) return await db.cleanOldAwemeCache(days)
  } else {
    const db = await getBilibiliDB()
    if (db) return await db.cleanOldDynamicCache(days)
  }
  return 0
}
