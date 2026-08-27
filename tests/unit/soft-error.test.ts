import { describe, expect, it, vi } from 'vitest'

import {
  AmagiError,
  SOFT_ERROR_CODES,
  isSoftFailure,
  readAmagiFailureCode,
  softFetch
} from '../../src/module/platform/common/softError.js'
import { RequestTimeoutError } from '../../src/module/utils/RequestGuard.js'

/** amagi 抛出来的失败对象形状：`Object.assign(new Error(...), { code, data, amagiError })` */
const amagiThrown = (code: number) => Object.assign(new Error('获取响应数据失败！'), {
  code,
  data: { code, message: 'UP主已关闭评论区', data: null },
  amagiError: { errorDescription: '获取响应数据失败！', requestType: 'comments' }
})

/** amagi 返回的失败 Result：`createErrorResponse(amagiError, message, rawData.code, rawData)` */
const amagiFailureResult = (code: number) => ({
  success: false as const,
  error: { errorDescription: '获取响应数据失败！' },
  message: 'B站数据获取失败',
  code,
  data: { code, message: 'UP主已关闭评论区', data: null }
})

describe('SOFT_ERROR_CODES', () => {
  it('only whitelists the two provable bilibili comment-refusal codes', () => {
    expect(SOFT_ERROR_CODES.bilibili).toEqual([12061, 12002])
  })

  it('keeps the other three platforms empty because amagi drops their business codes', () => {
    // amagi 6.5.0 的抖音 / 快手 / 小红书失败 Result 的 code 恒为 500
    // （dist/default/index.cjs:4169 / :6860 / :7246 都没传 code 参数），
    // 500 不携带业务语义，放进白名单等于把所有失败都当正常拒绝。
    expect(SOFT_ERROR_CODES.douyin).toEqual([])
    expect(SOFT_ERROR_CODES.kuaishou).toEqual([])
    expect(SOFT_ERROR_CODES.xiaohongshu).toEqual([])
  })

  it('never whitelists the generic amagi failure code 500', () => {
    for (const codes of Object.values(SOFT_ERROR_CODES)) {
      expect(codes).not.toContain(500)
    }
  })
})

describe('readAmagiFailureCode', () => {
  it('reads the top level code first', () => {
    expect(readAmagiFailureCode(amagiFailureResult(12061))).toBe(12061)
  })

  it('falls back to error.code then rawError.code', () => {
    expect(readAmagiFailureCode({ error: { code: -352 } })).toBe(-352)
    expect(readAmagiFailureCode({ rawError: { code: -111 } })).toBe(-111)
  })

  it('normalizes the string literal codes from amagi enums', () => {
    expect(readAmagiFailureCode({ code: '-111' })).toBe(-111)
  })

  it('returns undefined for a non-numeric code', () => {
    expect(readAmagiFailureCode({ code: 'INVALID_COOKIE' })).toBeUndefined()
    expect(readAmagiFailureCode(new RequestTimeoutError(10))).toBeUndefined()
    expect(readAmagiFailureCode(undefined)).toBeUndefined()
    expect(readAmagiFailureCode('boom')).toBeUndefined()
  })
})

describe('softFetch', () => {
  it('returns the value untouched on success', async () => {
    const fn = vi.fn().mockResolvedValue({ success: true, data: { ok: true } })

    expect(await softFetch(fn, SOFT_ERROR_CODES.bilibili)).toEqual({ success: true, data: { ok: true } })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('turns a whitelisted thrown code into a Result instead of throwing', async () => {
    const result = await softFetch(async () => { throw amagiThrown(12061) }, SOFT_ERROR_CODES.bilibili)

    expect(result).toMatchObject({
      success: false,
      code: 12061,
      soft: true,
      data: { code: 12061 }
    })
  })

  it('softens 12002 as well', async () => {
    const result = await softFetch(async () => { throw amagiThrown(12002) }, SOFT_ERROR_CODES.bilibili)

    expect(result).toMatchObject({ success: false, code: 12002, soft: true })
  })

  it('rethrows a code that is not whitelisted', async () => {
    const error = amagiThrown(12009)

    await expect(softFetch(async () => { throw error }, SOFT_ERROR_CODES.bilibili)).rejects.toBe(error)
  })

  it('rethrows an AmagiError whose code is not whitelisted, unchanged', async () => {
    const error = new AmagiError(-352, '风控校验失败', { v_voucher: 'v' }, { errorDescription: '风控' })

    await expect(softFetch(async () => { throw error }, SOFT_ERROR_CODES.bilibili)).rejects.toBe(error)
  })

  it('softens an AmagiError whose code is whitelisted', async () => {
    const error = new AmagiError(12061, 'UP主已关闭评论区', { replies: null }, { errorDescription: '关了' })

    const result = await softFetch(async () => { throw error }, SOFT_ERROR_CODES.bilibili)

    expect(result).toMatchObject({
      success: false,
      code: 12061,
      message: 'UP主已关闭评论区',
      data: { replies: null },
      soft: true
    })
  })

  it('never swallows a RequestGuard timeout, so its identity survives for the retry logic', async () => {
    const timeout = new RequestTimeoutError(10)

    await expect(softFetch(async () => { throw timeout }, SOFT_ERROR_CODES.bilibili)).rejects.toBe(timeout)
  })

  it('never softens anything when the whitelist is empty', async () => {
    const error = amagiThrown(12061)

    await expect(softFetch(async () => { throw error }, SOFT_ERROR_CODES.kuaishou)).rejects.toBe(error)
  })
})

describe('isSoftFailure', () => {
  it('recognizes a whitelisted failure Result that amagi returned rather than threw', async () => {
    // amagi 表达业务拒绝的主要方式是**返回**失败 Result，softFetch 只软化抛出来的那一半，
    // 剩下这一半由调用点用这个判据识别
    expect(isSoftFailure(amagiFailureResult(12061), SOFT_ERROR_CODES.bilibili)).toBe(true)
    expect(isSoftFailure(amagiFailureResult(12002), SOFT_ERROR_CODES.bilibili)).toBe(true)
  })

  it('rejects a failure whose code is not whitelisted', () => {
    expect(isSoftFailure(amagiFailureResult(-352), SOFT_ERROR_CODES.bilibili)).toBe(false)
    expect(isSoftFailure(amagiFailureResult(500), SOFT_ERROR_CODES.bilibili)).toBe(false)
  })

  it('rejects a successful Result even when its data carries a whitelisted code', () => {
    expect(isSoftFailure({ success: true, code: 200, data: { code: 12061 } }, SOFT_ERROR_CODES.bilibili)).toBe(false)
  })

  it('rejects non-Result values', () => {
    expect(isSoftFailure(undefined, SOFT_ERROR_CODES.bilibili)).toBe(false)
    expect(isSoftFailure({ code: 12061 }, SOFT_ERROR_CODES.bilibili)).toBe(false)
  })

  it('recognizes the SoftFailureResult that softFetch produces', async () => {
    const result = await softFetch(async () => { throw amagiThrown(12061) }, SOFT_ERROR_CODES.bilibili)

    expect(isSoftFailure(result, SOFT_ERROR_CODES.bilibili)).toBe(true)
  })
})
