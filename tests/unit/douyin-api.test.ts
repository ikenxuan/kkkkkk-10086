import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const configMock = vi.hoisted(() => ({
  request: {} as Record<string, unknown>,
  cookies: {} as Record<string, unknown>
}))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: configMock
}))

const { getDouyinData } = await import('../../src/module/platform/douyin/api.js')

const fetchVideoWork = vi.fn()
const fetchUserFavoriteList = vi.fn()
const parseWork = vi.fn()

/** 注入替代真实 amagi 的方法映射与 fetcher */
const dependencies = {
  methodMap: {
    视频作品数据: 'fetchVideoWork',
    聚合解析: 'parseWork',
    缺失实现: 'fetchMissingMethod'
  },
  fetcher: {
    fetchVideoWork,
    fetchUserFavoriteList,
    parseWork
  }
}

beforeEach(() => {
  configMock.request = {}
  configMock.cookies = {}
  fetchVideoWork.mockReset()
  fetchVideoWork.mockResolvedValue({ ok: true })
  fetchUserFavoriteList.mockReset()
  fetchUserFavoriteList.mockResolvedValue({ ok: true })
  parseWork.mockReset()
  parseWork.mockResolvedValue({ ok: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getDouyinData v5 compatibility wrapper', () => {
  it('accepts the (method, cookie, options) call shape', async () => {
    expect(await getDouyinData('视频作品数据', 'cookie-from-caller', { aweme_id: '123' }, dependencies)).toEqual({ ok: true })

    expect(fetchVideoWork).toHaveBeenCalledTimes(1)
    const [options, cookie] = fetchVideoWork.mock.calls[0] as [unknown, unknown, unknown]
    expect(options).toEqual({ aweme_id: '123' })
    expect(cookie).toBe('cookie-from-caller')
  })

  it('accepts the (method, options) call shape and falls back to the configured cookie', async () => {
    configMock.cookies.douyin = 'cookie-from-config'

    await getDouyinData('聚合解析', { url: 'https://v.douyin.com/x' }, undefined, dependencies)

    const [options, cookie] = parseWork.mock.calls[0] as [unknown, unknown, unknown]
    expect(options).toEqual({ url: 'https://v.douyin.com/x' })
    expect(cookie).toBe('cookie-from-config')
  })

  it('uses an empty cookie when neither caller nor config provides one', async () => {
    await getDouyinData('视频作品数据', { aweme_id: '1' }, undefined, dependencies)

    const [, cookie] = fetchVideoWork.mock.calls[0] as [unknown, unknown, unknown]
    expect(cookie).toBe('')
  })

  it('defaults the options to an empty object when the caller passes none', async () => {
    await getDouyinData('视频作品数据', undefined, undefined, dependencies)

    const [options] = fetchVideoWork.mock.calls[0] as [unknown, unknown, unknown]
    expect(options).toEqual({})
  })

  it('routes an exposed English fetcher name through the guarded request path', async () => {
    configMock.cookies.douyin = 'guarded-cookie'

    await getDouyinData('fetchUserFavoriteList', { sec_uid: 'sec-1' }, undefined, dependencies)

    expect(fetchUserFavoriteList).toHaveBeenCalledTimes(1)
    const [options, cookie, requestConfig] = fetchUserFavoriteList.mock.calls[0] as [
      unknown,
      unknown,
      { signal?: AbortSignal }
    ]
    expect(options).toEqual({ sec_uid: 'sec-1' })
    expect(cookie).toBe('guarded-cookie')
    expect(requestConfig.signal).toBeInstanceOf(AbortSignal)
  })

  it('rejects an unknown Chinese method name', async () => {
    await expect(getDouyinData('不存在的方法', undefined, undefined, dependencies))
      .rejects.toThrow('Unsupported Douyin API method: 不存在的方法')
  })

  it('rejects a mapped method that the fetcher does not implement', async () => {
    await expect(getDouyinData('缺失实现', undefined, undefined, dependencies))
      .rejects.toThrow('Unsupported Douyin API method: 缺失实现')
  })

  describe('request config', () => {
    it('passes the configured timeout and user agent', async () => {
      configMock.request = { timeout: 5000, 'User-Agent': 'kkk-agent' }

      await getDouyinData('视频作品数据', undefined, undefined, dependencies)

      const [, , requestConfig] = fetchVideoWork.mock.calls[0] as [unknown, unknown, { timeout: number, headers: Record<string, string>, proxy: unknown }]
      expect(requestConfig.timeout).toBe(5000)
      expect(requestConfig.headers['User-Agent']).toBe('kkk-agent')
      expect(requestConfig.proxy).toBe(false)
    })

    it('falls back to a 15 second timeout', async () => {
      await getDouyinData('视频作品数据', undefined, undefined, dependencies)

      const [, , requestConfig] = fetchVideoWork.mock.calls[0] as [unknown, unknown, { timeout: number }]
      expect(requestConfig.timeout).toBe(15000)
    })

    it('forwards the proxy settings when the switch is on', async () => {
      configMock.request = {
        proxy: { switch: true, host: '127.0.0.1', port: '7890', protocol: 'http', auth: { username: 'u', password: 'p' } }
      }

      await getDouyinData('视频作品数据', undefined, undefined, dependencies)

      const [, , requestConfig] = fetchVideoWork.mock.calls[0] as [unknown, unknown, { proxy: unknown }]
      expect(requestConfig.proxy).toEqual({
        host: '127.0.0.1',
        port: 7890,
        protocol: 'http',
        auth: { username: 'u', password: 'p' }
      })
    })

    it('passes an abort signal and releases a stuck Amagi attempt at the hard timeout', async () => {
      vi.useFakeTimers()
      configMock.request = { amagiTimeout: 10, amagiMaxRetries: 0 }
      let attemptSignal: AbortSignal | undefined
      fetchVideoWork.mockImplementation((
        _options: unknown,
        _cookie: unknown,
        requestConfig: { signal?: AbortSignal }
      ) => {
        attemptSignal = requestConfig.signal
        if (!attemptSignal) return Promise.resolve({ missingSignal: true })

        return new Promise((_resolve, reject) => {
          attemptSignal?.addEventListener('abort', () => reject(attemptSignal?.reason), { once: true })
        })
      })

      const request = getDouyinData('视频作品数据', undefined, undefined, dependencies)
      const assertion = expect(request).rejects.toMatchObject({
        name: 'RequestTimeoutError',
        code: 'ERR_REQUEST_TIMEOUT',
        timeoutMs: 10
      })

      await vi.advanceTimersByTimeAsync(10)
      await assertion

      expect(fetchVideoWork).toHaveBeenCalledTimes(1)
      expect(attemptSignal).toBeInstanceOf(AbortSignal)
      expect(attemptSignal?.aborted).toBe(true)
    })

    it('caps a manually configured Amagi timeout at one minute', async () => {
      vi.useFakeTimers()
      configMock.request = { amagiTimeout: 60_001, amagiMaxRetries: 0 }
      fetchVideoWork.mockImplementation((
        _options: unknown,
        _cookie: unknown,
        requestConfig: { signal?: AbortSignal }
      ) => new Promise((_resolve, reject) => {
        requestConfig.signal?.addEventListener('abort', () => reject(requestConfig.signal?.reason), { once: true })
      }))

      let settled = false
      const failure = getDouyinData('视频作品数据', undefined, undefined, dependencies)
        .catch((error: unknown) => {
          settled = true
          return error
        })

      await vi.advanceTimersByTimeAsync(60_000)
      const settledAtOneMinute = settled
      await vi.advanceTimersByTimeAsync(1)
      const error = await failure

      expect(settledAtOneMinute).toBe(true)
      expect(error).toMatchObject({
        name: 'RequestTimeoutError',
        timeoutMs: 60_000
      })
    })
  })
})
