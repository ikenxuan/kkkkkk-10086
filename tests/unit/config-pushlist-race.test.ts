/**
 * pushlist 的读改写竞态。
 *
 * 这三条都是实测复现过的线上表现，不是假想：
 *
 * 1. 缓存被原地改：`Config.pushlist` 以前只做一层展开，`douyin`、`douyin[0]`、
 *    `group_id` 全是缓存里那一份。业务代码 splice 完再 await，中间抛错就不落盘 ——
 *    内存里那个群已经没了，磁盘还在，推送从此漏掉它，配置文件看着完全正常。
 * 2. 过期快照整份覆盖写：`读快照 → await → Config.modify(整份数组)`，
 *    这期间别处写进去的订阅会被抹掉。
 * 3. 库字段回流：`All()` 把 filterMode / Keywords / Tags 写进条目，之后任意一次
 *    落盘就把它们写进了 pushlist.yaml，`syncFilterConfigToDb` 再拿去覆盖库。
 */
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import YAML from 'yaml'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Cfg } from '../../src/module/utils/Config.js'
import type { DouyinPushItem } from '../../src/types/config.js'

const fixtureRoot = join(process.cwd(), 'tests', 'fixtures', 'config')
const temporaryDirectories: string[] = []
const configurations: Cfg[] = []

vi.mock('../../src/module/db/index.js', () => ({
  getDouyinDB: async () => null,
  getBilibiliDB: async () => null
}))

/** 两个博主、两个群，够覆盖「删一个群」「删空整条」「并发写不同条目」三种情况 */
const seed = {
  douyin: [
    { switch: true, sec_uid: 'A', short_id: '1', group_id: ['g1:b1', 'g2:b2'], remark: '甲', pushTypes: ['post', 'live'] },
    { switch: true, sec_uid: 'B', short_id: '2', group_id: ['g1:b1'], remark: '乙', pushTypes: ['post', 'live'] }
  ],
  bilibili: null
}

async function createCfg (): Promise<{ cfg: Cfg, pushlistFile: string }> {
  const root = await mkdtemp(join(tmpdir(), 'kkkkkk-race-'))
  temporaryDirectories.push(root)
  await cp(fixtureRoot, join(root, 'config'), { recursive: true })

  // fixture 里的 pushlist.yaml 是全注释模板，先写进真条目
  const pushlistFile = join(root, 'config', 'config', 'pushlist.yaml')
  await writeFile(pushlistFile, YAML.stringify(seed))
  await writeFile(join(root, 'config', 'default_config', 'pushlist.yaml'), YAML.stringify({ douyin: null, bilibili: null }))

  const cfg = new Cfg(root)
  configurations.push(cfg)
  return { cfg, pushlistFile }
}

/** 读磁盘上的 douyin 列表，绕开所有缓存 */
async function readDisk (file: string): Promise<DouyinPushItem[]> {
  return (YAML.parse(await readFile(file, 'utf8')) as { douyin?: DouyinPushItem[] }).douyin ?? []
}

beforeEach(() => {
  globalThis.logger = {
    warn: vi.fn(),
    error: vi.fn(),
    mark: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  } as never
})

afterEach(async () => {
  await Promise.all(configurations.splice(0).flatMap(cfg => Object.values(cfg.watcher).map(watcher => watcher.close())))
  vi.restoreAllMocks()
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('Config.pushlist 交出来的是快照', () => {
  it('两次读取之间不共享任何一层引用', async () => {
    const { cfg } = await createCfg()

    const first = cfg.pushlist
    const second = cfg.pushlist

    // 顶层以前就是新的，嵌套这三层以前全是同一份
    expect(first.douyin).not.toBe(second.douyin)
    expect(first.douyin![0]).not.toBe(second.douyin![0])
    expect(first.douyin![0].group_id).not.toBe(second.douyin![0].group_id)
    // 拷贝不能拷丢东西
    expect(first).toEqual(second)
  })

  it('原地改快照不影响后续读取，也不会污染磁盘', async () => {
    const { cfg, pushlistFile } = await createCfg()

    const snapshot = cfg.pushlist
    snapshot.douyin![0].group_id.splice(0, 1)
    snapshot.douyin!.splice(1, 1)
    snapshot.douyin![0].remark = '被改过'

    expect(cfg.pushlist.douyin).toHaveLength(2)
    expect(cfg.pushlist.douyin![0].group_id).toEqual(['g1:b1', 'g2:b2'])
    expect(cfg.pushlist.douyin![0].remark).toBe('甲')
    expect(await readDisk(pushlistFile)).toEqual(seed.douyin)
  })

  // 这条是「推送莫名不发了」的现场：退订时先 splice，再 await 数据库、await 回复消息，
  // 最后才落盘。中间抛错则落盘不执行，但缓存里那个群已经没了。
  it('改到一半抛错时内存和磁盘仍然一致', async () => {
    const { cfg, pushlistFile } = await createCfg()

    await expect((async () => {
      const config = cfg.pushlist
      config.douyin![0].group_id.splice(0, 1)
      await Promise.resolve()
      throw new Error('数据库炸了')
    })()).rejects.toThrow('数据库炸了')

    expect(cfg.pushlist.douyin![0].group_id).toHaveLength(2)
    expect((await readDisk(pushlistFile))[0].group_id).toHaveLength(2)
  })
})

describe('Config.update 原子读改写', () => {
  it('拿到的是磁盘上的最新值，不是调用前的快照', async () => {
    const { cfg, pushlistFile } = await createCfg()

    // 别处先写了一条：模拟另一个群的订阅在这期间落了盘
    cfg.update<'pushlist', DouyinPushItem[]>('pushlist', 'douyin', current => {
      current!.push({ switch: true, sec_uid: 'C', group_id: ['g9:b9'], remark: '外部' })
      return current
    })

    let seen: string[] = []
    cfg.update<'pushlist', DouyinPushItem[]>('pushlist', 'douyin', current => {
      seen = current!.map(item => item.sec_uid!)
      return current
    })

    expect(seen).toEqual(['A', 'B', 'C'])
    expect((await readDisk(pushlistFile)).map(item => item.sec_uid)).toEqual(['A', 'B', 'C'])
  })

  // 深拷贝之前这条路径「碰巧」是对的（两个流程改同一个共享数组），
  // 所以只加拷贝会把一个隐蔽的不一致换成一个明确的丢数据。
  it('两个流程各自订阅一个新博主，两条都留得下来', async () => {
    const { cfg, pushlistFile } = await createCfg()

    // 各自在自己的 await 之前读快照，之后才落盘 —— 交错顺序是最坏的那种
    const flowOne = cfg.pushlist
    const flowTwo = cfg.pushlist
    expect(flowOne.douyin).toHaveLength(2)
    expect(flowTwo.douyin).toHaveLength(2)

    const subscribe = (sec_uid: string, groupId: string): void => {
      cfg.update<'pushlist', DouyinPushItem[]>('pushlist', 'douyin', current => {
        const list = current ?? []
        list.push({ switch: true, sec_uid, group_id: [`${groupId}:b1`], remark: sec_uid })
        return list
      })
    }

    subscribe('X', 'g7')
    subscribe('Y', 'g8')

    expect((await readDisk(pushlistFile)).map(item => item.sec_uid)).toEqual(['A', 'B', 'X', 'Y'])
  })

  it('退订写成幂等的，重复退订不会误删别的群', async () => {
    const { cfg, pushlistFile } = await createCfg()

    const unsubscribe = (sec_uid: string, groupId: string): void => {
      cfg.update<'pushlist', DouyinPushItem[]>('pushlist', 'douyin', current => {
        const list = current ?? []
        const index = list.findIndex(item => item.sec_uid === sec_uid)
        if (index < 0) return list
        const item = list[index]!
        const groupIndex = item.group_id.findIndex(entry => entry.split(':')[0] === groupId)
        if (groupIndex >= 0) item.group_id.splice(groupIndex, 1)
        if (item.group_id.length === 0) list.splice(index, 1)
        return list
      })
    }

    unsubscribe('A', 'g1')
    unsubscribe('A', 'g1')

    const disk = await readDisk(pushlistFile)
    expect(disk[0].group_id).toEqual(['g2:b2'])
    expect(disk).toHaveLength(2)
  })

  it('退掉最后一个群时整条删掉', async () => {
    const { cfg, pushlistFile } = await createCfg()

    cfg.update<'pushlist', DouyinPushItem[]>('pushlist', 'douyin', current => {
      const list = current!
      const index = list.findIndex(item => item.sec_uid === 'B')
      list[index]!.group_id.splice(0, 1)
      if (list[index]!.group_id.length === 0) list.splice(index, 1)
      return list
    })

    expect((await readDisk(pushlistFile)).map(item => item.sec_uid)).toEqual(['A'])
  })

  it('改动函数返回 undefined 时不写盘', async () => {
    const { cfg, pushlistFile } = await createCfg()
    const before = await readFile(pushlistFile, 'utf8')

    expect(cfg.update('pushlist', 'douyin', () => undefined)).toBe(false)

    expect(await readFile(pushlistFile, 'utf8')).toBe(before)
  })

  it('落盘后缓存失效，下次读取拿到新值', async () => {
    const { cfg } = await createCfg()

    expect(cfg.pushlist.douyin).toHaveLength(2)
    cfg.update<'pushlist', DouyinPushItem[]>('pushlist', 'douyin', current => {
      current!.splice(1, 1)
      return current
    })

    expect(cfg.pushlist.douyin).toHaveLength(1)
  })

  // YamlReader 解析失败时 document 是空文档，照着它算增量等于把用户配置
  // 换成只剩这一个键。这时候必须整个跳过，连改动函数都不能跑。
  it('yaml 解析失败时既不跑改动函数也不动原文件', async () => {
    const { cfg, pushlistFile } = await createCfg()
    const malformed = 'douyin: [broken\n'
    await writeFile(pushlistFile, malformed)
    const mutate = vi.fn()

    expect(cfg.update('pushlist', 'douyin', mutate)).toBe(false)

    expect(mutate).not.toHaveBeenCalled()
    expect(await readFile(pushlistFile, 'utf8')).toBe(malformed)
  })

  // document.get() 交出来的是 YAMLSeq 节点，Array.isArray 为假。
  // 改动函数拿它当数组用会静默得到错的结果，所以 update 必须走 toJS()。
  it('交给改动函数的是普通数组，不是 YAML 节点', async () => {
    const { cfg } = await createCfg()

    let received: unknown
    cfg.update('pushlist', 'douyin', current => {
      received = current
      return current
    })

    expect(Array.isArray(received)).toBe(true)
  })
})

describe('库字段不会被写回 pushlist.yaml', () => {
  // All() 会把库里的 filterMode / Keywords / Tags 注入条目。以前注入的是缓存原件，
  // 之后任意一次落盘就把这三个字段一起写进了配置文件，而 syncFilterConfigToDb
  // 又拿配置里的值去覆盖库 —— 面板上删掉的关键词会被上一次快照重新写回去。
  it('注入过库字段之后落盘，磁盘上不会多出这三个字段', async () => {
    const { cfg, pushlistFile } = await createCfg()

    const injected = cfg.pushlist
    injected.douyin![0].filterMode = 'whitelist'
    injected.douyin![0].Keywords = ['来自库的关键词']
    injected.douyin![0].Tags = ['来自库的标签']

    cfg.update<'pushlist', DouyinPushItem[]>('pushlist', 'douyin', current => {
      current![0].remark = '改个备注'
      return current
    })

    const disk = await readDisk(pushlistFile)
    expect(disk[0].remark).toBe('改个备注')
    expect(disk[0]).not.toHaveProperty('filterMode')
    expect(disk[0]).not.toHaveProperty('Keywords')
    expect(disk[0]).not.toHaveProperty('Tags')
  })
})
