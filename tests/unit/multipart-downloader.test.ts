import { mkdtempSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  acquireDownloadSlot,
  resetDownloadBudget,
  setDownloadBudgetLimitResolver
} from '../../src/module/utils/Network/DownloadBudget.js'
import {
  DEFAULT_GRACE_MS,
  DEFAULT_SUSTAIN_MS,
  MIN_REMAINING_BYTES,
  SAMPLE_INTERVAL_MS,
  SLOW_DOWNLOAD_ABORT_CODE,
  isSlowDownloadAbort
} from '../../src/module/utils/Network/DownloadWatchdog.js'
import {
  createRanges,
  downloadMultipart,
  parseContentRange,
  probeRangeSupport
} from '../../src/module/utils/Network/MultipartDownloader.js'

globalThis.logger = {
  warn: vi.fn(),
  debug: vi.fn(),
  mark: vi.fn(),
  error: vi.fn(),
  info: vi.fn()
} as unknown as typeof logger

const workspace = mkdtempSync(join(tmpdir(), 'kkkkkk-multipart-'))

let fileCounter = 0
const targetPath = (): string => join(workspace, `part-${++fileCounter}.bin`)

/** 让出一个**真的**宏任务。假时钟推不动流水线，chunk 要靠它流到计数器那一段。 */
const yieldReal = async (): Promise<void> => {
  await new Promise<void>(resolve => setImmediate(resolve))
}

/**
 * 手动喂数据的可读流。
 *
 * 用它而不是 `Readable.from([buf])`：低速判定要的是「字节一点一点来」这个过程，
 * 一次性给完的流在第一次采样之前就下完了，看守压根走不到判定那一步。
 */
class ManualStream extends Readable {
  override _read (): void {}
}

interface Shard {
  start: number
  end: number
  stream: ManualStream
  /** 已经喂进去多少字节，收尾时靠它算还差多少 */
  pushed: number
}

interface ShardServer {
  request: Parameters<typeof downloadMultipart>[0]['request']
  shards: Shard[]
  requests: number
  waitForShards: (count: number) => Promise<void>
}

/**
 * 造一个按 Range 分发手动流的假服务端。
 *
 * `signal` 要真的接上：被测代码判低速之后是 `controller.abort()`，真实 axios 在那时
 * 会让流带着 `ERR_CANCELED` 挂掉。假服务端不照做的话分片会一直挂着，
 * 「掐掉之后抛的是哪份错误」这条判定就永远走不到。
 */
const createShardServer = (
  total: number,
  options: { status?: number, contentRange?: (start: number, end: number) => string, headers?: Record<string, string> } = {}
): ShardServer => {
  const server: ShardServer = {
    shards: [],
    requests: 0,
    request: null as never,
    waitForShards: null as never
  }
  let announce: (() => void) | undefined

  server.request = (async (config: { headers?: Record<string, unknown>, signal?: AbortSignal }) => {
    server.requests += 1
    const match = String(config.headers?.Range ?? '').match(/bytes=(\d+)-(\d+)/)
    const start = Number(match?.[1] ?? 0)
    const end = Number(match?.[2] ?? total - 1)
    const stream = new ManualStream()
    config.signal?.addEventListener('abort', () => {
      stream.destroy(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' }))
    })
    server.shards.push({ start, end, stream, pushed: 0 })
    announce?.()
    return {
      status: options.status ?? 206,
      headers: {
        'content-range': options.contentRange?.(start, end) ?? `bytes ${start}-${end}/${total}`,
        ...options.headers
      },
      data: stream
    }
  }) as ShardServer['request']

  // 事件驱动地等，不用「让 N 拍看够不够」那种轮询：被测代码在 spawn 分片之前还要
  // 过一遍真实的 mkdir / open / truncate，那几步的耗时不由我们控制，
  // 定额让拍在忙的机器上会等不到，表现成用例偶发失败而不是真有问题。
  server.waitForShards = async (count: number): Promise<void> => {
    while (server.shards.length < count) {
      await new Promise<void>(resolve => { announce = resolve })
    }
    announce = undefined
  }

  return server
}

interface RunHandle {
  filepath: string
  outcome: Promise<{ status: 'resolved', value: unknown } | { status: 'rejected', error: unknown }>
}

/** 起一次分片下载，不在这里收场 —— 喂多少、什么时候收尾由各用例自己摆。 */
const startMultipart = (
  server: ShardServer,
  overrides: Partial<Parameters<typeof downloadMultipart>[0]> & { total: number }
): RunHandle => {
  const filepath = targetPath()
  const outcome = downloadMultipart({
    filepath,
    request: server.request,
    headers: {},
    validator: null,
    concurrency: 2,
    bucket: 'douyin',
    maxRetries: 0,
    onProgress: () => {},
    ...overrides
  }).then(
    value => ({ status: 'resolved' as const, value }),
    (error: unknown) => ({ status: 'rejected' as const, error })
  )
  return { filepath, outcome }
}

/** 走到「最早可能判定」那一刻要推多少格：宽限期走完，再攒满持续窗口。 */
const TICKS_TO_VERDICT = (DEFAULT_GRACE_MS + DEFAULT_SUSTAIN_MS) / SAMPLE_INTERVAL_MS

/**
 * 等一格数据被数进去最多等这么久（**真实**时钟）。
 *
 * 只用来把「卡住了」炸成一句话，别干等 vitest 的 testTimeout。
 */
const DRAIN_TIMEOUT_MS = 10_000

/**
 * 等到条件成立，超时就抛。
 *
 * 按**真实**时间收口而不是按「让多少拍」收口：让拍次数在满载下不是个可预测的量，
 * 定额让拍等于把「这台机器现在忙不忙」写进了判定条件里。`Date` 被假掉了，
 * 所以这里读 `performance.now()` —— 它不在 `toFake` 名单里，是真的在走。
 */
const waitUntil = async (condition: () => boolean, describeStuck: () => string): Promise<void> => {
  const deadline = performance.now() + DRAIN_TIMEOUT_MS
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(`等了 ${DRAIN_TIMEOUT_MS}ms 还没就绪：${describeStuck()}`)
    await yieldReal()
  }
}

/**
 * 按格喂数据并推假时钟。
 *
 * 每格都要等到喂进去的字节真的被计数器数过，再推下一格的时钟。这一步是这个用例组
 * 的地基：chunk 从可读流走到 `updateProgress` 那一段是真实的流机制加一次真实的
 * 落盘写，假时钟推不动它。没等到就推时钟的话，这一格的合计速率会少算一个分片的量,
 * 而低速判定看的正是每格的增量 —— 满载时连着几格少算，就会给一条健康的连接
 * 判出「持续低速」，表现成这个文件在整个 tests/ 一起跑时偶发翻红。
 *
 * @param server 假服务端
 * @param bytesPerTick 每个分片每格喂多少字节
 * @param ticks 推多少格
 */
const driveTicks = async (server: ShardServer, bytesPerTick: number, ticks: number): Promise<void> => {
  for (let tick = 0; tick < ticks; tick++) {
    const fed: Shard[] = []
    for (const shard of server.shards) {
      // 判定之后 abort() 会把流销毁，往销毁的流里 push 会抛。继续喂是无害的，
      // 但得先问一句
      if (shard.stream.destroyed) continue
      shard.stream.push(Buffer.alloc(bytesPerTick, 1))
      shard.pushed += bytesPerTick
      fed.push(shard)
    }

    // 缓冲区空掉就说明这一格的 chunk 已经交给被测代码那个 Transform 了，而它的
    // transform 体是同步的（数完字节当场 callback），所以「交出去」就等于「数过了」。
    // 中途被 abort 掉的流不算 —— 那正是低速用例要的结局。
    await waitUntil(
      () => fed.every(shard => shard.stream.destroyed || shard.stream.readableLength === 0),
      () => `第 ${tick + 1} 格还有 ${fed.filter(s => !s.stream.destroyed && s.stream.readableLength > 0).length} 个分片的数据没被取走`
    )
    await vi.advanceTimersByTimeAsync(SAMPLE_INTERVAL_MS)
  }
}

/**
 * 把每个分片剩下的字节一次喂完并收尾，让整次下载能正常落定。
 *
 * 喂完就返回，不在这里等下载落定：调用方紧接着 `await run.outcome`，而那是一条
 * 由真实 IO 推动的 promise 链，本身就是最准的那个等法。在这里再定额让几拍
 * 只会让人以为「让够了才对」。
 */
const finishAllShards = (server: ShardServer): void => {
  for (const shard of server.shards) {
    if (shard.stream.destroyed) continue
    const remaining = shard.end - shard.start + 1 - shard.pushed
    if (remaining > 0) shard.stream.push(Buffer.alloc(remaining, 1))
    shard.stream.push(null)
  }
}

beforeEach(() => {
  resetDownloadBudget()
  setDownloadBudgetLimitResolver(() => 2)
})

afterEach(() => {
  resetDownloadBudget()
  setDownloadBudgetLimitResolver(undefined as never)
  vi.useRealTimers()
})

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('parseContentRange', () => {
  it('读出标准形状的三个数', () => {
    expect(parseContentRange('bytes 0-1023/8192')).toEqual({ start: 0, end: 1023, total: 8192 })
  })

  it('大小写和空白宽松处理 —— 头部是远端给的，不该按大小写较真', () => {
    expect(parseContentRange('BYTES   0-0/1')).toEqual({ start: 0, end: 0, total: 1 })
  })

  it.each([
    ['整段未知长度', 'bytes 0-1023/*'],
    ['区间未知', 'bytes */8192'],
    ['缺单位', '0-1023/8192'],
    ['起点大于终点', 'bytes 100-50/8192'],
    ['终点越过总长', 'bytes 0-8192/8192'],
    ['终点正好等于总长', 'bytes 8192-8192/8192'],
    ['非数字', 'bytes a-b/c'],
    ['空串', ''],
    ['undefined', undefined],
    ['null', null]
  ])('%s 一律返回 null，而不是一个半截的区间', (_label, value) => {
    expect(parseContentRange(value)).toBeNull()
  })

  it('超过安全整数范围的值不收 —— 那会让后面的区间算术悄悄失准', () => {
    expect(parseContentRange('bytes 0-1/99999999999999999999')).toBeNull()
  })
})

describe('createRanges', () => {
  it('整除时均分', () => {
    expect(createRanges(4096, 2)).toEqual([
      { start: 0, end: 2047 },
      { start: 2048, end: 4095 }
    ])
  })

  it('不整除时最后一段短一点，且合起来正好盖满', () => {
    const ranges = createRanges(1000, 3)
    expect(ranges[0]).toEqual({ start: 0, end: 333 })
    expect(ranges[ranges.length - 1]?.end).toBe(999)
    const covered = ranges.reduce((sum, range) => sum + (range.end - range.start + 1), 0)
    expect(covered).toBe(1000)
  })

  it('分片数比总字节还多时不产出空区间', () => {
    const ranges = createRanges(3, 8)
    expect(ranges).toHaveLength(3)
    expect(ranges.every(range => range.start <= range.end)).toBe(true)
  })

  it('并发数是脏值时退化成一条，而不是抛错', () => {
    expect(createRanges(4096, Number.NaN)).toEqual([{ start: 0, end: 4095 }])
    expect(createRanges(4096, 0)).toEqual([{ start: 0, end: 4095 }])
    expect(createRanges(4096, -3)).toEqual([{ start: 0, end: 4095 }])
  })
})

describe('probeRangeSupport', () => {
  const probeRequest = (
    status: number,
    headers: Record<string, string>
  ): { request: Parameters<typeof probeRangeSupport>[0]['request'], destroyed: () => boolean } => {
    const stream = new ManualStream()
    const request = (async () => ({ status, headers, data: stream })) as never
    return { request, destroyed: () => stream.destroyed }
  }

  it('206 + 合法 content-range 时读出总长与校验器', async () => {
    const { request } = probeRequest(206, { 'content-range': 'bytes 0-0/8388608', etag: '"abc"' })

    await expect(probeRangeSupport({ request })).resolves.toEqual({
      total: 8388608,
      validator: { name: 'etag', value: '"abc"' }
    })
  })

  it('弱校验的 ETag 不采信，退到 last-modified', async () => {
    const { request } = probeRequest(206, {
      'content-range': 'bytes 0-0/8388608',
      etag: 'W/"weak"',
      'last-modified': 'Wed, 21 Oct 2026 07:28:00 GMT'
    })

    // 弱校验只保证「语义等价」，同一个 W/ETag 下字节可以不同 ——
    // 拿它当分片一致性的判据等于放过「下到一半资源被换了」这种情况
    await expect(probeRangeSupport({ request })).resolves.toMatchObject({
      validator: { name: 'last-modified', value: 'Wed, 21 Oct 2026 07:28:00 GMT' }
    })
  })

  it('两个校验器都没有时返回 null，而不是编一个出来', async () => {
    const { request } = probeRequest(206, { 'content-range': 'bytes 0-0/8388608' })

    await expect(probeRangeSupport({ request })).resolves.toMatchObject({ validator: null })
  })

  it.each([
    ['状态码不是 206', 200, { 'content-range': 'bytes 0-0/8388608' }],
    ['没有 content-range', 206, {}],
    ['content-range 不是我们要的那一个字节', 206, { 'content-range': 'bytes 0-1023/8388608' }]
  ])('%s 时报 MULTIPART_UNSUPPORTED，让上层回落单线程', async (_label, status, headers) => {
    const { request } = probeRequest(status, headers)

    await expect(probeRangeSupport({ request })).rejects.toMatchObject({
      code: 'MULTIPART_UNSUPPORTED'
    })
  })

  it('探测流一定要销毁 —— 探完不关的话那条连接会一直挂着', async () => {
    const { request, destroyed } = probeRequest(206, { 'content-range': 'bytes 0-0/8388608' })

    await probeRangeSupport({ request })

    expect(destroyed()).toBe(true)
  })
})

/**
 * 合计速率的低速看守。
 *
 * 只假掉 `setInterval` / `clearInterval` / `Date` 三样：`setImmediate` 得留真的
 * （流机制靠它推进），`setTimeout` 也得留真的 —— 分片重试的退避用的是它，
 * 一并假掉之后那条路会在假时钟里永远等下去。
 */
describe('分片下载的合计低速看守', () => {
  /** 8MB：剩余量远在收尾豁免线之上，判定不会被豁免顺手挡掉 */
  const TOTAL = 8 * 1024 * 1024
  /**
   * 地板速取 3000 B/s，两个分片各喂 4000 B/格（每格 2 秒）。
   *
   * 这组数是**故意**摆成「单看每个分片都低于地板速，合起来才够」的：
   * 单片速率 2000 B/s < 3000，合计 4000 B/s > 3000。看守要是改成按单片判，
   * 下面那条「健康」的用例就会翻红 —— 这正是它存在的意义。
   */
  const FLOOR = 3000
  const HEALTHY_PER_TICK = 4000
  /** 低速用例每格只喂 400 B，合计 400 B/s，比地板速低一个数量级 */
  const SLOW_PER_TICK = 400

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
  })

  it('合计速率持续低于地板速时掐掉，并抛自己那份低速错误', async () => {
    const server = createShardServer(TOTAL)
    const run = startMultipart(server, { total: TOTAL, slowFloorBytesPerSecond: FLOOR })
    await server.waitForShards(2)

    await driveTicks(server, SLOW_PER_TICK, TICKS_TO_VERDICT + 2)

    const outcome = await run.outcome
    expect(outcome.status).toBe('rejected')
    if (outcome.status !== 'rejected') return
    // 抛的必须是我们造的那份，不能是 abort() 之后每个分片抛的 ERR_CANCELED：
    // 上层拿 `isSlowDownloadAbort` 判要不要换地址，认不出来就等于在同一个
    // 被限速的节点上反复重试到底
    expect(isSlowDownloadAbort(outcome.error)).toBe(true)
    expect(outcome.error).toMatchObject({ code: SLOW_DOWNLOAD_ABORT_CODE, kkkSlowAbort: true })
    expect((outcome.error as Error).message).toMatch(/下载速度持续低于下限/)
  })

  it('每个分片单看都低于地板速、合起来够时不动手', async () => {
    const server = createShardServer(TOTAL)
    const run = startMultipart(server, { total: TOTAL, slowFloorBytesPerSecond: FLOOR })
    await server.waitForShards(2)

    // 推到判定窗口的两倍那么久：真要误判，这么长的窗口一定盖得住
    await driveTicks(server, HEALTHY_PER_TICK, TICKS_TO_VERDICT * 2)
    finishAllShards(server)

    const outcome = await run.outcome
    // 误判的代价是把一条好连接和已下的字节一起扔掉，再换个地址重来
    expect(outcome.status).toBe('resolved')
    expect(readFileSync(run.filepath)).toHaveLength(TOTAL)
  })

  it.each([
    ['没给地板速', undefined],
    ['地板速为 0', 0]
  ])('%s 时不装看守，彻底不动的流也照样等下去', async (_label, slowFloorBytesPerSecond) => {
    const server = createShardServer(TOTAL)
    const run = startMultipart(server, { total: TOTAL, slowFloorBytesPerSecond })
    await server.waitForShards(2)

    // 一个字节都不喂，比任何限速都慢
    await driveTicks(server, 0, TICKS_TO_VERDICT * 2)
    finishAllShards(server)

    const outcome = await run.outcome
    // 关掉低速判定是用户在面板上的选择，不能被看守的默认值顶回来
    expect(outcome.status).toBe('resolved')
  })

  it('自定义持续窗口生效，判定跟着提前', async () => {
    const server = createShardServer(TOTAL)
    const run = startMultipart(server, {
      total: TOTAL,
      slowFloorBytesPerSecond: FLOOR,
      slowSustainMs: SAMPLE_INTERVAL_MS * 2
    })
    await server.waitForShards(2)

    // 宽限期照旧要走完，但持续窗口只要两格 —— 比默认的十格早得多
    await driveTicks(server, SLOW_PER_TICK, DEFAULT_GRACE_MS / SAMPLE_INTERVAL_MS + 3)

    const outcome = await run.outcome
    expect(outcome.status).toBe('rejected')
    if (outcome.status !== 'rejected') return
    expect(isSlowDownloadAbort(outcome.error)).toBe(true)
  })

  it('快下完了不掐 —— 剩余量低于豁免线时重启纯亏', async () => {
    // 总量摆在豁免线以内：无论下了多少，剩余量都低于 MIN_REMAINING_BYTES，
    // 于是「慢」也不该动手 —— 重新握手的代价比等它下完还大
    const total = MIN_REMAINING_BYTES - 1024
    const server = createShardServer(total)
    const run = startMultipart(server, { total, slowFloorBytesPerSecond: FLOOR })
    await server.waitForShards(2)

    await driveTicks(server, SLOW_PER_TICK, TICKS_TO_VERDICT + 2)
    finishAllShards(server)

    const outcome = await run.outcome
    expect(outcome.status).toBe('resolved')
  })

  it('掐掉之后不留临时分片文件', async () => {
    const server = createShardServer(TOTAL)
    const run = startMultipart(server, { total: TOTAL, slowFloorBytesPerSecond: FLOOR })
    await server.waitForShards(2)

    await driveTicks(server, SLOW_PER_TICK, TICKS_TO_VERDICT + 2)
    await run.outcome

    // 目标文件没落成，`.part` 中间文件也不能留 —— 留着的话下一次重试会
    // 在同一个目录里越堆越多，而它们都是整个文件那么大
    expect(existsSync(run.filepath)).toBe(false)
    expect(readdirSync(workspace).filter(name => name.endsWith('.part'))).toEqual([])
  })
})

describe('分片一致性校验', () => {
  const TOTAL = 4096

  it('资源在分片期间被换掉时报 MULTIPART_RESOURCE_CHANGED', async () => {
    const server = createShardServer(TOTAL, { headers: { etag: '"v2"' } })
    const run = startMultipart(server, {
      total: TOTAL,
      // 探测阶段拿到的是 v1，分片响应回的是 v2
      validator: { name: 'etag', value: '"v1"' },
      maxRetries: 2
    })
    await server.waitForShards(1)

    const outcome = await run.outcome
    expect(outcome.status).toBe('rejected')
    if (outcome.status !== 'rejected') return
    expect(outcome.error).toMatchObject({ code: 'MULTIPART_RESOURCE_CHANGED' })
  })

  it('content-range 对不上时报 MULTIPART_INVALID_RANGE', async () => {
    // 回一个和请求区间无关的 content-range：这条分片写到暂存文件里就是错位的字节，
    // 拼出来的文件能落地却是坏的 —— 所以必须在写之前就拦住
    const server = createShardServer(TOTAL, { contentRange: () => `bytes 0-15/${TOTAL}` })
    const run = startMultipart(server, { total: TOTAL, maxRetries: 2 })
    await server.waitForShards(1)

    const outcome = await run.outcome
    expect(outcome.status).toBe('rejected')
    if (outcome.status !== 'rejected') return
    expect(outcome.error).toMatchObject({ code: 'MULTIPART_INVALID_RANGE' })
  })

  it('结构性失败不重试 —— 同一个坏响应再问几遍还是坏的', async () => {
    const server = createShardServer(TOTAL, { contentRange: () => `bytes 0-15/${TOTAL}` })
    const run = startMultipart(server, { total: TOTAL, concurrency: 2, maxRetries: 3 })

    await run.outcome

    // 允许 3 次重试，但结构性失败一次都不该重来。分片数取决于抢到几格额度，
    // 所以按「每个分片恰好问过一次」来断言
    expect(server.requests).toBe(server.shards.length)
  })

  it('结构性失败同样不留临时文件', async () => {
    const server = createShardServer(TOTAL, { status: 200 })
    const run = startMultipart(server, { total: TOTAL, maxRetries: 0 })

    await run.outcome

    expect(readdirSync(workspace).filter(name => name.endsWith('.part'))).toEqual([])
  })
})

describe('额度退化', () => {
  it('一格额度都抢不到时退化成一条 range，而不是报错', async () => {
    setDownloadBudgetLimitResolver(() => 1)
    // 把桶占满：文件级下载自己那一格
    const fileSlot = await acquireDownloadSlot({ bucket: 'douyin' })
    const total = 4096
    const server = createShardServer(total)
    const run = startMultipart(server, { total, concurrency: 4 })
    await server.waitForShards(1)
    finishAllShards(server)

    const outcome = await run.outcome
    expect(outcome.status).toBe('resolved')
    // 退化成单线程是正确的降级，不是失败
    expect(server.shards).toHaveLength(1)
    expect(server.shards[0]).toMatchObject({ start: 0, end: total - 1 })
    expect(readFileSync(run.filepath)).toHaveLength(total)

    fileSlot.release()
  })
})
