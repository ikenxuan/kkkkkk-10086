import { beforeEach, describe, expect, it, vi } from 'vitest'

const axiosGet = vi.hoisted(() => vi.fn())

vi.mock('axios', () => ({
  default: { get: axiosGet }
}))

const loggerDebug = vi.fn()

globalThis.logger = {
  debug: loggerDebug,
  warn: vi.fn()
} as unknown as typeof logger

const { getXiaohongshuID } = await import('../../src/module/platform/xiaohongshu/getid.js')

/** 模拟 axios 跟随重定向后的最终地址 */
const respondWith = (responseUrl?: string): void => {
  axiosGet.mockResolvedValue(responseUrl === undefined
    ? {}
    : { request: { res: { responseUrl } } })
}

beforeEach(() => {
  axiosGet.mockReset()
  loggerDebug.mockClear()
})

describe('getXiaohongshuID', () => {
  const cases = [
    {
      name: 'an explore link with a lowercase token',
      responseUrl: 'https://www.xiaohongshu.com/explore/abc123?xsec_token=TOKEN1&xsec_source=pc',
      expected: { type: 'note', note_id: 'abc123', xsec_token: 'TOKEN1' }
    },
    {
      name: 'a discovery item link with an uppercase token',
      responseUrl: 'https://www.xiaohongshu.com/discovery/item/def456?XSEC_TOKEN=TOKEN2',
      expected: { type: 'note', note_id: 'def456', xsec_token: 'TOKEN2' }
    },
    {
      name: 'an explore link without any token',
      responseUrl: 'https://www.xiaohongshu.com/explore/ghi789',
      expected: { type: 'note', note_id: 'ghi789', xsec_token: undefined }
    },
    {
      name: 'a 404 page carrying an encoded redirectPath',
      responseUrl: 'https://www.xiaohongshu.com/404?redirectPath=https%3A%2F%2Fwww.xiaohongshu.com%2Fexplore%2Fjkl012%3Fxsec_token%3DTOKEN3',
      expected: { type: 'note', note_id: 'jkl012', xsec_token: 'TOKEN3' }
    }
  ]

  for (const { name, responseUrl, expected } of cases) {
    it(`extracts the note id from ${name}`, async () => {
      respondWith(responseUrl)

      expect(await getXiaohongshuID('https://xhslink.com/share')).toEqual(expected)
    })
  }

  it('falls back to the requested url when the response exposes no final url', async () => {
    respondWith(undefined)

    expect(await getXiaohongshuID('https://www.xiaohongshu.com/explore/mno345?xsec_token=TOKEN4')).toEqual({
      type: 'note',
      note_id: 'mno345',
      xsec_token: 'TOKEN4'
    })
  })

  it('rejects a link that carries no note id', async () => {
    respondWith('https://www.xiaohongshu.com/user/profile/abc')

    await expect(getXiaohongshuID('https://xhslink.com/share')).rejects.toThrow('无法从链接中提取小红书笔记ID')
  })

  it('logs the parsed result unless logging is disabled', async () => {
    respondWith('https://www.xiaohongshu.com/explore/pqr678')

    await getXiaohongshuID('https://xhslink.com/share')
    expect(loggerDebug).toHaveBeenCalledTimes(1)

    await getXiaohongshuID('https://xhslink.com/share', false)
    expect(loggerDebug).toHaveBeenCalledTimes(1)
  })
})
