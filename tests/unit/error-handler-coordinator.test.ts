import { beforeEach, describe, expect, it, vi } from 'vitest'

const emojiManagerMock = vi.hoisted(() => vi.fn())
const renderErrorReportMock = vi.hoisted(() => vi.fn(async () => 'error-report'))
const sendErrorToTriggerMock = vi.hoisted(() => vi.fn(async () => {}))
const sendErrorToMasterMock = vi.hoisted(() => vi.fn(async () => {}))
const sendErrorToAllMastersMock = vi.hoisted(() => vi.fn(async () => {}))

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
})
