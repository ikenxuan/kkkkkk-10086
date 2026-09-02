import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AmagiError } from '../../src/module/platform/common/softError.js'

/**
 * `platform/douyin/login.ts` 的行为护栏。
 *
 * 这条流程移植自上游 3cf285ae：协议层全在 `@ikenxuan/amagi` 的 passport 接口里，
 * 本文件只剩「与用户的交互 + 状态流转」，所以钉住的正是那部分：
 *
 * - **失败语义是抛而不是返回**。四个 passport 方法挂在 `douyinFetcher` 上、过了
 *   `wrapAmagiClient`，业务失败是抛出来的 `AmagiError`（上游那份是带 `success` 的返回值）。
 *   每一步都要自己接住并给出各自的提示，漏接一步就塌成一句「登录过程出错」。
 * - **会话 cookie 的逐步流转**。每个接口都返回一份刷新过的 cookie，漏传一次就是
 *   下一步被判成伪造请求，而错误信息里看不出是哪一步丢的。
 * - **等待窗口的三次改写**。二维码有效期 → 扫码后 → 二次验证通过后，各是一个
 *   不同的截止时间，写错只会表现成「用户白等」或「刚扫完就说超时」。
 * - **二次验证的每一条退出路径**。发码前的两道前置判断（有没有交互上下文、
 *   服务端给的方式支不支持）都在真的发短信之前，走错顺序就是白扣一次发码额度。
 * - **提示文案里的秒数和实际等待秒数是同一个**。它们分别来自 login.ts 和宿主的
 *   awaitContext，各写各的就会出现「提示 90 秒、60 秒就超时」。
 *
 * 时间用 `Date.now` + `Common.sleep` 两个桩接管：轮询循环只从这两处读时间，
 * 让 sleep 直接推进假时钟，两分钟和三分钟的窗口都能在零耗时内跑完，
 * 也不用把真实 IO 和假定时器混在一起。
 */

/** `buildAmagiRequestConfig()` 的替身返回值，只用来认第三个实参真的到位 */
const requestConfig = vi.hoisted(() => ({ timeout: 15_000 }))

// 裸 Proxy 承载不了调用断言（每次属性访问都是一个新 vi.fn()），逐个列具名替身
const doubles = vi.hoisted(() => ({
  requestPassportQrcode: vi.fn(),
  checkPassportQrcode: vi.fn(),
  sendPassportVerifyCode: vi.fn(),
  validatePassportVerifyCode: vi.fn(),
  isSmsCodeVerifyWay: vi.fn(),
  buildAmagiRequestConfig: vi.fn(() => requestConfig),
  Render: vi.fn(),
  readImageBytes: vi.fn(),
  mkdir: vi.fn(),
  sleep: vi.fn(),
  modify: vi.fn(),
  writeFileSync: vi.fn()
}))

vi.mock('../../src/module/utils/amagiClient.js', () => ({
  douyinFetcher: {
    requestPassportQrcode: doubles.requestPassportQrcode,
    checkPassportQrcode: doubles.checkPassportQrcode,
    sendPassportVerifyCode: doubles.sendPassportVerifyCode,
    validatePassportVerifyCode: doubles.validatePassportVerifyCode
  },
  isSmsCodeVerifyWay: doubles.isSmsCodeVerifyWay,
  buildAmagiRequestConfig: doubles.buildAmagiRequestConfig
}))

vi.mock('../../src/module/utils/index.js', () => ({
  Config: { modify: doubles.modify },
  Common: {
    tempDri: { default: '/tmp/kkk' },
    mkdir: doubles.mkdir,
    sleep: doubles.sleep
  },
  Render: doubles.Render
}))

// Watermark 真身在模块级 import sharp，单测里不需要那颗原生模块
vi.mock('../../src/module/utils/Watermark.js', () => ({
  readImageBytes: doubles.readImageBytes
}))

vi.mock('node:fs', () => ({
  default: { writeFileSync: doubles.writeFileSync }
}))

globalThis.logger = {
  info: vi.fn(),
  mark: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
} as unknown as typeof logger

const { dylogin } = await import('../../src/module/platform/douyin/login.js')

/** amagi 的成功信封 */
const ok = (data: unknown) => ({ success: true, code: 200, message: 'success', data })

/** wrapAmagiClient 在业务失败时抛出的那种错误 */
const amagiFailure = (message: string): AmagiError => new AmagiError(500, message)

/** 一条二维码轮询结果，默认带上会话 cookie 与服务端给的退避间隔 */
const poll = (overrides: Record<string, unknown>) =>
  ok({ interval: 1000, cookie: 'cookie-poll', logged_in: false, ...overrides })

/** 六个关键 cookie 齐全的登录凭证 */
const FULL_COOKIE = 'sessionid=a; sessionid_ss=b; sid_guard=c; uid_tt=d; uid_tt_ss=e; ttwid=f'

/** 发码成功的返回，绝大多数二次验证用例只改其中一两个字段 */
const sendCodeOk = (overrides: Record<string, unknown> = {}) => ok({
  ok: true,
  mobile: '138****0000',
  retryAfter: 60,
  message: '',
  cookie: 'cookie-sent',
  biz_trace_id: 'trace-1',
  verify_way: 'mobile_sms_verify',
  ...overrides
})

const verifyContext = (overrides: Record<string, unknown> = {}) => ({
  encryptUid: 'euid',
  verifyTicket: 'ticket',
  stdParams: { std_verify_token: 'token' },
  copywritingKey: 'qr_connect',
  diversionTag: 'mfa',
  newVerifyFlow: '1',
  verifyWays: [{ verifyWay: 'mobile_sms_verify', mobile: '138****0000' }],
  ...overrides
})

const createEvent = () => {
  const replies: unknown[] = []
  const recalled: unknown[] = []
  let nextId = 0
  return {
    replies,
    recalled,
    reply: vi.fn(async (message: unknown, _quote?: boolean) => {
      replies.push(message)
      nextId++
      return { message_id: `msg-${nextId}` }
    }),
    bot: {
      recallMsg: vi.fn(async (_event: unknown, id: unknown) => {
        recalled.push(id)
      })
    }
  }
}

type LoginEventDouble = ReturnType<typeof createEvent>

/**
 * `waitForCode` 的替身。
 *
 * 形参必须写全：零参数的 `vi.fn` 其 `mock.calls` 是空元组，
 * 取不到提示文案与秒数这两个正是本文件要断言的东西。
 * @param answer 每次都返回的验证码
 */
const codeSource = (answer: string) =>
  vi.fn(async (_prompt: string, _timeoutSeconds: number) => answer)

/** 把所有文本回复拼成一段，用来做包含断言 */
const said = (event: LoginEventDouble): string =>
  event.replies.filter(item => typeof item === 'string').join('\n')

const run = async (
  event: LoginEventDouble,
  waitForCode?: (prompt: string, timeoutSeconds: number) => Promise<string>
): Promise<boolean> => await dylogin(event, waitForCode ? { waitForCode } : {})

/** 假时钟当前值，`Common.sleep` 的替身按传入毫秒推进它 */
let clock = 0
let nowSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  clock = 0
  nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => clock)
  doubles.sleep.mockImplementation(async (ms: number) => {
    clock += ms
  })
  doubles.buildAmagiRequestConfig.mockReturnValue(requestConfig)
  doubles.Render.mockResolvedValue([{ file: 'base64://qrcode-png' }])
  doubles.readImageBytes.mockReturnValue(null)
  doubles.isSmsCodeVerifyWay.mockReturnValue(true)
  doubles.requestPassportQrcode.mockResolvedValue(ok({
    token: 'token-1',
    content: 'https://www.douyin.com/qr/x',
    expire_time: 1_800_000_000,
    expires_in: 60,
    cookie: 'cookie-qrcode'
  }))
})

afterEach(() => {
  nowSpy.mockRestore()
})

describe('二维码获取', () => {
  it('带上 requestConfig 申请二维码，并把 content 交给模板渲染', async () => {
    doubles.checkPassportQrcode.mockResolvedValue(poll({ status: 'expired' }))
    const event = createEvent()

    await run(event)

    expect(doubles.requestPassportQrcode).toHaveBeenCalledWith({ typeMode: 'strict' }, undefined, requestConfig)
    expect(doubles.Render).toHaveBeenCalledWith('douyin/qrcodeImg', { share_url: 'https://www.douyin.com/qr/x' })
    expect(event.replies).toContainEqual([{ file: 'base64://qrcode-png' }])
  })

  it('渲染出图后顺手落一份 png 到临时目录', async () => {
    doubles.readImageBytes.mockReturnValue(Buffer.from('png-bytes'))
    doubles.checkPassportQrcode.mockResolvedValue(poll({ status: 'expired' }))

    await run(createEvent())

    expect(doubles.mkdir).toHaveBeenCalledWith('/tmp/kkk')
    expect(doubles.writeFileSync).toHaveBeenCalledTimes(1)
    expect(String(doubles.writeFileSync.mock.calls[0]?.[0])).toContain('DouyinLoginQrcode.png')
  })

  it('申请失败时报出 AmagiError 的 message，并且不进入轮询', async () => {
    doubles.requestPassportQrcode.mockRejectedValue(amagiFailure('二维码接口 502'))
    const event = createEvent()

    await run(event)

    expect(said(event)).toContain('获取二维码失败：二维码接口 502')
    expect(doubles.checkPassportQrcode).not.toHaveBeenCalled()
  })

  it('渲染不出图时落到通用错误分支，不会拿 undefined 继续跑', async () => {
    doubles.Render.mockResolvedValue(false)
    const event = createEvent()

    await run(event)

    expect(said(event)).toContain('登录过程出错')
    expect(doubles.checkPassportQrcode).not.toHaveBeenCalled()
  })
})

describe('扫码轮询', () => {
  it('确认登录后保存 cookie 并撤回此前发出的消息', async () => {
    doubles.checkPassportQrcode.mockResolvedValue(poll({
      status: 'confirmed',
      redirectUrl: 'https://sso',
      logged_in: true,
      cookie: FULL_COOKIE
    }))
    const event = createEvent()

    const result = await run(event)

    expect(result).toBe(true)
    expect(doubles.modify).toHaveBeenCalledWith('cookies', 'douyin', FULL_COOKIE)
    expect(said(event)).toContain('登录成功')
    // 免责声明 + 二维码两条都要撤掉，二维码不能留在群里
    expect(event.recalled).toEqual(['msg-1', 'msg-2'])
  })

  it('已确认但没拿到登录态时不写 cookies.yaml', async () => {
    doubles.checkPassportQrcode.mockResolvedValue(poll({
      status: 'confirmed',
      redirectUrl: 'https://sso',
      logged_in: false,
      cookie: 'ttwid=only'
    }))
    const event = createEvent()

    await run(event)

    expect(doubles.modify).not.toHaveBeenCalled()
    expect(said(event)).toContain('未下发登录凭证')
  })

  it('一直没人扫码时等到二维码有效期用尽才收口', async () => {
    doubles.checkPassportQrcode.mockResolvedValue(poll({ status: 'new', interval: 5_000 }))
    const event = createEvent()

    await run(event)

    // expires_in 是 60 秒，比 SCAN_TIMEOUT 的 120 秒短，取小的那个
    expect(doubles.checkPassportQrcode).toHaveBeenCalledTimes(12)
    expect(said(event)).toContain('登录超时！二维码已失效！')
  })

  it('二维码有效期长于 SCAN_TIMEOUT 时以 SCAN_TIMEOUT 封顶', async () => {
    doubles.requestPassportQrcode.mockResolvedValue(ok({
      token: 'token-1',
      content: 'https://qr',
      expire_time: 1_800_000_000,
      expires_in: 600,
      cookie: 'cookie-qrcode'
    }))
    doubles.checkPassportQrcode.mockResolvedValue(poll({ status: 'new', interval: 10_000 }))

    await run(createEvent())

    expect(doubles.checkPassportQrcode).toHaveBeenCalledTimes(12)
  })

  it('二维码失效时提示重新发起', async () => {
    doubles.checkPassportQrcode.mockResolvedValue(poll({ status: 'expired' }))
    const event = createEvent()

    await run(event)

    expect(said(event)).toContain('二维码已失效，请重新发起登录')
    expect(doubles.modify).not.toHaveBeenCalled()
  })

  it('扫码提示只发一次，并把等待窗口改写成确认时限', async () => {
    doubles.checkPassportQrcode.mockResolvedValue(poll({ status: 'scanned', interval: 10_000 }))
    const event = createEvent()

    await run(event)

    expect(event.replies.filter(item => item === '二维码已扫码，请在手机上授权以登录')).toHaveLength(1)
    // 首次 scanned 把窗口重置成 CONFIRM_TIMEOUT（180 秒），10 秒一轮，加首轮共 18 次
    expect(doubles.checkPassportQrcode).toHaveBeenCalledTimes(18)
    expect(said(event)).toContain('等待手机确认超时，登录已取消')
  })

  it('命中风控时把服务端的描述带给用户', async () => {
    doubles.checkPassportQrcode.mockResolvedValue(poll({ status: 'risk', message: '环境异常' }))
    const event = createEvent()

    await run(event)

    expect(said(event)).toContain('登录请求被抖音风控拦截：环境异常')
  })

  it('轮询请求本身失败时直接收口', async () => {
    doubles.checkPassportQrcode.mockRejectedValue(amagiFailure('check_qrconnect 超时'))
    const event = createEvent()

    await run(event)

    expect(said(event)).toContain('轮询二维码状态失败：check_qrconnect 超时')
    expect(doubles.checkPassportQrcode).toHaveBeenCalledTimes(1)
  })

  it('限频与未知状态都按服务端给的间隔继续轮询', async () => {
    doubles.checkPassportQrcode
      .mockResolvedValueOnce(poll({ status: 'busy', message: '访问太频繁', interval: 6_000 }))
      .mockResolvedValueOnce(poll({ status: 'unknown', message: 'status=whatever', interval: 3_000 }))
      .mockResolvedValue(poll({ status: 'expired' }))
    const event = createEvent()

    await run(event)

    expect(doubles.sleep).toHaveBeenNthCalledWith(1, 6_000)
    expect(doubles.sleep).toHaveBeenNthCalledWith(2, 3_000)
    expect(said(event)).toContain('二维码已失效')
  })

  it('每一轮都带上上一次返回的会话 cookie', async () => {
    doubles.checkPassportQrcode
      .mockResolvedValueOnce(poll({ status: 'new', cookie: 'cookie-round-1' }))
      .mockResolvedValueOnce(poll({ status: 'expired', cookie: 'cookie-round-2' }))

    await run(createEvent())

    expect(doubles.checkPassportQrcode).toHaveBeenNthCalledWith(1, { token: 'token-1', typeMode: 'strict' }, 'cookie-qrcode', requestConfig)
    expect(doubles.checkPassportQrcode).toHaveBeenNthCalledWith(2, { token: 'token-1', typeMode: 'strict' }, 'cookie-round-1', requestConfig)
  })
})

describe('短信二次验证', () => {
  /** 第一轮下发 verify，之后一律 confirmed */
  const scriptVerifyThenConfirm = (verify: Record<string, unknown> = verifyContext()): void => {
    doubles.checkPassportQrcode
      .mockResolvedValueOnce(poll({ status: 'verify', verify, cookie: 'cookie-verify' }))
      .mockResolvedValue(poll({ status: 'confirmed', redirectUrl: 'https://sso', logged_in: true, cookie: FULL_COOKIE }))
  }

  /** 每一轮都下发 verify，用来观察二次验证自身的收口 */
  const scriptVerifyOnly = (verify: Record<string, unknown> = verifyContext()): void => {
    doubles.checkPassportQrcode.mockResolvedValue(poll({ status: 'verify', verify, cookie: 'cookie-verify' }))
  }

  it('发码 → 回填 → 验码通过 → 继续轮询到登录成功', async () => {
    scriptVerifyThenConfirm()
    doubles.sendPassportVerifyCode.mockResolvedValue(sendCodeOk())
    doubles.validatePassportVerifyCode.mockResolvedValue(ok({
      ok: true,
      wrongCode: false,
      message: '',
      cookie: 'cookie-validated'
    }))
    const waitForCode = codeSource('123456')
    const event = createEvent()

    await run(event, waitForCode)

    expect(doubles.sendPassportVerifyCode).toHaveBeenCalledWith(
      { verify: verifyContext(), verify_way: 'mobile_sms_verify', typeMode: 'strict' },
      'cookie-verify',
      requestConfig
    )
    // biz_trace_id 与 verify_way 必须回传发码那次的取值，cookie 用发码刷新过的那份
    expect(doubles.validatePassportVerifyCode).toHaveBeenCalledWith(
      { verify: verifyContext(), code: '123456', biz_trace_id: 'trace-1', verify_way: 'mobile_sms_verify', typeMode: 'strict' },
      'cookie-sent',
      requestConfig
    )
    expect(said(event)).toContain('验证通过')
    expect(doubles.modify).toHaveBeenCalledWith('cookies', 'douyin', FULL_COOKIE)
  })

  it('提示文案里的秒数就是交给宿主的等待秒数', async () => {
    scriptVerifyThenConfirm()
    doubles.sendPassportVerifyCode.mockResolvedValue(sendCodeOk())
    doubles.validatePassportVerifyCode.mockResolvedValue(ok({ ok: true, wrongCode: false, message: '', cookie: 'c2' }))
    const waitForCode = codeSource('123456')

    await run(createEvent(), waitForCode)

    const [prompt, timeoutSeconds] = waitForCode.mock.calls[0]!
    expect(prompt).toContain('138****0000')
    expect(prompt).toContain(`请在 ${timeoutSeconds} 秒内`)
    expect(timeoutSeconds).toBe(90)
  })

  it('验证码连错三次后放弃，不会无限重试', async () => {
    scriptVerifyOnly()
    doubles.sendPassportVerifyCode.mockResolvedValue(sendCodeOk())
    doubles.validatePassportVerifyCode.mockResolvedValue(ok({
      ok: false, wrongCode: true, errorCode: 1202, message: '验证码错误', cookie: 'c2'
    }))
    const waitForCode = codeSource('000000')
    const event = createEvent()

    await run(event, waitForCode)

    expect(doubles.validatePassportVerifyCode).toHaveBeenCalledTimes(3)
    expect(waitForCode).toHaveBeenCalledTimes(3)
    // 第二、三次的提示要带上剩余机会，最后一次直接报失败
    expect(String(waitForCode.mock.calls[1]?.[0])).toContain('剩余 2 次机会')
    expect(String(waitForCode.mock.calls[2]?.[0])).toContain('剩余 1 次机会')
    expect(said(event)).toContain('验证失败：验证码错误')
  })

  it('格式不对的输入不消耗验码接口，用尽机会后取消', async () => {
    scriptVerifyOnly()
    doubles.sendPassportVerifyCode.mockResolvedValue(sendCodeOk())
    const waitForCode = codeSource('12ab')
    const event = createEvent()

    await run(event, waitForCode)

    expect(doubles.validatePassportVerifyCode).not.toHaveBeenCalled()
    expect(waitForCode).toHaveBeenCalledTimes(3)
    expect(said(event)).toContain('输入格式不正确，登录已取消')
  })

  it('不是「填错了」的失败不给重试机会', async () => {
    scriptVerifyOnly()
    doubles.sendPassportVerifyCode.mockResolvedValue(sendCodeOk())
    doubles.validatePassportVerifyCode.mockResolvedValue(ok({
      ok: false, wrongCode: false, errorCode: 1204, message: '验证失败 error_code=1204', cookie: 'c2'
    }))
    const event = createEvent()

    await run(event, codeSource('123456'))

    expect(doubles.validatePassportVerifyCode).toHaveBeenCalledTimes(1)
    expect(said(event)).toContain('验证失败 error_code=1204')
  })

  it('验码请求本身失败时报出 AmagiError 的 message', async () => {
    scriptVerifyOnly()
    doubles.sendPassportVerifyCode.mockResolvedValue(sendCodeOk())
    doubles.validatePassportVerifyCode.mockRejectedValue(amagiFailure('validate_code 502'))
    const event = createEvent()

    await run(event, codeSource('123456'))

    expect(doubles.validatePassportVerifyCode).toHaveBeenCalledTimes(1)
    expect(said(event)).toContain('验证失败：validate_code 502')
  })

  it('拿不到验证码时按取消处理', async () => {
    scriptVerifyOnly()
    doubles.sendPassportVerifyCode.mockResolvedValue(sendCodeOk())
    const event = createEvent()

    await run(event, codeSource(''))

    expect(doubles.validatePassportVerifyCode).not.toHaveBeenCalled()
    expect(said(event)).toContain('等待验证码超时，登录已取消')
  })

  it('没有验证码输入上下文时不白发一条短信', async () => {
    scriptVerifyOnly()
    const event = createEvent()

    await run(event)

    expect(doubles.sendPassportVerifyCode).not.toHaveBeenCalled()
    expect(said(event)).toContain('#设置抖音ck')
  })

  it('服务端只给了不支持的验证方式时不发短信', async () => {
    scriptVerifyOnly(verifyContext({
      verifyWays: [{ verifyWay: 'face_verify' }, { verifyWay: 'mobile_up_sms_verify' }]
    }))
    doubles.isSmsCodeVerifyWay.mockReturnValue(false)
    const event = createEvent()

    await run(event, codeSource('123456'))

    expect(doubles.sendPassportVerifyCode).not.toHaveBeenCalled()
    expect(said(event)).toContain('face_verify、mobile_up_sms_verify')
  })

  it('服务端没给验证方式时仍然尝试发码，由服务端自己挑', async () => {
    scriptVerifyOnly(verifyContext({ verifyWays: [] }))
    doubles.sendPassportVerifyCode.mockResolvedValue(sendCodeOk({ mobile: '' }))
    const waitForCode = codeSource('')

    await run(createEvent(), waitForCode)

    expect(doubles.sendPassportVerifyCode).toHaveBeenCalledWith(
      expect.objectContaining({ verify_way: undefined }),
      'cookie-verify',
      requestConfig
    )
    // 服务端没给脱敏手机号时用兜底文案，不能出现 undefined
    expect(String(waitForCode.mock.calls[0]?.[0])).toContain('扫码设备绑定的手机号')
  })

  it('缺验证上下文时直接放弃', async () => {
    scriptVerifyOnly(verifyContext({ encryptUid: '' }))
    const event = createEvent()

    await run(event, codeSource('123456'))

    expect(doubles.sendPassportVerifyCode).not.toHaveBeenCalled()
    expect(said(event)).toContain('未下发验证上下文')
  })

  it('发码被服务端拒绝时报出原因', async () => {
    scriptVerifyOnly()
    doubles.sendPassportVerifyCode.mockResolvedValue(sendCodeOk({
      ok: false, mobile: '', retryAfter: 30, errorCode: 1206, message: '短信发送过于频繁'
    }))
    const waitForCode = codeSource('123456')
    const event = createEvent()

    await run(event, waitForCode)

    expect(waitForCode).not.toHaveBeenCalled()
    expect(said(event)).toContain('短信验证码发送失败：短信发送过于频繁')
  })

  it('发码请求本身失败时报出 AmagiError 的 message', async () => {
    scriptVerifyOnly()
    doubles.sendPassportVerifyCode.mockRejectedValue(amagiFailure('send_code 502'))
    const event = createEvent()

    await run(event, codeSource('123456'))

    expect(said(event)).toContain('短信验证码发送失败：send_code 502')
  })

  it('验证通过后把等待窗口改写成确认时限', async () => {
    doubles.sendPassportVerifyCode.mockResolvedValue(sendCodeOk())
    doubles.validatePassportVerifyCode.mockResolvedValue(ok({ ok: true, wrongCode: false, message: '', cookie: 'c2' }))
    // 首轮 verify 走完二次验证，之后一直 new：窗口应当从验证通过那一刻起算 180 秒
    doubles.checkPassportQrcode
      .mockResolvedValueOnce(poll({ status: 'verify', verify: verifyContext(), cookie: 'cookie-verify' }))
      .mockResolvedValue(poll({ status: 'new', interval: 10_000 }))

    await run(createEvent(), codeSource('123456'))

    // 首轮 verify 后窗口重置成 180 秒，退避 1 秒再按 10 秒一轮，加首轮共 19 次
    expect(doubles.checkPassportQrcode).toHaveBeenCalledTimes(19)
  })
})

describe('登录凭证落盘', () => {
  const confirmWith = (cookie: string): void => {
    doubles.checkPassportQrcode.mockResolvedValue(poll({
      status: 'confirmed', redirectUrl: 'https://sso', logged_in: true, cookie
    }))
  }

  it('六个关键 cookie 齐全时不告警', async () => {
    confirmWith(FULL_COOKIE)

    await run(createEvent())

    expect(vi.mocked(globalThis.logger.warn)).not.toHaveBeenCalled()
    expect(doubles.modify).toHaveBeenCalledWith('cookies', 'douyin', FULL_COOKIE)
  })

  it('关键 cookie 缺失时逐个列出来，但仍然保存本次凭证', async () => {
    const partial = 'sessionid=a; sid_guard=c; ttwid=f'
    confirmWith(partial)
    const event = createEvent()

    await run(event)

    const warned = vi.mocked(globalThis.logger.warn).mock.calls.map(call => String(call[0])).join('\n')
    expect(warned).toContain('sessionid_ss')
    expect(warned).toContain('uid_tt')
    expect(warned).toContain('uid_tt_ss')
    expect(warned).not.toContain('sid_guard')
    // 抖音并非每次都下发全部六个，缺字段只是告警，不能因此不保存
    expect(doubles.modify).toHaveBeenCalledWith('cookies', 'douyin', partial)
    expect(said(event)).toContain('登录成功')
  })
})
