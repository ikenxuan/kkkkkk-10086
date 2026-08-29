import { Readable } from 'node:stream'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_DOWNLOAD_BUCKET,
  acquireDownloadSlot,
  getCurrentDownloadBucket,
  getDownloadBudgetSnapshot,
  resetDownloadBudget,
  runWithDownloadSlot,
  setDownloadBudgetLimitResolver,
  tryAcquireDownloadSlots,
  withDownloadBucket
} from '../../src/module/utils/Network/DownloadBudget.js'
import { createRanges, downloadMultipart } from '../../src/module/utils/Network/MultipartDownloader.js'

globalThis.logger = {
  warn: vi.fn(),
  debug: vi.fn(),
  mark: vi.fn(),
  error: vi.fn(),
  info: vi.fn()
} as unknown as typeof logger

const workspace = mkdtempSync(join(tmpdir(), 'kkkkkk-budget-'))

/** 让排队中的 acquire 有机会推进 */
const flush = async (): Promise<void> => {
  for (let round = 0; round < 8; round += 1) await Promise.resolve()
}

beforeEach(() => {
  resetDownloadBudget()
})

afterEach(() => {
  resetDownloadBudget()
})

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('下载预算信号量', () => {
  it('额度耗尽时排队，释放后按 FIFO 继续，并发数不超上限', async () => {
    setDownloadBudgetLimitResolver(() => 2)
    const started: string[] = []
    let running = 0
    let maxRunning = 0
    const release: Array<() => void> = []

    const task = (name: string): Promise<void> => runWithDownloadSlot(async () => {
      started.push(name)
      running += 1
      maxRunning = Math.max(maxRunning, running)
      await new Promise<void>(resolve => {
        release.push(resolve)
      })
      running -= 1
    }, { bucket: 'douyin' })

    const all = [task('a'), task('b'), task('c'), task('d')]
    await flush()

    // 额度 2：前两个跑起来，后两个必须还在排队
    expect(started).toEqual(['a', 'b'])
    expect(getDownloadBudgetSnapshot().buckets).toEqual([
      { bucket: 'douyin', limit: 2, running: 2, queued: 2 }
    ])

    release[0]?.()
    await flush()
    expect(started).toEqual(['a', 'b', 'c'])

    release[1]?.()
    await flush()
    expect(started).toEqual(['a', 'b', 'c', 'd'])

    for (const resolve of release) resolve()
    await Promise.all(all)

    expect(maxRunning).toBe(2)
    expect(getDownloadBudgetSnapshot().buckets).toEqual([
      { bucket: 'douyin', limit: 2, running: 0, queued: 0 }
    ])
  })

  it('release 幂等，重复调用不会把额度还多', async () => {
    setDownloadBudgetLimitResolver(() => 1)
    const slot = await acquireDownloadSlot({ bucket: 'douyin' })
    slot.release()
    slot.release()
    slot.release()

    expect(getDownloadBudgetSnapshot().buckets).toEqual([
      { bucket: 'douyin', limit: 1, running: 0, queued: 0 }
    ])
  })
})

describe('按平台分桶', () => {
  it('不同平台互不影响：一个桶排满时另一个桶照样立刻拿到额度', async () => {
    setDownloadBudgetLimitResolver(() => 1)
    const started: string[] = []
    const release: Array<() => void> = []

    const task = (bucket: string, name: string): Promise<void> => runWithDownloadSlot(async () => {
      started.push(name)
      await new Promise<void>(resolve => {
        release.push(resolve)
      })
    }, { bucket })

    const all = [
      task('douyin', 'douyin-1'),
      task('douyin', 'douyin-2'),
      task('bilibili', 'bilibili-1')
    ]
    await flush()

    // 抖音桶满了，B站那条不该被连带堵住
    expect(started).toEqual(['douyin-1', 'bilibili-1'])
    expect(getDownloadBudgetSnapshot()).toEqual({
      limit: 1,
      buckets: [
        { bucket: 'bilibili', limit: 1, running: 1, queued: 0 },
        { bucket: 'douyin', limit: 1, running: 1, queued: 1 }
      ]
    })

    for (const resolve of release) resolve()
    await flush()
    for (const resolve of release) resolve()
    await Promise.all(all)
  })

  it('withDownloadBucket 的标签被链内的下载继承，跨 await 也不丢', async () => {
    setDownloadBudgetLimitResolver(() => 4)
    expect(getCurrentDownloadBucket()).toBeUndefined()

    const buckets = await withDownloadBucket('DouYin', async () => {
      await new Promise(resolve => setTimeout(resolve, 1))
      const outer = getCurrentDownloadBucket()
      // 深层 helper 不传任何参数也该记到同一个桶
      const slot = await acquireDownloadSlot()
      const inner = slot.bucket
      slot.release()
      return { outer, inner }
    })

    // 桶名归一化成小写，免得 'DouYin' 和 'douyin' 变成两个桶、把上限放宽一倍
    expect(buckets).toEqual({ outer: 'douyin', inner: 'douyin' })
    expect(getCurrentDownloadBucket()).toBeUndefined()
  })

  it('上下文缺失时落 default 桶并记一条 debug，而不是抛错', async () => {
    setDownloadBudgetLimitResolver(() => 2)
    const debug = vi.spyOn(logger, 'debug')

    const slot = await acquireDownloadSlot()
    expect(slot.bucket).toBe(DEFAULT_DOWNLOAD_BUCKET)
    expect(debug).toHaveBeenCalled()
    slot.release()
  })

  it('显式 bucket 覆盖 AsyncLocalStorage 上下文', async () => {
    setDownloadBudgetLimitResolver(() => 2)
    const bucket = await withDownloadBucket('douyin', async () => {
      const slot = await acquireDownloadSlot({ bucket: 'bilibili' })
      const name = slot.bucket
      slot.release()
      return name
    })
    expect(bucket).toBe('bilibili')
  })
})

describe('分片下载与文件级下载共享同一份额度', () => {
  const total = 4096
  const payload = Buffer.alloc(total, 7)

  const createRequest = (): {
    request: (config: { headers?: Record<string, unknown> }) => Promise<{
      status: number
      headers: Record<string, string>
      data: Readable
    }>
    ranges: Array<[number, number]>
  } => {
    const ranges: Array<[number, number]> = []
    const request = async (config: { headers?: Record<string, unknown> }): Promise<{
      status: number
      headers: Record<string, string>
      data: Readable
    }> => {
      const match = String(config.headers?.Range ?? '').match(/bytes=(\d+)-(\d+)/)
      const start = Number(match?.[1] ?? 0)
      const end = Number(match?.[2] ?? total - 1)
      ranges.push([start, end])
      return {
        status: 206,
        headers: { 'content-range': `bytes ${start}-${end}/${total}` },
        data: Readable.from([payload.subarray(start, end + 1)])
      }
    }
    return { request, ranges }
  }

  const runMultipart = async (
    filename: string,
    request: ReturnType<typeof createRequest>['request']
  ): Promise<string> => {
    const filepath = join(workspace, filename)
    const info = await downloadMultipart({
      filepath,
      // downloadMultipart 只要求返回 status / headers / data 三个字段
      request: request as unknown as Parameters<typeof downloadMultipart>[0]['request'],
      headers: {},
      total,
      validator: null,
      concurrency: 4,
      bucket: 'douyin',
      maxRetries: 0,
      onProgress: () => {}
    })
    return info.filepath
  }

  it('额度充足时按 额度-1 开分片（文件级已占一格）', async () => {
    setDownloadBudgetLimitResolver(() => 4)
    const { request, ranges } = createRequest()
    // 模拟文件级已经占住的那一格
    const fileSlot = await acquireDownloadSlot({ bucket: 'douyin' })

    const filepath = await runMultipart('plenty.bin', request)

    expect(readFileSync(filepath)).toEqual(payload)
    // 额度 4，文件级占 1、分片再抢 3 => 4 条 range
    expect(ranges).toHaveLength(4)
    fileSlot.release()
  })

  it('抢不到额度时退化成单线程（一条 range），不报错', async () => {
    setDownloadBudgetLimitResolver(() => 2)
    // 把桶占满：文件级那一格 + 另一个平行下载
    const fileSlot = await acquireDownloadSlot({ bucket: 'douyin' })
    const rivalSlot = await acquireDownloadSlot({ bucket: 'douyin' })
    const { request, ranges } = createRequest()

    const filepath = await runMultipart('starved.bin', request)

    // 关键：不是抛错，而是只开一条覆盖全文件的 range
    expect(ranges).toEqual([[0, total - 1]])
    expect(readFileSync(filepath)).toEqual(payload)

    fileSlot.release()
    rivalSlot.release()
  })

  it('分片结束后把额度全部还回桶里', async () => {
    setDownloadBudgetLimitResolver(() => 4)
    const { request } = createRequest()
    await runMultipart('released.bin', request)

    expect(getDownloadBudgetSnapshot().buckets).toEqual([
      { bucket: 'douyin', limit: 4, running: 0, queued: 0 }
    ])
  })

  it('createRanges 不再把 1 抬回 2，否则「退化成单线程」失效', () => {
    expect(createRanges(4096, 1)).toEqual([{ start: 0, end: 4095 }])
    expect(createRanges(4096, 2)).toHaveLength(2)
  })
})

describe('只读快照', () => {
  it('还没有任何下载时是空桶列表，且带上当前额度', () => {
    setDownloadBudgetLimitResolver(() => 6)
    expect(getDownloadBudgetSnapshot()).toEqual({ limit: 6, buckets: [] })
  })

  it('tryAcquireDownloadSlots 要不到就少要，不排队', () => {
    setDownloadBudgetLimitResolver(() => 3)
    const slots = tryAcquireDownloadSlots(10, { bucket: 'douyin' })

    expect(slots).toHaveLength(3)
    expect(getDownloadBudgetSnapshot().buckets).toEqual([
      { bucket: 'douyin', limit: 3, running: 3, queued: 0 }
    ])

    for (const slot of slots) slot.release()
    expect(tryAcquireDownloadSlots(0, { bucket: 'douyin' })).toEqual([])
  })
})
