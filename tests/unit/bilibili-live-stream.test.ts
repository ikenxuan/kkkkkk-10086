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

const { fetchBilibiliLiveStream, listBilibiliLiveStreams } = await import('../../src/module/platform/bilibili/live-stream.js')

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

/** 从 Networks 收到的 URL 里读出这次请求的 qn，用来给替身按档位造响应 */
const requestedQn = (url: string): number => Number(new URL(url).searchParams.get('qn'))

/** 按档位造一份响应：`current_qn` 跟着入参走，模拟官方真的给了那一档 */
const responseForQn = (qn: number): typeof okResponse => {
  const response = structuredClone(okResponse)
  const codec = response.data.playurl_info.playurl.stream[0]!.format[0]!.codec[0]!
  codec.current_qn = qn
  codec.base_url = `/live-bvc/123/live_456_${qn}.flv`
  return response
}

/**
 * 列清单是给用户看的，要的是全集；`fetchBilibiliLiveStream` 是给录制用的，只要一条。
 * 下面这组钉住的是「一个画质一条」「按画质降序」「一档失败不拖垮整张清单」，
 * 以及请求次数的护栏 —— 官方一次只回一档，所以这里的请求数就是清单长度。
 */
describe('listBilibiliLiveStreams', () => {
  it('按 accept_qn 逐档问，一个画质一条，画质降序', async () => {
    getData.mockImplementation(async () =>
      responseForQn(requestedQn(networksOptions.at(-1)!.url))
    )

    const entries = await listBilibiliLiveStreams(123456)

    expect(entries.map(entry => entry.qn)).toEqual([10000, 400, 250, 150])
    expect(entries[0].qualityName).toBe('原画')
    expect(entries[2].qualityName).toBe('超清')
    expect(entries[0].url).toContain('live_456_10000.flv')
    expect(entries[3].url).toContain('live_456_150.flv')
    // 第一次问原画顺便发现 accept_qn，剩下三档各一次
    expect(networksOptions).toHaveLength(4)
    expect(networksOptions.map(options => requestedQn(options.url))).toEqual([10000, 400, 250, 150])
  })

  // 官方对某些房间会把所有档都降级到同一个 current_qn，那时清单只该有一条
  it('同一个画质只出现一次', async () => {
    getData.mockResolvedValue(okResponse)

    const entries = await listBilibiliLiveStreams(123456)

    expect(entries).toHaveLength(1)
    expect(entries[0].qn).toBe(10000)
  })

  /*
    这一条钉的是 pickFromPlayurl 里那个「不提前 return」：第一个 codec 就有地址时，
    如果挑中就退出，accept_qn 只会收到那一个 codec 的，后面的档全部发现不了。
  */
  it('第一个 codec 就命中时也能拿到完整的 accept_qn', async () => {
    getData.mockImplementation(async () =>
      responseForQn(requestedQn(networksOptions.at(-1)!.url))
    )

    const entries = await listBilibiliLiveStreams(123456)

    expect(entries.length).toBeGreaterThan(1)
  })

  it('单档请求失败时跳过它，其余照常给出', async () => {
    globalThis.logger = { debug: vi.fn() } as unknown as typeof logger
    getData.mockImplementation(async () => {
      const qn = requestedQn(networksOptions.at(-1)!.url)
      if (qn === 250) throw new Error('CDN 拒了这一档')
      return responseForQn(qn)
    })

    const entries = await listBilibiliLiveStreams(123456)

    expect(entries.map(entry => entry.qn)).toEqual([10000, 400, 150])
  })

  it('第一次请求就拿不到地址时返回空数组，且不再追问', async () => {
    getData.mockResolvedValue({ code: 0, data: {} })

    const entries = await listBilibiliLiveStreams(123456)

    expect(entries).toEqual([])
    expect(networksOptions).toHaveLength(1)
  })

  // accept_qn 的顺序是接口给的，不保证从高到低
  it('accept_qn 乱序时按画质降序问', async () => {
    getData.mockImplementation(async () => {
      const qn = requestedQn(networksOptions.at(-1)!.url)
      const response = responseForQn(qn)
      response.data.playurl_info.playurl.stream[0]!.format[0]!.codec[0]!.accept_qn = [150, 10000, 250]
      return response
    })

    const entries = await listBilibiliLiveStreams(123456)

    expect(networksOptions.map(options => requestedQn(options.url))).toEqual([10000, 250, 150])
    expect(entries.map(entry => entry.qn)).toEqual([10000, 250, 150])
  })

  // 上游把 accept_qn 撑长时不该变成十几次请求
  it('请求次数有上限', async () => {
    getData.mockImplementation(async () => {
      const qn = requestedQn(networksOptions.at(-1)!.url)
      const response = responseForQn(qn)
      response.data.playurl_info.playurl.stream[0]!.format[0]!.codec[0]!.accept_qn =
        [30000, 20000, 10000, 400, 250, 150, 80, 60, 40, 20]
      return response
    })

    await listBilibiliLiveStreams(123456)

    expect(networksOptions).toHaveLength(6)
  })
})

/**
 * 同一档的 FLV 和 M3U8 在**同一份响应**里（protocol 那一维不额外花请求），
 * 所以清单必须把它展开。之前只按画质列一维，结果七条地址里一条 m3u8 都没有。
 */
describe('listBilibiliLiveStreams 协议维度', () => {
  /** 在 okResponse 上补一路 http_hls，模拟真实响应的两个 protocol */
  const withHls = (qn: number): typeof okResponse => {
    const response = responseForQn(qn)
    response.data.playurl_info.playurl.stream.push({
      protocol_name: 'http_hls',
      format: [
        {
          format_name: 'fmp4',
          codec: [
            {
              codec_name: 'avc',
              current_qn: qn,
              accept_qn: [10000, 400, 250, 150],
              base_url: `/live-bvc/123/live_456_${qn}/index.m3u8`,
              url_info: [{ host: 'https://cn-hls.bilivideo.com', extra: '?expires=1' }]
            }
          ]
        }
      ]
    } as never)
    return response
  }

  it('每个画质给出 FLV 与 M3U8 两条', async () => {
    getData.mockImplementation(async () => withHls(requestedQn(networksOptions.at(-1)!.url)))

    const entries = await listBilibiliLiveStreams(123456)

    expect(entries.map(entry => `${entry.qn}:${entry.protocol}`)).toEqual([
      '10000:flv', '10000:hls',
      '400:flv', '400:hls',
      '250:flv', '250:hls',
      '150:flv', '150:hls'
    ])
    expect(entries.find(entry => entry.protocol === 'hls')?.url).toContain('index.m3u8')
    // 协议维度不额外花请求：还是一档一次
    expect(networksOptions).toHaveLength(4)
  })

  it('hls 那条带上实际命中的容器格式', async () => {
    getData.mockImplementation(async () => withHls(requestedQn(networksOptions.at(-1)!.url)))

    const entries = await listBilibiliLiveStreams(123456)

    expect(entries.find(entry => entry.protocol === 'hls')?.format).toBe('fmp4')
    expect(entries.find(entry => entry.protocol === 'flv')?.format).toBe('flv')
  })

  // hevc 在不少播放器上放不了，同一个 (画质, 协议) 只该留 avc 那条
  it('同一档同协议的 avc 与 hevc 只留 avc', async () => {
    getData.mockImplementation(async () => {
      const qn = requestedQn(networksOptions.at(-1)!.url)
      const response = responseForQn(qn)
      response.data.playurl_info.playurl.stream[0]!.format[0]!.codec.unshift({
        codec_name: 'hevc',
        current_qn: qn,
        accept_qn: [10000],
        base_url: `/live-bvc/123/hevc_${qn}.flv`,
        url_info: [{ host: 'https://cn-example.bilivideo.com', extra: '?expires=1' }]
      } as never)
      return response
    })

    const entries = await listBilibiliLiveStreams(123456)

    expect(entries.filter(entry => entry.qn === 10000)).toHaveLength(1)
    expect(entries[0].url).not.toContain('hevc')
  })

  // 表外的 protocol_name 不知道该叫它什么，收了只会在转发里印出一个猜的标签
  it('认不出的 protocol_name 不进清单', async () => {
    getData.mockImplementation(async () => {
      const qn = requestedQn(networksOptions.at(-1)!.url)
      const response = responseForQn(qn)
      response.data.playurl_info.playurl.stream[0]!.protocol_name = 'http_brand_new'
      return response
    })

    expect(await listBilibiliLiveStreams(123456)).toEqual([])
  })
})
