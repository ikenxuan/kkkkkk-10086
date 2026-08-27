import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const configMock = vi.hoisted(() => ({
  request: {} as Record<string, unknown>,
  cookies: {} as Record<string, unknown>
}))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: configMock
}))

const { resetApiCache, setApiCacheEnabledResolver } = await import('../../src/module/utils/ApiCache.js')
const { getKuaishouData } = await import('../../src/module/platform/kuaishou/api.js')

const fetchVideoWork = vi.fn()
const fetchWorkComments = vi.fn()
const fetchEmojiList = vi.fn()

/**
 * 注入替代真实 amagi 的方法映射与 fetcher。
 *
 * 中文键逐字抄自 `@ikenxuan/amagi@6.5.0` 的 `KuaishouInternalMethods`
 * （`dist/default/index.d.ts:26006`），值抄自 `KuaishouFetcherMethods`。
 * 这三对是本插件实际用到的全部，`fetchUserProfile` / `fetchUserWorkList` /
 * `fetchLiveRoomInfo` 目前没接。
 */
const dependencies = {
  methodMap: {
    单个视频作品数据: 'fetchVideoWork',
    评论数据: 'fetchWorkComments',
    Emoji数据: 'fetchEmojiList',
    缺失实现: 'fetchMissingMethod'
  },
  fetcher: {
    fetchVideoWork,
    fetchWorkComments,
    fetchEmojiList
  }
}

/** 迁移前 `getdata.ts` 里那份游客兜底 ck，amagi 自己没有兜底，丢了会让没配 ck 的用户直接坏掉 */
const GUEST_COOKIE =
  'did=web_50424132d556424eb8fa8d27a612fda9; didv=1720860549000; kpf=PC_WEB; clientid=3; kpn=KUAISHOU_VISION'

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
  fetchVideoWork.mockResolvedValue({ ok: 'video' })
  fetchWorkComments.mockReset()
  fetchWorkComments.mockResolvedValue({ ok: 'comments' })
  fetchEmojiList.mockReset()
  fetchEmojiList.mockResolvedValue({ ok: 'emoji' })
})

afterEach(() => {
  resetApiCache()
  vi.useRealTimers()
})

describe('getKuaishouData amagi wrapper', () => {
  it('routes every Chinese method name this plugin uses to the right fetcher', async () => {
    expect(await getKuaishouData('单个视频作品数据', { photoId: '3x1' }, undefined, dependencies))
      .toEqual({ ok: 'video' })
    expect(await getKuaishouData('评论数据', { photoId: '3x1' }, undefined, dependencies))
      .toEqual({ ok: 'comments' })
    expect(await getKuaishouData('Emoji数据', undefined, undefined, dependencies))
      .toEqual({ ok: 'emoji' })

    expect(fetchVideoWork).toHaveBeenCalledTimes(1)
    expect(fetchWorkComments).toHaveBeenCalledTimes(1)
    expect(fetchEmojiList).toHaveBeenCalledTimes(1)
    expect(fetchVideoWork.mock.calls[0]?.[0]).toEqual({ photoId: '3x1' })
    expect(fetchEmojiList.mock.calls[0]?.[0]).toEqual({})
  })

  it('accepts the (method, cookie, options) call shape', async () => {
    await getKuaishouData('单个视频作品数据', 'cookie-from-caller', { photoId: '3x2' }, dependencies)

    const [options, cookie] = fetchVideoWork.mock.calls[0] as [unknown, unknown, unknown]
    expect(options).toEqual({ photoId: '3x2' })
    expect(cookie).toBe('cookie-from-caller')
  })

  it('accepts the (method, options) call shape and falls back to the configured cookie', async () => {
    configMock.cookies.kuaishou = 'cookie-from-config'

    await getKuaishouData('评论数据', { photoId: '3x3' }, undefined, dependencies)

    const [options, cookie] = fetchWorkComments.mock.calls[0] as [unknown, unknown, unknown]
    expect(options).toEqual({ photoId: '3x3' })
    expect(cookie).toBe('cookie-from-config')
  })

  it('rejects an unknown Chinese method name', async () => {
    await expect(getKuaishouData('不存在的方法', undefined, undefined, dependencies))
      .rejects.toThrow('Unsupported Kuaishou API method: 不存在的方法')
  })

  it('rejects a mapped method that the fetcher does not implement', async () => {
    await expect(getKuaishouData('缺失实现', undefined, undefined, dependencies))
      .rejects.toThrow('Unsupported Kuaishou API method: 缺失实现')
  })

  it('does not accept an English fetcher name (only Douyin allows that shortcut)', async () => {
    await expect(getKuaishouData('fetchVideoWork', undefined, undefined, dependencies))
      .rejects.toThrow('Unsupported Kuaishou API method: fetchVideoWork')
  })

  describe('guest cookie fallback', () => {
    it('falls back to the guest cookie when nothing is configured', async () => {
      await getKuaishouData('单个视频作品数据', { photoId: '3x4' }, undefined, dependencies)

      const [, cookie] = fetchVideoWork.mock.calls[0] as [unknown, unknown, unknown]
      expect(cookie).toBe(GUEST_COOKIE)
    })

    it('falls back to the guest cookie when the configured one is an empty string', async () => {
      configMock.cookies.kuaishou = ''

      await getKuaishouData('评论数据', { photoId: '3x5' }, undefined, dependencies)

      const [, cookie] = fetchWorkComments.mock.calls[0] as [unknown, unknown, unknown]
      expect(cookie).toBe(GUEST_COOKIE)
    })

    it('falls back to the guest cookie when the caller passes an empty cookie', async () => {
      await getKuaishouData('Emoji数据', '', undefined, dependencies)

      const [, cookie] = fetchEmojiList.mock.calls[0] as [unknown, unknown, unknown]
      expect(cookie).toBe(GUEST_COOKIE)
    })
  })

  describe('request config', () => {
    it('passes the configured timeout, user agent and proxy', async () => {
      configMock.request = {
        timeout: 5000,
        'User-Agent': 'Mozilla/5.0 Chrome/200.0.0.0',
        proxy: { switch: true, host: '127.0.0.1', port: '7890', protocol: 'http', auth: { username: 'u', password: 'p' } }
      }

      await getKuaishouData('单个视频作品数据', { photoId: '3x6' }, undefined, dependencies)

      const [, , requestConfig] = fetchVideoWork.mock.calls[0] as [
        unknown,
        unknown,
        { timeout: number, headers: Record<string, string>, proxy: unknown }
      ]
      expect(requestConfig.timeout).toBe(5000)
      expect(requestConfig.headers['User-Agent']).toBe('Mozilla/5.0 Chrome/200.0.0.0')
      expect(requestConfig.proxy).toEqual({
        host: '127.0.0.1',
        port: 7890,
        protocol: 'http',
        auth: { username: 'u', password: 'p' }
      })
    })

    it('leaves the user agent to amagi when the configured one is older than its built-in', async () => {
      // amagi 快手内置 Chrome/130（见 platform/common/userAgent.ts 的常量表），
      // 配置里锁着更旧的版本时不能覆盖，否则 Sec-Ch-Ua 会和 UA 自相矛盾
      configMock.request = { 'User-Agent': 'Mozilla/5.0 Chrome/125.0.0.0' }

      await getKuaishouData('单个视频作品数据', { photoId: '3x7' }, undefined, dependencies)

      const [, , requestConfig] = fetchVideoWork.mock.calls[0] as [unknown, unknown, { headers: Record<string, string> }]
      expect('User-Agent' in requestConfig.headers).toBe(false)
    })

    it('falls back to a 15 second timeout', async () => {
      await getKuaishouData('单个视频作品数据', { photoId: '3x8' }, undefined, dependencies)

      const [, , requestConfig] = fetchVideoWork.mock.calls[0] as [unknown, unknown, { timeout: number }]
      expect(requestConfig.timeout).toBe(15000)
    })
  })

  describe('RequestGuard', () => {
    it('passes an abort signal and releases a stuck amagi attempt at the hard timeout', async () => {
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

      const request = getKuaishouData('单个视频作品数据', { photoId: '3x9' }, undefined, dependencies)
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

    it('retries a network failure up to the configured retry count', async () => {
      vi.useFakeTimers()
      configMock.request = { amagiMaxRetries: 2 }
      fetchVideoWork
        .mockRejectedValueOnce(Object.assign(new Error('reset'), { code: 'ECONNRESET' }))
        .mockRejectedValueOnce(Object.assign(new Error('reset'), { code: 'ECONNRESET' }))
        .mockResolvedValueOnce({ ok: 'video' })

      const request = getKuaishouData('单个视频作品数据', { photoId: '3x10' }, undefined, dependencies)
      await vi.advanceTimersByTimeAsync(1000)

      expect(await request).toEqual({ ok: 'video' })
      expect(fetchVideoWork).toHaveBeenCalledTimes(3)
    })

    it('does not retry a business failure', async () => {
      configMock.request = { amagiMaxRetries: 2 }
      // amagi 的业务失败是**返回** Result，不是抛异常；返回值不该触发重试
      fetchVideoWork.mockResolvedValue({ success: false, code: 500, message: '快手数据获取失败' })

      expect(await getKuaishouData('单个视频作品数据', { photoId: '3x11' }, undefined, dependencies))
        .toEqual({ success: false, code: 500, message: '快手数据获取失败' })
      expect(fetchVideoWork).toHaveBeenCalledTimes(1)
    })
  })
})
