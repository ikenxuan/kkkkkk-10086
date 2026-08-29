import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 定时推送那条路上的接口错误卡片。
 *
 * 被测的三段逻辑（`parsePushTargets` / `getPushAdapterInfo` / `buildApiErrorImage` 的
 * 推送分支）在 `Base.ts` 里都是模块私有的，但它们唯一的调用点是 amagi 那层 Proxy ——
 * 而这个 Proxy 已经有现成的注入口（`new Base(e, overrides)` 的第二个参数，
 * 见 tests/unit/ffmpeg-options.test.ts）。所以这里不导出任何东西，直接从真实缝隙驱动：
 * 喂一个「业务码非 200」的假 fetcher，让 Proxy 自己走到出图那一步，
 * 再从 `Render()` 收到的 payload 上断言。这样连「Proxy 有没有把 pushContext
 * 当第 5 个参数传下去」也一并被钉住，导出私有函数是钉不到那一段的。
 */
const renderMock = vi.hoisted(() => vi.fn())

const configMock = vi.hoisted(() => ({
  cookies: {} as Record<string, string | null | undefined>,
  request: {} as Record<string, unknown>,
  pushlist: {},
  upload: {} as Record<string, unknown>,
  app: {} as Record<string, unknown>
}))

vi.mock('../../src/module/utils/Render.js', () => ({
  Render: renderMock
}))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: configMock
}))

vi.mock('../../src/module/utils/Network/index.js', () => ({
  Networks: class {},
  baseHeaders: {}
}))

vi.mock('../../src/module/platform/bilibili/api.js', () => ({
  getBilibiliData: vi.fn()
}))

vi.mock('../../src/module/platform/douyin/api.js', () => ({
  getDouyinData: vi.fn()
}))

vi.mock('../../src/runtime/host/config.js', () => ({
  default: { masterQQ: [], master: [] }
}))

// BotName 必须是 TRSS-Yunzai：定时推送分支走 sendMasterMessage，
// 另一条分支会去 statBotId(Config.pushlist) 里翻推送统计，那跟本文件要验的事无关。
vi.mock('../../src/module/utils/Version.js', () => ({
  default: {
    BotName: 'TRSS-Yunzai',
    BotVersion: 'test-bot',
    version: 'test-plugin',
    pluginName: 'kkk',
    pluginPath: ''
  }
}))

vi.mock('../../src/module/utils/Common.js', () => ({
  default: {
    tempDri: { video: '' },
    removeFile: vi.fn(),
    getVideoFileSize: vi.fn(async () => 1),
    calculateBitrate: vi.fn(() => 100),
    registerVideoPreview: vi.fn()
  }
}))

import { Base } from '../../src/module/utils/Base.js'

/** `Bot` / `logger` / `segment` 在全局声明里都是必填，塞部分实现得先过一层 unknown */
const globalWithHost = globalThis as unknown as {
  Bot?: unknown
  logger?: unknown
  segment?: unknown
}

const originalBot = globalWithHost.Bot

const amagiDependencies = {
  default: vi.fn(() => ({})),
  bilibiliErrorCodeMap: {},
  getBilibiliData: vi.fn(),
  getDouyinData: vi.fn()
}

/**
 * 宿主 plugins/adapter/OneBotv11.js 的字段形状：适配器实例上只有 id / name，
 * id 是平台（"QQ"）、name 是协议标准（"OneBotv11"），协议端真名只在
 * get_version_info 的 app_name 里。`_isServer: true` 对应 TRSS 自己起
 * WebSocketServer、协议端反连进来那种挂法。
 */
const llOneBot = () => ({
  adapter: { id: 'QQ', name: 'OneBotv11' },
  version: { app_name: 'LLOneBot', app_version: '8.1.8', id: 'QQ', name: 'OneBotv11' },
  ws: { readyState: 1, send: () => {}, _isServer: true }
})

/** Karin 形状的适配器：几格结论都是现成的，用来和上面那个区分「信息是从哪来的」 */
const napCatBot = () => ({
  adapter: {
    name: 'NapCat.Onebot',
    version: '4.18.9',
    platform: 'qq',
    standard: 'onebot11',
    protocol: 'napcat',
    communication: 'webSocketServer'
  }
})

interface ErrorCardPayload {
  logs?: Array<{ message: string }>
  adapterInfo?: {
    name: string
    version: string
    platform: string
    protocol: string
    standard: string
    communication: string
  }
}

/**
 * 把 `Bot[botId]` 摆成宿主那个形状：一个既能按账号索引、又带 sendMasterMsg 的对象
 * （TRSS-Yunzai 的 lib/bot.js 就是这么一个 Proxy）。
 */
const installBots = (bots: Record<string, unknown>): void => {
  globalWithHost.Bot = { sendMasterMsg: vi.fn(async () => undefined), ...bots }
}

/**
 * 驱动一次「抖音接口返回非 200」，返回 `Render()` 收到的卡片数据。
 *
 * 走 getDouyinData 而不是 getBilibiliData 只是因为它的触发条件更短
 * （`code !== 200`，不用配 bilibiliErrorCodeMap）；两条分支传给
 * buildApiErrorImage 的第 5 个参数是同一个 `self.pushContext`。
 */
const errorCard = async (options: {
  pushContext?: { groupWithBot: string[] }
  event?: Record<string, unknown>
  bots?: Record<string, unknown>
} = {}): Promise<ErrorCardPayload> => {
  installBots(options.bots ?? {})

  const base = new Base(options.event as never, {
    ...amagiDependencies,
    getDouyinData: vi.fn().mockResolvedValue({ code: 500, message: '抖音接口炸了' })
  })
  base.pushContext = options.pushContext

  await expect(
    (base.amagi.getDouyinData as () => Promise<unknown>)()
  ).rejects.toThrow('抖音接口炸了')

  // 不加这条的话，Render 压根没被调到时下面会拿到空 payload，
  // 「某一行不该出现」这类用例就会假通过。
  expect(renderMock).toHaveBeenCalledTimes(1)
  return renderMock.mock.calls[0][1] as ErrorCardPayload
}

/** 卡片上的上下文行。合成的群/用户两行就是 `logs` 里的条目，模板只是 data.logs.map */
const contextRows = async (
  options: Parameters<typeof errorCard>[0] = {}
): Promise<string[]> => {
  const payload = await errorCard(options)
  return (payload.logs ?? []).map(entry => entry.message)
}

/**
 * 同一件事走 B站那条分支。
 *
 * 两个分支各自独立调 buildApiErrorImage，第 5 个参数是分别写的两处 ——
 * 只驱动抖音的话，漏传 B站那一处的回归测不出来。
 */
const bilibiliErrorCard = async (
  pushContext: { groupWithBot: string[] },
  bots: Record<string, unknown> = {}
): Promise<ErrorCardPayload> => {
  installBots(bots)

  const base = new Base(undefined, {
    ...amagiDependencies,
    bilibiliErrorCodeMap: { [-352]: true },
    getBilibiliData: vi.fn().mockResolvedValue({ code: -352, message: 'B站接口炸了' })
  })
  base.pushContext = pushContext

  await expect(
    (base.amagi.getBilibiliData as () => Promise<unknown>)()
  ).rejects.toThrow('B站接口炸了')

  expect(renderMock).toHaveBeenCalledTimes(1)
  return renderMock.mock.calls[0][1] as ErrorCardPayload
}

beforeEach(() => {
  renderMock.mockReset()
  renderMock.mockResolvedValue(['image'])
  globalWithHost.logger = {
    warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), mark: vi.fn()
  }
  globalWithHost.segment = { image: vi.fn(file => ({ type: 'image', file })) }
  configMock.cookies = {}
  configMock.request = {}
})

afterEach(() => {
  globalWithHost.Bot = originalBot
})

describe('push error card target rows', () => {
  it('shows the target group a scheduled push was aiming at', async () => {
    // 定时推送没有事件对象，但目标群号在推送配置里是有的（`群号:机器人账号`）。
    // 原来这条路上整张卡片一个群号都没有，只能看出「哪个接口挂了」。
    expect(await contextRows({ pushContext: { groupWithBot: ['114514:2854196310'] } }))
      .toEqual(['群: 114514'])
  })

  it('keeps the user row absent on the push path', async () => {
    // 这是刻意的不变量：cron 触发的推送确实没有触发者，
    // 所以走的是 buildContextLogEntries(groupId, undefined) 而不是让
    // buildEventContextLogEntries 去凭空造一行。
    // 同一口径在 tests/unit/error-handler.test.ts 里由 contextRows(undefined) 钉着。
    const rows = await contextRows({ pushContext: { groupWithBot: ['114514:2854196310'] } })

    expect(rows.some(row => row.startsWith('用户'))).toBe(false)
    // 占位串也不许出现 —— 旧实现在这条路上印的是「群: private / 用户: unknown」
    expect(rows.join('\n')).not.toContain('private')
    expect(rows.join('\n')).not.toContain('unknown')
  })

  it('lists one group row per target, in config order', async () => {
    // `group_id` 是 string[]，一个订阅推多个群是合法配置（见 config/default_config
    // 里那两份 pushlist 的注释），只是线上常见形态恰好是一群一订阅。
    // 顺序照配置原样，不排序：卡片是给人对着配置文件看的。
    expect(await contextRows({
      pushContext: { groupWithBot: ['114514:2854196310', '1919810:2854196310', '456:789'] }
    })).toEqual(['群: 114514', '群: 1919810', '群: 456'])
  })

  it('still shows the group when a config line omits the :botId half', async () => {
    // 两个平台自己的解析对这种残缺配置口径不一（douyin 直接丢掉、bilibili 留成空串），
    // 错误卡片这边一律保留：群号能显示就显示，机器人账号缺了只影响适配器那一区。
    const payload = await errorCard({ pushContext: { groupWithBot: ['114514'] } })

    expect((payload.logs ?? []).map(entry => entry.message)).toEqual(['群: 114514'])
    expect(payload.adapterInfo).toBeUndefined()
  })

  it('drops an entry that has no group id at all', async () => {
    // 只写了个冒号、或整行是空白的配置项不该在卡片上留一行「群: 」
    expect(await contextRows({ pushContext: { groupWithBot: ['', ':2854196310', '   '] } }))
      .toEqual([])
  })

  it('tolerates surrounding whitespace in a config line', async () => {
    expect(await contextRows({ pushContext: { groupWithBot: [' 114514 : 2854196310 '] } }))
      .toEqual(['群: 114514'])
  })

  it('adds no context rows at all when there is neither event nor push context', async () => {
    // 回归护栏：这是改动之前的表现，也是「用户主动命令但事件为空」等场景的兜底
    expect(await contextRows()).toEqual([])
  })

  it('carries the push context through the Bilibili branch too', async () => {
    // 两条分支各自调 buildApiErrorImage，漏传其中一处的话只测抖音是发现不了的
    const payload = await bilibiliErrorCard(
      { groupWithBot: ['114514:2854196310'] },
      { 2854196310: llOneBot() }
    )

    expect((payload.logs ?? []).map(entry => entry.message)).toEqual(['群: 114514'])
    expect(payload.adapterInfo?.name).toBe('LLOneBot')
  })

  it('repeats the group rows in the plain-text fallback when rendering fails', async () => {
    // 渲染挂掉时这段文字是唯一的信息载体，不该比卡片少一行
    renderMock.mockRejectedValue(new Error('puppeteer 超时'))
    installBots({})

    const base = new Base(undefined, {
      ...amagiDependencies,
      getDouyinData: vi.fn().mockResolvedValue({ code: 500, message: '抖音接口炸了' })
    })
    base.pushContext = { groupWithBot: ['114514:2854196310', '1919810:2854196310'] }

    await expect((base.amagi.getDouyinData as () => Promise<unknown>)()).rejects.toThrow('抖音接口炸了')

    const sendMasterMsg = (globalWithHost.Bot as { sendMasterMsg: ReturnType<typeof vi.fn> }).sendMasterMsg
    const text = String((sendMasterMsg.mock.calls[0]?.[0] as unknown[])?.join('\n'))
    expect(text).toContain('群: 114514')
    expect(text).toContain('群: 1919810')
    expect(text).not.toContain('用户')
  })
})

describe('push error card adapter info', () => {
  it('resolves the adapter through globalThis.Bot[botId] when there is no event', async () => {
    // 事件里的 `event.bot` 就是 `Bot[self_id]`（宿主 lib/bot.js 用 Proxy 暴露 Bot），
    // 所以按配置里的机器人账号主动去查，getAdapterInfo 不用改就能吃同一个对象。
    const payload = await errorCard({
      pushContext: { groupWithBot: ['114514:2854196310'] },
      bots: { 2854196310: llOneBot() }
    })

    expect(payload.adapterInfo).toMatchObject({
      name: 'LLOneBot',
      version: '8.1.8',
      platform: 'QQ',
      protocol: 'llonebot',
      standard: 'onebot11',
      communication: 'webSocketServer'
    })
  })

  it('leaves the adapter section off when the configured bot is not online', async () => {
    // 配置里写着账号但 Bot[botId] 取不到是真实场景（bot 掉线、或配置里留着已删的账号），
    // sendMasterMessage 里也为它单独打过一条 warn。这时候该整区不显示，
    // 而不是印一堆 unknown 冒充「查到了」。
    const payload = await errorCard({
      pushContext: { groupWithBot: ['114514:2854196310'] },
      bots: {}
    })

    expect(payload.adapterInfo).toBeUndefined()
    // 群号那行不受影响：机器人离线不代表不知道推给谁
    expect((payload.logs ?? []).map(entry => entry.message)).toEqual(['群: 114514'])
  })

  it('skips unresolvable targets and takes the first bot that is actually up', async () => {
    const payload = await errorCard({
      pushContext: {
        groupWithBot: ['114514', '1919810:2854196310', '456:10000']
      },
      bots: { 10000: llOneBot() }
    })

    // 前两个目标一个没有 botId、一个 Bot 里查不到，都跳过
    expect(payload.adapterInfo?.name).toBe('LLOneBot')
    // 群号行不受适配器解析影响，三个目标里有群号的两个都在
    expect((payload.logs ?? []).map(entry => entry.message)).toEqual(['群: 114514', '群: 1919810', '群: 456'])
  })
})

describe('push error card leaves the event-driven path alone', () => {
  it('prefers the event over the push context when both are present', async () => {
    // 主人手敲 #测试推送 走的是 handler(e)：有真实触发者、有会话群，
    // 那两行必须按事件来，不能被订阅配置里的群号顶掉。
    const reply = vi.fn(async () => undefined)
    const payload = await errorCard({
      event: { group_id: 114514, user_id: 1919810, bot: napCatBot(), reply },
      pushContext: { groupWithBot: ['999999:2854196310'] },
      bots: { 2854196310: llOneBot() }
    })

    expect((payload.logs ?? []).map(entry => entry.message)).toEqual([
      '群: 114514',
      '用户: 1919810'
    ])
    // 订阅配置里的那个群不该出现在卡片上
    expect(JSON.stringify(payload.logs)).not.toContain('999999')
    // 适配器同理：事件自带 bot，就不该再去 Bot[botId] 里翻
    expect(payload.adapterInfo).toMatchObject({ name: 'NapCat.Onebot', protocol: 'napcat' })
    expect(payload.adapterInfo?.name).not.toBe('LLOneBot')
    // 有事件就回复到会话里，不发给主人
    expect(reply).toHaveBeenCalledTimes(1)
  })

  it('keeps a private-chat event free of a group row even with a push context set', async () => {
    const reply = vi.fn(async () => undefined)
    const payload = await errorCard({
      event: { isPrivate: true, user_id: 1919810, bot: napCatBot(), reply },
      pushContext: { groupWithBot: ['999999:2854196310'] }
    })

    expect((payload.logs ?? []).map(entry => entry.message)).toEqual(['用户: 1919810'])
  })
})
