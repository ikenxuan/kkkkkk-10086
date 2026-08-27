import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 「缓存真的接在了四个 wrapper 上」的接线护栏。
 *
 * `tests/unit/api-cache.test.ts` 测的是缓存模块自己的行为，`*-api.test.ts` 测的是 wrapper 的
 * 分发语义（并且刻意把缓存关掉）。两边都全绿、缓存却**一个 wrapper 都没接上**是完全可能的，
 * 而那种情况在线上表现为「加了缓存但一点没省」—— 没有任何报错。这个文件就是堵这个缺口的：
 * 每个平台各钉一遍「白名单方法第二次不打接口」和「白名单外方法第二次照样打接口」。
 */
vi.mock('../../src/module/utils/Config.js', () => ({
  default: {
    app: {} as Record<string, unknown>,
    request: {} as Record<string, unknown>,
    cookies: {} as Record<string, unknown>
  }
}))

const { resetApiCache } = await import('../../src/module/utils/ApiCache.js')
const { getDouyinData } = await import('../../src/module/platform/douyin/api.js')
const { getBilibiliData } = await import('../../src/module/platform/bilibili/api.js')
const { getKuaishouData } = await import('../../src/module/platform/kuaishou/api.js')
const { getXiaohongshuData } = await import('../../src/module/platform/xiaohongshu/api.js')

/** 四个平台的 `*RequestConfig` 形状一致，这里照抄，免得 proxy 被收窄成 `false` 而不兼容 */
type Fetcher = (
  options: Record<string, unknown>,
  cookie: string,
  requestConfig: {
    timeout: number
    headers: { 'User-Agent'?: string }
    signal?: AbortSignal
    proxy: false | { host: string, port: number, protocol: string, auth: unknown }
  }
) => Promise<unknown>

/** 一个会数次数的 amagi fetcher 替身 */
const createFetcher = () => {
  const state = { calls: 0 }
  const fetcher: Fetcher = async () => {
    state.calls++
    return { success: true, data: { ok: true } }
  }
  return { state, fetcher }
}

beforeEach(() => {
  resetApiCache()
})

afterEach(() => {
  resetApiCache()
})

describe('抖音 wrapper', () => {
  const build = () => {
    const emoji = createFetcher()
    const aggregate = createFetcher()
    const search = createFetcher()
    return {
      emoji,
      aggregate,
      search,
      dependencies: {
        methodMap: { Emoji数据: 'fetchEmojiList', 聚合解析: 'parseWork', 搜索数据: 'fetchSearch' },
        fetcher: { fetchEmojiList: emoji.fetcher, parseWork: aggregate.fetcher, fetchSearch: search.fetcher }
      }
    }
  }

  it('准静态与作品详情两档都真的走了缓存', async () => {
    const { emoji, aggregate, dependencies } = build()

    await getDouyinData('Emoji数据', undefined, undefined, dependencies)
    await getDouyinData('Emoji数据', undefined, undefined, dependencies)
    expect(emoji.state.calls).toBe(1)

    await getDouyinData('聚合解析', { url: 'https://v.douyin.com/x' }, undefined, dependencies)
    await getDouyinData('聚合解析', { url: 'https://v.douyin.com/x' }, undefined, dependencies)
    expect(aggregate.state.calls).toBe(1)
  })

  it('白名单外的方法照样每次直连', async () => {
    const { search, dependencies } = build()

    await getDouyinData('搜索数据', { keyword: 'k' }, undefined, dependencies)
    await getDouyinData('搜索数据', { keyword: 'k' }, undefined, dependencies)

    expect(search.state.calls).toBe(2)
  })

  it('不同参数不串味', async () => {
    const { aggregate, dependencies } = build()

    await getDouyinData('聚合解析', { url: 'a' }, undefined, dependencies)
    await getDouyinData('聚合解析', { url: 'b' }, undefined, dependencies)

    expect(aggregate.state.calls).toBe(2)
  })
})

describe('B站 wrapper', () => {
  const build = () => {
    const video = createFetcher()
    const qrcode = createFetcher()
    const login = createFetcher()
    const methodMap: Record<string, string> = {
      单个视频作品数据: 'fetchOneVideo',
      二维码状态: 'fetchQrcodeStatus',
      登录基本信息: 'fetchLoginBasic'
    }
    return {
      video,
      qrcode,
      login,
      dependencies: {
        getEnglishMethodName: (_platform: string, method: string) => methodMap[method],
        methodMap,
        fetcher: {
          fetchOneVideo: video.fetcher,
          fetchQrcodeStatus: qrcode.fetcher,
          fetchLoginBasic: login.fetcher
        }
      }
    }
  }

  it('稿件详情走缓存', async () => {
    const { video, dependencies } = build()

    await getBilibiliData('单个视频作品数据', { bvid: 'BV1' }, undefined, dependencies)
    await getBilibiliData('单个视频作品数据', { bvid: 'BV1' }, undefined, dependencies)

    expect(video.state.calls).toBe(1)
  })

  it('二维码状态与登录基本信息在 wrapper 这一层也绝不缓存', async () => {
    const { qrcode, login, dependencies } = build()

    await getBilibiliData('二维码状态', { qrcode_key: 'k' }, undefined, dependencies)
    await getBilibiliData('二维码状态', { qrcode_key: 'k' }, undefined, dependencies)
    await getBilibiliData('二维码状态', { qrcode_key: 'k' }, undefined, dependencies)
    expect(qrcode.state.calls).toBe(3)

    await getBilibiliData('登录基本信息', undefined, undefined, dependencies)
    await getBilibiliData('登录基本信息', undefined, undefined, dependencies)
    expect(login.state.calls).toBe(2)
  })
})

describe('快手 wrapper', () => {
  const build = () => {
    const emoji = createFetcher()
    const video = createFetcher()
    return {
      emoji,
      video,
      dependencies: {
        methodMap: { Emoji数据: 'fetchEmojiList', 单个视频作品数据: 'fetchOneVideo' },
        fetcher: { fetchEmojiList: emoji.fetcher, fetchOneVideo: video.fetcher }
      }
    }
  }

  it('表情清单与作品详情都走缓存', async () => {
    const { emoji, video, dependencies } = build()

    await getKuaishouData('Emoji数据', undefined, undefined, dependencies)
    await getKuaishouData('Emoji数据', undefined, undefined, dependencies)
    expect(emoji.state.calls).toBe(1)

    await getKuaishouData('单个视频作品数据', { photoId: 'p1' }, undefined, dependencies)
    await getKuaishouData('单个视频作品数据', { photoId: 'p1' }, undefined, dependencies)
    expect(video.state.calls).toBe(1)
  })

  it('游客 ck 兜底不影响缓存身份：两次调用的 ck 是同一个，所以合成一条', async () => {
    const { emoji, dependencies } = build()

    await getKuaishouData('Emoji数据', '', undefined, dependencies)
    await getKuaishouData('Emoji数据', undefined, undefined, dependencies)

    expect(emoji.state.calls).toBe(1)
  })
})

describe('小红书 wrapper', () => {
  const build = () => {
    const emoji = createFetcher()
    const note = createFetcher()
    return {
      emoji,
      note,
      dependencies: {
        methodMap: { 表情列表: 'fetchEmojiList', 单个笔记数据: 'fetchOneNote' },
        fetcher: { fetchEmojiList: emoji.fetcher, fetchOneNote: note.fetcher }
      }
    }
  }

  /** 迁移前小红书**每次解析都重新拉一次表情列表**，这是这套缓存最直接的收益点 */
  it('表情列表只在第一次解析时真的拉一次', async () => {
    const { emoji, dependencies } = build()

    for (let round = 0; round < 5; round++) {
      await getXiaohongshuData('表情列表', undefined, undefined, dependencies)
    }

    expect(emoji.state.calls).toBe(1)
  })

  it('笔记详情走缓存，不同笔记各自一条', async () => {
    const { note, dependencies } = build()

    await getXiaohongshuData('单个笔记数据', { note_id: 'n1' }, undefined, dependencies)
    await getXiaohongshuData('单个笔记数据', { note_id: 'n1' }, undefined, dependencies)
    await getXiaohongshuData('单个笔记数据', { note_id: 'n2' }, undefined, dependencies)

    expect(note.state.calls).toBe(2)
  })
})
