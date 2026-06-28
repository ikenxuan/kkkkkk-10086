import Version from '../utils/Version.js'
import sqlite3 from 'sqlite3'
import path from 'node:path'
import fs from 'node:fs'

const PLATFORMS = ['douyin', 'bilibili', 'kuaishou', 'xiaohongshu']

export class StatisticsDBBase {
  /** @type {sqlite3.Database | null} */
  db = null
  /** @type {string} */
  dbPath

  constructor() {
    this.dbPath = path.join(Version.pluginPath, 'data', 'statistics.db')
  }

  async init() {
    try {
      logger.debug(logger.green('--------------------------[StatisticsDB] 开始初始化数据库--------------------------'))
      await fs.promises.mkdir(path.dirname(this.dbPath), { recursive: true })
      this.db = new sqlite3.Database(this.dbPath)
      await this.createTables()
      await this.initGlobalStatistics()
      await this.syncHistoryFromStats()
      logger.debug(logger.green('--------------------------[StatisticsDB] 初始化数据库完成--------------------------'))
    } catch (error) {
      logger.error('[StatisticsDB] 数据库初始化失败:', error)
      throw error
    }
    return this
  }

  async createTables() {
    const queries = [
      `CREATE TABLE IF NOT EXISTS ParseStatistics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        groupId TEXT NOT NULL,
        userId TEXT NOT NULL,
        platform TEXT NOT NULL,
        parseCount INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(groupId, userId, platform)
      )`,
      `CREATE TABLE IF NOT EXISTS ParseHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        totalParses INTEGER DEFAULT 0,
        douyin INTEGER DEFAULT 0,
        bilibili INTEGER DEFAULT 0,
        kuaishou INTEGER DEFAULT 0,
        xiaohongshu INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS GlobalStatistics (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    ]

    for (const query of queries) {
      await this.runQuery(query)
    }
  }

  async initGlobalStatistics() {
    for (const key of ['totalGroups', 'totalParses']) {
      const exists = await this.getQuery('SELECT * FROM GlobalStatistics WHERE key = ?', [key])
      if (!exists) {
        await this.runQuery('INSERT INTO GlobalStatistics (key, value, updatedAt) VALUES (?, ?, ?)', [
          key,
          '0',
          new Date().toISOString()
        ])
      }
    }
  }

  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db?.run(sql, params, function (err) {
        if (err) {
          reject(err)
        } else {
          resolve({ lastID: this.lastID, changes: this.changes })
        }
      })
    })
  }

  getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db?.get(sql, params, (err, row) => {
        if (err) {
          reject(err)
        } else {
          resolve(row)
        }
      })
    })
  }

  allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db?.all(sql, params, (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows)
        }
      })
    })
  }

  async recordParse(groupId, userId, platform) {
    if (!PLATFORMS.includes(platform)) return

    const now = new Date().toISOString()
    const today = now.split('T')[0]
    const existing = await this.getQuery(
      'SELECT * FROM ParseStatistics WHERE groupId = ? AND userId = ? AND platform = ?',
      [groupId, userId, platform]
    )

    if (existing) {
      await this.runQuery(
        'UPDATE ParseStatistics SET parseCount = parseCount + 1, updatedAt = ? WHERE groupId = ? AND userId = ? AND platform = ?',
        [now, groupId, userId, platform]
      )
    } else {
      await this.runQuery(
        'INSERT INTO ParseStatistics (groupId, userId, platform, parseCount, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)',
        [groupId, userId, platform, now, now]
      )
      await this.refreshTotalGroups()
    }

    await this.incrementTotalParses()
    await this.updateDailyHistory(today, platform)
  }

  async updateDailyHistory(date, platform) {
    const existing = await this.getQuery('SELECT * FROM ParseHistory WHERE date = ?', [date])
    if (existing) {
      await this.runQuery(`UPDATE ParseHistory SET totalParses = totalParses + 1, ${platform} = ${platform} + 1 WHERE date = ?`, [date])
      return
    }

    await this.runQuery(
      'INSERT INTO ParseHistory (date, totalParses, douyin, bilibili, kuaishou, xiaohongshu, createdAt) VALUES (?, 1, ?, ?, ?, ?, ?)',
      [
        date,
        platform === 'douyin' ? 1 : 0,
        platform === 'bilibili' ? 1 : 0,
        platform === 'kuaishou' ? 1 : 0,
        platform === 'xiaohongshu' ? 1 : 0,
        new Date().toISOString()
      ]
    )
  }

  async syncHistoryFromStats() {
    const historyCount = await this.getQuery('SELECT COUNT(*) as count FROM ParseHistory')
    if (historyCount?.count > 0) return

    const allStats = await this.getAllStatistics()
    const dateMap = new Map()
    for (const stat of allStats) {
      const date = stat.createdAt.split('T')[0]
      if (!dateMap.has(date)) {
        dateMap.set(date, { douyin: 0, bilibili: 0, kuaishou: 0, xiaohongshu: 0 })
      }
      dateMap.get(date)[stat.platform] += stat.parseCount
    }

    for (const [date, platforms] of dateMap.entries()) {
      const totalParses = PLATFORMS.reduce((sum, platform) => sum + platforms[platform], 0)
      await this.runQuery(
        'INSERT OR IGNORE INTO ParseHistory (date, totalParses, douyin, bilibili, kuaishou, xiaohongshu, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [date, totalParses, platforms.douyin, platforms.bilibili, platforms.kuaishou, platforms.xiaohongshu, new Date().toISOString()]
      )
    }
  }

  async getGroupStatistics(groupId) {
    return await this.allQuery('SELECT * FROM ParseStatistics WHERE groupId = ? ORDER BY platform, userId', [groupId])
  }

  async getGroupUniqueUsers(groupId) {
    const result = await this.getQuery('SELECT COUNT(DISTINCT userId) as count FROM ParseStatistics WHERE groupId = ?', [groupId])
    return result?.count || 0
  }

  async getTotalUniqueUsers() {
    const result = await this.getQuery('SELECT COUNT(DISTINCT userId) as count FROM ParseStatistics')
    return result?.count || 0
  }

  async getAllStatistics() {
    return await this.allQuery('SELECT * FROM ParseStatistics ORDER BY groupId, platform')
  }

  async getRecentHistory(days = 30) {
    return await this.allQuery('SELECT * FROM ParseHistory ORDER BY date DESC LIMIT ?', [days])
  }

  async getPlatformTotalParses(platform) {
    const result = await this.getQuery('SELECT SUM(parseCount) as total FROM ParseStatistics WHERE platform = ?', [platform])
    return result?.total || 0
  }

  async getTotalGroups() {
    const result = await this.getQuery('SELECT COUNT(DISTINCT groupId) as count FROM ParseStatistics')
    return result?.count || 0
  }

  async getTotalParses() {
    const result = await this.getQuery('SELECT value FROM GlobalStatistics WHERE key = ?', ['totalParses'])
    return Number.parseInt(result?.value || '0', 10)
  }

  async refreshTotalGroups() {
    const totalGroups = await this.getTotalGroups()
    await this.runQuery('UPDATE GlobalStatistics SET value = ?, updatedAt = ? WHERE key = ?', [
      String(totalGroups),
      new Date().toISOString(),
      'totalGroups'
    ])
  }

  async incrementTotalParses() {
    await this.runQuery('UPDATE GlobalStatistics SET value = value + 1, updatedAt = ? WHERE key = ?', [
      new Date().toISOString(),
      'totalParses'
    ])
  }

  async getGlobalSummary() {
    return {
      totalGroups: await this.getTotalGroups(),
      totalParses: await this.getTotalParses(),
      totalUsers: await this.getTotalUniqueUsers(),
      platformStats: {
        douyin: await this.getPlatformTotalParses('douyin'),
        bilibili: await this.getPlatformTotalParses('bilibili'),
        kuaishou: await this.getPlatformTotalParses('kuaishou'),
        xiaohongshu: await this.getPlatformTotalParses('xiaohongshu')
      }
    }
  }
}
