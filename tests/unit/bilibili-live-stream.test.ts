import { beforeEach, describe, expect, it, vi } from 'vitest'

/** 每次 `new Networks()` 的构造参数，用来断言 URL 与请求头 */
const networksOptions = vi.hoisted(() => [] as { url: string, headers?: Record<string, string> }[])
const getData = vi.hoisted(() => vi.fn())

// 路径必须和 live-stream.ts 里 `@/module/utils/Network/index` 解析到同一个文件：
// vitest.config.ts 把 `@/` 映射到 src/，所以这里写相对路径 + .js 后缀，与
// ffmpeg-options / live-photo / theme 等九个测试文件对同一模块的写法一致。
// mock 路径是纯字符串，lint 和 typecheck 都不会告诉你它脱靶了，
// 脱靶的表现是测试真的去打 B站。实测把路径改错：只有断言具体取值的那 7 条会红，
// 15 条畸形响应用例照样全绿（它们只断言「返回空 url」，而真实请求打不通时
// 返回的也是空 url），整体耗时从 20ms 涨到 2.6s。
// 所以判断 mock 有没有脱靶，看耗时比看红绿准。
vi.mock('../../src/module/utils/Network/index.js', () => ({
  baseHeaders: { 'User-Agent': 'test-agent' },
  Networks: class {
    constructor (options: { url: string, headers?: Record<string, string> }) {
      networksOptions.push(options)
    }

    getData = getData
  }
}))

vi.mock('../../src/module/utils/Config.js', () => ({
  default: { cookies: { bilibili: 'SESSDATA=test' } }
}))

const { fetchBilibiliLiveStream } = await import('../../src/module/platform/bilibili/live-stream.js')

/**
 * 一份结构完整的正常响应，畸形用例都从它上面剪字段。
 *
 * 字段名与嵌套按 2026-08-31 的真机响应校准，但只保留代码真的会读的键：
 * 真实响应里 codec 有 16 个键（drm / session / is_pushing 等），塞进来只会让
 * fixture 变成「复刻一份响应」而不是「钉住代码依赖的形状」。
 * host / extra / base_url 用占位值 —— 真值带签名且会过期。
 */
const okResponse = {
  code: 0,
  data: {
    playurl_info: {
      playurl: {
        g_qn_desc: [
          { qn: 10000, desc: '原画' },
          { qn: 250, desc: '超清' }
        ],
        stream: [
          {
            protocol_name: 'http_stream',
            format: [
              {
                format_name: 'flv',
                codec: [
                  {
                    codec_name: 'avc',
                    current_qn: 10000,
                    accept_qn: [10000, 400, 250, 150],
                    base_url: '/live-bvc/123/live_456.flv',
                    url_info: [
                      {
                        host: 'https://cn-example.bilivideo.com',
                        extra: '?expires=1&trid=abc'
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  }
}

beforeEach(() => {
  networksOptions.length = 0
  getData.mockReset()
})

describe('fetchBilibiliLiveStream happy path', () => {
  it('joins host, base_url and extra into a playable url', async () => {
    getData.mockResolvedValue(okResponse)

    const pick = await fetchBilibiliLiveStream(123456)

    expect(pick.url).toBe(
      'https://cn-example.bilivideo.com/live-bvc/123/live_456.flv?expires=1&trid=abc'
    )
    expect(pick.format).toBe('flv')
  })

  it('reports the quality actually returned, not the requested one', async () => {
    // 请求 4K、官方降级到 250：显示给用户的必须是实际拿到的那一档
    getData.mockResolvedValue(okResponse)

    const pick = await fetchBilibiliLiveStream(123456, 20000)

    expect(pick.qn).toBe(10000)
    expect(pick.qualityName).toBe('原画')
  })

  it('falls back to the local qn name table when g_qn_desc is missing', async () => {
    const response = structuredClone(okResponse)
    delete (response.data.playurl_info.playurl as { g_qn_desc?: unknown }).g_qn_desc
    getData.mockResolvedValue(response)

    const pick = await fetchBilibiliLiveStream(123456)

    expect(pick.qualityName).toBe('原画')
  })

  it('skips a codec whose url_info is empty and takes the next usable one', async () => {
    const response = structuredClone(okResponse)
    const format = response.data.playurl_info.playurl.stream[0]!.format[0]!
    format.codec.unshift({
      codec_name: 'hevc',
      current_qn: 10000,
      accept_qn: [10000],
      base_url: '/live-bvc/dead.flv',
      url_info: []
    })
    getData.mockResolvedValue(response)

    const pick = await fetchBilibiliLiveStream(123456)

    expect(pick.url).toContain('live_456.flv')
  })

  it('requests the live playurl endpoint with the room id', async () => {
    getData.mockResolvedValue(okResponse)

    await fetchBilibiliLiveStream(789)

    const url = networksOptions[0]?.url ?? ''
    expect(url).toContain('api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo')
    expect(url).toContain('room_id=789')
  })
})

// B站的拉流 CDN 校验 Referer，不带就是 403。这条锁住的是「请求头没被后续重构弄丢」。
describe('fetchBilibiliLiveStream request headers', () => {
  it('sends a Referer pointing at the live room', async () => {
    getData.mockResolvedValue(okResponse)

    await fetchBilibiliLiveStream(654321)

    expect(networksOptions[0]?.headers?.Referer).toBe('https://live.bilibili.com/654321')
  })

  it('returns the same headers it used so the recorder can reuse them', async () => {
    getData.mockResolvedValue(okResponse)

    const pick = await fetchBilibiliLiveStream(654321)

    expect(pick.headers.Referer).toBe('https://live.bilibili.com/654321')
    expect(pick.headers.Origin).toBe('https://live.bilibili.com')
    expect(pick.headers.Cookie).toBe('SESSDATA=test')
  })

  it('keeps the shared baseHeaders', async () => {
    getData.mockResolvedValue(okResponse)

    await fetchBilibiliLiveStream(1)

    expect(networksOptions[0]?.headers?.['User-Agent']).toBe('test-agent')
  })
})

/**
 * 这一组是本次重构的核心诉求：官方改结构时不能抛
 * `TypeError: Cannot read properties of undefined (reading '0')`。
 * 每个用例都断言「不抛 + 返回空 url」，而不只是断言不抛。
 */
describe('fetchBilibiliLiveStream malformed responses', () => {
  const malformed: [string, unknown][] = [
    ['response is not an object', 'nope'],
    ['response is null', null],
    ['data is missing', { code: 0 }],
    ['data is null', { code: 0, data: null }],
    ['playurl_info is missing', { code: 0, data: {} }],
    ['playurl is missing', { code: 0, data: { playurl_info: {} } }],
    ['stream is missing', { code: 0, data: { playurl_info: { playurl: {} } } }],
    ['stream is an empty array', { code: 0, data: { playurl_info: { playurl: { stream: [] } } } }],
    [
      'stream items are not objects',
      { code: 0, data: { playurl_info: { playurl: { stream: ['x', 1, null] } } } }
    ],
    [
      'format is missing',
      { code: 0, data: { playurl_info: { playurl: { stream: [{}] } } } }
    ],
    [
      'format is an empty array',
      { code: 0, data: { playurl_info: { playurl: { stream: [{ format: [] }] } } } }
    ],
    [
      'codec is missing',
      { code: 0, data: { playurl_info: { playurl: { stream: [{ format: [{}] }] } } } }
    ],
    [
      'url_info is an empty array',
      {
        code: 0,
        data: {
          playurl_info: {
            playurl: { stream: [{ format: [{ codec: [{ base_url: '/a.flv', url_info: [] }] }] }] }
          }
        }
      }
    ],
    [
      'url_info items have no host',
      {
        code: 0,
        data: {
          playurl_info: {
            playurl: {
              stream: [{ format: [{ codec: [{ base_url: '/a.flv', url_info: [{ extra: '?x=1' }] }] }] }]
            }
          }
        }
      }
    ],
    [
      'base_url is missing so the url would be half-built',
      {
        code: 0,
        data: {
          playurl_info: {
            playurl: {
              stream: [{
                format: [{ codec: [{ url_info: [{ host: 'https://cn.example.com' }] }] }]
              }]
            }
          }
        }
      }
    ],
    // 上面的用例都是「缺了」或「空数组」，走不到四道 Array.isArray 的否定分支。
    // 下面四条把每一层换成非数组对象 —— 上游把某层从数组改成对象时就是这个形状。
    [
      'stream is an object instead of an array',
      { code: 0, data: { playurl_info: { playurl: { stream: { format: [] } } } } }
    ],
    [
      'format is an object instead of an array',
      { code: 0, data: { playurl_info: { playurl: { stream: [{ format: { codec: [] } }] } } } }
    ],
    [
      'codec is an object instead of an array',
      {
        code: 0,
        data: { playurl_info: { playurl: { stream: [{ format: [{ codec: { base_url: '/a.flv' } }] }] } } }
      }
    ],
    [
      'url_info is an object instead of an array',
      {
        code: 0,
        data: {
          playurl_info: {
            playurl: {
              stream: [{ format: [{ codec: [{ base_url: '/a.flv', url_info: { host: 'https://a.example.com' } }] }] }]
            }
          }
        }
      }
    ]
  ]

  it.each(malformed)('does not throw when %s', async (_name, response) => {
    getData.mockResolvedValue(response)

    const pick = await fetchBilibiliLiveStream(123456)

    expect(pick.url).toBe('')
    expect(pick.qn).toBe(0)
    // 即使一个地址都没取到，请求头也要照样回给调用点
    expect(pick.headers.Referer).toBe('https://live.bilibili.com/123456')
  })
})
