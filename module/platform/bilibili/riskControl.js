import util from 'node:util'
import { createBoundBilibiliFetcher } from '@ikenxuan/amagi'
import { generate } from '@ikenxuan/qrcode'
import Config from '../../utils/Config.js'
import { registerErrorStrategy, sendErrorToAllMasters, sendErrorToMaster } from '../../utils/ErrorHandler/index.js'

const getVoucher = (error) => {
  return error?.data?.data?.v_voucher ||
    error?.rawError?.data?.data?.v_voucher ||
    error?.rawError?.error?.data?.data?.v_voucher ||
    error?.rawError?.error?.data?.v_voucher
}

const getFetcher = () => createBoundBilibiliFetcher(Config.cookies.bilibili, {
  timeout: Config.request?.timeout || 15000,
  headers: { 'User-Agent': Config.request?.['User-Agent'] },
  proxy: Config.request?.proxy?.switch ? {
    host: Config.request.proxy.host,
    port: Number(Config.request.proxy.port),
    protocol: Config.request.proxy.protocol,
    auth: Config.request.proxy.auth
  } : false
})

const createQrImage = (url) => {
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

const parseVerifyMessage = (msg = '') => {
  const text = String(msg).trim()
  const query = text.includes('?') ? text.slice(text.indexOf('?') + 1) : text
  const params = new URLSearchParams(query)
  return {
    validate: params.get('validate'),
    seccode: params.get('seccode')
  }
}

export const bilibiliRiskControlStrategy = {
  name: 'BilibiliRiskControl',

  match: ({ error, event }) => {
    return error?.code === -352 && Boolean(getVoucher(error)) && Boolean(event)
  },

  async handle (ctx) {
    const { error, event, options } = ctx
    const voucher = getVoucher(error)
    if (!voucher) return 'continue'

    logger.info('[BilibiliRiskControl] 检测到B站风控(-352)，开始申请验证码')
    const fetcher = getFetcher()
    const verification = await fetcher.requestCaptchaFromVoucher({
      v_voucher: voucher,
      typeMode: 'strict'
    })

    const payload = verification?.data?.data || verification?.data || verification
    const geetest = payload?.geetest
    const token = payload?.token
    if (!geetest?.gt || !geetest?.challenge || !token) {
      logger.error('[BilibiliRiskControl] 申请验证码失败:', util.inspect(verification, { depth: 2 }))
      return 'continue'
    }

    const verifyUrl = `https://karin-plugin-kkk-docs.vercel.app/geetest?v=3&gt=${geetest.gt}&challenge=${geetest.challenge}`
    const message = [
      '检测到B站风控，请在120秒内扫码完成验证后发送验证结果链接或参数。',
      createQrImage(verifyUrl),
      verifyUrl
    ]

    await event.reply?.(message)
    await sendErrorToMaster(ctx, message)
    await sendErrorToAllMasters(ctx, message)

    const plugin = options?.plugin
    if (typeof plugin?.awaitContext !== 'function') {
      await event.reply?.('当前环境无法等待验证结果，请完成验证后重新发送命令。')
      return 'handled'
    }

    const resultCtx = await plugin.awaitContext(false, 120, '验证超时，请重新发送命令')
    const { validate, seccode } = parseVerifyMessage(resultCtx?.msg)
    if (!validate || !seccode) {
      await event.reply?.('验证参数不完整，请确保包含 validate 和 seccode。')
      return 'handled'
    }

    try {
      const verifyResult = await fetcher.validateCaptchaResult({
        challenge: geetest.challenge,
        token,
        validate,
        seccode,
        typeMode: 'strict'
      })
      const resultPayload = verifyResult?.data?.data || verifyResult?.data || verifyResult
      if (verifyResult?.success || resultPayload?.grisk_id) {
        logger.info(`[BilibiliRiskControl] 验证成功，grisk_id: ${resultPayload?.grisk_id || 'unknown'}`)
        await event.reply?.('验证成功，请重新发送命令。')
        return 'handled'
      }
      await event.reply?.('验证失败，请重试。')
    } catch (verifyError) {
      logger.error('[BilibiliRiskControl] 验证请求失败:', verifyError)
      await event.reply?.(`验证失败: ${verifyError?.message || verifyError}`)
    }

    return 'handled'
  }
}

registerErrorStrategy(bilibiliRiskControlStrategy)
