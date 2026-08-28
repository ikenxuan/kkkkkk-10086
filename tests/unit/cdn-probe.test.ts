import { Readable } from 'node:stream'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosRequestConfig } from 'axios'

// ---------------------------------------------------------------------------
// axios 在 CdnProbe 里是被**直接调用**的（`axios<Readable>({ ... })`），
// 所以 mock 必须给出一个可调用的 default，而不是一个带 get/request 的对象。
//
// 整个文件一次真实网络请求都不发：测速的判定全部来自这个假响应。
// ---------------------------------------------------------------------------
const axiosSend = vi.hoisted(() => vi.fn())
vi.mock('axios', () => ({ default: axiosSend }))

const loggerMock = {
  warn: vi.fn(),
  error: vi.fn(),
  mark: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
}

// probeAndOrderCdnUrls 会 logger.debug 记下选中了谁；少了这个全局会炸成
// `ReferenceError: logger is not defined`，把它伪装成断言失败。
globalThis.logger = loggerMock as unknown as typeof logger

const {
  DEFAULT_PROBE_TIMEOUT_MS,
  DEFAULT_SAMPLE_BYTES,
  PROBE_TTL_MS,
  getCdnProbeSnapshot,
  probeAndOrderCdnUrls,
  probeCdnUrl,
  resetCdnProbe
} = await import('../../src/module/utils/CdnProbe.js')

const T0 = 1_700_000_000_000

/**
 * 假时钟。
 *
 * TTFB 和吞吐都是 `Date.now()` 的差值算出来的，用真时钟的话它们在快机器上全是
 * 0 或 1 毫秒，测不出任何排序。这里让时钟只在假响应里显式推进：
 * 「握手花了多久」由 axios mock 推，「读 body 花了多久」由响应流推。
 *
 * 代价是**并发**探测会互相污染彼此的读数（共享同一个时钟），所以凡是要对
 * ttfb / 吞吐做断言的用例，都只让一批里有一次真探测（见 seedProbe）。
 */
let clockMs = T0

const advance = (ms: number): void => {
  clockMs += ms
}

vi.spyOn(Date, 'now').mockImplementation(() => clockMs)

interface ResponsePlan {
  /** HTTP 状态码，默认 206（Range 请求的正常回应） */
  status?: number
  /** 握手 + 首字节耗时 */
  ttfbMs?: number
  /** 读 body 耗时，吞吐的分母 */
  bodyMs?: number
  /** body 给多少字节，默认给满一个样本 */
  bytes?: number
  /** 给了就抛它，模拟 DNS / 连接层失败 */
  error?: unknown
}

const plans = new Map<string, ResponsePlan>()

/** 给某个地址安排一次假响应，返回地址本身好让调用处一行写完 */
const respond = (url: string, plan: ResponsePlan = {}): string => {
  plans.set(url, plan)
  return url
}

/** 每次造出来的响应流都留一份，用来验证 4xx 时有没有真的把它掐掉 */
const bodies: Readable[] = []

const bodyStream = (bytes: number, bodyMs: number): Readable => {
  const stream = Readable.from((async function * () {
    // 吞吐只按读 body 的这段时间算，所以时钟在这里走
    advance(bodyMs)
    if (bytes > 0) yield Buffer.alloc(bytes)
  })())
  bodies.push(stream)
  return stream
}

const HOST_A = 'upos-sz-mirrorcos.bilivideo.com'
const HOST_B = 'upos-sz-mirrorbd.bilivideo.com'
const HOST_C = 'v26-web.douyinvod.com'

const urlOn = (host: string, path = '/upgcxcode/12/34/1234567-1-30080.m4s'): string =>
  `https://${host}${path}?deadline=1700000000&upsig=deadbeefcafe`

/** host 解析不出来的地址：会被判失败，且**不会**发起探测 */
const BAD_URL = 'not a url'

const probedUrls = (): string[] =>
  axiosSend.mock.calls.map(call => String((call[0] as AxiosRequestConfig).url))

const requestAt = (index: number): AxiosRequestConfig =>
  axiosSend.mock.calls[index]?.[0] as AxiosRequestConfig

const headerAt = (index: number, name: string): unknown =>
  (requestAt(index).headers as Record<string, unknown> | undefined)?.[name]

/**
 * 往测速缓存里塞一条确定的结果。
 *
 * 缓存只有 `probeAndOrderCdnUrls` 会写，而它是并发探测的 —— 于是这里凑一条畸形地址
 * 当第二个候选：它 host 解析不出来，直接算失败且不发请求，这一批里就只有一次真探测，
 * 没有并发交错，假时钟给出的 ttfb 与吞吐都是确定值。
 */
const seedProbe = async (url: string, plan: ResponsePlan = {}): Promise<void> => {
  respond(url, plan)
  await probeAndOrderCdnUrls([url, BAD_URL], { now: T0 })
}

beforeEach(() => {
  resetCdnProbe()
  plans.clear()
  bodies.length = 0
  clockMs = T0
  loggerMock.debug.mockClear()
  axiosSend.mockReset()
  axiosSend.mockImplementation(async (config: AxiosRequestConfig) => {
    const plan = plans.get(String(config.url))
    if (!plan) throw new Error(`用例没给 ${String(config.url)} 安排假响应`)
    advance(plan.ttfbMs ?? 10)
    if ('error' in plan) throw plan.error
    return {
      status: plan.status ?? 206,
      data: bodyStream(plan.bytes ?? DEFAULT_SAMPLE_BYTES, plan.bodyMs ?? 100)
    }
  })
})

describe('probeCdnUrl 的请求形状', () => {
  it('用 Range 限量取样，而不是 HEAD —— HEAD 没有响应体，测不出吞吐', async () => {
    await probeCdnUrl(respond(urlOn(HOST_A)))

    expect(requestAt(0).method).toBe('GET')
    expect(requestAt(0).responseType).toBe('stream')
    expect(headerAt(0, 'Range')).toBe(`bytes=0-${DEFAULT_SAMPLE_BYTES - 1}`)
  })

  it('自定义样本大小跟着改 Range 上界', async () => {
    await probeCdnUrl(respond(urlOn(HOST_A)), { sampleBytes: 4096 })

    expect(headerAt(0, 'Range')).toBe('bytes=0-4095')
  })

  it('样本大小为 0 时 Range 不出现负数', async () => {
    await probeCdnUrl(respond(urlOn(HOST_A), { bytes: 1 }), { sampleBytes: 0 })

    expect(headerAt(0, 'Range')).toBe('bytes=0-0')
  })

  it('调用方的请求头和代理原样带上，Range 不被它们盖掉', async () => {
    const proxy = { host: '127.0.0.1', port: 7890 } as const

    await probeCdnUrl(respond(urlOn(HOST_A)), {
      headers: { Referer: 'https://www.bilibili.com', Range: 'bytes=0-1' },
      proxy
    })

    expect(headerAt(0, 'Referer')).toBe('https://www.bilibili.com')
    // Range 排在展开之后，调用方传的那个覆盖不掉它
    expect(headerAt(0, 'Range')).toBe(`bytes=0-${DEFAULT_SAMPLE_BYTES - 1}`)
    expect(requestAt(0).proxy).toBe(proxy)
  })

  it('不压缩、跟随重定向，且不靠 axios 自己的超时', async () => {
    await probeCdnUrl(respond(urlOn(HOST_A)))

    expect(requestAt(0).decompress).toBe(false)
    expect(requestAt(0).maxRedirects).toBe(5)
    // 超时由自带的 AbortController 管，axios 的 timeout 要关掉免得两套互相打架
    expect(requestAt(0).timeout).toBe(0)
    expect(requestAt(0).signal).toBeDefined()
  })

  it('默认超时 5 秒 —— 比这还慢的节点就算能下完也不值得优先', () => {
    expect(DEFAULT_PROBE_TIMEOUT_MS).toBe(5000)
  })
})

describe('probeCdnUrl 的结论', () => {
  it('成功时算出 TTFB 与样本吞吐，主机名小写', async () => {
    const result = await probeCdnUrl(respond(urlOn(HOST_A.toUpperCase()), {
      ttfbMs: 200,
      bodyMs: 100,
      bytes: DEFAULT_SAMPLE_BYTES
    }))

    expect(result).toEqual({
      url: urlOn(HOST_A.toUpperCase()),
      host: HOST_A,
      ok: true,
      ttfbMs: 200,
      // 吞吐只按读 body 的 100ms 算，握手那 200ms 摘出去了：
      // 握手是一次性成本，要预测的是接下来几十兆的持续速率
      bytesPerSecond: DEFAULT_SAMPLE_BYTES / 0.1,
      status: 206
    })
  })

  it('4xx 直接判失败，且不读响应体', async () => {
    const result = await probeCdnUrl(respond(urlOn(HOST_A), { status: 403, ttfbMs: 30 }))

    expect(result).toEqual({
      url: urlOn(HOST_A),
      host: HOST_A,
      ok: false,
      ttfbMs: 30,
      bytesPerSecond: 0,
      status: 403,
      error: 'HTTP 403'
    })
    // 掐掉连接，别让一条用不了的地址继续占着 socket
    expect(bodies[0]?.destroyed).toBe(true)
  })

  it.each([
    ['404', 404],
    ['416 Range 不受理', 416],
    ['500', 500],
    ['503', 503]
  ])('%s 一律算失败', async (_label, status) => {
    const result = await probeCdnUrl(respond(urlOn(HOST_A), { status }))

    expect(result.ok).toBe(false)
    expect(result.error).toBe(`HTTP ${status}`)
  })

  it('200 也算成功 —— 节点不认 Range 时会整条回过来', async () => {
    const result = await probeCdnUrl(respond(urlOn(HOST_A), { status: 200 }))

    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
  })

  it('一个字节都没读到算失败', async () => {
    const result = await probeCdnUrl(respond(urlOn(HOST_A), { bytes: 0, bodyMs: 50 }))

    expect(result.ok).toBe(false)
    expect(result.bytesPerSecond).toBe(0)
    expect(result.status).toBe(206)
  })

  it('body 比样本小也算成功，吞吐按实收字节算', async () => {
    const result = await probeCdnUrl(respond(urlOn(HOST_A), { bytes: 8192, bodyMs: 100 }))

    expect(result.ok).toBe(true)
    expect(result.bytesPerSecond).toBe(8192 / 0.1)
  })

  it('永不抛错：连接层失败变成一条带 code 的结论', async () => {
    const result = await probeCdnUrl(respond(urlOn(HOST_C), {
      ttfbMs: 40,
      error: Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })
    }))

    expect(result).toEqual({
      url: urlOn(HOST_C),
      host: HOST_C,
      ok: false,
      ttfbMs: 40,
      bytesPerSecond: 0,
      error: 'ENOTFOUND'
    })
  })

  it('没有 code 的错误退化成字符串，仍然不抛', async () => {
    const noCode = respond(urlOn(HOST_A), { error: new Error('boom') })
    const notAnObject = respond(urlOn(HOST_B), { error: 'boom' })

    expect((await probeCdnUrl(noCode)).error).toBe('Error: boom')
    expect((await probeCdnUrl(notAnObject)).error).toBe('boom')
  })

  it('读 body 中途断流也不抛，算失败', async () => {
    plans.set(urlOn(HOST_A), {})
    axiosSend.mockImplementationOnce(async () => {
      advance(20)
      const stream = new Readable({ read () {} })
      setImmediate(() => stream.emit('error', Object.assign(new Error('reset'), { code: 'ECONNRESET' })))
      return { status: 206, data: stream }
    })

    const result = await probeCdnUrl(urlOn(HOST_A))

    expect(result.ok).toBe(false)
    expect(result.error).toBe('ECONNRESET')
  })

  it('畸形地址的 host 是空串，不抛错', async () => {
    const result = await probeCdnUrl(respond(BAD_URL))

    expect(result.host).toBe('')
  })

  it('自己不写缓存 —— 缓存只由 probeAndOrderCdnUrls 负责', async () => {
    await probeCdnUrl(respond(urlOn(HOST_A)))

    expect(getCdnProbeSnapshot(T0)).toEqual({ hosts: 0, entries: [] })
  })
})

describe('probeAndOrderCdnUrls 的短路', () => {
  it('只有一条候选时直接返回，不探测 —— 探了也没得选', async () => {
    const only = respond(urlOn(HOST_A))

    expect(await probeAndOrderCdnUrls([only], { now: T0 })).toEqual([only])
    expect(axiosSend).not.toHaveBeenCalled()
  })

  it('空清单返回空数组', async () => {
    expect(await probeAndOrderCdnUrls([], { now: T0 })).toEqual([])
    expect(axiosSend).not.toHaveBeenCalled()
  })

  it('limit 为 0 或负数等于关掉测速，原样返回', async () => {
    const urls = [respond(urlOn(HOST_A)), respond(urlOn(HOST_B))]

    expect(await probeAndOrderCdnUrls(urls, { limit: 0, now: T0 })).toEqual(urls)
    expect(await probeAndOrderCdnUrls(urls, { limit: -2, now: T0 })).toEqual(urls)
    expect(axiosSend).not.toHaveBeenCalled()
  })

  it('只探前 limit 个，其余原样接在后面', async () => {
    const first = respond(urlOn(HOST_A), { bodyMs: 1000 })
    const second = respond(urlOn(HOST_B), { bodyMs: 100 })
    const third = respond(urlOn(HOST_C))

    const ordered = await probeAndOrderCdnUrls([first, second, third], { limit: 2, now: T0 })

    expect(probedUrls()).toEqual([first, second])
    // 备胎的备胎不测速，位置也不动
    expect(ordered[ordered.length - 1]).toBe(third)
    expect(new Set(ordered)).toEqual(new Set([first, second, third]))
  })

  it('host 解析不出来的候选不发请求', async () => {
    const good = respond(urlOn(HOST_A))

    await probeAndOrderCdnUrls([good, BAD_URL, 'ftp://example.com/x.m4s'], { now: T0 })

    expect(probedUrls()).toEqual([good])
  })

  it('不修改调用方传进来的数组', async () => {
    const input = [respond(urlOn(HOST_A), { bodyMs: 1000 }), respond(urlOn(HOST_B), { bodyMs: 100 })]
    const snapshot = [...input]

    await probeAndOrderCdnUrls(input, { now: T0 })

    expect(input).toEqual(snapshot)
  })
})

describe('probeAndOrderCdnUrls 的排序', () => {
  // 这一组先把结果喂进缓存再排序：只有这样每条读数才是确定值，
  // 否则并发探测共享同一个假时钟，测的就是交错顺序而不是排序规则。

  it('快的排前面', async () => {
    const slow = urlOn(HOST_A)
    const fast = urlOn(HOST_B)
    await seedProbe(slow, { bodyMs: 1000 })
    await seedProbe(fast, { bodyMs: 100 })
    axiosSend.mockClear()

    expect(await probeAndOrderCdnUrls([slow, fast], { now: T0 })).toEqual([fast, slow])
    // 全部命中缓存，一次请求都没发
    expect(axiosSend).not.toHaveBeenCalled()
  })

  it('吞吐差在 5% 以内算测量噪声，改比 TTFB', async () => {
    // 655360 vs 630153 B/s，差 3.8%
    const nominallyFaster = urlOn(HOST_A)
    const lowerLatency = urlOn(HOST_B)
    await seedProbe(nominallyFaster, { bodyMs: 100, ttfbMs: 200 })
    await seedProbe(lowerLatency, { bodyMs: 104, ttfbMs: 20 })

    expect(await probeAndOrderCdnUrls([nominallyFaster, lowerLatency], { now: T0 }))
      .toEqual([lowerLatency, nominallyFaster])
  })

  it('吞吐差超过 5% 时不看 TTFB', async () => {
    const highThroughput = urlOn(HOST_A)
    const lowLatency = urlOn(HOST_B)
    await seedProbe(highThroughput, { bodyMs: 100, ttfbMs: 900 })
    await seedProbe(lowLatency, { bodyMs: 400, ttfbMs: 10 })

    expect(await probeAndOrderCdnUrls([highThroughput, lowLatency], { now: T0 }))
      .toEqual([highThroughput, lowLatency])
  })

  it('成功的一律排在失败的前面', async () => {
    const failed = urlOn(HOST_A)
    const succeeded = urlOn(HOST_B)
    await seedProbe(failed, { status: 403 })
    await seedProbe(succeeded, {})

    expect(await probeAndOrderCdnUrls([failed, succeeded], { now: T0 })).toEqual([succeeded, failed])
  })

  it('失败者之间慢的排前面 —— 立刻 403 的那条最不值得再试', async () => {
    const fastFail = urlOn(HOST_A)
    const slowFail = urlOn(HOST_B)
    const succeeded = urlOn(HOST_C)
    await seedProbe(fastFail, { status: 403, ttfbMs: 5 })
    await seedProbe(slowFail, { ttfbMs: 4000, error: Object.assign(new Error('t'), { code: 'ETIMEDOUT' }) })
    await seedProbe(succeeded, {})

    expect(await probeAndOrderCdnUrls([fastFail, slowFail, succeeded], { now: T0 }))
      .toEqual([succeeded, slowFail, fastFail])
  })

  it('吞吐与 TTFB 都打平时保持调用方给的次序', async () => {
    const first = urlOn(HOST_A)
    const second = urlOn(HOST_B)
    await seedProbe(first, { bodyMs: 100, ttfbMs: 50 })
    await seedProbe(second, { bodyMs: 100, ttfbMs: 50 })

    expect(await probeAndOrderCdnUrls([first, second], { now: T0 })).toEqual([first, second])
    expect(await probeAndOrderCdnUrls([second, first], { now: T0 })).toEqual([second, first])
  })

  it('选中谁记一条 debug，把实测值摊出来', async () => {
    const slow = urlOn(HOST_A)
    const fast = urlOn(HOST_B)
    await seedProbe(slow, { bodyMs: 1000 })
    await seedProbe(fast, { bodyMs: 100, ttfbMs: 12 })
    loggerMock.debug.mockClear()

    await probeAndOrderCdnUrls([slow, fast], { now: T0 })

    expect(loggerMock.debug).toHaveBeenCalledWith(expect.stringContaining(HOST_B))
    expect(loggerMock.debug).toHaveBeenCalledWith(expect.stringContaining('640KB/s'))
  })
})

describe('全部探测失败时保持原始顺序', () => {
  it('两条都失败就原样返回，不按「谁失败得更慢」排', async () => {
    // 这种情况通常是本机网络断了或者代理挂了，不是这些节点各有优劣，
    // 此时按失败快慢排序是在噪声上做决策
    const first = respond(urlOn(HOST_A), { ttfbMs: 5, status: 403 })
    const second = respond(urlOn(HOST_B), {
      ttfbMs: 4000,
      error: Object.assign(new Error('t'), { code: 'ETIMEDOUT' })
    })

    expect(await probeAndOrderCdnUrls([first, second], { now: T0 })).toEqual([first, second])
    expect(loggerMock.debug).toHaveBeenCalledWith(expect.stringContaining('保持原有顺序'))
  })

  it('limit 之外的候选也一并原样带回', async () => {
    const first = respond(urlOn(HOST_A), { status: 403 })
    const second = respond(urlOn(HOST_B), { status: 403 })
    const third = respond(urlOn(HOST_C))

    expect(await probeAndOrderCdnUrls([first, second, third], { limit: 2, now: T0 }))
      .toEqual([first, second, third])
    expect(probedUrls()).toEqual([first, second])
  })

  it('一条候选成功就恢复按实测排序', async () => {
    const failed = urlOn(HOST_A)
    const succeeded = urlOn(HOST_B)
    await seedProbe(failed, { status: 403 })
    await seedProbe(succeeded, {})
    loggerMock.debug.mockClear()

    expect(await probeAndOrderCdnUrls([failed, succeeded], { now: T0 })).toEqual([succeeded, failed])
    expect(loggerMock.debug).not.toHaveBeenCalledWith(expect.stringContaining('保持原有顺序'))
  })
})

describe('测速缓存', () => {
  it('按主机名缓存，同一台机器上的另一条地址不再探测', async () => {
    const one = respond(urlOn(HOST_A, '/upgcxcode/aa/bb/1-1-30080.m4s'))
    const another = respond(urlOn(HOST_A, '/upgcxcode/zz/yy/9-9-30112.m4s'))
    const other = respond(urlOn(HOST_B))

    await probeAndOrderCdnUrls([one, BAD_URL], { now: T0 })
    axiosSend.mockClear()

    const ordered = await probeAndOrderCdnUrls([another, other], { now: T0 })

    // 「我到这台机器有多快」跟下的是哪个视频无关，所以只探没见过的那台
    expect(probedUrls()).toEqual([other])
    expect(ordered).toContain(another)
    expect(getCdnProbeSnapshot(T0).hosts).toBe(2)
  })

  it('同一批里的同主机地址仍各探一次 —— 缓存去重只跨批次生效', async () => {
    const one = respond(urlOn(HOST_A, '/upgcxcode/aa/bb/1-1-30080.m4s'))
    const two = respond(urlOn(HOST_A, '/upgcxcode/zz/yy/9-9-30112.m4s'))

    await probeAndOrderCdnUrls([one, two], { now: T0 })

    // 一批探测是并发发出去的，每一路都在**任何**结果落库之前读缓存，所以同主机
    // 在同一批里省不掉。这不是缺陷：B站 的音视频分离流本就是同主机的两条地址，
    // 真要在批内去重，得给每台主机加一份 in-flight 的 Promise 表，
    // 而省下的只是一次 64KB 取样 —— 不值得拿并发正确性去换。
    expect(probedUrls()).toEqual([one, two])
    // 两条结论写的是同一个主机键，后落库的那条覆盖前面 —— 缓存里只留一台机器。
    expect(getCdnProbeSnapshot(T0).hosts).toBe(1)
  })

  it('缓存命中时返回的是这次的地址，不是入库时那条', async () => {
    const seeded = urlOn(HOST_A, '/upgcxcode/aa/bb/1-1-30080.m4s')
    const current = respond(urlOn(HOST_A, '/upgcxcode/zz/yy/9-9-30112.m4s'))
    await seedProbe(seeded, { bodyMs: 100 })
    const slower = respond(urlOn(HOST_B), { bodyMs: 5000 })

    const ordered = await probeAndOrderCdnUrls([slower, current], { now: T0 })

    expect(ordered).toEqual([current, slower])
    expect(ordered).not.toContain(seeded)
  })

  it('端口不进缓存键 —— PCDN 的 :4483 和默认端口是同一台机器', async () => {
    const withPort = respond('https://xy1xy.mcdn.bilivideo.cn:4483/upgcxcode/a.m4s')
    const withoutPort = respond('https://xy1xy.mcdn.bilivideo.cn/upgcxcode/b.m4s')

    await probeAndOrderCdnUrls([withPort, BAD_URL], { now: T0 })
    axiosSend.mockClear()
    await probeAndOrderCdnUrls([withoutPort, respond(urlOn(HOST_B))], { now: T0 })

    expect(probedUrls()).toEqual([urlOn(HOST_B)])
  })

  it('失败的结论一样缓存 —— 十分钟内不必再撞一次同一堵墙', async () => {
    const failing = urlOn(HOST_A)
    await seedProbe(failing, { status: 403 })
    axiosSend.mockClear()

    await probeAndOrderCdnUrls([failing, respond(urlOn(HOST_B))], { now: T0 })

    expect(probedUrls()).toEqual([urlOn(HOST_B)])
  })

  it('TTL 到点重新探测', async () => {
    const url = urlOn(HOST_A)
    await seedProbe(url, {})
    axiosSend.mockClear()

    await probeAndOrderCdnUrls([url, BAD_URL], { now: T0 + PROBE_TTL_MS - 1 })
    expect(axiosSend).not.toHaveBeenCalled()

    await probeAndOrderCdnUrls([url, BAD_URL], { now: T0 + PROBE_TTL_MS })
    expect(probedUrls()).toEqual([url])
  })

  it('TTL 是 10 分钟：够长到一次会话只测一遍，够短到线路变化能被跟上', () => {
    expect(PROBE_TTL_MS).toBe(10 * 60 * 1000)
  })

  it('resetCdnProbe 清空缓存', async () => {
    await seedProbe(urlOn(HOST_A), {})
    expect(getCdnProbeSnapshot(T0).hosts).toBe(1)

    resetCdnProbe()

    expect(getCdnProbeSnapshot(T0)).toEqual({ hosts: 0, entries: [] })
  })
})

describe('getCdnProbeSnapshot', () => {
  it('按主机名列出实测结果，速率取整到 KB', async () => {
    await seedProbe(urlOn(HOST_A), { bodyMs: 100, ttfbMs: 33 })

    expect(getCdnProbeSnapshot(T0)).toEqual({
      hosts: 1,
      entries: [{ host: HOST_A, ok: true, kbPerSecond: 640, ttfbMs: 33 }]
    })
  })

  it('按速率从高到低排', async () => {
    await seedProbe(urlOn(HOST_A), { bodyMs: 1000 })
    await seedProbe(urlOn(HOST_B), { bodyMs: 100 })
    await seedProbe(urlOn(HOST_C), { status: 403 })

    expect(getCdnProbeSnapshot(T0).entries.map(entry => entry.host)).toEqual([HOST_B, HOST_A, HOST_C])
  })

  it('顺手清掉过期条目，且是真删', async () => {
    await seedProbe(urlOn(HOST_A), {})

    expect(getCdnProbeSnapshot(T0 + PROBE_TTL_MS)).toEqual({ hosts: 0, entries: [] })
    expect(getCdnProbeSnapshot(T0)).toEqual({ hosts: 0, entries: [] })
  })
})

describe('样本大小', () => {
  it('默认 64KB —— 够算出有意义的吞吐，又不至于让测速本身变成流量开销', () => {
    expect(DEFAULT_SAMPLE_BYTES).toBe(64 * 1024)
  })
})
