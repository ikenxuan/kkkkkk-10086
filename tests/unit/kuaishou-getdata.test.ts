import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { KuaishouFetcher } from '@ikenxuan/amagi'

import type { KuaishouDataType } from '../../src/module/platform/kuaishou/getdata.js'

/**
 * `kuaishou/getdata.ts` 的取数与剥壳，外加它产出的 payload 被 `KuaiShou.Action`
 * 原样消费这段接缝。四件事：
 *
 * 1. **字段路径不能变深**。amagi v6 在响应外面多包了一层 `Result`，而 `comments.ts`
 *    只认 `data.visionCommentList` 与 `visionCommentList` 两级 —— 带壳进去评论会静默
 *    变成空数组，一句报错都没有。
 * 2. **cookie 排在第二位**。amagi fetcher 收的是 `(options, cookie, requestConfig)`，
 *    和 options 换位不会崩，只会让请求变成未登录态、回一份空数据。
 * 3. **没配 ck 要落到内置游客 ck**。amagi 的 `getKuaishouDefaultConfig` 只做
 *    `cookie?.trim() ?? ''`，没有自己的游客兜底，空 Cookie 会被快手归一成 INVALID_COOKIE。
 * 4. **防盗链头在调用点补**。体积探测那一跳不走 amagi，它原本是靠 getdata.ts 污染
 *    共享 baseHeaders 才拿到 Referer 的。
 *
 * `amagiClient` 整个换成替身，所以真 amagi 一次都不会被 require —— 它 exports map 里的
 * `development` 条件指向未发布的 `src/index.ts`，在 vitest 下加载即 MODULE_NOT_FOUND。
 */

/** `buildAmagiRequestConfig()` 的替身返回值，只用来认第三个实参真的到位 */
const requestConfig = vi.hoisted(() => ({ timeout: 15_000 }))

const doubles = vi.hoisted(() => ({
  fetchVideoWork: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  fetchWorkComments: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  fetchEmojiList: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  buildAmagiRequestConfig: vi.fn(() => requestConfig),
  Render: vi.fn(),
  downloadVideo: vi.fn(),
  getHeaders: vi.fn()
}))

const networksOptions = vi.hoisted(() => [] as Array<{ url: string, headers: Record<string, string> }>)

const config = vi.hoisted(() => ({
  app: {} as Record<string, unknown>,
  kuaishou: {} as Record<string, unknown>,
  cookies: {} as { kuaishou?: string }
}))

// 裸 fetcher 上只列被测那条路用到的三个方法：写成 Proxy 的话每次属性访问都是一个新
// `vi.fn()`，断言永远拿不到收到调用的那一份。
vi.mock('../../src/module/utils/amagiClient.js', () => ({
  kuaishouFetcher: {
    fetchVideoWork: doubles.fetchVideoWork,
    fetchWorkComments: doubles.fetchWorkComments,
    fetchEmojiList: doubles.fetchEmojiList
  },
  buildAmagiRequestConfig: doubles.buildAmagiRequestConfig
}))

vi.mock('../../src/module/utils/index.js', () => ({
  // 真 Base 的构造函数会 require amagi 建 Client，一引就是 MODULE_NOT_FOUND
  Base: class {
    e: unknown
    headers: Record<string, string> = { Accept: '*/*' }
  },
  Config: config,
  Render: doubles.Render,
  Networks: class {
    constructor (options: { url: string, headers: Record<string, string> }) {
      networksOptions.push(options)
    }

    getHeaders = doubles.getHeaders
  },
  downloadVideo: doubles.downloadVideo
}))

// getdata.ts 与 comments.ts 引的是这个模块本身，不是上面那个 barrel
vi.mock('../../src/module/utils/Config.js', () => ({
  default: config
}))

globalThis.logger = {
  debug: vi.fn(), error: vi.fn(), info: vi.fn(), mark: vi.fn(), warn: vi.fn()
} as unknown as typeof logger

const { default: KuaishouData } = await import('../../src/module/platform/kuaishou/getdata.js')
const { default: KuaiShou } = await import('../../src/module/platform/kuaishou/kuaishou.js')

/**
 * 方法名从 amagi 的 fetcher 类型上取，下面的期望序列都用 `satisfies` 钉在它上面。
 * `toEqual` 的形参是无约束泛型，光写字面量的话上游改名（或有人把中文旧方法名塞回来）
 * 这里会静默变成「断言一串谁也不会调用的名字」—— 是 satisfies 那一句让它在类型检查时报出来。
 */
type KuaishouApiMethod = keyof KuaishouFetcher

/** getdata.ts 真正用到的三个，顺序就是它 `Promise.all` 里的构造顺序 */
const USED_METHODS = ['fetchVideoWork', 'fetchWorkComments', 'fetchEmojiList'] as const satisfies readonly KuaishouApiMethod[]

type UsedMethod = (typeof USED_METHODS)[number]

type KuaishouActionArg = Parameters<InstanceType<typeof KuaiShou>['Action']>[0]

const PHOTO_ID = '3x1'
const KUAISHOU_CK = 'did=web_test; kpn=KUAISHOU_VISION'

/**
 * amagi v6 的成功响应形状：`createSuccessResponse(rawData, '获取成功', 200)`
 * （`@ikenxuan/amagi@6.5.0` `dist/default/index.cjs:1405`）。
 * `rawData` 就是快手 GraphQL 的响应体，也正是迁移前 `Networks.getData()` 的返回值。
 */
const amagiResult = (rawBody: unknown): unknown => ({
  success: true,
  code: 200,
  message: '获取成功',
  error: undefined,
  data: rawBody
})

const VIDEO_BODY = {
  data: {
    visionVideoDetail: {
      status: 1,
      photo: {
        photoUrl: 'https://example.com/video.mp4',
        caption: '测试作品',
        viewCount: 100,
        likeCount: 20
      }
    }
  }
}

const COMMENT_BODY = {
  data: {
    visionCommentList: {
      commentCount: 1,
      rootComments: [
        {
          commentId: 'c1',
          authorName: '甲',
          headurl: 'https://example.com/a.png',
          content: '好看[大笑]',
          timestamp: 1_700_000_000_000,
          likedCount: 7,
          realLikedCount: 7,
          subCommentCount: 2
        }
      ]
    }
  }
}

const EMOJI_BODY = {
  data: {
    visionBaseEmoticons: {
      iconUrls: { '[大笑]': '//static.kuaishou.com/daxiao.png' }
    }
  }
}

const BODY_OF: Record<UsedMethod, unknown> = {
  fetchVideoWork: VIDEO_BODY,
  fetchWorkComments: COMMENT_BODY,
  fetchEmojiList: EMOJI_BODY
}

/** 一次被拦下来的取数调用 */
interface FetchCall {
  method: UsedMethod
  options: unknown
  cookie: unknown
  requestConfig: unknown
}

const calls: FetchCall[] = []

/** 给三个具名 handle 装上记账实现，`respond` 决定这一跳回什么 */
const installFetchers = (respond: (method: UsedMethod) => Promise<unknown>): void => {
  for (const method of USED_METHODS) {
    doubles[method].mockImplementation(async (...args: unknown[]) => {
      calls.push({ method, options: args[0], cookie: args[1], requestConfig: args[2] })
      return await respond(method)
    })
  }
}

/** 按方法名分派响应体，默认包上 amagi 的 Result 外壳 */
const respondByMethod = (wrap: (body: unknown) => unknown = amagiResult): void => {
  installFetchers(async method => wrap(BODY_OF[method]))
}

// 不写返回类型：`ReturnType<typeof vi.fn>` 会宽成 `Mock<Procedure | Constructable>`，
// 那个过不了 `BaseEvent.reply` 的赋值检查，靠推断才拿到能用的形状
const createEvent = () => ({ reply: vi.fn().mockResolvedValue({ message_id: 1 }) })

beforeEach(() => {
  vi.clearAllMocks()
  // clearAllMocks 只清调用记录，实现会跨用例留着，所以取数那三个要连实现一起归零
  for (const method of USED_METHODS) doubles[method].mockReset()

  config.app = {}
  config.kuaishou = { numcomment: 5 }
  config.cookies = { kuaishou: KUAISHOU_CK }
  calls.length = 0
  networksOptions.length = 0
  doubles.Render.mockResolvedValue(['rendered-comment-image'])
  doubles.downloadVideo.mockResolvedValue(true)
  doubles.getHeaders.mockResolvedValue({ 'content-length': '2097152' })
})

describe('KuaishouData.GetData 的取数与剥壳', () => {
  it.each(['one_work', '单个作品信息'] satisfies KuaishouDataType[])(
    '「%s」打三个 amagi 方法，参数、ck、请求配置依次到位',
    async (type) => {
      respondByMethod()

      await new KuaishouData(type).GetData({ photoId: PHOTO_ID })

      expect(calls.map(call => call.method))
        .toEqual(['fetchVideoWork', 'fetchWorkComments', 'fetchEmojiList'] satisfies KuaishouApiMethod[])
      expect(doubles.fetchVideoWork).toHaveBeenCalledWith({ photoId: PHOTO_ID }, KUAISHOU_CK, requestConfig)
      expect(doubles.fetchWorkComments).toHaveBeenCalledWith({ photoId: PHOTO_ID }, KUAISHOU_CK, requestConfig)
      // 表情列表无参，但 ck 与请求配置一样得给：它们在 amagi 的签名里不可省
      expect(doubles.fetchEmojiList).toHaveBeenCalledWith({}, KUAISHOU_CK, requestConfig)
    }
  )

  it('剥掉 amagi 的 Result 外壳，payload 的字段路径和迁移前逐字相同', async () => {
    respondByMethod()

    const payload = await new KuaishouData('one_work').GetData({ photoId: PHOTO_ID })

    expect(payload).toEqual({
      VideoData: VIDEO_BODY,
      CommentData: COMMENT_BODY,
      EmojiData: EMOJI_BODY
    })
  })

  it('裸响应原样透传，不会再剥掉一层 data', async () => {
    // 防御：amagi 换形状或调用方直接塞裸响应时不能把 data 再剥一层
    respondByMethod(body => body)

    const payload = await new KuaishouData('one_work').GetData({ photoId: PHOTO_ID })

    expect(payload).toEqual({
      VideoData: VIDEO_BODY,
      CommentData: COMMENT_BODY,
      EmojiData: EMOJI_BODY
    })
  })

  it('三个请求并发在飞，而不是串成三个往返', async () => {
    // 三个请求之间没有数据依赖。这个 gate 只在**三个都已发出**之后才放行，
    // 所以串行实现会永久卡在第一个请求上，由下面的 1s 竞速兜底报错。
    let release: () => void = () => {}
    const gate = new Promise<void>(resolve => { release = resolve })

    installFetchers(async method => {
      if (calls.length === 3) release()
      await gate
      return amagiResult(BODY_OF[method])
    })

    const payload = await Promise.race([
      new KuaishouData('one_work').GetData({ photoId: PHOTO_ID }),
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error('GetData 仍在串行发请求：三个请求没有同时在飞')), 1000)
      })
    ])

    expect(calls).toHaveLength(3)
    expect(payload).toEqual({
      VideoData: VIDEO_BODY,
      CommentData: COMMENT_BODY,
      EmojiData: EMOJI_BODY
    })
  })

  it('「作品评论信息」只打评论那一跳，返回剥壳后的评论体', async () => {
    respondByMethod()

    const payload = await new KuaishouData('作品评论信息').GetData({ photoId: PHOTO_ID })

    expect(payload).toEqual(COMMENT_BODY)
    expect(calls.map(call => call.method)).toEqual(['fetchWorkComments'] satisfies KuaishouApiMethod[])
  })

  it('信封成功但 data 为空时逐条记 error 日志，而不是抛出来', async () => {
    respondByMethod(() => amagiResult(undefined))

    const payload = await new KuaishouData('one_work').GetData({ photoId: PHOTO_ID })

    expect(payload).toEqual({ VideoData: undefined, CommentData: undefined, EmojiData: undefined })
    expect(logger.error).toHaveBeenCalledTimes(3)
    // 日志要指名道姓：三条一模一样的报错看不出是哪一跳空了
    for (const method of USED_METHODS) {
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(method))
    }
  })

  it('amagi 抛错时 GetData 不吞掉它', async () => {
    // 生产里 `success: false` 的信封在 amagiClient 的 wrapAmagiClient 就抛成 AmagiError 了，
    // 根本走不到 unwrapAmagiResult —— 所以「取数失败」的形态是 reject 而不是一个失败信封
    respondByMethod()
    doubles.fetchVideoWork.mockRejectedValue(new Error('快手数据获取失败'))

    await expect(new KuaishouData('one_work').GetData({ photoId: PHOTO_ID }))
      .rejects.toThrow('快手数据获取失败')
  })

  it('未知请求类型返回 undefined，一个接口都不打', async () => {
    expect(await new KuaishouData('未知类型' as never).GetData({ photoId: PHOTO_ID })).toBeUndefined()

    for (const method of USED_METHODS) expect(doubles[method]).not.toHaveBeenCalled()
  })

  it.each([[undefined], ['']])('快手 ck 为 %p 时落到内置游客 ck', async (cookie) => {
    // amagi 的 getKuaishouDefaultConfig 没有自己的游客兜底，空 Cookie 会被快手
    // 归一成 INVALID_COOKIE —— 没配 ck 的用户会整条坏掉
    config.cookies = { kuaishou: cookie }
    respondByMethod()

    await new KuaishouData('one_work').GetData({ photoId: PHOTO_ID })

    expect(calls).toHaveLength(3)
    for (const call of calls) {
      expect(String(call.cookie)).toContain('kpn=KUAISHOU_VISION')
    }
  })
})

describe('KuaishouWorkPayload 原样喂给 KuaiShou.Action', () => {
  it('走到 Action 与 comments() 真正读的视频、评论、表情字段', async () => {
    respondByMethod()
    const payload = await new KuaishouData('one_work').GetData({ photoId: PHOTO_ID })
    const event = createEvent()

    expect(await new KuaiShou(event).Action(payload as KuaishouActionArg)).toBe(true)

    expect(doubles.Render).toHaveBeenCalledTimes(1)
    const [template, props] = doubles.Render.mock.calls[0] as [string, {
      viewCount: number
      likeCount: number
      share_url: string
      VideoSize: string
      CommentLength: number
      CommentsData: Array<{ nickname: string, digg_count: number, text: { nodes: Array<Record<string, unknown>> } }>
    }]

    expect(template).toBe('kuaishou/comment')
    // VideoData 走到了 `data.visionVideoDetail`
    expect(props.viewCount).toBe(100)
    expect(props.likeCount).toBe(20)
    expect(props.share_url).toBe('https://example.com/video.mp4')
    expect(props.VideoSize).toBe('2.00')
    // CommentData 走到了 `data.visionCommentList.rootComments`
    expect(props.CommentLength).toBe(1)
    expect(props.CommentsData[0]?.nickname).toBe('甲')
    expect(props.CommentsData[0]?.digg_count).toBe(7)
    // EmojiData 走到了 `data.visionBaseEmoticons.iconUrls`，且 `//` 被补成 https
    expect(props.CommentsData[0]?.text.nodes).toEqual([
      expect.objectContaining({ type: 'text', text: '好看' }),
      expect.objectContaining({ type: 'emoji', name: '[大笑]', src: 'https://static.kuaishou.com/daxiao.png' })
    ])

    expect(doubles.downloadVideo).toHaveBeenCalledTimes(1)
    const [, options] = doubles.downloadVideo.mock.calls[0] as [unknown, { title: { originTitle: string } }]
    expect(options.title.originTitle).toBe('测试作品.mp4')
  })

  it('体积探测那一跳带上快手的防盗链头', async () => {
    // 迁移前这个 Referer 是靠 getdata.ts 污染共享 baseHeaders 拿到的，
    // 删掉污染后必须在 kuaishou.ts 里显式补上，否则防盗链会拦掉体积探测
    respondByMethod()
    const payload = await new KuaishouData('one_work').GetData({ photoId: PHOTO_ID })

    await new KuaiShou(createEvent()).Action(payload as KuaishouActionArg)

    expect(networksOptions).toHaveLength(1)
    const options = networksOptions[0]!
    expect(options.url).toBe('https://example.com/video.mp4')
    expect(options.headers.Referer).toBe('https://www.kuaishou.com/')
    expect(options.headers.Origin).toBe('https://www.kuaishou.com')
    // Base 的原有请求头不能被丢掉
    expect(options.headers.Accept).toBe('*/*')
    // ck 不该发给视频 CDN
    expect('Cookie' in options.headers).toBe(false)
  })

  it('取数回来是空数据时退化成「不支持解析的视频」，不渲染也不下载', async () => {
    // 迁移前这条的前提是 amagi 回一个 `success: false` 的信封；新架构里那种信封在
    // amagiClient 就抛成 AmagiError 了，能走到 Action 的失败形态只剩「信封成功、data 为空」
    respondByMethod(() => amagiResult(undefined))
    const payload = await new KuaishouData('one_work').GetData({ photoId: PHOTO_ID })
    const event = createEvent()

    expect(await new KuaiShou(event).Action(payload as KuaishouActionArg)).toBe(true)

    // 和迁移前一致：取数失败退化成「不支持解析的视频」，不弹错误卡
    expect(event.reply).toHaveBeenCalledWith('不支持解析的视频')
    expect(doubles.Render).not.toHaveBeenCalled()
    expect(doubles.downloadVideo).not.toHaveBeenCalled()
  })
})
