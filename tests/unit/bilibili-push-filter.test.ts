import { beforeEach, describe, expect, it, vi } from 'vitest'

const shouldFilterMock = vi.hoisted(() => vi.fn())

vi.mock('../../src/module/utils/index.js', () => ({
  Base: class {
    e: unknown
    headers: Record<string, string> = {}
  },
  baseHeaders: {},
  Networks: class {},
  Render: vi.fn(),
  Config: { cookies: {}, bilibili: {}, pushlist: {}, app: {}, upload: {} },
  Common: { tempDri: { images: '', video: '' }, useDarkTheme: () => false },
  downloadFile: vi.fn(),
  mergeFile: vi.fn(),
  uploadFile: vi.fn(),
  processImageUrl: vi.fn(),
  Version: { BotName: 'TRSS-Yunzai', version: 'test', pluginName: 'kkkkkk-10086' }
}))

vi.mock('../../src/module/db/index.js', () => ({
  cleanOldDynamicCache: vi.fn(),
  bilibiliDB: { shouldFilter: shouldFilterMock }
}))

vi.mock('../../src/module/platform/bilibili/bilibili.js', () => ({
  bilibiliProcessVideos: vi.fn(),
  cover: vi.fn(),
  generateDecorationCard: vi.fn(),
  getBilibiliDash: vi.fn(),
  getBilibiliPayload: vi.fn(),
  getvideosize: vi.fn(),
  replacetext: vi.fn(),
  dedupeBilibiliVideoStreams: vi.fn()
}))

vi.mock('../../src/module/platform/bilibili/article.js', () => ({
  formatBilibiliArticleBody: vi.fn()
}))

vi.mock('../../src/module/platform/bilibili/api.js', () => ({
  getBilibiliData: vi.fn()
}))

vi.mock('../../src/module/platform/common/livePhoto.js', () => ({
  buildLivePhotoMessages: vi.fn(),
  buildLivePhotoTipMessage: vi.fn()
}))

vi.mock('../../src/runtime/host/common.js', () => ({
  default: { makeForwardMsg: vi.fn() }
}))

globalThis.logger = {
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  mark: vi.fn()
} as unknown as typeof logger

const {
  normalizeBilibiliPushTypes,
  extractEmojisData,
  skipDynamic,
  Bilibilipush
} = await import('../../src/module/platform/bilibili/push.js')

beforeEach(() => {
  shouldFilterMock.mockReset()
  shouldFilterMock.mockResolvedValue(false)
})

describe('normalizeBilibiliPushTypes', () => {
  const defaults = ['video', 'draw', 'word', 'live', 'forward', 'article']

  const cases = [
    { name: 'an undefined list', input: undefined, expected: defaults },
    { name: 'an empty list', input: [], expected: defaults },
    { name: 'a non-array value', input: 'video', expected: defaults },
    { name: 'a list of only invalid types', input: ['unknown', 'bogus'], expected: defaults },
    { name: 'a valid subset', input: ['video', 'live'], expected: ['video', 'live'] },
    { name: 'duplicated entries', input: ['draw', 'draw', 'word'], expected: ['draw', 'word'] },
    { name: 'a mix of valid and invalid types', input: ['article', 'nope', 'forward'], expected: ['article', 'forward'] },
    { name: 'a reordered list, preserving caller order', input: ['live', 'video'], expected: ['live', 'video'] }
  ]

  for (const { name, input, expected } of cases) {
    it(`normalizes ${name}`, () => {
      expect(normalizeBilibiliPushTypes(input as never)).toEqual(expected)
    })
  }

  it('returns a fresh array so callers cannot mutate the defaults', () => {
    const first = normalizeBilibiliPushTypes(undefined as never)
    first.push('video' as never)

    expect(normalizeBilibiliPushTypes(undefined as never)).toEqual(defaults)
  })
})

describe('Bilibilipush construction', () => {
  it('accepts a zero-argument construction for cron execution', () => {
    expect(() => new Bilibilipush()).not.toThrow()
  })
})

describe('extractEmojisData', () => {
  it('collects every complete emote across all paragraphs', () => {
    expect(extractEmojisData([
      { emote: [{ text: '[doge]', url: 'https://example.com/doge.png' }] },
      { emote: [{ text: '[妙]', url: 'https://example.com/miao.png' }] }
    ])).toEqual([
      { text: '[doge]', url: 'https://example.com/doge.png' },
      { text: '[妙]', url: 'https://example.com/miao.png' }
    ])
  })

  it('drops emotes that are missing a text or a url', () => {
    expect(extractEmojisData([
      { emote: [{ text: '[doge]', url: 'https://example.com/doge.png' }, { text: '[无图]' }, { url: 'https://example.com/no-text.png' }] }
    ])).toEqual([{ text: '[doge]', url: 'https://example.com/doge.png' }])
  })

  it('ignores paragraphs without an emote list', () => {
    expect(extractEmojisData([{ text: 'plain' }, {}])).toEqual([])
  })

  it('returns an empty list for a non-array value', () => {
    expect(extractEmojisData(undefined)).toEqual([])
    expect(extractEmojisData({ emote: [] })).toEqual([])
  })
})

describe('skipDynamic', () => {
  /** 构造一条只带 rich_text_nodes 的普通动态 */
  const plainDynamic = (nodes: unknown[]) => ({
    Dynamic_Data: {
      id_str: '857012345678901234',
      type: 'DYNAMIC_TYPE_WORD',
      modules: {
        module_dynamic: {
          desc: { rich_text_nodes: nodes }
        }
      }
    }
  })

  it('forwards the topic tags of a plain dynamic to the database filter', async () => {
    const pushItem = plainDynamic([
      { type: 'topic', orig_text: '#标签一#' },
      { type: 'text', orig_text: '正文' },
      { type: 'topic', orig_text: '#标签二#' }
    ])

    expect(await skipDynamic(pushItem as never)).toBe(false)
    expect(shouldFilterMock).toHaveBeenCalledWith(pushItem, ['#标签一#', '#标签二#'])
  })

  it('skips topic nodes without an orig_text', async () => {
    await skipDynamic(plainDynamic([{ type: 'topic' }, { type: 'topic', orig_text: '#有效#' }]) as never)

    expect(shouldFilterMock).toHaveBeenCalledWith(expect.anything(), ['#有效#'])
  })

  it('passes an empty tag list when the dynamic has no rich text nodes', async () => {
    await skipDynamic({
      Dynamic_Data: {
        id_str: '1',
        type: 'DYNAMIC_TYPE_WORD',
        modules: { module_dynamic: {} }
      }
    } as never)

    expect(shouldFilterMock).toHaveBeenCalledWith(expect.anything(), [])
  })

  const forwardMajorTypes = ['MAJOR_TYPE_DRAW', 'MAJOR_TYPE_OPUS', 'MAJOR_TYPE_LIVE_RCMD']

  for (const majorType of forwardMajorTypes) {
    it(`also collects the original topics of a forwarded ${majorType} dynamic`, async () => {
      const pushItem = {
        Dynamic_Data: {
          id_str: '2',
          type: 'DYNAMIC_TYPE_FORWARD',
          modules: {
            module_dynamic: {
              desc: { rich_text_nodes: [{ type: 'topic', orig_text: '#转发语标签#' }] }
            }
          },
          orig: {
            modules: {
              module_dynamic: {
                major: {
                  type: majorType,
                  opus: {
                    summary: {
                      rich_text_nodes: [
                        { type: 'topic', orig_text: '#原动态标签#' },
                        { type: 'text', orig_text: '原动态正文' }
                      ]
                    }
                  }
                }
              }
            }
          }
        }
      }

      expect(await skipDynamic(pushItem as never)).toBe(false)
      expect(shouldFilterMock).toHaveBeenCalledWith(pushItem, ['#转发语标签#', '#原动态标签#'])
    })
  }

  it('ignores the original dynamic when its major type is not an opus like type', async () => {
    const pushItem = {
      Dynamic_Data: {
        id_str: '3',
        type: 'DYNAMIC_TYPE_FORWARD',
        modules: {
          module_dynamic: {
            desc: { rich_text_nodes: [{ type: 'topic', orig_text: '#转发语标签#' }] }
          }
        },
        orig: {
          modules: {
            module_dynamic: {
              major: { type: 'MAJOR_TYPE_ARCHIVE', archive: { bvid: 'BV1' } }
            }
          }
        }
      }
    }

    expect(await skipDynamic(pushItem as never)).toBe(false)
    expect(shouldFilterMock).toHaveBeenCalledWith(pushItem, ['#转发语标签#'])
  })

  it('returns the database verdict', async () => {
    shouldFilterMock.mockResolvedValue(true)

    expect(await skipDynamic(plainDynamic([]) as never)).toBe(true)
  })
})
