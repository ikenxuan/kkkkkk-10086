import { logger, Config, Version } from '../utils/index.js'
import { DynamicType } from '../platform/bilibili/push.js'
import { join } from 'node:path'
import sqlite3 from 'sqlite3'

/**
 * 抖音推送数据类型
 * @typedef {import('../utils/Config.js').bilibiliPushItem} bilibiliPushItem
 * @typedef {import('../platform/bilibili/push.js').BilibiliPushItem} BilibiliPushItem
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
 * B站用户接口 - 存储B站用户信息
 * @typedef {Object} BilibiliUser
 * @property {number} host_mid - B站用户UID
 * @property {string} [remark] - B站用户昵称
 * @property {'blacklist'|'whitelist'} filterMode - 过滤模式：黑名单或白名单
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 */

/**
 * 群组用户订阅关系接口 - 存储群组订阅的B站用户关系
 * @typedef {Object} GroupUserSubscription
 * @property {string} groupId - 群组ID
 * @property {number} host_mid - B站用户UID
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 */

/**
 * 动态缓存接口 - 存储已推送的动态ID
 * @typedef {Object} DynamicCache
 * @property {number} id - 缓存ID
 * @property {string} dynamic_id - 动态ID
 * @property {number} host_mid - B站用户UID
 * @property {string} groupId - 群组ID
 * @property {string} [dynamic_type] - 动态类型
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 */

/**
 * 过滤词接口 - 存储过滤词
 * @typedef {Object} FilterWord
 * @property {number} id - 过滤词ID
 * @property {number} host_mid - B站用户UID
 * @property {string} word - 过滤词
 * @property {number} bilibiliUserHostMid - B站用户UID（外键）
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 */

/**
 * 过滤标签接口 - 存储过滤标签
 * @typedef {Object} FilterTag
 * @property {number} id - 过滤标签ID
 * @property {number} host_mid - B站用户UID
 * @property {string} tag - 过滤标签
 * @property {number} bilibiliUserHostMid - B站用户UID（外键）
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 */

/** 数据库操作类 */
export class BilibiliDBBase {
  /** @type {sqlite3.Database} */
  #db

  /** @type {string} */
  #dbPath

  constructor() {
    this.#dbPath = join(Version.pluginPath, 'data', 'bilibili.db')
  }

  /**
   * 初始化数据库
   * @returns {Promise<BilibiliDBBase>}
   */
  async init() {
    try {
      logger.debug(logger.green('--------------------------[BilibiliDB] 开始初始化数据库--------------------------'))
      logger.debug('[BilibiliDB] 正在连接数据库...')

      // 创建数据库连接
      this.#db = new sqlite3.Database(this.#dbPath)

      // 创建表结构
      await this.#createTables()

      logger.debug('[BilibiliDB] 数据库模型同步成功')

      logger.debug('[BilibiliDB] 正在同步配置订阅...')
      logger.debug('[BilibiliDB] 配置项数量:', Config.pushlist.bilibili?.length || 0)
      await this.syncConfigSubscriptions(Config.pushlist.bilibili || [])
      logger.debug('[BilibiliDB] 配置订阅同步成功')
      logger.debug(logger.green('--------------------------[BilibiliDB] 初始化数据库完成--------------------------'))
    } catch (error) {
      logger.error('[BilibiliDB] 数据库初始化失败:', error)
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

      // 创建B站用户表
      `CREATE TABLE IF NOT EXISTS BilibiliUsers (
        host_mid INTEGER PRIMARY KEY,
        remark TEXT,
        filterMode TEXT DEFAULT 'blacklist',
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL
      )`,

      // 创建群组用户订阅关系表
      `CREATE TABLE IF NOT EXISTS GroupUserSubscriptions (
        groupId TEXT,
        host_mid INTEGER,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        PRIMARY KEY (groupId, host_mid),
        FOREIGN KEY (groupId) REFERENCES Groups(id),
        FOREIGN KEY (host_mid) REFERENCES BilibiliUsers(host_mid)
      )`,

      // 创建动态缓存表
      `CREATE TABLE IF NOT EXISTS DynamicCaches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dynamic_id TEXT NOT NULL,
        host_mid INTEGER NOT NULL,
        groupId TEXT NOT NULL,
        dynamic_type TEXT,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        FOREIGN KEY (host_mid) REFERENCES BilibiliUsers(host_mid),
        FOREIGN KEY (groupId) REFERENCES Groups(id),
        UNIQUE(dynamic_id, host_mid, groupId)
      )`,

      // 创建过滤词表
      `CREATE TABLE IF NOT EXISTS FilterWords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        host_mid INTEGER NOT NULL,
        word TEXT NOT NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        bilibiliUserHostMid INTEGER,
        FOREIGN KEY (bilibiliUserHostMid) REFERENCES BilibiliUsers(host_mid),
        UNIQUE(host_mid, word)
      )`,

      // 创建过滤标签表
      `CREATE TABLE IF NOT EXISTS FilterTags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        host_mid INTEGER NOT NULL,
        tag TEXT NOT NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        bilibiliUserHostMid INTEGER,
        FOREIGN KEY (bilibiliUserHostMid) REFERENCES BilibiliUsers(host_mid),
        UNIQUE(host_mid, tag)
      )`
    ]

    for (const query of queries) {
      await this.#runQuery(query)
    }
  }

  /**
   * 执行SQL查询
   * @param {string} sql
   * @param {any[]} [params=[]]
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
   * @param {string} sql
   * @param {any[]} [params=[]]
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
   * @param {string} sql
   * @param {any[]} [params=[]]
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

    // 如果查询不到记录，可能是插入失败，尝试直接插入
    if (!group) {
      try {
        await this.#runQuery(
          'INSERT INTO Groups (id, botId, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
          [groupId, botId, now, now]
        )
        // 重新查询
        group = await this.#getQuery('SELECT * FROM Groups WHERE id = ? AND botId = ?', [groupId, botId])
        if (!group) {
          // 如果查询仍然为空，创建新对象
          group = { id: groupId, botId, createdAt: new Date(now), updatedAt: new Date(now) }
        }
      } catch (/** @type {*} */ error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
          // 可能是并发插入导致的冲突，重新查询
          group = await this.#getQuery('SELECT * FROM Groups WHERE id = ? AND botId = ?', [groupId, botId])
          if (group) {
            return group
          }
          // 如果仍然没有找到，重新抛出错误
          throw new Error(`无法创建群组记录: ${error.message}`)
        } else {
          // 其他错误，重新抛出
          logger.error(`创建群组记录失败: ${error.message}`)
          throw new Error(`无法创建群组记录: ${error.message}`)
        }
      }
    }

    return group
  }

  /**
   * 获取或创建B站用户记录
   * @param {number} host_mid - B站用户UID
   * @param {string} [remark=''] - UP主昵称
   * @returns {Promise<BilibiliUser>}
   */
  async getOrCreateBilibiliUser(host_mid, remark = '') {
    let user = await this.#getQuery('SELECT * FROM BilibiliUsers WHERE host_mid = ?', [host_mid])

    if (!user) {
      const now = new Date().toLocaleString('zh-CN')
      await this.#runQuery(
        'INSERT INTO BilibiliUsers (host_mid, remark, filterMode, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
        [host_mid, remark, 'blacklist', now, now]
      )
      user = {
        host_mid,
        remark,
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
   * 订阅B站用户
   * @param {string} groupId - 群组ID
   * @param {string} botId - 机器人ID
   * @param {number} host_mid - B站用户UID
   * @param {string} [remark=''] - UP主昵称
   * @returns {Promise<GroupUserSubscription>}
   */
  async subscribeBilibiliUser(groupId, botId, host_mid, remark = '') {
    try {
      await this.getOrCreateGroup(groupId, botId)
      await this.getOrCreateBilibiliUser(host_mid, remark)

      let subscription = await this.#getQuery(
        'SELECT * FROM GroupUserSubscriptions WHERE groupId = ? AND host_mid = ?',
        [groupId, host_mid]
      )

      if (!subscription) {
        const now = new Date().toLocaleString('zh-CN')
        await this.#runQuery(
          'INSERT INTO GroupUserSubscriptions (groupId, host_mid, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
          [groupId, host_mid, now, now]
        )
        subscription = { groupId, host_mid, createdAt: now, updatedAt: now }
      }

      return subscription
    } catch (/** @type {*} */ error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        // 可能是并发插入导致的冲突，重新查询
        const subscription = await this.#getQuery(
          'SELECT * FROM GroupUserSubscriptions WHERE groupId = ? AND host_mid = ?',
          [groupId, host_mid]
        )
        if (subscription) {
          return subscription
        }
        // 如果仍然没有找到，重新抛出错误
        throw error
      } else {
        // 其他错误，重新抛出
        throw error
      }
    }
  }

  /**
   * 取消订阅B站用户
   * @param {string} groupId - 群组ID
   * @param {number} host_mid - B站用户UID
   * @returns {Promise<boolean>}
   */
  async unsubscribeBilibiliUser(groupId, host_mid) {
    const result = await this.#runQuery(
      'DELETE FROM GroupUserSubscriptions WHERE groupId = ? AND host_mid = ?',
      [groupId, host_mid]
    )

    // 清除相关的动态缓存
    await this.#runQuery(
      'DELETE FROM DynamicCaches WHERE groupId = ? AND host_mid = ?',
      [groupId, host_mid]
    )

    return result.changes > 0
  }

  /**
   * 添加动态缓存
   * @param {string} dynamic_id - 动态ID
   * @param {number} host_mid - B站用户UID
   * @param {string} groupId - 群组ID
   * @param {string} dynamic_type - 动态类型
   * @returns {Promise<DynamicCache>}
   */
  async addDynamicCache(dynamic_id, host_mid, groupId, dynamic_type) {
    let cache = await this.#getQuery(
      'SELECT * FROM DynamicCaches WHERE dynamic_id = ? AND host_mid = ? AND groupId = ?',
      [dynamic_id, host_mid, groupId]
    )

    if (!cache) {
      const now = new Date().toLocaleString('zh-CN')
      try {
        const result = await this.#runQuery(
          'INSERT INTO DynamicCaches (dynamic_id, host_mid, groupId, dynamic_type, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
          [dynamic_id, host_mid, groupId, dynamic_type, now, now]
        )
        cache = {
          id: result.lastID,
          dynamic_id,
          host_mid,
          groupId,
          dynamic_type,
          createdAt: now,
          updatedAt: now
        }
      } catch (/** @type {*} */ error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
          // 可能是并发插入导致的冲突，重新查询
          cache = await this.#getQuery(
            'SELECT * FROM DynamicCaches WHERE dynamic_id = ? AND host_mid = ? AND groupId = ?',
            [dynamic_id, host_mid, groupId]
          )
          if (!cache) {
            // 如果仍然没有找到，重新抛出错误
            throw error
          }
        } else {
          // 其他错误，重新抛出
          throw error
        }
      }
    }

    return cache
  }

  /**
   * 检查动态是否已推送
   * @param {string} dynamic_id - 动态ID
   * @param {number} host_mid - B站用户UID
   * @param {string} groupId - 群组ID
   * @returns {Promise<boolean>}
   */
  async isDynamicPushed(dynamic_id, host_mid, groupId) {
    const result = await this.#getQuery(
      'SELECT COUNT(*) as count FROM DynamicCaches WHERE dynamic_id = ? AND host_mid = ? AND groupId = ?',
      [dynamic_id, host_mid, groupId]
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
   * 获取群组订阅的所有B站用户
   * @param {string} groupId - 群组ID
   * @returns {Promise<Array<GroupUserSubscription & { bilibiliUser: BilibiliUser }>>}
   */
  async getGroupSubscriptions(groupId) {
    const subscriptions = await this.#allQuery(
      `SELECT 
        gus.groupId, gus.host_mid, gus.createdAt, gus.updatedAt,
        bu.remark, bu.filterMode,
        bu.createdAt as bu_createdAt, bu.updatedAt as bu_updatedAt
      FROM GroupUserSubscriptions gus
      LEFT JOIN BilibiliUsers bu ON gus.host_mid = bu.host_mid
      WHERE gus.groupId = ?`,
      [groupId]
    )

    return subscriptions.map(sub => ({
      groupId: sub.groupId,
      host_mid: sub.host_mid,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
      bilibiliUser: {
        host_mid: sub.host_mid,
        remark: sub.remark,
        filterMode: sub.filterMode,
        createdAt: sub.bu_createdAt,
        updatedAt: sub.bu_updatedAt
      }
    }))
  }

  /**
   * 获取B站用户的所有订阅群组
   * @param {number} host_mid - B站用户UID
   * @returns {Promise<Group[]>}
   */
  async getUserSubscribedGroups(host_mid) {
    return await this.#allQuery(
      `SELECT g.* FROM Groups g
      INNER JOIN GroupUserSubscriptions gus ON g.id = gus.groupId
      WHERE gus.host_mid = ?`,
      [host_mid]
    )
  }

  /**
   * 获取群组的动态缓存
   * @param {string} groupId - 群组ID
   * @param {string} [host_mid] - 可选的B站用户UID过滤
   * @returns {Promise<DynamicCache[]>}
   */
  async getGroupDynamicCache(groupId, host_mid) {
    let sql = 'SELECT * FROM DynamicCaches WHERE groupId = ?'
    const params = [groupId]

    if (host_mid) {
      sql += ' AND host_mid = ?'
      params.push(host_mid)
    }

    sql += ' ORDER BY createdAt DESC'

    return await this.#allQuery(sql, params)
  }

  /**
   * 检查群组是否已订阅B站用户
   * @param {number} host_mid - B站用户UID
   * @param {string} groupId - 群组ID
   * @returns {Promise<boolean>}
   */
  async isSubscribed(host_mid, groupId) {
    const result = await this.#getQuery(
      'SELECT COUNT(*) as count FROM GroupUserSubscriptions WHERE host_mid = ? AND groupId = ?',
      [host_mid, groupId]
    )

    return (result?.count || 0) > 0
  }

  /**
   * 批量同步配置文件中的订阅到数据库
   * @param {bilibiliPushItem[]} configItems - 配置文件中的订阅项
   * @returns {Promise<void>}
   */
  async syncConfigSubscriptions(configItems) {
    // 1. 收集配置文件中的所有订阅关系
    const configSubscriptions = new Map()

    // 初始化每个群组的订阅UP集合
    for (const item of configItems) {
      const host_mid = item.host_mid
      const remark = item.remark ?? ''

      // 创建或更新B站用户记录
      await this.getOrCreateBilibiliUser(host_mid, remark)

      // 处理该UP主的所有群组订阅
      for (const groupWithBot of item.group_id) {
        const [groupId, botId] = groupWithBot.split(':')
        if (!groupId || !botId) continue

        // 确保群组存在
        await this.getOrCreateGroup(groupId, botId)

        // 记录配置文件中的订阅关系
        if (!configSubscriptions.has(groupId)) {
          configSubscriptions.set(groupId, new Set())
        }
        configSubscriptions.get(groupId)?.add(host_mid)

        // 检查是否已订阅
        const isSubscribed = await this.isSubscribed(host_mid, groupId)

        // 如果未订阅，创建订阅关系
        if (!isSubscribed) {
          await this.subscribeBilibiliUser(groupId, botId, host_mid, remark)
        }
      }
    }

    // 2. 获取数据库中的所有订阅关系，并与配置文件比较，删除不在配置文件中的订阅
    // 获取所有群组
    const allGroups = await this.#allQuery('SELECT * FROM Groups')

    for (const group of allGroups) {
      const groupId = group.id
      const configUps = configSubscriptions.get(groupId) ?? new Set()

      // 获取该群组在数据库中的所有订阅
      const dbSubscriptions = await this.getGroupSubscriptions(groupId)

      // 找出需要删除的订阅（在数据库中存在但配置文件中不存在）
      for (const subscription of dbSubscriptions) {
        const host_mid = subscription.host_mid

        if (!configUps.has(host_mid)) {
          // 删除订阅关系
          await this.unsubscribeBilibiliUser(groupId, host_mid)
          logger.mark(`已删除群组 ${groupId} 对UP主 ${host_mid} 的订阅`)
        }
      }
    }

    // 3. 清理不再被任何群组订阅的UP主记录及其过滤词和过滤标签
    // 获取所有B站用户
    const allUsers = await this.#allQuery('SELECT * FROM BilibiliUsers')

    for (const user of allUsers) {
      const host_mid = user.host_mid

      // 检查该UP主是否还有群组订阅
      const subscribedGroups = await this.getUserSubscribedGroups(host_mid)

      if (subscribedGroups.length === 0) {
        // 删除该UP主的过滤词和过滤标签
        await this.#runQuery('DELETE FROM FilterWords WHERE host_mid = ?', [host_mid])
        await this.#runQuery('DELETE FROM FilterTags WHERE host_mid = ?', [host_mid])

        // 删除该UP主记录
        await this.#runQuery('DELETE FROM BilibiliUsers WHERE host_mid = ?', [host_mid])

        logger.mark(`已删除UP主 ${host_mid} 的记录及相关过滤设置（不再被任何群组订阅）`)
      }
    }
  }

  /**
   * 更新用户的过滤模式
   * @param {number} host_mid - B站用户UID
   * @param {'blacklist'|'whitelist'} filterMode - 过滤模式
   * @returns {Promise<BilibiliUser>}
   */
  async updateFilterMode(host_mid, filterMode) {
    const user = await this.getOrCreateBilibiliUser(host_mid)
    const now = new Date().toLocaleString('zh-CN')

    await this.#runQuery(
      'UPDATE BilibiliUsers SET filterMode = ?, updatedAt = ? WHERE host_mid = ?',
      [filterMode, now, host_mid]
    )

    return { ...user, filterMode, updatedAt: new Date(now) }
  }

  /**
   * 添加过滤词
   * @param {number} host_mid - B站用户UID
   * @param {string} word - 过滤词
   * @returns {Promise<FilterWord>}
   */
  async addFilterWord(host_mid, word) {
    await this.getOrCreateBilibiliUser(host_mid)

    let filterWord = await this.#getQuery(
      'SELECT * FROM FilterWords WHERE host_mid = ? AND word = ?',
      [host_mid, word]
    )

    if (!filterWord) {
      const now = new Date().toLocaleString('zh-CN')
      try {
        const result = await this.#runQuery(
          'INSERT INTO FilterWords (host_mid, word, bilibiliUserHostMid, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
          [host_mid, word, host_mid, now, now]
        )
        filterWord = {
          id: result.lastID,
          host_mid,
          word,
          bilibiliUserHostMid: host_mid,
          createdAt: now,
          updatedAt: now
        }
      } catch (/** @type {*} */ error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
          // 可能是并发插入导致的冲突，重新查询
          filterWord = await this.#getQuery(
            'SELECT * FROM FilterWords WHERE host_mid = ? AND word = ?',
            [host_mid, word]
          )
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
   * @param {number} host_mid - B站用户UID
   * @param {string} word - 过滤词
   * @returns {Promise<boolean>}
   */
  async removeFilterWord(host_mid, word) {
    const result = await this.#runQuery(
      'DELETE FROM FilterWords WHERE host_mid = ? AND word = ?',
      [host_mid, word]
    )
    return result.changes > 0
  }

  /**
   * 添加过滤标签
   * @param {number} host_mid - B站用户UID
   * @param {string} tag - 过滤标签
   * @returns {Promise<FilterTag>}
   */
  async addFilterTag(host_mid, tag) {
    await this.getOrCreateBilibiliUser(host_mid)

    let filterTag = await this.#getQuery(
      'SELECT * FROM FilterTags WHERE host_mid = ? AND tag = ?',
      [host_mid, tag]
    )

    if (!filterTag) {
      const now = new Date().toLocaleString('zh-CN')
      try {
        const result = await this.#runQuery(
          'INSERT INTO FilterTags (host_mid, tag, bilibiliUserHostMid, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
          [host_mid, tag, host_mid, now, now]
        )
        filterTag = {
          id: result.lastID,
          host_mid,
          tag,
          bilibiliUserHostMid: host_mid,
          createdAt: now,
          updatedAt: now
        }
      } catch (/** @type {*} */ error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
          // 可能是并发插入导致的冲突，重新查询
          filterTag = await this.#getQuery(
            'SELECT * FROM FilterTags WHERE host_mid = ? AND tag = ?',
            [host_mid, tag]
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
   * @param {number} host_mid - B站用户UID
   * @param {string} tag - 过滤标签
   * @returns {Promise<boolean>}
   */
  async removeFilterTag(host_mid, tag) {
    const result = await this.#runQuery(
      'DELETE FROM FilterTags WHERE host_mid = ? AND tag = ?',
      [host_mid, tag]
    )
    return result.changes > 0
  }

  /**
   * 获取用户的所有过滤词
   * @param {number} host_mid - B站用户UID
   * @returns {Promise<string[]>}
   */
  async getFilterWords(host_mid) {
    const filterWords = await this.#allQuery('SELECT * FROM FilterWords WHERE host_mid = ?', [host_mid])
    return filterWords.map(word => word.word)
  }

  /**
   * 获取用户的所有过滤标签
   * @param {number} host_mid - B站用户UID
   * @returns {Promise<string[]>}
   */
  async getFilterTags(host_mid) {
    const filterTags = await this.#allQuery('SELECT * FROM FilterTags WHERE host_mid = ?', [host_mid])
    return filterTags.map(tag => tag.tag)
  }

  /**
   * 获取用户的过滤配置
   * @param {number} host_mid - B站用户UID
   * @returns {Promise<{ filterMode: 'blacklist'|'whitelist', filterWords: string[], filterTags: string[] }>}
   */
  async getFilterConfig(host_mid) {
    const user = await this.getOrCreateBilibiliUser(host_mid)
    const filterWords = await this.getFilterWords(host_mid)
    const filterTags = await this.getFilterTags(host_mid)

    return {
      filterMode: user.filterMode,
      filterWords,
      filterTags
    }
  }

  /**
   * 从动态中提取文本内容和标签
   * @param {any} dynamicData - 动态数据
   * @returns {Promise<{ text: string; tags: string[] }>}
   */
  async #extractTextAndTags(dynamicData) {
    let text = ''
    /**
     * @type {any[]}
     */
    const tags = []

    // 如果没有模块数据，返回空结果
    if (!dynamicData || !dynamicData.modules || !dynamicData.modules.module_dynamic) {
      return { text, tags }
    }

    const moduleDynamic = dynamicData.modules.module_dynamic

    // 提取直播标题和分区
    if (moduleDynamic.major && moduleDynamic.major.live_rcmd) {
      const content = JSON.parse(moduleDynamic.major.live_rcmd.content)
      text += content.live_play_info.title + ' '
      tags.push(content.live_play_info.area_name)
    }

    // 提取描述文本
    if (moduleDynamic.desc && moduleDynamic.desc.text) {
      text += moduleDynamic.desc.text + ' '
    }

    // 提取视频标题
    if (moduleDynamic.major && moduleDynamic.major.archive && moduleDynamic.major.archive.title) {
      text += moduleDynamic.major.archive.title + ' '
    }

    // 提取标签
    // 主动态
    if (moduleDynamic.desc && moduleDynamic.desc.rich_text_nodes) {
      for (const node of moduleDynamic.desc.rich_text_nodes) {
        if (node.type !== 'RICH_TEXT_NODE_TYPE_TEXT') {
          tags.push(node.orig_text)
        }
      }
    }
    // 若为转发动态，再检查子动态
    if (dynamicData.type === DynamicType.FORWARD && 'orig' in dynamicData) {
      if (dynamicData.orig.type === DynamicType.AV) {
        text += dynamicData.orig.modules.module_dynamic.major.archive.title + ''
      } else {
        logger.debug(`提取子动态文本和tag：https://t.bilibili.com/${dynamicData.id_str}`)
        try {
          text += dynamicData.orig.modules.module_dynamic.major.opus.summary.text + ' '
          for (const node of dynamicData.orig.modules.module_dynamic.major.opus.summary.rich_text_nodes) {
            tags.push(node.orig_text)
          }
        } catch (error) {
          logger.error(`提取子动态文本和tag失败：${error}`)
        }
      }
    }

    return { text: text.trim(), tags }
  }

  /**
   * 检查内容是否应该被过滤
   * @param {BilibiliPushItem} PushItem - 推送项
   * @param {string[]} [extraTags=[]] - 额外的标签列表
   * @returns {Promise<boolean>}
   */
  async shouldFilter(PushItem, extraTags = []) {
    // 获取用户的过滤配置
    const { filterMode, filterWords, filterTags } = await this.getFilterConfig(PushItem.host_mid)
    logger.debug(`
      获取用户${PushItem.remark}（${PushItem.host_mid}）的过滤配置：
      过滤模式：${filterMode}
      过滤词：${filterWords}
      过滤标签：${filterTags}
      `)

    // 提取主动态的文本和标签
    const { text: mainText, tags: mainTags } = await this.#extractTextAndTags(PushItem.Dynamic_Data)
    logger.debug(`
      提取主动态的文本和标签：
      文本：${mainText}
      标签：[${mainTags.join('][')}]
      `)

    // 合并所有标签
    let allTags = [...mainTags, ...extraTags]
    let allText = mainText

    // 如果是转发动态，还需要检查原动态
    if (PushItem.Dynamic_Data.type === DynamicType.FORWARD && 'orig' in PushItem.Dynamic_Data) {
      const { text: origText, tags: origTags } = await this.#extractTextAndTags(PushItem.Dynamic_Data.orig)
      allText += ' ' + origText
      allTags = [...allTags, ...origTags]
    }

    // 检查内容中是否包含过滤词
    const hasFilterWord = filterWords.some(word => allText.includes(word))

    // 检查标签中是否包含过滤标签
    const hasFilterTag = filterTags.some(filterTag =>
      allTags.some(tag => tag.includes(filterTag))
    )

    logger.debug(`
    UP主UID：${PushItem.host_mid}
    检查内容：${allText}
    检查标签：${allTags.join(', ')}
    命中词：[${filterWords.join('], [')}]
    命中标签：[${filterTags.join('], [')}]
    过滤模式：${filterMode}
    是否过滤：${(hasFilterWord || hasFilterTag) ? logger.red(`${hasFilterWord || hasFilterTag}`) : logger.green(`${hasFilterWord || hasFilterTag}`)}
    动态地址：${logger.green(`https://t.bilibili.com/${PushItem.Dynamic_Data.id_str}`)}
    动态类型：${PushItem.dynamic_type}
    `)

    // 根据过滤模式决定是否过滤
    if (filterMode === 'blacklist') {
      // 黑名单模式：如果包含过滤词或过滤标签，则过滤
      if (hasFilterWord || hasFilterTag) {
        logger.warn(`
        动态内容命中黑名单规则，已过滤该动态不再推送
        动态地址：${logger.yellow(`https://t.bilibili.com/${PushItem.Dynamic_Data.id_str}`)}
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
        动态内容未命中白名单规则，已过滤该动态不再推送
        动态地址：${logger.yellow(`https://t.bilibili.com/${PushItem.Dynamic_Data.id_str}`)}
        当前白名单词：[${filterWords.join('], [')}]
        当前白名单标签：[${filterTags.join('], [')}]
      `)
      return true // 过滤
    }
  }

  /**
   * 清理旧的动态缓存记录
   * @param {number} [days=7] - 保留最近几天的记录
   * @returns {Promise<number>}
   */
  async cleanOldDynamicCache(days = 7) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const cutoffDateStr = cutoffDate.toLocaleString('zh-CN')

    const result = await this.#runQuery(
      'DELETE FROM DynamicCaches WHERE createdAt < ?',
      [cutoffDateStr]
    )
    return result.changes ?? 0
  }

  /** 为了向后兼容，保留groupRepository和dynamicCacheRepository属性 */
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

  get dynamicCacheRepository() {
    return {
      /**
       * 查询动态缓存数据
       * @param {Object} [options={}] - 查询选项
       * @param {Object} [options.where] - 查询条件
       * @param {string} [options.where.groupId] - 群组ID
       * @param {number} [options.where.host_mid] - 主机用户ID
       * @param {string} [options.where.dynamic_id] - 动态ID
       * @param {Record<string, 'ASC' | 'DESC'>} [options.order] - 排序条件
       * @param {number} [options.take] - 限制返回结果数量
       * @param {string[]} [options.relations] - 关联数据，支持 'bilibiliUser'
       * @returns {Promise<Array<DynamicCache & { createdAt: Date, updatedAt: Date } & ({ bilibiliUser: BilibiliUser } | {})>>} 返回动态缓存数据的Promise
       */
      find: async (options = {}) => {
        const { where = {}, order, take, relations } = options
        let sql = 'SELECT * FROM DynamicCaches'
        const params = []

        // 构建WHERE条件
        const conditions = []
        if (where.groupId) {
          conditions.push('groupId = ?')
          params.push(where.groupId)
        }
        if (where.host_mid) {
          conditions.push('host_mid = ?')
          params.push(where.host_mid)
        }
        if (where.dynamic_id) {
          conditions.push('dynamic_id = ?')
          params.push(where.dynamic_id)
        }

        if (conditions.length > 0) {
          sql += ' WHERE ' + conditions.join(' AND ')
        }

        // 构建ORDER BY
        if (order) {
          const orderClauses = []
          const allowedFields = ['id', 'dynamic_id', 'host_mid', 'groupId', 'dynamic_type', 'createdAt', 'updatedAt']
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

        // 如果需要关联bilibiliUser数据
        if (relations && relations.includes('bilibiliUser')) {
          const result = []
          for (const cache of caches) {
            const bilibiliUser = await this.#getQuery('SELECT * FROM BilibiliUsers WHERE host_mid = ?', [cache.host_mid])
            result.push({
              ...cache,
              bilibiliUser,
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
       * @param {number} [conditions.host_mid] - 主机用户ID
       * @param {string} [conditions.dynamic_id] - 动态ID
       * @returns {Promise<{ affected: number }>} 返回删除操作影响的行数
       */
      delete: async (conditions = {}) => {
        const { groupId, host_mid, dynamic_id } = conditions

        if (groupId && host_mid) {
          const result = await this.#runQuery(
            'DELETE FROM DynamicCaches WHERE groupId = ? AND host_mid = ?',
            [groupId, host_mid]
          )
          return { affected: result.changes }
        }
        if (groupId) {
          const result = await this.#runQuery(
            'DELETE FROM DynamicCaches WHERE groupId = ?',
            [groupId]
          )
          return { affected: result.changes }
        }
        if (host_mid) {
          const result = await this.#runQuery(
            'DELETE FROM DynamicCaches WHERE host_mid = ?',
            [host_mid]
          )
          return { affected: result.changes }
        }
        if (dynamic_id) {
          const result = await this.#runQuery(
            'DELETE FROM DynamicCaches WHERE dynamic_id = ?',
            [dynamic_id]
          )
          return { affected: result.changes }
        }
        return { affected: 0 }
      }
    }
  }
}
