import { logger, Config, Version } from '../utils/index.js'
import { join } from 'node:path'
import sqlite3 from 'sqlite3'

/**
 * 抖音推送数据类型
 * @typedef {import('../utils/Config.js').douyinPushItem} douyinPushItem
 * @typedef {import('../platform/douyin/push.js').DouyinPushItem} DouyinPushItem
 */

/**
 * 机器人接口 - 存储机器人信息
 * @typedef {Object} Bot
 * @property {string} id - 机器人ID
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 */

/**
 * 群组接口 - 存储群组信息
 * @typedef {Object} Group
 * @property {string} id - 群组ID
 * @property {string} botId - 所属机器人ID
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 */

/**
 * 抖音用户接口 - 存储抖音用户信息
 * @typedef {Object} DouyinUser
 * @property {string} sec_uid - 抖音用户sec_uid
 * @property {string} [short_id] - 抖音号
 * @property {string} [remark] - 抖音用户昵称
 * @property {boolean} living - 是否正在直播
 * @property {string} filterMode - 过滤模式：黑名单或白名单
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 */

/**
 * 群组用户订阅关系接口 - 存储群组订阅的抖音用户关系
 * @typedef {Object} GroupUserSubscription
 * @property {string} groupId - 群组ID
 * @property {string} sec_uid - 抖音用户sec_uid
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 */

/**
 * 抖音缓存接口 - 存储抖音作品缓存
 * @typedef {Object} AwemeCache
 * @property {number} id - 缓存ID
 * @property {string} aweme_id - 作品ID
 * @property {string} sec_uid - 抖音用户sec_uid
 * @property {string} groupId - 群组ID
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 */

/**
 * 过滤词接口 - 存储过滤词
 * @typedef {Object} FilterWord
 * @property {number} id - 过滤词ID
 * @property {string} sec_uid - 抖音用户sec_uid
 * @property {string} word - 过滤词
 * @property {string} douyinUserSecUid - 抖音用户sec_uid（外键）
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 */

/**
 * 过滤标签接口 - 存储过滤标签
 * @typedef {Object} FilterTag
 * @property {number} id - 过滤标签ID
 * @property {string} sec_uid - 抖音用户sec_uid
 * @property {string} tag - 过滤标签
 * @property {string} douyinUserSecUid - 抖音用户sec_uid（外键）
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 */

/** 数据库操作类 */
export class DouyinDBBase {
  /** @type {sqlite3.Database} */
  #db

  /** @type {string} */
  #dbPath

  constructor() {
    this.#dbPath = join(Version.pluginPath, 'data', 'douyin.db')
  }

  /**
   * 初始化数据库
   * @returns {Promise<DouyinDBBase>}
   */
  async init() {
    try {
      logger.debug(logger.green('--------------------------[DouyinDB] 开始初始化数据库--------------------------'))
      logger.debug('[DouyinDB] 正在连接数据库...')

      // 创建数据库连接
      this.#db = new sqlite3.Database(this.#dbPath)

      // 创建表结构
      await this.#createTables()

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

  /**
   * 创建数据库表结构
   * @returns {Promise<void>}
   */
  async #createTables() {
    const queries = [
      // 创建机器人表
      `CREATE TABLE IF NOT EXISTS Bots (
        id TEXT PRIMARY KEY,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL
      )`,

      // 创建群组表
      `CREATE TABLE IF NOT EXISTS Groups (
        id TEXT PRIMARY KEY,
        botId TEXT NOT NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        FOREIGN KEY (botId) REFERENCES Bots(id)
      )`,

      // 创建抖音用户表
      `CREATE TABLE IF NOT EXISTS DouyinUsers (
        sec_uid TEXT PRIMARY KEY,
        short_id TEXT,
        remark TEXT,
        living INTEGER DEFAULT 0,
        filterMode TEXT DEFAULT 'blacklist',
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL
      )`,

      // 创建群组用户订阅关系表
      `CREATE TABLE IF NOT EXISTS GroupUserSubscriptions (
        groupId TEXT,
        sec_uid TEXT,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        PRIMARY KEY (groupId, sec_uid),
        FOREIGN KEY (groupId) REFERENCES Groups(id),
        FOREIGN KEY (sec_uid) REFERENCES DouyinUsers(sec_uid)
      )`,

      // 创建作品缓存表
      `CREATE TABLE IF NOT EXISTS AwemeCaches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aweme_id TEXT NOT NULL,
        sec_uid TEXT NOT NULL,
        groupId TEXT NOT NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        FOREIGN KEY (sec_uid) REFERENCES DouyinUsers(sec_uid),
        FOREIGN KEY (groupId) REFERENCES Groups(id),
        UNIQUE(aweme_id, sec_uid, groupId)
      )`,

      // 创建过滤词表
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

      // 创建过滤标签表
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
      await this.#runQuery(query)
    }
  }

  /**
   * 执行SQL查询
   * @param {string} sql - SQL语句
   * @param {Array<any>} [params=[]] - 参数
   * @returns {Promise<any>}
   */
  async #runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.#db.run(sql, params, function (err) {
        if (err) {
          reject(err)
        } else {
          resolve({ lastID: this.lastID, changes: this.changes })
        }
      })
    })
  }

  /**
   * 执行SQL查询并获取单个结果
   * @template T
   * @param {string} sql - SQL语句
   * @param {Array<any>} [params=[]] - 参数
   * @returns {Promise<T|undefined>}
   */
  async #getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.#db.get(sql, params, (err, row) => {
        if (err) {
          reject(err)
        } else {
          resolve(row)
        }
      })
    })
  }

  /**
   * 执行SQL查询并获取所有结果
   * @template T
   * @param {string} sql - SQL语句
   * @param {Array<any>} [params=[]] - 参数
   * @returns {Promise<T[]>}
   */
  async #allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.#db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows)
        }
      })
    })
  }

  /**
   * 获取或创建机器人记录
   * @param {string} botId - 机器人ID
   * @returns {Promise<Bot>}
   */
  async getOrCreateBot(botId) {
    let bot = await this.#getQuery('SELECT * FROM Bots WHERE id = ?', [botId])

    if (!bot) {
      const now = new Date().toLocaleString('zh-CN')
      await this.#runQuery(
        'INSERT INTO Bots (id, createdAt, updatedAt) VALUES (?, ?, ?)',
        [botId, now, now]
      )
      bot = { id: botId, createdAt: new Date(now), updatedAt: new Date(now) }
    } else {
      // 确保返回的Date对象
      bot.createdAt = new Date(bot.createdAt)
      bot.updatedAt = new Date(bot.updatedAt)
    }

    return bot
  }

  /**
   * 获取或创建群组记录
   * @param {string} groupId - 群组ID
   * @param {string} botId - 机器人ID
   * @returns {Promise<Group>}
   */
  async getOrCreateGroup(groupId, botId) {
    await this.getOrCreateBot(botId)

    const now = new Date().toLocaleString('zh-CN')

    // 尝试插入，如果已存在则忽略
    await this.#runQuery(
      'INSERT OR IGNORE INTO Groups (id, botId, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
      [groupId, botId, now, now]
    )

    // 查询记录，无论是否存在
    let group = await this.#getQuery('SELECT * FROM Groups WHERE id = ? AND botId = ?', [groupId, botId])

    // 确保返回的Date对象
    group.createdAt = new Date(group.createdAt)
    group.updatedAt = new Date(group.updatedAt)

    return group
  }

  /**
   * 获取或创建抖音用户记录
   * @param {string} sec_uid - 抖音用户sec_uid
   * @param {string} [short_id=''] - 抖音号
   * @param {string} [remark=''] - 用户昵称
   * @returns {Promise<DouyinUser>}
   */
  async getOrCreateDouyinUser(sec_uid, short_id = '', remark = '') {
    let user = await this.#getQuery('SELECT * FROM DouyinUsers WHERE sec_uid = ?', [sec_uid])

    if (!user) {
      const now = new Date().toLocaleString('zh-CN')
      await this.#runQuery(
        'INSERT INTO DouyinUsers (sec_uid, short_id, remark, living, filterMode, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [sec_uid, short_id, remark, 0, 'blacklist', now, now]
      )
      user = {
        sec_uid,
        short_id,
        remark,
        living: false,
        filterMode: 'blacklist',
        createdAt: new Date(now),
        updatedAt: new Date(now)
      }
    } else {
      // 确保返回的Date对象
      user.createdAt = new Date(user.createdAt)
      user.updatedAt = new Date(user.updatedAt)
    }

    return user
  }

  /**
   * 订阅抖音用户
   * @param {string} groupId - 群组ID
   * @param {string} botId - 机器人ID
   * @param {string} sec_uid - 抖音用户sec_uid
   * @param {string} [short_id=''] - 抖音号
   * @param {string} [remark=''] - 用户昵称
   * @returns {Promise<GroupUserSubscription>}
   */
  async subscribeDouyinUser(groupId, botId, sec_uid, short_id = '', remark = '') {
    try {
      await this.getOrCreateGroup(groupId, botId);
      await this.getOrCreateDouyinUser(sec_uid, short_id, remark);

      let subscription = await this.#getQuery(
        'SELECT * FROM GroupUserSubscriptions WHERE groupId = ? AND sec_uid = ?',
        [groupId, sec_uid]
      );

      if (!subscription) {
        const now = new Date().toLocaleString('zh-CN');
        await this.#runQuery(
          'INSERT INTO GroupUserSubscriptions (groupId, sec_uid, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
          [groupId, sec_uid, now, now]
        );
        subscription = { groupId, sec_uid, createdAt: now, updatedAt: now };
      }

      return subscription;
    } catch (/** @type {*} */ error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        // 可能是并发插入导致的冲突，重新查询
        const subscription = await this.#getQuery(
          'SELECT * FROM GroupUserSubscriptions WHERE groupId = ? AND sec_uid = ?',
          [groupId, sec_uid]
        );
        if (subscription) {
          return subscription;
        }
        // 如果仍然没有找到，重新抛出错误
        throw error;
      } else {
        // 其他错误，重新抛出
        throw error;
      }
    }
  }

  /**
   * 取消订阅抖音用户
   * @param {string} groupId - 群组ID
   * @param {string} sec_uid - 抖音用户sec_uid
   * @returns {Promise<boolean>}
   */
  async unsubscribeDouyinUser(groupId, sec_uid) {
    const result = await this.#runQuery(
      'DELETE FROM GroupUserSubscriptions WHERE groupId = ? AND sec_uid = ?',
      [groupId, sec_uid]
    )

    // 清除相关的作品缓存
    await this.#runQuery(
      'DELETE FROM AwemeCaches WHERE groupId = ? AND sec_uid = ?',
      [groupId, sec_uid]
    )

    return result.changes > 0
  }

  /**
   * 添加作品缓存
   * @param {string} aweme_id - 作品ID
   * @param {string} sec_uid - 抖音用户sec_uid
   * @param {string} groupId - 群组ID
   * @returns {Promise<AwemeCache>}
   */
  async addAwemeCache(aweme_id, sec_uid, groupId) {
    let cache = await this.#getQuery(
      'SELECT * FROM AwemeCaches WHERE aweme_id = ? AND sec_uid = ? AND groupId = ?',
      [aweme_id, sec_uid, groupId]
    )

    if (!cache) {
      const now = new Date().toLocaleString('zh-CN')
      const result = await this.#runQuery(
        'INSERT INTO AwemeCaches (aweme_id, sec_uid, groupId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
        [aweme_id, sec_uid, groupId, now, now]
      )
      cache = {
        id: result.lastID,
        aweme_id,
        sec_uid,
        groupId,
        createdAt: now,
        updatedAt: now
      }
    }

    return cache
  }

  /**
   * 检查作品是否已推送
   * @param {string} aweme_id - 作品ID
   * @param {string} sec_uid - 抖音用户sec_uid
   * @param {string} groupId - 群组ID
   * @returns {Promise<boolean>}
   */
  async isAwemePushed(aweme_id, sec_uid, groupId) {
    const result = await this.#getQuery(
      'SELECT COUNT(*) as count FROM AwemeCaches WHERE aweme_id = ? AND sec_uid = ? AND groupId = ?',
      [aweme_id, sec_uid, groupId]
    )

    return (result?.count || 0) > 0
  }

  /**
   * 获取机器人管理的所有群组
   * @param {string} botId - 机器人ID
   * @returns {Promise<Group[]>}
   */
  async getBotGroups(botId) {
    return await this.#allQuery('SELECT * FROM Groups WHERE botId = ?', [botId])
  }

  /**
   * 获取群组订阅的所有抖音用户
   * @param {string} groupId - 群组ID
   * @returns {Promise<Array<GroupUserSubscription & { douyinUser: DouyinUser }>>}
   */
  async getGroupSubscriptions(groupId) {
    const subscriptions = await this.#allQuery(
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

  /**
   * 获取抖音用户的所有订阅群组
   * @param {string} sec_uid - 抖音用户sec_uid
   * @returns {Promise<Group[]>}
   */
  async getUserSubscribedGroups(sec_uid) {
    return await this.#allQuery(
      `SELECT g.* FROM Groups g
      INNER JOIN GroupUserSubscriptions gus ON g.id = gus.groupId
      WHERE gus.sec_uid = ?`,
      [sec_uid]
    )
  }

  /**
   * 检查群组是否已订阅抖音用户
   * @param {string} sec_uid - 抖音用户sec_uid
   * @param {string} groupId - 群组ID
   * @returns {Promise<boolean>}
   */
  async isSubscribed(sec_uid, groupId) {
    const result = await this.#getQuery(
      'SELECT COUNT(*) as count FROM GroupUserSubscriptions WHERE sec_uid = ? AND groupId = ?',
      [sec_uid, groupId]
    )

    return (result?.count || 0) > 0
  }

  /**
   * 获取抖音用户信息
   * @param {string} sec_uid - 抖音用户sec_uid
   * @returns {Promise<DouyinUser|null>}
   */
  async getDouyinUser(sec_uid) {
    const user = await this.#getQuery('SELECT * FROM DouyinUsers WHERE sec_uid = ?', [sec_uid])

    if (user) {
      user.living = !!user.living // 转换为boolean
    }

    return user || null
  }

  /**
   * 更新用户直播状态
   * @param {string} sec_uid - 抖音用户sec_uid
   * @param {boolean} living - 是否正在直播
   * @returns {Promise<boolean>}
   */
  async updateLiveStatus(sec_uid, living) {
    const user = await this.getDouyinUser(sec_uid)
    if (!user) return false

    const now = new Date().toLocaleString('zh-CN')
    const result = await this.#runQuery(
      'UPDATE DouyinUsers SET living = ?, updatedAt = ? WHERE sec_uid = ?',
      [living ? 1 : 0, now, sec_uid]
    )

    return result.changes > 0
  }

  /**
   * 获取用户直播状态
   * @param {string} sec_uid - 抖音用户sec_uid
   * @returns {Promise<{living: boolean}>}
   */
  async getLiveStatus(sec_uid) {
    const user = await this.getDouyinUser(sec_uid)
    return { living: user?.living || false }
  }

  /**
   * 批量同步配置文件中的订阅到数据库
   * @param {douyinPushItem[]} configItems - 配置文件中的订阅项
   * @returns {Promise<void>}
   */
  async syncConfigSubscriptions(configItems) {
    // 1. 收集配置文件中的所有订阅关系
    const configSubscriptions = new Map()

    // 初始化每个群组的订阅用户集合
    for (const item of configItems) {
      const sec_uid = item.sec_uid
      const short_id = item.short_id ?? ''
      const remark = item.remark ?? ''

      // 创建或更新抖音用户记录
      await this.getOrCreateDouyinUser(sec_uid, short_id, remark)

      // 处理该用户的所有群组订阅
      for (const groupWithBot of item.group_id) {
        const [groupId, botId] = groupWithBot.split(':')
        if (!groupId || !botId) continue

        // 确保群组存在
        await this.getOrCreateGroup(groupId, botId)

        // 记录配置文件中的订阅关系
        if (!configSubscriptions.has(groupId)) {
          configSubscriptions.set(groupId, new Set())
        }
        configSubscriptions.get(groupId).add(sec_uid)

        // 检查是否已订阅
        const isSubscribed = await this.isSubscribed(sec_uid, groupId)

        // 如果未订阅，创建订阅关系
        if (!isSubscribed) {
          await this.subscribeDouyinUser(groupId, botId, sec_uid, short_id, remark)
        }
      }
    }

    // 2. 获取数据库中的所有订阅关系，并与配置文件比较，删除不在配置文件中的订阅
    // 获取所有群组
    const allGroups = await this.#allQuery('SELECT * FROM Groups')

    for (const group of allGroups) {
      const groupId = group.id
      const configUsers = configSubscriptions.get(groupId) || new Set()

      // 获取该群组在数据库中的所有订阅
      const dbSubscriptions = await this.getGroupSubscriptions(groupId)

      // 找出需要删除的订阅（在数据库中存在但配置文件中不存在）
      for (const subscription of dbSubscriptions) {
        const sec_uid = subscription.sec_uid

        if (!configUsers.has(sec_uid)) {
          // 删除订阅关系
          await this.unsubscribeDouyinUser(groupId, sec_uid)
          logger.mark(`已删除群组 ${groupId} 对抖音用户 ${sec_uid} 的订阅`)
        }
      }
    }

    // 3. 清理不再被任何群组订阅的抖音用户记录及其过滤词和过滤标签
    // 获取所有抖音用户
    const allUsers = await this.#allQuery('SELECT * FROM DouyinUsers')

    for (const user of allUsers) {
      const sec_uid = user.sec_uid

      // 检查该用户是否还有群组订阅
      const subscribedGroups = await this.getUserSubscribedGroups(sec_uid)

      if (subscribedGroups.length === 0) {
        // 删除该用户的过滤词和过滤标签
        await this.#runQuery('DELETE FROM FilterWords WHERE sec_uid = ?', [sec_uid])
        await this.#runQuery('DELETE FROM FilterTags WHERE sec_uid = ?', [sec_uid])

        // 删除该用户记录
        await this.#runQuery('DELETE FROM DouyinUsers WHERE sec_uid = ?', [sec_uid])

        logger.mark(`已删除抖音用户 ${sec_uid} 的记录及相关过滤设置（不再被任何群组订阅）`)
      }
    }
  }

  /**
   * 通过ID获取群组信息
   * @param {string} groupId - 群组ID
   * @returns {Promise<Group|null>}
   */
  async getGroupById(groupId) {
    return await this.#getQuery('SELECT * FROM Groups WHERE id = ?', [groupId]) || null
  }

  /**
   * 更新用户的过滤模式
   * @param {string} sec_uid - 抖音用户sec_uid
   * @param {string} filterMode - 过滤模式
   * @returns {Promise<DouyinUser>}
   */
  async updateFilterMode(sec_uid, filterMode) {
    const user = await this.getOrCreateDouyinUser(sec_uid)
    const now = new Date().toLocaleString('zh-CN')

    await this.#runQuery(
      'UPDATE DouyinUsers SET filterMode = ?, updatedAt = ? WHERE sec_uid = ?',
      [filterMode, now, sec_uid]
    )

    return { ...user, filterMode, updatedAt: new Date(now) }
  }

  /**
   * 添加过滤词
   * @param {string} sec_uid - 抖音用户sec_uid
   * @param {string} word - 过滤词
   * @returns {Promise<FilterWord>}
   */
  async addFilterWord(sec_uid, word) {
    await this.getOrCreateDouyinUser(sec_uid)

    let filterWord = await this.#getQuery(
      'SELECT * FROM FilterWords WHERE sec_uid = ? AND word = ?',
      [sec_uid, word]
    )

    if (!filterWord) {
      const now = new Date().toLocaleString('zh-CN')
      try {
        const result = await this.#runQuery(
          'INSERT INTO FilterWords (sec_uid, word, douyinUserSecUid, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
          [sec_uid, word, sec_uid, now, now]
        )
        filterWord = {
          id: result.lastID,
          sec_uid,
          word,
          douyinUserSecUid: sec_uid,
          createdAt: now,
          updatedAt: now
        }
      } catch (/** @type {*} */ error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
          // 可能是并发插入导致的冲突，重新查询
          filterWord = await this.#getQuery(
            'SELECT * FROM FilterWords WHERE sec_uid = ? AND word = ?',
            [sec_uid, word]
          );
          if (!filterWord) {
            // 如果仍然没有找到，重新抛出错误
            throw error
          }
        } else {
          // 其他错误，重新抛出
          throw error
        }
      }
    }

    return filterWord
  }

  /**
   * 删除过滤词
   * @param {string} sec_uid - 抖音用户sec_uid
   * @param {string} word - 过滤词
   * @returns {Promise<boolean>}
   */
  async removeFilterWord(sec_uid, word) {
    const result = await this.#runQuery(
      'DELETE FROM FilterWords WHERE sec_uid = ? AND word = ?',
      [sec_uid, word]
    )
    return result.changes > 0
  }

  /**
   * 添加过滤标签
   * @param {string} sec_uid - 抖音用户sec_uid
   * @param {string} tag - 过滤标签
   * @returns {Promise<FilterTag>}
   */
  async addFilterTag(sec_uid, tag) {
    await this.getOrCreateDouyinUser(sec_uid)

    let filterTag = await this.#getQuery(
      'SELECT * FROM FilterTags WHERE sec_uid = ? AND tag = ?',
      [sec_uid, tag]
    )

    if (!filterTag) {
      const now = new Date().toLocaleString('zh-CN')
      try {
        const result = await this.#runQuery(
          'INSERT INTO FilterTags (sec_uid, tag, douyinUserSecUid, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
          [sec_uid, tag, sec_uid, now, now]
        );
        filterTag = {
          id: result.lastID,
          sec_uid,
          tag,
          douyinUserSecUid: sec_uid,
          createdAt: now,
          updatedAt: now
        }
      } catch (/** @type {*} */ error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
          // 可能是并发插入导致的冲突，重新查询
          filterTag = await this.#getQuery(
            'SELECT * FROM FilterTags WHERE sec_uid = ? AND tag = ?',
            [sec_uid, tag]
          )
          if (!filterTag) {
            // 如果仍然没有找到，重新抛出错误
            throw error
          }
        } else {
          // 其他错误，重新抛出
          throw error
        }
      }
    }

    return filterTag
  }

  /**
   * 删除过滤标签
   * @param {string} sec_uid - 抖音用户sec_uid
   * @param {string} tag - 过滤标签
   * @returns {Promise<boolean>}
   */
  async removeFilterTag(sec_uid, tag) {
    const result = await this.#runQuery(
      'DELETE FROM FilterTags WHERE sec_uid = ? AND tag = ?',
      [sec_uid, tag]
    )
    return result.changes > 0
  }

  /**
   * 获取用户的所有过滤词
   * @param {string} sec_uid - 抖音用户sec_uid
   * @returns {Promise<string[]>}
   */
  async getFilterWords(sec_uid) {
    const filterWords = await this.#allQuery('SELECT * FROM FilterWords WHERE sec_uid = ?', [sec_uid])
    return filterWords.map(word => word.word)
  }

  /**
   * 获取用户的所有过滤标签
   * @param {string} sec_uid - 抖音用户sec_uid
   * @returns {Promise<string[]>}
   */
  async getFilterTags(sec_uid) {
    const filterTags = await this.#allQuery('SELECT * FROM FilterTags WHERE sec_uid = ?', [sec_uid])
    return filterTags.map(tag => tag.tag)
  }

  /**
   * 获取用户的过滤配置
   * @param {string} sec_uid - 抖音用户sec_uid
   * @returns {Promise<{filterMode: string, filterWords: string[], filterTags: string[]}>}
   */
  async getFilterConfig(sec_uid) {
    const user = await this.getOrCreateDouyinUser(sec_uid)
    const filterWords = await this.getFilterWords(sec_uid)
    const filterTags = await this.getFilterTags(sec_uid)

    return {
      filterMode: user.filterMode,
      filterWords,
      filterTags
    }
  }

  /**
   * 检查内容是否应该被过滤
   * @param {DouyinPushItem} PushItem - 推送项
   * @param {string[]} [tags=[]] - 标签列表
   * @returns {Promise<boolean>}
   */
  async shouldFilter(PushItem, tags = []) {
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
    const desc = PushItem.Detail_Data.desc || ''

    // 检查内容中是否包含过滤词
    const hasFilterWord = filterWords.some(word => desc.includes(word))

    // 检查标签中是否包含过滤标签
    const hasFilterTag = filterTags.some(filterTag =>
      tags.some(tag => tag === filterTag)
    )

    logger.debug(`
      作者：${PushItem.remark}
      检查内容：${desc}
      命中词：[${filterWords.join('], [')}]
      命中标签：[${filterTags.join('], [')}]
      过滤模式：${filterMode}
      是否过滤：${(hasFilterWord || hasFilterTag) ? logger.red(`${hasFilterWord || hasFilterTag}`) : logger.green(`${hasFilterWord || hasFilterTag}`)}
      作品地址：${logger.green(`https://www.douyin.com/video/${PushItem.Detail_Data.aweme_id}`)}
      `)

    // 根据过滤模式决定是否过滤
    if (filterMode === 'blacklist') {
      // 黑名单模式：如果包含过滤词或过滤标签，则过滤
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
        return false // 不过滤
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
   * 清理旧的作品缓存记录
   * @param {number} [days=7] - 保留最近几天的记录
   * @returns {Promise<number>} - 删除的记录数量
   */
  async cleanOldAwemeCache(days = 7) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const cutoffDateStr = cutoffDate.toLocaleString('zh-CN') // 使用本地时间格式化日期

    const result = await this.#runQuery(
      'DELETE FROM AwemeCaches WHERE createdAt < ?',
      [cutoffDateStr]
    )
    return result.changes || 0
  }

  /** 为了向后兼容，保留groupRepository和awemeCacheRepository属性 */
  get groupRepository() {
    return {
      /**
       * 查找群组
       * @param {Object} [options={}] - 查询选项
       * @param {Object} [options.where] - 查询条件
       * @param {string} [options.where.botId] - 机器人ID，用于筛选特定机器人的群组
       * @returns {Promise<Array<Object>>} 返回群组数据的Promise
       */
      find: async (options = {}) => {
        if (options?.where?.botId) {
          return await this.getBotGroups(options.where.botId)
        }
        return await this.#allQuery('SELECT * FROM Groups')
      }
    }
  }

  get awemeCacheRepository() {
    return {
      /**
       * 查询抖音缓存数据
       * @template T
       * @param {Object} [options={}] - 查询选项
       * @param {Object} [options.where] - 查询条件
       * @param {string} [options.where.groupId] - 群组ID
       * @param {string} [options.where.sec_uid] - 抖音用户ID
       * @param {string} [options.where.aweme_id] - 抖音视频ID
       * @param {Record<string, 'ASC' | 'DESC'>} [options.order] - 排序条件
       * @param {number} [options.take] - 限制返回结果数量
       * @param {string[]} [options.relations] - 关联数据，支持 'douyinUser'
       * @returns {Promise<Array<T & AwemeCache & { createdAt: Date, updatedAt: Date } & ({ douyinUser: any } | {})>>} 返回抖音缓存数据的Promise
       */
      find: async (options = {}) => {
        const { where = {}, order, take, relations } = options
        let sql = 'SELECT * FROM AwemeCaches'
        const params = []

        // 构建WHERE条件
        const conditions = []
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

        // 构建ORDER BY
        if (order) {
          const orderClauses = []
          const allowedFields = ['id', 'aweme_id', 'sec_uid', 'groupId', 'createdAt', 'updatedAt']
          const allowedDirections = ['ASC', 'DESC']

          for (const [field, direction] of Object.entries(order)) {
            // 验证字段名和排序方向，防止SQL注入
            if (allowedFields.includes(field) && allowedDirections.includes(direction)) {
              orderClauses.push(`${field} ${direction}`)
            }
          }
          if (orderClauses.length > 0) {
            sql += ' ORDER BY ' + orderClauses.join(', ')
          }
        }

        // 构建LIMIT
        if (take) {
          sql += ' LIMIT ?'
          params.push(take.toString())
        }

        const caches = await this.#allQuery(sql, params)

        // 如果需要关联douyinUser数据
        if (relations && relations.includes('douyinUser')) {
          const result = []
          for (const cache of caches) {
            const douyinUser = await this.getDouyinUser(cache.sec_uid)
            result.push({
              ...cache,
              douyinUser,
              createdAt: new Date(cache.createdAt), // 转换为Date对象
              updatedAt: new Date(cache.updatedAt)
            })
          }
          return result
        }

        // 转换日期字符串为Date对象
        return caches.map(cache => ({
          ...cache,
          createdAt: new Date(cache.createdAt),
          updatedAt: new Date(cache.updatedAt)
        }))
      },
      /**
       * 删除动态缓存记录
       * @param {Object} [conditions={}] - 删除条件
       * @param {string} [conditions.groupId] - 群组ID
       * @param {string} [conditions.sec_uid] - 抖音用户ID
       * @param {string} [conditions.aweme_id] - 抖音视频ID
       * @returns {Promise<{ affected: number }>} 返回删除操作影响的行数
       */
      delete: async (conditions = {}) => {
        const { groupId = '', sec_uid = '', aweme_id = '' } = conditions

        if (groupId && sec_uid) {
          const result = await this.#runQuery(
            'DELETE FROM AwemeCaches WHERE groupId = ? AND sec_uid = ?',
            [groupId, sec_uid]
          )
          return { affected: result.changes }
        }
        if (groupId) {
          const result = await this.#runQuery(
            'DELETE FROM AwemeCaches WHERE groupId = ?',
            [groupId]
          )
          return { affected: result.changes }
        }
        if (sec_uid) {
          const result = await this.#runQuery(
            'DELETE FROM AwemeCaches WHERE sec_uid = ?',
            [sec_uid]
          )
          return { affected: result.changes }
        }
        if (aweme_id) {
          const result = await this.#runQuery(
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
