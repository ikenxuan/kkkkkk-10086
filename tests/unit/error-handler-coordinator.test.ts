import { beforeEach, describe, expect, it, vi } from 'vitest'

const emojiManagerMock = vi.hoisted(() => vi.fn())
const renderErrorReportMock = vi.hoisted(() => vi.fn(async () => 'error-report'))
const sendErrorToTriggerMock = vi.hoisted(() => vi.fn(async () => {}))
const sendErrorToMasterMock = vi.hoisted(() => vi.fn(async () => {}))
const sendErrorToAllMastersMock = vi.hoisted(() => vi.fn(async () => {}))
const sendErrorToTriggerAsFallbackMock = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('../../src/module/utils/EmojiReaction.js', () => ({
  EmojiReactionManager: emojiManagerMock
}))

vi.mock('../../src/module/utils/ErrorHandler/render.js', () => ({
  renderErrorReport: renderErrorReportMock
}))

vi.mock('../../src/module/utils/ErrorHandler/sender.js', () => ({
  sendErrorToTrigger: sendErrorToTriggerMock,
  sendErrorToMaster: sendErrorToMasterMock,
  sendErrorToAllMasters: sendErrorToAllMastersMock,
  // 三个正式出口都没落地时，handler 会把卡片退回给触发者
  sendErrorToTriggerAsFallback: sendErrorToTriggerAsFallbackMock,
  // handler 现在先问「有没有人收得到」再决定要不要渲染错误卡片；
  // 本用例关心的是失败只处理一次并原样抛出，所以恒定有收件人。
  hasErrorReportTarget: () => true
}))

vi.mock('../../src/module/utils/ErrorHandler/strategy.js', () => ({
  getStrategies: () => []
}))

globalThis.logger = {
  error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), mark: vi.fn()
} as unknown as typeof logger

const { wrapWithErrorHandler } = await import('../../src/module/utils/ErrorHandler/handler.js')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('wrapWithErrorHandler coordinated mode', () => {
  it('handles a winner failure once, skips its own reactions, then rethrows the original error', async () => {
    const failure = new Error('amagi failed')
    const reply = vi.fn(async () => undefined)
    const event = { reply } as never
    const wrapped = wrapWithErrorHandler(
      () => { throw failure },
      {
        businessName: 'coordinated parse',
        emojiReaction: false,
        rethrowAfterHandle: true
      }
    )

    await expect(wrapped(event)).rejects.toBe(failure)

    expect(emojiManagerMock).not.toHaveBeenCalled()
    expect(renderErrorReportMock).toHaveBeenCalledTimes(1)
    expect(sendErrorToTriggerMock).toHaveBeenCalledTimes(1)
    expect(reply).toHaveBeenCalledWith('处理失败：amagi failed')
  })

  it('三个正式出口都没落地时，把卡片退回给触发者', async () => {
    // 真机常态：errorLogSendTo 默认只有 master，而主人表按 Bot 取 —— QQBot 常常没登记，
    // 卡片渲好了却谁也收不到。兜底之前用户只剩一行「处理失败」。
    sendErrorToTriggerAsFallbackMock.mockResolvedValueOnce(true as never)
    const reply = vi.fn(async () => undefined)
    const wrapped = wrapWithErrorHandler(
      () => { throw new Error('amagi failed') },
      { businessName: 'coordinated parse', emojiReaction: false }
    )

    await wrapped({ reply } as never)

    expect(sendErrorToTriggerAsFallbackMock).toHaveBeenCalledTimes(1)
    // 兜底把卡片发出去了就不该再补那行文字，否则同一个错误在会话里出现两次
    expect(reply).not.toHaveBeenCalledWith('处理失败：amagi failed')
  })

  it('已经有人收到卡片时不走兜底', async () => {
    sendErrorToMasterMock.mockResolvedValueOnce(true as never)
    const wrapped = wrapWithErrorHandler(
      () => { throw new Error('amagi failed') },
      { businessName: 'coordinated parse', emojiReaction: false }
    )

    await wrapped({ reply: vi.fn(async () => undefined) } as never)

    expect(sendErrorToTriggerAsFallbackMock).not.toHaveBeenCalled()
  })
})
