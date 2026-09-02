import { describe, expect, it, vi } from 'vitest'

/**
 * `getHeaders` 的探测预算。
 *
 * 这里只验构造函数的取值，不发请求：`headersTimeout` 原来是 `getHeaders` 里写死的
 * `timeout: 3000`，而且它排在 `...config` 之后，把 `getConfig()` 已经设好的
 * `this.timeout` 盖掉 —— 调用方传什么都无效。
 */
vi.mock('../../src/module/utils/Config.js', () => ({ default: { request: {} } }))

const { Networks } = await import('../../src/module/utils/Network/client.js')

describe('Networks 的探测预算', () => {
  it('maxRetries: 0 不再被兜底成 3', () => {
    // `data.maxRetries || 3` 会把「一次就够，别重试」静默变成 3 次重试
    expect(new Networks({ url: 'https://example.com/a', maxRetries: 0 }).maxRetries).toBe(0)
  })

  it('不传时保持原来的 3 次重试与 3 秒探测', () => {
    const networks = new Networks({ url: 'https://example.com/a' })

    // 四个探体积的调用点（probeVideoSize、快手与 B站 的 getvideosize）吃的就是这个默认值
    expect(networks.maxRetries).toBe(3)
    expect(networks.headersTimeout).toBe(3000)
  })

  it('headersTimeout 与 timeout 各走各的', () => {
    const networks = new Networks({ url: 'https://example.com/a', timeout: 30000, headersTimeout: 8000 })

    expect(networks.timeout).toBe(30000)
    expect(networks.headersTimeout).toBe(8000)
  })
})
