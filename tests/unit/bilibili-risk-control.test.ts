import { beforeEach, describe, expect, it, vi } from 'vitest'

// 两个方法各自一个替身。旧的单函数替身靠调用次序区分「申请」与「验证」，
// 裸 fetcher 下它们是两个键，次序不再是判据。
const requestCaptchaFromVoucher = vi.hoisted(() => vi.fn())
const validateCaptchaResult = vi.hoisted(() => vi.fn())
const registerErrorStrategy = vi.hoisted(() => vi.fn())
const sendErrorToMaster = vi.hoisted(() => vi.fn(async () => undefined))
const sendErrorToAllMasters = vi.hoisted(() => vi.fn(async () => undefined))
/**
 * 风控走的是错误卡片那条路（模板里 `isVerification && verificationUrl` 那块）。
 * 默认让它「渲染成功」并返回一个可辨认的非字符串，好断言发出去的是卡片而不是裸二维码；
 * 想测回退时把它改成返回字符串即可 —— 真实实现渲染失败时正是退化成纯文本。
 */
const renderErrorReport = vi.hoisted(() => vi.fn(async () => ({ card: 'rendered-image' })))

vi.mock('../../src/module/utils/amagiClient.js', () => ({
  bilibiliFetcher: { requestCaptchaFromVoucher, validateCaptchaResult },
  buildAmagiRequestConfig: vi.fn(() => ({}))
}))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: {
    cookies: { bilibili: 'configured-cookie' },
    request: {}
  }
}))

vi.mock('../../src/module/utils/ErrorHandler/index.js', () => ({
  registerErrorStrategy,
  renderErrorReport,
  sendErrorToMaster,
  sendErrorToAllMasters
}))

vi.mock('@ikenxuan/qrcode', () => ({
  generate: vi.fn(() => 'qr-base64')
}))

globalThis.logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
} as unknown as typeof logger

const { bilibiliRiskControlStrategy } = await import('../../src/module/platform/bilibili/riskControl.js')

beforeEach(() => {
  vi.clearAllMocks()
})

const createContext = (overrides: Record<string, unknown> = {}) => ({
  error: {
    code: -352,
    data: { data: { v_voucher: 'voucher-1' } }
  },
  options: { businessName: 'Bilibili request' },
  logs: [],
  event: { reply: vi.fn(async () => undefined) },
  ...overrides
})

describe('bilibiliRiskControlStrategy guarded Amagi requests', () => {
  it('requests a captcha through the bare fetcher', async () => {
    requestCaptchaFromVoucher.mockResolvedValue({})

    await expect(bilibiliRiskControlStrategy.handle(createContext() as never)).resolves.toBe('continue')

    // 只钉 options：cookie 与 requestConfig 不是本用例的被测面
    expect(requestCaptchaFromVoucher.mock.calls[0]?.[0]).toEqual({
      v_voucher: 'voucher-1',
      typeMode: 'strict'
    })
  })

  it('validates a captcha through the bare fetcher', async () => {
    requestCaptchaFromVoucher.mockResolvedValue({
      data: {
        data: {
          geetest: { gt: 'gt-1', challenge: 'challenge-1' },
          token: 'token-1'
        }
      }
    })
    validateCaptchaResult.mockResolvedValue({ success: true })
    const awaitContext = vi.fn(async () => ({
      msg: 'https://example.test/callback?validate=validate-1&seccode=seccode-1'
    }))

    await expect(bilibiliRiskControlStrategy.handle(createContext({
      options: {
        businessName: 'Bilibili request',
        plugin: { awaitContext }
      }
    }) as never)).resolves.toBe('handled')

    expect(validateCaptchaResult.mock.calls[0]?.[0]).toEqual({
      challenge: 'challenge-1',
      token: 'token-1',
      validate: 'validate-1',
      seccode: 'seccode-1',
      typeMode: 'strict'
    })
  })
})

describe('bilibiliRiskControlStrategy verification failures', () => {
  /** 把流程推进到「验证结果已提交」，验证那一步的结果由入参决定 */
  const runVerification = async (
    verifyOutcome: { resolve: unknown } | { reject: unknown }
  ): Promise<ReturnType<typeof vi.fn>> => {
    requestCaptchaFromVoucher.mockResolvedValue({
      data: {
        data: {
          geetest: { gt: 'gt-1', challenge: 'challenge-1' },
          token: 'token-1'
        }
      }
    })
    if ('reject' in verifyOutcome) validateCaptchaResult.mockRejectedValueOnce(verifyOutcome.reject)
    else validateCaptchaResult.mockResolvedValueOnce(verifyOutcome.resolve)

    const reply = vi.fn(async () => undefined)
    const awaitContext = vi.fn(async () => ({
      msg: 'https://example.test/callback?validate=validate-1&seccode=seccode-1'
    }))

    await expect(bilibiliRiskControlStrategy.handle(createContext({
      event: { reply },
      options: { businessName: 'Bilibili request', plugin: { awaitContext } }
    }) as never)).resolves.toBe('handled')

    return reply
  }

  /** 取最后一条回复文本，前面几条是二维码那组消息 */
  const lastReply = (reply: ReturnType<typeof vi.fn>): string =>
    String(reply.mock.calls.at(-1)?.[0])

  // -352 的 csrf 失败在本仓库是以「返回值」形态出现的：api.ts 直调 amagi fetcher，
  // 失败的 Result 原样返回，不会抛。上游靠 Proxy 抛 AmagiError 才走到 catch。
  it('gives ck specific guidance when a returned result carries -111', async () => {
    const reply = await runVerification({
      resolve: { success: false, code: -111, error: { errorDescription: 'csrf 校验失败' } }
    })

    expect(lastReply(reply)).toContain('#B站登录')
    expect(lastReply(reply)).toContain('csrf')
  })

  // 另一种形态：某一层把它抛出来（Base.ts 的代理就会抛带 code 的错误）。
  it('gives the same guidance when -111 is thrown instead of returned', async () => {
    const thrown = Object.assign(new Error('csrf 校验失败'), { code: -111 })
    const reply = await runVerification({ reject: thrown })

    expect(lastReply(reply)).toContain('#B站登录')
  })

  // 其余错误码不能退化成一句没有信息量的「请重试」，要把接口的描述带出来。
  it('surfaces the API description for other failure codes', async () => {
    const reply = await runVerification({
      resolve: { success: false, code: -662, error: { errorDescription: '请求字符串长度超出限制' } }
    })

    expect(lastReply(reply)).toBe('验证失败: 请求字符串长度超出限制')
    expect(lastReply(reply)).not.toContain('#B站登录')
  })

  it('reads the code off error.code when the top level does not carry it', async () => {
    // amagi 的 createErrorResponse(error, message, code, data) 把 B站业务码放在顶层 code，
    // 但 APIErrorType 上还有一个同名字段。顶层缺失时得能从 error.code 兜到，
    // 否则 -111 会被当成普通失败、给出「请重试」这种把人往错方向带的提示。
    const reply = await runVerification({
      resolve: { success: false, error: { code: -111, errorDescription: 'csrf 校验失败' } }
    })

    expect(lastReply(reply)).toContain('#B站登录')
  })

  it('treats a string error code the same as a numeric one', async () => {
    // amagi 的 bilibiliAPIErrorCode 枚举值是字符串字面量（CSRF_ERROR = "-111"），
    // 而响应体里通常是数字。两种都要认，否则枚举形态的 -111 会漏判。
    const reply = await runVerification({
      resolve: { success: false, code: '-111', error: { errorDescription: 'csrf 校验失败' } }
    })

    expect(lastReply(reply)).toContain('#B站登录')
  })

  it('does not report success when a failed result happens to carry grisk_id', async () => {
    // 判定收紧成只认 success===true。原来是 `success || griskId`：失败响应的 data 是 never，
    // 正常取不到 grisk_id，但协议端真在错误体里回了这个键的话，一次没通过的验证
    // 会被报成「验证成功」，用户拿着它去重发命令只会再撞一次风控。
    const reply = await runVerification({
      resolve: { success: false, code: -662, data: { grisk_id: 'leaked-id' }, error: { errorDescription: '验证未通过' } }
    })

    expect(lastReply(reply)).not.toContain('验证成功')
    expect(lastReply(reply)).toContain('验证失败')
  })
})

describe('bilibiliRiskControlStrategy 验证卡片', () => {
  /** 让「申请 captcha」这一步成功，好让流程走到出图那一段 */
  const captchaGranted = (): void => {
    requestCaptchaFromVoucher.mockResolvedValue({
      data: { data: { geetest: { gt: 'gt-1', challenge: 'challenge-1' }, token: 'token-1' } }
    })
  }

  it('渲染成功时发的是错误卡片，不是裸二维码', async () => {
    // 模板早就支持 isVerification + verificationUrl，但此前没有调用点能喂进去，
    // 于是这里只能手搓一张裸二维码。现在应该走卡片。
    captchaGranted()
    const ctx = createContext()

    await bilibiliRiskControlStrategy.handle(ctx as never)

    expect(renderErrorReport).toHaveBeenCalledWith(ctx, {
      isVerification: true,
      verificationUrl: expect.stringContaining('gt=gt-1')
    })

    const replied = vi.mocked((ctx.event as { reply: ReturnType<typeof vi.fn> }).reply).mock.calls[0]?.[0]
    expect(replied).toEqual([{ card: 'rendered-image' }, expect.stringContaining('challenge=challenge-1')])
    // 卡片自带二维码，不该再塞一张裸的
    expect(JSON.stringify(replied)).not.toContain('qr-base64')
  })

  it('渲染失败退回文字加裸二维码，而不是把「业务出错」的纯文本发出去', async () => {
    // renderErrorReport 渲染失败时返回的是 buildErrorMessage 的纯文本，
    // 那段话讲的是业务错误、对「请扫码验证」这个场景没有意义，所以必须自己回退。
    captchaGranted()
    renderErrorReport.mockResolvedValueOnce('KKK业务执行出错: Bilibili request' as never)
    const ctx = createContext()

    await bilibiliRiskControlStrategy.handle(ctx as never)

    const replied = vi.mocked((ctx.event as { reply: ReturnType<typeof vi.fn> }).reply).mock.calls[0]?.[0]
    expect(JSON.stringify(replied)).toContain('qr-base64')
    expect(JSON.stringify(replied)).toContain('扫码完成验证')
    expect(JSON.stringify(replied)).not.toContain('业务执行出错')
  })
})

describe('bilibiliRiskControlStrategy without an event', () => {
  // v_voucher 是一次性的：没人能看到验证码时申请一次就白烧掉一张，
  // 用户下次重试反而更难过。上游有这个前置返回，本仓库原先缺。
  it('does not burn the voucher when there is nobody to reply to', async () => {
    await expect(bilibiliRiskControlStrategy.handle(createContext({
      event: undefined
    }) as never)).resolves.toBe('continue')

    expect(requestCaptchaFromVoucher).not.toHaveBeenCalled()
  })
})

/**
 * voucher 的候选路径现在只有一份，在 `platform/bilibili/riskVoucher.ts`。
 *
 * 合并前这里认 4 条、`utils/Base.ts` 的闸门只认 2 条，落在差集上的 voucher 会让用户
 * 先收一张「接口失败」卡再被要求扫码。两侧同源之后，这张表和
 * tests/unit/base-push-error-card.test.ts 里那张必须一起过。
 */
const voucherShapes: Array<[string, Record<string, unknown>]> = [
  ['data.data.v_voucher', { code: -352, data: { data: { v_voucher: 'voucher-1' } } }],
  ['data.v_voucher', { code: -352, data: { v_voucher: 'voucher-1' } }],
  ['rawError.data.data.v_voucher', { code: -352, rawError: { data: { data: { v_voucher: 'voucher-1' } } } }],
  ['rawError.data.v_voucher', { code: -352, rawError: { data: { v_voucher: 'voucher-1' } } }],
  ['rawError.error.data.data.v_voucher', { code: -352, rawError: { error: { data: { data: { v_voucher: 'voucher-1' } } } } }],
  ['rawError.error.data.v_voucher', { code: -352, rawError: { error: { data: { v_voucher: 'voucher-1' } } } }],
  ['rawError.v_voucher', { code: -352, rawError: { v_voucher: 'voucher-1' } }],
  ['v_voucher', { code: -352, v_voucher: 'voucher-1' }]
]

describe('bilibiliRiskControlStrategy voucher 候选路径', () => {
  it.each(voucherShapes)('命中并把 voucher 交给申请接口: %s', async (_path, error) => {
    requestCaptchaFromVoucher.mockResolvedValue({})
    const ctx = createContext({ error })

    expect(bilibiliRiskControlStrategy.match(ctx as never)).toBe(true)
    await bilibiliRiskControlStrategy.handle(ctx as never)

    expect(requestCaptchaFromVoucher.mock.calls[0]?.[0]).toMatchObject({ v_voucher: 'voucher-1' })
  })

  it('一条都不命中时 match 为假', () => {
    // 实测的 -352 信封只有 {code, message, ttl}。没有 voucher 就申请不了验证码，
    // 这时候必须让路给错误卡片，而不是把 handle 跑一遍再 continue。
    expect(bilibiliRiskControlStrategy.match(
      createContext({ error: { code: -352, message: '风控校验失败', ttl: 1 } }) as never
    )).toBe(false)
  })

  it('空字符串 voucher 不算命中', () => {
    expect(bilibiliRiskControlStrategy.match(
      createContext({ error: { code: -352, data: { data: { v_voucher: '' } } } }) as never
    )).toBe(false)
  })
})
