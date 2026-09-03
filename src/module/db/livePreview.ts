import type { Database, RunResult as Sqlite3RunResult } from 'sqlite3'
import sqlite3 from 'sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import Version from '@/module/utils/Version'
import type { LivePreviewRow, RunResult } from '@/types/database'

/** 一条待录制的直播预览，`enqueue` 的入参 */
export interface LivePreviewTicket {
  selfId: string
  sessionType: 'group' | 'private'
  sessionId: string
  platform: 'douyin' | 'bilibili'
  roomKey: string
  roomUrl: string
}

/**
 * 直播预览队列的落盘账本。
 *
 * ## 为什么要落盘
 *
 * 运行期的队列项持着事件对象（`e`），录完直接 `e.reply` 发出去 —— 这是最省事的形态，
 * 但 `e` 带着 bot 连接，序列化不了。进程在「已入队、还没录完」的窗口里重启，
 * 内存队列整个消失，用户等的那段预览就静默没了。
 *
 * 所以这里存的不是队列本身，而是「重启后重新发一次所需的最小信息」：
 * 用 `Bot[selfId].pickGroup/pickFriend(sessionId)` 就能把消息送到原来那个会话。
 * 两种发送形态并存是这个设计的代价，不是疏漏。
 *
 * ## 为什么一个订阅者一行
 *
 * 录制按 `roomKey` 去重、只跑一次，但发送要发给所有等它的会话。
 * 一行一个订阅者，录完 `SELECT ... WHERE roomKey = ?` 就是订阅者名单；
 * 反过来把名单塞进一行的 JSON 列，会让「某个会话单独退订」变成读改写整行。
 */
export class LivePreviewDBBase {
  db: Database | null = null
  dbPath: string

  /**
   * @param {string} [dataPath] 数据目录，缺省时使用插件根目录下的 `data`
   */
  constructor (dataPath?: string) {
    this.dbPath = path.join(dataPath ?? path.join(Version.pluginPath, 'data'), 'livePreview.db')
  }

  async init (): Promise<this> {
    try {
      await fs.promises.mkdir(path.dirname(this.dbPath), { recursive: true })
      this.db = new sqlite3.Database(this.dbPath)
      await this.createTables()
    } catch (error) {
      logger.error('[LivePreviewDB] 数据库初始化失败:', error)
      throw error
    }
    return this
  }

  async createTables (): Promise<void> {
    /*
      UNIQUE 落在四列上而不是只落 roomKey：同一个直播间可以有多个订阅者
      （不同群、不同 bot 实例），但同一个会话重复转同一个链接不该排两次。
      入队走 INSERT OR IGNORE，靠这个约束把重复挡掉，省掉一次先查后写。
    */
    await this.runQuery(
      `CREATE TABLE IF NOT EXISTS LivePreviewQueue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        selfId TEXT NOT NULL,
        sessionType TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        platform TEXT NOT NULL,
        roomKey TEXT NOT NULL,
        roomUrl TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(selfId, sessionType, sessionId, roomKey)
      )`
    )
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

  /**
   * 记一个订阅者。同一会话对同一房间重复入队时静默忽略。
   * @param ticket 订阅信息
   */
  async enqueue (ticket: LivePreviewTicket): Promise<void> {
    await this.runQuery(
      `INSERT OR IGNORE INTO LivePreviewQueue
       (selfId, sessionType, sessionId, platform, roomKey, roomUrl, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        ticket.selfId,
        ticket.sessionType,
        ticket.sessionId,
        ticket.platform,
        ticket.roomKey,
        ticket.roomUrl,
        new Date().toISOString()
      ]
    )
  }

  /**
   * 取某个房间的订阅者名单
   * @param roomKey 去重键
   * @returns 该房间的所有订阅行，按入队顺序
   */
  async subscribers (roomKey: string): Promise<LivePreviewRow[]> {
    return await this.allQuery<LivePreviewRow>(
      'SELECT * FROM LivePreviewQueue WHERE roomKey = ? ORDER BY id ASC',
      [roomKey]
    )
  }

  /**
   * 取账本里剩下的全部行，重启恢复用
   * @returns 所有未完成的订阅行
   */
  async pending (): Promise<LivePreviewRow[]> {
    return await this.allQuery<LivePreviewRow>('SELECT * FROM LivePreviewQueue ORDER BY id ASC')
  }

  /**
   * 一个房间录完（或判定不用录了）就把它的所有订阅行删掉
   * @param roomKey 去重键
   * @returns 删掉的行数
   */
  async release (roomKey: string): Promise<number> {
    const result = await this.runQuery('DELETE FROM LivePreviewQueue WHERE roomKey = ?', [roomKey])
    return result.changes
  }
}
