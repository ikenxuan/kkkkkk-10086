import type { Database, RunResult as Sqlite3RunResult } from 'sqlite3'
import sqlite3 from 'sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import Version from '@/module/utils/Version'
import type {
  CountResult,
  GlobalStatisticsRow,
  GlobalStatisticsSummary,
  GroupUserRankingRow,
  MediaMetricsPlatformSummary,
  MediaMetricsRow,
  MediaMetricsSummary,
  ParseHistoryRow,
  ParseStatisticsRow,
  RunResult,
  StatisticsPlatform,
  SumResult
} from '@/types/database'
import type { MediaRecord } from '@/module/utils/media-metrics'

const PLATFORMS: StatisticsPlatform[] = ['douyin', 'bilibili', 'kuaishou', 'xiaohongshu']

/**
 * ParseStatistics 表里给私聊解析占位的 groupId。
 *
 * 表上有 `UNIQUE(groupId, userId, platform)`，groupId 又是 `NOT NULL`，
 * 而私聊根本没有群号，于是统一写成这个字面量。
 *
 * 它不是群号：凡是按「群」聚合的读取端（全局统计的群组排行、群数统计）
 * 都必须先把它排除掉，否则会凭空多出一个群号写着 `private` 的假群。
 * 写库端和读取端共用这一个常量，避免两边字面量各写一份后悄悄漂移。
 */
export const PRIVATE_GROUP_ID = 'private'

const isStatisticsPlatform = (value: string): value is StatisticsPlatform =>
  (PLATFORMS as string[]).includes(value)

export class StatisticsDBBase {
  db: Database | null = null
  dbPath: string

  /**
   * @param {string} [dataPath] 数据目录，缺省时使用插件根目录下的 `data`
   */
  constructor (dataPath?: string) {
    this.dbPath = path.join(dataPath ?? path.join(Version.pluginPath, 'data'), 'statistics.db')
  }

  async init (): Promise<this> {
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

  async createTables (): Promise<void> {
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
      )`,
      /*
        媒体度量：解析出去的视频 / 音频的时长、体积、耗时。

        为什么不并到 ParseStatistics 上：那张表的粒度是「群 × 用户 × 平台」，
        而这些度量是按媒体条数累加的，一次解析可能产出多条媒体（图集里的实况图），
        跟「解析次数」不是同一个计数单位。混在一起会让 parseCount 和时长的分母
        对不上，读的时候没法判断平均值该除谁。

        粒度是「群 × 平台」而不是只按平台：单群卡片（#kkk解析统计）要本群的数字，
        全局卡片按群求和 / 取最大值就能得到全局值，反过来则做不到。

        三组 *Samples 列是分母，必须和被累加的量分开记：快手、小红书当前的解析路径
        上拿不到时长（见 utils/media-metrics.ts），这些条目只增 mediaCount 不增
        durationSamples。少了这组列就只能用 mediaCount 当分母，
        平均时长会被这些「没有时长的条目」按 0 拉低。
      */
      `CREATE TABLE IF NOT EXISTS MediaMetrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        groupId TEXT NOT NULL,
        platform TEXT NOT NULL,
        mediaCount INTEGER DEFAULT 0,
        videoCount INTEGER DEFAULT 0,
        audioCount INTEGER DEFAULT 0,
        videoDurationMs INTEGER DEFAULT 0,
        audioDurationMs INTEGER DEFAULT 0,
        durationSamples INTEGER DEFAULT 0,
        maxDurationMs INTEGER DEFAULT 0,
        totalBytes INTEGER DEFAULT 0,
        bytesSamples INTEGER DEFAULT 0,
        processingMs INTEGER DEFAULT 0,
        processingSamples INTEGER DEFAULT 0,
        successCount INTEGER DEFAULT 0,
        failureCount INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(groupId, platform)
      )`
    ]

    for (const query of queries) {
      await this.runQuery(query)
    }
  }

  async initGlobalStatistics (): Promise<void> {
    for (const key of ['totalGroups', 'totalParses']) {
      const exists = await this.getQuery<GlobalStatisticsRow>('SELECT * FROM GlobalStatistics WHERE key = ?', [key])
      if (!exists) {
        await this.runQuery('INSERT INTO GlobalStatistics (key, value, updatedAt) VALUES (?, ?, ?)', [
          key,
          '0',
          new Date().toISOString()
        ])
      }
    }
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

  async recordParse (groupId: string, userId: string, platform: string): Promise<void> {
    if (!isStatisticsPlatform(platform)) return

    const now = new Date().toISOString()
    const today = now.split('T')[0] ?? now
    const existing = await this.getQuery<ParseStatisticsRow>(
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

  async updateDailyHistory (date: string, platform: StatisticsPlatform): Promise<void> {
    const existing = await this.getQuery<ParseHistoryRow>('SELECT * FROM ParseHistory WHERE date = ?', [date])
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

  async syncHistoryFromStats (): Promise<void> {
    const historyCount = await this.getQuery<CountResult>('SELECT COUNT(*) as count FROM ParseHistory')
    if ((historyCount?.count ?? 0) > 0) return

    const allStats = await this.getAllStatistics()
    const dateMap = new Map<string, Record<StatisticsPlatform, number>>()
    for (const stat of allStats) {
      const date = stat.createdAt.split('T')[0] ?? stat.createdAt
      let platforms = dateMap.get(date)
      if (!platforms) {
        platforms = { douyin: 0, bilibili: 0, kuaishou: 0, xiaohongshu: 0 }
        dateMap.set(date, platforms)
      }
      platforms[stat.platform] += stat.parseCount
    }

    for (const [date, platforms] of dateMap.entries()) {
      const totalParses = PLATFORMS.reduce((sum, platform) => sum + platforms[platform], 0)
      await this.runQuery(
        'INSERT OR IGNORE INTO ParseHistory (date, totalParses, douyin, bilibili, kuaishou, xiaohongshu, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [date, totalParses, platforms.douyin, platforms.bilibili, platforms.kuaishou, platforms.xiaohongshu, new Date().toISOString()]
      )
    }
  }

  async getGroupStatistics (groupId: string): Promise<ParseStatisticsRow[]> {
    return await this.allQuery<ParseStatisticsRow>('SELECT * FROM ParseStatistics WHERE groupId = ? ORDER BY platform, userId', [groupId])
  }

  /**
   * 群内用户解析次数排行，按总次数从多到少取前 `limit` 名。
   *
   * 为什么走 SQL 聚合而不是拿 `getGroupStatistics()` 的结果在应用层 reduce：
   * - 建表时的 `UNIQUE(groupId, userId, platform)` 会带一个隐式索引，列序正好是
   *   「groupId 前缀 + userId」，所以 `WHERE groupId = ? GROUP BY userId` 能直接
   *   沿这个索引有序扫过去，SQLite 不用为分组另建临时 B 树。
   * - `LIMIT` 在 SQLite 里生效，跨进程边界只回 `limit` 行；应用层聚合要先把这个群
   *   的全部行读进 JS 堆，再建 Map、再排序，行数随群活跃度无上限增长。
   *
   * 四个平台的分布用 `SUM(CASE WHEN ...)` 一次查完，不再为每个用户补查一次。
   *
   * `ORDER BY` 补了 `userId ASC` 作次级键：次数打平时 SQLite 不保证行序，
   * 少了它同样的数据每次渲染可能排出不同的名次。
   *
   * @param groupId 群号
   * @param limit 取前几名，默认 10
   */
  async getGroupUserRanking (groupId: string, limit = 10): Promise<GroupUserRankingRow[]> {
    return await this.allQuery<GroupUserRankingRow>(
      `SELECT
         userId,
         SUM(parseCount) AS totalParses,
         SUM(CASE WHEN platform = 'douyin' THEN parseCount ELSE 0 END) AS douyin,
         SUM(CASE WHEN platform = 'bilibili' THEN parseCount ELSE 0 END) AS bilibili,
         SUM(CASE WHEN platform = 'kuaishou' THEN parseCount ELSE 0 END) AS kuaishou,
         SUM(CASE WHEN platform = 'xiaohongshu' THEN parseCount ELSE 0 END) AS xiaohongshu
       FROM ParseStatistics
       WHERE groupId = ?
       GROUP BY userId
       ORDER BY totalParses DESC, userId ASC
       LIMIT ?`,
      [groupId, limit]
    )
  }

  async getGroupUniqueUsers (groupId: string): Promise<number> {
    const result = await this.getQuery<CountResult>('SELECT COUNT(DISTINCT userId) as count FROM ParseStatistics WHERE groupId = ?', [groupId])
    return result?.count || 0
  }

  async getTotalUniqueUsers (): Promise<number> {
    const result = await this.getQuery<CountResult>('SELECT COUNT(DISTINCT userId) as count FROM ParseStatistics')
    return result?.count || 0
  }

  async getAllStatistics (): Promise<ParseStatisticsRow[]> {
    return await this.allQuery<ParseStatisticsRow>('SELECT * FROM ParseStatistics ORDER BY groupId, platform')
  }

  async getRecentHistory (days = 30): Promise<ParseHistoryRow[]> {
    return await this.allQuery<ParseHistoryRow>('SELECT * FROM ParseHistory ORDER BY date DESC LIMIT ?', [days])
  }

  async getPlatformTotalParses (platform: string): Promise<number> {
    const result = await this.getQuery<SumResult>('SELECT SUM(parseCount) as total FROM ParseStatistics WHERE platform = ?', [platform])
    return result?.total || 0
  }

  /**
   * 真实群数。
   *
   * 必须排除 `PRIVATE_GROUP_ID`：私聊解析在表里也占一行，
   * 直接 `COUNT(DISTINCT groupId)` 会把「私聊」当成一个群多算一个，
   * 让统计卡片上的「服务群组」比实际群数多 1。
   */
  async getTotalGroups (): Promise<number> {
    const result = await this.getQuery<CountResult>(
      'SELECT COUNT(DISTINCT groupId) as count FROM ParseStatistics WHERE groupId != ?',
      [PRIVATE_GROUP_ID]
    )
    return result?.count || 0
  }

  async getTotalParses (): Promise<number> {
    // 只投影 value 一列，用整行类型会让 key / updatedAt 在类型上存在、运行时却是 undefined
    const result = await this.getQuery<Pick<GlobalStatisticsRow, 'value'>>('SELECT value FROM GlobalStatistics WHERE key = ?', ['totalParses'])
    return Number.parseInt(result?.value || '0', 10)
  }

  async refreshTotalGroups (): Promise<void> {
    const totalGroups = await this.getTotalGroups()
    await this.runQuery('UPDATE GlobalStatistics SET value = ?, updatedAt = ? WHERE key = ?', [
      String(totalGroups),
      new Date().toISOString(),
      'totalGroups'
    ])
  }

  async incrementTotalParses (): Promise<void> {
    await this.runQuery('UPDATE GlobalStatistics SET value = value + 1, updatedAt = ? WHERE key = ?', [
      new Date().toISOString(),
      'totalParses'
    ])
  }

  async getGlobalSummary (): Promise<GlobalStatisticsSummary> {
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

  /**
   * 累加一批媒体度量。
   *
   * 一次调用对应一次解析产出的全部媒体，所以先在应用层把这一批合成一组增量，
   * 再用一条 UPSERT 落库 —— 图集解析可能产出几十条媒体，逐条 UPDATE 就是几十次
   * 往返，而它们的目标行是同一行。
   *
   * `INSERT ... ON CONFLICT DO UPDATE` 而不是先 SELECT 再分支：那张表上有
   * `UNIQUE(groupId, platform)`，交给 SQLite 判冲突比应用层查一次再写一次少一趟，
   * 并发下也不会两个解析同时看到「行不存在」各插一条。
   *
   * 三个 `*Samples` 各自独立累加，不是都跟着 mediaCount 走：拿不到时长的平台
   * （快手、小红书）只增 mediaCount，平均时长的分母因此不被它们污染。
   *
   * @param groupId 群号，私聊是 PRIVATE_GROUP_ID
   * @param platform 平台
   * @param records 本次解析收集到的媒体记录
   * @param outcome 本次解析的成败，用于成功率
   * @param processingMs 本次解析耗时毫秒，拿不到时省略
   */
  async recordMediaMetrics (
    groupId: string,
    platform: string,
    records: readonly MediaRecord[],
    outcome: 'success' | 'failure',
    processingMs?: number
  ): Promise<void> {
    if (!isStatisticsPlatform(platform)) return
    // 一条媒体都没有、也没有耗时可记时不建行：否则每次纯图文解析都会
    // 在表里留一行全 0，把「这个平台有没有媒体数据」这个判断搞糊
    if (records.length === 0 && processingMs === undefined) return

    let videoCount = 0
    let audioCount = 0
    let videoDurationMs = 0
    let audioDurationMs = 0
    let durationSamples = 0
    let maxDurationMs = 0
    let totalBytes = 0
    let bytesSamples = 0

    for (const record of records) {
      if (record.kind === 'audio') audioCount += 1
      else videoCount += 1

      if (record.durationMs !== undefined) {
        durationSamples += 1
        if (record.kind === 'audio') audioDurationMs += record.durationMs
        else videoDurationMs += record.durationMs
        if (record.durationMs > maxDurationMs) maxDurationMs = record.durationMs
      }

      if (record.bytes !== undefined) {
        bytesSamples += 1
        totalBytes += record.bytes
      }
    }

    const now = new Date().toISOString()
    const hasProcessing = typeof processingMs === 'number' && Number.isFinite(processingMs) && processingMs >= 0
    await this.runQuery(
      `INSERT INTO MediaMetrics (
         groupId, platform, mediaCount, videoCount, audioCount,
         videoDurationMs, audioDurationMs, durationSamples, maxDurationMs,
         totalBytes, bytesSamples, processingMs, processingSamples,
         successCount, failureCount, createdAt, updatedAt
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(groupId, platform) DO UPDATE SET
         mediaCount = mediaCount + excluded.mediaCount,
         videoCount = videoCount + excluded.videoCount,
         audioCount = audioCount + excluded.audioCount,
         videoDurationMs = videoDurationMs + excluded.videoDurationMs,
         audioDurationMs = audioDurationMs + excluded.audioDurationMs,
         durationSamples = durationSamples + excluded.durationSamples,
         maxDurationMs = MAX(maxDurationMs, excluded.maxDurationMs),
         totalBytes = totalBytes + excluded.totalBytes,
         bytesSamples = bytesSamples + excluded.bytesSamples,
         processingMs = processingMs + excluded.processingMs,
         processingSamples = processingSamples + excluded.processingSamples,
         successCount = successCount + excluded.successCount,
         failureCount = failureCount + excluded.failureCount,
         updatedAt = excluded.updatedAt`,
      [
        groupId,
        platform,
        records.length,
        videoCount,
        audioCount,
        videoDurationMs,
        audioDurationMs,
        durationSamples,
        maxDurationMs,
        totalBytes,
        bytesSamples,
        hasProcessing ? Math.round(processingMs) : 0,
        hasProcessing ? 1 : 0,
        outcome === 'success' ? 1 : 0,
        outcome === 'failure' ? 1 : 0,
        now,
        now
      ]
    )
  }

  /** 某个群的媒体度量原始行 */
  async getGroupMediaMetrics (groupId: string): Promise<MediaMetricsRow[]> {
    return await this.allQuery<MediaMetricsRow>(
      'SELECT * FROM MediaMetrics WHERE groupId = ? ORDER BY platform',
      [groupId]
    )
  }

  /**
   * 全部媒体度量行。
   *
   * 不在这里排除 `PRIVATE_GROUP_ID`：私聊解析出去的媒体，时长是真实发生的，
   * 计入总时长有意义。按「群」聚合的读取端（如果以后有）才需要排除，
   * 和 getTotalGroups 的口径一致。
   */
  async getAllMediaMetrics (): Promise<MediaMetricsRow[]> {
    return await this.allQuery<MediaMetricsRow>('SELECT * FROM MediaMetrics ORDER BY groupId, platform')
  }

  /** 某个群的媒体度量汇总 */
  async getGroupMediaSummary (groupId: string): Promise<MediaMetricsSummary> {
    return summarizeMediaMetrics(await this.getGroupMediaMetrics(groupId))
  }

  /** 全局媒体度量汇总 */
  async getGlobalMediaSummary (): Promise<MediaMetricsSummary> {
    return summarizeMediaMetrics(await this.getAllMediaMetrics())
  }
}

/** 分母为 0 时返回 undefined 而不是 0 —— 「没有数据」和「平均 0」在卡片上必须能区分 */
const average = (total: number, samples: number): number | undefined =>
  samples > 0 ? Math.round(total / samples) : undefined

/**
 * 把原始行聚合成模板消费的形状。
 *
 * 导出是为了让读取端（apps/statistics.ts）和测试都用同一套口径，
 * 避免两边各写一遍平均值公式后悄悄漂移。
 */
export const summarizeMediaMetrics = (rows: readonly MediaMetricsRow[]): MediaMetricsSummary => {
  const platforms = {
    douyin: emptyPlatformSummary(),
    bilibili: emptyPlatformSummary(),
    kuaishou: emptyPlatformSummary(),
    xiaohongshu: emptyPlatformSummary()
  } satisfies Record<StatisticsPlatform, MediaMetricsPlatformSummary>

  let mediaCount = 0
  let videoCount = 0
  let audioCount = 0
  let videoDurationMs = 0
  let audioDurationMs = 0
  let durationSamples = 0
  let maxDurationMs = 0
  let totalBytes = 0
  let processingMs = 0
  let processingSamples = 0
  let successCount = 0
  let failureCount = 0

  for (const row of rows) {
    if (!isStatisticsPlatform(row.platform)) continue

    mediaCount += row.mediaCount
    videoCount += row.videoCount
    audioCount += row.audioCount
    videoDurationMs += row.videoDurationMs
    audioDurationMs += row.audioDurationMs
    durationSamples += row.durationSamples
    if (row.maxDurationMs > maxDurationMs) maxDurationMs = row.maxDurationMs
    totalBytes += row.totalBytes
    processingMs += row.processingMs
    processingSamples += row.processingSamples
    successCount += row.successCount
    failureCount += row.failureCount

    // 同一平台可能横跨多个群，累加而不是覆盖
    const platform = platforms[row.platform]
    platform.mediaCount += row.mediaCount
    platform.totalDurationMs += row.videoDurationMs + row.audioDurationMs
    platform.durationSamples += row.durationSamples
    platform.totalBytes += row.totalBytes
    if (row.maxDurationMs > (platform.maxDurationMs ?? 0)) platform.maxDurationMs = row.maxDurationMs
  }

  for (const platform of Object.values(platforms)) {
    platform.averageDurationMs = average(platform.totalDurationMs, platform.durationSamples)
  }

  const attempts = successCount + failureCount
  return {
    mediaCount,
    videoCount,
    audioCount,
    totalDurationMs: videoDurationMs + audioDurationMs,
    videoDurationMs,
    audioDurationMs,
    durationSamples,
    averageDurationMs: average(videoDurationMs + audioDurationMs, durationSamples),
    maxDurationMs: maxDurationMs > 0 ? maxDurationMs : undefined,
    totalBytes,
    averageProcessingMs: average(processingMs, processingSamples),
    successCount,
    failureCount,
    successRate: attempts > 0 ? successCount / attempts : undefined,
    platforms
  }
}

const emptyPlatformSummary = (): MediaMetricsPlatformSummary => ({
  mediaCount: 0,
  totalDurationMs: 0,
  durationSamples: 0,
  totalBytes: 0
})
