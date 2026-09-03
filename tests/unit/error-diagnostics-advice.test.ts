import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/module/utils/Version.js', () => ({
  default: { pluginPath: 'E:/Yunzai/plugins/kkkkkk-10086' }
}))

const { collectApiDiagnostics } = await import('../../src/module/utils/ErrorHandler/diagnostics.js')

/** 取出卡片上那一行「建议」，没有这一行时返回空串 */
const adviceOf = (platform: string, error: unknown): string =>
  collectApiDiagnostics(platform, undefined, error).find(item => item.label === '建议')?.value ?? ''

/**
 * 照抄一条真实的 -352（推送路径 userCard 撞风控），只保留代码会读的键。
 * `data.data` 里只有 `{code, message, ttl}` —— 没有 v_voucher 才是实测的常态形态。
 */
const voucherlessRiskControl = {
  code: -352,
  data: {
    code: -352,
    data: { code: -352, message: '-352', ttl: 1 }
  },
  rawError: {
    errorDescription: '获取响应数据失败，原因：风控校验失败 (UA 或 wbi 参数不合法)，',
    requestType: 'userCard',
    requestUrl: 'https://api.bilibili.com/x/web-interface/card?mid=214391420&photo=true',
    responseCode: -352
  }
}

describe('collectApiDiagnostics 的「建议」一行', () => {
  /*
    这条是本次修的缺口：THROTTLED_CODES 只列了 -412 / -509 / -799，
    没有 voucher 的 -352 落不到任何分支，主人收到的卡片除了「B站数据获取失败」
    什么都没有 —— 而它的处境和 -412 一模一样。
  */
  it('没有 voucher 的 -352 给出「没有验证码可过」的建议', () => {
    const advice = adviceOf('bilibili', voucherlessRiskControl)

    expect(advice).toContain('没有验证码可过')
    // 实测的头号原因是 UA 粘错（把 header 名一起粘进了值里），所以这句必须先点它
    expect(advice).toContain('User-Agent')
  })

  /*
    带 voucher 的那半必须保持沉默：riskControl 策略会接手发二维码，
    这时候卡片再教用户「等一会儿」就是两条互相打脸的消息。
  */
  it('带 voucher 的 -352 不给建议，让 riskControl 去发二维码', () => {
    const withVoucher = {
      ...voucherlessRiskControl,
      data: { code: -352, data: { code: -352, v_voucher: 'voucher_abc123' } }
    }

    expect(adviceOf('bilibili', withVoucher)).toBe('')
  })

  // voucher 可能嵌在 rawError 那一侧，判据是 readRiskVoucher 撒的那张网，不是单条路径
  it('voucher 在 rawError 一侧时同样算「有出路」', () => {
    const withVoucher = {
      code: -352,
      rawError: { responseCode: -352, data: { data: { v_voucher: 'voucher_xyz' } } }
    }

    expect(adviceOf('bilibili', withVoucher)).toBe('')
  })

  it('-412 那句建议不受影响', () => {
    const advice = adviceOf('bilibili', { code: -412, rawError: { responseCode: -412 } })

    expect(advice).toContain('当前出口 IP 被服务端风控')
  })

  // -352 的判据带平台：别让别的平台的同号业务码借到 B站 的话术
  it('非 B站 平台的 -352 不给这句建议', () => {
    expect(adviceOf('douyin', { code: -352 })).toBe('')
  })

  it('抖音被折叠成 500 且没有结构化字段时给的还是原来那句', () => {
    const advice = adviceOf('douyin', { code: 500 })

    expect(advice).toContain('接口没有返回可用原因')
  })

  it('认不出来的失败不硬凑一句建议', () => {
    expect(adviceOf('bilibili', { code: -404, rawError: { responseCode: -404 } })).toBe('')
  })

  // 建议之外的几行是这张卡的定位信息，顺手钉住，免得改建议时把它们挤掉
  it('业务码 / 请求类型 / 接口地址照旧渲染', () => {
    const rows = collectApiDiagnostics('bilibili', 'userCard', voucherlessRiskControl)
    const value = (label: string): string => rows.find(item => item.label === label)?.value ?? ''

    expect(value('平台')).toBe('bilibili')
    expect(value('接口')).toBe('userCard')
    expect(value('业务码')).toBe('-352')
    expect(value('请求类型')).toBe('userCard')
    expect(value('接口地址')).toContain('api.bilibili.com/x/web-interface/card')
  })
})
