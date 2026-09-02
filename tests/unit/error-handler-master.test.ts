import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 主人号必须按 Bot 取。
 *
 * 这组用例钉住一个真实故障：TRSS 的 `cfg.master` 是 `{ "botUin": ["masterId"] }`（宿主
 * `lib/config/config.js` 的 `get master()` 内部 `const masters = {}`），而我们曾把它的类型
 * 声明成扁平数组，于是 `Array.isArray(cfg.master)` 恒为假、那个分支成了死代码，一路退化
 * 去读不带 Bot 归属的 `cfg.masterQQ`。
 *
 * 后果是把 ICQQ 的 QQ 号配到 QQBot 的 self_id 上 —— QQBot 的 user_id 是 openid，
 * `POST /v2/users/<QQ号>/messages` 返回 11255「请求的资源不存在(用户/群已注销)」。
 * 而在那之前错误卡片已经渲染好、并被适配器走 markdown 上传过一次图床了。
 */

/** ICQQ Bot，登记在 master 表里 */
const BOT_REGISTERED = '1000000001'
/** 另一个登记过的 Bot，用来证明 master 表是按 Bot 分表的 */
const BOT_REGISTERED_2 = '1000000002'
/** 主人号 */
const MASTER_ID = '2000000001'
/** QQBot，故意不登记在 master 表里 —— 老 bug 就是给它配了 MASTER_ID */
const BOT_UNREGISTERED = '3000000001'

const cfgMock = vi.hoisted(() => ({ masterQQ: [] as unknown[], master: {} as unknown }))
const appConfigMock = vi.hoisted(() => ({ app: { errorLogSendTo: [] as string[] } }))

vi.mock('../../src/runtime/host/config.js', () => ({ default: cfgMock }))
vi.mock('../../src/module/utils/Config.js', () => ({ default: appConfigMock }))

const { hasErrorReportTarget } = await import('../../src/module/utils/ErrorHandler/sender.js')

/** 造一个带 self_id 的最小事件；`ctx.event` 只需要被 getBotId 认出来 */
const ctxWith = (selfId?: string, reply?: () => Promise<void>) => ({
  error: new Error('boom'),
  options: {},
  logs: [],
  event: selfId === undefined && !reply ? undefined : { self_id: selfId, reply }
}) as unknown as Parameters<typeof hasErrorReportTarget>[0]

beforeEach(() => {
  // TRSS 的真实形状：对象而不是数组，键是 Bot 自己的 uin。
  // 关键是 BOT_UNREGISTERED 不在这张表里 —— 它就是当初报 11255 的那个 QQBot。
  cfgMock.master = {
    [BOT_REGISTERED]: [MASTER_ID],
    [BOT_REGISTERED_2]: [MASTER_ID],
    stdin: ['stdin']
  }
  cfgMock.masterQQ = [MASTER_ID, 'stdin']
  appConfigMock.app.errorLogSendTo = ['master']
})

describe('hasErrorReportTarget', () => {
  it('登记过主人的 Bot 有收件人', () => {
    expect(hasErrorReportTarget(ctxWith(BOT_REGISTERED))).toBe(true)
  })

  it('没登记主人、又回不了话的 Bot 没有收件人 —— 不能退化去读 masterQQ', () => {
    // 退化读 masterQQ 会拿到 ICQQ 那个主人号配给 QQBot，最终 11255
    expect(hasErrorReportTarget(ctxWith(BOT_UNREGISTERED))).toBe(false)
  })

  it('没登记主人但事件回得了话时算有收件人 —— 兜底会把卡片退回触发者', () => {
    // 真机常态：QQBot 的 self_id 不在宿主主人表里，而消息事件一定带 reply。
    // 原来这里返回 false，于是卡片压根不渲，用户只剩一行「处理失败：...」。
    expect(hasErrorReportTarget(ctxWith(BOT_UNREGISTERED, async () => {}))).toBe(true)
  })

  it('errorLogSendTo 为空时没有收件人', () => {
    appConfigMock.app.errorLogSendTo = []
    expect(hasErrorReportTarget(ctxWith(BOT_REGISTERED))).toBe(false)
  })

  it('只配了 trigger 时，有 reply 的事件就算有收件人', () => {
    appConfigMock.app.errorLogSendTo = ['trigger']
    expect(hasErrorReportTarget(ctxWith(BOT_UNREGISTERED, async () => {}))).toBe(true)
  })

  it('只配了 trigger 但事件没有 reply 时没有收件人', () => {
    appConfigMock.app.errorLogSendTo = ['trigger']
    expect(hasErrorReportTarget(ctxWith(BOT_UNREGISTERED))).toBe(false)
  })

  it('定时推送没有事件（拿不到 botId）时没有收件人', () => {
    // 这条是老 bug 的另一半：定时任务 ctx.event 为 undefined，
    // 原来会静默 return 而不留任何日志
    expect(hasErrorReportTarget(ctxWith(undefined))).toBe(false)
  })

  it('只有 masterQQ 的宿主（Miao-Yunzai）行为不变', () => {
    // master 为空对象时退回 masterQQ —— 那种宿主本来就没有按 Bot 分表
    cfgMock.master = {}
    expect(hasErrorReportTarget(ctxWith(BOT_REGISTERED))).toBe(true)
  })

  it('master 真是数组时也能用（防御宿主实现变化）', () => {
    cfgMock.master = [MASTER_ID]
    cfgMock.masterQQ = []
    expect(hasErrorReportTarget(ctxWith(BOT_REGISTERED))).toBe(true)
  })
})
