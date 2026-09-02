import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { ErrorHandlerContext } from '../../src/module/utils/ErrorHandler/types.js'
import type { MessageEvent } from '../../src/types/message.js'

// 场景收敛的断言全靠「Render() 到手的 logs 数组」，所以这个 mock 要留得住调用参数
const renderMock = vi.hoisted(() => vi.fn())

vi.mock('../../src/module/utils/Render.js', () => ({
  Render: renderMock
}))

vi.mock('../../src/runtime/host/config.js', () => ({
  default: { masterQQ: [], master: [] }
}))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: { app: { errorLogSendTo: [] } }
}))

let normalizeError: typeof import('../../src/module/utils/ErrorHandler/render.js').normalizeError
let renderErrorReport: typeof import('../../src/module/utils/ErrorHandler/render.js').renderErrorReport
let buildErrorMessage: typeof import('../../src/module/utils/ErrorHandler/render.js').buildErrorMessage
let errorHandlerExports: typeof import('../../src/module/utils/ErrorHandler/index.js')

// globalThis.logger 在全局声明里是必填的 Logger，塞部分实现得先过一层 unknown
const globalWithLogger = globalThis as unknown as { logger?: unknown }

beforeAll(async () => {
  // renderErrorReport 的 catch 分支会调 logger.warn。装个哑实现，
  // 好让真出问题时看到的是断言失败，而不是「logger is not defined」把原因盖掉。
  globalWithLogger.logger ??= {
    warn: () => {}, error: () => {}, info: () => {}, debug: () => {}, mark: () => {}
  }
  ;({ normalizeError, renderErrorReport, buildErrorMessage } = await import('../../src/module/utils/ErrorHandler/render.js'))
  errorHandlerExports = await import('../../src/module/utils/ErrorHandler/index.js')
})

describe('normalizeError', () => {
  it('preserves Error details', () => {
    const error = new TypeError('invalid payload')

    expect(normalizeError(error)).toMatchObject({
      name: 'TypeError',
      message: 'invalid payload',
      stack: expect.stringContaining('TypeError: invalid payload')
    })
  })

  it('normalizes string errors', () => {
    expect(normalizeError('request failed')).toEqual({
      name: 'Error',
      message: 'request failed',
      stack: ''
    })
  })

  it('preserves Axios-style error fields', () => {
    expect(normalizeError({
      name: 'AxiosError',
      message: 'Request failed with status code 503',
      stack: 'AxiosError: Request failed',
      code: 'ERR_BAD_RESPONSE',
      response: { status: 503 }
    })).toEqual({
      name: 'AxiosError',
      message: 'Request failed with status code 503',
      stack: 'AxiosError: Request failed'
    })
  })

  it('normalizes values that cannot be stringified normally', () => {
    expect(() => normalizeError(Object.create(null))).not.toThrow()
    expect(normalizeError(Object.create(null))).toEqual({
      name: 'Error',
      message: '[object Object]',
      stack: ''
    })
  })

  it('ignores properties whose access throws', () => {
    const error = Object.defineProperty({}, 'message', {
      get () {
        throw new Error('blocked getter')
      }
    })

    expect(() => normalizeError(error)).not.toThrow()
    expect(normalizeError(error).name).toBe('Error')
  })

  it('exports the normalizer from the ErrorHandler barrel', () => {
    expect(errorHandlerExports.normalizeError).toBe(normalizeError)
  })
})

describe('error card context rows converge per scenario', () => {
  /**
   * 「群 / 用户」两行是 render.ts 合成进 `logs` 的条目，模板只是 `data.logs.map` ——
   * 所以「某一行渲不渲染」等价于「那条条目在不在 Render() 收到的 logs 里」，
   * 直接断言这个数组就够，不用起 puppeteer 去看图。
   */
  const contextRows = async (event?: MessageEvent, logs: ErrorHandlerContext['logs'] = []) => {
    renderMock.mockClear()
    renderMock.mockResolvedValue(['image'])

    await renderErrorReport({
      error: new Error('boom'),
      options: { businessName: '解析' },
      logs,
      event
    })

    // 不加这条的话，Render 压根没被调到时下面会拿到空数组，
    // 「主动推送没有用户行」这类用例就会假通过。
    expect(renderMock).toHaveBeenCalledTimes(1)
    const params = renderMock.mock.calls[0][1] as { logs?: Array<{ message: string }> }
    return (params.logs ?? []).map(entry => entry.message)
  }

  it('keeps both rows when a group message triggered the failure', async () => {
    expect(await contextRows({ group_id: 114514, user_id: 1919810 })).toEqual([
      '群: 114514',
      '用户: 1919810'
    ])
  })

  it('still finds the trigger user on adapters that only fill sender.user_id', async () => {
    // 群号用 snake_case：camelCase 的 groupId 全宿主无一处产生（lib/、7 个适配器、
    // 其余协议插件都只给 group_id），@kaguyajs/trss-yunzai-types 也只声明 snake_case，
    // 所以那层兼容连带这条断言都是在防御一个不存在的形状。
    // sender.user_id 这条回退是真的：部分适配器只填 sender 不填顶层 user_id。
    expect(await contextRows({ group_id: 114514, sender: { user_id: 1919810 } })).toEqual([
      '群: 114514',
      '用户: 1919810'
    ])
  })

  it('drops the group row in a private chat', async () => {
    // 三种私聊形状都要认：宿主 loader 注入的 isPrivate、OneBot 原始的 is_private，
    // 以及两个标记都没给、只能靠「压根没有 group_id」判断的适配器。
    for (const event of [
      { isPrivate: true, user_id: 1919810 },
      { is_private: true, user_id: 1919810 },
      { user_id: 1919810 }
    ] satisfies MessageEvent[]) {
      expect(await contextRows(event)).toEqual(['用户: 1919810'])
    }
  })

  it('drops the group row even if a private event still carries a stale group_id', async () => {
    // 判定以「是不是私聊」为准而不是「有没有 group_id」，否则残留字段会把私聊图
    // 又填回一行群号，而那个群跟这次报错没关系。
    expect(await contextRows({ isPrivate: true, group_id: 114514, user_id: 1919810 })).toEqual([
      '用户: 1919810'
    ])
  })

  it('drops the user row for a cron-triggered push', async () => {
    // push.ts 的 createPushTask 是 `handler(undefined)`：定时推送连事件对象都没有，
    // 既没有触发用户也没有会话群，两行都不该出现（旧实现会写成「群: private / 用户: unknown」）。
    expect(await contextRows(undefined)).toEqual([])
  })

  it('drops only the user row when a push knows its target group but has no trigger user', async () => {
    expect(await contextRows({ group_id: 114514 })).toEqual(['群: 114514'])
  })

  it('leaves real captured logs untouched while suppressing the synthetic rows', async () => {
    // 收敛只针对合成的两行，真日志一条都不能少 —— 那才是排查报错要看的内容
    const captured: ErrorHandlerContext['logs'] = [
      { timestamp: '12:00:00.123', level: 'INFO', message: '请求开始', raw: '[12:00:00.123][INFO] 请求开始' },
      { timestamp: '12:00:00.456', level: 'ERRO', message: '请求失败', raw: '[12:00:00.456][ERRO] 请求失败' }
    ]

    expect(await contextRows(undefined, captured)).toEqual(['请求失败', '请求开始'])
  })

  it('applies the same scenario rules to the plain-text fallback', async () => {
    // 渲染失败时这段文字是唯一的信息载体，不该比卡片多出占位行
    const textFor = (event?: MessageEvent) => buildErrorMessage({
      error: new Error('boom'),
      options: { businessName: '解析' },
      logs: [],
      event
    })

    const group = textFor({ group_id: 114514, user_id: 1919810 })
    expect(group).toContain('群: 114514')
    expect(group).toContain('用户: 1919810')

    const priv = textFor({ isPrivate: true, user_id: 1919810 })
    expect(priv).not.toContain('群:')
    expect(priv).toContain('用户: 1919810')

    const push = textFor(undefined)
    expect(push).not.toContain('用户:')
    expect(push).not.toContain('群:')
    // 占位串彻底消失，而不是换了个写法
    expect(push).not.toContain('private')
    expect(push).not.toContain('unknown')
  })
})

describe('业务错误卡片带上接口诊断', () => {
  const cardOf = async (error: unknown, platform?: string) => {
    renderMock.mockClear()
    renderMock.mockResolvedValue(['image'])

    await renderErrorReport({
      error,
      options: { businessName: '解析', platform } as ErrorHandlerContext['options'],
      logs: [],
      event: { group_id: 1, user_id: 2 } as MessageEvent
    })

    expect(renderMock).toHaveBeenCalledTimes(1)
    return renderMock.mock.calls[0][1] as {
      error: { stack: string, diagnostics?: Array<{ label: string, value: string }> }
    }
  }

  const rows = async (error: unknown, platform?: string): Promise<Record<string, string>> => {
    const card = await cardOf(error, platform)
    return Object.fromEntries((card.error.diagnostics ?? []).map(item => [item.label, item.value]))
  }

  /** 线上那次 -412 的信封形状 */
  const bilibiliBanned = (): Error => Object.assign(new Error('B站数据获取失败'), {
    code: -412,
    rawError: {
      errorDescription: '请求被拦截 (客户端 ip 被服务端风控)',
      requestType: 'videoInfo',
      requestUrl: 'https://api.bilibili.com/x/web-interface/view?bvid=BV1',
      responseCode: -412
    }
  })

  it('把 AmagiError 的信封摊成诊断行', async () => {
    // normalizeError 只读 name / message / stack，code 与 rawError 原来整个丢掉 ——
    // 而这条路上唯一有定位价值的就是 requestUrl 和 errorDescription
    expect(await rows(bilibiliBanned(), 'bilibili')).toMatchObject({
      平台: 'bilibili',
      业务码: '-412',
      请求类型: 'videoInfo',
      错误描述: '请求被拦截 (客户端 ip 被服务端风控)',
      接口地址: 'https://api.bilibili.com/x/web-interface/view?bvid=BV1'
    })
  })

  it('-412 给一句「等」，不引导用户去找验证码', async () => {
    // riskControl 只认 -352：-412 没有 voucher，也没有验证码可过
    expect((await rows(bilibiliBanned(), 'bilibili')).建议).toContain('IP')
  })

  it('抖音那个恒为 500 的通用失败如实说不知道原因', async () => {
    const advice = (await rows(Object.assign(new Error('抖音数据获取失败'), { code: 500 }), 'douyin')).建议
    expect(advice).toContain('稍后再试')
  })

  it('认不出来的失败不硬凑一句建议', async () => {
    expect((await rows(new Error('boom'), 'douyin')).建议).toBeUndefined()
  })

  it('堆栈里的绝对路径被压掉，不把服务器目录贴到群里', async () => {
    const error = new Error('boom')
    const pluginRoot = process.cwd().replace(/\\/g, '/')
    error.stack = `Error: boom\n    at foo (${pluginRoot}/lib/x.js:1:1)`

    const card = await cardOf(error, 'douyin')

    expect(card.error.stack).not.toContain(pluginRoot)
    expect(card.error.stack).toContain('./lib/x.js')
  })
})
