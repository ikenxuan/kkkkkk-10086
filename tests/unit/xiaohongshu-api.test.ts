import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const configMock = vi.hoisted(() => ({
  request: {} as Record<string, unknown>,
  cookies: {} as Record<string, unknown>
}))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: configMock
}))

const fetchNoteDetail = vi.fn()
const dependencies = {
  methodMap: {
    单个笔记数据: 'fetchNoteDetail'
  },
  fetcher: {
    fetchNoteDetail
  }
}

beforeEach(() => {
  configMock.request = {}
  configMock.cookies = {}
  fetchNoteDetail.mockReset()
  fetchNoteDetail.mockResolvedValue({ success: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getXiaohongshuData guarded Amagi wrapper', () => {
  it('routes a mapped method with the configured cookie and an abort-aware request config', async () => {
    const { getXiaohongshuData } = await import('../../src/module/platform/xiaohongshu/api.js')
    configMock.cookies.xiaohongshu = 'xhs-cookie'
    configMock.request = { timeout: 5000, 'User-Agent': 'kkk-agent' }

    const result = await getXiaohongshuData(
      '单个笔记数据',
      { typeMode: 'strict', note_id: 'note-1' },
      undefined,
      dependencies
    )

    expect(result).toEqual({ success: true })
    const [options, cookie, requestConfig] = fetchNoteDetail.mock.calls[0] as [
      unknown,
      unknown,
      { timeout: number, headers: Record<string, string>, proxy: unknown, signal?: AbortSignal }
    ]
    expect(options).toEqual({ typeMode: 'strict', note_id: 'note-1' })
    expect(cookie).toBe('xhs-cookie')
    expect(requestConfig.timeout).toBe(5000)
    expect(requestConfig.headers['User-Agent']).toBe('kkk-agent')
    expect(requestConfig.proxy).toBe(false)
    expect(requestConfig.signal).toBeInstanceOf(AbortSignal)
  })

  it('retries a transient network failure with a fresh signal', async () => {
    const { getXiaohongshuData } = await import('../../src/module/platform/xiaohongshu/api.js')
    vi.useFakeTimers()
    configMock.request = { amagiTimeout: 60_000, amagiMaxRetries: 1 }
    const attemptSignals: Array<AbortSignal | undefined> = []
    fetchNoteDetail
      .mockImplementationOnce((
        _options: unknown,
        _cookie: unknown,
        requestConfig: { signal?: AbortSignal }
      ) => {
        attemptSignals.push(requestConfig.signal)
        return Promise.reject(Object.assign(new Error('temporary network failure'), { code: 'ECONNRESET' }))
      })
      .mockImplementationOnce((
        _options: unknown,
        _cookie: unknown,
        requestConfig: { signal?: AbortSignal }
      ) => {
        attemptSignals.push(requestConfig.signal)
        return Promise.resolve({ recovered: true })
      })

    const request = getXiaohongshuData('单个笔记数据', { note_id: 'note-1' }, undefined, dependencies)
    const assertion = expect(request).resolves.toEqual({ recovered: true })

    await vi.advanceTimersByTimeAsync(250)
    await assertion

    expect(fetchNoteDetail).toHaveBeenCalledTimes(2)
    expect(attemptSignals).toHaveLength(2)
    expect(attemptSignals.every(signal => signal instanceof AbortSignal)).toBe(true)
    expect(attemptSignals[0]).not.toBe(attemptSignals[1])
  })

  it('stops a stuck Amagi attempt after at most one minute', async () => {
    const { getXiaohongshuData } = await import('../../src/module/platform/xiaohongshu/api.js')
    vi.useFakeTimers()
    configMock.request = { amagiTimeout: 60_001, amagiMaxRetries: 0 }
    fetchNoteDetail.mockImplementation((
      _options: unknown,
      _cookie: unknown,
      requestConfig: { signal?: AbortSignal }
    ) => new Promise((_resolve, reject) => {
      requestConfig.signal?.addEventListener('abort', () => reject(requestConfig.signal?.reason), { once: true })
    }))

    const request = getXiaohongshuData('单个笔记数据', { note_id: 'note-1' }, undefined, dependencies)
    const assertion = expect(request).rejects.toMatchObject({
      name: 'RequestTimeoutError',
      code: 'ERR_REQUEST_TIMEOUT',
      timeoutMs: 60_000
    })

    await vi.advanceTimersByTimeAsync(60_000)
    await assertion
  })
})
