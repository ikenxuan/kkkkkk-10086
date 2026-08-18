import { beforeEach, describe, expect, it, vi } from 'vitest'

const getBilibiliData = vi.hoisted(() => vi.fn())
const registerErrorStrategy = vi.hoisted(() => vi.fn())
const sendErrorToMaster = vi.hoisted(() => vi.fn(async () => undefined))
const sendErrorToAllMasters = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('../../src/module/platform/bilibili/api.js', () => ({
  getBilibiliData
}))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: {
    cookies: { bilibili: 'configured-cookie' },
    request: {}
  }
}))

vi.mock('../../src/module/utils/ErrorHandler/index.js', () => ({
  registerErrorStrategy,
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
  it('requests a captcha through getBilibiliData', async () => {
    getBilibiliData.mockResolvedValue({})

    await expect(bilibiliRiskControlStrategy.handle(createContext() as never)).resolves.toBe('continue')

    expect(getBilibiliData).toHaveBeenCalledWith('从_v_voucher_申请_captcha', {
      v_voucher: 'voucher-1',
      typeMode: 'strict'
    })
  })

  it('validates a captcha through getBilibiliData', async () => {
    getBilibiliData
      .mockResolvedValueOnce({
        data: {
          data: {
            geetest: { gt: 'gt-1', challenge: 'challenge-1' },
            token: 'token-1'
          }
        }
      })
      .mockResolvedValueOnce({ success: true })
    const awaitContext = vi.fn(async () => ({
      msg: 'https://example.test/callback?validate=validate-1&seccode=seccode-1'
    }))

    await expect(bilibiliRiskControlStrategy.handle(createContext({
      options: {
        businessName: 'Bilibili request',
        plugin: { awaitContext }
      }
    }) as never)).resolves.toBe('handled')

    expect(getBilibiliData).toHaveBeenNthCalledWith(2, '验证验证码结果', {
      challenge: 'challenge-1',
      token: 'token-1',
      validate: 'validate-1',
      seccode: 'seccode-1',
      typeMode: 'strict'
    })
  })
})
