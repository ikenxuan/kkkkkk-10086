import { beforeEach, describe, expect, it, vi } from 'vitest'

const getLongLink = vi.hoisted(() => vi.fn())

vi.mock('../../src/module/utils/Network/index.js', () => ({
  Networks: class {
    getLongLink = getLongLink
  },
  baseHeaders: {}
}))

const loggerWarn = vi.fn()
const loggerDebug = vi.fn()

globalThis.logger = {
  warn: loggerWarn,
  debug: loggerDebug
} as unknown as typeof logger

const { default: GetKuaishouID } = await import('../../src/module/platform/kuaishou/getid.js')

beforeEach(() => {
  getLongLink.mockReset()
  loggerWarn.mockClear()
  loggerDebug.mockClear()
})

describe('GetKuaishouID', () => {
  const cases = [
    {
      name: 'a short-video link with a query string',
      longLink: 'https://www.kuaishou.com/short-video/3xabc123?authorId=1&streamSource=find',
      expected: { type: 'one_work', id: '3xabc123', photoId: '3xabc123', P: '快手' }
    },
    {
      name: 'a short-video link without a query string',
      longLink: 'https://www.kuaishou.com/short-video/3xdef456',
      expected: { type: 'one_work', id: '3xdef456', photoId: '3xdef456', P: '快手' }
    },
    {
      name: 'a resolved share link carrying photoId',
      longLink: 'https://www.kuaishou.com/fw/photo/abc?photoId=3xghi789&fid=1',
      expected: { type: 'one_work', id: '3xghi789', photoId: '3xghi789', P: '快手' }
    },
    {
      name: 'a photoId parameter placed last',
      longLink: 'https://www.kuaishou.com/fw/photo/abc?fid=1&photoId=3xjkl012',
      expected: { type: 'one_work', id: '3xjkl012', photoId: '3xjkl012', P: '快手' }
    }
  ]

  for (const { name, longLink, expected } of cases) {
    it(`extracts the work id from ${name}`, async () => {
      getLongLink.mockResolvedValue(longLink)

      expect(await GetKuaishouID('https://v.kuaishou.com/share')).toEqual(expected)
      expect(loggerWarn).not.toHaveBeenCalled()
    })
  }

  it('prefers the photoId parameter over the short-video path', async () => {
    getLongLink.mockResolvedValue('https://www.kuaishou.com/short-video/pathId?photoId=queryId')

    expect(await GetKuaishouID('https://v.kuaishou.com/share')).toMatchObject({ id: 'queryId' })
  })

  it('returns undefined and warns for a link without any work id', async () => {
    getLongLink.mockResolvedValue('https://example.com/not-kuaishou')

    expect(await GetKuaishouID('https://v.kuaishou.com/share')).toBeUndefined()
    expect(loggerWarn).toHaveBeenCalledWith('无法获取作品ID')
  })

  it('reports an empty photoId parameter as a work without an id', async () => {
    getLongLink.mockResolvedValue('https://www.kuaishou.com/fw/photo/abc?photoId=&fid=1')

    expect(await GetKuaishouID('https://v.kuaishou.com/share')).toEqual({
      type: 'one_work',
      id: undefined,
      photoId: undefined,
      P: '快手'
    })
    expect(loggerWarn).not.toHaveBeenCalled()
  })
})
