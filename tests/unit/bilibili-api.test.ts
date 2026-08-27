import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const configMock = vi.hoisted(() => ({
  request: {} as Record<string, unknown>,
  cookies: {} as Record<string, unknown>
}))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: configMock
}))

const { resetApiCache, setApiCacheEnabledResolver } = await import('../../src/module/utils/ApiCache.js')
const { getBilibiliData } = await import('../../src/module/platform/bilibili/api.js')

const fetchVideoWork = vi.fn()
const fetchComments = vi.fn()

/** 注入替代真实 amagi 的方法名解析、方法映射与 fetcher */
const dependencies = {
  /** amagi v6 优先通过该函数解析中文方法名 */
  getEnglishMethodName: (platform: string, method: string) =>
    platform === 'bilibili' && method === '单个视频作品数据' ? 'fetchVideoWork' : undefined,
  /** 解析失败时回退到旧的静态映射表 */
  methodMap: {
    评论数据: 'fetchComments',
    缺失实现: 'fetchMissingMethod'
  },
  fetcher: {
    fetchVideoWork,
    fetchComments
  }
}

/**
 * 这些用例断言的是 wrapper 的**分发语义**（方法名解析、cookie 兜底、请求配置、重试），
 * 逐条数底层 fetcher 被调了几次。接口响应缓存挂在 wrapper 最外层，且缓存是进程内单例，
 * 所以这里显式把它关掉：不关的话，两个用例只要调了同一个白名单方法 + 同一份参数 + 同一个 ck，
 * 后一个就会命中前一个留下的缓存，fetcher 一次都不被调，用例读起来像「wrapper 坏了」。
 * 缓存本身的行为在 tests/unit/api-cache.test.ts，接线在 tests/unit/api-cache-wiring.test.ts。
 */
beforeEach(() => {
  resetApiCache()
  setApiCacheEnabledResolver(() => false)
  configMock.request = {}
  configMock.cookies = {}
  fetchVideoWork.mockReset()
  fetchVideoWork.mockResolvedValue({ ok: true })
  fetchComments.mockReset()
  fetchComments.mockResolvedValue({ ok: 'comments' })
})

afterEach(() => {
  resetApiCache()
  vi.useRealTimers()
})

describe('getBilibiliData method resolution', () => {
  it('resolves the fetcher through getEnglishMethodName first', async () => {
    expect(await getBilibiliData('单个视频作品数据', '', { bvid: 'BV1' }, dependencies)).toEqual({ ok: true })

    expect(fetchVideoWork).toHaveBeenCalledTimes(1)
    expect(fetchComments).not.toHaveBeenCalled()
  })

  it('falls back to the static method map when the name lookup misses', async () => {
    expect(await getBilibiliData('评论数据', '', { oid: '1' }, dependencies)).toEqual({ ok: 'comments' })

    expect(fetchComments).toHaveBeenCalledTimes(1)
    expect(fetchVideoWork).not.toHaveBeenCalled()
  })

  it('rejects an unknown Chinese method name', async () => {
    await expect(getBilibiliData('不存在的方法', undefined, undefined, dependencies))
      .rejects.toThrow('Unsupported Bilibili API method: 不存在的方法')
  })

  it('rejects a mapped method that the fetcher does not implement', async () => {
    await expect(getBilibiliData('缺失实现', undefined, undefined, dependencies))
      .rejects.toThrow('Unsupported Bilibili API method: 缺失实现')
  })
})

describe('getBilibiliData v5 compatibility wrapper', () => {
  it('accepts the (method, cookie, options) call shape', async () => {
    await getBilibiliData('单个视频作品数据', 'cookie-from-caller', { bvid: 'BV1xx' }, dependencies)

    const [options, cookie] = fetchVideoWork.mock.calls[0] as [unknown, unknown, unknown]
    expect(options).toEqual({ bvid: 'BV1xx' })
    expect(cookie).toBe('cookie-from-caller')
  })

  it('accepts the (method, options) call shape and falls back to the configured cookie', async () => {
    configMock.cookies.bilibili = 'cookie-from-config'

    await getBilibiliData('单个视频作品数据', { bvid: 'BV1yy' }, undefined, dependencies)

    const [options, cookie] = fetchVideoWork.mock.calls[0] as [unknown, unknown, unknown]
    expect(options).toEqual({ bvid: 'BV1yy' })
    expect(cookie).toBe('cookie-from-config')
  })

  it('keeps an explicitly empty cookie instead of reading the config', async () => {
    configMock.cookies.bilibili = 'cookie-from-config'

    await getBilibiliData('单个视频作品数据', '', { bvid: 'BV1zz' }, dependencies)

    const [, cookie] = fetchVideoWork.mock.calls[0] as [unknown, unknown, unknown]
    expect(cookie).toBe('')
  })

  it('uses an empty cookie when neither caller nor config provides one', async () => {
    await getBilibiliData('单个视频作品数据', { bvid: 'BV1' }, undefined, dependencies)

    const [, cookie] = fetchVideoWork.mock.calls[0] as [unknown, unknown, unknown]
    expect(cookie).toBe('')
  })

  it('defaults the options to an empty object when the caller passes none', async () => {
    await getBilibiliData('单个视频作品数据', undefined, undefined, dependencies)

    const [options] = fetchVideoWork.mock.calls[0] as [unknown, unknown, unknown]
    expect(options).toEqual({})
  })

  describe('request config', () => {
    it('passes the configured timeout and user agent', async () => {
      configMock.request = { timeout: 5000, 'User-Agent': 'kkk-agent' }

      await getBilibiliData('单个视频作品数据', undefined, undefined, dependencies)

      const [, , requestConfig] = fetchVideoWork.mock.calls[0] as [unknown, unknown, { timeout: number, headers: Record<string, string>, proxy: unknown }]
      expect(requestConfig.timeout).toBe(5000)
      expect(requestConfig.headers['User-Agent']).toBe('kkk-agent')
      expect(requestConfig.proxy).toBe(false)
    })

    it('falls back to a 15 second timeout', async () => {
      await getBilibiliData('单个视频作品数据', undefined, undefined, dependencies)

      const [, , requestConfig] = fetchVideoWork.mock.calls[0] as [unknown, unknown, { timeout: number }]
      expect(requestConfig.timeout).toBe(15000)
    })

    it('forwards the proxy settings when the switch is on', async () => {
      configMock.request = {
        proxy: { switch: true, host: '127.0.0.1', port: '7890', protocol: 'http', auth: { username: 'u', password: 'p' } }
      }

      await getBilibiliData('单个视频作品数据', undefined, undefined, dependencies)

      const [, , requestConfig] = fetchVideoWork.mock.calls[0] as [unknown, unknown, { proxy: unknown }]
      expect(requestConfig.proxy).toEqual({
        host: '127.0.0.1',
        port: 7890,
        protocol: 'http',
        auth: { username: 'u', password: 'p' }
      })
    })

    it('retries a transient Amagi failure with a fresh signal for each attempt', async () => {
      vi.useFakeTimers()
      configMock.request = { amagiTimeout: 60_000, amagiMaxRetries: 1 }
      const attemptSignals: Array<AbortSignal | undefined> = []
      fetchVideoWork
        .mockImplementationOnce((
          _options: unknown,
          _cookie: unknown,
          requestConfig: { signal?: AbortSignal }
        ) => {
          attemptSignals.push(requestConfig.signal)
          return Promise.reject(Object.assign(new Error('temporary network failure'), { code: 'ECONNRESET' }))
        })
        .mockImplementationOnce((
          _options: unknown,
          _cookie: unknown,
          requestConfig: { signal?: AbortSignal }
        ) => {
          attemptSignals.push(requestConfig.signal)
          return Promise.resolve({ recovered: true })
        })

      const request = getBilibiliData('单个视频作品数据', undefined, undefined, dependencies)
      const assertion = expect(request).resolves.toEqual({ recovered: true })

      await vi.advanceTimersByTimeAsync(250)
      await assertion

      expect(fetchVideoWork).toHaveBeenCalledTimes(2)
      expect(attemptSignals).toHaveLength(2)
      expect(attemptSignals.every(signal => signal instanceof AbortSignal)).toBe(true)
      expect(attemptSignals[0]).not.toBe(attemptSignals[1])
    })
  })
})
