import { existsSync } from 'node:fs'
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sqlite3 from 'sqlite3'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/module/utils/Version.js', () => ({
  default: { pluginPath: join(tmpdir(), 'kkkkkk-pushdb-unused') }
}))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: { pushlist: { douyin: [], bilibili: [] } }
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

const { DouyinDBBase } = await import('../../src/module/db/douyin.js')
const { BilibiliDBBase } = await import('../../src/module/db/bilibili.js')
const { KEEP_PER_TARGET } = await import('../../src/module/db/retention.js')

type PushDatabase = InstanceType<typeof DouyinDBBase> | InstanceType<typeof BilibiliDBBase>

const repoDataPath = join(process.cwd(), 'data')
const temporaryDirectories: string[] = []
const openDatabases: PushDatabase[] = []
let repoDataSnapshot = ''

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

/** 关闭连接，Windows 下未关闭的 SQLite 句柄会阻止删除临时目录 */
const closeDatabase = async (instance: PushDatabase): Promise<void> => {
  const connection = instance.db
  if (!connection) return
  await new Promise<void>((resolve, reject) => {
    connection.close(error => error ? reject(error) : resolve())
  })
}

const createDataDir = async (): Promise<string> => {
  const dataPath = await mkdtemp(join(tmpdir(), 'kkkkkk-pushdb-'))
  temporaryDirectories.push(dataPath)
  return dataPath
}

const createDouyinDB = async () => {
  const dataPath = await createDataDir()
  const db = await new DouyinDBBase(dataPath).init()
  openDatabases.push(db)
  return { db, dataPath }
}

const createBilibiliDB = async () => {
  const dataPath = await createDataDir()
  const db = await new BilibiliDBBase(dataPath).init()
  openDatabases.push(db)
  return { db, dataPath }
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

describe('DouyinDBBase', () => {
  it('creates the database inside the injected data directory', async () => {
    const { db, dataPath } = await createDouyinDB()

    expect(existsSync(join(dataPath, 'douyin.db'))).toBe(true)
    expect(db.dbPath).toBe(join(dataPath, 'douyin.db'))
  })

  it('subscribes a group to a user and reports the subscription', async () => {
    const { db } = await createDouyinDB()

    await db.subscribeDouyinUser('group-1', 'bot-1', 'sec-1', '12345', '测试用户')

    expect(await db.isSubscribed('sec-1', 'group-1')).toBe(true)
    expect(await db.getGroupSubscriptions('group-1')).toMatchObject([
      {
        groupId: 'group-1',
        sec_uid: 'sec-1',
        douyinUser: { sec_uid: 'sec-1', short_id: '12345', remark: '测试用户', living: false, filterMode: 'blacklist' }
      }
    ])
    expect(await db.getUserSubscribedGroups('sec-1')).toMatchObject([{ id: 'group-1', botId: 'bot-1' }])
  })

  it('updates the stored bot when a group moves to another bot', async () => {
    const { db } = await createDouyinDB()

    await db.subscribeDouyinUser('group-1', 'bot-1', 'sec-1')
    const group = await db.getOrCreateGroup('group-1', 'bot-2')

    expect(group.botId).toBe('bot-2')
    expect(await db.getGroupById('group-1')).toMatchObject({ id: 'group-1', botId: 'bot-2' })
  })

  it('separates the pushed-work cache per push type', async () => {
    const { db } = await createDouyinDB()

    await db.addAwemeCache('aweme-1', 'sec-1', 'group-1', 'post')

    expect(await db.isAwemePushed('aweme-1', 'sec-1', 'group-1', 'post')).toBe(true)
    expect(await db.isAwemePushed('aweme-1', 'sec-1', 'group-1', 'favorite')).toBe(false)
    expect(await db.hasHistory('sec-1', 'group-1', 'post')).toBe(true)
    expect(await db.hasHistory('sec-1', 'group-1', 'favorite')).toBe(false)
  })

  it('reuses the existing cache row instead of inserting duplicates', async () => {
    const { db } = await createDouyinDB()

    const first = await db.addAwemeCache('aweme-1', 'sec-1', 'group-1')
    const second = await db.addAwemeCache('aweme-1', 'sec-1', 'group-1')

    expect(second.id).toBe(first.id)
    expect(await db.allQuery('SELECT id FROM AwemeCaches')).toHaveLength(1)
  })

  it('drops the cached works when a subscription is removed', async () => {
    const { db } = await createDouyinDB()
    await db.subscribeDouyinUser('group-1', 'bot-1', 'sec-1')
    await db.addAwemeCache('aweme-1', 'sec-1', 'group-1')

    expect(await db.unsubscribeDouyinUser('group-1', 'sec-1')).toBe(true)

    expect(await db.isSubscribed('sec-1', 'group-1')).toBe(false)
    expect(await db.isAwemePushed('aweme-1', 'sec-1', 'group-1')).toBe(false)
    expect(await db.unsubscribeDouyinUser('group-1', 'sec-1')).toBe(false)
  })

  it('keeps an old row while it is still among the newest per target', async () => {
    // 清理判据从「够老」改成了「够老 **且** 不在该目标最新 KEEP_PER_TARGET 条之内」。
    // 这条用例原来断言 stale 会被删 —— 现在两行都在保留窗口内，一行都不该删。
    // 为什么要这样改：这张表的行就是去重键，键消失而作品还在接口列表里就会重复推送。
    const { db } = await createDouyinDB()
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    await db.addAwemeCache('fresh', 'sec-1', 'group-1')
    await db.runQuery(
      'INSERT INTO AwemeCaches (aweme_id, sec_uid, groupId, pushType, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      ['stale', 'sec-1', 'group-1', 'post', old, old]
    )

    expect(await db.cleanOldAwemeCache(7)).toBe(0)

    expect(await db.isAwemePushed('fresh', 'sec-1', 'group-1')).toBe(true)
    expect(await db.isAwemePushed('stale', 'sec-1', 'group-1')).toBe(true)
  })

  it('recycles rows that fell out of the newest window', async () => {
    // 保留策略是上界不是永久保留：超出 KEEP_PER_TARGET 的陈旧行仍要回收，否则表无界增长。
    const { db } = await createDouyinDB()
    const total = KEEP_PER_TARGET + 20
    // 一条 INSERT 塞完 120 行，不要 for 循环逐条 await：本地 sqlite 快（半秒），
    // 但 CI 的 windows runner 磁盘慢得多，逐条提交会跑到 60 秒、撞上 30 秒超时。
    const rows = Array.from({ length: total }, (_, index) => {
      const stamp = new Date(Date.now() - (total - index) * 24 * 60 * 60 * 1000).toISOString()
      return [`aweme-${index}`, 'sec-1', 'group-1', 'post', stamp, stamp]
    })
    await db.runQuery(
      `INSERT INTO AwemeCaches (aweme_id, sec_uid, groupId, pushType, createdAt, updatedAt) VALUES ${rows.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}`,
      rows.flat()
    )

    expect(await db.cleanOldAwemeCache(1)).toBe(20)

    // 最老的 20 条被回收，最新的一条必须还在
    expect(await db.isAwemePushed('aweme-0', 'sec-1', 'group-1')).toBe(false)
    expect(await db.isAwemePushed(`aweme-${total - 1}`, 'sec-1', 'group-1')).toBe(true)
  })

  it('counts each push type as its own target when recycling', async () => {
    // AwemeCaches 的 UNIQUE 是 (aweme_id, sec_uid, groupId, pushType)：同一条作品在
    // post / favorite / recommend 下是三个独立去重键。分区不带 pushType 的话，
    // 一种类型的行会挤掉另一种的，导致那一种重复推送。
    const { db } = await createDouyinDB()
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    for (const pushType of ['post', 'favorite', 'recommend']) {
      await db.runQuery(
        'INSERT INTO AwemeCaches (aweme_id, sec_uid, groupId, pushType, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        ['shared-aweme', 'sec-1', 'group-1', pushType, old, old]
      )
    }

    // 三个分区各只有 1 行，都在保留窗口内
    expect(await db.cleanOldAwemeCache(1)).toBe(0)
  })

  it('tracks the live status of a subscribed user', async () => {
    const { db } = await createDouyinDB()
    await db.getOrCreateDouyinUser('sec-1')

    expect(await db.updateLiveStatus('sec-1', true)).toBe(true)
    expect(await db.getLiveStatus('sec-1')).toEqual({ living: true })

    await db.updateLiveStatus('sec-1', false)
    expect(await db.getLiveStatus('sec-1')).toEqual({ living: false })
    expect(await db.updateLiveStatus('missing', true)).toBe(false)
  })

  it('stores filter words, tags and the filter mode per user', async () => {
    const { db } = await createDouyinDB()

    await db.addFilterWord('sec-1', '广告')
    await db.addFilterTag('sec-1', '带货')
    await db.updateFilterMode('sec-1', 'whitelist')

    expect(await db.getFilterConfig('sec-1')).toEqual({
      filterMode: 'whitelist',
      filterWords: ['广告'],
      filterTags: ['带货']
    })

    expect(await db.removeFilterWord('sec-1', '广告')).toBe(true)
    expect(await db.removeFilterTag('sec-1', '带货')).toBe(true)
    expect(await db.getFilterConfig('sec-1')).toEqual({
      filterMode: 'whitelist',
      filterWords: [],
      filterTags: []
    })
  })

  it('keeps rows from a legacy cache table that predates the push type column', async () => {
    const dataPath = await createDataDir()
    const dbPath = join(dataPath, 'douyin.db')

    // 用独立连接写入旧结构后关闭，避免与 init() 的连接争用同一文件
    const seed = new sqlite3.Database(dbPath)
    await new Promise<void>((resolve, reject) => {
      seed.serialize(() => {
        seed.run(`CREATE TABLE AwemeCaches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          aweme_id TEXT NOT NULL,
          sec_uid TEXT NOT NULL,
          groupId TEXT NOT NULL,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(aweme_id, sec_uid, groupId)
        )`)
        seed.run(
          'INSERT INTO AwemeCaches (aweme_id, sec_uid, groupId) VALUES (?, ?, ?)',
          ['legacy-aweme', 'sec-legacy', 'group-legacy'],
          error => error ? reject(error) : resolve()
        )
      })
    })
    await new Promise<void>((resolve, reject) => {
      seed.close(error => error ? reject(error) : resolve())
    })

    const migrated = await new DouyinDBBase(dataPath).init()
    openDatabases.push(migrated)

    // 旧记录被保留并归入默认推送类型
    expect(await migrated.isAwemePushed('legacy-aweme', 'sec-legacy', 'group-legacy', 'post')).toBe(true)
    const columns = await migrated.allQuery<{ name: string }>('PRAGMA table_info(AwemeCaches)')
    expect(columns.map(column => column.name)).toContain('pushType')

    // 迁移后仍可写入新记录
    await migrated.addAwemeCache('new-aweme', 'sec-legacy', 'group-legacy', 'favorite')
    expect(await migrated.isAwemePushed('new-aweme', 'sec-legacy', 'group-legacy', 'favorite')).toBe(true)
    expect(await migrated.allQuery('SELECT id FROM AwemeCaches')).toHaveLength(2)
  })
})

describe('BilibiliDBBase', () => {
  it('creates the database inside the injected data directory', async () => {
    const { db, dataPath } = await createBilibiliDB()

    expect(existsSync(join(dataPath, 'bilibili.db'))).toBe(true)
    expect(db.dbPath).toBe(join(dataPath, 'bilibili.db'))
  })

  it('subscribes a group to a user and reports the subscription', async () => {
    const { db } = await createBilibiliDB()

    await db.subscribeBilibiliUser('group-1', 'bot-1', 1234, 'UP主')

    expect(await db.isSubscribed(1234, 'group-1')).toBe(true)
    expect(await db.getGroupSubscriptions('group-1')).toMatchObject([
      {
        groupId: 'group-1',
        host_mid: 1234,
        bilibiliUser: { host_mid: 1234, remark: 'UP主', filterMode: 'blacklist' }
      }
    ])
  })

  it('records pushed dynamics and reports them once cached', async () => {
    const { db } = await createBilibiliDB()

    await db.addDynamicCache('dynamic-1', 1234, 'group-1', 'DYNAMIC_TYPE_AV')

    expect(await db.isDynamicPushed('dynamic-1', 1234, 'group-1')).toBe(true)
    expect(await db.isDynamicPushed('dynamic-2', 1234, 'group-1')).toBe(false)
    expect(await db.getGroupDynamicCache('group-1', 1234)).toMatchObject([
      { dynamic_id: 'dynamic-1', host_mid: 1234, groupId: 'group-1', dynamic_type: 'DYNAMIC_TYPE_AV' }
    ])
  })

  it('drops the cached dynamics when a subscription is removed', async () => {
    const { db } = await createBilibiliDB()
    await db.subscribeBilibiliUser('group-1', 'bot-1', 1234)
    await db.addDynamicCache('dynamic-1', 1234, 'group-1')

    expect(await db.unsubscribeBilibiliUser('group-1', 1234)).toBe(true)

    expect(await db.isSubscribed(1234, 'group-1')).toBe(false)
    expect(await db.isDynamicPushed('dynamic-1', 1234, 'group-1')).toBe(false)
  })

  it('keeps an old dynamic row while it is still among the newest per target', async () => {
    // 同 douyin 侧：判据改成「够老 **且** 不在最新 KEEP_PER_TARGET 条之内」，两行都该留下
    const { db } = await createBilibiliDB()
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    await db.addDynamicCache('fresh', 1234, 'group-1')
    await db.runQuery(
      'INSERT INTO DynamicCaches (dynamic_id, host_mid, groupId, dynamic_type, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      ['stale', 1234, 'group-1', '', old, old]
    )

    expect(await db.cleanOldDynamicCache(7)).toBe(0)

    expect(await db.isDynamicPushed('fresh', 1234, 'group-1')).toBe(true)
    expect(await db.isDynamicPushed('stale', 1234, 'group-1')).toBe(true)
  })

  it('keeps a long-running live session key no matter how old it gets', async () => {
    // 这是改动的正题：直播场次键是 host_mid + room_id + live_time，一场播只有一行。
    // 只按年龄删的话，播满保留期后这行被回收，下一轮直播推送会把同一场当成新场次再推一遍。
    // 一个长播 30 天的直播间在该 (host_mid, group) 下只有这一行，必须活着。
    const { db } = await createBilibiliDB()
    const veryOld = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    await db.runQuery(
      'INSERT INTO DynamicCaches (dynamic_id, host_mid, groupId, dynamic_type, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      ['live_100_room1_1690000000', 100, 'group-1', 'live', veryOld, veryOld]
    )

    expect(await db.cleanOldDynamicCache(1)).toBe(0)
    expect(await db.isDynamicPushed('live_100_room1_1690000000', 100, 'group-1')).toBe(true)
  })

  it('recycles dynamic rows that fell out of the newest window', async () => {
    const { db } = await createBilibiliDB()
    const total = KEEP_PER_TARGET + 20
    // 单条批量 INSERT，理由同 douyin 侧那条：逐条 await 在 CI 的慢磁盘上会撞超时
    const rows = Array.from({ length: total }, (_, index) => {
      const stamp = new Date(Date.now() - (total - index) * 24 * 60 * 60 * 1000).toISOString()
      return [`dyn-${index}`, 1234, 'group-1', '', stamp, stamp]
    })
    await db.runQuery(
      `INSERT INTO DynamicCaches (dynamic_id, host_mid, groupId, dynamic_type, createdAt, updatedAt) VALUES ${rows.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}`,
      rows.flat()
    )

    expect(await db.cleanOldDynamicCache(1)).toBe(20)

    expect(await db.isDynamicPushed('dyn-0', 1234, 'group-1')).toBe(false)
    expect(await db.isDynamicPushed(`dyn-${total - 1}`, 1234, 'group-1')).toBe(true)
  })

  it('stores filter words, tags and the filter mode per user', async () => {
    const { db } = await createBilibiliDB()

    await db.addFilterWord(1234, '恰饭')
    await db.addFilterTag(1234, '广告')
    await db.updateFilterMode(1234, 'whitelist')

    expect(await db.getFilterConfig(1234)).toEqual({
      filterMode: 'whitelist',
      filterWords: ['恰饭'],
      filterTags: ['广告']
    })
  })
})

describe('database singletons', () => {
  it('initialises each database once across repeated getters', async () => {
    vi.resetModules()
    const initialised: string[] = []

    class CountingDB {
      db = null
      readonly label: string

      constructor (label: string) {
        this.label = label
      }

      async init (): Promise<this> {
        initialised.push(this.label)
        await new Promise(resolve => setTimeout(resolve, 30))
        return this
      }
    }

    vi.doMock('../../src/module/db/statistics.js', () => ({
      StatisticsDBBase: class extends CountingDB {
        constructor () {
          super('statistics')
        }
      }
    }))
    vi.doMock('../../src/module/db/douyin.js', () => ({
      DouyinDBBase: class extends CountingDB {
        constructor () {
          super('douyin')
        }
      }
    }))
    vi.doMock('../../src/module/db/bilibili.js', () => ({
      BilibiliDBBase: class extends CountingDB {
        constructor () {
          super('bilibili')
        }
      }
    }))
    vi.doMock('../../src/module/db/livePreview.js', () => ({
      LivePreviewDBBase: class extends CountingDB {
        constructor () {
          super('livePreview')
        }
      }
    }))

    const db = await import('../../src/module/db/index.js')

    const [statisticsA, statisticsB] = await Promise.all([db.getStatisticsDB(), db.getStatisticsDB()])
    const [douyinA, douyinB] = await Promise.all([db.getDouyinDB(), db.getDouyinDB()])
    const [bilibiliA, bilibiliB] = await Promise.all([db.getBilibiliDB(), db.getBilibiliDB()])
    const [livePreviewA, livePreviewB] = await Promise.all([db.getLivePreviewDB(), db.getLivePreviewDB()])
    const all = await db.initAllDatabases()

    expect(statisticsA).not.toBeNull()
    expect(statisticsB).toBe(statisticsA)
    expect(douyinB).toBe(douyinA)
    expect(bilibiliB).toBe(bilibiliA)
    expect(livePreviewB).toBe(livePreviewA)
    expect(all).toEqual({
      douyinDB: douyinA,
      bilibiliDB: bilibiliA,
      statisticsDB: statisticsA,
      livePreviewDB: livePreviewA
    })
    expect(initialised.sort()).toEqual(['bilibili', 'douyin', 'livePreview', 'statistics'])
    expect(db.douyinDB).toBe(douyinA)
    expect(db.bilibiliDB).toBe(bilibiliA)
    expect(db.statisticsDB).toBe(statisticsA)

    vi.doUnmock('../../src/module/db/statistics.js')
    vi.doUnmock('../../src/module/db/douyin.js')
    vi.doUnmock('../../src/module/db/bilibili.js')
    vi.doUnmock('../../src/module/db/livePreview.js')
    vi.resetModules()
  })
})
