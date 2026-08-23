import { existsSync } from 'node:fs'
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/module/utils/Version.js', () => ({
  default: { pluginPath: join(tmpdir(), 'kkkkkk-statsdb-unused') }
}))

globalThis.logger = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  mark: vi.fn(),
  warn: vi.fn(),
  green: (message: string) => message,
  red: (message: string) => message,
  yellow: (message: string) => message
} as unknown as typeof logger

const { StatisticsDBBase } = await import('../../src/module/db/statistics.js')
type StatisticsDB = InstanceType<typeof StatisticsDBBase>

const repoDataPath = join(process.cwd(), 'data')
const temporaryDirectories: string[] = []
const openDatabases: StatisticsDB[] = []
let repoDataSnapshot = ''

/** 关闭连接，Windows 下未关闭的 SQLite 句柄会阻止删除临时目录 */
const closeDatabase = async (instance: StatisticsDB): Promise<void> => {
  const connection = instance.db
  if (!connection) return
  await new Promise<void>((resolve, reject) => {
    connection.close((error: Error | null) => error ? reject(error) : resolve())
  })
}

/** 记录真实仓库 data/ 的内容指纹，用于证明测试没有写入运行时数据 */
const snapshotRepoData = async (): Promise<string> => {
  if (!existsSync(repoDataPath)) return 'absent'
  const entries = await readdir(repoDataPath)
  const fingerprints = await Promise.all(entries.map(async entry => {
    const info = await stat(join(repoDataPath, entry))
    return `${entry}:${info.size}:${info.mtimeMs}`
  }))
  return fingerprints.sort().join('|')
}

const createStatisticsDB = async () => {
  const dataPath = await mkdtemp(join(tmpdir(), 'kkkkkk-statsdb-'))
  temporaryDirectories.push(dataPath)
  const db = await new StatisticsDBBase(dataPath).init()
  openDatabases.push(db)
  return { db, dataPath }
}

const reopenStatisticsDB = async (dataPath: string) => {
  const db = await new StatisticsDBBase(dataPath).init()
  openDatabases.push(db)
  return db
}

beforeAll(async () => {
  repoDataSnapshot = await snapshotRepoData()
})

afterEach(async () => {
  await Promise.all(openDatabases.splice(0).map(closeDatabase))
  await Promise.all(temporaryDirectories.splice(0).map(async directory => {
    await rm(directory, { recursive: true, force: true })
  }))
})

afterAll(async () => {
  expect(await snapshotRepoData()).toBe(repoDataSnapshot)
})

describe('StatisticsDBBase', () => {
  it('creates the database inside the injected data directory', async () => {
    const { db, dataPath } = await createStatisticsDB()

    expect(existsSync(join(dataPath, 'statistics.db'))).toBe(true)
    expect(db.dbPath).toBe(join(dataPath, 'statistics.db'))
  })

  it('seeds the global statistics keys exactly once per database', async () => {
    const { db } = await createStatisticsDB()

    expect(await db.getTotalParses()).toBe(0)
    expect(await db.allQuery('SELECT key FROM GlobalStatistics ORDER BY key')).toEqual([
      { key: 'totalGroups' },
      { key: 'totalParses' }
    ])
  })

  it('inserts a new row on the first parse and increments it afterwards', async () => {
    const { db } = await createStatisticsDB()

    await db.recordParse('group-1', 'user-1', 'douyin')
    expect(await db.getGroupStatistics('group-1')).toMatchObject([
      { groupId: 'group-1', userId: 'user-1', platform: 'douyin', parseCount: 1 }
    ])

    await db.recordParse('group-1', 'user-1', 'douyin')
    expect(await db.getGroupStatistics('group-1')).toMatchObject([
      { groupId: 'group-1', userId: 'user-1', platform: 'douyin', parseCount: 2 }
    ])
  })

  it('ignores parses for unsupported platforms', async () => {
    const { db } = await createStatisticsDB()

    await db.recordParse('group-1', 'user-1', 'unknown')

    expect(await db.getAllStatistics()).toEqual([])
    expect(await db.getTotalParses()).toBe(0)
  })

  it('aggregates unique users, groups and per-platform totals', async () => {
    const { db } = await createStatisticsDB()

    await db.recordParse('group-1', 'user-1', 'douyin')
    await db.recordParse('group-1', 'user-2', 'bilibili')
    await db.recordParse('group-2', 'user-1', 'douyin')

    expect(await db.getGroupUniqueUsers('group-1')).toBe(2)
    expect(await db.getTotalUniqueUsers()).toBe(2)
    expect(await db.getGlobalSummary()).toEqual({
      totalGroups: 2,
      totalParses: 3,
      totalUsers: 2,
      platformStats: {
        douyin: 2,
        bilibili: 1,
        kuaishou: 0,
        xiaohongshu: 0
      }
    })
  })

  it('records one daily history row per date with per-platform counters', async () => {
    const { db } = await createStatisticsDB()

    await db.recordParse('group-1', 'user-1', 'douyin')
    await db.recordParse('group-1', 'user-1', 'kuaishou')

    const history = await db.getRecentHistory(30)
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      totalParses: 2,
      douyin: 1,
      kuaishou: 1,
      bilibili: 0,
      xiaohongshu: 0
    })
  })

  it('keeps existing rows when the same database is initialised again', async () => {
    const { db, dataPath } = await createStatisticsDB()
    await db.recordParse('group-1', 'user-1', 'douyin')

    const reopened = await reopenStatisticsDB(dataPath)

    expect(await reopened.getGroupStatistics('group-1')).toMatchObject([
      { groupId: 'group-1', userId: 'user-1', parseCount: 1 }
    ])
    expect(await reopened.allQuery('SELECT key FROM GlobalStatistics')).toHaveLength(2)
    expect(await reopened.getTotalParses()).toBe(1)
  })

  describe('getGroupUserRanking', () => {
    /** 让 user-N 在 group-1 的某个平台上刷出 count 次解析 */
    const seed = async (
      db: StatisticsDB,
      userId: string,
      platform: 'douyin' | 'bilibili' | 'kuaishou' | 'xiaohongshu',
      count: number
    ): Promise<void> => {
      for (let index = 0; index < count; index += 1) {
        await db.recordParse('group-1', userId, platform)
      }
    }

    it('按总次数降序聚合，并把四个平台拆开', async () => {
      const { db } = await createStatisticsDB()
      await seed(db, 'user-1', 'douyin', 3)
      await seed(db, 'user-1', 'bilibili', 2)
      await seed(db, 'user-2', 'kuaishou', 4)
      await seed(db, 'user-3', 'xiaohongshu', 1)

      expect(await db.getGroupUserRanking('group-1')).toEqual([
        { userId: 'user-1', totalParses: 5, douyin: 3, bilibili: 2, kuaishou: 0, xiaohongshu: 0 },
        { userId: 'user-2', totalParses: 4, douyin: 0, bilibili: 0, kuaishou: 4, xiaohongshu: 0 },
        { userId: 'user-3', totalParses: 1, douyin: 0, bilibili: 0, kuaishou: 0, xiaohongshu: 1 }
      ])
    })

    it('只统计指定群，别的群不串进来', async () => {
      const { db } = await createStatisticsDB()
      await seed(db, 'user-1', 'douyin', 1)
      await db.recordParse('group-2', 'user-1', 'douyin')
      await db.recordParse('group-2', 'user-9', 'douyin')

      expect(await db.getGroupUserRanking('group-1')).toEqual([
        { userId: 'user-1', totalParses: 1, douyin: 1, bilibili: 0, kuaishou: 0, xiaohongshu: 0 }
      ])
    })

    it('limit 生效，且次数打平时按 userId 给出稳定名次', async () => {
      const { db } = await createStatisticsDB()
      await seed(db, 'user-c', 'douyin', 2)
      await seed(db, 'user-a', 'douyin', 2)
      await seed(db, 'user-b', 'douyin', 2)

      const top2 = await db.getGroupUserRanking('group-1', 2)
      expect(top2.map(row => row.userId)).toEqual(['user-a', 'user-b'])
      // 次级键保证同样的数据每次查出同样的顺序
      expect((await db.getGroupUserRanking('group-1')).map(row => row.userId)).toEqual([
        'user-a',
        'user-b',
        'user-c'
      ])
    })

    it('没有任何记录的群返回空数组，而不是抛错', async () => {
      const { db } = await createStatisticsDB()

      expect(await db.getGroupUserRanking('group-does-not-exist')).toEqual([])
    })
  })

  describe('recordMediaMetrics', () => {
    it('首次解析建行，再次解析在同一行上累加', async () => {
      const { db } = await createStatisticsDB()

      await db.recordMediaMetrics('group-1', 'douyin', [
        { kind: 'video', durationMs: 30_000, bytes: 1_000 }
      ], 'success', 500)
      await db.recordMediaMetrics('group-1', 'douyin', [
        { kind: 'video', durationMs: 10_000, bytes: 2_000 }
      ], 'success', 700)

      // UNIQUE(groupId, platform) 让第二次走 ON CONFLICT 分支，而不是插第二行
      const rows = await db.getGroupMediaMetrics('group-1')
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        mediaCount: 2,
        videoCount: 2,
        videoDurationMs: 40_000,
        durationSamples: 2,
        totalBytes: 3_000,
        processingMs: 1_200,
        processingSamples: 2,
        successCount: 2,
        failureCount: 0
      })
    })

    it('maxDurationMs 取最大值而不是累加，短的那次不会把它压下去', async () => {
      const { db } = await createStatisticsDB()

      await db.recordMediaMetrics('group-1', 'douyin', [{ kind: 'video', durationMs: 90_000 }], 'success')
      await db.recordMediaMetrics('group-1', 'douyin', [{ kind: 'video', durationMs: 5_000 }], 'success')

      expect((await db.getGroupMediaMetrics('group-1'))[0]?.maxDurationMs).toBe(90_000)
    })

    it('拿不到时长的条目只增条数，不污染时长分母', async () => {
      const { db } = await createStatisticsDB()

      // 快手 / 小红书当前的解析路径上就是这样：有媒体但没有时长字段
      await db.recordMediaMetrics('group-1', 'kuaishou', [
        { kind: 'video' },
        { kind: 'video' }
      ], 'success')

      const row = (await db.getGroupMediaMetrics('group-1'))[0]
      expect(row).toMatchObject({ mediaCount: 2, videoCount: 2, durationSamples: 0, videoDurationMs: 0 })
      // 分母为 0 -> 平均值缺省，而不是 0
      expect((await db.getGroupMediaSummary('group-1')).averageDurationMs).toBeUndefined()
    })

    it('音频与视频分开计时长，汇总里合成总时长', async () => {
      const { db } = await createStatisticsDB()

      await db.recordMediaMetrics('group-1', 'bilibili', [
        { kind: 'video', durationMs: 60_000 },
        { kind: 'audio', durationMs: 20_000 }
      ], 'success')

      const summary = await db.getGroupMediaSummary('group-1')
      expect(summary).toMatchObject({
        videoCount: 1,
        audioCount: 1,
        videoDurationMs: 60_000,
        audioDurationMs: 20_000,
        totalDurationMs: 80_000,
        averageDurationMs: 40_000
      })
    })

    it('不支持的平台直接忽略，不建行', async () => {
      const { db } = await createStatisticsDB()

      await db.recordMediaMetrics('group-1', 'unknown', [{ kind: 'video', durationMs: 1_000 }], 'success')

      expect(await db.getAllMediaMetrics()).toEqual([])
    })

    it('一条媒体都没有、也没有耗时可记时不建全 0 行', async () => {
      const { db } = await createStatisticsDB()

      await db.recordMediaMetrics('group-1', 'douyin', [], 'success')

      expect(await db.getAllMediaMetrics()).toEqual([])
    })

    it('纯图文解析（无媒体但有耗时）仍记成败，用于成功率', async () => {
      const { db } = await createStatisticsDB()

      await db.recordMediaMetrics('group-1', 'douyin', [], 'success', 300)
      await db.recordMediaMetrics('group-1', 'douyin', [], 'failure', 100)

      const summary = await db.getGroupMediaSummary('group-1')
      expect(summary).toMatchObject({
        mediaCount: 0,
        successCount: 1,
        failureCount: 1,
        successRate: 0.5,
        averageProcessingMs: 200
      })
      // 一条媒体都没有 -> 时长相关一律缺省
      expect(summary.averageDurationMs).toBeUndefined()
      expect(summary.maxDurationMs).toBeUndefined()
    })

    it('同一平台横跨多个群时，全局汇总按平台累加', async () => {
      const { db } = await createStatisticsDB()

      await db.recordMediaMetrics('group-1', 'douyin', [{ kind: 'video', durationMs: 30_000 }], 'success')
      await db.recordMediaMetrics('group-2', 'douyin', [{ kind: 'video', durationMs: 50_000 }], 'success')

      expect(await db.getAllMediaMetrics()).toHaveLength(2)
      const summary = await db.getGlobalMediaSummary()
      expect(summary.platforms.douyin).toMatchObject({
        mediaCount: 2,
        totalDurationMs: 80_000,
        durationSamples: 2,
        averageDurationMs: 40_000,
        maxDurationMs: 50_000
      })
      // 单群汇总只看自己那一行
      expect((await db.getGroupMediaSummary('group-1')).totalDurationMs).toBe(30_000)
    })

    it('重开同一个库，已累计的度量还在', async () => {
      const { db, dataPath } = await createStatisticsDB()
      await db.recordMediaMetrics('group-1', 'douyin', [{ kind: 'video', durationMs: 30_000 }], 'success')

      const reopened = await reopenStatisticsDB(dataPath)

      expect((await reopened.getGroupMediaSummary('group-1')).totalDurationMs).toBe(30_000)
    })

    it('没有任何度量的群，汇总是全 0 且平均值缺省', async () => {
      const { db } = await createStatisticsDB()

      const summary = await db.getGroupMediaSummary('group-does-not-exist')
      expect(summary).toMatchObject({ mediaCount: 0, totalDurationMs: 0, durationSamples: 0 })
      expect(summary.averageDurationMs).toBeUndefined()
      expect(summary.successRate).toBeUndefined()
    })
  })
})