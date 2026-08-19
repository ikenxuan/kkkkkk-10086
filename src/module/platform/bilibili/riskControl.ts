import util from 'node:util'
import { generate } from '@ikenxuan/qrcode'
import { registerErrorStrategy, sendErrorToAllMasters, sendErrorToMaster } from '@/module/utils/ErrorHandler/index'
import type { ErrorHandlerContext, ErrorStrategy, ErrorStrategyResult } from '@/module/utils/ErrorHandler/strategy'
import { getBilibiliData } from './api.js'

/** 判断是否为普通对象 */
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 按路径读取嵌套字段，任意一层缺失时返回 undefined */
const readPath = (value: unknown, path: string[]): unknown => {
  let current = value
  for (const key of path) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }
  return current
}

/** 读取指定路径上的非空字符串 */
const readString = (value: unknown, path: string[]): string | undefined => {
  const found = readPath(value, path)
  return typeof found === 'string' && found ? found : undefined
}

const getVoucher = (error: unknown): string | undefined => {
  return readString(error, ['data', 'data', 'v_voucher']) ||
    readString(error, ['rawError', 'data', 'data', 'v_voucher']) ||
    readString(error, ['rawError', 'error', 'data', 'data', 'v_voucher']) ||
    readString(error, ['rawError', 'error', 'data', 'v_voucher'])
}

/** amagi 返回结构不固定，逐层向下取 data 作为业务数据 */
const pickPayload = (value: unknown): Record<string, unknown> | undefined => {
  const nested = readPath(value, ['data', 'data'])
  if (isRecord(nested)) return nested
  const data = readPath(value, ['data'])
  if (isRecord(data)) return data
  return isRecord(value) ? value : undefined
}

const createQrImage = (url: string): unknown => {
  const base64 = generate({
    data: url,
    size: 800,
    dotsOptions: { dotType: 'rounded', color: 'rgba(0, 0, 0, 0.85)' },
    cornersSquareOptions: { cornerType: 'extra-rounded', color: 'rgba(0, 0, 0, 0.85)' },
    cornersDotOptions: { cornerType: 'dot', color: 'rgba(0, 0, 0, 0.85)' },
    backgroundOptions: { transparent: false, color: '#ffffff' }
  }, 'webp', 'base64')
  return globalThis.segment?.image ? globalThis.segment.image(`base64://${base64}`) : `base64://${base64}`
}

const parseVerifyMessage = (msg: unknown = ''): { validate: string | null, seccode: string | null } => {
  const text = String(msg).trim()
  const query = text.includes('?') ? text.slice(text.indexOf('?') + 1) : text
  const params = new URLSearchParams(query)
  return {
    validate: params.get('validate'),
    seccode: params.get('seccode')
  }
}

export const bilibiliRiskControlStrategy: ErrorStrategy = {
  name: 'BilibiliRiskControl',

  match: ({ error, event }: ErrorHandlerContext): boolean => {
    return isRecord(error) && error.code === -352 && Boolean(getVoucher(error)) && Boolean(event)
  },

  async handle (ctx: ErrorHandlerContext): Promise<ErrorStrategyResult> {
    const { error, event, options } = ctx
    const voucher = getVoucher(error)
    if (!voucher) return 'continue'

    logger.info('[BilibiliRiskControl] 检测到B站风控(-352)，开始申请验证码')
    const verification = await getBilibiliData('从_v_voucher_申请_captcha', {
      v_voucher: voucher,
      typeMode: 'strict'
    })

    const payload = pickPayload(verification)
    const geetest = isRecord(payload?.geetest) ? payload.geetest : undefined
    const gt = typeof geetest?.gt === 'string' ? geetest.gt : undefined
    const challenge = typeof geetest?.challenge === 'string' ? geetest.challenge : undefined
    const token = typeof payload?.token === 'string' ? payload.token : undefined
    if (!gt || !challenge || !token) {
      logger.error('[BilibiliRiskControl] 申请验证码失败:', util.inspect(verification, { depth: 2 }))
      return 'continue'
    }

    const verifyUrl = `https://karin-plugin-kkk-docs.vercel.app/geetest?v=3&gt=${gt}&challenge=${challenge}`
    const message = [
      '检测到B站风控，请在120秒内扫码完成验证后发送验证结果链接或参数。',
      createQrImage(verifyUrl),
      verifyUrl
    ]

    await event?.reply?.(message)
    await sendErrorToMaster(ctx, message)
    await sendErrorToAllMasters(ctx, message)

    const plugin = options?.plugin
    if (typeof plugin?.awaitContext !== 'function') {
      await event?.reply?.('当前环境无法等待验证结果，请完成验证后重新发送命令。')
      return 'handled'
    }

    const resultCtx = await plugin.awaitContext(false, 120, '验证超时，请重新发送命令')
    const { validate, seccode } = parseVerifyMessage(readPath(resultCtx, ['msg']))
    if (!validate || !seccode) {
      await event?.reply?.('验证参数不完整，请确保包含 validate 和 seccode。')
      return 'handled'
    }

    try {
      const verifyResult = await getBilibiliData('验证验证码结果', {
        challenge,
        token,
        validate,
        seccode,
        typeMode: 'strict'
      })
      const resultPayload = pickPayload(verifyResult)
      const griskId = resultPayload?.grisk_id
      if ((isRecord(verifyResult) && verifyResult.success) || griskId) {
        logger.info(`[BilibiliRiskControl] 验证成功，grisk_id: ${String(griskId || 'unknown')}`)
        await event?.reply?.('验证成功，请重新发送命令。')
        return 'handled'
      }
      await event?.reply?.('验证失败，请重试。')
    } catch (verifyError) {
      logger.error('[BilibiliRiskControl] 验证请求失败:', verifyError)
      await event?.reply?.(`验证失败: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`)
    }

    return 'handled'
  }
}

registerErrorStrategy(bilibiliRiskControlStrategy)
