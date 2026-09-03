import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/module/utils/Version.js', () => ({
  default: { pluginPath: join(tmpdir(), 'kkkkkk-livepreviewdb-unused') }
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

const { LivePreviewDBBase } = await import('../../src/module/db/livePreview.js')
type LivePreviewDB = InstanceType<typeof LivePreviewDBBase>

const temporaryDirectories: string[] = []
const openDatabases: LivePreviewDB[] = []

/** 关闭连接：Windows 下未关闭的 SQLite 句柄会阻止删除临时目录 */
const closeDatabase = async (instance: LivePreviewDB): Promise<void> => {
  const connection = instance.db
  if (!connection) return
  await new Promise<void>((resolve, reject) => {
    connection.close((error: Error | null) => error ? reject(error) : resolve())
  })
}

/** 每个用例一个独立的临时库，避免用例间互相看见对方的行 */
const openDB = async (): Promise<LivePreviewDB> => {
  const directory = await mkdtemp(join(tmpdir(), 'kkkkkk-livepreviewdb-'))
  temporaryDirectories.push(directory)
  const instance = await new LivePreviewDBBase(directory).init()
  openDatabases.push(instance)
  return instance
}

const ticket = (options: Partial<Parameters<LivePreviewDB['enqueue']>[0]> = {}): Parameters<LivePreviewDB['enqueue']>[0] => ({
  selfId: '10001',
  sessionType: 'group',
  sessionId: '999',
  platform: 'douyin',
  roomKey: 'douyin:123456',
  roomUrl: 'https://live.douyin.com/123456',
  ...options
})

afterEach(async () => {
  while (openDatabases.length > 0) await closeDatabase(openDatabases.pop()!)
  while (temporaryDirectories.length > 0) {
    await rm(temporaryDirectories.pop()!, { recursive: true, force: true })
  }
})

describe('LivePreviewDBBase', () => {
  it('落盘的字段能原样读回来', async () => {
    const db = await openDB()
    await db.enqueue(ticket())

    const rows = await db.subscribers('douyin:123456')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      selfId: '10001',
      sessionType: 'group',
      sessionId: '999',
      platform: 'douyin',
      roomKey: 'douyin:123456',
      roomUrl: 'https://live.douyin.com/123456'
    })
    expect(rows[0].createdAt).toBeTruthy()
  })

  /*
    UNIQUE 落在 selfId + sessionType + sessionId + roomKey 四列上：同一个会话把同一条
    链接连转三次不该排三份，而 INSERT OR IGNORE 让这件事不用先查后写。
  */
  it('同一个会话对同一房间重复入队只留一行', async () => {
    const db = await openDB()
    await db.enqueue(ticket())
    await db.enqueue(ticket())
    await db.enqueue(ticket())

    expect(await db.subscribers('douyin:123456')).toHaveLength(1)
  })

  it('同一房间的不同会话各占一行', async () => {
    const db = await openDB()
    await db.enqueue(ticket({ sessionId: '999' }))
    await db.enqueue(ticket({ sessionId: '888' }))
    await db.enqueue(ticket({ sessionType: 'private', sessionId: '777' }))

    const rows = await db.subscribers('douyin:123456')
    expect(rows.map(row => `${row.sessionType}:${row.sessionId}`)).toEqual([
      'group:999',
      'group:888',
      'private:777'
    ])
  })

  // 多 bot 实例在线时，同一个群同一个房间在两个实例上是两条独立的订阅
  it('不同 bot 实例算不同订阅者', async () => {
    const db = await openDB()
    await db.enqueue(ticket({ selfId: '10001' }))
    await db.enqueue(ticket({ selfId: '10002' }))

    expect(await db.subscribers('douyin:123456')).toHaveLength(2)
  })

  it('subscribers 只给指定房间的行', async () => {
    const db = await openDB()
    await db.enqueue(ticket())
    await db.enqueue(ticket({ platform: 'bilibili', roomKey: 'bilibili:654', roomUrl: 'https://live.bilibili.com/654' }))

    expect(await db.subscribers('douyin:123456')).toHaveLength(1)
    expect(await db.subscribers('bilibili:654')).toHaveLength(1)
    expect(await db.pending()).toHaveLength(2)
  })

  it('release 按房间号清掉它的所有订阅者', async () => {
    const db = await openDB()
    await db.enqueue(ticket({ sessionId: '999' }))
    await db.enqueue(ticket({ sessionId: '888' }))
    await db.enqueue(ticket({ platform: 'bilibili', roomKey: 'bilibili:654', roomUrl: 'https://live.bilibili.com/654' }))

    expect(await db.release('douyin:123456')).toBe(2)
    expect(await db.subscribers('douyin:123456')).toEqual([])
    // 别的房间不受影响
    expect(await db.pending()).toHaveLength(1)
  })

  // 重启恢复读的就是这个：库文件里剩下的行必须能跨连接读回来
  it('账本跨连接存活', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'kkkkkk-livepreviewdb-'))
    temporaryDirectories.push(directory)

    const first = await new LivePreviewDBBase(directory).init()
    await first.enqueue(ticket())
    await closeDatabase(first)

    const second = await new LivePreviewDBBase(directory).init()
    openDatabases.push(second)
    const rows = await second.pending()

    expect(rows).toHaveLength(1)
    expect(rows[0].roomUrl).toBe('https://live.douyin.com/123456')
  })
})
