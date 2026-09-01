import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `utils/ApiCache.ts` 的行为护栏。
 *
 * 这套缓存有两类特别容易悄悄坏掉、并且坏了以后**表现成别的问题**的地方，
 * 用例的重点全在这两类上：
 *
 * 1. **登录态被误缓存**：扫码登录会永远停在「等待扫码」，而日志里一切正常。
 *    白名单是运行时的唯一真相，所以这里既钉行为（连续两次真打两次接口），
 *    也钉「白名单和绝不缓存清单交集为空」这条不变量。
 * 2. **Cookie 原文进键**：键会进日志和诊断快照，一旦进去就是泄凭据；
 *    而指纹**没**进键的话，用户换了 ck 还会命中旧缓存，表现成「换了 Cookie 也没用」。
 */

// ApiCache 不再读 Config；替身留着，避免将来重新引入时测试碰真实配置目录。
vi.mock('../../src/module/utils/Config.js', () => ({
  default: { app: {} as Record<string, unknown> }
}))

const {
  API_CACHE_CAPACITY,
  API_CACHE_NEGATIVE_TTL_MS,
  API_CACHE_POLICY,
  API_CACHE_TTL_MS,
  NEVER_CACHE_METHODS,
  buildApiCacheKey,
  fingerprintCookie,
  getApiCacheSnapshot,
  resetApiCache,
  resolveApiCacheTier,
  withApiCache
} = await import('../../src/module/utils/ApiCache.js')

type Platform = 'douyin' | 'bilibili' | 'kuaishou' | 'xiaohongshu'

const NOW_MS = 1_760_000_000_000

/** 一个会数次数的取数 thunk */
const createFetcher = <T> (produce: () => T) => {
  const state = { calls: 0 }
  return {
    state,
    run: async (): Promise<T> => {
      state.calls++
      return produce()
    }
  }
}

/** 一个会数次数、且抛指定错误的取数 thunk */
const createFailingFetcher = (produce: () => unknown) => {
  const state = { calls: 0 }
  return {
    state,
    run: async (): Promise<never> => {
      state.calls++
      throw produce()
    }
  }
}

const request = (
  platform: Platform,
  method: string,
  options: Record<string, unknown> = {},
  cookie = ''
) => ({ platform, method, cookie, options })

/** 手动闸门，用来把若干并发请求按住在同一个时刻 */
const createGate = () => {
  let release = (): void => {}
  const opened = new Promise<void>((resolve) => {
    release = resolve
  })
  return { opened, release: () => { release() } }
}

beforeEach(() => {
  resetApiCache()
})

afterEach(() => {
  resetApiCache()
  vi.useRealTimers()
})

describe('策略表：白名单之外一律直连', () => {
  it('把「表情清单」这类准静态接口归到长 TTL 档，作品详情归到短 TTL 档', () => {
    expect(resolveApiCacheTier('xiaohongshu', 'fetchEmojiList')).toBe('static')
    expect(resolveApiCacheTier('kuaishou', 'fetchEmojiList')).toBe('static')
    expect(resolveApiCacheTier('douyin', 'fetchEmojiList')).toBe('static')
    expect(resolveApiCacheTier('bilibili', 'fetchEmojiList')).toBe('static')

    expect(resolveApiCacheTier('xiaohongshu', 'fetchNoteDetail')).toBe('detail')
    expect(resolveApiCacheTier('bilibili', 'fetchVideoInfo')).toBe('detail')
    expect(resolveApiCacheTier('douyin', 'parseWork')).toBe('detail')
  })

  it('按平台分别配：抖音 fetchUserProfile 兼任直播态载体，所以只有 B站 的 fetchUserCard 进白名单', () => {
    expect(resolveApiCacheTier('bilibili', 'fetchUserCard')).toBe('detail')
    expect(resolveApiCacheTier('douyin', 'fetchUserProfile')).toBeUndefined()
  })

  it('方法名跨平台撞车时按平台各判各的', () => {
    expect(resolveApiCacheTier('kuaishou', 'fetchVideoWork')).toBe('detail')
    expect(resolveApiCacheTier('douyin', 'fetchVideoWork')).toBeUndefined()
  })

  it('没列进白名单的方法两次调用真打两次接口', async () => {
    const fetcher = createFetcher(() => ({ ok: true }))

    await withApiCache(request('douyin', 'searchContent', { keyword: 'x' }), fetcher.run)
    await withApiCache(request('douyin', 'searchContent', { keyword: 'x' }), fetcher.run)

    expect(fetcher.state.calls).toBe(2)
  })

  it('直连的方法不进命中率统计，免得把分母冲淡', async () => {
    const fetcher = createFetcher(() => ({ ok: true }))
    await withApiCache(request('bilibili', 'fetchVideoStreamUrl', { bvid: 'BV1' }), fetcher.run)
    await withApiCache(request('bilibili', 'fetchVideoStreamUrl', { bvid: 'BV1' }), fetcher.run)

    const snapshot = getApiCacheSnapshot()
    expect(snapshot.hits).toBe(0)
    expect(snapshot.misses).toBe(0)
    expect(snapshot.coalesced).toBe(0)
  })

  it('推送轮询、直播态、带时效签名的下载直链都不在白名单里', () => {
    expect(resolveApiCacheTier('douyin', 'fetchUserVideoList')).toBeUndefined()
    expect(resolveApiCacheTier('douyin', 'fetchUserFavoriteList')).toBeUndefined()
    expect(resolveApiCacheTier('douyin', 'fetchUserRecommendList')).toBeUndefined()
    expect(resolveApiCacheTier('douyin', 'fetchLiveRoomInfo')).toBeUndefined()
    expect(resolveApiCacheTier('bilibili', 'fetchUserDynamicList')).toBeUndefined()
    expect(resolveApiCacheTier('bilibili', 'fetchVideoStreamUrl')).toBeUndefined()
    expect(resolveApiCacheTier('bilibili', 'fetchLiveRoomInfo')).toBeUndefined()
    expect(resolveApiCacheTier('bilibili', 'fetchLiveRoomInitInfo')).toBeUndefined()
    expect(resolveApiCacheTier('bilibili', 'fetchUserLiveStatus')).toBeUndefined()
  })
})

describe('登录态方法绝不缓存', () => {
  /**
   * 这条不变量是整套缓存最危险的回归点，所以钉两遍：
   * 先钉「白名单里根本没有这些方法」（结构），再钉「连续两次调用真的打了两次接口」（行为）。
   * 把登录态方法误加进白名单时，这两条会一起红。
   */
  /**
   * 上面那条对**拼错的名字**是空洞满足的：不存在的方法名天然不在白名单里，
   * 断言照样通过。而这张表在运行时不参与判定，拼错了没有任何东西会响——
   * 正是它要防的那种静默失效。所以这里再钉一层：名字必须真的是某个调用点在调的方法。
   */
  it('绝不缓存清单里的名字都能在 B站 调用点里找到', async () => {
    const { readFileSync, readdirSync } = await import('node:fs')

    const sources = readdirSync('src/module/platform/bilibili')
      .filter(name => name.endsWith('.ts'))
      .map(name => readFileSync(`src/module/platform/bilibili/${name}`, 'utf8'))
      .join('\n')

    for (const method of NEVER_CACHE_METHODS.bilibili) {
      expect(
        sources.includes(`.${method}(`),
        `${method} 在 platform/bilibili 下没有任何调用点——要么拼错了，要么 amagi 改了名`
      ).toBe(true)
    }
  })

  it('绝不缓存清单和白名单的交集为空', () => {
    for (const platform of Object.keys(NEVER_CACHE_METHODS) as Platform[]) {
      for (const method of NEVER_CACHE_METHODS[platform]) {
        expect(
          API_CACHE_POLICY[platform][method],
          `${platform} 的 ${method} 是有状态轮询或一次性凭据，绝不能进白名单`
        ).toBeUndefined()
        expect(resolveApiCacheTier(platform, method)).toBeUndefined()
      }
    }
  })

  it.each([
    ['requestLoginQrcode', { }],
    ['checkQrcodeStatus', { qrcode_key: 'key-1' }],
    ['fetchLoginStatus', { }],
    ['requestCaptchaFromVoucher', { v_voucher: 'voucher-1' }],
    ['validateCaptchaResult', { challenge: 'c', token: 't', validate: 'v', seccode: 's' }]
  ])('B站 %s 连续两次调用都真的打了接口', async (method, options) => {
    const fetcher = createFetcher(() => ({ success: true, data: { code: 86101 } }))

    await withApiCache(request('bilibili', method, options), fetcher.run)
    await withApiCache(request('bilibili', method, options), fetcher.run)

    expect(fetcher.state.calls).toBe(2)
  })

  it('checkQrcodeStatus 轮询里，第一轮的「未扫码」不会盖住第二轮的「已扫码」', async () => {
    const codes = [86101, 86090, 0]
    let index = 0
    const fetcher = createFetcher(() => ({ success: true, data: { code: codes[index++] } }))

    const first = await withApiCache(request('bilibili', 'checkQrcodeStatus', { qrcode_key: 'k' }), fetcher.run)
    const second = await withApiCache(request('bilibili', 'checkQrcodeStatus', { qrcode_key: 'k' }), fetcher.run)
    const third = await withApiCache(request('bilibili', 'checkQrcodeStatus', { qrcode_key: 'k' }), fetcher.run)

    expect(fetcher.state.calls).toBe(3)
    expect(first).toMatchObject({ data: { code: 86101 } })
    expect(second).toMatchObject({ data: { code: 86090 } })
    expect(third).toMatchObject({ data: { code: 0 } })
  })
})

describe('分级 TTL', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW_MS)
  })

  it('两个档位的 TTL 相差两个数量级', () => {
    expect(API_CACHE_TTL_MS.static).toBe(24 * 60 * 60 * 1000)
    expect(API_CACHE_TTL_MS.detail).toBe(5 * 60 * 1000)
    expect(API_CACHE_TTL_MS.static / API_CACHE_TTL_MS.detail).toBeGreaterThanOrEqual(100)
  })

  it('准静态档在作品详情档早已过期之后仍然命中', async () => {
    const fetcher = createFetcher(() => ({ success: true, data: 'emoji' }))
    const target = request('xiaohongshu', 'fetchEmojiList')

    await withApiCache(target, fetcher.run)
    expect(fetcher.state.calls).toBe(1)

    // 越过作品详情档的 TTL
    vi.setSystemTime(NOW_MS + API_CACHE_TTL_MS.detail + 1)
    await withApiCache(target, fetcher.run)
    expect(fetcher.state.calls).toBe(1)

    // 越过准静态档的 TTL
    vi.setSystemTime(NOW_MS + API_CACHE_TTL_MS.static + 1)
    await withApiCache(target, fetcher.run)
    expect(fetcher.state.calls).toBe(2)
  })

  it('作品详情档过期后 miss', async () => {
    const fetcher = createFetcher(() => ({ success: true, data: 'note' }))
    const target = request('xiaohongshu', 'fetchNoteDetail', { note_id: 'n1' })

    await withApiCache(target, fetcher.run)
    vi.setSystemTime(NOW_MS + API_CACHE_TTL_MS.detail - 1)
    await withApiCache(target, fetcher.run)
    expect(fetcher.state.calls).toBe(1)

    vi.setSystemTime(NOW_MS + API_CACHE_TTL_MS.detail + 1)
    await withApiCache(target, fetcher.run)
    expect(fetcher.state.calls).toBe(2)
  })

  it('同一时刻的两个档位互不影响到期时间', async () => {
    const staticFetcher = createFetcher(() => ({ success: true, data: 'emoji' }))
    const detailFetcher = createFetcher(() => ({ success: true, data: 'note' }))

    await withApiCache(request('xiaohongshu', 'fetchEmojiList'), staticFetcher.run)
    await withApiCache(request('xiaohongshu', 'fetchNoteDetail', { note_id: 'n1' }), detailFetcher.run)

    vi.setSystemTime(NOW_MS + API_CACHE_TTL_MS.detail + 1)
    await withApiCache(request('xiaohongshu', 'fetchEmojiList'), staticFetcher.run)
    await withApiCache(request('xiaohongshu', 'fetchNoteDetail', { note_id: 'n1' }), detailFetcher.run)

    expect(staticFetcher.state.calls).toBe(1)
    expect(detailFetcher.state.calls).toBe(2)
  })

  it('过期条目在快照里不再计数', async () => {
    await withApiCache(request('xiaohongshu', 'fetchNoteDetail', { note_id: 'n1' }), createFetcher(() => ({ ok: 1 })).run)
    expect(getApiCacheSnapshot().entries).toBe(1)

    vi.setSystemTime(NOW_MS + API_CACHE_TTL_MS.detail + 1)
    expect(getApiCacheSnapshot().entries).toBe(0)
  })
})

describe('缓存键里的 Cookie 指纹', () => {
  const RAW_COOKIE = 'SESSDATA=abc123def456; bili_jct=deadbeefcafe; DedeUserID=10086'

  it('键里绝对不出现 Cookie 原文，只有短哈希', () => {
    const key = buildApiCacheKey(request('bilibili', 'fetchVideoInfo', { bvid: 'BV1' }, RAW_COOKIE))

    expect(key).toBeDefined()
    // 整串、各个键值对、以及每一段值，都不允许出现在键里
    expect(key).not.toContain(RAW_COOKIE)
    for (const fragment of ['SESSDATA', 'abc123def456', 'bili_jct', 'deadbeefcafe', 'DedeUserID', '10086']) {
      expect(key, `键里不能出现 Cookie 片段 ${fragment}`).not.toContain(fragment)
    }
    expect(key).toContain(fingerprintCookie(RAW_COOKIE))
  })

  it('指纹是 12 位十六进制，空 ck 给可读的 anon', () => {
    expect(fingerprintCookie(RAW_COOKIE)).toMatch(/^[0-9a-f]{12}$/)
    expect(fingerprintCookie(RAW_COOKIE)).toBe(fingerprintCookie(RAW_COOKIE))
    expect(fingerprintCookie('')).toBe('anon')
    expect(fingerprintCookie('   ')).toBe('anon')
    expect(fingerprintCookie(RAW_COOKIE)).not.toBe(fingerprintCookie(`${RAW_COOKIE}x`))
  })

  it('同一个 work-id 在登录态与未登录态下是两条缓存', async () => {
    const fetcher = createFetcher(() => ({ success: true }))

    await withApiCache(request('bilibili', 'fetchVideoInfo', { bvid: 'BV1' }, ''), fetcher.run)
    await withApiCache(request('bilibili', 'fetchVideoInfo', { bvid: 'BV1' }, RAW_COOKIE), fetcher.run)

    expect(fetcher.state.calls).toBe(2)
    expect(getApiCacheSnapshot().entries).toBe(2)
  })

  it('换了 Cookie 之后旧缓存不再命中——不然表现就是「换了 Cookie 也没用」', async () => {
    let quality = '480p'
    const fetcher = createFetcher(() => ({ success: true, data: { quality } }))

    const anonymous = await withApiCache(
      request('bilibili', 'fetchVideoInfo', { bvid: 'BV1' }, ''),
      fetcher.run
    )
    expect(anonymous).toMatchObject({ data: { quality: '480p' } })

    // 用户在锅巴里填了大会员 ck，接口从此回 1080p
    quality = '1080p'
    const loggedIn = await withApiCache(
      request('bilibili', 'fetchVideoInfo', { bvid: 'BV1' }, RAW_COOKIE),
      fetcher.run
    )

    expect(loggedIn).toMatchObject({ data: { quality: '1080p' } })
    expect(fetcher.state.calls).toBe(2)
  })

  it('参数键的书写顺序不影响键，免得同一份参数产生两条缓存', () => {
    const first = buildApiCacheKey(request('douyin', 'parseWork', { url: 'u', typeMode: 'strict' }))
    const second = buildApiCacheKey(request('douyin', 'parseWork', { typeMode: 'strict', url: 'u' }))

    expect(first).toBe(second)
  })

  it('参数序列化不了时降级成直连，而不是硬编一个键', async () => {
    const circular: Record<string, unknown> = { note_id: 'n1' }
    circular.self = circular
    expect(buildApiCacheKey(request('xiaohongshu', 'fetchNoteDetail', circular))).toBeUndefined()

    const fetcher = createFetcher(() => ({ ok: 1 }))
    await withApiCache(request('xiaohongshu', 'fetchNoteDetail', circular), fetcher.run)
    await withApiCache(request('xiaohongshu', 'fetchNoteDetail', circular), fetcher.run)
    expect(fetcher.state.calls).toBe(2)
  })
})

describe('in-flight 合并', () => {
  it('同键并发 8 次只真的打一次接口', async () => {
    const gate = createGate()
    const state = { calls: 0 }
    const run = async (): Promise<unknown> => {
      state.calls++
      await gate.opened
      return { success: true, data: 'shared' }
    }

    const target = request('xiaohongshu', 'fetchNoteDetail', { note_id: 'n1' })
    const inFlight = Array.from({ length: 8 }, async () => await withApiCache(target, run))

    // 闸门还没开，8 个请求都在飞
    expect(state.calls).toBe(1)
    expect(getApiCacheSnapshot().inflight).toBe(1)

    gate.release()
    const results = await Promise.all(inFlight)

    expect(state.calls).toBe(1)
    for (const result of results) expect(result).toEqual({ success: true, data: 'shared' })

    const snapshot = getApiCacheSnapshot()
    expect(snapshot.misses).toBe(1)
    expect(snapshot.coalesced).toBe(7)
    expect(snapshot.hits).toBe(0)
    expect(snapshot.inflight).toBe(0)
  })

  it('不同键的并发请求各自打一次，不会被错误地合并', async () => {
    const gate = createGate()
    const state = { calls: 0 }
    const run = async (): Promise<unknown> => {
      state.calls++
      await gate.opened
      return { success: true }
    }

    const pending = [
      withApiCache(request('xiaohongshu', 'fetchNoteDetail', { note_id: 'n1' }), run),
      withApiCache(request('xiaohongshu', 'fetchNoteDetail', { note_id: 'n2' }), run),
      withApiCache(request('xiaohongshu', 'fetchNoteDetail', { note_id: 'n1' }), run)
    ]

    expect(state.calls).toBe(2)
    gate.release()
    await Promise.all(pending)
    expect(state.calls).toBe(2)
  })

  it('合并后紧接着到达的同键请求拿到的是缓存命中，不是一次新的 miss', async () => {
    const gate = createGate()
    const state = { calls: 0 }
    const run = async (): Promise<unknown> => {
      state.calls++
      await gate.opened
      return { success: true }
    }

    const target = request('xiaohongshu', 'fetchNoteDetail', { note_id: 'n1' })
    const pending = [withApiCache(target, run), withApiCache(target, run)]
    gate.release()
    await Promise.all(pending)

    await withApiCache(target, run)

    expect(state.calls).toBe(1)
    const snapshot = getApiCacheSnapshot()
    expect(snapshot.misses).toBe(1)
    expect(snapshot.coalesced).toBe(1)
    expect(snapshot.hits).toBe(1)
  })

  it('共享请求失败时所有等待者一起失败，且 in-flight 表被清空', async () => {
    const gate = createGate()
    const state = { calls: 0 }
    const boom = new Error('upstream down')
    const run = async (): Promise<unknown> => {
      state.calls++
      await gate.opened
      throw boom
    }

    const target = request('xiaohongshu', 'fetchNoteDetail', { note_id: 'n1' })
    const pending = [
      withApiCache(target, run).catch((error: unknown) => error),
      withApiCache(target, run).catch((error: unknown) => error)
    ]
    gate.release()

    expect(await Promise.all(pending)).toEqual([boom, boom])
    expect(state.calls).toBe(1)
    expect(getApiCacheSnapshot().inflight).toBe(0)
  })
})

describe('LRU 容量上限', () => {
  it('超过上限后条目数不再增长', async () => {
    for (let index = 0; index <= API_CACHE_CAPACITY + 20; index++) {
      await withApiCache(
        request('xiaohongshu', 'fetchNoteDetail', { note_id: `n${index}` }),
        createFetcher(() => ({ index })).run
      )
    }

    const snapshot = getApiCacheSnapshot()
    expect(snapshot.entries).toBeLessThanOrEqual(API_CACHE_CAPACITY)
    expect(snapshot.entries).toBeGreaterThan(0)
  })

  it('淘汰的是最久未用的那条，而不是最早写入的那条', async () => {
    const keyOf = (index: number) => request('xiaohongshu', 'fetchNoteDetail', { note_id: `n${index}` })

    // 填满
    for (let index = 0; index < API_CACHE_CAPACITY; index++) {
      await withApiCache(keyOf(index), createFetcher(() => ({ index })).run)
    }

    // 把最早写入的 n0 读一次，它就成了最近使用
    const zero = createFetcher(() => ({ refetched: true }))
    expect(await withApiCache(keyOf(0), zero.run)).toEqual({ index: 0 })
    expect(zero.state.calls).toBe(0)

    // 再写一条，触发一次淘汰
    await withApiCache(keyOf(API_CACHE_CAPACITY), createFetcher(() => ({ fresh: true })).run)

    // n0 还在（刚被用过），被挤掉的是 n1
    const zeroAgain = createFetcher(() => ({ refetched: true }))
    expect(await withApiCache(keyOf(0), zeroAgain.run)).toEqual({ index: 0 })
    expect(zeroAgain.state.calls).toBe(0)

    const one = createFetcher(() => ({ refetched: true }))
    expect(await withApiCache(keyOf(1), one.run)).toEqual({ refetched: true })
    expect(one.state.calls).toBe(1)
  })
})

describe('失败缓存（negative caching）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW_MS)
  })

  it('失败缓存的 TTL 明显短于成功档位', () => {
    expect(API_CACHE_NEGATIVE_TTL_MS).toBeLessThan(API_CACHE_TTL_MS.detail)
    expect(API_CACHE_TTL_MS.detail / API_CACHE_NEGATIVE_TTL_MS).toBeGreaterThanOrEqual(5)
    expect(API_CACHE_NEGATIVE_TTL_MS).toBeLessThanOrEqual(60_000)
    expect(API_CACHE_NEGATIVE_TTL_MS).toBeGreaterThanOrEqual(30_000)
  })

  it.each([
    ['429 限流', 429],
    ['403 拒绝', 403],
    ['404 不存在', 404],
    ['401 未授权', 401]
  ])('抛出的 %s 被缓存住，不再反复打接口', async (_label, status) => {
    const fetcher = createFailingFetcher(() => Object.assign(new Error('rejected'), { response: { status } }))
    const target = request('xiaohongshu', 'fetchNoteDetail', { note_id: 'n1' })

    await expect(withApiCache(target, fetcher.run)).rejects.toThrow('rejected')
    await expect(withApiCache(target, fetcher.run)).rejects.toThrow('rejected')

    expect(fetcher.state.calls).toBe(1)
    expect(getApiCacheSnapshot().negativeEntries).toBe(1)
  })

  it('失败缓存在 45 秒后自愈', async () => {
    const fetcher = createFailingFetcher(() => Object.assign(new Error('rejected'), { response: { status: 429 } }))
    const target = request('xiaohongshu', 'fetchNoteDetail', { note_id: 'n1' })

    await expect(withApiCache(target, fetcher.run)).rejects.toThrow('rejected')

    vi.setSystemTime(NOW_MS + API_CACHE_NEGATIVE_TTL_MS - 1)
    await expect(withApiCache(target, fetcher.run)).rejects.toThrow('rejected')
    expect(fetcher.state.calls).toBe(1)

    vi.setSystemTime(NOW_MS + API_CACHE_NEGATIVE_TTL_MS + 1)
    await expect(withApiCache(target, fetcher.run)).rejects.toThrow('rejected')
    expect(fetcher.state.calls).toBe(2)
  })

  it.each([
    ['500 服务端错误', Object.assign(new Error('boom'), { response: { status: 500 } })],
    ['503 暂时不可用', Object.assign(new Error('boom'), { response: { status: 503 } })],
    ['408 请求超时', Object.assign(new Error('boom'), { response: { status: 408 } })],
    ['本地硬超时', Object.assign(new Error('Request timed out after 60000ms'), { name: 'RequestTimeoutError', code: 'ERR_REQUEST_TIMEOUT' })],
    ['取消', Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })],
    ['连接被重置', Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })],
    ['域名解析失败', Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })],
    ['认不出来的失败', new Error('who knows')]
  ])('暂时故障不进缓存：%s', async (_label, error) => {
    const fetcher = createFailingFetcher(() => error)
    const target = request('xiaohongshu', 'fetchNoteDetail', { note_id: 'n1' })

    await expect(withApiCache(target, fetcher.run)).rejects.toBeTruthy()
    await expect(withApiCache(target, fetcher.run)).rejects.toBeTruthy()

    expect(fetcher.state.calls).toBe(2)
    expect(getApiCacheSnapshot().negativeEntries).toBe(0)
  })

  it.each([
    ['-412 请求被拦截', -412],
    ['-509 请求过于频繁', -509],
    ['-799 请求过于频繁', -799],
    ['-101 账号未登录', -101]
  ])('B站 返回的 %s 被缓存住', async (_label, code) => {
    const fetcher = createFetcher(() => ({ success: false, code, message: '风控' }))
    const target = request('bilibili', 'fetchVideoInfo', { bvid: 'BV1' })

    await withApiCache(target, fetcher.run)
    await withApiCache(target, fetcher.run)

    expect(fetcher.state.calls).toBe(1)
    expect(getApiCacheSnapshot().negativeEntries).toBe(1)
  })

  it('B站 -352 刻意不缓存：本仓库对它有交互式验证码恢复链路，用户会在几秒内重发命令', async () => {
    const fetcher = createFetcher(() => ({ success: false, code: -352, data: { v_voucher: 'voucher-1' } }))
    const target = request('bilibili', 'fetchVideoInfo', { bvid: 'BV1' })

    await withApiCache(target, fetcher.run)
    await withApiCache(target, fetcher.run)

    expect(fetcher.state.calls).toBe(2)
    expect(getApiCacheSnapshot().negativeEntries).toBe(0)
  })

  it('amagi 那个恒为 500 的通用失败码不缓存：它不带业务语义，缓存等于把网络抖动也缓存', async () => {
    const fetcher = createFetcher(() => ({ success: false, code: 500, message: '小红书数据获取失败' }))
    const target = request('xiaohongshu', 'fetchNoteDetail', { note_id: 'n1' })

    await withApiCache(target, fetcher.run)
    await withApiCache(target, fetcher.run)

    expect(fetcher.state.calls).toBe(2)
    expect(getApiCacheSnapshot().negativeEntries).toBe(0)
  })
})

describe('软失败按成功档位缓存', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW_MS)
  })

  /**
   * B站 12061「UP 主已关闭评论区」是接口稳定正确的业务答案，不是故障，
   * 所以按成功档位存而不是按失败的 45 秒存：没有东西需要自愈，
   * 而按 45 秒存恰好会在「评论图静默缺失、用户重发链接」这个最高频的重试路径上失效。
   */
  it('softFetch 归一出的软失败按作品详情档存，而不是按失败的 45 秒存', async () => {
    const fetcher = createFetcher(() => ({
      success: false,
      soft: true,
      code: 12061,
      message: 'UP 主已关闭评论区',
      data: undefined,
      error: undefined
    }))
    const target = request('bilibili', 'fetchComments', { oid: '1', type: 1 })

    await withApiCache(target, fetcher.run)

    // 失败档位早就过期了，软失败还在
    vi.setSystemTime(NOW_MS + API_CACHE_NEGATIVE_TTL_MS + 1)
    await withApiCache(target, fetcher.run)
    expect(fetcher.state.calls).toBe(1)
    expect(getApiCacheSnapshot().negativeEntries).toBe(0)

    // 到了作品详情档的 TTL 才过期
    vi.setSystemTime(NOW_MS + API_CACHE_TTL_MS.detail + 1)
    await withApiCache(target, fetcher.run)
    expect(fetcher.state.calls).toBe(2)
  })
})

describe('诊断快照', () => {
  it('命中率把合并算进分子：合并掉的请求确实没打接口', async () => {
    const gate = createGate()
    const state = { calls: 0 }
    const run = async (): Promise<unknown> => {
      state.calls++
      await gate.opened
      return { success: true }
    }

    const target = request('xiaohongshu', 'fetchNoteDetail', { note_id: 'n1' })
    // 1 miss + 3 coalesced
    const pending = [
      withApiCache(target, run),
      withApiCache(target, run),
      withApiCache(target, run),
      withApiCache(target, run)
    ]
    gate.release()
    await Promise.all(pending)

    // 再来 1 次真命中
    await withApiCache(target, run)

    const snapshot = getApiCacheSnapshot()
    expect(snapshot.misses).toBe(1)
    expect(snapshot.coalesced).toBe(3)
    expect(snapshot.hits).toBe(1)
    // (1 + 3) / (1 + 3 + 1)
    expect(snapshot.hitRate).toBeCloseTo(0.8, 10)
  })

  it('一次查询都没有时命中率是 0，而不是 NaN', () => {
    const snapshot = getApiCacheSnapshot()
    expect(snapshot.hitRate).toBe(0)
    expect(Number.isNaN(snapshot.hitRate)).toBe(false)
  })

  it('按档位分开报计数，且档位总和等于总计', async () => {
    const emoji = createFetcher(() => ({ success: true }))
    const note = createFetcher(() => ({ success: true }))

    await withApiCache(request('xiaohongshu', 'fetchEmojiList'), emoji.run)
    await withApiCache(request('xiaohongshu', 'fetchEmojiList'), emoji.run)
    await withApiCache(request('xiaohongshu', 'fetchNoteDetail', { note_id: 'n1' }), note.run)

    const snapshot = getApiCacheSnapshot()
    const staticTier = snapshot.tiers.find(tier => tier.tier === 'static')
    const detailTier = snapshot.tiers.find(tier => tier.tier === 'detail')

    expect(staticTier).toMatchObject({ hits: 1, misses: 1, coalesced: 0, entries: 1 })
    expect(detailTier).toMatchObject({ hits: 0, misses: 1, coalesced: 0, entries: 1 })

    expect(snapshot.hits).toBe(1)
    expect(snapshot.misses).toBe(2)
    expect(snapshot.entries).toBe(2)
    expect(snapshot.capacity).toBe(API_CACHE_CAPACITY)
  })
})
