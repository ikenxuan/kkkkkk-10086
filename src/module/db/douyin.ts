import type { Database, RunResult as Sqlite3RunResult } from 'sqlite3'
import sqlite3 from 'sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import Version from '@/module/utils/Version'
import Config from '@/module/utils/Config'
import type { DouyinPushItem } from '@/types/config'
import type {
  AwemeCacheRow,
  BotRow,
  CountResult,
  DouyinFilterConfig,
  DouyinFilterTagRow,
  DouyinFilterWordRow,
  DouyinPushType,
  DouyinSubscriptionRow,
  DouyinSubscriptionWithUser,
  DouyinUserRow,
  FilterMode,
  GroupRow,
  RunResult,
  TableColumnInfo
} from '@/types/database'
import { KEEP_PER_TARGET } from './retention.js'

/** shouldFilter 读取的推送项字段 */
export interface DouyinFilterPushItem {
  sec_uid?: string
  remark?: string
  Detail_Data: {
    desc?: string
    aweme_id?: string
    share_url?: string
  }
}

export type AwemeCacheWithDates = Omit<AwemeCacheRow, 'createdAt' | 'updatedAt'> & {
  createdAt: Date
  updatedAt: Date
  douyinUser?: DouyinUserRow | null
}

interface AwemeCacheFindOptions {
  where?: {
    groupId?: string
    sec_uid?: string
    aweme_id?: string
  }
  order?: Record<string, 'ASC' | 'DESC'>
  take?: number
  relations?: string[]
}

interface AwemeCacheDeleteConditions {
  groupId?: string
  sec_uid?: string
  aweme_id?: string
}

export class DouyinDBBase {
  db: Database | null = null
  dbPath: string

  /**
   * @param {string} [dataPath] 数据目录，缺省时使用插件根目录下的 `data`
   */
  constructor (dataPath?: string) {
    this.dbPath = path.join(dataPath ?? path.join(Version.pluginPath, 'data'), 'douyin.db')
  }

  async init (): Promise<this> {
    try {
      logger.debug(logger.green('--------------------------[DouyinDB] 开始初始化数据库--------------------------'))
      logger.debug('[DouyinDB] 正在连接数据库...')
      await fs.promises.mkdir(path.dirname(this.dbPath), { recursive: true })
      this.db = new sqlite3.Database(this.dbPath)
      await this.createTables()
      logger.debug('[DouyinDB] 数据库模型同步成功')
      logger.debug('[DouyinDB] 正在同步配置订阅...')
      logger.debug('[DouyinDB] 配置项数量:', Config.pushlist.douyin?.length || 0)
      await this.syncConfigSubscriptions(Config.pushlist.douyin || [])
      logger.debug('[DouyinDB] 配置订阅同步成功')
      logger.debug(logger.green('--------------------------[DouyinDB] 初始化数据库完成--------------------------'))
    } catch (error) {
      logger.error('[DouyinDB] 数据库初始化失败:', error)
      throw error
    }
    return this
  }

  async createTables (): Promise<void> {
    const queries = [
      `CREATE TABLE IF NOT EXISTS Bots (
        id TEXT PRIMARY KEY,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS Groups (
        id TEXT PRIMARY KEY,
        botId TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (botId) REFERENCES Bots(id)
      )`,

      `CREATE TABLE IF NOT EXISTS DouyinUsers (
        sec_uid TEXT PRIMARY KEY,
        short_id TEXT,
        remark TEXT,
        living INTEGER DEFAULT 0,
        filterMode TEXT DEFAULT 'blacklist',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS GroupUserSubscriptions (
        groupId TEXT,
        sec_uid TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (groupId, sec_uid),
        FOREIGN KEY (groupId) REFERENCES Groups(id),
        FOREIGN KEY (sec_uid) REFERENCES DouyinUsers(sec_uid)
      )`,

      `CREATE TABLE IF NOT EXISTS AwemeCaches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aweme_id TEXT NOT NULL,
        sec_uid TEXT NOT NULL,
        groupId TEXT NOT NULL,
        pushType TEXT NOT NULL DEFAULT 'post',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sec_uid) REFERENCES DouyinUsers(sec_uid),
        FOREIGN KEY (groupId) REFERENCES Groups(id),
        UNIQUE(aweme_id, sec_uid, groupId, pushType)
      )`,

      `CREATE TABLE IF NOT EXISTS FilterWords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sec_uid TEXT NOT NULL,
        word TEXT NOT NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        douyinUserSecUid TEXT,
        FOREIGN KEY (douyinUserSecUid) REFERENCES DouyinUsers(sec_uid),
        UNIQUE(sec_uid, word)
      )`,

      `CREATE TABLE IF NOT EXISTS FilterTags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sec_uid TEXT NOT NULL,
        tag TEXT NOT NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        douyinUserSecUid TEXT,
        FOREIGN KEY (douyinUserSecUid) REFERENCES DouyinUsers(sec_uid),
        UNIQUE(sec_uid, tag)
      )`
    ]
    for (const query of queries) {
      await this.runQuery(query)
    }
    await this.migrateAwemeCachesPushType()
  }

  /**
   * 迁移旧 AwemeCaches 表，为不同推送类型拆分去重缓存。
   */
  async migrateAwemeCachesPushType (): Promise<void> {
    const columns = await this.allQuery<TableColumnInfo>('PRAGMA table_info(AwemeCaches)')
    const hasPushType = columns.some(column => column.name === 'pushType')
    if (hasPushType) return

    logger.mark('[DouyinDB] 迁移 AwemeCaches 表，增加 pushType 字段')
    await this.runQuery('ALTER TABLE AwemeCaches RENAME TO AwemeCaches_old')
    await this.runQuery(`CREATE TABLE AwemeCaches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aweme_id TEXT NOT NULL,
      sec_uid TEXT NOT NULL,
      groupId TEXT NOT NULL,
      pushType TEXT NOT NULL DEFAULT 'post',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sec_uid) REFERENCES DouyinUsers(sec_uid),
      FOREIGN KEY (groupId) REFERENCES Groups(id),
      UNIQUE(aweme_id, sec_uid, groupId, pushType)
    )`)
    await this.runQuery(`INSERT OR IGNORE INTO AwemeCaches (id, aweme_id, sec_uid, groupId, pushType, createdAt, updatedAt)
      SELECT id, aweme_id, sec_uid, groupId, 'post', createdAt, updatedAt FROM AwemeCaches_old`)
    await this.runQuery('DROP TABLE AwemeCaches_old')
  }

  runQuery (sql: string, params: unknown[] = []): Promise<RunResult> {
    return new Promise((resolve, reject) => {
      this.db?.run(sql, params, function (this: Sqlite3RunResult, err: Error | null) {
        if (err) {
          reject(err)
        } else {
          resolve({ lastID: this.lastID, changes: this.changes })
        }
      })
    })
  }

  getQuery<T> (sql: string, params: unknown[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db?.get<T>(sql, params, (err, row) => {
        if (err) {
          reject(err)
        } else {
          resolve(row)
        }
      })
    })
  }

  allQuery<T> (sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db?.all<T>(sql, params, (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows)
        }
      })
    })
  }

  async getOrCreateBot (botId: string): Promise<BotRow> {
    let bot = await this.getQuery<BotRow>('SELECT * FROM Bots WHERE id = ?', [botId])
    if (!bot) {
      const now = new Date().toISOString()
      await this.runQuery(
        'INSERT INTO Bots (id, createdAt, updatedAt) VALUES (?, ?, ?)',
        [botId, now, now]
      )
      bot = { id: botId, createdAt: now, updatedAt: now }
    }
    return bot
  }

  async getOrCreateGroup (groupId: string, botId: string): Promise<GroupRow> {
    await this.getOrCreateBot(botId)
    let group = await this.getQuery<GroupRow>('SELECT * FROM Groups WHERE id = ?', [groupId])
    if (!group) {
      const now = new Date().toISOString()
      await this.runQuery(
        'INSERT INTO Groups (id, botId, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
        [groupId, botId, now, now]
      )
      group = { id: groupId, botId, createdAt: now, updatedAt: now }
    } else if (group.botId !== botId) {
      const now = new Date().toISOString()
      await this.runQuery(
        'UPDATE Groups SET botId = ?, updatedAt = ? WHERE id = ?',
        [botId, now, groupId]
      )
      group.botId = botId
      group.updatedAt = now
    }
    return group
  }

  async getOrCreateDouyinUser (sec_uid: string, short_id = '', remark = ''): Promise<DouyinUserRow> {
    let user = await this.getQuery<DouyinUserRow>('SELECT * FROM DouyinUsers WHERE sec_uid = ?', [sec_uid])
    if (!user) {
      const now = new Date().toISOString()
      await this.runQuery(
        'INSERT INTO DouyinUsers (sec_uid, short_id, remark, living, filterMode, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [sec_uid, short_id, remark, 0, 'blacklist', now, now]
      )
      user = {
        sec_uid,
        short_id,
        remark,
        living: false,
        filterMode: 'blacklist',
        createdAt: now,
        updatedAt: now
      }
    } else {
      // living 在表里是 INTEGER，SELECT * 读回来是 0/1，和 getDouyinUser 一样转成 boolean，
      // 否则类型写着 boolean、运行时却是 number，`=== true` 之类的判断会静默失败
      user.living = !!user.living
      let needUpdate = false
      const updates: string[] = []
      const params: unknown[] = []
      if (remark && user.remark !== remark) {
        updates.push('remark = ?')
        params.push(remark)
        user.remark = remark
        needUpdate = true
      }
      if (short_id && user.short_id !== short_id) {
        updates.push('short_id = ?')
        params.push(short_id)
        user.short_id = short_id
        needUpdate = true
      }
      if (needUpdate) {
        const now = new Date().toISOString()
        updates.push('updatedAt = ?')
        params.push(now)
        params.push(sec_uid)
        await this.runQuery(
          `UPDATE DouyinUsers SET ${updates.join(', ')} WHERE sec_uid = ?`,
          params
        )
        user.updatedAt = now
      }
    }
    return user
  }

  async subscribeDouyinUser (
    groupId: string,
    botId: string,
    sec_uid: string,
    short_id = '',
    remark = ''
  ): Promise<DouyinSubscriptionRow> {
    await this.getOrCreateGroup(groupId, botId)
    await this.getOrCreateDouyinUser(sec_uid, short_id, remark)
    let subscription = await this.getQuery<DouyinSubscriptionRow>(
      'SELECT * FROM GroupUserSubscriptions WHERE groupId = ? AND sec_uid = ?',
      [groupId, sec_uid]
    )
    if (!subscription) {
      const now = new Date().toISOString()
      await this.runQuery(
        'INSERT INTO GroupUserSubscriptions (groupId, sec_uid, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
        [groupId, sec_uid, now, now]
      )
      subscription = { groupId, sec_uid, createdAt: now, updatedAt: now }
    }
    return subscription
  }

  async unsubscribeDouyinUser (groupId: string, sec_uid: string): Promise<boolean> {
    const result = await this.runQuery(
      'DELETE FROM GroupUserSubscriptions WHERE groupId = ? AND sec_uid = ?',
      [groupId, sec_uid]
    )
    await this.runQuery(
      'DELETE FROM AwemeCaches WHERE groupId = ? AND sec_uid = ?',
      [groupId, sec_uid]
    )
    return result.changes > 0
  }

  async addAwemeCache (
    aweme_id: string,
    sec_uid: string,
    groupId: string,
    pushType: DouyinPushType = 'post'
  ): Promise<AwemeCacheRow> {
    let cache = await this.getQuery<AwemeCacheRow>(
      'SELECT * FROM AwemeCaches WHERE aweme_id = ? AND sec_uid = ? AND groupId = ? AND pushType = ?',
      [aweme_id, sec_uid, groupId, pushType]
    )
    if (!cache) {
      const now = new Date().toISOString()
      const result = await this.runQuery(
        'INSERT INTO AwemeCaches (aweme_id, sec_uid, groupId, pushType, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [aweme_id, sec_uid, groupId, pushType, now, now]
      )
      cache = {
        id: result.lastID,
        aweme_id,
        sec_uid,
        groupId,
        pushType,
        createdAt: now,
        updatedAt: now
      }
    }
    return cache
  }

  async isAwemePushed (
    aweme_id: string,
    sec_uid: string,
    groupId: string,
    pushType: DouyinPushType = 'post'
  ): Promise<boolean> {
    const result = await this.getQuery<CountResult>(
      'SELECT COUNT(*) as count FROM AwemeCaches WHERE aweme_id = ? AND sec_uid = ? AND groupId = ? AND pushType = ?',
      [aweme_id, sec_uid, groupId, pushType]
    )
    return (result?.count || 0) > 0
  }

  async hasHistory (sec_uid: string, groupId: string, pushType: DouyinPushType = 'post'): Promise<boolean> {
    const result = await this.getQuery<CountResult>(
      'SELECT COUNT(*) as count FROM AwemeCaches WHERE sec_uid = ? AND groupId = ? AND pushType = ?',
      [sec_uid, groupId, pushType]
    )
    return (result?.count || 0) > 0
  }

  /**
   * 兼容 Karin 新版列表快照接口。当前 Yunzai 版直接复用 AwemeCaches 去重。
   */
  async updateListSnapshot (): Promise<void> {}

  async getBotGroups (botId: string): Promise<GroupRow[]> {
    return await this.allQuery<GroupRow>('SELECT * FROM Groups WHERE botId = ?', [botId])
  }

  async getGroupSubscriptions (groupId: string): Promise<DouyinSubscriptionWithUser[]> {
    const subscriptions = await this.allQuery<{
      groupId: string
      sec_uid: string
      createdAt: string
      updatedAt: string
      short_id?: string
      remark?: string
      living: number
      filterMode: FilterMode
      du_createdAt: string
      du_updatedAt: string
    }>(
      `SELECT
        gus.groupId, gus.sec_uid, gus.createdAt, gus.updatedAt,
        du.short_id, du.remark, du.living, du.filterMode,
        du.createdAt as du_createdAt, du.updatedAt as du_updatedAt
      FROM GroupUserSubscriptions gus
      LEFT JOIN DouyinUsers du ON gus.sec_uid = du.sec_uid
      WHERE gus.groupId = ?`,
      [groupId]
    )
    return subscriptions.map(sub => ({
      groupId: sub.groupId,
      sec_uid: sub.sec_uid,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
      douyinUser: {
        sec_uid: sub.sec_uid,
        short_id: sub.short_id,
        remark: sub.remark,
        living: !!sub.living,
        filterMode: sub.filterMode,
        createdAt: sub.du_createdAt,
        updatedAt: sub.du_updatedAt
      }
    }))
  }

  async getUserSubscribedGroups (sec_uid: string): Promise<GroupRow[]> {
    return await this.allQuery<GroupRow>(
      `SELECT g.* FROM Groups g
      INNER JOIN GroupUserSubscriptions gus ON g.id = gus.groupId
      WHERE gus.sec_uid = ?`,
      [sec_uid]
    )
  }

  async isSubscribed (sec_uid: string, groupId: string): Promise<boolean> {
    const result = await this.getQuery<CountResult>(
      'SELECT COUNT(*) as count FROM GroupUserSubscriptions WHERE sec_uid = ? AND groupId = ?',
      [sec_uid, groupId]
    )
    return (result?.count || 0) > 0
  }

  async getDouyinUser (sec_uid: string): Promise<DouyinUserRow | null> {
    const user = await this.getQuery<DouyinUserRow>('SELECT * FROM DouyinUsers WHERE sec_uid = ?', [sec_uid])
    if (user) {
      user.living = !!user.living
    }
    return user || null
  }

  async updateLiveStatus (sec_uid: string, living: boolean): Promise<boolean> {
    const user = await this.getDouyinUser(sec_uid)
    if (!user) return false
    const now = new Date().toISOString()
    const result = await this.runQuery(
      'UPDATE DouyinUsers SET living = ?, updatedAt = ? WHERE sec_uid = ?',
      [living ? 1 : 0, now, sec_uid]
    )
    return result.changes > 0
  }

  async getLiveStatus (sec_uid: string): Promise<{ living: boolean }> {
    const user = await this.getDouyinUser(sec_uid)
    return { living: user?.living || false }
  }

  /**
   * 批量同步配置文件中的订阅到数据库
   */
  async syncConfigSubscriptions (configItems: DouyinPushItem[]): Promise<void> {
    // 1. 收集配置文件中的所有订阅关系
    const configSubscriptions = new Map<string, Set<string>>()
    for (const item of configItems) {
      // 配置文件始终写入 sec_uid，补默认值会改变旧实现对缺失项的处理
      const sec_uid = item.sec_uid as string
      const short_id = item.short_id ?? ''
      const remark = item.remark ?? ''
      await this.getOrCreateDouyinUser(sec_uid, short_id, remark)
      for (const groupWithBot of item.group_id) {
        const [groupId, botId] = groupWithBot.split(':')
        if (!groupId || !botId) continue
        await this.getOrCreateGroup(groupId, botId)
        if (!configSubscriptions.has(groupId)) {
          configSubscriptions.set(groupId, new Set())
        }
        configSubscriptions.get(groupId)?.add(sec_uid)
        const isSubscribed = await this.isSubscribed(sec_uid, groupId)
        if (!isSubscribed) {
          await this.subscribeDouyinUser(groupId, botId, sec_uid, short_id, remark)
        }
      }
    }
    // 2. 获取数据库中的所有订阅关系，并与配置文件比较，删除不在配置文件中的订阅
    const allGroups = await this.allQuery<GroupRow>('SELECT * FROM Groups')
    for (const group of allGroups) {
      const groupId = group.id
      const configUsers = configSubscriptions.get(groupId) ?? new Set<string>()
      const dbSubscriptions = await this.getGroupSubscriptions(groupId)
      for (const subscription of dbSubscriptions) {
        const sec_uid = subscription.sec_uid
        if (!configUsers.has(sec_uid)) {
          await this.unsubscribeDouyinUser(groupId, sec_uid)
          logger.mark(`已删除群组 ${groupId} 对抖音用户 ${sec_uid} 的订阅`)
        }
      }
    }
    // 3. 清理不再被任何群组订阅的抖音用户记录及其过滤词和过滤标签
    const allUsers = await this.allQuery<DouyinUserRow>('SELECT * FROM DouyinUsers')
    for (const user of allUsers) {
      const sec_uid = user.sec_uid
      const subscribedGroups = await this.getUserSubscribedGroups(sec_uid)
      if (subscribedGroups.length === 0) {
        await this.runQuery('DELETE FROM FilterWords WHERE sec_uid = ?', [sec_uid])
        await this.runQuery('DELETE FROM FilterTags WHERE sec_uid = ?', [sec_uid])
        await this.runQuery('DELETE FROM DouyinUsers WHERE sec_uid = ?', [sec_uid])
        logger.mark(`已删除抖音用户 ${sec_uid} 的记录及相关过滤设置（不再被任何群组订阅）`)
      }
    }
  }

  async getGroupById (groupId: string): Promise<GroupRow | null> {
    return await this.getQuery<GroupRow>('SELECT * FROM Groups WHERE id = ?', [groupId]) || null
  }

  async updateFilterMode (sec_uid: string, filterMode: FilterMode): Promise<DouyinUserRow> {
    const user = await this.getOrCreateDouyinUser(sec_uid)
    const now = new Date().toISOString()
    await this.runQuery(
      'UPDATE DouyinUsers SET filterMode = ?, updatedAt = ? WHERE sec_uid = ?',
      [filterMode, now, sec_uid]
    )
    return { ...user, filterMode, updatedAt: now }
  }

  async addFilterWord (sec_uid: string, word: string): Promise<DouyinFilterWordRow> {
    await this.getOrCreateDouyinUser(sec_uid)
    let filterWord = await this.getQuery<DouyinFilterWordRow>(
      'SELECT * FROM FilterWords WHERE sec_uid = ? AND word = ?',
      [sec_uid, word]
    )
    if (!filterWord) {
      const now = new Date().toISOString()
      const result = await this.runQuery(
        'INSERT INTO FilterWords (sec_uid, douyinUserSecUid, word, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
        [sec_uid, sec_uid, word, now, now]
      )
      filterWord = {
        id: result.lastID,
        sec_uid,
        douyinUserSecUid: sec_uid,
        word,
        createdAt: now,
        updatedAt: now
      }
    }
    return filterWord
  }

  async removeFilterWord (sec_uid: string, word: string): Promise<boolean> {
    const result = await this.runQuery(
      'DELETE FROM FilterWords WHERE sec_uid = ? AND word = ?',
      [sec_uid, word]
    )
    return result.changes > 0
  }

  async addFilterTag (sec_uid: string, tag: string): Promise<DouyinFilterTagRow> {
    await this.getOrCreateDouyinUser(sec_uid)
    let filterTag = await this.getQuery<DouyinFilterTagRow>(
      'SELECT * FROM FilterTags WHERE sec_uid = ? AND tag = ?',
      [sec_uid, tag]
    )
    if (!filterTag) {
      const now = new Date().toISOString()
      const result = await this.runQuery(
        'INSERT INTO FilterTags (sec_uid, douyinUserSecUid, tag, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
        [sec_uid, sec_uid, tag, now, now]
      )
      filterTag = {
        id: result.lastID,
        sec_uid,
        douyinUserSecUid: sec_uid,
        tag,
        createdAt: now,
        updatedAt: now
      }
    }
    return filterTag
  }

  async removeFilterTag (sec_uid: string, tag: string): Promise<boolean> {
    const result = await this.runQuery(
      'DELETE FROM FilterTags WHERE sec_uid = ? AND tag = ?',
      [sec_uid, tag]
    )
    return result.changes > 0
  }

  async getFilterWords (sec_uid: string): Promise<string[]> {
    const filterWords = await this.allQuery<DouyinFilterWordRow>('SELECT * FROM FilterWords WHERE sec_uid = ?', [sec_uid])
    return filterWords.map(word => word.word)
  }

  async getFilterTags (sec_uid: string): Promise<string[]> {
    const filterTags = await this.allQuery<DouyinFilterTagRow>('SELECT * FROM FilterTags WHERE sec_uid = ?', [sec_uid])
    return filterTags.map(tag => tag.tag)
  }

  async getFilterConfig (sec_uid: string): Promise<DouyinFilterConfig> {
    const user = await this.getOrCreateDouyinUser(sec_uid)
    const filterWords = await this.getFilterWords(sec_uid)
    const filterTags = await this.getFilterTags(sec_uid)
    return {
      filterMode: user.filterMode,
      filterWords,
      filterTags
    }
  }

  async shouldFilter (PushItem: DouyinFilterPushItem, tags: string[] = []): Promise<boolean> {
    // 使用 PushItem.sec_uid 而不是 PushItem.Detail_Data.sec_uid
    const sec_uid = PushItem.sec_uid
    if (!sec_uid) {
      logger.warn(`推送项缺少 sec_uid 参数: ${JSON.stringify(PushItem)}`)
      return false // 如果没有 sec_uid，默认不过滤
    }
    const { filterMode, filterWords, filterTags } = await this.getFilterConfig(sec_uid)
    logger.debug(`
      获取用户${PushItem.remark}（${PushItem.sec_uid}）的过滤配置：
      过滤模式：${filterMode}
      过滤词：${filterWords}
      过滤标签：${filterTags}
      `)
    const desc = PushItem.Detail_Data.desc ?? ''
    const hasFilterWord = filterWords.some(word => desc.includes(word))
    const hasFilterTag = filterTags.some(
      filterTag => tags.some(tag => tag === filterTag)
    )
    logger.debug(`
      作者：${PushItem.remark}
      检查内容：${desc}
      命中词：[${filterWords.join('], [')}]
      命中标签：[${filterTags.join('], [')}]
      过滤模式：${filterMode}
      是否过滤：${hasFilterWord || hasFilterTag ? logger.red(`${hasFilterWord || hasFilterTag}`) : logger.green(`${hasFilterWord || hasFilterTag}`)}
      作品地址：${logger.green(`https://www.douyin.com/video/${PushItem.Detail_Data.aweme_id}`)}
      `)
    if (filterMode === 'blacklist') {
      if (hasFilterWord || hasFilterTag) {
        logger.warn(`
          作品内容命中黑名单规则，已过滤该作品不再推送
          作品地址：${logger.yellow(PushItem.Detail_Data.share_url)}
          命中的黑名单词：[${filterWords.join('], [')}]
          命中的黑名单标签：[${filterTags.join('], [')}]
          `)
        return true
      }
      return false
    } else {
      // 白名单模式：如果不包含任何白名单词或白名单标签，则过滤
      // 注意：如果白名单为空，则不过滤任何内容
      if (filterWords.length === 0 && filterTags.length === 0) {
        return false
      }
      if (hasFilterWord || hasFilterTag) {
        return false
      }
      logger.warn(`
        作品内容未命中白名单规则，已过滤该作品不再推送
        作品地址：${logger.yellow(PushItem.Detail_Data.share_url)}
        命中的黑名单词：[${filterWords.join('], [')}]
        命中的黑名单标签：[${filterTags.join('], [')}]
        `)
      return true
    }
  }

  /**
   * 清理旧的作品缓存记录。
   *
   * 判据是「够老」**并且**「不在该订阅目标最新 N 条之内」，两个条件同时满足才删。
   * 只按年龄删会重复推送 —— 这张表里的行就是「这条作品对这个群推过了」的去重键，
   * 键消失而作品还在接口返回里，就会被当成新作品再推一遍。喜欢 / 推荐这两种
   * pushType 压根没有「多久以前的不推」这道时间窗，只能靠键本身活得够久。
   *
   * 分区带上 pushType：同一条作品在 post / favorite / recommend 下是三个独立的
   * 去重键（表上的 UNIQUE 也是这么定的），不分开算会让一种类型的行挤掉另一种的。
   *
   * 详细理由见 bilibili 侧同名方法的注释。
   *
   * @param days 年龄阈值（天）
   */
  async cleanOldAwemeCache (days = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const result = await this.runQuery(
      `DELETE FROM AwemeCaches
       WHERE datetime(createdAt) < datetime(?)
         AND id NOT IN (
           SELECT id FROM (
             SELECT id, ROW_NUMBER() OVER (
               PARTITION BY sec_uid, groupId, pushType
               ORDER BY datetime(createdAt) DESC, id DESC
             ) AS rn
             FROM AwemeCaches
           ) WHERE rn <= ?
         )`,
      [cutoffDate.toISOString(), KEEP_PER_TARGET]
    )
    return result.changes ?? 0
  }

  /** 为了向后兼容，保留groupRepository和awemeCacheRepository属性 */
  get groupRepository (): { find: (options?: { where?: { botId?: string } }) => Promise<GroupRow[]> } {
    return {
      find: async options => {
        if (options?.where?.botId) {
          return await this.getBotGroups(options.where.botId)
        }
        return await this.allQuery<GroupRow>('SELECT * FROM Groups')
      }
    }
  }

  get awemeCacheRepository (): { find: (options?: AwemeCacheFindOptions) => Promise<AwemeCacheWithDates[]>; delete: (conditions: AwemeCacheDeleteConditions) => Promise<{ affected: number }> } {
    return {
      find: async (options = {}) => {
        const { where = {}, order, take, relations } = options
        let sql = 'SELECT * FROM AwemeCaches'
        const params: unknown[] = []
        const conditions: string[] = []
        if (where.groupId) {
          conditions.push('groupId = ?')
          params.push(where.groupId)
        }
        if (where.sec_uid) {
          conditions.push('sec_uid = ?')
          params.push(where.sec_uid)
        }
        if (where.aweme_id) {
          conditions.push('aweme_id = ?')
          params.push(where.aweme_id)
        }
        if (conditions.length > 0) {
          sql += ' WHERE ' + conditions.join(' AND ')
        }
        if (order) {
          const orderClauses: string[] = []
          const allowedFields = ['id', 'aweme_id', 'sec_uid', 'groupId', 'createdAt', 'updatedAt']
          const allowedDirections = ['ASC', 'DESC']
          for (const [field, direction] of Object.entries(order)) {
            if (allowedFields.includes(field) && allowedDirections.includes(direction)) {
              orderClauses.push(`${field} ${direction}`)
            }
          }
          if (orderClauses.length > 0) {
            sql += ' ORDER BY ' + orderClauses.join(', ')
          }
        }
        if (take) {
          sql += ' LIMIT ?'
          params.push(take.toString())
        }
        const caches = await this.allQuery<AwemeCacheRow>(sql, params)
        if (relations && relations.includes('douyinUser')) {
          const result: AwemeCacheWithDates[] = []
          for (const cache of caches) {
            const douyinUser = await this.getDouyinUser(cache.sec_uid)
            result.push({
              ...cache,
              douyinUser,
              createdAt: new Date(cache.createdAt),
              updatedAt: new Date(cache.updatedAt)
            })
          }
          return result
        }
        return caches.map(cache => ({
          ...cache,
          createdAt: new Date(cache.createdAt),
          updatedAt: new Date(cache.updatedAt)
        }))
      },
      delete: async conditions => {
        const { groupId, sec_uid, aweme_id } = conditions
        if (groupId && sec_uid) {
          const result = await this.runQuery(
            'DELETE FROM AwemeCaches WHERE groupId = ? AND sec_uid = ?',
            [groupId, sec_uid]
          )
          return { affected: result.changes }
        }
        if (groupId) {
          const result = await this.runQuery(
            'DELETE FROM AwemeCaches WHERE groupId = ?',
            [groupId]
          )
          return { affected: result.changes }
        }
        if (sec_uid) {
          const result = await this.runQuery(
            'DELETE FROM AwemeCaches WHERE sec_uid = ?',
            [sec_uid]
          )
          return { affected: result.changes }
        }
        if (aweme_id) {
          const result = await this.runQuery(
            'DELETE FROM AwemeCaches WHERE aweme_id = ?',
            [aweme_id]
          )
          return { affected: result.changes }
        }
        return { affected: 0 }
      }
    }
  }
}
