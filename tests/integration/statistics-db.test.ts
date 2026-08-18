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
})
