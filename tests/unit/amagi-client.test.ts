import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Config 是唯一的替身。amagi 本体不 mock —— 那四个 fetcher 走 `createRequire`，
 * `vi.mock` 拦不到 CommonJS 加载，写了只会给出「已隔离」的假象。
 */
const configMock = vi.hoisted(() => ({
  request: {} as Record<string, unknown> | undefined
}))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: configMock
}))

const {
  AmagiError,
  bilibiliFetcher,
  buildAmagiRequestConfig,
  softFetch,
  wrapAmagiClient
} = await import('../../src/module/utils/amagiClient.js')

const softErrorModule = await import('../../src/module/platform/common/softError.js')

/** amagi 6.5.0 四平台内置 UA 的最高 Chrome 主版本号（bilibili 的 142） */
const SHARED_UA_THRESHOLD = 142

const chromeUA = (major: number): string =>
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`

/** 造一个失败信封，形状照 amagi 的 `createErrorResponse(error, message, code, data)` */
const failureEnvelope = (code: number, message = '业务失败') => ({
  success: false as const,
  code,
  message,
  data: { rawData: { code } },
  error: { amagiError: 'BILIBILI_ERROR', code, amagiMessage: `amagi:${code}` }
})

/** 造一个成功信封 */
const successEnvelope = <T> (data: T) => ({
  success: true as const,
  code: 200,
  message: 'ok',
  data
})

beforeEach(() => {
  configMock.request = { timeout: 4321 }
})

describe('AmagiError 是重导出而不是本地新定义', () => {
  it('和 softError 导出的是同一个类对象', () => {
    // 定义第二个类会让 instanceof 跨模块失效，而 riskControl.ts 的 match 依赖它
    expect(AmagiError).toBe(softErrorModule.AmagiError)
  })

  it('softFetch 也是同一个函数对象', () => {
    expect(softFetch).toBe(softErrorModule.softFetch)
  })
})

describe('wrapAmagiClient 把失败信封抛成 AmagiError', () => {
  it('code / data / rawError 逐字段取自信封', async () => {
    const envelope = failureEnvelope(12061)
    const client = wrapAmagiClient({ fetchComments: async () => envelope })

    const error = await client.fetchComments().catch((err: unknown) => err)

    expect(error).toBeInstanceOf(AmagiError)
    const amagiError = error as InstanceType<typeof AmagiError>
    expect(amagiError.code).toBe(12061)
    expect(amagiError.data).toStrictEqual(envelope.data)
    expect(amagiError.rawError).toStrictEqual(envelope.error)
    expect(amagiError.name).toBe('AmagiError')
  })

  it('message 取信封的 message，不是 util.inspect 的彩色 dump', () => {
    // 上游把带 ANSI 转义的 inspect 结果塞进 message，那串东西会流进错误卡片的 HTML
    const client = wrapAmagiClient({ f: async () => failureEnvelope(500, 'UP主已关闭评论区') })

    return expect(client.f()).rejects.toThrow('UP主已关闭评论区')
  })

  it('message 为空时退到 error.amagiMessage', async () => {
    const client = wrapAmagiClient({ f: async () => failureEnvelope(500, '') })

    const error = await client.f().catch((err: unknown) => err) as Error

    expect(error.message).toBe('amagi:500')
  })

  it('message 和 amagiMessage 都没有时退到「请求失败」', async () => {
    const client = wrapAmagiClient({
      f: async () => ({ success: false, code: 500, message: '', data: null, error: null })
    })

    const error = await client.f().catch((err: unknown) => err) as Error

    expect(error.message).toBe('请求失败')
  })

  it('success 是 false 之外的非 true 值同样抛（判据是 !== true）', async () => {
    const client = wrapAmagiClient({
      f: async () => ({ success: false as boolean, code: 7, message: 'x', data: 1, error: 2 })
    })

    await expect(client.f()).rejects.toBeInstanceOf(AmagiError)
  })
})

describe('wrapAmagiClient 的放行路径', () => {
  it('成功信封原样返回', async () => {
    const envelope = successEnvelope({ aweme_id: '123' })
    const client = wrapAmagiClient({ f: async () => envelope })

    await expect(client.f()).resolves.toStrictEqual(envelope)
  })

  it('不是信封的返回值原样透传', async () => {
    // 三键缺一就不算信封：只有 success、或只有 code+message，都不该被当成失败
    const shapes = [
      { ok: true },
      { success: false },
      { code: 500, message: 'x' },
      { success: 'false', code: 500, message: 'x' },
      'plain string',
      42,
      null,
      undefined,
      [1, 2, 3]
    ]

    for (const shape of shapes) {
      const client = wrapAmagiClient({ f: async () => shape })

      await expect(client.f()).resolves.toStrictEqual(shape)
    }
  })

  it('同步方法被包成 async，返回值透传', async () => {
    // 声明类型保留原签名，但运行期每个方法都变成 async —— 上游同样如此。
    // 这个 as 就是那处不一致的显式记录：真实 fetcher 全是 async，所以线上不暴露。
    const client = wrapAmagiClient({ f: () => ({ ok: 'sync' }) })
    const returned = client.f() as unknown as Promise<unknown>

    expect(returned).toBeInstanceOf(Promise)
    await expect(returned).resolves.toStrictEqual({ ok: 'sync' })
  })

  it('非函数、非对象的属性原样读出', () => {
    const client = wrapAmagiClient({ version: '6.5.0', retries: 3 })

    expect(client.version).toBe('6.5.0')
    expect(client.retries).toBe(3)
  })

  it('参数原样转交底层方法', async () => {
    const inner = vi.fn(async (
      _options: Record<string, unknown>,
      _cookie: string,
      _config: Record<string, unknown>
    ) => successEnvelope(null))
    const client = wrapAmagiClient({ f: inner })

    await client.f({ bvid: 'BV1' }, 'cookie', { timeout: 1 })

    expect(inner).toHaveBeenCalledWith({ bvid: 'BV1' }, 'cookie', { timeout: 1 })
  })
})

describe('wrapAmagiClient 递归到嵌套对象', () => {
  it('嵌套一层的方法也被包到', async () => {
    const client = wrapAmagiClient({ bilibili: { fetcher: { f: async () => failureEnvelope(12002) } } })

    await expect(client.bilibili.fetcher.f()).rejects.toBeInstanceOf(AmagiError)
  })

  it('嵌套三层依然生效，且成功信封仍原样返回', async () => {
    const client = wrapAmagiClient({
      a: { b: { c: { fail: async () => failureEnvelope(1), pass: async () => successEnvelope('ok') } } }
    })

    await expect(client.a.b.c.fail()).rejects.toBeInstanceOf(AmagiError)
    await expect(client.a.b.c.pass()).resolves.toStrictEqual(successEnvelope('ok'))
  })

  it('数组属性不被当成嵌套对象递归', async () => {
    const client = wrapAmagiClient({ codes: [12061, 12002] })

    expect(Array.isArray(client.codes)).toBe(true)
    expect(client.codes).toStrictEqual([12061, 12002])
  })

  it('方法内部的 this 仍指向原对象', async () => {
    const client = wrapAmagiClient({
      base: 'https://api.bilibili.com',
      buildUrl (this: { base: string }) {
        return `${this.base}/x`
      }
    })

    await expect(client.buildUrl() as unknown as Promise<string>).resolves.toBe('https://api.bilibili.com/x')
  })
})

describe('softFetch 在包装后的客户端上放行白名单码', () => {
  const bilibiliWhitelist = softErrorModule.SOFT_ERROR_CODES.bilibili

  it('白名单锁在 [12061, 12002]', () => {
    expect(bilibiliWhitelist).toStrictEqual([12061, 12002])
  })

  it.each([12061, 12002])('白名单内的 %i 还原成失败 Result 而不是抛', async code => {
    const client = wrapAmagiClient({ fetchComments: async () => failureEnvelope(code) })

    const result = await softFetch(() => client.fetchComments(), bilibiliWhitelist)

    expect(result).toMatchObject({ success: false, code, soft: true })
  })

  it('还原出的结果带 soft 标记，能和 amagi 原样返回的失败区分开', async () => {
    const client = wrapAmagiClient({ f: async () => failureEnvelope(12061, 'UP主已关闭评论区') })

    const result = await softFetch(() => client.f(), bilibiliWhitelist) as Record<string, unknown>

    expect(result.soft).toBe(true)
    expect(result.message).toBe('UP主已关闭评论区')
    expect(result.data).toStrictEqual({ rawData: { code: 12061 } })
  })

  it.each([500, -352, -404, 12009])('白名单外的 %i 继续抛 AmagiError', async code => {
    const client = wrapAmagiClient({ f: async () => failureEnvelope(code) })

    await expect(softFetch(() => client.f(), bilibiliWhitelist)).rejects.toBeInstanceOf(AmagiError)
  })

  it('成功信封在 softFetch 下原样返回', async () => {
    const envelope = successEnvelope([{ rpid: 1 }])
    const client = wrapAmagiClient({ f: async () => envelope })

    await expect(softFetch(() => client.f(), bilibiliWhitelist)).resolves.toStrictEqual(envelope)
  })

  it('空白名单的平台一律不放行', async () => {
    const client = wrapAmagiClient({ f: async () => failureEnvelope(500) })

    expect(softErrorModule.SOFT_ERROR_CODES.douyin).toStrictEqual([])
    await expect(softFetch(() => client.f(), softErrorModule.SOFT_ERROR_CODES.douyin)).rejects.toBeInstanceOf(AmagiError)
  })
})

describe('buildAmagiRequestConfig 的 UA 守卫', () => {
  it('配置值比所有平台内置都旧时不覆盖，把 UA 交回 amagi', () => {
    // 差一版就不覆盖：141 < 142(bilibili)。透传会让 UA 降级、Sec-Ch-Ua 跟着降，
    // 那正是 B站 gaia 风控（-352）看的信号。
    configMock.request = { timeout: 4321, 'User-Agent': chromeUA(SHARED_UA_THRESHOLD - 1) }

    const headers = buildAmagiRequestConfig().headers

    expect(headers).toStrictEqual({})
    // 断言 key 不存在而不是值 falsy：`{ 'User-Agent': undefined }` 照样会在 amagi 的
    // spread 里把内置 UA 打掉，axios 于是发自己的 UA
    expect('User-Agent' in headers).toBe(false)
    expect({ 'User-Agent': 'amagi-builtin', ...headers }['User-Agent']).toBe('amagi-builtin')
  })

  it('配置值比所有平台内置都新时才覆盖', () => {
    const ua = chromeUA(SHARED_UA_THRESHOLD + 1)
    configMock.request = { timeout: 4321, 'User-Agent': ua }

    expect(buildAmagiRequestConfig().headers).toStrictEqual({ 'User-Agent': ua })
  })

  it('阈值取四平台最高的 142，抖音会覆盖的 Chrome/130 在这里不覆盖', () => {
    // 共用客户端不知道这次请求走哪个平台，所以只有比所有内置都新才敢覆盖
    configMock.request = { timeout: 4321, 'User-Agent': chromeUA(130) }

    expect(buildAmagiRequestConfig().headers).toStrictEqual({})
  })

  it.each([
    ['undefined', undefined],
    ['空串', ''],
    ['纯空白', '   '],
    ['非字符串', 142]
  ])('配置值无效（%s）时不覆盖', (_label, value) => {
    configMock.request = { timeout: 4321, 'User-Agent': value }

    expect(buildAmagiRequestConfig().headers).toStrictEqual({})
  })

  it('headers 是新对象，改一次的结果不会污染下一次', () => {
    const ua = chromeUA(999)
    configMock.request = { timeout: 4321, 'User-Agent': ua }

    const first = buildAmagiRequestConfig().headers
    first['User-Agent'] = 'tampered'

    expect(buildAmagiRequestConfig().headers).toStrictEqual({ 'User-Agent': ua })
  })
})

describe('buildAmagiRequestConfig 每次调用现算', () => {
  it('读的是 mock 过的 Config（确认 mock 命中，没打到真实配置）', () => {
    expect(buildAmagiRequestConfig().timeout).toBe(4321)
  })

  it('timeout 缺失或为 0 时回落到 15000', () => {
    configMock.request = {}
    expect(buildAmagiRequestConfig().timeout).toBe(15000)

    configMock.request = { timeout: 0 }
    expect(buildAmagiRequestConfig().timeout).toBe(15000)
  })

  it('Config.request 整体缺失时不抛', () => {
    configMock.request = undefined

    expect(() => buildAmagiRequestConfig()).not.toThrow()
    expect(buildAmagiRequestConfig()).toStrictEqual({ timeout: 15000, headers: {}, proxy: false })
  })

  it('配置改动立刻反映到下一次调用 —— 所以不需要 reloadConfig 那套', () => {
    // 上游的 reloadConfig / configSignature / registerAmagiReloadListener 是为
    // 「模块级单例 + 构造时读一次配置」服务的。这里没有陈旧快照，那套没有对应的问题可解。
    configMock.request = { timeout: 1000 }
    expect(buildAmagiRequestConfig().timeout).toBe(1000)

    configMock.request = { timeout: 2000 }
    expect(buildAmagiRequestConfig().timeout).toBe(2000)
  })

  it('proxy 关闭时是 false', () => {
    configMock.request = { timeout: 4321, proxy: { switch: false, host: 'h', port: '1', protocol: 'http', auth: null } }

    expect(buildAmagiRequestConfig().proxy).toBe(false)
  })

  it('proxy 开启时 port 归一成数字', () => {
    const auth = { username: 'u', password: 'p' }
    configMock.request = {
      timeout: 4321,
      proxy: { switch: true, host: '127.0.0.1', port: '7890', protocol: 'http', auth }
    }

    expect(buildAmagiRequestConfig().proxy).toStrictEqual({
      host: '127.0.0.1',
      port: 7890,
      protocol: 'http',
      auth
    })
  })
})

/**
 * 这四个导出在 vitest 里**不能**被解引用。
 *
 * `createRequire` 用的是 Node 的条件解析，而 vitest 会带上 `development` 条件；
 * amagi 的 exports map 里 `development` 指向 `./src/index.ts`，那个路径不在发布产物里
 * （package.json 的 `files` 只有 `dist/*`），于是必然 ERR_MODULE_NOT_FOUND。
 * 纯 Node 下（也就是线上）同一句 require 解析到 `dist/default/index.cjs`，四个导出齐全 ——
 * 已用独立脚本核对过：27 / 19 / 6 / 7 个方法。
 *
 * 所以这里只断言「导入这个模块没有加载期副作用」，真实 fetcher 的形状不在 vitest 覆盖范围内。
 */
describe('四平台 fetcher 导出是惰性的', () => {
  it('import 本模块不触发 amagi 加载', () => {
    // 上面 40 条用例全部通过本身就是证据：如果模块级就 require 了 amagi，
    // 这个文件在 import 阶段就会整体炸掉。这条把它固化成显式断言。
    expect(typeof bilibiliFetcher).toBe('object')
  })
})

describe('-352 记下风控信封的形状', () => {
  const callWith = async (envelope: unknown): Promise<unknown> => {
    const client = wrapAmagiClient({ fetch: async () => envelope })
    return await client.fetch().catch((error: unknown) => error)
  }

  beforeEach(() => {
    globalThis.logger = { warn: vi.fn() } as unknown as typeof logger
  })

  it('记的是键名，不是值', async () => {
    await callWith({
      success: false as const,
      code: -352,
      message: '风控校验失败',
      data: { rawData: { code: -352 } },
      error: { amagiError: 'BILIBILI_ERROR', cookieFingerprint: 'a1b2c3' }
    })

    const line = vi.mocked(globalThis.logger.warn).mock.calls[0]?.[0] as string
    expect(line).toContain('data={rawData}')
    expect(line).toContain('amagiError,cookieFingerprint')
    // 值里可能带 cookie 指纹一类东西，只能出现键名
    expect(line).not.toContain('a1b2c3')
  })

  it('实测的 -352 形状（没有 data 键）也记得下来', async () => {
    // 真机探针拿到的响应体就是 `{code, message, ttl}`，data 是 undefined
    await callWith({ success: false as const, code: -352, message: '风控校验失败', ttl: 1 })

    expect(vi.mocked(globalThis.logger.warn).mock.calls[0]?.[0]).toContain('data={undefined}')
  })

  it('别的错误码不记', async () => {
    await callWith(failureEnvelope(12061))

    expect(globalThis.logger.warn).not.toHaveBeenCalled()
  })

  it('logger 缺席时照旧抛 AmagiError，不被日志带崩', async () => {
    // @ts-expect-error 故意抹掉宿主注入的全局 logger
    delete globalThis.logger

    const error = await callWith({ success: false as const, code: -352, message: '风控校验失败' })

    expect(error).toBeInstanceOf(AmagiError)
    expect((error as InstanceType<typeof AmagiError>).code).toBe(-352)
  })
})
